import { useState, useEffect } from 'react';
import type { JSONSchema } from '../../../../core/src/mapper';
import './AddPropertyModal.css';

/**
 * AddPropertyModal - Modal for adding or editing properties on free-form objects
 */
export interface AddPropertyModalProps {
  mode: 'add' | 'edit';
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (propertyName: string, propertySchema: JSONSchema, oldPropertyName?: string) => void;
  existingPropertyName?: string;
  existingPropertySchema?: JSONSchema;
  existingProperties?: string[]; // For duplicate validation
}

const PROPERTY_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' }
] as const;

export function AddPropertyModal({
  mode,
  isOpen,
  onClose,
  onSubmit,
  existingPropertyName = '',
  existingPropertySchema,
  existingProperties = []
}: AddPropertyModalProps) {
  const [propertyName, setPropertyName] = useState(existingPropertyName);
  const [propertyType, setPropertyType] = useState<string>(existingPropertySchema?.type as string || 'string');
  const [description, setDescription] = useState(existingPropertySchema?.description || '');
  const [error, setError] = useState<string>('');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPropertyName(existingPropertyName);
      setPropertyType(existingPropertySchema?.type as string || 'string');
      setDescription(existingPropertySchema?.description || '');
      setError('');
    }
  }, [isOpen, existingPropertyName, existingPropertySchema]);

  // Validate property name
  const validatePropertyName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Property name is required';
    }

    // Check if valid identifier (alphanumeric + underscore + dash)
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$-]*$/.test(name)) {
      return 'Property name must be a valid identifier (letters, numbers, _, $, -)';
    }

    // Check for duplicates (only when adding, or when editing and name changed)
    if (mode === 'add' || name !== existingPropertyName) {
      // Filter out the current property name when editing to allow keeping same name
      const propsToCheck = mode === 'edit'
        ? existingProperties.filter(p => p !== existingPropertyName)
        : existingProperties;

      if (propsToCheck.includes(name)) {
        return 'Property name already exists';
      }
    }

    return null;
  };

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const validationError = validatePropertyName(propertyName);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Build JSON Schema for the property
    const propertySchema: JSONSchema = {
      type: propertyType as any,
      ...(description.trim() && { description: description.trim() })
    };

    // Add default empty properties/items for object/array types
    if (propertyType === 'object') {
      propertySchema.properties = {};
    } else if (propertyType === 'array') {
      propertySchema.items = { type: 'string' }; // Default array item type
    }

    // Pass the old property name when editing (for renaming support)
    if (mode === 'edit') {
      onSubmit(propertyName, propertySchema, existingPropertyName);
    } else {
      onSubmit(propertyName, propertySchema);
    }
    onClose();
  };

  // Handle cancel
  const handleCancel = () => {
    onClose();
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="add-property-modal-backdrop" onClick={handleBackdropClick}>
      <div className="add-property-modal">
        {/* Header */}
        <div className="add-property-modal-header">
          <h2>{mode === 'add' ? '➕ Add Property' : '✏️ Edit Property'}</h2>
          <button
            className="add-property-modal-close"
            onClick={handleCancel}
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="add-property-modal-form">
          {/* Property Name */}
          <div className="form-field">
            <label htmlFor="property-name" className="form-label">
              Property Name *
            </label>
            <input
              id="property-name"
              type="text"
              className="form-input"
              value={propertyName}
              onChange={(e) => {
                setPropertyName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Authorization, Content-Type"
              autoFocus
            />
            {mode === 'edit' && propertyName !== existingPropertyName && (
              <p className="form-hint">Property will be renamed from "{existingPropertyName}" to "{propertyName}"</p>
            )}
          </div>

          {/* Property Type */}
          <div className="form-field">
            <label htmlFor="property-type" className="form-label">
              Type *
            </label>
            <select
              id="property-type"
              className="form-select"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
            >
              {PROPERTY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="form-field">
            <label htmlFor="property-description" className="form-label">
              Description
            </label>
            <textarea
              id="property-description"
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for this property"
              rows={3}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="add-property-modal-actions">
            <button
              type="button"
              className="modal-button modal-button-secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-button modal-button-primary"
            >
              {mode === 'add' ? 'Add Property' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
