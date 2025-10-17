/**
 * Service Task Plugin
 *
 * Provides specialized editing for service-oriented states with task execution.
 */

import type {
  StatePlugin,
  TerminalRole,
  ConnectionParams,
  DisconnectionParams,
  DesignHints,
  PluginHooks,
  PluginProblem
} from '../types.js';
import type { State, Transition } from '../../types/index.js';
import { ServiceTaskVariantProvider } from './variantProvider.js';
import { serviceTaskLintRules } from './lints.js';

/**
 * Service Task terminal definitions
 */
const SERVICE_TASK_TERMINALS: TerminalRole[] = [
  {
    id: 'success',
    label: 'Success',
    icon: '✓',
    position: 'right',
    required: true,
    maxConnections: 1,
    transitionSubset: {
      defaultTriggerType: 1, // Automatic
      allowedTriggerTypes: [1],
      requiredFields: ['key', 'target', 'triggerType', 'versionStrategy'],
      disallowedFields: ['timer', 'view'],
      defaults: {
        triggerType: 1,
        versionStrategy: 'Minor'
      }
    }
  },
  {
    id: 'timeout',
    label: 'Timeout',
    icon: '⏱',
    position: 'bottom',
    required: false,
    maxConnections: 1,
    transitionSubset: {
      defaultTriggerType: 2, // Timeout
      allowedTriggerTypes: [2],
      requiredFields: ['key', 'target', 'triggerType', 'versionStrategy', 'timer'],
      disallowedFields: ['view'],
      defaults: {
        triggerType: 2,
        versionStrategy: 'Minor',
        timer: {
          reset: 'N',
          duration: 'PT5M' // Default 5 minutes
        }
      },
      validate: (transition: Transition) => {
        const errors: PluginProblem[] = [];
        if (!transition.timer) {
          errors.push({
            code: 'service-task.timeout.missing-timer',
            message: 'Timeout transition must have a timer configuration',
            severity: 'error',
            location: {
              type: 'transition',
              stateKey: '', // Will be filled in by caller
              transitionKey: transition.key
            }
          });
        } else if (!transition.timer.duration) {
          errors.push({
            code: 'service-task.timeout.missing-duration',
            message: 'Timeout timer must specify a duration',
            severity: 'error',
            location: {
              type: 'transition',
              stateKey: '', // Will be filled in by caller
              transitionKey: transition.key
            }
          });
        }
        return { valid: errors.length === 0, problems: errors };
      }
    }
  },
  {
    id: 'error',
    label: 'Error',
    icon: '⚠',
    position: 'bottom',
    required: false,
    maxConnections: 1,
    transitionSubset: {
      defaultTriggerType: 1, // Can be Automatic or Event
      allowedTriggerTypes: [1, 3],
      requiredFields: ['key', 'target', 'triggerType', 'versionStrategy'],
      disallowedFields: ['view', 'timer'],
      defaults: {
        triggerType: 1,
        versionStrategy: 'Minor'
      }
    }
  }
];

/**
 * Service Task plugin hooks
 */
const serviceTaskHooks: PluginHooks = {
  onActivate: () => {
    console.log('Service Task plugin activated');
  },

  onDeactivate: () => {
    console.log('Service Task plugin deactivated');
  },

  onCreate: (state: State, hints: DesignHints) => {
    // Ensure at least one task is configured
    if (!state.onEntries || state.onEntries.length === 0) {
      state.onEntries = [
        {
          order: 1,
          task: { ref: '' }, // Placeholder, to be configured
          mapping: {
            location: 'inline',
            code: '// Configure task mapping'
          }
        }
      ];
    }

    // Make success terminal visible by default
    const successTerminal = hints.terminals.find(t => t.id === 'success');
    if (successTerminal) {
      successTerminal.visible = true;
    }
  },

  onConnect: (params: ConnectionParams): Transition | null => {
    const terminal = SERVICE_TASK_TERMINALS.find(t => t.id === params.fromTerminalId);
    if (!terminal) {
      return null;
    }

    const subset = terminal.transitionSubset;
    const transitionKey = `${params.fromState.key}-to-${params.toState.key}`;

    // Create transition based on subset defaults
    const transition: Transition = {
      key: transitionKey,
      target: params.toState.key,
      triggerType: subset.defaultTriggerType,
      versionStrategy: 'Minor',
      ...subset.defaults
    };

    return transition;
  },

  onDisconnect: (params: DisconnectionParams) => {
    console.log(`Disconnecting transition ${params.transitionKey} from terminal ${params.fromTerminalId}`);
  },

  onValidate: (state: State, hints: DesignHints): PluginProblem[] => {
    const problems: PluginProblem[] = [];

    // Must have at least one task
    if (!state.onEntries || state.onEntries.length === 0) {
      problems.push({
        code: 'service-task.no-task',
        message: 'Service Task must have at least one task configured',
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key
        }
      });
    }

    // Must have exactly one success transition
    const successBinding = hints.terminalBindings['success'];
    if (!successBinding) {
      problems.push({
        code: 'service-task.no-success',
        message: 'Service Task must have a Success transition',
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key
        }
      });
    }

    // Cannot have view or subflow
    if (state.view) {
      problems.push({
        code: 'service-task.has-view',
        message: 'Service Task cannot have a view',
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key
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
          stateKey: state.key
        }
      });
    }

    return problems;
  },

  onSerialize: (state: State, hints: DesignHints): State => {
    // Clean up any editor-only fields before saving
    const cleanState = { ...state };

    // Ensure transitions are properly ordered based on terminal bindings
    if (cleanState.transitions) {
      const orderedTransitions: Transition[] = [];

      // Add success transition first
      const successKey = hints.terminalBindings['success'];
      if (successKey) {
        const successTransition = cleanState.transitions.find(t => t.key === successKey);
        if (successTransition) {
          orderedTransitions.push(successTransition);
        }
      }

      // Add timeout transition
      const timeoutKey = hints.terminalBindings['timeout'];
      if (timeoutKey) {
        const timeoutTransition = cleanState.transitions.find(t => t.key === timeoutKey);
        if (timeoutTransition) {
          orderedTransitions.push(timeoutTransition);
        }
      }

      // Add error transition
      const errorKey = hints.terminalBindings['error'];
      if (errorKey) {
        const errorTransition = cleanState.transitions.find(t => t.key === errorKey);
        if (errorTransition) {
          orderedTransitions.push(errorTransition);
        }
      }

      // Add any remaining transitions
      cleanState.transitions.forEach(t => {
        if (!orderedTransitions.find(ot => ot.key === t.key)) {
          orderedTransitions.push(t);
        }
      });

      cleanState.transitions = orderedTransitions;
    }

    return cleanState;
  },

  onDeserialize: (state: State): DesignHints | null => {
    // Detect if this is a service task pattern
    const hasTask = state.onEntries && state.onEntries.length > 0;
    const hasNoView = !state.view;
    const hasNoSubflow = !state.subFlow;

    if (!hasTask || !hasNoView || !hasNoSubflow) {
      return null;
    }

    // Reconstruct hints from state
    const hints: DesignHints = {
      kind: 'ServiceTask',
      terminals: [],
      terminalBindings: {}
    };

    // Detect terminals from transitions
    if (state.transitions) {
      state.transitions.forEach(transition => {
        if (transition.triggerType === 1) {
          // Likely a success transition
          if (!hints.terminalBindings['success']) {
            hints.terminals.push({
              id: 'success',
              role: 'success',
              visible: true
            });
            hints.terminalBindings['success'] = transition.key;
          } else if (transition.key.toLowerCase().includes('error') ||
                     transition.key.toLowerCase().includes('fail')) {
            // Likely an error transition
            hints.terminals.push({
              id: 'error',
              role: 'error',
              visible: true
            });
            hints.terminalBindings['error'] = transition.key;
          }
        } else if (transition.triggerType === 2) {
          // Timeout transition
          hints.terminals.push({
            id: 'timeout',
            role: 'timeout',
            visible: true
          });
          hints.terminalBindings['timeout'] = transition.key;
        } else if (transition.triggerType === 3) {
          // Event transition, could be error
          if (transition.key.toLowerCase().includes('error') ||
              transition.key.toLowerCase().includes('fail')) {
            hints.terminals.push({
              id: 'error',
              role: 'error',
              visible: true
            });
            hints.terminalBindings['error'] = transition.key;
          }
        }
      });
    }

    // Ensure success terminal exists even if no transition yet
    if (!hints.terminals.find(t => t.id === 'success')) {
      hints.terminals.push({
        id: 'success',
        role: 'success',
        visible: true
      });
    }

    return hints;
  }
};

/**
 * Service Task Plugin definition
 */
export const ServiceTaskPlugin: StatePlugin = {
  id: 'ServiceTask',
  label: 'Service Task',
  description: 'Execute tasks and services with success/error handling',
  icon: '⚙', // gear icon
  keyPrefix: 'service',
  defaultLabel: 'Service Task',
  stateType: 2, // Intermediate state type
  terminals: SERVICE_TASK_TERMINALS,

  createState: (): State => {
    const stateKey = `service-${Date.now()}`;
    return {
      key: stateKey,
      stateType: 2, // Intermediate
      xProfile: 'ServiceTask', // Mark this as a ServiceTask state
      versionStrategy: 'Minor',
      labels: [
        {
          label: 'Service Task',
          language: 'en'
        }
      ],
      onEntries: [
        {
          order: 1,
          task: { ref: '' }, // To be configured
          mapping: {
            location: 'inline',
            code: '// Configure task input mapping'
          }
        }
      ],
      transitions: []
    };
  },

  variantProvider: new ServiceTaskVariantProvider(),

  hooks: serviceTaskHooks,

  lintRules: serviceTaskLintRules,

  enabled: true,

  profiles: ['Default', 'ServiceTask']
};

// Export for registration
export default ServiceTaskPlugin;