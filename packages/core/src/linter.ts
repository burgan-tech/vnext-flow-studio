import { validateWorkflow } from './schema.js';
import type { Workflow } from './types.js';

export type Severity = 'error' | 'warning';

export interface Problem {
  id: string;
  message: string;
  severity: Severity;
  path?: string;
}

export function lint(workflow: Workflow): Record<string, Problem[]> {
  const problems: Record<string, Problem[]> = {};
  const push = (ownerId: string, p: Problem) => {
    (problems[ownerId] ||= []).push(p);
  };

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
  const stateKeys = new Set(workflow.attributes.states.map(s => s.key));

  // Check startTransition target
  if (workflow.attributes.startTransition && !stateKeys.has(workflow.attributes.startTransition.target)) {
    push('__start__', {
      id: 'E_START_TARGET',
      severity: 'error',
      message: `startTransition.target '${workflow.attributes.startTransition.target}' not found`
    });
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
    for (const transition of (state.transitions || [])) {
      // E_FROM_MISMATCH: transition.from must equal parent state key
      if (transition.from !== state.key) {
        push(state.key, {
          id: 'E_FROM_MISMATCH',
          severity: 'error',
          message: `transition.from '${transition.from}' must equal parent state '${state.key}'`
        });
      }

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
      if (task.mapping?.location && !task.mapping.location.match(/^\.\/src\/.*\.csx$/)) {
        push(state.key, {
          id: 'E_BAD_PATH',
          severity: 'error',
          message: `mapping.location '${task.mapping.location}' must match pattern './src/*.csx'`
        });
      }
    }

    for (const task of (state.onExit || [])) {
      if (task.mapping?.location && !task.mapping.location.match(/^\.\/src\/.*\.csx$/)) {
        push(state.key, {
          id: 'E_BAD_PATH',
          severity: 'error',
          message: `mapping.location '${task.mapping.location}' must match pattern './src/*.csx'`
        });
      }
    }

    for (const task of (state.onExecutionTasks || [])) {
      if (task.mapping?.location && !task.mapping.location.match(/^\.\/src\/.*\.csx$/)) {
        push(state.key, {
          id: 'E_BAD_PATH',
          severity: 'error',
          message: `mapping.location '${task.mapping.location}' must match pattern './src/*.csx'`
        });
      }
    }

    // Check transition rules
    for (const transition of (state.transitions || [])) {
      if (transition.rule?.location && !transition.rule.location.match(/^\.\/src\/.*\.csx$/)) {
        push(state.key, {
          id: 'E_BAD_PATH',
          severity: 'error',
          message: `rule.location '${transition.rule.location}' must match pattern './src/*.csx'`
        });
      }
    }
  }

  // Check shared transitions
  for (const sharedTransition of (workflow.attributes.sharedTransitions || [])) {
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

  return problems;
}