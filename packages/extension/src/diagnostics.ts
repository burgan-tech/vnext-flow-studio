import * as vscode from 'vscode';
import { lint, type Workflow } from '@nextcredit/core';

export class FlowDiagnosticsProvider {
  private diagnosticsCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticsCollection = vscode.languages.createDiagnosticCollection('bbt-flow');
  }

  public updateDiagnostics(uri: vscode.Uri, workflow: Workflow): void {
    const problems = lint(workflow);
    const diagnostics: vscode.Diagnostic[] = [];

    // Convert problems to VS Code diagnostics
    for (const [_ownerId, problemList] of Object.entries(problems)) {
      for (const problem of problemList) {
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 0), // TODO: Map to actual line/column
          problem.message,
          problem.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
        );

        diagnostic.code = problem.id;
        diagnostic.source = 'bbt-flow';
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
      context: vscode.CodeActionContext
    ): vscode.CodeAction[] {
      const actions: vscode.CodeAction[] = [];

      for (const diagnostic of context.diagnostics) {
        if (diagnostic.source === 'bbt-flow') {
          switch (diagnostic.code) {
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
      }

      return actions;
    }
  };
}
