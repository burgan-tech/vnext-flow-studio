/**
 * Service Task Linting Rules
 *
 * Validation rules specific to Service Task states.
 */

import type { LintRule, DesignHints, PluginProblem } from '../types.js';
import type { State, Workflow } from '../../types/index.js';

/**
 * Validate that Service Task has at least one task configured
 */
const requireTask: LintRule = {
  id: 'service-task.require-task',
  description: 'Service Task must have at least one task configured',
  severity: 'error',
  validate: (state: State, _hints: DesignHints, _workflow: Workflow): PluginProblem[] => {
    const problems: PluginProblem[] = [];

    if (!state.onEntries || state.onEntries.length === 0) {
      problems.push({
        code: 'service-task.no-task',
        message: 'Service Task must have at least one task in onEntries',
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key
        },
        fix: {
          type: 'add-task',
          description: 'Add a task to onEntries'
        }
      });
    } else {
      // Check each task has a valid reference
      state.onEntries.forEach((entry, index) => {
        if (!entry.task) {
          problems.push({
            code: 'service-task.missing-task-ref',
            message: `Task entry ${index + 1} is missing task reference`,
            severity: 'error',
            location: {
              type: 'state',
              stateKey: state.key,
              field: `onEntries[${index}]`
            }
          });
        } else if ('ref' in entry.task && !entry.task.ref) {
          problems.push({
            code: 'service-task.empty-task-ref',
            message: `Task entry ${index + 1} has empty task reference`,
            severity: 'error',
            location: {
              type: 'state',
              stateKey: state.key,
              field: `onEntries[${index}].task.ref`
            }
          });
        }
      });
    }

    return problems;
  }
};

/**
 * Validate that Service Task has exactly one Success transition
 */
const requireSuccessTransition: LintRule = {
  id: 'service-task.require-success',
  description: 'Service Task must have exactly one Success transition',
  severity: 'error',
  validate: (state: State, hints: DesignHints, _workflow: Workflow): PluginProblem[] => {
    const problems: PluginProblem[] = [];

    const successBinding = hints.terminalBindings['success'];
    if (!successBinding) {
      problems.push({
        code: 'service-task.no-success-transition',
        message: 'Service Task must have a Success transition',
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key
        },
        fix: {
          type: 'add-transition',
          description: 'Connect the Success terminal to a target state'
        }
      });
    } else {
      // Verify the transition exists and is valid
      const transition = state.transitions?.find(t => t.key === successBinding);
      if (!transition) {
        problems.push({
          code: 'service-task.invalid-success-binding',
          message: 'Success terminal is bound to non-existent transition',
          severity: 'error',
          location: {
            type: 'state',
            stateKey: state.key
          }
        });
      } else if (transition.triggerType !== 1) {
        problems.push({
          code: 'service-task.invalid-success-trigger',
          message: 'Success transition must have Automatic trigger type',
          severity: 'error',
          location: {
            type: 'transition',
            stateKey: state.key,
            transitionKey: transition.key
          }
        });
      }
    }

    return problems;
  }
};

/**
 * Validate Timeout terminal configuration
 */
const validateTimeoutTerminal: LintRule = {
  id: 'service-task.validate-timeout',
  description: 'Timeout terminal must have valid timer configuration',
  severity: 'error',
  validate: (state: State, hints: DesignHints, _workflow: Workflow): PluginProblem[] => {
    const problems: PluginProblem[] = [];

    const timeoutBinding = hints.terminalBindings['timeout'];
    if (timeoutBinding) {
      const transition = state.transitions?.find(t => t.key === timeoutBinding);
      if (!transition) {
        problems.push({
          code: 'service-task.invalid-timeout-binding',
          message: 'Timeout terminal is bound to non-existent transition',
          severity: 'error',
          location: {
            type: 'state',
            stateKey: state.key
          }
        });
      } else {
        // Check trigger type
        if (transition.triggerType !== 2) {
          problems.push({
            code: 'service-task.invalid-timeout-trigger',
            message: 'Timeout transition must have Timeout trigger type',
            severity: 'error',
            location: {
              type: 'transition',
              stateKey: state.key,
              transitionKey: transition.key
            }
          });
        }

        // Check timer configuration
        if (!transition.timer) {
          problems.push({
            code: 'service-task.missing-timer',
            message: 'Timeout transition must have timer configuration',
            severity: 'error',
            location: {
              type: 'transition',
              stateKey: state.key,
              transitionKey: transition.key
            }
          });
        } else {
          // Validate timer duration
          if (!transition.timer.duration) {
            problems.push({
              code: 'service-task.missing-timer-duration',
              message: 'Timeout timer must specify a duration',
              severity: 'error',
              location: {
                type: 'transition',
                stateKey: state.key,
                transitionKey: transition.key,
                field: 'timer.duration'
              }
            });
          } else if (!isValidISO8601Duration(transition.timer.duration)) {
            problems.push({
              code: 'service-task.invalid-timer-duration',
              message: `Invalid ISO 8601 duration: ${transition.timer.duration}`,
              severity: 'error',
              location: {
                type: 'transition',
                stateKey: state.key,
                transitionKey: transition.key,
                field: 'timer.duration'
              },
              fix: {
                type: 'format-duration',
                description: 'Use ISO 8601 format (e.g., PT5M for 5 minutes)'
              }
            });
          }
        }
      }
    }

    return problems;
  }
};

/**
 * Validate Error terminal configuration
 */
const validateErrorTerminal: LintRule = {
  id: 'service-task.validate-error',
  description: 'Error terminal must have valid configuration',
  severity: 'warning',
  validate: (state: State, hints: DesignHints, _workflow: Workflow): PluginProblem[] => {
    const problems: PluginProblem[] = [];

    const errorBinding = hints.terminalBindings['error'];
    if (errorBinding) {
      const transition = state.transitions?.find(t => t.key === errorBinding);
      if (!transition) {
        problems.push({
          code: 'service-task.invalid-error-binding',
          message: 'Error terminal is bound to non-existent transition',
          severity: 'error',
          location: {
            type: 'state',
            stateKey: state.key
          }
        });
      } else {
        // Check trigger type (should be Automatic or Event)
        if (transition.triggerType !== 1 && transition.triggerType !== 3) {
          problems.push({
            code: 'service-task.invalid-error-trigger',
            message: 'Error transition must have Automatic or Event trigger type',
            severity: 'error',
            location: {
              type: 'transition',
              stateKey: state.key,
              transitionKey: transition.key
            }
          });
        }
      }
    } else {
      // Warning if no error handling
      problems.push({
        code: 'service-task.no-error-handling',
        message: 'Consider adding error handling to Service Task',
        severity: 'warning',
        location: {
          type: 'state',
          stateKey: state.key
        },
        fix: {
          type: 'add-error-transition',
          description: 'Add an Error terminal for error handling'
        }
      });
    }

    return problems;
  }
};

/**
 * Ensure Service Task doesn't have view or subflow
 */
const disallowViewAndSubflow: LintRule = {
  id: 'service-task.no-view-subflow',
  description: 'Service Task cannot have view or subflow',
  severity: 'error',
  validate: (state: State, _hints: DesignHints, _workflow: Workflow): PluginProblem[] => {
    const problems: PluginProblem[] = [];

    if (state.view) {
      problems.push({
        code: 'service-task.has-view',
        message: 'Service Task cannot have a view',
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key,
          field: 'view'
        },
        fix: {
          type: 'remove-field',
          description: 'Remove view from Service Task'
        }
      });
    }

    if (state.subFlow) {
      problems.push({
        code: 'service-task.has-subflow',
        message: 'Service Task cannot have a subflow',
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key,
          field: 'subFlow'
        },
        fix: {
          type: 'remove-field',
          description: 'Remove subflow from Service Task'
        }
      });
    }

    return problems;
  }
};

/**
 * Validate task mapping
 */
const validateTaskMapping: LintRule = {
  id: 'service-task.validate-mapping',
  description: 'Task mapping should be properly configured',
  severity: 'warning',
  validate: (state: State, _hints: DesignHints, _workflow: Workflow): PluginProblem[] => {
    const problems: PluginProblem[] = [];

    state.onEntries?.forEach((entry, index) => {
      if (!entry.mapping) {
        problems.push({
          code: 'service-task.missing-mapping',
          message: `Task entry ${index + 1} is missing input mapping`,
          severity: 'warning',
          location: {
            type: 'state',
            stateKey: state.key,
            field: `onEntries[${index}]`
          },
          fix: {
            type: 'add-mapping',
            description: 'Add input mapping for the task'
          }
        });
      } else if (!entry.mapping.code || entry.mapping.code.trim() === '') {
        problems.push({
          code: 'service-task.empty-mapping',
          message: `Task entry ${index + 1} has empty mapping code`,
          severity: 'warning',
          location: {
            type: 'state',
            stateKey: state.key,
            field: `onEntries[${index}].mapping`
          }
        });
      }
    });

    return problems;
  }
};

/**
 * Validate task order
 */
const validateTaskOrder: LintRule = {
  id: 'service-task.validate-order',
  description: 'Task execution order should be sequential',
  severity: 'warning',
  validate: (state: State, _hints: DesignHints, _workflow: Workflow): PluginProblem[] => {
    const problems: PluginProblem[] = [];

    if (state.onEntries && state.onEntries.length > 1) {
      const orders = state.onEntries.map(e => e.order);
      const sortedOrders = [...orders].sort((a, b) => a - b);

      // Check for duplicates
      const duplicates = orders.filter((item, index) => orders.indexOf(item) !== index);
      if (duplicates.length > 0) {
        problems.push({
          code: 'service-task.duplicate-order',
          message: `Duplicate execution order values: ${duplicates.join(', ')}`,
          severity: 'error',
          location: {
            type: 'state',
            stateKey: state.key,
            field: 'onEntries'
          }
        });
      }

      // Check for gaps
      for (let i = 0; i < sortedOrders.length - 1; i++) {
        if (sortedOrders[i + 1] - sortedOrders[i] > 1) {
          problems.push({
            code: 'service-task.order-gap',
            message: `Gap in execution order between ${sortedOrders[i]} and ${sortedOrders[i + 1]}`,
            severity: 'info',
            location: {
              type: 'state',
              stateKey: state.key,
              field: 'onEntries'
            }
          });
        }
      }
    }

    return problems;
  }
};

/**
 * Helper function to validate ISO 8601 duration
 */
function isValidISO8601Duration(duration: string): boolean {
  // Basic ISO 8601 duration pattern
  const pattern = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;
  return pattern.test(duration);
}

/**
 * All Service Task lint rules
 */
export const serviceTaskLintRules: LintRule[] = [
  requireTask,
  requireSuccessTransition,
  validateTimeoutTerminal,
  validateErrorTerminal,
  disallowViewAndSubflow,
  validateTaskMapping,
  validateTaskOrder
];