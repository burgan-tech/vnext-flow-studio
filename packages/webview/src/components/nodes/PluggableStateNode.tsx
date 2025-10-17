import React, { useMemo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { State, StateType } from '@amorphie-flow-studio/core';
import type { DesignHints, TerminalConfig } from '@amorphie-flow-studio/core/plugins/types';
import { useBridge } from '../../hooks/useBridge';

interface PluggableStateNodeProps {
  data: {
    title?: string;
    label?: string;
    state?: State;
    stateType: StateType;
    stateSubType?: number;
    variant?: 'start' | 'timeout';
    width?: number;
    height?: number;
    // Plugin-specific data
    pluginId?: string;
    designHints?: DesignHints;
  };
  selected?: boolean;
  style?: React.CSSProperties;
  isConnectable?: boolean;
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

const getStateTypeIcon = (stateType: StateType, pluginId?: string): string => {
  // Use plugin-specific icon if available
  if (pluginId === 'ServiceTask') {
    return '⚙';
  }

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

const getPositionFromRole = (position?: string): Position => {
  switch (position) {
    case 'top': return Position.Top;
    case 'bottom': return Position.Bottom;
    case 'left': return Position.Left;
    case 'right': return Position.Right;
    default: return Position.Right;
  }
};

const getTerminalStyle = (position?: string): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    background: 'var(--state-color)',
    border: '2px solid var(--state-surface)',
    width: 12,
    height: 12
  };

  switch (position) {
    case 'top':
      return {
        ...baseStyle,
        top: -6,
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    case 'bottom':
      return {
        ...baseStyle,
        bottom: -6,
        left: '50%',
        transform: 'translate(-50%, 50%)'
      };
    case 'left':
      return {
        ...baseStyle,
        left: -6,
        top: '50%',
        transform: 'translate(-50%, -50%)'
      };
    case 'right':
    default:
      return {
        ...baseStyle,
        right: -6,
        top: '50%',
        transform: 'translate(50%, -50%)'
      };
  }
};

export function PluggableStateNode({ data, selected, style: externalStyle, isConnectable = true }: PluggableStateNodeProps) {
  const {
    title,
    label,
    state,
    stateType,
    stateSubType,
    variant,
    width: dataWidth,
    height: dataHeight,
    pluginId,
    designHints
  } = data;

  const { postMessage } = useBridge();
  const stateTypeClass = getStateTypeClass(stateType);
  const stateTypeName = getStateTypeName(stateType);
  const stateSubTypeName = getStateSubTypeName(stateSubType);
  const stateSubTypeIcon = getStateSubTypeIcon(stateSubType);
  const stateTypeIcon = getStateTypeIcon(stateType, pluginId);
  const variantIcon = getVariantIcon(variant);
  const displayTitle = title || label || 'Node';
  const isFinal = stateType === 3;
  const isStart = variant === 'start';
  const isSubflow = stateType === 4;
  const hasSubflowReference = isSubflow && state?.subFlow?.process;

  // Calculate terminals to render
  const terminals = useMemo(() => {
    if (designHints?.terminals) {
      // Use plugin-defined terminals
      return designHints.terminals.filter(t => t.visible);
    }

    // Fallback to standard terminals
    const standardTerminals: TerminalConfig[] = [];

    if (!isStart && !isFinal) {
      standardTerminals.push({
        id: 'input',
        role: 'input',
        visible: true,
        position: { x: 0, y: 0 }
      });
    }

    if (!isFinal) {
      standardTerminals.push({
        id: 'output',
        role: 'output',
        visible: true,
        position: { x: 0, y: 0 }
      });
    }

    return standardTerminals;
  }, [designHints, isStart, isFinal]);

  const handleNavigateToSubflow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state?.key) {
      postMessage({
        type: 'navigate:subflow',
        stateKey: state.key
      });
    }
  };

  // Calculate node dimensions
  let calculatedWidth: number;
  let calculatedHeight: number;

  if (dataWidth && dataHeight) {
    calculatedWidth = dataWidth;
    calculatedHeight = dataHeight;
  } else {
    // Default size, adjust if we have multiple terminals
    calculatedWidth = 180;
    calculatedHeight = terminals.length > 2 ? 100 : 80;
  }

  const classNames = [
    'react-flow__node-default',
    'state-node',
    stateTypeClass,
    pluginId ? `plugin-${pluginId.toLowerCase()}` : '',
    selected ? 'selected' : ''
  ].filter(Boolean).join(' ');

  // Render terminal labels for plugin nodes (currently disabled to keep nodes clean)
  const renderTerminalLabel = (terminal: TerminalConfig) => {
    // Terminal labels are disabled for now to avoid clutter
    // They can be shown on hover or in property panel instead
    return null;
  };

  return (
    <div className={classNames} data-variant={variant} style={{ width: `${calculatedWidth}px`, height: `${calculatedHeight}px`, ...externalStyle }}>
      {/* Resizable card per RF v12 UI */}
      <NodeResizer isVisible={selected} minWidth={180} minHeight={80} handleStyle={{ borderRadius: 4 }} />

      {/* Shape is the visual rectangle used for edge intersections; handles live inside */}
      <div className="state-node__shape">
        {/* Render plugin terminals */}
        {terminals.map(terminal => {
          // Determine terminal type based on role or position
          const isSource = terminal.role === 'output' ||
                          terminal.role === 'success' ||
                          terminal.role === 'timeout' ||
                          terminal.role === 'error' ||
                          terminal.role === 'approve' ||
                          terminal.role === 'reject';

          const isTarget = terminal.role === 'input' || !isSource;

          // Get position from terminal config or default based on role
          let position: string = 'right';
          if (terminal.role === 'input') {
            position = 'left';
          } else if (terminal.role === 'timeout' || terminal.role === 'error') {
            position = 'bottom';
          }

          // Override with terminal-specific position if provided
          if (terminal.position) {
            // Terminal position might be specified differently in the actual implementation
            // For now, use a simple mapping
            if (terminal.id === 'success') position = 'right';
            else if (terminal.id === 'timeout') position = 'bottom';
            else if (terminal.id === 'error') position = 'bottom';
          }

          return (
            <React.Fragment key={terminal.id}>
              <Handle
                id={terminal.id}
                className={`state-node__handle state-node__handle--${isSource ? 'source' : 'target'} terminal-${terminal.role}`}
                type={isSource ? 'source' : 'target'}
                position={getPositionFromRole(position)}
                style={getTerminalStyle(position)}
                isConnectable={isConnectable}
              />
              {renderTerminalLabel(terminal)}
            </React.Fragment>
          );
        })}

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
          {hasSubflowReference && (
            <button
              className="state-node__navigate-btn"
              onClick={handleNavigateToSubflow}
              title={`Open subflow: ${state.subFlow?.process.key}`}
              aria-label="Navigate to subflow definition"
            >
              →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}