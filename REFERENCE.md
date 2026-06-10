# ProConDashBoard — Reference Guide

**Stack:** Node.js/Express backend · React/Vite frontend · SQL Server (mssql)

---

## 1. Running Locally

```powershell
# Backend
cd backend
npm install
npm start          # http://localhost:5000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

---

## 2. Deployment to Client Server

### On your machine

1. Edit `backend/.env`:
   ```
   PORT=80
   NODE_ENV=production
   DB_SERVER=192.168.x.x
   DB_DATABASE=your_db_name
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   ```
2. Build frontend: `cd frontend && npm run build`
3. Package for delivery — copy to `ProConDashBoard-Release/`:
   ```
   backend/src/
   backend/package.json
   backend/.env
   frontend/dist/
   ```
4. Zip: `Compress-Archive -Path "ProConDashBoard-Release" -DestinationPath "ProConDashBoard-Release.zip"`

### On client server

```powershell
# Install Node.js (LTS) from nodejs.org, then:
cd C:\Apps\ProConDashBoard\backend
npm install
node src/index.js         # verify: open http://localhost

# Keep running with PM2
npm install -g pm2 pm2-windows-startup
pm2 start src/index.js --name procondashboard
pm2-startup install
pm2 save

# Firewall (if users can't reach it)
netsh advfirewall firewall add rule name="ProConDashboard" dir=in action=allow protocol=TCP localport=80
```

Network access: ask IT to add DNS `procondashboard-factory → server IP`, or add to each PC's `hosts` file.

---

## 3. Key Files

| File | Purpose |
|------|---------|
| `backend/src/routes/dashboard.js` | All API routes — production, efficiency, operators, etc. |
| `backend/src/services/efficiencyCalculator.js` | Efficiency calculation engine (EfficiencyCalculator class) |
| `frontend/src/pages/Dashboard.jsx` | Main dashboard UI |
| `backend/.env` | DB connection settings |

---

## 4. API Endpoints

### `GET /api/dashboard/production`
Returns production data rows for all lines (or one line).

| Param | Default | Notes |
|-------|---------|-------|
| `date` | today (DD/MM/YYYY) | |
| `shift` | `001` | |
| `lineCode` | `''` | empty = all lines |

### `GET /api/dashboard/efficiency`
Returns efficiency calculation result. Uses the same shared production query — **no extra DB hit**.

Additional param: `debug=true` for verbose console output.

**Response:**
```json
{
  "efficiency": 85.5,
  "earnedMinutes": 1250.0,
  "availableMinutes": 1470.0,
  "hoursWorked": 24.5,
  "manDays": 1120.1,
  "shiftDetails": { "ShiftCode": "003", "ShiftTime": 480, ... },
  "flags": { "I_L_SameDate": 1, "I_L_Output_Sewing": 1, ... }
}
```

### `GET /api/dashboard/styledetails`
Returns style/PO details. Reads StyleCodeStg/PoSlNoStg from the cached production query — **no extra DB hit**.

### Other routes
`/lines` · `/shifts` · `/wip` · `/dhu` · `/qc-defects` · `/operators` · `/hourly-production` · `/top-operators`

---

## 5. Shared Production Query (`fetchProductionData`)

`dashboard.js` has a shared `fetchProductionData(conn, masterDB, transDB, date, shift, lineCode)` function:
- Hits `T_FactLineProduction` **once per refresh** — covers all columns needed by `/production` AND `/efficiency`
- 10-second TTL cache (keyed by DB + date + shift + lineCode)
- Pending-promise deduplication (`_pending` map) so parallel calls for the same params share one DB hit
- Columns include: all section/line SAM, OT columns, StyleCodeStg, PoSlNoStg, AvailMinsOT, CurrWorkedHrs, QCCurrWorkedHrs, LineNoOfHrs

---

## 6. Efficiency Calculation

### Config string (from `M_BundleSettings.LineEffDefaultSettings`)
Pipe-delimited codes, e.g. `2,5,1,6,14,,N,24,NNNN`

| Position | Codes | Meaning |
|----------|-------|---------|
| Output stage | 1=SWG, 2=CHK, 3=AQL, 4=FIN, 5=PKG | Which section's output to use |
| SAM type | 4=PcsSAM, 5=StyleSAM, 8=ProdTime | Numerator method |
| — | 1=SWG section | I_L_SewingOpr |
| Opr type | 6=ManDays, 7=AttOprs, 10=NoOfWs | Denominator operator count |
| Time type | 11=ShiftTime, 12=HrsWorked, 13=HrsWorked+LineNPT, 14=HrsWorked+OprNPT | Denominator time base |
| OT time | 15-18 (same as 11-14 for OT branch) | |
| Include OT | Y/N | |
| Off-std | 24=OffStdGross, 25=OffStdNet, etc. | |
| Section flags | NNNN = SWG/CHK/AQL/FIN flags | |

### Formula
```
Efficiency (%) = Earned Minutes (Nr) / Available Minutes (Dr) × 100
```

**Numerator (Nr):**
- PcsSAM: `SUM(Section×PcsSAM)` per selected output stage(s)
- ProdTime: `SUM(Section×ProdTime / 60)`
- StyleSAM: `SUM(Style pieces × cumulative SAM)` — SAM from `M_StyleHd`

**Denominator (Dr):**
- ShiftTime: `ShiftTime × Operators`
- HrsWorked: `CurrWorkedHrs + QCCurrWorkedHrs` (SameDate) or `SectionXXXWorkedMins` (NotSameDate)
- +NPT: adds `SectionXXXNPTimeLine` or `SectionXXXNPTimeOPR` depending on config

---

## 7. SameDate vs NotSameDate Logic

**SameDate (I_L_SameDate = 1):** selected date is today AND the selected shift is currently active.
**NotSameDate (I_L_NotSameDate = 1):** any other combination (historical data or a different shift).

| | SameDate | NotSameDate |
|---|---|---|
| BreakMinsTillNow | From `M_ShiftLineBreak` (elapsed breaks) | 0 |
| AvailableMinsWithBreakMins | Minutes since shift start | ShiftTime |
| Target pcs (frontend) | `(LineTargetPcs / ShiftTime) × AvailableMins` (pro-rated) | `LineTargetPcs` (full) |
| Present operators | `CurrNoOfOprsLoggedIn + CurrNoOfQcOprsLoggedIn` (real-time M_LineDt) | `SectionSWGOprsLoggedIn + SectionCHKOprsLoggedIn + ...` (stored in T_FactLineProduction) |
| CurrWorkedHrs (efficiency) | Uses real-time M_LineDt DateDiff subquery | 0 (M_LineDt is real-time, returns nothing for past dates) |

**Why absent operators were wrong for NotSameDate:**
`M_LineDt` / `M_QcLineDt` are real-time login tables — they hold current-shift logins only. For historical dates, `CurrNoOfOprsLoggedIn` returns 0 even if operators worked that day. The fix is to use the `SectionXXXOprsLoggedIn` columns stored in `T_FactLineProduction` (written by the VB.NET system at shift close).

---

## 8. Database Schema (Key Tables)

| Table | DB | Notes |
|-------|----|-------|
| `T_FactLineProduction` | Trans | Daily line-level aggregates (written at interval/shift close) |
| `M_LineHd` | Masters | Line master — ShortName, LineIndex, LineType |
| `M_ShiftHd` | Masters | Shift time windows (CStartTime, CEndTime) |
| `M_Shift` | Masters | ShiftTime, ShiftOverTime, ManDayMinutes |
| `M_ShiftLineBreak` | Masters | Scheduled break periods per shift/line |
| `M_BundleSettings` | Masters | `LineEffDefaultSettings` pipe-delimited config |
| `M_LineDt` | Masters | Real-time operator logins (SWG) |
| `M_QcLineDt` | Masters | Real-time QC operator logins |
| `M_Hrs` | Masters | Shift hour slots (used for LineNoOfHrs count) |
| `M_StyleHd` | Masters | Style SAM values (SWG_OprSAM, CHK_OprSAM, …) |
| `V_StylePoHd` | Masters | Style + PO details (buyer, order qty, ex-factory) |
| `T_FactStyleProduction` | Trans | Style-level daily production (cumulative pcs) |

---

## 9. Frontend Notes (Dashboard.jsx)

- API calls: `/production` and `/efficiency` are called in parallel (`Promise.all`) on refresh
- `/styledetails`, `/wip`, `/dhu`, `/qc-defects` are non-blocking follow-up calls
- `s` = aggregated production row (summed/avg across multi-row data via `sumRows`/`avgRows` helpers)
- `isSameDate = efficiencyData?.flags?.I_L_SameDate === 1`
- `prsOprs` uses `SectionXXXOprsLoggedIn` for NotSameDate (historical), `CurrNoOfOprsLoggedIn` for SameDate (real-time)
- `fCurrTargetPcs` is pro-rated for SameDate only

---

## 10. Common Issues

| Issue | Fix |
|-------|-----|
| API returns 400 "Production data not found" | Check T_FactLineProduction has rows for that date/shift/line |
| API returns 400 "Efficiency Settings Not Found" | Check `M_BundleSettings.LineEffDefaultSettings` is populated |
| All operators show as absent on historical dates | Fixed — code now uses SectionXXXOprsLoggedIn for NotSameDate |
| Frontend shows 0% efficiency | Check efficiencyData loaded; verify M_BundleSettings config |
| Slow first load | Normal (cold DB connection). Subsequent refreshes use 10s cache |
