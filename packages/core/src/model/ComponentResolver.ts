// Component resolver for loading workflow components

import * as path from 'path';
import * as fs from 'fs/promises';
import type {
  IComponentResolver,
  ComponentRef,
  ResolvedScript
} from './types.js';
import type {
  TaskComponentDefinition,
  SchemaDefinition,
  ViewDefinition,
  FunctionDefinition,
  ExtensionDefinition,
  Workflow
} from '../types/index.js';
import { ScriptManager } from './ScriptManager.js';
import { ComponentWatcher, type ComponentWatcherOptions } from './ComponentWatcher.js';
import { extractWorkflowDependencies, type DependencyTree } from '../dependencies/workflow-dependencies.js';

/**
 * Options for the component resolver
 */
export interface ComponentResolverOptions {
  /** Base path for resolving component references */
  basePath?: string;
  /** Component search paths */
  searchPaths?: {
    tasks?: string[];
    schemas?: string[];
    views?: string[];
    functions?: string[];
    extensions?: string[];
    workflows?: string[];
  };
  /** Whether to use caching */
  useCache?: boolean;
}

/**
 * Default search paths for components
 */
const DEFAULT_SEARCH_PATHS = {
  tasks: [
    'Tasks',
    'tasks',
    'sys-tasks'
  ],
  schemas: [
    'Schemas',
    'schemas',
    'sys-schemas'
  ],
  views: [
    'Views',
    'views',
    'sys-views'
  ],
  functions: [
    'Functions',
    'functions',
    'sys-functions'
  ],
  extensions: [
    'Extensions',
    'extensions',
    'sys-extensions'
  ],
  workflows: [
    'Workflows',
    'workflows',
    'flows',
    'sys-flows',
    '.'
  ]
};

/**
 * Resolves component references to actual definitions
 */
export class ComponentResolver implements IComponentResolver {
  private scriptManager: ScriptManager;
  private options: ComponentResolverOptions;

  // Component caches
  private taskCache: Map<string, TaskComponentDefinition> = new Map();
  private schemaCache: Map<string, SchemaDefinition> = new Map();
  private viewCache: Map<string, ViewDefinition> = new Map();
  private functionCache: Map<string, FunctionDefinition> = new Map();
  private extensionCache: Map<string, ExtensionDefinition> = new Map();
  private workflowCache: Map<string, Workflow> = new Map();

  // File watcher (optional)
  private watcher?: ComponentWatcher;

  constructor(options: ComponentResolverOptions = {}) {
    this.options = {
      useCache: true,
      ...options,
      searchPaths: {
        ...DEFAULT_SEARCH_PATHS,
        ...options.searchPaths
      }
    };
    this.scriptManager = new ScriptManager();
  }

  /**
   * Resolve a task reference
   */
  async resolveTask(ref: ComponentRef | { ref: string }): Promise<TaskComponentDefinition | null> {
    const cacheKey = this.getCacheKey(ref);

    // Check cache
    if (this.options.useCache && this.taskCache.has(cacheKey)) {
      return this.taskCache.get(cacheKey)!;
    }

    // Resolve the component
    const component = await this.resolveComponent<TaskComponentDefinition>(ref, 'tasks');

    // Cache it
    if (component && this.options.useCache) {
      this.taskCache.set(cacheKey, component);
    }

    return component;
  }

  /**
   * Resolve a schema reference
   */
  async resolveSchema(ref: ComponentRef | { ref: string }): Promise<SchemaDefinition | null> {
    const cacheKey = this.getCacheKey(ref);

    // Check cache
    if (this.options.useCache && this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey)!;
    }

    // Resolve the component
    const component = await this.resolveComponent<SchemaDefinition>(ref, 'schemas');

    // Cache it
    if (component && this.options.useCache) {
      this.schemaCache.set(cacheKey, component);
    }

    return component;
  }

  /**
   * Resolve a view reference
   */
  async resolveView(ref: ComponentRef | { ref: string }): Promise<ViewDefinition | null> {
    const cacheKey = this.getCacheKey(ref);

    // Check cache
    if (this.options.useCache && this.viewCache.has(cacheKey)) {
      return this.viewCache.get(cacheKey)!;
    }

    // Resolve the component
    const component = await this.resolveComponent<ViewDefinition>(ref, 'views');

    // Cache it
    if (component && this.options.useCache) {
      this.viewCache.set(cacheKey, component);
    }

    return component;
  }

  /**
   * Resolve a function reference
   */
  async resolveFunction(ref: ComponentRef | { ref: string }): Promise<FunctionDefinition | null> {
    const cacheKey = this.getCacheKey(ref);

    // Check cache
    if (this.options.useCache && this.functionCache.has(cacheKey)) {
      return this.functionCache.get(cacheKey)!;
    }

    // Resolve the component
    const component = await this.resolveComponent<FunctionDefinition>(ref, 'functions');

    // Cache it
    if (component && this.options.useCache) {
      this.functionCache.set(cacheKey, component);
    }

    return component;
  }

  /**
   * Resolve an extension reference
   */
  async resolveExtension(ref: ComponentRef | { ref: string }): Promise<ExtensionDefinition | null> {
    const cacheKey = this.getCacheKey(ref);

    // Check cache
    if (this.options.useCache && this.extensionCache.has(cacheKey)) {
      return this.extensionCache.get(cacheKey)!;
    }

    // Resolve the component
    const component = await this.resolveComponent<ExtensionDefinition>(ref, 'extensions');

    // Cache it
    if (component && this.options.useCache) {
      this.extensionCache.set(cacheKey, component);
    }

    return component;
  }

  /**
   * Resolve a script file
   */
  async resolveScript(location: string, basePath: string): Promise<ResolvedScript | null> {
    return this.scriptManager.loadScript(location, basePath);
  }

  /**
   * Get the script manager instance
   */
  getScriptManager(): ScriptManager {
    return this.scriptManager;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.taskCache.clear();
    this.schemaCache.clear();
    this.viewCache.clear();
    this.functionCache.clear();
    this.extensionCache.clear();
    this.workflowCache.clear();
    this.scriptManager.clearCache();
  }

  /**
   * Resolve a component reference to its file path
   */
  async resolveComponentPath(
    ref: ComponentRef | { ref: string },
    type: 'tasks' | 'schemas' | 'views' | 'functions' | 'extensions' | 'workflows'
  ): Promise<string | null> {
    // Handle ref-style reference
    if ('ref' in ref) {
      const basePath = this.options.basePath || process.cwd();
      const fullPath = path.resolve(basePath, ref.ref);

      console.log('[ComponentResolver] Trying ref-style path:', fullPath);
      try {
        await fs.access(fullPath);
        console.log('[ComponentResolver] Found ref-style file:', fullPath);
        return fullPath;
      } catch {
        console.log('[ComponentResolver] Ref-style file not found');
        return null;
      }
    }

    // Handle explicit reference - use same logic as resolveExplicitRef
    const basePath = this.options.basePath || process.cwd();
    const searchPaths = this.options.searchPaths![type] || [];

    console.log('[ComponentResolver] Resolving normalized ref:', ref, 'basePath:', basePath, 'searchPaths:', searchPaths);

    // Try different naming patterns for each search path
    const patterns = [
      (sp: string) => `${sp}/${ref.domain}/${ref.key}.json`,
      (sp: string) => `${sp}/${ref.key}.json`,
      (sp: string) => `${sp}/${ref.domain}-${ref.key}.json`,
      (sp: string) => `${sp}/${ref.domain}/${ref.key}-${ref.version}.json`,
      (sp: string) => `${sp}/${ref.domain}-${ref.key}-${ref.version}.json`,
      (sp: string) => `${sp}/${ref.domain}/${ref.key}.${ref.version}.json`,
      (sp: string) => `${sp}/${ref.domain}-${ref.key}.${ref.version}.json`,
      (sp: string) => `${sp}/${ref.key}.${ref.version}.json`
    ];

    // Try each search path with each pattern
    for (const searchPath of searchPaths) {
      for (const pattern of patterns) {
        const filePath = pattern(searchPath);
        const fullPath = path.resolve(basePath, filePath);

        console.log('[ComponentResolver] Trying path:', fullPath);
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const component = JSON.parse(content) as any;

          // Validate that the component matches the reference
          if (component.key === ref.key && component.domain === ref.domain) {
            // Check version if specified
            if (ref.version && component.version && component.version !== ref.version) {
              console.log('[ComponentResolver] Version mismatch:', component.version, '!==', ref.version);
              continue; // Version mismatch, try next file
            }
            // Check flow if specified and component has flow
            if (ref.flow && component.flow && component.flow !== ref.flow) {
              console.log('[ComponentResolver] Flow mismatch:', component.flow, '!==', ref.flow);
              continue; // Flow mismatch, try next file
            }
            console.log('[ComponentResolver] Found matching file:', fullPath);
            return fullPath;
          } else {
            console.log('[ComponentResolver] Component mismatch: key=', component.key, 'vs', ref.key, 'domain=', component.domain, 'vs', ref.domain);
          }
        } catch {
          // File doesn't exist or can't be read, try next path
          continue;
        }
      }
    }

    console.log('[ComponentResolver] No matching file found');
    return null;
  }

  /**
   * Get cache key for a reference
   */
  private getCacheKey(ref: ComponentRef | { ref: string }): string {
    if ('ref' in ref) {
      return ref.ref;
    }
    return `${ref.domain}/${ref.flow}/${ref.key}@${ref.version}`;
  }

  /**
   * Resolve a component reference to actual definition
   */
  private async resolveComponent<T>(
    ref: ComponentRef | { ref: string },
    type: 'tasks' | 'schemas' | 'views' | 'functions' | 'extensions'
  ): Promise<T | null> {
    // Handle ref-style reference
    if ('ref' in ref) {
      return this.resolveRefPath<T>(ref.ref);
    }

    // Handle explicit reference
    return this.resolveExplicitRef<T>(ref, type);
  }

  /**
   * Resolve a ref path to a component
   */
  private async resolveRefPath<T>(refPath: string): Promise<T | null> {
    const basePath = this.options.basePath || process.cwd();
    const fullPath = path.resolve(basePath, refPath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      console.warn(`Failed to resolve ref path: ${refPath}`, error);
      return null;
    }
  }

  /**
   * Resolve an explicit component reference
   */
  private async resolveExplicitRef<T>(
    ref: ComponentRef,
    type: 'tasks' | 'schemas' | 'views' | 'functions' | 'extensions'
  ): Promise<T | null> {
    const basePath = this.options.basePath || process.cwd();
    const searchPaths = this.options.searchPaths![type] || [];

    // Try different naming patterns for each search path
    const patterns = [
      (sp: string) => `${sp}/${ref.domain}/${ref.key}.json`,
      (sp: string) => `${sp}/${ref.key}.json`,
      (sp: string) => `${sp}/${ref.domain}-${ref.key}.json`,
      (sp: string) => `${sp}/${ref.domain}/${ref.key}-${ref.version}.json`,
      (sp: string) => `${sp}/${ref.domain}-${ref.key}-${ref.version}.json`,
      (sp: string) => `${sp}/${ref.domain}/${ref.key}.${ref.version}.json`,
      (sp: string) => `${sp}/${ref.domain}-${ref.key}.${ref.version}.json`,
      (sp: string) => `${sp}/${ref.key}.${ref.version}.json`
    ];

    // Try each search path with each pattern
    for (const searchPath of searchPaths) {
      for (const pattern of patterns) {
        const filePath = pattern(searchPath);
        const fullPath = path.resolve(basePath, filePath);

        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const component = JSON.parse(content) as any;

          // Validate that the component matches the reference
          // Be more lenient with validation - check key and domain at minimum
          if (component.key === ref.key && component.domain === ref.domain) {
            // Check version if specified
            if (ref.version && component.version && component.version !== ref.version) {
              continue; // Version mismatch, try next file
            }
            // Check flow if specified and component has flow
            if (ref.flow && component.flow && component.flow !== ref.flow) {
              continue; // Flow mismatch, try next file
            }
            return component as T;
          }
        } catch {
          // File doesn't exist or can't be parsed, try next pattern
          continue;
        }
      }
    }

    // Try pattern-based search as fallback
    return this.searchForComponent<T>(ref, type);
  }

  /**
   * Build a file path for a component
   */
  private buildComponentPath(ref: ComponentRef, searchPath: string): string {
    // Try different naming conventions - this returns the most likely path
    // The actual file existence check happens in resolveExplicitRef
    return `${searchPath}/${ref.domain}/${ref.key}.json`;
  }

  /**
   * Search for a component using patterns
   */
  private async searchForComponent<T>(
    ref: ComponentRef,
    type: 'tasks' | 'schemas' | 'views' | 'functions' | 'extensions'
  ): Promise<T | null> {
    const basePath = this.options.basePath || process.cwd();
    const searchPaths = this.options.searchPaths![type] || [];

    for (const searchPath of searchPaths) {
      const searchDir = path.resolve(basePath, searchPath);

      try {
        const files = await this.findJsonFiles(searchDir);

        for (const file of files) {
          try {
            const content = await fs.readFile(file, 'utf-8');
            const component = JSON.parse(content) as any;

            // Check if this is the component we're looking for
            if (
              component.key === ref.key &&
              component.domain === ref.domain &&
              component.version === ref.version &&
              component.flow === ref.flow
            ) {
              return component as T;
            }
          } catch {
            // Skip invalid JSON files
            continue;
          }
        }
      } catch {
        // Search path doesn't exist
        continue;
      }
    }

    return null;
  }

  /**
   * Find all directories matching a name pattern recursively
   * Supports patterns like "Schemas" to find all directories named "Schemas" anywhere
   */
  private async findDirectories(basePath: string, dirName: string, maxDepth: number = 5): Promise<string[]> {
    const results: string[] = [];

    async function walk(currentDir: string, depth: number) {
      if (depth > maxDepth) return;

      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const fullPath = path.join(currentDir, entry.name);

            // Check if this directory matches our target name
            if (entry.name === dirName) {
              results.push(fullPath);
            }

            // Continue searching recursively
            await walk(fullPath, depth + 1);
          }
        }
      } catch {
        // Directory doesn't exist or can't be read
      }
    }

    await walk(basePath, 0);
    return results;
  }

  /**
   * Find all JSON files in a directory recursively
   */
  private async findJsonFiles(dir: string, maxDepth: number = 3): Promise<string[]> {
    const results: string[] = [];

    async function walk(currentDir: string, depth: number) {
      if (depth > maxDepth) return;

      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await walk(fullPath, depth + 1);
          } else if (entry.isFile() && entry.name.endsWith('.json')) {
            results.push(fullPath);
          }
        }
      } catch {
        // Directory doesn't exist or can't be read
      }
    }

    await walk(dir, 0);
    return results;
  }

  /**
   * Set the base path for resolution
   */
  setBasePath(basePath: string): void {
    this.options.basePath = basePath;
  }

  /**
   * Get current options
   */
  getOptions(): ComponentResolverOptions {
    return { ...this.options };
  }

  /**
   * Preload all components from the filesystem
   * This scans the search paths and loads all components into cache
   */
  async preloadAllComponents(): Promise<{
    tasks: TaskComponentDefinition[];
    schemas: SchemaDefinition[];
    views: ViewDefinition[];
    functions: FunctionDefinition[];
    extensions: ExtensionDefinition[];
    workflows: Workflow[];
  }> {
    const result = {
      tasks: [] as TaskComponentDefinition[],
      schemas: [] as SchemaDefinition[],
      views: [] as ViewDefinition[],
      functions: [] as FunctionDefinition[],
      extensions: [] as ExtensionDefinition[],
      workflows: [] as Workflow[]
    };

    const basePath = this.options.basePath || process.cwd();
    console.log('[ComponentResolver] preloadAllComponents - basePath:', basePath);
    console.log('[ComponentResolver] search paths:', this.options.searchPaths);

    // Helper function to scan a directory for components
    const scanForComponents = async <T>(
      type: 'tasks' | 'schemas' | 'views' | 'functions' | 'extensions' | 'workflows',
      cache: Map<string, T>
    ): Promise<T[]> => {
      const components: T[] = [];
      const searchPathNames = this.options.searchPaths![type] || [];
      console.log(`[ComponentResolver] Scanning for ${type}, searchPathNames:`, searchPathNames);

      // For each search path name (e.g., "Schemas", "schemas", "sys-schemas")
      // Find all directories with that name anywhere in the workspace (**/Schemas/**)
      for (const searchPathName of searchPathNames) {
        // Find all directories matching this name
        const matchingDirs = await this.findDirectories(basePath, searchPathName);
        console.log(`[ComponentResolver] Found ${matchingDirs.length} directories named "${searchPathName}"`);

        // Scan each matching directory
        for (const dir of matchingDirs) {
          console.log(`[ComponentResolver] Scanning directory: ${dir}`);

          try {
            const files = await this.findJsonFiles(dir);
            console.log(`[ComponentResolver] Found ${files.length} JSON files in ${dir}`);

            for (const file of files) {
              try {
                // Exclude diagram files for all types
                if (file.endsWith('.diagram.json')) {
                  continue;
                }

                const content = await fs.readFile(file, 'utf-8');
                const component = JSON.parse(content) as any;

                // Basic validation - must have key, domain, and version
                if (!component.key || !component.domain || !component.version) {
                  continue;
                }

                // Distinguish workflows from other components
                // Workflows have an 'attributes' object with 'states' and 'startTransition'
                const isWorkflow = component.attributes &&
                                   component.attributes.states &&
                                   component.attributes.startTransition;

                // Skip if types don't match
                if (type === 'workflows' && !isWorkflow) {
                  continue;
                }
                if (type !== 'workflows' && isWorkflow) {
                  continue;
                }

                // Component is valid for this type
                const cacheKey = `${component.domain}/${component.flow || type}/${component.key}@${component.version}`;

                // Attach file path for change detection (especially for schemas)
                component.__filePath = file;

                // Add to cache (avoid duplicates)
                if (this.options.useCache && !cache.has(cacheKey)) {
                  cache.set(cacheKey, component as T);
                  components.push(component as T);
                  console.log(`[ComponentResolver] ✓ Loaded ${type}: ${component.domain}/${component.key}@${component.version} from ${dir}`);
                }
              } catch (err) {
                console.log(`[ComponentResolver] ✗ Failed to parse ${file}:`, err);
                continue;
              }
            }
          } catch (err) {
            console.log(`[ComponentResolver] ✗ Error scanning directory: ${dir}`, err);
            continue;
          }
        }
      }

      console.log(`[ComponentResolver] Total ${type} loaded: ${components.length}`);
      return components;
    };

    // Scan all component types in parallel
    const [tasks, schemas, views, functions, extensions, workflows] = await Promise.all([
      scanForComponents<TaskComponentDefinition>('tasks', this.taskCache),
      scanForComponents<SchemaDefinition>('schemas', this.schemaCache),
      scanForComponents<ViewDefinition>('views', this.viewCache),
      scanForComponents<FunctionDefinition>('functions', this.functionCache),
      scanForComponents<ExtensionDefinition>('extensions', this.extensionCache),
      scanForComponents<Workflow>('workflows', this.workflowCache)
    ]);

    result.tasks = tasks;
    result.schemas = schemas;
    result.views = views;
    result.functions = functions;
    result.extensions = extensions;
    result.workflows = workflows;

    return result;
  }

  /**
   * Get all cached components
   */
  getCachedComponents(): {
    tasks: TaskComponentDefinition[];
    schemas: SchemaDefinition[];
    views: ViewDefinition[];
    functions: FunctionDefinition[];
    extensions: ExtensionDefinition[];
    workflows: Workflow[];
  } {
    return {
      tasks: Array.from(this.taskCache.values()),
      schemas: Array.from(this.schemaCache.values()),
      views: Array.from(this.viewCache.values()),
      functions: Array.from(this.functionCache.values()),
      extensions: Array.from(this.extensionCache.values()),
      workflows: Array.from(this.workflowCache.values())
    };
  }

  /**
   * Enable file watching for automatic cache updates
   */
  async enableFileWatching(options?: Partial<ComponentWatcherOptions>): Promise<ComponentWatcher> {
    if (this.watcher) {
      console.warn('[ComponentResolver] File watching already enabled');
      return this.watcher;
    }

    const basePath = this.options.basePath || process.cwd();
    this.watcher = new ComponentWatcher(this, {
      basePath,
      ...options
    });

    // Listen to watcher events
    this.watcher.on('change', (event) => {
      console.log(`[ComponentResolver] Component changed: ${event.type} ${event.componentType} at ${event.path}`);
    });

    this.watcher.on('error', (error) => {
      console.error('[ComponentResolver] Watcher error:', error);
    });

    await this.watcher.start();
    console.log('[ComponentResolver] File watching enabled');

    return this.watcher;
  }

  /**
   * Disable file watching
   */
  async disableFileWatching(): Promise<void> {
    if (!this.watcher) {
      return;
    }

    await this.watcher.stop();
    this.watcher = undefined;
    console.log('[ComponentResolver] File watching disabled');
  }

  /**
   * Get the file watcher instance
   */
  getWatcher(): ComponentWatcher | undefined {
    return this.watcher;
  }

  /**
   * Extract all dependencies from a workflow
   * Returns a tree structure organized by state
   */
  extractWorkflowDependencies(workflow: Workflow): DependencyTree {
    return extractWorkflowDependencies(workflow);
  }
}