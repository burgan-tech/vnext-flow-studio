import React, { useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  Position,
  useNodes
} from '@xyflow/react';

import type { Node as RFNode } from '@xyflow/react';

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
  const { id, source, target, markerEnd, style, className, label, labelStyle, labelBgStyle, labelBgPadding = [10, 8], labelBgBorderRadius = 6 } = props;
  const nodes = useNodes();

  const sourceNode = useMemo(() => nodes.find((n) => n.id === source), [nodes, source]);
  const targetNode = useMemo(() => nodes.find((n) => n.id === target), [nodes, target]);

  if (!sourceNode || !targetNode) return null;

  const srcRect = getNodeRect(sourceNode);
  const tgtRect = getNodeRect(targetNode);

  // Handle self-connections (loops)
  const isSelfConnection = source === target;

  let sourceX: number, sourceY: number, targetX: number, targetY: number;
  let sourcePosition: Position, targetPosition: Position;

  if (isSelfConnection) {
    // Self-loop: exit from right, enter from bottom (creates a larger visible loop)
    sourceX = srcRect.x + srcRect.width;
    sourceY = srcRect.y + srcRect.height * 0.3; // Exit from upper-right
    sourcePosition = Position.Right;

    targetX = srcRect.x + srcRect.width;
    targetY = srcRect.y + srcRect.height * 0.7; // Enter at lower-right
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
  }

  // Use smooth step path for self-loops, bezier for normal connections
  let edgePath: string, labelX: number, labelY: number;

  if (isSelfConnection) {
    const [path, defaultLabelX, defaultLabelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 20,
      offset: 40 // Push the loop out 40px from the node
    });
    edgePath = path;
    // Position label to the right of the loop (at the rightmost point of the loop path)
    // Use measured position relative to the viewport
    const measuredWidth = sourceNode.measured?.width ?? srcRect.width;
    const posAbsolute = (sourceNode as any).internals?.positionAbsolute ?? (sourceNode as any).positionAbsolute ?? { x: srcRect.x, y: srcRect.y };
    labelX = posAbsolute.x + measuredWidth + 80;
    labelY = posAbsolute.y + srcRect.height / 2;
  } else {
    const [path, defaultLabelX, defaultLabelY] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition
    });
    edgePath = path;
    labelX = defaultLabelX;
    labelY = defaultLabelY;
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} className={className} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              padding: `${labelBgPadding[1]}px ${labelBgPadding[0]}px`,
              borderRadius: `${labelBgBorderRadius}px`,
              ...labelBgStyle,
              ...labelStyle
            }}
            className="react-flow__edge-text"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
