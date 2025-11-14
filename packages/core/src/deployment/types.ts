// TypeScript types for deployment normalization

import type { Workflow } from '../types/workflow';

/**
 * Normalized reference - all file refs converted to explicit references
 */
export interface NormalizedReference {
  key: string;
  domain: string;
  flow: string;
  version: string;
}

/**
 * Normalized script - location and base64-encoded code
 */
export interface NormalizedScript {
  location: string; // Original location for tracking
  code: string; // Base64-encoded content
}

/**
 * Result of normalization process
 */
export interface NormalizationResult {
  success: boolean;
  workflow?: Workflow;
  errors: NormalizationError[];
  warnings: NormalizationWarning[];
  stats: NormalizationStats;
}

/**
 * Error during normalization
 */
export interface NormalizationError {
  type: 'reference' | 'script' | 'mapper' | 'validation' | 'io';
  message: string;
  location?: string; // State key, transition key, or file path
  details?: any;
}

/**
 * Warning during normalization
 */
export interface NormalizationWarning {
  type: 'missing-script' | 'deprecated' | 'best-practice';
  message: string;
  location?: string;
}

/**
 * Statistics about normalization
 */
export interface NormalizationStats {
  referencesResolved: number;
  scriptsInlined: number;
  mappersCompiled: number;
  totalStates: number;
  totalTransitions: number;
}

/**
 * Options for normalization
 */
export interface NormalizationOptions {
  /**
   * Base directory for resolving file references
   */
  baseDir: string;

  /**
   * Whether to validate schema after normalization
   */
  validate?: boolean;

  /**
   * Whether to inline scripts (default: true)
   */
  inlineScripts?: boolean;

  /**
   * Whether to compile mappers (default: true)
   */
  compileMappers?: boolean;

  /**
   * Whether to fail on warnings (default: false)
   */
  failOnWarnings?: boolean;
}

/**
 * Context passed through normalization pipeline
 */
export interface NormalizationContext {
  options: NormalizationOptions;
  errors: NormalizationError[];
  warnings: NormalizationWarning[];
  stats: NormalizationStats;
  /**
   * Cache of resolved components to avoid duplicate resolution
   */
  componentCache: Map<string, any>;
}
