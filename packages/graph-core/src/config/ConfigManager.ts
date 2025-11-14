/**
 * Multi-source configuration manager with precedence
 * Precedence order: 1. VS Code settings (highest)
 *                    2. Environment files (.env)
 *                    3. CLI integration (lowest)
 */

import type {
  GraphConfig,
  EnvironmentConfig,
  ConfigSource,
  ConfigWithSource
} from '../types/config.js';

/**
 * Configuration manager
 */
export class ConfigManager {
  private config: GraphConfig;
  private sources: Map<string, ConfigSource> = new Map();

  constructor() {
    this.config = {
      environments: {},
      cache: {
        enabled: true,
        ttlMs: 300000 // 5 minutes
      },
      sources: {
        vscodeSettings: true,
        envFiles: true,
        cliIntegration: true
      }
    };
  }

  /**
   * Load configuration from all sources
   */
  async load(options?: {
    workspaceRoot?: string;
    vscodeSettings?: any;
  }): Promise<void> {
    const { workspaceRoot, vscodeSettings } = options || {};

    // Load from CLI integration (lowest priority)
    if (this.config.sources?.cliIntegration) {
      await this.loadFromCliIntegration(workspaceRoot);
    }

    // Load from environment files (medium priority)
    if (this.config.sources?.envFiles) {
      await this.loadFromEnvFiles(workspaceRoot);
    }

    // Load from VS Code settings (highest priority)
    if (this.config.sources?.vscodeSettings && vscodeSettings) {
      this.loadFromVSCodeSettings(vscodeSettings);
    }
  }

  /**
   * Load configuration from VS Code settings
   */
  private loadFromVSCodeSettings(settings: any): void {
    if (!settings) {
      return;
    }

    // Load environments
    const environments = settings.get?.('amorphie.environments') || settings['amorphie.environments'];
    if (environments) {
      for (const [envId, envConfig] of Object.entries(environments)) {
        this.config.environments[envId] = envConfig as EnvironmentConfig;
        this.sources.set(`env:${envId}`, 'vscode-settings');
      }
    }

    // Load active environment
    const activeEnvironment = settings.get?.('amorphie.activeEnvironment') || settings['amorphie.activeEnvironment'];
    if (activeEnvironment) {
      this.config.activeEnvironment = activeEnvironment;
      this.sources.set('activeEnvironment', 'vscode-settings');
    }

    // Load cache settings
    const cacheEnabled = settings.get?.('amorphie.cache.enabled');
    const cacheTtlMs = settings.get?.('amorphie.cache.ttlMs');

    if (!this.config.cache) {
      this.config.cache = { enabled: true, ttlMs: 300000 };
    }

    if (cacheEnabled !== undefined || settings['amorphie.cache.enabled'] !== undefined) {
      this.config.cache.enabled = cacheEnabled ?? settings['amorphie.cache.enabled'] ?? true;
    }

    if (cacheTtlMs !== undefined || settings['amorphie.cache.ttlMs'] !== undefined) {
      this.config.cache.ttlMs = cacheTtlMs ?? settings['amorphie.cache.ttlMs'] ?? 300000;
    }

    if (cacheEnabled !== undefined || cacheTtlMs !== undefined) {
      this.sources.set('cache', 'vscode-settings');
    }
  }

  /**
   * Load configuration from .env files
   */
  private async loadFromEnvFiles(workspaceRoot?: string): Promise<void> {
    if (!workspaceRoot) {
      return;
    }

    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Try to load .env file
      const envPath = path.join(workspaceRoot, '.env');

      try {
        const content = await fs.readFile(envPath, 'utf-8');
        const env = this.parseEnvFile(content);

        // Extract environment configurations
        // Expected format:
        // AMORPHIE_ENV_DEV_URL=https://dev.example.com
        // AMORPHIE_ENV_DEV_DOMAIN=core
        // AMORPHIE_ENV_DEV_AUTH_TOKEN=xxx

        const envConfigs = this.extractEnvironmentsFromEnv(env);

        for (const [envId, envConfig] of Object.entries(envConfigs)) {
          // Only set if not already set by higher priority source
          if (!this.sources.has(`env:${envId}`) || this.sources.get(`env:${envId}`) !== 'vscode-settings') {
            this.config.environments[envId] = envConfig;
            this.sources.set(`env:${envId}`, 'env-file');
          }
        }

        // Get active environment
        if (env.AMORPHIE_ACTIVE_ENV && !this.sources.has('activeEnvironment')) {
          this.config.activeEnvironment = env.AMORPHIE_ACTIVE_ENV;
          this.sources.set('activeEnvironment', 'env-file');
        }
      } catch {
        // .env file doesn't exist - that's okay
      }

      // Try to load .env.local file (overrides .env)
      const envLocalPath = path.join(workspaceRoot, '.env.local');

      try {
        const content = await fs.readFile(envLocalPath, 'utf-8');
        const env = this.parseEnvFile(content);
        const envConfigs = this.extractEnvironmentsFromEnv(env);

        for (const [envId, envConfig] of Object.entries(envConfigs)) {
          if (!this.sources.has(`env:${envId}`) || this.sources.get(`env:${envId}`) !== 'vscode-settings') {
            this.config.environments[envId] = envConfig;
            this.sources.set(`env:${envId}`, 'env-file');
          }
        }

        if (env.AMORPHIE_ACTIVE_ENV && !this.sources.has('activeEnvironment')) {
          this.config.activeEnvironment = env.AMORPHIE_ACTIVE_ENV;
          this.sources.set('activeEnvironment', 'env-file');
        }
      } catch {
        // .env.local doesn't exist - that's okay
      }
    } catch {
      // Error loading env files - ignore
    }
  }

  /**
   * Load configuration from CLI integration (vnext-workflow-cli)
   */
  private async loadFromCliIntegration(workspaceRoot?: string): Promise<void> {
    if (!workspaceRoot) {
      return;
    }

    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Try to load vnext-workflow-cli config
      const cliConfigPath = path.join(workspaceRoot, '.vnext', 'config.json');

      try {
        const content = await fs.readFile(cliConfigPath, 'utf-8');
        const cliConfig = JSON.parse(content);

        // Extract environment configurations from CLI config
        if (cliConfig.environments) {
          for (const [envId, envConfig] of Object.entries(cliConfig.environments)) {
            // Only set if not already set by higher priority source
            if (!this.sources.has(`env:${envId}`)) {
              this.config.environments[envId] = envConfig as EnvironmentConfig;
              this.sources.set(`env:${envId}`, 'cli-integration');
            }
          }
        }

        // Get active environment
        if (cliConfig.activeEnvironment && !this.sources.has('activeEnvironment')) {
          this.config.activeEnvironment = cliConfig.activeEnvironment;
          this.sources.set('activeEnvironment', 'cli-integration');
        }
      } catch {
        // CLI config doesn't exist - that's okay
      }
    } catch {
      // Error loading CLI config - ignore
    }
  }

  /**
   * Parse .env file content
   */
  private parseEnvFile(content: string): Record<string, string> {
    const env: Record<string, string> = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse key=value
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        env[key] = value;
      }
    }

    return env;
  }

  /**
   * Extract environment configurations from environment variables
   */
  private extractEnvironmentsFromEnv(env: Record<string, string>): Record<string, EnvironmentConfig> {
    const environments: Record<string, EnvironmentConfig> = {};

    // Find all environment IDs
    const envIds = new Set<string>();
    for (const key of Object.keys(env)) {
      const match = key.match(/^AMORPHIE_ENV_([^_]+)_/);
      if (match) {
        envIds.add(match[1].toLowerCase());
      }
    }

    // Build environment configs
    for (const envId of envIds) {
      const prefix = `AMORPHIE_ENV_${envId.toUpperCase()}_`;

      const config: EnvironmentConfig = {
        id: envId,
        name: env[`${prefix}NAME`] || envId,
        baseUrl: env[`${prefix}URL`] || '',
        domain: env[`${prefix}DOMAIN`] || 'core'
      };

      // Add auth if present
      if (env[`${prefix}AUTH_TOKEN`]) {
        config.auth = {
          type: 'bearer',
          token: env[`${prefix}AUTH_TOKEN`]
        };
      } else if (env[`${prefix}AUTH_USERNAME`] && env[`${prefix}AUTH_PASSWORD`]) {
        config.auth = {
          type: 'basic',
          username: env[`${prefix}AUTH_USERNAME`],
          password: env[`${prefix}AUTH_PASSWORD`]
        };
      }

      // Add optional settings
      if (env[`${prefix}TIMEOUT`]) {
        config.timeout = parseInt(env[`${prefix}TIMEOUT`], 10);
      }

      if (env[`${prefix}VERIFY_SSL`]) {
        config.verifySsl = env[`${prefix}VERIFY_SSL`] === 'true';
      }

      environments[envId] = config;
    }

    return environments;
  }

  /**
   * Get complete configuration
   */
  getConfig(): GraphConfig {
    return this.config;
  }

  /**
   * Get specific environment configuration
   */
  getEnvironment(envId: string): EnvironmentConfig | undefined {
    return this.config.environments[envId];
  }

  /**
   * Get active environment configuration
   */
  getActiveEnvironment(): EnvironmentConfig | undefined {
    if (!this.config.activeEnvironment) {
      return undefined;
    }
    return this.config.environments[this.config.activeEnvironment];
  }

  /**
   * Get all environment configurations
   */
  getAllEnvironments(): Record<string, EnvironmentConfig> {
    return this.config.environments;
  }

  /**
   * Set environment configuration
   */
  setEnvironment(envId: string, config: EnvironmentConfig, source: ConfigSource = 'vscode-settings'): void {
    this.config.environments[envId] = config;
    this.sources.set(`env:${envId}`, source);
  }

  /**
   * Set active environment
   */
  setActiveEnvironment(envId: string, source: ConfigSource = 'vscode-settings'): void {
    this.config.activeEnvironment = envId;
    this.sources.set('activeEnvironment', source);
  }

  /**
   * Get source of a configuration value
   */
  getSource(key: string): ConfigSource | undefined {
    return this.sources.get(key);
  }

  /**
   * Save configuration to VS Code settings
   */
  async saveToVSCodeSettings(updateSettings: (key: string, value: any) => Promise<void>): Promise<void> {
    await updateSettings('amorphie.environments', this.config.environments);
    await updateSettings('amorphie.activeEnvironment', this.config.activeEnvironment);

    if (this.config.cache) {
      await updateSettings('amorphie.cache.enabled', this.config.cache.enabled);
      await updateSettings('amorphie.cache.ttlMs', this.config.cache.ttlMs);
    }
  }

  /**
   * Save configuration to .env file
   */
  async saveToEnvFile(workspaceRoot: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const lines: string[] = [];

    // Add header
    lines.push('# Amorphie Flow Studio - Graph Configuration');
    lines.push('');

    // Add active environment
    if (this.config.activeEnvironment) {
      lines.push(`AMORPHIE_ACTIVE_ENV=${this.config.activeEnvironment}`);
      lines.push('');
    }

    // Add environments
    for (const [envId, envConfig] of Object.entries(this.config.environments)) {
      const prefix = `AMORPHIE_ENV_${envId.toUpperCase()}_`;

      lines.push(`# ${envConfig.name || envId}`);
      lines.push(`${prefix}URL=${envConfig.baseUrl}`);
      lines.push(`${prefix}DOMAIN=${envConfig.domain}`);

      if (envConfig.auth) {
        if (envConfig.auth.type === 'bearer' && envConfig.auth.token) {
          lines.push(`${prefix}AUTH_TOKEN=${envConfig.auth.token}`);
        } else if (envConfig.auth.type === 'basic' && envConfig.auth.username && envConfig.auth.password) {
          lines.push(`${prefix}AUTH_USERNAME=${envConfig.auth.username}`);
          lines.push(`${prefix}AUTH_PASSWORD=${envConfig.auth.password}`);
        }
      }

      if (envConfig.timeout) {
        lines.push(`${prefix}TIMEOUT=${envConfig.timeout}`);
      }

      if (envConfig.verifySsl !== undefined) {
        lines.push(`${prefix}VERIFY_SSL=${envConfig.verifySsl}`);
      }

      lines.push('');
    }

    const content = lines.join('\n');
    const envPath = path.join(workspaceRoot, '.env.local');

    await fs.writeFile(envPath, content, 'utf-8');
  }
}
