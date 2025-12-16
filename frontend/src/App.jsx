import React, { useEffect, useState, useRef } from 'react';
import ProcessNode from './components/ProcessNode';
import ChannelPanel from './components/ChannelPanel';
import Timeline from './components/Timeline';
import WaitForGraph from './components/WaitForGraph';

export default function App() {
  const [state, setState] = useState({ processes: {}, channels: {} });
  const [events, setEvents] = useState([]);
  const wsRef = useRef(null);

  // ---------- HELPERS ----------
  const refreshState = async () => {
    const s = await (await fetch('/api/state')).json();
    setState(s);
  };

  // ---------- WEBSOCKET ----------
  useEffect(() => {
    refreshState();

    const ws = new WebSocket(
      (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
    );
    wsRef.current = ws;

    ws.onmessage = (m) => {
      const data = JSON.parse(m.data);
      if (data.kind === 'snapshot') setState(data.state);
      if (data.kind === 'event') {
        setEvents(e => [data.event, ...e].slice(0, 200));
      }
    };

    return () => ws.close();
  }, []);

  // ---------- ACTIONS ----------
  const createProcess = async () => {
    await fetch('/api/process', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'proc-' + Date.now(), priority: 1 })
    });
    refreshState();
  };

  const createChannel = async (type) => {
    await fetch('/api/channel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, bufferSize: 5 })
    });
    refreshState();
  };

  const send = async () => {
    const pids = Object.keys(state.processes);
    const cids = Object.keys(state.channels);
    if (pids.length < 2 || cids.length < 1) {
      alert('Create at least 2 processes and 1 channel');
      return;
    }

    await fetch('/api/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        from: pids[0],
        to: pids[1],
        channelId: cids[0],
        payload: { text: 'hi', key: 'x', value: Math.random() }
      })
    });
    refreshState();
  };

  const step = async () => {
    await fetch('/api/step', { method: 'POST' });
    refreshState();
  };

  const killProcess = async (pid) => {
    if (!window.confirm(`Kill process ${pid}?`)) return;
    await fetch('/api/kill', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pid })
    });
    refreshState();
  };

  // ---------- SAFE RESET (FRONTEND ONLY) ----------
  const resetSim = () => {
    if (!window.confirm('Clear UI state? Backend will continue running.')) return;
    setState({ processes: {}, channels: {} });
    setEvents([]);
  };

  // ---------- DEADLOCK ACTION ----------
  async function onSelectCycle(action) {
    if (action.type === 'killLowest') {
      let lowest = null;
      let lowPri = Infinity;

      for (const pid of action.cycle.nodes) {
        const p = state.processes[pid];
        if (p && p.priority < lowPri) {
          lowPri = p.priority;
          lowest = pid;
        }
      }

      if (lowest) await killProcess(lowest);
    }

    if (action.type === 'forceRelease') {
      const edge = action.cycle.edges.find(e => e.reason?.includes('lock'));
      if (!edge) return alert('No lock edge found');

      const match = edge.reason.match(/(C\d+:[^\s]+)/);
      const lockFullName = match?.[1];

      await fetch('/api/releaseLock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ownerPid: edge.to,
          lockFullName
        })
      });

      refreshState();
    }
  }

  // ---------- UI ----------
  return (
    <div className="app">
      <div className="header">
        <h1>IPC Debugger — Wait-For Graph</h1>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn" onClick={createProcess}>Create Process</button>
          <button className="btn" onClick={() => createChannel('shared')}>SharedMem</button>
          <button className="btn" onClick={() => createChannel('mq')}>MessageQ</button>
          <button className="btn" onClick={send}>Send</button>
          <button className="btn" onClick={step}>Step</button>
          <button className="btn danger" onClick={resetSim}>Reset</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 480px', gap: 16, marginTop: 16 }}>
        {/* LEFT */}
        <div>
          <div className="box">
            <h3>Processes</h3>
            {Object.values(state.processes).length === 0 && (
              <div className="small">No processes yet.</div>
            )}
            {Object.values(state.processes).map(p => (
              <ProcessNode key={p.pid} p={p} onKill={killProcess} />
            ))}
          </div>

          <div className="box" style={{ marginTop: 12 }}>
            <h3>Channels</h3>
            {Object.values(state.channels).map(c => (
              <ChannelPanel key={c.cid} c={c} />
            ))}
          </div>

          <div className="box" style={{ marginTop: 12 }}>
            <h3>Timeline</h3>
            <Timeline events={events.slice(0, 50)} />
          </div>
        </div>

        {/* RIGHT */}
        <div>
          <div className="box">
            <h3>Wait-For Graph</h3>
            <WaitForGraph onSelectCycle={onSelectCycle} />
          </div>

          <div className="box" style={{ marginTop: 12 }}>
            <h3>Event Log</h3>
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {events.map((e, i) => (
                <div key={i} className="log-item">
                  [{new Date(e.time || Date.now()).toLocaleTimeString()}] {e.type}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
