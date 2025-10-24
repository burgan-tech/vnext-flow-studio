import { useState } from 'react';
import './SchemaTree.css';

export function SchemaTree({ side, terminals, mappedFields, onFieldDragStart }) {
  const [search, setSearch] = useState('');

  const filtered = terminals.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDragStart = (e, terminal) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      ...terminal,
      side
    }));
    onFieldDragStart?.(terminal);
  };

  const isMapped = (terminal) => mappedFields.has(terminal.id);

  return (
    <div className={`schema-tree schema-tree-${side}`}>
      <div className="schema-tree-header">
        <h3>{side === 'source' ? 'Source Schema' : 'Target Schema'}</h3>
        <input
          type="search"
          placeholder="Search fields..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="schema-search"
        />
      </div>

      <div className="schema-tree-content">
        {filtered.map((terminal) => (
          <div
            key={terminal.id}
            className={`tree-field ${isMapped(terminal) ? 'mapped' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, terminal)}
          >
            <div className="field-indicator">
              {isMapped(terminal) ? (
                side === 'source' ? '🔗' : '✅'
              ) : (
                side === 'target' ? '⭕' : '•'
              )}
            </div>
            <div className="field-info">
              <span className="field-name">{terminal.name}</span>
              <span className="field-type">[{terminal.type}]</span>
            </div>
            <div className="field-path">{terminal.path}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
