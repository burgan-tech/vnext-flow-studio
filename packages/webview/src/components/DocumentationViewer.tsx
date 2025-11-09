import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Workflow } from '@amorphie-flow-studio/core';

interface DocumentationViewerProps {
  workflow: Workflow;
  onClose: () => void;
  onExportWithDiagram: (documentation: string, filename: string) => Promise<void>;
}

export function DocumentationViewer({ workflow, onClose, onExportWithDiagram }: DocumentationViewerProps) {
  const [isExporting, setIsExporting] = useState(false);
  const fullDocumentation = useMemo(() => {
    const sections: string[] = [];

    // Workflow-level documentation
    if (workflow._comment) {
      sections.push(`# ${workflow.key} (${workflow.version})`);
      sections.push(workflow._comment);
      sections.push('');
      sections.push('---');
      sections.push('');
    } else {
      sections.push(`# ${workflow.key} (${workflow.version})`);
      sections.push('');
    }

    // Start transition documentation
    if (workflow.attributes.startTransition._comment) {
      sections.push('## Start Transition');
      sections.push(workflow.attributes.startTransition._comment);
      sections.push('');
    }

    // States documentation
    if (workflow.attributes.states && workflow.attributes.states.length > 0) {
      sections.push('## States');
      sections.push('');

      workflow.attributes.states.forEach((state) => {
        const stateLabel = state.labels?.[0]?.label || state.key;

        if (state._comment) {
          sections.push(`### ${stateLabel} (\`${state.key}\`)`);
          sections.push(state._comment);
          sections.push('');
        }

        // On-entry tasks
        if (state.onEntries && state.onEntries.length > 0) {
          const tasksWithComments = state.onEntries.filter(task => task._comment);
          if (tasksWithComments.length > 0) {
            if (!state._comment) {
              sections.push(`### ${stateLabel} (\`${state.key}\`)`);
              sections.push('');
            }
            sections.push('#### On-Entry Tasks');
            tasksWithComments.forEach((task) => {
              const taskRef = 'ref' in task.task ? task.task.ref : task.task.key;
              sections.push(`**${taskRef}** (Order ${task.order})`);
              sections.push(task._comment!);
              sections.push('');
            });
          }
        }

        // On-exit tasks
        if (state.onExits && state.onExits.length > 0) {
          const tasksWithComments = state.onExits.filter(task => task._comment);
          if (tasksWithComments.length > 0) {
            if (!state._comment && (!state.onEntries || state.onEntries.every(t => !t._comment))) {
              sections.push(`### ${stateLabel} (\`${state.key}\`)`);
              sections.push('');
            }
            sections.push('#### On-Exit Tasks');
            tasksWithComments.forEach((task) => {
              const taskRef = 'ref' in task.task ? task.task.ref : task.task.key;
              sections.push(`**${taskRef}** (Order ${task.order})`);
              sections.push(task._comment!);
              sections.push('');
            });
          }
        }

        // Transitions
        if (state.transitions && state.transitions.length > 0) {
          const transitionsWithComments = state.transitions.filter(t => t._comment);
          if (transitionsWithComments.length > 0) {
            if (!state._comment &&
                (!state.onEntries || state.onEntries.every(t => !t._comment)) &&
                (!state.onExits || state.onExits.every(t => !t._comment))) {
              sections.push(`### ${stateLabel} (\`${state.key}\`)`);
              sections.push('');
            }
            sections.push('#### Transitions');
            transitionsWithComments.forEach((transition) => {
              const transitionLabel = transition.labels?.[0]?.label || transition.key;
              sections.push(`**${transitionLabel}** → \`${transition.target}\``);
              sections.push(transition._comment!);
              sections.push('');
            });
          }
        }
      });
    }

    // Shared transitions documentation
    if (workflow.attributes.sharedTransitions && workflow.attributes.sharedTransitions.length > 0) {
      const sharedWithComments = workflow.attributes.sharedTransitions.filter(t => t._comment);
      if (sharedWithComments.length > 0) {
        sections.push('## Shared Transitions');
        sections.push('');

        sharedWithComments.forEach((transition) => {
          const transitionLabel = transition.labels?.[0]?.label || transition.key;
          sections.push(`### ${transitionLabel}`);
          sections.push(transition._comment!);
          sections.push('');
        });
      }
    }

    return sections.join('\n');
  }, [workflow]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExportWithDiagram(fullDocumentation, `${workflow.key}-${workflow.version}-documentation.md`);
    } catch (error) {
      console.error('Failed to export:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="comment-modal-overlay" onClick={onClose}>
      <div className="comment-modal comment-modal--large" onClick={(e) => e.stopPropagation()}>
        <div className="comment-modal__header">
          <h2 className="comment-modal__title">Full Documentation</h2>
          <button
            className="comment-modal__close-btn"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="comment-modal__content">
          <div className="comment-modal__view markdown-content">
            {fullDocumentation ? (
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
                {fullDocumentation}
              </ReactMarkdown>
            ) : (
              <p className="comment-modal__empty">No documentation available</p>
            )}
          </div>
        </div>

        <div className="comment-modal__footer">
          <button
            type="button"
            className="comment-modal__btn comment-modal__btn--secondary"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="comment-modal__btn comment-modal__btn--primary"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export as Markdown'}
          </button>
        </div>
      </div>
    </div>
  );
}
