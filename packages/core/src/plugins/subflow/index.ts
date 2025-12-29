/**
 * SubFlow State Plugin
 *
 * Provides specialized handling for subflow states that delegate to other workflows.
 * Supports different subflow types and parameter mapping.
 */

import type {
  StatePlugin,
  TerminalRole,
  ConnectionParams,
  DesignHints,
  PluginHooks,
  PluginProblem
} from '../types.js';
import type { State, Transition, SubFlowConfig } from '../../types/index.js';

/**
 * SubFlow state terminal definitions
 */
const SUBFLOW_STATE_TERMINALS: TerminalRole[] = [
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
      defaults: {
        triggerType: 1,
        versionStrategy: 'Minor'
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
      defaultTriggerType: 1, // Automatic
      allowedTriggerTypes: [1, 3], // Auto or Event
      requiredFields: ['key', 'target', 'triggerType', 'versionStrategy'],
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
      defaults: {
        triggerType: 2,
        versionStrategy: 'Minor',
        timer: {
          // Static timer script - default 30 minutes for subflow, no reset on re-entry
          code: btoa(`using System.Threading.Tasks;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions.Timer;

public class StaticTimer : ITimerMapping
{
    public async Task<TimerSchedule> Handler(ScriptContext context)
    {
        // Static duration: PT30M
        return TimerSchedule.FromDuration("PT30M", resetOnEntry: false);
    }
}
`),
          location: './src/timers/subflow-timeout.csx',
          encoding: 'B64',
          type: 'L'
        }
      }
    }
  }
];

/**
 * SubFlow state plugin hooks
 */
const subflowStateHooks: PluginHooks = {
  onActivate: () => {
    console.log('SubFlow State plugin activated');
  },

  onCreate: (state: State, hints: DesignHints) => {
    // Ensure state type is set to SubFlow
    state.stateType = 4;

    // Initialize subflow configuration if not present
    if (!state.subFlow) {
      state.subFlow = {
        type: 'S', // Default to 'S' type (SubFlow)
        process: {
          key: '',
          domain: '',
          flow: '',
          version: ''
        },
        mapping: {
          code: '',
          location: ''
        }
      } as SubFlowConfig;
    }

    // Make success terminal visible by default
    const successTerminal = hints.terminals.find(t => t.id === 'success');
    if (successTerminal) {
      successTerminal.visible = true;
    }

    // Set visual hint for subflow
    if (hints.visual) {
      hints.visual.icon = '⊕';
    } else {
      hints.visual = {
        icon: '⊕'
      };
    }
  },

  onConnect: (params: ConnectionParams): Transition | null => {
    const terminal = SUBFLOW_STATE_TERMINALS.find(t => t.id === params.fromTerminalId);
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

  onValidate: (state: State, hints: DesignHints): PluginProblem[] => {
    const problems: PluginProblem[] = [];

    // Must have subflow configuration
    if (!state.subFlow) {
      problems.push({
        code: 'subflow-state.no-config',
        message: 'SubFlow state must have subflow configuration',
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key
        }
      });
    } else {
      // Validate subflow process reference
      const process = state.subFlow.process;
      const hasValidProcess =
        ('ref' in process && process.ref) ||
        ('key' in process && process.key && process.domain && process.version);

      if (!hasValidProcess) {
        problems.push({
          code: 'subflow-state.invalid-process',
          message: 'SubFlow must have a valid process reference',
          severity: 'error',
          location: {
            type: 'state',
            stateKey: state.key,
            field: 'subFlow.process'
          }
        });
      }

      // Validate subflow type
      if (!state.subFlow.type || !['C', 'F', 'S', 'P'].includes(state.subFlow.type)) {
        problems.push({
          code: 'subflow-state.invalid-type',
          message: `Invalid subflow type '${state.subFlow.type}'. Must be 'C', 'F', 'S', or 'P'`,
          severity: 'error',
          location: {
            type: 'state',
            stateKey: state.key,
            field: 'subFlow.type'
          }
        });
      }
    }

    // Must have success transition
    const successBinding = hints.terminalBindings['success'];
    if (!successBinding && (!state.transitions || state.transitions.length === 0)) {
      problems.push({
        code: 'subflow-state.no-success',
        message: 'SubFlow state must have a success transition',
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key
        }
      });
    }

    // SubFlow state should not have onEntries/onExits
    if (state.onEntries && state.onEntries.length > 0) {
      problems.push({
        code: 'subflow-state.has-onentries',
        message: 'SubFlow state should not have onEntries tasks',
        severity: 'warning',
        location: {
          type: 'state',
          stateKey: state.key
        }
      });
    }

    if (state.onExits && state.onExits.length > 0) {
      problems.push({
        code: 'subflow-state.has-onexits',
        message: 'SubFlow state should not have onExits tasks',
        severity: 'warning',
        location: {
          type: 'state',
          stateKey: state.key
        }
      });
    }

    // SubFlow state should not have view
    if (state.view) {
      problems.push({
        code: 'subflow-state.has-view',
        message: 'SubFlow state should not have a view',
        severity: 'warning',
        location: {
          type: 'state',
          stateKey: state.key
        }
      });
    }

    return problems;
  },

  onDeserialize: (state: State): DesignHints | null => {
    // Detect if this is a subflow state
    if (state.stateType !== 4) {
      return null;
    }

    // Reconstruct hints from state
    const hints: DesignHints = {
      kind: 'SubFlow',
      terminals: [],
      terminalBindings: {},
      visual: {
        icon: '⊕'
      }
    };

    // Always show success terminal
    hints.terminals.push({
      id: 'success',
      role: 'success',
      visible: true
    });

    // Detect terminals from transitions
    if (state.transitions) {
      // Map first automatic transition to success
      const successTransition = state.transitions.find(t => t.triggerType === 1);
      if (successTransition) {
        hints.terminalBindings['success'] = successTransition.key;
      }

      // Check for error transition
      const errorTransition = state.transitions.find(t =>
        (t.key.toLowerCase().includes('error') || t.key.toLowerCase().includes('fail')) &&
        (t.triggerType === 1 || t.triggerType === 3)
      );
      if (errorTransition) {
        hints.terminals.push({
          id: 'error',
          role: 'error',
          visible: true
        });
        hints.terminalBindings['error'] = errorTransition.key;
      }

      // Check for timeout transition
      const timeoutTransition = state.transitions.find(t => t.triggerType === 2);
      if (timeoutTransition) {
        hints.terminals.push({
          id: 'timeout',
          role: 'timeout',
          visible: true
        });
        hints.terminalBindings['timeout'] = timeoutTransition.key;
      }
    }

    return hints;
  }
};

/**
 * SubFlow State Plugin definition
 */
export const SubFlowStatePlugin: StatePlugin = {
  id: 'SubFlow',
  label: 'SubFlow State',
  description: 'Delegate execution to another workflow',
  icon: '⊕',
  keyPrefix: 'subflow',
  defaultLabel: 'SubFlow',
  stateType: 4, // SubFlow state type
  terminals: SUBFLOW_STATE_TERMINALS,

  createState: (): State => {
    const stateKey = `subflow-${Date.now()}`;
    return {
      key: stateKey,
      stateType: 4, // SubFlow
      versionStrategy: 'Minor',
      labels: [
        {
          label: 'SubFlow',
          language: 'en'
        }
      ],
      subFlow: {
        type: 'S', // SubFlow type
        process: {
          key: '',
          domain: '',
          flow: '',
          version: ''
        },
        mapping: {
          code: '',
          location: ''
        }
      } as SubFlowConfig,
      transitions: []
    };
  },

  hooks: subflowStateHooks,

  lintRules: [],

  enabled: true,

  profiles: ['Default', 'SubFlow']
};

// Export for registration
export default SubFlowStatePlugin;