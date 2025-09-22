import * as vscode from 'vscode';
import type { Workflow, StateType } from '@nextcredit/core';

export async function createMissingState(
  uri: vscode.Uri,
  diagnostic: vscode.Diagnostic
): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const workflowText = document.getText();
    const workflow: Workflow = JSON.parse(workflowText);

    // Extract missing state name from diagnostic message
    const match = diagnostic.message.match(/'([^']+)'/);
    if (!match) {
      vscode.window.showErrorMessage('Could not extract state name from diagnostic');
      return;
    }

    const missingStateName = match[1];

    // Create new state
    const newState = {
      key: missingStateName,
      stateType: 2 as StateType, // Intermediate
      versionStrategy: 'Minor' as const,
      labels: [
        {
          label: missingStateName,
          language: 'en'
        }
      ]
    };

    // Add to workflow
    workflow.attributes.states.push(newState);

    // Apply edit
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(workflowText.length)
    );

    edit.replace(uri, fullRange, JSON.stringify(workflow, null, 2));
    await vscode.workspace.applyEdit(edit);

    vscode.window.showInformationMessage(`Created missing state: ${missingStateName}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create missing state: ${error}`);
  }
}

export function registerQuickFixCommands(context: vscode.ExtensionContext): void {
  const createMissingStateCommand = vscode.commands.registerCommand(
    'flowEditor.createMissingState',
    createMissingState
  );

  context.subscriptions.push(createMissingStateCommand);
}