import { Handle, Position } from '@xyflow/react';
import './FunctoidNode.css';

export function FunctoidNode({ data }) {
  return (
    <div className={`functoid-node functoid-${data.category}`}>
      <Handle
        type="target"
        position={Position.Left}
        id="in1"
        style={{ top: '30%' }}
        className="functoid-handle"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="in2"
        style={{ top: '70%' }}
        className="functoid-handle"
      />

      <div className="functoid-content">
        <div className="functoid-icon">{data.icon}</div>
        <div className="functoid-label">{data.label}</div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="functoid-handle"
      />
    </div>
  );
}
