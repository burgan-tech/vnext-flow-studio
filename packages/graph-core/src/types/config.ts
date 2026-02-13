/**
 * Configuration types for the graph system
 */

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** Auth type */
  type: 'bearer' | 'basic' | 'none';

  /** Bearer token or basic auth token */
  token?: string;

  /** Username for basic auth */
  username?: string;

  /** Password for basic auth */
  password?: string;
}

/**
 * Database configuration for direct cleanup operations
 */
export interface DatabaseConfig {
  /** Database host (if not using Docker) */
  host?: string;

  /** Database port (if not using Docker) */
  port?: number;

  /** Database name */
  database: string;

  /** Database user */
  user: string;

  /** Database password */
  password: string;

  /** Whether to use Docker exec instead of direct connection */
  useDocker?: boolean;

  /** Docker container name (if useDocker is true) */
  dockerContainer?: string;
}

/**
 * Monitoring / analytics database configuration (ClickHouse)
 * Used by Instance Monitor to query transition history
 */
export interface MonitoringConfig {
  /** ClickHouse HTTP endpoint (e.g. http://localhost:8123) */
  clickhouseUrl?: string;

  /** ClickHouse database name (default: workflow_analytics) */
  clickhouseDatabase?: string;

  /** ClickHouse user (default: default) */
  clickhouseUser?: string;

  /** ClickHouse password */
  clickhousePassword?: string;
}

/**
 * Environment configuration
 * Note: Domain is now read from vnext.config.json, not from environment settings
 */
export interface EnvironmentConfig {
  /** Unique environment identifier */
  id: string;

  /** Display name */
  name?: string;

  /** Base URL for the runtime API */
  baseUrl: string;

  /** Authentication config */
  auth?: AuthConfig;

  /** Additional headers */
  headers?: Record<string, string>;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Whether to verify SSL certificates */
  verifySsl?: boolean;

  /** Database config for direct cleanup (optional) */
  database?: DatabaseConfig;

  /** Monitoring / analytics config (ClickHouse) for instance monitoring */
  monitoring?: MonitoringConfig;
}

/**
 * Multi-source configuration with precedence
 */
export interface GraphConfig {
  /** Environments (from all sources merged) */
  environments: Record<string, EnvironmentConfig>;

  /** Active environment ID */
  activeEnvironment?: string;

  /** Graph cache settings */
  cache?: {
    enabled: boolean;
    ttlMs: number;
  };

  /** Source precedence configuration */
  sources?: {
    vscodeSettings: boolean;
    envFiles: boolean;
    cliIntegration: boolean;
  };
}

/**
 * Config source type
 */
export type ConfigSource = 'vscode-settings' | 'env-file' | 'cli-integration';

/**
 * Config with source information
 */
export interface ConfigWithSource<T = any> {
  value: T;
  source: ConfigSource;
}
