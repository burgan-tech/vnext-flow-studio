/**
 * CsxHoverProvider - VS Code HoverProvider for .csx files
 *
 * Shows documentation on hover for BBT Workflow API types,
 * properties, and methods in C# script files.
 */

import * as vscode from 'vscode';

// ─── Hover Documentation Database ──────────────────────────────────

interface HoverDoc {
  /** Pattern to match the word/expression under cursor */
  pattern: RegExp;
  /** Markdown content to display */
  markdown: string;
}

const HOVER_DOCS: HoverDoc[] = [
  // ── Classes/Interfaces ──────────────────────────────────
  {
    pattern: /\bScriptBase\b/,
    markdown: [
      '### ScriptBase',
      '`BBT.Workflow.Scripting.Functions.ScriptBase`',
      '',
      'Base class for scripts that provides access to global utility functions.',
      '',
      '**Methods:**',
      '- `GetSecret(storeName, secretName, key)` - Retrieve secrets from Dapr secret store',
      '- `Log(message)` - Log a message',
      '- `LogError(message, exception?)` - Log an error'
    ].join('\n')
  },
  {
    pattern: /\bIMapping\b/,
    markdown: [
      '### IMapping',
      '`BBT.Workflow.Scripting.IMapping`',
      '',
      'Interface for implementing workflow task mappings.',
      '',
      '**Methods:**',
      '- `InputHandler(WorkflowTask task, ScriptContext context)` → `Task<ScriptResponse>`',
      '- `OutputHandler(ScriptContext context)` → `Task<ScriptResponse>`',
      '',
      'Implement both methods to transform data before/after task execution.'
    ].join('\n')
  },
  {
    pattern: /\bIConditionMapping\b/,
    markdown: [
      '### IConditionMapping',
      '`BBT.Workflow.Scripting.IConditionMapping`',
      '',
      'Interface for implementing conditional mappings (rules).',
      '',
      '**Methods:**',
      '- `Handler(ScriptContext context)` → `Task<bool>`',
      '',
      'Return `true` to allow the transition, `false` to block it.'
    ].join('\n')
  },
  {
    pattern: /\bScriptContext\b/,
    markdown: [
      '### ScriptContext',
      '`BBT.Workflow.Scripting.ScriptContext`',
      '',
      'Provides access to the current workflow execution context.',
      '',
      '**Properties:**',
      '- `Instance` - Current workflow instance (Id, Key, State, Data)',
      '- `Body` - Request/response body data',
      '- `Headers` - HTTP headers',
      '- `RouteValues` - Route parameter values',
      '- `Workflow` - Workflow definition',
      '- `Transition` - Current transition',
      '- `CurrentState` - Current state definition',
      '- `QueryString` - Query string parameters'
    ].join('\n')
  },
  {
    pattern: /\bScriptResponse\b/,
    markdown: [
      '### ScriptResponse',
      '`BBT.Workflow.Scripting.ScriptResponse`',
      '',
      'Response object returned from mapping handlers.',
      '',
      '**Properties:**',
      '- `Data` (`object`) - Response data',
      '- `Headers` (`Dictionary<string, string>`) - Response headers',
      '- `StatusCode` (`int`) - HTTP status code'
    ].join('\n')
  },
  {
    pattern: /\bWorkflowTask\b/,
    markdown: [
      '### WorkflowTask',
      '`BBT.Workflow.Definitions.WorkflowTask`',
      '',
      'Base class for all workflow task definitions.',
      '',
      'Cast to specific types for task-specific properties:',
      '- `HttpTask` - HTTP API calls',
      '- `DaprHttpEndpointTask` - Dapr service-to-service',
      '- `HumanTask` - User interaction tasks',
      '- `BusTask` - Message bus tasks'
    ].join('\n')
  },

  // ── ScriptContext Properties ─────────────────────────────
  {
    pattern: /\bcontext\.Instance\b/,
    markdown: [
      '### context.Instance',
      '`BBT.Workflow.Instances.Instance`',
      '',
      'Current workflow instance information.',
      '',
      '**Properties:**',
      '- `Id` (Guid) - Unique instance identifier',
      '- `Key` (string) - Human-readable key',
      '- `Flow` (string) - Flow name',
      '- `CurrentState` (string) - Current state',
      '- `Status` (InstanceStatus) - Active/Completed/Failed',
      '- `Data` (dynamic) - Instance data',
      '- `Domain` (string) - Domain name',
      '- `UserId` (string) - Associated user',
      '- `CorrelationId` (string) - Correlation ID',
      '- `CreatedAt` (DateTime) - Creation time',
      '- `ModifiedAt` (DateTime?) - Last modification time'
    ].join('\n')
  },
  {
    pattern: /\bcontext\.Body\b/,
    markdown: [
      '### context.Body',
      '`dynamic`',
      '',
      'Request body data containing task execution results.',
      '',
      '**Properties:**',
      '- `StatusCode` (int?) - HTTP status code',
      '- `Data` (object) - Response data',
      '- `ErrorMessage` (string) - Error message if failed',
      '- `IsSuccess` (bool?) - Whether task succeeded',
      '- `TaskType` (string) - Type of executed task',
      '- `ExecutionDurationMs` (long?) - Duration in ms',
      '- `Headers` (Dictionary) - Response headers',
      '- `Metadata` (Dictionary) - Additional metadata'
    ].join('\n')
  },
  {
    pattern: /\bcontext\.Headers\b/,
    markdown: [
      '### context.Headers',
      '`dynamic`',
      '',
      'HTTP headers from the incoming request.'
    ].join('\n')
  },
  {
    pattern: /\bcontext\.Workflow\b/,
    markdown: [
      '### context.Workflow',
      '`BBT.Workflow.Definitions.Workflow`',
      '',
      'The workflow definition currently being executed.',
      'Includes states, transitions, and metadata.'
    ].join('\n')
  },
  {
    pattern: /\bcontext\.Transition\b/,
    markdown: [
      '### context.Transition',
      '`BBT.Workflow.Definitions.Transition`',
      '',
      'The current transition being executed.',
      'Includes source/target states, trigger type, and schema.'
    ].join('\n')
  },

  // ── Methods ─────────────────────────────────────────────
  {
    pattern: /\bGetSecret\b/,
    markdown: [
      '### GetSecret',
      '`string GetSecret(string storeName, string secretName, string key)`',
      '',
      'Retrieves a secret from the configured Dapr secret store.',
      '',
      '**Parameters:**',
      '- `storeName` - Dapr secret store name (e.g., "dapr_store")',
      '- `secretName` - Secret name (e.g., "api_store")',
      '- `key` - Key within the secret (e.g., "auth_token")',
      '',
      '**Example:**',
      '```csharp',
      'var token = GetSecret("dapr_store", "api_store", "auth_token");',
      '```'
    ].join('\n')
  },
  {
    pattern: /\bInputHandler\b/,
    markdown: [
      '### InputHandler',
      '`Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)`',
      '',
      'Handles input processing before task execution.',
      'Prepare request data and headers for the target task.',
      '',
      'The `task` parameter can be cast to specific task types:',
      '```csharp',
      'var httpTask = (task as HttpTask)!;',
      '```'
    ].join('\n')
  },
  {
    pattern: /\bOutputHandler\b/,
    markdown: [
      '### OutputHandler',
      '`Task<ScriptResponse> OutputHandler(ScriptContext context)`',
      '',
      'Handles output processing after task execution.',
      'Transform response data and update instance state.'
    ].join('\n')
  },
  {
    pattern: /\bHandler\b/,
    markdown: [
      '### Handler (IConditionMapping)',
      '`Task<bool> Handler(ScriptContext context)`',
      '',
      'Evaluates a condition for the workflow transition.',
      'Return `true` to allow, `false` to block the transition.'
    ].join('\n')
  }
];

// ─── Hover Provider ─────────────────────────────────────────────────

export class CsxHoverProvider implements vscode.HoverProvider {

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Hover | undefined {
    // Get word range at position
    const wordRange = document.getWordRangeAtPosition(position, /[\w.]+/);
    if (!wordRange) return undefined;

    const word = document.getText(wordRange);

    // Also check the line for broader context (e.g., "context.Instance")
    const lineText = document.lineAt(position).text;

    // Try to match against hover docs
    for (const doc of HOVER_DOCS) {
      // Check if the word or line context matches
      if (doc.pattern.test(word) || doc.pattern.test(lineText)) {
        // Verify the match is at the cursor position
        const match = doc.pattern.exec(word) || doc.pattern.exec(lineText);
        if (match) {
          const md = new vscode.MarkdownString(doc.markdown);
          md.isTrusted = true;
          return new vscode.Hover(md, wordRange);
        }
      }
    }

    return undefined;
  }
}

/**
 * Register the CSX Hover Provider
 */
export function registerCsxHoverProvider(
  _context: vscode.ExtensionContext
): vscode.Disposable {
  const provider = new CsxHoverProvider();

  return vscode.languages.registerHoverProvider(
    { scheme: 'file', pattern: '**/*.csx' },
    provider
  );
}
