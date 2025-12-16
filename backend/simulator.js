// backend/simulator.js
// Simulator with locks, wait-for graph and Tarjan SCC for deadlock detection

class Simulator {
  constructor(onEvent) {
    this.emit = onEvent || (() => {});
    this.processes = {}; 
    this.channels = {};
    this.nextPid = 1;
    this.nextCid = 1;
    this.running = true;
  }

  // ---------------- PROCESS ----------------

  createProcess(name, priority = 1) {
    const pid = `P${this.nextPid++}`;
    const p = {
      pid,
      name,
      state: 'ready',
      heldLocks: new Set(),
      waitingFor: null,
      priority
    };
    this.processes[pid] = p;
    this.emit({ type: 'process.created', payload: this._serializeProcess(p) });
    return p;
  }

  killProcess(pid) {
    const p = this.processes[pid];
    if (!p) return false;

    // Release all held locks
    for (const lockFull of Array.from(p.heldLocks)) {
      this.forceReleaseLock(pid, lockFull);
    }

    // Remove from all lock wait queues
    for (const ch of Object.values(this.channels)) {
      for (const lock of Object.values(ch.locks || {})) {
        lock.waiters = lock.waiters.filter(w => w !== pid);
      }
    }

    // Clear waiting references
    p.waitingFor = null;
    p.state = 'terminated';

    delete this.processes[pid];

    this.emit({ type: 'process.killed', payload: { pid } });
    return true;
  }

  // ---------------- CHANNEL ----------------

  createChannel({ type = 'pipe', bufferSize = 5, name } = {}) {
    const cid = `C${this.nextCid++}`;
    const ch = {
      cid,
      type,
      name: name || `${type}-${cid}`,
      buffer: [],
      bufferSize,
      locks: {}
    };
    if (type === 'shared') ch.memory = {};
    this.channels[cid] = ch;

    this.emit({ type: 'channel.created', payload: ch });
    return ch;
  }

  // ---------------- LOCKS ----------------

  acquireLock(pid, channelId, lockName) {
    const ch = this.channels[channelId];
    const p = this.processes[pid];
    if (!ch || !p) return false;

    if (!ch.locks[lockName]) {
      ch.locks[lockName] = { owner: null, waiters: [] };
    }

    const L = ch.locks[lockName];

    if (L.owner === null) {
      L.owner = pid;
      p.heldLocks.add(`${channelId}:${lockName}`);
      this.emit({ type: 'lock.acquired', payload: { pid, channelId, lockName } });
      return true;
    }

    if (!L.waiters.includes(pid)) {
      L.waiters.push(pid);
    }

    p.state = 'blocked';
    p.waitingFor = { type: 'lock', channelId, lockName };

    this.emit({
      type: 'lock.waiting',
      payload: { pid, channelId, lockName, owner: L.owner }
    });

    return false;
  }

  forceReleaseLock(ownerPid, lockFull) {
    let channelId, lockName;

    if (lockFull.includes(':')) {
      [channelId, lockName] = lockFull.split(':');
    }

    const ch = this.channels[channelId];
    const L = ch?.locks?.[lockName];
    if (!L || L.owner !== ownerPid) return false;

    L.owner = null;
    this.processes[ownerPid]?.heldLocks.delete(`${channelId}:${lockName}`);

    if (L.waiters.length > 0) {
      const next = L.waiters.shift();
      L.owner = next;

      const pNext = this.processes[next];
      if (pNext) {
        pNext.heldLocks.add(`${channelId}:${lockName}`);
        pNext.state = 'ready';
        pNext.waitingFor = null;
      }

      this.emit({
        type: 'lock.force_released_and_granted',
        payload: { prevOwner: ownerPid, newOwner: next, channelId, lockName }
      });
    } else {
      this.emit({
        type: 'lock.force_released',
        payload: { prevOwner: ownerPid, channelId, lockName }
      });
    }

    return true;
  }

  // ---------------- MESSAGING ----------------

  sendMessage({ from, to, channelId, payload }) {
    const ch = this.channels[channelId];
    if (!ch) throw new Error('channel not found');

    if (ch.buffer.length >= ch.bufferSize) {
      const p = this.processes[from];
      if (p) {
        p.state = 'blocked';
        p.waitingFor = { type: 'channel', channelId };
      }
      this.emit({ type: 'channel.full', payload: { channelId, from } });
      return;
    }

    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from,
      to,
      payload,
      ts: Date.now()
    };

    ch.buffer.push(msg);
    this.emit({ type: 'message.enqueued', payload: { channelId, message: msg } });
  }

  step() {
    for (const ch of Object.values(this.channels)) {
      if (ch.buffer.length > 0) {
        const msg = ch.buffer.shift();
        this.emit({ type: 'message.delivered', payload: { channelId: ch.cid, message: msg } });

        const dest = this.processes[msg.to];
        if (dest) dest.state = 'running';
      }
    }
    this.detectDeadlocks();
  }

  // ---------------- DEADLOCK ----------------

  buildWaitForGraph() {
    const nodes = Object.keys(this.processes);
    const edges = [];

    for (const p of Object.values(this.processes)) {
      if (!p.waitingFor) continue;

      if (p.waitingFor.type === 'lock') {
        const { channelId, lockName } = p.waitingFor;
        const L = this.channels[channelId]?.locks?.[lockName];
        if (L?.owner) {
          edges.push({
            from: p.pid,
            to: L.owner,
            reason: `waiting on ${channelId}:${lockName}`
          });
        }
      }
    }
    return { nodes, edges };
  }

  detectDeadlocks() {
    const g = this.buildWaitForGraph();
    const adj = {};
    g.nodes.forEach(n => (adj[n] = []));

    g.edges.forEach(e => adj[e.from]?.push(e.to));

    let index = 0;
    const stack = [];
    const indices = {};
    const low = {};
    const onStack = {};
    const cycles = [];

    const dfs = v => {
      indices[v] = low[v] = index++;
      stack.push(v);
      onStack[v] = true;

      adj[v].forEach(w => {
        if (indices[w] === undefined) {
          dfs(w);
          low[v] = Math.min(low[v], low[w]);
        } else if (onStack[w]) {
          low[v] = Math.min(low[v], indices[w]);
        }
      });

      if (low[v] === indices[v]) {
        const comp = [];
        let w;
        do {
          w = stack.pop();
          onStack[w] = false;
          comp.push(w);
        } while (w !== v);

        if (comp.length > 1) cycles.push(comp);
      }
    };

    g.nodes.forEach(n => indices[n] === undefined && dfs(n));

    if (cycles.length) {
      this.emit({
        type: 'deadlock.detected',
        payload: { cycles, ts: Date.now() }
      });
    }
  }

  // ---------------- UTIL ----------------

  getState() {
    const procs = {};
    Object.values(this.processes).forEach(p => {
      procs[p.pid] = this._serializeProcess(p);
    });
    return { processes: procs, channels: this.channels };
  }

  reset() {
    this.processes = {};
    this.channels = {};
    this.nextPid = 1;
    this.nextCid = 1;
    this.emit({ type: 'sim.reset' });
  }

  _serializeProcess(p) {
    return { ...p, heldLocks: Array.from(p.heldLocks) };
  }

  pause() { this.running = false; }
  resume() { this.running = true; }
}

module.exports = Simulator;
