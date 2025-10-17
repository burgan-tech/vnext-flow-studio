/**
 * Core type definitions for the Editor Plugin Mechanism
 */

import type {
  State,
  Transition,
  TriggerType,
  ExecutionTask,
  ViewRef,
  Label
} from '../types/index.js';

/**
 * Validation result for plugin operations
 */
export interface PluginValidationResult {
  valid: boolean;
  problems: PluginProblem[];
}

/**
 * Extended problem type for plugins with additional metadata
 */
export interface PluginProblem {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  location: {
    type: 'state' | 'transition';
    stateKey: string;
    transitionKey?: string;
    field?: string;
  };
  fix?: {
    type: string;
    description: string;
  };
}

/**
 * Terminal role defines the connection point type and its transition constraints
 */
export interface TerminalRole {
  /** Unique identifier for this terminal role */
  id: string;

  /** Display label for the terminal */
  label: string;

  /** Icon or symbol to display */
  icon?: string;

  /** Position on the node (right, bottom, left, top) */
  position?: 'right' | 'bottom' | 'left' | 'top';

  /** Whether this terminal is required */
  required?: boolean;

  /** Maximum number of connections allowed (default: 1) */
  maxConnections?: number;

  /** Transition subset configuration */
  transitionSubset: TransitionSubset;
}

/**
 * Defines the subset of allowed transitions for a terminal
 */
export interface TransitionSubset {
  /** Default trigger type for new connections */
  defaultTriggerType: TriggerType;

  /** Allowed trigger types */
  allowedTriggerTypes?: TriggerType[];

  /** Required fields for this transition type */
  requiredFields?: Array<keyof Transition>;

  /** Optional fields that can be configured */
  optionalFields?: Array<keyof Transition>;

  /** Fields that must NOT be set */
  disallowedFields?: Array<keyof Transition>;

  /** Default values for transition fields */
  defaults?: Partial<Transition>;

  /** Validation rules specific to this subset */
  validate?: (transition: Transition) => PluginValidationResult;
}

/**
 * Variant represents a preset configuration for a specialized state
 */
export interface StateVariant {
  /** Unique identifier */
  id: string;

  /** Display name */
  label: string;

  /** Optional description */
  description?: string;

  /** Icon or symbol */
  icon?: string;

  /** Category for grouping in palette */
  category?: string;

  /** Pre-configured state template */
  stateTemplate: Partial<State>;

  /** Pre-configured mapping */
  defaultMapping?: Record<string, any>;

  /** Metadata for the variant */
  metadata?: Record<string, any>;
}

/**
 * Design hints store editor-only information for enhanced UX
 */
export interface DesignHints {
  /** Plugin kind identifier (e.g., "ServiceTask", "HumanTask") */
  kind: string;

  /** Terminal configurations */
  terminals: TerminalConfig[];

  /** Variant ID if created from a variant */
  variantId?: string;

  /** Terminal to transition bindings */
  terminalBindings: Record<string, string>;

  /** Additional plugin-specific hints */
  pluginData?: Record<string, any>;

  /** Visual customizations */
  visual?: {
    color?: string;
    icon?: string;
    badge?: string;
  };
}

/**
 * Terminal configuration in design hints
 */
export interface TerminalConfig {
  /** Terminal ID matching TerminalRole.id */
  id: string;

  /** Role reference */
  role: string;

  /** Whether terminal is visible */
  visible: boolean;

  /** Terminal position override */
  position?: { x: number; y: number };

  /** Custom styling */
  style?: Record<string, any>;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  /** Called when plugin is activated */
  onActivate?: () => void;

  /** Called when plugin is deactivated */
  onDeactivate?: () => void;

  /** Called when a state is created from this plugin */
  onCreate?: (state: State, hints: DesignHints) => void;

  /** Called when a terminal is connected */
  onConnect?: (params: ConnectionParams) => Transition | null;

  /** Called when a terminal is disconnected */
  onDisconnect?: (params: DisconnectionParams) => void;

  /** Called to validate state configuration */
  onValidate?: (state: State, hints: DesignHints) => PluginProblem[];

  /** Called when state is being serialized */
  onSerialize?: (state: State, hints: DesignHints) => State;

  /** Called when state is being deserialized */
  onDeserialize?: (state: State) => DesignHints | null;
}

/**
 * Parameters for terminal connection
 */
export interface ConnectionParams {
  fromState: State;
  fromTerminalId: string;
  toState: State;
  role: string;
}

/**
 * Parameters for terminal disconnection
 */
export interface DisconnectionParams {
  fromState: State;
  fromTerminalId: string;
  transitionKey: string;
}

/**
 * Variant provider discovers presets from project
 */
export interface VariantProvider {
  /** Provider identifier */
  id: string;

  /** Discover variants from project/registries */
  discoverVariants(): Promise<StateVariant[]>;

  /** Watch for variant changes */
  watchVariants?(callback: (variants: StateVariant[]) => void): () => void;

  /** Get variant by ID */
  getVariant(id: string): Promise<StateVariant | null>;
}

/**
 * Property panel configuration
 */
export interface PropertyPanelConfig {
  /** Panel identifier */
  id: string;

  /** Panel title */
  title: string;

  /** React component for state editing */
  stateComponent?: React.ComponentType<StatePanelProps>;

  /** React component for transition editing */
  transitionComponent?: React.ComponentType<TransitionPanelProps>;
}

/**
 * Props for state property panel
 */
export interface StatePanelProps {
  state: State;
  hints: DesignHints;
  onChange: (state: State, hints: DesignHints) => void;
  registries: Record<string, any[]>;
}

/**
 * Props for transition property panel
 */
export interface TransitionPanelProps {
  transition: Transition;
  fromState: State;
  terminal: TerminalRole;
  onChange: (transition: Transition) => void;
}

/**
 * Complete plugin definition
 */
export interface StatePlugin {
  /** Unique plugin identifier */
  id: string;

  /** Display name */
  label: string;

  /** Description for palette/docs */
  description: string;

  /** Icon for palette */
  icon?: string;

  /** Key prefix for generated states */
  keyPrefix: string;

  /** Default label for new states */
  defaultLabel: string;

  /** The state type this plugin creates (1=initial, 2=intermediate, 3=final, 4=subflow) */
  stateType?: number;

  /** Terminal role definitions */
  terminals: TerminalRole[];

  /** Create canonical state from template */
  createState(): State;

  /** Variant provider */
  variantProvider?: VariantProvider;

  /** Property panel configuration */
  propertyPanels?: PropertyPanelConfig;

  /** Plugin lifecycle hooks */
  hooks?: PluginHooks;

  /** Linting rules specific to this plugin */
  lintRules?: LintRule[];

  /** Whether this plugin is enabled by default */
  enabled?: boolean;

  /** Required xProfile values for activation */
  profiles?: string[];
}

/**
 * Lint rule for plugin-specific validation
 */
export interface LintRule {
  /** Rule identifier */
  id: string;

  /** Rule description */
  description: string;

  /** Severity level */
  severity: 'error' | 'warning' | 'info';

  /** Validation function */
  validate: (state: State, hints: DesignHints, workflow: any) => PluginProblem[];
}

/**
 * Plugin registration entry
 */
export interface PluginRegistration {
  plugin: StatePlugin;
  priority?: number;
  activated: boolean;
}

/**
 * Plugin manager interface
 */
export interface IPluginManager {
  /** Register a plugin */
  register(plugin: StatePlugin): void;

  /** Get all registered plugins */
  getPlugins(): StatePlugin[];

  /** Get plugin by ID */
  getPlugin(id: string): StatePlugin | undefined;

  /** Get plugins for profile */
  getPluginsForProfile(profile: string): StatePlugin[];

  /** Activate plugin */
  activate(pluginId: string): void;

  /** Deactivate plugin */
  deactivate(pluginId: string): void;

  /** Check if plugin is active */
  isActive(pluginId: string): boolean;
}

/**
 * Extended workflow attributes with xProfile
 */
export interface WorkflowAttributesWithProfile {
  xProfile?: 'Default' | 'ServiceTask' | 'HumanTask' | string;
  // ... rest of the attributes
}