/**
 * Environment Manager
 * Manages runtime environment configuration from VS Code settings
 */

import * as vscode from 'vscode';
import type { EnvironmentConfig } from '@amorphie-flow-studio/graph-core';
import type { DeploymentStatus } from './types.js';
import { AmorphieRuntimeAdapter } from '@amorphie-flow-studio/graph-core';

/**
 * Manages environment configuration for deployments
 */
export class EnvironmentManager {
  private static readonly SETTINGS_KEY = 'amorphie';
  private static readonly ENVIRONMENTS_KEY = 'environments';
  private static readonly ACTIVE_ENV_KEY = 'activeEnvironment';

  /**
   * Get all configured environments
   * Checks both workspace and global settings (workspace takes priority)
   */
  static getEnvironments(): Record<string, EnvironmentConfig> {
    const config = vscode.workspace.getConfiguration(this.SETTINGS_KEY);
    const workspaceEnvs = config.inspect<Record<string, EnvironmentConfig>>(this.ENVIRONMENTS_KEY);

    // Merge: global first, then workspace overrides
    const globalEnvs = workspaceEnvs?.globalValue || {};
    const localEnvs = workspaceEnvs?.workspaceValue || {};
    const merged = { ...globalEnvs, ...localEnvs };

    // If neither has anything, try the plain get (covers defaults)
    if (Object.keys(merged).length === 0) {
      const environments = config.get<Record<string, EnvironmentConfig>>(this.ENVIRONMENTS_KEY);
      return environments || {};
    }

    return merged;
  }

  /**
   * Get the active environment ID
   * Checks both workspace and global settings
   */
  static getActiveEnvironmentId(): string | undefined {
    const config = vscode.workspace.getConfiguration(this.SETTINGS_KEY);
    const inspection = config.inspect<string>(this.ACTIVE_ENV_KEY);
    // Workspace value takes priority over global
    return inspection?.workspaceValue || inspection?.globalValue || config.get<string>(this.ACTIVE_ENV_KEY);
  }

  /**
   * Get the active environment configuration
   */
  static getActiveEnvironment(): EnvironmentConfig | undefined {
    const envId = this.getActiveEnvironmentId();
    if (!envId) {
      console.log('[EnvironmentManager] No active environment ID found');
      return undefined;
    }

    const environments = this.getEnvironments();
    const activeEnv = environments[envId];
    console.log(`[EnvironmentManager] Active environment ID: ${envId}`);
    console.log(`[EnvironmentManager] Active environment data:`, JSON.stringify(activeEnv, null, 2));
    return activeEnv;
  }

  /**
   * Set the active environment
   * Saves to both workspace and global so it persists across workspaces
   */
  static async setActiveEnvironment(envId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.SETTINGS_KEY);
    // Save to global (persists across workspaces)
    await config.update(this.ACTIVE_ENV_KEY, envId, vscode.ConfigurationTarget.Global);
    // Also save to workspace (overrides in this workspace)
    try {
      await config.update(this.ACTIVE_ENV_KEY, envId, vscode.ConfigurationTarget.Workspace);
    } catch {
      // Workspace update may fail if no workspace folder is open
    }
  }

  /**
   * Add or update an environment
   * Saves to both workspace and global so it persists across workspaces
   */
  static async saveEnvironment(envConfig: EnvironmentConfig): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.SETTINGS_KEY);
    const environments = this.getEnvironments();

    environments[envConfig.id] = envConfig;

    // Save to global (persists across workspaces)
    await config.update(
      this.ENVIRONMENTS_KEY,
      environments,
      vscode.ConfigurationTarget.Global
    );
    // Also save to workspace
    try {
      await config.update(
        this.ENVIRONMENTS_KEY,
        environments,
        vscode.ConfigurationTarget.Workspace
      );
    } catch {
      // Workspace update may fail if no workspace folder is open
    }
  }

  /**
   * Remove an environment
   */
  static async removeEnvironment(envId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.SETTINGS_KEY);
    const environments = this.getEnvironments();

    delete environments[envId];

    // Remove from both global and workspace
    await config.update(this.ENVIRONMENTS_KEY, environments, vscode.ConfigurationTarget.Global);
    try {
      await config.update(this.ENVIRONMENTS_KEY, environments, vscode.ConfigurationTarget.Workspace);
    } catch { /* ignore */ }

    // If this was the active environment, clear it
    const activeEnvId = this.getActiveEnvironmentId();
    if (activeEnvId === envId) {
      await config.update(this.ACTIVE_ENV_KEY, undefined, vscode.ConfigurationTarget.Global);
      try {
        await config.update(this.ACTIVE_ENV_KEY, undefined, vscode.ConfigurationTarget.Workspace);
      } catch { /* ignore */ }
    }
  }

  /**
   * Check deployment status
   */
  static async checkDeploymentStatus(): Promise<DeploymentStatus> {
    const environment = this.getActiveEnvironment();

    if (!environment) {
      return {
        ready: false,
        configured: false,
        apiReachable: false,
        error: 'No environment configured. Please configure an environment in Amorphie Settings.'
      };
    }

    // Check database configuration
    if (!environment.database) {
      return {
        ready: false,
        configured: true,
        environment,
        apiReachable: false,
        error: `Database configuration not set for environment '${environment.name || environment.id}'. Configure database connection in Amorphie Settings.`
      };
    }

    // Test API connection
    let apiReachable = false;
    try {
      const adapter = new AmorphieRuntimeAdapter();
      apiReachable = await adapter.testConnection(environment);

      if (!apiReachable) {
        return {
          ready: false,
          configured: true,
          environment,
          apiReachable: false,
          error: `Cannot connect to API at ${environment.baseUrl}`
        };
      }
    } catch (error) {
      return {
        ready: false,
        configured: true,
        environment,
        apiReachable: false,
        error: `API connection test failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }

    // Test database connection
    try {
      const { testDatabaseConnection } = await import('../deployment/DatabaseCleanup.js');
      const dbConnected = await testDatabaseConnection(environment.database);

      if (!dbConnected) {
        return {
          ready: false,
          configured: true,
          environment,
          apiReachable: true,
          error: `Cannot connect to database. Check your database configuration in Amorphie Settings.`
        };
      }

      return {
        ready: true,
        configured: true,
        environment,
        apiReachable: true
      };
    } catch (error) {
      return {
        ready: false,
        configured: true,
        environment,
        apiReachable: true,
        error: `Database connection test failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Prompt user to configure an environment
   */
  static async promptForEnvironmentConfiguration(): Promise<boolean> {
    const result = await vscode.window.showInformationMessage(
      'No deployment environment configured. Would you like to configure one now?',
      'Configure Environment',
      'Cancel'
    );

    if (result === 'Configure Environment') {
      // Open settings UI
      await vscode.commands.executeCommand('amorphie.openSettings');
      return true;
    }

    return false;
  }

  /**
   * Prompt user to select an environment
   */
  static async promptForEnvironmentSelection(): Promise<EnvironmentConfig | undefined> {
    const environments = this.getEnvironments();
    const envList = Object.values(environments);

    if (envList.length === 0) {
      await this.promptForEnvironmentConfiguration();
      return undefined;
    }

    if (envList.length === 1) {
      // Only one environment, use it
      const env = envList[0];
      await this.setActiveEnvironment(env.id);
      return env;
    }

    // Multiple environments, let user choose
    const activeEnvId = this.getActiveEnvironmentId();

    const items = envList.map((env) => ({
      label: env.name || env.id,
      description: env.baseUrl,
      detail: env.id === activeEnvId ? 'Currently active' : undefined,
      env
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select deployment environment',
      ignoreFocusOut: true
    });

    if (selected) {
      await this.setActiveEnvironment(selected.env.id);
      return selected.env;
    }

    return undefined;
  }

  /**
   * Validate environment configuration
   */
  static validateEnvironment(env: EnvironmentConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!env.id || env.id.trim() === '') {
      errors.push('Environment ID is required');
    }

    if (!env.baseUrl || env.baseUrl.trim() === '') {
      errors.push('Base URL is required');
    } else {
      try {
        new URL(env.baseUrl);
      } catch {
        errors.push('Base URL is not a valid URL');
      }
    }

    // Note: Domain is now read from vnext.config.json, not validated here

    if (env.auth) {
      if (env.auth.type === 'bearer' && !env.auth.token) {
        errors.push('Bearer token is required when using bearer authentication');
      }

      if (env.auth.type === 'basic' && (!env.auth.username || !env.auth.password)) {
        errors.push('Username and password are required when using basic authentication');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
