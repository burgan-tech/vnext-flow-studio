import { validateWorkflow } from './schema.js';
import type {
  TaskDefinition,
  TaskRef,
  Workflow,
  SharedTransition,
  Transition,
  SchemaDefinition,
  SchemaRef,
  ViewDefinition,
  ViewRef,
  FunctionDefinition,
  FunctionRef,
  ExtensionDefinition,
  ExtensionRef,
  ProcessRef
} from './types/index.js';
import * as path from 'path';

export type Severity = 'error' | 'warning';

export interface Problem {
  id: string;
  message: string;
  severity: Severity;
  path?: string;
}

export interface LintContext {
  tasks?: TaskDefinition[];
  schemas?: SchemaDefinition[];
  views?: ViewDefinition[];
  functions?: FunctionDefinition[];
  extensions?: ExtensionDefinition[];
  workflows?: Workflow[];
  workflowPath?: string; // Path to the workflow file for resolving relative script paths
  scripts?: Map<string, { exists: boolean }>; // Map of absolute paths to script info
}

export function lint(
  workflow: Workflow,
  context: LintContext = {}
): Record<string, Problem[]> {
  const problems: Record<string, Problem[]> = {};
  const push = (ownerId: string, p: Problem) => {
    (problems[ownerId] ||= []).push(p);
  };

  // Helper to check if a script file exists (when context provides the info)
  const checkScriptExists = (location: string | undefined): boolean | null => {
    if (!location || !context.workflowPath || !context.scripts) {
      return null; // Can't check - no context provided
    }

    // Resolve path relative to workflow file's directory
    const workflowDir = path.dirname(context.workflowPath);
    const absolutePath = path.isAbsolute(location)
      ? location
      : path.resolve(workflowDir, location);

    const scriptInfo = context.scripts.get(absolutePath);
    return scriptInfo?.exists ?? null;
  };

  // Build indexes for all component types
  const taskIndex = new Set<string>();
  if (context.tasks) {
    for (const task of context.tasks) {
      const key = task.key?.trim();
      const domain = task.domain?.trim();
      const version = task.version?.trim();
      const flow = task.flow?.trim();

      if (key && domain && version && flow) {
        taskIndex.add(`${domain}/${flow}/${key}@${version}`);
      }
    }
  }

  const schemaIndex = new Set<string>();
  if (context.schemas) {
    for (const schema of context.schemas) {
      const key = schema.key?.trim();
      const domain = schema.domain?.trim();
      const version = schema.version?.trim();
      const flow = schema.flow?.trim();

      if (key && domain && version && flow) {
        schemaIndex.add(`${domain}/${flow}/${key}@${version}`);
      }
    }
  }

  const viewIndex = new Set<string>();
  if (context.views) {
    for (const view of context.views) {
      const key = view.key?.trim();
      const domain = view.domain?.trim();
      const version = view.version?.trim();
      const flow = view.flow?.trim();

      if (key && domain && version && flow) {
        viewIndex.add(`${domain}/${flow}/${key}@${version}`);
      }
    }
  }

  const functionIndex = new Set<string>();
  if (context.functions) {
    for (const func of context.functions) {
      const key = func.key?.trim();
      const domain = func.domain?.trim();
      const version = func.version?.trim();
      const flow = func.flow?.trim();

      if (key && domain && version && flow) {
        functionIndex.add(`${domain}/${flow}/${key}@${version}`);
      }
    }
  }

  const extensionIndex = new Set<string>();
  if (context.extensions) {
    for (const ext of context.extensions) {
      const key = ext.key?.trim();
      const domain = ext.domain?.trim();
      const version = ext.version?.trim();
      const flow = ext.flow?.trim();

      if (key && domain && version && flow) {
        extensionIndex.add(`${domain}/${flow}/${key}@${version}`);
      }
    }
  }

  const workflowIndex = new Set<string>();
  if (context.workflows) {
    for (const wf of context.workflows) {
      const key = wf.key?.trim();
      const domain = wf.domain?.trim();
      const version = wf.version?.trim();
      const flow = wf.flow?.trim();

      if (key && domain && version && flow) {
        workflowIndex.add(`${domain}/${flow}/${key}@${version}`);
      }
    }
  }

  const shouldValidateTasks = context.tasks !== undefined;
  const shouldValidateSchemas = context.schemas !== undefined;
  const shouldValidateViews = context.views !== undefined;
  const shouldValidateFunctions = context.functions !== undefined;
  const shouldValidateExtensions = context.extensions !== undefined;
  const shouldValidateWorkflows = context.workflows !== undefined;

  const hasTaskReference = (ref: TaskRef | undefined): boolean => {
    if (!ref) {
      return true;
    }

    // Handle ref-style reference
    if ('ref' in ref) {
      return true; // We don't validate ref-style references against the catalog
    }

    // Handle explicit reference
    const key = ref.key?.trim();
    const domain = ref.domain?.trim();
    const version = ref.version?.trim();
    const flow = ref.flow?.trim();

    // Always validate that required fields are not empty
    if (!key || !domain || !version || !flow) {
      return false;
    }

    // Only check catalog if available
    if (shouldValidateTasks) {
      return taskIndex.has(`${domain}/${flow}/${key}@${version}`);
    }

    return true; // Can't check catalog, but fields are valid
  };

  const describeTaskRef = (ref: TaskRef | undefined): string => {
    if (!ref) {
      return '<missing task>';
    }

    // Handle ref-style reference
    if ('ref' in ref) {
      return ref.ref;
    }

    // Handle explicit reference
    const domain = ref.domain?.trim() || '<missing-domain>';
    const key = ref.key?.trim() || '<missing-key>';
    const version = ref.version?.trim() || '<missing-version>';
    return `${domain}/${key}@${version}`;
  };

  // Helper functions for schema references
  const hasSchemaReference = (ref: SchemaRef | null | undefined): boolean => {
    if (!ref) {
      return true;
    }

    if ('ref' in ref) {
      return true; // Don't validate ref-style references
    }

    const key = ref.key?.trim();
    const domain = ref.domain?.trim();
    const version = ref.version?.trim();
    const flow = ref.flow?.trim();

    // Always validate that required fields are not empty
    if (!key || !domain || !version || !flow) {
      return false;
    }

    // Only check catalog if available
    if (shouldValidateSchemas) {
      return schemaIndex.has(`${domain}/${flow}/${key}@${version}`);
    }

    return true; // Can't check catalog, but fields are valid
  };

  const describeSchemaRef = (ref: SchemaRef | null | undefined): string => {
    if (!ref) {
      return '<missing schema>';
    }

    if ('ref' in ref) {
      return ref.ref;
    }

    const domain = ref.domain?.trim() || '<missing-domain>';
    const key = ref.key?.trim() || '<missing-key>';
    const version = ref.version?.trim() || '<missing-version>';
    return `${domain}/${key}@${version}`;
  };

  // Helper functions for view references
  const hasViewReference = (ref: ViewRef | null | undefined): boolean => {
    if (!ref) {
      return true;
    }

    if ('ref' in ref) {
      return true; // Don't validate ref-style references
    }

    const key = ref.key?.trim();
    const domain = ref.domain?.trim();
    const version = ref.version?.trim();
    const flow = ref.flow?.trim();

    // Always validate that required fields are not empty
    if (!key || !domain || !version || !flow) {
      return false;
    }

    // Only check catalog if available
    if (shouldValidateViews) {
      return viewIndex.has(`${domain}/${flow}/${key}@${version}`);
    }

    return true; // Can't check catalog, but fields are valid
  };

  const describeViewRef = (ref: ViewRef | null | undefined): string => {
    if (!ref) {
      return '<missing view>';
    }

    if ('ref' in ref) {
      return ref.ref;
    }

    const domain = ref.domain?.trim() || '<missing-domain>';
    const key = ref.key?.trim() || '<missing-key>';
    const version = ref.version?.trim() || '<missing-version>';
    return `${domain}/${key}@${version}`;
  };

  // Helper functions for function references
  const hasFunctionReference = (ref: FunctionRef | undefined): boolean => {
    if (!ref) {
      return true;
    }

    if ('ref' in ref) {
      return true; // Don't validate ref-style references
    }

    const key = ref.key?.trim();
    const domain = ref.domain?.trim();
    const version = ref.version?.trim();
    const flow = ref.flow?.trim();

    // Always validate that required fields are not empty
    if (!key || !domain || !version || !flow) {
      return false;
    }

    // Only check catalog if available
    if (shouldValidateFunctions) {
      return functionIndex.has(`${domain}/${flow}/${key}@${version}`);
    }

    return true; // Can't check catalog, but fields are valid
  };

  const describeFunctionRef = (ref: FunctionRef | undefined): string => {
    if (!ref) {
      return '<missing function>';
    }

    if ('ref' in ref) {
      return ref.ref;
    }

    const domain = ref.domain?.trim() || '<missing-domain>';
    const key = ref.key?.trim() || '<missing-key>';
    const version = ref.version?.trim() || '<missing-version>';
    return `${domain}/${key}@${version}`;
  };

  // Helper functions for extension references
  const hasExtensionReference = (ref: ExtensionRef | undefined): boolean => {
    if (!ref) {
      return true;
    }

    if ('ref' in ref) {
      return true; // Don't validate ref-style references
    }

    const key = ref.key?.trim();
    const domain = ref.domain?.trim();
    const version = ref.version?.trim();
    const flow = ref.flow?.trim();

    // Always validate that required fields are not empty
    if (!key || !domain || !version || !flow) {
      return false;
    }

    // Only check catalog if available
    if (shouldValidateExtensions) {
      return extensionIndex.has(`${domain}/${flow}/${key}@${version}`);
    }

    return true; // Can't check catalog, but fields are valid
  };

  const describeExtensionRef = (ref: ExtensionRef | undefined): string => {
    if (!ref) {
      return '<missing extension>';
    }

    if ('ref' in ref) {
      return ref.ref;
    }

    const domain = ref.domain?.trim() || '<missing-domain>';
    const key = ref.key?.trim() || '<missing-key>';
    const version = ref.version?.trim() || '<missing-version>';
    return `${domain}/${key}@${version}`;
  };

  // Helper functions for process/subflow references
  const hasProcessReference = (ref: ProcessRef | undefined): boolean => {
    if (!ref) {
      return true;
    }

    if ('ref' in ref) {
      return true; // Don't validate ref-style references
    }

    const key = ref.key?.trim();
    const domain = ref.domain?.trim();
    const version = ref.version?.trim();
    const flow = ref.flow?.trim();

    // Always validate that required fields are not empty
    if (!key || !domain || !version || !flow) {
      return false;
    }

    // Only check catalog if available
    if (shouldValidateWorkflows) {
      return workflowIndex.has(`${domain}/${flow}/${key}@${version}`);
    }

    return true; // Can't check catalog, but fields are valid
  };

  const describeProcessRef = (ref: ProcessRef | undefined): string => {
    if (!ref) {
      return '<missing process>';
    }

    if ('ref' in ref) {
      return ref.ref;
    }

    const domain = ref.domain?.trim() || '<missing-domain>';
    const key = ref.key?.trim() || '<missing-key>';
    const version = ref.version?.trim() || '<missing-version>';
    return `${domain}/${key}@${version}`;
  };

  const stateKeys = new Set<string>();
  const duplicateStateKeys = new Set<string>();
  const transitionKeys = new Set<string>();
  const duplicateTransitionKeys = new Set<string>();

  const registerTransitionKey = (key?: string | null) => {
    if (!key) {
      return;
    }

    if (transitionKeys.has(key)) {
      duplicateTransitionKeys.add(key);
    } else {
      transitionKeys.add(key);
    }
  };

  for (const state of workflow.attributes.states) {
    if (stateKeys.has(state.key)) {
      duplicateStateKeys.add(state.key);
    }

    stateKeys.add(state.key);

    for (const transition of (state.transitions || [])) {
      registerTransitionKey(transition.key);
    }
  }

  // Schema validation
  if (!validateWorkflow(workflow)) {
    // Deduplicate schema errors - AJV can report the same error multiple times
    // when multiple branches of an anyOf/oneOf fail with the same message
    const seenErrors = new Set<string>();

    for (const error of (validateWorkflow.errors || [])) {
      const errorKey = `${error.instancePath}::${error.message}`;

      // Skip if we've already seen this exact error
      if (seenErrors.has(errorKey)) {
        continue;
      }
      seenErrors.add(errorKey);

      push('__schema__', {
        id: 'E_SCHEMA',
        severity: 'error',
        message: `${error.instancePath} ${error.message}`,
        path: error.instancePath
      });
    }
  }

  // Referential integrity checks
  // Check startTransition target
  if (workflow.attributes.startTransition) {
    const startTransition = workflow.attributes.startTransition;
    registerTransitionKey(startTransition.key);

    if (!stateKeys.has(startTransition.target)) {
      push('__start__', {
        id: 'E_START_TARGET',
        severity: 'error',
        message: `startTransition.target '${startTransition.target}' not found`
      });
    }

    // Check startTransition schema reference
    if (startTransition.schema && !hasSchemaReference(startTransition.schema)) {
      push('__start__', {
        id: 'E_SCHEMA_MISSING',
        severity: 'error',
        message: `startTransition schema '${describeSchemaRef(startTransition.schema)}' not found in catalog`
      });
    }

    // Check startTransition view reference
    if (startTransition.view && !hasViewReference(startTransition.view)) {
      push('__start__', {
        id: 'E_VIEW_MISSING',
        severity: 'error',
        message: `startTransition view '${describeViewRef(startTransition.view)}' not found in catalog`
      });
    }

    // Check startTransition labels
    if (!startTransition.labels || startTransition.labels.length === 0) {
      push('__start__', {
        id: 'E_LABELS_EMPTY',
        severity: 'error',
        message: 'Start transition must have at least one label'
      });
    }
  }

  // Check timeout target
  if (workflow.attributes.timeout && !stateKeys.has(workflow.attributes.timeout.target)) {
    push('__timeout__', {
      id: 'E_TIMEOUT_TARGET',
      severity: 'error',
      message: `timeout.target '${workflow.attributes.timeout.target}' not found`
    });
  }

  // Check workflow-level function references
  if (workflow.attributes.functions) {
    for (const funcRef of workflow.attributes.functions) {
      if (!hasFunctionReference(funcRef)) {
        push('__workflow__', {
          id: 'E_FUNCTION_MISSING',
          severity: 'error',
          message: `workflow function '${describeFunctionRef(funcRef)}' not found in catalog`
        });
      }
    }
  }

  // Check workflow-level extension references (including 'features' alias)
  const extensions = workflow.attributes.extensions || (workflow.attributes as any).features || [];
  if (extensions.length > 0) {
    for (const extRef of extensions) {
      if (!hasExtensionReference(extRef)) {
        push('__workflow__', {
          id: 'E_EXTENSION_MISSING',
          severity: 'error',
          message: `workflow extension '${describeExtensionRef(extRef)}' not found in catalog`
        });
      }
    }
  }

  // Check workflow-level labels
  if (!workflow.attributes.labels || workflow.attributes.labels.length === 0) {
    push('__workflow__', {
      id: 'E_LABELS_EMPTY',
      severity: 'error',
      message: 'Workflow must have at least one label'
    });
  }

  // Check states and transitions
  for (const state of workflow.attributes.states) {
    // Check local transitions
    const transitions = state.transitions || [];

    // Count shared transitions available from this state
    const sharedTransitionsForState = (workflow.attributes.sharedTransitions || []).filter(
      (st: SharedTransition) => st.availableIn.includes(state.key)
    );
    const sharedAutoTransitions = sharedTransitionsForState.filter((st: SharedTransition) => st.triggerType === 1);

    // Check that automatic transitions have rules when needed
    // Consider both local and shared transitions
    const autoTransitions = transitions.filter((t: Transition) => t.triggerType === 1); // Auto triggers
    const totalTransitions = transitions.length + sharedTransitionsForState.length;
    const totalAutoTransitions = autoTransitions.length + sharedAutoTransitions.length;

    // Rules needed if:
    // - Multiple auto transitions exist (need to decide which one)
    // - Single auto transition but other transitions exist (need to decide when to auto vs wait for manual)
    const needsRules = totalAutoTransitions > 1 || (totalAutoTransitions === 1 && totalTransitions > 1);

    if (needsRules) {
      // Check local auto transitions
      for (const transition of autoTransitions) {
        if (!transition.rule?.location) {
          push(state.key, {
            id: 'E_MISSING_RULE',
            severity: 'error',
            message: `Automatic transition '${transition.key}' must have a rule configured (state has ${totalTransitions} total transition(s), ${totalAutoTransitions} automatic)`
          });
        }
      }

      // Check shared auto transitions available from this state
      for (const sharedTransition of sharedAutoTransitions) {
        if (!sharedTransition.rule?.location) {
          push(state.key, {
            id: 'E_MISSING_RULE',
            severity: 'error',
            message: `Automatic shared transition '${sharedTransition.key}' must have a rule configured (state has ${totalTransitions} total transition(s), ${totalAutoTransitions} automatic)`
          });
        }
      }
    }

    for (const transition of transitions) {
      // E_BAD_TARGET: transition target must exist
      if (!stateKeys.has(transition.target)) {
        push(state.key, {
          id: 'E_BAD_TARGET',
          severity: 'error',
          message: `transition '${transition.key}' targets missing state '${transition.target}'`
        });
      }
    }

    // E_FINAL_OUT: Final states should not have outgoing transitions
    if (state.stateType === 3 && state.transitions && state.transitions.length > 0) {
      push(state.key, {
        id: 'E_FINAL_OUT',
        severity: 'warning',
        message: 'Final states should not have outgoing transitions'
      });
    }

    // E_WIZARD_MULTIPLE: Wizard states can only have one outgoing transition
    if (state.stateType === 5 && state.transitions && state.transitions.length > 1) {
      push(state.key, {
        id: 'E_WIZARD_MULTIPLE',
        severity: 'error',
        message: 'Wizard states can only have one outgoing transition'
      });
    }

    // PATH checks for mappings and rules
    for (const task of (state.onEntries || [])) {
      if (!hasTaskReference(task.task)) {
        push(state.key, {
          id: 'E_TASK_MISSING',
          severity: 'error',
          message: `task '${describeTaskRef(task.task)}' not found in catalog`
        });
      }

      if (task.mapping?.location) {
        // Check path pattern
        if (!task.mapping.location.match(/^\.\/.*\.csx$/)) {
          push(state.key, {
            id: 'E_BAD_PATH',
            severity: 'error',
            message: `mapping.location '${task.mapping.location}' must match pattern './*.csx'`
          });
        } else {
          // Check if file exists (when context available)
          const exists = checkScriptExists(task.mapping.location);
          if (exists === false) {
            push(state.key, {
              id: 'E_SCRIPT_NOT_FOUND',
              severity: 'error',
              message: `Script file '${task.mapping.location}' not found`
            });
          }
        }
      }
    }

    for (const task of (state.onExits || [])) {
      if (!hasTaskReference(task.task)) {
        push(state.key, {
          id: 'E_TASK_MISSING',
          severity: 'error',
          message: `task '${describeTaskRef(task.task)}' not found in catalog`
        });
      }

      if (task.mapping?.location) {
        // Check path pattern
        if (!task.mapping.location.match(/^\.\/.*\.csx$/)) {
          push(state.key, {
            id: 'E_BAD_PATH',
            severity: 'error',
            message: `mapping.location '${task.mapping.location}' must match pattern './*.csx'`
          });
        } else {
          // Check if file exists (when context available)
          const exists = checkScriptExists(task.mapping.location);
          if (exists === false) {
            push(state.key, {
              id: 'E_SCRIPT_NOT_FOUND',
              severity: 'error',
              message: `Script file '${task.mapping.location}' not found`
            });
          }
        }
      }
    }

    // onExecutionTasks moved to transition level in new schema

    // Check transition rules and tasks
    for (const transition of (state.transitions || [])) {
      if (transition.rule?.location) {
        // Check path pattern
        if (!transition.rule.location.match(/^\.\/.*\.csx$/)) {
          push(state.key, {
            id: 'E_BAD_PATH',
            severity: 'error',
            message: `rule.location '${transition.rule.location}' must match pattern './*.csx'`
          });
        } else {
          // Check if file exists (when context available)
          const exists = checkScriptExists(transition.rule.location);
          if (exists === false) {
            push(state.key, {
              id: 'E_SCRIPT_NOT_FOUND',
              severity: 'error',
              message: `Script file '${transition.rule.location}' not found`
            });
          }
        }
      }

      // Check transition schema reference
      if (transition.schema && !hasSchemaReference(transition.schema)) {
        push(state.key, {
          id: 'E_SCHEMA_MISSING',
          severity: 'error',
          message: `transition schema '${describeSchemaRef(transition.schema)}' not found in catalog`
        });
      }

      // Check transition view reference
      if (transition.view && !hasViewReference(transition.view)) {
        push(state.key, {
          id: 'E_VIEW_MISSING',
          severity: 'error',
          message: `transition view '${describeViewRef(transition.view)}' not found in catalog`
        });
      }

      // Check transition labels
      if (!transition.labels || transition.labels.length === 0) {
        push(state.key, {
          id: 'E_LABELS_EMPTY',
          severity: 'error',
          message: `Transition '${transition.key}' must have at least one label`
        });
      }

      // Check transition-level onExecutionTasks
      for (const task of (transition.onExecutionTasks || [])) {
        if (!hasTaskReference(task.task)) {
          push(state.key, {
            id: 'E_TASK_MISSING',
            severity: 'error',
            message: `transition task '${describeTaskRef(task.task)}' not found in catalog`
          });
        }

        if (task.mapping?.location) {
          // Check path pattern
          if (!task.mapping.location.match(/^\.\/.*\.csx$/)) {
            push(state.key, {
              id: 'E_BAD_PATH',
              severity: 'error',
              message: `mapping.location '${task.mapping.location}' must match pattern './*.csx'`
            });
          } else {
            // Check if file exists (when context available)
            const exists = checkScriptExists(task.mapping.location);
            if (exists === false) {
              push(state.key, {
                id: 'E_SCRIPT_NOT_FOUND',
                severity: 'error',
                message: `Script file '${task.mapping.location}' not found`
              });
            }
          }
        }
      }
    }

    // Check state view reference
    if (state.view && !hasViewReference(state.view)) {
      push(state.key, {
        id: 'E_VIEW_MISSING',
        severity: 'error',
        message: `state view '${describeViewRef(state.view)}' not found in catalog`
      });
    }

    // Check state labels
    if (!state.labels || state.labels.length === 0) {
      push(state.key, {
        id: 'E_LABELS_EMPTY',
        severity: 'error',
        message: `State '${state.key}' must have at least one label`
      });
    }

    // Check SubFlow state configuration
    // StateType: 4 = SubFlow
    if (state.stateType === 4) {
      if (!state.subFlow) {
        push(state.key, {
          id: 'E_SUBFLOW_NOT_CONFIGURED',
          severity: 'error',
          message: `SubFlow state '${state.key}' is missing subFlow configuration`
        });
      } else if (!state.subFlow.process) {
        push(state.key, {
          id: 'E_SUBFLOW_PROCESS_MISSING',
          severity: 'error',
          message: `SubFlow state '${state.key}' is missing subFlow.process reference`
        });
      } else if (!hasProcessReference(state.subFlow.process)) {
        // Check if the referenced process exists in catalog
        push(state.key, {
          id: 'E_SUBFLOW_MISSING',
          severity: 'error',
          message: `subflow process '${describeProcessRef(state.subFlow.process)}' not found in catalog`
        });
      }
    } else if (state.subFlow?.process && !hasProcessReference(state.subFlow.process)) {
      // Non-SubFlow state with subFlow configuration (edge case)
      push(state.key, {
        id: 'E_SUBFLOW_MISSING',
        severity: 'error',
        message: `subflow process '${describeProcessRef(state.subFlow.process)}' not found in catalog`
      });
    }
  }

  // Check shared transitions for basic validity
  // (Rule checking is done per-state above to consider context)
  for (const sharedTransition of (workflow.attributes.sharedTransitions || [])) {
    registerTransitionKey(sharedTransition.key);

    // Skip target validation for "$self" as it will be resolved to each source state
    if (sharedTransition.target !== '$self' && !stateKeys.has(sharedTransition.target)) {
      push('__shared__', {
        id: 'E_BAD_TARGET',
        severity: 'error',
        message: `shared transition '${sharedTransition.key}' targets missing state '${sharedTransition.target}'`
      });
    }

    // For "$self" transitions, ensure availableIn is not empty
    if (sharedTransition.target === '$self' && sharedTransition.availableIn.length === 0) {
      push('__shared__', {
        id: 'E_SELF_TRANSITION_NO_STATES',
        severity: 'error',
        message: `shared transition '${sharedTransition.key}' with target "$self" must have at least one state in availableIn`
      });
    }

    for (const from of sharedTransition.availableIn) {
      if (!stateKeys.has(from)) {
        push('__shared__', {
          id: 'E_BAD_AVAILABLE_IN',
          severity: 'error',
          message: `shared transition '${sharedTransition.key}' references missing state '${from}' in availableIn`
        });
      }
    }

    // Check shared transition schema reference
    if (sharedTransition.schema && !hasSchemaReference(sharedTransition.schema)) {
      push('__shared__', {
        id: 'E_SCHEMA_MISSING',
        severity: 'error',
        message: `shared transition schema '${describeSchemaRef(sharedTransition.schema)}' not found in catalog`
      });
    }

    // Check shared transition view reference
    if (sharedTransition.view && !hasViewReference(sharedTransition.view)) {
      push('__shared__', {
        id: 'E_VIEW_MISSING',
        severity: 'error',
        message: `shared transition view '${describeViewRef(sharedTransition.view)}' not found in catalog`
      });
    }

    // Check shared transition labels
    if (!sharedTransition.labels || sharedTransition.labels.length === 0) {
      push('__shared__', {
        id: 'E_LABELS_EMPTY',
        severity: 'error',
        message: `Shared transition '${sharedTransition.key}' must have at least one label`
      });
    }
  }

  for (const duplicateKey of duplicateStateKeys) {
    push('__states__', {
      id: 'E_DUP_STATE_KEY',
      severity: 'error',
      message: `state key '${duplicateKey}' is duplicated`
    });
  }

  for (const duplicateKey of duplicateTransitionKeys) {
    push('__transitions__', {
      id: 'E_DUP_TRANSITION_KEY',
      severity: 'error',
      message: `transition key '${duplicateKey}' is duplicated`
    });
  }

  return problems;
}
