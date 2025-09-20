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

  const canHaveIncoming = stateType !== 1; // Not initial
  const canHaveOutgoing = stateType !== 3; // Not final

  const classNames = [
    'react-flow__node-default',
    'state-node',
    stateTypeClass,
    selected ? 'selected' : ''
  ].filter(Boolean).join(' ');

  const handleStyle = { background: 'var(--state-color)' } as const;

  return (
    <div className={classNames}>
      {canHaveIncoming && (
        <Handle
          type="target"
          position={Position.Left}
          style={handleStyle}
        />
      )}

      <div className="state-node__header">
        <span className="state-node__type">{stateTypeName}</span>
        {stateSubTypeName && (
          <span className="state-node__pill">{stateSubTypeName}</span>
        )}
      </div>

      <div className="state-node__body">
        <div className="state-node__title">{title}</div>
        <div className="state-node__key">{state.key}</div>
      </div>

      {canHaveOutgoing && (
        <Handle
          type="source"
          position={Position.Right}
          style={handleStyle}
        />
      )}
    </div>
  );
}