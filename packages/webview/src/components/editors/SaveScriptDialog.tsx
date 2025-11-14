import React, { useState, useEffect } from 'react';

interface SaveScriptDialogProps {
  scriptType: 'mapping' | 'rule';
  templateContent: string;
  workflowName?: string;
  fromStateKey?: string;
  onSave: (location: string, content: string) => void;
  onCancel: () => void;
}

/**
 * Dialog for saving a new script file (.csx)
 */
export function SaveScriptDialog({ scriptType, templateContent, workflowName, fromStateKey, onSave, onCancel }: SaveScriptDialogProps) {
  const [filePath, setFilePath] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auto-generate suggested file path: ./src/{workflowPrefix}/{stateKey}_{Mapping|Rule}.csx
  useEffect(() => {
    let path = './src/';

    // Extract workflow prefix (part before first dash)
    if (workflowName) {
      const prefix = workflowName.split('-')[0];
      path += `${prefix}/`;
    }

    // Sanitize state key (replace spaces with underscores)
    const suffix = scriptType === 'mapping' ? 'Mapping' : 'Rule';
    if (fromStateKey) {
      const sanitized = fromStateKey.replace(/\s+/g, '_');
      path += `${sanitized}_${suffix}.csx`;
    } else {
      // Fallback if no state key
      const timestamp = Date.now().toString().slice(-6);
      path += `${suffix}${timestamp}.csx`;
    }

    setFilePath(path);
  }, [scriptType, workflowName, fromStateKey]);

  const handleSave = () => {
    setError(null);

    // Validate file path
    if (!filePath) {
      setError('File path is required');
      return;
    }

    if (!filePath.endsWith('.csx')) {
      setError('File path must end with .csx');
      return;
    }

    // Normalize path
    let location = filePath;
    if (!location.startsWith('./') && !location.startsWith('../') && !location.startsWith('/')) {
      location = `./${location}`;
    }

    onSave(location, templateContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="comment-modal-overlay" onClick={onCancel}>
      <div className="comment-modal" style={{ width: '550px', maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
        <div className="comment-modal__header">
          <h2 className="comment-modal__title">
            Save {scriptType === 'mapping' ? 'Mapping' : 'Rule'} Script
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
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#334155' }}>
              File Path
            </label>
            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="./src/Workflow/StateName_Rule.csx"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '13px',
                fontFamily: 'Monaco, Menlo, monospace',
                backgroundColor: '#ffffff',
                color: '#1e293b'
              }}
            />
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              Pattern: ./src/[WorkflowName]/[StateKey]_{scriptType === 'mapping' ? 'Mapping' : 'Rule'}.csx
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px 12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#dc2626',
              fontSize: '13px'
            }}>
              {error}
            </div>
          )}
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
            className="comment-modal__btn comment-modal__btn--primary"
            onClick={handleSave}
          >
            Create File
          </button>
        </div>
      </div>
    </div>
  );
}
