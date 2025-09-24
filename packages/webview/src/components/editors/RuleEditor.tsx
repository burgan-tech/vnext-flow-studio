import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import type { Rule } from '@amorphie-flow-studio/core';
import { getAllBBTWorkflowIntelliSense } from '../../types/bbt-workflow-intellisense';
import type { IntelliSenseItem } from '../../types/workflow-types';
import { getTemplateForTaskType } from '../../utils/taskTemplates';


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
  taskType?: string; // Task type for applying appropriate templates
}

export const RuleEditor: React.FC<RuleEditorProps> = ({
  title,
  rule,
  inlineText,
  onLoadFromFile,
  onChange,
  onInlineChange,
  hideLocation = false,
  taskType
}) => {
  const hasRule = Boolean(rule);
  const [displayText, setDisplayText] = useState(inlineText);
  const [useMonaco, setUseMonaco] = useState(true); // Default to IntelliSense mode
  const [isFullscreen, setIsFullscreen] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // Set display text from inlineText (PropertyPanel now handles Base64 decoding)
  useEffect(() => {

    if (inlineText) {
      setDisplayText(inlineText);
           } else {
             const template = getTemplateForTaskType(taskType);
             setDisplayText(template);
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

      const completionProvider = monaco.languages.registerCompletionItemProvider('csharp', {
        triggerCharacters: ['.', ' ', '('],
        provideCompletionItems: (model, position) => {
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

          // Start with BBT Workflow suggestions
          let suggestions = [...bbtSuggestions];

          // Add default C# IntelliSense suggestions
          const defaultCSharpSuggestions: IntelliSenseItem[] = [
            // C# Keywords
            { label: 'var', kind: 'Keyword', insertText: 'var', documentation: 'Implicitly typed local variable', detail: 'keyword', sortText: '001' },
            { label: 'if', kind: 'Keyword', insertText: 'if (${1:condition})\n{\n\t$2\n}', documentation: 'If statement', detail: 'keyword', sortText: '002' },
            { label: 'else', kind: 'Keyword', insertText: 'else\n{\n\t$1\n}', documentation: 'Else statement', detail: 'keyword', sortText: '003' },
            { label: 'for', kind: 'Keyword', insertText: 'for (int i = 0; i < ${1:count}; i++)\n{\n\t$2\n}', documentation: 'For loop', detail: 'keyword', sortText: '004' },
            { label: 'foreach', kind: 'Keyword', insertText: 'foreach (var ${1:item} in ${2:collection})\n{\n\t$3\n}', documentation: 'Foreach loop', detail: 'keyword', sortText: '005' },
            { label: 'while', kind: 'Keyword', insertText: 'while (${1:condition})\n{\n\t$2\n}', documentation: 'While loop', detail: 'keyword', sortText: '006' },
            { label: 'switch', kind: 'Keyword', insertText: 'switch (${1:value})\n{\n\tcase ${2:case}:\n\t\t$3\n\t\tbreak;\n\tdefault:\n\t\t$4\n\t\tbreak;\n}', documentation: 'Switch statement', detail: 'keyword', sortText: '007' },
            { label: 'try', kind: 'Keyword', insertText: 'try\n{\n\t$1\n}\ncatch (Exception ex)\n{\n\t$2\n}', documentation: 'Try-catch block', detail: 'keyword', sortText: '008' },
            { label: 'return', kind: 'Keyword', insertText: 'return $1;', documentation: 'Return statement', detail: 'keyword', sortText: '009' },
            { label: 'throw', kind: 'Keyword', insertText: 'throw new Exception("${1:message}");', documentation: 'Throw exception', detail: 'keyword', sortText: '010' },

            // Common Types
            { label: 'string', kind: 'Class', insertText: 'string', documentation: 'String type', detail: 'type', sortText: '020' },
            { label: 'int', kind: 'Class', insertText: 'int', documentation: 'Integer type', detail: 'type', sortText: '021' },
            { label: 'bool', kind: 'Class', insertText: 'bool', documentation: 'Boolean type', detail: 'type', sortText: '022' },
            { label: 'DateTime', kind: 'Class', insertText: 'DateTime', documentation: 'DateTime type', detail: 'type', sortText: '023' },
            { label: 'Guid', kind: 'Class', insertText: 'Guid', documentation: 'GUID type', detail: 'type', sortText: '024' },
            { label: 'object', kind: 'Class', insertText: 'object', documentation: 'Object type', detail: 'type', sortText: '025' },
            { label: 'dynamic', kind: 'Class', insertText: 'dynamic', documentation: 'Dynamic type', detail: 'type', sortText: '026' },
            { label: 'List', kind: 'Class', insertText: 'List<${1:T}>', documentation: 'Generic List', detail: 'type', sortText: '027' },
            { label: 'Dictionary', kind: 'Class', insertText: 'Dictionary<${1:TKey}, ${2:TValue}>', documentation: 'Generic Dictionary', detail: 'type', sortText: '028' },
            { label: 'Task', kind: 'Class', insertText: 'Task', documentation: 'Task type', detail: 'type', sortText: '029' },
            { label: 'Task<T>', kind: 'Class', insertText: 'Task<${1:T}>', documentation: 'Generic Task', detail: 'type', sortText: '030' },

            // Common Methods
            { label: 'Console.WriteLine', kind: 'Method', insertText: 'Console.WriteLine("${1:message}");', documentation: 'Write line to console', detail: 'method', sortText: '040' },
            { label: 'Console.WriteLine', kind: 'Method', insertText: 'Console.WriteLine(${1:value});', documentation: 'Write line to console', detail: 'method', sortText: '041' },
            { label: 'string.IsNullOrEmpty', kind: 'Method', insertText: 'string.IsNullOrEmpty(${1:value})', documentation: 'Check if string is null or empty', detail: 'method', sortText: '042' },
            { label: 'string.IsNullOrWhiteSpace', kind: 'Method', insertText: 'string.IsNullOrWhiteSpace(${1:value})', documentation: 'Check if string is null or whitespace', detail: 'method', sortText: '043' },
            { label: 'DateTime.UtcNow', kind: 'Property', insertText: 'DateTime.UtcNow', documentation: 'Current UTC time', detail: 'property', sortText: '044' },
            { label: 'DateTime.Now', kind: 'Property', insertText: 'DateTime.Now', documentation: 'Current local time', detail: 'property', sortText: '045' },
            { label: 'Guid.NewGuid', kind: 'Method', insertText: 'Guid.NewGuid()', documentation: 'Generate new GUID', detail: 'method', sortText: '046' },
            { label: 'Math.Round', kind: 'Method', insertText: 'Math.Round(${1:value}, ${2:decimals})', documentation: 'Round number to specified decimals', detail: 'method', sortText: '047' },
            { label: 'Math.Max', kind: 'Method', insertText: 'Math.Max(${1:val1}, ${2:val2})', documentation: 'Get maximum of two values', detail: 'method', sortText: '048' },
            { label: 'Math.Min', kind: 'Method', insertText: 'Math.Min(${1:val1}, ${2:val2})', documentation: 'Get minimum of two values', detail: 'method', sortText: '049' },

            // LINQ Methods
            { label: 'Where', kind: 'Method', insertText: 'Where(${1:x} => ${2:condition})', documentation: 'Filter collection', detail: 'method', sortText: '060' },
            { label: 'Select', kind: 'Method', insertText: 'Select(${1:x} => ${2:expression})', documentation: 'Transform collection', detail: 'method', sortText: '061' },
            { label: 'FirstOrDefault', kind: 'Method', insertText: 'FirstOrDefault(${1:x} => ${2:condition})', documentation: 'Get first element or default', detail: 'method', sortText: '062' },
            { label: 'Any', kind: 'Method', insertText: 'Any(${1:x} => ${2:condition})', documentation: 'Check if any element matches condition', detail: 'method', sortText: '063' },
            { label: 'Count', kind: 'Method', insertText: 'Count(${1:x} => ${2:condition})', documentation: 'Count elements matching condition', detail: 'method', sortText: '064' },
            { label: 'OrderBy', kind: 'Method', insertText: 'OrderBy(${1:x} => ${2:key})', documentation: 'Sort collection ascending', detail: 'method', sortText: '065' },
            { label: 'OrderByDescending', kind: 'Method', insertText: 'OrderByDescending(${1:x} => ${2:key})', documentation: 'Sort collection descending', detail: 'method', sortText: '066' },
            { label: 'Take', kind: 'Method', insertText: 'Take(${1:count})', documentation: 'Take first N elements', detail: 'method', sortText: '067' },
            { label: 'Skip', kind: 'Method', insertText: 'Skip(${1:count})', documentation: 'Skip first N elements', detail: 'method', sortText: '068' },
            { label: 'ToList', kind: 'Method', insertText: 'ToList()', documentation: 'Convert to List', detail: 'method', sortText: '069' },
            { label: 'ToArray', kind: 'Method', insertText: 'ToArray()', documentation: 'Convert to Array', detail: 'method', sortText: '070' }
          ];

          // Add default C# suggestions to the list
          suggestions = [...suggestions, ...defaultCSharpSuggestions];

          // Check if we're typing after a dot (object property access)
          if (textBeforeCursor.endsWith('.')) {
            // Get the full property chain before the dot
            const beforeDot = textBeforeCursor.substring(0, textBeforeCursor.length - 1);

            // Extract the property chain by finding the last complete expression
            // Look for patterns like: context.Instance, response.Data, etc.
            const propertyChainMatch = beforeDot.match(/([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)$/);
            const propertyChain = propertyChainMatch ? propertyChainMatch[1] : '';

            // Determine the object type based on the property chain
            let objectType = '';
            if (propertyChain.includes('.')) {
              // Handle chained properties like context.Instance
              const parts = propertyChain.split('.');

              // Check if this is a valid object chain or if we've reached a terminal property
              if (parts.length === 2) {
                const baseObject = parts[0].toLowerCase();
                const property = parts[1].toLowerCase();


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


                // Define terminal properties (properties that don't have sub-properties)
                const terminalProperties = ['id', 'userid', 'correlationid', 'state', 'statuscode', 'errormessage', 'name', 'count'];

                if (terminalProperties.includes(lastProperty)) {
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


            // When we're after a dot, ONLY show object properties for the specific object type
            // This prevents showing suggestions for other objects
            if (objectType) {
              const objectProperties = getObjectProperties(objectType);

              // Only show properties for this specific object type
              suggestions = objectProperties;
            } else {
              // No valid object type, show no suggestions
              suggestions = [];
            }

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
      {title && (
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
      )}

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
