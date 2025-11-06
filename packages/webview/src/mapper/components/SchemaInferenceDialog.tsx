import { useState, useEffect } from 'react';
import { inferSchema, type SchemaInferenceOptions } from '../../../../core/src/mapper';
import type { SchemaDefinition } from '../../../../core/src/types/schema';
import './SchemaInferenceDialog.css';

/**
 * SchemaInferenceDialog - UI for inferring JSON Schema from example JSON
 * Allows users to paste JSON examples and generate schemas automatically
 */
export interface SchemaInferenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSchemaInferred: (schema: any, side: 'source' | 'target') => void;
  side: 'source' | 'target';
  vscodeApi?: any;
  availableSchemas?: SchemaDefinition[];
}

export function SchemaInferenceDialog({
  isOpen,
  onClose,
  onSchemaInferred,
  side,
  vscodeApi,
  availableSchemas = []
}: SchemaInferenceDialogProps) {
  const [mode, setMode] = useState<'platform' | 'infer' | 'direct' | 'file'>('platform');
  const [jsonInput, setJsonInput] = useState('');
  const [schemaInput, setSchemaInput] = useState('');
  const [filePath, setFilePath] = useState('');
  const [inferredSchema, setInferredSchema] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number>(0);
  const [copySuccess, setCopySuccess] = useState(false);

  // Platform schema selection
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [options, setOptions] = useState<SchemaInferenceOptions>({
    detectFormats: true,
    allRequired: false,
    addConstraints: false,
    strictTypes: true
  });

  // Listen for file picker results
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'schemaFilePicked' && message.side === side) {
        if (message.path) {
          setFilePath(message.path);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [side]);

  if (!isOpen) return null;

  const handleInfer = () => {
    setError('');
    setWarnings([]);
    setInferredSchema(null);

    // Validate input
    if (!jsonInput.trim()) {
      setError('Please paste some JSON data to infer a schema');
      return;
    }

    try {
      // Parse JSON
      const examples = JSON.parse(jsonInput);

      // Validate that it's an object or array
      if (typeof examples !== 'object' || examples === null) {
        setError('JSON must be an object or array of objects');
        return;
      }

      // Infer schema
      const result = inferSchema(examples, options);

      setInferredSchema(result.schema);
      setConfidence(result.confidence);
      setWarnings(result.warnings);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError(`Invalid JSON: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to parse JSON');
      }
    }
  };

  const handleDirectSchema = () => {
    setError('');
    setInferredSchema(null);

    if (!schemaInput.trim()) {
      setError('Please paste a JSON Schema');
      return;
    }

    try {
      const schema = JSON.parse(schemaInput);

      // Basic validation
      if (typeof schema !== 'object' || schema === null) {
        setError('Schema must be a valid JSON object');
        return;
      }

      if (!schema.type && !schema.properties && !schema.items) {
        setError('Not a valid JSON Schema - missing type, properties, or items');
        return;
      }

      setInferredSchema(schema);
      setConfidence(1);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError(`Invalid JSON: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to parse JSON Schema');
      }
    }
  };

  const handleAccept = () => {
    if (inferredSchema) {
      onSchemaInferred(inferredSchema, side);
      handleReset();
      onClose();
    }
  };

  const handleFileReference = () => {
    setError('');

    if (!filePath.trim()) {
      setError('Please enter a schema file path');
      return;
    }

    // Basic validation - file should end with .json or .schema.json
    if (!filePath.endsWith('.json') && !filePath.endsWith('.schema.json')) {
      setError('Schema file must be a .json or .schema.json file');
      return;
    }

    // For file references, we'll pass a special marker object
    // The parent component will handle storing the reference
    setInferredSchema({
      __fileReference: true,
      path: filePath
    });
    setConfidence(1);
  };

  const handleReset = () => {
    setJsonInput('');
    setSchemaInput('');
    setFilePath('');
    setSearchQuery('');
    setInferredSchema(null);
    setError('');
    setWarnings([]);
    setConfidence(0);
    setCopySuccess(false);
  };

  const handleLoadExample = () => {
    const example = side === 'source' ? exampleSourceData : exampleTargetData;
    setJsonInput(JSON.stringify(example, null, 2));
    setError('');
  };

  const handleFormatJSON = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setError('');
    } catch {
      setError('Cannot format invalid JSON');
    }
  };

  const handleCopySchema = () => {
    if (inferredSchema) {
      navigator.clipboard.writeText(JSON.stringify(inferredSchema, null, 2));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const exampleSourceData = {
    orderId: "ORD-2024-001",
    orderDate: "2024-01-15T14:30:00Z",
    customer: {
      id: "CUST-12345",
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "+1-555-0123"
    },
    shippingAddress: {
      street: "123 Main St",
      city: "San Francisco",
      state: "CA",
      zipCode: "94102",
      country: "USA"
    },
    items: [
      {
        productId: "PROD-A001",
        name: "Laptop Computer",
        sku: "TECH-LAP-001",
        quantity: 1,
        price: 1299.99,
        tax: 104.00
      },
      {
        productId: "PROD-B002",
        name: "Wireless Mouse",
        sku: "ACC-MOU-002",
        quantity: 2,
        price: 29.99,
        tax: 4.80
      }
    ],
    subtotal: 1359.97,
    taxTotal: 108.80,
    shippingCost: 15.00,
    total: 1483.77,
    status: "pending",
    paymentMethod: "credit_card"
  };

  const exampleTargetData = {
    invoiceNumber: "INV-2024-001",
    invoiceDate: "2024-01-15",
    dueDate: "2024-02-14",
    customerId: "CUST-12345",
    customerName: "John Doe",
    customerEmail: "john.doe@example.com",
    billingAddress: "123 Main St, San Francisco, CA 94102",
    lineItems: [
      {
        productId: "PROD-A001",
        description: "Laptop Computer",
        quantity: 1,
        price: 1299.99,
        lineTotal: 1299.99
      },
      {
        productId: "PROD-B002",
        description: "Wireless Mouse",
        quantity: 2,
        price: 29.99,
        lineTotal: 59.98
      }
    ],
    subtotal: 1359.97,
    tax: 108.80,
    shipping: 15.00,
    total: 1483.77,
    currency: "USD",
    paid: false
  };

  const sampleJSON = side === 'source'
    ? JSON.stringify(exampleSourceData, null, 2)
    : JSON.stringify(exampleTargetData, null, 2);

  return (
    <div className="schema-inference-overlay" onClick={onClose}>
      <div className="schema-inference-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dialog-header">
          <h2>
            {side === 'source' ? '📤 Import Source Schema' : '📥 Import Target Schema'}
          </h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="dialog-body">
          {/* Mode Tabs */}
          <div className="mode-tabs">
            <button
              className={`mode-tab ${mode === 'platform' ? 'active' : ''}`}
              onClick={() => {
                setMode('platform');
                setError('');
                setInferredSchema(null);
              }}
            >
              🏛️ Platform Schemas
            </button>
            <button
              className={`mode-tab ${mode === 'infer' ? 'active' : ''}`}
              onClick={() => {
                setMode('infer');
                setError('');
                setInferredSchema(null);
              }}
            >
              📊 Infer from JSON
            </button>
            <button
              className={`mode-tab ${mode === 'direct' ? 'active' : ''}`}
              onClick={() => {
                setMode('direct');
                setError('');
                setInferredSchema(null);
              }}
            >
              📄 Paste Schema
            </button>
            {mode !== 'platform' && (
              <button
                className={`mode-tab ${mode === 'file' ? 'active' : ''}`}
                onClick={() => {
                  setMode('file');
                  setError('');
                  setInferredSchema(null);
                }}
              >
                📁 Reference File
              </button>
            )}
          </div>

          {/* Platform Schemas Mode */}
          {mode === 'platform' && (
            <div className="dialog-section">
              <div className="section-header">
                <label className="section-label">
                  Select a platform schema:
                </label>
              </div>

              {/* Search filter */}
              <input
                type="text"
                className="json-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search schemas by key, domain, or type..."
                style={{
                  fontFamily: 'inherit',
                  height: 'auto',
                  padding: '10px 12px',
                  marginBottom: '12px'
                }}
              />

              {/* Schema list */}
              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '8px'
              }}>
                {availableSchemas.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                    No platform schemas found. Make sure sys-schemas directory exists in your project.
                  </div>
                ) : (
                  availableSchemas
                    .filter(schema => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      return (
                        schema.key.toLowerCase().includes(query) ||
                        schema.domain.toLowerCase().includes(query) ||
                        schema.attributes.type.toLowerCase().includes(query) ||
                        (schema.attributes.schema.title?.toLowerCase() || '').includes(query) ||
                        (schema.attributes.schema.description?.toLowerCase() || '').includes(query)
                      );
                    })
                    .map(schema => {
                      const schemaKey = `${schema.domain}/${schema.flow}/${schema.key}@${schema.version}`;

                      return (
                        <div
                          key={schemaKey}
                          onClick={() => {
                            // Directly use the schema when clicked
                            const jsonSchema = schema.attributes.schema;
                            // Add metadata for schema change detection using actual file path
                            const schemaWithMetadata = {
                              ...jsonSchema,
                              __platformSchemaPath: schema.__filePath // Use actual file path from where schema was loaded
                            };
                            onSchemaInferred(schemaWithMetadata, side);
                            onClose();
                          }}
                          style={{
                            padding: '12px',
                            marginBottom: '8px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            backgroundColor: 'white',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.backgroundColor = 'white';
                          }}
                        >
                          <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                            {schema.key}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                            {schema.domain} • {schema.attributes.type} • v{schema.version}
                          </div>
                          {schema.attributes.schema.title && (
                            <div style={{ fontSize: '13px', color: '#374151', marginBottom: '2px' }}>
                              {schema.attributes.schema.title}
                            </div>
                          )}
                          {schema.attributes.schema.description && (
                            <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.4' }}>
                              {schema.attributes.schema.description.length > 150
                                ? schema.attributes.schema.description.substring(0, 150) + '...'
                                : schema.attributes.schema.description}
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}

          {/* Infer Mode */}
          {mode === 'infer' && (
            <div className="dialog-section">
              <div className="section-header">
                <label className="section-label">
                  Paste example JSON (single object or array of objects):
                </label>
                <div className="section-actions">
                  <button className="action-button" onClick={handleLoadExample} title="Load example">
                    📋 Load Example
                  </button>
                  <button
                    className="action-button"
                    onClick={handleFormatJSON}
                    disabled={!jsonInput}
                    title="Format JSON"
                  >
                    ✨ Format
                  </button>
                </div>
              </div>
              <textarea
                className="json-input"
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={sampleJSON}
                rows={12}
              />
            </div>
          )}

          {/* Direct Schema Mode */}
          {mode === 'direct' && (
            <div className="dialog-section">
              <div className="section-header">
                <label className="section-label">
                  Paste JSON Schema:
                </label>
                <div className="section-actions">
                  <button
                    className="action-button"
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(schemaInput);
                        setSchemaInput(JSON.stringify(parsed, null, 2));
                        setError('');
                      } catch {
                        setError('Cannot format invalid JSON');
                      }
                    }}
                    disabled={!schemaInput}
                    title="Format JSON"
                  >
                    ✨ Format
                  </button>
                </div>
              </div>
              <textarea
                className="json-input"
                value={schemaInput}
                onChange={(e) => setSchemaInput(e.target.value)}
                placeholder={`{\n  "type": "object",\n  "properties": {\n    "name": { "type": "string" },\n    "age": { "type": "integer" }\n  }\n}`}
                rows={12}
              />
            </div>
          )}

          {/* File Reference Mode */}
          {mode === 'file' && (
            <div className="dialog-section">
              <div className="section-header">
                <label className="section-label">
                  Schema File Path:
                </label>
                <button
                  className="action-button"
                  onClick={() => {
                    // Request file picker from extension
                    if (vscodeApi) {
                      vscodeApi.postMessage({
                        type: 'pickSchemaFile',
                        side
                      });
                    }
                  }}
                  title="Browse for schema file"
                >
                  📁 Browse...
                </button>
              </div>
              <input
                type="text"
                className="json-input"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="./schemas/source.schema.json"
                style={{ fontFamily: 'inherit', height: 'auto', padding: '10px 12px' }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', marginBottom: 0 }}>
                Enter a relative or absolute path to a JSON Schema file, or click Browse to select a file
              </p>
            </div>
          )}

          {/* Options - only for infer mode */}
          {mode === 'infer' && (
            <div className="dialog-section">
              <label className="section-label">Inference Options:</label>
              <div className="options-grid">
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={options.detectFormats}
                    onChange={(e) => setOptions({ ...options, detectFormats: e.target.checked })}
                  />
                  <span>Detect formats (date, email, UUID)</span>
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={options.allRequired}
                    onChange={(e) => setOptions({ ...options, allRequired: e.target.checked })}
                  />
                  <span>Mark all fields as required</span>
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={options.addConstraints}
                    onChange={(e) => setOptions({ ...options, addConstraints: e.target.checked })}
                  />
                  <span>Add length/range constraints</span>
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={options.strictTypes}
                    onChange={(e) => setOptions({ ...options, strictTypes: e.target.checked })}
                  />
                  <span>Distinguish integer vs number</span>
                </label>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="error-message">
              <strong>❌ Error:</strong> {error}
            </div>
          )}

          {/* Inferred schema display */}
          {inferredSchema && (
            <div className="dialog-section">
              <div className="section-header">
                <label className="section-label">
                  Inferred Schema (confidence: {(confidence * 100).toFixed(0)}%):
                </label>
                <button
                  className="action-button"
                  onClick={handleCopySchema}
                  title="Copy schema to clipboard"
                >
                  {copySuccess ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
              <pre className="schema-preview">
                {JSON.stringify(inferredSchema, null, 2)}
              </pre>

              {warnings.length > 0 && (
                <div className="warnings-list">
                  <strong>⚠️ Warnings:</strong>
                  <ul>
                    {warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dialog-footer">
          <button className="button button-secondary" onClick={handleReset}>
            Reset
          </button>
          {mode === 'infer' ? (
            <button className="button button-primary" onClick={handleInfer}>
              Infer Schema
            </button>
          ) : mode === 'direct' ? (
            <button className="button button-primary" onClick={handleDirectSchema}>
              Validate Schema
            </button>
          ) : mode === 'file' ? (
            <button className="button button-primary" onClick={handleFileReference}>
              Reference File
            </button>
          ) : null}
          {inferredSchema && (
            <button className="button button-success" onClick={handleAccept}>
              ✓ Use This Schema
            </button>
          )}
          <button className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
