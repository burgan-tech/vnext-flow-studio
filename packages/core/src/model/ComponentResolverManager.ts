/**
 * Lifecycle manager for ComponentResolver instances
 * Provides centralized management of resolver instances with proper cleanup
 */

import type { ComponentResolver } from './ComponentResolver.js';
import type { ComponentResolverOptions } from './ComponentResolver.js';
import type { ComponentType } from './ComponentResolver.js';

/**
 * Lifecycle event callbacks for resolver management
 */
export interface ComponentResolverLifecycle {
  /**
   * Called when a component cache is invalidated
   * @param type - The component type that was invalidated
   */
  onCacheInvalidated?: (type: ComponentType) => void;

  /**
   * Called when a resolver encounters an error
   * @param error - The error that occurred
   */
  onError?: (error: Error) => void;

  /**
   * Called when a resolver is being disposed
   */
  onDispose?: () => void;
}

/**
 * Options for creating a global resolver
 */
export interface GlobalResolverOptions extends ComponentResolverOptions {
  /**
   * Unique identifier for this resolver (typically workspace path)
   * Used to manage multiple workspace resolvers
   */
  workspaceId: string;

  /**
   * Lifecycle callbacks
   */
  lifecycle?: ComponentResolverLifecycle;

  /**
   * Whether to enable file watching for this resolver
   * @default false
   */
  enableWatching?: boolean;
}

/**
 * Manages ComponentResolver lifecycle and provides factory methods
 *
 * @example
 * ```typescript
 * // In VS Code extension activation
 * const manager = ComponentResolverManager.getInstance();
 *
 * const resolver = await manager.getOrCreateGlobalResolver({
 *   workspaceId: workspacePath,
 *   basePath: workspacePath,
 *   enableWatching: true,
 *   lifecycle: {
 *     onError: (error) => console.error('Resolver error:', error)
 *   }
 * });
 *
 * // In extension deactivation
 * await manager.dispose();
 * ```
 */
export class ComponentResolverManager {
  private static instance?: ComponentResolverManager;
  private static instanceId = Math.random().toString(36).substring(7);

  /**
   * Map of workspace ID to global resolver instance
   */
  private globalResolvers: Map<string, ComponentResolver> = new Map();
  private instanceId: string;

  /**
   * Map of workspace ID to lifecycle callbacks
   */
  private lifecycleCallbacks: Map<string, ComponentResolverLifecycle> = new Map();

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.instanceId = ComponentResolverManager.instanceId;
    console.log('[ComponentResolverManager] NEW INSTANCE CREATED with ID:', this.instanceId);
  }

  /**
   * Get the singleton instance of ComponentResolverManager
   */
  static getInstance(): ComponentResolverManager {
    if (!this.instance) {
      console.log('[ComponentResolverManager] Creating singleton instance');
      this.instance = new ComponentResolverManager();
    }
    console.log('[ComponentResolverManager] getInstance() returning instance with ID:', this.instance.instanceId);
    return this.instance;
  }

  /**
   * Get or create a global shared resolver for a workspace
   *
   * Global resolvers are long-lived, cached, and can have file watching enabled.
   * They should be used for workspace-wide component resolution.
   *
   * @param options - Configuration for the global resolver
   * @returns The global resolver instance for this workspace
   */
  async getOrCreateGlobalResolver(options: GlobalResolverOptions): Promise<ComponentResolver> {
    const { workspaceId, lifecycle, enableWatching, ...resolverOptions } = options;

    console.log('[ComponentResolverManager] getOrCreateGlobalResolver called with workspaceId:', workspaceId, 'Instance ID:', this.instanceId);
    console.log('[ComponentResolverManager] Current resolvers in map:', Array.from(this.globalResolvers.keys()));

    // Return existing resolver if already created
    if (this.globalResolvers.has(workspaceId)) {
      console.log('[ComponentResolverManager] Returning existing resolver for workspaceId:', workspaceId);
      return this.globalResolvers.get(workspaceId)!;
    }

    console.log('[ComponentResolverManager] Creating new resolver for workspaceId:', workspaceId);

    // Dynamically import to avoid circular dependencies
    const { ComponentResolver } = await import('./ComponentResolver.js');

    // Create new global resolver
    const resolver = new ComponentResolver(resolverOptions);

    // Store lifecycle callbacks
    if (lifecycle) {
      this.lifecycleCallbacks.set(workspaceId, lifecycle);
    }

    // Enable file watching if requested
    if (enableWatching) {
      try {
        await resolver.enableFileWatching({
          basePath: resolverOptions.basePath,
          logger: {
            debug: (msg: string) => console.debug(`[ComponentResolver:${workspaceId}] ${msg}`),
            info: (msg: string) => console.log(`[ComponentResolver:${workspaceId}] ${msg}`),
            warn: (msg: string) => console.warn(`[ComponentResolver:${workspaceId}] ${msg}`),
            error: (msg: string) => console.error(`[ComponentResolver:${workspaceId}] ${msg}`)
          }
        });

        // Set up event handlers for lifecycle callbacks
        if (lifecycle) {
          const watcher = resolver['watcher'];
          if (watcher) {
            watcher.on('error', (error: Error) => {
              lifecycle.onError?.(error);
            });

            // Hook into cache invalidation events
            watcher.on('componentChanged', (event: any) => {
              lifecycle.onCacheInvalidated?.(event.type as ComponentType);
            });
          }
        }
      } catch (error) {
        lifecycle?.onError?.(error as Error);
        throw error;
      }
    }

    // Store the resolver
    this.globalResolvers.set(workspaceId, resolver);
    console.log('[ComponentResolverManager] Stored resolver for workspaceId:', workspaceId);
    console.log('[ComponentResolverManager] Map now contains:', Array.from(this.globalResolvers.keys()));

    return resolver;
  }

  /**
   * Get an existing global resolver for a workspace
   *
   * @param workspaceId - Workspace identifier
   * @returns The resolver if it exists, undefined otherwise
   */
  getGlobalResolver(workspaceId: string): ComponentResolver | undefined {
    console.log('[ComponentResolverManager] getGlobalResolver called with workspaceId:', workspaceId, 'Instance ID:', this.instanceId);
    console.log('[ComponentResolverManager] Map contains:', Array.from(this.globalResolvers.keys()));
    const resolver = this.globalResolvers.get(workspaceId);
    console.log('[ComponentResolverManager] Found resolver:', !!resolver);
    return resolver;
  }

  /**
   * Create an isolated resolver for specific contexts
   *
   * Isolated resolvers are short-lived and don't have file watching.
   * Use for temporary operations, testing, or different base paths.
   *
   * @param options - Configuration for the isolated resolver
   * @returns A new isolated resolver instance
   *
   * @example
   * ```typescript
   * // For fallback schema loading in mapper
   * const resolver = manager.createIsolatedResolver({
   *   basePath: workspacePath
   * });
   * await resolver.preloadSchemas();
   * ```
   */
  async createIsolatedResolver(options: ComponentResolverOptions): Promise<ComponentResolver> {
    // Dynamically import to avoid circular dependencies
    const { ComponentResolver } = await import('./ComponentResolver.js');
    return new ComponentResolver(options);
  }

  /**
   * Dispose a specific global resolver
   *
   * @param workspaceId - Workspace identifier
   */
  async disposeGlobalResolver(workspaceId: string): Promise<void> {
    const resolver = this.globalResolvers.get(workspaceId);
    if (!resolver) {
      return;
    }

    // Call lifecycle callback
    const lifecycle = this.lifecycleCallbacks.get(workspaceId);
    lifecycle?.onDispose?.();

    // Disable file watching
    await resolver.disableFileWatching();

    // Clear caches
    resolver.clearCache();

    // Remove from maps
    this.globalResolvers.delete(workspaceId);
    this.lifecycleCallbacks.delete(workspaceId);
  }

  /**
   * Dispose all global resolvers
   * Should be called during extension deactivation
   */
  async dispose(): Promise<void> {
    const workspaceIds = Array.from(this.globalResolvers.keys());

    // Dispose all resolvers in parallel
    await Promise.all(
      workspaceIds.map(workspaceId => this.disposeGlobalResolver(workspaceId))
    );
  }

  /**
   * Get statistics about managed resolvers
   */
  getStats(): {
    globalResolverCount: number;
    workspaceIds: string[];
  } {
    return {
      globalResolverCount: this.globalResolvers.size,
      workspaceIds: Array.from(this.globalResolvers.keys())
    };
  }

  /**
   * Reset the singleton instance (primarily for testing)
   * @internal
   */
  static reset(): void {
    if (this.instance) {
      // Don't await - this is for testing cleanup
      this.instance.dispose().catch(() => {});
      this.instance = undefined;
    }
  }
}
