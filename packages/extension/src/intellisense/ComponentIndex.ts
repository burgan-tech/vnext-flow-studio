/**
 * ComponentIndex - Workspace indexer for vnext components
 *
 * Scans and indexes all vnext component files (Tasks, Schemas, Views,
 * Functions, Extensions, Workflows) in the workspace. Provides fast
 * lookup by component key/domain/flow/version for Go-to-Definition
 * and reference validation.
 *
 * Uses FileSystemWatcher for incremental updates.
 */

import * as vscode from 'vscode';
import { loadVNextConfig, resolveComponentPaths, VNextConfig } from '@amorphie-flow-studio/core';

// ─── Types ──────────────────────────────────────────────────────────

export interface ComponentRef {
  key: string;
  domain: string;
  flow: string;
  version: string;
}

export interface IndexedComponent {
  /** Component reference extracted from JSON */
  ref: ComponentRef;
  /** Component type (task, schema, view, function, extension, workflow) */
  type: ComponentType;
  /** Absolute file path */
  filePath: string;
  /** VS Code URI */
  uri: vscode.Uri;
}

export type ComponentType = 'task' | 'schema' | 'view' | 'function' | 'extension' | 'workflow';

// Map directory names to component types
const DIR_TO_TYPE: Record<string, ComponentType> = {
  Tasks: 'task',
  tasks: 'task',
  'sys-tasks': 'task',
  Schemas: 'schema',
  schemas: 'schema',
  'sys-schemas': 'schema',
  Views: 'view',
  views: 'view',
  'sys-views': 'view',
  Functions: 'function',
  functions: 'function',
  'sys-functions': 'function',
  Extensions: 'extension',
  extensions: 'extension',
  'sys-extensions': 'extension',
  Workflows: 'workflow',
  workflows: 'workflow',
  'sys-flows': 'workflow'
};

// Flow values that correspond to each component type
const TYPE_TO_FLOW: Record<ComponentType, string> = {
  task: 'sys-tasks',
  schema: 'sys-schemas',
  view: 'sys-views',
  function: 'sys-functions',
  extension: 'sys-extensions',
  workflow: 'sys-flows'
};

// ─── ComponentIndex ──────────────────────────────────────────────────

export class ComponentIndex implements vscode.Disposable {
  private static instance: ComponentIndex | undefined;

  /** All indexed components, keyed by composite key */
  private components = new Map<string, IndexedComponent>();
  /** Index by file path for quick removal */
  private pathIndex = new Map<string, string>();
  /** File watchers */
  private watchers: vscode.FileSystemWatcher[] = [];
  /** vnext config */
  private config: VNextConfig | undefined;
  /** Initialization promise */
  private initPromise: Promise<void> | undefined;
  /** Whether index is ready */
  private ready = false;
  /** Event emitter for index changes */
  private _onDidChange = new vscode.EventEmitter<void>();
  public readonly onDidChange = this._onDidChange.event;

  private constructor() {}

  static getInstance(): ComponentIndex {
    if (!ComponentIndex.instance) {
      ComponentIndex.instance = new ComponentIndex();
    }
    return ComponentIndex.instance;
  }

  /**
   * Initialize the index by scanning workspace
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      console.warn('[ComponentIndex] No workspace folder found');
      this.ready = true;
      return;
    }

    // Try to load vnext.config.json
    try {
      const configResult = await loadVNextConfig(workspaceFolder.uri.fsPath);
      if (configResult.success && configResult.config) {
        this.config = configResult.config;
        console.log('[ComponentIndex] Loaded vnext.config.json, domain:', this.config.domain);
      }
    } catch (error) {
      console.warn('[ComponentIndex] Failed to load vnext.config.json:', error);
    }

    // Scan all JSON files in component directories
    await this.fullScan();

    // Set up file watchers
    this.setupWatchers();

    this.ready = true;
    console.log(`[ComponentIndex] Initialized with ${this.components.size} components`);
  }

  /**
   * Full scan of workspace for component files
   */
  private async fullScan(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    // Build glob patterns for component directories
    const patterns = [
      '**/Tasks/**/*.json',
      '**/Schemas/**/*.json',
      '**/Views/**/*.json',
      '**/Functions/**/*.json',
      '**/Extensions/**/*.json',
      '**/Workflows/**/*.json'
    ];

    // If config has custom paths, add those too
    if (this.config) {
      const resolved = resolveComponentPaths(workspaceFolder.uri.fsPath, this.config);
      for (const [type, absPath] of Object.entries(resolved)) {
        if (type !== 'componentsRoot') {
          // Convert absolute path to relative glob
          const rel = vscode.workspace.asRelativePath(absPath);
          patterns.push(`${rel}/**/*.json`);
        }
      }
    }

    // Use a single inclusive glob
    const includePattern = `{${patterns.join(',')}}`;
    const excludePattern = '**/node_modules/**';

    try {
      const files = await vscode.workspace.findFiles(includePattern, excludePattern);
      console.log(`[ComponentIndex] Found ${files.length} potential component files`);

      for (const fileUri of files) {
        await this.indexFile(fileUri);
      }
    } catch (error) {
      console.error('[ComponentIndex] Full scan failed:', error);
    }
  }

  /**
   * Index a single JSON file
   */
  private async indexFile(uri: vscode.Uri): Promise<void> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(content).toString('utf8');
      const json = JSON.parse(text);

      // Must have key, domain, version to be a valid component
      if (!json.key || !json.domain || !json.version) {
        return;
      }

      // Determine component type from file path
      const type = this.detectComponentType(uri.fsPath);
      if (!type) return;

      const ref: ComponentRef = {
        key: json.key,
        domain: json.domain,
        flow: json.flow || TYPE_TO_FLOW[type],
        version: json.version
      };

      const component: IndexedComponent = {
        ref,
        type,
        filePath: uri.fsPath,
        uri
      };

      const compositeKey = this.makeCompositeKey(ref);

      // Remove old entry for this file path if exists
      const oldKey = this.pathIndex.get(uri.fsPath);
      if (oldKey) {
        this.components.delete(oldKey);
      }

      this.components.set(compositeKey, component);
      this.pathIndex.set(uri.fsPath, compositeKey);
    } catch {
      // Silently skip files that can't be parsed
    }
  }

  /**
   * Remove a file from the index
   */
  private removeFile(uri: vscode.Uri): void {
    const key = this.pathIndex.get(uri.fsPath);
    if (key) {
      this.components.delete(key);
      this.pathIndex.delete(uri.fsPath);
    }
  }

  /**
   * Detect component type from file path
   */
  private detectComponentType(filePath: string): ComponentType | undefined {
    const parts = filePath.replace(/\\/g, '/').split('/');

    // Walk backwards through path segments to find a known directory
    for (let i = parts.length - 2; i >= 0; i--) {
      const dir = parts[i];
      if (DIR_TO_TYPE[dir]) {
        return DIR_TO_TYPE[dir];
      }
    }

    // Also check config paths
    if (this.config) {
      const pathsConfig = this.config.paths;
      const dirMap: Record<string, ComponentType> = {
        [pathsConfig.tasks]: 'task',
        [pathsConfig.schemas]: 'schema',
        [pathsConfig.views]: 'view',
        [pathsConfig.functions]: 'function',
        [pathsConfig.extensions]: 'extension',
        [pathsConfig.workflows]: 'workflow'
      };

      for (let i = parts.length - 2; i >= 0; i--) {
        if (dirMap[parts[i]]) {
          return dirMap[parts[i]];
        }
      }
    }

    return undefined;
  }

  /**
   * Create a composite key for lookup
   */
  private makeCompositeKey(ref: ComponentRef): string {
    return `${ref.key}::${ref.domain}::${ref.flow}::${ref.version}`;
  }

  /**
   * Set up file system watchers
   */
  private setupWatchers(): void {
    const pattern = '**/{Tasks,Schemas,Views,Functions,Extensions,Workflows}/**/*.json';

    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidCreate(async (uri) => {
      await this.indexFile(uri);
      this._onDidChange.fire();
    });

    watcher.onDidChange(async (uri) => {
      await this.indexFile(uri);
      this._onDidChange.fire();
    });

    watcher.onDidDelete((uri) => {
      this.removeFile(uri);
      this._onDidChange.fire();
    });

    this.watchers.push(watcher);
  }

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Find a component by its reference
   */
  findByRef(ref: ComponentRef): IndexedComponent | undefined {
    const key = this.makeCompositeKey(ref);
    return this.components.get(key);
  }

  /**
   * Find a component by key only (returns first match)
   */
  findByKey(key: string): IndexedComponent | undefined {
    for (const comp of this.components.values()) {
      if (comp.ref.key === key) return comp;
    }
    return undefined;
  }

  /**
   * Find all components matching partial reference
   * Useful for autocomplete suggestions
   */
  findMatching(partial: Partial<ComponentRef>): IndexedComponent[] {
    const results: IndexedComponent[] = [];
    for (const comp of this.components.values()) {
      let match = true;
      if (partial.key && comp.ref.key !== partial.key) match = false;
      if (partial.domain && comp.ref.domain !== partial.domain) match = false;
      if (partial.flow && comp.ref.flow !== partial.flow) match = false;
      if (partial.version && comp.ref.version !== partial.version) match = false;
      if (match) results.push(comp);
    }
    return results;
  }

  /**
   * Find all components of a given type
   */
  findByType(type: ComponentType): IndexedComponent[] {
    return Array.from(this.components.values()).filter(c => c.type === type);
  }

  /**
   * Get all indexed components
   */
  getAll(): IndexedComponent[] {
    return Array.from(this.components.values());
  }

  /**
   * Get component count
   */
  get size(): number {
    return this.components.size;
  }

  /**
   * Whether the index is ready
   */
  get isReady(): boolean {
    return this.ready;
  }

  /**
   * Get the loaded vnext config
   */
  getConfig(): VNextConfig | undefined {
    return this.config;
  }

  dispose(): void {
    for (const w of this.watchers) {
      w.dispose();
    }
    this.watchers = [];
    this.components.clear();
    this.pathIndex.clear();
    this._onDidChange.dispose();
    ComponentIndex.instance = undefined;
  }
}
