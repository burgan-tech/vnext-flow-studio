import React from 'react';

const TRIGGER_TYPE_INFO = [
  { type: 0, color: '#3b82f6', label: 'Manual', description: 'User-triggered transition' },
  { type: 1, color: '#10b981', label: 'Auto', description: 'Automatic transition' },
  { type: 2, color: '#f59e0b', label: 'Timeout', description: 'Time-based transition' },
  { type: 3, color: '#8b5cf6', label: 'Event', description: 'Event-driven transition' }
];

export const TriggerTypeLegend: React.FC = () => {
  return (
    <div className="trigger-legend">
      <div className="trigger-legend__title">Transition Types</div>
      <div className="trigger-legend__items">
        {TRIGGER_TYPE_INFO.map(({ type, color, label, description }) => (
          <div key={type} className="trigger-legend__item" title={description}>
            <div
              className="trigger-legend__color"
              style={{ backgroundColor: color }}
            />
            <span className="trigger-legend__label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};