import React from 'react';
import type { Label } from '@amorphie-flow-studio/core';

interface LabelListEditorProps {
  title: string;
  labels: Label[];
  onChange: (labels: Label[]) => void;
}

export const LabelListEditor: React.FC<LabelListEditorProps> = ({ title, labels, onChange }) => {
  const handleLabelChange = (index: number, field: 'label' | 'language', value: string) => {
    const newLabels = [...labels];
    newLabels[index] = { ...newLabels[index], [field]: value };
    onChange(newLabels);
  };

  const handleAddLabel = () => {
    onChange([...labels, { label: '', language: 'en' }]);
  };

  const handleRemoveLabel = (index: number) => {
    onChange(labels.filter((_, i) => i !== index));
  };

  return (
    <div className="property-panel__group">
      {title && (
        <div className="property-panel__group-header">
          <span>{title}</span>
          <button
            type="button"
            onClick={handleAddLabel}
            className="property-panel__add-button"
          >
            +
          </button>
        </div>
      )}
      {labels.length === 0 ? (
        <p className="property-panel__muted">No labels defined.</p>
      ) : (
        labels.map((label, index) => (
          <div key={index} className="property-panel__label-row">
            <input
              type="text"
              value={label.label}
              onChange={(e) => handleLabelChange(index, 'label', e.target.value)}
              placeholder="Label text"
              className="property-panel__input"
            />
            <select
              value={label.language}
              onChange={(e) => handleLabelChange(index, 'language', e.target.value)}
              className="property-panel__select property-panel__select--small"
            >
              <option value="en">en</option>
              <option value="en-US">en-US</option>
              <option value="tr">tr</option>
              <option value="tr-TR">tr-TR</option>
            </select>
            <button
              type="button"
              onClick={() => handleRemoveLabel(index)}
              className="property-panel__remove-button"
            >
              ×
            </button>
          </div>
        ))
      )}
    </div>
  );
};