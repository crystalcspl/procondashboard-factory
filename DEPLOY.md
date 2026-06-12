# ProConDashBoard — Factory: Package & Publish Guide

## Architecture Overview

In production, **everything runs from a single Node.js process on port 3001**.  
Express serves both the API and the pre-built React static files.

```
Browser  ──►  http://<server>:3001
                ├── /api/dashboard/*   → factory data routes
                ├── /api/auth/*        → login / session
                ├── /health            → health check
                └── /*                 → React SPA (frontend/dist/)
```

No separate frontend server is needed in production.

---

## Step 1 — Prerequisites (target machine)

| Requirement | Version | Notes |
|---|---|---|
| OS | Windows 10 / 11 / Server 2019+ | |
| Node.js | v18 LTS or v20 LTS | [nodejs.org](https://nodejs.org) |
| SQL Server | Any edition | Network-reachable from server machine |
| RAM | 2 GB minimum | |

Verify Node is installed:
```powershell
node -v    # v18.x.x or higher
npm -v
```

---

## Step 2 — Configure Environment

The production config lives in `backend/.env`.  
A template is provided in `backend/.env_release` — copy and edit it:

```powershell
copy backend\.env_release backend\.env
# then open backend\.env and fill in actual credentials
```

`backend/.env` contents:
```
PORT=3001
NODE_ENV=production
DB_SERVER=<sql-server-hostname-or-ip>\<instance>
DB_NAME=ProConDB
DB_USER=sa
DB_PASSWORD=<password>
```

> **Do not commit `.env` to git** — it contains credentials.

---

## Step 3 — Install Dependencies

Run this on the build machine (or on the target machine after copying files):

```powershell
# Backend
cd backend
npm install --omit=dev

# Frontend (build machine only — not needed at runtime)
cd ..\frontend
npm install
```

---

## Step 4 — Build the Frontend

```powershell
cd frontend
npm run build
```

Output: `frontend\dist\` — this folder is served as static files by Express.

---

## Step 5 — Start in Production

### Option A — Direct node (simplest)

```powershell
cd backend
$env:NODE_ENV = "production"
node src/index.js
```

### Option B — npm script (builds + starts in one step)

```powershell
cd backend
npm run prod
```

Open browser: **http://localhost:3001**

---

## Step 6 — Deploy to Another Machine

Copy these to the target machine (**exclude node_modules**):

```
ProConDashBoard-Factory\
  backend\
    src\
    .env            ← filled in with production DB credentials
    package.json
  frontend\
    dist\           ← pre-built React output (from Step 4)
```

On the target machine:
```powershell
cd backend
npm install --omit=dev
$env:NODE_ENV = "production"
node src/index.js
```

---

## Step 7 — Keep It Running: PM2 (Recommended)

PM2 keeps the app alive after terminal close and auto-restarts on crashes.

### Install PM2
```powershell
npm install -g pm2
npm install -g pm2-windows-startup
```

### Start with PM2
```powershell
cd backend
npm run build:win                      # build frontend first (if not already done)
$env:NODE_ENV = "production"
pm2 start src/index.js --name procon-factory
pm2 save
pm2-startup install                    # auto-start on Windows reboot
```

### PM2 Commands

| Command | Purpose |
|---|---|
| `pm2 list` | Show all running processes |
| `pm2 logs procon-factory` | View live logs |
| `pm2 restart procon-factory` | Restart after config/code change |
| `pm2 stop procon-factory` | Stop the app |
| `pm2 delete procon-factory` | Remove from PM2 |

---

## Step 8 — Open Firewall Port (if remote access needed)

```powershell
# Run PowerShell as Administrator
New-NetFirewallRule -DisplayName "ProCon Factory Dashboard" `
  -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
```

---

## Updating to a New Version

```powershell
# 1. Pull latest code
git pull origin main

# 2. Rebuild frontend
cd frontend
npm install
npm run build

# 3. Restart
cd ..\backend
pm2 restart procon-factory
```

---

## Environment Variable Reference

| Variable | Value | Description |
|---|---|---|
| `PORT` | `3001` | Port Express listens on |
| `NODE_ENV` | `production` | Enables static SPA serving, disables CORS dev headers |
| `DB_SERVER` | hostname or IP\instance | SQL Server address |
| `DB_NAME` | `ProConDB` | Master database name |
| `DB_USER` | `sa` | SQL Server login |
| `DB_PASSWORD` | — | SQL Server password |

---

## Port Reference

| App | Port |
|---|---|
| Factory Dashboard (this app) | **3001** |
| Line Dashboard (ProConDashBoard-Line) | 3000 |
| Vite dev server (dev only) | 5173 |

Both dashboards can run simultaneously on the same machine — they use different ports.

---

## Verify Deployment

1. `http://<server>:3001` — login screen loads
2. `http://<server>:3001/health` → `{"status":"ok"}`
3. Login and select a date/shift — verify data loads

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| White page / 404 on `/` | `frontend\dist` missing — run `npm run build` in `frontend\` |
| `EADDRINUSE 3001` | Run `netstat -ano \| findstr :3001` to find the PID, then `taskkill /PID <pid> /F` |
| DB connection error | Check `backend\.env` credentials; ensure SQL Server TCP/IP is enabled and port 1433 is reachable |
| App unreachable from other PCs | Add Windows firewall rule for port 3001 (Step 8) |
| `Efficiency Settings Not Found` | `M_BundleSettings.LineEffDefaultSettings` is empty — check master DB data |
| Changes not showing after update | Old `dist\` is stale — rebuild frontend and restart pm2 |
