import * as vscode from 'vscode';
import type { Workflow, StateType } from '@amorphie-flow-studio/core';

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

export async function setFlowVersion(uri: vscode.Uri): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const workflowText = document.getText();
    const workflow: Workflow = JSON.parse(workflowText);

    workflow.flowVersion = '1.0.0';

    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(workflowText.length)
    );
    edit.replace(uri, fullRange, JSON.stringify(workflow, null, 2));
    await vscode.workspace.applyEdit(edit);

    vscode.window.showInformationMessage('Set flowVersion to "1.0.0"');
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to set flowVersion: ${error}`);
  }
}

export async function addDefaultLabel(
  uri: vscode.Uri,
  diagnostic: vscode.Diagnostic
): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const workflowText = document.getText();
    const workflow: Workflow = JSON.parse(workflowText);

    const ownerId = (diagnostic as any).data?.ownerId;
    if (!ownerId) return;

    for (const state of workflow.attributes.states) {
      if (state.key === ownerId) {
        if (!state.labels || state.labels.length === 0) {
          state.labels = [{ label: state.key, language: 'en' }];
        }
        break;
      }
      for (const t of state.transitions || []) {
        if (t.key === ownerId) {
          if (!t.labels || t.labels.length === 0) {
            t.labels = [{ label: t.key, language: 'en' }];
          }
          break;
        }
      }
    }

    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(workflowText.length)
    );
    edit.replace(uri, fullRange, JSON.stringify(workflow, null, 2));
    await vscode.workspace.applyEdit(edit);

    vscode.window.showInformationMessage(`Added default label to: ${ownerId}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to add label: ${error}`);
  }
}

export async function removeFinalTransitions(
  uri: vscode.Uri,
  diagnostic: vscode.Diagnostic
): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const workflowText = document.getText();
    const workflow: Workflow = JSON.parse(workflowText);

    const ownerId = (diagnostic as any).data?.ownerId;
    if (!ownerId) return;

    for (const state of workflow.attributes.states) {
      if (state.key === ownerId && state.stateType === 3) {
        delete state.transitions;
        break;
      }
    }

    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(workflowText.length)
    );
    edit.replace(uri, fullRange, JSON.stringify(workflow, null, 2));
    await vscode.workspace.applyEdit(edit);

    vscode.window.showInformationMessage(`Removed transitions from final state: ${ownerId}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to remove transitions: ${error}`);
  }
}

export function registerQuickFixCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('flowEditor.createMissingState', createMissingState),
    vscode.commands.registerCommand('flowEditor.setFlowVersion', setFlowVersion),
    vscode.commands.registerCommand('flowEditor.addDefaultLabel', addDefaultLabel),
    vscode.commands.registerCommand('flowEditor.removeFinalTransitions', removeFinalTransitions)
  );
}