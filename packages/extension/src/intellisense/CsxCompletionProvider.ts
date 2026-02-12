/**
 * CsxCompletionProvider - VS Code CompletionItemProvider for .csx files
 *
 * Provides BBT Workflow API autocomplete for C# script files (.csx)
 * used in vnext workflow mappings and rules.
 *
 * Features:
 * - Context-aware completion (context. → Instance, Body, Headers)
 * - Type/interface suggestions (ScriptBase, IMapping, IConditionMapping)
 * - Method snippets (InputHandler, OutputHandler, Handler templates)
 * - Using statement suggestions
 * - ScriptBase utility methods (GetSecret, Log, etc.)
 */

import * as vscode from 'vscode';

// ─── IntelliSense Data ──────────────────────────────────────────────

interface CsxSuggestion {
  label: string;
  kind: vscode.CompletionItemKind;
  insertText: string;
  documentation: string;
  detail: string;
  sortText: string;
  /** If true, insertText is a snippet */
  isSnippet?: boolean;
  /** Trigger characters / context for this suggestion */
  triggerContext?: string;
}

// ─── Context-aware Suggestions ──────────────────────────────────────

/** Suggestions for `context.` */
const CONTEXT_MEMBERS: CsxSuggestion[] = [
  {
    label: 'Instance',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Instance',
    documentation: 'Workflow instance information including Id, Key, Flow, CurrentState, Status, Data',
    detail: 'BBT.Workflow.Instances.Instance',
    sortText: '001',
    triggerContext: 'context.'
  },
  {
    label: 'Body',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Body',
    documentation: 'Request body data containing task execution results and metadata',
    detail: 'dynamic',
    sortText: '002',
    triggerContext: 'context.'
  },
  {
    label: 'Headers',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Headers',
    documentation: 'HTTP headers from request/response',
    detail: 'dynamic',
    sortText: '003',
    triggerContext: 'context.'
  },
  {
    label: 'RouteValues',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'RouteValues',
    documentation: 'Route parameter values',
    detail: 'Dictionary<string, dynamic>',
    sortText: '004',
    triggerContext: 'context.'
  },
  {
    label: 'Workflow',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Workflow',
    documentation: 'Workflow definition and metadata',
    detail: 'BBT.Workflow.Definitions.Workflow',
    sortText: '005',
    triggerContext: 'context.'
  },
  {
    label: 'Transition',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Transition',
    documentation: 'Current transition being executed',
    detail: 'BBT.Workflow.Definitions.Transition',
    sortText: '006',
    triggerContext: 'context.'
  },
  {
    label: 'CurrentState',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'CurrentState',
    documentation: 'Current state definition',
    detail: 'BBT.Workflow.Definitions.State',
    sortText: '007',
    triggerContext: 'context.'
  },
  {
    label: 'QueryString',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'QueryString',
    documentation: 'Query string parameters',
    detail: 'Dictionary<string, dynamic>',
    sortText: '008',
    triggerContext: 'context.'
  }
];

/** Suggestions for `context.Instance.` */
const INSTANCE_MEMBERS: CsxSuggestion[] = [
  {
    label: 'Id',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Id',
    documentation: 'Unique identifier for this workflow instance',
    detail: 'Guid',
    sortText: '001',
    triggerContext: 'context.Instance.'
  },
  {
    label: 'Key',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Key',
    documentation: 'Human-readable key for the workflow instance',
    detail: 'string',
    sortText: '002',
    triggerContext: 'context.Instance.'
  },
  {
    label: 'Flow',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Flow',
    documentation: 'Flow name that this instance belongs to',
    detail: 'string',
    sortText: '003',
    triggerContext: 'context.Instance.'
  },
  {
    label: 'CurrentState',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'CurrentState',
    documentation: 'Current state of the workflow instance',
    detail: 'string',
    sortText: '004',
    triggerContext: 'context.Instance.'
  },
  {
    label: 'Status',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Status',
    documentation: 'Status of the workflow instance (Active, Completed, etc.)',
    detail: 'InstanceStatus',
    sortText: '005',
    triggerContext: 'context.Instance.'
  },
  {
    label: 'Data',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Data',
    documentation: 'Latest instance data containing workflow variables and state',
    detail: 'dynamic',
    sortText: '006',
    triggerContext: 'context.Instance.'
  },
  {
    label: 'CreatedAt',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'CreatedAt',
    documentation: 'When the workflow instance was created',
    detail: 'DateTime',
    sortText: '007',
    triggerContext: 'context.Instance.'
  },
  {
    label: 'ModifiedAt',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'ModifiedAt',
    documentation: 'When the workflow instance was last modified',
    detail: 'DateTime?',
    sortText: '008',
    triggerContext: 'context.Instance.'
  },
  {
    label: 'UserId',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'UserId',
    documentation: 'User ID associated with this instance',
    detail: 'string',
    sortText: '009',
    triggerContext: 'context.Instance.'
  },
  {
    label: 'CorrelationId',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'CorrelationId',
    documentation: 'Correlation ID for tracking across services',
    detail: 'string',
    sortText: '010',
    triggerContext: 'context.Instance.'
  },
  {
    label: 'Domain',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Domain',
    documentation: 'Domain of the workflow instance',
    detail: 'string',
    sortText: '011',
    triggerContext: 'context.Instance.'
  }
];

/** Suggestions for `context.Body.` */
const BODY_MEMBERS: CsxSuggestion[] = [
  {
    label: 'StatusCode',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'StatusCode',
    documentation: 'HTTP status code from task execution (for HTTP and Dapr tasks)',
    detail: 'int?',
    sortText: '001',
    triggerContext: 'context.Body.'
  },
  {
    label: 'Data',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Data',
    documentation: 'Response data from the executed task',
    detail: 'object',
    sortText: '002',
    triggerContext: 'context.Body.'
  },
  {
    label: 'ErrorMessage',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'ErrorMessage',
    documentation: 'Error message if the task execution failed',
    detail: 'string',
    sortText: '003',
    triggerContext: 'context.Body.'
  },
  {
    label: 'IsSuccess',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'IsSuccess',
    documentation: 'Boolean indicating if the task execution was successful',
    detail: 'bool?',
    sortText: '004',
    triggerContext: 'context.Body.'
  },
  {
    label: 'TaskType',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'TaskType',
    documentation: 'Type of the executed task (HTTP, Dapr, etc.)',
    detail: 'string',
    sortText: '005',
    triggerContext: 'context.Body.'
  },
  {
    label: 'ExecutionDurationMs',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'ExecutionDurationMs',
    documentation: 'Execution duration in milliseconds',
    detail: 'long?',
    sortText: '006',
    triggerContext: 'context.Body.'
  },
  {
    label: 'Headers',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Headers',
    documentation: 'HTTP headers from the task response',
    detail: 'Dictionary<string, string>',
    sortText: '007',
    triggerContext: 'context.Body.'
  },
  {
    label: 'Metadata',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Metadata',
    documentation: 'Additional metadata from task execution',
    detail: 'Dictionary<string, object>',
    sortText: '008',
    triggerContext: 'context.Body.'
  }
];

/** Suggestions for `response.` (ScriptResponse) */
const RESPONSE_MEMBERS: CsxSuggestion[] = [
  {
    label: 'Data',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Data',
    documentation: 'Response data to pass to the next task or store',
    detail: 'object',
    sortText: '001',
    triggerContext: 'response.'
  },
  {
    label: 'Headers',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'Headers',
    documentation: 'Response headers to include in the HTTP response',
    detail: 'Dictionary<string, string>',
    sortText: '002',
    triggerContext: 'response.'
  },
  {
    label: 'StatusCode',
    kind: vscode.CompletionItemKind.Property,
    insertText: 'StatusCode',
    documentation: 'HTTP status code for the response',
    detail: 'int',
    sortText: '003',
    triggerContext: 'response.'
  }
];

/** Top-level class/interface suggestions */
const TYPE_SUGGESTIONS: CsxSuggestion[] = [
  {
    label: 'ScriptBase',
    kind: vscode.CompletionItemKind.Class,
    insertText: 'ScriptBase',
    documentation: 'Base class for scripts that provides access to global functions like GetSecret, Log',
    detail: 'BBT.Workflow.Scripting.Functions.ScriptBase',
    sortText: '001'
  },
  {
    label: 'IMapping',
    kind: vscode.CompletionItemKind.Interface,
    insertText: 'IMapping',
    documentation: 'Interface for implementing workflow task mappings with InputHandler and OutputHandler methods',
    detail: 'BBT.Workflow.Scripting.IMapping',
    sortText: '002'
  },
  {
    label: 'IConditionMapping',
    kind: vscode.CompletionItemKind.Interface,
    insertText: 'IConditionMapping',
    documentation: 'Interface for implementing conditional mappings that return boolean results',
    detail: 'BBT.Workflow.Scripting.IConditionMapping',
    sortText: '003'
  },
  {
    label: 'ScriptContext',
    kind: vscode.CompletionItemKind.Class,
    insertText: 'ScriptContext',
    documentation: 'Provides access to workflow instance, request body, headers, and other runtime context',
    detail: 'BBT.Workflow.Scripting.ScriptContext',
    sortText: '004'
  },
  {
    label: 'ScriptResponse',
    kind: vscode.CompletionItemKind.Class,
    insertText: 'ScriptResponse',
    documentation: 'Response object returned from mapping handlers',
    detail: 'BBT.Workflow.Scripting.ScriptResponse',
    sortText: '005'
  },
  {
    label: 'WorkflowTask',
    kind: vscode.CompletionItemKind.Class,
    insertText: 'WorkflowTask',
    documentation: 'Base class for workflow tasks',
    detail: 'BBT.Workflow.Definitions.WorkflowTask',
    sortText: '006'
  },
  {
    label: 'HttpTask',
    kind: vscode.CompletionItemKind.Class,
    insertText: 'HttpTask',
    documentation: 'HTTP task for making API calls',
    detail: 'BBT.Workflow.Definitions.HttpTask',
    sortText: '007'
  },
  {
    label: 'DaprHttpEndpointTask',
    kind: vscode.CompletionItemKind.Class,
    insertText: 'DaprHttpEndpointTask',
    documentation: 'Dapr HTTP endpoint task for service-to-service communication',
    detail: 'BBT.Workflow.Definitions.DaprHttpEndpointTask',
    sortText: '008'
  }
];

/** ScriptBase methods (available via `this.` or direct call) */
const SCRIPTBASE_METHODS: CsxSuggestion[] = [
  {
    label: 'GetSecret',
    kind: vscode.CompletionItemKind.Method,
    insertText: 'GetSecret("${1:storeName}", "${2:secretName}", "${3:key}")',
    documentation: 'Retrieves a secret from the configured secret store (Dapr)',
    detail: 'string GetSecret(string storeName, string secretName, string key)',
    sortText: '001',
    isSnippet: true
  },
  {
    label: 'Log',
    kind: vscode.CompletionItemKind.Method,
    insertText: 'Log("${1:message}")',
    documentation: 'Logs a message to the workflow execution log',
    detail: 'void Log(string message)',
    sortText: '002',
    isSnippet: true
  },
  {
    label: 'LogError',
    kind: vscode.CompletionItemKind.Method,
    insertText: 'LogError("${1:message}", ${2:exception})',
    documentation: 'Logs an error message with optional exception',
    detail: 'void LogError(string message, Exception? ex = null)',
    sortText: '003',
    isSnippet: true
  }
];

/** Using statement suggestions */
const USING_SUGGESTIONS: CsxSuggestion[] = [
  {
    label: 'using BBT.Workflow.Scripting',
    kind: vscode.CompletionItemKind.Keyword,
    insertText: 'using BBT.Workflow.Scripting;',
    documentation: 'Main BBT Workflow scripting namespace',
    detail: 'using statement',
    sortText: '001'
  },
  {
    label: 'using BBT.Workflow.Definitions',
    kind: vscode.CompletionItemKind.Keyword,
    insertText: 'using BBT.Workflow.Definitions;',
    documentation: 'BBT Workflow definitions namespace',
    detail: 'using statement',
    sortText: '002'
  },
  {
    label: 'using BBT.Workflow.Scripting.Functions',
    kind: vscode.CompletionItemKind.Keyword,
    insertText: 'using BBT.Workflow.Scripting.Functions;',
    documentation: 'BBT Workflow scripting functions namespace',
    detail: 'using statement',
    sortText: '003'
  },
  {
    label: 'using BBT.Workflow.Instances',
    kind: vscode.CompletionItemKind.Keyword,
    insertText: 'using BBT.Workflow.Instances;',
    documentation: 'BBT Workflow instances namespace',
    detail: 'using statement',
    sortText: '004'
  },
  {
    label: 'using System.Text.Json',
    kind: vscode.CompletionItemKind.Keyword,
    insertText: 'using System.Text.Json;',
    documentation: 'JSON serialization/deserialization',
    detail: 'using statement',
    sortText: '005'
  },
  {
    label: 'using System.Linq',
    kind: vscode.CompletionItemKind.Keyword,
    insertText: 'using System.Linq;',
    documentation: 'LINQ query operators',
    detail: 'using statement',
    sortText: '006'
  }
];

/** Full class template snippets */
const TEMPLATE_SNIPPETS: CsxSuggestion[] = [
  {
    label: 'IMapping Class',
    kind: vscode.CompletionItemKind.Snippet,
    insertText: [
      '/// <summary>',
      '/// ${1:MappingName} - Implements IMapping for workflow processing',
      '/// </summary>',
      'public class ${1:MappingName}Mapping : ScriptBase, IMapping',
      '{',
      '    public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)',
      '    {',
      '        var response = new ScriptResponse();',
      '',
      '        response.Data = new',
      '        {',
      '            instanceId = context.Instance.Id,',
      '            $0',
      '        };',
      '',
      '        return response;',
      '    }',
      '',
      '    public async Task<ScriptResponse> OutputHandler(ScriptContext context)',
      '    {',
      '        var response = new ScriptResponse();',
      '        return response;',
      '    }',
      '}'
    ].join('\n'),
    documentation: 'Complete IMapping class template with InputHandler and OutputHandler',
    detail: 'IMapping class snippet',
    sortText: '000',
    isSnippet: true
  },
  {
    label: 'IConditionMapping Class',
    kind: vscode.CompletionItemKind.Snippet,
    insertText: [
      '/// <summary>',
      '/// ${1:RuleName} - Implements IConditionMapping for workflow conditions',
      '/// </summary>',
      'public class ${1:RuleName}Rule : IConditionMapping',
      '{',
      '    public async Task<bool> Handler(ScriptContext context)',
      '    {',
      '        $0',
      '        return true;',
      '    }',
      '}'
    ].join('\n'),
    documentation: 'Complete IConditionMapping class template for rules',
    detail: 'IConditionMapping class snippet',
    sortText: '001',
    isSnippet: true
  },
  {
    label: 'InputHandler',
    kind: vscode.CompletionItemKind.Snippet,
    insertText: [
      'public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)',
      '{',
      '    var response = new ScriptResponse();',
      '    $0',
      '    return response;',
      '}'
    ].join('\n'),
    documentation: 'InputHandler method for IMapping implementations',
    detail: 'Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)',
    sortText: '002',
    isSnippet: true
  },
  {
    label: 'OutputHandler',
    kind: vscode.CompletionItemKind.Snippet,
    insertText: [
      'public async Task<ScriptResponse> OutputHandler(ScriptContext context)',
      '{',
      '    var response = new ScriptResponse();',
      '    $0',
      '    return response;',
      '}'
    ].join('\n'),
    documentation: 'OutputHandler method for IMapping implementations',
    detail: 'Task<ScriptResponse> OutputHandler(ScriptContext context)',
    sortText: '003',
    isSnippet: true
  },
  {
    label: 'Handler (condition)',
    kind: vscode.CompletionItemKind.Snippet,
    insertText: [
      'public async Task<bool> Handler(ScriptContext context)',
      '{',
      '    $0',
      '    return true;',
      '}'
    ].join('\n'),
    documentation: 'Handler method for IConditionMapping implementations',
    detail: 'Task<bool> Handler(ScriptContext context)',
    sortText: '004',
    isSnippet: true
  }
];

// ─── Completion Provider ────────────────────────────────────────────

export class CsxCompletionProvider implements vscode.CompletionItemProvider {

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionTriggerKind
  ): vscode.CompletionItem[] {
    const lineText = document.lineAt(position).text;
    const linePrefix = lineText.substring(0, position.character);

    // Determine context and provide appropriate suggestions
    const items: vscode.CompletionItem[] = [];

    // Context-aware: context.Instance.
    if (linePrefix.endsWith('context.Instance.')) {
      return this.buildCompletionItems(INSTANCE_MEMBERS);
    }

    // Context-aware: context.Body.
    if (linePrefix.endsWith('context.Body.')) {
      return this.buildCompletionItems(BODY_MEMBERS);
    }

    // Context-aware: context.
    if (linePrefix.endsWith('context.')) {
      return this.buildCompletionItems(CONTEXT_MEMBERS);
    }

    // Context-aware: response.
    if (linePrefix.endsWith('response.')) {
      return this.buildCompletionItems(RESPONSE_MEMBERS);
    }

    // Using statements
    if (linePrefix.trimStart().startsWith('using ')) {
      return this.buildCompletionItems(USING_SUGGESTIONS);
    }

    // Top-level completions: types, methods, templates
    items.push(...this.buildCompletionItems(TYPE_SUGGESTIONS));
    items.push(...this.buildCompletionItems(SCRIPTBASE_METHODS));
    items.push(...this.buildCompletionItems(TEMPLATE_SNIPPETS));
    items.push(...this.buildCompletionItems(USING_SUGGESTIONS));

    return items;
  }

  private buildCompletionItems(suggestions: CsxSuggestion[]): vscode.CompletionItem[] {
    return suggestions.map(s => {
      const item = new vscode.CompletionItem(s.label, s.kind);

      if (s.isSnippet) {
        item.insertText = new vscode.SnippetString(s.insertText);
      } else {
        item.insertText = s.insertText;
      }

      item.documentation = new vscode.MarkdownString(s.documentation);
      item.detail = s.detail;
      item.sortText = s.sortText;

      return item;
    });
  }
}

/**
 * Register the CSX Completion Provider
 */
export function registerCsxCompletionProvider(
  context: vscode.ExtensionContext
): vscode.Disposable {
  const provider = new CsxCompletionProvider();

  return vscode.languages.registerCompletionItemProvider(
    { scheme: 'file', pattern: '**/*.csx' },
    provider,
    '.' // Trigger on dot
  );
}
