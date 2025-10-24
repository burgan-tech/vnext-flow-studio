import { Handle } from '@xyflow/react';
import './LabeledHandle.css';

/**
 * LabeledHandle - A handle component with a label
 * Compatible with React Flow UI API (https://reactflow.dev/ui/components/labeled-handle)
 *
 * @param {string} id - Unique identifier for the handle
 * @param {string} title - Label text displayed with the handle
 * @param {'source'|'target'} type - Handle type (source or target)
 * @param {Position} position - Handle position (Left, Right, Top, Bottom)
 * @param {string} className - Additional className for wrapper
 * @param {string} handleClassName - Additional className for handle element
 * @param {string} labelClassName - Additional className for label text
 */
export function LabeledHandle({
  id,
  type,
  position,
  title,
  className = '',
  handleClassName = '',
  labelClassName = ''
}) {
  return (
    <div className={`labeled-handle labeled-handle-${type} ${className}`}>
      <span className={`labeled-handle-label ${labelClassName}`}>
        {title}
      </span>
      <Handle
        type={type}
        position={position}
        id={id}
        className={`labeled-handle-connector ${handleClassName}`}
      />
    </div>
  );
}
