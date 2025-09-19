import * as vscode from 'vscode';

export function registerCommands(context: vscode.ExtensionContext) {
  // flowEditor.open is registered in extension.ts as it needs context

  // Stub for freeze versions command
  const freezeVersionsCommand = vscode.commands.registerCommand(
    'flowEditor.freezeVersions',
    async (uri?: vscode.Uri) => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
      }

      const flowFiles = await vscode.workspace.findFiles('**/*.flow.json');
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