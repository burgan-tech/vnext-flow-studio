import * as vscode from 'vscode';
import { WorkflowTestService } from './WorkflowTestService.js';
import { TestCaseManager } from './TestCaseManager.js';
import type { MsgFromWebview, MsgToWebview } from '@amorphie-flow-studio/core';

interface WorkflowInfo {
  key: string;
  domain: string;
  version: string;
}

/**
 * Provider for workflow test runner webview panel
 */
export class TestPanelProvider {
  private static activePanels = new Map<string, vscode.WebviewPanel>();
  private static testService: WorkflowTestService;
  private static testCaseManager: TestCaseManager;
  private static modelBridge: any;
  private static pollingIntervals = new Map<string, NodeJS.Timeout>();

  /**
   * Register the test panel provider
   */
  public static register(
    context: vscode.ExtensionContext,
    modelBridge: any
  ): vscode.Disposable {
    this.testService = new WorkflowTestService();
    this.testCaseManager = new TestCaseManager(context);
    this.modelBridge = modelBridge;

    const command = vscode.commands.registerCommand(
      'amorphie.openTestPanel',
      (workflow?: WorkflowInfo) => {
        this.createOrShowPanel(context, workflow);
      }
    );

    return command;
  }

  /**
   * Create or show existing test panel
   */
  private static async createOrShowPanel(
    context: vscode.ExtensionContext,
    workflow?: WorkflowInfo
  ): Promise<void> {
    // Create unique key for this workflow
    const panelKey = workflow
      ? `${workflow.domain}/${workflow.key}@${workflow.version}`
      : 'test-runner';

    // Check if panel already exists
    const existingPanel = this.activePanels.get(panelKey);
    if (existingPanel) {
      existingPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'amorphieTestRunner',
      workflow ? `Test: ${workflow.key}` : 'Workflow Test Runner',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist-web')]
      }
    );

    // Set HTML content
    panel.webview.html = await this.getWebviewContent(panel.webview, context);

    // Track panel
    this.activePanels.set(panelKey, panel);

    // Setup message handling
    panel.webview.onDidReceiveMessage(
      async (message: MsgFromWebview) => {
        await this.handleMessage(message, panel, workflow, panelKey);
      },
      undefined,
      context.subscriptions
    );

    // Cleanup on dispose
    panel.onDidDispose(() => {
      this.activePanels.delete(panelKey);
      // Clear any polling intervals
      this.stopPolling(panelKey);
    });

    // Send initial data
    panel.webview.postMessage({
      type: 'init',
      workflow
    } as MsgToWebview);
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
          await this.handleReady(panel, workflow);
          break;

        case 'test:checkStatus':
          await this.handleCheckStatus(panel);
          break;

        case 'test:start':
          await this.handleStartTest(message, panel, panelKey || '');
          break;

        case 'test:pollInstance':
          await this.handlePollInstance(message, panel);
          break;

        case 'test:executeTransition':
          await this.handleExecuteTransition(message, panel);
          break;

        case 'test:listInstances':
          await this.handleListInstances(message, panel);
          break;

        case 'test:connectInstance':
          this.handleConnectInstance(message);
          break;

        case 'test:disconnectInstance':
          this.handleDisconnectInstance();
          break;

        case 'test:highlightHistory':
          this.handleHighlightHistory(message);
          break;

        case 'test:saveTestCase':
          await this.handleSaveTestCase(message, panel);
          break;

        case 'test:loadTestCases':
          await this.handleLoadTestCases(message, panel);
          break;

        case 'test:deleteTestCase':
          await this.handleDeleteTestCase(message, panel);
          break;

        case 'test:getModelTransitions':
          await this.handleGetModelTransitions(message, panel);
          break;

        case 'test:loadSchema':
          await this.handleLoadSchema(message, panel);
          break;

        case 'test:getStartTransitionSchema':
          await this.handleGetStartTransitionSchema(message, panel);
          break;

        case 'test:getSubFlowModel':
          await this.handleGetSubFlowModel(message, panel);
          break;

        default:
          console.warn('[TestPanelProvider] Unknown message type:', message.type);
      }
    } catch (error: any) {
      console.error('[TestPanelProvider] Error handling message:', error);
      panel.webview.postMessage({
        type: 'test:error',
        error: error.message
      } as MsgToWebview);
    }
  }

  /**
   * Handle ready message - send initial status
   */
  private static async handleReady(
    panel: vscode.WebviewPanel,
    workflow?: WorkflowInfo
  ): Promise<void> {
    // Check status
    const status = await this.testService.checkStatus();
    panel.webview.postMessage({
      type: 'test:status',
      ...status
    } as MsgToWebview);

    // Load test cases if workflow provided
    if (workflow) {
      const testCases = await this.testCaseManager.loadTestCases(workflow.key);
      panel.webview.postMessage({
        type: 'test:testCases',
        testCases
      } as MsgToWebview);
    }
  }

  /**
   * Handle check status request
   */
  private static async handleCheckStatus(panel: vscode.WebviewPanel): Promise<void> {
    const status = await this.testService.checkStatus();
    panel.webview.postMessage({
      type: 'test:status',
      ...status
    } as MsgToWebview);
  }

  /**
   * Handle start test request
   */
  private static async handleStartTest(
    message: any,
    panel: vscode.WebviewPanel,
    _panelKey: string
  ): Promise<void> {
    try {
      const { workflowKey, domain, version, inputData } = message;

      const result = await this.testService.startInstance(
        { key: workflowKey, domain, version },
        inputData
      );

      // Send instance created notification
      panel.webview.postMessage({
        type: 'test:instanceCreated',
        instanceId: result.instanceId,
        workflowKey,
        initialState: result.initialState
      } as MsgToWebview);

      // Fetch state with transitions and data (one-time call, no polling)
      const status = await this.testService.getInstanceStatus(result.instanceId, {
        key: workflowKey,
        domain
      });

      // Send state update with full data including activeCorrelations
      panel.webview.postMessage({
        type: 'test:instanceUpdate',
        instanceId: result.instanceId,
        currentState: status.state,
        data: status.data,
        transitions: status.availableTransitions || []
      } as MsgToWebview);
    } catch (error: any) {
      panel.webview.postMessage({
        type: 'test:error',
        error: error.message
      } as MsgToWebview);
    }
  }

  /**
   * Start polling an instance
   */
  private static startPolling(
    panelKey: string,
    instanceId: string,
    workflowKey: string,
    domain: string,
    panel: vscode.WebviewPanel
  ): void {
    // Clear existing polling
    this.stopPolling(panelKey);

    let attempts = 0;
    const maxAttempts = 150; // 5 minutes at 2s intervals

    const poll = async () => {
      try {
        const status = await this.testService.getInstanceStatus(instanceId, {
          key: workflowKey,
          domain
        });

        panel.webview.postMessage({
          type: 'test:instanceUpdate',
          instanceId,
          currentState: status.state,
          data: status.data,
          transitions: status.availableTransitions || []
        } as MsgToWebview);

        // Check if completed (final state or error)
        if (status.isFinal || status.error) {
          panel.webview.postMessage({
            type: 'test:instanceCompleted',
            instanceId,
            finalState: status.state,
            data: status.data
          } as MsgToWebview);
          this.stopPolling(panelKey);
          return;
        }

        // Continue polling
        if (attempts++ < maxAttempts) {
          const interval = setTimeout(poll, 2000);
          this.pollingIntervals.set(panelKey, interval);
        } else {
          this.stopPolling(panelKey);
        }
      } catch (error: any) {
        panel.webview.postMessage({
          type: 'test:error',
          instanceId,
          error: error.message
        } as MsgToWebview);
        this.stopPolling(panelKey);
      }
    };

    // Start first poll
    poll();
  }

  /**
   * Stop polling for a panel
   */
  private static stopPolling(panelKey: string): void {
    const interval = this.pollingIntervals.get(panelKey);
    if (interval) {
      clearTimeout(interval);
      this.pollingIntervals.delete(panelKey);
    }
  }

  /**
   * Handle manual poll request
   */
  private static async handlePollInstance(
    message: any,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      const { instanceId, workflowKey, domain } = message;

      const status = await this.testService.getInstanceStatus(instanceId, {
        key: workflowKey,
        domain
      });

      panel.webview.postMessage({
        type: 'test:instanceUpdate',
        instanceId,
        currentState: status.state,
        data: status.data,
        transitions: status.availableTransitions || []
      } as MsgToWebview);
    } catch (error: any) {
      panel.webview.postMessage({
        type: 'test:error',
        instanceId: message.instanceId,
        error: error.message
      } as MsgToWebview);
    }
  }

  /**
   * Handle execute transition request
   */
  private static async handleExecuteTransition(
    message: any,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      const { instanceId, transitionKey, workflowKey, domain, data } = message;

      // Execute transition with sync=true to get immediate response
      const result = await this.testService.executeTransition(instanceId, transitionKey, {
        key: workflowKey,
        domain
      }, data);

      // Send immediate state update with data from sync response
      if (result.isFinal) {
        panel.webview.postMessage({
          type: 'test:instanceCompleted',
          instanceId,
          finalState: result.state,
          data: result.data
        } as MsgToWebview);
      } else {
        panel.webview.postMessage({
          type: 'test:instanceUpdate',
          instanceId,
          currentState: result.state,
          data: result.data,
          transitions: result.transitions || []
        } as MsgToWebview);
      }
    } catch (error: any) {
      panel.webview.postMessage({
        type: 'test:error',
        instanceId: message.instanceId,
        error: error.message
      } as MsgToWebview);
    }
  }

  /**
   * Handle list instances request
   */
  private static async handleListInstances(
    message: any,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      const { workflowKey, domain } = message;

      const instances = await this.testService.listInstances({
        key: workflowKey,
        domain
      });

      panel.webview.postMessage({
        type: 'test:instancesList',
        instances
      } as MsgToWebview);
    } catch (error: any) {
      panel.webview.postMessage({
        type: 'test:error',
        error: error.message
      } as MsgToWebview);
    }
  }

  /**
   * Handle connect instance (highlight on canvas)
   */
  private static handleConnectInstance(message: any): void {
    if (this.modelBridge && this.modelBridge.broadcastInstanceHighlight) {
      this.modelBridge.broadcastInstanceHighlight(
        message.instanceId,
        message.workflowKey,
        message.stateKey
      );
    }
  }

  /**
   * Handle disconnect instance (clear highlighting)
   */
  private static handleDisconnectInstance(): void {
    if (this.modelBridge && this.modelBridge.clearInstanceHighlight) {
      this.modelBridge.clearInstanceHighlight();
    }
  }

  /**
   * Handle highlight history (highlight transition path)
   */
  private static handleHighlightHistory(message: any): void {
    if (this.modelBridge && this.modelBridge.broadcastHistoryHighlight) {
      this.modelBridge.broadcastHistoryHighlight(
        message.workflowKey,
        message.history,
        message.currentState
      );
    }
  }

  /**
   * Handle save test case request
   */
  private static async handleSaveTestCase(
    message: any,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      const { workflowKey, testCase } = message;

      await this.testCaseManager.saveTestCase(workflowKey, testCase);

      // Send updated test cases
      const testCases = await this.testCaseManager.loadTestCases(workflowKey);
      panel.webview.postMessage({
        type: 'test:testCases',
        testCases
      } as MsgToWebview);

      vscode.window.showInformationMessage(`Test case "${testCase.name}" saved successfully`);
    } catch (error: any) {
      panel.webview.postMessage({
        type: 'test:error',
        error: error.message
      } as MsgToWebview);
    }
  }

  /**
   * Handle load test cases request
   */
  private static async handleLoadTestCases(
    message: any,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      const { workflowKey } = message;

      const testCases = await this.testCaseManager.loadTestCases(workflowKey);
      panel.webview.postMessage({
        type: 'test:testCases',
        testCases
      } as MsgToWebview);
    } catch (error: any) {
      panel.webview.postMessage({
        type: 'test:error',
        error: error.message
      } as MsgToWebview);
    }
  }

  /**
   * Handle delete test case request
   */
  private static async handleDeleteTestCase(
    message: any,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      const { workflowKey, testCaseName } = message;

      await this.testCaseManager.deleteTestCase(workflowKey, testCaseName);

      // Send updated test cases
      const testCases = await this.testCaseManager.loadTestCases(workflowKey);
      panel.webview.postMessage({
        type: 'test:testCases',
        testCases
      } as MsgToWebview);

      vscode.window.showInformationMessage(`Test case "${testCaseName}" deleted`);
    } catch (error: any) {
      panel.webview.postMessage({
        type: 'test:error',
        error: error.message
      } as MsgToWebview);
    }
  }

  /**
   * Handle get model transitions request
   */
  private static async handleGetModelTransitions(
    message: any,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      const { workflowKey, stateKey } = message;

      // Get transitions from the model via modelBridge
      const transitions = await this.modelBridge.getModelTransitions(workflowKey, stateKey);

      panel.webview.postMessage({
        type: 'test:modelTransitions',
        stateKey,
        transitions
      } as MsgToWebview);
    } catch (error: any) {
      panel.webview.postMessage({
        type: 'test:error',
        error: error.message
      } as MsgToWebview);
    }
  }

  /**
   * Handle get start transition schema request
   */
  private static async handleGetStartTransitionSchema(
    message: any,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      const { workflowKey } = message;

      // Get start transition schema from the model via modelBridge
      const startTransition = await this.modelBridge.getStartTransitionSchema(workflowKey);

      panel.webview.postMessage({
        type: 'test:startTransitionSchema',
        startTransition
      } as MsgToWebview);
    } catch (error: any) {
      panel.webview.postMessage({
        type: 'test:error',
        error: error.message
      } as MsgToWebview);
    }
  }

  /**
   * Handle get subflow model request
   */
  private static async handleGetSubFlowModel(
    message: any,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      const { workflowKey, stateKey } = message;

      console.log('[TestPanelProvider] Getting subflow model for:', { workflowKey, stateKey });

      // Get subflow model from the model bridge
      const result = await this.modelBridge.getSubFlowModel(workflowKey, stateKey);

      panel.webview.postMessage({
        type: 'test:subFlowModel',
        subFlowWorkflow: result.subFlowWorkflow,
        subFlowInfo: result.subFlowInfo,
        error: result.error
      } as MsgToWebview);
    } catch (error: any) {
      console.error('[TestPanelProvider] Error getting subflow model:', error);
      panel.webview.postMessage({
        type: 'test:subFlowModel',
        subFlowWorkflow: null,
        subFlowInfo: { stateKey: message.stateKey },
        error: error.message
      } as MsgToWebview);
    }
  }

  /**
   * Handle load schema request
   */
  private static async handleLoadSchema(
    message: any,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      const { transitionKey, schemaRef } = message;

      console.log('[TestPanelProvider] Loading schema for transition:', transitionKey, schemaRef);

      // Resolve schema using the component resolver via ModelBridge
      const schema = await this.modelBridge.resolveSchema(schemaRef);

      if (!schema) {
        panel.webview.postMessage({
          type: 'test:schemaLoaded',
          transitionKey,
          error: `Schema not found: ${schemaRef.key}`
        } as MsgToWebview);
        return;
      }

      panel.webview.postMessage({
        type: 'test:schemaLoaded',
        transitionKey,
        schema
      } as MsgToWebview);
    } catch (error: any) {
      panel.webview.postMessage({
        type: 'test:schemaLoaded',
        transitionKey: message.transitionKey,
        error: error.message
      } as MsgToWebview);
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
      // Path to the webview dist folder
      const webviewDistPath = vscode.Uri.joinPath(context.extensionUri, 'dist-web');

      // Read the built HTML file
      const htmlUri = vscode.Uri.joinPath(webviewDistPath, 'testRunner.html');
      const htmlContent = await vscode.workspace.fs.readFile(htmlUri);
      let html = new TextDecoder().decode(htmlContent);

      // Map relative paths to webview URIs
      const webviewUri = webview.asWebviewUri(webviewDistPath);

      // Add CSP header
      const cspContent = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data: https:; connect-src ${webview.cspSource} https:;`;
      const cspTag = `\n    <meta http-equiv="Content-Security-Policy" content="${cspContent}">`;

      // Insert CSP as the first thing in <head>
      html = html.replace(/<head>/i, `<head>${cspTag}`);

      // Replace relative paths with webview URIs
      html = html.replace(/(src|href)="\.\//g, (_, attr) => `${attr}="${webviewUri}/`);

      return html;
    } catch (error) {
      console.error('Failed to load test runner webview content:', error);
      // Fallback HTML
      return `<!DOCTYPE html>
        <html>
          <head><title>Test Runner</title></head>
          <body>
            <div style="padding: 20px; font-family: Arial, sans-serif;">
              <h2>Test Runner Not Built</h2>
              <p>The test runner webview hasn't been built yet.</p>
              <p>Run <code>npm run build</code> to build the webview.</p>
              <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
            </div>
          </body>
        </html>`;
    }
  }
}
