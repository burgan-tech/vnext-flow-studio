/**
 * Types for graph diff and violation detection
 */

import type { ComponentId, ComponentRef } from './index.js';

/**
 * Severity levels for violations
 */
export type ViolationSeverity = 'error' | 'warning' | 'info';

/**
 * Types of graph differences
 */
export type DiffType =
  | 'node-added'        // Node exists in local but not runtime
  | 'node-removed'      // Node exists in runtime but not local
  | 'node-changed'      // Node exists in both but with differences
  | 'version-drift'     // Version mismatch between local and runtime
  | 'semver-violation'  // Dependency version doesn't satisfy semver range
  | 'missing-dependency' // Referenced component doesn't exist
  | 'circular-dependency' // Circular dependency detected
  | 'api-drift'         // API hash differs (breaking change)
  | 'config-drift';     // Config hash differs

/**
 * Base violation interface
 */
export interface Violation {
  /** Violation type */
  type: DiffType;

  /** Severity level */
  severity: ViolationSeverity;

  /** Component(s) involved */
  componentIds: ComponentId[];

  /** Human-readable message */
  message: string;

  /** Additional details */
  details?: any;
}

/**
 * Node added violation (exists in local, not in runtime)
 */
export interface NodeAddedViolation extends Violation {
  type: 'node-added';
  componentIds: [ComponentId];
  details: {
    ref: ComponentRef;
    componentType: string;
  };
}

/**
 * Node removed violation (exists in runtime, not in local)
 */
export interface NodeRemovedViolation extends Violation {
  type: 'node-removed';
  componentIds: [ComponentId];
  details: {
    ref: ComponentRef;
    componentType: string;
  };
}

/**
 * Node changed violation (exists in both but differs)
 */
export interface NodeChangedViolation extends Violation {
  type: 'node-changed';
  componentIds: [ComponentId];
  details: {
    ref: ComponentRef;
    changes: string[];
  };
}

/**
 * Version drift violation
 */
export interface VersionDriftViolation extends Violation {
  type: 'version-drift';
  componentIds: [ComponentId];
  details: {
    ref: ComponentRef;
    localVersion: string;
    runtimeVersion: string;
  };
}

/**
 * Semver violation (dependency version doesn't satisfy range)
 */
export interface SemverViolation extends Violation {
  type: 'semver-violation';
  componentIds: [ComponentId, ComponentId]; // [dependent, dependency]
  details: {
    dependent: ComponentRef;
    dependency: ComponentRef;
    requiredRange: string;
    actualVersion: string;
  };
}

/**
 * Missing dependency violation
 */
export interface MissingDependencyViolation extends Violation {
  type: 'missing-dependency';
  componentIds: [ComponentId]; // The dependent component
  details: {
    dependent: ComponentRef;
    missingRef: ComponentRef;
    dependencyType: string;
  };
}

/**
 * Circular dependency violation
 */
export interface CircularDependencyViolation extends Violation {
  type: 'circular-dependency';
  componentIds: ComponentId[]; // All components in the cycle
  details: {
    cycle: ComponentRef[];
    cyclePath: string; // Human-readable path like "A → B → C → A"
  };
}

/**
 * API drift violation (breaking change detected)
 */
export interface ApiDriftViolation extends Violation {
  type: 'api-drift';
  componentIds: [ComponentId];
  details: {
    ref: ComponentRef;
    localHash: string;
    runtimeHash: string;
  };
}

/**
 * Config drift violation
 */
export interface ConfigDriftViolation extends Violation {
  type: 'config-drift';
  componentIds: [ComponentId];
  details: {
    ref: ComponentRef;
    localHash: string;
    runtimeHash: string;
  };
}

/**
 * Union type for all violations
 */
export type AnyViolation =
  | NodeAddedViolation
  | NodeRemovedViolation
  | NodeChangedViolation
  | VersionDriftViolation
  | SemverViolation
  | MissingDependencyViolation
  | CircularDependencyViolation
  | ApiDriftViolation
  | ConfigDriftViolation;

/**
 * Graph delta result
 */
export interface GraphDelta {
  /** All detected violations */
  violations: AnyViolation[];

  /** Violations grouped by severity */
  bySeverity: {
    error: AnyViolation[];
    warning: AnyViolation[];
    info: AnyViolation[];
  };

  /** Statistics */
  stats: {
    totalViolations: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    nodesAdded: number;
    nodesRemoved: number;
    nodesChanged: number;
  };

  /** Timestamp when diff was computed */
  timestamp: number;

  /** Metadata */
  metadata?: {
    localGraphSource?: string;
    runtimeGraphSource?: string;
    environmentId?: string;
    [key: string]: any;
  };
}
