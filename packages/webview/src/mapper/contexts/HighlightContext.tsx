import { createContext, useContext } from 'react';

/**
 * Context for managing highlighting of contributing elements
 * when hovering over target handles
 */
export interface HighlightContextValue {
  highlightedNodes: Set<string>;
  highlightedEdges: Set<string>;
  highlightedSourceHandles: Set<string>; // Format: "nodeId:handleId"
  onTargetHandleHover: (nodeId: string, handleId: string) => void;
  onTargetHandleHoverEnd: () => void;
}

export const HighlightContext = createContext<HighlightContextValue | null>(null);

/**
 * Hook to access highlight context
 */
export function useHighlight() {
  const context = useContext(HighlightContext);
  if (!context) {
    // Return no-op defaults if not within provider
    return {
      highlightedNodes: new Set<string>(),
      highlightedEdges: new Set<string>(),
      highlightedSourceHandles: new Set<string>(),
      onTargetHandleHover: () => {},
      onTargetHandleHoverEnd: () => {}
    };
  }
  return context;
}
