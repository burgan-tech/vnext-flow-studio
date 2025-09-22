import { validateWorkflow } from './schema.js';
import type { TaskDefinition, TaskRef, Workflow } from './types.js';

export type Severity = 'error' | 'warning';

export interface Problem {
  id: string;
  message: string;
  severity: Severity;
  path?: string;
}

export interface LintContext {
  tasks?: TaskDefinition[];
}

export function lint(
  workflow: Workflow,
  context: LintContext = {}
): Record<string, Problem[]> {
  const problems: Record<string, Problem[]> = {};
  const push = (ownerId: string, p: Problem) => {
    (problems[ownerId] ||= []).push(p);
  };

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

  const shouldValidateTasks = context.tasks !== undefined;

  const hasTaskReference = (ref: TaskRef | undefined): boolean => {
    if (!shouldValidateTasks || !ref) {
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

    if (!key || !domain || !version || !flow) {
      return false;
    }

    return taskIndex.has(`${domain}/${flow}/${key}@${version}`);
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
    for (const error of (validateWorkflow.errors || [])) {
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
  }

  // Check timeout target
  if (workflow.attributes.timeout && !stateKeys.has(workflow.attributes.timeout.target)) {
    push('__timeout__', {
      id: 'E_TIMEOUT_TARGET',
      severity: 'error',
      message: `timeout.target '${workflow.attributes.timeout.target}' not found`
    });
  }

  // Check states and transitions
  for (const state of workflow.attributes.states) {
    // Check local transitions
    const transitions = state.transitions || [];

    // Check if multiple transitions have rules when needed
    const autoTransitions = transitions.filter(t => t.triggerType === 1); // Auto triggers
    if (autoTransitions.length > 1) {
      for (const transition of autoTransitions) {
        if (!transition.rule?.location) {
          push(state.key, {
            id: 'E_MISSING_RULE',
            severity: 'error',
            message: `State has ${autoTransitions.length} auto transitions - transition '${transition.key}' must have a rule to determine which path to take`
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

    // PATH checks for mappings and rules
    for (const task of (state.onEntries || [])) {
      if (!hasTaskReference(task.task)) {
        push(state.key, {
          id: 'E_TASK_MISSING',
          severity: 'error',
          message: `task '${describeTaskRef(task.task)}' not found in catalog`
        });
      }

      if (task.mapping?.location && !task.mapping.location.match(/^\.\/.*\.csx$/)) {
        push(state.key, {
          id: 'E_BAD_PATH',
          severity: 'error',
          message: `mapping.location '${task.mapping.location}' must match pattern './*.csx'`
        });
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

      if (task.mapping?.location && !task.mapping.location.match(/^\.\/.*\.csx$/)) {
        push(state.key, {
          id: 'E_BAD_PATH',
          severity: 'error',
          message: `mapping.location '${task.mapping.location}' must match pattern './*.csx'`
        });
      }
    }

    // onExecutionTasks moved to transition level in new schema

    // Check transition rules and tasks
    for (const transition of (state.transitions || [])) {
      if (transition.rule?.location && !transition.rule.location.match(/^\.\/.*\.csx$/)) {
        push(state.key, {
          id: 'E_BAD_PATH',
          severity: 'error',
          message: `rule.location '${transition.rule.location}' must match pattern './*.csx'`
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

        if (task.mapping?.location && !task.mapping.location.match(/^\.\/.*\.csx$/)) {
          push(state.key, {
            id: 'E_BAD_PATH',
            severity: 'error',
            message: `mapping.location '${task.mapping.location}' must match pattern './*.csx'`
          });
        }
      }
    }
  }

  // Check shared transitions
  for (const sharedTransition of (workflow.attributes.sharedTransitions || [])) {
    registerTransitionKey(sharedTransition.key);

    if (!stateKeys.has(sharedTransition.target)) {
      push('__shared__', {
        id: 'E_BAD_TARGET',
        severity: 'error',
        message: `shared transition '${sharedTransition.key}' targets missing state '${sharedTransition.target}'`
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
