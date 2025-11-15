// Main workflow model class that provides unified access to all components

import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';
import type {
  Workflow,
  State,
  Transition,
  SharedTransition,
  ExecutionTask,
  Diagram
} from '../types/index.js';
import type {
  WorkflowModelState,
  ResolvedState,
  ResolvedTransition,
  ResolvedSharedTransition,
  ResolvedExecutionTask,
  ResolvedScript,
  ModelChangeEvent,
  ValidationResult,
  SaveResult,
  ModelLoadOptions,
  ModelSaveOptions,
  IModelEventEmitter,
  ScriptUsage
} from './types.js';
import { ComponentResolver } from './ComponentResolver.js';
import { ScriptManager } from './ScriptManager.js';
import { lint } from '../linter.js';

/**
 * Main workflow model that provides a unified view of a workflow
 * and all its referenced components
 */
export class WorkflowModel extends EventEmitter implements IModelEventEmitter {
  private state: WorkflowModelState;
  private componentResolver: ComponentResolver;
  private scriptManager: ScriptManager;

  constructor(workflowPath: string, basePath?: string, componentResolver?: ComponentResolver) {
    super();

    // BasePath should be provided by the caller (VS Code workspace folder)
    // If not provided, fallback to workflow file's directory as a last resort
    const actualBasePath = basePath || path.dirname(workflowPath);
    console.log('[WorkflowModel] constructor - workflowPath:', workflowPath);
    console.log('[WorkflowModel] constructor - basePath:', actualBasePath);
    console.log('[WorkflowModel] constructor - using shared resolver:', !!componentResolver);

    this.state = {
      workflow: {} as Workflow,
      diagram: undefined,
      resolvedStates: new Map(),
      resolvedFunctions: new Map(),
      resolvedExtensions: new Map(),
      resolvedSharedTransitions: new Map(),
      scripts: new Map(),
      mappers: new Map(),
      rules: new Map(),
      components: {
        tasks: new Map(),
        schemas: new Map(),
        views: new Map(),
        workflows: new Map()
      },
      metadata: {
        workflowPath,
        basePath: actualBasePath,
        lastLoaded: new Date(),
        isDirty: false
      }
    };

    // Use provided resolver or create a new one
    this.componentResolver = componentResolver || new ComponentResolver({ basePath: actualBasePath });
    this.scriptManager = this.componentResolver.getScriptManager();
  }

  /**
   * Load the workflow and all its references
   */
  async load(options: ModelLoadOptions = {}): Promise<void> {
    const {
      resolveReferences = true,
      loadScripts = true,
      validate = false,
      preloadComponents = false
    } = options;

    try {
      // Optionally preload all components from the filesystem
      if (preloadComponents) {
        console.log('[WorkflowModel] Preloading components from filesystem...');
        const components = await this.componentResolver.preloadAllComponents();
        console.log('[WorkflowModel] Preload complete:', {
          tasks: components.tasks.length,
          schemas: components.schemas.length,
          views: components.views.length,
          functions: components.functions.length,
          extensions: components.extensions.length,
          workflows: components.workflows.length
        });

        // Store preloaded components in the state
        for (const task of components.tasks) {
          const key = `${task.domain}/${task.flow || 'sys-tasks'}/${task.key}@${task.version}`;
          this.state.components.tasks.set(key, task);
        }
        for (const schema of components.schemas) {
          const key = `${schema.domain}/${schema.flow || 'sys-schemas'}/${schema.key}@${schema.version}`;
          this.state.components.schemas.set(key, schema);
        }
        for (const view of components.views) {
          const key = `${view.domain}/${view.flow || 'sys-views'}/${view.key}@${view.version}`;
          this.state.components.views.set(key, view);
        }
        for (const func of components.functions) {
          const key = `${func.domain}/${func.flow || 'sys-functions'}/${func.key}@${func.version}`;
          this.state.resolvedFunctions.set(key, func);
        }
        for (const ext of components.extensions) {
          const key = `${ext.domain}/${ext.flow || 'sys-extensions'}/${ext.key}@${ext.version}`;
          this.state.resolvedExtensions.set(key, ext);
        }
        for (const workflow of components.workflows) {
          const key = `${workflow.domain}/${workflow.flow || 'sys-flows'}/${workflow.key}@${workflow.version}`;
          this.state.components.workflows.set(key, workflow);
        }
        console.log('[WorkflowModel] Components stored in state');

        // Preload all scripts from the filesystem
        console.log('[WorkflowModel] Preloading scripts from filesystem...');
        const { mappers, rules } = await this.scriptManager.discoverScripts(this.state.metadata.basePath);
        console.log(`[WorkflowModel] Preloaded ${mappers.length} mappers and ${rules.length} rules`);

        // Store preloaded mappers and rules in the state
        for (const mapper of mappers) {
          this.state.mappers.set(mapper.absolutePath, mapper);
        }
        for (const rule of rules) {
          this.state.rules.set(rule.absolutePath, rule);
        }
        console.log('[WorkflowModel] Mappers and rules stored in state');
      }

      // Load workflow file
      // Use provided content from VS Code TextDocument if available (for git virtual URIs)
      // Otherwise read from file system
      const workflowContent = options.content ?? await fs.readFile(this.state.metadata.workflowPath, 'utf-8');
      this.state.workflow = JSON.parse(workflowContent) as Workflow;

      // Load diagram file if it exists
      // Use provided diagram content from VS Code TextDocument if available (for git virtual URIs)
      if (options.diagramContent) {
        this.state.diagram = JSON.parse(options.diagramContent) as Diagram;
        const diagramPath = this.getDiagramPath();
        if (diagramPath) {
          this.state.metadata.diagramPath = diagramPath;
        }
      } else {
        const diagramPath = this.getDiagramPath();
        if (diagramPath) {
          try {
            const diagramContent = await fs.readFile(diagramPath, 'utf-8');
            this.state.diagram = JSON.parse(diagramContent) as Diagram;
            this.state.metadata.diagramPath = diagramPath;
          } catch {
            // Diagram file doesn't exist - that's ok
          }
        }
      }

      // Resolve all references
      if (resolveReferences) {
        await this.resolveAllReferences(loadScripts);
      }

      // Validate if requested
      if (validate) {
        const result = await this.validate();
        this.emit('validate', result);
      }

      this.state.metadata.lastLoaded = new Date();
      this.state.metadata.isDirty = false;
    } catch (error) {
      throw new Error(`Failed to load workflow: ${error}`);
    }
  }

  /**
   * Resolve all component references
   */
  private async resolveAllReferences(loadScripts: boolean): Promise<void> {
    // Resolve functions
    for (const funcRef of (this.state.workflow.attributes.functions || [])) {
      const func = await this.componentResolver.resolveFunction(funcRef);
      if (func) {
        const key = this.getComponentKey(funcRef);
        this.state.resolvedFunctions.set(key, func);
      }
    }

    // Resolve extensions
    for (const extRef of (this.state.workflow.attributes.extensions || [])) {
      const ext = await this.componentResolver.resolveExtension(extRef);
      if (ext) {
        const key = this.getComponentKey(extRef);
        this.state.resolvedExtensions.set(key, ext);
      }
    }

    // Resolve shared transitions
    for (const sharedTransition of (this.state.workflow.attributes.sharedTransitions || [])) {
      const resolved = await this.resolveSharedTransition(sharedTransition, loadScripts);
      this.state.resolvedSharedTransitions.set(sharedTransition.key, resolved);
    }

    // Resolve states
    for (const state of (this.state.workflow.attributes.states || [])) {
      const resolved = await this.resolveState(state, loadScripts);
      this.state.resolvedStates.set(state.key, resolved);
    }

    // Resolve start transition tasks
    if (this.state.workflow.attributes.startTransition) {
      const startTransition = this.state.workflow.attributes.startTransition;
      if (startTransition.onExecutionTasks && loadScripts) {
        for (const task of startTransition.onExecutionTasks) {
          await this.resolveExecutionTask(task, loadScripts);
        }
      }
    }
  }

  /**
   * Resolve a state and all its references
   */
  private async resolveState(state: State, loadScripts: boolean): Promise<ResolvedState> {
    const resolved: ResolvedState = {
      ...state,
      resolvedView: undefined,
      resolvedOnEntries: [],
      resolvedOnExits: [],
      resolvedTransitions: []
    };

    // Resolve view
    if (state.view) {
      resolved.resolvedView = await this.componentResolver.resolveView(state.view) || undefined;
      if (resolved.resolvedView) {
        const key = this.getComponentKey(state.view);
        this.state.components.views.set(key, resolved.resolvedView);
      }
    }

    // Resolve onEntry tasks
    if (state.onEntries) {
      for (const task of state.onEntries) {
        const resolvedTask = await this.resolveExecutionTask(task, loadScripts);
        resolved.resolvedOnEntries!.push(resolvedTask);
      }
    }

    // Resolve onExit tasks
    if (state.onExits) {
      for (const task of state.onExits) {
        const resolvedTask = await this.resolveExecutionTask(task, loadScripts);
        resolved.resolvedOnExits!.push(resolvedTask);
      }
    }

    // Resolve transitions
    if (state.transitions) {
      for (const transition of state.transitions) {
        const resolvedTransition = await this.resolveTransition(transition, loadScripts);
        resolved.resolvedTransitions!.push(resolvedTransition);
      }
    }

    return resolved;
  }

  /**
   * Resolve a transition and its references
   */
  private async resolveTransition(
    transition: Transition,
    loadScripts: boolean
  ): Promise<ResolvedTransition> {
    const resolved: ResolvedTransition = {
      ...transition,
      resolvedRule: undefined,
      resolvedSchema: undefined,
      resolvedTasks: []
    };

    // Resolve rule script
    if (transition.rule && loadScripts) {
      // Always resolve scripts relative to workflow file directory
      const workflowDir = path.dirname(this.state.metadata.workflowPath);
      const script = await this.scriptManager.loadScript(
        transition.rule.location,
        workflowDir
      );
      if (script) {
        resolved.resolvedRule = {
          ...transition.rule,
          script
        };
        this.state.scripts.set(script.absolutePath, script);
      }
    }

    // Resolve schema
    if (transition.schema) {
      resolved.resolvedSchema = await this.componentResolver.resolveSchema(transition.schema) || undefined;
      if (resolved.resolvedSchema) {
        const key = this.getComponentKey(transition.schema);
        this.state.components.schemas.set(key, resolved.resolvedSchema);
      }
    }

    // Resolve onExecutionTasks
    if (transition.onExecutionTasks) {
      for (const task of transition.onExecutionTasks) {
        const resolvedTask = await this.resolveExecutionTask(task, loadScripts);
        resolved.resolvedTasks!.push(resolvedTask);
      }
    }

    return resolved;
  }

  /**
   * Resolve a shared transition
   */
  private async resolveSharedTransition(
    sharedTransition: SharedTransition,
    loadScripts: boolean
  ): Promise<ResolvedSharedTransition> {
    const resolved: ResolvedSharedTransition = {
      ...sharedTransition,
      resolvedRule: undefined,
      resolvedSchema: undefined,
      resolvedTasks: []
    };

    // Resolve rule script
    if (sharedTransition.rule && loadScripts) {
      // Always resolve scripts relative to workflow file directory
      const workflowDir = path.dirname(this.state.metadata.workflowPath);
      const script = await this.scriptManager.loadScript(
        sharedTransition.rule.location,
        workflowDir
      );
      if (script) {
        resolved.resolvedRule = {
          ...sharedTransition.rule,
          script
        };
        this.state.scripts.set(script.absolutePath, script);
      }
    }

    // Resolve schema
    if (sharedTransition.schema) {
      resolved.resolvedSchema = await this.componentResolver.resolveSchema(sharedTransition.schema) || undefined;
      if (resolved.resolvedSchema) {
        const key = this.getComponentKey(sharedTransition.schema);
        this.state.components.schemas.set(key, resolved.resolvedSchema);
      }
    }

    // Resolve onExecutionTasks
    if (sharedTransition.onExecutionTasks) {
      for (const task of sharedTransition.onExecutionTasks) {
        const resolvedTask = await this.resolveExecutionTask(task, loadScripts);
        resolved.resolvedTasks!.push(resolvedTask);
      }
    }

    return resolved;
  }

  /**
   * Resolve an execution task
   */
  private async resolveExecutionTask(
    task: ExecutionTask,
    loadScripts: boolean
  ): Promise<ResolvedExecutionTask> {
    const resolved: ResolvedExecutionTask = {
      ...task,
      resolvedTask: undefined,
      resolvedMapping: undefined
    };

    // Resolve task definition
    const taskDef = await this.componentResolver.resolveTask(task.task);
    if (taskDef) {
      resolved.resolvedTask = taskDef;
      const key = this.getComponentKey(task.task);
      this.state.components.tasks.set(key, taskDef);
    }

    // Resolve mapping script
    if (task.mapping && loadScripts) {
      // Always resolve scripts relative to workflow file directory
      const workflowDir = path.dirname(this.state.metadata.workflowPath);
      const script = await this.scriptManager.loadScript(
        task.mapping.location,
        workflowDir
      );
      if (script) {
        resolved.resolvedMapping = {
          ...task.mapping,
          script
        };
        this.state.scripts.set(script.absolutePath, script);
      }
    }

    return resolved;
  }

  /**
   * Get a unique key for a component reference
   */
  private getComponentKey(ref: any): string {
    if ('ref' in ref) {
      return ref.ref;
    }
    return `${ref.domain}/${ref.flow}/${ref.key}@${ref.version}`;
  }

  /**
   * Get the workflow definition
   */
  getWorkflow(): Workflow {
    return this.state.workflow;
  }

  /**
   * Get the diagram
   */
  getDiagram(): Diagram | undefined {
    return this.state.diagram;
  }

  /**
   * Set the diagram
   */
  setDiagram(diagram: Diagram): void {
    const oldDiagram = this.state.diagram;
    this.state.diagram = diagram;

    // Ensure diagramPath is set so the diagram can be saved
    if (!this.state.metadata.diagramPath) {
      const path = this.getDiagramPath();
      if (path) {
        this.state.metadata.diagramPath = path;
      }
    }

    this.markDirty();

    this.emitChange({
      type: 'workflow',
      action: 'update',
      target: 'diagram',
      oldValue: oldDiagram,
      newValue: diagram
    });
  }

  /**
   * Get a resolved state by key
   */
  getState(key: string): ResolvedState | undefined {
    return this.state.resolvedStates.get(key);
  }

  /**
   * Get all resolved states
   */
  getStates(): Map<string, ResolvedState> {
    return new Map(this.state.resolvedStates);
  }

  /**
   * Add a new state
   */
  addState(state: State): void {
    // Add to workflow
    this.state.workflow.attributes.states.push(state);

    // Resolve and add to resolved states
    this.resolveState(state, true).then(resolved => {
      this.state.resolvedStates.set(state.key, resolved);
      this.markDirty();
      this.emitChange({
        type: 'state',
        action: 'add',
        target: state.key,
        newValue: state
      });
    });
  }

  /**
   * Update a state
   */
  updateState(key: string, updates: Partial<State>): void {
    const stateIndex = this.state.workflow.attributes.states.findIndex(s => s.key === key);
    if (stateIndex === -1) return;

    const oldState = { ...this.state.workflow.attributes.states[stateIndex] };
    const newState = { ...oldState, ...updates };

    this.state.workflow.attributes.states[stateIndex] = newState;

    // Re-resolve the state
    this.resolveState(newState, true).then(resolved => {
      this.state.resolvedStates.set(key, resolved);
      this.markDirty();
      this.emitChange({
        type: 'state',
        action: 'update',
        target: key,
        oldValue: oldState,
        newValue: newState
      });
    });
  }

  /**
   * Delete a state
   */
  deleteState(key: string): void {
    const stateIndex = this.state.workflow.attributes.states.findIndex(s => s.key === key);
    if (stateIndex === -1) return;

    const oldState = this.state.workflow.attributes.states[stateIndex];
    this.state.workflow.attributes.states.splice(stateIndex, 1);
    this.state.resolvedStates.delete(key);

    // Remove transitions targeting this state
    this.removeTransitionsTargeting(key);

    this.markDirty();
    this.emitChange({
      type: 'state',
      action: 'delete',
      target: key,
      oldValue: oldState
    });
  }

  /**
   * Get script content by location
   */
  getScript(location: string): ResolvedScript | undefined {
    // Always resolve relative paths from workflow file directory
    const workflowDir = path.dirname(this.state.metadata.workflowPath);
    const absolutePath = path.isAbsolute(location)
      ? location
      : path.resolve(workflowDir, location);
    return this.state.scripts.get(absolutePath);
  }

  /**
   * Update script content
   */
  async updateScript(location: string, content: string): Promise<void> {
    // Always resolve scripts relative to workflow file directory
    const workflowDir = path.dirname(this.state.metadata.workflowPath);
    await this.scriptManager.saveScript(location, content, workflowDir);
    const script = await this.scriptManager.loadScript(location, workflowDir);

    if (script) {
      this.state.scripts.set(script.absolutePath, script);
      this.markDirty();
      this.emitChange({
        type: 'script',
        action: 'update',
        target: location,
        newValue: content
      });
    }
  }

  /**
   * Create a new script from template
   */
  async createScript(location: string, taskType?: string): Promise<ResolvedScript> {
    // Always resolve scripts relative to workflow file directory
    const workflowDir = path.dirname(this.state.metadata.workflowPath);
    const script = await this.scriptManager.createScript(
      location,
      taskType || 'mapping',
      workflowDir
    );

    this.state.scripts.set(script.absolutePath, script);
    this.markDirty();
    this.emitChange({
      type: 'script',
      action: 'add',
      target: location,
      newValue: script.content
    });

    return script;
  }

  /**
   * Find where a script is used
   */
  findScriptUsages(location: string): ScriptUsage[] {
    const usages: ScriptUsage[] = [];
    const normalizedLocation = location.startsWith('./') ? location : `./${location}`;

    // Check states
    for (const [stateKey, state] of this.state.resolvedStates) {
      // Check onEntries
      state.onEntries?.forEach((task, index) => {
        if (task.mapping?.location === normalizedLocation) {
          usages.push({
            stateKey,
            type: 'mapping',
            taskIndex: index,
            list: 'onEntries'
          });
        }
      });

      // Check onExits
      state.onExits?.forEach((task, index) => {
        if (task.mapping?.location === normalizedLocation) {
          usages.push({
            stateKey,
            type: 'mapping',
            taskIndex: index,
            list: 'onExits'
          });
        }
      });

      // Check transitions
      state.transitions?.forEach(transition => {
        if (transition.rule?.location === normalizedLocation) {
          usages.push({
            stateKey,
            transitionKey: transition.key,
            type: 'rule'
          });
        }

        // Check transition tasks
        transition.onExecutionTasks?.forEach((task, index) => {
          if (task.mapping?.location === normalizedLocation) {
            usages.push({
              stateKey,
              transitionKey: transition.key,
              type: 'mapping',
              taskIndex: index,
              list: 'onExecutionTasks'
            });
          }
        });
      });
    }

    // Check shared transitions
    for (const [key, sharedTransition] of this.state.resolvedSharedTransitions) {
      if (sharedTransition.rule?.location === normalizedLocation) {
        usages.push({
          sharedTransitionKey: key,
          type: 'rule'
        });
      }

      // Check shared transition tasks
      sharedTransition.onExecutionTasks?.forEach((task, index) => {
        if (task.mapping?.location === normalizedLocation) {
          usages.push({
            sharedTransitionKey: key,
            type: 'mapping',
            taskIndex: index,
            list: 'onExecutionTasks'
          });
        }
      });
    }

    return usages;
  }

  /**
   * Validate the model
   */
  async validate(): Promise<ValidationResult> {
    const tasks = Array.from(this.state.components.tasks.values());

    // Build scripts context for the linter
    const scripts = new Map<string, { exists: boolean }>();
    for (const [absolutePath, script] of this.state.scripts) {
      scripts.set(absolutePath, { exists: script.exists });
    }

    const lintResult = lint(this.state.workflow, {
      tasks,
      workflowPath: this.state.metadata.workflowPath,
      scripts
    });

    const errors = [];
    const warnings = [];

    for (const [location, problems] of Object.entries(lintResult)) {
      for (const problem of problems) {
        const item = {
          type: problem.id,
          message: problem.message,
          path: problem.path,
          location
        };

        if (problem.severity === 'error') {
          errors.push(item);
        } else {
          warnings.push(item);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Save the model back to files
   */
  async save(_options: ModelSaveOptions = {}): Promise<SaveResult> {
    // This will be implemented by ModelSaver
    throw new Error('Save not yet implemented - use ModelSaver');
  }

  /**
   * Check if the model has unsaved changes
   */
  isDirty(): boolean {
    return this.state.metadata.isDirty;
  }

  /**
   * Mark the model as dirty (having unsaved changes)
   */
  private markDirty(): void {
    this.state.metadata.isDirty = true;
  }

  /**
   * Get the model state
   */
  getModelState(): WorkflowModelState {
    return { ...this.state };
  }

  /**
   * Get path to diagram file
   */
  private getDiagramPath(): string | null {
    const workflowPath = this.state.metadata.workflowPath;

    const dir = path.dirname(workflowPath);
    const filename = path.basename(workflowPath);

    let diagramFilename: string;
    if (filename.endsWith('.flow.json')) {
      // Handle .flow.json files
      diagramFilename = filename.replace('.flow.json', '.diagram.json');
    } else if (filename.endsWith('.json')) {
      // Handle plain .json files - insert .diagram before .json
      diagramFilename = filename.replace(/\.json$/, '.diagram.json');
    } else {
      // Unknown extension, append .diagram.json
      diagramFilename = filename + '.diagram.json';
    }

    // Put diagram in .meta subdirectory
    const diagramPath = path.join(dir, '.meta', diagramFilename);

    const result = diagramPath !== workflowPath ? diagramPath : null;
    return result;
  }

  /**
   * Remove transitions targeting a specific state
   */
  private removeTransitionsTargeting(stateKey: string): void {
    // Remove from states
    for (const state of this.state.workflow.attributes.states) {
      if (state.transitions) {
        state.transitions = state.transitions.filter(t => t.target !== stateKey);
      }
    }

    // Update start transition if needed
    if (this.state.workflow.attributes.startTransition?.target === stateKey) {
      // You might want to handle this differently
      console.warn(`Start transition targets deleted state ${stateKey}`);
    }

    // Update timeout if needed
    if (this.state.workflow.attributes.timeout?.target === stateKey) {
      console.warn(`Timeout targets deleted state ${stateKey}`);
    }
  }

  /**
   * Emit a change event
   */
  private emitChange(event: ModelChangeEvent): void {
    this.emit('change', event);
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.componentResolver.clearCache();
  }
}