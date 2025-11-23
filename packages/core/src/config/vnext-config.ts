/**
 * vnext.config.json configuration file types and loader
 */

export interface VNextConfigPaths {
  componentsRoot: string;
  tasks: string;
  views: string;
  functions: string;
  extensions: string;
  workflows: string;
  schemas: string;
}

export interface VNextConfigExports {
  functions: string[];
  workflows: string[];
  tasks: string[];
  views: string[];
  schemas: string[];
  extensions: string[];
  visibility: 'public' | 'private';
  metadata?: {
    description?: string;
    maintainer?: string;
    license?: string;
    keywords?: string[];
  };
}

export interface VNextConfigDependencies {
  domains: string[];
  npm: string[];
}

export interface VNextConfigReferenceResolution {
  enabled: boolean;
  validateOnBuild: boolean;
  strictMode: boolean;
  validateReferenceConsistency: boolean;
  validateSchemas: boolean;
  allowedHosts: string[];
  schemaValidationRules?: {
    enforceKeyFormat?: boolean;
    enforceVersionFormat?: boolean;
    enforceFilenameConsistency?: boolean;
    allowUnknownProperties?: boolean;
  };
}

export interface VNextConfig {
  version: string;
  description?: string;
  domain: string;
  runtimeVersion: string;
  schemaVersion: string;
  paths: VNextConfigPaths;
  exports: VNextConfigExports;
  dependencies: VNextConfigDependencies;
  referenceResolution: VNextConfigReferenceResolution;
}

/**
 * Result of config loading operation
 */
export interface ConfigLoadResult {
  success: boolean;
  config?: VNextConfig;
  configPath?: string;
  error?: string;
}

/**
 * Load and parse vnext.config.json from a directory
 */
export async function loadVNextConfig(workspaceRoot: string): Promise<ConfigLoadResult> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const configPath = path.join(workspaceRoot, 'vnext.config.json');

  try {
    // Check if file exists
    await fs.access(configPath);

    // Read and parse JSON
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as VNextConfig;

    // Validate required fields
    if (!config.paths || !config.paths.componentsRoot) {
      return {
        success: false,
        error: 'Invalid config: missing paths.componentsRoot'
      };
    }

    if (!config.domain) {
      return {
        success: false,
        error: 'Invalid config: missing domain'
      };
    }

    return {
      success: true,
      config,
      configPath
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        success: false,
        error: 'vnext.config.json not found'
      };
    }

    return {
      success: false,
      error: `Failed to load config: ${(error as Error).message}`
    };
  }
}

/**
 * Get absolute paths for all component directories based on config
 */
export function resolveComponentPaths(
  workspaceRoot: string,
  config: VNextConfig
): Record<string, string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  const { componentsRoot, tasks, views, functions, extensions, workflows, schemas } = config.paths;

  const baseDir = path.join(workspaceRoot, componentsRoot);

  return {
    tasks: path.join(baseDir, tasks),
    views: path.join(baseDir, views),
    functions: path.join(baseDir, functions),
    extensions: path.join(baseDir, extensions),
    workflows: path.join(baseDir, workflows),
    schemas: path.join(baseDir, schemas),
    componentsRoot: baseDir
  };
}

/**
 * Get all component directory names from config (for watching)
 */
export function getComponentDirNames(config: VNextConfig): string[] {
  const { tasks, views, functions, extensions, workflows, schemas } = config.paths;
  return [tasks, views, functions, extensions, workflows, schemas];
}

/**
 * Find vnext.config.json by searching up the directory tree
 */
export async function findVNextConfig(startPath: string): Promise<ConfigLoadResult> {
  const fs = await import('fs/promises');
  const path = await import('path');

  let currentPath = startPath;
  const root = path.parse(currentPath).root;

  while (currentPath !== root) {
    const configPath = path.join(currentPath, 'vnext.config.json');

    try {
      await fs.access(configPath);
      return await loadVNextConfig(currentPath);
    } catch {
      // Not found, try parent directory
      currentPath = path.dirname(currentPath);
    }
  }

  return {
    success: false,
    error: 'vnext.config.json not found in directory tree'
  };
}
