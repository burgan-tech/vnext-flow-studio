import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import type { Rule } from '@amorphie-flow-studio/core';
import { getAllBBTWorkflowIntelliSense } from '../../types/bbt-workflow-intellisense';

interface RuleEditorProps {
  title: string;
  rule?: Rule;
  inlineText: string;
  onLoadFromFile?: () => void;
  onChange: (rule?: Rule) => void;
  onInlineChange: (text: string) => void;
}

export const RuleEditor: React.FC<RuleEditorProps> = ({
  title,
  rule,
  inlineText,
  onLoadFromFile,
  onChange,
  onInlineChange
}) => {
  const hasRule = Boolean(rule);
  const [displayText, setDisplayText] = useState(inlineText);
  const [useMonaco, setUseMonaco] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // Decode Base64 content for display
  useEffect(() => {
    if (inlineText) {
      try {
        // Check if it's Base64 by trying to decode it
        const decoded = atob(inlineText);
        // Verify it looks like C# code (contains common keywords)
        if (decoded.includes('using ') || decoded.includes('public ') || decoded.includes('class ') || decoded.includes('namespace ')) {
          setDisplayText(decoded);
        } else {
          setDisplayText(inlineText);
        }
      } catch (error) {
        // Not Base64, use as-is
        setDisplayText(inlineText);
      }
    } else {
      setDisplayText('');
    }
  }, [inlineText]);

  const handleCodeChange = (value: string) => {
    // Try to encode as Base64 if it looks like C# code
    let codeToStore = value;
    if (value && (value.includes('using ') || value.includes('public ') || value.includes('class '))) {
      try {
        codeToStore = btoa(value);
      } catch (error) {
        // If encoding fails, store as-is
        codeToStore = value;
      }
    }
    onInlineChange(codeToStore);
  };

  // Initialize Monaco Editor
  const initializeMonaco = useCallback(async () => {
    if (!editorContainerRef.current || editorRef.current) return;

    try {
      // Register C# language for syntax highlighting
      monaco.languages.register({ id: 'csharp' });
      
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
        value: displayText,
        language: 'csharp',
        theme: 'vs-dark',
        fontSize: 12,
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: 'on'
      });

      editorRef.current = editor;

      // Set up IntelliSense
      const bbtSuggestions = getAllBBTWorkflowIntelliSense();
      
      const completionProvider = monaco.languages.registerCompletionItemProvider('csharp', {
        provideCompletionItems: (model, position) => {
          const suggestions = bbtSuggestions.map(item => ({
            label: item.label,
            kind: monaco.languages.CompletionItemKind[item.kind as keyof typeof monaco.languages.CompletionItemKind] || monaco.languages.CompletionItemKind.Text,
            insertText: item.insertText,
            documentation: item.documentation,
            detail: item.detail,
            sortText: item.sortText
          }));

          return { suggestions };
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

  // Initialize Monaco when switching to Monaco mode
  useEffect(() => {
    if (useMonaco) {
      initializeMonaco();
    }
  }, [useMonaco, initializeMonaco]);

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

          <div className="property-panel__field">
            <div className="property-panel__field-header">
              <label>Code (Base64 or inline):</label>
              <button
                type="button"
                onClick={toggleEditor}
                className="property-panel__toggle-button"
                title={useMonaco ? "Switch to simple editor" : "Switch to IntelliSense editor"}
              >
                {useMonaco ? "📝 Simple" : "🧠 IntelliSense"}
              </button>
            </div>
            
            {useMonaco ? (
              <div 
                ref={editorContainerRef}
                style={{ 
                  height: '200px', 
                  border: '1px solid #333',
                  borderRadius: '4px'
                }}
              />
            ) : (
              <textarea
                value={displayText}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="Enter C# script code (auto-encodes to Base64)"
                className="property-panel__textarea"
                rows={8}
                style={{
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  fontSize: '12px',
                  lineHeight: '1.4'
                }}
              />
            )}
            
            <div className="property-panel__hint">
              ✨ C# code is automatically detected and encoded as Base64
              {useMonaco && " | 🧠 IntelliSense active with BBT Workflow suggestions"}
            </div>
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
