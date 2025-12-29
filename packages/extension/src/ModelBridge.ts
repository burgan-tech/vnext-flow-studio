/**
 * Bridge between VS Code extension and the model abstraction layer
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  VSCodeModelIntegration,
  WorkflowModel,
  ModelValidator,
  toReactFlow,
  autoLayout,
  pluginManager,
  InitialStatePlugin,
  IntermediateStatePlugin,
  FinalStatePlugin,
  SubFlowStatePlugin,
  WizardStatePlugin,
  DesignHintsManager,
  DEFAULT_COMPONENT_SEARCH_PATHS,
  ComponentResolverManager,
  type Workflow,
  type State,
  type Transition,
  type SharedTransition,
  type ExecutionTask,
  type TaskComponentDefinition,
  type MsgFromWebview,
  type MsgToWebview,
  type ValidationResult,
  type Problem,
  type DesignHints
} from '@amorphie-flow-studio/core';
import { DeploymentService, EnvironmentManager } from './deployment/index.js';
import { VSCodeOutputChannelLogger } from './VSCodeLogger.js';
import type { ComponentWatcher, ComponentResolver, FileChangeEvent } from '@amorphie-flow-studio/core';

/**
 * Model bridge configuration
 */
export interface ModelBridgeConfig {
  /** Extension context */
  context: vscode.ExtensionContext;
  /** Diagnostics provider */
  diagnosticsProvider: any; // FlowDiagnosticsProvider
  /** Active panels tracking */
  activePanels: Map<string, vscode.WebviewPanel>;
  /** Output channel for deployment logs */
  deploymentOutputChannel: vscode.OutputChannel;
}

/**
 * Bridges the VS Code extension with the model abstraction layer
 */
export class ModelBridge {
  private integration: VSCodeModelIntegration;
  private config: ModelBridgeConfig;
  private panelModelMap: Map<string, WorkflowModel> = new Map();
  private panelUriMap: Map<string, vscode.Uri> = new Map(); // Track URI for read-only detection
  private hintsManagers: Map<string, DesignHintsManager> = new Map();
  private autosaveTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastSavedContent: Map<string, string> = new Map();
  private lastSaveTime: Map<string, number> = new Map();

  // Component watching
  private componentWatcher?: ComponentWatcher;
  private componentWatcherLogger?: VSCodeOutputChannelLogger;
  private globalResolver?: ComponentResolver;

  // Deployment service
  private deploymentService?: DeploymentService;

  // Initialization tracking
  private initializationPromise: Promise<void>;
  private initializationResolve?: () => void;

  constructor(config: ModelBridgeConfig) {
    this.config = config;
    this.integration = new VSCodeModelIntegration();

    // Create initialization promise
    this.initializationPromise = new Promise<void>((resolve) => {
      this.initializationResolve = resolve;
    });

    // Initialize plugin system
    this.initializePlugins();

    // Set up integration event handlers
    this.setupEventHandlers();

    // Set up component file watching for hot reloading (async, runs in background)
    this.setupComponentWatching()
      .then(() => {
        console.log('[ModelBridge] Initialization complete');
        this.initializationResolve?.();
      })
      .catch(error => {
        console.error('[ModelBridge] Failed to setup component watching:', error);
        vscode.window.showWarningMessage(
          `Component file watching failed to start: ${error.message}`
        );
        // Resolve anyway to not block the extension
        this.initializationResolve?.();
      });
  }

  /**
   * Wait for ModelBridge to finish initialization
   * This ensures ComponentResolver is ready before use
   */
  public async waitForInitialization(): Promise<void> {
    return this.initializationPromise;
  }


  /**
   * Initialize the plugin system
   */
  private initializePlugins(): void {
    // Register core state plugins
    pluginManager.register(InitialStatePlugin);
    pluginManager.register(IntermediateStatePlugin);
    pluginManager.register(FinalStatePlugin);
    pluginManager.register(SubFlowStatePlugin);
    pluginManager.register(WizardStatePlugin);

    // Set default profile
    pluginManager.setActiveProfile('Default');

    // Activate all core plugins
    pluginManager.activate('Initial');
    pluginManager.activate('Intermediate');
    pluginManager.activate('Final');
    pluginManager.activate('SubFlow');
    pluginManager.activate('Wizard');

    // Refresh variants for active plugins
    this.refreshPluginVariants();
  }

  /**
   * Refresh plugin variants
   */
  private async refreshPluginVariants(model?: WorkflowModel): Promise<void> {
    const activePlugins = pluginManager.getActivePlugins();

    // Get registries from model if available
    let registries = null;
    if (model) {
      const catalogs = this.getCatalogsFromModel(model);
      registries = {
        tasks: catalogs.task || [],
        schemas: catalogs.schema || [],
        views: catalogs.view || [],
        functions: catalogs.function || [],
        extensions: catalogs.extension || []
      };
    }

    for (const plugin of activePlugins) {
      await pluginManager.refreshVariants(plugin.id, registries);
    }
  }

  /**
   * Set up event handlers for model changes
   */
  private setupEventHandlers(): void {
    this.integration.on('onDidChangeModel', (_event) => {
      // Notify all relevant panels about model changes
      const model = this.integration.getActiveModel();
      if (model) {
        this.updateWebviewForModel(model);
      }
    });

    this.integration.on('onDirtyStateChange', (isDirty) => {
      // Update VS Code tab to show dirty indicator
      const model = this.integration.getActiveModel();
      if (model) {
        const panel = this.getPanelForModel(model);
        if (panel) {
          // VS Code doesn't directly support dirty state for webview panels
          // But we can update the title to indicate unsaved changes
          const workflow = model.getWorkflow();
          const title = this.getWorkflowLabel(workflow);
          panel.title = isDirty ? `${title} ●` : title;
        }
      }
    });

    this.integration.on('onDidValidate', (result) => {
      // Update diagnostics based on validation results
      const model = this.integration.getActiveModel();
      if (model) {
        this.updateDiagnosticsFromValidation(model, result);
      }
    });
  }

  /**
   * Set up component file watching for hot reloading
   */
  private async setupComponentWatching(): Promise<void> {
    try {
      // Get workspace folders
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        console.log('[ModelBridge] No workspace folders, skipping component watching');
        return;
      }

      // We'll watch the first workspace folder
      // In multi-root workspaces, you might want to watch all folders
      const workspaceRoot = workspaceFolders[0].uri.fsPath;

      // Create a separate logger for component watching
      this.componentWatcherLogger = new VSCodeOutputChannelLogger('Component Watcher', true);
      this.componentWatcherLogger.info('=== Component Watcher Starting ===');
      this.componentWatcherLogger.info(`Workspace: ${workspaceRoot}`);

      let tasksDirs: string[] = [];
      let schemasDirs: string[] = [];
      let viewsDirs: string[] = [];
      let functionsDirs: string[] = [];
      let extensionsDirs: string[] = [];

      // Try to load vnext.config.json first
      const { loadVNextConfig, resolveComponentPaths } = await import('@amorphie-flow-studio/core');
      const configResult = await loadVNextConfig(workspaceRoot);

      if (configResult.success && configResult.config) {
        this.componentWatcherLogger.info('✅ Found vnext.config.json - using config-based discovery');
        this.componentWatcherLogger.info(`Domain: ${configResult.config.domain}`);
        this.componentWatcherLogger.info(`Components Root: ${configResult.config.paths.componentsRoot}`);

        // Resolve absolute paths from config
        const _componentPaths = resolveComponentPaths(workspaceRoot, configResult.config);

        // Use relative paths for the resolver
        const componentsRoot = configResult.config.paths.componentsRoot;
        tasksDirs = [path.join(componentsRoot, configResult.config.paths.tasks)];
        schemasDirs = [path.join(componentsRoot, configResult.config.paths.schemas)];
        viewsDirs = [path.join(componentsRoot, configResult.config.paths.views)];
        functionsDirs = [path.join(componentsRoot, configResult.config.paths.functions)];
        extensionsDirs = [path.join(componentsRoot, configResult.config.paths.extensions)];

        this.componentWatcherLogger.info(`Config-based component directories:`);
        this.componentWatcherLogger.info(`  Tasks: ${tasksDirs.join(', ')}`);
        this.componentWatcherLogger.info(`  Schemas: ${schemasDirs.join(', ')}`);
        this.componentWatcherLogger.info(`  Views: ${viewsDirs.join(', ')}`);
        this.componentWatcherLogger.info(`  Functions: ${functionsDirs.join(', ')}`);
        this.componentWatcherLogger.info(`  Extensions: ${extensionsDirs.join(', ')}`);
      } else {
        this.componentWatcherLogger.warn('⚠️  vnext.config.json not found - falling back to glob-based discovery');
        this.componentWatcherLogger.info(`Reason: ${configResult.error}`);

        // Fallback: Dynamically find all component directories in the workspace
        const findComponentDirs = async (dirName: string): Promise<string[]> => {
          const fg = await import('fast-glob');
          const paths = await fg.default(`**/${dirName}`, {
            cwd: workspaceRoot,
            onlyDirectories: true,
            ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
            deep: 3 // Limit depth to avoid performance issues
          });
          return paths;
        };

        [tasksDirs, schemasDirs, viewsDirs, functionsDirs, extensionsDirs] = await Promise.all([
          findComponentDirs('Tasks'),
          findComponentDirs('Schemas'),
          findComponentDirs('Views'),
          findComponentDirs('Functions'),
          findComponentDirs('Extensions')
        ]);

        this.componentWatcherLogger.info(`Found component directories via glob:`);
        this.componentWatcherLogger.info(`  Tasks: ${tasksDirs.join(', ')}`);
        this.componentWatcherLogger.info(`  Schemas: ${schemasDirs.join(', ')}`);
        this.componentWatcherLogger.info(`  Views: ${viewsDirs.join(', ')}`);
        this.componentWatcherLogger.info(`  Functions: ${functionsDirs.join(', ')}`);
        this.componentWatcherLogger.info(`  Extensions: ${extensionsDirs.join(', ')}`);
      }

      // Get or create a global component resolver using ComponentResolverManager
      // This ensures proper lifecycle management and cleanup
      const manager = ComponentResolverManager.getInstance();
      console.log('[ModelBridge] Creating/getting global resolver with workspaceId:', workspaceRoot);
      this.globalResolver = await manager.getOrCreateGlobalResolver({
        workspaceId: workspaceRoot,
        basePath: workspaceRoot,
        useCache: true,
        searchPaths: {
          tasks: [...DEFAULT_COMPONENT_SEARCH_PATHS.task, ...tasksDirs],
          schemas: [...DEFAULT_COMPONENT_SEARCH_PATHS.schema, ...schemasDirs],
          views: [...DEFAULT_COMPONENT_SEARCH_PATHS.view, ...viewsDirs],
          functions: [...DEFAULT_COMPONENT_SEARCH_PATHS.function, ...functionsDirs],
          extensions: [...DEFAULT_COMPONENT_SEARCH_PATHS.extension, ...extensionsDirs],
          workflows: [...DEFAULT_COMPONENT_SEARCH_PATHS.workflow] // Include workflows for catalog validation
        },
        enableWatching: false, // We'll enable watching manually to set up custom event handlers
        lifecycle: {
          onError: (error: Error) => {
            this.componentWatcherLogger?.error(`Resolver error: ${error.message}`);
          }
        }
      });

      this.componentWatcherLogger.info('ComponentResolver created via manager, enabling file watching...');

      // Enable file watching with custom logger
      this.componentWatcher = await this.globalResolver.enableFileWatching({
        basePath: workspaceRoot,
        debounceMs: 500, // Longer debounce for VS Code
        logger: this.componentWatcherLogger
      });

      this.componentWatcherLogger.info('File watching enabled successfully');

      // Listen for component changes
      this.componentWatcher.on('change', async (event: FileChangeEvent) => {
        this.componentWatcherLogger?.info(`Component file changed: ${event.type} ${event.componentType} - ${path.basename(event.path)}`);

        // Skip reload if this is a workflow file we just saved (prevents reload loop)
        if (event.componentType === 'workflow' && this.isRecentlySaved(event.path)) {
          console.log('[ModelBridge] Skipping reload for recently saved workflow:', path.basename(event.path));
          return;
        }

        // Use lightweight refresh for all component types (no full reload needed)
        if (event.componentType === 'script' as any) {
          console.log('[ModelBridge] Script file changed, using lightweight refresh:', event.path);
          await this.notifyPanelsAboutScriptUpdate(event.path);
        } else {
          console.log(`[ModelBridge] ${event.componentType} file changed, using lightweight refresh:`, event.path);
          await this.notifyPanelsAboutComponentUpdate(event.path, event.componentType);
        }
      });

      this.componentWatcher.on('componentAdded', (data: { path: string; type: string }) => {
        this.componentWatcherLogger?.info(`✅ Component added: ${data.type}`);
        vscode.window.showInformationMessage(`Component added: ${path.basename(data.path)}`);
      });

      this.componentWatcher.on('componentChanged', (data: { path: string; type: string }) => {
        this.componentWatcherLogger?.info(`🔄 Component updated: ${data.type}`);
      });

      this.componentWatcher.on('componentDeleted', (data: { path: string; type: string }) => {
        this.componentWatcherLogger?.warn(`🗑️ Component deleted: ${data.type}`);
        vscode.window.showWarningMessage(`Component deleted: ${path.basename(data.path)}`);
      });

      this.componentWatcher.on('error', (error: Error) => {
        this.componentWatcherLogger?.error('Component watcher error:', error);
        vscode.window.showWarningMessage(
          `Component file watching encountered an error: ${error.message}`
        );
      });

      this.componentWatcherLogger.info('Component file watching enabled');
      this.componentWatcherLogger.info(`Watching: ${workspaceRoot}`);

      console.log('[ModelBridge] Component file watching enabled');

    } catch (error) {
      console.error('[ModelBridge] Failed to enable component watching:', error);

      if (this.componentWatcherLogger) {
        this.componentWatcherLogger.error('Failed to start component watching:', error);
      }

      // Re-throw so the constructor's catch handler can show a notification
      throw error;
    }
  }

  /**
   * Notify panels about a single script update (lightweight, no full reload)
   */
  private async notifyPanelsAboutScriptUpdate(scriptPath: string): Promise<void> {
    console.log('[ModelBridge] ⚡ Lightweight script update starting for:', scriptPath);

    for (const [panelKey, panel] of this.config.activePanels) {
      const model = this.panelModelMap.get(panelKey);
      if (!model) continue;

      try {
        // Use lightweight refresh instead of full model reload
        const result = await model.refreshScript(scriptPath);

        if (!result) {
          console.log('[ModelBridge] Script refresh returned null, skipping panel:', panelKey);
          continue;
        }

        const { script, type } = result;

        // Transform script location to be relative to workflow file
        const workflowDir = path.dirname(model.getModelState().metadata.workflowPath);
        let relativePath = path.relative(workflowDir, script.absolutePath);
        if (!relativePath.startsWith('./') && !relativePath.startsWith('../')) {
          relativePath = `./${relativePath}`;
        }

        const transformedScript = {
          ...script,
          location: relativePath
        };

        console.log('[ModelBridge] ✓ Script refreshed:', {
          path: relativePath,
          type,
          size: script.content.length
        });

        // Send incremental update to webview
        panel.webview.postMessage({
          type: 'script:updated',
          script: transformedScript,
          scriptType: type
        });

        console.log('[ModelBridge] ✓ Sent script:updated message to panel:', panelKey);

        // Schedule autosave if model was updated (embedded base64 content changed)
        if (model.isDirty()) {
          console.log('[ModelBridge] ✓ Model is dirty, scheduling autosave');
          this.scheduleAutosave(model, 100); // Immediate save for script content changes
        }
      } catch (error) {
        console.error('[ModelBridge] Failed to refresh script for panel:', panelKey, error);
      }
    }

    console.log('[ModelBridge] ⚡ Lightweight script update complete');
  }

  /**
   * Notify panels about a single component update (lightweight, no full reload)
   * Handles task, schema, view, function, extension, workflow updates
   */
  private async notifyPanelsAboutComponentUpdate(componentPath: string, componentType: string): Promise<void> {
    console.log('[ModelBridge] ⚡ Lightweight component update starting for:', componentPath);

    try {
      // Read and parse the component file
      const fs = await import('fs/promises');
      const content = await fs.readFile(componentPath, 'utf-8');
      const component = JSON.parse(content);

      // Validate basic structure
      if (!component.key || !component.domain || !component.version) {
        console.log('[ModelBridge] Invalid component structure, skipping update');
        return;
      }

      console.log('[ModelBridge] ✓ Component loaded:', {
        type: componentType,
        key: component.key,
        domain: component.domain,
        version: component.version
      });

      // Send incremental update to all panels AND re-validate workflows
      for (const [panelKey, panel] of this.config.activePanels) {
        panel.webview.postMessage({
          type: 'component:updated',
          componentType,
          component
        });

        // Re-validate workflow with updated catalog
        // (component changes might affect workflow validation - e.g., missing task reference)
        const model = this.panelModelMap.get(panelKey);
        if (model) {
          await this.performLinting(model, panel);
        }
      }

      console.log('[ModelBridge] ⚡ Lightweight component update and re-validation complete');
    } catch (error) {
      console.error('[ModelBridge] Failed to load component:', error);
      // Fall back to logging, but don't fail - ComponentResolver cache is already invalidated
    }
  }

  /**
   * Notify all open panels about catalog update
   */
  private async notifyAllPanelsAboutCatalogUpdate(): Promise<void> {
    for (const [panelKey, panel] of this.config.activePanels) {
      const model = this.panelModelMap.get(panelKey);
      if (!model) continue;

      try {
        console.log('[ModelBridge] Reloading model components for panel:', panelKey);

        // Reload components for this model with timeout protection
        const loadPromise = model.load({
          preloadComponents: true,
          basePath: model.getModelState().metadata.basePath
        });
        const loadTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Model reload timeout after 30s')), 30000)
        );
        await Promise.race([loadPromise, loadTimeout]);

        console.log('[ModelBridge] Model reloaded, getting updated catalogs');

        // Get updated catalogs and tasks
        const catalogs = this.getCatalogsFromModel(model);
        const tasks = this.getTasksFromModel(model);

        console.log('[ModelBridge] Retrieved catalogs:', {
          mappers: catalogs.mapper?.length || 0,
          rules: catalogs.rule?.length || 0
        });

        // Refresh plugin variants
        await this.refreshPluginVariants(model);

        // Get plugin variants
        const activePlugins = pluginManager.getActivePlugins();
        const pluginVariants: Record<string, any[]> = {};
        for (const plugin of activePlugins) {
          const variants = pluginManager.getVariants(plugin.id);
          if (variants.length > 0) {
            pluginVariants[plugin.id] = variants;
          }
        }

        // Debug: Check mapper content before sending
        if (catalogs.mapper && catalogs.mapper.length > 0) {
          console.log('[ModelBridge] Sending catalog:update with mappers:', {
            count: catalogs.mapper.length,
            firstMapper: {
              location: catalogs.mapper[0]?.location,
              hasContent: !!catalogs.mapper[0]?.content,
              contentLength: catalogs.mapper[0]?.content?.length || 0
            }
          });
        }

        // Send update to webview
        panel.webview.postMessage({
          type: 'catalog:update',
          tasks,
          catalogs,
          pluginVariants
        });

        this.componentWatcherLogger?.debug(`Sent catalog update to panel: ${panelKey}`);
      } catch (error) {
        console.error(`[ModelBridge] Failed to update catalog for panel ${panelKey}:`, error);
        this.componentWatcherLogger?.error(`Failed to update catalog for panel:`, error);
      }
    }
  }

  /**
   * Find the project-specific base path for component discovery.
   *
   * For multi-project workspaces (e.g., workspace/loans/, workspace/credit-cards/),
   * this finds the project root by looking for vnext.config.json or component directories.
   *
   * Searches upward from the workflow file to find:
   * 1. vnext.config.json (preferred)
   * 2. Typical component folders (Tasks, Workflows, etc.) as fallback
   */
  private async findProjectBasePath(workflowPath: string, workspaceRoot?: string): Promise<string> {
    const fs = await import('fs/promises');
    const { findVNextConfig } = await import('@amorphie-flow-studio/core');

    // Start from workflow's parent directory
    let currentDir = path.dirname(workflowPath);
    const workspaceRootNormalized = workspaceRoot ? path.normalize(workspaceRoot) : null;

    // First, try to find vnext.config.json by searching upward
    const configResult = await findVNextConfig(currentDir);
    if (configResult.success && configResult.configPath) {
      const projectRoot = path.dirname(configResult.configPath);
      console.log(`[ModelBridge] Found project root via vnext.config.json at: ${projectRoot}`);
      return projectRoot;
    }

    // Fallback: Component directories to look for
    const componentDirs = ['Tasks', 'tasks', 'Workflows', 'workflows', 'Flows', 'flows'];

    // Search upward until we find a directory with component folders
    while (true) {
      // Check if any component directories exist at this level
      const hasComponentDirs = await Promise.all(
        componentDirs.map(async (dir) => {
          try {
            const fullPath = path.join(currentDir, dir);
            const stats = await fs.stat(fullPath);
            return stats.isDirectory();
          } catch {
            return false;
          }
        })
      );

      // If we found at least one component directory, this is likely the project root
      if (hasComponentDirs.some(exists => exists)) {
        console.log(`[ModelBridge] Found project root at: ${currentDir}`);
        return currentDir;
      }

      // Move up one directory
      const parentDir = path.dirname(currentDir);

      // Stop if we've reached the workspace root
      if (workspaceRootNormalized && path.normalize(currentDir) === workspaceRootNormalized) {
        console.log(`[ModelBridge] Reached workspace root, using: ${currentDir}`);
        return currentDir;
      }

      // Stop if we've reached the filesystem root
      if (parentDir === currentDir) {
        console.log(`[ModelBridge] Reached filesystem root, using workflow directory: ${path.dirname(workflowPath)}`);
        return path.dirname(workflowPath);
      }

      currentDir = parentDir;
    }
  }

  /**
   * Open a workflow in the editor
   */
  async openWorkflow(flowUri: vscode.Uri, panel: vscode.WebviewPanel, document?: vscode.TextDocument): Promise<WorkflowModel> {
    try {
      const startTime = Date.now();
      console.log('[ModelBridge] openWorkflow called for:', flowUri.fsPath);

      // Extract content from VS Code TextDocument if provided
      // This is essential for git virtual URIs (e.g., git:/path/to/file?ref=HEAD)
      const content = document?.getText();
      if (content) {
        console.log('[ModelBridge] Using content from TextDocument (length:', content.length, ')');
      }

      // For git URIs, also fetch the diagram content from the same commit
      let diagramContent: string | undefined;
      if (flowUri.scheme === 'git') {
        try {
          // Construct diagram URI by replacing .json with .diagram.json
          // Need to update both the path and the query params (VS Code uses query params to fetch)
          const uriStr = flowUri.toString();

          // Replace in both the path and query parameters
          const diagramUriStr = uriStr
            .replace(/\.json\?/, '.diagram.json?')  // Path before query
            .replace(/\.json%22/, '.diagram.json%22')  // Encoded path in query params
            .replace(/\.json"/, '.diagram.json"');  // Unencoded path in query params (if any)

          const diagramUri = vscode.Uri.parse(diagramUriStr);
          console.log('[ModelBridge] Attempting to load diagram from git:', diagramUriStr);

          const diagramDoc = await vscode.workspace.openTextDocument(diagramUri);
          diagramContent = diagramDoc.getText();
          console.log('[ModelBridge] Successfully loaded diagram from git (length:', diagramContent.length, ')');
        } catch (error) {
          // Diagram doesn't exist in this commit - that's ok
          console.log('[ModelBridge] Diagram not found in git commit (this is ok):', error);
        }
      }

      // Get the workspace folder for this file to use as basePath
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(flowUri);

      // Find the project-specific base path by looking for component directories
      // This supports multi-project workspaces (e.g., workspace/loans/, workspace/credit-cards/)
      console.log('[ModelBridge] Finding project base path...');
      const basePath = await this.findProjectBasePath(
        flowUri.fsPath,
        workspaceFolder?.uri.fsPath
      );

      console.log('[ModelBridge] openWorkflow - workspaceFolder:', workspaceFolder?.uri.fsPath);
      console.log('[ModelBridge] openWorkflow - workflow file:', flowUri.fsPath);
      console.log('[ModelBridge] openWorkflow - detected basePath:', basePath);

      // Get the model from integration (may be cached for cross-model queries)
      console.log('[ModelBridge] Loading workflow model...');
      const modelStartTime = Date.now();
      // Pass full URI (not just fsPath) to support separate instances for git:// vs file:// URIs
      // Also pass fsPath explicitly for file operations (handles complex git:// URI formats)
      let model;
      try {
        const modelPromise = this.integration.openWorkflow(
          flowUri.toString(),  // URI for caching
          flowUri.fsPath,      // fsPath for file operations
          {
            resolveReferences: true,
            loadScripts: true,
            validate: true,
            preloadComponents: true, // This will scan and load all tasks, schemas, views, etc.
            basePath: basePath, // Use VS Code workspace folder as base path
            content: content, // Pass content from TextDocument for git virtual URIs
            diagramContent: diagramContent, // Pass diagram content from git commit
            componentResolver: this.globalResolver // Share global component resolver
          }
        );
        const modelTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Model load timeout after 30s - filesystem may be slow or unresponsive')), 30000)
        );
        model = await Promise.race([modelPromise, modelTimeout]);
        console.log(`[ModelBridge] Model opened in ${Date.now() - modelStartTime}ms`);
      } catch (error) {
        console.error('[ModelBridge] Model load failed or timed out:', error);
        throw error;
      }
      console.log('[ModelBridge] Model URI:', flowUri.toString(), '| fsPath:', flowUri.fsPath, '| Scheme:', flowUri.scheme);

      // No need for second load - components are in resolver cache (single source of truth)
      // Model reads directly from resolver, not from its own state

      // Track the association between panel and model using the flow URI as the key
      const panelKey = flowUri.toString();
      this.panelModelMap.set(panelKey, model);
      this.panelUriMap.set(panelKey, flowUri); // Track URI for read-only detection
      this.config.activePanels.set(panelKey, panel);

      // Set up panel disposal cleanup
      panel.onDidDispose(() => {
        console.log('[ModelBridge] Panel disposed, cleaning up model for:', panelKey);
        this.panelModelMap.delete(panelKey);
        this.panelUriMap.delete(panelKey);
        this.config.activePanels.delete(panelKey);

        // Force remove model from integration cache to ensure fresh load on reopen
        // We use forceClose instead of closeWorkflow to bypass dirty state checks
        try {
          this.integration.forceClose(panelKey);
          console.log('[ModelBridge] Model removed from cache:', panelKey);
        } catch (error) {
          console.warn('[ModelBridge] Error closing workflow:', error);
        }
      });

      // Get initial data from model
      const workflow = model.getWorkflow();
      let diagram = model.getDiagram();

      console.log('[ModelBridge] Initial diagram check:', diagram ? 'exists' : 'UNDEFINED');

      // Generate diagram if it doesn't exist (but not for git URIs which are read-only)
      let generatedDiagram = false;
      const isGitUri = flowUri.scheme === 'git';
      if (!diagram) {
        console.log('[ModelBridge] Auto-generating diagram...');
        const layoutStartTime = Date.now();
        try {
          diagram = await autoLayout(workflow);
          console.log('[ModelBridge] autoLayout returned:', diagram ? 'diagram object' : 'UNDEFINED');
          if (!diagram) {
            throw new Error('autoLayout returned undefined');
          }
          model.setDiagram(diagram);
          console.log('[ModelBridge] Diagram set on model, verifying...', model.getDiagram() ? 'OK' : 'FAILED');

          // Only save for non-git URIs (git URIs are read-only snapshots)
          if (!isGitUri) {
            await this.saveModel(model);
            console.log(`[ModelBridge] Diagram generated and saved in ${Date.now() - layoutStartTime}ms`);
          } else {
            console.log(`[ModelBridge] Diagram generated (not saved - git URI is read-only) in ${Date.now() - layoutStartTime}ms`);
          }
          generatedDiagram = true;
        } catch (error) {
          console.error('[ModelBridge] Failed to auto-generate diagram:', error);
          throw new Error(`Failed to auto-generate diagram: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      console.log('[ModelBridge] After auto-generation, diagram check:', diagram ? 'exists' : 'UNDEFINED');

      // Get tasks from the model
      console.log('[ModelBridge] Getting tasks from model...');
      const tasks = this.getTasksFromModel(model);

      // Get design hints for this model
      console.log('[ModelBridge] Getting design hints...');
      const modelKey = this.getModelKey(model);
      let hintsManager = this.hintsManagers.get(modelKey);
      if (!hintsManager) {
        hintsManager = new DesignHintsManager();
        this.hintsManagers.set(modelKey, hintsManager);
      }
      const allDesignHints = hintsManager.getAllHints();
      console.log('[ModelBridge] Design hints retrieved');

      // Convert to React Flow format
      console.log('[ModelBridge] Converting to React Flow format...');
      console.log('[ModelBridge] Pre-conversion diagram check:', diagram ? 'exists' : 'UNDEFINED');
      console.log('[ModelBridge] Diagram type:', typeof diagram);
      console.log('[ModelBridge] Diagram value:', diagram);
      const flowStartTime = Date.now();

      // Ensure diagram exists (should have been auto-generated above if missing)
      if (!diagram) {
        throw new Error('Diagram is unexpectedly undefined after auto-generation attempt');
      }

      const derived = toReactFlow(workflow, diagram, 'en', allDesignHints.states);
      console.log(`[ModelBridge] Converted to React Flow in ${Date.now() - flowStartTime}ms`);

      // Get problems (with timeout to prevent hanging)
      console.log('[ModelBridge] Getting lint problems...');
      const lintStartTime = Date.now();
      let problemsById: Record<string, any> = {};
      try {
        const lintPromise = this.getLintProblems(model);
        const lintTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Lint timeout after 5s')), 5000)
        );
        problemsById = await Promise.race([lintPromise, lintTimeout]) as Record<string, any>;
        console.log(`[ModelBridge] Lint problems retrieved in ${Date.now() - lintStartTime}ms`);
      } catch (lintError) {
        console.warn('[ModelBridge] Lint problems skipped:', lintError instanceof Error ? lintError.message : 'unknown error');
        console.log(`[ModelBridge] Lint skipped after ${Date.now() - lintStartTime}ms, continuing with empty problems`);
      }

      // Get catalogs from model
      console.log('[ModelBridge] Getting catalogs from model...');
      const catalogStartTime = Date.now();
      const catalogs = this.getCatalogsFromModel(model);
      console.log(`[ModelBridge] Catalogs retrieved in ${Date.now() - catalogStartTime}ms`);

      // Refresh plugin variants with discovered tasks (with timeout)
      console.log('[ModelBridge] Refreshing plugin variants...');
      const pluginStartTime = Date.now();
      try {
        const pluginPromise = this.refreshPluginVariants(model);
        const pluginTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Plugin variant refresh timeout after 10s')), 10000)
        );
        await Promise.race([pluginPromise, pluginTimeout]);
        console.log(`[ModelBridge] Plugin variants refreshed in ${Date.now() - pluginStartTime}ms`);
      } catch (pluginError) {
        const isTimeout = pluginError instanceof Error && pluginError.message.includes('timeout');
        if (isTimeout) {
          console.warn('[ModelBridge] Plugin variant refresh timeout - skipping to unblock UI');
        } else {
          console.error('[ModelBridge] Error refreshing plugin variants:', pluginError);
        }
        console.log(`[ModelBridge] Plugin refresh completed/skipped after ${Date.now() - pluginStartTime}ms, continuing`);
      }

      // Get active plugins and their variants
      const activePlugins = pluginManager.getActivePlugins();
      const plugins = activePlugins.map(plugin => ({
        id: plugin.id,
        label: plugin.label,
        description: plugin.description,
        icon: plugin.icon,
        keyPrefix: plugin.keyPrefix,
        defaultLabel: plugin.defaultLabel,
        stateType: plugin.stateType,
        terminals: plugin.terminals,
        profiles: plugin.profiles,
        createState: plugin.createState
      }));

      // Get plugin variants
      const pluginVariants: Record<string, any[]> = {};
      for (const plugin of activePlugins) {
        const variants = pluginManager.getVariants(plugin.id);
        if (variants.length > 0) {
          pluginVariants[plugin.id] = variants;
        }
      }

      // Send initial data to webview
      console.log('[ModelBridge] Sending init message to webview...');
      const initMessage: MsgToWebview = {
        type: 'init',
        workflow,
        diagram,
        derived,
        problemsById,
        tasks,
        catalogs,
        plugins,
        pluginVariants,
        designHints: allDesignHints.states,
        generatedDiagram
      };

      panel.webview.postMessage(initMessage);
      console.log(`[ModelBridge] Init message sent. Total time: ${Date.now() - startTime}ms`);

      // Update panel title
      panel.title = this.getWorkflowLabel(workflow);

      return model;
    } catch (error) {
      console.error('Failed to open workflow:', error);
      throw error;
    }
  }

  /**
   * Check if this message type modifies the workflow
   */
  private isModificationMessage(messageType: string): boolean {
    return messageType.startsWith('domain:') ||
           messageType.startsWith('persist:') ||
           messageType.startsWith('mapping:') ||
           messageType.startsWith('rule:') ||
           messageType.startsWith('editor:createScript') ||
           messageType.startsWith('editor:saveScript');
  }

  /**
   * Get the URI for a given panel
   */
  private getUriForPanel(panel: vscode.WebviewPanel): vscode.Uri | undefined {
    // Find the panel key by searching through activePanels
    for (const [key, p] of this.config.activePanels.entries()) {
      if (p === panel) {
        return this.panelUriMap.get(key);
      }
    }
    return undefined;
  }

  /**
   * Handle messages from the webview
   */
  async handleWebviewMessage(
    message: MsgFromWebview,
    model: WorkflowModel,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      console.log('[ModelBridge] handleWebviewMessage received:', message.type);

      // Check if this panel is read-only (git diff view)
      const panelUri = this.getUriForPanel(panel);
      const isReadOnly = panelUri?.scheme === 'git';

      if (isReadOnly && this.isModificationMessage(message.type)) {
        console.log('[ModelBridge] Blocked modification in read-only git panel:', message.type);
        panel.webview.postMessage({
          type: 'error',
          message: 'Cannot modify in git diff view. This is a read-only snapshot from git history.'
        });
        return;
      }

      switch (message.type) {
        case 'persist:diagram':
          model.setDiagram(message.diagram);
          // Immediate save for explicit diagram persistence
          await this.saveModel(model);
          break;

        case 'domain:setStart':
          await this.setStartTransition(model, message.target);
          this.scheduleAutosave(model);
          break;

        case 'domain:setCancel':
          await this.setCancelTransition(model, message.target);
          await this.updateWebviewForModel(model, panel);
          this.scheduleAutosave(model);
          break;

        case 'domain:addTransition':
          await this.addTransition(model, message.from, message.target, message.triggerType);
          this.scheduleAutosave(model, 100); // Immediate save for structural changes
          break;

        case 'domain:moveTransition':
          await this.moveTransition(model, message.oldFrom, message.tKey, message.newFrom, message.newTarget);
          this.scheduleAutosave(model, 100); // Immediate save for structural changes
          break;

        case 'domain:removeTransition':
          await this.removeTransition(model, message.from, message.tKey);
          this.scheduleAutosave(model, 100); // Immediate save for structural changes
          break;

        case 'domain:removeState':
          await this.removeState(model, message.stateKey);
          this.scheduleAutosave(model, 100); // Immediate save for structural changes
          break;

        case 'domain:updateState':
          await this.updateState(model, message.stateKey, message.state);
          this.scheduleAutosave(model);
          break;

        case 'domain:updateTransition':
          await this.updateTransition(model, message.from, message.transitionKey, message.transition);
          this.scheduleAutosave(model);
          break;

        case 'domain:makeTransitionShared':
          console.log('[ModelBridge] Handling domain:makeTransitionShared');
          await this.makeTransitionShared(model, message.from, message.transitionKey);
          console.log('[ModelBridge] makeTransitionShared complete, scheduling immediate autosave');
          this.scheduleAutosave(model, 100); // Immediate save for structural changes
          break;

        case 'domain:updateSharedTransition':
          await this.updateSharedTransition(model, message.transitionKey, message.sharedTransition);
          this.scheduleAutosave(model);
          break;

        case 'domain:updateStartTransition':
          await this.updateStartTransition(model, message.startTransition);
          await this.updateWebviewForModel(model, panel);
          this.scheduleAutosave(model);
          break;

        case 'domain:convertSharedToRegular':
          await this.convertSharedToRegular(model, message.transitionKey, message.targetState);
          this.scheduleAutosave(model, 100); // Immediate save for structural changes
          break;

        case 'domain:removeFromSharedTransition': {
          console.log('[ModelBridge] Handling domain:removeFromSharedTransition');
          const deleted = await this.removeFromSharedTransition(model, message.transitionKey, message.stateKey);
          console.log('[ModelBridge] Deletion result:', deleted);
          if (deleted) {
            console.log('[ModelBridge] Scheduling immediate autosave');
            this.scheduleAutosave(model, 100); // Immediate save for structural changes
          }
          break;
        }

        case 'domain:updateComment':
          await this.updateComment(model, message);
          this.scheduleAutosave(model);
          break;

        case 'domain:addState':
          await this.addState(model, message.state, message.position, message.pluginId, message.hints);
          this.scheduleAutosave(model, 100); // Immediate save for structural changes
          break;

        case 'mapping:createFile':
          await this.createMappingFile(model, message);
          break;

        case 'mapping:loadFromFile':
          await this.loadMappingFromFile(model, message);
          break;

        case 'mapping:openMapper':
          await this.openMapperForTask(model, message);
          break;

        case 'task:createNew':
          await vscode.commands.executeCommand('taskEditor.newTask');
          break;

        case 'task:create':
          await this.handleTaskCreation(message, model, panel);
          break;

        case 'task:open':
          await this.handleOpenTask(message, panel);
          break;

        case 'rule:loadFromFile':
          await this.loadRuleFromFile(model, message);
          break;

        case 'editor:openInVSCode':
          await this.openScriptInVSCode(model, message.location, panel);
          break;

        case 'editor:createScript':
          await this.createScriptFile(model, message.content, message.location, message.scriptType, panel);
          break;

        case 'editor:createOrBindScript':
          await this.createOrBindScriptFile(model, message.content, message.location, message.scriptType, message.mode, panel);
          break;

        case 'dependency:open':
          await this.openDependency(model, message.dependency);
          break;

        case 'dependency:validate':
          await this.validateDependencies(model, message.dependencies, panel);
          break;

        case 'workflow:getSettings':
          await this.getWorkflowSettings(model, panel);
          break;

        case 'workflow:updateSettings':
          await this.updateWorkflowSettings(model, message.data, panel);
          break;

        case 'test:openPanel':
          await vscode.commands.executeCommand('amorphie.openTestPanel', message.workflow);
          break;

        case 'request:lint':
          await this.performLinting(model, panel);
          break;

        case 'request:exportDocumentation':
          await this.exportDocumentation(model, message.content, message.filename, message.svgContent, message.svgFilename);
          break;

        case 'request:autoLayout':
          await this.performAutoLayout(model, message.nodeSizes, message.edgeLabelSizes, message.direction);
          break;

        case 'navigate:subflow':
          await this.navigateToSubflow(model, message.stateKey);
          break;

        case 'confirm:unsavedChanges':
          await this.handleUnsavedChangesConfirmation(panel, message.message || 'You have unsaved changes. Do you want to save them?');
          break;

        case 'deploy:current':
          await this.handleDeployCurrent(model, panel, message.force);
          break;

        case 'deploy:changed':
          await this.handleDeployChanged(panel, message.force);
          break;

        case 'deploy:checkStatus':
          await this.handleCheckDeployStatus(panel);
          break;

        case 'deploy:selectEnvironment':
          await this.handleSelectEnvironment(panel);
          break;

        case 'deploy:openSettings':
          await vscode.commands.executeCommand('amorphie.openSettings');
          break;
      }

      // After handling the message, update the webview if needed
      if (this.shouldUpdateWebview(message.type)) {
        console.log('[ModelBridge] Updating webview for message type:', message.type);
        await this.updateWebviewForModel(model, panel);
        console.log('[ModelBridge] Webview update complete');
      }
    } catch (error) {
      console.error(`Error handling message ${message.type}:`, error);
      vscode.window.showErrorMessage(`Error: ${error}`);
    }
  }

  /**
   * Set start transition
   */
  private async setStartTransition(model: WorkflowModel, target: string): Promise<void> {
    const workflow = model.getWorkflow();
    workflow.attributes.startTransition = {
      key: 'start',
      target,
      versionStrategy: 'Major',
      triggerType: 0
    };
    // Autosave will be triggered by the message handler
  }

  /**
   * Set cancel transition
   */
  private async setCancelTransition(model: WorkflowModel, target: string): Promise<void> {
    const workflow = model.getWorkflow();
    workflow.attributes.cancel = {
      key: 'cancel',
      target,
      versionStrategy: 'Major',
      triggerType: 0,
      labels: [{ label: 'Cancel', language: 'en' }]
    };
    // Autosave will be triggered by the message handler
  }

  /**
   * Add a transition between states
   */
  private async addTransition(
    model: WorkflowModel,
    from: string,
    target: string,
    triggerType: 1 | 3 = 1
  ): Promise<void> {
    const workflow = model.getWorkflow();
    const sourceState = workflow.attributes.states.find(s => s.key === from);

    if (!sourceState) {
      throw new Error(`Source state ${from} not found`);
    }

    if (!sourceState.transitions) {
      sourceState.transitions = [];
    }

    // Check for duplicate - for self-loops, allow multiple (they can have different conditions)
    // For regular transitions, prevent exact duplicates
    const isSelfLoop = from === target;
    if (!isSelfLoop && sourceState.transitions.find(t => t.target === target)) {
      vscode.window.showInformationMessage(`A transition from ${from} to ${target} already exists`);
      return;
    }

    // Generate unique key - pass existing transitions to ensure uniqueness
    const key = this.generateTransitionKey(from, target, sourceState.transitions || []);

    sourceState.transitions.push({
      key,
      target,
      versionStrategy: 'Major',
      triggerType,
      labels: [
        { label: key, language: 'en-US' },
        { label: key, language: 'tr-TR' }
      ]
    });

    // Autosave will be triggered by the message handler
  }

  /**
   * Move a transition
   */
  private async moveTransition(
    model: WorkflowModel,
    oldFrom: string,
    tKey: string,
    newFrom: string,
    newTarget: string
  ): Promise<void> {
    const workflow = model.getWorkflow();

    // Find and remove from old source
    const oldSource = workflow.attributes.states.find(s => s.key === oldFrom);
    if (!oldSource?.transitions) {
      throw new Error(`Transition ${tKey} not found in state ${oldFrom}`);
    }

    const transitionIndex = oldSource.transitions.findIndex(t => t.key === tKey);
    if (transitionIndex === -1) {
      throw new Error(`Transition ${tKey} not found`);
    }

    const transition = oldSource.transitions.splice(transitionIndex, 1)[0];
    if (oldSource.transitions.length === 0) {
      delete oldSource.transitions;
    }

    // Add to new source
    const newSource = workflow.attributes.states.find(s => s.key === newFrom);
    if (!newSource) {
      throw new Error(`State ${newFrom} not found`);
    }

    if (!newSource.transitions) {
      newSource.transitions = [];
    }

    transition.target = newTarget;
    newSource.transitions.push(transition);

    // Autosave will be triggered by the message handler
  }

  /**
   * Remove a transition
   */
  private async removeTransition(model: WorkflowModel, from: string, tKey: string): Promise<void> {
    const workflow = model.getWorkflow();
    const state = workflow.attributes.states.find(s => s.key === from);

    if (!state?.transitions) {
      return;
    }

    const index = state.transitions.findIndex(t => t.key === tKey);
    if (index !== -1) {
      state.transitions.splice(index, 1);
      if (state.transitions.length === 0) {
        delete state.transitions;
      }
    }

    // Autosave will be triggered by the message handler
  }

  /**
   * Remove a state
   */
  private async removeState(model: WorkflowModel, stateKey: string): Promise<void> {
    model.deleteState(stateKey);

    // Also remove from diagram
    const diagram = model.getDiagram();
    if (diagram?.nodePos[stateKey]) {
      delete diagram.nodePos[stateKey];
      model.setDiagram(diagram);
    }

    // Autosave will be triggered by the message handler
  }

  /**
   * Update a state
   */
  private async updateState(model: WorkflowModel, stateKey: string, state: State): Promise<void> {
    const workflow = model.getWorkflow();
    const oldState = workflow.attributes.states.find(s => s.key === stateKey);

    if (!oldState) {
      throw new Error(`State ${stateKey} not found`);
    }

    // Handle key change
    if (state.key !== stateKey) {
      // Update all references
      this.updateStateReferences(workflow, stateKey, state.key);

      // Update diagram
      const diagram = model.getDiagram();
      if (diagram?.nodePos[stateKey]) {
        diagram.nodePos[state.key] = diagram.nodePos[stateKey];
        delete diagram.nodePos[stateKey];
        model.setDiagram(diagram);
      }
    }

    // Update the state
    model.updateState(stateKey, state);
    // Autosave will be triggered by the message handler
  }

  /**
   * Update a transition
   */
  private async updateTransition(
    model: WorkflowModel,
    from: string,
    transitionKey: string,
    transition: Transition
  ): Promise<void> {
    const workflow = model.getWorkflow();
    const state = workflow.attributes.states.find(s => s.key === from);

    if (!state?.transitions) {
      throw new Error(`Transition ${transitionKey} not found`);
    }

    const index = state.transitions.findIndex(t => t.key === transitionKey);
    if (index !== -1) {
      state.transitions[index] = transition;
    }

    // Autosave will be triggered by the message handler
  }

  private async updateComment(
    model: WorkflowModel,
    message: { elementType: 'state' | 'transition' | 'workflow'; stateKey?: string; from?: string; transitionKey?: string; comment: string }
  ): Promise<void> {
    const workflow = model.getWorkflow();

    if (message.elementType === 'state' && message.stateKey) {
      const state = workflow.attributes.states.find(s => s.key === message.stateKey);
      if (state) {
        state._comment = message.comment || undefined;
      }
    } else if (message.elementType === 'transition' && message.from && message.transitionKey) {
      const state = workflow.attributes.states.find(s => s.key === message.from);
      if (state?.transitions) {
        const transition = state.transitions.find(t => t.key === message.transitionKey);
        if (transition) {
          transition._comment = message.comment || undefined;
        }
      }
    } else if (message.elementType === 'workflow') {
      workflow._comment = message.comment || undefined;
    }

    // Autosave will be triggered by the message handler
  }

  /**
   * Make a transition shared
   */
  private async makeTransitionShared(
    model: WorkflowModel,
    from: string,
    transitionKey: string
  ): Promise<void> {
    console.log('[ModelBridge] makeTransitionShared called:', { from, transitionKey });
    const workflow = model.getWorkflow();
    const state = workflow.attributes.states.find(s => s.key === from);

    console.log('[ModelBridge] Found state:', state?.key, 'transitions:', state?.transitions?.length);

    if (!state?.transitions) {
      console.error('[ModelBridge] No transitions found on state');
      throw new Error(`Transition ${transitionKey} not found`);
    }

    const index = state.transitions.findIndex(t => t.key === transitionKey);
    console.log('[ModelBridge] Transition index:', index);

    if (index === -1) {
      console.error('[ModelBridge] Transition not found in state.transitions');
      console.log('[ModelBridge] Available transitions:', state.transitions.map(t => t.key));
      throw new Error(`Transition ${transitionKey} not found`);
    }

    const transition = state.transitions.splice(index, 1)[0];
    console.log('[ModelBridge] Removed transition:', { key: transition.key, target: transition.target });

    if (state.transitions.length === 0) {
      delete state.transitions;
      console.log('[ModelBridge] Deleted empty transitions array');
    }

    // Add to shared transitions
    if (!workflow.attributes.sharedTransitions) {
      workflow.attributes.sharedTransitions = [];
      console.log('[ModelBridge] Created sharedTransitions array');
    }

    // Check if this is a self-loop transition
    const isSelfLoop = transition.target === from;
    console.log('[ModelBridge] Is self-loop:', isSelfLoop, 'target:', transition.target, 'from:', from);

    const sharedTransition: SharedTransition = {
      ...transition,
      // If it's a self-loop, use "$self" as the target
      target: isSelfLoop ? '$self' : transition.target,
      availableIn: [from]
    };

    console.log('[ModelBridge] Adding shared transition:', { key: sharedTransition.key, target: sharedTransition.target, availableIn: sharedTransition.availableIn });

    workflow.attributes.sharedTransitions.push(sharedTransition);
    console.log('[ModelBridge] Total shared transitions now:', workflow.attributes.sharedTransitions.length);
    // Autosave will be triggered by the message handler
  }

  /**
   * Update a shared transition
   */
  private async updateSharedTransition(
    model: WorkflowModel,
    transitionKey: string,
    sharedTransition: SharedTransition
  ): Promise<void> {
    const workflow = model.getWorkflow();

    if (!workflow.attributes.sharedTransitions) {
      throw new Error(`Shared transition ${transitionKey} not found`);
    }

    const index = workflow.attributes.sharedTransitions.findIndex(t => t.key === transitionKey);
    if (index !== -1) {
      workflow.attributes.sharedTransitions[index] = sharedTransition;
    }

    // Autosave will be triggered by the message handler
  }

  /**
   * Update start transition
   */
  private async updateStartTransition(
    model: WorkflowModel,
    startTransition: Transition
  ): Promise<void> {
    const workflow = model.getWorkflow();

    // Enforce schema requirement: startTransition.triggerType must be 0 (Manual)
    if (startTransition.triggerType !== 0) {
      console.warn('[ModelBridge] startTransition.triggerType must be 0 (Manual), forcing correction');
      startTransition.triggerType = 0;
    }

    workflow.attributes.startTransition = startTransition;
    // Autosave will be triggered by the message handler
  }

  /**
   * Convert shared transition to regular
   */
  private async convertSharedToRegular(
    model: WorkflowModel,
    transitionKey: string,
    targetState: string
  ): Promise<void> {
    const workflow = model.getWorkflow();

    if (!workflow.attributes.sharedTransitions) {
      throw new Error(`Shared transition ${transitionKey} not found`);
    }

    const index = workflow.attributes.sharedTransitions.findIndex(t => t.key === transitionKey);
    if (index === -1) {
      throw new Error(`Shared transition ${transitionKey} not found`);
    }

    const sharedTransition = workflow.attributes.sharedTransitions.splice(index, 1)[0];

    // Add as regular transition
    const state = workflow.attributes.states.find(s => s.key === targetState);
    if (!state) {
      throw new Error(`State ${targetState} not found`);
    }

    if (!state.transitions) {
      state.transitions = [];
    }

    const { availableIn, ...regularTransition } = sharedTransition;
    // Resolve "$self" target to the actual state
    if (regularTransition.target === '$self') {
      regularTransition.target = targetState;
    }
    state.transitions.push(regularTransition as Transition);

    // Autosave will be triggered by the message handler
  }

  /**
   * Remove state from shared transition
   * @returns true if deletion occurred, false if cancelled by user
   */
  private async removeFromSharedTransition(
    model: WorkflowModel,
    transitionKey: string,
    stateKey: string
  ): Promise<boolean> {
    const workflow = model.getWorkflow();

    console.log('[ModelBridge] removeFromSharedTransition called:', { transitionKey, stateKey });

    if (!workflow.attributes.sharedTransitions) {
      console.log('[ModelBridge] No shared transitions found');
      return false;
    }

    const transition = workflow.attributes.sharedTransitions.find(t => t.key === transitionKey);
    if (!transition) {
      console.log('[ModelBridge] Transition not found:', transitionKey);
      return false;
    }

    console.log('[ModelBridge] Found transition:', {
      key: transition.key,
      target: transition.target,
      availableIn: transition.availableIn
    });

    if (transition.availableIn.length === 1 && transition.availableIn[0] === stateKey) {
      // Last state - remove the entire shared transition
      const targetDisplay = transition.target === '$self' ? `${stateKey} (self-loop)` : transition.target;
      console.log('[ModelBridge] Showing delete warning for last state');

      const answer = await vscode.window.showWarningMessage(
        `This is the last state using shared transition "${transitionKey}" → ${targetDisplay}. Delete the entire shared transition?`,
        'Yes, Delete',
        'Cancel'
      );

      console.log('[ModelBridge] User answered:', answer);

      if (answer === 'Yes, Delete') {
        const index = workflow.attributes.sharedTransitions.findIndex(t => t.key === transitionKey);
        console.log('[ModelBridge] Deleting transition at index:', index, 'before length:', workflow.attributes.sharedTransitions.length);

        workflow.attributes.sharedTransitions.splice(index, 1);

        console.log('[ModelBridge] After deletion, length:', workflow.attributes.sharedTransitions.length);

        return true;
      } else {
        // User cancelled
        console.log('[ModelBridge] User cancelled deletion');
        return false;
      }
    } else {
      // Remove state from availableIn
      console.log('[ModelBridge] Removing state from availableIn (not last state)');
      transition.availableIn = transition.availableIn.filter(s => s !== stateKey);
      return true;
    }
  }

  /**
   * Add a new state
   */
  private async addState(
    model: WorkflowModel,
    state: State,
    position: { x: number; y: number },
    pluginId?: string,
    hints?: DesignHints
  ): Promise<void> {
    model.addState(state);

    // Update diagram
    const diagram = model.getDiagram() || { nodePos: {} };
    diagram.nodePos[state.key] = position;
    model.setDiagram(diagram);

    // Store design hints if this is a plugin state
    if (pluginId && hints) {
      const modelKey = this.getModelKey(model);
      let hintsManager = this.hintsManagers.get(modelKey);
      if (!hintsManager) {
        hintsManager = new DesignHintsManager();
        this.hintsManagers.set(modelKey, hintsManager);
      }
      hintsManager.setStateHints(state.key, hints);
    }

    // Autosave will be triggered by the message handler
  }

  /**
   * Get unique key for model
   */
  private getModelKey(model: WorkflowModel): string {
    const workflow = model.getWorkflow();
    return `${workflow.domain}/${workflow.flow}/${workflow.key}`;
  }

  /**
   * Create a mapping file
   */
  private async createMappingFile(model: WorkflowModel, message: any): Promise<void> {
    const { location, code } = message;

    if (!location) {
      return;
    }

    // Validate the location path
    if (location.includes('..') || path.isAbsolute(location)) {
      vscode.window.showErrorMessage(
        `Invalid file location: ${location}\n` +
        'Mapping files must use relative paths within the project directory.'
      );
      return;
    }

    // Check if file exists
    const script = model.getScript(location);
    if (script?.exists) {
      return; // Don't overwrite existing files
    }

    // Get the absolute path for display to user
    const basePath = path.dirname(model.getModelState().metadata.workflowPath);
    const absolutePath = path.resolve(basePath, location);

    // Ensure the path is within the project directory
    const normalizedBasePath = path.normalize(basePath);
    const normalizedAbsolutePath = path.normalize(absolutePath);
    if (!normalizedAbsolutePath.startsWith(normalizedBasePath)) {
      vscode.window.showErrorMessage(
        `Security Error: Cannot create files outside of project directory.\n` +
        `Attempted path: ${absolutePath}`
      );
      return;
    }

    // Ask for user confirmation before creating the file
    const choice = await vscode.window.showWarningMessage(
      `Create mapping file at:\n${absolutePath}?`,
      { modal: true },
      'Create File',
      'Cancel'
    );

    if (choice !== 'Create File') {
      return; // User cancelled
    }

    // Decode Base64 if needed
    let content = '';
    if (code) {
      try {
        const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(code) && code.length % 4 === 0 && code.length > 10;
        content = isBase64 ? Buffer.from(code, 'base64').toString('utf8') : code;
      } catch {
        content = code;
      }
    }

    // Create script with template if no content
    if (!content) {
      await model.createScript(location, 'default');
    } else {
      await model.updateScript(location, content);
    }

    await this.saveModel(model);

    // Show confirmation to user
    vscode.window.showInformationMessage(`Mapping file created at: ${location}`);
  }

  /**
   * Load mapping from file
   */
  private async loadMappingFromFile(model: WorkflowModel, message: any): Promise<void> {
    const picks = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { CSX: ['csx'] }
    });

    if (!picks || picks.length === 0) {
      return;
    }

    const fileUri = picks[0];
    const bytes = await vscode.workspace.fs.readFile(fileUri);
    const content = new TextDecoder().decode(bytes);

    const basePath = path.dirname(model.getModelState().metadata.workflowPath);
    let rel = path.relative(basePath, fileUri.fsPath);
    if (!rel.startsWith('.')) {
      rel = `./${rel}`;
    }

    // Update the script
    await model.updateScript(rel, content);

    // Update the task mapping reference
    await this.updateTaskMapping(model, message, rel);

    await this.saveModel(model);
  }

  /**
   * Load rule from file
   */
  private async loadRuleFromFile(model: WorkflowModel, message: any): Promise<void> {
    const { from, transitionKey } = message;

    const picks = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { CSX: ['csx'] }
    });

    if (!picks || picks.length === 0) {
      return;
    }

    const fileUri = picks[0];
    const bytes = await vscode.workspace.fs.readFile(fileUri);
    const content = new TextDecoder().decode(bytes);

    const basePath = path.dirname(model.getModelState().metadata.workflowPath);
    let rel = path.relative(basePath, fileUri.fsPath);
    if (!rel.startsWith('.')) {
      rel = `./${rel}`;
    }

    // Update the script
    await model.updateScript(rel, content);

    // Update the transition rule reference
    const workflow = model.getWorkflow();
    const state = workflow.attributes.states.find(s => s.key === from);
    if (state?.transitions) {
      const transition = state.transitions.find(t => t.key === transitionKey);
      if (transition) {
        transition.rule = {
          location: rel,
          code: Buffer.from(content).toString('base64')
        };
      }
    }

    await this.saveModel(model);
  }

  /**
   * Validate dependencies and send results back to webview
   */
  private async validateDependencies(
    model: WorkflowModel,
    dependencies: Array<{ type: string; key: string; domain?: string; flow?: string; version?: string; location?: string; ref?: string }>,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    console.log('[ModelBridge] Validating', dependencies.length, 'dependencies');
    const basePath = path.dirname(model.getModelState().metadata.workflowPath);
    const results: Array<{ index: number; exists: boolean }> = [];

    for (let i = 0; i < dependencies.length; i++) {
      const dep = dependencies[i];
      let exists = false;

      try {
        // For scripts with location, check file directly (relative to workflow file)
        if (dep.type === 'Script' && dep.location) {
          const absolutePath = path.resolve(basePath, dep.location);
          console.log(`[ModelBridge] Validating script [${i}]:`, dep.location, '→', absolutePath);
          try {
            await vscode.workspace.fs.stat(vscode.Uri.file(absolutePath));
            exists = true;
            console.log(`[ModelBridge] Script [${i}] exists: true`);
          } catch {
            exists = false;
            console.log(`[ModelBridge] Script [${i}] exists: false`);
          }
        } else if (dep.ref) {
          // For ref-style references, resolve directly from workflow directory
          const absolutePath = path.resolve(basePath, dep.ref);
          console.log(`[ModelBridge] Validating ${dep.type} ref [${i}]:`, dep.ref, '→', absolutePath);
          try {
            await vscode.workspace.fs.stat(vscode.Uri.file(absolutePath));
            exists = true;
            console.log(`[ModelBridge] ${dep.type} ref [${i}] exists: true`);
          } catch {
            exists = false;
            console.log(`[ModelBridge] ${dep.type} ref [${i}] exists: false`);
          }
        } else if (this.globalResolver && dep.key) {
          // For key-style references, use ComponentResolver with search paths
          const componentType = dep.type.toLowerCase() + 's' as 'tasks' | 'schemas' | 'views' | 'functions' | 'extensions' | 'workflows';

          const componentRef = {
            key: dep.key,
            domain: dep.domain,
            flow: dep.flow,
            version: dep.version
          };

          console.log(`[ModelBridge] Validating ${dep.type} [${i}]:`, componentRef);
          const foundPath = await this.globalResolver.resolveComponentPath(componentRef, componentType);
          exists = foundPath !== null;
          console.log(`[ModelBridge] ${dep.type} [${i}] exists:`, exists, 'path:', foundPath);
        }
      } catch (error) {
        console.error('[ModelBridge] Error validating dependency:', error);
        exists = false;
      }

      results.push({ index: i, exists });
    }

    console.log('[ModelBridge] Validation complete, sending results:', results);
    // Send results back to webview
    panel.webview.postMessage({
      type: 'dependency:validation',
      results
    });
  }

  /**
   * Open a dependency file in VS Code (script, task, schema, etc.)
   */
  private async openDependency(model: WorkflowModel, dependency: { type: string; key: string; domain?: string; flow?: string; version?: string; location?: string; ref?: string }): Promise<void> {
    try {
      const basePath = path.dirname(model.getModelState().metadata.workflowPath);

      // For scripts with location, open the file directly
      if (dependency.type === 'Script' && dependency.location) {
        const absolutePath = path.resolve(basePath, dependency.location);

        // Check if file exists
        try {
          await vscode.workspace.fs.stat(vscode.Uri.file(absolutePath));
        } catch {
          vscode.window.showErrorMessage(`File not found: ${dependency.location}`);
          return;
        }

        // Open the file to the right
        const document = await vscode.workspace.openTextDocument(absolutePath);
        await vscode.window.showTextDocument(document, {
          viewColumn: vscode.ViewColumn.Beside,
          preserveFocus: false
        });
        return;
      }

      // For workflows, use the flowEditor.open command to open in visual editor
      if (dependency.type === 'Workflow') {
        if (!this.globalResolver) {
          vscode.window.showErrorMessage('Component resolver not initialized');
          return;
        }

        // Build the component reference
        let componentRef: any;
        if (dependency.ref) {
          componentRef = { ref: dependency.ref };
        } else if (dependency.key) {
          componentRef = {
            key: dependency.key,
            domain: dependency.domain,
            flow: dependency.flow,
            version: dependency.version
          };
        } else {
          vscode.window.showErrorMessage(`Invalid workflow reference`);
          return;
        }

        // Use ComponentResolver to find the workflow file
        console.log('[ModelBridge] Resolving workflow:', componentRef);
        const foundPath = await this.globalResolver.resolveComponentPath(componentRef, 'workflows');
        console.log('[ModelBridge] Found workflow path:', foundPath);

        if (foundPath) {
          // Open the workflow in the visual editor
          await vscode.commands.executeCommand('flowEditor.open', vscode.Uri.file(foundPath));
        } else {
          const refInfo = dependency.ref || (dependency.domain ? `${dependency.domain}/${dependency.key}` : dependency.key);
          vscode.window.showErrorMessage(`Could not find workflow: ${refInfo}`);
        }
        return;
      }

      // For all other components (tasks, schemas, views, functions, extensions), use ComponentResolver
      if (!this.globalResolver) {
        vscode.window.showErrorMessage('Component resolver not initialized');
        return;
      }

      const componentType = dependency.type.toLowerCase() + 's' as 'tasks' | 'schemas' | 'views' | 'functions' | 'extensions';

      // Build the component reference - handle both ref-style and normalized
      let componentRef: any;
      if (dependency.ref) {
        // File-based reference
        componentRef = { ref: dependency.ref };
      } else if (dependency.key) {
        // Normalized reference
        componentRef = {
          key: dependency.key,
          domain: dependency.domain,
          flow: dependency.flow,
          version: dependency.version
        };
      } else {
        vscode.window.showErrorMessage(`Invalid dependency reference`);
        return;
      }

      // Use ComponentResolver to find the file
      console.log('[ModelBridge] Resolving component:', componentRef, 'type:', componentType);
      console.log('[ModelBridge] Resolver basePath:', this.globalResolver['options'].basePath);
      const foundPath = await this.globalResolver.resolveComponentPath(componentRef, componentType);
      console.log('[ModelBridge] Found path:', foundPath);

      if (foundPath) {
        const document = await vscode.workspace.openTextDocument(foundPath);
        await vscode.window.showTextDocument(document, {
          viewColumn: vscode.ViewColumn.Beside,
          preserveFocus: false
        });
      } else {
        const refInfo = dependency.ref || (dependency.domain ? `${dependency.domain}/${dependency.key}` : dependency.key);
        console.error('[ModelBridge] Could not resolve component. Resolver config:', {
          basePath: this.globalResolver['options'].basePath,
          searchPaths: this.globalResolver['options'].searchPaths,
          componentRef,
          componentType
        });
        vscode.window.showErrorMessage(`Could not find ${dependency.type}: ${refInfo}`);
      }
    } catch (error) {
      console.error('Error opening dependency:', error);
      vscode.window.showErrorMessage(`Failed to open dependency: ${error}`);
    }
  }

  /**
   * Open a script file in VS Code
   */
  private async openScriptInVSCode(model: WorkflowModel, location: string, panel: vscode.WebviewPanel): Promise<void> {
    try {
      // Resolve the absolute path
      const basePath = path.dirname(model.getModelState().metadata.workflowPath);
      const absolutePath = path.resolve(basePath, location);

      // Check if file exists
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(absolutePath));
      } catch {
        panel.webview.postMessage({
          type: 'editor:fileOpened',
          success: false,
          error: `File not found: ${location}`
        });
        vscode.window.showErrorMessage(`Script file not found: ${location}`);
        return;
      }

      // Open the file in VS Code in a new tab (preserves the workflow editor)
      const document = await vscode.workspace.openTextDocument(absolutePath);
      await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: false
      });

      panel.webview.postMessage({
        type: 'editor:fileOpened',
        success: true
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      panel.webview.postMessage({
        type: 'editor:fileOpened',
        success: false,
        error: errorMessage
      });
      vscode.window.showErrorMessage(`Failed to open file: ${errorMessage}`);
    }
  }

  /**
   * Create a new script file (.csx)
   */
  private async createScriptFile(
    model: WorkflowModel,
    content: string,
    location: string,
    scriptType: 'mapping' | 'rule',
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      // Validate the location path
      if (location.includes('..') || path.isAbsolute(location)) {
        panel.webview.postMessage({
          type: 'editor:scriptCreated',
          success: false,
          error: 'Script files must use relative paths within the project directory.'
        });
        vscode.window.showErrorMessage(
          `Invalid file location: ${location}\nScript files must use relative paths within the project directory.`
        );
        return;
      }

      // Get the absolute path
      const basePath = path.dirname(model.getModelState().metadata.workflowPath);
      const absolutePath = path.resolve(basePath, location);

      // Ensure the path is within the project directory (security check)
      const normalizedBasePath = path.normalize(basePath);
      const normalizedAbsolutePath = path.normalize(absolutePath);
      if (!normalizedAbsolutePath.startsWith(normalizedBasePath)) {
        panel.webview.postMessage({
          type: 'editor:scriptCreated',
          success: false,
          error: 'Cannot create files outside of project directory.'
        });
        vscode.window.showErrorMessage(
          `Security Error: Cannot create files outside of project directory.\nAttempted path: ${absolutePath}`
        );
        return;
      }

      // Check if file already exists
      const script = model.getScript(location);
      if (script?.exists) {
        panel.webview.postMessage({
          type: 'editor:scriptCreated',
          success: false,
          error: 'File already exists'
        });
        vscode.window.showErrorMessage(`File already exists: ${location}`);
        return;
      }

      // Create the script file
      await model.updateScript(location, content);
      await this.saveModel(model);

      // Reload model to pick up the new script
      await model.load({
        preloadComponents: true,
        basePath: model.getModelState().metadata.basePath
      });

      // Send updated catalogs to webview
      const catalogs = this.getCatalogsFromModel(model);
      const tasks = Array.from(model.getModelState().components.tasks.values());
      panel.webview.postMessage({
        type: 'catalog:update',
        tasks,
        catalogs
      });

      // Send success response
      panel.webview.postMessage({
        type: 'editor:scriptCreated',
        success: true,
        location
      });

      // No need to show confirmation message - user can open file from the popup using "Edit in VS Code" button
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      panel.webview.postMessage({
        type: 'editor:scriptCreated',
        success: false,
        error: errorMessage
      });
      vscode.window.showErrorMessage(`Failed to create script file: ${errorMessage}`);
    }
  }

  /**
   * Create or override a script file with support for override mode
   * Handles both creating new files and overriding existing files based on mode
   */
  private async createOrBindScriptFile(
    model: WorkflowModel,
    content: string,
    location: string,
    scriptType: 'mapping' | 'rule',
    mode: 'create' | 'override',
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      // Validate the location path (same security checks as createScriptFile)
      if (location.includes('..') || path.isAbsolute(location)) {
        panel.webview.postMessage({
          type: 'editor:scriptOperationResult',
          success: false,
          error: 'Script files must use relative paths within the project directory.',
          action: 'failed'
        });
        vscode.window.showErrorMessage(
          `Invalid file location: ${location}\nScript files must use relative paths within the project directory.`
        );
        return;
      }

      // Get the absolute path
      const basePath = path.dirname(model.getModelState().metadata.workflowPath);
      const absolutePath = path.resolve(basePath, location);

      // Ensure the path is within the project directory (security check)
      const normalizedBasePath = path.normalize(basePath);
      const normalizedAbsolutePath = path.normalize(absolutePath);
      if (!normalizedAbsolutePath.startsWith(normalizedBasePath)) {
        panel.webview.postMessage({
          type: 'editor:scriptOperationResult',
          success: false,
          error: 'Cannot create files outside of project directory.',
          action: 'failed'
        });
        vscode.window.showErrorMessage(
          `Security Error: Cannot create files outside of project directory.\nAttempted path: ${absolutePath}`
        );
        return;
      }

      // Check if file already exists
      const script = model.getScript(location);

      if (mode === 'create' && script?.exists) {
        // File exists but mode is 'create' → error (force user to choose different name)
        panel.webview.postMessage({
          type: 'editor:scriptOperationResult',
          success: false,
          error: 'File already exists. Please choose a different name.',
          action: 'failed'
        });
        vscode.window.showErrorMessage(
          `File already exists: ${location}\nPlease choose a different filename.`
        );
        return;
      }

      // Create or override the script file
      let action: 'created' | 'overridden';
      if (mode === 'override') {
        // Override mode → always write (even if file doesn't exist, treat as create)
        await model.updateScript(location, content);
        action = script?.exists ? 'overridden' : 'created';
      } else {
        // Create mode → write new file
        await model.updateScript(location, content);
        action = 'created';
      }

      await this.saveModel(model);

      // Reload model to pick up the new/updated script
      await model.load({
        preloadComponents: true,
        basePath: model.getModelState().metadata.basePath
      });

      // Send updated catalogs to webview
      const catalogs = this.getCatalogsFromModel(model);
      const tasks = Array.from(model.getModelState().components.tasks.values());
      panel.webview.postMessage({
        type: 'catalog:update',
        tasks,
        catalogs
      });

      // Send success response with action
      panel.webview.postMessage({
        type: 'editor:scriptOperationResult',
        success: true,
        location,
        action
      });

      console.log(`[ModelBridge] Script ${action}: ${location}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      panel.webview.postMessage({
        type: 'editor:scriptOperationResult',
        success: false,
        error: errorMessage,
        action: 'failed'
      });
      vscode.window.showErrorMessage(`Failed to ${mode} script file: ${errorMessage}`);
    }
  }

  /**
   * Find the closest Tasks folder to a workflow file by searching upwards in the directory tree
   */
  private async findClosestTasksFolder(workflowPath: string): Promise<vscode.Uri | undefined> {
    let currentDir = path.dirname(workflowPath);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceRoot) {
      return undefined;
    }

    // Search upwards from workflow directory to workspace root
    while (currentDir.startsWith(workspaceRoot)) {
      const tasksFolder = vscode.Uri.file(path.join(currentDir, 'Tasks'));

      try {
        const stat = await vscode.workspace.fs.stat(tasksFolder);
        if (stat.type === vscode.FileType.Directory) {
          return tasksFolder;
        }
      } catch {
        // Tasks folder doesn't exist at this level, continue
      }

      // Move up one directory
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        // Reached filesystem root
        break;
      }
      currentDir = parentDir;
    }

    return undefined;
  }

  /**
   * Handle task creation from webview
   */
  private async handleTaskCreation(message: any, model: WorkflowModel, panel: vscode.WebviewPanel): Promise<void> {
    const { taskName, taskType, version, domain, folderPath, openInQuickEditor } = message;

    try {
      // Find Tasks folder in workspace
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        panel.webview.postMessage({
          type: 'task:created',
          success: false,
          error: 'No workspace folder open'
        });
        return;
      }

      let targetFolder: vscode.Uri | undefined;

      // Use provided folder path or find Tasks folder
      if (folderPath) {
        targetFolder = vscode.Uri.file(folderPath);
      } else {
        // Get workflow path from the model
        const workflowPath = model.getModelState().metadata.workflowPath;
        console.log('[ModelBridge] Task creation - using workflow path from model:', workflowPath);

        // Try to find Tasks folder closest to the workflow
        if (workflowPath) {
          targetFolder = await this.findClosestTasksFolder(workflowPath);
          console.log('[ModelBridge] Task creation - found closest Tasks folder:', targetFolder?.fsPath);
        }

        // If no Tasks folder found nearby, search workspace
        if (!targetFolder) {
          for (const folder of folders) {
            const tasksFolder = vscode.Uri.joinPath(folder.uri, 'Tasks');
            try {
              await vscode.workspace.fs.stat(tasksFolder);
              targetFolder = tasksFolder;
              break;
            } catch {
              // Tasks folder doesn't exist, continue
            }
          }
        }

        if (!targetFolder) {
          // Create Tasks folder in first workspace folder
          targetFolder = vscode.Uri.joinPath(folders[0].uri, 'Tasks');
          await vscode.workspace.fs.createDirectory(targetFolder);
        }
      }

      // Create task template with domain and version
      const taskContent = this.createTaskTemplate(taskName, taskType, version, domain);

      // Create file path with version
      const fileName = `${taskName}.${version}.json`;
      const filePath = vscode.Uri.joinPath(targetFolder, fileName);

      // Check if file already exists
      try {
        await vscode.workspace.fs.stat(filePath);
        panel.webview.postMessage({
          type: 'task:created',
          success: false,
          error: `File ${fileName} already exists`
        });
        return;
      } catch {
        // File doesn't exist, continue
      }

      // Write file
      await vscode.workspace.fs.writeFile(
        filePath,
        Buffer.from(JSON.stringify(taskContent, null, 2), 'utf8')
      );

      // Open in Quick Editor directly
      if (openInQuickEditor) {
        await vscode.commands.executeCommand(
          'vscode.openWith',
          filePath,
          'vnext.taskQuickEditor',
          vscode.ViewColumn.Beside
        );
      } else {
        // Open in JSON editor
        const document = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(document, {
          viewColumn: vscode.ViewColumn.Beside,
          preserveFocus: false
        });
      }

      // Create task reference for the newly created task
      const taskRef = domain && version
        ? `${domain}/sys-tasks/${taskName}@${version}`
        : taskName;

      // Send success message with task reference info
      panel.webview.postMessage({
        type: 'task:created',
        success: true,
        filePath: filePath.fsPath,
        taskRef: taskRef,
        domain: domain,
        flow: 'sys-tasks',
        key: taskName,
        version: version
      });

      vscode.window.showInformationMessage(`Task "${taskName}" created successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      panel.webview.postMessage({
        type: 'task:created',
        success: false,
        error: errorMessage
      });
      vscode.window.showErrorMessage(`Failed to create task: ${errorMessage}`);
    }
  }

  /**
   * Open a task file in the Quick Task Editor
   */
  private async handleOpenTask(message: any, _panel: vscode.WebviewPanel): Promise<void> {
    const { taskRef, domain, flow, key, version } = message;

    console.log('[ModelBridge] handleOpenTask called with message:', message);

    try {
      let componentRef: any;

      // If domain, flow, key, version are provided, use them directly
      if (domain && key) {
        componentRef = {
          domain: domain,
          flow: flow || 'sys-tasks',
          key: key,
          version: version || '1.0.0'
        };
      } else {
        // Otherwise, parse the task reference string
        componentRef = this.parseTaskReference(taskRef);
      }

      console.log('[ModelBridge] Resolving task with componentRef:', componentRef);

      // Use the global component resolver to find the task
      const task = await this.globalResolver.resolveTask(componentRef);

      console.log('[ModelBridge] Task resolved:', task ? 'YES' : 'NO');
      if (task) {
        console.log('[ModelBridge] Task keys:', Object.keys(task));
        console.log('[ModelBridge] Task __filePath:', (task as any).__filePath);
      }

      if (!task) {
        const errorMsg = `Task not found: ${key || taskRef}`;
        console.error('[ModelBridge]', errorMsg);
        vscode.window.showErrorMessage(errorMsg);
        return;
      }

      // Check if the task has a file path
      const filePath = (task as any).__filePath;
      if (!filePath) {
        const errorMsg = `No file path found for task: ${key || taskRef}`;
        console.error('[ModelBridge]', errorMsg);
        console.error('[ModelBridge] Task object:', JSON.stringify(task, null, 2));
        vscode.window.showErrorMessage(errorMsg);
        return;
      }

      console.log('[ModelBridge] Opening task file:', filePath);

      // Open the task file in the Quick Task Editor
      const uri = vscode.Uri.file(filePath);
      await vscode.commands.executeCommand('vscode.openWith', uri, 'vnext.taskQuickEditor', vscode.ViewColumn.Beside);

      console.log('[ModelBridge] Task file opened successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ModelBridge] Error opening task:', error);
      vscode.window.showErrorMessage(`Failed to open task: ${errorMessage}`);
    }
  }

  /**
   * Parse task reference string into ComponentRef
   * Supports formats:
   * - domain/flow/key@version
   * - key
   */
  private parseTaskReference(refString: string): any {
    // Check if it includes @ for version
    const versionMatch = refString.match(/^(.+)@(.+)$/);
    const [mainPart, version] = versionMatch ? [versionMatch[1], versionMatch[2]] : [refString, '1.0.0'];

    // Check if it includes / for domain/flow/key format
    const parts = mainPart.split('/');

    if (parts.length === 3) {
      // Full format: domain/flow/key@version
      return {
        domain: parts[0],
        flow: parts[1],
        key: parts[2],
        version: version
      };
    } else if (parts.length === 1) {
      // Just key, assume defaults
      return {
        domain: 'my-domain',
        flow: 'sys-tasks',
        key: parts[0],
        version: version
      };
    } else {
      // Fallback: treat entire string as key
      return {
        domain: 'my-domain',
        flow: 'sys-tasks',
        key: refString,
        version: '1.0.0'
      };
    }
  }

  /**
   * Create task template based on type
   */
  private createTaskTemplate(name: string, type: string, version: string, domain?: string): any {
    const base = {
      key: name,
      domain: domain || 'my-domain',
      version: version,
      flow: 'sys-tasks',
      flowVersion: '1.0.0',
      tags: ['task'],
      attributes: {
        type: type,
        config: {}
      }
    };

    // Add type-specific default config
    // TaskType enum values: '1' = DaprHttpEndpoint, '2' = DaprBinding, '3' = DaprService, etc.
    switch (type) {
      case '1': // DaprHttpEndpoint
        base.attributes.config = {
          endpointName: '',
          path: '',
          method: 'GET',
          headers: {}
        };
        break;
      case '2': // DaprBinding
        base.attributes.config = {
          bindingName: '',
          operation: '',
          metadata: {},
          data: {}
        };
        break;
      case '3': // DaprService
        base.attributes.config = {
          appId: '',
          methodName: '',
          httpVerb: 'GET',
          data: {},
          queryString: '',
          timeoutSeconds: 30
        };
        break;
      case '4': // DaprPubSub
        base.attributes.config = {
          pubSubName: '',
          topic: '',
          data: {},
          metadata: {}
        };
        break;
      case '5': // HumanTask
        base.attributes.config = {
          title: 'Human Task',
          instructions: '',
          assignedTo: '',
          dueDate: ''
        };
        break;
      case '6': // HttpTask
        base.attributes.config = {
          url: 'https://api.example.com/endpoint',
          method: 'GET',
          headers: {},
          body: {},
          timeout: 30000
        };
        break;
      case '7': // ScriptTask
        base.attributes.config = {
          language: 'csharp',
          script: '',
          parameters: {}
        };
        break;
    }

    return base;
  }

  /**
   * Open mapper editor for task mapping
   */
  private async openMapperForTask(model: WorkflowModel, message: any): Promise<void> {
    const { existingMapperRef } = message;

    if (existingMapperRef) {
      // Open existing mapper file with the mapper editor (not workflow editor)
      const workflowPath = model.getModelState().metadata.workflowPath;
      const workflowDir = path.dirname(workflowPath);
      const mapperPath = path.resolve(workflowDir, existingMapperRef);
      const mapperUri = vscode.Uri.file(mapperPath);

      try {
        // Explicitly open with the mapper editor (viewType: mapperEditor.canvas)
        await vscode.commands.executeCommand('vscode.openWith', mapperUri, 'mapperEditor.canvas');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open mapper: ${error}`);
      }
    } else {
      // No mapper selected - show info message
      const action = await vscode.window.showInformationMessage(
        'No mapper selected. You can select an existing mapper from the dropdown or create a new one.',
        'Create New Mapper'
      );

      if (action === 'Create New Mapper') {
        await vscode.commands.executeCommand('flowEditor.createMapper');
      }
    }
  }

  /**
   * Perform linting
   */
  private async performLinting(model: WorkflowModel, panel: vscode.WebviewPanel): Promise<void> {
    const problems = await this.getLintProblems(model);
    panel.webview.postMessage({
      type: 'lint:update',
      problemsById: problems
    });

    // Also send updated catalogs (in case this was triggered by component file changes)
    const catalogs = this.getCatalogsFromModel(model);
    const tasks = Array.from(model.getModelState().components.tasks.values());
    panel.webview.postMessage({
      type: 'catalog:update',
      tasks,
      catalogs
    });
  }

  /**
   * Export documentation to a markdown file (and optional SVG diagram)
   */
  private async exportDocumentation(model: WorkflowModel, content: string, filename: string, svgContent?: string, svgFilename?: string): Promise<void> {
    // Get the workflow file's directory as the default location
    const workflowPath = model.getModelState().metadata.workflowPath;
    const workflowDir = path.dirname(workflowPath);
    const defaultUri = vscode.Uri.file(path.join(workflowDir, filename));

    const uri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {
        'Markdown': ['md']
      }
    });

    if (uri) {
      // Save the markdown file
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));

      // Save the SVG file in the same directory if provided
      if (svgContent && svgFilename) {
        const svgUri = vscode.Uri.file(path.join(path.dirname(uri.fsPath), svgFilename));
        await vscode.workspace.fs.writeFile(svgUri, Buffer.from(svgContent, 'utf8'));
        vscode.window.showInformationMessage(`Documentation and diagram exported to ${path.dirname(uri.fsPath)}`);
      } else {
        vscode.window.showInformationMessage(`Documentation exported to ${uri.fsPath}`);
      }
    }
  }

  /**
   * Perform auto layout
   */
  private async performAutoLayout(
    model: WorkflowModel,
    nodeSizes?: Record<string, { width: number; height: number }>,
    edgeLabelSizes?: Record<string, { width: number; height: number }>,
    direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP'
  ): Promise<void> {
    const workflow = model.getWorkflow();
    const currentDiagram = model.getDiagram();
    const newDiagram = await autoLayout(workflow, currentDiagram, { nodeSizes, edgeLabelSizes, direction });
    model.setDiagram(newDiagram);
    await this.saveModel(model);
  }

  /**
   * Navigate to subflow
   */
  private async navigateToSubflow(model: WorkflowModel, stateKey: string): Promise<void> {
    console.log('[ModelBridge] navigateToSubflow called for state:', stateKey);
    const workflow = model.getWorkflow();
    const state = workflow.attributes.states.find(s => s.key === stateKey);

    if (!state) {
      console.error('[ModelBridge] State not found:', stateKey);
      vscode.window.showWarningMessage(`State ${stateKey} not found`);
      return;
    }

    if (state.stateType !== 4) {
      console.error('[ModelBridge] State is not a subflow. Type:', state.stateType);
      vscode.window.showWarningMessage(`State ${stateKey} is not a subflow (type: ${state.stateType})`);
      return;
    }

    if (!state.subFlow?.process) {
      console.error('[ModelBridge] State has no subflow process reference');
      vscode.window.showWarningMessage(`State ${stateKey} has no subflow reference configured`);
      return;
    }

    const subflowRef = state.subFlow.process;
    console.log('[ModelBridge] Subflow reference:', JSON.stringify(subflowRef, null, 2));

    // First, try to find the subflow in the catalog
    const modelState = model.getModelState();
    const workflowCatalog = Array.from(modelState.components.workflows.values());

    let targetWorkflow = null;

    // Handle ref-style reference
    if ('ref' in subflowRef && subflowRef.ref) {
      console.log('[ModelBridge] Using ref-style reference:', subflowRef.ref);
      // For ref-style, resolve relative to the workflow file's directory (not project root)
      const workflowDir = path.dirname(modelState.metadata.workflowPath);
      const fullPath = path.resolve(workflowDir, subflowRef.ref);
      console.log('[ModelBridge] Workflow directory:', workflowDir);
      console.log('[ModelBridge] Resolved path:', fullPath);

      try {
        const foundUri = vscode.Uri.file(fullPath);
        // Check if file exists before opening
        try {
          await vscode.workspace.fs.stat(foundUri);
          console.log('[ModelBridge] File exists, opening subflow');
          await this.openSubflowInNewPanel(foundUri);
          return;
        } catch {
          console.error('[ModelBridge] File does not exist:', fullPath);
          vscode.window.showWarningMessage(`Subflow file not found at: ${subflowRef.ref}\nResolved to: ${fullPath}`);
          return;
        }
      } catch (error) {
        console.error('[ModelBridge] Failed to open subflow by ref:', error);
        vscode.window.showWarningMessage(`Failed to open subflow: ${error}`);
        return;
      }
    }

    // Handle explicit reference - search in catalog
    // At this point, we know subflowRef is not a ref-style, so it must have key, domain, flow, version
    if (!('key' in subflowRef)) {
      console.error('[ModelBridge] Invalid subflow reference - neither ref nor explicit format');
      vscode.window.showWarningMessage('Invalid subflow reference format');
      return;
    }

    console.log('[ModelBridge] Searching catalog for subflow. Catalog size:', workflowCatalog.length);
    console.log('[ModelBridge] Search criteria - key:', subflowRef.key, 'domain:', subflowRef.domain, 'flow:', subflowRef.flow, 'version:', subflowRef.version);

    targetWorkflow = workflowCatalog.find(wf => {
      const keyMatches = wf.key === subflowRef.key;
      const domainMatches = !subflowRef.domain || wf.domain === subflowRef.domain;
      const versionMatches = !subflowRef.version || wf.version === subflowRef.version;
      const flowMatches = !subflowRef.flow || wf.flow === subflowRef.flow;

      if (keyMatches) {
        console.log('[ModelBridge] Checking workflow:', {
          key: wf.key,
          domain: wf.domain,
          flow: wf.flow,
          version: wf.version,
          matches: { keyMatches, domainMatches, versionMatches, flowMatches }
        });
      }

      return keyMatches && domainMatches && versionMatches && flowMatches;
    });

    if (!targetWorkflow) {
      // Fallback to filesystem search if not in catalog
      console.log('[ModelBridge] Subflow not found in catalog, falling back to filesystem search');
      const foundUri = await this.findSubflowFile(
        subflowRef.key,
        subflowRef.domain,
        subflowRef.version,
        subflowRef.flow
      );

      if (!foundUri) {
        console.error('[ModelBridge] Filesystem search failed');
        vscode.window.showWarningMessage(
          `Subflow not found: key="${subflowRef.key}", domain="${subflowRef.domain}", flow="${subflowRef.flow}", version="${subflowRef.version}". Make sure the workflow file exists and is in the workspace.`
        );
        return;
      }

      console.log('[ModelBridge] Found via filesystem:', foundUri.fsPath);
      await this.openSubflowInNewPanel(foundUri);
      return;
    }

    // We found the workflow in the catalog, but we need to find its file path
    // Search for the file matching this workflow
    console.log('[ModelBridge] Found in catalog:', targetWorkflow.key, '- searching for file');
    const foundUri = await this.findWorkflowFileInWorkspace(targetWorkflow);

    if (!foundUri) {
      console.error('[ModelBridge] Workflow file not found in workspace');
      vscode.window.showWarningMessage(
        `Workflow file not found for key="${targetWorkflow.key}", domain="${targetWorkflow.domain}". The workflow is in the catalog but its file could not be located.`
      );
      return;
    }

    console.log('[ModelBridge] Opening subflow from:', foundUri.fsPath);
    await this.openSubflowInNewPanel(foundUri);
  }

  /**
   * Open a subflow in a new webview panel
   */
  private async openSubflowInNewPanel(workflowUri: vscode.Uri): Promise<void> {
    // Check if this workflow is already open in a panel
    const panelKey = workflowUri.toString();
    const existingPanel = this.config.activePanels.get(panelKey);

    if (existingPanel) {
      // Workflow is already open, just focus the existing panel
      console.log('[ModelBridge] Workflow already open, focusing existing panel:', panelKey);
      existingPanel.reveal();
      return;
    }

    // Open the subflow in a new editor
    const panel = vscode.window.createWebviewPanel(
      'amorphieFlow',
      'Loading...', // Will be updated after model loads
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.config.context.extensionUri, 'dist-web')
        ]
      }
    );

    // Load webview content
    const webviewDistPath = vscode.Uri.joinPath(this.config.context.extensionUri, 'dist-web');

    try {
      const indexHtmlUri = vscode.Uri.joinPath(webviewDistPath, 'index.html');
      const indexHtmlContent = await vscode.workspace.fs.readFile(indexHtmlUri);
      let html = new TextDecoder().decode(indexHtmlContent);

      // Fix asset paths for webview (handle both absolute /path and relative ./path)
      const webviewUri = panel.webview.asWebviewUri(webviewDistPath);
      html = html.replace(/(src|href)="(\.?\/[^"]+)"/g, (_match, attr, path) => {
        // Remove leading ./ or / from path
        const cleanPath = path.replace(/^\.?\//, '');
        return `${attr}="${webviewUri}/${cleanPath}"`;
      });

      panel.webview.html = html;
    } catch (error) {
      console.error('Failed to load webview content:', error);
      panel.dispose();
      throw error;
    }

    // Wait for the webview to signal it's ready before sending init message
    console.log('[ModelBridge] Waiting for webview ready signal...');
    const readyPromise = new Promise<void>((resolve) => {
      const disposable = panel.webview.onDidReceiveMessage((message: MsgFromWebview) => {
        if (message.type === 'ready') {
          console.log('[ModelBridge] Webview ready signal received');
          disposable.dispose();
          resolve();
        }
      });
    });

    // Set a timeout in case the ready message never arrives
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Webview ready timeout')), 10000);
    });

    try {
      await Promise.race([readyPromise, timeoutPromise]);
      console.log('[ModelBridge] Webview is ready, proceeding to load workflow');
    } catch (error) {
      console.warn('[ModelBridge] Webview ready timeout, loading workflow anyway:', error);
      // Continue anyway - the webview might still work
    }

    // Open the subflow using the model bridge
    const model = await this.openWorkflow(workflowUri, panel);

    // Register message handler for this panel (same as extension.ts)
    panel.webview.onDidReceiveMessage(async (message) => {
      console.log('[ModelBridge/openSubflowInNewPanel] onDidReceiveMessage called with type:', message.type);
      try {
        await this.handleWebviewMessage(message, model, panel);
      } catch (error) {
        console.error(`Error handling message ${message.type}:`, error);
        vscode.window.showErrorMessage(`Error: ${error}`);
      }
    });
  }

  /**
   * Find a workflow file in the workspace by matching workflow object
   */
  private async findWorkflowFileInWorkspace(workflow: any): Promise<vscode.Uri | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return null;
    }

    // Search patterns for workflow files (regular .json files)
    const patterns = [
      '**/*.json'
    ];

    for (const folder of workspaceFolders) {
      for (const pattern of patterns) {
        const files = await vscode.workspace.findFiles(
          new vscode.RelativePattern(folder, pattern),
          '**/node_modules/**'
        );

        for (const file of files) {
          // Skip diagram files
          if (file.fsPath.endsWith('.diagram.json')) {
            continue;
          }

          try {
            const content = await vscode.workspace.fs.readFile(file);
            const wf = JSON.parse(new TextDecoder().decode(content)) as any;

            // Check if this is the workflow we're looking for
            const keyMatches = wf.key === workflow.key;
            const domainMatches = wf.domain === workflow.domain;
            const versionMatches = wf.version === workflow.version;
            const flowMatches = !workflow.flow || wf.flow === workflow.flow;

            if (keyMatches && domainMatches && versionMatches && flowMatches) {
              return file;
            }
          } catch {
            // Not a valid JSON or workflow file, continue
            continue;
          }
        }
      }
    }

    return null;
  }

  /**
   * Find a subflow file by its reference (fallback method)
   */
  private async findSubflowFile(
    key: string,
    domain?: string,
    version?: string,
    flow?: string
  ): Promise<vscode.Uri | null> {
    console.log('[ModelBridge] findSubflowFile - searching for:', { key, domain, version, flow });
    // Get workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      console.log('[ModelBridge] No workspace folders found');
      return null;
    }

    // Search patterns for workflow files (regular .json files)
    const patterns = [
      '**/*.json'
    ];

    let filesChecked = 0;
    for (const folder of workspaceFolders) {
      for (const pattern of patterns) {
        const files = await vscode.workspace.findFiles(
          new vscode.RelativePattern(folder, pattern),
          '**/node_modules/**'
        );
        console.log('[ModelBridge] Found', files.length, 'JSON files to check');

        for (const file of files) {
          // Skip diagram files
          if (file.fsPath.endsWith('.diagram.json')) {
            continue;
          }

          filesChecked++;
          try {
            const content = await vscode.workspace.fs.readFile(file);
            const workflow = JSON.parse(new TextDecoder().decode(content)) as any;

            // Check if this is a workflow (has attributes.states and attributes.startTransition)
            if (!workflow.attributes?.states || !workflow.attributes?.startTransition) {
              continue;
            }

            // Check if this is the workflow we're looking for
            const keyMatches = workflow.key === key;
            const domainMatches = !domain || workflow.domain === domain;
            const versionMatches = !version || workflow.version === version;
            const flowMatches = !flow || workflow.flow === flow;

            if (keyMatches) {
              console.log('[ModelBridge] Found matching key in file:', file.fsPath, {
                keyMatches,
                domainMatches,
                versionMatches,
                flowMatches,
                workflow: { key: workflow.key, domain: workflow.domain, version: workflow.version, flow: workflow.flow }
              });
            }

            if (keyMatches && domainMatches && versionMatches && flowMatches) {
              console.log('[ModelBridge] ✓ Match found:', file.fsPath);
              return file;
            }
          } catch {
            // Not a valid JSON or workflow file, continue
            continue;
          }
        }
      }
    }

    console.log('[ModelBridge] Checked', filesChecked, 'workflow files, no match found');
    return null;
  }

  /**
   * Save the model
   */
  async saveModel(model: WorkflowModel): Promise<void> {
    // Store content before save to prevent false positive external change detection
    const workflow = model.getWorkflow();
    const diagram = model.getDiagram();
    const modelKey = this.getModelKey(model);

    this.lastSavedContent.set(`${modelKey}:workflow`, JSON.stringify(workflow, null, 2));
    if (diagram) {
      this.lastSavedContent.set(`${modelKey}:diagram`, JSON.stringify(diagram, null, 2));
    }

    // Track save timestamp to prevent unnecessary component reloads
    const workflowPath = model.getModelState().metadata.workflowPath;
    this.lastSaveTime.set(workflowPath, Date.now());

    // Ensure this model is set as active before saving
    const previousActive = this.integration.getActiveModel();
    this.integration.setActiveModel(model);

    await this.integration.save({
      backup: false,
      format: true,
      indent: 2,
      updateScriptEncoding: false  // Disabled automatic script encoding to prevent unwanted file creation
    });

    // Restore previous active model if different
    if (previousActive && previousActive !== model) {
      this.integration.setActiveModel(previousActive);
    }
  }

  /**
   * Check if a file was recently saved (within 500ms)
   */
  isRecentlySaved(filePath: string): boolean {
    const lastSave = this.lastSaveTime.get(filePath);
    if (!lastSave) return false;
    return Date.now() - lastSave < 500;
  }

  /**
   * Schedule autosave for a model
   */
  private scheduleAutosave(model: WorkflowModel, delayMs: number = 2000): void {
    const modelKey = this.getModelKey(model);
    console.log('[ModelBridge] scheduleAutosave called for:', modelKey, 'delayMs:', delayMs);

    // Clear existing timer if any
    const existingTimer = this.autosaveTimers.get(modelKey);
    if (existingTimer) {
      console.log('[ModelBridge] Clearing existing autosave timer');
      clearTimeout(existingTimer);
    }

    // Schedule new save
    const timer = setTimeout(async () => {
      try {
        console.log('[ModelBridge] Autosaving model:', modelKey);
        await this.saveModel(model);

        // Find panel for this model and send save confirmation
        const panel = this.getPanelForModel(model);
        if (panel) {
          panel.webview.postMessage({
            type: 'autosave:complete',
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('[ModelBridge] Autosave failed:', error);
      } finally {
        this.autosaveTimers.delete(modelKey);
      }
    }, delayMs);

    this.autosaveTimers.set(modelKey, timer);
  }

  /**
   * Update webview for a model
   */
  async updateWebviewForModel(model: WorkflowModel, panel?: vscode.WebviewPanel): Promise<void> {
    if (!panel) {
      panel = this.getPanelForModel(model);
    }

    if (!panel) {
      return;
    }

    const workflow = model.getWorkflow();
    const diagram = model.getDiagram();

    console.log('[ModelBridge] updateWebviewForModel - shared transitions count:', workflow.attributes.sharedTransitions?.length || 0);
    if (workflow.attributes.sharedTransitions) {
      console.log('[ModelBridge] Shared transitions:', workflow.attributes.sharedTransitions.map(t => ({ key: t.key, target: t.target, availableIn: t.availableIn })));
    }

    if (!diagram) {
      return;
    }

    // Get design hints for this model
    const modelKey = this.getModelKey(model);
    const hintsManager = this.hintsManagers.get(modelKey);
    const designHints = hintsManager ? hintsManager.getAllHints().states : {};

    const derived = toReactFlow(workflow, diagram, 'en', designHints);
    const problems = await this.getLintProblems(model);

    panel.webview.postMessage({
      type: 'workflow:update',
      workflow,
      derived
    });

    panel.webview.postMessage({
      type: 'diagram:update',
      diagram
    });

    panel.webview.postMessage({
      type: 'lint:update',
      problemsById: problems
    });
  }

  /**
   * Get lint problems from model
   * Uses ModelValidator as single source of truth to avoid redundant lint() calls
   */
  private async getLintProblems(model: WorkflowModel): Promise<Record<string, Problem[]>> {
    // Use ModelValidator.validate() which calls lint() internally
    // This avoids redundant lint() calls since diagnostics also uses ModelValidator
    const validationResult = await ModelValidator.validate(model);

    // Convert ValidationResult to Problem[] format for webview
    const problems: Record<string, Problem[]> = {};

    // Add errors
    for (const error of validationResult.errors) {
      const ownerId = error.location || '__schema__';
      if (!problems[ownerId]) {
        problems[ownerId] = [];
      }
      problems[ownerId].push({
        id: error.type,
        message: error.message,
        severity: 'error',
        path: error.path
      });
    }

    // Add warnings
    for (const warning of validationResult.warnings) {
      const ownerId = warning.location || '__schema__';
      if (!problems[ownerId]) {
        problems[ownerId] = [];
      }
      problems[ownerId].push({
        id: warning.type,
        message: warning.message,
        severity: 'warning',
        path: warning.path
      });
    }

    // Update VS Code diagnostics using the same ValidationResult
    const workflowPath = model.getModelState().metadata.workflowPath;
    if (!workflowPath.startsWith('memory://') && this.config.diagnosticsProvider?.updateDiagnosticsFromModel) {
      const uri = vscode.Uri.file(workflowPath);
      await this.config.diagnosticsProvider.updateDiagnosticsFromModel(uri, model);
    }

    return problems;
  }

  /**
   * Get tasks from model
   */
  private getTasksFromModel(model: WorkflowModel): TaskComponentDefinition[] {
    const state = model.getModelState();
    const tasks = Array.from(state.components.tasks.values());
    console.log('[ModelBridge] getTasksFromModel:', tasks.length, 'tasks found');
    if (tasks.length > 0) {
      console.log('[ModelBridge] First task sample:', tasks[0]);
    }
    // Cast to TaskComponentDefinition[] as they should already have the attributes property
    return tasks as TaskComponentDefinition[];
  }

  /**
   * Get catalogs from model
   */
  private getCatalogsFromModel(model: WorkflowModel): Record<string, any[]> {
    const state = model.getModelState();
    const workflowDir = path.dirname(state.metadata.workflowPath);

    // Transform script locations to be relative to workflow file
    const transformScriptLocation = (script: any) => {
      // Calculate path relative to workflow file
      let relativePath = path.relative(workflowDir, script.absolutePath);
      if (!relativePath.startsWith('./') && !relativePath.startsWith('../')) {
        relativePath = `./${relativePath}`;
      }
      return {
        ...script,
        location: relativePath
      };
    };

    // Use globalResolver's catalog if available (workspace-wide discovery)
    // Otherwise fallback to model's own state (per-workflow discovery)
    const globalCatalogs = this.globalResolver?.getCachedComponents();

    const catalogs = {
      task: (globalCatalogs?.tasks && globalCatalogs.tasks.length > 0) ? globalCatalogs.tasks : Array.from(state.components.tasks.values()),
      schema: (globalCatalogs?.schemas && globalCatalogs.schemas.length > 0) ? globalCatalogs.schemas : Array.from(state.components.schemas.values()),
      view: (globalCatalogs?.views && globalCatalogs.views.length > 0) ? globalCatalogs.views : Array.from(state.components.views.values()),
      function: (globalCatalogs?.functions && globalCatalogs.functions.length > 0) ? globalCatalogs.functions : Array.from(state.resolvedFunctions.values()),
      extension: (globalCatalogs?.extensions && globalCatalogs.extensions.length > 0) ? globalCatalogs.extensions : Array.from(state.resolvedExtensions.values()),
      mapper: Array.from(state.mappers.values()).map(transformScriptLocation),
      rule: Array.from(state.rules.values()).map(transformScriptLocation),
      workflow: (globalCatalogs?.workflows && globalCatalogs.workflows.length > 0) ? globalCatalogs.workflows : Array.from(state.components.workflows.values())
    };
    console.log('[ModelBridge] getCatalogsFromModel:', {
      tasks: catalogs.task.length,
      schemas: catalogs.schema.length,
      views: catalogs.view.length,
      functions: catalogs.function.length,
      extensions: catalogs.extension.length,
      mappers: catalogs.mapper.length,
      rules: catalogs.rule.length,
      workflows: catalogs.workflow.length
    });

    // Debug: Log workflow details
    if (catalogs.workflow.length > 0) {
      console.log('[ModelBridge] Workflows in catalog:', catalogs.workflow.map(w => ({
        key: w.key,
        type: w.attributes?.type,
        domain: w.domain,
        version: w.version
      })));
      const subflows = catalogs.workflow.filter(w => w.attributes?.type === 'S' || w.attributes?.type === 'P');
      console.log('[ModelBridge] SubFlows/SubProcesses found:', subflows.length);
      if (subflows.length > 0) {
        console.log('[ModelBridge] SubFlow details:', subflows.map(w => `${w.key} (type: ${w.attributes?.type})`));
      }
    }

    // Debug: Log mapper details
    if (catalogs.mapper.length > 0) {
      console.log('[ModelBridge] Mapper files found:', catalogs.mapper.map(m => m.location));
      console.log('[ModelBridge] First mapper sample:', {
        location: catalogs.mapper[0]?.location,
        hasContent: !!catalogs.mapper[0]?.content,
        contentLength: catalogs.mapper[0]?.content?.length || 0,
        contentPreview: catalogs.mapper[0]?.content?.substring(0, 200)
      });
    }
    return catalogs;
  }

  /**
   * Update diagnostics from validation
   */
  private updateDiagnosticsFromValidation(model: WorkflowModel, result: ValidationResult): void {
    // Convert validation result to VS Code diagnostics
    // This would integrate with your diagnostics provider
    console.log('Validation result:', result);
  }

  /**
   * Update task mapping
   */
  private async updateTaskMapping(model: WorkflowModel, message: any, location: string): Promise<void> {
    const workflow = model.getWorkflow();
    const { stateKey, list, index, from, transitionKey, sharedTransitionKey } = message;

    const base64 = model.getScript(location)?.base64 || '';

    if (stateKey && list) {
      const state = workflow.attributes.states.find(s => s.key === stateKey);
      if (state) {
        const arr = (state as any)[list] as ExecutionTask[];
        if (arr?.[index]) {
          arr[index].mapping = { location, code: base64 };
        }
      }
    } else if (from && transitionKey) {
      const state = workflow.attributes.states.find(s => s.key === from);
      const transition = state?.transitions?.find(t => t.key === transitionKey);
      if (transition?.onExecutionTasks?.[index]) {
        transition.onExecutionTasks[index].mapping = { location, code: base64 };
      }
    } else if (sharedTransitionKey) {
      const transition = workflow.attributes.sharedTransitions?.find(t => t.key === sharedTransitionKey);
      if (transition?.onExecutionTasks?.[index]) {
        transition.onExecutionTasks[index].mapping = { location, code: base64 };
      }
    }
  }

  /**
   * Update state references when a state key changes
   */
  private updateStateReferences(workflow: Workflow, oldKey: string, newKey: string): void {
    // Update transitions
    for (const state of workflow.attributes.states) {
      if (state.transitions) {
        for (const transition of state.transitions) {
          if (transition.target === oldKey) {
            transition.target = newKey;
          }
        }
      }
    }

    // Update shared transitions
    if (workflow.attributes.sharedTransitions) {
      for (const sharedTransition of workflow.attributes.sharedTransitions) {
        if (sharedTransition.target === oldKey) {
          sharedTransition.target = newKey;
        }
        const index = sharedTransition.availableIn.indexOf(oldKey);
        if (index !== -1) {
          sharedTransition.availableIn[index] = newKey;
        }
      }
    }

    // Update start transition
    if (workflow.attributes.startTransition?.target === oldKey) {
      workflow.attributes.startTransition.target = newKey;
    }

    // Update timeout
    if (workflow.attributes.timeout?.target === oldKey) {
      workflow.attributes.timeout.target = newKey;
    }
  }

  /**
   * Get panel for a model
   */
  private getPanelForModel(model: WorkflowModel): vscode.WebviewPanel | undefined {
    for (const [panelKey, m] of this.panelModelMap) {
      if (m === model) {
        // Find panel by the same key (flow URI)
        return this.config.activePanels.get(panelKey);
      }
    }
    return undefined;
  }

  /**
   * Check if webview should be updated after a message
   */
  private shouldUpdateWebview(messageType: string): boolean {
    const updateTypes = [
      'domain:setStart',
      'domain:addTransition',
      'domain:moveTransition',
      'domain:removeTransition',
      'domain:removeState',
      'domain:updateState',
      'domain:updateTransition',
      'domain:updateComment',
      'domain:makeTransitionShared',
      'domain:updateSharedTransition',
      'domain:convertSharedToRegular',
      'domain:removeFromSharedTransition',
      'domain:addState',
      'mapping:loadFromFile',
      'rule:loadFromFile',
      'request:autoLayout'
    ];
    return updateTypes.includes(messageType);
  }

  /**
   * Generate a unique transition key
   * Must match pattern ^[a-z0-9-]+$ as required by schema
   */
  private generateTransitionKey(from: string, target: string, existingTransitions: any[]): string {
    // Use the same pattern as the plugin system for consistency
    // This matches the schema requirement: lowercase letters, numbers, and hyphens only
    const baseKey = `${from}-to-${target}`;

    // Check if this key already exists
    const existingKeys = existingTransitions.map(t => t.key);
    if (!existingKeys.includes(baseKey)) {
      return baseKey;
    }

    // If it exists, append a counter to make it unique
    let counter = 2;
    let uniqueKey = `${baseKey}-${counter}`;
    while (existingKeys.includes(uniqueKey)) {
      counter++;
      uniqueKey = `${baseKey}-${counter}`;
    }

    return uniqueKey;
  }

  /**
   * Get localized workflow label
   */
  private getWorkflowLabel(workflow: Workflow, fallback: string = 'Amorphie Flow Studio'): string {
    if (!workflow.attributes?.labels || workflow.attributes.labels.length === 0) {
      return fallback;
    }

    const systemLanguage = Intl.DateTimeFormat().resolvedOptions().locale;

    let label = workflow.attributes.labels.find(l => l.language === systemLanguage)?.label;

    if (!label) {
      const languageCode = systemLanguage.split('-')[0];
      label = workflow.attributes.labels.find(l => l.language.startsWith(languageCode))?.label;
    }

    if (!label) {
      label = workflow.attributes.labels[0]?.label;
    }

    return label || fallback;
  }

  /**
   * Dispose the bridge
   */
  /**
   * Handle unsaved changes confirmation
   */
  private async handleUnsavedChangesConfirmation(
    panel: vscode.WebviewPanel,
    message: string
  ): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      'Save',
      'Don\'t Save'
    );

    // Send response back to webview
    panel.webview.postMessage({
      type: 'confirm:response',
      save: choice === 'Save'
    });
  }

  /**
   * Handle deploy current file request
   */
  private async handleDeployCurrent(model: WorkflowModel, panel: vscode.WebviewPanel, force?: boolean): Promise<void> {
    // Initialize deployment service if needed
    if (!this.deploymentService) {
      if (!this.globalResolver) {
        console.error('[ModelBridge] Cannot deploy: globalResolver not initialized');
        panel.webview.postMessage({
          type: 'deploy:result',
          success: false,
          message: 'Component resolver not initialized. Try reopening the workspace.'
        });
        return;
      }
      this.deploymentService = new DeploymentService(
        this.globalResolver,
        this.config.deploymentOutputChannel
      );
    }

    // Get active environment
    const environment = EnvironmentManager.getActiveEnvironment();
    if (!environment) {
      const configured = await EnvironmentManager.promptForEnvironmentConfiguration();
      if (!configured) {
        panel.webview.postMessage({
          type: 'deploy:result',
          success: false,
          message: 'No deployment environment configured'
        });
      }
      return;
    }

    // Log environment config for debugging
    console.log('[ModelBridge] Active environment:', JSON.stringify(environment, null, 2));

    // Save the workflow before deploying
    await this.saveModel(model);

    // Get workflow info
    const workflow = model.getWorkflow();
    const workflowPath = model.getModelState().metadata.workflowPath;

    // Get workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      panel.webview.postMessage({
        type: 'deploy:result',
        success: false,
        message: 'No workspace folder found'
      });
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Log to output channel without showing it (user can view manually if needed)
    this.config.deploymentOutputChannel.appendLine('');
    this.config.deploymentOutputChannel.appendLine(`=== Deploying ${workflow.key} to ${environment.name || environment.id} ===`);
    this.config.deploymentOutputChannel.appendLine(`Database configured: ${environment.database ? 'YES' : 'NO'}`);
    if (environment.database) {
      this.config.deploymentOutputChannel.appendLine(`  Docker: ${environment.database.useDocker}`);
      this.config.deploymentOutputChannel.appendLine(`  Database: ${environment.database.database}`);
    }

    try {
      // Deploy with dependencies and progress updates
      const batchResult = await this.deploymentService.deployWithDependencies(
        { component: workflow, filePath: workflowPath, environment, force },
        workspaceRoot,
        (progress) => {
          // Send progress to webview
          panel.webview.postMessage({
            type: 'deploy:progress',
            step: progress.step,
            current: progress.current,
            total: progress.total,
            workflow: progress.workflow,
            message: progress.message,
            percentage: progress.percentage
          });
        }
      );

      // Send final result
      const successMessage = batchResult.success
        ? `Successfully deployed ${workflow.key}${batchResult.total > 1 ? ` and ${batchResult.total - 1} dependencies` : ''}`
        : `Failed to deploy ${workflow.key}: ${batchResult.results.find(r => !r.success)?.error || 'Unknown error'}`;

      panel.webview.postMessage({
        type: 'deploy:result',
        success: batchResult.success,
        message: successMessage,
        results: batchResult.results
      });

      if (batchResult.success) {
        vscode.window.showInformationMessage(
          `Successfully deployed ${workflow.key}${batchResult.total > 1 ? ` with ${batchResult.total - 1} dependencies` : ''} to ${environment.name || environment.id}`
        );
      } else {
        const failedResults = batchResult.results.filter(r => !r.success);
        vscode.window.showErrorMessage(
          `Failed to deploy ${failedResults.length} component(s): ${failedResults.map(r => r.key).join(', ')}`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.config.deploymentOutputChannel.appendLine(`ERROR: ${errorMessage}`);

      panel.webview.postMessage({
        type: 'deploy:result',
        success: false,
        message: `Deployment failed: ${errorMessage}`
      });

      vscode.window.showErrorMessage(`Deployment failed: ${errorMessage}`);
    }
  }


  /**
   * Handle deploy changed files request
   * TODO: Implement Git integration to detect changed *.flow.json files
   */
  private async handleDeployChanged(panel: vscode.WebviewPanel, _force?: boolean): Promise<void> {
    panel.webview.postMessage({
      type: 'deploy:result',
      success: false,
      message: 'Deploy changed files not yet implemented. Use "Deploy Current" for now.'
    });

    vscode.window.showInformationMessage(
      'Deploy changed files not yet implemented. Use "Deploy Current" to deploy the currently open workflow.'
    );
  }

  /**
   * Handle check deployment status request
   */
  private async handleCheckDeployStatus(panel: vscode.WebviewPanel): Promise<void> {
    // Check deployment status
    const status = await EnvironmentManager.checkDeploymentStatus();

    // Get domain from vnext.config.json
    let domain: string | undefined;
    if (this.workspaceRoot) {
      const { loadVNextConfig } = await import('@amorphie-flow-studio/core');
      const configResult = await loadVNextConfig(this.workspaceRoot);
      if (configResult.success && configResult.config) {
        domain = configResult.config.domain;
      }
    }

    // Send status back to webview
    panel.webview.postMessage({
      type: 'deploy:status',
      ready: status.ready,
      configured: status.configured,
      environment: status.environment ? {
        id: status.environment.id,
        name: status.environment.name,
        baseUrl: status.environment.baseUrl
      } : undefined,
      domain, // Domain from vnext.config.json
      apiReachable: status.apiReachable,
      error: status.error
    });
  }

  /**
   * Handle environment selection request
   */
  private async handleSelectEnvironment(panel: vscode.WebviewPanel): Promise<void> {
    const environment = await EnvironmentManager.promptForEnvironmentSelection();

    if (environment) {
      vscode.window.showInformationMessage(
        `Switched to environment: ${environment.name || environment.id}`
      );

      // Refresh status
      await this.handleCheckDeployStatus(panel);
    }
  }

  /**
   * Get workflow settings and send to webview
   */
  private async getWorkflowSettings(model: WorkflowModel, panel: vscode.WebviewPanel): Promise<void> {
    try {
      console.log('[ModelBridge] Getting workflow settings');
      const settings = model.getWorkflowSettings();
      console.log('[ModelBridge] Settings retrieved:', settings);

      panel.webview.postMessage({
        type: 'workflow:settings',
        data: settings
      });
      console.log('[ModelBridge] Settings sent to webview');
    } catch (error) {
      console.error('[ModelBridge] Error getting workflow settings:', error);
      vscode.window.showErrorMessage(`Failed to get workflow settings: ${error}`);
    }
  }

  /**
   * Update workflow settings and save
   */
  private async updateWorkflowSettings(
    model: WorkflowModel,
    data: {
      key?: string;
      domain?: string;
      version?: string;
      labels?: Array<{ label: string; language: string }>;
      tags?: string[];
      type?: 'C' | 'F' | 'S' | 'P';
      subFlowType?: 'S' | 'P';
      timeout?: any;
      functions?: any[];
      features?: any[];
      extensions?: any[];
    },
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      // Validate settings before applying
      const errors: string[] = [];

      if (data.key !== undefined && !/^[a-z0-9-]+$/.test(data.key)) {
        errors.push('Key must be lowercase with hyphens only (pattern: ^[a-z0-9-]+$)');
      }
      if (data.domain !== undefined && !/^[a-z0-9-]+$/.test(data.domain)) {
        errors.push('Domain must be lowercase with hyphens only (pattern: ^[a-z0-9-]+$)');
      }
      if (data.version !== undefined && !/^\d+\.\d+\.\d+$/.test(data.version)) {
        errors.push('Version must be semantic version format (e.g., 1.0.0)');
      }
      if (data.tags !== undefined && data.tags.some(tag => !tag.trim())) {
        errors.push('Tags cannot be empty');
      }

      if (errors.length > 0) {
        panel.webview.postMessage({
          type: 'workflow:settingsSaved',
          success: false,
          error: errors.join('\n')
        });
        vscode.window.showErrorMessage(`Validation failed:\n${errors.join('\n')}`);
        return;
      }

      // Update workflow settings
      model.updateWorkflowSettings(data);

      // Auto-save the workflow
      await this.saveModel(model);

      panel.webview.postMessage({
        type: 'workflow:settingsSaved',
        success: true
      });

      vscode.window.showInformationMessage('Workflow settings updated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      panel.webview.postMessage({
        type: 'workflow:settingsSaved',
        success: false,
        error: errorMessage
      });
      console.error('[ModelBridge] Error updating workflow settings:', error);
      vscode.window.showErrorMessage(`Failed to update workflow settings: ${errorMessage}`);
    }
  }

  /**
   * Broadcast instance highlight to all workflow editor panels
   * Used by test panel to highlight the current state on canvas
   */
  public broadcastInstanceHighlight(instanceId: string, workflowKey: string, stateKey: string): void {
    for (const [panelKey, panel] of this.config.activePanels) {
      const model = this.panelModelMap.get(panelKey);

      // Only highlight if panel shows the same workflow
      if (model) {
        const workflowState = model.getModelState();
        const currentWorkflowKey = workflowState.workflow.key;

        if (currentWorkflowKey === workflowKey) {
          panel.webview.postMessage({
            type: 'instance:highlight',
            instanceId,
            workflowKey,
            stateKey
          });
        }
      }
    }
  }

  /**
   * Clear instance highlighting from all workflow editor panels
   */
  public clearInstanceHighlight(): void {
    for (const [_panelKey, panel] of this.config.activePanels) {
      panel.webview.postMessage({
        type: 'instance:clearHighlight'
      });
    }
  }

  /**
   * Broadcast history-based highlighting to workflow editor panels
   */
  public broadcastHistoryHighlight(workflowKey: string, history: string[], currentState: string): void {
    for (const [panelKey, panel] of this.config.activePanels) {
      const model = this.panelModelMap.get(panelKey);

      // Only highlight if panel shows the same workflow
      if (model) {
        const workflowState = model.getModelState();
        const currentWorkflowKey = workflowState.workflow.key;

        if (currentWorkflowKey === workflowKey) {
          panel.webview.postMessage({
            type: 'instance:highlightHistory',
            workflowKey,
            history,
            currentState
          });
        }
      }
    }
  }

  /**
   * Resolve a schema using the component resolver
   */
  public async resolveSchema(schemaRef: { key: string; domain?: string; flow?: string; version?: string }): Promise<any | null> {
    if (!this.globalResolver) {
      console.warn('[ModelBridge] Global resolver not initialized');
      return null;
    }

    try {
      const ref = {
        key: schemaRef.key,
        domain: schemaRef.domain || '',
        flow: schemaRef.flow || 'sys-schemas',
        version: schemaRef.version || '1.0.0'
      };

      const schemaDefinition = await this.globalResolver.resolveSchema(ref);

      if (!schemaDefinition) {
        console.warn('[ModelBridge] Schema not found:', ref);
        return null;
      }

      // Extract the actual JSON Schema from the SchemaDefinition
      // SchemaDefinition has structure: { key, domain, attributes: { schema: {...} } }
      return (schemaDefinition as any).attributes?.schema || schemaDefinition;
    } catch (error: any) {
      console.error('[ModelBridge] Error resolving schema:', error);
      return null;
    }
  }

  /**
   * Get transitions from the workflow model for a given state
   */
  /**
   * Get start transition schema from workflow
   */
  public async getStartTransitionSchema(workflowKey: string): Promise<{key: string; schema: any} | null> {
    console.log('[ModelBridge] Getting start transition schema for workflow:', workflowKey);
    console.log('[ModelBridge] Active panels:', this.config.activePanels.size);

    // Find the panel/model for this workflow
    for (const [_panelKey, _panel] of this.config.activePanels) {
      const model = this.panelModelMap.get(_panelKey);
      if (model) {
        const workflowState = model.getModelState();
        console.log('[ModelBridge] Checking workflow:', workflowState.workflow.key);

        if (workflowState.workflow.key === workflowKey) {
          console.log('[ModelBridge] Found matching workflow!');

          const startTransition = (workflowState.workflow as any).attributes?.startTransition;
          if (!startTransition) {
            console.log('[ModelBridge] No start transition found');
            return null;
          }

          const result = {
            key: startTransition.key || 'start',
            schema: startTransition.schema ? {
              key: startTransition.schema.key,
              domain: startTransition.schema.domain,
              flow: startTransition.schema.flow,
              version: startTransition.schema.version
            } : null
          };

          console.log('[ModelBridge] Returning start transition:', result);
          return result;
        }
      }
    }

    console.log('[ModelBridge] Workflow not found in active panels');
    return null;
  }

  public async getModelTransitions(workflowKey: string, stateKey: string): Promise<Array<{key: string; schema: any}>> {
    console.log('[ModelBridge] Getting model transitions for workflow:', workflowKey, 'state:', stateKey);
    console.log('[ModelBridge] Active panels:', this.config.activePanels.size);

    // Find the panel/model for this workflow
    for (const [_panelKey, _panel] of this.config.activePanels) {
      const model = this.panelModelMap.get(_panelKey);
      if (model) {
        const workflowState = model.getModelState();
        console.log('[ModelBridge] Checking workflow:', workflowState.workflow.key);

        if (workflowState.workflow.key === workflowKey) {
          console.log('[ModelBridge] Found matching workflow!');

          // States are in workflow.attributes.states
          const states = (workflowState.workflow as any).attributes?.states;
          console.log('[ModelBridge] Available states:', states?.map((s: any) => s.key));

          // Get the state from the workflow
          const state = states?.find((s: any) => s.key === stateKey);
          console.log('[ModelBridge] Found state:', state?.key, 'transitions:', state?.transitions?.length);

          if (state && state.transitions) {
            // Return the transition objects with schema info
            const transitions = state.transitions.map((t: any) => ({
              key: t.key,
              schema: t.schema ? {
                key: t.schema.key,
                domain: t.schema.domain,
                flow: t.schema.flow,
                version: t.schema.version
              } : null
            }));
            console.log('[ModelBridge] Returning transitions:', transitions);
            return transitions;
          }
        }
      }
    }
    console.log('[ModelBridge] No transitions found, returning empty array');
    return [];
  }

  /**
   * Resolve a subflow workflow from a ProcessRef
   */
  public async resolveSubFlowWorkflow(processRef: any): Promise<Workflow | null> {
    if (!this.globalResolver) {
      console.warn('[ModelBridge] Global resolver not initialized');
      return null;
    }

    try {
      console.log('[ModelBridge] Resolving subflow workflow from ProcessRef:', processRef);

      // Normalize ProcessRef to ComponentRef format
      let ref: any;
      if ('ref' in processRef) {
        // Simple ref-style reference
        ref = { ref: processRef.ref };
      } else {
        // Explicit reference with key, domain, flow, version
        ref = {
          key: processRef.key,
          domain: processRef.domain || '',
          flow: processRef.flow || 'sys-flows',
          version: processRef.version || '1.0.0'
        };
      }

      // Use ComponentResolver to find the workflow file path
      const workflowPath = await this.globalResolver.resolveComponentPath(ref, 'workflows');

      if (!workflowPath) {
        console.warn('[ModelBridge] Subflow workflow file not found:', ref);
        return null;
      }

      console.log('[ModelBridge] Found subflow workflow file:', workflowPath);

      // Read and parse the workflow file
      const fs = await import('fs/promises');
      const content = await fs.readFile(workflowPath, 'utf-8');
      const workflow = JSON.parse(content) as Workflow;

      console.log('[ModelBridge] Loaded subflow workflow:', workflow.key);
      return workflow;
    } catch (error: any) {
      console.error('[ModelBridge] Error resolving subflow workflow:', error);
      return null;
    }
  }

  /**
   * Get subflow model with info from parent state
   * Returns the subflow workflow and the initial state (usually "initial-state" or from startTransition)
   */
  public async getSubFlowModel(workflowKey: string, stateKey: string): Promise<{ subFlowWorkflow: Workflow | null; subFlowInfo: any; error?: string }> {
    console.log('[ModelBridge] Getting subflow model for workflow:', workflowKey, 'state:', stateKey);

    try {
      // Find the parent workflow model
      for (const [_panelKey, _panel] of this.config.activePanels) {
        const model = this.panelModelMap.get(_panelKey);
        if (model) {
          const workflowState = model.getModelState();

          if (workflowState.workflow.key === workflowKey) {
            console.log('[ModelBridge] Found parent workflow');

            // Get the state from the workflow
            const states = (workflowState.workflow as any).attributes?.states;
            const state = states?.find((s: any) => s.key === stateKey);

            if (!state) {
              return {
                subFlowWorkflow: null,
                subFlowInfo: { stateKey },
                error: 'State not found'
              };
            }

            // Check if this is a SubFlow state (stateType === 4)
            if (state.stateType !== 4 || !state.subFlow) {
              return {
                subFlowWorkflow: null,
                subFlowInfo: { stateKey },
                error: 'Not a SubFlow state'
              };
            }

            console.log('[ModelBridge] State is a SubFlow, resolving workflow...');

            // Resolve the subflow workflow
            const subFlowWorkflow = await this.resolveSubFlowWorkflow(state.subFlow.process);

            if (!subFlowWorkflow) {
              return {
                subFlowWorkflow: null,
                subFlowInfo: { stateKey, type: state.subFlow.type },
                error: 'SubFlow workflow not found'
              };
            }

            // Get the initial state from the subflow workflow
            // Usually it's determined by the startTransition
            const startTransition = (subFlowWorkflow as any).attributes?.startTransition;
            const initialState = startTransition?.to || 'initial-state';

            console.log('[ModelBridge] SubFlow resolved:', {
              key: subFlowWorkflow.key,
              initialState
            });

            return {
              subFlowWorkflow,
              subFlowInfo: {
                stateKey,
                type: state.subFlow.type,
                workflowKey: subFlowWorkflow.key,
                domain: subFlowWorkflow.domain,
                initialState // Include the initial state for transition lookup
              }
            };
          }
        }
      }

      return {
        subFlowWorkflow: null,
        subFlowInfo: { stateKey },
        error: 'Parent workflow not found'
      };
    } catch (error: any) {
      console.error('[ModelBridge] Error getting subflow model:', error);
      return {
        subFlowWorkflow: null,
        subFlowInfo: { stateKey },
        error: error.message
      };
    }
  }

  dispose(): void {
    // Clear all autosave timers
    for (const timer of this.autosaveTimers.values()) {
      clearTimeout(timer);
    }
    this.autosaveTimers.clear();

    // Stop component watcher
    if (this.componentWatcher) {
      this.componentWatcher.stop().catch(error => {
        console.error('[ModelBridge] Error stopping component watcher:', error);
      });
      this.componentWatcher = undefined;
    }

    // Dispose component watcher logger
    if (this.componentWatcherLogger) {
      this.componentWatcherLogger.dispose();
      this.componentWatcherLogger = undefined;
    }

    // Clean up resources
    this.panelModelMap.clear();
    this.lastSavedContent.clear();
    this.hintsManagers.clear();
  }

  /**
   * Check if file content matches last saved content
   */
  isLastSavedContent(modelKey: string, type: 'workflow' | 'diagram', content: string): boolean {
    const key = `${modelKey}:${type}`;
    const lastSaved = this.lastSavedContent.get(key);
    return lastSaved !== undefined && lastSaved.trim() === content.trim();
  }
}