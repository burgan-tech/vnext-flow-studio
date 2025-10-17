// Model saver for persisting workflow models to filesystem

import * as path from 'path';
import * as fs from 'fs/promises';
import { WorkflowModel } from './WorkflowModel.js';
import type { ModelSaveOptions, SaveResult, ResolvedScript } from './types.js';
import type { Workflow, Diagram } from '../types/index.js';

/**
 * Saves workflow models back to the filesystem
 */
export class ModelSaver {
  /**
   * Save a workflow model to files
   */
  static async save(model: WorkflowModel, options: ModelSaveOptions = {}): Promise<SaveResult> {
    const {
      backup = true,
      format = true,
      indent = 2,
      updateScriptEncoding = true
    } = options;

    const result: SaveResult = {
      success: false,
      modified: [],
      created: [],
      deleted: [],
      errors: []
    };

    try {
      const state = model.getModelState();

      // Create backups if requested
      if (backup) {
        await this.createBackups(state.metadata.workflowPath, state.metadata.diagramPath);
      }

      // Update script encodings if requested
      if (updateScriptEncoding) {
        await this.updateScriptEncodings(model, state.workflow);
      }

      // Save workflow file
      const workflowJson = format
        ? JSON.stringify(state.workflow, null, indent)
        : JSON.stringify(state.workflow);

      await fs.writeFile(state.metadata.workflowPath, workflowJson, 'utf-8');
      result.modified.push(state.metadata.workflowPath);

      // Save diagram file if exists
      if (state.diagram && state.metadata.diagramPath) {
        const diagramJson = format
          ? JSON.stringify(state.diagram, null, indent)
          : JSON.stringify(state.diagram);

        await fs.writeFile(state.metadata.diagramPath, diagramJson, 'utf-8');
        result.modified.push(state.metadata.diagramPath);
      }

      // Only save EXISTING script files that have been modified
      // Do NOT create new files automatically
      const savedScripts = await this.saveExistingScriptsOnly(model, state.scripts);
      result.modified.push(...savedScripts.modified);
      // Note: result.created is intentionally not populated here

      result.success = true;
    } catch (error: any) {
      result.errors = [error];
    }

    return result;
  }

  /**
   * Save only the workflow file (not scripts or diagram)
   */
  static async saveWorkflow(
    workflowPath: string,
    workflow: Workflow,
    options: { format?: boolean; indent?: number; backup?: boolean } = {}
  ): Promise<void> {
    const { format = true, indent = 2, backup = true } = options;

    // Create backup if requested
    if (backup) {
      await this.createBackup(workflowPath);
    }

    // Save workflow
    const json = format
      ? JSON.stringify(workflow, null, indent)
      : JSON.stringify(workflow);

    await fs.writeFile(workflowPath, json, 'utf-8');
  }

  /**
   * Save only the diagram file
   */
  static async saveDiagram(
    diagramPath: string,
    diagram: Diagram,
    options: { format?: boolean; indent?: number; backup?: boolean } = {}
  ): Promise<void> {
    const { format = true, indent = 2, backup = true } = options;

    // Create backup if requested
    if (backup) {
      await this.createBackup(diagramPath);
    }

    // Save diagram
    const json = format
      ? JSON.stringify(diagram, null, indent)
      : JSON.stringify(diagram);

    await fs.writeFile(diagramPath, json, 'utf-8');
  }

  /**
   * Update script encodings in the workflow
   */
  private static async updateScriptEncodings(
    model: WorkflowModel,
    workflow: Workflow
  ): Promise<void> {

    // Helper to update mapping encoding
    const updateMapping = async (mapping: any) => {
      if (mapping?.location) {
        const script = model.getScript(mapping.location);
        if (script && script.exists) {
          mapping.code = script.base64;
        }
      }
    };

    // Helper to update rule encoding
    const updateRule = async (rule: any) => {
      if (rule?.location) {
        const script = model.getScript(rule.location);
        if (script && script.exists) {
          rule.code = script.base64;
        }
      }
    };

    // Update states
    for (const state of workflow.attributes.states) {
      // Update onEntry tasks
      for (const task of (state.onEntries || [])) {
        await updateMapping(task.mapping);
      }

      // Update onExit tasks
      for (const task of (state.onExits || [])) {
        await updateMapping(task.mapping);
      }

      // Update transitions
      for (const transition of (state.transitions || [])) {
        await updateRule(transition.rule);

        // Update transition tasks
        for (const task of (transition.onExecutionTasks || [])) {
          await updateMapping(task.mapping);
        }
      }
    }

    // Update shared transitions
    for (const sharedTransition of (workflow.attributes.sharedTransitions || [])) {
      await updateRule(sharedTransition.rule);

      // Update shared transition tasks
      for (const task of (sharedTransition.onExecutionTasks || [])) {
        await updateMapping(task.mapping);
      }
    }

    // Update start transition tasks
    if (workflow.attributes.startTransition?.onExecutionTasks) {
      for (const task of workflow.attributes.startTransition.onExecutionTasks) {
        await updateMapping(task.mapping);
      }
    }
  }

  /**
   * Save only existing script files that have been modified
   * This method does NOT create new files - only updates existing ones
   */
  private static async saveExistingScriptsOnly(
    model: WorkflowModel,
    scripts: Map<string, ResolvedScript>
  ): Promise<{ modified: string[] }> {
    const modified: string[] = [];

    for (const [absolutePath, script] of scripts) {
      // Only process scripts that already exist on disk
      if (script.exists) {
        // Check if content changed
        try {
          const currentContent = await fs.readFile(absolutePath, 'utf-8');
          if (currentContent !== script.content) {
            await fs.writeFile(absolutePath, script.content, 'utf-8');
            modified.push(absolutePath);
          }
        } catch {
          // File was deleted externally, skip it
          // Do NOT recreate it automatically
          console.log(`Script file ${absolutePath} no longer exists, skipping save`);
        }
      }
      // Explicitly skip non-existent files - no automatic creation
    }

    return { modified };
  }

  /**
   * Save modified script files (DEPRECATED - creates files without consent)
   * @deprecated Use saveExistingScriptsOnly instead
   */
  private static async saveScripts(
    model: WorkflowModel,
    scripts: Map<string, ResolvedScript>
  ): Promise<{ modified: string[]; created: string[] }> {
    const modified: string[] = [];
    const created: string[] = [];

    for (const [absolutePath, script] of scripts) {
      if (!script.exists) {
        // New script - ensure directory exists
        const dir = path.dirname(absolutePath);
        await fs.mkdir(dir, { recursive: true });

        // Write the script
        await fs.writeFile(absolutePath, script.content, 'utf-8');
        created.push(absolutePath);
      } else {
        // Check if content changed
        try {
          const currentContent = await fs.readFile(absolutePath, 'utf-8');
          if (currentContent !== script.content) {
            await fs.writeFile(absolutePath, script.content, 'utf-8');
            modified.push(absolutePath);
          }
        } catch {
          // File was deleted, recreate it
          await fs.writeFile(absolutePath, script.content, 'utf-8');
          created.push(absolutePath);
        }
      }
    }

    return { modified, created };
  }

  /**
   * Create backups for workflow and diagram files
   */
  private static async createBackups(
    workflowPath: string,
    diagramPath?: string
  ): Promise<void> {
    await this.createBackup(workflowPath);
    if (diagramPath) {
      await this.createBackup(diagramPath);
    }
  }

  /**
   * Create a backup of a single file
   */
  private static async createBackup(filePath: string): Promise<void> {
    try {
      // Check if file exists
      await fs.access(filePath);

      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = path.extname(filePath);
      const base = path.basename(filePath, ext);
      const dir = path.dirname(filePath);
      const backupPath = path.join(dir, `.backup`, `${base}.${timestamp}${ext}`);

      // Ensure backup directory exists
      await fs.mkdir(path.join(dir, '.backup'), { recursive: true });

      // Copy file to backup
      await fs.copyFile(filePath, backupPath);

      // Clean old backups (keep only last 10)
      await this.cleanOldBackups(dir, base, ext);
    } catch {
      // File doesn't exist, no backup needed
    }
  }

  /**
   * Clean old backup files (keep only last 10)
   */
  private static async cleanOldBackups(
    dir: string,
    base: string,
    ext: string
  ): Promise<void> {
    try {
      const backupDir = path.join(dir, '.backup');
      const files = await fs.readdir(backupDir);

      // Filter for backups of this file
      const backups = files
        .filter(f => f.startsWith(`${base}.`) && f.endsWith(ext))
        .sort()
        .reverse();

      // Delete old backups
      if (backups.length > 10) {
        for (const backup of backups.slice(10)) {
          await fs.unlink(path.join(backupDir, backup));
        }
      }
    } catch {
      // Backup directory doesn't exist or can't be read
    }
  }

  /**
   * Export a workflow model to a single file (bundle)
   */
  static async exportBundle(
    model: WorkflowModel,
    outputPath: string,
    options: { includeScripts?: boolean; includeDiagram?: boolean } = {}
  ): Promise<void> {
    const { includeScripts = true, includeDiagram = true } = options;
    const state = model.getModelState();

    const bundle: any = {
      version: '1.0.0',
      exported: new Date().toISOString(),
      workflow: state.workflow
    };

    if (includeDiagram && state.diagram) {
      bundle.diagram = state.diagram;
    }

    if (includeScripts) {
      bundle.scripts = {};
      for (const [, script] of state.scripts) {
        bundle.scripts[script.location] = {
          content: script.content,
          base64: script.base64
        };
      }
    }

    // Include referenced components
    bundle.components = {
      tasks: Array.from(state.components.tasks.values()),
      schemas: Array.from(state.components.schemas.values()),
      views: Array.from(state.components.views.values()),
      functions: Array.from(state.resolvedFunctions.values()),
      extensions: Array.from(state.resolvedExtensions.values())
    };

    // Save bundle
    const json = JSON.stringify(bundle, null, 2);
    await fs.writeFile(outputPath, json, 'utf-8');
  }

  /**
   * Import a workflow model from a bundle
   */
  static async importBundle(
    bundlePath: string,
    targetDir: string,
    options: { overwrite?: boolean } = {}
  ): Promise<WorkflowModel> {
    const { overwrite = false } = options;

    // Read bundle
    const content = await fs.readFile(bundlePath, 'utf-8');
    const bundle = JSON.parse(content);

    // Validate bundle
    if (!bundle.workflow || !bundle.version) {
      throw new Error('Invalid bundle file');
    }

    // Determine target paths
    const workflowPath = path.join(targetDir, `${bundle.workflow.key}.flow.json`);
    const diagramPath = path.join(targetDir, `${bundle.workflow.key}.diagram.json`);

    // Check if files exist
    if (!overwrite) {
      try {
        await fs.access(workflowPath);
        throw new Error(`Workflow file already exists: ${workflowPath}`);
      } catch {
        // File doesn't exist, ok to proceed
      }
    }

    // Save workflow file
    await this.saveWorkflow(workflowPath, bundle.workflow, { backup: false });

    // Save diagram if present
    if (bundle.diagram) {
      await this.saveDiagram(diagramPath, bundle.diagram, { backup: false });
    }

    // Save scripts if present
    if (bundle.scripts) {
      for (const [location, scriptData] of Object.entries(bundle.scripts)) {
        const scriptPath = path.resolve(targetDir, location);
        const scriptDir = path.dirname(scriptPath);
        await fs.mkdir(scriptDir, { recursive: true });
        await fs.writeFile(scriptPath, (scriptData as any).content, 'utf-8');
      }
    }

    // Create and load the model
    const model = new WorkflowModel(workflowPath, targetDir);
    await model.load();

    return model;
  }
}