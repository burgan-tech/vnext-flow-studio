/**
 * JsonDefinitionProvider - Go-to-Definition for vnext JSON files
 *
 * Provides Ctrl+Click navigation from component references in JSON files
 * to their definition files. Supports:
 * - task references (ExecutionTask.task)
 * - schema references (transition.schema)
 * - process references (subFlow.process)
 * - view references (state.view.view)
 */

import * as vscode from 'vscode';
import { ComponentIndex, ComponentRef } from './ComponentIndex';

// ─── JSON Path Parser ────────────────────────────────────────────────

interface JsonContext {
  /** The parent property key chain leading to cursor position */
  propertyPath: string[];
  /** The object containing the cursor position */
  currentObject: Record<string, unknown> | undefined;
  /** The full parsed JSON */
  root: Record<string, unknown>;
}

/**
 * Parse JSON and find the context at a given offset
 */
function getJsonContextAtOffset(text: string, offset: number): JsonContext | undefined {
  try {
    const root = JSON.parse(text);
    // Find which object block the cursor is in by scanning brackets
    const propertyPath = findPropertyPathAtOffset(text, offset);
    const currentObject = navigateToPath(root, propertyPath);

    return { propertyPath, currentObject: currentObject as Record<string, unknown>, root };
  } catch {
    return undefined;
  }
}

/**
 * Find the JSON property path at a given text offset
 * Returns array of property names leading to the current position
 */
function findPropertyPathAtOffset(text: string, offset: number): string[] {
  const path: string[] = [];
  const stack: { key: string; start: number }[] = [];
  let i = 0;
  let inString = false;
  let escapeNext = false;
  let currentKey = '';
  let collectingKey = false;
  let afterColon = false;

  while (i < offset && i < text.length) {
    const ch = text[i];

    if (escapeNext) {
      if (collectingKey) currentKey += ch;
      escapeNext = false;
      i++;
      continue;
    }

    if (ch === '\\') {
      escapeNext = true;
      if (collectingKey) currentKey += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        collectingKey = !afterColon;
        currentKey = '';
      } else {
        inString = false;
        if (collectingKey) {
          // This was a property key
          collectingKey = false;
        }
      }
      i++;
      continue;
    }

    if (inString) {
      if (collectingKey) currentKey += ch;
      i++;
      continue;
    }

    if (ch === ':') {
      afterColon = true;
      i++;
      continue;
    }

    if (ch === '{') {
      if (currentKey) {
        stack.push({ key: currentKey, start: i });
      } else {
        // Anonymous object (like root or array element)
        stack.push({ key: '', start: i });
      }
      afterColon = false;
      currentKey = '';
      i++;
      continue;
    }

    if (ch === '}') {
      if (stack.length > 0) {
        stack.pop();
      }
      afterColon = false;
      currentKey = '';
      i++;
      continue;
    }

    if (ch === '[') {
      afterColon = false;
      i++;
      continue;
    }

    if (ch === ',') {
      afterColon = false;
      currentKey = '';
      i++;
      continue;
    }

    i++;
  }

  // Build path from stack
  for (const frame of stack) {
    if (frame.key) {
      path.push(frame.key);
    }
  }

  return path;
}

/**
 * Navigate to a nested path in a JSON object
 */
function navigateToPath(obj: unknown, path: string[]): unknown {
  let current = obj;
  for (const key of path) {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

// ─── Reference Extractor ────────────────────────────────────────────

/** Reference context types we recognize */
type RefType = 'task' | 'schema' | 'view' | 'process';

/**
 * Check if a JSON property path represents a component reference
 */
function detectRefType(propertyPath: string[]): RefType | undefined {
  const joined = propertyPath.join('.');

  // Direct task reference: onEntries[n].task, onExits[n].task, onExecutionTasks[n].task
  if (/\btask$/.test(joined)) return 'task';

  // Schema reference: transitions[n].schema, startTransition.schema
  if (/\bschema$/.test(joined)) return 'schema';

  // View reference: view.view (nested inside ViewConfig)
  if (/\bview\.view$/.test(joined) || /\bview$/.test(joined)) return 'view';

  // Process/SubFlow reference: subFlow.process
  if (/\bprocess$/.test(joined)) return 'process';

  return undefined;
}

/**
 * Try to extract a ComponentRef from a JSON object
 */
function extractRef(obj: unknown): ComponentRef | undefined {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;

  const record = obj as Record<string, unknown>;
  const key = record.key;
  const domain = record.domain;
  const version = record.version;
  const flow = record.flow;

  if (typeof key === 'string' && typeof domain === 'string' && typeof version === 'string') {
    return {
      key,
      domain,
      flow: typeof flow === 'string' ? flow : '',
      version
    };
  }

  return undefined;
}

// ─── Definition Provider ────────────────────────────────────────────

export class JsonDefinitionProvider implements vscode.DefinitionProvider {
  private componentIndex: ComponentIndex;

  constructor(componentIndex: ComponentIndex) {
    this.componentIndex = componentIndex;
  }

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Definition | undefined> {
    // Only handle JSON files
    if (document.languageId !== 'json' && document.languageId !== 'jsonc') {
      return undefined;
    }

    // Wait for index to be ready
    if (!this.componentIndex.isReady) {
      return undefined;
    }

    const text = document.getText();
    const offset = document.offsetAt(position);

    // Get JSON context at cursor
    const ctx = getJsonContextAtOffset(text, offset);
    if (!ctx || !ctx.currentObject) return undefined;

    // Detect if we're inside a reference object
    const refType = detectRefType(ctx.propertyPath);

    if (refType) {
      // The currentObject should be the reference itself
      const ref = extractRef(ctx.currentObject);
      if (ref) {
        return this.resolveDefinition(ref);
      }
    }

    // Also try: cursor is on a property value that IS a reference object
    // e.g. cursor on the "key" value inside { "key": "xxx", "domain": "yyy", ... }
    // Check if parent context has reference fields
    const parentPath = ctx.propertyPath.slice(0, -1);
    if (parentPath.length > 0) {
      const parentObj = navigateToPath(ctx.root, parentPath);
      const parentRefType = detectRefType(parentPath);
      if (parentRefType) {
        const ref = extractRef(parentObj);
        if (ref) {
          return this.resolveDefinition(ref);
        }
      }
    }

    // Also check: the current object itself might be a reference
    // (when cursor is inside { "key": "xxx", "domain": "yyy" } block directly)
    const selfRef = extractRef(ctx.currentObject);
    if (selfRef && selfRef.key && selfRef.domain) {
      // Check if this looks like a component reference (has flow pattern)
      if (selfRef.flow && selfRef.flow.startsWith('sys-')) {
        return this.resolveDefinition(selfRef);
      }
    }

    return undefined;
  }

  /**
   * Resolve a component reference to its file location
   */
  private resolveDefinition(ref: ComponentRef): vscode.Location | undefined {
    // Try exact match first
    let component = this.componentIndex.findByRef(ref);

    if (!component) {
      // Try without version (find any version)
      const matches = this.componentIndex.findMatching({
        key: ref.key,
        domain: ref.domain
      });

      if (matches.length > 0) {
        component = matches[0];
      }
    }

    if (!component) {
      // Last resort: try by key only
      component = this.componentIndex.findByKey(ref.key);
    }

    if (component) {
      return new vscode.Location(component.uri, new vscode.Position(0, 0));
    }

    return undefined;
  }
}

/**
 * Register the JSON Definition Provider
 */
export function registerJsonDefinitionProvider(
  context: vscode.ExtensionContext,
  componentIndex: ComponentIndex
): vscode.Disposable {
  const provider = new JsonDefinitionProvider(componentIndex);

  return vscode.languages.registerDefinitionProvider(
    { language: 'json', scheme: 'file' },
    provider
  );
}
