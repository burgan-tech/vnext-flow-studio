import { Handle, Position } from '@xyflow/react';
import type { FunctoidCategory, NodeKind } from '../../../../core/src/mapper/types';
import { functoidRegistry } from '../../../../core/src/mapper/registry';
import { extractTemplateParams } from '../../../../core/src/mapper/templateUtils';
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
    config?: Record<string, any>;
  };
  selected?: boolean;
}

export function FunctoidNode({ data, selected }: FunctoidNodeProps) {
  // Get functoid definition to determine number of inputs
  const functoidDef = functoidRegistry[data.kind];

  // For Template functoid, dynamically determine inputs from config
  let inputCount = functoidDef?.inputs?.length ?? 0;
  let inputLabels = functoidDef?.inputs ?? [];

  if (data.kind === 'String.Template' && data.config?.template) {
    const params = extractTemplateParams(data.config.template);
    inputCount = params.length;
    inputLabels = params.map(param => param.charAt(0).toUpperCase() + param.slice(1));
  }

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
        <div className="functoid-icon">{data.icon}</div>
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
