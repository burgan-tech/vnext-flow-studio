import { Handle, Position } from '@xyflow/react';
import './CustomNodes.css';

export function SourceFieldNode({ data }) {
  return (
    <div className="custom-node source-field-node">
      <div className="node-header">Source</div>
      <div className="node-content">
        <div className="node-label">{data.label}</div>
        <div className="node-type">{data.type}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="custom-handle"
      />
    </div>
  );
}

export function TargetFieldNode({ data }) {
  return (
    <div className="custom-node target-field-node">
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="custom-handle"
      />
      <div className="node-header">Target</div>
      <div className="node-content">
        <div className="node-label">{data.label}</div>
        <div className="node-type">{data.type}</div>
      </div>
    </div>
  );
}

export function FunctoidNode({ data }) {
  return (
    <div className={`custom-node functoid-node functoid-${data.category}`}>
      <Handle
        type="target"
        position={Position.Left}
        id="in1"
        style={{ top: '30%' }}
        className="custom-handle"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="in2"
        style={{ top: '70%' }}
        className="custom-handle"
      />
      <div className="node-content">
        <div className="node-icon">{data.icon}</div>
        <div className="node-label">{data.label}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="custom-handle"
      />
    </div>
  );
}

export const nodeTypes = {
  sourceField: SourceFieldNode,
  targetField: TargetFieldNode,
  functoid: FunctoidNode
};
