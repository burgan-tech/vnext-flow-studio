/**
 * Component file watcher for real-time updates
 * Monitors component directories and updates ComponentResolver cache automatically
 */

import * as chokidar from 'chokidar';
import * as path from 'path';
import { EventEmitter } from 'events';
import type { ComponentResolver } from './ComponentResolver.js';
import type { ILogger } from './Logger.js';
import { createLogger } from './Logger.js';

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  componentType: 'task' | 'schema' | 'view' | 'function' | 'extension' | 'workflow';
  component?: any;
}

export interface ComponentWatcherOptions {
  /** Base path to watch */
  basePath: string;
  /** Component directories to watch */
  watchPaths?: string[];
  /** Debounce time in milliseconds */
  debounceMs?: number;
  /** Whether to watch recursively */
  recursive?: boolean;
  /** Ignored patterns */
  ignored?: string[];
  /** Logger instance (optional) */
  logger?: ILogger;
}

export interface WatcherStats {
  isWatching: boolean;
  basePath: string;
  watchedPaths: string[];
  pendingDebounces: number;
  eventsReceived: number;
  eventsProcessed: number;
  errorsCount: number;
  lastEventTime: number;
}

/**
 * Watches component directories for file changes and updates ComponentResolver cache
 */
export class ComponentWatcher extends EventEmitter {
  private watcher?: chokidar.FSWatcher;
  private resolver: ComponentResolver;
  private options: Required<ComponentWatcherOptions>;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private isWatching = false;
  private logger: ILogger;

  // Statistics
  private stats = {
    eventsReceived: 0,
    eventsProcessed: 0,
    errorsCount: 0,
    lastEventTime: 0
  };

  constructor(resolver: ComponentResolver, options: ComponentWatcherOptions) {
    super();
    this.resolver = resolver;
    this.logger = options.logger || createLogger('ComponentWatcher', 'info');

    this.options = {
      watchPaths: [
        'Tasks', 'tasks', 'sys-tasks',
        'Schemas', 'schemas', 'sys-schemas',
        'Views', 'views', 'sys-views',
        'Functions', 'functions', 'sys-functions',
        'Extensions', 'extensions', 'sys-extensions',
        'Workflows', 'workflows', 'flows', 'sys-flows'
      ],
      debounceMs: 300,
      recursive: true,
      ignored: ['**/node_modules/**', '**/.git/**', '**/*.diagram.json', '**/.*'],
      logger: this.logger,
      ...options
    };
  }

  /**
   * Start watching for file changes
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      this.logger.warn('Already watching');
      return;
    }

    this.logger.info('Starting file watcher');
    this.logger.info(`Base path: ${this.options.basePath}`);
    this.logger.info(`Watch paths: ${this.options.watchPaths.join(', ')}`);

    // Instead of glob patterns, find and watch actual directories
    // This allows watching empty directories too
    const fs = await import('fs/promises');
    const watchDirs: string[] = [];

    // Function to recursively find matching directories
    const findComponentDirs = async (dir: string, depth: number = 0): Promise<void> => {
      if (depth > 10) return; // Prevent too deep recursion

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const fullPath = path.join(dir, entry.name);

          // Check if this directory matches one of our watch paths
          if (this.options.watchPaths.includes(entry.name)) {
            watchDirs.push(fullPath);
          }

          // Recurse into subdirectories (skip node_modules, .git, etc.)
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await findComponentDirs(fullPath, depth + 1);
          }
        }
      } catch (error) {
        // Ignore permission errors, etc.
      }
    };

    this.logger.info('Scanning for component directories...');
    await findComponentDirs(this.options.basePath);

    if (watchDirs.length === 0) {
      this.logger.warn('No component directories found. Watcher will not detect any changes.');
      this.logger.warn(`Expected directories: ${this.options.watchPaths.join(', ')}`);
      // Still proceed to create watcher for the base path
      watchDirs.push(this.options.basePath);
    }

    this.logger.info(`Found ${watchDirs.length} component directories to watch`);
    watchDirs.forEach(dir => this.logger.info(`  - ${dir}`));

    try {
      // Create chokidar watcher - watch directories directly, filter for .json files
      this.watcher = chokidar.watch(watchDirs, {
        ignored: this.options.ignored,
        persistent: true,
        ignoreInitial: true, // Don't fire events for existing files on startup
        depth: 10, // Maximum depth to watch
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100
        }
      });

      // Set up event handlers - filter for .json files only
      this.watcher
        .on('add', (filePath) => {
          if (!filePath.endsWith('.json')) return;
          this.handleFileChange('add', filePath);
        })
        .on('change', (filePath) => {
          if (!filePath.endsWith('.json')) return;
          this.handleFileChange('change', filePath);
        })
        .on('unlink', (filePath) => {
          if (!filePath.endsWith('.json')) return;
          this.handleFileChange('unlink', filePath);
        })
        .on('error', (error) => {
          this.handleError(error);
        })
        .on('ready', () => {
          this.logger.info('Initial scan complete. Watching for changes...');

          // Log what's being watched with error handling
          try {
            const watched = this.watcher!.getWatched();
            const watchedDirs = Object.keys(watched);
            this.logger.info(`Chokidar is watching ${watchedDirs.length} directories`);

            if (watchedDirs.length === 0) {
              this.logger.warn('⚠️ No directories are being watched! Check if component directories exist.');
            } else {
              // Show first few directories
              const dirs = watchedDirs.slice(0, 5);
              this.logger.info('Sample watched directories:');
              dirs.forEach(dir => {
                const files = watched[dir];
                this.logger.info(`  📁 ${dir} (${files.length} files)`);
              });

              if (watchedDirs.length > 5) {
                this.logger.info(`  ... and ${watchedDirs.length - 5} more directories`);
              }
            }
          } catch (error) {
            this.logger.error('Failed to get watched directories:', error);
          }

          this.isWatching = true;
          this.emit('ready');
        });

      // Wait for initial scan
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Watcher initialization timeout'));
        }, 30000); // 30 second timeout

        this.watcher!.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.watcher!.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.logger.info('File watcher started successfully');
    } catch (error) {
      this.logger.error('Failed to start file watcher', error);
      throw error;
    }
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (!this.isWatching) {
      return;
    }

    this.logger.info('Stopping file watcher');

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close watcher
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }

    this.isWatching = false;
    this.logger.info('File watcher stopped');
    this.emit('stopped');
  }

  /**
   * Handle file change event with debouncing
   */
  private handleFileChange(type: 'add' | 'change' | 'unlink', filePath: string): void {
    this.stats.eventsReceived++;
    this.stats.lastEventTime = Date.now();

    this.logger.debug(`File ${type}: ${path.basename(filePath)}`);

    // Clear existing debounce timer for this file
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.processFileChange(type, filePath);
      this.debounceTimers.delete(filePath);
    }, this.options.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Process file change after debounce
   */
  private async processFileChange(type: 'add' | 'change' | 'unlink', filePath: string): Promise<void> {
    try {
      this.stats.eventsProcessed++;

      // Determine component type from path
      const componentType = this.detectComponentType(filePath);
      if (!componentType) {
        this.logger.debug(`Skipping non-component file: ${path.basename(filePath)}`);
        return;
      }

      this.logger.info(`Processing ${type} event for ${componentType}: ${path.basename(filePath)}`);

      // Handle different change types
      switch (type) {
        case 'add':
          await this.handleFileAdded(filePath, componentType);
          break;
        case 'change':
          await this.handleFileChanged(filePath, componentType);
          break;
        case 'unlink':
          await this.handleFileDeleted(filePath, componentType);
          break;
      }

      // Emit event
      const event: FileChangeEvent = {
        type,
        path: filePath,
        componentType
      };
      this.emit('change', event);

      this.logger.debug(`Successfully processed ${type} event for ${componentType}`);

    } catch (error) {
      this.logger.error(`Error processing file change:`, error);
      this.handleError(error);
    }
  }

  /**
   * Handle file added
   */
  private async handleFileAdded(filePath: string, componentType: string): Promise<void> {
    this.logger.info(`Component added: ${componentType} at ${path.basename(filePath)}`);

    // Clear cache to force reload
    this.resolver.clearCache();

    // Optionally: Load just this component instead of full reload
    await this.loadSingleComponent(filePath, componentType);

    this.emit('componentAdded', { path: filePath, type: componentType });
  }

  /**
   * Handle file changed
   */
  private async handleFileChanged(filePath: string, componentType: string): Promise<void> {
    this.logger.info(`Component changed: ${componentType} at ${path.basename(filePath)}`);

    // Clear cache for this specific component
    this.invalidateCacheForFile(filePath);

    // Reload the component
    await this.loadSingleComponent(filePath, componentType);

    this.emit('componentChanged', { path: filePath, type: componentType });
  }

  /**
   * Handle file deleted
   */
  private async handleFileDeleted(filePath: string, componentType: string): Promise<void> {
    this.logger.info(`Component deleted: ${componentType} at ${path.basename(filePath)}`);

    // Remove from cache
    this.invalidateCacheForFile(filePath);

    this.emit('componentDeleted', { path: filePath, type: componentType });
  }

  /**
   * Detect component type from file path
   */
  private detectComponentType(filePath: string): FileChangeEvent['componentType'] | null {
    const normalized = path.normalize(filePath).toLowerCase();

    // Check for diagram files (should be ignored)
    if (normalized.includes('.diagram.json')) {
      return null;
    }

    // Detect by directory name
    const pathSep = path.sep;

    if (normalized.includes(`${pathSep}tasks${pathSep}`) ||
        normalized.includes(`${pathSep}sys-tasks${pathSep}`)) {
      return 'task';
    }
    if (normalized.includes(`${pathSep}schemas${pathSep}`) ||
        normalized.includes(`${pathSep}sys-schemas${pathSep}`)) {
      return 'schema';
    }
    if (normalized.includes(`${pathSep}views${pathSep}`) ||
        normalized.includes(`${pathSep}sys-views${pathSep}`)) {
      return 'view';
    }
    if (normalized.includes(`${pathSep}functions${pathSep}`) ||
        normalized.includes(`${pathSep}sys-functions${pathSep}`)) {
      return 'function';
    }
    if (normalized.includes(`${pathSep}extensions${pathSep}`) ||
        normalized.includes(`${pathSep}sys-extensions${pathSep}`)) {
      return 'extension';
    }
    if (normalized.includes(`${pathSep}workflows${pathSep}`) ||
        normalized.includes(`${pathSep}flows${pathSep}`) ||
        normalized.includes(`${pathSep}sys-flows${pathSep}`)) {
      return 'workflow';
    }

    return null;
  }

  /**
   * Load a single component file
   */
  private async loadSingleComponent(filePath: string, componentType: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');
      const component = JSON.parse(content);

      // Validate basic structure
      if (!component.key || !component.domain || !component.version) {
        this.logger.warn(`Invalid component structure in ${path.basename(filePath)}`);
        return;
      }

      // Attach file path metadata
      component.__filePath = filePath;

      this.logger.debug(`Loaded component: ${component.domain}/${component.key}@${component.version}`);
    } catch (error) {
      this.logger.error(`Failed to load component from ${path.basename(filePath)}:`, error);
    }
  }

  /**
   * Invalidate cache for a specific file
   */
  private invalidateCacheForFile(filePath: string): void {
    // For now, just clear all caches
    // In a more sophisticated implementation, we could track file-to-cache-key mappings
    this.logger.debug(`Invalidating cache for ${path.basename(filePath)}`);
    this.resolver.clearCache();
  }

  /**
   * Handle errors
   */
  private handleError(error: any): void {
    this.stats.errorsCount++;
    this.logger.error('Watcher error:', error);
    this.emit('error', error);
  }

  /**
   * Check if watching
   */
  isActive(): boolean {
    return this.isWatching;
  }

  /**
   * Get watch statistics
   */
  getStats(): WatcherStats {
    return {
      isWatching: this.isWatching,
      basePath: this.options.basePath,
      watchedPaths: this.options.watchPaths,
      pendingDebounces: this.debounceTimers.size,
      eventsReceived: this.stats.eventsReceived,
      eventsProcessed: this.stats.eventsProcessed,
      errorsCount: this.stats.errorsCount,
      lastEventTime: this.stats.lastEventTime
    };
  }

  /**
   * Get formatted statistics string
   */
  getStatsString(): string {
    const stats = this.getStats();
    return [
      `Component Watcher Statistics:`,
      `  Status: ${stats.isWatching ? 'Active' : 'Inactive'}`,
      `  Base Path: ${stats.basePath}`,
      `  Watched Paths: ${stats.watchedPaths.length}`,
      `  Events Received: ${stats.eventsReceived}`,
      `  Events Processed: ${stats.eventsProcessed}`,
      `  Events Dropped: ${stats.eventsReceived - stats.eventsProcessed}`,
      `  Errors: ${stats.errorsCount}`,
      `  Pending Debounces: ${stats.pendingDebounces}`,
      `  Last Event: ${stats.lastEventTime ? new Date(stats.lastEventTime).toISOString() : 'Never'}`
    ].join('\n');
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      eventsReceived: 0,
      eventsProcessed: 0,
      errorsCount: 0,
      lastEventTime: 0
    };
    this.logger.info('Statistics reset');
  }
}
