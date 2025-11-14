/**
 * Deployment service types
 */

import type { EnvironmentConfig } from '@amorphie-flow-studio/graph-core';
import type { Workflow } from '@amorphie-flow-studio/core';

/**
 * Deployment request for a single component (workflow, task, schema, view, function, extension)
 */
export interface DeploymentRequest {
  /** Component to deploy (workflow, task, schema, view, function, extension) */
  component: any;

  /** Original file path */
  filePath: string;

  /** Environment to deploy to */
  environment: EnvironmentConfig;

  /** Force deployment (skip change detection) */
  force?: boolean;
}

/**
 * Batch deployment request for multiple components
 */
export interface BatchDeploymentRequest {
  /** Components to deploy */
  components: DeploymentRequest[];

  /** Environment to deploy to */
  environment: EnvironmentConfig;
}

/**
 * Deployment result for a single component
 */
export interface DeploymentResult {
  /** Success flag */
  success: boolean;

  /** Component type */
  type: 'workflow' | 'task' | 'schema' | 'view' | 'function' | 'extension';

  /** Component key */
  key: string;

  /** Component domain */
  domain: string;

  /** Component flow */
  flow: string;

  /** Component version */
  version: string;

  /** File path */
  filePath: string;

  /** Instance ID from API (if successful) */
  instanceId?: string;

  /** Error message (if failed) */
  error?: string;

  /** Validation errors (if any) */
  validationErrors?: string[];
}

/**
 * Batch deployment result
 */
export interface BatchDeploymentResult {
  /** Overall success flag */
  success: boolean;

  /** Total number of workflows to deploy */
  total: number;

  /** Number of successful deployments */
  succeeded: number;

  /** Number of failed deployments */
  failed: number;

  /** Individual deployment results */
  results: DeploymentResult[];

  /** Overall error message (if any) */
  error?: string;
}

/**
 * Deployment progress event
 */
export interface DeploymentProgress {
  /** Current step */
  step: 'normalizing' | 'validating' | 'deploying' | 'completed' | 'failed';

  /** Current index (0-based) */
  current: number;

  /** Total count */
  total: number;

  /** Current workflow being deployed */
  workflow?: {
    key: string;
    domain: string;
    filePath: string;
  };

  /** Progress message */
  message: string;

  /** Progress percentage (0-100) */
  percentage: number;
}

/**
 * Deployment progress callback
 */
export type DeploymentProgressCallback = (progress: DeploymentProgress) => void;

/**
 * Deployment status check result
 */
export interface DeploymentStatus {
  /** Whether system is ready for deployment */
  ready: boolean;

  /** Whether an environment is configured */
  configured: boolean;

  /** Active environment (if configured) */
  environment?: EnvironmentConfig;

  /** API connection status */
  apiReachable: boolean;

  /** Error message (if not ready) */
  error?: string;
}

/**
 * Component file info for Git-based deployment
 */
export interface ComponentFile {
  /** File path */
  path: string;

  /** Component type (inferred from path) */
  type: 'workflow' | 'task' | 'schema' | 'view' | 'function' | 'extension';

  /** Whether file is new (not in Git) */
  isNew: boolean;

  /** Whether file is modified (in Git) */
  isModified: boolean;
}

/**
 * Change detection result for a single component
 */
export interface ComponentChangeStatus {
  /** Component key */
  key: string;

  /** Component domain */
  domain: string;

  /** Component flow */
  flow: string;

  /** File path */
  filePath: string;

  /** Whether component has changes */
  hasChanges: boolean;

  /** Whether component is new (not in database) */
  isNew: boolean;

  /** Reason for status */
  reason: string;
}

/**
 * Change detection result for batch
 */
export interface ChangeDetectionResult {
  /** Components to skip (no changes) */
  toSkip: ComponentChangeStatus[];

  /** Components to deploy (has changes) */
  toDeploy: ComponentChangeStatus[];

  /** New components (not in database) */
  newComponents: ComponentChangeStatus[];

  /** Total components checked */
  total: number;
}
