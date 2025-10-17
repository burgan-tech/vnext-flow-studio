/**
 * Intermediate State Plugin
 *
 * Provides standard state functionality with full feature support including
 * onEntries, onExits, views, and multiple transitions.
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
 * Intermediate state terminal definitions
 * Supports multiple outgoing connections
 */
const INTERMEDIATE_STATE_TERMINALS: TerminalRole[] = [
  {
    id: 'auto',
    label: 'Automatic',
    icon: '→',
    position: 'right',
    required: false,
    maxConnections: undefined, // Unlimited
    transitionSubset: {
      defaultTriggerType: 1, // Automatic
      allowedTriggerTypes: [1], // Auto only
      requiredFields: ['key', 'target', 'triggerType', 'versionStrategy'],
      defaults: {
        triggerType: 1,
        versionStrategy: 'Minor'
      }
    }
  },
  {
    id: 'manual',
    label: 'Manual',
    icon: '👤',
    position: 'right',
    required: false,
    maxConnections: undefined, // Unlimited
    transitionSubset: {
      defaultTriggerType: 0, // Manual
      allowedTriggerTypes: [0], // Manual only
      requiredFields: ['key', 'target', 'triggerType', 'versionStrategy'],
      defaults: {
        triggerType: 0,
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
          reset: 'N',
          duration: 'PT5M' // Default 5 minutes
        }
      }
    }
  },
  {
    id: 'event',
    label: 'Event',
    icon: '⚡',
    position: 'bottom',
    required: false,
    maxConnections: undefined, // Unlimited
    transitionSubset: {
      defaultTriggerType: 3, // Event
      allowedTriggerTypes: [3],
      requiredFields: ['key', 'target', 'triggerType', 'versionStrategy'],
      defaults: {
        triggerType: 3,
        versionStrategy: 'Minor'
      }
    }
  }
];

/**
 * Intermediate state plugin hooks
 */
const intermediateStateHooks: PluginHooks = {
  onActivate: () => {
    console.log('Intermediate State plugin activated');
  },

  onCreate: (state: State, hints: DesignHints) => {
    // Ensure state type is set to Intermediate
    state.stateType = 2;

    // Make auto terminal visible by default
    const autoTerminal = hints.terminals.find(t => t.id === 'auto');
    if (autoTerminal) {
      autoTerminal.visible = true;
    }
  },

  onConnect: (params: ConnectionParams): Transition | null => {
    const terminal = INTERMEDIATE_STATE_TERMINALS.find(t => t.id === params.fromTerminalId);
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

    // Check for multiple auto transitions without rules
    const autoTransitions = state.transitions?.filter(t => t.triggerType === 1) || [];
    if (autoTransitions.length > 1) {
      const transitionsWithoutRules = autoTransitions.filter(t => !t.rule || !t.rule.code);
      if (transitionsWithoutRules.length > 0) {
        problems.push({
          code: 'intermediate-state.multiple-auto-no-rules',
          message: 'Multiple automatic transitions require rules to determine which path to take',
          severity: 'error',
          location: {
            type: 'state',
            stateKey: state.key
          }
        });
      }
    }

    // Validate timer configuration for timeout transitions
    const timeoutTransitions = state.transitions?.filter(t => t.triggerType === 2) || [];
    for (const transition of timeoutTransitions) {
      if (!transition.timer || !transition.timer.duration) {
        problems.push({
          code: 'intermediate-state.timeout-missing-duration',
          message: `Timeout transition '${transition.key}' must have a duration`,
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
  },

  onDeserialize: (state: State): DesignHints | null => {
    // Detect if this is an intermediate state
    if (state.stateType !== 2) {
      return null;
    }

    // Don't deserialize if it has a specific xProfile (like ServiceTask)
    if (state.xProfile && state.xProfile !== 'Default' && state.xProfile !== 'Intermediate') {
      return null;
    }

    // Reconstruct hints from state
    const hints: DesignHints = {
      kind: 'Intermediate',
      terminals: [],
      terminalBindings: {}
    };

    // Analyze transitions to determine visible terminals
    const hasAuto = state.transitions?.some(t => t.triggerType === 1);
    const hasManual = state.transitions?.some(t => t.triggerType === 0);
    const hasTimeout = state.transitions?.some(t => t.triggerType === 2);
    const hasEvent = state.transitions?.some(t => t.triggerType === 3);

    if (hasAuto || (!hasAuto && !hasManual && !hasTimeout && !hasEvent)) {
      hints.terminals.push({
        id: 'auto',
        role: 'auto',
        visible: true
      });
    }

    if (hasManual) {
      hints.terminals.push({
        id: 'manual',
        role: 'manual',
        visible: true
      });
    }

    if (hasTimeout) {
      hints.terminals.push({
        id: 'timeout',
        role: 'timeout',
        visible: true
      });
      // Bind timeout transitions
      const timeoutTransition = state.transitions?.find(t => t.triggerType === 2);
      if (timeoutTransition) {
        hints.terminalBindings['timeout'] = timeoutTransition.key;
      }
    }

    if (hasEvent) {
      hints.terminals.push({
        id: 'event',
        role: 'event',
        visible: true
      });
    }

    return hints;
  }
};

/**
 * Intermediate State Plugin definition
 */
export const IntermediateStatePlugin: StatePlugin = {
  id: 'Intermediate',
  label: 'Intermediate State',
  description: 'Standard processing state with full feature support',
  icon: '▢',
  keyPrefix: 'state',
  defaultLabel: 'State',
  stateType: 2, // Intermediate state type
  terminals: INTERMEDIATE_STATE_TERMINALS,

  createState: (): State => {
    const stateKey = `state-${Date.now()}`;
    return {
      key: stateKey,
      stateType: 2, // Intermediate
      xProfile: 'Intermediate',
      versionStrategy: 'Minor',
      labels: [
        {
          label: 'State',
          language: 'en'
        }
      ],
      transitions: []
    };
  },

  hooks: intermediateStateHooks,

  lintRules: [],

  enabled: true,

  profiles: ['Default', 'Intermediate']
};

// Export for registration
export default IntermediateStatePlugin;