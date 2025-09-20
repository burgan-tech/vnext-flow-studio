import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { State, StateType } from '@nextcredit/core';

interface StateNodeProps {
  data: {
    title: string;
    state: State;
    stateType: StateType;
    stateSubType?: number;
  };
  selected?: boolean;
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

export function StateNode({ data, selected }: StateNodeProps) {
  const { title, state, stateType, stateSubType } = data;
  const stateTypeClass = getStateTypeClass(stateType);
  const stateTypeName = getStateTypeName(stateType);
  const stateSubTypeName = getStateSubTypeName(stateSubType);
  const isEventType = stateType === 1 || stateType === 3;
  const isSubFlow = stateType === 4;

  const canHaveIncoming = true // stateType !== 1; // Not initial
  const canHaveOutgoing = stateType !== 3; // Not final

  const classNames = [
    'react-flow__node-default',
    'state-node',
    stateTypeClass,
    selected ? 'selected' : ''
  ].filter(Boolean).join(' ');

  const handleGap = 4;

  const baseHandleStyle = {
    background: 'var(--state-color)',
    border: '2px solid var(--state-surface)'
  } as const;

  const incomingHandleStyle: React.CSSProperties = {
    ...baseHandleStyle,
    transform: `translate(calc(-50% - ${handleGap}px), -50%)`
  };

  const outgoingHandleStyle: React.CSSProperties = {
    ...baseHandleStyle,
    transform: `translate(calc(50% + ${handleGap}px), -50%)`
  };

  const incomingHandle = canHaveIncoming ? (
    <Handle
      className="state-node__handle state-node__handle--target"
      type="target"
      position={Position.Left}
      style={incomingHandleStyle}
    />
  ) : null;

  const outgoingHandle = canHaveOutgoing ? (
    <Handle
      className="state-node__handle state-node__handle--source"
      type="source"
      position={Position.Right}
      style={outgoingHandleStyle}
    />
  ) : null;

  return (
    <div className={classNames}>
      {isEventType ? (
        <div className="state-node__event">
          <div className="state-node__shape-wrapper">
            {incomingHandle}
            <div className="state-node__shape" aria-hidden="true" />
            {outgoingHandle}
          </div>
          <div className="state-node__label">{title}</div>
          <div className="state-node__meta">
            <span className="state-node__type">{stateTypeName}</span>
            <span className="state-node__key">{state.key}</span>
          </div>
        </div>
      ) : (
        <div className="state-node__activity">
          <div className="state-node__shape-wrapper">
            {incomingHandle}
            <div className="state-node__shape">
              <div className="state-node__title">{title}</div>
              {stateSubTypeName && (
                <span className="state-node__badge">{stateSubTypeName}</span>
              )}
              {isSubFlow && (
                <div className="state-node__marker" aria-label="Subflow" role="img" />
              )}
            </div>
            {outgoingHandle}
          </div>
          <div className="state-node__meta">
            <span className="state-node__type">{stateTypeName}</span>
            <span className="state-node__key">{state.key}</span>
          </div>
        </div>
      )}
    </div>
  );
}
