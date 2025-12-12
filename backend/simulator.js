// backend/simulator.js
if (this.processes[from]) {
this.processes[from].state = 'blocked';
this.processes[from].waitingFor = { channelId };
}
this.emit({ type: 'channel.full', payload: { channelId: ch.cid, from } });
return;
}
const msg = { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, from, to, payload, ts: Date.now() };
ch.buffer.push(msg);
this.emit({ type: 'message.enqueued', payload: { channelId: ch.cid, message: msg } });
}


if (ch.type === 'shared') {
// naive write
const { key, value } = payload || {};
ch.memory[key] = { value, by: from, ts: Date.now() };
this.emit({ type: 'shm.write', payload: { channelId: ch.cid, key, value, by: from } });
}
}


step() {
// deliver one message per channel
for (const ch of Object.values(this.channels)) {
if ((ch.type === 'pipe' || ch.type === 'mq') && ch.buffer.length > 0) {
const msg = ch.buffer.shift();
// deliver
const dest = this.processes[msg.to];
this.emit({ type: 'message.delivered', payload: { channelId: ch.cid, message: msg } });
if (dest) {
dest.state = 'running';
}
// if any process was blocked waiting on this channel, unblock one
for (const p of Object.values(this.processes)) {
if (p.state === 'blocked' && p.waitingFor && p.waitingFor.channelId === ch.cid) {
p.state = 'ready';
p.waitingFor = null;
this.emit({ type: 'process.unblocked', payload: { pid: p.pid, channelId: ch.cid } });
break; // only unblock one
}
}
}
}
this.detectDeadlocks();
}


detectDeadlocks() {
// build wait-for graph: p -> q if p waiting for channel held by q
// simplified: if p is blocked waiting for channel with no free slot, consider blocked; if all blocked, signal deadlock
const blocked = Object.values(this.processes).filter(p => p.state === 'blocked');
if (blocked.length > 1) {
// naive cycle detection: if any blocked and none of them can be unblocked, mark deadlock
// (In production you'd build exact wait-for edges using lock owners)
this.emit({ type: 'deadlock.detected', payload: { processes: blocked.map(b => b.pid) } });
}
}


injectDelay({ channelId, ms }) {
this.emit({ type: 'delay.injected', payload: { channelId, ms } });
// not implemented: placeholder for delay simulation
}


getState() {
return { processes: this.processes, channels: this.channels };
}


pause() { this.running = false; this.emit({ type: 'sim.paused' }); }
resume() { this.running = true; this.emit({ type: 'sim.resumed' }); }
}


module.exports = Simulator;
