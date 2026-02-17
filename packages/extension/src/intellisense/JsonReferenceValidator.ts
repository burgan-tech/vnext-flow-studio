/**
 * JsonReferenceValidator - Cross-file reference validation for vnext JSON files
 *
 * Validates that component references (task, schema, view, process) in
 * workflow JSON files point to existing component files. Shows diagnostics
 * (red squiggles) for broken references with Quick Fix suggestions.
 */

import * as vscode from 'vscode';
import { ComponentIndex, ComponentRef, ComponentType } from './ComponentIndex';

// ─── Types ──────────────────────────────────────────────────────────

interface FoundReference {
  ref: ComponentRef;
  /** Expected component type */
  expectedType: ComponentType;
  /** Range in the document where the reference appears */
  range: vscode.Range;
  /** Human-readable reference context */
  context: string;
}

// ─── Reference Finder ───────────────────────────────────────────────

/**
 * Find all component references in a JSON document
 */
function findReferences(document: vscode.TextDocument): FoundReference[] {
  const text = document.getText();
  let json: Record<string, unknown>;

  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }

  const refs: FoundReference[] = [];

  // Check if this is a workflow file (has attributes.states or attributes.startTransition)
  const attributes = json.attributes as Record<string, unknown> | undefined;
  if (!attributes) return refs;

  // ─── startTransition.schema ──────────────────
  const startTransition = attributes.startTransition as Record<string, unknown> | undefined;
  if (startTransition?.schema) {
    const schemaRef = extractComponentRef(startTransition.schema);
    if (schemaRef) {
      const range = findObjectRange(text, 'startTransition', 'schema');
      refs.push({
        ref: schemaRef,
        expectedType: 'schema',
        range: range ?? new vscode.Range(0, 0, 0, 0),
        context: 'startTransition.schema'
      });
    }
  }

  // ─── states[].transitions[].schema ──────────
  const states = attributes.states as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(states)) {
    for (let si = 0; si < states.length; si++) {
      const state = states[si];
      const stateKey = (state.key as string) || `states[${si}]`;

      // State transitions
      const transitions = state.transitions as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(transitions)) {
        for (let ti = 0; ti < transitions.length; ti++) {
          const transition = transitions[ti];
          const transKey = (transition.key as string) || `transitions[${ti}]`;

          // transition.schema
          if (transition.schema) {
            const schemaRef = extractComponentRef(transition.schema);
            if (schemaRef) {
              const range = findRefRange(text, schemaRef.key, 'schema');
              refs.push({
                ref: schemaRef,
                expectedType: 'schema',
                range: range ?? new vscode.Range(0, 0, 0, 0),
                context: `${stateKey}.${transKey}.schema`
              });
            }
          }

          // transition.onExecutionTasks[].task
          const execTasks = transition.onExecutionTasks as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(execTasks)) {
            for (const execTask of execTasks) {
              if (execTask.task) {
                const taskRef = extractComponentRef(execTask.task);
                if (taskRef) {
                  const range = findRefRange(text, taskRef.key, 'task');
                  refs.push({
                    ref: taskRef,
                    expectedType: 'task',
                    range: range ?? new vscode.Range(0, 0, 0, 0),
                    context: `${stateKey}.${transKey}.onExecutionTasks.task`
                  });
                }
              }
            }
          }
        }
      }

      // State onEntries[].task
      const onEntries = state.onEntries as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(onEntries)) {
        for (const entry of onEntries) {
          if (entry.task) {
            const taskRef = extractComponentRef(entry.task);
            if (taskRef) {
              const range = findRefRange(text, taskRef.key, 'task');
              refs.push({
                ref: taskRef,
                expectedType: 'task',
                range: range ?? new vscode.Range(0, 0, 0, 0),
                context: `${stateKey}.onEntries.task`
              });
            }
          }
        }
      }

      // State onExits[].task
      const onExits = state.onExits as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(onExits)) {
        for (const exit of onExits) {
          if (exit.task) {
            const taskRef = extractComponentRef(exit.task);
            if (taskRef) {
              const range = findRefRange(text, taskRef.key, 'task');
              refs.push({
                ref: taskRef,
                expectedType: 'task',
                range: range ?? new vscode.Range(0, 0, 0, 0),
                context: `${stateKey}.onExits.task`
              });
            }
          }
        }
      }

      // State view.view
      const viewConfig = state.view as Record<string, unknown> | undefined;
      if (viewConfig?.view) {
        const viewRef = extractComponentRef(viewConfig.view);
        if (viewRef) {
          const range = findRefRange(text, viewRef.key, 'view');
          refs.push({
            ref: viewRef,
            expectedType: 'view',
            range: range ?? new vscode.Range(0, 0, 0, 0),
            context: `${stateKey}.view`
          });
        }
      }

      // State subFlow.process
      const subFlow = state.subFlow as Record<string, unknown> | undefined;
      if (subFlow?.process) {
        const processRef = extractComponentRef(subFlow.process);
        if (processRef) {
          const range = findRefRange(text, processRef.key, 'process');
          refs.push({
            ref: processRef,
            expectedType: 'workflow',
            range: range ?? new vscode.Range(0, 0, 0, 0),
            context: `${stateKey}.subFlow.process`
          });
        }
      }
    }
  }

  return refs;
}

/**
 * Extract a ComponentRef from a JSON value
 */
function extractComponentRef(value: unknown): ComponentRef | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const obj = value as Record<string, unknown>;
  if (typeof obj.key !== 'string' || typeof obj.domain !== 'string') return undefined;

  return {
    key: obj.key,
    domain: obj.domain,
    flow: typeof obj.flow === 'string' ? obj.flow : '',
    version: typeof obj.version === 'string' ? obj.version : ''
  };
}

/**
 * Find the range of a reference object in the text by searching for its key value
 */
function findRefRange(text: string, key: string, contextProp: string): vscode.Range | undefined {
  // Search for the pattern "key": "value" near the context property
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`"key"\\s*:\\s*"${escapedKey}"`, 'g');

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const offset = match.index;
    const lines = text.substring(0, offset).split('\n');
    const line = lines.length - 1;
    const col = lines[lines.length - 1].length;

    // Check if this is near the expected context property
    // Look backward a few hundred chars for the context
    const lookback = text.substring(Math.max(0, offset - 500), offset);
    if (lookback.includes(`"${contextProp}"`)) {
      return new vscode.Range(line, col, line, col + match[0].length);
    }
  }

  // Fallback: just find the first occurrence
  const firstMatch = pattern.exec(text);
  if (firstMatch) {
    const lines = text.substring(0, firstMatch.index).split('\n');
    const line = lines.length - 1;
    const col = lines[lines.length - 1].length;
    return new vscode.Range(line, col, line, col + firstMatch[0].length);
  }

  return undefined;
}

/**
 * Find range of an object property in text
 */
function findObjectRange(text: string, parentProp: string, childProp: string): vscode.Range | undefined {
  const escapedParent = parentProp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedChild = childProp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Find parent property first
  const parentPattern = new RegExp(`"${escapedParent}"\\s*:`);
  const parentMatch = parentPattern.exec(text);
  if (!parentMatch) return undefined;

  // Find child property after parent
  const afterParent = text.substring(parentMatch.index);
  const childPattern = new RegExp(`"${escapedChild}"\\s*:`);
  const childMatch = childPattern.exec(afterParent);
  if (!childMatch) return undefined;

  const offset = parentMatch.index + childMatch.index;
  const lines = text.substring(0, offset).split('\n');
  const line = lines.length - 1;
  const col = lines[lines.length - 1].length;
  return new vscode.Range(line, col, line, col + childMatch[0].length);
}

// ─── Validator ──────────────────────────────────────────────────────

export class JsonReferenceValidator implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private componentIndex: ComponentIndex;
  private disposables: vscode.Disposable[] = [];

  constructor(componentIndex: ComponentIndex) {
    this.componentIndex = componentIndex;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('vnext-refs');

    // Validate open documents
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => this.validateDocument(doc))
    );

    // Re-validate on save
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => this.validateDocument(doc))
    );

    // Clear diagnostics when document is closed
    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.diagnosticCollection.delete(doc.uri);
      })
    );

    // Re-validate all open documents when index changes
    this.disposables.push(
      componentIndex.onDidChange(() => this.validateAllOpen())
    );

    // Validate already-open documents
    this.validateAllOpen();
  }

  /**
   * Validate a single document
   */
  private validateDocument(document: vscode.TextDocument): void {
    if (document.languageId !== 'json') return;
    if (!this.isWorkflowFile(document.uri)) return;
    if (!this.componentIndex.isReady) return;

    const diagnostics: vscode.Diagnostic[] = [];
    const refs = findReferences(document);

    for (const foundRef of refs) {
      // Try to find the referenced component
      const component = this.componentIndex.findByRef(foundRef.ref);

      if (!component) {
        // Also try without version
        const anyVersion = this.componentIndex.findMatching({
          key: foundRef.ref.key,
          domain: foundRef.ref.domain
        });

        if (anyVersion.length === 0) {
          // Also try by key only
          const byKey = this.componentIndex.findByKey(foundRef.ref.key);

          if (!byKey) {
            const diagnostic = new vscode.Diagnostic(
              foundRef.range,
              `${foundRef.expectedType} not found: "${foundRef.ref.key}" (domain: ${foundRef.ref.domain})`,
              vscode.DiagnosticSeverity.Warning
            );
            diagnostic.source = 'vnext-refs';
            diagnostic.code = `VNEXT_REF_${foundRef.expectedType.toUpperCase()}_NOT_FOUND`;
            diagnostics.push(diagnostic);
          }
        }
      }
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  /**
   * Check if a URI is a workflow file
   */
  private isWorkflowFile(uri: vscode.Uri): boolean {
    const fsPath = uri.fsPath.replace(/\\/g, '/');
    return (
      fsPath.endsWith('.flow.json') ||
      fsPath.endsWith('-subflow.json') ||
      fsPath.endsWith('-workflow.json') ||
      fsPath.includes('/Workflows/') ||
      fsPath.includes('/workflows/')
    );
  }

  /**
   * Validate all currently open documents
   */
  private validateAllOpen(): void {
    for (const doc of vscode.workspace.textDocuments) {
      this.validateDocument(doc);
    }
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

// ─── Quick Fix Code Action Provider ─────────────────────────────────

export class VNextRefCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diag of context.diagnostics) {
      if (diag.source !== 'vnext-refs') continue;
      if (typeof diag.code !== 'string') continue;

      // Extract component type from diagnostic code
      const typeMatch = diag.code.match(/VNEXT_REF_(\w+)_NOT_FOUND/);
      if (!typeMatch) continue;

      const componentType = typeMatch[1].toLowerCase();

      // Create "Create missing component" quick fix
      const action = new vscode.CodeAction(
        `Create missing ${componentType} component`,
        vscode.CodeActionKind.QuickFix
      );
      action.diagnostics = [diag];
      action.isPreferred = true;

      // For now, just show a message (full scaffold implementation can come later)
      action.command = {
        title: `Create ${componentType}`,
        command: 'vnext.createComponentFromRef',
        arguments: [document.uri, componentType, diag.message]
      };

      actions.push(action);
    }

    return actions;
  }
}

/**
 * Register the reference validator and related providers
 */
export function registerJsonReferenceValidator(
  context: vscode.ExtensionContext,
  componentIndex: ComponentIndex
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // Register the validator
  const validator = new JsonReferenceValidator(componentIndex);
  disposables.push(validator);

  // Register the Quick Fix code action provider for workflow files
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    { language: 'json', scheme: 'file' },
    new VNextRefCodeActionProvider(),
    { providedCodeActionKinds: VNextRefCodeActionProvider.providedCodeActionKinds }
  );
  disposables.push(codeActionProvider);

  // Register the "create component from ref" command
  const createCommand = vscode.commands.registerCommand(
    'vnext.createComponentFromRef',
    async (_uri: vscode.Uri, componentType: string, message: string) => {
      vscode.window.showInformationMessage(
        `Create ${componentType} component scaffold: ${message}\n(Coming soon - scaffold generation)`
      );
    }
  );
  disposables.push(createCommand);

  return disposables;
}
