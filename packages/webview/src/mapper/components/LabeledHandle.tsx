import { Handle, Position } from '@xyflow/react';
import './LabeledHandle.css';

/**
 * LabeledHandle - A handle component with a label
 * Compatible with React Flow UI API (https://reactflow.dev/ui/components/labeled-handle)
 *
 * @param id - Unique identifier for the handle
 * @param title - Label text displayed with the handle
 * @param type - Handle type (source or target)
 * @param position - Handle position (Left, Right, Top, Bottom)
 * @param className - Additional className for wrapper
 * @param handleClassName - Additional className for handle element
 * @param labelClassName - Additional className for label text
 */
export interface LabeledHandleProps {
  id: string;
  title: string;
  type: 'source' | 'target';
  position: Position;
  className?: string;
  handleClassName?: string;
  labelClassName?: string;
}

export function LabeledHandle({
  id,
  type,
  position,
  title,
  className = '',
  handleClassName = '',
  labelClassName = ''
}: LabeledHandleProps) {
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
