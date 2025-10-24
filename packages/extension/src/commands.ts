import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FLOW_FILE_GLOBS } from './flowFileUtils';
import { getWorkflowTemplate } from '@amorphie-flow-studio/core';

export function registerCommands(context: vscode.ExtensionContext) {
  // flowEditor.open is registered in extension.ts as it needs context

  // Command to create a new workflow from scratch
  const createWorkflowCommand = vscode.commands.registerCommand(
    'flowEditor.createWorkflow',
    async (uri?: vscode.Uri) => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found. Please open a workspace first.');
        return;
      }

      // Determine the target folder from context menu or use default
      let targetFolder: string;
      if (uri && uri.fsPath) {
        // Called from context menu - use the selected folder
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
          targetFolder = uri.fsPath;
        } else {
          // If a file was selected, use its parent directory
          targetFolder = path.dirname(uri.fsPath);
        }
      } else {
        // Called from command palette - use default
        targetFolder = path.join(workspaceFolder.uri.fsPath, 'flows');
      }

      // Ask for workflow type
      const workflowType = await vscode.window.showQuickPick(
        [
          { label: 'Flow', value: 'F', description: 'Standard workflow' },
          { label: 'SubFlow', value: 'S', description: 'Reusable subflow' },
          { label: 'Sub Process', value: 'P', description: 'Sub process workflow' }
        ],
        { placeHolder: 'Select workflow type' }
      );

      if (!workflowType) {
        return;
      }

      // Ask for workflow details
      const key = await vscode.window.showInputBox({
        prompt: 'Enter workflow key (lowercase, alphanumeric with dashes)',
        placeHolder: 'my-workflow',
        validateInput: (value) => {
          if (!value) return 'Key is required';
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Key must contain only lowercase letters, numbers, and dashes';
          }
          return null;
        }
      });

      if (!key) {
        return;
      }

      const domain = await vscode.window.showInputBox({
        prompt: 'Enter domain (lowercase, alphanumeric with dashes)',
        placeHolder: 'core',
        value: 'core',
        validateInput: (value) => {
          if (!value) return 'Domain is required';
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Domain must contain only lowercase letters, numbers, and dashes';
          }
          return null;
        }
      });

      if (!domain) {
        return;
      }

      const flow = await vscode.window.showInputBox({
        prompt: 'Enter flow identifier (lowercase, alphanumeric with dashes)',
        placeHolder: 'sys-flows',
        value: 'sys-flows',
        validateInput: (value) => {
          if (!value) return 'Flow is required';
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Flow must contain only lowercase letters, numbers, and dashes';
          }
          return null;
        }
      });

      if (!flow) {
        return;
      }

      const label = await vscode.window.showInputBox({
        prompt: 'Enter workflow label',
        placeHolder: 'My Workflow',
        value: key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      });

      if (!label) {
        return;
      }

      // Generate the workflow
      const workflow = getWorkflowTemplate(workflowType.value as 'F' | 'S' | 'P', {
        key,
        flow,
        domain,
        version: '1.0.0',
        type: workflowType.value as 'F' | 'S' | 'P',
        labels: [{ label, language: 'en' }],
        tags: ['new']
      });

      // Add $schema reference - calculate relative path to schemas submodule
      // The schemas submodule is at the project root in schemas/schemas/
      const workspaceRoot = workspaceFolder.uri.fsPath;
      const schemaPath = path.join(workspaceRoot, 'schemas', 'schemas', 'workflow-definition.schema.json');

      // Calculate relative path from where the workflow will be saved
      // (We'll update this after we know the save location)
      let workflowWithSchema = workflow;

      // Determine save location - use targetFolder if it's a workflow-related directory,
      // otherwise use flows/domain structure
      let defaultFolder: string;
      const targetFolderLower = targetFolder.toLowerCase();
      if (targetFolderLower.includes('workflow') ||
          targetFolderLower.includes('flows') ||
          targetFolderLower.includes('flow')) {
        defaultFolder = targetFolder;
      } else {
        defaultFolder = path.join(targetFolder, 'flows', domain);
      }

      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(defaultFolder, `${key}.json`)),
        filters: {
          'Workflow Files': ['json']
        },
        title: 'Save New Workflow'
      });

      if (!saveUri) {
        return;
      }

      // Ensure directory exists
      const saveDir = path.dirname(saveUri.fsPath);
      await fs.mkdir(saveDir, { recursive: true });

      // Now calculate the relative path from the saved file to the schema
      const relativeSchemaPath = path.relative(saveDir, schemaPath).replace(/\\/g, '/');
      workflowWithSchema = {
        $schema: relativeSchemaPath,
        ...workflow
      };

      // Write the workflow file
      const content = JSON.stringify(workflowWithSchema, null, 2);
      await fs.writeFile(saveUri.fsPath, content, 'utf-8');

      // Open the new workflow in the editor
      const doc = await vscode.workspace.openTextDocument(saveUri);
      await vscode.window.showTextDocument(doc);

      vscode.window.showInformationMessage(`Created workflow: ${key}`);

      // Optionally open in flow editor
      const openInEditor = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Open in Flow Editor?'
      });

      if (openInEditor === 'Yes') {
        await vscode.commands.executeCommand('flowEditor.open', saveUri);
      }
    }
  );

  // Stub for freeze versions command
  const freezeVersionsCommand = vscode.commands.registerCommand(
    'flowEditor.freezeVersions',
    async (_uri?: vscode.Uri) => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
      }

      const searchResults = await Promise.all(
        FLOW_FILE_GLOBS.map((pattern) => vscode.workspace.findFiles(pattern))
      );

      const flowFiles = Array.from(
        new Map(searchResults.flat().map((uri) => [uri.toString(), uri])).values()
      );
      if (flowFiles.length === 0) {
        vscode.window.showInformationMessage('No flow files found to freeze');
        return;
      }

      // TODO: Implement version freezing logic
      // This would scan all flow files, extract version references,
      // and create/update flow.lock.json files
      vscode.window.showInformationMessage(
        `Found ${flowFiles.length} flow files. Version freezing is not yet implemented.`
      );
    }
  );

  // Command to create a new mapper
  const createMapperCommand = vscode.commands.registerCommand(
    'flowEditor.createMapper',
    async (uri?: vscode.Uri) => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found. Please open a workspace first.');
        return;
      }

      // Determine the target folder from context menu or use default
      let targetFolder: string;
      if (uri && uri.fsPath) {
        // Called from context menu - use the selected folder
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
          targetFolder = uri.fsPath;
        } else {
          // If a file was selected, use its parent directory
          targetFolder = path.dirname(uri.fsPath);
        }
      } else {
        // Called from command palette - use default
        targetFolder = path.join(workspaceFolder.uri.fsPath, 'mappers');
      }

      // Ask for mapper name
      const name = await vscode.window.showInputBox({
        prompt: 'Enter mapper name',
        placeHolder: 'order-to-invoice',
        validateInput: (value) => {
          if (!value) return 'Name is required';
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Name must contain only lowercase letters, numbers, and dashes';
          }
          return null;
        }
      });

      if (!name) {
        return;
      }

      const description = await vscode.window.showInputBox({
        prompt: 'Enter mapper description (optional)',
        placeHolder: 'Maps order data to invoice format'
      });

      // Create the mapper template
      const mapper = {
        version: '1.0',
        metadata: {
          name,
          description: description || `${name} mapper`,
          version: '1.0.0',
          source: 'none',
          target: 'none',
          createdAt: new Date().toISOString(),
          tags: ['new']
        },
        schemas: {
          source: 'none',
          target: 'none'
        },
        nodes: [],
        edges: []
      };

      // Ensure directory exists
      await fs.mkdir(targetFolder, { recursive: true });

      // Determine save location
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(targetFolder, `${name}.mapper.json`)),
        filters: {
          'Mapper Files': ['json']
        },
        title: 'Save New Mapper'
      });

      if (!saveUri) {
        return;
      }

      // Ensure directory exists
      const saveDir = path.dirname(saveUri.fsPath);
      await fs.mkdir(saveDir, { recursive: true });

      // Write the mapper file
      const content = JSON.stringify(mapper, null, 2);
      await fs.writeFile(saveUri.fsPath, content, 'utf-8');

      vscode.window.showInformationMessage(`Created mapper: ${name}`);

      // Open in mapper editor
      const openInEditor = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Open in Mapper Editor?',
        title: 'Open in Mapper Editor?'
      });

      if (openInEditor === 'Yes') {
        await vscode.commands.executeCommand('mapperEditor.open', saveUri);
      } else {
        // Open as text document
        const doc = await vscode.workspace.openTextDocument(saveUri);
        await vscode.window.showTextDocument(doc);
      }
    }
  );

  context.subscriptions.push(createWorkflowCommand, freezeVersionsCommand, createMapperCommand);
}
