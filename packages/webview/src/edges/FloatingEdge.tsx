import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  Position,
  useNodes,
  useEdges
} from '@xyflow/react';

import type { Node as RFNode } from '@xyflow/react';
import { useHighlight } from '../mapper/contexts/HighlightContext';
import { CommentIcon } from '../components/CommentIcon';
import { CommentModal } from '../components/CommentModal';
import { TransitionTaskBadge } from '../components/badges/TransitionTaskBadge';
import { useBridge } from '../hooks/useBridge';

type FloatingEdgeProps = {
  id: string;
  source: string;
  target: string;
  markerEnd?: string;
  style?: React.CSSProperties;
  className?: string;
  selected?: boolean;
  label?: React.ReactNode;
  labelStyle?: React.CSSProperties;
  labelBgStyle?: React.CSSProperties;
  labelBgPadding?: [number, number];
  labelBgBorderRadius?: number;
};

type Point = { x: number; y: number };

const fallbackSizeForNode = (n: RFNode): { width: number; height: number } => {
  // Try to get size from node data first (pre-calculated in adapter)
  if (typeof n.data?.width === 'number' && typeof n.data?.height === 'number') {
    return { width: n.data.width, height: n.data.height };
  }
  // All nodes now use the same rectangular size - natural sizing with minimum
  return { width: 180, height: 80 };
};

const getNodeRect = (node: RFNode) => {
  const pos = (node as any).internals?.positionAbsolute ?? (node as any).positionAbsolute ?? node.position;

  // Prioritize pre-calculated dimensions from data, then measured, then fallback
  let width: number;
  let height: number;

  if (typeof node.data?.width === 'number' && typeof node.data?.height === 'number') {
    width = node.data.width;
    height = node.data.height;
  } else {
    const measuredW = node.measured?.width;
    const measuredH = node.measured?.height;
    const fallback = fallbackSizeForNode(node);
    width = measuredW ?? (node as any).width ?? fallback.width;
    height = measuredH ?? (node as any).height ?? fallback.height;
  }

  return {
    x: pos.x,
    y: pos.y,
    width,
    height,
    center: { x: pos.x + width / 2, y: pos.y + height / 2 }
  };
};

// Line intersection helpers (from React Flow floating edges example logic)
const intersectLineLine = (a: Point, b: Point, c: Point, d: Point): Point | null => {
  const tTop = (d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x);
  const uTop = (c.y - a.y) * (a.x - b.x) - (c.x - a.x) * (a.y - b.y);
  const bottom = (d.y - c.y) * (b.x - a.x) - (d.x - c.x) * (b.y - a.y);

  if (bottom !== 0) {
    const t = tTop / bottom;
    const u = uTop / bottom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    }
  }

  return null;
};

const intersectLineRect = (lineStart: Point, lineEnd: Point, rect: { x: number; y: number; width: number; height: number }): Point => {
  const r = {
    x: rect.x,
    y: rect.y,
    xMax: rect.x + rect.width,
    yMax: rect.y + rect.height
  };

  const intersections = [
    intersectLineLine(lineStart, lineEnd, { x: r.x, y: r.y }, { x: r.xMax, y: r.y }), // top
    intersectLineLine(lineStart, lineEnd, { x: r.xMax, y: r.y }, { x: r.xMax, y: r.yMax }), // right
    intersectLineLine(lineStart, lineEnd, { x: r.xMax, y: r.yMax }, { x: r.x, y: r.yMax }), // bottom
    intersectLineLine(lineStart, lineEnd, { x: r.x, y: r.yMax }, { x: r.x, y: r.y }) // left
  ].filter(Boolean) as Point[];

  if (intersections.length > 0) {
    // Return the closest intersection to the line end
    intersections.sort((p1, p2) => {
      const d1 = Math.hypot(p1.x - lineEnd.x, p1.y - lineEnd.y);
      const d2 = Math.hypot(p2.x - lineEnd.x, p2.y - lineEnd.y);
      return d1 - d2;
    });
    return intersections[0];
  }

  // Fallback to center if no intersection found
  return { x: (rect.x + rect.x + rect.width) / 2, y: (rect.y + rect.y + rect.height) / 2 };
};

// Circle intersection removed - all nodes are now rectangles

const getSideForPoint = (pt: Point, rect: { x: number; y: number; width: number; height: number }): Position => {
  const left = Math.abs(pt.x - rect.x);
  const right = Math.abs(pt.x - (rect.x + rect.width));
  const top = Math.abs(pt.y - rect.y);
  const bottom = Math.abs(pt.y - (rect.y + rect.height));

  const min = Math.min(left, right, top, bottom);
  switch (min) {
    case left:
      return Position.Left;
    case right:
      return Position.Right;
    case top:
      return Position.Top;
    default:
      return Position.Bottom;
  }
};

// getSideForCircle removed - all nodes are now rectangles

export function FloatingEdge(props: FloatingEdgeProps) {
  const { id, source, target, markerEnd, style, className, selected, label, labelStyle, labelBgStyle, labelBgPadding = [10, 8], labelBgBorderRadius = 6 } = props;
  const nodes = useNodes();
  const edges = useEdges();
  const { highlightedEdges } = useHighlight();
  const { postMessage } = useBridge();
  const [showCommentModal, setShowCommentModal] = useState(false);

  const sourceNode = useMemo(() => nodes.find((n) => n.id === source), [nodes, source]);
  const targetNode = useMemo(() => nodes.find((n) => n.id === target), [nodes, target]);

  // Get edge data for comment and tasks
  const edgeData = useMemo(() => edges.find((e) => e.id === id)?.data, [edges, id]);
  const hasComment = !!edgeData?._comment;
  // Tasks can be at top level or inside transition object
  const onExecutionTasks = edgeData?.onExecutionTasks || edgeData?.transition?.onExecutionTasks || [];
  const onTaskBadgeClick = edgeData?.onTaskBadgeClick;

  // Check if this edge is highlighted
  const isHighlighted = highlightedEdges.has(id);

  // Check if there's a reverse edge (bidirectional connection)
  const hasReverseEdge = useMemo(() => {
    return edges.some((edge) => edge.source === target && edge.target === source && edge.id !== id);
  }, [edges, source, target, id]);

  if (!sourceNode || !targetNode) return null;

  const srcRect = getNodeRect(sourceNode);
  const tgtRect = getNodeRect(targetNode);

  // Handle self-connections (loops)
  const isSelfConnection = source === target;

  let sourceX: number, sourceY: number, targetX: number, targetY: number;
  let sourcePosition: Position, targetPosition: Position;
  let curvature = 0.25; // Default curvature for bezier

  // For self-loops, calculate index and total count for dynamic positioning
  let selfLoopOffset = 40; // Default offset
  let selfLoopExitRatio = 0.3; // Default exit point
  let selfLoopEntryRatio = 0.7; // Default entry point

  if (isSelfConnection) {
    // Find all self-loops for this node and get the index of current edge
    const selfLoops = edges.filter(e => e.source === source && e.target === source)
      .sort((a, b) => a.id.localeCompare(b.id)); // Consistent ordering

    const selfLoopIndex = selfLoops.findIndex(e => e.id === id);
    const totalSelfLoops = selfLoops.length;

    // Apply dynamic positioning based on index
    if (totalSelfLoops > 1) {
      // Stack loops with increasing offset (30px between each)
      const baseOffset = 40;
      const offsetIncrement = 30;
      selfLoopOffset = baseOffset + (selfLoopIndex * offsetIncrement);

      // Vary exit and entry points slightly to create visual separation
      // Distribute along the right edge
      const exitSpread = 0.15; // How much to spread the exit points
      const entrySpread = 0.15; // How much to spread the entry points

      // Center the distribution around the default ratios
      const exitOffset = ((selfLoopIndex - (totalSelfLoops - 1) / 2) * exitSpread) / Math.max(1, totalSelfLoops - 1);
      const entryOffset = ((selfLoopIndex - (totalSelfLoops - 1) / 2) * entrySpread) / Math.max(1, totalSelfLoops - 1);

      selfLoopExitRatio = 0.3 + exitOffset;
      selfLoopEntryRatio = 0.7 + entryOffset;
    }

    // Self-loop: exit from right, enter from right (creates a visible loop)
    sourceX = srcRect.x + srcRect.width;
    sourceY = srcRect.y + srcRect.height * selfLoopExitRatio;
    sourcePosition = Position.Right;

    targetX = srcRect.x + srcRect.width;
    targetY = srcRect.y + srcRect.height * selfLoopEntryRatio;
    targetPosition = Position.Right;
  } else {
    // Normal connection between different nodes
    const sourceCenter: Point = srcRect.center;
    const targetCenter: Point = tgtRect.center;

    // Calculate intersection points where the center-to-center line meets the rectangles
    const sourceIntersection = intersectLineRect(targetCenter, sourceCenter, srcRect);
    const targetIntersection = intersectLineRect(sourceCenter, targetCenter, tgtRect);

    // Determine which side of each rectangle we're connecting from/to
    sourcePosition = getSideForPoint(sourceIntersection, srcRect);
    targetPosition = getSideForPoint(targetIntersection, tgtRect);

    sourceX = sourceIntersection.x;
    sourceY = sourceIntersection.y;
    targetX = targetIntersection.x;
    targetY = targetIntersection.y;

    // If there's a bidirectional connection, add curvature to separate the edges
    if (hasReverseEdge) {
      curvature = 0.5; // Increase curvature for bidirectional edges
    }
  }

  // Use smooth step path for self-loops, bezier for normal connections
  let edgePath: string, labelX: number, labelY: number;

  if (isSelfConnection) {
    const [path, _defaultLabelX, _defaultLabelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 20,
      offset: selfLoopOffset // Use dynamic offset based on self-loop index
    });
    edgePath = path;
    // Position label to the right of the loop (at the rightmost point of the loop path)
    // Use measured position relative to the viewport
    const measuredWidth = sourceNode.measured?.width ?? srcRect.width;
    const posAbsolute = (sourceNode as any).internals?.positionAbsolute ?? (sourceNode as any).positionAbsolute ?? { x: srcRect.x, y: srcRect.y };

    // For multiple self-loops, stagger the label positions vertically
    const selfLoops = edges.filter(e => e.source === source && e.target === source)
      .sort((a, b) => a.id.localeCompare(b.id));
    const selfLoopIndex = selfLoops.findIndex(e => e.id === id);
    const totalSelfLoops = selfLoops.length;

    // Position labels at different vertical positions based on index
    const verticalSpacing = 25; // Pixels between labels
    const centerY = posAbsolute.y + srcRect.height / 2;
    const totalHeight = (totalSelfLoops - 1) * verticalSpacing;
    const startY = centerY - totalHeight / 2;

    labelX = posAbsolute.x + measuredWidth + 50 + selfLoopOffset;
    labelY = totalSelfLoops > 1
      ? startY + (selfLoopIndex * verticalSpacing)
      : centerY;
  } else {
    // For bidirectional edges, apply offset to control points
    if (hasReverseEdge) {
      // Calculate perpendicular offset vector
      const dx = targetX - sourceX;
      const dy = targetY - sourceY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Perpendicular vector (rotated 90 degrees)
      const perpX = -dy / distance;
      const perpY = dx / distance;

      // Offset amount (20px to the "right" of the direction)
      const offsetAmount = 20;

      // Calculate control points with offset
      const centerX = (sourceX + targetX) / 2;
      const centerY = (sourceY + targetY) / 2;

      const controlX = centerX + perpX * offsetAmount;
      const controlY = centerY + perpY * offsetAmount;

      // Create curved path using quadratic bezier
      edgePath = `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`;

      // Position label at the curve apex
      labelX = controlX;
      labelY = controlY;
    } else {
      // Normal bezier path
      const [path, defaultLabelX, defaultLabelY] = getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        curvature
      });
      edgePath = path;
      labelX = defaultLabelX;
      labelY = defaultLabelY;
    }
  }

  // Apply highlight styles
  const edgeStyle = isHighlighted
    ? { ...style, stroke: '#10b981', strokeWidth: 4, filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.6))' }
    : style;

  const edgeClassName = isHighlighted
    ? `${className || ''} highlighted`
    : className;

  // For self-loops, use a semi-transparent white background with subtle shadow for better readability
  const finalLabelBgStyle = isSelfConnection
    ? {
        ...labelBgStyle,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(0, 0, 0, 0.05)'
      }
    : labelBgStyle;

  // Apply higher z-index for selected or highlighted edges to ensure their labels appear on top
  const labelZIndex = selected || isHighlighted ? 1000 : 0;

  // Comment handler
  const handleCommentSave = (newComment: string) => {
    // Determine transition type and send appropriate message
    const localMatch = /^t:local:([^:]+):(.+)$/.exec(id);
    const sharedMatch = /^t:shared:([^:]+):/.exec(id);
    const startMatch = /^t:start:(.+)$/.exec(id);

    if (localMatch) {
      postMessage({
        type: 'domain:updateComment',
        elementType: 'transition',
        from: localMatch[1],
        transitionKey: localMatch[2],
        comment: newComment
      });
    } else if (sharedMatch) {
      postMessage({
        type: 'domain:updateComment',
        elementType: 'transition',
        transitionKey: sharedMatch[1],
        comment: newComment
      });
    } else if (startMatch) {
      postMessage({
        type: 'domain:updateComment',
        elementType: 'transition',
        transitionKey: startMatch[1],
        comment: newComment
      });
    }
    setShowCommentModal(false);
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={edgeStyle}
        className={edgeClassName}
        interactionWidth={30}
      />
      <EdgeLabelRenderer>
        {/* Custom edge updater handles at our calculated positions */}
        {(selected || isHighlighted) && (
          <>
            <div
              className="custom-edge-updater custom-edge-updater-source"
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${sourceX}px, ${sourceY}px)`,
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: '2px solid white',
                background: '#2563eb',
                cursor: 'grab',
                pointerEvents: 'all',
                zIndex: 1000,
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
              data-nodeid={source}
              data-handletype="source"
            />
            <div
              className="custom-edge-updater custom-edge-updater-target"
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${targetX}px, ${targetY}px)`,
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: '2px solid white',
                background: '#2563eb',
                cursor: 'grab',
                pointerEvents: 'all',
                zIndex: 1000,
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
              data-nodeid={target}
              data-handletype="target"
            />
          </>
        )}
      </EdgeLabelRenderer>
      {label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              zIndex: labelZIndex
            }}
          >
            {/* Label with comment icon */}
            <div
              style={{
                padding: `${labelBgPadding[1]}px ${labelBgPadding[0]}px`,
                borderRadius: `${labelBgBorderRadius}px`,
                ...finalLabelBgStyle,
                ...labelStyle,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
              className="react-flow__edge-text"
              onClick={(e) => {
                e.stopPropagation();
                // Clicking the label itself (not the icon) does nothing
                // This prevents edge selection/editing when clicking the label background
              }}
            >
              <CommentIcon
                hasComment={hasComment}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCommentModal(true);
                }}
                title={hasComment ? 'View transition documentation' : 'Add transition documentation'}
              />
              <span>{label}</span>
            </div>
            {/* Task badge below label */}
            <TransitionTaskBadge
              tasks={onExecutionTasks}
              onDoubleClick={onTaskBadgeClick}
            />
          </div>
        </EdgeLabelRenderer>
      ) : null}

      {/* Comment Modal - rendered in portal outside React Flow */}
      {showCommentModal && createPortal(
        <CommentModal
          content={edgeData?._comment || ''}
          title={`Transition Documentation: ${label || 'Untitled'}`}
          isEditing={true}
          onSave={handleCommentSave}
          onClose={() => setShowCommentModal(false)}
        />,
        document.body
      )}
    </>
  );
}
