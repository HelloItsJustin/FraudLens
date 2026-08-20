"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { DashboardState, GraphEdge, GraphNode } from "@/lib/contracts";
import { useNodeSelection } from "@/components/node-selection-context";

interface Camera { scale: number; tx: number; ty: number; }
interface Offset { x: number; y: number; }
const overview: Camera = { scale: 1, tx: 0, ty: 0 };
const terminalLines = ["Gathering nodes...", "Drawing connections...", "Mapping account relationships..."];

function curveFor(edge: GraphEdge, source: GraphNode, target: GraphNode): string {
  const x1 = source.x * 1000;
  const y1 = source.y * 720;
  const x2 = target.x * 1000;
  const y2 = target.y * 720;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.max(1, Math.hypot(dx, dy));
  const bend = ((edge.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2) ? 1 : -1) * Math.min(28, length * .12);
  return `M ${x1} ${y1} C ${x1 + dx * .32 - (dy / length) * bend} ${y1 + dy * .32 + (dx / length) * bend}, ${x1 + dx * .68 - (dy / length) * bend} ${y1 + dy * .68 + (dx / length) * bend}, ${x2} ${y2}`;
}

function cameraFor(node: GraphNode): Camera {
  const scale = 1.32;
  return { scale, tx: 500 - node.x * 1000 * scale, ty: 365 - node.y * 720 * scale };
}

function transformFor(camera: Camera): string {
  return `translate(${camera.tx} ${camera.ty}) scale(${camera.scale})`;
}

export function EntityGraph({ state, showLabels, replayToken, onInspect }: {
  state?: DashboardState;
  showLabels: boolean;
  replayToken: number;
  onInspect: () => void;
}) {
  const { selectedNodeId, selectNode } = useNodeSelection();
  const graph = state?.graph ?? { nodes: [], edges: [], nodeTransactions: {}, nodeProfiles: {} };
  const nodes = graph.nodes;
  const [terminalStep, setTerminalStep] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [isRevealing, setIsRevealing] = useState(true);
  const [camera, setCamera] = useState<Camera>(overview);
  const [offsets, setOffsets] = useState<Record<string, Offset>>({});
  const drag = useRef<{ x: number; y: number; camera: Camera } | undefined>(undefined);
  const nodeDrag = useRef<{ id: string; x: number; y: number; offset: Offset } | undefined>(undefined);
  const positionedNodes = useMemo(() => nodes.map((node) => {
    const offset = offsets[node.id] ?? { x: 0, y: 0 };
    return { ...node, x: Math.max(.045, Math.min(.955, node.x + offset.x)), y: Math.max(.06, Math.min(.94, node.y + offset.y)) };
  }), [nodes, offsets]);
  const byId = useMemo(() => new Map(positionedNodes.map((node) => [node.id, node])), [positionedNodes]);

  useEffect(() => {
    setTerminalStep(0); setRevealedCount(0); setIsRevealing(true); setCamera(overview);
    const steps = terminalLines.map((_, index) => window.setTimeout(() => setTerminalStep(index + 1), 430 + index * 820));
    const revealStart = window.setTimeout(() => {
      let cursor = 0;
      const interval = window.setInterval(() => {
        cursor += 1;
        setRevealedCount(cursor);
        const focus = nodes[cursor - 1];
        if (focus) setCamera(cameraFor(focus));
        if (cursor >= nodes.length) {
          window.clearInterval(interval);
          window.setTimeout(() => { setCamera(overview); setIsRevealing(false); }, 620);
        }
      }, 210);
    }, 3_000);
    return () => { steps.forEach(window.clearTimeout); window.clearTimeout(revealStart); };
  // Reveal is intentionally once per dashboard entry or explicit replay.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayToken]);

  useEffect(() => {
    if (!isRevealing) setRevealedCount(nodes.length);
  }, [isRevealing, nodes.length]);

  const visibleNodes = positionedNodes.slice(0, revealedCount);
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const selected = positionedNodes.find((node) => node.id === selectedNodeId);
  const related = new Set<string>();
  if (selected) {
    related.add(selected.id);
    graph.edges.forEach((edge) => { if (edge.source === selected.id) related.add(edge.target); if (edge.target === selected.id) related.add(edge.source); });
  }
  const ringNodes = visibleNodes.filter((node) => node.ring);
  const ringBounds = ringNodes.length >= 3 ? {
    minX: Math.min(...ringNodes.map((node) => node.x * 1000)) - 42,
    maxX: Math.max(...ringNodes.map((node) => node.x * 1000)) + 42,
    minY: Math.min(...ringNodes.map((node) => node.y * 720)) - 42,
    maxY: Math.max(...ringNodes.map((node) => node.y * 720)) + 42,
  } : undefined;
  const ringCenter = ringBounds ? { x: (ringBounds.minX + ringBounds.maxX) / 2, y: (ringBounds.minY + ringBounds.maxY) / 2 } : undefined;
  const panStart = (event: React.PointerEvent<SVGSVGElement>) => {
    if (isRevealing) return;
    drag.current = { x: event.clientX, y: event.clientY, camera };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const panMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (isRevealing) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (nodeDrag.current) {
      const active = nodeDrag.current;
      setOffsets((current) => ({ ...current, [active.id]: { x: active.offset.x + (event.clientX - active.x) * (1 / rect.width), y: active.offset.y + (event.clientY - active.y) * (1 / rect.height) } }));
      return;
    }
    if (!drag.current) return;
    setCamera({ ...drag.current.camera, tx: drag.current.camera.tx + (event.clientX - drag.current.x) * (1000 / rect.width), ty: drag.current.camera.ty + (event.clientY - drag.current.y) * (720 / rect.height) });
  };
  const adjustZoom = (change: number) => setCamera((current) => ({ ...current, scale: Math.max(.7, Math.min(2.3, current.scale + change)) }));
  return <div className={`entity-graph ${isRevealing ? "entity-graph--revealing" : ""}`}>
    <AnimatePresence>{isRevealing && <motion.div className="graph-terminal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><span>FRAUDLENS / GRAPH ENGINE</span>{terminalLines.slice(0, terminalStep).map((line) => <motion.p key={line} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}><b>&gt;</b> {line}</motion.p>)}</motion.div>}</AnimatePresence>
    <div className="graph-controls" aria-label="Graph camera controls"><button onClick={() => adjustZoom(.15)} aria-label="Zoom in"><Plus size={15} /></button><button onClick={() => adjustZoom(-.15)} aria-label="Zoom out"><Minus size={15} /></button><button onClick={() => setCamera(overview)} aria-label="Reset graph view"><RotateCcw size={14} /></button></div>
    <svg viewBox="0 0 1000 720" preserveAspectRatio="xMidYMid meet" onPointerDown={panStart} onPointerMove={panMove} onPointerUp={() => { drag.current = undefined; nodeDrag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; nodeDrag.current = undefined; }} onWheel={(event) => { if (!isRevealing) { event.preventDefault(); adjustZoom(event.deltaY < 0 ? .1 : -.1); } }}>
      <defs><filter id="node-glow"><feGaussianBlur stdDeviation="3.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter><filter id="ring-glow"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter><marker id="edge-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" className="edge-arrow" /></marker></defs>
      <motion.g animate={{ transform: transformFor(camera) }} transition={{ duration: .72, ease: [0.16, 1, 0.3, 1] }}>
        <g className="graph-edges">{graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)).map((edge) => { const source = byId.get(edge.source); const target = byId.get(edge.target); if (!source || !target) return null; const isRelated = !selected || edge.source === selected.id || edge.target === selected.id; return <motion.path key={edge.id} d={curveFor(edge, source, target)} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: isRelated ? (edge.suspicious ? 1 : .58) : .1 }} transition={{ duration: .5, ease: [0.16, 1, 0.3, 1] }} markerEnd={edge.suspicious ? "url(#edge-arrow)" : undefined} className={edge.suspicious ? "graph-edge graph-edge--ring" : "graph-edge"} />; })}</g>
        {ringBounds && <motion.ellipse className="ring-boundary ring-boundary--clean" cx={ringCenter?.x} cy={ringCenter?.y} rx={(ringBounds.maxX - ringBounds.minX) / 2} ry={(ringBounds.maxY - ringBounds.minY) / 2} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} filter="url(#ring-glow)" />}
        <g className="graph-nodes">{visibleNodes.map((node) => { const radius = Math.min(13, 5 + node.degree * 1.35); const isSelected = node.id === selectedNodeId; const isRelated = !selected || related.has(node.id); const inspect = () => { selectNode(node.id); onInspect(); }; return <motion.g key={node.id} className={`graph-node-group ${isSelected ? "graph-node-group--selected" : ""}`} role="button" tabIndex={0} aria-label={`Inspect ${node.label}`} onPointerDown={(event) => { if (isRevealing) return; event.stopPropagation(); nodeDrag.current = { id: node.id, x: event.clientX, y: event.clientY, offset: offsets[node.id] ?? { x: 0, y: 0 } }; event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId); }} onClick={(event) => { event.stopPropagation(); inspect(); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inspect(); }} initial={{ opacity: 0, scale: .2 }} animate={{ opacity: isRelated ? 1 : .22, scale: 1 }} transition={{ duration: .42, ease: [0.16, 1, 0.3, 1] }}>{node.ring && <circle className="node-halo" cx={node.x * 1000} cy={node.y * 720} r={radius + 9} />}{isSelected && <motion.circle className="selected-node-halo" cx={node.x * 1000} cy={node.y * 720} r={radius + 14} initial={{ opacity: 0, scale: .65 }} animate={{ opacity: 1, scale: [1, 1.18, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />}<circle className={node.ring ? "graph-node graph-node--ring" : "graph-node"} cx={node.x * 1000} cy={node.y * 720} r={radius} filter={node.ring || isSelected ? "url(#node-glow)" : undefined} /><circle className="graph-node-core" cx={node.x * 1000} cy={node.y * 720} r={Math.max(1.8, radius - 3.2)} />{(showLabels || node.ring || isSelected) && <text className="graph-node-label" x={node.x * 1000} y={node.y * 720 - radius - 10}>{node.label}</text>}</motion.g>; })}</g>
        {ringBounds && ringCenter && <g className="ring-callout"><path d={`M ${ringBounds.maxX + 2} ${ringCenter.y} L ${Math.min(805, ringBounds.maxX + 75)} ${ringCenter.y - 30}`} /><rect x={Math.min(808, ringBounds.maxX + 78)} y={ringCenter.y - 65} width="152" height="54" rx="2" /><text x={Math.min(823, ringBounds.maxX + 92)} y={ringCenter.y - 42}>MULE RING</text><text x={Math.min(823, ringBounds.maxX + 92)} y={ringCenter.y - 25}>DETECTED</text></g>}
      </motion.g>
      {!nodes.length && <text className="graph-empty" x="500" y="365">Listening for account relationships...</text>}
    </svg>
  </div>;
}
