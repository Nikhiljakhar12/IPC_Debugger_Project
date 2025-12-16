import React, { useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function WaitForGraph({ onSelectCycle }) {
  const fgRef = useRef(null);
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [cycles, setCycles] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);

  async function loadGraph() {
    try {
      const res = await fetch('/api/waitfor');
      const j = await res.json();
      if (!j?.ok) return;

      const nodes = j.graph.nodes.map(n => ({ id: n }));
      const links = j.graph.edges.map(e => ({
        source: e.from,
        target: e.to,
        reason: e.reason
      }));

      setGraph({ nodes, links });

      const evRes = await fetch('/api/events');
      const ev = await evRes.json();
      const deadlocks = ev?.rows?.filter(r => r.type === 'deadlock.detected') || [];

      if (deadlocks.length) {
        const latest = JSON.parse(deadlocks[0].payload || '{}');
        setCycles(latest.cycles || []);
      } else {
        setCycles([]);
      }
    } catch (err) {
      console.error('WaitForGraph load error:', err);
    }
  }

  useEffect(() => {
    loadGraph();
    const t = setInterval(loadGraph, 3000);
    return () => clearInterval(t);
  }, []);

  // ---------- NODE RENDER ----------
  const nodePaint = (node, ctx, globalScale) => {
    const fontSize = 12 / globalScale;
    const inCycle = cycles.some(c => c.nodes.includes(node.id));
    const isSelected = selectedNode === node.id;

    ctx.beginPath();
    ctx.arc(node.x, node.y, inCycle ? 8 : 6, 0, 2 * Math.PI);
    ctx.fillStyle = inCycle
      ? '#ef4444'
      : isSelected
      ? '#2563eb'
      : '#374151';
    ctx.fill();

    ctx.font = `${fontSize}px Inter, sans-serif`;
    ctx.fillStyle = '#111827';
    ctx.fillText(node.id, node.x + 10, node.y + 4);
  };

  return (
    <div>
      {/* GRAPH */}
      <div
        className="graph-container"
        style={{ height: 420, marginBottom: 8 }}
      >
        {graph.nodes.length === 0 ? (
          <div
            className="small"
            style={{ textAlign: 'center', marginTop: 180 }}
          >
            No wait-for relationships yet.
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={graph}
            nodeLabel="id"
            linkDirectionalArrowLength={6}
            linkDirectionalArrowRelPos={1}
            linkColor={() => '#9ca3af'}
            linkWidth={1.5}
            nodeCanvasObject={nodePaint}
            onNodeClick={node => setSelectedNode(node.id)}
            enableZoomInteraction
          />
        )}
      </div>

      {/* DEADLOCK PANEL */}
      <div>
        {cycles.length === 0 && (
          <div className="small">No deadlocks detected.</div>
        )}

        {cycles.map((c, i) => (
          <div
            key={i}
            style={{
              border: '1px solid #fecaca',
              borderRadius: 10,
              padding: 10,
              marginTop: 8,
              background: '#fff5f5'
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              🔴 Deadlock Cycle {i + 1}
            </div>

            <div className="small" style={{ marginBottom: 6 }}>
              {c.nodes.join(' → ')}
            </div>

            <div className="small" style={{ marginBottom: 8 }}>
              {c.edges.map(e => e.reason).join(', ')}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn"
                onClick={() =>
                  onSelectCycle?.({ type: 'killLowest', cycle: c })
                }
              >
                Kill lowest-priority
              </button>

              <button
                className="btn"
                onClick={() =>
                  onSelectCycle?.({ type: 'forceRelease', cycle: c })
                }
              >
                Force release lock
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
