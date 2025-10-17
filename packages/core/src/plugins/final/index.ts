/**
 * Final State Plugin
 *
 * Provides specialized handling for final states (terminal states) in workflows.
 * Final states cannot have outgoing connections and support state subtypes.
 */

import type {
  StatePlugin,
  TerminalRole,
  DesignHints,
  PluginHooks,
  PluginProblem
} from '../types.js';
import type { State, StateSubType } from '../../types/index.js';

/**
 * Final state has only input terminal (no outgoing connections)
 * Note: Input terminals are handled by the node renderer, not defined here
 * since they don't create outgoing transitions. This array defines
 * terminals that can create transitions FROM this state.
 */
const FINAL_STATE_TERMINALS: TerminalRole[] = [];
// Final states have no outgoing terminals, but the node renderer
// will automatically add an input handle for incoming connections

/**
 * Get icon for state subtype
 */
function getStateSubTypeIcon(stateSubType?: StateSubType): string {
  switch (stateSubType) {
    case 1: return '✓'; // Success
    case 2: return '✗'; // Failed
    case 3: return '⊘'; // Cancelled
    default: return '';
  }
}

/**
 * Final state plugin hooks
 */
const finalStateHooks: PluginHooks = {
  onActivate: () => {
    console.log('Final State plugin activated');
  },

  onCreate: (state: State, hints: DesignHints) => {
    // Ensure state type is set to Final
    state.stateType = 3;

    // Set default subtype to Success if not specified
    if (!state.stateSubType) {
      state.stateSubType = 1; // Success
    }

    // Update visual hints based on subtype
    if (hints.visual) {
      hints.visual.badge = getStateSubTypeIcon(state.stateSubType);
    } else {
      hints.visual = {
        badge: getStateSubTypeIcon(state.stateSubType)
      };
    }
  },

  onValidate: (state: State, _hints: DesignHints): PluginProblem[] => {
    const problems: PluginProblem[] = [];

    // Final states cannot have transitions
    if (state.transitions && state.transitions.length > 0) {
      problems.push({
        code: 'final-state.has-transitions',
        message: 'Final state cannot have outgoing transitions',
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key
        },
        fix: {
          type: 'remove-transitions',
          description: 'Remove all transitions from this final state'
        }
      });
    }

    // Final state should not have subflow
    if (state.subFlow) {
      problems.push({
        code: 'final-state.has-subflow',
        message: 'Final state cannot have a subflow',
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key
        }
      });
    }

    // Validate state subtype
    if (state.stateSubType && ![1, 2, 3].includes(state.stateSubType)) {
      problems.push({
        code: 'final-state.invalid-subtype',
        message: `Invalid state subtype '${state.stateSubType}'. Must be 1 (Success), 2 (Failed), or 3 (Cancelled)`,
        severity: 'error',
        location: {
          type: 'state',
          stateKey: state.key,
          field: 'stateSubType'
        }
      });
    }

    return problems;
  },

  onSerialize: (state: State, _hints: DesignHints): State => {
    // Ensure no transitions are saved for final states
    const cleanState = { ...state };
    delete cleanState.transitions;

    return cleanState;
  },

  onDeserialize: (state: State): DesignHints | null => {
    // Detect if this is a final state
    if (state.stateType !== 3) {
      return null;
    }

    // Reconstruct hints from state
    const hints: DesignHints = {
      kind: 'Final',
      terminals: [], // No terminals for final state
      terminalBindings: {},
      visual: {
        badge: getStateSubTypeIcon(state.stateSubType)
      }
    };

    return hints;
  }
};

/**
 * Lint rules specific to final states
 */
const finalStateLintRules = [
  {
    id: 'final-state-workflow-completion',
    description: 'Check that final states properly complete the workflow',
    severity: 'warning' as const,
    validate: (state: State, hints: DesignHints, workflow: any): PluginProblem[] => {
      const problems: PluginProblem[] = [];

      // Check if there's at least one path to this final state
      if (workflow && workflow.attributes && workflow.attributes.states) {
        const hasIncomingTransition = workflow.attributes.states.some((s: State) =>
          s.transitions?.some(t => t.target === state.key)
        );

        if (!hasIncomingTransition && state.key !== workflow.attributes.startTransition?.target) {
          problems.push({
            code: 'final-state.unreachable',
            message: 'This final state is not reachable from any other state',
            severity: 'warning',
            location: {
              type: 'state',
              stateKey: state.key
            }
          });
        }
      }

      return problems;
    }
  }
];

/**
 * Final State Plugin definition
 */
export const FinalStatePlugin: StatePlugin = {
  id: 'Final',
  label: 'Final State',
  description: 'Terminal state that ends workflow execution',
  icon: '◉',
  keyPrefix: 'final',
  defaultLabel: 'End',
  stateType: 3, // Final state type
  terminals: FINAL_STATE_TERMINALS,

  createState: (): State => {
    const stateKey = `final-${Date.now()}`;
    return {
      key: stateKey,
      stateType: 3, // Final
      stateSubType: 1, // Default to Success
      xProfile: 'Final',
      versionStrategy: 'Minor',
      labels: [
        {
          label: 'End',
          language: 'en'
        }
      ]
      // No transitions for final state
    };
  },

  hooks: finalStateHooks,

  lintRules: finalStateLintRules,

  enabled: true,

  profiles: ['Default', 'Final']
};

// Export for registration
export default FinalStatePlugin;