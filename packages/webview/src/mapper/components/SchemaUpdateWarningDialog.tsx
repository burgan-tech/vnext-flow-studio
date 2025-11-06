import './SchemaUpdateWarningDialog.css';

export interface OutdatedSchema {
  side: 'source' | 'target';
  partName: string;
  currentHash: string;
  storedHash: string;
}

export interface SchemaUpdateWarningDialogProps {
  isOpen: boolean;
  outdatedSchemas: OutdatedSchema[];
  onUpdateAll: () => void;
  onKeepCurrent: () => void;
}

export function SchemaUpdateWarningDialog({
  isOpen,
  outdatedSchemas,
  onUpdateAll,
  onKeepCurrent
}: SchemaUpdateWarningDialogProps) {
  if (!isOpen || outdatedSchemas.length === 0) return null;

  return (
    <div className="schema-warning-overlay" onClick={onKeepCurrent}>
      <div className="schema-warning-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="warning-header">
          <div className="warning-icon">⚠️</div>
          <h2>Schema Changes Detected</h2>
        </div>

        {/* Body */}
        <div className="warning-body">
          <p className="warning-message">
            The following schemas have been modified since they were last bound to this mapper.
            Would you like to update them?
          </p>

          <div className="outdated-schemas-list">
            {outdatedSchemas.map((schema) => (
              <div key={`${schema.side}-${schema.partName}`} className="outdated-schema-item">
                <div className="schema-item-header">
                  <span className="schema-side-badge">{schema.side === 'source' ? 'Source' : 'Target'}</span>
                  <span className="schema-part-name">{schema.partName}</span>
                </div>
                <div className="schema-hash-info">
                  <div className="hash-row">
                    <span className="hash-label">Stored:</span>
                    <code className="hash-value">{schema.storedHash.substring(0, 12)}...</code>
                  </div>
                  <div className="hash-row">
                    <span className="hash-label">Current:</span>
                    <code className="hash-value">{schema.currentHash.substring(0, 12)}...</code>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="warning-note">
            <strong>Note:</strong> Updating will reload schemas from files and may affect existing mappings.
          </div>
        </div>

        {/* Footer */}
        <div className="warning-footer">
          <button className="button button-secondary" onClick={onKeepCurrent}>
            Keep Current
          </button>
          <button className="button button-primary" onClick={onUpdateAll}>
            Update All
          </button>
        </div>
      </div>
    </div>
  );
}
