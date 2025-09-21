import * as vscode from 'vscode';
import { FLOW_FILE_GLOBS } from './flowFileUtils';

export function registerCommands(context: vscode.ExtensionContext) {
  // flowEditor.open is registered in extension.ts as it needs context

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

  context.subscriptions.push(freezeVersionsCommand);
}
