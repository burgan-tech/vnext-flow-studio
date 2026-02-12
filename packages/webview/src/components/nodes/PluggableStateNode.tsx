import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { State, StateType, DesignHints, TerminalConfig } from '@amorphie-flow-studio/core';
import { useBridge } from '../../hooks/useBridge';
import { CommentIcon } from '../CommentIcon';
import { CommentModal } from '../CommentModal';
import { TaskBadges } from '../badges/TaskBadges';

interface PluggableStateNodeProps {
  data: {
    title?: string;
    label?: string;
    state?: State;
    stateType: StateType;
    stateSubType?: number;
    isCancelTarget?: boolean;
    variant?: 'start' | 'timeout';
    width?: number;
    height?: number;
    // Plugin-specific data
    pluginId?: string;
    designHints?: DesignHints;
    // Callback for task badge clicks
    onTaskBadgeClick?: (stateKey: string, lane?: 'onEntries' | 'onExits') => void;
    // Instance highlighting
    highlighted?: boolean;
    highlightedInHistory?: boolean;
    // Monitoring overlay (Zeebe Operate style)
    monitoringStatus?: 'completed' | 'active' | 'error' | 'human-waiting' | 'suspended' | 'unvisited';
    monitoringVisitOrder?: number;
    monitoringDuration?: number;
  };
  selected?: boolean;
  style?: React.CSSProperties;
  isConnectable?: boolean;
}

/** Format milliseconds into human-readable duration */
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
};

/** Monitoring status icon */
const getMonitoringIcon = (status: string): string => {
  switch (status) {
    case 'completed': return '\u2713'; // checkmark
    case 'active': return '\u25CF';    // filled circle
    case 'error': return '\u2717';     // X mark
    case 'human-waiting': return '\u23F3'; // hourglass
    case 'suspended': return '\u23F8'; // pause
    default: return '';
  }
};

const getStateTypeClass = (stateType: StateType, stateSubType?: number): string => {
  switch (stateType) {
    case 1: return 'state-node--initial';
    case 2: {
      // Intermediate states with optional sub-status
      switch (stateSubType) {
        case 4: return 'state-node--intermediate-suspended';
        case 5: return 'state-node--intermediate-busy';
        case 6: return 'state-node--intermediate-human';
        default: return 'state-node--intermediate';
      }
    }
    case 3: {
      // Final states with sub-status specific colors
      switch (stateSubType) {
        case 1: return 'state-node--final-success';
        case 2: return 'state-node--final-failed';
        case 3: return 'state-node--final-cancelled';
        default: return 'state-node--final'; // neutral gray
      }
    }
    case 4: return 'state-node--subflow';
    case 5: return 'state-node--wizard';
    default: return '';
  }
};

const getStateTypeName = (stateType: StateType): string => {
  switch (stateType) {
    case 1: return 'Initial';
    case 2: return 'Intermediate';
    case 3: return 'Final';
    case 4: return 'SubFlow';
    case 5: return 'Wizard';
    default: return 'Unknown';
  }
};


const getStateTypeIcon = (stateType: StateType, _pluginId?: string): string => {
  switch (stateType) {
    case 1: return '▶'; // Initial
    case 2: return '▢'; // Intermediate
    case 3: return '◉'; // Final
    case 4: return '⊕'; // Subflow
    case 5: return '◇'; // Wizard
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
    border: '4px solid var(--state-surface)',
    width: 18,
    height: 18
  };

  switch (position) {
    case 'top':
      return {
        ...baseStyle,
        top: -9,
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    case 'bottom':
      return {
        ...baseStyle,
        bottom: -9,
        left: '50%',
        transform: 'translate(-50%, 50%)'
      };
    case 'left':
      return {
        ...baseStyle,
        left: -9,
        top: '50%',
        transform: 'translate(-50%, -50%)'
      };
    case 'right':
    default:
      return {
        ...baseStyle,
        right: -9,
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
    isCancelTarget,
    variant,
    width: dataWidth,
    height: dataHeight,
    pluginId,
    designHints,
    onTaskBadgeClick,
    highlighted,
    highlightedInHistory,
    monitoringStatus,
    monitoringVisitOrder,
    monitoringDuration
  } = data;

  const { postMessage } = useBridge();
  const [showCommentModal, setShowCommentModal] = useState(false);
  const stateTypeClass = getStateTypeClass(stateType, stateSubType);
  const stateTypeName = getStateTypeName(stateType);
  const stateTypeIcon = getStateTypeIcon(stateType, pluginId);
  const variantIcon = getVariantIcon(variant);
  const displayTitle = title || label || 'Node';
  const isFinal = stateType === 3;
  const isStart = variant === 'start';
  const isSubflow = stateType === 4;
  const hasSubflowReference = isSubflow && state?.subFlow?.process;
  const hasComment = !!state?._comment;

  // Calculate terminals to render
  const terminals = useMemo(() => {
    if (designHints?.terminals && designHints.terminals.length > 0) {
      // Use plugin-defined terminals if any are defined
      return designHints.terminals.filter(t => t.visible);
    }

    // Fallback to standard terminals (for plugins with no custom terminals)
    const standardTerminals: TerminalConfig[] = [];

    // Add input terminal for all states except start nodes
    if (!isStart) {
      standardTerminals.push({
        id: 'input',
        role: 'input',
        visible: true,
        position: { x: 0, y: 0 }
      });
    }

    // Add output terminal for all states except final nodes
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

  const handleCommentSave = (newComment: string) => {
    if (state?.key) {
      postMessage({
        type: 'domain:updateComment',
        elementType: 'state',
        stateKey: state.key,
        comment: newComment
      });
    }
    setShowCommentModal(false);
  };

  const handleTaskBadgeClick = (lane: 'onEntries' | 'onExits') => {
    if (state?.key && onTaskBadgeClick) {
      onTaskBadgeClick(state.key, lane);
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

  // Build class name with plugin-specific styling
  const pluginClass = pluginId ? `state-node--plugin-${pluginId.toLowerCase()}` : '';

  const isMonitoring = monitoringStatus !== undefined;
  const monitoringClass = isMonitoring ? `state-node--monitor-${monitoringStatus}` : '';

  const classNames = [
    'react-flow__node-default',
    'state-node',
    stateTypeClass,
    pluginClass,
    selected ? 'selected' : '',
    highlighted ? 'state-node--highlighted' : '',
    highlightedInHistory ? 'state-node--history' : '',
    isCancelTarget ? 'state-node--cancel-target' : '',
    monitoringClass
  ].filter(Boolean).join(' ');

  // Render terminal labels for plugin nodes (currently disabled to keep nodes clean)
  const renderTerminalLabel = (_terminal: TerminalConfig) => {
    // Terminal labels are disabled for now to avoid clutter
    // They can be shown on hover or in property panel instead
    return null;
  };

  return (
    <div className={classNames} data-variant={variant} data-plugin-id={pluginId} style={{ width: `${calculatedWidth}px`, height: `${calculatedHeight}px`, ...externalStyle }}>
      {/* Resizable card per RF v12 UI */}
      <NodeResizer isVisible={selected} minWidth={180} minHeight={80} handleStyle={{ borderRadius: 4 }} />

      {/* Monitoring badges (Zeebe Operate style) */}
      {isMonitoring && monitoringStatus !== 'unvisited' && (
        <>
          {/* Status badge - top left */}
          <div className={`monitoring-badge monitoring-badge--status monitoring-badge--${monitoringStatus}`} title={monitoringStatus}>
            {getMonitoringIcon(monitoringStatus!)}
          </div>
          {/* Visit order badge - top right */}
          {monitoringVisitOrder !== undefined && (
            <div className="monitoring-badge monitoring-badge--order" title={`Visit order: #${monitoringVisitOrder}`}>
              {monitoringVisitOrder}
            </div>
          )}
          {/* Duration badge - bottom center */}
          {monitoringDuration !== undefined && monitoringDuration > 0 && (
            <div className="monitoring-badge monitoring-badge--duration" title={`Duration: ${formatDuration(monitoringDuration)}`}>
              {formatDuration(monitoringDuration)}
            </div>
          )}
        </>
      )}

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

          const _isTarget = terminal.role === 'input' || !isSource;

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
          {isCancelTarget && (
            <div className="state-node__badge-icon state-node__badge-icon--cancel" aria-label="Cancel Target" title="Cancel Target">
              ✕
            </div>
          )}
          <div className="state-node__title">
            {state && (
              <CommentIcon
                hasComment={hasComment}
                onClick={() => setShowCommentModal(true)}
              />
            )}
            <span>{displayTitle}</span>
          </div>
          {state && (
            <div className="state-node__meta">
              <span className="state-node__key">{state.key}</span>
            </div>
          )}
          {hasSubflowReference && state.subFlow && (
            <button
              className="state-node__navigate-btn"
              onClick={handleNavigateToSubflow}
              title={`Open subflow: ${'ref' in state.subFlow.process ? state.subFlow.process.ref : state.subFlow.process.key}`}
              aria-label="Navigate to subflow definition"
            >
              →
            </button>
          )}
        </div>
      </div>

      {/* Task badges shown below the node */}
      {state && (
        <TaskBadges
          state={state}
          onClick={handleTaskBadgeClick}
        />
      )}

      {/* Comment Modal - rendered in portal outside React Flow */}
      {showCommentModal && state && createPortal(
        <CommentModal
          content={state._comment || ''}
          title={`Documentation: ${displayTitle}`}
          isEditing={true}
          onSave={handleCommentSave}
          onClose={() => setShowCommentModal(false)}
        />,
        document.body
      )}
    </div>
  );
}