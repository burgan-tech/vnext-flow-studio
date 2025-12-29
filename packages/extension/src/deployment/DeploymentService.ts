/**
 * Deployment Service
 * Handles workflow deployment to the Amorphie runtime API
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  AmorphieRuntimeAdapter,
  buildLocalGraph,
  getNode,
  getTransitiveDependencies,
  getDeploymentOrder as _getDeploymentOrder,
  toComponentId
} from '@amorphie-flow-studio/graph-core';
import type { GraphNode, ComponentRef, ComponentType } from '@amorphie-flow-studio/graph-core';
import { DeploymentNormalizer } from '@amorphie-flow-studio/core';
import type { ComponentResolver } from '@amorphie-flow-studio/core';
import type { EnvironmentConfig } from '@amorphie-flow-studio/graph-core';
import type { Workflow } from '@amorphie-flow-studio/core';
import type {
  DeploymentRequest,
  BatchDeploymentRequest,
  DeploymentResult,
  BatchDeploymentResult,
  DeploymentProgress as _DeploymentProgress,
  DeploymentProgressCallback,
  ChangeDetectionResult,
  ComponentChangeStatus
} from './types.js';
import { getInstanceInfo, getInstanceId as _getInstanceId, deleteWorkflowInstance } from './DatabaseCleanup.js';
import { getComponentDataBatch } from './DatabaseQuery.js';
import { compareContent, extractAttributes } from './ContentComparison.js';
import { filterDesignTimeAttributes } from './DesignTimeFilter.js';

/**
 * Deployment service for workflows
 */
export class DeploymentService {
  private adapter: AmorphieRuntimeAdapter;
  private normalizer: DeploymentNormalizer;
  private componentsPreloaded: boolean = false;

  constructor(
    private componentResolver: ComponentResolver,
    private outputChannel?: vscode.OutputChannel
  ) {
    this.adapter = new AmorphieRuntimeAdapter();
    this.normalizer = new DeploymentNormalizer(componentResolver);
  }

  /**
   * Discover dependencies for a workflow file
   * Returns list of all components that need to be deployed (in dependency order)
   */
  async discoverDependencies(
    workflow: Workflow,
    workspaceRoot: string
  ): Promise<{ workflow: GraphNode; dependencies: GraphNode[] }> {
    this.log(`Discovering dependencies for ${workflow.key}...`);
    this.log(`Workspace root: ${workspaceRoot}`);
    this.log(`Workflow info - domain: ${workflow.domain}, flow: ${workflow.flow}, key: ${workflow.key}, version: ${workflow.version}`);

    // Build local graph from workspace
    const graph = await buildLocalGraph({
      basePath: workspaceRoot,
      computeHashes: false
    });

    this.log(`Graph built with ${graph.nodes.size} nodes`);

    // Log all workflow nodes for debugging
    const workflowNodes = Array.from(graph.nodes.values()).filter(n => n.type === 'workflow');
    this.log(`Found ${workflowNodes.length} workflows in graph:`);
    workflowNodes.forEach(n => {
      this.log(`  - ${n.id} (domain: ${n.ref.domain}, flow: ${n.ref.flow}, key: ${n.ref.key})`);
    });

    // Create component ref for the workflow
    const ref: ComponentRef = {
      domain: workflow.domain,
      flow: workflow.flow || 'sys-flows',
      key: workflow.key,
      version: workflow.version
    };

    const workflowId = toComponentId(ref);
    this.log(`Looking for workflow with ID: ${workflowId}`);

    const workflowNode = getNode(graph, workflowId);

    if (!workflowNode) {
      this.log(`Warning: Workflow ${workflow.key} not found in local graph`);
      return { workflow: workflowNode!, dependencies: [] };
    }

    // Debug: check outgoing edges
    const edges = graph.outgoingEdges.get(workflowId) || [];
    this.log(`Workflow has ${edges.length} outgoing edges`);
    if (edges.length > 0) {
      edges.forEach(e => this.log(`  Edge: ${e.from} -> ${e.to} (type: ${e.type})`));
    }

    // Get all transitive dependencies
    const allDeps = getTransitiveDependencies(graph, workflowId);

    this.log(`Found ${allDeps.length} dependencies for ${workflow.key}`);

    // Log dependency tree
    if (allDeps.length > 0) {
      this.log('Dependency tree:');
      allDeps.forEach(dep => {
        this.log(`  - ${dep.type}: ${dep.ref.domain}/${dep.ref.flow}/${dep.ref.key}@${dep.ref.version}`);
      });
    }

    return {
      workflow: workflowNode,
      dependencies: allDeps
    };
  }

  /**
   * Deploy a workflow with all its dependencies
   */
  async deployWithDependencies(
    request: DeploymentRequest,
    workspaceRoot: string,
    onProgress?: DeploymentProgressCallback
  ): Promise<BatchDeploymentResult> {
    // Determine the correct base path by finding where the Workflows directory is
    // The workflow file path might be like: /workspace/domain/Workflows/file.json
    // We need to find the parent directory that contains Workflows/
    const pathModule = await import('path');

    let basePath = workspaceRoot;

    // Check if workflow file path gives us a better base path
    if (request.filePath.includes('/Workflows/') || request.filePath.includes('/workflows/')) {
      // Extract the base path from the workflow file path
      const workflowPathParts = request.filePath.split('/');
      const workflowsDirIndex = workflowPathParts.findIndex(p =>
        p === 'Workflows' || p === 'workflows' || p === 'flows'
      );

      if (workflowsDirIndex > 0) {
        basePath = workflowPathParts.slice(0, workflowsDirIndex).join('/');
        this.log(`Detected base path from workflow file: ${basePath}`);
      }
    }

    // Verify that the base path has component directories
    const hasWorkflowsDir = await this.directoryExists(pathModule.join(basePath, 'Workflows')) ||
                            await this.directoryExists(pathModule.join(basePath, 'workflows')) ||
                            await this.directoryExists(pathModule.join(basePath, 'flows'));

    if (!hasWorkflowsDir) {
      this.log(`Warning: No Workflows directory found at ${basePath}, using workspace root ${workspaceRoot}`);
      basePath = workspaceRoot;
    }

    // Load vnext.config.json to get authoritative domain
    const { findVNextConfig } = await import('@amorphie-flow-studio/core');
    const configResult = await findVNextConfig(basePath);
    let authoritativeDomain: string | undefined;

    if (configResult.success && configResult.config?.domain) {
      authoritativeDomain = configResult.config.domain;
      this.log(`Loaded authoritative domain from vnext.config.json: ${authoritativeDomain}`);

      // Override main workflow domain if needed
      if (request.component.domain !== authoritativeDomain) {
        this.log(`⚠️  Main workflow domain mismatch: "${request.component.domain}" → "${authoritativeDomain}"`);
        request.component.domain = authoritativeDomain;
      }
    }

    // Report progress: discovering dependencies
    onProgress?.({
      step: 'normalizing',
      current: 0,
      total: 1,
      workflow: {
        key: request.component.key,
        domain: request.component.domain,
        filePath: request.filePath
      },
      message: 'Discovering dependencies...',
      percentage: 5
    });

    // Discover dependencies
    const { workflow: workflowNode, dependencies } = await this.discoverDependencies(
      request.component,
      basePath
    );

    // If workflow not found in graph, deploy just the workflow
    if (!workflowNode) {
      this.log('Workflow not found in graph, deploying without dependencies');
      const result = await this.deploySingle(request, onProgress);
      return {
        success: result.success,
        total: 1,
        succeeded: result.success ? 1 : 0,
        failed: result.success ? 0 : 1,
        results: [result]
      };
    }

    // Deploy ALL dependencies (tasks, schemas, views, functions, workflows)
    this.log(`Found ${dependencies.length} dependencies to deploy`);

    // Build deployment requests for all dependencies
    const deploymentRequests: DeploymentRequest[] = [];

    // Add all dependency deployment requests
    for (const dep of dependencies) {
      // Get file path from metadata
      const filePath = dep.metadata?.filePath as string | undefined;

      if (!filePath) {
        this.log(`Warning: No file path for ${dep.type} ${dep.ref.key}, skipping`);
        continue;
      }

      // Use the graph node's definition (already normalized with correct versions)
      // Graph stores: ref (key, domain, flow, version) + definition (attributes)
      // Reconstruct full component for deployment
      const component = {
        key: dep.ref.key,
        domain: authoritativeDomain || dep.ref.domain,  // Use authoritative domain if available
        flow: dep.ref.flow,
        version: dep.ref.version,  // ← Correct version from graph!
        attributes: dep.definition  // Already normalized
      };

      // Log domain override for dependencies if applicable
      if (authoritativeDomain && dep.ref.domain !== authoritativeDomain) {
        this.log(`  └─ Dependency ${dep.type} "${dep.ref.key}": domain "${dep.ref.domain}" → "${authoritativeDomain}"`);
      }

      deploymentRequests.push({
        component: component,
        environment: request.environment,
        filePath
      });
    }

    // Add the main workflow last (after all dependencies)
    deploymentRequests.push(request);

    this.log(`Collected ${deploymentRequests.length} components (${dependencies.length} dependencies + 1 main workflow)`);

    // Determine deployment strategy
    const isForceDeployment = request.force === true;
    let filteredDeploymentRequests = deploymentRequests;

    if (isForceDeployment) {
      this.log('🔴 FORCE DEPLOYMENT - Deploying entire dependency tree');
      this.log(`  Skipping change detection, deploying all ${deploymentRequests.length} components (${dependencies.length} dependencies + main workflow)`);
      // Deploy all components regardless of changes
      filteredDeploymentRequests = deploymentRequests;
    } else {
      // Detect changes before deployment
      onProgress?.({
        step: 'validating',
        current: 0,
        total: deploymentRequests.length,
        message: 'Detecting changes...',
        percentage: 10
      });

      const changeDetection = await this.detectChanges(deploymentRequests, request.environment);

      // Log change detection summary
      const totalToSkip = changeDetection.toSkip.length;
      const totalToChange = changeDetection.toDeploy.length;
      const totalNew = changeDetection.newComponents.length;

      this.log(`Change detection complete: ${totalToSkip} unchanged, ${totalToChange} changed, ${totalNew} new`);

      // Log skipped components
      if (totalToSkip > 0) {
        this.log(`Skipping ${totalToSkip} unchanged components:`);
        changeDetection.toSkip.forEach(comp => {
          this.log(`  ✓ ${comp.key} (${comp.reason})`);
        });
      }

      // Log changed components
      if (totalToChange > 0) {
        this.log(`Deploying ${totalToChange} changed components:`);
        changeDetection.toDeploy.forEach(comp => {
          this.log(`  → ${comp.key} (${comp.reason})`);
        });
      }

      // Log new components
      if (totalNew > 0) {
        this.log(`Deploying ${totalNew} new components:`);
        changeDetection.newComponents.forEach(comp => {
          this.log(`  → ${comp.key} (${comp.reason})`);
        });
      }

      // Filter deployment requests to only include components with changes or new components
      const componentsToDeployKeys = new Set([
        ...changeDetection.toDeploy.map(c => c.key),
        ...changeDetection.newComponents.map(c => c.key)
      ]);

      filteredDeploymentRequests = deploymentRequests.filter(req =>
        componentsToDeployKeys.has(req.component.key)
      );

      // If no components need deployment, return early
      if (filteredDeploymentRequests.length === 0) {
        this.log('');
        this.log('═══════════════════════════════════════════════════════');
        this.log(`✓ All ${totalToSkip} components are up to date!`);
        this.log('  No deployment needed.');
        this.log('═══════════════════════════════════════════════════════');
        return {
          success: true,
          total: 0,  // Only count components that were actually deployed
          succeeded: 0,
          failed: 0,
          results: []  // Don't include skipped components in results
        };
      }
    }

    this.log(`Deploying ${filteredDeploymentRequests.length} components`);

    // Deploy filtered components using batch deployment
    return await this.deployBatch(
      {
        components: filteredDeploymentRequests,
        environment: request.environment
      },
      onProgress
    );
  }

  /**
   * Deploy a single workflow
   */
  async deploySingle(
    request: DeploymentRequest,
    onProgress?: DeploymentProgressCallback
  ): Promise<DeploymentResult> {
    const workspaceRoot = path.dirname(request.filePath);

    // Determine component type from flow
    const componentType = this.getComponentType(request.component.flow);
    const isWorkflow = componentType === 'workflow';

    // Only normalize workflows (tasks, schemas, views don't need normalization)
    let componentToDeploy = request.component;

    if (isWorkflow) {
      // Report progress: normalizing
      onProgress?.({
        step: 'normalizing',
        current: 0,
        total: 1,
        workflow: {
          key: request.component.key,
          domain: request.component.domain,
          filePath: request.filePath
        },
        message: `Normalizing ${request.component.key}...`,
        percentage: 10
      });

      // Find the project root (where vnext.config.json is located)
      // This ensures we search for components in the correct project
      const { findVNextConfig } = await import('@amorphie-flow-studio/core');
      const configResult = await findVNextConfig(path.dirname(request.filePath));

      let projectRoot = workspaceRoot;
      if (configResult.success && configResult.configPath) {
        projectRoot = path.dirname(configResult.configPath);
        this.log(`Found project root via vnext.config.json: ${projectRoot}`);

        // Extract and apply authoritative domain from vnext.config.json
        if (configResult.config?.domain) {
          const authoritativeDomain = configResult.config.domain;
          this.log(`Authoritative domain from vnext.config.json: ${authoritativeDomain}`);

          // Override component domain if it differs
          if (request.component.domain !== authoritativeDomain) {
            this.log(`⚠️  Domain mismatch detected!`);
            this.log(`   Component file domain: "${request.component.domain}"`);
            this.log(`   vnext.config.json domain: "${authoritativeDomain}"`);
            this.log(`   → Overriding with authoritative domain: "${authoritativeDomain}"`);
            request.component.domain = authoritativeDomain;
          }
        }

        // Update ComponentResolver basePath to the project root
        this.componentResolver.setBasePath(projectRoot);

        // Clear cache to force reload with new basePath
        this.componentResolver.clearCache();
        this.componentsPreloaded = false;
        this.log('Cache cleared for new project root');
      } else {
        this.log(`No vnext.config.json found, using workspace root: ${projectRoot}`);
      }

      // Preload all components (tasks, schemas, views, functions, extensions) into resolver cache
      // This is required for reference resolution during normalization
      if (!this.componentsPreloaded) {
        this.log('Preloading components for reference resolution...');
        this.log(`ComponentResolver basePath: ${this.componentResolver.getOptions().basePath}`);
        try {
          const preloadedComponents = await this.componentResolver.preloadAllComponents();
          this.log(`Preloaded components: ${preloadedComponents.tasks.length} tasks, ${preloadedComponents.schemas.length} schemas, ` +
            `${preloadedComponents.views.length} views, ${preloadedComponents.functions.length} functions, ` +
            `${preloadedComponents.extensions.length} extensions`);
          this.componentsPreloaded = true;
        } catch (error) {
          this.logError('Failed to preload components', error);
          // Continue anyway - normalization will report specific missing references
        }
      } else {
        this.log('Components already preloaded, skipping...');
      }

      // Normalize workflow
      this.log(`Normalizing workflow: ${request.component.key}`);
      const normalizeResult = await this.normalizer.normalize(request.component, {
        baseDir: workspaceRoot,
        validate: true,
        inlineScripts: true,
        compileMappers: true,
        failOnWarnings: false
      });

      if (!normalizeResult.success || !normalizeResult.workflow) {
        this.logError(`Normalization failed for ${request.component.key}`, normalizeResult.errors);

        return {
          success: false,
          type: componentType as 'workflow' | 'task' | 'schema' | 'view' | 'function' | 'extension',
          key: request.component.key,
          domain: request.component.domain,
          flow: request.component.flow,
          version: request.component.version,
          filePath: request.filePath,
          error: `Normalization failed: ${normalizeResult.errors.map(e => e.message).join('; ')}`,
          validationErrors: normalizeResult.errors.map(e => e.message)
        };
      }

      this.log(`Normalization complete: ${normalizeResult.stats.referencesResolved} refs resolved, ` +
        `${normalizeResult.stats.scriptsInlined} scripts inlined, ${normalizeResult.stats.mappersCompiled} mappers compiled`);

      // Report normalization stats to UI
      onProgress?.({
        step: 'deploying',
        current: 0,
        total: 1,
        workflow: {
          key: request.component.key,
          domain: request.component.domain,
          filePath: request.filePath
        },
        message: `Normalized: ${normalizeResult.stats.referencesResolved} refs, ${normalizeResult.stats.scriptsInlined} scripts, ${normalizeResult.stats.mappersCompiled} mappers`,
        percentage: 30
      });

      componentToDeploy = normalizeResult.workflow;
    } else {
      // For non-workflow components, use as-is
      this.log(`Deploying ${componentType}: ${request.component.key}`);
    }

    // Filter out design-time attributes before deployment
    this.log(`Filtering design-time attributes...`);
    componentToDeploy = filterDesignTimeAttributes(componentToDeploy);

    // Ensure domain is still correct after normalization and filtering
    // (normalization might have reset it)
    if (componentToDeploy.domain !== request.component.domain) {
      this.log(`Re-applying authoritative domain after normalization: ${request.component.domain}`);
      componentToDeploy.domain = request.component.domain;
    }

    // Clean up existing instance from database if database config is provided
    if (!request.environment.database) {
      this.log(`⚠️  WARNING: Database configuration not set for environment '${request.environment.id}'`);
      this.log(`   Skipping database cleanup. If there are existing instances, deployment may fail with 409 Conflict`);
      this.log(`   Configure database connection in Amorphie Settings to enable automatic cleanup`);
    } else {
      this.log(`Checking for existing instance in database...`);
      this.log(`  Schema: ${request.component.flow || 'sys-flows'} (converted from flow name)`);
      this.log(`  Key: ${request.component.key}`);

      onProgress?.({
        step: 'deploying',
        current: 0,
        total: 1,
        workflow: {
          key: request.component.key,
          domain: request.component.domain,
          filePath: request.filePath
        },
        message: `Cleaning up existing instance...`,
        percentage: 40
      });

      try {
        // First, query for specific version
        const instanceInfo = await getInstanceInfo(
          request.environment.database,
          request.component.flow || 'sys-flows',
          request.component.key,
          request.component.version  // Query for specific version
        );

        this.log(`Database query completed. Instance found: ${instanceInfo ? 'YES' : 'NO'}`);

        if (instanceInfo) {
          this.log(`Found existing instance ${instanceInfo.id} (Status: ${instanceInfo.status}, Version: ${request.component.version})`);
          this.log(`Deleting ${instanceInfo.status} instance ${instanceInfo.id}...`);

          const deleted = await deleteWorkflowInstance(
            request.environment.database,
            request.component.flow || 'sys-flows',
            instanceInfo.id
          );

          if (deleted) {
            this.log(`✓ Deleted ${instanceInfo.status} instance ${instanceInfo.id}`);
          } else {
            this.log(`⚠ Failed to delete ${instanceInfo.status} instance ${instanceInfo.id}`);
            this.log(`   This may cause deployment conflicts if instance exists in API`);
          }
        } else {
          // Specific version not found, but check if ANY other version exists
          // The runtime only allows ONE active instance per key (regardless of version)
          this.log(`Specific version ${request.component.version} not found in database`);
          this.log(`Checking for other versions of key "${request.component.key}"...`);

          const anyVersionInfo = await getInstanceInfo(
            request.environment.database,
            request.component.flow || 'sys-flows',
            request.component.key
            // No version parameter = gets latest version by CreatedAt
          );

          if (anyVersionInfo) {
            this.log(`Found instance with different version: ${anyVersionInfo.id} (Status: ${anyVersionInfo.status}, DB Version: ${anyVersionInfo.version || 'unknown'})`);
            this.log(`Expected version: ${request.component.version}, Found version: ${anyVersionInfo.version || 'unknown'}`);
            this.log(`Deleting to avoid 409 Conflict...`);

            const deleted = await deleteWorkflowInstance(
              request.environment.database,
              request.component.flow || 'sys-flows',
              anyVersionInfo.id
            );

            if (deleted) {
              this.log(`✓ Deleted instance ${anyVersionInfo.id}`);
            } else {
              this.log(`⚠ Failed to delete instance ${anyVersionInfo.id}`);
              this.log(`   Deployment may fail with 409 Conflict`);
            }
          } else {
            this.log(`No existing instance found in database (any version)`);
          }
        }
      } catch (error) {
        this.log(`⚠ Database cleanup failed: ${error}`);
        // Continue anyway - the API might handle it
      }
    }

    // Report progress: deploying
    onProgress?.({
      step: 'deploying',
      current: 0,
      total: 1,
      workflow: {
        key: request.component.key,
        domain: request.component.domain,
        filePath: request.filePath
      },
      message: `Deploying ${request.component.key} to ${request.environment.name || request.environment.id}...`,
      percentage: 60
    });

    // Deploy to runtime
    this.log(`Deploying to ${request.environment.baseUrl}...`);
    this.log(`Component to deploy - key: ${componentToDeploy.key}, domain: ${componentToDeploy.domain}, flow: ${componentToDeploy.flow}`);

    // Log full component structure for debugging
    this.log('Full component structure:');
    this.log(JSON.stringify({
      key: componentToDeploy.key,
      domain: componentToDeploy.domain,
      flow: componentToDeploy.flow,
      version: componentToDeploy.version,
      hasAttributes: !!componentToDeploy.attributes,
      attributesKeys: componentToDeploy.attributes ? Object.keys(componentToDeploy.attributes).slice(0, 10) : []
    }, null, 2));

    const deployResult = await this.adapter.createComponent(
      componentType,
      componentToDeploy,
      request.environment
    );

    if (!deployResult.success) {
      this.logError(`Deployment failed for ${request.component.key}`, [{ message: deployResult.error || 'Unknown error' }]);

      // Report progress: failed
      onProgress?.({
        step: 'failed',
        current: 1,
        total: 1,
        workflow: {
          key: request.component.key,
          domain: request.component.domain,
          filePath: request.filePath
        },
        message: `Failed to deploy ${request.component.key}`,
        percentage: 100
      });

      return {
        success: false,
        type: componentType as 'workflow' | 'task' | 'schema' | 'view' | 'function' | 'extension',
        key: request.component.key,
        domain: request.component.domain,
        flow: request.component.flow,
        version: request.component.version,
        filePath: request.filePath,
        error: deployResult.error
      };
    }

    this.log(`✓ Created instance: ${request.component.key} (${deployResult.instanceId})`);

    // Report progress: activating
    onProgress?.({
      step: 'deploying',
      current: 0,
      total: 1,
      workflow: {
        key: request.component.key,
        domain: request.component.domain,
        filePath: request.filePath
      },
      message: `Activating ${request.component.key}...`,
      percentage: 80
    });

    // Activate the component instance
    this.log(`Activating ${componentType} instance: ${deployResult.instanceId}...`);
    const activateResult = await this.adapter.activateComponent(
      componentType,
      deployResult.instanceId,
      request.component.flowVersion || '1.0.0',  // Flow version, not instance version
      request.component.domain,
      request.component.flow || 'sys-flows',
      request.environment
    );

    if (!activateResult.success) {
      this.logError(`Activation failed for ${request.component.key}`, [{ message: activateResult.error || 'Unknown error' }]);

      // Report progress: failed
      onProgress?.({
        step: 'failed',
        current: 1,
        total: 1,
        workflow: {
          key: request.component.key,
          domain: request.component.domain,
          filePath: request.filePath
        },
        message: `Failed to activate ${request.component.key}`,
        percentage: 100
      });

      return {
        success: false,
        type: componentType as 'workflow' | 'task' | 'schema' | 'view' | 'function' | 'extension',
        key: request.component.key,
        domain: request.component.domain,
        flow: request.component.flow,
        version: request.component.version,
        filePath: request.filePath,
        error: `Deployed but activation failed: ${activateResult.error}`,
        instanceId: deployResult.instanceId
      };
    }

    this.log(`✓ Successfully deployed and activated: ${request.component.key}`);

    // Report progress: completed
    onProgress?.({
      step: 'completed',
      current: 1,
      total: 1,
      workflow: {
        key: request.component.key,
        domain: request.component.domain,
        filePath: request.filePath
      },
      message: `Successfully deployed ${request.component.key}`,
      percentage: 100
    });

    return {
      success: true,
      type: componentType as 'workflow' | 'task' | 'schema' | 'view' | 'function' | 'extension',
      key: request.component.key,
      domain: request.component.domain,
      flow: request.component.flow,
      version: request.component.version,
      filePath: request.filePath,
      instanceId: deployResult.instanceId
    };
  }

  /**
   * Deploy multiple workflows in batch
   */
  async deployBatch(
    request: BatchDeploymentRequest,
    onProgress?: DeploymentProgressCallback
  ): Promise<BatchDeploymentResult> {
    const results: DeploymentResult[] = [];
    let succeeded = 0;
    let failed = 0;

    this.log(`Starting batch deployment of ${request.components.length} workflows...`);

    // Preload all components once before batch deployment
    // This avoids reloading for each workflow in the batch
    if (!this.componentsPreloaded) {
      this.log('Preloading components for batch deployment...');
      try {
        const preloadedComponents = await this.componentResolver.preloadAllComponents();
        this.log(`Preloaded components: ${preloadedComponents.tasks.length} tasks, ${preloadedComponents.schemas.length} schemas, ` +
          `${preloadedComponents.views.length} views, ${preloadedComponents.functions.length} functions, ` +
          `${preloadedComponents.extensions.length} extensions`);
        this.componentsPreloaded = true;
      } catch (error) {
        this.logError('Failed to preload components', error);
        // Continue anyway - normalization will report specific missing references
      }
    } else {
      this.log('Components already preloaded, skipping...');
    }

    for (let i = 0; i < request.components.length; i++) {
      const componentRequest = request.components[i];

      // Report overall progress
      onProgress?.({
        step: 'deploying',
        current: i,
        total: request.components.length,
        workflow: {
          key: componentRequest.component.key,
          domain: componentRequest.component.domain,
          filePath: componentRequest.filePath
        },
        message: `Deploying ${i + 1} of ${request.components.length}: ${componentRequest.component.key}...`,
        percentage: Math.round(((i) / request.components.length) * 100)
      });

      // Deploy single component (with its own progress callback)
      const result = await this.deploySingle(componentRequest, (_subProgress) => {
        // Don't propagate sub-progress, we're handling overall progress
      });

      results.push(result);

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    this.log(`Batch deployment complete: ${succeeded} succeeded, ${failed} failed`);

    // Reinitialize system if any deployments succeeded
    if (succeeded > 0) {
      onProgress?.({
        step: 'deploying',
        current: request.components.length,
        total: request.components.length,
        message: 'Reinitializing runtime system...',
        percentage: 95
      });

      this.log('Reinitializing runtime system...');
      const reinitResult = await this.adapter.reinitializeSystem(request.environment);

      if (!reinitResult.success) {
        this.logError('System reinitialize failed', [{ message: reinitResult.error || 'Unknown error' }]);
        this.log('⚠ Deployment succeeded but system reinitialize failed - changes may not be fully applied');
      } else {
        this.log('✓ System reinitialized successfully');
      }
    }

    // Report final progress
    onProgress?.({
      step: failed === 0 ? 'completed' : 'failed',
      current: request.components.length,
      total: request.components.length,
      message: `Deployment complete: ${succeeded} succeeded, ${failed} failed`,
      percentage: 100
    });

    return {
      success: failed === 0,
      total: request.components.length,
      succeeded,
      failed,
      results
    };
  }

  /**
   * Get component type from flow name
   */
  private getComponentType(flow: string): ComponentType {
    const lowerFlow = flow.toLowerCase();

    if (lowerFlow.includes('task')) return 'task';
    if (lowerFlow.includes('schema')) return 'schema';
    if (lowerFlow.includes('view')) return 'view';
    if (lowerFlow.includes('function')) return 'function';
    if (lowerFlow.includes('extension')) return 'extension';

    // Default to workflow
    return 'workflow';
  }

  /**
   * Log message to output channel
   */
  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = `[${timestamp}] ${message}`;
    console.log('[DeploymentService]', message);

    if (this.outputChannel) {
      this.outputChannel.appendLine(formattedMessage);
    }
  }

  /**
   * Log error to output channel
   */
  private logError(message: string, errors: Array<{ message: string }>): void {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = `[${timestamp}] ERROR: ${message}`;
    console.error('[DeploymentService]', message, errors);

    if (this.outputChannel) {
      this.outputChannel.appendLine(formattedMessage);

      errors.forEach((error) => {
        this.outputChannel!.appendLine(`  - ${error.message}`);
      });
    }
  }

  /**
   * Check if a directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Detect changes in components using hybrid approach:
   * 1. Query database for component data
   * 2. Normalize local components
   * 3. Compare content
   */
  async detectChanges(
    deploymentRequests: DeploymentRequest[],
    environment: EnvironmentConfig
  ): Promise<ChangeDetectionResult> {
    const toSkip: ComponentChangeStatus[] = [];
    const toDeploy: ComponentChangeStatus[] = [];
    const newComponents: ComponentChangeStatus[] = [];

    // Check if database config is available
    if (!environment.database) {
      this.log('Warning: No database configured, skipping change detection');
      // Treat all as "to deploy" if no database
      for (const req of deploymentRequests) {
        toDeploy.push({
          key: req.component.key,
          domain: req.component.domain,
          flow: req.component.flow,
          filePath: req.filePath,
          hasChanges: true,
          isNew: false,
          reason: 'No database configured'
        });
      }
      return { toSkip, toDeploy, newComponents, total: deploymentRequests.length };
    }

    try {
      this.log(`Checking ${deploymentRequests.length} components for changes...`);

      // Build query list with version and domain for specific component lookup
      const components = deploymentRequests.map(req => ({
        flow: req.component.flow,
        key: req.component.key,
        version: req.component.version,  // Query for this specific version
        domain: req.component.domain     // Part of component identity
      }));

      // Log what we're querying for
      this.log(`Querying database for ${components.length} components:`);
      components.forEach(c => {
        this.log(`  → ${c.domain}/${c.flow}/${c.key}@${c.version}`);
      });

      // Batch query database
      const dbData = await getComponentDataBatch(environment.database, components);

      // Log query results
      this.log(`Database query returned ${dbData.size} results`);
      for (const [mapKey, data] of dbData.entries()) {
        if (data.exists) {
          this.log(`  ✓ ${mapKey} → Found (version: ${data.version})`);
        } else {
          this.log(`  ✗ ${mapKey} → NOT FOUND`);
        }
      }

      // Check each component
      for (const req of deploymentRequests) {
        const key = req.component.key;
        const domain = req.component.domain;
        const flow = req.component.flow;
        const filePath = req.filePath;

        const dbKey = `${flow.replace(/-/g, '_')}/${key}`;
        const dbComponent = dbData.get(dbKey);

        this.log(`Checking ${key}: dbKey="${dbKey}", found=${!!dbComponent?.exists}`);

        // Component not in database - it's new
        if (!dbComponent || !dbComponent.exists) {
          newComponents.push({
            key,
            domain,
            flow,
            filePath,
            hasChanges: false,
            isNew: true,
            reason: 'New component (not in database)'
          });
          continue;
        }

        // Normalize local component
        const componentType = this.getComponentType(flow);
        const isWorkflow = componentType === 'workflow';

        let localAttributes: any;
        if (isWorkflow) {
          // Normalize workflow
          try {
            const normalizeResult = await this.normalizer.normalize(req.component, {
              baseDir: path.dirname(filePath),
              validate: false, // Skip validation for change detection
              inlineScripts: true,
              compileMappers: true,
              failOnWarnings: false
            });
            // Filter design-time attributes before comparison
            const filtered = filterDesignTimeAttributes(normalizeResult.workflow);
            localAttributes = extractAttributes(filtered);
          } catch (error) {
            this.log(`Warning: Failed to normalize ${key}, treating as changed: ${error}`);
            toDeploy.push({
              key,
              domain,
              flow,
              filePath,
              hasChanges: true,
              isNew: false,
              reason: 'Normalization failed'
            });
            continue;
          }
        } else {
          // For non-workflow components, filter design-time attributes
          const filtered = filterDesignTimeAttributes(req.component);
          localAttributes = extractAttributes(filtered);
        }

        // Reconstruct database component from separate fields
        // Database stores: data (attributes only), key, flow, version in separate columns
        let dbAttributes = null;
        if (dbComponent.data) {
          // Reconstruct full component structure for comparison
          const dbReconstructed = {
            key: dbComponent.key,
            version: dbComponent.version,
            flow: dbComponent.flow,
            domain,  // Use domain from local component for consistency
            attributes: dbComponent.data  // Data column contains only attributes
          };
          dbAttributes = extractAttributes(dbReconstructed);
        }

        // Compare content (version is already matched in database query)
        const comparison = compareContent(localAttributes, dbAttributes);

        if (comparison.identical) {
          // No changes detected
          toSkip.push({
            key,
            domain,
            flow,
            filePath,
            hasChanges: false,
            isNew: false,
            reason: 'No changes detected'
          });
        } else {
          // Changes detected
          toDeploy.push({
            key,
            domain,
            flow,
            filePath,
            hasChanges: true,
            isNew: false,
            reason: comparison.reason || 'Content differs from database'
          });
        }
      }

      // Log summary
      this.log(`Change detection complete: ${toSkip.length} unchanged, ${toDeploy.length} changed, ${newComponents.length} new`);

      return {
        toSkip,
        toDeploy,
        newComponents,
        total: deploymentRequests.length
      };
    } catch (error) {
      this.log(`Warning: Change detection failed: ${error}, deploying all components`);

      // On error, treat all as "to deploy" (fail-safe)
      for (const req of deploymentRequests) {
        toDeploy.push({
          key: req.component.key,
          domain: req.component.domain,
          flow: req.component.flow,
          filePath: req.filePath,
          hasChanges: true,
          isNew: false,
          reason: 'Change detection error'
        });
      }

      return {
        toSkip,
        toDeploy,
        newComponents,
        total: deploymentRequests.length
      };
    }
  }
}
