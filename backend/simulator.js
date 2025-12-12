// simulator.js - a simplified in-memory simulator for IPC types
class Simulator {
  constructor(emit) {
    this.emit = emit; // callback to emit telemetry/events
    this.processes = {};
    this.channels = {};
    this.nextPid = 1;
    this.nextCid = 1;
    this.running = true;
  }

  createProcess(name) {
    const p = { pid: `P${this.nextPid++}`, name, state: 'ready', locks: [] };
    this.processes[p.pid] = p;
    this.emit({ type: 'process.created', payload: p });
    return p;
  }

  createChannel({ type='pipe', bufferSize=10, name }) {
    const ch = { cid: `C${this.nextCid++}`, type, buffer: [], bufferSize, name: name || `${type}-${Date.now()}` };
    if (type === 'shared') ch.memory = {};
    this.channels[ch.cid] = ch;
    this.emit({ type: 'channel.created', payload: ch });
    return ch;
  }

  sendMessage({ from, to, channelId, payload }) {
    const ch = this.channels[channelId];
    if (!ch) return this.emit({ type: 'error', payload: { message: 'channel not found' } });
    // pipe & message queue behave similarly for simulation
    if (ch.type === 'pipe' || ch.type === 'mq') {
      // simulate blocking if buffer full
      if (ch.buffer.length >= ch.bufferSize) {
        this.emit({ type: 'channel.blocked', payload: { channelId }});
        // enqueue a blocked-sender event and attach to wait-for graph
        // simplified: mark process as waiting
        if (this.processes[from]) this.processes[from].state = 'blocked';
      } else {
        const msg = { id: Date.now()+Math.random(), from, to, payload, ts: Date.now() };
        ch.buffer.push(msg);
        this.emit({ type: 'message.enqueued', payload: { channelId: ch.cid, message: msg } });
      }
    }
    // shared memory: write
    if (ch.type === 'shared') {
      // naive write without locks
      ch.memory[payload.key] = payload.value;
      this.emit({ type: 'shm.write', payload: { channelId: ch.cid, key: payload.key, value: payload.value, by: from } });
    }
  }

  step() {
    // process each channel: deliver one message per non-empty buffer
    Object.values(this.channels).forEach(ch => {
      if ((ch.type === 'pipe' || ch.type === 'mq') && ch.buffer.length > 0) {
        const msg = ch.buffer.shift();
        // deliver to 'to' if exists
        this.emit({ type: 'message.delivered', payload: { channelId: ch.cid, message: msg } });
        if (this.processes[msg.to]) this.processes[msg.to].state = 'running';
      }
    });
    // detect deadlocks: naive wait-for cycles
    this.detectDeadlocks();
  }

  detectDeadlocks() {
    // simplified: look for processes that are all blocked and waiting on each other
    const blocked = Object.values(this.processes).filter(p => p.state === 'blocked');
    if (blocked.length >= 2) {
      // For demo: signal deadlock found
      this.emit({ type: 'deadlock.detected', payload: { processes: blocked.map(b => b.pid) } });
    }
  }

  injectDelay({ channelId, ms }){
    this.emit({ type: 'debug.delayInjected', payload: { channelId, ms } });
    // for demo do nothing else
  }

  getState(){
    return { processes: this.processes, channels: this.channels };
  }

  pause(){ this.running = false; this.emit({type:'sim.paused'}); }
  resume(){ this.running = true; this.emit({type:'sim.resumed'}); }
}

module.exports = Simulator;
