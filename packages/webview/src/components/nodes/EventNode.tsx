import React from 'react';
import { Handle, Position } from '@xyflow/react';

interface EventNodeProps {
  data: {
    label: string;
    variant: 'start' | 'timeout';
  };
  selected?: boolean;
}

export function EventNode({ data, selected }: EventNodeProps) {
  const { label, variant } = data;
  const handleGap = 4;

  // Position handle at the center of the 68px circle (34px from top)
  // Plus some offset for the container padding
  const handleStyle = {
    background: 'var(--event-color)',
    border: '2px solid var(--event-surface)',
    top: '40px', // Adjusted to center on the circle (6px padding + 34px half-circle)
    transform: `translate(calc(50% + ${handleGap}px), -50%)`
  } as const;

  const className = [
    'event-node',
    `event-node--${variant}`,
    selected ? 'selected' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <div className="event-node__shape" aria-hidden="true" />
      <div className="event-node__label">{label}</div>

      <Handle
        className="event-node__handle"
        type="source"
        position={Position.Right}
        style={handleStyle}
      />
    </div>
  );
}
