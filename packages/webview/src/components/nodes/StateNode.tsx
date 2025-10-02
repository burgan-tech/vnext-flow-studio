import React from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { State, StateType } from '@amorphie-flow-studio/core';

interface StateNodeProps {
  data: {
    title?: string;
    label?: string;
    state?: State;
    stateType: StateType;
    stateSubType?: number;
    variant?: 'start' | 'timeout';
    width?: number;
    height?: number;
  };
  selected?: boolean;
  style?: React.CSSProperties;
}

const getStateTypeClass = (stateType: StateType): string => {
  switch (stateType) {
    case 1: return 'state-node--initial';
    case 2: return 'state-node--intermediate';
    case 3: return 'state-node--final';
    case 4: return 'state-node--subflow';
    default: return '';
  }
};

const getStateTypeName = (stateType: StateType): string => {
  switch (stateType) {
    case 1: return 'Initial';
    case 2: return 'Intermediate';
    case 3: return 'Final';
    case 4: return 'SubFlow';
    default: return 'Unknown';
  }
};

const getStateSubTypeName = (stateSubType?: number): string => {
  switch (stateSubType) {
    case 1: return 'Success';
    case 2: return 'Failed';
    case 3: return 'Cancelled';
    default: return '';
  }
};

const getStateSubTypeIcon = (stateSubType?: number): string => {
  switch (stateSubType) {
    case 1: return '✓'; // Success
    case 2: return '✗'; // Failed
    case 3: return '⊘'; // Cancelled
    default: return '';
  }
};

const getStateTypeIcon = (stateType: StateType): string => {
  switch (stateType) {
    case 1: return '▶'; // Initial
    case 2: return '▢'; // Intermediate
    case 3: return '◉'; // Final
    case 4: return '⊕'; // Subflow
    default: return '●';
  }
};

const getVariantIcon = (variant?: 'start' | 'timeout'): string => {
  if (variant === 'start') return '▶';
  if (variant === 'timeout') return '⏱';
  return '';
};

export function StateNode({ data, selected, style: externalStyle }: StateNodeProps) {
  const { title, label, state, stateType, stateSubType, variant, width: dataWidth, height: dataHeight } = data;
  const stateTypeClass = getStateTypeClass(stateType);
  const stateTypeName = getStateTypeName(stateType);
  const stateSubTypeName = getStateSubTypeName(stateSubType);
  const stateSubTypeIcon = getStateSubTypeIcon(stateSubType);
  const stateTypeIcon = getStateTypeIcon(stateType);
  const variantIcon = getVariantIcon(variant);
  const displayTitle = title || label || 'Node';
  const isFinal = stateType === 3;

  const canHaveIncoming = true; // initial can receive if we allow start->initial; adjust later if needed
  const canHaveOutgoing = !isFinal;

  // Use width/height from data if provided, otherwise calculate (for event nodes)
  let calculatedWidth: number;
  let calculatedHeight: number;

  if (dataWidth && dataHeight) {
    calculatedWidth = dataWidth;
    calculatedHeight = dataHeight;
  } else {
    // Fallback calculation for event nodes (start/timeout)
    calculatedWidth = 180;
    calculatedHeight = 80;
  }

  const classNames = [
    'react-flow__node-default',
    'state-node',
    stateTypeClass,
    selected ? 'selected' : ''
  ].filter(Boolean).join(' ');

  const handleCommon: React.CSSProperties = {
    background: 'var(--state-color)',
    border: '2px solid var(--state-surface)'
  };

  const leftHandleStyle: React.CSSProperties = {
    ...handleCommon,
    left: -7,
    top: '50%',
    transform: 'translate(-50%, -50%)'
  };

  const rightHandleStyle: React.CSSProperties = {
    ...handleCommon,
    right: -7,
    top: '50%',
    transform: 'translate(50%, -50%)'
  };

  return (
    <div className={classNames} data-variant={variant} style={{ width: `${calculatedWidth}px`, height: `${calculatedHeight}px`, ...externalStyle }}>
      {/* Resizable card per RF v12 UI */}
      <NodeResizer isVisible={selected} minWidth={180} minHeight={80} handleStyle={{ borderRadius: 4 }} />

      {/* Shape is the visual rectangle used for edge intersections; handles live inside */}
      <div className="state-node__shape">
        {canHaveIncoming && (
          <Handle
            className="state-node__handle state-node__handle--target"
            type="target"
            position={Position.Left}
            style={leftHandleStyle}
          />
        )}
        {canHaveOutgoing && (
          <Handle
            className="state-node__handle state-node__handle--source"
            type="source"
            position={Position.Right}
            style={rightHandleStyle}
          />
        )}

        <div className="state-node__icon-column" aria-label={stateTypeName} title={stateTypeName}>
          <div className="state-node__type-icon">
            {variantIcon || stateTypeIcon}
          </div>
        </div>

        <div className="state-node__content">
          {stateSubTypeIcon && (
            <div className="state-node__badge-icon" aria-label={stateSubTypeName} title={stateSubTypeName}>
              {stateSubTypeIcon}
            </div>
          )}
          <div className="state-node__title">{displayTitle}</div>
          {state && (
            <div className="state-node__meta">
              <span className="state-node__key">{state.key}</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
