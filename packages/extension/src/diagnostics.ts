import * as vscode from 'vscode';
import { lint, type Workflow, type TaskDefinition } from '@amorphie-flow-studio/core';

export class FlowDiagnosticsProvider {
  private diagnosticsCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticsCollection = vscode.languages.createDiagnosticCollection('amorphie-flow');
  }

  public async updateDiagnostics(
    uri: vscode.Uri,
    workflow: Workflow,
    tasks?: TaskDefinition[]
  ): Promise<void> {
    const problems = lint(workflow, { tasks });
    const diagnostics: vscode.Diagnostic[] = [];

    // Read the document to find actual positions
    let document: vscode.TextDocument | undefined;
    try {
      document = await vscode.workspace.openTextDocument(uri);
    } catch {
      // If we can't open the document, use default position
    }

    const jsonText = document?.getText() || '';

    // Convert problems to VS Code diagnostics
    for (const [ownerId, problemList] of Object.entries(problems)) {
      for (const problem of problemList) {
        // Try to find the position of the state in the JSON
        let range = new vscode.Range(0, 0, 0, 0);

        if (document && jsonText) {
          // Search for the state key in the JSON
          const searchPattern = `"key"\\s*:\\s*"${ownerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`;
          const regex = new RegExp(searchPattern);
          const match = regex.exec(jsonText);

          if (match) {
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            // Make sure we have a proper range for the diagnostic
            range = new vscode.Range(startPos, endPos);
          } else {
            // If we can't find the key, try to at least point to line 1
            range = new vscode.Range(1, 0, 1, 1);
          }
        }

        const diagnostic = new vscode.Diagnostic(
          range,
          problem.message,
          problem.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
        );

        diagnostic.code = {
          value: problem.id,
          // Create a command link that can be clicked in Problems panel - include the file URI
          target: vscode.Uri.parse(`command:flowEditor.openPropertyPanel?${encodeURIComponent(JSON.stringify({ ownerId, fileUri: uri.toString() }))}`),
        };
        diagnostic.source = 'amorphie-flow';
        // Store the owner ID in the diagnostic data for use in code actions
        (diagnostic as any).data = { ownerId };
        diagnostics.push(diagnostic);
      }
    }

    this.diagnosticsCollection.set(uri, diagnostics);
  }

  public clearDiagnostics(uri: vscode.Uri): void {
    this.diagnosticsCollection.delete(uri);
  }

  public dispose(): void {
    this.diagnosticsCollection.dispose();
  }
}

export function createCodeActionProvider(): vscode.CodeActionProvider {
  return {
    provideCodeActions(
      document: vscode.TextDocument,
      range: vscode.Range | vscode.Selection,
      _context: vscode.CodeActionContext,
      _token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
      const actions: (vscode.CodeAction | vscode.Command)[] = [];

      // Get all diagnostics for this document from our source
      const allDiagnostics = vscode.languages.getDiagnostics(document.uri);
      const flowDiagnostics = allDiagnostics.filter(d => d.source === 'amorphie-flow');

      // Find diagnostics that overlap with the current range/position
      const relevantDiagnostics = flowDiagnostics.filter(diag => {
        // Check if the diagnostic overlaps with the provided range
        return diag.range.intersection(range) !== undefined ||
               diag.range.contains(range.start) ||
               range.contains(diag.range.start);
      });

      // Log for debugging
      console.log(`Code actions requested at ${range.start.line}:${range.start.character}, found ${relevantDiagnostics.length} diagnostics`);

      for (const diagnostic of relevantDiagnostics) {
        // Add "Open in Property Panel" action for all diagnostics
        const ownerId = (diagnostic as any).data?.ownerId;
        if (ownerId) {
          const openAction = new vscode.CodeAction(
            `📝 Open "${ownerId}" in Flow Editor`,
            vscode.CodeActionKind.QuickFix
          );
          openAction.diagnostics = [diagnostic];
          openAction.command = {
            command: 'flowEditor.openPropertyPanel',
            title: 'Open in Property Panel',
            arguments: [{ ownerId, fileUri: document.uri.toString() }]
          };
          openAction.isPreferred = true; // Make this the default action
          actions.push(openAction);
        }

        // Add specific actions based on diagnostic code
        const codeValue = typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code;
        switch (codeValue) {
          case 'E_BAD_TARGET': {
            const action = new vscode.CodeAction(
              'Create missing state',
              vscode.CodeActionKind.QuickFix
            );
            action.diagnostics = [diagnostic];
            action.command = {
              command: 'flowEditor.createMissingState',
              title: 'Create missing state',
              arguments: [document.uri, diagnostic]
            };
            actions.push(action);
            break;
          }
        }
      }

      return actions;
    }
  };
}
