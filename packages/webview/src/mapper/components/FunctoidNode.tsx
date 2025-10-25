import { Handle, Position } from '@xyflow/react';
import type { FunctoidCategory, NodeKind } from '../../../../core/src/mapper/types';
import { functoidRegistry } from '../../../../core/src/mapper/registry';
import { getFunctoidIcon } from './functoidIcons';
import './FunctoidNode.css';

/**
 * FunctoidNode - Visual representation of a transformation function
 * Displays icon, label, and handles for inputs/output
 */
export interface FunctoidNodeProps {
  data: {
    label: string;
    icon: string;
    category: FunctoidCategory;
    kind: NodeKind;
    inputs?: string[];
    output?: string;
  };
  selected?: boolean;
}

export function FunctoidNode({ data, selected }: FunctoidNodeProps) {
  // Get functoid definition to determine number of inputs
  const functoidDef = functoidRegistry[data.kind];
  const inputCount = functoidDef?.inputs?.length ?? 0;

  // Get the icon component for this functoid
  const IconComponent = getFunctoidIcon(data.kind);

  // Calculate vertical positions for inputs
  const inputPositions = Array.from({ length: inputCount }, (_, i) => {
    if (inputCount === 1) return 50; // Center for single input
    return (100 / (inputCount + 1)) * (i + 1); // Evenly space multiple inputs
  });

  return (
    <div className={`functoid-node functoid-${data.category} ${selected ? 'selected' : ''}`}>
      {/* Input handles - only render if there are inputs */}
      {inputCount > 0 && inputPositions.map((topPercent, index) => (
        <Handle
          key={`input-${index}`}
          type="target"
          position={Position.Left}
          id={`input-${index}`}
          style={{ top: `${topPercent}%` }}
          className="functoid-handle"
        />
      ))}

      <div className="functoid-content">
        <div className="functoid-icon">
          <IconComponent size={18} strokeWidth={2.5} />
        </div>
        <div className="functoid-label">{data.label}</div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="functoid-handle"
      />
    </div>
  );
}
