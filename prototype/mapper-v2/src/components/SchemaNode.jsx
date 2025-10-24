import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import './SchemaNode.css';

export function SchemaNode({ data }) {
  const { side, schema, terminals } = data;
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set(terminals.map(t => t.id)));

  const filtered = terminals.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const isSource = side === 'source';
  const handlePosition = isSource ? Position.Right : Position.Left;

  return (
    <div className={`schema-node schema-node-${side}`}>
      {/* Header */}
      <div className="schema-node-header">
        <h3>{isSource ? 'Source Schema' : 'Target Schema'}</h3>
        <input
          type="search"
          placeholder="Search fields..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="schema-search"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Field list with terminals */}
      <div className="schema-fields">
        {filtered.map((terminal, index) => (
          <div
            key={terminal.id}
            className="field-terminal"
            style={{ '--handle-index': index }}
          >
            {/* Field info */}
            <div className="field-info">
              <span className="field-name">{terminal.name}</span>
              <span className="field-type">[{terminal.type}]</span>
            </div>

            {/* Terminal handle */}
            <Handle
              type={isSource ? 'source' : 'target'}
              position={handlePosition}
              id={terminal.id}
              className="field-handle"
              style={{
                top: `${(index + 1) * 32 + 80}px`, // Offset by header height
              }}
            />

            {/* Path label */}
            <div className="field-path">{terminal.path}</div>
          </div>
        ))}
      </div>

      {/* Footer stats */}
      <div className="schema-node-footer">
        {filtered.length} fields
      </div>
    </div>
  );
}
