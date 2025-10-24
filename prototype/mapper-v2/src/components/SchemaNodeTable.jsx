import { useState } from 'react';
import { Position } from '@xyflow/react';
import { LabeledHandle } from './LabeledHandle';
import './SchemaNodeTable.css';

export function SchemaNodeTable({ data }) {
  const { side, schema, terminals } = data;
  const [search, setSearch] = useState('');

  const filtered = terminals.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.path.toLowerCase().includes(search.toLowerCase())
  );

  const isSource = side === 'source';
  const handleType = isSource ? 'source' : 'target';
  const handlePosition = isSource ? Position.Right : Position.Left;

  return (
    <div className={`schema-node-table schema-node-${side}`}>
      {/* Header */}
      <div className="schema-node-table-header">
        <div className="schema-title">
          {isSource ? '📤 Source Schema' : '📥 Target Schema'}
        </div>
        <input
          type="search"
          placeholder="Search fields..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="schema-search-input"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Table structure */}
      <div className="schema-table">
        <div className="schema-table-header-row">
          <div className="schema-table-cell">Field: Type</div>
        </div>

        <div className="schema-table-body">
          {filtered.length === 0 ? (
            <div className="schema-table-empty">
              No fields found
            </div>
          ) : (
            filtered.map((terminal, index) => (
              <div
                key={terminal.id}
                className="schema-table-row"
                data-field-id={terminal.id}
              >
                {/* Field name with type in label */}
                <div className="schema-table-cell field-name-cell">
                  <LabeledHandle
                    id={terminal.id}
                    type={handleType}
                    position={handlePosition}
                    title={`${terminal.name}: ${terminal.type}`}
                    labelClassName={isSource ? 'text-right' : 'text-left'}
                  />
                </div>

                {/* Path tooltip on hover */}
                <div className="field-path-tooltip">
                  {terminal.path}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="schema-node-table-footer">
        <span className="field-count">{filtered.length} field{filtered.length !== 1 ? 's' : ''}</span>
        {search && (
          <span className="search-indicator">
            (filtered from {terminals.length})
          </span>
        )}
      </div>
    </div>
  );
}
