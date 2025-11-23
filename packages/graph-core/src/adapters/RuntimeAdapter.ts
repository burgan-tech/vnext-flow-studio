/**
 * Runtime adapter interface for fetching component graphs from deployed environments
 */

import type { Graph, ComponentType } from '../types/index.js';
import type { EnvironmentConfig } from '../types/config.js';

/**
 * Runtime adapter interface
 * Note: domain parameter is now required as it comes from vnext.config.json
 */
export interface RuntimeAdapter {
  /**
   * Fetch all components from the runtime environment
   * @param envConfig Environment configuration
   * @param domain Project domain from vnext.config.json
   * @param options Fetch options
   * @returns Graph representing deployed components
   */
  fetchGraph(
    envConfig: EnvironmentConfig,
    domain: string,
    options?: FetchGraphOptions
  ): Promise<Graph>;

  /**
   * Fetch components of a specific type
   * @param type Component type
   * @param envConfig Environment configuration
   * @param domain Project domain from vnext.config.json
   * @param options Fetch options
   * @returns Array of components
   */
  fetchComponentsByType(
    type: ComponentType,
    envConfig: EnvironmentConfig,
    domain: string,
    options?: FetchOptions
  ): Promise<any[]>;

  /**
   * Test connection to the runtime environment
   * @param envConfig Environment configuration
   * @param domain Project domain from vnext.config.json (optional, defaults to 'core')
   * @returns true if connection successful
   */
  testConnection(envConfig: EnvironmentConfig, domain?: string): Promise<boolean>;
}

/**
 * Options for fetching graph
 */
export interface FetchGraphOptions {
  /** Component types to include (default: all) */
  includeTypes?: ComponentType[];

  /** Whether to compute hashes for drift detection */
  computeHashes?: boolean;

  /** Maximum number of components to fetch per type */
  limit?: number;

  /** Filter expression (implementation-specific) */
  filter?: string;
}

/**
 * Options for fetching components
 */
export interface FetchOptions {
  /** Page number (1-based) */
  page?: number;

  /** Page size */
  pageSize?: number;

  /** Filter expression */
  filter?: string;

  /** Sort expression */
  sort?: string;
}

/**
 * Runtime API response types
 */

export interface WorkflowInstanceResponse {
  id: string;
  key: string;
  flow: string;
  domain: string;
  flowVersion: string;
  etag?: string;
  tags?: string[];
  attributes?: any; // The actual component definition
  extensions?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PagedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
