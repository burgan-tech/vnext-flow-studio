// Model loader for loading workflow models from filesystem

import * as path from 'path';
import * as fs from 'fs/promises';
import { WorkflowModel } from './WorkflowModel.js';
import type { ModelLoadOptions } from './types.js';
import type { Workflow, Diagram } from '../types/index.js';

/**
 * Options for discovering workflow files
 */
export interface DiscoveryOptions {
  /** Root directory to search in */
  rootDir: string;
  /** Maximum depth to search */
  maxDepth?: number;
  /** Include pattern for workflow files */
  includePattern?: RegExp;
  /** Exclude pattern for directories */
  excludePattern?: RegExp;
}

/**
 * Discovered workflow file information
 */
export interface DiscoveredWorkflow {
  /** Path to the workflow file */
  workflowPath: string;
  /** Path to the diagram file (if exists) */
  diagramPath?: string;
  /** Workflow key */
  key: string;
  /** Workflow domain */
  domain: string;
  /** Workflow version */
  version: string;
  /** Workflow flow */
  flow: string;
  /** Whether diagram exists */
  hasDiagram: boolean;
  /** File size */
  size: number;
  /** Last modified date */
  lastModified: Date;
}

/**
 * Loads workflow models from the filesystem
 */
export class ModelLoader {
  /**
   * Load a workflow model from a file
   */
  static async loadFromFile(
    workflowPath: string,
    options: ModelLoadOptions = {}
  ): Promise<WorkflowModel> {
    // Validate file exists
    try {
      await fs.access(workflowPath);
    } catch {
      throw new Error(`Workflow file not found: ${workflowPath}`);
    }

    // Validate it's a workflow file
    if (!workflowPath.endsWith('.json')) {
      throw new Error(`Not a workflow file: ${workflowPath}`);
    }

    // Create model and load it
    const basePath = options.basePath || path.dirname(workflowPath);
    const model = new WorkflowModel(workflowPath, basePath, options.componentResolver);
    await model.load(options);

    return model;
  }

  /**
   * Load a workflow from JSON data (without file)
   */
  static async loadFromData(
    workflow: Workflow,
    options: ModelLoadOptions & { workflowPath?: string; diagram?: Diagram } = {}
  ): Promise<WorkflowModel> {
    const workflowPath = options.workflowPath || 'memory://workflow.flow.json';
    const basePath = options.basePath || process.cwd();

    // Create a custom model that doesn't read from file
    const model = new WorkflowModel(workflowPath, basePath, options.componentResolver);

    // Inject the workflow data directly
    const state = model.getModelState();
    state.workflow = workflow;
    state.diagram = options.diagram;

    // Manually trigger resolution if needed
    if (options.resolveReferences) {
      // This would need WorkflowModel to expose resolveAllReferences
      // For now, we'll skip this in memory mode
      console.warn('Reference resolution not supported for in-memory workflows');
    }

    return model;
  }

  /**
   * Discover workflow files in a directory
   */
  static async discoverWorkflows(options: DiscoveryOptions): Promise<DiscoveredWorkflow[]> {
    const {
      rootDir,
      maxDepth = 10,
      includePattern = /\.json$/,
      excludePattern = /node_modules|\.git/
    } = options;

    const workflows: DiscoveredWorkflow[] = [];

    async function walk(dir: string, depth: number) {
      if (depth > maxDepth) return;
      if (excludePattern.test(dir)) return;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await walk(fullPath, depth + 1);
          } else if (entry.isFile() && includePattern.test(entry.name)) {
            try {
              // Read workflow to get metadata
              const content = await fs.readFile(fullPath, 'utf-8');
              const workflow = JSON.parse(content) as Workflow;
              const stats = await fs.stat(fullPath);

              // Check for diagram file in .meta directory
              const dir = path.dirname(fullPath);
              const filename = path.basename(fullPath);

              let diagramFilename: string;
              if (filename.endsWith('.flow.json')) {
                diagramFilename = filename.replace('.flow.json', '.diagram.json');
              } else if (filename.endsWith('.json')) {
                diagramFilename = filename.replace(/\.json$/, '.diagram.json');
              } else {
                diagramFilename = filename + '.diagram.json';
              }

              const diagramPath = path.join(dir, '.meta', diagramFilename);

              let hasDiagram = false;
              try {
                await fs.access(diagramPath);
                hasDiagram = true;
              } catch {
                // No diagram file
              }

              workflows.push({
                workflowPath: fullPath,
                diagramPath: hasDiagram ? diagramPath : undefined,
                key: workflow.key,
                domain: workflow.domain,
                version: workflow.version,
                flow: workflow.flow,
                hasDiagram,
                size: stats.size,
                lastModified: stats.mtime
              });
            } catch (error) {
              // Invalid workflow file, skip it
              console.warn(`Skipping invalid workflow file: ${fullPath}`, error);
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to read directory: ${dir}`, error);
      }
    }

    await walk(rootDir, 0);
    return workflows;
  }

  /**
   * Load multiple workflow models
   */
  static async loadMultiple(
    workflowPaths: string[],
    options: ModelLoadOptions = {}
  ): Promise<Map<string, WorkflowModel>> {
    const models = new Map<string, WorkflowModel>();

    // Load in parallel
    const promises = workflowPaths.map(async path => {
      try {
        const model = await ModelLoader.loadFromFile(path, options);
        models.set(path, model);
      } catch (error) {
        console.error(`Failed to load workflow: ${path}`, error);
      }
    });

    await Promise.all(promises);
    return models;
  }

  /**
   * Create a new workflow model from template
   */
  static createFromTemplate(
    key: string,
    domain: string,
    flow: string,
    version: string = '1.0.0',
    type: 'C' | 'F' | 'S' | 'P' = 'F'
  ): WorkflowModel {
    const workflow: Workflow = {
      key,
      flow,
      domain,
      version,
      tags: [],
      attributes: {
        type,
        labels: [
          {
            label: key,
            language: 'en'
          }
        ],
        states: [
          {
            key: 'initial',
            stateType: 1, // Initial
            versionStrategy: 'Minor',
            labels: [
              {
                label: 'Initial',
                language: 'en'
              }
            ],
            transitions: [
              {
                key: 'start',
                target: 'final',
                triggerType: 0, // Manual
                versionStrategy: 'Minor'
              }
            ]
          },
          {
            key: 'final',
            stateType: 3, // Final
            stateSubType: 1, // Success
            versionStrategy: 'Minor',
            labels: [
              {
                label: 'Final',
                language: 'en'
              }
            ]
          }
        ],
        startTransition: {
          key: 'initialize',
          target: 'initial',
          triggerType: 0, // Manual
          versionStrategy: 'Minor'
        }
      }
    };

    // Create model from data
    const workflowPath = `${key}.flow.json`;
    const model = new WorkflowModel(workflowPath);
    const state = model.getModelState();
    state.workflow = workflow;

    return model;
  }

  /**
   * Validate a workflow file without fully loading it
   */
  static async validateFile(workflowPath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check file exists
      await fs.access(workflowPath);

      // Check it's a workflow file
      if (!workflowPath.endsWith('.flow.json')) {
        return { valid: false, error: 'Not a workflow file (must end with .flow.json)' };
      }

      // Try to parse JSON
      const content = await fs.readFile(workflowPath, 'utf-8');
      const workflow = JSON.parse(content) as Workflow;

      // Check required fields
      if (!workflow.key || !workflow.domain || !workflow.version || !workflow.flow) {
        return { valid: false, error: 'Missing required workflow fields' };
      }

      if (!workflow.attributes || !workflow.attributes.type || !workflow.attributes.states) {
        return { valid: false, error: 'Missing required attributes' };
      }

      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Check if a file is a workflow file
   */
  static isWorkflowFile(filePath: string): boolean {
    return filePath.endsWith('.flow.json');
  }

  /**
   * Check if a file is a diagram file
   */
  static isDiagramFile(filePath: string): boolean {
    return filePath.endsWith('.diagram.json');
  }

  /**
   * Get the diagram path for a workflow file
   */
  static getDiagramPath(workflowPath: string): string {
    const dir = path.dirname(workflowPath);
    const filename = path.basename(workflowPath);

    let diagramFilename: string;
    if (filename.endsWith('.flow.json')) {
      diagramFilename = filename.replace('.flow.json', '.diagram.json');
    } else if (filename.endsWith('.json')) {
      diagramFilename = filename.replace(/\.json$/, '.diagram.json');
    } else {
      diagramFilename = filename + '.diagram.json';
    }

    // Put diagram in .meta subdirectory
    return path.join(dir, '.meta', diagramFilename);
  }

  /**
   * Get the workflow path for a diagram file
   */
  static getWorkflowPath(diagramPath: string): string {
    // Diagram is in .meta subdirectory, so go up one level
    const dir = path.dirname(path.dirname(diagramPath)); // Go up from .meta
    const filename = path.basename(diagramPath);

    if (filename.endsWith('.diagram.json')) {
      // Try to determine if it was originally a .flow.json or plain .json file
      const withoutDiagram = filename.replace('.diagram.json', '');
      // Check if a .flow.json version would make sense
      if (withoutDiagram.includes('.flow')) {
        return path.join(dir, withoutDiagram.replace('.diagram', '.flow') + '.json');
      } else {
        // Default to plain .json
        return path.join(dir, withoutDiagram + '.json');
      }
    }
    // Shouldn't happen, but return as-is
    return diagramPath;
  }
}