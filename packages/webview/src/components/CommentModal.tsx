import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Editor from '@monaco-editor/react';

interface CommentModalProps {
  content: string;
  title: string;
  isEditing?: boolean;
  onSave?: (newContent: string) => void;
  onClose: () => void;
}

// Helper function to generate default template based on title
function getDefaultTemplate(title: string): string {
  const isTransition = title.toLowerCase().includes('transition');

  if (isTransition) {
    return `## Transition Overview

**Purpose:** Describe what triggers this transition and when it occurs.

**Conditions:**
- List any conditions or rules that must be met
- Include validation requirements
- Note any business rules

**Behavior:**
- Describe what happens during this transition
- Note any data transformations
- Document side effects or notifications

**Notes:**
- Add any additional information or edge cases
`;
  } else {
    return `## State Overview

**Purpose:** Describe what this state represents in the workflow.

**Responsibilities:**
- What actions or tasks are performed in this state
- Any business logic or validation
- Expected processing or waiting behavior

**Inputs:**
- Required data or conditions to enter this state
- Any parameters or context needed

**Outputs:**
- What this state produces or modifies
- Next possible states or transitions

**Notes:**
- Add any additional information, edge cases, or special handling
`;
  }
}

export function CommentModal({ content, title, isEditing = false, onSave, onClose }: CommentModalProps) {
  const defaultContent = content || getDefaultTemplate(title);
  const [editedContent, setEditedContent] = useState(defaultContent);
  const [showPreview, setShowPreview] = useState(!isEditing || !!content);

  useEffect(() => {
    const newContent = content || getDefaultTemplate(title);
    setEditedContent(newContent);
    // Show edit mode if no content exists
    if (isEditing && !content) {
      setShowPreview(false);
    }
  }, [content, title, isEditing]);

  const handleSave = () => {
    if (onSave) {
      onSave(editedContent);
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="comment-modal-overlay" onClick={handleClose}>
      <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="comment-modal__header">
          <h2 className="comment-modal__title">{title}</h2>
          <button
            className="comment-modal__close-btn"
            onClick={handleClose}
            aria-label="Close"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="comment-modal__content">
          {isEditing ? (
            <div className="comment-modal__editor">
              <div className="comment-modal__editor-toolbar">
                <button
                  type="button"
                  className={`comment-modal__tab ${!showPreview ? 'active' : ''}`}
                  onClick={() => setShowPreview(false)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`comment-modal__tab ${showPreview ? 'active' : ''}`}
                  onClick={() => setShowPreview(true)}
                >
                  Preview
                </button>
              </div>

            {showPreview ? (
              <div className="comment-modal__preview markdown-content">
                {editedContent ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {editedContent}
                  </ReactMarkdown>
                ) : (
                  <p className="comment-modal__empty">No content to preview</p>
                )}
              </div>
            ) : (
              <div className="comment-modal__monaco-wrapper">
                <Editor
                  height="400px"
                  defaultLanguage="markdown"
                  value={editedContent}
                  onChange={(value) => setEditedContent(value || '')}
                  theme="vs"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    padding: { top: 12, bottom: 12 },
                    renderLineHighlight: 'all',
                    lineDecorationsWidth: 0,
                    lineNumbersMinChars: 3,
                    folding: true,
                    guides: {
                      indentation: true,
                      bracketPairs: false
                    },
                    quickSuggestions: false,
                    suggest: {
                      showWords: false
                    }
                  }}
                />
              </div>
            )}
          </div>
          ) : (
            <div className="comment-modal__view markdown-content">
              {content ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {content}
                </ReactMarkdown>
              ) : (
                <p className="comment-modal__empty">No documentation available</p>
              )}
            </div>
          )}
        </div>

        <div className="comment-modal__footer">
          {isEditing ? (
            <>
              <button
                type="button"
                className="comment-modal__btn comment-modal__btn--secondary"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="comment-modal__btn comment-modal__btn--primary"
                onClick={handleSave}
              >
                Save
              </button>
            </>
          ) : (
            <button
              type="button"
              className="comment-modal__btn comment-modal__btn--primary"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
