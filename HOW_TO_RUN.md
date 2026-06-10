# ProCon Dashboard Factory — How to Run

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18 or higher | [nodejs.org](https://nodejs.org) |
| npm | 9 or higher | Comes with Node.js |
| SQL Server | 2016 or higher | Must be reachable from this machine |
| Git | Any | For cloning / pulling updates |

---

## 1. Clone the Repository

```bash
git clone https://github.com/crystalcspl/procondashboard-factory.git
cd procondashboard-factory
```

---

## 2. Install Dependencies

Install backend and frontend packages separately.

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## 3. Configure Environment Variables

Create the file `backend/.env` (if it does not already exist).

```
PORT=5000
DB_SERVER=<your-sql-server-name-or-ip>
DB_NAME=ProConDB
DB_USER=sa
DB_PASSWORD=<your-sa-password>
```

| Key | Description |
|---|---|
| `PORT` | Port the backend API listens on (default `5000` in dev) |
| `DB_SERVER` | SQL Server hostname, IP address, or `host\instance` |
| `DB_NAME` | Database name (default `ProConDB`) |
| `DB_USER` | SQL Server login username |
| `DB_PASSWORD` | SQL Server login password |

> **Note:** `backend/.env` is listed in `.gitignore` and will never be committed.

---

## 4. Run in Development Mode

Development mode runs the backend and frontend as two separate processes.  
The Vite dev server (port **5173**) proxies all `/api` calls to the Express backend (port **5000**).

**Terminal 1 — Backend**
```bash
cd backend
npm run dev
```
Expected output:
```
[nodemon] starting `node src/index.js`
Server running on http://localhost:5000
Connected to MSSQL
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```
Expected output:
```
  VITE v5.x  ready in Xms
  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in the browser.

---

## 5. Run in Production Mode (Single Process)

This builds the React app and serves everything from a single Express server on one port.

```bash
cd backend
npm run prod
```

This command:
1. Runs `vite build` inside `../frontend`
2. Starts Express with `NODE_ENV=production` on port **3000** (as set in `.env`)

Open **http://localhost:3000** in the browser.

---

## Project Structure

```
procondashboard-factory/
├── backend/
│   ├── src/
│   │   ├── index.js              ← Express entry point
│   │   ├── routes/
│   │   │   ├── dashboard.js      ← All dashboard API routes
│   │   │   └── auth.js           ← Login / session routes
│   │   ├── services/
│   │   │   └── efficiencyCalculator.js  ← Efficiency formula engine
│   │   └── db/
│   │       └── connection.js     ← MSSQL connection pool
│   ├── .env                      ← Environment variables (not in git)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   └── Dashboard.jsx     ← Main dashboard UI
    │   └── utils/
    │       └── auth.js           ← Session helpers
    ├── vite.config.js
    └── package.json
```

---

## Available npm Scripts

### Backend (`cd backend`)

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | nodemon src/index.js | Start backend with auto-restart |
| `npm start` | node src/index.js (production) | Start backend once (no restart) |
| `npm run build:win` | cd ..\frontend && npm run build | Build frontend only |
| `npm run prod` | build + start production | Full production start |

### Frontend (`cd frontend`)

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | vite | Start Vite dev server on :5173 |
| `npm run build` | vite build | Build for production into `dist/` |
| `npm run preview` | vite preview | Preview the production build locally |

---

## Common Issues

| Problem | Likely cause | Fix |
|---|---|---|
| `MSSQL connection failed` | Wrong server/credentials in `.env` | Check `DB_SERVER`, `DB_USER`, `DB_PASSWORD` |
| `Cannot find module` | Dependencies not installed | Run `npm install` in `backend/` and `frontend/` |
| Port already in use | Another process on port 5000 or 5173 | Change `PORT` in `.env`, or kill the other process |
| Blank page on `:5173` | Backend not running | Start backend first, then frontend |
| API returns 400 / no data | DB has no data for selected date+shift | Try a different date or verify DB content |
