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
          detail: 'WorkflowInstance: The current workflow instance',
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
          detail: 'Dictionary<string, string>: HTTP headers',
          sortText: '003'
        }
      ];

    case 'instance':
      return [
        {
          label: 'Id',
          kind: 'Property',
          insertText: 'Id',
          documentation: 'Gets the unique identifier for this workflow instance',
          detail: 'string: Workflow instance ID',
          sortText: '001'
        },
        {
          label: 'UserId',
          kind: 'Property',
          insertText: 'UserId',
          documentation: 'Gets the user ID associated with this workflow instance',
          detail: 'string: User ID',
          sortText: '002'
        },
        {
          label: 'CorrelationId',
          kind: 'Property',
          insertText: 'CorrelationId',
          documentation: 'Gets the correlation ID for tracking this workflow instance',
          detail: 'string: Correlation ID',
          sortText: '003'
        },
        {
          label: 'State',
          kind: 'Property',
          insertText: 'State',
          documentation: 'Gets the current state of the workflow instance',
          detail: 'string: Current state',
          sortText: '004'
        },
        {
          label: 'Data',
          kind: 'Property',
          insertText: 'Data',
          documentation: 'Gets the workflow instance data as dynamic object',
          detail: 'dynamic: Instance data',
          sortText: '005'
        }
      ];

    case 'body':
      return [
        {
          label: 'StatusCode',
          kind: 'Property',
          insertText: 'StatusCode',
          documentation: 'Gets the HTTP status code of the response',
          detail: 'int?: HTTP status code (200, 400, 500, etc.)',
          sortText: '001'
        },
        {
          label: 'Data',
          kind: 'Property',
          insertText: 'Data',
          documentation: 'Gets the response data as dynamic object',
          detail: 'dynamic: Response data',
          sortText: '002'
        },
        {
          label: 'ErrorMessage',
          kind: 'Property',
          insertText: 'ErrorMessage',
          documentation: 'Gets the error message if the request failed',
          detail: 'string: Error message',
          sortText: '003'
        }
      ];

    case 'task':
      return [
        {
          label: 'Id',
          kind: 'Property',
          insertText: 'Id',
          documentation: 'Gets the unique identifier for the workflow task',
          detail: 'string: Task ID',
          sortText: '001'
        },
        {
          label: 'Name',
          kind: 'Property',
          insertText: 'Name',
          documentation: 'Gets the name of the workflow task',
          detail: 'string: Task name',
          sortText: '002'
        },
        {
          label: 'Configuration',
          kind: 'Property',
          insertText: 'Configuration',
          documentation: 'Gets the task configuration as dynamic object',
          detail: 'dynamic: Task configuration',
          sortText: '003'
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
      setDisplayText('// Enter your C# rule code here\nusing System;\nusing BBT.Workflow.Domain;\n\npublic class YourRule : IConditionMapping\n{\n    public async Task<bool> Handler(ScriptContext context)\n    {\n        // TODO: Implement your rule logic\n        return true;\n    }\n}');
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
            suggestions = getObjectProperties(objectType);
          }

          // Filter suggestions based on current word
          if (currentWord && !textBeforeCursor.endsWith('.')) {
            suggestions = suggestions.filter(item =>
              item.label.toLowerCase().startsWith(currentWord.toLowerCase())
            );
          }

          const monacoSuggestions = suggestions.map(item => ({
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
