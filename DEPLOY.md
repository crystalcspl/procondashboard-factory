# ProCon Dashboard Factory — Publish & Deploy Guide

## Architecture Overview

In production, **everything runs from a single Node.js process**.  
Express serves both the API and the pre-built React static files.

```
Browser  ──►  Express (port 3000)
                ├── /api/*        → dashboard & auth routes
                ├── /health       → health check
                └── /*            → React SPA (frontend/dist/)
```

No separate frontend server is needed in production.

---

## Step 1 — Prepare the Server

### Minimum Requirements

| Item | Requirement |
|---|---|
| OS | Windows Server 2016+ or Windows 10/11 |
| RAM | 2 GB minimum, 4 GB recommended |
| Node.js | v18 or higher |
| Network | Must reach SQL Server on the configured port (default 1433) |
| Firewall | Open the app port (default **3000**) for inbound traffic |

### Install Node.js (if not already installed)

Download and install from **https://nodejs.org** (LTS version).

Verify:
```bash
node -v   # should print v18.x.x or higher
npm -v    # should print 9.x.x or higher
```

---

## Step 2 — Deploy the Application

### Option A — Deploy from Source (Recommended)

**On the server**, clone or copy the repository:

```bash
git clone https://github.com/crystalcspl/procondashboard-factory.git
cd procondashboard-factory
```

Install dependencies:
```bash
cd backend && npm install --production
cd ../frontend && npm install
```

> `--production` skips devDependencies (nodemon etc.) on the server.

---

### Option B — Pull Latest Update (for existing deployment)

```bash
cd procondashboard-factory
git pull origin main
cd backend && npm install --production
```

Then rebuild and restart (see Step 4).

---

## Step 3 — Configure Environment

Create the file **`backend/.env`** on the server:

```
PORT=3000
NODE_ENV=production
DB_SERVER=<sql-server-hostname-or-ip>
DB_NAME=ProConDB
DB_USER=sa
DB_PASSWORD=<password>
```

> Use the file `backend/.env_release` as a reference template — copy it and edit values.

```bash
copy backend\.env_release backend\.env
# then edit backend\.env with the correct server credentials
```

---

## Step 4 — Build & Start

### One-command build + start

```bash
cd backend
npm run prod
```

This will:
1. Build the React frontend (`frontend/dist/` is created)
2. Start Express in production mode on port **3000**

The app is now accessible at **http://\<server-ip\>:3000**

---

## Step 5 — Keep It Running (Process Manager)

Without a process manager the server stops when the terminal closes.  
Use **PM2** to run the app as a persistent background service.

### Install PM2

```bash
npm install -g pm2
```

### Start with PM2

```bash
cd procondashboard-factory/backend
npm run build:win          # build frontend first
pm2 start src/index.js --name procon-dashboard-line-line
```

### Useful PM2 Commands

| Command | Purpose |
|---|---|
| `pm2 list` | Show all running processes |
| `pm2 logs procon-dashboard-line` | View live logs |
| `pm2 restart procon-dashboard-line` | Restart after config change |
| `pm2 stop procon-dashboard-line` | Stop the app |
| `pm2 delete procon-dashboard-line` | Remove from PM2 |

### Auto-start on Windows Reboot

```bash
pm2 startup
pm2 save
```

PM2 will generate a startup script — follow the printed instruction to register it.

---

## Step 6 — Verify Deployment

1. Open **http://\<server-ip\>:3000** in a browser
2. Check the health endpoint: `http://<server-ip>:3000/health` → should return `{"status":"ok"}`
3. Log in and load a line/shift — verify data loads correctly

---

## Updating to a New Version

```bash
# 1. Pull latest code
cd procondashboard-factory
git pull origin main

# 2. Install any new backend packages
cd backend
npm install --production

# 3. Rebuild frontend
npm run build:win

# 4. Restart the process
pm2 restart procon-dashboard-line
```

---

## Environment Variable Reference

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port Express listens on |
| `NODE_ENV` | `production` | Enables static file serving, disables CORS dev mode |
| `DB_SERVER` | — | SQL Server hostname, IP, or `host\instance` |
| `DB_NAME` | `ProConDB` | Database name |
| `DB_USER` | — | SQL Server username |
| `DB_PASSWORD` | — | SQL Server password |

---

## Firewall — Open the App Port (Windows)

To allow external access to port 3000:

```powershell
# Run PowerShell as Administrator
New-NetFirewallRule -DisplayName "ProCon Dashboard" `
  -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

---

## Folder Structure on Server

```
procondashboard-factory/
├── backend/
│   ├── src/          ← API source code
│   ├── .env          ← Production config (never commit this)
│   └── node_modules/
└── frontend/
    ├── dist/         ← Built React app (served by Express)
    └── src/          ← Source (not needed at runtime)
```

> Only `frontend/dist/` is needed at runtime. The `frontend/src/` and `frontend/node_modules/` directories are only required during the build step.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| White page / 404 on `/` | Frontend not built | Run `npm run build:win` in `backend/` |
| `MSSQL connection failed` on start | Wrong `.env` credentials | Edit `backend/.env` and restart |
| App unreachable from other machines | Firewall blocking port 3000 | Add firewall rule (see above) |
| Changes not reflected after update | Old `dist/` still being served | Run `npm run build:win`, then `pm2 restart` |
| Port 3000 already in use | Another process on that port | Change `PORT` in `.env` or stop the other process |
