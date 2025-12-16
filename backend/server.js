// backend/server.js
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const Simulator = require('./simulator.js');
const sqlite3 = require('sqlite3');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(bodyParser.json());

// ---------- DB ----------
const DB_FILE = path.join(__dirname, 'events.sqlite3');
const db = new sqlite3.Database(DB_FILE);
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS events(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time INTEGER,
      type TEXT,
      payload TEXT
    )
  `);
});

// ---------- SIMULATOR ----------
function broadcastState() {
  const msg = JSON.stringify({
    kind: 'snapshot',
    state: sim.getState()
  });
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

const sim = new Simulator((evt) => {
  db.run(
    'INSERT INTO events(time,type,payload) VALUES(?,?,?)',
    [Date.now(), evt.type, JSON.stringify(evt.payload || {})]
  );

  const msg = JSON.stringify({ kind: 'event', event: evt });
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
});

// ---------- API ----------

// create process
app.post('/api/process', (req, res) => {
  const p = sim.createProcess(
    req.body.name || `proc-${Date.now()}`,
    req.body.priority || 1
  );
  broadcastState();
  res.json({ ok: true, process: p });
});

// create channel
app.post('/api/channel', (req, res) => {
  const ch = sim.createChannel(req.body || {});
  broadcastState();
  res.json({ ok: true, channel: ch });
});

// send message
app.post('/api/send', (req, res) => {
  try {
    sim.sendMessage(req.body);
    broadcastState();
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// step simulation
app.post('/api/step', (req, res) => {
  sim.step();
  broadcastState();
  res.json({ ok: true });
});

// -------- KILL PROCESS (IMPROVED) --------
app.post('/api/kill', (req, res) => {
  const { pid } = req.body;
  if (!pid) {
    return res.status(400).json({ ok: false, error: 'pid required' });
  }

  const ok = sim.killProcess(pid);
  if (!ok) {
    return res.status(404).json({ ok: false, error: 'process not found' });
  }

  db.run(
    'INSERT INTO events(time,type,payload) VALUES(?,?,?)',
    [Date.now(), 'process.killed', JSON.stringify({ pid })]
  );

  broadcastState();
  res.json({ ok: true });
});

// force release lock
app.post('/api/releaseLock', (req, res) => {
  const { ownerPid, lockFullName } = req.body;
  const ok = sim.forceReleaseLock(ownerPid, lockFullName);
  if (!ok) {
    return res.status(400).json({ ok: false, error: 'could not release lock' });
  }
  broadcastState();
  res.json({ ok: true });
});

// wait-for graph
app.get('/api/waitfor', (req, res) => {
  res.json({ ok: true, graph: sim.buildWaitForGraph() });
});

// full state
app.get('/api/state', (req, res) => {
  res.json(sim.getState());
});

// events
app.get('/api/events', (req, res) => {
  db.all(
    'SELECT * FROM events ORDER BY id DESC LIMIT 200',
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ rows });
    }
  );
});

// -------- RESET (OPTIONAL BUT AWESOME) --------
app.post('/api/reset', (req, res) => {
  sim.reset();
  db.run('DELETE FROM events');
  broadcastState();
  res.json({ ok: true });
});

// ---------- STATIC FRONTEND ----------
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use('/', express.static(frontendDist));

// ---------- WEBSOCKET ----------
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ kind: 'snapshot', state: sim.getState() }));

  ws.on('message', (m) => {
    try {
      const msg = JSON.parse(m);
      if (msg.kind === 'control') {
        if (msg.action === 'pause') sim.pause();
        if (msg.action === 'resume') sim.resume();
        if (msg.action === 'step') sim.step();
        broadcastState();
      }
    } catch (_) {}
  });
});

// ---------- START ----------
const PORT = process.env.PORT || 4000;
server.listen(PORT, () =>
  console.log(`IPC Debugger backend listening on ${PORT}`)
);
