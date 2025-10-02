import React, { useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  useNodes
} from '@xyflow/react';

import type { Node as RFNode } from '@xyflow/react';

type FloatingEdgeProps = {
  id: string;
  source: string;
  target: string;
  markerEnd?: string | React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  selected?: boolean;
  label?: React.ReactNode;
  labelStyle?: React.CSSProperties;
};

type Point = { x: number; y: number };

const fallbackSizeForNode = (n: RFNode): { width: number; height: number } => {
  const isEvent = n.type === 'event' || n.data?.stateType === 1 || n.data?.stateType === 3;
  return isEvent ? { width: 96, height: 96 } : { width: 260, height: 160 };
};

const getNodeRect = (node: RFNode) => {
  const pos = node.internals?.positionAbsolute ?? (node as any).positionAbsolute ?? node.position;
  const measuredW = node.measured?.width;
  const measuredH = node.measured?.height;
  const fallback = fallbackSizeForNode(node);
  const width = measuredW ?? (node as any).width ?? fallback.width;
  const height = measuredH ?? (node as any).height ?? fallback.height;

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

const intersectLineCircle = (lineStart: Point, lineEnd: Point, center: Point, radius: number): Point => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const fx = lineStart.x - center.x;
  const fy = lineStart.y - center.y;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return { x: center.x, y: center.y };
  }

  const disc = Math.sqrt(discriminant);
  const t1 = (-b - disc) / (2 * a);
  const t2 = (-b + disc) / (2 * a);

  const candidates: Point[] = [];
  if (t1 >= 0 && t1 <= 1) candidates.push({ x: lineStart.x + t1 * dx, y: lineStart.y + t1 * dy });
  if (t2 >= 0 && t2 <= 1) candidates.push({ x: lineStart.x + t2 * dx, y: lineStart.y + t2 * dy });

  if (candidates.length === 0) {
    // fall back to projecting onto circle in the line direction
    const lx = lineEnd.x - center.x;
    const ly = lineEnd.y - center.y;
    const len = Math.hypot(lx, ly) || 1;
    return { x: center.x + (lx / len) * radius, y: center.y + (ly / len) * radius };
  }

  // pick intersection closest to the line end
  candidates.sort((p1, p2) => {
    const d1 = Math.hypot(p1.x - lineEnd.x, p1.y - lineEnd.y);
    const d2 = Math.hypot(p2.x - lineEnd.x, p2.y - lineEnd.y);
    return d1 - d2;
  });

  return candidates[0];
};

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

const getSideForCircle = (from: Point, to: Point): Position => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Position.Right : Position.Left;
  }
  return dy > 0 ? Position.Bottom : Position.Top;
};

export function FloatingEdge(props: FloatingEdgeProps) {
  const { id, source, target, markerEnd, style, className, label, labelStyle } = props;
  const nodes = useNodes();

  const sourceNode = useMemo(() => nodes.find((n) => n.id === source), [nodes, source]);
  const targetNode = useMemo(() => nodes.find((n) => n.id === target), [nodes, target]);

  if (!sourceNode || !targetNode) return null;

  const srcRect = getNodeRect(sourceNode);
  const tgtRect = getNodeRect(targetNode);
  // Compute centers based on actual visuals
  const isSrcEventNode = sourceNode.type === 'event';
  const isTgtEventNode = targetNode.type === 'event';

  const sourceCenter: Point = (() => {
    if (isSrcEventNode) {
      // event-node: paddingTop 6px, circle 68px => centerY = y + 6 + 34 = y + 40
      return { x: srcRect.x + srcRect.width / 2, y: srcRect.y + 40 };
    }
    if (sourceNode.data?.stateType === 1 || sourceNode.data?.stateType === 3) {
      // state-node event variant: paddingTop 6px, circle 74px => y + 6 + 37 = y + 43
      return { x: srcRect.x + srcRect.width / 2, y: srcRect.y + 43 };
    }
    return srcRect.center;
  })();

  const targetCenter: Point = (() => {
    if (isTgtEventNode) {
      return { x: tgtRect.x + tgtRect.width / 2, y: tgtRect.y + 40 };
    }
    if (targetNode.data?.stateType === 1 || targetNode.data?.stateType === 3) {
      return { x: tgtRect.x + tgtRect.width / 2, y: tgtRect.y + 43 };
    }
    return tgtRect.center;
  })();

  // Determine shapes
  const isSrcCircle = isSrcEventNode || sourceNode.data?.stateType === 1 || sourceNode.data?.stateType === 3;
  const isTgtCircle = isTgtEventNode || targetNode.data?.stateType === 1 || targetNode.data?.stateType === 3;

  // Insets to approximate the visible state-node__shape border inside the node container
  // Tuned to rf-theme.css: padding-top 6, padding-x 10, gap 8, meta height ~16-18, padding-bottom 12
  const RECT_INSETS = { left: 6, right: 6, top: 6, bottom: 34 } as const;
  const circlePadding = 10; // accounts for event-node padding around the circle

  // Compute intersections
  const srcIntersection = isSrcCircle
    ? (() => {
        const r = Math.max(
          4,
          isSrcEventNode ? 34 : 37 // based on CSS circle sizes
        );
        return intersectLineCircle(targetCenter, sourceCenter, sourceCenter, r);
      })()
    : intersectLineRect(targetCenter, sourceCenter, {
        x: srcRect.x + RECT_INSETS.left,
        y: srcRect.y + RECT_INSETS.top,
        width: Math.max(2, srcRect.width - (RECT_INSETS.left + RECT_INSETS.right)),
        height: Math.max(2, srcRect.height - (RECT_INSETS.top + RECT_INSETS.bottom))
      });

  const tgtIntersection = isTgtCircle
    ? (() => {
        const r = Math.max(
          4,
          isTgtEventNode ? 34 : 37
        );
        return intersectLineCircle(sourceCenter, targetCenter, targetCenter, r);
      })()
    : intersectLineRect(sourceCenter, targetCenter, {
        x: tgtRect.x + RECT_INSETS.left,
        y: tgtRect.y + RECT_INSETS.top,
        width: Math.max(2, tgtRect.width - (RECT_INSETS.left + RECT_INSETS.right)),
        height: Math.max(2, tgtRect.height - (RECT_INSETS.top + RECT_INSETS.bottom))
      });

  const sourcePosition = isSrcCircle
    ? getSideForCircle(sourceCenter, targetCenter)
    : getSideForPoint(srcIntersection, {
        x: srcRect.x + RECT_INSETS.left,
        y: srcRect.y + RECT_INSETS.top,
        width: Math.max(2, srcRect.width - (RECT_INSETS.left + RECT_INSETS.right)),
        height: Math.max(2, srcRect.height - (RECT_INSETS.top + RECT_INSETS.bottom))
      });
  const targetPosition = isTgtCircle
    ? getSideForCircle(targetCenter, sourceCenter)
    : getSideForPoint(tgtIntersection, {
        x: tgtRect.x + RECT_INSETS.left,
        y: tgtRect.y + RECT_INSETS.top,
        width: Math.max(2, tgtRect.width - (RECT_INSETS.left + RECT_INSETS.right)),
        height: Math.max(2, tgtRect.height - (RECT_INSETS.top + RECT_INSETS.bottom))
      });

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: srcIntersection.x,
    sourceY: srcIntersection.y,
    targetX: tgtIntersection.x,
    targetY: tgtIntersection.y,
    sourcePosition,
    targetPosition
  });

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
