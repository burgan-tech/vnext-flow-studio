// VS Code integration layer for the model abstraction

import { WorkflowModel } from './WorkflowModel.js';
import { ModelLoader } from './ModelLoader.js';
import { ModelSaver } from './ModelSaver.js';
import { ModelValidator } from './ModelValidator.js';
import type {
  ValidationResult,
  ModelChangeEvent,
  SaveResult,
  ModelLoadOptions,
  ModelSaveOptions
} from './types.js';
import type { Workflow, Diagram } from '../types/index.js';

/**
 * VS Code specific events
 */
export interface VSCodeModelEvents {
  onDidChangeModel: (event: ModelChangeEvent) => void;
  onDidSave: (result: SaveResult) => void;
  onDidValidate: (result: ValidationResult) => void;
  onDirtyStateChange: (isDirty: boolean) => void;
}

/**
 * VS Code document change
 */
export interface DocumentChange {
  type: 'workflow' | 'diagram' | 'script';
  path: string;
  content: string;
}

/**
 * Integration layer between VS Code and the workflow model
 */
export class VSCodeModelIntegration {
  private models: Map<string, WorkflowModel> = new Map();
  private activeModel?: WorkflowModel;
  private listeners: Partial<VSCodeModelEvents> = {};

  /**
   * Open a workflow model from a file
   * @param workflowUri - Full URI string for caching (file://, git://, or plain path)
   * @param fsPath - File system path for file operations (optional, derived from URI if not provided)
   */
  async openWorkflow(workflowUri: string, fsPath?: string, options: ModelLoadOptions = {}): Promise<WorkflowModel> {
    // Use the full URI as cache key to support multiple versions (git diff, etc.)
    const cacheKey = workflowUri;

    // Check if already loaded
    if (this.models.has(cacheKey)) {
      const model = this.models.get(cacheKey)!;
      this.setActiveModel(model);
      console.log('[VSCodeIntegration] Returning cached model for:', cacheKey);
      return model;
    }

    // Use provided fsPath or fall back to URI as path (for backward compatibility)
    const filePath = fsPath || workflowUri;
    console.log('[VSCodeIntegration] Loading model - URI:', cacheKey, '→ fsPath:', filePath);

    // Load the model using the fsPath
    const model = await ModelLoader.loadFromFile(filePath, options);

    // Set up event listeners
    this.setupModelListeners(model);

    // Store and activate using full URI as key
    this.models.set(cacheKey, model);
    this.setActiveModel(model);

    return model;
  }

  /**
   * Close a workflow model
   */
  async closeWorkflow(workflowPath: string): Promise<boolean> {
    const model = this.models.get(workflowPath);
    if (!model) return false;

    // Check for unsaved changes
    if (model.isDirty()) {
      // In VS Code, this would trigger a save dialog
      // For now, we'll just return false
      return false;
    }

    // Remove from cache
    this.models.delete(workflowPath);

    // If this was the active model, clear it
    if (this.activeModel === model) {
      this.activeModel = undefined;
    }

    return true;
  }

  /**
   * Save the active model
   */
  async save(options: ModelSaveOptions = {}): Promise<SaveResult | null> {
    if (!this.activeModel) {
      return null;
    }

    const result = await ModelSaver.save(this.activeModel, options);

    if (result.success) {
      // Clear dirty flag
      const state = this.activeModel.getModelState();
      state.metadata.isDirty = false;
      this.notifyDirtyStateChange(false);
    }

    this.notifySave(result);
    return result;
  }

  /**
   * Save all open models
   */
  async saveAll(options: ModelSaveOptions = {}): Promise<Map<string, SaveResult>> {
    const results = new Map<string, SaveResult>();

    for (const [path, model] of this.models) {
      if (model.isDirty()) {
        const result = await ModelSaver.save(model, options);
        results.set(path, result);
      }
    }

    return results;
  }

  /**
   * Validate the active model
   */
  async validate(options?: any): Promise<ValidationResult | null> {
    if (!this.activeModel) {
      return null;
    }

    const result = await ModelValidator.validate(this.activeModel, options);
    this.notifyValidate(result);
    return result;
  }

  /**
   * Handle document changes from VS Code
   */
  async handleDocumentChange(change: DocumentChange): Promise<void> {
    if (!this.activeModel) return;

    const state = this.activeModel.getModelState();

    switch (change.type) {
      case 'workflow':
        if (change.path === state.metadata.workflowPath) {
          try {
            const workflow = JSON.parse(change.content) as Workflow;
            state.workflow = workflow;
            state.metadata.isDirty = true;
            this.notifyDirtyStateChange(true);

            // Re-resolve references
            await this.activeModel.load({ resolveReferences: true });
          } catch (error) {
            console.error('Failed to parse workflow JSON:', error);
          }
        }
        break;

      case 'diagram':
        if (change.path === state.metadata.diagramPath) {
          try {
            const diagram = JSON.parse(change.content) as Diagram;
            this.activeModel.setDiagram(diagram);
          } catch (error) {
            console.error('Failed to parse diagram JSON:', error);
          }
        }
        break;

      case 'script': {
        const script = state.scripts.get(change.path);
        if (script) {
          await this.activeModel.updateScript(script.location, change.content);
        }
        break;
      }
    }
  }

  /**
   * Get diagnostics for the active model
   */
  async getDiagnostics(): Promise<Array<{
    file: string;
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
  }>> {
    if (!this.activeModel) {
      return [];
    }

    const result = await this.activeModel.validate();
    const diagnostics: Array<{
      file: string;
      line: number;
      column: number;
      severity: 'error' | 'warning' | 'info';
      message: string;
    }> = [];

    // Convert validation errors to diagnostics
    for (const error of result.errors) {
      diagnostics.push({
        file: this.activeModel.getModelState().metadata.workflowPath,
        line: 1, // Would need to parse JSON to get actual line numbers
        column: 1,
        severity: 'error',
        message: error.message
      });
    }

    for (const warning of result.warnings) {
      diagnostics.push({
        file: this.activeModel.getModelState().metadata.workflowPath,
        line: 1,
        column: 1,
        severity: 'warning',
        message: warning.message
      });
    }

    return diagnostics;
  }

  /**
   * Get quick fixes for a diagnostic
   */
  getQuickFixes(diagnostic: any): Array<{
    title: string;
    action: () => void;
  }> {
    const fixes: Array<{ title: string; action: () => void }> = [];

    // Add quick fixes based on diagnostic type
    if (diagnostic.message.includes('Script file not found')) {
      fixes.push({
        title: 'Create script file',
        action: async () => {
          if (!this.activeModel) return;
          // Extract script location from message
          const match = diagnostic.message.match(/Script file not found: (.+)/);
          if (match) {
            await this.activeModel.createScript(match[1]);
          }
        }
      });
    }

    if (diagnostic.message.includes('unreachable')) {
      fixes.push({
        title: 'Remove unreachable state',
        action: () => {
          if (!this.activeModel) return;
          // Extract state key from message
          const match = diagnostic.message.match(/State '(.+)' is unreachable/);
          if (match) {
            this.activeModel.deleteState(match[1]);
          }
        }
      });
    }

    return fixes;
  }

  /**
   * Get the active workflow model
   */
  getActiveModel(): WorkflowModel | undefined {
    return this.activeModel;
  }

  /**
   * Set the active model
   */
  setActiveModel(model: WorkflowModel): void {
    this.activeModel = model;
  }

  /**
   * Get all open models
   */
  getOpenModels(): Map<string, WorkflowModel> {
    return new Map(this.models);
  }

  /**
   * Register event listener
   */
  on<K extends keyof VSCodeModelEvents>(
    event: K,
    listener: VSCodeModelEvents[K]
  ): void {
    this.listeners[event] = listener;
  }

  /**
   * Remove event listener
   */
  off<K extends keyof VSCodeModelEvents>(event: K): void {
    delete this.listeners[event];
  }

  /**
   * Set up model event listeners
   */
  private setupModelListeners(model: WorkflowModel): void {
    model.on('change', (event: ModelChangeEvent) => {
      this.notifyModelChange(event);
      this.notifyDirtyStateChange(true);
    });

    model.on('save', (result: SaveResult) => {
      this.notifySave(result);
    });

    model.on('validate', (result: ValidationResult) => {
      this.notifyValidate(result);
    });
  }

  /**
   * Notify model change
   */
  private notifyModelChange(event: ModelChangeEvent): void {
    if (this.listeners.onDidChangeModel) {
      this.listeners.onDidChangeModel(event);
    }
  }

  /**
   * Notify save
   */
  private notifySave(result: SaveResult): void {
    if (this.listeners.onDidSave) {
      this.listeners.onDidSave(result);
    }
  }

  /**
   * Notify validation
   */
  private notifyValidate(result: ValidationResult): void {
    if (this.listeners.onDidValidate) {
      this.listeners.onDidValidate(result);
    }
  }

  /**
   * Notify dirty state change
   */
  private notifyDirtyStateChange(isDirty: boolean): void {
    if (this.listeners.onDirtyStateChange) {
      this.listeners.onDirtyStateChange(isDirty);
    }
  }

  /**
   * Create a new workflow from template
   */
  createNewWorkflow(
    key: string,
    domain: string,
    flow: string,
    version?: string,
    type?: 'C' | 'F' | 'S' | 'P'
  ): WorkflowModel {
    const model = ModelLoader.createFromTemplate(key, domain, flow, version, type);
    this.setupModelListeners(model);

    const path = `${key}.flow.json`;
    this.models.set(path, model);
    this.setActiveModel(model);

    return model;
  }

  /**
   * Export workflow bundle
   */
  async exportBundle(outputPath: string): Promise<void> {
    if (!this.activeModel) {
      throw new Error('No active workflow model');
    }

    await ModelSaver.exportBundle(this.activeModel, outputPath);
  }

  /**
   * Import workflow bundle
   */
  async importBundle(bundlePath: string, targetDir: string): Promise<WorkflowModel> {
    const model = await ModelSaver.importBundle(bundlePath, targetDir);

    this.setupModelListeners(model);
    this.models.set(model.getModelState().metadata.workflowPath, model);
    this.setActiveModel(model);

    return model;
  }

  /**
   * Discover workflows in a directory
   */
  async discoverWorkflows(rootDir: string): Promise<Array<{
    path: string;
    key: string;
    domain: string;
    version: string;
    hasDiagram: boolean;
  }>> {
    const discovered = await ModelLoader.discoverWorkflows({ rootDir });

    return discovered.map(w => ({
      path: w.workflowPath,
      key: w.key,
      domain: w.domain,
      version: w.version,
      hasDiagram: w.hasDiagram
    }));
  }
}