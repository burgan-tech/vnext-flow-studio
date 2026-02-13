import * as vscode from 'vscode';
import { WorkflowTestService } from '../testing/WorkflowTestService.js';
import { EnvironmentManager } from '../deployment/EnvironmentManager.js';
import { ClickHouseService } from './ClickHouseService.js';

interface WorkflowInfo {
  key: string;
  domain: string;
  version: string;
}

/**
 * Provider for the Zeebe-style Instance Monitor panel.
 * Shows all running instances for the current workflow, allows selecting
 * an instance, viewing its details, and highlighting its state path on the canvas.
 *
 * Data sources (prioritized):
 *  1. ClickHouse (if configured) — full transition history, analytics
 *  2. Runtime API (fallback) — current state only, limited history
 */
export class InstanceMonitorProvider {
  private static activePanels = new Map<string, vscode.WebviewPanel>();
  private static testService: WorkflowTestService;
  private static modelBridge: any;
  private static pollingIntervals = new Map<string, NodeJS.Timeout>();
  /** Cache of last fetched instances list — used as fallback when API calls fail */
  private static lastInstancesCache = new Map<string, Array<{ instanceId: string; state: string; status?: string; created: string }>>();

  /**
   * Register the instance monitor command
   */
  public static register(
    context: vscode.ExtensionContext,
    modelBridge: any
  ): vscode.Disposable {
    this.testService = new WorkflowTestService();
    this.modelBridge = modelBridge;

    console.log('[InstanceMonitorProvider] Registering command amorphie.openInstanceMonitor');

    const command = vscode.commands.registerCommand(
      'amorphie.openInstanceMonitor',
      (workflow?: WorkflowInfo) => {
        console.log('[InstanceMonitorProvider] Command triggered, workflow:', JSON.stringify(workflow));
        this.createOrShowPanel(context, workflow);
      }
    );

    return command;
  }

  /**
   * Try to create a ClickHouse service from the active environment
   */
  private static getClickHouseService(): ClickHouseService | null {
    const env = EnvironmentManager.getActiveEnvironment();
    if (env?.monitoring?.clickhouseUrl) {
      return new ClickHouseService(env.monitoring);
    }
    return null;
  }

  /**
   * Resolve domain — tries vnext.config.json, falls back to 'core'
   */
  private static async resolveDomain(domain?: string): Promise<string> {
    if (domain) return domain;
    try {
      const folders = vscode.workspace.workspaceFolders;
      if (folders) {
        for (const folder of folders) {
          try {
            const configPath = vscode.Uri.joinPath(folder.uri, 'vnext.config.json');
            const configBytes = await vscode.workspace.fs.readFile(configPath);
            const config = JSON.parse(Buffer.from(configBytes).toString('utf-8'));
            if (config.domain) {
              console.log(`[InstanceMonitorProvider] Resolved domain from vnext.config.json: ${config.domain}`);
              return config.domain;
            }
          } catch { /* no config in this folder */ }
        }
      }
    } catch { /* ignore */ }
    console.warn('[InstanceMonitorProvider] Domain not found, using fallback: core');
    return 'core';
  }

  /**
   * Create or show the monitor panel
   */
  private static async createOrShowPanel(
    context: vscode.ExtensionContext,
    workflow?: WorkflowInfo
  ): Promise<void> {
    console.log('[InstanceMonitorProvider] createOrShowPanel called, workflow:', JSON.stringify(workflow));

    const panelKey = workflow
      ? `monitor:${workflow.domain}/${workflow.key}`
      : 'instance-monitor';

    // Reuse existing panel
    const existing = this.activePanels.get(panelKey);
    if (existing) {
      existing.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'amorphieInstanceMonitor',
      workflow ? `Monitor: ${workflow.key}` : 'Instance Monitor',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist-web')]
      }
    );

    panel.webview.html = await this.getWebviewContent(panel.webview, context);
    this.activePanels.set(panelKey, panel);

    // Prepare init data (will be sent when webview signals ready)
    const buildInitData = async () => {
      const environments = EnvironmentManager.getEnvironments();
      let activeEnvId = EnvironmentManager.getActiveEnvironmentId();
      let envList = Object.values(environments).map(e => ({
        id: e.id,
        name: e.name || e.id,
        baseUrl: e.baseUrl,
        hasClickHouse: !!e.monitoring?.clickhouseUrl
      }));

      let autoDetected = false;
      let autoDetectedUrl = '';

      if (envList.length === 0) {
        console.log('[InstanceMonitorProvider] No environments found, trying auto-detect');
        const detected = await this.tryAutoDetectRuntime();
        if (detected) {
          autoDetected = true;
          autoDetectedUrl = detected;
          const refreshedEnvs = EnvironmentManager.getEnvironments();
          activeEnvId = EnvironmentManager.getActiveEnvironmentId();
          envList = Object.values(refreshedEnvs).map(e => ({
            id: e.id,
            name: e.name || e.id,
            baseUrl: e.baseUrl,
            hasClickHouse: !!e.monitoring?.clickhouseUrl
          }));
          this.testService = new WorkflowTestService();
        }
      } else if (activeEnvId) {
        this.testService = new WorkflowTestService();
      }

      return {
        type: 'init' as const,
        workflow,
        environments: envList,
        activeEnvironment: activeEnvId,
        hasEnvironment: envList.length > 0,
        autoDetected,
        autoDetectedUrl
      };
    };

    // Build init data ahead of time
    const initData = await buildInitData();
    let initSentViaMessage = false;

    // Message handler
    panel.webview.onDidReceiveMessage(
      async (message: any) => {
        // On first contact from webview, send init data (only once via message handler)
        if (!initSentViaMessage && (message.type === 'ready' || message.type === 'monitor:checkStatus')) {
          initSentViaMessage = true;
          console.log(`[InstanceMonitorProvider] Webview sent '${message.type}', sending init data`);
          panel.webview.postMessage(initData);
        }
        await this.handleMessage(message, panel, workflow, panelKey);
      },
      undefined,
      context.subscriptions
    );

    // Cleanup
    panel.onDidDispose(() => {
      this.activePanels.delete(panelKey);
      this.stopAllPolling(panelKey);
      if (this.modelBridge?.clearInstanceHighlight) {
        this.modelBridge.clearInstanceHighlight();
      }
    });

    // Also try to send init immediately (may or may not arrive depending on webview readiness)
    panel.webview.postMessage(initData);
  }

  /**
   * Handle messages from webview
   */
  private static async handleMessage(
    message: any,
    panel: vscode.WebviewPanel,
    workflow?: WorkflowInfo,
    panelKey?: string
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'ready':
          await this.handleCheckStatus(panel);
          break;

        case 'monitor:checkStatus':
          await this.handleCheckStatus(panel);
          break;

        case 'monitor:switchEnvironment':
          await this.handleSwitchEnvironment(message, panel);
          break;

        case 'monitor:listInstances':
          await this.handleListInstances(message, panel);
          break;

        case 'monitor:getInstanceDetail':
          await this.handleGetInstanceDetail(message, panel);
          break;

        case 'monitor:highlightInstance':
          this.handleHighlightInstance(message);
          break;

        case 'monitor:clearHighlight':
          this.handleClearHighlight();
          break;

        case 'monitor:showOnFlow':
          await this.handleShowOnFlow(message, panel);
          break;

        case 'monitor:clearOverlay':
          this.handleClearOverlay();
          break;

        case 'monitor:startPolling':
          this.handleStartPolling(message, panel, panelKey || '');
          break;

        case 'monitor:getWorkflowStats':
          await this.handleGetWorkflowStats(message, panel);
          break;

        case 'monitor:saveEnvironment':
          await this.handleSaveEnvironment(message, panel, workflow);
          break;

        case 'monitor:updateEnvironment':
          await this.handleUpdateEnvironment(message, panel, workflow);
          break;

        case 'monitor:deleteEnvironment':
          await this.handleDeleteEnvironment(message, panel, workflow);
          break;

        case 'monitor:getEnvironmentDetail': {
          const env = EnvironmentManager.getActiveEnvironment();
          if (env) {
            panel.webview.postMessage({
              type: 'monitor:environmentDetail',
              env: { id: env.id, name: env.name || env.id, baseUrl: env.baseUrl }
            });
          }
          break;
        }

        default:
          console.warn('[InstanceMonitorProvider] Unknown message type:', message.type);
      }
    } catch (error: any) {
      console.error('[InstanceMonitorProvider] Error:', error);
      panel.webview.postMessage({
        type: 'monitor:error',
        error: error.message
      });
    }
  }

  /**
   * Check API status + ClickHouse availability
   */
  private static async handleCheckStatus(panel: vscode.WebviewPanel): Promise<void> {
    const status = await this.testService.checkStatus();

    // Check ClickHouse availability
    let clickhouseAvailable = false;
    const ch = this.getClickHouseService();
    if (ch) {
      try {
        clickhouseAvailable = await ch.testConnection();
      } catch {
        clickhouseAvailable = false;
      }
    }

    panel.webview.postMessage({
      type: 'test:status',
      ...status,
      clickhouseAvailable
    });
  }

  /**
   * Switch active environment
   */
  private static async handleSwitchEnvironment(message: any, panel: vscode.WebviewPanel): Promise<void> {
    const { environmentId } = message;
    await EnvironmentManager.setActiveEnvironment(environmentId);

    // Re-check status with new environment
    await this.handleCheckStatus(panel);

    const env = EnvironmentManager.getActiveEnvironment();
    panel.webview.postMessage({
      type: 'monitor:environmentChanged',
      environmentId,
      hasClickHouse: !!env?.monitoring?.clickhouseUrl
    });
  }

  /**
   * List instances — prefer ClickHouse, fall back to Runtime API (with pagination)
   */
  private static async handleListInstances(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      const { workflowKey, page, pageSize, stateFilter } = message;
      const domain = await this.resolveDomain(message.domain);

      // Try ClickHouse first
      const ch = this.getClickHouseService();
      if (ch) {
        try {
          console.log('[InstanceMonitorProvider] Fetching instances from ClickHouse');
          const instances = await ch.getInstances(workflowKey, 100);

          // Cache for fallback use
          this.lastInstancesCache.set(workflowKey, instances);

          panel.webview.postMessage({
            type: 'monitor:instancesList',
            instances,
            source: 'clickhouse'
          });
          return;
        } catch (error: any) {
          console.warn('[InstanceMonitorProvider] ClickHouse query failed, falling back to API:', error.message);
        }
      }

      // Fallback: Runtime API with pagination
      const requestedPage = page || 1;
      const requestedPageSize = pageSize || 20;
      console.log(`[InstanceMonitorProvider] Fetching instances from Runtime API (page=${requestedPage}, pageSize=${requestedPageSize}, workflow=${workflowKey}, domain=${domain})`);

      const result = await this.testService.listInstances(
        { key: workflowKey, domain },
        { page: requestedPage, pageSize: requestedPageSize, state: stateFilter }
      );

      console.log(`[InstanceMonitorProvider] Got ${result.instances.length} instances, pagination:`, JSON.stringify(result.pagination));

      // Send instances immediately (without enrichment) for fast UI response
      panel.webview.postMessage({
        type: 'monitor:instancesList',
        instances: result.instances,
        source: 'api',
        pagination: result.pagination
      });

      // Cache instances
      this.lastInstancesCache.set(workflowKey, result.instances);

      // Enrich in background (update state/status info) — non-blocking
      this.enrichInstancesInBackground(result.instances, workflowKey, domain, panel);
    } catch (error: any) {
      console.error(`[InstanceMonitorProvider] handleListInstances FAILED: ${error.message}`);
      // Send empty list so UI stops loading + show error
      panel.webview.postMessage({
        type: 'monitor:instancesList',
        instances: [],
        source: 'api'
      });
      panel.webview.postMessage({
        type: 'monitor:error',
        error: `Failed to list instances: ${error.message}`
      });
    }
  }

  /**
   * Enrich instances in background — fetches state/status from /functions/state
   * and sends updated list to webview
   */
  private static async enrichInstancesInBackground(
    instances: Array<{ instanceId: string; state: string; status?: string; created: string }>,
    workflowKey: string,
    domain: string,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      const enriched = await Promise.all(
        instances.map(async (inst) => {
          try {
            const status = await this.testService.getStateFunctions(inst.instanceId, {
              key: workflowKey,
              domain
            });
            return {
              ...inst,
              state: status.state || inst.state,
              status: status.status || inst.status || 'A'
            };
          } catch {
            return { ...inst, status: inst.status || 'A' };
          }
        })
      );

      // Update cache
      this.lastInstancesCache.set(workflowKey, enriched);

      // Send enriched data to webview (silently updates)
      panel.webview.postMessage({
        type: 'monitor:instancesList',
        instances: enriched,
        source: 'api'
        // Don't resend pagination — it hasn't changed
      });

      console.log(`[InstanceMonitorProvider] Background enrichment complete for ${enriched.length} instances`);
    } catch (error: any) {
      console.warn('[InstanceMonitorProvider] Background enrichment failed:', error.message);
    }
  }

  /**
   * Get instance detail — ClickHouse gives us FULL transition history!
   * Falls back to minimal info if /functions/state fails (e.g. 400 errors).
   */
  private static async handleGetInstanceDetail(message: any, panel: vscode.WebviewPanel): Promise<void> {
    const { instanceId, workflowKey } = message;
    const domain = await this.resolveDomain(message.domain);

    // Try to get full state info (may fail for some instances)
    let status: any = null;
    let fetchError: string | null = null;

    try {
      status = await this.testService.getInstanceStatus(instanceId, {
        key: workflowKey,
        domain
      });
    } catch (error: any) {
      console.warn('[InstanceMonitorProvider] getInstanceStatus failed, using fallback:', error.message);
      fetchError = error.message;
    }

    // Get transition history — ClickHouse is the KEY advantage!
    let visitedStates: string[] = [];
    let transitionHistory: any[] = [];

    const ch = this.getClickHouseService();
    if (ch) {
      try {
        console.log('[InstanceMonitorProvider] Fetching transition history from ClickHouse');
        transitionHistory = await ch.getTransitionHistory(instanceId);
        visitedStates = await ch.getVisitedStates(instanceId);
        console.log('[InstanceMonitorProvider] ClickHouse: found', visitedStates.length, 'visited states');
      } catch (error: any) {
        console.warn('[InstanceMonitorProvider] ClickHouse history query failed:', error.message);
      }
    }

    if (status) {
      // Normal path — full data available
      if (visitedStates.length === 0) {
        if (status.data?.stateHistory && Array.isArray(status.data.stateHistory)) {
          visitedStates = status.data.stateHistory;
        } else if (status.data?.history && Array.isArray(status.data.history)) {
          visitedStates = status.data.history.map((h: any) => h.state || h.stateKey || h);
        }
      }

      if (status.state && !visitedStates.includes(status.state)) {
        visitedStates.push(status.state);
      }

      const statusCode = status.isFinal
        ? (status.error ? 'F' : 'C')
        : 'A';

      panel.webview.postMessage({
        type: 'monitor:instanceDetail',
        detail: {
          instanceId,
          currentState: status.state,
          status: statusCode,
          data: status.data,
          transitions: status.availableTransitions || [],
          visitedStates,
          transitionHistory,
          isFinal: status.isFinal,
          activeCorrelations: status.data?.activeCorrelations
        }
      });
    } else {
      // Fallback — /functions/state failed
      // Try to get info from: 1) message (webview sent), 2) cached instance list, 3) defaults
      const cachedInstances = this.lastInstancesCache.get(workflowKey) || [];
      const cachedInst = cachedInstances.find(i => i.instanceId === instanceId);

      const fallbackState = message.currentState || message.state || cachedInst?.state || 'unknown';
      const fallbackStatus = message.status || cachedInst?.status || 'A';

      if (fallbackState !== 'unknown' && !visitedStates.includes(fallbackState)) {
        visitedStates.push(fallbackState);
      }

      console.log('[InstanceMonitorProvider] Using fallback for instance detail:', {
        instanceId,
        fallbackState,
        fallbackStatus,
        fromMessage: !!message.currentState,
        fromCache: !!cachedInst,
        visitedStatesCount: visitedStates.length,
        transitionHistoryCount: transitionHistory.length,
        error: fetchError
      });

      panel.webview.postMessage({
        type: 'monitor:instanceDetail',
        detail: {
          instanceId,
          currentState: fallbackState,
          status: fallbackStatus,
          data: null,
          transitions: [],
          visitedStates,
          transitionHistory,
          isFinal: fallbackStatus === 'C' || fallbackStatus === 'F',
          error: fetchError
        }
      });
    }
  }

  /**
   * Get workflow stats from ClickHouse
   */
  private static async handleGetWorkflowStats(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      const ch = this.getClickHouseService();
      if (!ch) {
        panel.webview.postMessage({
          type: 'monitor:workflowStats',
          stats: null,
          error: 'ClickHouse not configured'
        });
        return;
      }

      const stats = await ch.getWorkflowStats(message.workflowKey);
      panel.webview.postMessage({
        type: 'monitor:workflowStats',
        stats
      });
    } catch (error: any) {
      panel.webview.postMessage({
        type: 'monitor:error',
        error: `Failed to get workflow stats: ${error.message}`
      });
    }
  }

  /**
   * Save environment configuration from the setup form
   */
  private static async handleSaveEnvironment(
    message: any,
    panel: vscode.WebviewPanel,
    workflow?: WorkflowInfo
  ): Promise<void> {
    try {
      const envId = 'local';
      const envConfig = {
        id: envId,
        name: message.name || 'Local Development',
        baseUrl: (message.baseUrl || '').replace(/\/$/, '')
      };

      await EnvironmentManager.saveEnvironment(envConfig as any);
      await EnvironmentManager.setActiveEnvironment(envId);

      // Recreate test service with new environment
      this.testService = new WorkflowTestService();

      // Notify webview
      panel.webview.postMessage({ type: 'monitor:environmentSaved' });

      // Re-check status
      await this.handleCheckStatus(panel);

      // Re-send environment list
      const environments = EnvironmentManager.getEnvironments();
      const envList = Object.values(environments).map(e => ({
        id: e.id,
        name: e.name || e.id,
        baseUrl: e.baseUrl,
        hasClickHouse: !!e.monitoring?.clickhouseUrl
      }));

      panel.webview.postMessage({
        type: 'init',
        workflow,
        environments: envList,
        activeEnvironment: envId,
        hasEnvironment: true
      });

      console.log('[InstanceMonitorProvider] Environment saved:', envConfig.baseUrl);
    } catch (error: any) {
      panel.webview.postMessage({
        type: 'monitor:error',
        error: `Failed to save environment: ${error.message}`
      });
    }
  }

  /**
   * Try to auto-detect a locally running Amorphie runtime
   * Probes common ports with a health check endpoint
   */
  private static async tryAutoDetectRuntime(): Promise<string | null> {
    const ports = [4201, 5000, 5001, 3000, 8080];
    // Try multiple health endpoints — different runtimes use different paths
    const healthPaths = ['/health', '/api/health', '/healthz', '/api/v1.0/health'];

    for (const port of ports) {
      const baseUrl = `http://localhost:${port}`;

      // First: just try to connect to the port (any response = port is open)
      for (const path of healthPaths) {
        try {
          console.log(`[InstanceMonitorProvider] Probing ${baseUrl}${path} ...`);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 1500);

          const response = await fetch(`${baseUrl}${path}`, {
            method: 'GET',
            signal: controller.signal
          });
          clearTimeout(timeout);

          if (response.ok || response.status < 500) {
            console.log(`[InstanceMonitorProvider] Auto-detected runtime at ${baseUrl} (${path} → ${response.status})`);

            // Save as environment
            const envConfig = {
              id: 'local',
              name: 'Local (Auto-detected)',
              baseUrl
            };
            await EnvironmentManager.saveEnvironment(envConfig as any);
            await EnvironmentManager.setActiveEnvironment('local');

            return baseUrl;
          }
        } catch {
          // Path not reachable, try next
        }
      }

      // Fallback: try a raw TCP-like check — just fetch the base URL
      try {
        console.log(`[InstanceMonitorProvider] Probing ${baseUrl}/ ...`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const response = await fetch(baseUrl, {
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeout);

        // Any response means the port is alive
        if (response.status < 500) {
          console.log(`[InstanceMonitorProvider] Auto-detected runtime at ${baseUrl} (root → ${response.status})`);

          const envConfig = {
            id: 'local',
            name: 'Local (Auto-detected)',
            baseUrl
          };
          await EnvironmentManager.saveEnvironment(envConfig as any);
          await EnvironmentManager.setActiveEnvironment('local');

          return baseUrl;
        }
      } catch {
        // Port not reachable
      }
    }

    console.log('[InstanceMonitorProvider] No local runtime detected');
    return null;
  }

  /**
   * Update an existing environment configuration
   */
  private static async handleUpdateEnvironment(
    message: any,
    panel: vscode.WebviewPanel,
    workflow?: WorkflowInfo
  ): Promise<void> {
    try {
      const { envId, baseUrl, name } = message;

      // Get existing env to preserve other fields (monitoring, database, auth)
      const environments = EnvironmentManager.getEnvironments();
      const existing = environments[envId];

      const updatedConfig = {
        ...(existing || {}),
        id: envId,
        name: name || 'Local Development',
        baseUrl: (baseUrl || '').replace(/\/$/, '')
      };

      await EnvironmentManager.saveEnvironment(updatedConfig as any);

      // Recreate test service
      this.testService = new WorkflowTestService();

      // Notify webview
      panel.webview.postMessage({ type: 'monitor:environmentUpdated' });

      // Re-check status
      await this.handleCheckStatus(panel);

      // Re-send environment list
      this.sendEnvironmentList(panel, workflow, EnvironmentManager.getActiveEnvironmentId());

      console.log('[InstanceMonitorProvider] Environment updated:', updatedConfig.baseUrl);
    } catch (error: any) {
      panel.webview.postMessage({
        type: 'monitor:error',
        error: `Failed to update environment: ${error.message}`
      });
    }
  }

  /**
   * Delete an environment configuration
   */
  private static async handleDeleteEnvironment(
    message: any,
    panel: vscode.WebviewPanel,
    workflow?: WorkflowInfo
  ): Promise<void> {
    try {
      const { envId } = message;

      await EnvironmentManager.removeEnvironment(envId);

      // Recreate test service
      this.testService = new WorkflowTestService();

      // Check if any environments remain
      const environments = EnvironmentManager.getEnvironments();
      const envList = Object.values(environments).map(e => ({
        id: e.id,
        name: e.name || e.id,
        baseUrl: e.baseUrl,
        hasClickHouse: !!e.monitoring?.clickhouseUrl
      }));

      const activeEnvId = EnvironmentManager.getActiveEnvironmentId();

      panel.webview.postMessage({
        type: 'init',
        workflow,
        environments: envList,
        activeEnvironment: activeEnvId,
        hasEnvironment: envList.length > 0
      });

      console.log('[InstanceMonitorProvider] Environment deleted:', envId);
    } catch (error: any) {
      panel.webview.postMessage({
        type: 'monitor:error',
        error: `Failed to delete environment: ${error.message}`
      });
    }
  }

  /**
   * Helper: send updated environment list to webview
   */
  private static sendEnvironmentList(
    panel: vscode.WebviewPanel,
    workflow?: WorkflowInfo,
    activeEnvId?: string
  ): void {
    const environments = EnvironmentManager.getEnvironments();
    const envList = Object.values(environments).map(e => ({
      id: e.id,
      name: e.name || e.id,
      baseUrl: e.baseUrl,
      hasClickHouse: !!e.monitoring?.clickhouseUrl
    }));

    panel.webview.postMessage({
      type: 'init',
      workflow,
      environments: envList,
      activeEnvironment: activeEnvId,
      hasEnvironment: envList.length > 0
    });
  }

  /**
   * Highlight instance state path on canvas
   */
  private static handleHighlightInstance(message: any): void {
    if (!this.modelBridge) return;

    const { workflowKey, currentState, visitedStates } = message;

    if (visitedStates && visitedStates.length > 0 && this.modelBridge.broadcastHistoryHighlight) {
      this.modelBridge.broadcastHistoryHighlight(workflowKey, visitedStates, currentState);
    } else if (this.modelBridge.broadcastInstanceHighlight) {
      this.modelBridge.broadcastInstanceHighlight(message.instanceId, workflowKey, currentState);
    }
  }

  /**
   * Clear canvas highlighting
   */
  private static handleClearHighlight(): void {
    if (this.modelBridge?.clearInstanceHighlight) {
      this.modelBridge.clearInstanceHighlight();
    }
  }

  /**
   * Show instance execution path on the flow canvas (Zeebe Operate style)
   */
  private static async handleShowOnFlow(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      const { instanceId, workflowKey } = message;
      const domain = await this.resolveDomain(message.domain);

      // Get instance state info (may fail for some instances)
      let stateInfo: any;
      try {
        stateInfo = await this.testService.getStateFunctions(instanceId, {
          key: workflowKey,
          domain
        });
      } catch (err: any) {
        console.warn('[InstanceMonitorProvider] getStateFunctions failed for showOnFlow, using fallback:', err.message);
        // Use fallback info from: 1) message, 2) cache, 3) defaults
        const cachedInstances = this.lastInstancesCache.get(workflowKey) || [];
        const cachedInst = cachedInstances.find(i => i.instanceId === instanceId);

        const fallbackState = message.currentState || cachedInst?.state || 'unknown';
        const fallbackStatus = message.status || cachedInst?.status || 'A';

        stateInfo = {
          state: fallbackState,
          status: fallbackStatus,
          transitions: [],
          isFinal: fallbackStatus === 'C' || fallbackStatus === 'F'
        };
      }

      // Get instance data
      let instanceData: any = {};
      if (stateInfo.dataHref) {
        try {
          instanceData = await this.testService.fetchInstanceDataFromHref(stateInfo.dataHref);
        } catch { /* ignore */ }
      }

      // Get visited states — prefer ClickHouse
      let visitedStates: string[] = [];
      let transitionHistory: any[] = [];

      const ch = this.getClickHouseService();
      if (ch) {
        try {
          visitedStates = await ch.getVisitedStates(instanceId);
          transitionHistory = await ch.getTransitionHistory(instanceId);
        } catch { /* ignore, fall through */ }
      }

      // Fallback: extract from runtime data
      if (visitedStates.length === 0) {
        if (instanceData?.stateHistory && Array.isArray(instanceData.stateHistory)) {
          visitedStates = instanceData.stateHistory;
        } else if (instanceData?.history && Array.isArray(instanceData.history)) {
          visitedStates = instanceData.history.map((h: any) => h.state || h.stateKey || h);
        }
      }

      // Always include current state
      if (stateInfo.state && !visitedStates.includes(stateInfo.state)) {
        visitedStates.push(stateInfo.state);
      }

      // Build overlay data
      const overlay = this.buildOverlayData(
        stateInfo,
        visitedStates,
        transitionHistory,
        instanceId,
        instanceData
      );

      // Broadcast to canvas
      if (this.modelBridge?.broadcastMonitoringOverlay) {
        this.modelBridge.broadcastMonitoringOverlay(instanceId, workflowKey, overlay);
      }

      // Also notify monitor panel
      panel.webview.postMessage({
        type: 'monitor:showOnFlowResult',
        success: true,
        overlay
      });

      console.log('[InstanceMonitorProvider] Monitoring overlay sent for instance:', instanceId,
        'states:', Object.keys(overlay.states).length,
        'edges:', Object.keys(overlay.edges).length);
    } catch (error: any) {
      console.error('[InstanceMonitorProvider] showOnFlow error:', error);
      panel.webview.postMessage({
        type: 'monitor:error',
        error: `Failed to show on flow: ${error.message}`
      });
    }
  }

  /**
   * Clear monitoring overlay from canvas
   */
  private static handleClearOverlay(): void {
    if (this.modelBridge?.clearMonitoringOverlay) {
      this.modelBridge.clearMonitoringOverlay();
    }
  }

  /**
   * Build MonitoringOverlayData from instance info
   */
  private static buildOverlayData(
    stateInfo: {
      state: string;
      status: string;
      transitions: string[];
      isFinal: boolean;
    },
    visitedStates: string[],
    transitionHistory: any[],
    instanceId: string,
    instanceData: any
  ): any {
    const states: Record<string, any> = {};
    const edges: Record<string, any> = {};

    // Determine instance overall status
    const instanceStatus = stateInfo.status || (stateInfo.isFinal ? 'C' : 'A');

    // Build state overlays from visited states
    visitedStates.forEach((stateKey, index) => {
      const isCurrent = stateKey === stateInfo.state;
      let status: string;

      if (isCurrent && !stateInfo.isFinal) {
        // Active instance, current state
        status = 'active';
      } else if (isCurrent && stateInfo.isFinal) {
        // Final state reached
        if (instanceStatus === 'F' || instanceStatus === 'C') {
          status = 'completed';
        } else {
          status = 'error';
        }
      } else {
        // Previously visited state
        status = 'completed';
      }

      states[stateKey] = {
        status,
        visitOrder: index + 1,
        stateData: isCurrent ? instanceData : undefined
      };
    });

    // Build edge overlays from transition history
    if (transitionHistory.length > 0) {
      transitionHistory.forEach((t: any) => {
        const sourceState = t.fromState || t.source;
        const transitionKey = t.transitionName || t.transition || t.name;
        if (sourceState && transitionKey) {
          const edgeId = `t:local:${sourceState}:${transitionKey}`;
          edges[edgeId] = {
            status: 'traversed',
            traversalTime: t.createdAt || t.timestamp,
            duration: t.duration
          };
        }
      });
    } else {
      // No transition history: infer edges from visited state sequence
      for (let i = 0; i < visitedStates.length - 1; i++) {
        const fromState = visitedStates[i];
        // We can't know exact transition key, mark all edges from this state
        // Canvas will match by source state
        const edgePrefix = `t:local:${fromState}:`;
        edges[edgePrefix] = {
          status: 'traversed',
          _matchPrefix: true  // Canvas will do prefix matching
        };
      }
    }

    return {
      states,
      edges,
      instanceId,
      instanceStatus,
      currentState: stateInfo.state
    };
  }

  /**
   * Start polling for instance state changes
   */
  private static handleStartPolling(message: any, panel: vscode.WebviewPanel, panelKey: string): void {
    const { instanceId, workflowKey } = message;
    const domain = message.domain || 'core';
    const pollKey = `${panelKey}:${instanceId}`;

    this.stopPolling(pollKey);

    let attempts = 0;
    const maxAttempts = 300; // 10 minutes at 2s intervals

    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5; // Stop after 5 consecutive failures
    let lastVisitedStates: string[] = [];
    let lastCurrentState: string = '';

    const poll = async () => {
      // Try to get instance status (may fail for some instances)
      let status: any = null;
      try {
        status = await this.testService.getInstanceStatus(instanceId, {
          key: workflowKey,
          domain
        });
        consecutiveErrors = 0; // Reset on success
      } catch (error: any) {
        consecutiveErrors++;
        console.warn(`[InstanceMonitorProvider] Polling error (${consecutiveErrors}/${maxConsecutiveErrors}):`, error.message);

        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.error('[InstanceMonitorProvider] Too many consecutive polling errors, stopping');
          panel.webview.postMessage({
            type: 'monitor:pollingError',
            instanceId,
            error: `Polling stopped after ${maxConsecutiveErrors} consecutive errors: ${error.message}`
          });
          this.stopPolling(pollKey);
          return;
        }

        // Continue polling despite error — schedule next attempt
        if (attempts++ < maxAttempts) {
          const interval = setTimeout(poll, 2000);
          this.pollingIntervals.set(pollKey, interval);
        } else {
          this.stopPolling(pollKey);
        }
        return;
      }

      // Get visited states — prefer ClickHouse
      let visitedStates: string[] = [];
      const ch = this.getClickHouseService();
      if (ch) {
        try {
          visitedStates = await ch.getVisitedStates(instanceId);
        } catch { /* ignore, fall through */ }
      }

      if (visitedStates.length === 0) {
        if (status.data?.stateHistory && Array.isArray(status.data.stateHistory)) {
          visitedStates = status.data.stateHistory;
        } else if (status.data?.history && Array.isArray(status.data.history)) {
          visitedStates = status.data.history.map((h: any) => h.state || h.stateKey || h);
        }
      }

      if (status.state && !visitedStates.includes(status.state)) {
        visitedStates.push(status.state);
      }

      const statusCode = status.isFinal
        ? (status.error ? 'F' : 'C')
        : 'A';

      panel.webview.postMessage({
        type: 'monitor:instanceUpdate',
        instanceId,
        currentState: status.state,
        status: statusCode,
        data: status.data,
        transitions: status.availableTransitions || [],
        visitedStates,
        isFinal: status.isFinal,
        activeCorrelations: status.data?.activeCorrelations
      });

      // Only broadcast canvas highlighting if visited states or current state actually changed
      const statesChanged = lastVisitedStates.length !== visitedStates.length ||
        lastVisitedStates.join(',') !== visitedStates.join(',') ||
        lastCurrentState !== status.state;

      if (statesChanged && this.modelBridge?.broadcastHistoryHighlight && visitedStates.length > 0) {
        this.modelBridge.broadcastHistoryHighlight(workflowKey, visitedStates, status.state);
        lastVisitedStates = [...visitedStates];
        lastCurrentState = status.state;
      }

      if (status.isFinal) {
        this.stopPolling(pollKey);
        return;
      }

      if (attempts++ < maxAttempts) {
        const interval = setTimeout(poll, 2000);
        this.pollingIntervals.set(pollKey, interval);
      } else {
        this.stopPolling(pollKey);
      }
    };

    poll();
  }

  /**
   * Stop polling for a key
   */
  private static stopPolling(key: string): void {
    const interval = this.pollingIntervals.get(key);
    if (interval) {
      clearTimeout(interval);
      this.pollingIntervals.delete(key);
    }
  }

  /**
   * Stop all polling for a panel
   */
  private static stopAllPolling(panelKeyPrefix: string): void {
    for (const [key, interval] of this.pollingIntervals) {
      if (key.startsWith(panelKeyPrefix)) {
        clearTimeout(interval);
        this.pollingIntervals.delete(key);
      }
    }
  }

  /**
   * Get webview HTML content
   */
  private static async getWebviewContent(
    webview: vscode.Webview,
    context: vscode.ExtensionContext
  ): Promise<string> {
    try {
      const webviewDistPath = vscode.Uri.joinPath(context.extensionUri, 'dist-web');
      const htmlUri = vscode.Uri.joinPath(webviewDistPath, 'instanceMonitor.html');
      const htmlContent = await vscode.workspace.fs.readFile(htmlUri);
      let html = new TextDecoder().decode(htmlContent);

      const webviewUri = webview.asWebviewUri(webviewDistPath);

      const cspContent = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data: https:; connect-src ${webview.cspSource} https:;`;
      const cspTag = `\n    <meta http-equiv="Content-Security-Policy" content="${cspContent}">`;

      html = html.replace(/<head>/i, `<head>${cspTag}`);
      html = html.replace(/(src|href)="\.\//g, (_, attr) => `${attr}="${webviewUri}/`);

      return html;
    } catch (error) {
      console.error('Failed to load instance monitor webview content:', error);
      return `<!DOCTYPE html>
        <html>
          <head><title>Instance Monitor</title></head>
          <body>
            <div style="padding: 20px; font-family: Arial, sans-serif;">
              <h2>Instance Monitor Not Built</h2>
              <p>Run <code>npm run build</code> to build the webview.</p>
              <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
            </div>
          </body>
        </html>`;
    }
  }
}
