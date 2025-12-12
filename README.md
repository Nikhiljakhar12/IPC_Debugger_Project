# 🚀 IPC Debugger — Inter-Process Communication Visualization & Deadlock Analyzer

A full-stack interactive debugging tool that simulates **Pipes**, **Message Queues**, and **Shared Memory**, while visualizing **wait-for graphs**, **bottlenecks**, and **deadlocks** using a force-directed UI.

Built with:

* **React + Vite** (frontend)
* **Node.js (Express + WebSocket)** backend
* **Interactive simulator** (locks, message flow, Tarjan SCC deadlock detection)

---

## ⭐ Features

### 🔄 IPC Simulation Engine

Simulates:

* Unix-style **Pipes**
* **Message Queues**
* **Shared Memory regions**
* Blocking / unblocking behavior
* Buffer overflows
* Race-condition patterns

---

### 🔍 Real-time Visualization

✔ Live **Wait-For Graph** (Force-Directed)
✔ Process states (Ready, Blocked, Running)
✔ Channel buffer usage
✔ Shared memory writes
✔ Live event timeline

---

### 🛑 Deadlock Detection & Auto-Resolution

* Detects cycles using **Tarjan’s SCC algorithm**
* Highlights deadlocked processes
* Provides fix actions:

  * **Kill lowest-priority process**
  * **Force-release lock**
  * **Step simulation** to inspect behavior frame-by-frame

---

### ⚙ Developer Tools

* WebSocket live updates
* Event logging (SQLite-backed)
* Deterministic step mode
* Load simulation hooks
* Extensible backend (Go/Rust versions possible)

---

## 🏗 Project Structure

```
ipc-debugger/
├─ backend/
│  ├─ server.js
│  ├─ simulator.js
│  ├─ package.json
│  └─ events.sqlite3 (auto-created)
├─ frontend/
│  ├─ index.html
│  ├─ package.json
│  ├─ vite.config.js
│  └─ src/
│     ├─ App.jsx
│     ├─ main.jsx
│     └─ components/
│         ├─ WaitForGraph.jsx
│         ├─ ProcessNode.jsx
│         ├─ ChannelPanel.jsx
│         ├─ Controls.jsx
│         └─ Timeline.jsx
└─ docker-compose.yml
```

---

# 🖥️ UI Overview (Screenshot-free Description)

### 🧩 **Left Panel**

* List of processes
* List of IPC channels
* Message timeline

### 🌐 **Right Panel**

* **Wait-For Graph** with force-directed nodes
* Red-highlighted deadlock cycles
* Buttons to kill processes or force-release locks

### 🔧 **Top Toolbar**

* Create processes
* Create channel types
* Send messages
* Step / pause / resume simulation

---

# ⚡ Installation

### Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/ipc-debugger.git
cd ipc-debugger
```

---

## 🟦 Backend Setup

```bash
cd backend
npm install
npm start
```

Backend runs at:

```
http://localhost:4000
```

---

## 🟩 Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend available at:

```
http://localhost:5173
```

---

# 🐳 Docker Setup

```bash
docker-compose up --build
```

Frontend → `http://localhost:5173`
Backend → `http://localhost:4000`

---

# 🔬 How Deadlock Detection Works

The simulator builds a **wait-for graph**:

```
A → B  (A is waiting for a lock held by B)
B → C
C → A  (cycle detected!)
```

Then it runs **Tarjan’s SCC algorithm**, producing components:

```
[A, B, C]  → Deadlock cycle
```

These nodes are highlighted in red in the UI.

---

# 📡 API Endpoints (Backend)

| Method | Route              | Description                  |
| ------ | ------------------ | ---------------------------- |
| POST   | `/api/process`     | Create a new process         |
| POST   | `/api/channel`     | Create IPC channel           |
| POST   | `/api/send`        | Send message                 |
| POST   | `/api/kill`        | Kill a process               |
| POST   | `/api/releaseLock` | Force-release lock           |
| POST   | `/api/step`        | Step the simulation          |
| GET    | `/api/state`       | Full process & channel state |
| GET    | `/api/events`      | Event history                |
| GET    | `/api/waitfor`     | Wait-for graph snapshot      |

---

# 🧪 Example Simulation Flow

```bash
Create 3 processes
Create shared memory channel C1
P1 acquires lockA
P2 acquires lockB
P1 waits for lockB
P2 waits for lockA  → Deadlock!
```

The UI will show the cycle and provide resolution buttons.

---

# 📦 Build for Production

```bash
cd frontend
npm run build
```

Bundled files will appear in:

```
frontend/dist/
```

These can be served by the backend automatically.

---

# 🛠️ Future Enhancements

* CPU scheduling visualizer
* Gantt chart timeline
* Real-process attachment (ptrace / gdb)
* Deterministic replay debugger
* Import/export simulation scenarios

---

# 🤝 Contributing

Pull requests are welcome!
For major changes, open an issue first so we can discuss improvements.

---

# 📄 License

MIT License — free to use, modify, and distribute.
