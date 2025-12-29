import { useState, useEffect } from 'react';
import { generateJSONata, generateCSharp, generateFakeDataForMapSpec } from '../../../../core/src/mapper';
import type { MapSpec } from '../../../../core/src/mapper';
import './ExecutionPreviewPanel.css';

/**
 * ExecutionPreviewPanel - Test mapper execution
 * Shows generated JSONata code and allows testing with sample data
 */
export interface ExecutionPreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mapSpec: MapSpec;
  activeHandler?: string;
}

export function ExecutionPreviewPanel({
  isOpen,
  onClose,
  mapSpec,
  activeHandler
}: ExecutionPreviewPanelProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<'jsonata' | 'csharp'>('jsonata');
  const [jsonataCode, setJsonataCode] = useState<string>('');
  const [csharpCode, setCsharpCode] = useState<string>('');
  const [inputJSON, setInputJSON] = useState<string>('');
  const [outputJSON, setOutputJSON] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  /**
   * Generate both JSONata and C# code when panel opens or mapSpec changes
   */
  useEffect(() => {
    if (isOpen) {
      try {
        // For contract mappers, flatten the MapSpec for the active handler
        let targetMapSpec = mapSpec;
        if (activeHandler && (mapSpec as any).handlers?.[activeHandler]) {
          const handler = (mapSpec as any).handlers[activeHandler];
          targetMapSpec = {
            ...mapSpec,
            nodes: handler.nodes || [],
            edges: handler.edges || [],
            schemaParts: handler.schemaParts,
            schemaOverlays: handler.schemaOverlays
          };
        }

        const jsonata = generateJSONata(targetMapSpec);
        const csharp = generateCSharp(mapSpec); // C# generator handles contract mappers internally
        setJsonataCode(jsonata);
        setCsharpCode(csharp);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate code');
        setJsonataCode('');
        setCsharpCode('');
      }
    }
  }, [isOpen, mapSpec, activeHandler]);

  /**
   * Load example input data generated from source schema
   */
  const handleLoadExample = async () => {
    try {
      // For contract mappers, flatten the MapSpec for the active handler
      let targetMapSpec = mapSpec;
      if (activeHandler && (mapSpec as any).handlers?.[activeHandler]) {
        const handler = (mapSpec as any).handlers[activeHandler];
        targetMapSpec = {
          ...mapSpec,
          nodes: handler.nodes || [],
          edges: handler.edges || [],
          schemaParts: handler.schemaParts,
          schemaOverlays: handler.schemaOverlays
        };
      }

      // Generate fake data matching the source schema structure
      const fakeData = await generateFakeDataForMapSpec(targetMapSpec, 'source', { seed: 12345 });
      setInputJSON(JSON.stringify(fakeData, null, 2));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate example data');
    }
  };

  /**
   * Format input JSON
   */
  const handleFormatInput = () => {
    try {
      const parsed = JSON.parse(inputJSON);
      setInputJSON(JSON.stringify(parsed, null, 2));
      setError('');
    } catch {
      setError('Invalid input JSON');
    }
  };

  /**
   * Execute transformation
   */
  const handleExecute = async () => {
    setError('');
    setOutputJSON('');
    setIsExecuting(true);

    try {
      // Parse input JSON
      const input = JSON.parse(inputJSON);

      // Execute JSONata
      const jsonata = (await import('jsonata')).default;
      const expression = jsonata(jsonataCode);
      const result = await expression.evaluate(input);

      // Display output
      setOutputJSON(JSON.stringify(result, null, 2));
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError(`Invalid JSON: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : 'Execution failed');
      }
    } finally {
      setIsExecuting(false);
    }
  };

  /**
   * Copy code to clipboard (selected language)
   */
  const handleCopyCode = () => {
    const code = selectedLanguage === 'jsonata' ? jsonataCode : csharpCode;
    navigator.clipboard.writeText(code);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  /**
   * Copy output to clipboard
   */
  const handleCopyOutput = () => {
    navigator.clipboard.writeText(outputJSON);
  };

  if (!isOpen) return null;

  return (
    <div className="execution-preview-overlay" onClick={onClose}>
      <div className="execution-preview-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="preview-header">
          <h2>🚀 Execution Preview</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="preview-body">
          {/* Generated Code */}
          <div className="preview-section">
            <div className="section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label className="section-label">Generated Code:</label>
                <div className="language-tabs">
                  <button
                    className={`tab-button ${selectedLanguage === 'jsonata' ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage('jsonata')}
                  >
                    JSONata
                  </button>
                  <button
                    className={`tab-button ${selectedLanguage === 'csharp' ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage('csharp')}
                  >
                    C#
                  </button>
                </div>
              </div>
              <button
                className="action-button"
                onClick={handleCopyCode}
                title={`Copy ${selectedLanguage === 'jsonata' ? 'JSONata' : 'C#'} code`}
              >
                {copySuccess ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
            <pre className="code-display">
              {selectedLanguage === 'jsonata'
                ? (jsonataCode || '// No mappings defined')
                : (csharpCode || '// No mappings defined')}
            </pre>
          </div>

          {/* Input JSON */}
          <div className="preview-section">
            <div className="section-header">
              <label className="section-label">Test Input (JSON):</label>
              <div className="section-actions">
                <button className="action-button" onClick={handleLoadExample}>
                  📋 Load Example
                </button>
                <button
                  className="action-button"
                  onClick={handleFormatInput}
                  disabled={!inputJSON}
                >
                  ✨ Format
                </button>
              </div>
            </div>
            <textarea
              className="json-input"
              value={inputJSON}
              onChange={(e) => setInputJSON(e.target.value)}
              placeholder="Paste your source JSON here..."
              rows={10}
            />
          </div>

          {/* Execute Button */}
          <div className="preview-section">
            <button
              className="execute-button"
              onClick={handleExecute}
              disabled={!jsonataCode || !inputJSON || isExecuting}
            >
              {isExecuting ? '⏳ Executing...' : '▶️ Execute Transformation'}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="preview-section">
              <div className="error-message">
                <strong>❌ Error:</strong> {error}
              </div>
            </div>
          )}

          {/* Output JSON */}
          {outputJSON && (
            <div className="preview-section">
              <div className="section-header">
                <label className="section-label">Output Result:</label>
                <button className="action-button" onClick={handleCopyOutput}>
                  📋 Copy
                </button>
              </div>
              <pre className="output-display">{outputJSON}</pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="preview-footer">
          <div className="footer-hint">
            💡 Test your mapper with sample data and see the transformed output
          </div>
          <button className="button button-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
