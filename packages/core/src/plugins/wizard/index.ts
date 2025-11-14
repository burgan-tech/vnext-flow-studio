/**
 * Wizard State Plugin
 *
 * Provides specialized handling for wizard states in workflows.
 * Wizard states can only have one outgoing transition (maxItems: 1).
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
 * Wizard state terminal definitions
 * Wizard states have incoming and outgoing connections, but only ONE outgoing transition
 */
const WIZARD_STATE_TERMINALS: TerminalRole[] = [
  {
    id: 'in',
    label: 'In',
    icon: '←',
    position: 'left',
    required: false,
    maxConnections: Infinity, // Can have multiple incoming
    transitionSubset: {
      defaultTriggerType: 0,
      allowedTriggerTypes: [0, 1, 2, 3],
      requiredFields: ['key', 'target', 'triggerType', 'versionStrategy'],
      defaults: {
        triggerType: 0,
        versionStrategy: 'Minor'
      }
    }
  },
  {
    id: 'next',
    label: 'Next',
    icon: '→',
    position: 'right',
    required: true,
    maxConnections: 1, // Only ONE outgoing transition
    transitionSubset: {
      defaultTriggerType: 0,
      allowedTriggerTypes: [0, 1, 2, 3],
      requiredFields: ['key', 'target', 'triggerType', 'versionStrategy'],
      defaults: {
        triggerType: 0,
        versionStrategy: 'Minor'
      }
    }
  }
];

/**
 * Wizard state plugin hooks
 */
const wizardStateHooks: PluginHooks = {
  onActivate: () => {
    console.log('Wizard State plugin activated');
  },

  onCreate: (state: State, hints: DesignHints) => {
    // Ensure state type is set to Wizard
    state.stateType = 5;

    // Make next terminal visible by default
    const nextTerminal = hints.terminals.find(t => t.id === 'next');
    if (nextTerminal) {
      nextTerminal.visible = true;
    }
  },

  onConnect: (params: ConnectionParams): Transition | null => {
    const terminal = WIZARD_STATE_TERMINALS.find(t => t.id === params.fromTerminalId);
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

  onValidate: (state: State, _hints: DesignHints, _workflow?: any): PluginProblem[] => {
    const problems: PluginProblem[] = [];

    // Wizard states can only have ONE outgoing transition
    if (state.transitions && state.transitions.length > 1) {
      problems.push({
        code: 'wizard-state.multiple-transitions',
        message: 'Wizard state can only have one outgoing transition',
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key
        }
      });
    }

    // Wizard state should not have subflow
    if (state.subFlow) {
      problems.push({
        code: 'wizard-state.has-subflow',
        message: 'Wizard state cannot have a subflow',
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
    // Detect if this is a wizard state
    if (state.stateType !== 5) {
      return null;
    }

    // Reconstruct hints from state
    const hints: DesignHints = {
      kind: 'Wizard',
      terminals: [
        {
          id: 'in',
          role: 'in',
          visible: false
        },
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
 * Wizard State Plugin definition
 */
export const WizardStatePlugin: StatePlugin = {
  id: 'Wizard',
  label: 'Wizard State',
  description: 'Wizard step with single next action',
  icon: '◇',
  keyPrefix: 'wizard',
  defaultLabel: 'Wizard Step',
  stateType: 5, // Wizard state type
  terminals: WIZARD_STATE_TERMINALS,

  createState: (): State => {
    const stateKey = `wizard-${Date.now()}`;
    return {
      key: stateKey,
      stateType: 5, // Wizard
      xProfile: 'Wizard',
      versionStrategy: 'Minor',
      labels: [
        {
          label: 'Wizard Step',
          language: 'en'
        }
      ],
      transitions: []
    };
  },

  hooks: wizardStateHooks,

  lintRules: [],

  enabled: true,

  profiles: ['Default', 'Wizard']
};

// Export for registration
export default WizardStatePlugin;
