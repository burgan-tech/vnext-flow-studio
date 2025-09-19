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
    case 1: return 'state-node-initial';
    case 2: return 'state-node-intermediate';
    case 3: return 'state-node-final';
    case 4: return 'state-node-subflow';
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

  return (
    <div className={`react-flow__node-default ${stateTypeClass} ${selected ? 'selected' : ''}`}>
      {canHaveIncoming && (
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: '#555' }}
        />
      )}

      <div className="node-content">
        <div className="node-title">{title}</div>
        <div className="node-subtitle">
          {stateTypeName}
          {stateSubTypeName && ` (${stateSubTypeName})`}
        </div>
        <div className="node-subtitle">{state.key}</div>
      </div>

      {canHaveOutgoing && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: '#555' }}
        />
      )}
    </div>
  );
}