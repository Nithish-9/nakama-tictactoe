# TacticX: Authoritative Multiplayer Tic-Tac-Toe

TacticX is a high-performance multiplayer Tic-Tac-Toe game featuring a Go backend running on Nakama and a React frontend utilizing real-time WebSockets, matchmaking, and global leaderboards.

---

## 🌐 Project Deliverables
* **Live Game URL**: [https://nakama-tictactoe-react.vercel.app/](https://nakama-tictactoe-react.vercel.app/)
* **Nakama Server Endpoint**: [https://nakama-tictactoe-vzcv.onrender.com](https://nakama-tictactoe-vzcv.onrender.com)
* **Source Code**: [https://github.com/Nithish-9/nakama-tictactoe](https://github.com/Nithish-9/nakama-tictactoe)

---

## 🏗️ Architecture & Design Decisions

### A. Server-Authoritative Logic
All game logic runs on the server. The client emits only an *intent to move* (OpCode 1), which the Go runtime validates against the active board state and current turn before broadcasting the update. This eliminates any vector for client-side manipulation.

### B. Deterministic Player Assignment
Player marks (X / O) are assigned by **sorting User IDs** at match-join time. This race-condition-free approach ensures mark assignment is fully deterministic and idempotent regardless of which client connects first.

### C. Reconnection via localStorage
Session state, including the match ID and user token, is persisted to `localStorage`. On page reload, the frontend automatically attempts to rejoin the active match using these stored credentials.

### D. Private Room Bypass
Users can skip the public matchmaker by creating a room and sharing its unique Match ID. The invitee enters the ID to join directly, avoiding queue waits and random pairing.

---

## 📡 WebSocket Protocol (OpCode Reference)

| OpCode | Direction | Name | Description |
| :--- | :--- | :--- | :--- |
| **01** | Client → Server | `MOVE` | Player intent to place a mark at a cell index. |
| **02** | Server → Client | `GAME_STATE` | Full board state and current turn broadcast to both players. |
| **05** | Server → Client | `TIMER_TICK` | Synchronized countdown for Timed game mode. |
| **06** | Server → Client | `RECONNECT_NOTICE` | Notifies remaining player of opponent disconnect; starts grace period. |

---

## 🛠️ Setup & Installation (Local)

### Backend (Docker + Nakama)
1. **Install Docker**: Ensure Docker Desktop or Engine is running.
2. **Clone & Navigate**: Clone the repository and `cd backend-go` to the root directory.
3. **Start the Stack**: Run `docker-compose up`.
4. **Access Console**: Navigate to `http://127.0.0.1:7351` (user: `admin` / pass: `password`).

### Frontend (React + Vite)
1. **Navigate**: `cd frontend-react`.
2. **Install**: `npm install`.
3. **Configure**: Set `VITE_NAKAMA_HOST=127.0.0.1` and `VITE_NAKAMA_PORT` in your `.env` file.
4. **Start**: `npm run dev`.

---

## 🚀 Deployment Process

### Frontend — Vercel
* **Framework**: React + Vite.
* **CI/CD**: Auto-deploy on GitHub push.
* **Environment Variables**: `VITE_NAKAMA_HOST` and `VITE_NAKAMA_PORT` are injected via the Vercel dashboard.

### Backend — Render
* **Runtime**: Dockerized Nakama image with Go modules compiled as a `.so` shared library.
* **Go Version**: Go 1.21+.
* **Persistence**: Managed PostgreSQL for leaderboard and account storage.

---

## 🧪 How to Test Multiplayer
1. **Open two browser windows**: Use a normal window and an Incognito window at `nakama-tictactoe-react.vercel.app`.
2. **Authenticate**: Enter a nickname in both windows to create or log in to Nakama accounts.
3. **Find a match**: Select **Classic** mode in both and click *Find Match* simultaneously.
4. **Verify Authority**: Click a cell and observe that it does *not* update locally until the server broadcasts the `GAME_STATE` (OpCode 02).
5. **Check Leaderboard**: Win in one window and verify the Victory overlay appears and the global leaderboard updates in real time.
6. **Test Reconnection**: Refresh one tab mid-game; the app should auto-rejoin using `localStorage` data.

---
*Built with Go · Nakama · React · PostgreSQL*
