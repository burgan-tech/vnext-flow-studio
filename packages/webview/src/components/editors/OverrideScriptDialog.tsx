import React from 'react';

interface OverrideScriptDialogProps {
  scriptType: 'mapping' | 'rule';
  currentLocation: string;
  templateContent: string;
  onOverride: () => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

/**
 * Dialog shown when user tries to create from template but a file is already bound
 * Offers to override the existing file or create a new one
 */
export function OverrideScriptDialog({
  scriptType,
  currentLocation,
  onOverride,
  onCreateNew,
  onCancel
}: OverrideScriptDialogProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="comment-modal-overlay" onClick={onCancel} onKeyDown={handleKeyDown}>
      <div className="comment-modal" style={{ width: '600px', maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
        <div className="comment-modal__header">
          <h2 className="comment-modal__title">
            Script Already Bound
          </h2>
          <button
            className="comment-modal__close-btn"
            onClick={onCancel}
            aria-label="Close"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="comment-modal__content">
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '14px', color: '#334155', marginBottom: '12px' }}>
              A {scriptType} script is already bound to this mapping:
            </p>
            <div style={{
              padding: '10px 12px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '13px',
              fontFamily: 'Monaco, Menlo, monospace',
              color: '#1e293b'
            }}>
              {currentLocation}
            </div>
          </div>

          <div style={{
            padding: '12px 14px',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#1e40af'
          }}>
            <strong>What would you like to do?</strong>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '4px' }}>
                <strong>Override Existing File:</strong> Replace the content of <code>{currentLocation}</code> with the template
              </li>
              <li>
                <strong>Create New File:</strong> Save the template with a different filename and bind it instead
              </li>
            </ul>
          </div>
        </div>

        <div className="comment-modal__footer">
          <button
            type="button"
            className="comment-modal__btn comment-modal__btn--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="comment-modal__btn comment-modal__btn--secondary"
            onClick={onCreateNew}
            style={{ marginLeft: 'auto' }}
          >
            Create New File
          </button>
          <button
            type="button"
            className="comment-modal__btn comment-modal__btn--primary"
            onClick={onOverride}
            style={{
              backgroundColor: '#f59e0b',
              borderColor: '#f59e0b'
            }}
          >
            Override Existing File
          </button>
        </div>
      </div>
    </div>
  );
}
