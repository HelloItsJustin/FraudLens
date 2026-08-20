"use client";

import { createContext, useContext, useMemo, useState } from "react";

interface NodeSelectionContextValue {
  selectedNodeId?: string;
  selectNode: (nodeId: string) => void;
  clearSelection: () => void;
}

const NodeSelectionContext = createContext<NodeSelectionContextValue | undefined>(undefined);

export function NodeSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const value = useMemo<NodeSelectionContextValue>(() => ({
    selectedNodeId,
    selectNode: setSelectedNodeId,
    clearSelection: () => setSelectedNodeId(undefined),
  }), [selectedNodeId]);
  return <NodeSelectionContext.Provider value={value}>{children}</NodeSelectionContext.Provider>;
}

export function useNodeSelection(): NodeSelectionContextValue {
  const context = useContext(NodeSelectionContext);
  if (!context) throw new Error("useNodeSelection must be used inside NodeSelectionProvider");
  return context;
}
