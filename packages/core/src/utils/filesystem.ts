/**
 * Shared filesystem utilities for component discovery and scanning
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Options for filesystem scanning operations
 */
export interface ScanOptions {
  /**
   * Maximum depth to traverse (0 = current directory only, undefined = unlimited)
   * @default 3
   */
  maxDepth?: number;

  /**
   * File patterns to exclude (e.g., ['*.diagram.json', '*.lock.json'])
   * Uses simple glob-style matching with * wildcard
   */
  excludePatterns?: string[];

  /**
   * Directory names to exclude from traversal
   * @default ['.git', '.vscode', 'node_modules']
   */
  excludeDirs?: string[];

  /**
   * Whether to follow symbolic links
   * @default false
   */
  followSymlinks?: boolean;
}

/**
 * Default scan options
 */
const DEFAULT_SCAN_OPTIONS: Required<ScanOptions> = {
  maxDepth: 3,
  excludePatterns: [],
  excludeDirs: ['.git', '.vscode', 'node_modules'],
  followSymlinks: false
};

/**
 * Check if a filename matches any of the exclude patterns
 */
function matchesPattern(filename: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Simple glob matching - convert * to regex
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    if (regex.test(filename)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a directory should be excluded from traversal
 */
function shouldExcludeDir(dirName: string, excludeDirs: string[]): boolean {
  // Exclude hidden directories (starting with .)
  if (dirName.startsWith('.')) {
    return true;
  }
  // Exclude explicitly listed directories
  return excludeDirs.includes(dirName);
}

/**
 * Find all JSON files in a directory recursively
 *
 * @param dir - Directory to scan
 * @param options - Scan options
 * @returns Array of absolute file paths
 *
 * @example
 * ```typescript
 * const files = await findJsonFiles('/path/to/workflows', {
 *   maxDepth: 5,
 *   excludePatterns: ['*.diagram.json']
 * });
 * ```
 */
export async function findJsonFiles(
  dir: string,
  options: ScanOptions = {}
): Promise<string[]> {
  const opts = { ...DEFAULT_SCAN_OPTIONS, ...options };
  const results: string[] = [];

  async function walk(currentDir: string, depth: number): Promise<void> {
    // Check depth limit
    if (opts.maxDepth !== undefined && depth > opts.maxDepth) {
      return;
    }

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          // Skip excluded directories
          if (!shouldExcludeDir(entry.name, opts.excludeDirs)) {
            await walk(fullPath, depth + 1);
          }
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          // Check if file matches exclude patterns
          if (!matchesPattern(entry.name, opts.excludePatterns)) {
            results.push(fullPath);
          }
        } else if (entry.isSymbolicLink() && opts.followSymlinks) {
          // Handle symlinks if enabled
          try {
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
              await walk(fullPath, depth + 1);
            } else if (stat.isFile() && entry.name.endsWith('.json')) {
              if (!matchesPattern(entry.name, opts.excludePatterns)) {
                results.push(fullPath);
              }
            }
          } catch {
            // Broken symlink or permission error - skip
          }
        }
      }
    } catch {
      // Directory doesn't exist, permission denied, or other I/O error
      // Silently skip to maintain backward compatibility, but could be logged
      // if a logger is provided in options
    }
  }

  await walk(dir, 0);
  return results;
}

/**
 * Scan directory for JSON files using a callback handler
 * Useful for streaming processing without loading all paths into memory
 *
 * @param dir - Directory to scan
 * @param handler - Async callback invoked for each JSON file
 * @param options - Scan options
 *
 * @example
 * ```typescript
 * await scanJsonFiles('/path/to/workflows', async (filePath) => {
 *   const content = await fs.readFile(filePath, 'utf-8');
 *   processWorkflow(JSON.parse(content));
 * }, {
 *   excludePatterns: ['*.diagram.json']
 * });
 * ```
 */
export async function scanJsonFiles(
  dir: string,
  handler: (filePath: string) => Promise<void>,
  options: ScanOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_SCAN_OPTIONS, ...options };

  async function walk(currentDir: string, depth: number): Promise<void> {
    // Check depth limit
    if (opts.maxDepth !== undefined && depth > opts.maxDepth) {
      return;
    }

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          // Skip excluded directories
          if (!shouldExcludeDir(entry.name, opts.excludeDirs)) {
            await walk(fullPath, depth + 1);
          }
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          // Check if file matches exclude patterns
          if (!matchesPattern(entry.name, opts.excludePatterns)) {
            await handler(fullPath);
          }
        } else if (entry.isSymbolicLink() && opts.followSymlinks) {
          // Handle symlinks if enabled
          try {
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
              await walk(fullPath, depth + 1);
            } else if (stat.isFile() && entry.name.endsWith('.json')) {
              if (!matchesPattern(entry.name, opts.excludePatterns)) {
                await handler(fullPath);
              }
            }
          } catch {
            // Broken symlink or permission error - skip
          }
        }
      }
    } catch {
      // Directory doesn't exist, permission denied, or other I/O error
      // Silently skip to maintain backward compatibility
    }
  }

  await walk(dir, 0);
}

/**
 * Find all directories matching a name pattern recursively
 *
 * @param basePath - Base directory to start search
 * @param dirName - Directory name to find (exact match)
 * @param options - Scan options (maxDepth, excludeDirs)
 * @returns Array of absolute directory paths
 *
 * @example
 * ```typescript
 * // Find all "Schemas" directories
 * const schemaDirs = await findDirectories('/path/to/workspace', 'Schemas', {
 *   maxDepth: 5
 * });
 * ```
 */
export async function findDirectories(
  basePath: string,
  dirName: string,
  options: Pick<ScanOptions, 'maxDepth' | 'excludeDirs' | 'followSymlinks'> = {}
): Promise<string[]> {
  const opts = {
    ...DEFAULT_SCAN_OPTIONS,
    ...options
  };
  const results: string[] = [];

  async function walk(currentDir: string, depth: number): Promise<void> {
    // Check depth limit
    if (opts.maxDepth !== undefined && depth > opts.maxDepth) {
      return;
    }

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !shouldExcludeDir(entry.name, opts.excludeDirs)) {
          const fullPath = path.join(currentDir, entry.name);

          // Check if this directory matches our target name
          if (entry.name === dirName) {
            results.push(fullPath);
          }

          // Continue searching recursively
          await walk(fullPath, depth + 1);
        } else if (entry.isSymbolicLink() && opts.followSymlinks) {
          // Handle symlinks if enabled
          try {
            const fullPath = path.join(currentDir, entry.name);
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory() && !shouldExcludeDir(entry.name, opts.excludeDirs)) {
              if (entry.name === dirName) {
                results.push(fullPath);
              }
              await walk(fullPath, depth + 1);
            }
          } catch {
            // Broken symlink or permission error - skip
          }
        }
      }
    } catch {
      // Directory doesn't exist, permission denied, or other I/O error
      // Silently skip
    }
  }

  await walk(basePath, 0);
  return results;
}
