/**
 * Plugin Manager for Editor Plugin Mechanism
 *
 * Manages registration, activation, and lifecycle of specialized state plugins.
 */

import type {
  StatePlugin,
  PluginRegistration,
  IPluginManager,
  StateVariant,
  DesignHints,
  ConnectionParams,
  DisconnectionParams,
  PluginProblem
} from './types.js';
import type { State, Transition, Workflow } from '../types/index.js';
import { DesignHintsManager } from './designHints.js';

/**
 * Singleton plugin manager
 */
export class PluginManager implements IPluginManager {
  private static instance: PluginManager;
  private plugins: Map<string, PluginRegistration> = new Map();
  private variantCache: Map<string, StateVariant[]> = new Map();
  private activeProfile: string = 'Default';
  private hintsManager: DesignHintsManager;

  private constructor() {
    this.hintsManager = new DesignHintsManager();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  /**
   * Register a plugin
   */
  register(plugin: StatePlugin, priority: number = 0): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin '${plugin.id}' is already registered`);
      return;
    }

    const registration: PluginRegistration = {
      plugin,
      priority,
      activated: false
    };

    this.plugins.set(plugin.id, registration);

    // Auto-activate if enabled by default or matches current profile
    if (plugin.enabled || this.shouldActivateForProfile(plugin)) {
      this.activate(plugin.id);
    }
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): void {
    const registration = this.plugins.get(pluginId);
    if (registration) {
      if (registration.activated) {
        this.deactivate(pluginId);
      }
      this.plugins.delete(pluginId);
    }
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): StatePlugin[] {
    return Array.from(this.plugins.values())
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .map(reg => reg.plugin);
  }

  /**
   * Get plugin by ID
   */
  getPlugin(id: string): StatePlugin | undefined {
    return this.plugins.get(id)?.plugin;
  }

  /**
   * Check if a plugin is registered
   */
  isRegistered(id: string): boolean {
    return this.plugins.has(id);
  }

  /**
   * Get active plugins
   */
  getActivePlugins(): StatePlugin[] {
    return Array.from(this.plugins.values())
      .filter(reg => reg.activated)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .map(reg => reg.plugin);
  }

  /**
   * Get plugins for profile
   */
  getPluginsForProfile(profile: string): StatePlugin[] {
    return this.getPlugins().filter(plugin =>
      !plugin.profiles || plugin.profiles.includes(profile)
    );
  }

  /**
   * Activate a plugin
   */
  activate(pluginId: string): void {
    const registration = this.plugins.get(pluginId);
    if (!registration) {
      console.error(`Plugin '${pluginId}' not found`);
      return;
    }

    if (registration.activated) {
      return;
    }

    registration.activated = true;

    // Call activation hook
    if (registration.plugin.hooks?.onActivate) {
      registration.plugin.hooks.onActivate();
    }

    // Start watching for variants
    if (registration.plugin.variantProvider) {
      this.refreshVariants(pluginId);
    }

    console.log(`Plugin '${pluginId}' activated`);
  }

  /**
   * Deactivate a plugin
   */
  deactivate(pluginId: string): void {
    const registration = this.plugins.get(pluginId);
    if (!registration) {
      return;
    }

    if (!registration.activated) {
      return;
    }

    registration.activated = false;

    // Call deactivation hook
    if (registration.plugin.hooks?.onDeactivate) {
      registration.plugin.hooks.onDeactivate();
    }

    // Clear variant cache
    this.variantCache.delete(pluginId);

    console.log(`Plugin '${pluginId}' deactivated`);
  }

  /**
   * Check if plugin is active
   */
  isActive(pluginId: string): boolean {
    return this.plugins.get(pluginId)?.activated || false;
  }

  /**
   * Set active profile
   */
  setActiveProfile(profile: string): void {
    this.activeProfile = profile;

    // Re-evaluate plugin activations
    this.plugins.forEach((registration, pluginId) => {
      if (this.shouldActivateForProfile(registration.plugin)) {
        if (!registration.activated) {
          this.activate(pluginId);
        }
      } else {
        if (registration.activated && !registration.plugin.enabled) {
          this.deactivate(pluginId);
        }
      }
    });
  }

  /**
   * Get active profile
   */
  getActiveProfile(): string {
    return this.activeProfile;
  }

  /**
   * Check if plugin should be activated for current profile
   */
  private shouldActivateForProfile(plugin: StatePlugin): boolean {
    if (!plugin.profiles || plugin.profiles.length === 0) {
      return true; // No profile restrictions
    }
    return plugin.profiles.includes(this.activeProfile);
  }

  /**
   * Refresh variants for a plugin
   */
  async refreshVariants(pluginId: string, registries?: any): Promise<void> {
    const registration = this.plugins.get(pluginId);
    if (!registration || !registration.plugin.variantProvider) {
      return;
    }

    try {
      // Pass registries to variant provider if it has a setRegistries method
      if (registries && 'setRegistries' in registration.plugin.variantProvider) {
        (registration.plugin.variantProvider as any).setRegistries(registries);
      }
      const variants = await registration.plugin.variantProvider.discoverVariants();
      this.variantCache.set(pluginId, variants);
    } catch (error) {
      console.error(`Failed to refresh variants for plugin '${pluginId}':`, error);
    }
  }

  /**
   * Get variants for a plugin
   */
  getVariants(pluginId: string): StateVariant[] {
    return this.variantCache.get(pluginId) || [];
  }

  /**
   * Get all variants across all active plugins
   */
  getAllVariants(): Map<string, StateVariant[]> {
    const result = new Map<string, StateVariant[]>();
    this.getActivePlugins().forEach(plugin => {
      const variants = this.getVariants(plugin.id);
      if (variants.length > 0) {
        result.set(plugin.id, variants);
      }
    });
    return result;
  }

  /**
   * Create state from plugin
   */
  createState(pluginId: string, variantId?: string): { state: State; hints: DesignHints } | null {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) {
      console.error(`Plugin '${pluginId}' not found`);
      return null;
    }

    let state = plugin.createState();
    let hints: DesignHints;

    // Apply variant if specified
    if (variantId) {
      const variant = this.variantCache.get(pluginId)?.find(v => v.id === variantId);
      if (variant) {
        state = {
          ...state,
          ...variant.stateTemplate
        };
        hints = this.createHintsForState(plugin, variantId);
      } else {
        hints = this.createHintsForState(plugin);
      }
    } else {
      hints = this.createHintsForState(plugin);
    }

    // Call onCreate hook
    if (plugin.hooks?.onCreate) {
      plugin.hooks.onCreate(state, hints);
    }

    return { state, hints };
  }

  /**
   * Create hints for a state
   */
  private createHintsForState(plugin: StatePlugin, variantId?: string): DesignHints {
    const terminals = plugin.terminals.map(terminal => ({
      id: terminal.id,
      role: terminal.id,
      visible: terminal.required || false,
      position: terminal.position ? { x: 0, y: 0 } : undefined
    }));

    return {
      kind: plugin.id,
      terminals,
      terminalBindings: {},
      variantId
    };
  }

  /**
   * Handle terminal connection
   */
  handleConnection(params: ConnectionParams): Transition | null {
    const hints = this.hintsManager.getStateHints(params.fromState.key);
    if (!hints) {
      return null;
    }

    const plugin = this.getPlugin(hints.kind);
    if (!plugin || !plugin.hooks?.onConnect) {
      return null;
    }

    return plugin.hooks.onConnect(params);
  }

  /**
   * Handle terminal disconnection
   */
  handleDisconnection(params: DisconnectionParams): void {
    const hints = this.hintsManager.getStateHints(params.fromState.key);
    if (!hints) {
      return;
    }

    const plugin = this.getPlugin(hints.kind);
    if (plugin?.hooks?.onDisconnect) {
      plugin.hooks.onDisconnect(params);
    }

    // Update terminal bindings
    this.hintsManager.updateTerminalBinding(
      params.fromState.key,
      params.fromTerminalId,
      null
    );
  }

  /**
   * Validate state with plugin rules
   */
  validateState(state: State, workflow: Workflow): PluginProblem[] {
    const problems: PluginProblem[] = [];
    const hints = this.hintsManager.getStateHints(state.key);

    if (!hints) {
      return problems;
    }

    const plugin = this.getPlugin(hints.kind);
    if (!plugin) {
      return problems;
    }

    // Run plugin validation hook
    if (plugin.hooks?.onValidate) {
      problems.push(...plugin.hooks.onValidate(state, hints));
    }

    // Run plugin lint rules
    if (plugin.lintRules) {
      plugin.lintRules.forEach(rule => {
        const ruleProblems = rule.validate(state, hints, workflow);
        problems.push(...ruleProblems);
      });
    }

    return problems;
  }

  /**
   * Get hints manager
   */
  getHintsManager(): DesignHintsManager {
    return this.hintsManager;
  }

  /**
   * Set hints manager
   */
  setHintsManager(manager: DesignHintsManager): void {
    this.hintsManager = manager;
  }

  /**
   * Detect plugin for existing state
   */
  detectPlugin(state: State): StatePlugin | null {
    // Check xProfile first
    if (state.xProfile) {
      const plugin = this.getPlugin(state.xProfile);
      if (plugin) {
        return plugin;
      }
    }

    // Try each plugin's detection logic
    for (const plugin of this.getActivePlugins()) {
      if (plugin.hooks?.onDeserialize) {
        const hints = plugin.hooks.onDeserialize(state);
        if (hints && hints.kind === plugin.id) {
          return plugin;
        }
      }
    }

    // Fallback: check for service task pattern
    const hasServiceTask = state.onEntries?.some(entry => entry.task);
    const hasView = !!state.view;
    const hasSubflow = !!state.subFlow;

    if (hasServiceTask && !hasView && !hasSubflow) {
      return this.getPlugin('ServiceTask') || null;
    }

    // Final fallback based on state type for backward compatibility
    if (!state.xProfile) {
      switch (state.stateType) {
        case 1: return this.getPlugin('Initial') || null;
        case 3: return this.getPlugin('Final') || null;
        case 4: return this.getPlugin('SubFlow') || null;
        case 2:
        default:
          return this.getPlugin('Intermediate') || null;
      }
    }

    return null;
  }

  /**
   * Reset the plugin manager
   */
  reset(): void {
    // Deactivate all plugins
    this.plugins.forEach((reg, id) => {
      if (reg.activated) {
        this.deactivate(id);
      }
    });

    // Clear all data
    this.plugins.clear();
    this.variantCache.clear();
    this.hintsManager = new DesignHintsManager();
    this.activeProfile = 'Default';
  }
}

// Export singleton instance
export const pluginManager = PluginManager.getInstance();