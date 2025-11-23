// Reference resolver for deployment normalization

import type { ComponentResolver } from '../model/ComponentResolver.js';
import type {
  Workflow,
  TaskRef,
  FunctionRef,
  ExtensionRef,
  ViewRef,
  SchemaRef,
  ProcessRef,
  ExecutionTask,
  Transition,
  State,
  SharedTransition
} from '../types/workflow.js';
import type {
  NormalizedReference,
  NormalizationContext,
  NormalizationError
} from './types.js';

/**
 * Resolves file references ({ ref: string }) to explicit references
 * ({ key, domain, flow, version })
 */
export class ReferenceResolver {
  constructor(private componentResolver: ComponentResolver) {}

  /**
   * Normalize all references in a workflow
   */
  async normalizeWorkflow(
    workflow: Workflow,
    context: NormalizationContext
  ): Promise<Workflow> {
    // Deep clone to avoid mutating original
    const normalized = JSON.parse(JSON.stringify(workflow)) as Workflow;

    // Normalize functions
    if (normalized.attributes.functions) {
      normalized.attributes.functions = await this.normalizeFunctionRefs(
        normalized.attributes.functions,
        context
      );
    }

    // Normalize extensions (both 'extensions' and 'features' fields)
    if (normalized.attributes.extensions) {
      normalized.attributes.extensions = await this.normalizeExtensionRefs(
        normalized.attributes.extensions,
        context
      );
    }
    if (normalized.attributes.features) {
      normalized.attributes.features = await this.normalizeExtensionRefs(
        normalized.attributes.features,
        context
      );
    }

    // Normalize start transition
    normalized.attributes.startTransition = await this.normalizeTransition(
      normalized.attributes.startTransition,
      'startTransition',
      context
    );

    // Normalize shared transitions
    if (normalized.attributes.sharedTransitions) {
      normalized.attributes.sharedTransitions = await Promise.all(
        normalized.attributes.sharedTransitions.map((st, idx) =>
          this.normalizeSharedTransition(st, idx, context)
        )
      );
    }

    // Normalize states
    normalized.attributes.states = await Promise.all(
      normalized.attributes.states.map((state) =>
        this.normalizeState(state, context)
      )
    );

    return normalized;
  }

  /**
   * Normalize a state's references
   */
  private async normalizeState(
    state: State,
    context: NormalizationContext
  ): Promise<State> {
    const normalized = { ...state };

    // Normalize view reference
    // Handle both direct ViewRef and nested view configuration object
    if (normalized.view) {
      console.log(`[ReferenceResolver] Normalizing state:${state.key}.view:`, JSON.stringify(normalized.view, null, 2));
      // Check if this is a view configuration object with a nested 'view' property
      if (typeof normalized.view === 'object' && 'view' in normalized.view && normalized.view.view) {
        // Nested structure: { view: ViewRef, loadData: boolean, extensions: [] }
        console.log(`[ReferenceResolver] Detected nested view config for state:${state.key}`);
        const viewConfig = normalized.view as any;
        const normalizedViewRef = await this.normalizeViewRef(
          viewConfig.view,
          `state:${state.key}.view`,
          context
        );
        console.log(`[ReferenceResolver] Normalized view ref:`, JSON.stringify(normalizedViewRef, null, 2));
        viewConfig.view = normalizedViewRef;
        normalized.view = viewConfig;
      } else {
        // Direct ViewRef
        console.log(`[ReferenceResolver] Detected direct ViewRef for state:${state.key}`);
        normalized.view = await this.normalizeViewRef(
          normalized.view,
          `state:${state.key}.view`,
          context
        );
      }
    }

    // Normalize onEntry tasks
    if (normalized.onEntries) {
      normalized.onEntries = await Promise.all(
        normalized.onEntries.map((task, idx) =>
          this.normalizeExecutionTask(
            task,
            `state:${state.key}.onEntries[${idx}]`,
            context
          )
        )
      );
    }

    // Normalize onExit tasks
    if (normalized.onExits) {
      normalized.onExits = await Promise.all(
        normalized.onExits.map((task, idx) =>
          this.normalizeExecutionTask(
            task,
            `state:${state.key}.onExits[${idx}]`,
            context
          )
        )
      );
    }

    // Normalize transitions
    if (normalized.transitions) {
      normalized.transitions = await Promise.all(
        normalized.transitions.map((trans, idx) =>
          this.normalizeTransition(
            trans,
            `state:${state.key}.transitions[${idx}]`,
            context
          )
        )
      );
    }

    // Normalize subflow reference
    if (normalized.subFlow?.process) {
      normalized.subFlow.process = await this.normalizeProcessRef(
        normalized.subFlow.process,
        `state:${state.key}.subFlow.process`,
        context
      );
    }

    return normalized;
  }

  /**
   * Normalize a shared transition's references
   */
  private async normalizeSharedTransition(
    transition: SharedTransition,
    index: number,
    context: NormalizationContext
  ): Promise<SharedTransition> {
    return this.normalizeTransition(
      transition,
      `sharedTransition[${index}]`,
      context
    ) as Promise<SharedTransition>;
  }

  /**
   * Normalize a transition's references
   */
  private async normalizeTransition<T extends Transition>(
    transition: T,
    location: string,
    context: NormalizationContext
  ): Promise<T> {
    const normalized = { ...transition };

    // Normalize schema reference
    if (normalized.schema) {
      normalized.schema = await this.normalizeSchemaRef(
        normalized.schema,
        `${location}.schema`,
        context
      );
    }

    // Normalize view reference
    // Handle both direct ViewRef and nested view configuration object
    if (normalized.view) {
      // Check if this is a view configuration object with a nested 'view' property
      if (typeof normalized.view === 'object' && 'view' in normalized.view && normalized.view.view) {
        // Nested structure: { view: ViewRef, loadData: boolean, extensions: [] }
        const viewConfig = normalized.view as any;
        viewConfig.view = await this.normalizeViewRef(
          viewConfig.view,
          `${location}.view`,
          context
        );
        normalized.view = viewConfig;
      } else {
        // Direct ViewRef
        normalized.view = await this.normalizeViewRef(
          normalized.view,
          `${location}.view`,
          context
        );
      }
    }

    // Normalize execution tasks
    if (normalized.onExecutionTasks) {
      normalized.onExecutionTasks = await Promise.all(
        normalized.onExecutionTasks.map((task, idx) =>
          this.normalizeExecutionTask(
            task,
            `${location}.onExecutionTasks[${idx}]`,
            context
          )
        )
      );
    }

    return normalized;
  }

  /**
   * Normalize an execution task's references
   */
  private async normalizeExecutionTask(
    task: ExecutionTask,
    location: string,
    context: NormalizationContext
  ): Promise<ExecutionTask> {
    const normalized = { ...task };

    // Normalize task reference
    normalized.task = await this.normalizeTaskRef(
      task.task,
      `${location}.task`,
      context
    );

    return normalized;
  }

  /**
   * Normalize task references
   */
  private async normalizeTaskRef(
    ref: TaskRef,
    location: string,
    context: NormalizationContext
  ): Promise<NormalizedReference> {
    if ('ref' in ref) {
      return this.resolveTaskRef(ref.ref, location, context);
    }
    return ref as NormalizedReference;
  }

  /**
   * Normalize function references
   */
  private async normalizeFunctionRefs(
    refs: FunctionRef[],
    context: NormalizationContext
  ): Promise<NormalizedReference[]> {
    return Promise.all(
      refs.map(async (ref, idx) => {
        if ('ref' in ref) {
          return this.resolveFunctionRef(ref.ref, `functions[${idx}]`, context);
        }
        return ref as NormalizedReference;
      })
    );
  }

  /**
   * Normalize extension references
   */
  private async normalizeExtensionRefs(
    refs: ExtensionRef[],
    context: NormalizationContext
  ): Promise<NormalizedReference[]> {
    return Promise.all(
      refs.map(async (ref, idx) => {
        if ('ref' in ref) {
          return this.resolveExtensionRef(ref.ref, `extensions[${idx}]`, context);
        }
        return ref as NormalizedReference;
      })
    );
  }

  /**
   * Normalize view reference
   */
  private async normalizeViewRef(
    ref: ViewRef,
    location: string,
    context: NormalizationContext
  ): Promise<NormalizedReference> {
    // Debug: Check what type of reference we have
    const hasRefProperty = 'ref' in ref;
    const refType = hasRefProperty ? 'FILE_REFERENCE' : 'EXPLICIT_REFERENCE';
    console.log(`[DEBUG] normalizeViewRef ${location}: type=${refType}, ref=`, ref);

    if (hasRefProperty) {
      const fileRef = (ref as any).ref;
      console.log(`[DEBUG] Resolving file reference: ${fileRef}`);
      return this.resolveViewRef(fileRef, location, context);
    }

    console.log(`[DEBUG] Returning explicit reference as-is:`, ref);
    return ref as NormalizedReference;
  }

  /**
   * Normalize schema reference
   */
  private async normalizeSchemaRef(
    ref: SchemaRef,
    location: string,
    context: NormalizationContext
  ): Promise<NormalizedReference> {
    if ('ref' in ref) {
      return this.resolveSchemaRef(ref.ref, location, context);
    }
    return ref as NormalizedReference;
  }

  /**
   * Normalize process reference (for subflows)
   */
  private async normalizeProcessRef(
    ref: ProcessRef,
    location: string,
    context: NormalizationContext
  ): Promise<NormalizedReference> {
    if ('ref' in ref) {
      return this.resolveProcessRef(ref.ref, location, context);
    }
    return ref as NormalizedReference;
  }

  /**
   * Resolve a task file reference
   */
  private async resolveTaskRef(
    refPath: string,
    location: string,
    context: NormalizationContext
  ): Promise<NormalizedReference> {
    const cacheKey = `task:${refPath}`;
    if (context.componentCache.has(cacheKey)) {
      return context.componentCache.get(cacheKey);
    }

    const component = await this.componentResolver.resolveTask({ ref: refPath });
    if (!component) {
      const error: NormalizationError = {
        type: 'reference',
        message: `Failed to resolve task reference: ${refPath}`,
        location
      };
      context.errors.push(error);
      // Return a placeholder to avoid breaking the structure
      return { key: 'UNRESOLVED', domain: 'UNRESOLVED', flow: 'UNRESOLVED', version: 'UNRESOLVED' };
    }

    const normalized: NormalizedReference = {
      key: component.key,
      domain: component.domain,
      flow: component.flow,
      version: component.version
    };

    context.componentCache.set(cacheKey, normalized);
    context.stats.referencesResolved++;
    return normalized;
  }

  /**
   * Resolve a function file reference
   */
  private async resolveFunctionRef(
    refPath: string,
    location: string,
    context: NormalizationContext
  ): Promise<NormalizedReference> {
    const cacheKey = `function:${refPath}`;
    if (context.componentCache.has(cacheKey)) {
      return context.componentCache.get(cacheKey);
    }

    const component = await this.componentResolver.resolveFunction({ ref: refPath });
    if (!component) {
      const error: NormalizationError = {
        type: 'reference',
        message: `Failed to resolve function reference: ${refPath}`,
        location
      };
      context.errors.push(error);
      return { key: 'UNRESOLVED', domain: 'UNRESOLVED', flow: 'UNRESOLVED', version: 'UNRESOLVED' };
    }

    const normalized: NormalizedReference = {
      key: component.key,
      domain: component.domain,
      flow: component.flow,
      version: component.version
    };

    context.componentCache.set(cacheKey, normalized);
    context.stats.referencesResolved++;
    return normalized;
  }

  /**
   * Resolve an extension file reference
   */
  private async resolveExtensionRef(
    refPath: string,
    location: string,
    context: NormalizationContext
  ): Promise<NormalizedReference> {
    const cacheKey = `extension:${refPath}`;
    if (context.componentCache.has(cacheKey)) {
      return context.componentCache.get(cacheKey);
    }

    const component = await this.componentResolver.resolveExtension({ ref: refPath });
    if (!component) {
      const error: NormalizationError = {
        type: 'reference',
        message: `Failed to resolve extension reference: ${refPath}`,
        location
      };
      context.errors.push(error);
      return { key: 'UNRESOLVED', domain: 'UNRESOLVED', flow: 'UNRESOLVED', version: 'UNRESOLVED' };
    }

    const normalized: NormalizedReference = {
      key: component.key,
      domain: component.domain,
      flow: component.flow,
      version: component.version
    };

    context.componentCache.set(cacheKey, normalized);
    context.stats.referencesResolved++;
    return normalized;
  }

  /**
   * Resolve a view file reference
   */
  private async resolveViewRef(
    refPath: string,
    location: string,
    context: NormalizationContext
  ): Promise<NormalizedReference> {
    const cacheKey = `view:${refPath}`;
    if (context.componentCache.has(cacheKey)) {
      return context.componentCache.get(cacheKey);
    }

    const component = await this.componentResolver.resolveView({ ref: refPath });
    if (!component) {
      const error: NormalizationError = {
        type: 'reference',
        message: `Failed to resolve view reference: ${refPath}`,
        location
      };
      context.errors.push(error);
      return { key: 'UNRESOLVED', domain: 'UNRESOLVED', flow: 'UNRESOLVED', version: 'UNRESOLVED' };
    }

    const normalized: NormalizedReference = {
      key: component.key,
      domain: component.domain,
      flow: component.flow,
      version: component.version
    };

    context.componentCache.set(cacheKey, normalized);
    context.stats.referencesResolved++;
    return normalized;
  }

  /**
   * Resolve a schema file reference
   */
  private async resolveSchemaRef(
    refPath: string,
    location: string,
    context: NormalizationContext
  ): Promise<NormalizedReference> {
    const cacheKey = `schema:${refPath}`;
    if (context.componentCache.has(cacheKey)) {
      return context.componentCache.get(cacheKey);
    }

    const component = await this.componentResolver.resolveSchema({ ref: refPath });
    if (!component) {
      const error: NormalizationError = {
        type: 'reference',
        message: `Failed to resolve schema reference: ${refPath}`,
        location
      };
      context.errors.push(error);
      return { key: 'UNRESOLVED', domain: 'UNRESOLVED', flow: 'UNRESOLVED', version: 'UNRESOLVED' };
    }

    const normalized: NormalizedReference = {
      key: component.key,
      domain: component.domain,
      flow: component.flow,
      version: component.version
    };

    context.componentCache.set(cacheKey, normalized);
    context.stats.referencesResolved++;
    return normalized;
  }

  /**
   * Resolve a process file reference (for subflows)
   * Process references point to other workflows
   */
  private async resolveProcessRef(
    refPath: string,
    location: string,
    context: NormalizationContext
  ): Promise<NormalizedReference> {
    const cacheKey = `process:${refPath}`;
    if (context.componentCache.has(cacheKey)) {
      return context.componentCache.get(cacheKey);
    }

    // For now, we'll use a generic approach since there's no resolveWorkflow method
    // This might need to be enhanced based on how workflow references are stored
    const error: NormalizationError = {
      type: 'reference',
      message: `Process/workflow reference resolution not yet implemented: ${refPath}`,
      location
    };
    context.errors.push(error);

    return { key: 'UNRESOLVED', domain: 'UNRESOLVED', flow: 'UNRESOLVED', version: 'UNRESOLVED' };
  }
}
