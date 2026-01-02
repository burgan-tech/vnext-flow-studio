/**
 * Detects if the current workspace is a vnext-template project
 */

import * as vscode from 'vscode';
import { loadVNextConfig, type VNextConfig } from '@amorphie-flow-studio/core';

export interface ProjectInfo {
  isVNextProject: boolean;
  rootPath?: string;
  config?: VNextConfig;
  domain?: string;
  hasValidateScript?: boolean;
  hasBuildScript?: boolean;
  hasSetupScript?: boolean;
  error?: string;
}

export class ProjectDetector {
  private cachedInfo?: ProjectInfo;
  private cacheTime?: number;
  private readonly cacheTtlMs = 5000; // 5 seconds cache

  /**
   * Detect if current workspace is a vnext-template project
   */
  async detectProject(forceRefresh = false): Promise<ProjectInfo> {
    // Return cached result if valid
    if (!forceRefresh && this.cachedInfo && this.cacheTime) {
      const age = Date.now() - this.cacheTime;
      if (age < this.cacheTtlMs) {
        return this.cachedInfo;
      }
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return this.cacheResult({
        isVNextProject: false,
        error: 'No workspace folder open'
      });
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    // Try to load vnext.config.json
    const configResult = await loadVNextConfig(rootPath);

    if (configResult.success && configResult.config) {
      // Found vnext.config.json - this is a vnext project
      const scripts = await this.detectNpmScripts(rootPath);

      return this.cacheResult({
        isVNextProject: true,
        rootPath,
        config: configResult.config,
        domain: configResult.config.domain,
        ...scripts
      });
    }

    // Fallback: check package.json for vnext scripts
    const scripts = await this.detectNpmScripts(rootPath);
    if (scripts.hasValidateScript || scripts.hasBuildScript) {
      return this.cacheResult({
        isVNextProject: true,
        rootPath,
        ...scripts
      });
    }

    return this.cacheResult({
      isVNextProject: false,
      rootPath,
      error: configResult.error
    });
  }

  /**
   * Detect npm scripts in package.json
   */
  private async detectNpmScripts(rootPath: string): Promise<{
    hasValidateScript: boolean;
    hasBuildScript: boolean;
    hasSetupScript: boolean;
  }> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const packageJsonPath = path.join(rootPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      const scripts = packageJson.scripts || {};

      return {
        hasValidateScript: 'validate' in scripts,
        hasBuildScript: 'build' in scripts,
        hasSetupScript: 'setup' in scripts
      };
    } catch {
      return {
        hasValidateScript: false,
        hasBuildScript: false,
        hasSetupScript: false
      };
    }
  }

  /**
   * Clear cached project info
   */
  clearCache(): void {
    this.cachedInfo = undefined;
    this.cacheTime = undefined;
  }

  private cacheResult(info: ProjectInfo): ProjectInfo {
    this.cachedInfo = info;
    this.cacheTime = Date.now();
    return info;
  }
}
