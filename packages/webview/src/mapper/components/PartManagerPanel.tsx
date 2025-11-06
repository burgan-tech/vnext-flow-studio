import { useState, useCallback, useEffect } from 'react';
import type { WizardTemplate, WIZARD_TEMPLATES, PartDefinition } from '../../../../core/src/mapper/types';
import { inferSchema } from '../../../../core/src/mapper';
import './PartManagerPanel.css';

export interface PartManagerPanelProps {
  sourceParts: Record<string, PartDefinition>;
  targetParts: Record<string, PartDefinition>;
  sourceOrder?: string[];
  targetOrder?: string[];
  onUpdateParts: (source: Record<string, PartDefinition>, target: Record<string, PartDefinition>, sourceOrder: string[], targetOrder: string[]) => void;
  onBindSchema: (side: 'source' | 'target', partName: string) => void;
  onClose: () => void;
  availableSchemas?: any[]; // Platform schemas available for binding
  vscodeApi?: any;
}

export function PartManagerPanel({
  sourceParts,
  targetParts,
  sourceOrder: initialSourceOrder,
  targetOrder: initialTargetOrder,
  onUpdateParts,
  onBindSchema: _onBindSchema,
  onClose,
  availableSchemas = [],
  vscodeApi
}: PartManagerPanelProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [newPartName, setNewPartName] = useState('');
  const [newPartLabel, setNewPartLabel] = useState('');
  const [addingSide, setAddingSide] = useState<'source' | 'target'>('source');

  // Track pending changes that haven't been applied yet
  const [pendingSourceParts, setPendingSourceParts] = useState<Record<string, PartDefinition>>(sourceParts);
  const [pendingTargetParts, setPendingTargetParts] = useState<Record<string, PartDefinition>>(targetParts);

  // Track part order for drag and drop
  const [sourcePartOrder, setSourcePartOrder] = useState<string[]>(initialSourceOrder || Object.keys(sourceParts));
  const [targetPartOrder, setTargetPartOrder] = useState<string[]>(initialTargetOrder || Object.keys(targetParts));

  // Track dragged item
  const [draggedItem, setDraggedItem] = useState<{ side: 'source' | 'target'; partName: string } | null>(null);

  // Track which part is currently being edited for schema selection
  const [selectingSchemaFor, setSelectingSchemaFor] = useState<{ side: 'source' | 'target'; partName: string } | null>(null);

  // Schema input mode: 'select' (browse schemas) or 'infer' (infer from JSON)
  const [schemaInputMode, setSchemaInputMode] = useState<'select' | 'infer'>('select');

  // Search query for filtering platform schemas
  const [searchQuery, setSearchQuery] = useState('');

  // JSON inference state
  const [jsonInput, setJsonInput] = useState('');
  const [inferredSchema, setInferredSchema] = useState<any>(null);
  const [inferenceError, setInferenceError] = useState('');
  const [inferenceWarnings, setInferenceWarnings] = useState<string[]>([]);
  const [confidence, setConfidence] = useState(0);
  const [inferenceOptions, setInferenceOptions] = useState({
    detectFormats: true,
    allRequired: false,
    addConstraints: false,
    strictTypes: true
  });

  // Update order when parts change - preserve existing order and add new parts
  useEffect(() => {
    setSourcePartOrder(prevOrder => {
      const partKeys = Object.keys(pendingSourceParts);
      // Keep existing order for parts that still exist
      const existingOrdered = prevOrder.filter(key => partKeys.includes(key));
      // Add new parts that aren't in the order yet
      const newParts = partKeys.filter(key => !prevOrder.includes(key));
      return [...existingOrdered, ...newParts];
    });
  }, [pendingSourceParts]);

  useEffect(() => {
    setTargetPartOrder(prevOrder => {
      const partKeys = Object.keys(pendingTargetParts);
      // Keep existing order for parts that still exist
      const existingOrdered = prevOrder.filter(key => partKeys.includes(key));
      // Add new parts that aren't in the order yet
      const newParts = partKeys.filter(key => !prevOrder.includes(key));
      return [...existingOrdered, ...newParts];
    });
  }, [pendingTargetParts]);

  // Calculate if there are unsaved changes (including order changes)
  const hasChanges = JSON.stringify(pendingSourceParts) !== JSON.stringify(sourceParts) ||
                     JSON.stringify(pendingTargetParts) !== JSON.stringify(targetParts) ||
                     JSON.stringify(sourcePartOrder) !== JSON.stringify(initialSourceOrder || Object.keys(sourceParts)) ||
                     JSON.stringify(targetPartOrder) !== JSON.stringify(initialTargetOrder || Object.keys(targetParts));

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

    // Update pending state only
    setPendingSourceParts(newSource);
    setPendingTargetParts(newTarget);
    setShowWizard(false);
  };

  const handleAddPart = () => {
    if (!newPartName.trim()) return;

    const newParts = addingSide === 'source' ? { ...pendingSourceParts } : { ...pendingTargetParts };
    newParts[newPartName] = {
      schemaRef: 'custom',
      label: newPartLabel || newPartName
    };

    // Update pending state only
    if (addingSide === 'source') {
      setPendingSourceParts(newParts);
    } else {
      setPendingTargetParts(newParts);
    }

    setNewPartName('');
    setNewPartLabel('');
  };

  const handleRemovePart = (side: 'source' | 'target', partName: string) => {
    const parts = side === 'source' ? { ...pendingSourceParts } : { ...pendingTargetParts };
    delete parts[partName];

    // Update pending state only
    if (side === 'source') {
      setPendingSourceParts(parts);
    } else {
      setPendingTargetParts(parts);
    }
  };

  // Apply all pending changes
  const handleApplyChanges = useCallback(() => {
    onUpdateParts(pendingSourceParts, pendingTargetParts, sourcePartOrder, targetPartOrder);
    onClose();
  }, [pendingSourceParts, pendingTargetParts, sourcePartOrder, targetPartOrder, onUpdateParts, onClose]);

  // Discard pending changes
  const handleDiscardChanges = useCallback(() => {
    setPendingSourceParts(sourceParts);
    setPendingTargetParts(targetParts);
    setSourcePartOrder(initialSourceOrder || Object.keys(sourceParts));
    setTargetPartOrder(initialTargetOrder || Object.keys(targetParts));
  }, [sourceParts, targetParts, initialSourceOrder, initialTargetOrder]);

  // Drag and drop handlers
  const handleDragStart = (side: 'source' | 'target', partName: string) => {
    setDraggedItem({ side, partName });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
  };

  const handleDrop = (side: 'source' | 'target', dropTargetPartName: string) => {
    if (!draggedItem || draggedItem.side !== side) {
      setDraggedItem(null);
      return;
    }

    const order = side === 'source' ? [...sourcePartOrder] : [...targetPartOrder];
    const draggedIndex = order.indexOf(draggedItem.partName);
    const targetIndex = order.indexOf(dropTargetPartName);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null);
      return;
    }

    // Remove dragged item and insert at target position
    order.splice(draggedIndex, 1);
    order.splice(targetIndex, 0, draggedItem.partName);

    // Update order
    if (side === 'source') {
      setSourcePartOrder(order);
    } else {
      setTargetPartOrder(order);
    }

    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  // Open schema selection for a part
  const handleBindSchemaRequest = (side: 'source' | 'target', partName: string) => {
    setSelectingSchemaFor({ side, partName });
    // Reset states
    setSchemaInputMode('select');
    setSearchQuery('');
    setJsonInput('');
    setInferredSchema(null);
    setInferenceError('');
    setInferenceWarnings([]);
    setConfidence(0);
  };

  // Handle JSON inference
  const handleInferSchema = () => {
    setInferenceError('');
    setInferenceWarnings([]);
    setInferredSchema(null);

    if (!jsonInput.trim()) {
      setInferenceError('Please paste some JSON data to infer a schema');
      return;
    }

    try {
      const examples = JSON.parse(jsonInput);

      if (typeof examples !== 'object' || examples === null) {
        setInferenceError('JSON must be an object or array of objects');
        return;
      }

      const result = inferSchema(examples, inferenceOptions);
      setInferredSchema(result.schema);
      setConfidence(result.confidence);
      setInferenceWarnings(result.warnings);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setInferenceError(`Invalid JSON: ${err.message}`);
      } else {
        setInferenceError(err instanceof Error ? err.message : 'Failed to parse JSON');
      }
    }
  };

  // Use inferred schema
  const handleUseInferredSchema = async () => {
    if (!inferredSchema || !selectingSchemaFor) return;
    await handleSchemaSelected({ attributes: { schema: inferredSchema }, __filePath: undefined });
  };

  // Handle schema selection - update pending state
  const handleSchemaSelected = useCallback(async (schema: any) => {
    if (!selectingSchemaFor) return;

    const { side, partName } = selectingSchemaFor;

    // Extract __filePath before processing
    const filePath = schema.__filePath;

    // Extract schema if it's wrapped in SchemaDefinition
    let actualSchema = schema;
    if (schema.attributes && schema.attributes.schema) {
      actualSchema = schema.attributes.schema;
    } else {
      // For plain JSON schemas, remove __filePath if it was added
      const { __filePath, ...cleanSchema } = schema;
      actualSchema = cleanSchema;
    }

    // Calculate hash for schema tracking
    const { calculateSchemaHash } = await import('../../../../core/src/mapper/schemaHashUtils');
    const schemaHash = await calculateSchemaHash(actualSchema);

    // Update pending state with new schema
    const updatedPart: PartDefinition = {
      schemaRef: 'custom',
      schema: actualSchema,
      schemaSourcePath: filePath, // Store source path for change detection
      schemaHash,
      label: (side === 'source' ? pendingSourceParts : pendingTargetParts)[partName]?.label
    };

    if (side === 'source') {
      setPendingSourceParts({
        ...pendingSourceParts,
        [partName]: updatedPart
      });
    } else {
      setPendingTargetParts({
        ...pendingTargetParts,
        [partName]: updatedPart
      });
    }

    // Close schema selector
    setSelectingSchemaFor(null);
  }, [selectingSchemaFor, pendingSourceParts, pendingTargetParts]);

  // Listen for schema file picked from extension
  useEffect(() => {
    if (!vscodeApi) return;

    const handleMessage = async (event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'schemaFilePicked' && selectingSchemaFor) {
        // Check if this message is for the current selection
        if (message.side === selectingSchemaFor.side && message.partName === selectingSchemaFor.partName) {
          // Request schema load from the picked file
          vscodeApi.postMessage({
            type: 'loadSchema',
            path: message.path,
            side: message.side,
            partName: message.partName
          });
        }
      } else if (message.type === 'schemaLoaded' && selectingSchemaFor) {
        // Check if this message is for the current selection
        if (message.partName === selectingSchemaFor.partName && message.side === selectingSchemaFor.side) {
          // Apply the loaded schema
          // For browsed files, message.schema is just a plain JSON Schema
          // For platform schemas, it would have attributes.schema wrapper
          // handleSchemaSelected will detect and handle both cases
          await handleSchemaSelected({ ...message.schema, __filePath: message.path });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscodeApi, selectingSchemaFor, handleSchemaSelected]);

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
        ) : selectingSchemaFor ? (
          <div className="schema-selector-section">
            <div className="selector-header">
              <h3>Select Schema for {selectingSchemaFor.side === 'source' ? 'Source' : 'Target'} Part: {selectingSchemaFor.partName}</h3>
              <button className="button button-secondary" onClick={() => setSelectingSchemaFor(null)}>
                Cancel
              </button>
            </div>

            {/* Schema source options */}
            <div className="schema-source-options">
              <button
                className="source-option-button"
                onClick={() => {
                  // Request file picker from extension
                  if (vscodeApi) {
                    vscodeApi.postMessage({
                      type: 'pickSchemaFile',
                      side: selectingSchemaFor.side,
                      partName: selectingSchemaFor.partName
                    });
                  }
                }}
              >
                📁 Browse Schema File...
              </button>
              <button
                className="source-option-button"
                onClick={() => {
                  // Generate empty schema
                  const emptySchema = {
                    type: 'object',
                    title: `${selectingSchemaFor.partName} Schema`,
                    properties: {}
                  };
                  handleSchemaSelected({ attributes: { schema: emptySchema }, __filePath: undefined });
                }}
              >
                ➕ Create Empty Schema
              </button>
              <button
                className={`source-option-button ${schemaInputMode === 'infer' ? 'active' : ''}`}
                onClick={() => setSchemaInputMode(schemaInputMode === 'infer' ? 'select' : 'infer')}
              >
                🔍 Infer from Example
              </button>
            </div>

            {/* Select mode - show platform schemas */}
            {schemaInputMode === 'select' && (
              <>
                <div className="schema-list-header">
                  <h4>Platform Schemas</h4>
                </div>

                {/* Search input */}
                <input
                  type="text"
                  className="schema-search-input"
                  placeholder="Search schemas by key, domain, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <div className="schema-list">
                  {availableSchemas.length === 0 ? (
                    <div className="empty-state">No platform schemas available</div>
                  ) : (
                    availableSchemas
                      .filter(schema => {
                        if (!searchQuery) return true;
                        const query = searchQuery.toLowerCase();
                        return (
                          schema.key.toLowerCase().includes(query) ||
                          schema.domain.toLowerCase().includes(query) ||
                          (schema.attributes?.schema?.title?.toLowerCase() || '').includes(query) ||
                          (schema.attributes?.schema?.description?.toLowerCase() || '').includes(query)
                        );
                      })
                      .map((schema) => (
                        <div
                          key={`${schema.domain}/${schema.key}@${schema.version}`}
                          className="schema-item"
                          onClick={() => handleSchemaSelected(schema)}
                        >
                          <div className="schema-info">
                            <div className="schema-name">{schema.key}</div>
                            <div className="schema-meta">
                              {schema.domain} • v{schema.version}
                            </div>
                            {schema.attributes?.schema?.description && (
                              <div className="schema-description">{schema.attributes.schema.description}</div>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </>
            )}

            {/* Infer mode - show JSON input and inference options */}
            {schemaInputMode === 'infer' && (
              <div className="inference-section">
                <div className="inference-label">
                  Paste example JSON (single object or array of objects):
                </div>
                <textarea
                  className="json-textarea"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={`{\n  "orderId": "ORD-001",\n  "customer": {\n    "name": "John Doe",\n    "email": "john@example.com"\n  }\n}`}
                  rows={10}
                />

                {/* Inference options */}
                <div className="inference-options">
                  <div className="inference-options-label">Inference Options:</div>
                  <label className="option-checkbox">
                    <input
                      type="checkbox"
                      checked={inferenceOptions.detectFormats}
                      onChange={(e) => setInferenceOptions({ ...inferenceOptions, detectFormats: e.target.checked })}
                    />
                    <span>Detect formats (date, email, UUID)</span>
                  </label>
                  <label className="option-checkbox">
                    <input
                      type="checkbox"
                      checked={inferenceOptions.allRequired}
                      onChange={(e) => setInferenceOptions({ ...inferenceOptions, allRequired: e.target.checked })}
                    />
                    <span>Mark all fields as required</span>
                  </label>
                  <label className="option-checkbox">
                    <input
                      type="checkbox"
                      checked={inferenceOptions.addConstraints}
                      onChange={(e) => setInferenceOptions({ ...inferenceOptions, addConstraints: e.target.checked })}
                    />
                    <span>Add length/range constraints</span>
                  </label>
                  <label className="option-checkbox">
                    <input
                      type="checkbox"
                      checked={inferenceOptions.strictTypes}
                      onChange={(e) => setInferenceOptions({ ...inferenceOptions, strictTypes: e.target.checked })}
                    />
                    <span>Distinguish integer vs number</span>
                  </label>
                </div>

                {/* Generate button */}
                <button
                  className="button button-primary"
                  onClick={handleInferSchema}
                  disabled={!jsonInput.trim()}
                  style={{ marginTop: '12px', width: '100%' }}
                >
                  Generate Schema
                </button>

                {/* Error display */}
                {inferenceError && (
                  <div className="inference-error">
                    <strong>❌ Error:</strong> {inferenceError}
                  </div>
                )}

                {/* Inferred schema result */}
                {inferredSchema && (
                  <div className="inference-result">
                    <div className="inference-result-header">
                      <span className="inference-confidence">
                        Confidence: {Math.round(confidence * 100)}%
                      </span>
                      {inferenceWarnings.length > 0 && (
                        <span className="inference-warnings-count">
                          ⚠️ {inferenceWarnings.length} warning{inferenceWarnings.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {inferenceWarnings.length > 0 && (
                      <div className="inference-warnings">
                        {inferenceWarnings.map((warning, idx) => (
                          <div key={idx} className="warning-item">⚠️ {warning}</div>
                        ))}
                      </div>
                    )}

                    <div className="inference-schema-preview">
                      <pre>{JSON.stringify(inferredSchema, null, 2)}</pre>
                    </div>

                    <button
                      className="button button-primary"
                      onClick={handleUseInferredSchema}
                      style={{ marginTop: '12px', width: '100%' }}
                    >
                      Use This Schema
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="parts-section">
              <h3>Source Parts {hasChanges && <span className="pending-indicator">● Pending changes</span>}</h3>
              <div className="parts-list">
                {sourcePartOrder.length === 0 ? (
                  <div className="empty-state">No source parts defined</div>
                ) : (
                  sourcePartOrder.map((partName) => {
                    const partDef = pendingSourceParts[partName];
                    if (!partDef) return null;

                    // Check if this part has pending changes
                    const hasChange = JSON.stringify(partDef) !== JSON.stringify(sourceParts[partName]);
                    const isDragging = draggedItem?.side === 'source' && draggedItem?.partName === partName;

                    return (
                      <div
                        key={partName}
                        className={`part-item ${hasChange ? 'pending-change' : ''} ${isDragging ? 'dragging' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart('source', partName)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop('source', partName)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="drag-handle" title="Drag to reorder">⋮⋮</div>
                        <div className="part-info">
                          <div className="part-name">
                            {hasChange && <span className="change-indicator">●</span>}
                            {partName}
                            <span className="part-label-inline">{partDef.label && partDef.label !== partName ? ` (${partDef.label})` : ''}</span>
                          </div>
                          <div className={`part-schema ${!partDef.schema ? 'warning' : ''}`}>
                            {partDef.schema ? (
                              <>✓ {partDef.schema.title || 'Schema bound'}</>
                            ) : (
                              '⚠ No schema'
                            )}
                          </div>
                        </div>
                        <div className="part-actions">
                          <button
                            className="action-button"
                            onClick={() => handleBindSchemaRequest('source', partName)}
                          >
                            {partDef.schema ? 'Change' : 'Bind'}
                          </button>
                          <button
                            className="action-button delete"
                            onClick={() => handleRemovePart('source', partName)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })
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
              <h3>Target Parts {hasChanges && <span className="pending-indicator">● Pending changes</span>}</h3>
              <div className="parts-list">
                {targetPartOrder.length === 0 ? (
                  <div className="empty-state">No target parts defined</div>
                ) : (
                  targetPartOrder.map((partName) => {
                    const partDef = pendingTargetParts[partName];
                    if (!partDef) return null;

                    // Check if this part has pending changes
                    const hasChange = JSON.stringify(partDef) !== JSON.stringify(targetParts[partName]);
                    const isDragging = draggedItem?.side === 'target' && draggedItem?.partName === partName;

                    return (
                      <div
                        key={partName}
                        className={`part-item ${hasChange ? 'pending-change' : ''} ${isDragging ? 'dragging' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart('target', partName)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop('target', partName)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="drag-handle" title="Drag to reorder">⋮⋮</div>
                        <div className="part-info">
                          <div className="part-name">
                            {hasChange && <span className="change-indicator">●</span>}
                            {partName}
                            <span className="part-label-inline">{partDef.label && partDef.label !== partName ? ` (${partDef.label})` : ''}</span>
                          </div>
                          <div className={`part-schema ${!partDef.schema ? 'warning' : ''}`}>
                            {partDef.schema ? (
                              <>✓ {partDef.schema.title || 'Schema bound'}</>
                            ) : (
                              '⚠ No schema'
                            )}
                          </div>
                        </div>
                        <div className="part-actions">
                          <button
                            className="action-button"
                            onClick={() => handleBindSchemaRequest('target', partName)}
                          >
                            {partDef.schema ? 'Change' : 'Bind'}
                          </button>
                          <button
                            className="action-button delete"
                            onClick={() => handleRemovePart('target', partName)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })
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
              <div className="footer-left">
                <button className="button button-secondary" onClick={() => setShowWizard(true)}>
                  Use Template
                </button>
              </div>
              <div className="footer-right">
                {hasChanges && (
                  <>
                    <button className="button button-secondary" onClick={handleDiscardChanges}>
                      Discard Changes
                    </button>
                    <button className="button button-primary" onClick={handleApplyChanges}>
                      Apply Changes
                    </button>
                  </>
                )}
                {!hasChanges && (
                  <button className="button button-secondary" onClick={onClose}>
                    Close
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
