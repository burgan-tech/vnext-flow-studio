import * as vscode from 'vscode';
import { lint, type Workflow, type TaskDefinition } from '@amorphie-flow-studio/core';
import { ModelValidator, type WorkflowModel } from '@amorphie-flow-studio/core';

/**
 * Extract the actual owner ID (state key, transition key, etc.) from a JSON path
 * @param path The JSON path (e.g., "/attributes/states/0/view")
 * @param jsonText The full JSON text
 * @returns The owner ID (state key, transition key, or fallback)
 */
function extractOwnerFromPath(path: string, jsonText: string): string {
  try {
    const json = JSON.parse(jsonText);

    // Parse the path to navigate to the containing entity
    // Examples:
    // /attributes/states/0/view -> state at index 0
    // /attributes/states/0/transitions/1/target -> transition at index 1 in state 0
    // /attributes/startTransition/key -> __start__
    // /attributes/timeout/target -> __timeout__

    const parts = path.split('/').filter(p => p.length > 0);

    // Check for special cases
    if (parts.includes('startTransition')) {
      return '__start__';
    }
    if (parts.includes('timeout')) {
      return '__timeout__';
    }
    if (parts.includes('sharedTransitions')) {
      // For shared transitions, try to get the key
      let current: any = json;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (/^\d+$/.test(part)) {
          current = current[parseInt(part, 10)];
        } else {
          current = current[part];
        }
        // If we found the shared transition object, return its key
        if (current && typeof current === 'object' && current.key) {
          return current.key;
        }
      }
      return '__shared__';
    }

    // For states and their children (transitions, etc.)
    if (parts.includes('states')) {
      // Find the state index
      const statesIndex = parts.indexOf('states');
      if (statesIndex >= 0 && parts.length > statesIndex + 1) {
        const stateIndexStr = parts[statesIndex + 1];
        if (/^\d+$/.test(stateIndexStr)) {
          const stateIndex = parseInt(stateIndexStr, 10);
          const state = json?.attributes?.states?.[stateIndex];
          if (state && state.key) {
            return state.key;
          }
        }
      }
    }

    // Fallback to __schema__ if we can't determine
    return '__schema__';
  } catch (error) {
    console.error('Error extracting owner from path:', error);
    return '__schema__';
  }
}

/**
 * Find the position in the document for a given JSON path
 * @param document The VS Code text document
 * @param jsonText The full JSON text
 * @param path The JSON path (e.g., "/attributes/states/0/key")
 * @returns The range in the document
 */
function findPositionForPath(
  document: vscode.TextDocument,
  jsonText: string,
  path: string
): vscode.Range {
  // Convert JSON path to property chain
  // Example: "/attributes/states/0/key" -> ["attributes", "states", "0", "key"]
  const parts = path.split('/').filter(p => p.length > 0);

  if (parts.length === 0) {
    return new vscode.Range(0, 0, 0, 0);
  }

  try {
    // Navigate through the path to find the position
    let searchStartIndex = 0;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isArrayIndex = /^\d+$/.test(part);
      const isLastPart = i === parts.length - 1;

      if (isArrayIndex) {
        const arrayIndex = parseInt(part, 10);

        // Find the opening bracket [ of the array
        // searchStartIndex should be right after the property name and colon
        let foundArrayStart = false;
        let inString = false;
        let escapeNext = false;
        for (let j = searchStartIndex; j < jsonText.length; j++) {
          const char = jsonText[j];

          if (escapeNext) {
            escapeNext = false;
            continue;
          }

          if (char === '\\') {
            escapeNext = true;
            continue;
          }

          if (char === '"') {
            inString = !inString;
            continue;
          }

          if (inString) continue;

          if (char === '[') {
            searchStartIndex = j + 1;
            foundArrayStart = true;
            break;
          }
        }

        if (!foundArrayStart) {
          console.error(`Could not find array opening bracket`);
          return new vscode.Range(0, 0, 0, 1);
        }

        // Find the Nth element in the array
        let braceDepth = 0;
        let bracketDepth = 0;
        let currentElementIndex = 0;
        inString = false;  // Reuse the variable
        escapeNext = false;  // Reuse the variable
        let foundElement = false;

        for (let j = searchStartIndex; j < jsonText.length; j++) {
          const char = jsonText[j];

          if (escapeNext) {
            escapeNext = false;
            continue;
          }

          if (char === '\\') {
            escapeNext = true;
            continue;
          }

          if (char === '"') {
            inString = !inString;
            continue;
          }

          if (inString) continue;

          if (char === '{') {
            if (braceDepth === 0 && bracketDepth === 0) {
              if (currentElementIndex === arrayIndex) {
                searchStartIndex = j;
                foundElement = true;
                break;
              }
              currentElementIndex++;
            }
            braceDepth++;
          } else if (char === '}') {
            braceDepth--;
          } else if (char === '[') {
            bracketDepth++;
          } else if (char === ']') {
            if (bracketDepth === 0) break; // End of array
            bracketDepth--;
          }
        }

        if (!foundElement) {
          console.error(`Could not find array element at index ${arrayIndex}`);
          return new vscode.Range(0, 0, 0, 1);
        }
      } else {
        // Regular property lookup
        const escapedProperty = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const propertyRegex = new RegExp(`"${escapedProperty}"\\s*:`, 'g');

        // Search starting from searchStartIndex
        let propertyMatch: RegExpExecArray | null = null;
        while ((propertyMatch = propertyRegex.exec(jsonText)) !== null) {
          if (propertyMatch.index >= searchStartIndex) {
            break;
          }
        }

        if (propertyMatch && propertyMatch.index >= searchStartIndex) {
          if (isLastPart) {
            // This is the property we're looking for
            const startPos = document.positionAt(propertyMatch.index);
            const endPos = document.positionAt(propertyMatch.index + propertyMatch[0].length);
            return new vscode.Range(startPos, endPos);
          }
          searchStartIndex = propertyMatch.index + propertyMatch[0].length;
        } else {
          console.error(`Could not find property "${part}" after index ${searchStartIndex}`);
          return new vscode.Range(0, 0, 0, 1);
        }
      }
    }
  } catch (error) {
    // If parsing fails, return a default position
    console.error('Error parsing JSON for diagnostics:', error);
  }

  // Fallback: return the first line
  return new vscode.Range(0, 0, 0, 1);
}

export class FlowDiagnosticsProvider {
  private diagnosticsCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticsCollection = vscode.languages.createDiagnosticCollection('amorphie-flow');
  }

  /**
   * Update diagnostics using WorkflowModel and ModelValidator
   */
  public async updateDiagnosticsFromModel(
    uri: vscode.Uri,
    model: WorkflowModel
  ): Promise<void> {
    // Use ModelValidator for comprehensive validation (it's a static method)
    const validationResult = await ModelValidator.validate(model);
    const diagnostics: vscode.Diagnostic[] = [];

    // Read the document to find actual positions
    let document: vscode.TextDocument | undefined;
    try {
      document = await vscode.workspace.openTextDocument(uri);
    } catch {
      // If we can't open the document, use default position
    }

    const jsonText = document?.getText() || '';

    // Convert validation errors to diagnostics
    for (const error of validationResult.errors) {
      let range = new vscode.Range(0, 0, 0, 0);
      // Use location field directly as ownerId (it contains the state key)
      const ownerId = error.location || '__schema__';

      if (document && jsonText) {
        if (error.path) {
          // If we have JSON path, use it for precise line positioning
          range = findPositionForPath(document, jsonText, error.path);
        } else if (ownerId !== '__schema__') {
          // Fallback: search for state key in document
          const searchPattern = `"key"\\s*:\\s*"${ownerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`;
          const match = new RegExp(searchPattern).exec(jsonText);
          if (match) {
            range = new vscode.Range(
              document.positionAt(match.index),
              document.positionAt(match.index + match[0].length)
            );
          }
        }
      }

      const diagnostic = new vscode.Diagnostic(
        range,
        error.message,
        vscode.DiagnosticSeverity.Error
      );

      diagnostic.code = {
        value: error.type,
        target: vscode.Uri.parse(`command:flowEditor.openPropertyPanel?${encodeURIComponent(JSON.stringify({ ownerId, fileUri: uri.toString() }))}`),
      };
      diagnostic.source = 'amorphie-flow';
      (diagnostic as any).data = { ownerId };
      diagnostics.push(diagnostic);
    }

    // Convert validation warnings to diagnostics
    for (const warning of validationResult.warnings) {
      let range = new vscode.Range(0, 0, 0, 0);
      // Use location field directly as ownerId (it contains the state key)
      const ownerId = warning.location || '__schema__';

      if (document && jsonText) {
        if (warning.path) {
          // If we have JSON path, use it for precise line positioning
          range = findPositionForPath(document, jsonText, warning.path);
        } else if (ownerId !== '__schema__') {
          // Fallback: search for state key in document
          const searchPattern = `"key"\\s*:\\s*"${ownerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`;
          const match = new RegExp(searchPattern).exec(jsonText);
          if (match) {
            range = new vscode.Range(
              document.positionAt(match.index),
              document.positionAt(match.index + match[0].length)
            );
          }
        }
      }

      const diagnostic = new vscode.Diagnostic(
        range,
        warning.message,
        vscode.DiagnosticSeverity.Warning
      );

      diagnostic.code = {
        value: warning.type,
        target: vscode.Uri.parse(`command:flowEditor.openPropertyPanel?${encodeURIComponent(JSON.stringify({ ownerId, fileUri: uri.toString() }))}`),
      };
      diagnostic.source = 'amorphie-flow';
      (diagnostic as any).data = { ownerId };
      diagnostics.push(diagnostic);
    }

    this.diagnosticsCollection.set(uri, diagnostics);
  }

  /**
   * Legacy method for backward compatibility
   */
  public async updateDiagnostics(
    uri: vscode.Uri,
    workflow: Workflow,
    tasks?: TaskDefinition[]
  ): Promise<void> {
    const problems = lint(workflow, {
      tasks,
      workflowPath: uri.fsPath
      // Note: Scripts context not available in legacy method
    });
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
        // Try to find the position in the JSON
        let range = new vscode.Range(0, 0, 0, 0);
        let actualOwnerId = ownerId;

        if (document && jsonText) {
          // For schema errors, use the instancePath to find the exact location
          if (ownerId === '__schema__' && problem.path) {
            range = findPositionForPath(document, jsonText, problem.path);
            // Extract the actual state key from the path for navigation
            // Example: /attributes/states/0/view -> extract state at index 0
            actualOwnerId = extractOwnerFromPath(problem.path, jsonText);
          } else {
            // For other errors, search for the state/entity key
            const searchPattern = `"key"\\s*:\\s*"${ownerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`;
            const regex = new RegExp(searchPattern);
            const match = regex.exec(jsonText);

            if (match) {
              const startPos = document.positionAt(match.index);
              const endPos = document.positionAt(match.index + match[0].length);
              range = new vscode.Range(startPos, endPos);
            } else {
              // If we can't find the key, point to line 1
              range = new vscode.Range(1, 0, 1, 1);
            }
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
          // Use actualOwnerId which might be extracted from the path for schema errors
          target: vscode.Uri.parse(`command:flowEditor.openPropertyPanel?${encodeURIComponent(JSON.stringify({ ownerId: actualOwnerId, fileUri: uri.toString() }))}`),
        };
        diagnostic.source = 'amorphie-flow';
        // Store the actual owner ID in the diagnostic data for use in code actions
        (diagnostic as any).data = { ownerId: actualOwnerId };
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
          case 'W_MISSING_FLOW_VERSION': {
            const action = new vscode.CodeAction(
              'Set flowVersion to "1.0.0"',
              vscode.CodeActionKind.QuickFix
            );
            action.diagnostics = [diagnostic];
            action.command = {
              command: 'flowEditor.setFlowVersion',
              title: 'Set flowVersion',
              arguments: [document.uri]
            };
            actions.push(action);
            break;
          }
          case 'E_LABELS_EMPTY': {
            const action = new vscode.CodeAction(
              'Add default label',
              vscode.CodeActionKind.QuickFix
            );
            action.diagnostics = [diagnostic];
            action.command = {
              command: 'flowEditor.addDefaultLabel',
              title: 'Add default label',
              arguments: [document.uri, diagnostic]
            };
            actions.push(action);
            break;
          }
          case 'E_FINAL_OUT': {
            const action = new vscode.CodeAction(
              'Remove outgoing transitions from final state',
              vscode.CodeActionKind.QuickFix
            );
            action.diagnostics = [diagnostic];
            action.command = {
              command: 'flowEditor.removeFinalTransitions',
              title: 'Remove transitions',
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
