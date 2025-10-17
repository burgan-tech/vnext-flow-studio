/**
 * Design Hints Storage and Serialization
 *
 * This module manages editor-only design hints that enhance the UX
 * but are not part of the engine's canonical model.
 */

import type { State, Workflow, Diagram } from '../types/index.js';
import type { DesignHints, TerminalConfig, StatePlugin } from './types.js';

/**
 * Storage structure for all design hints in a workflow
 */
export interface WorkflowDesignHints {
  /** Version for migration support */
  version: string;

  /** State-specific hints keyed by state.key */
  states: Record<string, DesignHints>;

  /** Global workflow hints */
  workflow?: {
    defaultProfile?: string;
    paletteLayout?: 'compact' | 'expanded';
    [key: string]: any;
  };
}

/**
 * Extended diagram type that includes design hints
 */
export interface DiagramWithHints extends Diagram {
  /** Design hints stored separately from layout */
  _designHints?: WorkflowDesignHints;
}

/**
 * Design hints manager
 */
export class DesignHintsManager {
  private hints: WorkflowDesignHints;
  private isDirty: boolean = false;

  constructor(hints?: WorkflowDesignHints) {
    this.hints = hints || this.createDefaultHints();
  }

  /**
   * Create default hints structure
   */
  private createDefaultHints(): WorkflowDesignHints {
    return {
      version: '1.0.0',
      states: {},
      workflow: {}
    };
  }

  /**
   * Get hints for a specific state
   */
  getStateHints(stateKey: string): DesignHints | undefined {
    return this.hints.states[stateKey];
  }

  /**
   * Set hints for a specific state
   */
  setStateHints(stateKey: string, hints: DesignHints): void {
    this.hints.states[stateKey] = hints;
    this.isDirty = true;
  }

  /**
   * Remove hints for a specific state
   */
  removeStateHints(stateKey: string): void {
    delete this.hints.states[stateKey];
    this.isDirty = true;
  }

  /**
   * Update terminal binding for a state
   */
  updateTerminalBinding(
    stateKey: string,
    terminalId: string,
    transitionKey: string | null
  ): void {
    const hints = this.hints.states[stateKey];
    if (!hints) return;

    if (transitionKey === null) {
      delete hints.terminalBindings[terminalId];
    } else {
      hints.terminalBindings[terminalId] = transitionKey;
    }
    this.isDirty = true;
  }

  /**
   * Get terminal binding for a state
   */
  getTerminalBinding(stateKey: string, terminalId: string): string | undefined {
    const hints = this.hints.states[stateKey];
    return hints?.terminalBindings[terminalId];
  }

  /**
   * Get all terminal bindings for a state
   */
  getTerminalBindings(stateKey: string): Record<string, string> {
    const hints = this.hints.states[stateKey];
    return hints?.terminalBindings || {};
  }

  /**
   * Infer design hints from an existing state
   * @deprecated This method should not be used as it relies on heuristics that can misidentify states
   */
  inferHintsFromState(state: State, _plugin?: StatePlugin): DesignHints | null {
    // Note: This method is deprecated and should not be used
    // Plugin detection should only rely on explicit xProfile attributes
    // not on heuristics based on state content

    // No plugin pattern detected
    return null;
  }

  /**
   * Serialize hints for storage
   */
  serialize(): string {
    return JSON.stringify(this.hints, null, 2);
  }

  /**
   * Deserialize hints from storage
   */
  static deserialize(data: string): DesignHintsManager {
    try {
      const hints = JSON.parse(data) as WorkflowDesignHints;
      return new DesignHintsManager(hints);
    } catch (error) {
      console.error('Failed to deserialize design hints:', error);
      return new DesignHintsManager();
    }
  }

  /**
   * Get all hints
   */
  getAllHints(): WorkflowDesignHints {
    return this.hints;
  }

  /**
   * Set all hints
   */
  setAllHints(hints: WorkflowDesignHints): void {
    this.hints = hints;
    this.isDirty = true;
  }

  /**
   * Check if hints have been modified
   */
  hasChanges(): boolean {
    return this.isDirty;
  }

  /**
   * Reset dirty flag
   */
  markClean(): void {
    this.isDirty = false;
  }

  /**
   * Clone the hints manager
   */
  clone(): DesignHintsManager {
    return new DesignHintsManager(JSON.parse(JSON.stringify(this.hints)));
  }

  /**
   * Merge hints from another manager
   */
  merge(other: DesignHintsManager): void {
    const otherHints = other.getAllHints();

    // Merge state hints
    Object.entries(otherHints.states).forEach(([key, hints]) => {
      this.hints.states[key] = hints;
    });

    // Merge workflow hints
    if (otherHints.workflow) {
      this.hints.workflow = {
        ...this.hints.workflow,
        ...otherHints.workflow
      };
    }

    this.isDirty = true;
  }

  /**
   * Validate hints against a plugin
   */
  validateHints(stateKey: string, plugin: StatePlugin): string[] {
    const errors: string[] = [];
    const hints = this.hints.states[stateKey];

    if (!hints) {
      return errors;
    }

    // Validate plugin kind matches
    if (hints.kind !== plugin.id) {
      errors.push(`Hints kind '${hints.kind}' doesn't match plugin '${plugin.id}'`);
    }

    // Validate terminals exist in plugin
    hints.terminals.forEach(terminal => {
      const pluginTerminal = plugin.terminals.find(t => t.id === terminal.id);
      if (!pluginTerminal) {
        errors.push(`Terminal '${terminal.id}' not found in plugin`);
      }
    });

    // Validate required terminals are present
    plugin.terminals
      .filter(t => t.required)
      .forEach(terminal => {
        const hintTerminal = hints.terminals.find(t => t.id === terminal.id);
        if (!hintTerminal || !hintTerminal.visible) {
          errors.push(`Required terminal '${terminal.id}' is not visible`);
        }
      });

    return errors;
  }

  /**
   * Clean up orphaned hints (states that no longer exist)
   */
  cleanup(workflow: Workflow): void {
    const stateKeys = new Set(workflow.attributes.states.map(s => s.key));

    Object.keys(this.hints.states).forEach(key => {
      if (!stateKeys.has(key)) {
        delete this.hints.states[key];
        this.isDirty = true;
      }
    });
  }
}

/**
 * Helper to extract hints from a diagram
 */
export function extractHints(diagram: DiagramWithHints): WorkflowDesignHints | undefined {
  return diagram._designHints;
}

/**
 * Helper to embed hints in a diagram
 */
export function embedHints(diagram: Diagram, hints: WorkflowDesignHints): DiagramWithHints {
  return {
    ...diagram,
    _designHints: hints
  };
}

/**
 * Helper to strip hints from a diagram (for engine payload)
 */
export function stripHints(diagram: DiagramWithHints): Diagram {
  const { _designHints, ...cleanDiagram } = diagram;
  return cleanDiagram;
}

/**
 * Create hints for a new specialized state
 */
export function createStateHints(
  plugin: StatePlugin,
  variantId?: string
): DesignHints {
  // Create default terminal configurations
  const terminals: TerminalConfig[] = plugin.terminals.map(terminal => ({
    id: terminal.id,
    role: terminal.id,
    visible: !terminal.required ? false : true,
    position: terminal.position ? { x: 0, y: 0 } : undefined
  }));

  return {
    kind: plugin.id,
    terminals,
    terminalBindings: {},
    variantId,
    pluginData: {}
  };
}

/**
 * Update terminal visibility
 */
export function updateTerminalVisibility(
  hints: DesignHints,
  terminalId: string,
  visible: boolean
): DesignHints {
  const terminal = hints.terminals.find(t => t.id === terminalId);
  if (terminal) {
    terminal.visible = visible;
  }
  return hints;
}

/**
 * Check if a state has plugin hints
 */
export function hasPluginHints(hints?: DesignHints): boolean {
  return !!hints && !!hints.kind && hints.terminals.length > 0;
}