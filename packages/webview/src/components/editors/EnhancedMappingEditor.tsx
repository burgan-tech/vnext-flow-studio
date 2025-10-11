import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import type { State, Workflow, TaskComponentDefinition } from '@amorphie-flow-studio/core';
import type { IntelliSenseItem, MappingConfiguration, WorkflowContext } from '../../types/ui-helpers';
import { TaskTypeInfo } from '../../types/ui-helpers';
import { getAllBBTWorkflowIntelliSense } from '../../types/bbt-workflow-intellisense';
import { ScriptSelector, type ScriptItem } from './ScriptSelector';

// Monaco Editor Worker Configuration for VS Code Webview
declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment;
  }
}

// Initialize Monaco Environment for proper worker support
if (typeof window !== 'undefined' && !window.MonacoEnvironment) {
  window.MonacoEnvironment = {
    getWorker: function(workerId: string, label: string) {
      console.log(`🔧 Creating Monaco worker for: ${label}`);

      const createSimpleWorker = () => {
        const workerCode = `
          self.addEventListener('message', function(event) {
            const { id, method, params } = event.data || {};

            try {
              let result = null;

              switch (method) {
                case 'initialize':
                  result = { capabilities: {} };
                  break;
                case 'textDocument/completion':
                  result = { items: [] };
                  break;
                case 'textDocument/hover':
                  result = null;
                  break;
                case 'textDocument/signatureHelp':
                  result = { signatures: [], activeSignature: 0, activeParameter: 0 };
                  break;
                default:
                  result = null;
              }

              self.postMessage({
                id: id || 0,
                result: result
              });

            } catch (error) {
              console.error('Worker error:', error);
              self.postMessage({
                id: id || 0,
                error: { message: error.message || 'Worker error' }
              });
            }
          });

          self.postMessage({ type: 'ready' });
        `;

        try {
          const blob = new Blob([workerCode], { type: 'application/javascript' });
          return new Worker(URL.createObjectURL(blob));
        } catch (error) {
          console.error(`❌ Failed to create worker for ${label}:`, error);

          return {
            postMessage: function(msg: any) {
              const self = this as any;
              setTimeout(() => {
                if (self.onmessage) {
                  self.onmessage({ data: { id: msg.id || 0, result: null } });
                }
              }, 1);
            },
            addEventListener: function(type: string, listener: any) {
              if (type === 'message') {
                (this as any).onmessage = listener;
              }
            },
            removeEventListener: () => {},
            terminate: () => {},
            onmessage: null,
            onerror: null
          } as any;
        }
      };

      return createSimpleWorker();
    }
  };
}

// Interface is now imported from workflow-types.ts

interface EnhancedMappingEditorProps {
  mapping: MappingConfiguration;
  onMappingChange: (mapping: MappingConfiguration) => void;
  onError: (error: string) => void;
  onMessage: (message: string) => void;
  height?: string;
  readOnly?: boolean;
  showTemplateSelector?: boolean;
  allowFullScreen?: boolean;
  workspaceRoot?: string;
  enableLSP?: boolean;
  mappingType?: string;
  includeReferences?: string[];
  // Enhanced context
  currentState?: State;
  workflow?: Workflow;
  availableTasks?: TaskComponentDefinition[];
  availableMappers?: ScriptItem[];
  currentTask?: TaskComponentDefinition;
}

interface MappingTemplate {
  name: string;
  description: string;
  code: string;
  category: 'basic' | 'async' | 'validation' | 'condition';
}

const MAPPING_TEMPLATES: MappingTemplate[] = [
  {
    name: 'IMapping Input Handler',
    description: 'BBT Workflow IMapping InputHandler template',
    code: `public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
{
    var response = new ScriptResponse();

    // Prepare request data from workflow instance
    response.Data = new
    {
        userId = context.Instance.UserId,
        workflowId = context.Instance.Id,
        requestTime = DateTime.UtcNow
    };

    // Set custom headers
    response.Headers = new Dictionary<string, string>
    {
        ["X-Correlation-Id"] = context.Instance.CorrelationId,
        ["X-User-Id"] = context.Instance.UserId
    };

    return response;
}`,
    category: 'basic'
  },
  {
    name: 'IMapping Output Handler',
    description: 'BBT Workflow IMapping OutputHandler template',
    code: `public async Task<ScriptResponse> OutputHandler(ScriptContext context)
{
    var response = new ScriptResponse();

    // Handle HTTP status codes
    if (context.Body.StatusCode != null)
    {
        var statusCode = (int)context.Body.StatusCode;

        if (statusCode == 200)
        {
            // Success - process the actual data
            response.Data = new
            {
                success = true,
                result = context.Body.Data,
                processedAt = DateTime.UtcNow
            };
        }
        else if (statusCode >= 500)
        {
            // Server error - might want to retry
            response.Data = new
            {
                success = false,
                error = "Server error occurred",
                shouldRetry = true,
                retryAfter = 30
            };
        }
        else if (statusCode >= 400)
        {
            // Client error - don't retry
            response.Data = new
            {
                success = false,
                error = context.Body.ErrorMessage ?? "Client error occurred",
                shouldRetry = false
            };
        }
    }

    return response;
}`,
    category: 'basic'
  },
  {
    name: 'IConditionMapping Handler',
    description: 'BBT Workflow IConditionMapping Handler template',
    code: `public async Task<bool> Handler(ScriptContext context)
{
    // Add your condition logic here
    // Return true if condition is met, false otherwise

    // Example: Check user permissions or business rules
    var userId = context.Instance.UserId;

    return await Task.FromResult(true);
}`,
    category: 'condition'
  },
  {
    name: 'Validation Mapping',
    description: 'Validate input data before processing',
    code: `// Validation mapping
if (input == null) {
    return new {
        isValid = false,
        error = "Input data is required"
    };
}

// Add your validation logic here
var isValid = input.Amount > 0 && !string.IsNullOrEmpty(input.UserId);

return new {
    isValid = isValid,
    data = input,
    validatedAt = DateTime.UtcNow
};`,
    category: 'validation'
  },
  {
    name: 'Conditional Logic',
    description: 'Mapping with conditional branching',
    code: `// Conditional mapping based on input
if (input.UserType == "PREMIUM") {
    return new {
        path = "premium-flow",
        priority = "high",
        data = input
    };
} else if (input.Amount > 10000) {
    return new {
        path = "high-value-flow",
        priority = "medium",
        data = input
    };
} else {
    return new {
        path = "standard-flow",
        priority = "low",
        data = input
    };
}`,
    category: 'condition'
  }
];

export const EnhancedMappingEditor: React.FC<EnhancedMappingEditorProps> = ({
  mapping,
  onMappingChange,
  onError,
  onMessage,
  height = '400px',
  readOnly = false,
  showTemplateSelector = true,
  allowFullScreen = false,
  currentState,
  workflow,
  availableTasks = [],
  availableMappers = [],
  currentTask
}) => {
  const [editorContent, setEditorContent] = useState<string>('');
  const [isEditorReady, setIsEditorReady] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [showTemplates, setShowTemplates] = useState<boolean>(false);
  const [showScriptSelector, setShowScriptSelector] = useState<boolean>(false);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticChange = useRef<boolean>(false);

  // Initialize editor content from mapping
  useEffect(() => {
    if (mapping.code) {
      try {
        // Use UTF-8 safe decoding instead of atob
        const decodedContent = decodeURIComponent(escape(atob(mapping.code)));
        setEditorContent(decodedContent);
        onMessage('Loaded mapping from base64 content');
      } catch {
        // Fallback: try plain atob for backward compatibility
        try {
          const decodedContent = atob(mapping.code);
          setEditorContent(decodedContent);
          onMessage('Loaded mapping from base64 content (legacy)');
        } catch {
          setEditorContent(mapping.code);
          onMessage('Loaded mapping content directly');
        }
      }
    } else {
      const templateContent = getDefaultTemplate();
      setEditorContent(templateContent);
      onMessage('Initialized with default template');
    }
  }, [mapping.code, onMessage]);

  const getDefaultTemplate = () => {
    return `// C# Mapping Script
// Use 'input' to access input data
// Use 'Context' for workflow variables

return new {
    // Add your mapping logic here
    processedAt = DateTime.UtcNow,
    data = input,
    success = true
};`;
  };

  // Initialize Monaco Editor
  useEffect(() => {
    const initializeEditor = async () => {
      if (!editorContainerRef.current) return;

      try {
        onMessage('🚀 Initializing Monaco Editor...');

        // Wait for Monaco to be fully loaded
        while (typeof monaco === 'undefined' || !monaco.editor) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Configure C# language
        const languages = monaco.languages.getLanguages();
        const csharpLang = languages.find(l => l.id === 'csharp');

        if (!csharpLang) {
          monaco.languages.register({
            id: 'csharp',
            extensions: ['.cs', '.csx'],
            aliases: ['C#', 'csharp', 'cs'],
            mimetypes: ['text/x-csharp', 'text/csharp']
          });
        }

        // Set up C# syntax highlighting
        monaco.languages.setMonarchTokensProvider('csharp', {
          defaultToken: '',
          tokenPostfix: '.csx',
          keywords: [
            'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char',
            'checked', 'class', 'const', 'continue', 'decimal', 'default', 'delegate',
            'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false',
            'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if', 'implicit',
            'in', 'int', 'interface', 'internal', 'is', 'lock', 'long', 'namespace',
            'new', 'null', 'object', 'operator', 'out', 'override', 'params', 'private',
            'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed',
            'short', 'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch',
            'this', 'throw', 'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked',
            'unsafe', 'ushort', 'using', 'virtual', 'void', 'volatile', 'while',
            'var', 'dynamic', 'async', 'await'
          ],
          operators: [
            '=', '>', '<', '!', '~', '?', ':',
            '==', '<=', '>=', '!=', '&&', '||', '++', '--',
            '+', '-', '*', '/', '&', '|', '^', '%', '<<',
            '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=',
            '^=', '%=', '<<=', '>>=', '>>>='
          ],
          symbols: /[=><!~?:&|+\-*/^%]+/,
          escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
          tokenizer: {
            root: [
              [/[a-zA-Z_]\w*/, {
                cases: {
                  '@keywords': 'keyword',
                  '@default': 'identifier'
                }
              }],
              { include: '@whitespace' },
              [/\d*\.\d+([eE][-+]?\d+)?[fFdD]?/, 'number.float'],
              [/0[xX][0-9a-fA-F]+[Ll]?/, 'number.hex'],
              [/\d+[Ll]?/, 'number'],
              [/[{}()[\]]/, '@brackets'],
              [/[<>](?!@symbols)/, '@brackets'],
              [/@symbols/, {
                cases: {
                  '@operators': 'operator',
                  '@default': ''
                }
              }],
              [/"([^"\\]|\\.)*$/, 'string.invalid'],
              [/"/, 'string', '@string'],
              [/'[^\\']'/, 'string'],
              [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
              [/'/, 'string.invalid'],
              [/@"/, 'string', '@verbatimstring'],
              [/[;,.]/, 'delimiter']
            ],
            whitespace: [
              [/[ \t\r\n]+/, 'white'],
              [/\/\*/, 'comment', '@comment'],
              [/\/\/.*$/, 'comment']
            ],
            comment: [
              [/[^/*]+/, 'comment'],
              [/\/\*/, 'comment', '@push'],
              [/\*\//, 'comment', '@pop'],
              [/[/*]/, 'comment']
            ],
            string: [
              [/[^\\"]+/, 'string'],
              [/@escapes/, 'string.escape'],
              [/\\./, 'string.escape.invalid'],
              [/"/, 'string', '@pop']
            ],
            verbatimstring: [
              [/[^"]+/, 'string'],
              [/""/, 'string.escape'],
              [/"/, 'string', '@pop']
            ]
          }
        });

        // Set up language configuration
        monaco.languages.setLanguageConfiguration('csharp', {
          comments: {
            lineComment: '//',
            blockComment: ['/*', '*/']
          },
          brackets: [
            ['{', '}'],
            ['[', ']'],
            ['(', ')']
          ],
          autoClosingPairs: [
            { open: '{', close: '}' },
            { open: '[', close: ']' },
            { open: '(', close: ')' },
            { open: '"', close: '"' },
            { open: "'", close: "'" }
          ],
          surroundingPairs: [
            { open: '{', close: '}' },
            { open: '[', close: ']' },
            { open: '(', close: ')' },
            { open: '"', close: '"' },
            { open: "'", close: "'" }
          ],
          wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=+[\]{}\\|;:'",.<>/?\\s]+)/g,
          indentationRules: {
            increaseIndentPattern: /^.*\{[^}"']*$/,
            decreaseIndentPattern: /^(.*\*\/)?\s*\}.*$/
          }
        });

        // Create editor model
        const fileName = mapping.location ? mapping.location.split('/').pop()?.replace('.csx', '') || 'Mapping' : 'Mapping';
        const modelUri = monaco.Uri.parse(`file:///mapping/${fileName}.csx`);

        let model = monaco.editor.getModel(modelUri);
        if (!model) {
          model = monaco.editor.createModel(editorContent, 'csharp', modelUri);
        } else {
          model.setValue(editorContent);
        }

        // Create editor instance
        const editor = monaco.editor.create(editorContainerRef.current, {
          model: model,
          theme: 'vs-dark',
          readOnly: readOnly,
          automaticLayout: true,
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          renderWhitespace: 'boundary',
          bracketPairColorization: { enabled: true },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false
          },
          quickSuggestionsDelay: 100,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnCommitCharacter: true,
          acceptSuggestionOnEnter: 'on',
          wordBasedSuggestions: 'currentDocument',
          parameterHints: {
            enabled: true,
            cycle: true
          },
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          formatOnType: true,
          formatOnPaste: true,
          suggest: {
            insertMode: 'replace',
            snippetsPreventQuickSuggestions: false,
            localityBonus: true,
            shareSuggestSelections: true,
            showIcons: true,
            filterGraceful: true
          },
          hover: {
            enabled: true,
            delay: 300,
            sticky: true
          },
          foldingStrategy: 'indentation',
          showFoldingControls: 'mouseover',
          selectionHighlight: true,
          tabCompletion: 'on'
        });

        editorRef.current = editor;

        // Set up enhanced completion provider with schema-based suggestions
        const completionProvider = monaco.languages.registerCompletionItemProvider('csharp', {
          triggerCharacters: ['.', '(', ' ', '\t'],
          provideCompletionItems: (model, position) => {
            const word = model.getWordUntilPosition(position);
            const range = new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn
            );

            const suggestions: monaco.languages.CompletionItem[] = [];

            // Enhanced schema-based suggestions
            const schemaBasedSuggestions = getSchemaBasedSuggestions(
              { workflow, currentState, currentTask, availableTasks },
              word.word,
              position
            );

            suggestions.push(...schemaBasedSuggestions.map(s => ({
              label: s.label,
              kind: convertIntelliSenseKind(s.kind),
              insertText: s.insertText,
              documentation: s.documentation,
              detail: s.detail,
              sortText: s.sortText,
              range
            })));

            return { suggestions };
          }
        });

        // Set up event handlers
        const contentChangeDisposable = editor.onDidChangeModelContent(() => {
          const content = editor.getValue();
          handleEditorChange(content);
        });

        // Add keyboard shortcuts
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          handleSave();
        });

        // Clean up on dispose
        editor.onDidDispose(() => {
          contentChangeDisposable.dispose();
          completionProvider.dispose();
        });

        setIsEditorReady(true);
        onMessage('✅ Monaco Editor initialized successfully');
        editor.focus();

      } catch (error: any) {
        onError(`Failed to initialize Monaco Editor: ${error.message || error}`);
        console.error('❌ Monaco Editor initialization failed:', error);
      }
    };

    const timer = setTimeout(initializeEditor, 100);

    return () => {
      clearTimeout(timer);
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // Update editor content when editorContent changes
  useEffect(() => {
    if (editorRef.current && isEditorReady) {
      const currentValue = editorRef.current.getValue();
      if (currentValue !== editorContent) {
        isProgrammaticChange.current = true;
        editorRef.current.setValue(editorContent);
        setTimeout(() => {
          isProgrammaticChange.current = false;
        }, 0);
      }
    }
  }, [editorContent, isEditorReady]);

  // Handle content changes
  const handleEditorChange = useCallback((value: string) => {
    // Skip if this is a programmatic change
    if (isProgrammaticChange.current) {
      return;
    }

    setEditorContent(value);
    setHasUnsavedChanges(true);

    // Use UTF-8 safe encoding instead of btoa
    const encodedContent = btoa(unescape(encodeURIComponent(value)));
    const updatedMapping = {
      ...mapping,
      code: encodedContent
    };
    onMappingChange(updatedMapping);
  }, [mapping, onMappingChange]);

  // Save functionality
  const handleSave = useCallback(() => {
    setHasUnsavedChanges(false);
    onMessage('💾 Mapping saved');
  }, [onMessage]);

  // Apply template
  const applyTemplate = (template: MappingTemplate) => {
    setEditorContent(template.code);
    setHasUnsavedChanges(true);
    setShowTemplates(false);
    onMessage(`Applied template: ${template.name}`);
  };

  // Helper functions for enhanced IntelliSense
  const getSchemaBasedSuggestions = (
    context: WorkflowContext,
    currentWord: string,
    _position: monaco.Position
  ): IntelliSenseItem[] => {
    const suggestions: IntelliSenseItem[] = [];

    // Add BBT Workflow IntelliSense suggestions
    const bbtSuggestions = getAllBBTWorkflowIntelliSense();
    suggestions.push(...bbtSuggestions);

    // Core mapping context variables
    suggestions.push(
      {
        label: 'input',
        kind: 'Variable',
        insertText: 'input',
        documentation: 'Input data from the previous workflow step or state',
        detail: 'Workflow Input Data',
        sortText: '001'
      },
      {
        label: 'context',
        kind: 'Variable',
        insertText: 'context',
        documentation: 'ScriptContext containing workflow execution data and task results',
        detail: 'BBT.Workflow.Scripting.ScriptContext',
        sortText: '002'
      }
    );

    // Context properties based on workflow schema
    if (context.workflow) {
      suggestions.push(
        {
          label: 'Context.WorkflowId',
          kind: 'Property',
          insertText: 'Context.WorkflowId',
          documentation: `Current workflow ID: ${context.workflow.key}`,
          detail: 'string',
          sortText: '003'
        },
        {
          label: 'Context.WorkflowVersion',
          kind: 'Property',
          insertText: 'Context.WorkflowVersion',
          documentation: `Workflow version: ${context.workflow.version}`,
          detail: 'string',
          sortText: '004'
        },
        {
          label: 'Context.Domain',
          kind: 'Property',
          insertText: 'Context.Domain',
          documentation: `Workflow domain: ${context.workflow.domain}`,
          detail: 'string',
          sortText: '005'
        }
      );
    }

    // Standard workflow context properties
    suggestions.push(
      {
        label: 'Context.UserId',
        kind: 'Property',
        insertText: 'Context.UserId',
        documentation: 'ID of the user who initiated the workflow instance',
        detail: 'string',
        sortText: '006'
      },
      {
        label: 'Context.CorrelationId',
        kind: 'Property',
        insertText: 'Context.CorrelationId',
        documentation: 'Correlation ID for tracking requests across services',
        detail: 'string',
        sortText: '007'
      },
      {
        label: 'Context.InstanceId',
        kind: 'Property',
        insertText: 'Context.InstanceId',
        documentation: 'Unique identifier for this workflow instance',
        detail: 'string',
        sortText: '008'
      }
    );

    // State-specific suggestions
    if (context.currentState) {
      suggestions.push(
        {
          label: 'State.Key',
          kind: 'Property',
          insertText: 'State.Key',
          documentation: `Current state key: ${context.currentState.key}`,
          detail: 'string',
          sortText: '009'
        },
        {
          label: 'State.Type',
          kind: 'Property',
          insertText: 'State.Type',
          documentation: `State type: ${context.currentState.stateType} (${['', 'Initial', 'Intermediate', 'Final', 'SubFlow'][context.currentState.stateType]})`,
          detail: 'int',
          sortText: '010'
        }
      );
    }

    // Task-specific suggestions
    if (context.currentTask) {
      const taskTypeInfo = TaskTypeInfo[context.currentTask.attributes.type];
      suggestions.push(
        {
          label: 'Task.Key',
          kind: 'Property',
          insertText: 'Task.Key',
          documentation: `Current task key: ${context.currentTask.key}`,
          detail: 'string',
          sortText: '011'
        },
        {
          label: 'Task.Type',
          kind: 'Property',
          insertText: 'Task.Type',
          documentation: `Task type: ${taskTypeInfo.label} (${taskTypeInfo.description})`,
          detail: 'string',
          sortText: '012'
        }
      );

      // Add task-specific config suggestions based on task type
      if (context.currentTask.attributes.type === '6') { // HTTP Task
        suggestions.push(
          {
            label: 'Task.StatusCode',
            kind: 'Property',
            insertText: 'Task.StatusCode',
            documentation: 'HTTP response status code from the task execution',
            detail: 'int',
            sortText: '013'
          },
          {
            label: 'Task.Headers',
            kind: 'Property',
            insertText: 'Task.Headers',
            documentation: 'HTTP response headers from the task execution',
            detail: 'Dictionary<string, string>',
            sortText: '014'
          }
        );
      }
    }

    // Common C# types and methods
    suggestions.push(
      {
        label: 'DateTime.UtcNow',
        kind: 'Property',
        insertText: 'DateTime.UtcNow',
        documentation: 'Gets the current UTC date and time',
        detail: 'DateTime',
        sortText: '020'
      },
      {
        label: 'DateTime.Now',
        kind: 'Property',
        insertText: 'DateTime.Now',
        documentation: 'Gets the current local date and time',
        detail: 'DateTime',
        sortText: '021'
      },
      {
        label: 'Guid.NewGuid()',
        kind: 'Method',
        insertText: 'Guid.NewGuid()',
        documentation: 'Creates a new GUID',
        detail: 'Guid',
        sortText: '022'
      },
      {
        label: 'string.IsNullOrEmpty',
        kind: 'Method',
        insertText: 'string.IsNullOrEmpty($1)',
        documentation: 'Indicates whether the specified string is null or empty',
        detail: 'bool',
        sortText: '023'
      },
      {
        label: 'string.IsNullOrWhiteSpace',
        kind: 'Method',
        insertText: 'string.IsNullOrWhiteSpace($1)',
        documentation: 'Indicates whether a specified string is null, empty, or consists only of white-space characters',
        detail: 'bool',
        sortText: '024'
      }
    );

    // Common return patterns
    suggestions.push(
      {
        label: 'return new',
        kind: 'Keyword',
        insertText: 'return new {\n\t$1\n};',
        documentation: 'Return a new anonymous object',
        detail: 'return statement',
        sortText: '030'
      },
      {
        label: 'return success result',
        kind: 'Keyword',
        insertText: 'return new {\n\tsuccess = true,\n\tdata = $1,\n\tprocessedAt = DateTime.UtcNow\n};',
        documentation: 'Return a success result object',
        detail: 'success pattern',
        sortText: '031'
      },
      {
        label: 'return error result',
        kind: 'Keyword',
        insertText: 'return new {\n\tsuccess = false,\n\terror = "$1",\n\tprocessedAt = DateTime.UtcNow\n};',
        documentation: 'Return an error result object',
        detail: 'error pattern',
        sortText: '032'
      }
    );

    // Filter suggestions based on current word
    if (currentWord) {
      return suggestions.filter(s =>
        s.label.toLowerCase().includes(currentWord.toLowerCase()) ||
        s.insertText.toLowerCase().includes(currentWord.toLowerCase())
      );
    }

    return suggestions;
  };

  const convertIntelliSenseKind = (kind: IntelliSenseItem['kind']): monaco.languages.CompletionItemKind => {
    switch (kind) {
      case 'Variable': return monaco.languages.CompletionItemKind.Variable;
      case 'Property': return monaco.languages.CompletionItemKind.Property;
      case 'Method': return monaco.languages.CompletionItemKind.Method;
      case 'Class': return monaco.languages.CompletionItemKind.Class;
      case 'Interface': return monaco.languages.CompletionItemKind.Interface;
      case 'Enum': return monaco.languages.CompletionItemKind.Enum;
      case 'Keyword': return monaco.languages.CompletionItemKind.Keyword;
      default: return monaco.languages.CompletionItemKind.Text;
    }
  };

  const actualHeight = isFullScreen ? '100vh' : height;

  return (
    <div
      className={`enhanced-mapping-editor ${isFullScreen ? 'fullscreen' : ''}`}
      style={{
        height: actualHeight,
        width: '100%',
        position: isFullScreen ? 'fixed' : 'relative',
        top: isFullScreen ? 0 : 'auto',
        left: isFullScreen ? 0 : 'auto',
        zIndex: isFullScreen ? 9999 : 'auto',
        backgroundColor: 'var(--vscode-editor-background)',
        color: 'var(--vscode-editor-foreground)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: 'var(--vscode-titleBar-activeBackground)',
        borderBottom: '1px solid var(--vscode-titleBar-border)',
        fontSize: '12px',
        gap: '12px'
      }}>
        <span>📝 C# Mapping Editor</span>

        <div style={{ flex: 1 }} />

        {availableMappers.length > 0 && (
          <button
            onClick={() => {
              setShowScriptSelector(!showScriptSelector);
              setShowTemplates(false);
            }}
            style={{
              backgroundColor: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-foreground)',
              border: '1px solid var(--vscode-button-border)',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            📄 Scripts
          </button>
        )}

        {showTemplateSelector && (
          <button
            onClick={() => {
              setShowTemplates(!showTemplates);
              setShowScriptSelector(false);
            }}
            style={{
              backgroundColor: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-foreground)',
              border: '1px solid var(--vscode-button-border)',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            📚 Templates
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={!hasUnsavedChanges || readOnly}
          style={{
            backgroundColor: hasUnsavedChanges && !readOnly
              ? 'var(--vscode-button-background)'
              : 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-foreground)',
            border: '1px solid var(--vscode-button-border)',
            padding: '4px 12px',
            fontSize: '12px',
            cursor: (!hasUnsavedChanges || readOnly) ? 'not-allowed' : 'pointer'
          }}
        >
          {hasUnsavedChanges ? '💾 Save' : '✅ Saved'}
        </button>

        {allowFullScreen && (
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            style={{
              backgroundColor: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-foreground)',
              border: '1px solid var(--vscode-button-border)',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {isFullScreen ? '🔽' : '🔼'}
          </button>
        )}
      </div>

      {/* Script Selector Panel */}
      {showScriptSelector && availableMappers.length > 0 && (
        <div style={{
          padding: '12px',
          backgroundColor: 'var(--vscode-sideBar-background)',
          borderBottom: '1px solid var(--vscode-sideBar-border)'
        }}>
          <ScriptSelector
            label="Available Mapper Scripts"
            value={mapping.location || null}
            availableScripts={availableMappers}
            scriptType="mapper"
            onChange={(location, script) => {
              if (location && script) {
                // Load the script content into the editor
                setEditorContent(script.content);
                setHasUnsavedChanges(true);
                // Use UTF-8 safe encoding
                const encodedContent = btoa(unescape(encodeURIComponent(script.content)));
                onMappingChange({
                  ...mapping,
                  location: script.location,
                  code: encodedContent
                });
                onMessage(`Loaded script: ${script.location}`);
                setShowScriptSelector(false);
              }
            }}
            helpText="Select a mapper script from available scripts in the workspace"
          />
        </div>
      )}

      {/* Templates Panel */}
      {showTemplates && (
        <div style={{
          padding: '12px',
          backgroundColor: 'var(--vscode-sideBar-background)',
          borderBottom: '1px solid var(--vscode-sideBar-border)',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Mapping Templates</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
            {MAPPING_TEMPLATES.map((template, index) => (
              <button
                key={index}
                onClick={() => applyTemplate(template)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--vscode-button-secondaryBackground)',
                  color: 'var(--vscode-button-foreground)',
                  border: '1px solid var(--vscode-button-border)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '12px'
                }}
                title={template.description}
              >
                <div style={{ fontWeight: 'bold' }}>{template.name}</div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>{template.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor Container */}
      <div
        ref={editorContainerRef}
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          backgroundColor: 'var(--vscode-editor-background)',
          color: 'var(--vscode-editor-foreground)'
        }}
      />
    </div>
  );
};
