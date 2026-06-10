import React, { useEffect, useState, useCallback, useContext, createContext } from 'react';
import axios from 'axios';
import {
  ComposedChart, Bar, Line as RLine,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { loadSession, clearSession } from '../utils/auth';

// ── Theme ──────────────────────────────────────────────────────────
const DARK = {
  bg: '#0b0f1a', header: '#111827', headerBorder: 'rgba(255,255,255,0.07)',
  card: '#1a2235', cardBorder: 'rgba(255,255,255,0.07)',
  progressTrack: 'rgba(255,255,255,0.06)',
  teal: '#00d4b8', tealDim: 'rgba(0,212,184,0.12)',
  text: '#f1f5f9', textSub: '#94a3b8', textMuted: '#4b5563',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.12)',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.12)',
  red: '#ef4444', redDim: 'rgba(239,68,68,0.12)',
  blue: '#3b82f6', blueDim: 'rgba(59,130,246,0.12)',
  purple: '#a855f7', purpleDim: 'rgba(168,85,247,0.12)',
  tableTh: '#1e2d45', tableRow: '#1a2235', tableRowAlt: '#1e2a3d',
  tableBorder: 'rgba(255,255,255,0.06)', tableFooter: '#162030',
};
const LIGHT = {
  bg: '#E3EEF9', header: '#1565C0', headerBorder: '#1565C0',
  card: '#ffffff', cardBorder: '#c5d8ef', progressTrack: '#c5d8ef',
  teal: '#1565C0', tealDim: 'rgba(21,101,192,0.1)',
  text: '#1e293b', textSub: '#1976D2', textMuted: '#64B5F6',
  green: '#16a34a', greenDim: 'rgba(22,163,74,0.1)',
  amber: '#d97706', amberDim: 'rgba(217,119,6,0.1)',
  red: '#dc2626', redDim: 'rgba(220,38,38,0.1)',
  blue: '#1565C0', blueDim: 'rgba(21,101,192,0.1)',
  purple: '#7c3aed', purpleDim: 'rgba(124,58,237,0.1)',
  tableTh: '#dbeafe', tableRow: '#ffffff', tableRowAlt: '#f0f7ff',
  tableBorder: '#c5d8ef', tableFooter: '#dbeafe',
};

const ThemeCtx = createContext(DARK);

// ── Helpers ────────────────────────────────────────────────────────
function toApiDate(s) { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}
function fmt(n, decimals = 0) {
  if (n === null || n === undefined) return '—';
  const v = Number(n);
  return isNaN(v) ? '—' : (decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString());
}
function effColor(C, eff) {
  if (eff >= 85) return C.green;
  if (eff >= 70) return C.amber;
  return C.red;
}

// ── Sub-components ─────────────────────────────────────────────────
function Card({ title, icon, badge, style, bodyStyle, headerBg, children }) {
  const C = useContext(ThemeCtx);
  return (
    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.cardBorder}`, overflow: 'hidden', ...style }}>
      <div style={{
        background: headerBg || '#1565C0', borderRadius: '10px 10px 0 0',
        padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {icon && <span style={{ fontSize: 17 }}>{icon}</span>}
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1 }}>{title}</span>
        {badge}
      </div>
      <div style={{ padding: '12px 14px', ...bodyStyle }}>{children}</div>
    </div>
  );
}

function ProgBar({ pct, color }) {
  const C = useContext(ThemeCtx);
  return (
    <div style={{ flex: 1, background: C.progressTrack, borderRadius: 4, height: 6 }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: color, borderRadius: 4 }} />
    </div>
  );
}

function CG({ pct, color, size = 48 }) {
  const C = useContext(ThemeCtx);
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.progressTrack} strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2+4} textAnchor="middle" fontSize={size < 50 ? 9 : 12} fontWeight={700} fill={color}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

function FilterField({ label, children, onDark }) {
  return (
    <div style={{ position: 'relative', marginTop: 8 }}>
      <span style={{
        position: 'absolute', top: -9, left: 10, zIndex: 2, pointerEvents: 'none',
        background: onDark ? '#1565C0' : '#fff', padding: '0 4px',
        fontSize: 10, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap',
        color: onDark ? 'rgba(255,255,255,0.8)' : '#1565C0',
      }}>{label}</span>
      <div style={{
        border: `1.5px solid ${onDark ? 'rgba(255,255,255,0.5)' : '#1565C0'}`,
        borderRadius: 6, display: 'flex', alignItems: 'center',
        background: onDark ? 'rgba(255,255,255,0.12)' : '#fff',
      }}>{children}</div>
    </div>
  );
}

const filterInputStyle = {
  flex: 1, border: 'none', outline: 'none', padding: '7px 10px',
  fontSize: 12, color: '#fff', background: 'transparent', fontFamily: 'inherit',
};
const filterSelectStyle = {
  flex: 1, border: 'none', outline: 'none', padding: '7px 8px',
  fontSize: 12, color: '#fff', background: 'transparent',
  fontFamily: 'inherit', cursor: 'pointer',
};

// ── Main Dashboard ─────────────────────────────────────────────────
export default function Dashboard({ onLogout }) {
  const [theme, setTheme]       = useState(() => localStorage.getItem('procon-theme') || 'light');
  const [dateInput, setDateInput] = useState(todayISO);
  const [shift, setShift]       = useState('001');
  const [shifts, setShifts]     = useState([]);
  const [factoryData, setFactoryData] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [lineWiseHourly, setLineWiseHourly] = useState({ section: 'Sewing', data: [], allHours: [] });
  const [bdNwData, setBdNwData] = useState({ bd: [], nw: [] });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [refreshInfo, setRefreshInfo] = useState(null);
  const [linesPopup, setLinesPopup] = useState(null); // { styleNo, poNo, buyer, lines: [...] }

  const session  = loadSession();
  const masterDB = session?.masterDB || '';
  const transDB  = session?.transDB  || '';
  const C = theme === 'dark' ? DARK : LIGHT;

  const toggleTheme = useCallback(() => {
    setTheme(t => { const n = t === 'dark' ? 'light' : 'dark'; localStorage.setItem('procon-theme', n); return n; });
  }, []);

  useEffect(() => {
    axios.get(`/api/dashboard/shifts?masterDB=${masterDB}`)
      .then(r => {
        setShifts(r.data || []);
        if (r.data?.length > 0 && !r.data.find(s => s.ShiftCode === shift))
          setShift(r.data[0].ShiftCode);
      })
      .catch(() => {});
  }, [masterDB]);

  const fetchData = useCallback(() => {
    if (!dateInput || !shift) return;
    setLoading(true); setError(null);
    const p = new URLSearchParams({ date: toApiDate(dateInput), shift, masterDB, transDB });

    // Critical calls — if these fail, show error
    Promise.all([
      axios.get(`/api/dashboard/efficiency?${p}`),
      axios.get(`/api/dashboard/active-orders?${p}`),
    ])
      .then(([effRes, ordersRes]) => {
        setFactoryData(effRes.data);
        setActiveOrders(ordersRes.data || []);
        const now = new Date();
        setRefreshInfo({
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          user: session?.username || '',
        });
        // Non-critical calls — silently ignore failures
        axios.get(`/api/dashboard/linewise-hourly?${p}`)
          .then(r => setLineWiseHourly(r.data || { section: 'Sewing', data: [], allHours: [] }))
          .catch(() => {});
        axios.get(`/api/dashboard/bd-nw?${p}`)
          .then(r => setBdNwData(r.data || { bd: [], nw: [] }))
          .catch(() => {});
      })
      .catch(err => setError(err.response?.data?.error || err.message || 'Fetch failed'))
      .finally(() => setLoading(false));
  }, [dateInput, shift, masterDB, transDB, session]);

  useEffect(() => { fetchData(); }, [dateInput, shift]);

  const handleLogout = useCallback(() => { clearSession(); if (onLogout) onLogout(); }, [onLogout]);

  // ── Derived values ─────────────────────────────────────────────
  const factory    = factoryData?.factory || {};
  const lines      = factoryData?.lines   || [];
  const shiftElapsed  = factoryData?.shiftElapsed || 0;
  const isSameDate    = factoryData?.metadata?.isSameDate || false;
  const shiftTime     = factory.shiftTime || 480;

  const totalWs       = factory.totalWs    || 0;
  const activeWs      = factory.activeWs   || 0;
  const presentOprs   = factory.presentOprs || 0;
  // If totalWs not tracked in DB, use presentOprs as best available count
  const displayTotalWs = totalWs > 0 ? totalWs : presentOprs;
  const absOprs       = Math.max(0, displayTotalWs - presentOprs);
  const attRate       = displayTotalWs > 0 ? (presentOprs / displayTotalWs) * 100 : 0;

  const currTargetPcs = isSameDate && shiftTime > 0
    ? Math.round((factory.target || 0) * (shiftElapsed / shiftTime))
    : (factory.target || 0);
  const outputPcs     = factory.output || 0;
  const taEff         = currTargetPcs > 0 ? Math.round(outputPcs / currTargetPcs * 100) : 0;
  const targetOutputPerHr = shiftTime > 0 ? (factory.target || 0) / (shiftTime / 60) : 0;
  const actualOutputPerHr = shiftElapsed > 0 ? outputPcs / (shiftElapsed / 60) : 0;
  const targetEff     = factory.targetEff || 0;

  const oeeAvailability = shiftTime > 0
    ? Math.round((isSameDate ? shiftElapsed : shiftTime) / shiftTime * 100)
    : 0;
  const oeePerformance  = (factory.target || 0) > 0
    ? Math.round((factory.output || 0) / factory.target * 100) : 0;
  const chkChecked      = (factory.chkPassed||0)+(factory.chkRw||0)+(factory.chkRj||0);
  const oeeQuality      = chkChecked > 0 ? Math.round((factory.chkPassed||0) / chkChecked * 100) : 100;
  const oeeScore        = Math.round(oeeAvailability * oeePerformance * oeeQuality / 10000);

  const sortedByEff = [...lines].sort((a, b) => b.efficiency - a.efficiency);
  const top5Lines   = sortedByEff.slice(0, 5);
  const bottom5Lines = sortedByEff.slice(-Math.min(5, sortedByEff.length)).reverse();

  const clockedMins = Math.round(shiftElapsed * activeWs);
  const idleTime = factory.idleTime || 0;
  const nwTime   = factory.nwTime   || 0;
  const bdTime   = factory.bdTime   || 0;
  const rwTime   = factory.rwTime   || 0;
  const nptOpr   = factory.nptOpr   || 0;
  const nptLine  = factory.nptLine  || 0;

  // Hourly chart
  const lineTargetMap = {};
  lineWiseHourly.data.forEach(r => { if (!lineTargetMap[r.LineCode]) lineTargetMap[r.LineCode] = r.TargetPerHr || 0; });
  const totalHrTarget = Object.values(lineTargetMap).reduce((s, v) => s + v, 0);
  const hourOutputMap = {};
  lineWiseHourly.data.forEach(r => { hourOutputMap[r.HrNo] = (hourOutputMap[r.HrNo] || 0) + (r.OutputPcs || 0); });
  const hourlyChartData = lineWiseHourly.allHours.map(hr => ({
    name: `Hr ${hr}`, output: hourOutputMap[hr] || 0, target: totalHrTarget,
  }));

  // BD/NW grouped by reason
  const groupByReason = (rows) => {
    const map = {};
    rows.forEach(r => { const k = r.ReasonName || '—'; map[k] = (map[k] || 0) + (Number(r.BDMins) || 0); });
    return Object.entries(map).map(([reason, mins]) => ({ reason, mins })).sort((a, b) => b.mins - a.mins);
  };
  const bdGrouped = groupByReason(bdNwData.bd);
  const nwGrouped = groupByReason(bdNwData.nw);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <ThemeCtx.Provider value={C}>
      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif" }}>

        {/* Header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: '#1565C0', borderBottom: `1px solid ${C.headerBorder}`, padding: '0 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 58, maxWidth: 1600, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff',
              }}>P</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>ProCon</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>Factory Dashboard</div>
              </div>
            </div>
            {session?.companyName && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500, borderLeft: '1px solid rgba(255,255,255,0.25)', paddingLeft: 14, flexShrink: 0 }}>
                {session.companyName}
              </div>
            )}
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FilterField label="DATE" onDark>
                <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
                  style={{ ...filterInputStyle, width: 126 }} />
              </FilterField>
              <FilterField label="SHIFT" onDark>
                <select value={shift} onChange={e => setShift(e.target.value)}
                  style={{ ...filterSelectStyle, minWidth: 100 }}>
                  {shifts.map(s => (
                    <option key={s.ShiftCode} value={s.ShiftCode} style={{ background: '#1565C0' }}>{s.ShiftName}</option>
                  ))}
                </select>
              </FilterField>
              <button onClick={fetchData} disabled={loading}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                {loading ? '⟳' : '↻'} Refresh
              </button>
              <button onClick={toggleTheme}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>
                {theme === 'dark' ? '☀' : '🌙'}
              </button>
              <button onClick={handleLogout}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Logout
              </button>
            </div>
          </div>
          {refreshInfo && (
            <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.6)', paddingBottom: 4 }}>
              Last refresh: {refreshInfo.time} · {refreshInfo.user}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ maxWidth: 1600, margin: '0 auto', padding: '18px 20px' }}>
          {/* Show error only when no data has been loaded */}
          {error && !factoryData && (
            <div style={{ background: C.redDim, border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: C.red, fontSize: 13 }}>
              {error}
            </div>
          )}
          {loading && !factoryData && (
            <div style={{ textAlign: 'center', padding: 60, color: C.textSub, fontSize: 14 }}>Loading factory data…</div>
          )}

          {factoryData && (!factoryData.lines || factoryData.lines.length === 0) && (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              background: C.card, borderRadius: 10, border: `1px solid ${C.cardBorder}`,
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>No production data</div>
              <div style={{ color: C.textSub, fontSize: 13 }}>No records found for the selected date and shift. Try a different date or shift.</div>
            </div>
          )}

          {factoryData && factoryData.lines && factoryData.lines.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ── Row 1: Operators | Target vs Actual | Feeding+WIP ── */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>

                {/* Operators card */}
                <Card title="Operators" icon="👷" style={{ flex: 1, minWidth: 0 }}>
                  {(() => {
                    const r = 26, circ = 2 * Math.PI * r;
                    const dashOff = circ * (1 - Math.min(100, attRate) / 100);
                    return (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                          <div style={{ background: C.tealDim, borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1, marginBottom: 4 }}>TOTAL WS</div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: C.teal, lineHeight: 1 }}>{fmt(displayTotalWs)}</div>
                          </div>
                          <div style={{ background: C.blueDim, borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1, marginBottom: 4 }}>CLOCKED MINS</div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: C.blue, lineHeight: 1 }}>{fmt(shiftElapsed)}</div>
                          </div>
                          <div style={{ background: C.tealDim, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1, marginBottom: 4 }}>ATT RATE</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: effColor(C, attRate), lineHeight: 1 }}>{fmt(attRate, 1)}%</div>
                            </div>
                            <svg width={60} height={60} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                              <circle cx={30} cy={30} r={r} fill="none" stroke={C.progressTrack} strokeWidth={4} />
                              <circle cx={30} cy={30} r={r} fill="none" stroke={effColor(C, attRate)} strokeWidth={4}
                                strokeDasharray={circ} strokeDashoffset={dashOff}
                                strokeLinecap="round" transform="rotate(-90 30 30)" />
                            </svg>
                          </div>
                          <div style={{ background: C.purpleDim, borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1, marginBottom: 4 }}>MAN DAYS</div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: C.purple, lineHeight: 1 }}>{fmt(factory.manDays, 1)}</div>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                          {[
                            { label: 'Active WS',  value: fmt(activeWs || displayTotalWs), color: C.teal },
                            { label: 'Present',    value: fmt(presentOprs),                color: C.green },
                            { label: 'Absent',     value: fmt(absOprs),                   color: C.red },
                          ].map(({ label, value, color }) => (
                            <div key={label} style={{ background: C.tealDim, borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: C.textSub, letterSpacing: 0.8, marginBottom: 3 }}>{label}</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </Card>

                {/* Target vs Actual card */}
                <Card title={`Curr Target vs Actuals: ${fmt(currTargetPcs)} vs ${fmt(outputPcs)} = ${taEff}%`}
                  icon="🎯" style={{ flex: 2, minWidth: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['', 'Target', 'Actual', 'vs Target'].map((h, i) => (
                          <th key={h} style={{
                            fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 0.5,
                            padding: '0 8px 10px', textAlign: i === 0 ? 'left' : i === 3 ? 'center' : 'right',
                            borderBottom: `2px solid ${C.cardBorder}`,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          label: 'Pcs',
                          target: fmt(currTargetPcs),
                          actual: fmt(outputPcs),
                          pct: currTargetPcs > 0 ? outputPcs / currTargetPcs * 100 : 0,
                          color: effColor(C, currTargetPcs > 0 ? outputPcs / currTargetPcs * 100 : 0),
                        },
                        {
                          label: 'Output/hr',
                          target: fmt(targetOutputPerHr, 1),
                          actual: fmt(actualOutputPerHr, 1),
                          pct: targetOutputPerHr > 0 ? actualOutputPerHr / targetOutputPerHr * 100 : 0,
                          color: effColor(C, targetOutputPerHr > 0 ? actualOutputPerHr / targetOutputPerHr * 100 : 0),
                        },
                        {
                          label: 'Eff%',
                          target: fmt(targetEff) + '%',
                          actual: fmt(factory.efficiency) + '%',
                          pct: targetEff > 0 ? (factory.efficiency || 0) / targetEff * 100 : 0,
                          color: effColor(C, factory.efficiency || 0),
                        },
                      ].map(({ label, target, actual, pct, color }) => (
                        <tr key={label} style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                          <td style={{ padding: '10px 8px 10px 0', fontSize: 12, fontWeight: 600, color: C.textSub, whiteSpace: 'nowrap' }}>{label}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: C.textSub, whiteSpace: 'nowrap' }}>{target}</td>
                          <td style={{ padding: '10px 8px', minWidth: 140 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <ProgBar pct={pct} color={color} />
                              <span style={{ fontSize: 13, fontWeight: 700, color, whiteSpace: 'nowrap', minWidth: 44, textAlign: 'right' }}>{actual}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <CG pct={pct} color={color} size={48} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>

                {/* Feeding + WIP card */}
                <Card title="Feeding — WIP" icon="🔄" style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { label: 'Feeding', value: fmt(factory.feeding), bg: C.greenDim, color: C.green },
                      { label: 'WIP',     value: fmt(factory.wip),     bg: C.amberDim, color: C.amber },
                    ].map(({ label, value, bg, color }) => (
                      <div key={label} style={{
                        flex: 1, background: bg, borderRadius: 10, padding: '16px 14px',
                        border: `1px solid ${color}22`, textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1, marginBottom: 8 }}>{label}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 10, color: C.textSub, marginTop: 6 }}>pcs</div>
                      </div>
                    ))}
                  </div>
                </Card>

              </div>

              {/* ── Row 2: Active Production Orders — style-level ── */}
              <Card title="Active Production Orders" icon="📋"
                badge={<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{activeOrders.length} styles</span>}
                bodyStyle={{ padding: 0 }}>
                <div style={{ overflowY: 'auto', maxHeight: 320 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: C.tableTh }}>
                        {[
                          { h: 'Lines', align: 'center' },
                          { h: 'Buyer', align: 'left' },
                          { h: 'Style No', align: 'left' },
                          { h: 'P.O. No', align: 'left' },
                          { h: 'P.O. Date', align: 'right' },
                          { h: 'Ex-Factory Date', align: 'right' },
                          { h: 'Order Qty', align: 'right' },
                          { h: 'Prodn Pcs', align: 'right' },
                        ].map(({ h, align }) => (
                          <th key={h} style={{
                            padding: '8px 10px', textAlign: align,
                            fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 0.8,
                            borderBottom: `1px solid ${C.tableBorder}`,
                            position: 'sticky', top: 0, background: C.tableTh, zIndex: 1,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeOrders.length === 0 ? (
                        <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: C.textMuted }}>No active orders</td></tr>
                      ) : activeOrders.map((o, i) => (
                        <tr key={`${o.styleCode}_${o.poSlNo}`}
                          style={{ background: i % 2 === 0 ? C.tableRow : C.tableRowAlt, borderBottom: `1px solid ${C.tableBorder}` }}>
                          {/* Lines button */}
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            <button
                              onClick={() => setLinesPopup(o)}
                              style={{
                                background: '#1565C0', color: '#fff', border: 'none',
                                borderRadius: 5, padding: '3px 10px', fontSize: 11,
                                fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                              }}
                            >{o.lines.length} Line{o.lines.length !== 1 ? 's' : ''}</button>
                          </td>
                          <td style={{ padding: '6px 10px', color: C.textSub }}>{o.buyer || '—'}</td>
                          <td style={{ padding: '6px 10px', color: C.text, fontWeight: 600 }}>{o.styleNo || '—'}</td>
                          <td style={{ padding: '6px 10px', color: C.textSub }}>{o.poNo || '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: C.textSub }}>{o.poDate || '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: o.exFactoryDate ? C.amber : C.textMuted, fontWeight: o.exFactoryDate ? 600 : 400 }}>{o.exFactoryDate || '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: C.text }}>{o.orderQty ? fmt(o.orderQty) : '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: C.green, fontWeight: 600 }}>{o.prodnPcs ? fmt(o.prodnPcs) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* ── Row 3: Hourly Production + OEE ── */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                <Card title={`Hourly Production — ${lineWiseHourly.section}`} icon="📊"
                  badge={<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>Factory Total</span>}
                  style={{ flex: 2, minWidth: 0 }}>
                  {hourlyChartData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 30, color: C.textSub, fontSize: 13 }}>No hourly data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={hourlyChartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.cardBorder} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textSub }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: C.textSub }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.text, fontWeight: 600 }} />
                        <ReferenceLine y={totalHrTarget} stroke={C.amber} strokeDasharray="4 4" label={{ value: 'Target', fill: C.amber, fontSize: 10 }} />
                        <Bar dataKey="output" name="Output" radius={[3, 3, 0, 0]}>
                          {hourlyChartData.map((d, i) => (
                            <Cell key={i} fill={d.output >= d.target ? C.green : C.red} />
                          ))}
                        </Bar>
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card title="OEE" icon="⚙️" style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                    {(() => {
                      const R = 50, SIZE = 120, circ = 2 * Math.PI * R;
                      const off = circ * (1 - Math.min(100, oeeScore) / 100);
                      const col = effColor(C, oeeScore);
                      return (
                        <svg width={SIZE} height={SIZE}>
                          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={C.progressTrack} strokeWidth={8} />
                          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={col} strokeWidth={8}
                            strokeDasharray={circ} strokeDashoffset={off}
                            strokeLinecap="round" transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`} />
                          <text x={SIZE/2} y={SIZE/2-6} textAnchor="middle" fontSize={22} fontWeight={800} fill={col}>{oeeScore}</text>
                          <text x={SIZE/2} y={SIZE/2+14} textAnchor="middle" fontSize={12} fill={C.textSub}>OEE%</text>
                        </svg>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Availability', value: oeeAvailability, color: C.blue },
                      { label: 'Performance',  value: oeePerformance,  color: C.green },
                      { label: 'Quality',      value: oeeQuality,      color: C.purple },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: C.tealDim, borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: C.textSub }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}%</span>
                        </div>
                        <ProgBar pct={value} color={color} />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* ── Row 4: Top 5 Lines + Needs Improvement (colored headers) ── */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                {[
                  { title: 'Top 5 Lines', icon: '👍', rows: top5Lines, accent: '#16a34a', rankBg: '#dcfce7', rankColor: '#15803d' },
                  { title: 'Needs Improvement', icon: '👎', rows: bottom5Lines, accent: '#dc2626', rankBg: '#fee2e2', rankColor: '#991b1b' },
                ].map(({ title, icon, rows, accent, rankBg, rankColor }) => (
                  <div key={title} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ background: accent, borderRadius: '10px 10px 0 0', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 17 }}>{icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1 }}>{title}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{rows.length} lines</span>
                    </div>
                    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: C.tableTh }}>
                            {['#', 'Line', 'Eff%', 'Output', 'Target', 'Operators'].map((h, i) => (
                              <th key={h} style={{
                                padding: '7px 10px', fontSize: 10, fontWeight: 700, color: C.textSub,
                                textAlign: i <= 1 ? 'left' : 'right', borderBottom: `1px solid ${C.tableBorder}`,
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: C.textMuted }}>No data</td></tr>
                          ) : rows.map((line, i) => (
                            <tr key={line.lineCode} style={{ background: i % 2 === 0 ? C.tableRow : C.tableRowAlt, borderBottom: `1px solid ${C.tableBorder}` }}>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  width: 22, height: 22, borderRadius: '50%',
                                  background: rankBg, color: rankColor, fontSize: 11, fontWeight: 800,
                                }}>{i + 1}</span>
                              </td>
                              <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600, color: C.text }}>{line.lineName}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: effColor(C, line.efficiency) }}>{fmt(line.efficiency)}%</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: C.text }}>{fmt(line.output)}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: C.textSub }}>{fmt(line.target)}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: C.textSub }}>{fmt(line.operators)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Row 5: Quality Info ── */}
              {(() => {
                const qualRows = [
                  { label: 'EndLine CHK', pass: factory.chkPassed||0, rw: factory.chkRw||0, rj: factory.chkRj||0 },
                  { label: 'AQL',         pass: factory.aqlPassed||0, rw: factory.aqlRw||0, rj: factory.aqlRj||0 },
                  { label: 'Finishing',   pass: factory.finPassed||0, rw: factory.finRw||0, rj: factory.finRj||0 },
                  { label: 'Packing',     pass: factory.pkgPassed||0, rw: factory.pkgRw||0, rj: factory.pkgRj||0 },
                ];
                if (!qualRows.some(r => r.pass + r.rw + r.rj > 0)) return null;
                return (
                  <Card title="Quality Info" icon="💎">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['', 'Checked', 'Passed', 'RW', 'RJ'].map((h, i) => (
                            <th key={h} style={{ fontSize: 11, fontWeight: 700, color: C.textSub, letterSpacing: 0.5, padding: '0 4px 10px', textAlign: i === 0 ? 'left' : 'center', borderBottom: `2px solid ${C.cardBorder}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {qualRows.map(({ label, pass, rw, rj }, i) => {
                          const checked = Math.round(pass) + Math.round(rw) + Math.round(rj);
                          const fmtPct = (v) => checked > 0 ? `${Math.round(v).toLocaleString()} (${Math.round(v / checked * 100)}%)` : Math.round(v).toLocaleString();
                          return (
                            <tr key={label} style={{ background: i % 2 === 1 ? C.tealDim : 'transparent' }}>
                              <td style={{ fontSize: 12, fontWeight: 600, color: C.text, padding: '9px 4px 9px 0', whiteSpace: 'nowrap' }}>{label}</td>
                              <td style={{ fontSize: 13, fontWeight: 700, color: C.text, textAlign: 'center', padding: '9px 4px' }}>{checked.toLocaleString()}</td>
                              <td style={{ fontSize: 13, fontWeight: 700, color: C.green, textAlign: 'center', padding: '9px 4px' }}>{fmtPct(pass)}</td>
                              <td style={{ fontSize: 13, fontWeight: 700, color: C.amber, textAlign: 'center', padding: '9px 4px' }}>{fmtPct(rw)}</td>
                              <td style={{ fontSize: 13, fontWeight: 700, color: C.red, textAlign: 'center', padding: '9px 4px' }}>{fmtPct(rj)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                );
              })()}

              {/* ── Row 6: DownTime Analysis + Alerts ── */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                <Card title="DownTime Analysis" icon="📉"
                  badge={<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>Lost time breakdown</span>}
                  style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: C.textSub, marginBottom: 10 }}>
                    Clocked Minutes: <b style={{ color: C.text }}>{clockedMins.toLocaleString()}</b>
                    &nbsp;(Shift {fmt(shiftElapsed)} mins × {activeWs} active WS)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Idle Time',   value: idleTime, color: '#3b82f6' },
                      { label: 'NoWork Time', value: nwTime,   color: '#f97316' },
                      { label: 'BD Time',     value: bdTime,   color: '#ef4444' },
                      { label: 'RW Time',     value: rwTime,   color: '#8b5cf6' },
                      { label: 'OPR NPT',     value: nptOpr,   color: '#06b6d4' },
                      { label: 'Line NPT',    value: nptLine,  color: '#22c55e' },
                    ].map(({ label, value, color }) => {
                      const p = clockedMins > 0 ? Math.round(value / clockedMins * 100) : 0;
                      return (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ minWidth: 90, fontSize: 12, fontWeight: 500, color: C.text, flexShrink: 0 }}>{label}</div>
                          <div style={{ flex: 1, background: C.tealDim, borderRadius: 6, height: 22, position: 'relative' }}>
                            <div style={{ width: `${p}%`, minWidth: p > 0 ? 6 : 0, height: '100%', background: color, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: p >= 10 ? 6 : 0, overflow: 'hidden' }}>
                              {p >= 10 && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{p}%</span>}
                            </div>
                            {p > 0 && p < 10 && <span style={{ position: 'absolute', left: `calc(${p}% + 5px)`, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{p}%</span>}
                          </div>
                          <div style={{ width: 50, fontSize: 11, fontWeight: 600, color: C.textSub, textAlign: 'right', flexShrink: 0 }}>{Math.round(value).toLocaleString()}</div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { title: 'Maintenance Alerts', rx: factory.mechAlertReceived||0, att: factory.mechAlertAttended||0, color: '#f97316', icon: '🔔' },
                    { title: 'Supervisor Alerts',  rx: factory.suprAlertReceived||0, att: factory.suprAlertAttended||0, color: '#8b5cf6', icon: '📢' },
                  ].map(({ title, rx, att, color, icon }) => {
                    const pending = Math.max(0, rx - att);
                    return (
                      <Card key={title} title={title} icon={icon} style={{ flex: 1 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
                          {[
                            { label: 'Received', value: rx,      col: color },
                            { label: 'Attended', value: att,     col: rx > 0 ? (att >= rx ? C.green : C.amber) : C.text },
                            { label: 'Pending',  value: pending, col: pending > 0 ? C.red : C.green },
                          ].map(({ label, value, col }) => (
                            <div key={label} style={{ background: C.tealDim, borderRadius: 10, padding: '10px', border: `1px solid ${C.cardBorder}`, textAlign: 'center' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1.1, marginBottom: 6 }}>{label}</div>
                              <div style={{ fontSize: 24, fontWeight: 800, color: col, lineHeight: 1 }}>{Math.round(value)}</div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* ── Row 7: BreakDown + NoWork ── */}
              {(bdGrouped.length > 0 || nwGrouped.length > 0) && (() => {
                const BdNwTable = ({ rows, minsLabel, accentColor }) => {
                  const total = rows.reduce((s, r) => s + r.mins, 0);
                  return (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: C.tealDim }}>
                          {['Reason', minsLabel].map((h, i) => (
                            <th key={h} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: C.textSub, textAlign: i === 0 ? 'left' : 'right', borderBottom: `2px solid ${C.cardBorder}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, ri) => (
                          <tr key={ri} style={{ background: ri % 2 === 1 ? C.tealDim : 'transparent' }}>
                            <td style={{ padding: '6px 10px', fontSize: 12, color: C.text, borderBottom: `1px solid ${C.cardBorder}` }}>{r.reason}</td>
                            <td style={{ padding: '6px 10px', fontSize: 12, fontWeight: 600, color: C.text, textAlign: 'right', borderBottom: `1px solid ${C.cardBorder}` }}>{r.mins.toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: `2px solid ${C.cardBorder}`, background: C.tealDim }}>
                          <td style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, color: C.textSub }}>Total</td>
                          <td style={{ padding: '6px 10px', fontSize: 13, fontWeight: 800, color: accentColor, textAlign: 'right' }}>{total.toFixed(0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  );
                };
                const bdTotal = bdGrouped.reduce((s, r) => s + r.mins, 0);
                const nwTotal = nwGrouped.reduce((s, r) => s + r.mins, 0);
                return (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {bdGrouped.length > 0 && (
                      <Card title="BreakDown" icon="🔧"
                        badge={<span style={{ fontSize: 14, fontWeight: 800, color: '#ffaaaa' }}>{bdTotal.toFixed(0)} Mins</span>}
                        style={{ flex: 1, minWidth: 0 }} bodyStyle={{ padding: 0 }}>
                        <BdNwTable rows={bdGrouped} minsLabel="BD Mins" accentColor={C.teal} />
                      </Card>
                    )}
                    {nwGrouped.length > 0 && (
                      <Card title="NoWork" icon="🕐"
                        badge={<span style={{ fontSize: 14, fontWeight: 800, color: '#fde68a' }}>{nwTotal.toFixed(0)} Mins</span>}
                        style={{ flex: 1, minWidth: 0 }} bodyStyle={{ padding: 0 }}>
                        <BdNwTable rows={nwGrouped} minsLabel="NW Mins" accentColor={C.teal} />
                      </Card>
                    )}
                  </div>
                );
              })()}

            </div>
          )}
        </div>

        {/* ── Lines Popup Modal ── */}
        {linesPopup && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setLinesPopup(null); }}
          >
            <div style={{
              background: C.card, borderRadius: 14, padding: '22px 24px 16px',
              width: 'min(96vw, 500px)', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 48px rgba(0,0,0,0.35)', border: `1px solid ${C.cardBorder}`,
            }}>
              {/* Modal header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.teal }}>{linesPopup.styleNo}</div>
                  <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>
                    {linesPopup.buyer} &nbsp;·&nbsp; {linesPopup.poNo}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {linesPopup.lines.length} line{linesPopup.lines.length !== 1 ? 's' : ''} running this style
                  </div>
                </div>
                <button onClick={() => setLinesPopup(null)}
                  style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.textSub }}>
                  ✕
                </button>
              </div>
              {/* Lines table */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.tableTh }}>
                      {['#', 'Line', 'Running Days'].map((h, i) => (
                        <th key={h} style={{
                          padding: '8px 12px', fontSize: 11, fontWeight: 700, color: C.textSub,
                          textAlign: i === 2 ? 'right' : 'left',
                          borderBottom: `2px solid ${C.tableBorder}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linesPopup.lines.map((l, i) => (
                      <tr key={l.lineCode} style={{ background: i % 2 === 0 ? C.tableRow : C.tableRowAlt, borderBottom: `1px solid ${C.tableBorder}` }}>
                        <td style={{ padding: '9px 12px', color: C.textMuted, fontSize: 12 }}>{i + 1}</td>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: C.text }}>{l.lineName}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: C.teal }}>{l.runningDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </ThemeCtx.Provider>
  );
}
