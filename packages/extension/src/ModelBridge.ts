/**
 * Bridge between VS Code extension and the model abstraction layer
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  VSCodeModelIntegration,
  WorkflowModel,
  toReactFlow,
  lint,
  autoLayout,
  pluginManager,
  InitialStatePlugin,
  IntermediateStatePlugin,
  FinalStatePlugin,
  SubFlowStatePlugin,
  ServiceTaskPlugin,
  DesignHintsManager,
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
import * as cli from './cli.js';

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
  private hintsManagers: Map<string, DesignHintsManager> = new Map();
  private autosaveTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastSavedContent: Map<string, string> = new Map();
  private lastSaveTime: Map<string, number> = new Map();
  private deploymentTerminal: vscode.Terminal | undefined;

  constructor(config: ModelBridgeConfig) {
    this.config = config;
    this.integration = new VSCodeModelIntegration();

    // Initialize plugin system
    this.initializePlugins();

    // Set up integration event handlers
    this.setupEventHandlers();

    // Listen for terminal close events to clear our reference
    config.context.subscriptions.push(
      vscode.window.onDidCloseTerminal((terminal) => {
        if (terminal === this.deploymentTerminal) {
          this.deploymentTerminal = undefined;
        }
      })
    );
  }

  /**
   * Get or create the deployment terminal
   */
  private getDeploymentTerminal(): vscode.Terminal {
    // Check if terminal still exists
    if (this.deploymentTerminal && vscode.window.terminals.includes(this.deploymentTerminal)) {
      return this.deploymentTerminal;
    }

    // Create new terminal
    this.deploymentTerminal = vscode.window.createTerminal({
      name: 'Workflow Deployment',
      hideFromUser: false
    });

    return this.deploymentTerminal;
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

    // Register Service Task plugin
    pluginManager.register(ServiceTaskPlugin);

    // Set default profile
    pluginManager.setActiveProfile('Default');

    // Activate all core plugins and Service Task plugin
    pluginManager.activate('Initial');
    pluginManager.activate('Intermediate');
    pluginManager.activate('Final');
    pluginManager.activate('SubFlow');
    pluginManager.activate('ServiceTask');

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
   * Find the project-specific base path for component discovery.
   *
   * For multi-project workspaces (e.g., workspace/loans/, workspace/credit-cards/),
   * this finds the project root by looking for component directories.
   *
   * Searches upward from the workflow file to find a directory that contains
   * typical component folders (Tasks, Workflows, etc.)
   */
  private async findProjectBasePath(workflowPath: string, workspaceRoot?: string): Promise<string> {
    const fs = await import('fs/promises');

    // Start from workflow's parent directory
    let currentDir = path.dirname(workflowPath);
    const workspaceRootNormalized = workspaceRoot ? path.normalize(workspaceRoot) : null;

    // Component directories to look for
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
  async openWorkflow(flowUri: vscode.Uri, panel: vscode.WebviewPanel): Promise<WorkflowModel> {
    try {
      console.log('[ModelBridge] openWorkflow called for:', flowUri.fsPath);

      // Get the workspace folder for this file to use as basePath
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(flowUri);

      // Find the project-specific base path by looking for component directories
      // This supports multi-project workspaces (e.g., workspace/loans/, workspace/credit-cards/)
      const basePath = await this.findProjectBasePath(
        flowUri.fsPath,
        workspaceFolder?.uri.fsPath
      );

      console.log('[ModelBridge] openWorkflow - workspaceFolder:', workspaceFolder?.uri.fsPath);
      console.log('[ModelBridge] openWorkflow - workflow file:', flowUri.fsPath);
      console.log('[ModelBridge] openWorkflow - detected basePath:', basePath);

      // Get the model from integration (may be cached for cross-model queries)
      const model = await this.integration.openWorkflow(flowUri.fsPath, {
        resolveReferences: true,
        loadScripts: true,
        validate: true,
        preloadComponents: true, // This will scan and load all tasks, schemas, views, etc.
        basePath: basePath // Use VS Code workspace folder as base path
      });

      // CRITICAL: Force reload from disk even if model was cached
      // The cache is needed for cross-model queries (subflows, references)
      // But we must refresh the content from disk when opening in editor
      console.log('[ModelBridge] Reloading model from disk to ensure fresh content');
      await model.load({
        resolveReferences: true,
        loadScripts: true,
        validate: true,
        preloadComponents: true,
        basePath: basePath
      });
      console.log('[ModelBridge] Model reloaded successfully');

      // Track the association between panel and model using the flow URI as the key
      const panelKey = flowUri.toString();
      this.panelModelMap.set(panelKey, model);
      this.config.activePanels.set(panelKey, panel);

      // Set up panel disposal cleanup
      panel.onDidDispose(() => {
        this.panelModelMap.delete(panelKey);
        this.config.activePanels.delete(panelKey);
      });

      // Get initial data from model
      const workflow = model.getWorkflow();
      let diagram = model.getDiagram();

      // Check if any states have xProfile and activate corresponding plugins
      const xProfiles = new Set(
        workflow.attributes.states
          .filter(state => state.xProfile && state.xProfile !== 'Default')
          .map(state => state.xProfile!)
      );

      // Activate plugins for any xProfiles found
      for (const profile of xProfiles) {
        if (pluginManager.isRegistered(profile)) {
          pluginManager.activate(profile);
        }
      }

      // Generate diagram if it doesn't exist
      let generatedDiagram = false;
      if (!diagram) {
        diagram = await autoLayout(workflow);
        model.setDiagram(diagram);
        await this.saveModel(model);
        generatedDiagram = true;
      }

      // Get tasks from the model
      const tasks = this.getTasksFromModel(model);

      // Get design hints for this model
      const modelKey = this.getModelKey(model);
      let hintsManager = this.hintsManagers.get(modelKey);
      if (!hintsManager) {
        hintsManager = new DesignHintsManager();
        this.hintsManagers.set(modelKey, hintsManager);
      }
      const allDesignHints = hintsManager.getAllHints();

      // Convert to React Flow format
      const derived = toReactFlow(workflow, diagram, 'en', allDesignHints.states);

      // Get problems
      const problemsById = await this.getLintProblems(model);

      // Get catalogs from model
      const catalogs = this.getCatalogsFromModel(model);

      // Refresh plugin variants with discovered tasks
      await this.refreshPluginVariants(model);

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

      // Update panel title
      panel.title = this.getWorkflowLabel(workflow);

      return model;
    } catch (error) {
      console.error('Failed to open workflow:', error);
      throw error;
    }
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

        case 'domain:addTransition':
          await this.addTransition(model, message.from, message.target, message.triggerType);
          this.scheduleAutosave(model);
          break;

        case 'domain:moveTransition':
          await this.moveTransition(model, message.oldFrom, message.tKey, message.newFrom, message.newTarget);
          this.scheduleAutosave(model);
          break;

        case 'domain:removeTransition':
          await this.removeTransition(model, message.from, message.tKey);
          this.scheduleAutosave(model);
          break;

        case 'domain:removeState':
          await this.removeState(model, message.stateKey);
          this.scheduleAutosave(model);
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
          await this.makeTransitionShared(model, message.from, message.transitionKey);
          this.scheduleAutosave(model);
          break;

        case 'domain:updateSharedTransition':
          await this.updateSharedTransition(model, message.transitionKey, message.sharedTransition);
          this.scheduleAutosave(model);
          break;

        case 'domain:updateStartTransition':
          await this.updateStartTransition(model, message.startTransition);
          this.scheduleAutosave(model);
          break;

        case 'domain:convertSharedToRegular':
          await this.convertSharedToRegular(model, message.transitionKey, message.targetState);
          this.scheduleAutosave(model);
          break;

        case 'domain:removeFromSharedTransition':
          await this.removeFromSharedTransition(model, message.transitionKey, message.stateKey);
          this.scheduleAutosave(model);
          break;

        case 'domain:updateComment':
          await this.updateComment(model, message);
          this.scheduleAutosave(model);
          break;

        case 'domain:addState':
          await this.addState(model, message.state, message.position, message.pluginId, message.hints);
          this.scheduleAutosave(model);
          break;

        case 'mapping:createFile':
          await this.createMappingFile(model, message);
          break;

        case 'mapping:loadFromFile':
          await this.loadMappingFromFile(model, message);
          break;

        case 'rule:loadFromFile':
          await this.loadRuleFromFile(model, message);
          break;

        case 'request:lint':
          await this.performLinting(model, panel);
          break;

        case 'request:exportDocumentation':
          await this.exportDocumentation(model, message.content, message.filename, message.svgContent, message.svgFilename);
          break;

        case 'request:autoLayout':
          await this.performAutoLayout(model, message.nodeSizes);
          break;

        case 'navigate:subflow':
          await this.navigateToSubflow(model, message.stateKey);
          break;

        case 'confirm:unsavedChanges':
          await this.handleUnsavedChangesConfirmation(panel, message.message || 'You have unsaved changes. Do you want to save them?');
          break;

        case 'deploy:current':
          await this.handleDeployCurrent(model, panel);
          break;

        case 'deploy:changed':
          await this.handleDeployChanged(panel);
          break;

        case 'deploy:checkStatus':
          await this.handleCheckDeployStatus(panel);
          break;

        case 'deploy:install':
          await this.handleInstallCli(panel);
          break;

        case 'deploy:configure':
          await this.handleConfigureCli(panel);
          break;

        case 'deploy:changeProjectRoot':
          await this.handleChangeProjectRoot(panel);
          break;
      }

      // After handling the message, update the webview if needed
      if (this.shouldUpdateWebview(message.type)) {
        await this.updateWebviewForModel(model, panel);
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
      triggerType
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
    const workflow = model.getWorkflow();
    const state = workflow.attributes.states.find(s => s.key === from);

    if (!state?.transitions) {
      throw new Error(`Transition ${transitionKey} not found`);
    }

    const index = state.transitions.findIndex(t => t.key === transitionKey);
    if (index === -1) {
      throw new Error(`Transition ${transitionKey} not found`);
    }

    const transition = state.transitions.splice(index, 1)[0];
    if (state.transitions.length === 0) {
      delete state.transitions;
    }

    // Add to shared transitions
    if (!workflow.attributes.sharedTransitions) {
      workflow.attributes.sharedTransitions = [];
    }

    // Check if this is a self-loop transition
    const isSelfLoop = transition.target === from;

    const sharedTransition: SharedTransition = {
      ...transition,
      // If it's a self-loop, use "$self" as the target
      target: isSelfLoop ? '$self' : transition.target,
      availableIn: [from]
    };

    workflow.attributes.sharedTransitions.push(sharedTransition);
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
    if (workflow.attributes.sharedTransitions.length === 0) {
      delete workflow.attributes.sharedTransitions;
    }

    // Add as regular transition
    const state = workflow.attributes.states.find(s => s.key === targetState);
    if (!state) {
      throw new Error(`State ${targetState} not found`);
    }

    if (!state.transitions) {
      state.transitions = [];
    }

    const { availableIn, ...regularTransition } = sharedTransition;
    state.transitions.push(regularTransition as Transition);

    // Autosave will be triggered by the message handler
  }

  /**
   * Remove state from shared transition
   */
  private async removeFromSharedTransition(
    model: WorkflowModel,
    transitionKey: string,
    stateKey: string
  ): Promise<void> {
    const workflow = model.getWorkflow();

    if (!workflow.attributes.sharedTransitions) {
      return;
    }

    const transition = workflow.attributes.sharedTransitions.find(t => t.key === transitionKey);
    if (!transition) {
      return;
    }

    if (transition.availableIn.length === 1 && transition.availableIn[0] === stateKey) {
      // Last state - remove the entire shared transition
      const answer = await vscode.window.showWarningMessage(
        `This is the last state for shared transition "${transitionKey}". Delete the entire shared transition?`,
        'Yes, Delete',
        'Cancel'
      );

      if (answer === 'Yes, Delete') {
        const index = workflow.attributes.sharedTransitions.findIndex(t => t.key === transitionKey);
        workflow.attributes.sharedTransitions.splice(index, 1);
        if (workflow.attributes.sharedTransitions.length === 0) {
          delete workflow.attributes.sharedTransitions;
        }
      }
    } else {
      // Remove state from availableIn
      transition.availableIn = transition.availableIn.filter(s => s !== stateKey);
    }

    // Autosave will be triggered by the message handler
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

    // The state already has xProfile set by the plugin's createState method

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
    nodeSizes?: Record<string, { width: number; height: number }>
  ): Promise<void> {
    const workflow = model.getWorkflow();
    const currentDiagram = model.getDiagram();
    const newDiagram = await autoLayout(workflow, currentDiagram, { nodeSizes });
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
      // For ref-style, we need to resolve the file path
      const basePath = modelState.metadata.basePath;
      const fullPath = path.resolve(basePath, subflowRef.ref);
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
          vscode.window.showWarningMessage(`Subflow file not found at: ${subflowRef.ref}`);
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
    await this.openWorkflow(workflowUri, panel);
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

    // Clear existing timer if any
    const existingTimer = this.autosaveTimers.get(modelKey);
    if (existingTimer) {
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
   */
  private async getLintProblems(model: WorkflowModel): Promise<Record<string, Problem[]>> {
    // Use both ModelValidator and traditional linting for comprehensive checks
    const workflow = model.getWorkflow();
    const tasks = this.getTasksFromModel(model);
    const modelState = model.getModelState();

    // Build scripts context for the linter
    const scripts = new Map<string, { exists: boolean }>();
    for (const [absolutePath, script] of modelState.scripts) {
      scripts.set(absolutePath, { exists: script.exists });
    }

    // Get traditional lint problems for UI display
    const lintProblems = lint(workflow, {
      tasks,
      workflowPath: modelState.metadata.workflowPath,
      scripts
    });

    // Also update VS Code diagnostics using ModelValidator if diagnosticsProvider has the new method
    const workflowPath = model.getModelState().metadata.workflowPath;
    if (!workflowPath.startsWith('memory://') && this.config.diagnosticsProvider?.updateDiagnosticsFromModel) {
      const uri = vscode.Uri.file(workflowPath);
      await this.config.diagnosticsProvider.updateDiagnosticsFromModel(uri, model);
    }

    return lintProblems;
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

    const catalogs = {
      task: Array.from(state.components.tasks.values()),
      schema: Array.from(state.components.schemas.values()),
      view: Array.from(state.components.views.values()),
      function: Array.from(state.resolvedFunctions.values()),
      extension: Array.from(state.resolvedExtensions.values()),
      mapper: Array.from(state.mappers.values()).map(transformScriptLocation),
      rule: Array.from(state.rules.values()).map(transformScriptLocation),
      workflow: Array.from(state.components.workflows.values())
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
  private async handleDeployCurrent(model: WorkflowModel, panel: vscode.WebviewPanel): Promise<void> {
    // Check if CLI is installed
    const installed = await cli.checkCliInstalled();
    if (!installed) {
      await cli.showInstallationGuide();
      panel.webview.postMessage({
        type: 'deploy:result',
        success: false,
        message: 'vnext-workflow-cli is not installed'
      });
      return;
    }

    // Check if CLI is configured
    const status = await cli.checkStatus(this.config.deploymentOutputChannel);
    if (!status.configured) {
      await cli.showConfigurationGuide();
      panel.webview.postMessage({
        type: 'deploy:result',
        success: false,
        message: 'vnext-workflow-cli is not configured'
      });
      return;
    }

    // Save the workflow before deploying
    await this.saveModel(model);

    // Get or create deployment terminal
    const terminal = this.getDeploymentTerminal();

    // Deploy the current file
    const workflowPath = model.getModelState().metadata.workflowPath;
    const result = await cli.deployFile(workflowPath, terminal);

    // Send result back to webview
    panel.webview.postMessage({
      type: 'deploy:result',
      success: result.success,
      message: result.message
    });
  }

  /**
   * Handle deploy changed files request
   */
  private async handleDeployChanged(panel: vscode.WebviewPanel): Promise<void> {
    // Check if CLI is installed
    const installed = await cli.checkCliInstalled();
    if (!installed) {
      await cli.showInstallationGuide();
      panel.webview.postMessage({
        type: 'deploy:result',
        success: false,
        message: 'vnext-workflow-cli is not installed'
      });
      return;
    }

    // Check if CLI is configured
    const status = await cli.checkStatus(this.config.deploymentOutputChannel);
    if (!status.configured) {
      await cli.showConfigurationGuide();
      panel.webview.postMessage({
        type: 'deploy:result',
        success: false,
        message: 'vnext-workflow-cli is not configured'
      });
      return;
    }

    // Get or create deployment terminal
    const terminal = this.getDeploymentTerminal();

    // Deploy changed files
    const result = await cli.deployChanged(terminal);

    // Send result back to webview
    panel.webview.postMessage({
      type: 'deploy:result',
      success: result.success,
      message: result.message
    });
  }

  /**
   * Handle check deployment status request
   */
  private async handleCheckDeployStatus(panel: vscode.WebviewPanel): Promise<void> {
    // Check status
    const status = await cli.checkStatus(this.config.deploymentOutputChannel);

    // Send status back to webview
    panel.webview.postMessage({
      type: 'deploy:status',
      installed: status.installed,
      configured: status.configured,
      version: status.version,
      projectRoot: status.projectRoot,
      apiReachable: status.apiReachable,
      dbReachable: status.dbReachable
    });
  }

  /**
   * Handle CLI installation request
   */
  private async handleInstallCli(panel: vscode.WebviewPanel): Promise<void> {
    // Install CLI
    const result = await cli.installCli(this.config.deploymentOutputChannel);

    // Send result back to webview
    panel.webview.postMessage({
      type: 'deploy:result',
      success: result.success,
      message: result.message
    });

    // Show notification
    if (result.success) {
      vscode.window.showInformationMessage('vnext-workflow-cli installed successfully');

      // Check status after installation
      const status = await cli.checkStatus(this.config.deploymentOutputChannel);
      panel.webview.postMessage({
        type: 'deploy:status',
        installed: status.installed,
        configured: status.configured,
        version: status.version,
        projectRoot: status.projectRoot,
        apiReachable: status.apiReachable,
        dbReachable: status.dbReachable
      });
    } else {
      vscode.window.showErrorMessage(`Installation failed: ${result.message}`);
    }
  }

  /**
   * Handle CLI configuration request
   */
  private async handleConfigureCli(panel: vscode.WebviewPanel): Promise<void> {
    // Get workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      panel.webview.postMessage({
        type: 'deploy:result',
        success: false,
        message: 'No workspace folder found'
      });
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    // Configure CLI
    const result = await cli.configureCli(workspaceFolder.uri.fsPath, this.config.deploymentOutputChannel);

    // Send result back to webview
    panel.webview.postMessage({
      type: 'deploy:result',
      success: result.success,
      message: result.message
    });

    // Show notification
    if (result.success) {
      vscode.window.showInformationMessage('vnext-workflow-cli configured successfully');

      // Check status after configuration
      const status = await cli.checkStatus(this.config.deploymentOutputChannel);
      panel.webview.postMessage({
        type: 'deploy:status',
        installed: status.installed,
        configured: status.configured,
        version: status.version,
        projectRoot: status.projectRoot,
        apiReachable: status.apiReachable,
        dbReachable: status.dbReachable
      });
    } else {
      vscode.window.showErrorMessage(`Configuration failed: ${result.message}`);
    }
  }

  /**
   * Handle change project root request
   */
  private async handleChangeProjectRoot(panel: vscode.WebviewPanel): Promise<void> {
    // Change project root (will show folder picker)
    const result = await cli.changeProjectRoot(this.config.deploymentOutputChannel);

    // Send result back to webview
    panel.webview.postMessage({
      type: 'deploy:result',
      success: result.success,
      message: result.message
    });

    // Show notification and refresh status
    if (result.success) {
      vscode.window.showInformationMessage('Project root changed successfully');

      // Wait a moment for config file to be fully written
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check status after changing project root
      const status = await cli.checkStatus(this.config.deploymentOutputChannel);
      panel.webview.postMessage({
        type: 'deploy:status',
        installed: status.installed,
        configured: status.configured,
        version: status.version,
        projectRoot: status.projectRoot,
        apiReachable: status.apiReachable,
        dbReachable: status.dbReachable
      });
    } else {
      if (result.message !== 'No folder selected') {
        vscode.window.showErrorMessage(`Failed to change project root: ${result.message}`);
      }
    }
  }

  dispose(): void {
    // Clear all autosave timers
    for (const timer of this.autosaveTimers.values()) {
      clearTimeout(timer);
    }
    this.autosaveTimers.clear();

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