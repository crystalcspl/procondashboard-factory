# ProConDashBoard-Factory — Claude Code Context

## What this project is

Factory-level production dashboard that aggregates across ALL sewing lines.
Copied from `ProConDashBoard-Line` (the per-line dashboard) as a starting point.

**Line dashboard:** one line at a time, filtered by `lineCode`
**Factory dashboard:** all lines for a given date + shift, with per-line breakdown table

---

## Stack

- Backend: Node.js / Express (`backend/src/`)
- Frontend: React / Vite (`frontend/src/`)
- DB: SQL Server (mssql) — same DB as Line dashboard
- Key files:
  - `backend/src/routes/dashboard.js` — all API routes + `fetchProductionData()`
  - `backend/src/services/efficiencyCalculator.js` — EfficiencyCalculator class
  - `frontend/src/pages/Dashboard.jsx` — main UI

---

## Key design decisions (agreed in prior session)

### 1. Production query already supports all lines
`fetchProductionData()` has `AND (@lineCode = '' OR a.LineCode = @lineCode)`.
Pass `lineCode = ''` to get ALL lines. Returns one row per line (GROUP BY LineCode).

### 2. Break minutes — Option A (batch query per line)
`M_ShiftLineBreak` stores breaks per line per shift — different lines can have different break schedules.
For SameDate (live shift), run ONE batch query returning break minutes per line:

```sql
SELECT LineCode,
       ISNULL(SUM(
         CASE WHEN CAST(BreakStartTime AS TIME) <= @CurrentTime
              THEN DATEDIFF(MINUTE, CAST(BreakStartTime AS TIME), CAST(BreakEndTime AS TIME))
              ELSE 0
         END
       ), 0) AS BreakMinsTillNow
FROM M_ShiftLineBreak
WHERE ShiftCode = @shiftCode AND Active = 'Y' AND WeekDayNo = @WeekDay
GROUP BY LineCode
```

Build a map `{ lineCode → breakMinsTillNow }`.
Then for each line: `lineManDayMinutes = minutesSinceShiftStart - breakMap[lineCode]`
Pass each line's own `ManDayMinutes` into `calculator.calculate()`.

For NotSameDate (historical): no problem — `ManDayMinutes = ShiftTime` (same for all lines).

### 3. ClockedMins card — use `shiftElapsed`
Factory header card shows `minutesSinceShiftStart` (= `AvailableMinsWithBreakMins`).
This is the same for all lines (it's just how long the shift has been running).
Variable name: `shiftElapsed` → displayed in the ClockedMins card.

Per-line table shows each line's `ManDayMinutes` (= `minutesSinceShiftStart - lineBreakMins`).

### 4. Efficiency calculation — per line, then aggregate
Run `calculator.calculate()` for EACH line separately (each with its own `ManDayMinutes`).
Factory efficiency = `SUM(earnedMinutes across all lines) / SUM(availableMinutes across all lines) × 100`
NOT an average of per-line percentages — it must be weighted.

### 5. Port
Factory dashboard runs on port `3001` in `backend/.env` so both Line (3000) and Factory (3001) can run simultaneously.

---

## What to build next (in order)

1. **Backend `/efficiency` route** — implement Option A batch breaks, loop over all lines, return:
   - `lines[]` array — per-line efficiency, output, target, operators, manDays, ManDayMinutes
   - `factory{}` — aggregated totals + weighted efficiency
   - `shiftElapsed` — `minutesSinceShiftStart` (global)

2. **Backend `/production` route** — already works with `lineCode=''`, returns all lines

3. **Frontend: Remove Line selector** — keep only Date + Shift in the filter bar

4. **Frontend: Factory header cards** — Efficiency %, Output, Target, ManDays, ClockedMins (shiftElapsed)

5. **Frontend: Lines summary table** — one row per line: Line name, Eff%, Output, Target, Operators, ManDayMins

6. **Change port to 3001** in `backend/.env` and `.env_release`

---

## Efficiency formula (same as Line dashboard)
```
Efficiency % = EarnedMinutes (Nr) / AvailableMinutes (Dr) × 100
```
Config from `M_BundleSettings.LineEffDefaultSettings` — pipe-delimited, parsed by `EfficiencyCalculator.dispEffSettings()`.

## SameDate vs NotSameDate
- **SameDate:** selected date is TODAY AND selected shift is currently active
- **NotSameDate:** historical date OR shift not currently active
- SameDate: `ManDayMinutes = minutesSinceShiftStart - lineBreakMins`
- NotSameDate: `ManDayMinutes = ShiftTime` (from M_Shift)

## Key DB tables
| Table | DB | Purpose |
|---|---|---|
| `T_FactLineProduction` | Trans | Daily line aggregates — main data source |
| `M_LineHd` | Masters | Line master (ShortName, LineIndex, LineType='S') |
| `M_ShiftHd` | Masters | Shift windows for SameDate detection |
| `M_Shift` | Masters | ShiftTime, ShiftOverTime, ManDayMinutes |
| `M_ShiftLineBreak` | Masters | Per-line scheduled breaks |
| `M_BundleSettings` | Masters | LineEffDefaultSettings config string |
