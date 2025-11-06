import { useState } from 'react';
import type { WizardTemplate, WIZARD_TEMPLATES, PartDefinition } from '../../../../core/src/mapper/types';
import './PartManagerPanel.css';

export interface PartManagerPanelProps {
  sourceParts: Record<string, PartDefinition>;
  targetParts: Record<string, PartDefinition>;
  onUpdateParts: (source: Record<string, PartDefinition>, target: Record<string, PartDefinition>) => void;
  onBindSchema: (side: 'source' | 'target', partName: string) => void;
  onClose: () => void;
}

export function PartManagerPanel({
  sourceParts,
  targetParts,
  onUpdateParts,
  onBindSchema,
  onClose
}: PartManagerPanelProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [newPartName, setNewPartName] = useState('');
  const [newPartLabel, setNewPartLabel] = useState('');
  const [addingSide, setAddingSide] = useState<'source' | 'target'>('source');

  const handleApplyTemplate = (template: WizardTemplate) => {
    const newSource: Record<string, PartDefinition> = {};
    const newTarget: Record<string, PartDefinition> = {};

    // Create source parts from template
    for (const [partName, label] of Object.entries(template.source)) {
      newSource[partName] = {
        schemaRef: 'custom',
        label
      };
    }

    // Create target parts from template
    for (const [partName, label] of Object.entries(template.target)) {
      newTarget[partName] = {
        schemaRef: 'custom',
        label
      };
    }

    onUpdateParts(newSource, newTarget);
    setShowWizard(false);
  };

  const handleAddPart = () => {
    if (!newPartName.trim()) return;

    const newParts = addingSide === 'source' ? { ...sourceParts } : { ...targetParts };
    newParts[newPartName] = {
      schemaRef: 'custom',
      label: newPartLabel || newPartName
    };

    if (addingSide === 'source') {
      onUpdateParts(newParts, targetParts);
    } else {
      onUpdateParts(sourceParts, newParts);
    }

    setNewPartName('');
    setNewPartLabel('');
  };

  const handleRemovePart = (side: 'source' | 'target', partName: string) => {
    const parts = side === 'source' ? { ...sourceParts } : { ...targetParts };
    delete parts[partName];

    if (side === 'source') {
      onUpdateParts(parts, targetParts);
    } else {
      onUpdateParts(sourceParts, parts);
    }
  };

  return (
    <div className="part-manager-overlay" onClick={onClose}>
      <div className="part-manager-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>📦 Manage Document Parts</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {showWizard ? (
          <div className="wizard-section">
            <h3>Choose a Template</h3>
            <div className="template-grid">
              {(WIZARD_TEMPLATES as any as WizardTemplate[]).map((template) => (
                <div
                  key={template.id}
                  className="template-card"
                  onClick={() => handleApplyTemplate(template)}
                >
                  <div className="template-icon">{template.icon}</div>
                  <div className="template-name">{template.name}</div>
                  <div className="template-description">{template.description}</div>
                  <div className="template-parts">
                    <div>
                      <strong>Source:</strong> {Object.keys(template.source).join(', ') || 'None'}
                    </div>
                    <div>
                      <strong>Target:</strong> {Object.keys(template.target).join(', ') || 'None'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="button button-secondary" onClick={() => setShowWizard(false)}>
              Back
            </button>
          </div>
        ) : (
          <>
            <div className="parts-section">
              <h3>Source Parts</h3>
              <div className="parts-list">
                {Object.entries(sourceParts).length === 0 ? (
                  <div className="empty-state">No source parts defined</div>
                ) : (
                  Object.entries(sourceParts).map(([partName, partDef]) => (
                    <div key={partName} className="part-item">
                      <div className="part-info">
                        <div className="part-name">{partName}</div>
                        <div className="part-label">{partDef.label || partName}</div>
                        <div className={`part-schema ${!partDef.schema ? 'warning' : ''}`}>
                          {partDef.schema ? '✓ Schema bound' : '⚠ No schema'}
                        </div>
                      </div>
                      <div className="part-actions">
                        <button
                          className="action-button"
                          onClick={() => onBindSchema('source', partName)}
                        >
                          {partDef.schema ? 'Change Schema' : 'Bind Schema'}
                        </button>
                        <button
                          className="action-button delete"
                          onClick={() => handleRemovePart('source', partName)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="add-part-form">
                <input
                  type="text"
                  placeholder="Part name (e.g., header)"
                  value={addingSide === 'source' ? newPartName : ''}
                  onChange={(e) => {
                    setAddingSide('source');
                    setNewPartName(e.target.value);
                  }}
                  onFocus={() => setAddingSide('source')}
                />
                <input
                  type="text"
                  placeholder="Label (optional)"
                  value={addingSide === 'source' ? newPartLabel : ''}
                  onChange={(e) => setNewPartLabel(e.target.value)}
                />
                <button className="button button-primary" onClick={handleAddPart}>
                  Add Source Part
                </button>
              </div>
            </div>

            <div className="parts-section">
              <h3>Target Parts</h3>
              <div className="parts-list">
                {Object.entries(targetParts).length === 0 ? (
                  <div className="empty-state">No target parts defined</div>
                ) : (
                  Object.entries(targetParts).map(([partName, partDef]) => (
                    <div key={partName} className="part-item">
                      <div className="part-info">
                        <div className="part-name">{partName}</div>
                        <div className="part-label">{partDef.label || partName}</div>
                        <div className={`part-schema ${!partDef.schema ? 'warning' : ''}`}>
                          {partDef.schema ? '✓ Schema bound' : '⚠ No schema'}
                        </div>
                      </div>
                      <div className="part-actions">
                        <button
                          className="action-button"
                          onClick={() => onBindSchema('target', partName)}
                        >
                          {partDef.schema ? 'Change Schema' : 'Bind Schema'}
                        </button>
                        <button
                          className="action-button delete"
                          onClick={() => handleRemovePart('target', partName)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="add-part-form">
                <input
                  type="text"
                  placeholder="Part name (e.g., targetHeader)"
                  value={addingSide === 'target' ? newPartName : ''}
                  onChange={(e) => {
                    setAddingSide('target');
                    setNewPartName(e.target.value);
                  }}
                  onFocus={() => setAddingSide('target')}
                />
                <input
                  type="text"
                  placeholder="Label (optional)"
                  value={addingSide === 'target' ? newPartLabel : ''}
                  onChange={(e) => setNewPartLabel(e.target.value)}
                />
                <button className="button button-primary" onClick={handleAddPart}>
                  Add Target Part
                </button>
              </div>
            </div>

            <div className="panel-footer">
              <button className="button button-secondary" onClick={() => setShowWizard(true)}>
                Use Template
              </button>
              <button className="button button-secondary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
