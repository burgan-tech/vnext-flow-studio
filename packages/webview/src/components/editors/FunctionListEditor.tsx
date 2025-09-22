import React from 'react';
import type { FunctionRef } from '@amorphie-flow-studio/core';

interface FunctionListEditorProps {
  title: string;
  functions?: FunctionRef[];
  onChange: (functions?: FunctionRef[]) => void;
}


function isFunctionInlineRef(func: FunctionRef): func is { ref: string } {
  return Boolean(func && 'ref' in func);
}

export const FunctionListEditor: React.FC<FunctionListEditorProps> = ({
  title,
  functions = [],
  onChange
}) => {
  const handleFunctionChange = (index: number, func: FunctionRef) => {
    const newFunctions = [...functions];
    newFunctions[index] = func;
    onChange(newFunctions);
  };

  const handleAddFunction = () => {
    const newFunction: FunctionRef = { ref: '' };
    onChange([...functions, newFunction]);
  };

  const handleRemoveFunction = (index: number) => {
    const newFunctions = functions.filter((_, i) => i !== index);
    onChange(newFunctions.length > 0 ? newFunctions : undefined);
  };

  const handleModeChange = (index: number, mode: 'ref' | 'full') => {
    const func = functions[index];
    if (!func) return;

    if (mode === 'ref') {
      handleFunctionChange(index, { ref: '' });
    } else {
      handleFunctionChange(index, {
        key: '',
        domain: '',
        flow: 'sys-functions',
        version: '1.0.0'
      });
    }
  };

  return (
    <div className="property-panel__group">
      <div className="property-panel__group-header">
        <span>{title}</span>
        <button
          type="button"
          onClick={handleAddFunction}
          className="property-panel__add-button"
        >
          +
        </button>
      </div>

      {functions.length === 0 ? (
        <p className="property-panel__muted">No functions defined.</p>
      ) : (
        functions.map((func, index) => (
          <div key={index} className="property-panel__list-item">
            <div className="property-panel__list-item-header">
              <span>Function {index + 1}</span>
              <div className="property-panel__list-item-actions">
                <select
                  value={isFunctionInlineRef(func) ? 'ref' : 'full'}
                  onChange={(e) => handleModeChange(index, e.target.value as 'ref' | 'full')}
                  className="property-panel__select property-panel__select--small"
                >
                  <option value="ref">Path Reference</option>
                  <option value="full">Full Reference</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveFunction(index)}
                  className="property-panel__remove-button"
                >
                  ×
                </button>
              </div>
            </div>

            {isFunctionInlineRef(func) ? (
              <div className="property-panel__field">
                <label>Function Path:</label>
                <input
                  type="text"
                  value={func.ref}
                  onChange={(e) =>
                    handleFunctionChange(index, { ref: e.target.value })
                  }
                  placeholder="e.g., Functions/calculate.json"
                  className="property-panel__input"
                />
                <small className="property-panel__help">
                  Path to the function definition file
                </small>
              </div>
            ) : (
              <>
                <div className="property-panel__field">
                  <label>Key:</label>
                  <input
                    type="text"
                    value={func.key}
                    onChange={(e) =>
                      handleFunctionChange(index, {
                        ...func,
                        key: e.target.value
                      } as FunctionRef)
                    }
                    placeholder="Function key"
                    className="property-panel__input"
                  />
                </div>
                <div className="property-panel__field">
                  <label>Domain:</label>
                  <input
                    type="text"
                    value={func.domain}
                    onChange={(e) =>
                      handleFunctionChange(index, {
                        ...func,
                        domain: e.target.value
                      } as FunctionRef)
                    }
                    placeholder="Domain"
                    className="property-panel__input"
                  />
                </div>
                <div className="property-panel__field">
                  <label>Flow:</label>
                  <input
                    type="text"
                    value={func.flow}
                    onChange={(e) =>
                      handleFunctionChange(index, {
                        ...func,
                        flow: e.target.value
                      } as FunctionRef)
                    }
                    placeholder="sys-functions"
                    className="property-panel__input"
                  />
                </div>
                <div className="property-panel__field">
                  <label>Version:</label>
                  <input
                    type="text"
                    value={func.version}
                    onChange={(e) =>
                      handleFunctionChange(index, {
                        ...func,
                        version: e.target.value
                      } as FunctionRef)
                    }
                    placeholder="1.0.0"
                    pattern="^\d+\.\d+\.\d+$"
                    className="property-panel__input"
                  />
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
};