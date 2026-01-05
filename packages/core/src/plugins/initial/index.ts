/**
 * Initial State Plugin
 *
 * Provides specialized handling for initial states (entry points) in workflows.
 * Initial states cannot have incoming connections and only one is allowed per workflow.
 */

import type {
  StatePlugin,
  TerminalRole,
  ConnectionParams,
  DesignHints,
  PluginHooks,
  PluginProblem
} from '../types.js';
import type { State, Transition } from '../../types/index.js';

/**
 * Initial state terminal definitions
 * Initial states only have outgoing connections
 */
const INITIAL_STATE_TERMINALS: TerminalRole[] = [
  {
    id: 'next',
    label: 'Next',
    icon: '→',
    position: 'right',
    required: true,
    maxConnections: 1,
    transitionSubset: {
      defaultTriggerType: 1, // Automatic
      allowedTriggerTypes: [0, 1, 3], // Manual, Auto, Event
      requiredFields: ['key', 'target', 'triggerType', 'versionStrategy'],
      defaults: {
        triggerType: 1,
        triggerKind: 10, // Default auto transition
        versionStrategy: 'Minor'
      }
    }
  }
];

/**
 * Initial state plugin hooks
 */
const initialStateHooks: PluginHooks = {
  onActivate: () => {
    console.log('Initial State plugin activated');
  },

  onCreate: (state: State, hints: DesignHints) => {
    // Ensure state type is set to Initial
    state.stateType = 1;

    // Make next terminal visible by default
    const nextTerminal = hints.terminals.find(t => t.id === 'next');
    if (nextTerminal) {
      nextTerminal.visible = true;
    }
  },

  onConnect: (params: ConnectionParams): Transition | null => {
    const terminal = INITIAL_STATE_TERMINALS.find(t => t.id === params.fromTerminalId);
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

  onValidate: (state: State, hints: DesignHints, workflow?: any): PluginProblem[] => {
    const problems: PluginProblem[] = [];

    // Must have exactly one outgoing transition
    if (!state.transitions || state.transitions.length === 0) {
      problems.push({
        code: 'initial-state.no-transition',
        message: 'Initial state must have an outgoing transition',
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key
        }
      });
    }

    // Check if there are multiple initial states in the workflow
    if (workflow) {
      const initialStates = workflow.attributes.states.filter((s: State) =>
        s.stateType === 1
      );
      if (initialStates.length > 1) {
        problems.push({
          code: 'initial-state.multiple',
          message: 'Only one initial state is allowed per workflow',
          severity: 'error',
          location: {
            type: 'state',
            stateKey: state.key
          }
        });
      }
    }

    // Initial state should not have view or subflow
    if (state.view) {
      problems.push({
        code: 'initial-state.has-view',
        message: 'Initial state cannot have a view',
        severity: 'warning',
        location: {
          type: 'state',
          stateKey: state.key
        }
      });
    }

    if (state.subFlow) {
      problems.push({
        code: 'initial-state.has-subflow',
        message: 'Initial state cannot have a subflow',
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key
        }
      });
    }

    return problems;
  },

  onDeserialize: (state: State): DesignHints | null => {
    // Detect if this is an initial state
    if (state.stateType !== 1) {
      return null;
    }

    // Reconstruct hints from state
    const hints: DesignHints = {
      kind: 'Initial',
      terminals: [
        {
          id: 'next',
          role: 'next',
          visible: true
        }
      ],
      terminalBindings: {}
    };

    // Bind existing transitions to the next terminal
    if (state.transitions && state.transitions.length > 0) {
      hints.terminalBindings['next'] = state.transitions[0].key;
    }

    return hints;
  }
};

/**
 * Initial State Plugin definition
 */
export const InitialStatePlugin: StatePlugin = {
  id: 'Initial',
  label: 'Initial State',
  description: 'Entry point for workflow execution',
  icon: '▶',
  keyPrefix: 'initial',
  defaultLabel: 'Start',
  stateType: 1, // Initial state type
  terminals: INITIAL_STATE_TERMINALS,

  createState: (): State => {
    const stateKey = `initial-${Date.now()}`;
    return {
      key: stateKey,
      stateType: 1, // Initial
      versionStrategy: 'Minor',
      labels: [
        {
          label: 'Start',
          language: 'en'
        }
      ],
      transitions: []
    };
  },

  hooks: initialStateHooks,

  lintRules: [],

  enabled: true,

  profiles: ['Default', 'Initial']
};

// Export for registration
export default InitialStatePlugin;