import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import type { Rule } from '@amorphie-flow-studio/core';
import { getAllBBTWorkflowIntelliSense } from '../../types/bbt-workflow-intellisense';
import type { IntelliSenseItem } from '../../types/workflow-types';

// Object property definitions for IntelliSense
function getObjectProperties(objectName: string): IntelliSenseItem[] {
  const objectName_lower = objectName.toLowerCase();

  switch (objectName_lower) {
    case 'context':
      return [
        {
          label: 'Instance',
          kind: 'Property',
          insertText: 'Instance',
          documentation: 'Gets the workflow instance associated with this script execution',
          detail: 'BBT.Workflow.Instances.Instance: The current workflow instance',
          sortText: '001'
        },
        {
          label: 'Body',
          kind: 'Property',
          insertText: 'Body',
          documentation: 'Gets the request/response body data for the script',
          detail: 'dynamic: The request/response body',
          sortText: '002'
        },
        {
          label: 'Headers',
          kind: 'Property',
          insertText: 'Headers',
          documentation: 'Gets the HTTP headers associated with the request',
          detail: 'dynamic: HTTP headers',
          sortText: '003'
        },
        {
          label: 'RouteValues',
          kind: 'Property',
          insertText: 'RouteValues',
          documentation: 'Gets the route parameter values',
          detail: 'Dictionary<string, dynamic>: Route values',
          sortText: '004'
        },
        {
          label: 'Workflow',
          kind: 'Property',
          insertText: 'Workflow',
          documentation: 'Gets the workflow definition and metadata',
          detail: 'BBT.Workflow.Definitions.Workflow: Workflow definition',
          sortText: '005'
        },
        {
          label: 'Transition',
          kind: 'Property',
          insertText: 'Transition',
          documentation: 'Gets the current transition being executed',
          detail: 'BBT.Workflow.Definitions.Transition: Current transition',
          sortText: '006'
        },
        {
          label: 'TaskResponse',
          kind: 'Property',
          insertText: 'TaskResponse',
          documentation: 'Gets the results from previous task executions',
          detail: 'Dictionary<string, dynamic?>: Previous task results',
          sortText: '007'
        },
        {
          label: 'MetaData',
          kind: 'Property',
          insertText: 'MetaData',
          documentation: 'Gets the custom metadata for the execution context',
          detail: 'Dictionary<string, dynamic>: Custom metadata',
          sortText: '008'
        },
        {
          label: 'Runtime',
          kind: 'Property',
          insertText: 'Runtime',
          documentation: 'Gets the runtime information provider',
          detail: 'BBT.Workflow.Runtime.IRuntimeInfoProvider: Runtime info',
          sortText: '009'
        },
        {
          label: 'Definitions',
          kind: 'Property',
          insertText: 'Definitions',
          documentation: 'Gets the workflow definitions and references',
          detail: 'Dictionary<string, dynamic>: Workflow definitions',
          sortText: '010'
        }
      ];

    case 'instance':
      return [
        {
          label: 'Id',
          kind: 'Property',
          insertText: 'Id',
          documentation: 'Unique identifier for this workflow instance',
          detail: 'Guid: Workflow instance ID',
          sortText: '001'
        },
        {
          label: 'Key',
          kind: 'Property',
          insertText: 'Key',
          documentation: 'Human-readable key for the workflow instance',
          detail: 'string: Instance key',
          sortText: '002'
        },
        {
          label: 'Flow',
          kind: 'Property',
          insertText: 'Flow',
          documentation: 'Flow name that this instance belongs to',
          detail: 'string: Flow name',
          sortText: '003'
        },
        {
          label: 'CurrentState',
          kind: 'Property',
          insertText: 'CurrentState',
          documentation: 'Current state of the workflow instance',
          detail: 'string: Current state',
          sortText: '004'
        },
        {
          label: 'Status',
          kind: 'Property',
          insertText: 'Status',
          documentation: 'Status of the workflow instance (Active, Completed, etc.)',
          detail: 'InstanceStatus: Instance status',
          sortText: '005'
        },
        {
          label: 'Data',
          kind: 'Property',
          insertText: 'Data',
          documentation: 'Latest instance data containing workflow variables and state',
          detail: 'dynamic: Instance data',
          sortText: '006'
        },
        {
          label: 'CreatedAt',
          kind: 'Property',
          insertText: 'CreatedAt',
          documentation: 'When the workflow instance was created',
          detail: 'DateTime: Creation time',
          sortText: '007'
        },
        {
          label: 'ModifiedAt',
          kind: 'Property',
          insertText: 'ModifiedAt',
          documentation: 'When the workflow instance was last modified',
          detail: 'DateTime?: Last modified time',
          sortText: '008'
        }
      ];

    case 'body':
      return [
        {
          label: 'StatusCode',
          kind: 'Property',
          insertText: 'StatusCode',
          documentation: 'HTTP status code from task execution',
          detail: 'int?: HTTP status code (200, 400, 500, etc.)',
          sortText: '001'
        },
        {
          label: 'Data',
          kind: 'Property',
          insertText: 'Data',
          documentation: 'Response data from the executed task',
          detail: 'dynamic: Response data',
          sortText: '002'
        },
        {
          label: 'ErrorMessage',
          kind: 'Property',
          insertText: 'ErrorMessage',
          documentation: 'Error message if the task execution failed',
          detail: 'string: Error message',
          sortText: '003'
        },
        {
          label: 'IsSuccess',
          kind: 'Property',
          insertText: 'IsSuccess',
          documentation: 'Boolean indicating if the task execution was successful',
          detail: 'bool?: Success status',
          sortText: '004'
        },
        {
          label: 'TaskType',
          kind: 'Property',
          insertText: 'TaskType',
          documentation: 'Type of the executed task (HTTP, Dapr, etc.)',
          detail: 'string: Task type',
          sortText: '005'
        },
        {
          label: 'ExecutionDurationMs',
          kind: 'Property',
          insertText: 'ExecutionDurationMs',
          documentation: 'Execution duration in milliseconds',
          detail: 'long?: Duration in ms',
          sortText: '006'
        },
        {
          label: 'Headers',
          kind: 'Property',
          insertText: 'Headers',
          documentation: 'HTTP headers from the task response',
          detail: 'Dictionary<string, string>: Response headers',
          sortText: '007'
        },
        {
          label: 'Metadata',
          kind: 'Property',
          insertText: 'Metadata',
          documentation: 'Additional metadata from task execution',
          detail: 'Dictionary<string, object>: Task metadata',
          sortText: '008'
        }
      ];

    case 'task':
      return [
        {
          label: 'Key',
          kind: 'Property',
          insertText: 'Key',
          documentation: 'Unique key identifier for the workflow task',
          detail: 'string: Task key',
          sortText: '001'
        },
        {
          label: 'Version',
          kind: 'Property',
          insertText: 'Version',
          documentation: 'Version of the workflow task',
          detail: 'string: Task version',
          sortText: '002'
        },
        {
          label: 'Domain',
          kind: 'Property',
          insertText: 'Domain',
          documentation: 'Domain the task belongs to',
          detail: 'string: Task domain',
          sortText: '003'
        },
        {
          label: 'Type',
          kind: 'Property',
          insertText: 'Type',
          documentation: 'Type of the workflow task (1=DaprHttpEndpoint, 2=DaprBinding, 3=DaprService, 4=DaprPubSub, 5=Human, 6=Http, 7=Script)',
          detail: 'string: Task type',
          sortText: '004'
        },
        {
          label: 'Config',
          kind: 'Property',
          insertText: 'Config',
          documentation: 'Task configuration as JsonElement',
          detail: 'JsonElement: Task configuration',
          sortText: '005'
        }
      ];

    case 'response':
      return [
        {
          label: 'Data',
          kind: 'Property',
          insertText: 'Data',
          documentation: 'Gets or sets the response data as dynamic object',
          detail: 'dynamic: Response data',
          sortText: '001'
        },
        {
          label: 'Headers',
          kind: 'Property',
          insertText: 'Headers',
          documentation: 'Gets or sets the response headers as key-value pairs',
          detail: 'Dictionary<string, string>: Response headers',
          sortText: '002'
        }
      ];

    case 'headers':
      return [
        {
          label: 'Add',
          kind: 'Method',
          insertText: 'Add(${1:key}, ${2:value})',
          documentation: 'Adds a header with the specified key and value',
          detail: 'void Add(string key, string value)',
          sortText: '001'
        },
        {
          label: 'ContainsKey',
          kind: 'Method',
          insertText: 'ContainsKey(${1:key})',
          documentation: 'Determines whether the headers contain the specified key',
          detail: 'bool ContainsKey(string key)',
          sortText: '002'
        },
        {
          label: 'Count',
          kind: 'Property',
          insertText: 'Count',
          documentation: 'Gets the number of headers in the collection',
          detail: 'int: Number of headers',
          sortText: '003'
        }
      ];

    case 'data':
      return [
        {
          label: 'ToString',
          kind: 'Method',
          insertText: 'ToString()',
          documentation: 'Returns a string representation of the data',
          detail: 'string ToString()',
          sortText: '001'
        },
        {
          label: 'GetType',
          kind: 'Method',
          insertText: 'GetType()',
          documentation: 'Gets the type of the current instance',
          detail: 'Type GetType()',
          sortText: '002'
        }
      ];

    case 'configuration':
      return [
        {
          label: 'ToString',
          kind: 'Method',
          insertText: 'ToString()',
          documentation: 'Returns a string representation of the configuration',
          detail: 'string ToString()',
          sortText: '001'
        },
        {
          label: 'GetType',
          kind: 'Method',
          insertText: 'GetType()',
          documentation: 'Gets the type of the current instance',
          detail: 'Type GetType()',
          sortText: '002'
        }
      ];

    default:
      return [];
  }
}

interface RuleEditorProps {
  title: string;
  rule?: Rule;
  inlineText: string;
  onLoadFromFile?: () => void;
  onChange: (rule?: Rule) => void;
  onInlineChange: (text: string) => void;
  hideLocation?: boolean; // Hide the location field when used for mapping code
}

export const RuleEditor: React.FC<RuleEditorProps> = ({
  title,
  rule,
  inlineText,
  onLoadFromFile,
  onChange,
  onInlineChange,
  hideLocation = false
}) => {
  const hasRule = Boolean(rule);
  const [displayText, setDisplayText] = useState(inlineText);
  const [useMonaco, setUseMonaco] = useState(true); // Default to IntelliSense mode
  const [isFullscreen, setIsFullscreen] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // Set display text from inlineText (PropertyPanel now handles Base64 decoding)
  useEffect(() => {
    console.log('🔍 Processing inlineText:', inlineText?.substring(0, 50) + '...');

    if (inlineText) {
      setDisplayText(inlineText);
           } else {
             console.log('🆕 No content, setting default template');
             setDisplayText('// Enter your C# mapping code here\nusing System;\nusing System.Threading.Tasks;\nusing BBT.Workflow.Scripting;\nusing BBT.Workflow.Definitions;\n\npublic class MappingHandler : ScriptBase, IMapping\n{\n    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)\n    {\n        var response = new ScriptResponse();\n\n        // Access instance data\n        var instanceId = context.Instance.Id;\n        var instanceKey = context.Instance.Key;\n        var currentState = context.Instance.CurrentState;\n        var instanceData = context.Instance.Data;\n\n        // Prepare request data\n        response.Data = new\n        {\n            instanceId = instanceId,\n            instanceKey = instanceKey,\n            currentState = currentState,\n            data = instanceData,\n            requestTime = DateTime.UtcNow\n        };\n\n        // Set headers\n        response.Headers = new Dictionary<string, string>\n        {\n            ["X-Instance-Id"] = instanceId.ToString(),\n            ["X-Flow"] = context.Instance.Flow\n        };\n\n        return Task.FromResult(response);\n    }\n\n    public Task<ScriptResponse> OutputHandler(ScriptContext context)\n    {\n        var response = new ScriptResponse();\n\n        // Transform response data\n        response.Data = new\n        {\n            success = context.Body?.IsSuccess ?? true,\n            message = context.Body?.ErrorMessage ?? "Success",\n            result = context.Body?.Data,\n            timestamp = DateTime.UtcNow\n        };\n\n        return Task.FromResult(response);\n    }\n}');
           }
  }, [inlineText]);

  const handleCodeChange = (value: string) => {
    // Store the raw C# code - don't encode to Base64 on every change
    // Base64 encoding will happen when the form is saved
    setDisplayText(value);
    onInlineChange(value);
  };

  // Initialize Monaco Editor
  const initializeMonaco = useCallback(async () => {
    if (!editorContainerRef.current || editorRef.current) return;

    try {
      // Register C# language for syntax highlighting (only if not already registered)
      const existingLanguages = monaco.languages.getLanguages();
      const csharpExists = existingLanguages.some(lang => lang.id === 'csharp');

      if (!csharpExists) {
        monaco.languages.register({ id: 'csharp' });
        console.log('🔧 Registered C# language');
      }

      // Set up C# language configuration
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
        ]
      });

      // Create editor instance
      const editor = monaco.editor.create(editorContainerRef.current, {
        value: displayText || '',
        language: 'csharp',
        theme: 'vs-dark',
        fontSize: 14,
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: 'on',
        selectOnLineNumbers: true,
        cursorBlinking: 'blink',
        cursorSmoothCaretAnimation: 'on',
        formatOnPaste: true,
        formatOnType: true
      });

      editorRef.current = editor;

      // Set up IntelliSense - ensure it's registered properly
      const bbtSuggestions = getAllBBTWorkflowIntelliSense();
      console.log('🧠 Setting up IntelliSense with', bbtSuggestions.length, 'suggestions');

      const completionProvider = monaco.languages.registerCompletionItemProvider('csharp', {
        triggerCharacters: ['.', ' ', '('],
        provideCompletionItems: (model, position) => {
          console.log('🧠 IntelliSense triggered at position:', position);

          // Get the text before the cursor
          const lineContent = model.getLineContent(position.lineNumber);
          const textBeforeCursor = lineContent.substring(0, position.column - 1);
          const wordStart = Math.max(
            textBeforeCursor.lastIndexOf(' ') + 1,
            textBeforeCursor.lastIndexOf('.') + 1,
            textBeforeCursor.lastIndexOf('(') + 1,
            0
          );
          const currentWord = textBeforeCursor.substring(wordStart);

          console.log('🔍 Text before cursor:', textBeforeCursor);
          console.log('🔍 Current word:', currentWord);

          let suggestions = [...bbtSuggestions];

          // Check if we're typing after a dot (object property access)
          if (textBeforeCursor.endsWith('.')) {
            // Get the full property chain before the dot
            const beforeDot = textBeforeCursor.substring(0, textBeforeCursor.length - 1);

            // Extract the property chain by finding the last complete expression
            // Look for patterns like: context.Instance, response.Data, etc.
            const propertyChainMatch = beforeDot.match(/([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)$/);
            const propertyChain = propertyChainMatch ? propertyChainMatch[1] : '';

            console.log('🔍 Full property chain:', propertyChain);

            // Determine the object type based on the property chain
            let objectType = '';
            if (propertyChain.includes('.')) {
              // Handle chained properties like context.Instance
              const parts = propertyChain.split('.');

              console.log('🔍 Property chain parts:', parts);

              // Check if this is a valid object chain or if we've reached a terminal property
              if (parts.length === 2) {
                const baseObject = parts[0].toLowerCase();
                const property = parts[1].toLowerCase();

                console.log('🔍 Base object:', baseObject, 'Property:', property);

                // Map known property chains to their types (only if the property is an object)
                if (baseObject === 'context' && property === 'instance') {
                  objectType = 'instance';
                } else if (baseObject === 'context' && property === 'body') {
                  objectType = 'body';
                } else if (baseObject === 'context' && property === 'headers') {
                  objectType = 'headers';
                } else if (property === 'data') {
                  objectType = 'data';
                } else if (property === 'configuration') {
                  objectType = 'configuration';
                }
              } else if (parts.length >= 3) {
                // For deeper chains like context.Instance.Id, check if the last property is a terminal value
                const baseObject = parts[0].toLowerCase();
                const firstProperty = parts[1].toLowerCase();
                const lastProperty = parts[parts.length - 1].toLowerCase();

                console.log('🔍 Deep chain - Base:', baseObject, 'First property:', firstProperty, 'Last property:', lastProperty);

                // Define terminal properties (properties that don't have sub-properties)
                const terminalProperties = ['id', 'userid', 'correlationid', 'state', 'statuscode', 'errormessage', 'name', 'count'];

                if (terminalProperties.includes(lastProperty)) {
                  console.log('🔍 Terminal property detected:', lastProperty, '- no suggestions');
                  objectType = ''; // No suggestions for terminal properties
                } else {
                  // Only provide suggestions for object properties, not terminal string/number properties
                  if (lastProperty === 'data' || lastProperty === 'configuration' || lastProperty === 'headers') {
                    objectType = lastProperty;
                  }
                }
              }
            } else {
              // Single object like context, task, response
              objectType = propertyChain.toLowerCase();
            }

            console.log('🔍 Resolved object type:', objectType);

            // When we're after a dot, ONLY show object properties for the specific object type
            // This prevents showing suggestions for other objects
            if (objectType) {
              const objectProperties = getObjectProperties(objectType);
              console.log('🔍 Object properties from getObjectProperties:', objectProperties.length, 'items:', objectProperties.map(p => p.label));

              // Only show properties for this specific object type
              suggestions = objectProperties;
            } else {
              // No valid object type, show no suggestions
              suggestions = [];
            }

            console.log('🔍 Final suggestions for', objectType, ':', suggestions.length, 'items:', suggestions.map(s => s.label));
          }

          // Filter suggestions based on current word
          if (currentWord && !textBeforeCursor.endsWith('.')) {
            suggestions = suggestions.filter(item =>
              item.label.toLowerCase().startsWith(currentWord.toLowerCase())
            );
          }

          // Remove duplicates from final suggestions
          const uniqueSuggestions = suggestions.filter((item, index, self) =>
            index === self.findIndex(s => s.label === item.label)
          );

          const monacoSuggestions = uniqueSuggestions.map(item => ({
            label: item.label,
            kind: monaco.languages.CompletionItemKind[item.kind as keyof typeof monaco.languages.CompletionItemKind] || monaco.languages.CompletionItemKind.Text,
            insertText: item.insertText,
            documentation: item.documentation,
            detail: item.detail,
            sortText: item.sortText,
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: position.column - currentWord.length,
              endColumn: position.column
            }
          }));

          console.log('🧠 Returning', monacoSuggestions.length, 'suggestions');
          console.log('🔍 Suggestions:', monacoSuggestions.map(s => s.label));
          return { suggestions: monacoSuggestions };
        }
      });

      // Set up hover provider for documentation
      const hoverProvider = monaco.languages.registerHoverProvider('csharp', {
        provideHover: (model, position) => {
          const wordAtPosition = model.getWordAtPosition(position);
          if (!wordAtPosition) return null;

          const word = wordAtPosition.word.toLowerCase();
          const allSuggestions = getAllBBTWorkflowIntelliSense();
          const suggestion = allSuggestions.find(s => s.label.toLowerCase() === word);

          if (suggestion) {
            return {
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: wordAtPosition.startColumn,
                endColumn: wordAtPosition.endColumn
              },
              contents: [
                { value: `**${suggestion.label}**` },
                { value: suggestion.documentation || suggestion.detail || 'No documentation available' }
              ]
            };
          }

          return null;
        }
      });

      // Handle content changes
      editor.onDidChangeModelContent(() => {
        const value = editor.getValue();
        setDisplayText(value);
        handleCodeChange(value);
      });

      // Cleanup on unmount
      return () => {
        completionProvider.dispose();
        hoverProvider.dispose();
        editor.dispose();
      };
    } catch (error) {
      console.error('Failed to initialize Monaco Editor:', error);
    }
  }, [displayText, handleCodeChange]);

  // Toggle between Monaco and textarea
  const toggleEditor = useCallback(() => {
    if (useMonaco && editorRef.current) {
      editorRef.current.dispose();
      editorRef.current = null;
    }
    setUseMonaco(!useMonaco);
  }, [useMonaco]);

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    // Save cursor position before toggle
    let cursorPosition = { lineNumber: 1, column: 1 };
    if (editorRef.current) {
      cursorPosition = editorRef.current.getPosition() || cursorPosition;
    }

    setIsFullscreen(!isFullscreen);

    // Restore layout and cursor position after toggle
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout();
        editorRef.current.setPosition(cursorPosition);
        editorRef.current.focus();
      }
    }, 150);
  }, [isFullscreen]);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFullscreen]);

  // Initialize Monaco when switching to Monaco mode
  useEffect(() => {
    if (useMonaco) {
      // Add small delay to ensure container is ready
      setTimeout(() => {
        initializeMonaco();
      }, 100);
    }
  }, [useMonaco, initializeMonaco]);

  // Update Monaco content when displayText changes
  useEffect(() => {
    if (useMonaco && editorRef.current) {
      const currentValue = editorRef.current.getValue();
      if (currentValue !== displayText) {
        editorRef.current.setValue(displayText);
        // Set cursor to beginning instead of end
        editorRef.current.setPosition({ lineNumber: 1, column: 1 });
      }
    }
  }, [displayText, useMonaco]);

  return (
    <div className="property-panel__group">
      <div className="property-panel__group-header">
        <span>{title}</span>
        {!hasRule && (
          <button
            type="button"
            onClick={() => onChange({ location: './src/rules/new.csx', code: '' })}
            className="property-panel__add-button"
          >
            +
          </button>
        )}
      </div>

      {hasRule && rule && (
        <div className="property-panel__rule-editor">
          {!hideLocation && (
            <div className="property-panel__field">
              <label>Location:</label>
              <div className="property-panel__input-group">
                <input
                  type="text"
                  value={rule.location}
                  onChange={(e) => onChange({ ...rule, location: e.target.value })}
                  placeholder="./src/rules/example.csx"
                  className="property-panel__input"
                />
                {onLoadFromFile && (
                  <button
                    type="button"
                    onClick={onLoadFromFile}
                    className="property-panel__action-button"
                    title="Load from file"
                  >
                    📁
                  </button>
                )}
              </div>
            </div>
          )}

          <div className={`property-panel__field ${isFullscreen ? 'property-panel__field--fullscreen' : ''}`}>
            <div className="property-panel__field-header">
              <label>Code (Base64 or inline):</label>
              <div className="property-panel__editor-controls">
                <button
                  type="button"
                  onClick={toggleEditor}
                  className="property-panel__toggle-button"
                  title={useMonaco ? "Switch to simple editor" : "Switch to IntelliSense editor"}
                >
                  {useMonaco ? "📝 Simple" : "🧠 IntelliSense"}
                </button>
                {useMonaco && (
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="property-panel__fullscreen-button"
                    title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
                  >
                    {isFullscreen ? "🗗 Exit" : "🗖 Fullscreen"}
                  </button>
                )}
              </div>
            </div>

            {useMonaco ? (
              <div
                ref={editorContainerRef}
                className={`property-panel__monaco-container ${isFullscreen ? 'property-panel__monaco-container--fullscreen' : ''}`}
                style={{
                  height: isFullscreen ? 'auto' : '400px',
                  border: '1px solid var(--vscode-panel-border)',
                  borderRadius: '4px'
                }}
              />
            ) : (
              <textarea
                value={displayText}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="Enter C# script code (auto-encodes to Base64)"
                className="property-panel__textarea"
                rows={isFullscreen ? 40 : 12}
                style={{
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  height: isFullscreen ? '100vh' : 'auto'
                }}
              />
            )}

            <div className="property-panel__hint">
              ✨ C# code is automatically detected and encoded as Base64
              {useMonaco && " | 🧠 IntelliSense active with BBT Workflow suggestions"}
              {isFullscreen && " | Press Esc to exit fullscreen"}
            </div>

            {isFullscreen && (
              <div className="property-panel__fullscreen-overlay" onClick={() => setIsFullscreen(false)} />
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              onInlineChange('');
            }}
            className="property-panel__remove-button"
          >
            Remove rule
          </button>
        </div>
      )}

      {!hasRule && (
        <p className="property-panel__muted">No rule configured.</p>
      )}
    </div>
  );
};
