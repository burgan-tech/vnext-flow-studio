import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FLOW_FILE_GLOBS } from './flowFileUtils';
import { getWorkflowTemplate } from '@amorphie-flow-studio/core';
import { showNewMapperDialog } from './mapper/NewMapperDialog';

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
        labels: [
          { label, language: 'en-US' },
          { label, language: 'tr-TR' } // User can update Turkish label later
        ],
        tags: ['new']
      });

      // Don't add $schema reference - we register schemas programmatically
      // This avoids issues with non-existent schema paths in external projects
      const workflowWithSchema = workflow;

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

      // Show the dialog to create a new mapper
      const result = await showNewMapperDialog(targetFolder, context);

      console.log('[createMapper] Dialog result:', result);

      if (!result) {
        console.log('[createMapper] User cancelled');
        return; // User cancelled
      }

      const { uri: saveUri, openInEditor } = result;

      console.log('[createMapper] Opening mapper:', saveUri.toString(), 'openInEditor:', openInEditor);

      // Small delay to ensure file is fully written
      await new Promise(resolve => setTimeout(resolve, 100));

      // Open the document - this will trigger the CustomTextEditorProvider automatically
      const doc = await vscode.workspace.openTextDocument(saveUri);
      console.log('[createMapper] Document opened:', doc.uri.toString());

      if (openInEditor) {
        // Show with custom editor (mapper canvas)
        // preview: false ensures it opens as a permanent tab, not a preview
        await vscode.window.showTextDocument(doc, {
          preview: false,  // Not a preview tab - opens as permanent
          preserveFocus: false  // Give it focus
        });
        console.log('[createMapper] Shown in custom editor');
      } else {
        // Show as plain text
        await vscode.window.showTextDocument(doc, {
          preview: false,
          preserveFocus: false
        });
        console.log('[createMapper] Shown as text document');
      }
    }
  );

  // Command to show component watcher statistics
  const showWatcherStatsCommand = vscode.commands.registerCommand(
    'flowEditor.showWatcherStats',
    async () => {
      // Get the ModelBridge instance (we'll need to pass it in)
      vscode.window.showInformationMessage(
        'Component watcher statistics can be viewed in the "Component Watcher" output channel. ' +
        'Use View → Output and select "Component Watcher" from the dropdown.'
      );
      // Show the output channel
      vscode.commands.executeCommand('workbench.action.output.show');
    }
  );

  // Command to open visual diff for workflow files
  const openVisualDiffCommand = vscode.commands.registerCommand(
    'flowEditor.openVisualDiff',
    async (uri?: vscode.Uri) => {
      // Get the URI from the active editor if not provided
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;

      if (!targetUri) {
        vscode.window.showErrorMessage('No file selected. Please open a workflow file first.');
        return;
      }

      // Check if this is a workflow file
      const fileName = path.basename(targetUri.fsPath);
      if (!fileName.endsWith('.json')) {
        vscode.window.showErrorMessage('Please select a workflow (.json) file.');
        return;
      }

      try {
        // Construct the git HEAD URI for comparison
        const gitUri = targetUri.with({
          scheme: 'git',
          path: targetUri.path,
          query: JSON.stringify({
            path: targetUri.fsPath,
            ref: 'HEAD'
          })
        });

        // Open both files with the Amorphie visual editor
        // Use vscode.openWith to explicitly specify our custom editor
        await vscode.commands.executeCommand(
          'vscode.openWith',
          gitUri,
          'flowEditor.canvas',
          { viewColumn: vscode.ViewColumn.One, preserveFocus: true }
        );

        await vscode.commands.executeCommand(
          'vscode.openWith',
          targetUri,
          'flowEditor.canvas',
          { viewColumn: vscode.ViewColumn.Two, preserveFocus: false }
        );

        vscode.window.showInformationMessage(
          `Visual diff: ${fileName} (HEAD ↔ Working Tree)`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to open visual diff: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // Command to show schema registrations
  const showSchemaRegistrationsCommand = vscode.commands.registerCommand(
    'flowEditor.showSchemaRegistrations',
    async () => {
      const config = vscode.workspace.getConfiguration('json');
      const schemas = config.get<any[]>('schemas') || [];

      // Filter Amorphie schemas
      const extensionSchemas = schemas.filter(s =>
        s.url.includes('amorphie-flow-studio') ||
        s.url.includes('workflow-definition.schema.json') ||
        s.url.includes('task-definition.schema.json') ||
        s.url.includes('schema-definition.schema.json') ||
        s.url.includes('view-definition.schema.json') ||
        s.url.includes('function-definition.schema.json') ||
        s.url.includes('extension-definition.schema.json')
      );

      if (extensionSchemas.length === 0) {
        vscode.window.showWarningMessage('No Amorphie schemas registered!');
        return;
      }

      // Create detailed output
      const output = extensionSchemas.map((s, i) => {
        const schemaName = s.url.split('/').pop();
        return `${i + 1}. ${schemaName}\n   URL: ${s.url}\n   Patterns: ${s.fileMatch.join(', ')}`;
      }).join('\n\n');

      // Show in output channel
      const channel = vscode.window.createOutputChannel('Schema Registrations');
      channel.clear();
      channel.appendLine('=== Amorphie Schema Registrations ===\n');
      channel.appendLine(output);
      channel.show();

      vscode.window.showInformationMessage(`Found ${extensionSchemas.length} registered schemas. Check Output panel.`);
    }
  );

  // Command to fix schema registrations
  const fixSchemaRegistrationsCommand = vscode.commands.registerCommand(
    'flowEditor.fixSchemaRegistrations',
    async () => {
      try {
        const config = vscode.workspace.getConfiguration('json');
        const schemas = config.get<any[]>('schemas') || [];

        // Show current schemas
        const extensionSchemas = schemas.filter(s =>
          s.url.includes('amorphie-flow-studio') ||
          s.url.includes('workflow-definition.schema.json') ||
          s.url.includes('task-definition.schema.json') ||
          s.url.includes('schema-definition.schema.json') ||
          s.url.includes('view-definition.schema.json') ||
          s.url.includes('function-definition.schema.json') ||
          s.url.includes('extension-definition.schema.json')
        );

        if (extensionSchemas.length === 0) {
          vscode.window.showInformationMessage('No Amorphie extension schemas found in settings');
          return;
        }

        // Ask for confirmation
        const answer = await vscode.window.showWarningMessage(
          `Found ${extensionSchemas.length} Amorphie schema registrations. Remove all and re-register?`,
          'Yes', 'No'
        );

        if (answer !== 'Yes') {
          return;
        }

        // Remove all extension schemas
        const cleanedSchemas = schemas.filter(s =>
          !s.url.includes('amorphie-flow-studio') &&
          !s.url.includes('workflow-definition.schema.json') &&
          !s.url.includes('task-definition.schema.json') &&
          !s.url.includes('schema-definition.schema.json') &&
          !s.url.includes('view-definition.schema.json') &&
          !s.url.includes('function-definition.schema.json') &&
          !s.url.includes('extension-definition.schema.json')
        );

        await config.update('schemas', cleanedSchemas, vscode.ConfigurationTarget.Global);

        vscode.window.showInformationMessage(
          `Removed ${extensionSchemas.length} old schema registrations. Please reload the window to re-register schemas.`,
          'Reload Window'
        ).then(choice => {
          if (choice === 'Reload Window') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
          }
        });

      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to fix schema registrations: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  context.subscriptions.push(
    createWorkflowCommand,
    freezeVersionsCommand,
    createMapperCommand,
    showWatcherStatsCommand,
    openVisualDiffCommand,
    showSchemaRegistrationsCommand,
    fixSchemaRegistrationsCommand
  );
}
