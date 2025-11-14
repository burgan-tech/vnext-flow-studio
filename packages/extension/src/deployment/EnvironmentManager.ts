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
   */
  static getEnvironments(): Record<string, EnvironmentConfig> {
    const config = vscode.workspace.getConfiguration(this.SETTINGS_KEY);
    const environments = config.get<Record<string, EnvironmentConfig>>(this.ENVIRONMENTS_KEY);
    return environments || {};
  }

  /**
   * Get the active environment ID
   */
  static getActiveEnvironmentId(): string | undefined {
    const config = vscode.workspace.getConfiguration(this.SETTINGS_KEY);
    return config.get<string>(this.ACTIVE_ENV_KEY);
  }

  /**
   * Get the active environment configuration
   */
  static getActiveEnvironment(): EnvironmentConfig | undefined {
    const envId = this.getActiveEnvironmentId();
    if (!envId) {
      return undefined;
    }

    const environments = this.getEnvironments();
    return environments[envId];
  }

  /**
   * Set the active environment
   */
  static async setActiveEnvironment(envId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.SETTINGS_KEY);
    await config.update(this.ACTIVE_ENV_KEY, envId, vscode.ConfigurationTarget.Workspace);
  }

  /**
   * Add or update an environment
   */
  static async saveEnvironment(envConfig: EnvironmentConfig): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.SETTINGS_KEY);
    const environments = this.getEnvironments();

    environments[envConfig.id] = envConfig;

    await config.update(
      this.ENVIRONMENTS_KEY,
      environments,
      vscode.ConfigurationTarget.Workspace
    );
  }

  /**
   * Remove an environment
   */
  static async removeEnvironment(envId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.SETTINGS_KEY);
    const environments = this.getEnvironments();

    delete environments[envId];

    await config.update(
      this.ENVIRONMENTS_KEY,
      environments,
      vscode.ConfigurationTarget.Workspace
    );

    // If this was the active environment, clear it
    const activeEnvId = this.getActiveEnvironmentId();
    if (activeEnvId === envId) {
      await config.update(this.ACTIVE_ENV_KEY, undefined, vscode.ConfigurationTarget.Workspace);
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
        error: 'No environment configured. Please configure an environment in settings.'
      };
    }

    // Test API connection
    try {
      const adapter = new AmorphieRuntimeAdapter();
      const connected = await adapter.testConnection(environment);

      if (!connected) {
        return {
          ready: false,
          configured: true,
          environment,
          apiReachable: false,
          error: `Cannot connect to API at ${environment.baseUrl}`
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
        apiReachable: false,
        error: `Connection test failed: ${error instanceof Error ? error.message : String(error)}`
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
      description: `${env.baseUrl} (${env.domain})`,
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

    if (!env.domain || env.domain.trim() === '') {
      errors.push('Domain is required');
    }

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
