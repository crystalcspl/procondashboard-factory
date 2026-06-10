import React, { useEffect, useState, useCallback, useContext, createContext, useMemo } from 'react';
import axios from 'axios';
import { ComposedChart, BarChart, Bar, Cell, Line, LabelList, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { loadSession } from '../utils/auth';

// ── Theme definitions ──────────────────────────────────────────────
const DARK = {
  bg:            '#0b0f1a',
  header:        '#111827',
  headerBorder:  'rgba(255,255,255,0.07)',
  card:          '#1a2235',
  cardBorder:    'rgba(255,255,255,0.07)',
  progressTrack: 'rgba(255,255,255,0.06)',
  teal:          '#00d4b8',
  tealDim:       'rgba(0,212,184,0.12)',
  text:          '#f1f5f9',
  textSub:       '#94a3b8',
  textMuted:     '#4b5563',
  green:         '#22c55e',
  greenDim:      'rgba(34,197,94,0.12)',
  amber:         '#f59e0b',
  amberDim:      'rgba(245,158,11,0.12)',
  red:           '#ef4444',
  redDim:        'rgba(239,68,68,0.12)',
  // sidebar
  sidebarBg:     '#111827',
  sidebarBorder: 'rgba(255,255,255,0.07)',
  sidebarActive: 'rgba(0,212,184,0.1)',
  sidebarText:   '#f1f5f9',
  sidebarSub:    '#94a3b8',
  sidebarMuted:  '#4b5563',
  sidebarTeal:   '#00d4b8',
  toggleBtnText: '#000',
};

const LIGHT = {
  bg:            '#E3EEF9',
  header:        '#E3EEF9',
  headerBorder:  '#c5d8ef',
  card:          '#ffffff',
  cardBorder:    '#c5d8ef',
  progressTrack: '#c5d8ef',
  teal:          '#1565C0',
  tealDim:       'rgba(21,101,192,0.1)',
  text:          '#1565C0',
  textSub:       '#1976D2',
  textMuted:     '#64B5F6',
  green:         '#16a34a',
  greenDim:      'rgba(22,163,74,0.1)',
  amber:         '#d97706',
  amberDim:      'rgba(217,119,6,0.1)',
  red:           '#dc2626',
  redDim:        'rgba(220,38,38,0.1)',
  // sidebar
  sidebarBg:     '#E3EEF9',
  sidebarBorder: '#c5d8ef',
  sidebarActive: 'rgba(21,101,192,0.1)',
  sidebarText:   '#1565C0',
  sidebarSub:    '#1976D2',
  sidebarMuted:  '#64B5F6',
  sidebarTeal:   '#1565C0',
  toggleBtnText: '#fff',
};

const ThemeCtx = createContext(DARK);


// ── Shared components (read C from context) ────────────────────────
function KpiCard({ label, value, unit, sub, icon, dimColor, valueColor }) {
  const C = useContext(ThemeCtx);
  return (
    <div style={{
      background: C.card, borderRadius: 14, padding: '18px 20px',
      border: `1px solid ${C.cardBorder}`, flex: 1, minWidth: 0,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1.2 }}>
          {label}
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: dimColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
        }}>{icon}</div>
      </div>
      <div style={{ fontSize: 34, fontWeight: 700, color: valueColor || C.text, lineHeight: 1, marginBottom: 8 }}>
        {value}
        {unit && <span style={{ fontSize: 16, fontWeight: 400, color: C.textSub, marginLeft: 5 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 12, color: C.textSub }}>{sub}</div>
    </div>
  );
}

function Card({ title, sub, badge, icon, children, style = {}, titleStyle = {} }) {
  const C = useContext(ThemeCtx);
  return (
    <div style={{
      background: C.card, borderRadius: 14,
      border: `1px solid ${C.cardBorder}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      overflow: 'hidden',
      ...style,
    }}>
      {title && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '9px 18px',
          background: '#1565C0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon && <span className="pc-card-icon">{icon}</span>}
            <div>
              <div className="font1" style={{ color: '#fff', ...titleStyle }}>{title}</div>
              {sub && <div className="font2" style={{ color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{sub}</div>}
            </div>
          </div>
          {badge && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{badge}</div>}
        </div>
      )}
      <div style={{ padding: '16px 22px' }}>
        {children}
      </div>
    </div>
  );
}

function StatRow({ label, value, suffix = '', decimals = 0, color }) {
  const C = useContext(ThemeCtx);
  const display = value === null || value === undefined ? '—'
    : (decimals > 0 ? Number(value).toFixed(decimals) : Math.round(Number(value)).toLocaleString()) + suffix;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0',
    }}>
      <span style={{ fontSize: 14, color: C.textSub }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: color || C.text }}>{display}</span>
    </div>
  );
}

function ProgressBar({ value, max, color }) {
  const C = useContext(ThemeCtx);
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div style={{ background: C.progressTrack, borderRadius: 4, height: 5, flex: 1, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color || C.teal, borderRadius: 4 }} />
    </div>
  );
}

function QualityRow({ name, pass, rw, rj }) {
  const C = useContext(ThemeCtx);
  const total = (pass || 0) + (rw || 0) + (rj || 0);
  const rate  = total > 0 ? (pass || 0) / total * 100 : 0;
  const col   = rate >= 90 ? C.green : rate >= 70 ? C.amber : C.red;
  return (
    <tr>
      <td style={{ padding: '11px 0', fontSize: 13, fontWeight: 600, color: C.text, width: '22%' }}>{name}</td>
      <td style={{ padding: '11px 10px', fontSize: 13, color: C.green,  textAlign: 'right', fontWeight: 700 }}>{Math.round(pass || 0).toLocaleString()}</td>
      <td style={{ padding: '11px 10px', fontSize: 13, color: C.amber,  textAlign: 'right', fontWeight: 700 }}>{Math.round(rw   || 0).toLocaleString()}</td>
      <td style={{ padding: '11px 10px', fontSize: 13, color: C.red,    textAlign: 'right', fontWeight: 700 }}>{Math.round(rj   || 0).toLocaleString()}</td>
      <td style={{ padding: '11px 0 11px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ProgressBar value={pass || 0} max={total} color={col} />
          <span style={{ fontSize: 12, fontWeight: 700, color: col, minWidth: 42, textAlign: 'right' }}>
            {rate.toFixed(1)}%
          </span>
        </div>
      </td>
    </tr>
  );
}

// ── FilterField (OutlinedField-style, matches ConnectionSettings) ──
function FilterField({ label, required, error, children, style = {}, onBlue }) {
  return (
    <div style={{ position: 'relative', marginTop: 10, ...style }}>
      <span style={{
        position: 'absolute', top: -9, left: 10,
        background: onBlue ? '#1565C0' : '#fff', padding: '0 4px',
        fontSize: 11, fontWeight: 500,
        color: onBlue ? '#fff' : (error ? '#ef4444' : '#1565C0'),
        lineHeight: 1, zIndex: 2, pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </span>
      <div style={{
        border: `1.5px solid ${onBlue ? '#fff' : (error ? '#ef4444' : '#1565C0')}`,
        borderRadius: 6, display: 'flex', alignItems: 'center', background: onBlue ? 'rgba(255,255,255,0.15)' : '#fff',
      }}>
        {children}
      </div>
    </div>
  );
}

const filterInputStyle = {
  flex: 1, border: 'none', outline: 'none',
  padding: '7px 10px', fontSize: 12,
  color: '#1565C0', background: 'transparent',
  fontFamily: 'inherit',
  caretColor: '#1565C0',
};

// ── Helpers ────────────────────────────────────────────────────────
function toApiDate(s) { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
function sumRows(rows, fields) {
  const o = {};
  fields.forEach(f => { o[f] = rows.reduce((a, r) => a + (Number(r[f]) || 0), 0); });
  return o;
}
function avgRows(rows, fields) {
  const o = {};
  fields.forEach(f => { o[f] = rows.length ? rows.reduce((a, r) => a + (Number(r[f]) || 0), 0) / rows.length : 0; });
  return o;
}

// ── Dashboard ──────────────────────────────────────────────────────
export default function Dashboard({ onLogout }) {
  const [theme, setTheme]       = useState(() => localStorage.getItem('procon-theme') || 'dark');
  const [dateInput, setDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [shift, setShift]       = useState('001');
  const [lineCode, setLineCode] = useState('');
  const [lines, setLines]         = useState([]);
  const [shifts, setShifts]       = useState([]);
  const [data, setData]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [refreshInfo, setRefreshInfo] = useState(null);
  const [efficiencyData, setEfficiencyData] = useState(null);
  const [wipPcs, setWipPcs] = useState(0);
  const [styleDetails, setStyleDetails] = useState([]);
  const [lineWiseHourly, setLineWiseHourly] = useState({ section: 'Sewing', data: [], allHours: [] });
  const [dhuData, setDhuData]             = useState([]);
  const [qcDefects, setQcDefects]         = useState([]);
  const [histogramData, setHistogramData]   = useState({ data: [], target: 0, ucl: 0, lcl: 0, tolerance: 80 });
  const [topOperators, setTopOperators]     = useState({ top: [], bottom: [] });
  const [showHourlyReport, setShowHourlyReport] = useState(false);
  const [bdNwData, setBdNwData] = useState({ bd: [], nw: [] });
  const [showBdReport, setShowBdReport]   = useState(false);
  const [showNwReport, setShowNwReport]   = useState(false);
  const [bdReportData, setBdReportData]   = useState([]);
  const [nwReportData, setNwReportData]   = useState([]);
  const [bdReportLoading, setBdReportLoading] = useState(false);
  const [nwReportLoading, setNwReportLoading] = useState(false);
  const [oprReportData, setOprReportData] = useState([]);
  const [oprReportLoading, setOprReportLoading] = useState(false);
  const [showWipReport, setShowWipReport] = useState(false);
  const [wipReportData, setWipReportData] = useState([]);
  const [wipReportLoading, setWipReportLoading] = useState(false);
  const [showAlertReport, setShowAlertReport] = useState(false);
  const [alertReportConfig, setAlertReportConfig] = useState({ alertType: 'mech', reportType: 'received', title: '' });
  const [alertReportData, setAlertReportData] = useState([]);
  const [alertReportLoading, setAlertReportLoading] = useState(false);
  const [showOprNptReport, setShowOprNptReport] = useState(false);
  const [oprNptReportData, setOprNptReportData] = useState([]);
  const [oprNptReportLoading, setOprNptReportLoading] = useState(false);
  const [topRwOperators, setTopRwOperators] = useState([]);

  const session = loadSession();
  const masterDB  = session?.masterDB  || '';
  const transDB   = session?.transDB   || '';

  const C = theme === 'dark' ? DARK : LIGHT;

  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('procon-theme', next);
      return next;
    });
  }, []);

  useEffect(() => {
    axios.get(`/api/dashboard/lines?masterDB=${masterDB}`)
      .then(r => setLines(r.data)).catch(() => {});
  }, [masterDB]);

  useEffect(() => {
    axios.get(`/api/dashboard/shifts?masterDB=${masterDB}`)
      .then(r => setShifts(r.data)).catch(() => {});
  }, [masterDB]);

  const fetchData = useCallback(() => {
    if (!dateInput) { setError('Date is required.'); return; }
    if (!shift)     { setError('Shift is required.'); return; }
    if (!lineCode)  { setError('Please select a Line.'); return; }
    setLoading(true);
    setError(null);
    const p = new URLSearchParams({ date: toApiDate(dateInput), shift, lineCode, masterDB, transDB });

    // Fetch production + efficiency in parallel
    Promise.all([
      axios.get(`/api/dashboard/production?${p}`),
      axios.get(`/api/dashboard/efficiency?${p}`),
    ])
      .then(([prodRes, effRes]) => {
        setData(prodRes.data);
        const lineName = lines.find(l => l.LineCode === lineCode)?.ShortName || lineCode;
        const shiftName = shifts.find(s => s.ShiftCode === shift)?.ShiftName || shift;
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setRefreshInfo({
          lineName,
          date: dateInput,
          shift: shiftName,
          user: session?.username || '',
          time: timeStr,
        });
        setEfficiencyData(effRes.data);
        // Fetch WIP pcs (non-blocking)
        axios.get(`/api/dashboard/wip?${p}`)
          .then(w => setWipPcs(w.data?.wipPcs || 0))
          .catch(() => setWipPcs(0));
        // Fetch style details (non-blocking)
        axios.get(`/api/dashboard/styledetails?${p}`)
          .then(r => setStyleDetails(r.data || []))
          .catch(() => setStyleDetails([]));
        // Fetch DHU data (non-blocking)
        axios.get(`/api/dashboard/dhu?${p}`)
          .then(r => setDhuData(r.data || []))
          .catch(() => setDhuData([]));
        // Fetch QC defect breakdown (non-blocking)
        axios.get(`/api/dashboard/qc-defects?${p}`)
          .then(r => setQcDefects(r.data || []))
          .catch(() => setQcDefects([]));
        // Fetch histogram (non-blocking)
        axios.get(`/api/dashboard/histogram?${p}`)
          .then(r => setHistogramData(r.data || { data: [], target: 0, ucl: 0, lcl: 0, tolerance: 80 }))
          .catch(() => setHistogramData({ data: [], target: 0, ucl: 0, lcl: 0, tolerance: 80 }));
        // Fetch top/bottom operators (non-blocking)
        axios.get(`/api/dashboard/top-operators?${p}`)
          .then(r => setTopOperators(r.data || { top: [], bottom: [] }))
          .catch(() => setTopOperators({ top: [], bottom: [] }));
        // Fetch line-wise hourly production graph (non-blocking)
        const lwhParams = new URLSearchParams({ date: toApiDate(dateInput), shift, lineCode, masterDB, transDB });
        axios.get(`/api/dashboard/linewise-hourly?${lwhParams}`)
          .then(r => setLineWiseHourly({ section: r.data.section || 'Sewing', data: r.data.data || [], allHours: r.data.allHours || [] }))
          .catch(() => setLineWiseHourly({ section: 'Sewing', data: [], allHours: [] }));
        // Fetch top RW operators (non-blocking)
        axios.get(`/api/dashboard/top-rw-operators?${p}`)
          .then(r => setTopRwOperators(r.data || []))
          .catch(() => setTopRwOperators([]));
        // Fetch BreakDown / NoWork (non-blocking)
        axios.get(`/api/dashboard/bd-nw?${p}`)
          .then(r => setBdNwData(r.data || { bd: [], nw: [] }))
          .catch(() => setBdNwData({ bd: [], nw: [] }));
      })
      .catch(e => {
        const msg = e.response?.data?.error || e.message;
        setError(msg);
        console.log('Dashboard fetch error:', msg);
      })
      .finally(() => setLoading(false));
  }, [dateInput, shift, lineCode, masterDB, transDB, shifts, lines]);

  // Only auto-fetch when all three mandatory fields are filled
  useEffect(() => {
    if (dateInput && shift && lineCode) fetchData();
  }, []);

  // Fetch operator-operation wise data when report modal opens
  useEffect(() => {
    if (!showHourlyReport) return;
    setOprReportLoading(true);
    const p = new URLSearchParams({ date: toApiDate(dateInput), shift, lineCode, masterDB, transDB });
    axios.get(`/api/dashboard/hourly-opr-operation?${p}`)
      .then(r => { setOprReportData(r.data || []); setOprReportLoading(false); })
      .catch(() => { setOprReportData([]); setOprReportLoading(false); });
  }, [showHourlyReport]);

  useEffect(() => {
    if (!showBdReport) return;
    setBdReportLoading(true);
    const p = new URLSearchParams({ date: toApiDate(dateInput), shift, lineCode, masterDB, transDB, type: 'bd' });
    axios.get(`/api/dashboard/bd-nw-detail?${p}`)
      .then(r => { setBdReportData(r.data || []); setBdReportLoading(false); })
      .catch(() => { setBdReportData([]); setBdReportLoading(false); });
  }, [showBdReport]);

  useEffect(() => {
    if (!showNwReport) return;
    setNwReportLoading(true);
    const p = new URLSearchParams({ date: toApiDate(dateInput), shift, lineCode, masterDB, transDB, type: 'nw' });
    axios.get(`/api/dashboard/bd-nw-detail?${p}`)
      .then(r => { setNwReportData(r.data || []); setNwReportLoading(false); })
      .catch(() => { setNwReportData([]); setNwReportLoading(false); });
  }, [showNwReport]);

  useEffect(() => {
    if (!showAlertReport) return;
    setAlertReportLoading(true);
    const p = new URLSearchParams({ date: toApiDate(dateInput), shift, lineCode, masterDB, transDB, alertType: alertReportConfig.alertType, reportType: alertReportConfig.reportType });
    axios.get(`/api/dashboard/alert-report?${p}`)
      .then(r => { setAlertReportData(r.data || []); setAlertReportLoading(false); })
      .catch(() => { setAlertReportData([]); setAlertReportLoading(false); });
  }, [showAlertReport, alertReportConfig]);

  useEffect(() => {
    if (!showOprNptReport) return;
    setOprNptReportLoading(true);
    const p = new URLSearchParams({ date: toApiDate(dateInput), shift, lineCode, masterDB, transDB });
    axios.get(`/api/dashboard/oprnpt-report?${p}`)
      .then(r => { setOprNptReportData(r.data || []); setOprNptReportLoading(false); })
      .catch(() => { setOprNptReportData([]); setOprNptReportLoading(false); });
  }, [showOprNptReport]);

  useEffect(() => {
    if (!showWipReport) return;
    setWipReportLoading(true);
    const p = new URLSearchParams({ lineCode, masterDB, transDB, date: toApiDate(dateInput), shift });
    axios.get(`/api/dashboard/wip-report?${p}`)
      .then(r => { setWipReportData(r.data || []); setWipReportLoading(false); })
      .catch(() => { setWipReportData([]); setWipReportLoading(false); });
  }, [showWipReport]);

  const s = useMemo(() => ({
    ...sumRows(data, [
      'SectionSWGOprsAtt','SectionCHKOprsAtt','SectionAQLOprsAtt','SectionFINOprsAtt','SectionPKGOprsAtt',
      'SectionSWGCapacityWs','SectionSWGActualWs',
      'SectionCHKCapacityWs','SectionCHKActualWs','SectionAQLCapacityWs','SectionAQLActualWs','SectionFINCapacityWs','SectionFINActualWs','SectionPKGCapacityWs','SectionPKGActualWs',
      'SectionSWGOprsLoggedIn','SectionCHKOprsLoggedIn','SectionAQLOprsLoggedIn','SectionFINOprsLoggedIn','SectionPKGOprsLoggedIn',
      'CurrNoOfOprsLoggedIn','CurrNoOfQcOprsLoggedIn',
      'SectionIssuedPcs','LineTargetPcs','LineIssuedPcs',
      'SectionSWGSewnPcs','LineSWGSewnPcs','LineSWGSewnPcsOT',
      'LineCHKPassedPcs','LineCHKPassedPcsOT','LineAQLPassedPcs','LineAQLPassedPcsOT',
      'LineFINPassedPcs','LineFINPassedPcsOT','LinePKGPassedPcs','LinePKGPassedPcsOT',
      'SectionSWGPcsSAM','SectionCHKPcsSAM','SectionAQLPcsSAM','SectionFINPcsSAM','SectionPKGPcsSAM','SectionSWGOnStdPcsSAM',
      'SectionSWGWorkedMins','SectionCHKWorkedMins','SectionAQLWorkedMins','SectionFINWorkedMins','SectionPKGWorkedMins','SectionSWGProdTime',
      'SectionSWGIdleTime','SectionSWGIdleTimeOT','SectionSWGNWTime','SectionSWGNWTimeOT','SectionSWGBDTime','SectionSWGBDTimeOT','SectionSWGRwTime','SectionSWGRwTimeOT',
      'SectionCHKIdleTime','SectionCHKIdleTimeOT','SectionCHKNWTime','SectionCHKNWTimeOT','SectionCHKBDTime','SectionCHKBDTimeOT',
      'SectionAQLIdleTime','SectionAQLIdleTimeOT','SectionAQLNWTime','SectionAQLNWTimeOT','SectionAQLBDTime','SectionAQLBDTimeOT',
      'SectionFINIdleTime','SectionFINIdleTimeOT','SectionFINNWTime','SectionFINNWTimeOT','SectionFINBDTime','SectionFINBDTimeOT',
      'SectionPKGIdleTime','SectionPKGIdleTimeOT','SectionPKGNWTime','SectionPKGNWTimeOT','SectionPKGBDTime','SectionPKGBDTimeOT',
      'SectionSWGNPTimeLine','SectionSWGNPTimeLineOT','SectionCHKNPTimeLine','SectionCHKNPTimeLineOT','SectionAQLNPTimeLine','SectionAQLNPTimeLineOT','SectionFINNPTimeLine','SectionFINNPTimeLineOT','SectionPKGNPTimeLine','SectionPKGNPTimeLineOT',
      'SectionSWGNPTimeOPR','SectionSWGNPTimeOPROT','SectionCHKNPTimeOPR','SectionCHKNPTimeOPROT','SectionAQLNPTimeOPR','SectionAQLNPTimeOPROT','SectionFINNPTimeOPR','SectionFINNPTimeOPROT','SectionPKGNPTimeOPR','SectionPKGNPTimeOPROT',
      'SectionCHKLoadingPcs','SectionCHKPassedPcs','SectionCHKReworkPcs','SectionCHKRejectedPcs',
      'SectionAQLPassedPcs','SectionAQLReworkPcs','SectionAQLRejectedPcs',
      'SectionFINPassedPcs','SectionFINReworkPcs','SectionFINRejectedPcs',
      'SectionPKGPassedPcs','SectionPKGReworkPcs','SectionPKGRejectedPcs',
      'MechAlertReceived','MechAlertAttended','SuprAlertReceived','SuprAlertAttended',
    ]),
    ...avgRows(data, ['SectionTargetEff', 'LineTargetEff']),
  }), [data]);

  // Operators calculations (summed across all sections)
  const totalWS = (s.SectionSWGCapacityWs || 0) + (s.SectionCHKCapacityWs || 0) + (s.SectionAQLCapacityWs || 0) + (s.SectionFINCapacityWs || 0) + (s.SectionPKGCapacityWs || 0);
  const activeWS = (s.SectionSWGActualWs || 0) + (s.SectionCHKActualWs || 0) + (s.SectionAQLActualWs || 0) + (s.SectionFINActualWs || 0) + (s.SectionPKGActualWs || 0);
  // For NotSameDate: M_LineDt/M_QcLineDt are real-time tables and return 0 for historical dates,
  // so use SectionXXXOprsLoggedIn (stored in T_FactLineProduction) instead.
  const prsOprs = (efficiencyData?.flags?.I_L_SameDate === 1)
    ? (s.CurrNoOfOprsLoggedIn || 0) + (s.CurrNoOfQcOprsLoggedIn || 0)
    : (s.SectionSWGOprsLoggedIn || 0) + (s.SectionCHKOprsLoggedIn || 0) +
      (s.SectionAQLOprsLoggedIn || 0) + (s.SectionFINOprsLoggedIn || 0) +
      (s.SectionPKGOprsLoggedIn || 0);
  const absOprs = Math.max(0, activeWS - prsOprs);
  const attRate = activeWS > 0 ? (prsOprs / activeWS) * 100 : 0;

  // Output calculation based on flags from efficiency API (using LINE-level PCS)
  let outputPcs = 0;
  const flags = efficiencyData?.flags || {};
  const outputSectionName =
    flags.I_L_Output_QC        === 1 ? 'EndLine Checking' :
    flags.I_L_Output_AQL       === 1 ? 'AQL' :
    flags.I_L_Output_Finishing === 1 ? 'Finishing' :
    flags.I_L_Output_Packing   === 1 ? 'Packing' :
    'Sewing';

  if (flags.I_L_Output_Sewing === 1) {
    outputPcs += (s.LineSWGSewnPcs || 0) + (s.LineSWGSewnPcsOT || 0);
  }
  if (flags.I_L_Output_QC === 1) {
    outputPcs += (s.LineCHKPassedPcs || 0) + (s.LineCHKPassedPcsOT || 0);
  }
  if (flags.I_L_Output_AQL === 1) {
    outputPcs += (s.LineAQLPassedPcs || 0) + (s.LineAQLPassedPcsOT || 0);
  }
  if (flags.I_L_Output_Finishing === 1) {
    outputPcs += (s.LineFINPassedPcs || 0) + (s.LineFINPassedPcsOT || 0);
  }
  if (flags.I_L_Output_Packing === 1) {
    outputPcs += (s.LinePKGPassedPcs || 0) + (s.LinePKGPassedPcsOT || 0);
  }

  // If no flags are set, default to sewing output
  if (outputPcs === 0) {
    outputPcs = (s.LineSWGSewnPcs || 0) + (s.LineSWGSewnPcsOT || 0);
  }

  // Target vs Actual Efficiency - Pro-rated based on SameDate/NotSameDate
  let fCurrTargetPcs = s.LineTargetPcs;
  const isSameDate = efficiencyData?.flags?.I_L_SameDate === 1;
  const availableMinsWithBreak = efficiencyData?.shiftDetails?.AvailableMinsWithBreakMins || 0;
  const shiftTime = efficiencyData?.shiftDetails?.ShiftTime || 480;

  if (isSameDate && shiftTime > 0) {
    // Pro-rate target pieces based on elapsed time
    fCurrTargetPcs = (s.LineTargetPcs / shiftTime) * availableMinsWithBreak;
  }
  // else: NotSameDate - use full target pieces

  const taEff = fCurrTargetPcs > 0 ? (outputPcs / fCurrTargetPcs) * 100 : 0;

  // Comprehensive Efficiency Calculation
  // Numerator: Earned Minutes (PcsSAM across all sections)
  const totalEarnedMinutes = (s.SectionSWGPcsSAM || 0) +
                             (s.SectionCHKPcsSAM || 0) +
                             (s.SectionAQLPcsSAM || 0) +
                             (s.SectionFINPcsSAM || 0) +
                             (s.SectionPKGPcsSAM || 0);

  // Denominator: Available Minutes (Worked Minutes - Off-Standard Time)
  // Worked minutes from all sections (already in minutes, no conversion needed)
  const totalWorkedMins = ((s.SectionSWGWorkedMins || 0) +
                           (s.SectionCHKWorkedMins || 0) +
                           (s.SectionAQLWorkedMins || 0) +
                           (s.SectionFINWorkedMins || 0) +
                           (s.SectionPKGWorkedMins || 0));

  // Off-Standard Time Deductions (in minutes)
  const offStandardMins = (s.SectionSWGIdleTime || 0) +
                          (s.SectionSWGNWTime || 0) +
                          (s.SectionSWGBDTime || 0) +
                          (s.SectionSWGRwTime || 0) +
                          (s.SectionCHKIdleTime || 0) +
                          (s.SectionCHKNWTime || 0) +
                          (s.SectionCHKBDTime || 0) +
                          (s.SectionAQLIdleTime || 0) +
                          (s.SectionAQLNWTime || 0) +
                          (s.SectionAQLBDTime || 0) +
                          (s.SectionFINIdleTime || 0) +
                          (s.SectionFINNWTime || 0) +
                          (s.SectionFINBDTime || 0) +
                          (s.SectionPKGIdleTime || 0) +
                          (s.SectionPKGNWTime || 0) +
                          (s.SectionPKGBDTime || 0);

  // Net Available Minutes (after deducting off-standard time)
  const netAvailableMins = Math.max(0, totalWorkedMins - offStandardMins);

  // Final Efficiency Calculation
  // Use backend calculation if available and non-zero, otherwise fall back to frontend calculation
  // Gross Efficiency = Earned Minutes / Worked Minutes
  const grsEff = (efficiencyData?.efficiency !== undefined && efficiencyData?.efficiency > 0)
    ? efficiencyData.efficiency
    : (totalWorkedMins > 0 ? (totalEarnedMinutes / totalWorkedMins) * 100 : 0);

  // Net Efficiency = Earned Minutes / (Worked Minutes - Off-Standard)
  // Using same as grsEff when backend provides efficiency (which is calculated as net efficiency)
  const onsEff = (efficiencyData?.efficiency !== undefined && efficiencyData?.efficiency > 0)
    ? efficiencyData.efficiency
    : (netAvailableMins > 0 ? (totalEarnedMinutes / netAvailableMins) * 100 : 0);

  // OEE Calculations
  const shiftTimeTillNow = isSameDate ? availableMinsWithBreak : shiftTime;
  const oeeAvailability = (activeWS > 0 && shiftTimeTillNow > 0)
    ? Math.min(100, (totalWorkedMins / (shiftTimeTillNow * activeWS)) * 100)
    : 0;
  const oeePerformance = totalWorkedMins > 0
    ? Math.min(100, (totalEarnedMinutes / totalWorkedMins) * 100)
    : 0;
  const oeeCHKPassedPcs  = (s.SectionCHKPassedPcs || 0) + (s.SectionCHKPassedPcsOT || 0);
  const oeeCHKCheckedPcs = s.SectionCHKLoadingPcs || 0;
  const oeeQuality = oeeCHKCheckedPcs > 0
    ? Math.min(100, (oeeCHKPassedPcs / oeeCHKCheckedPcs) * 100)
    : 0;
  const oeeScore = (oeeAvailability / 100) * (oeePerformance / 100) * (oeeQuality / 100) * 100;

  const effColor = v => v >= 80 ? C.green : v >= 60 ? C.amber : C.red;
  const effDim   = v => v >= 80 ? C.greenDim : v >= 60 ? C.amberDim : C.redDim;

  const lineNoOfHrs = data[0]?.LineNoOfHrs || 0;
  const manDayMinutes = efficiencyData?.shiftDetails?.ManDayMinutes || 0;
  const targetOutputPerHr = lineNoOfHrs > 0 ? Math.round(s.LineTargetPcs / lineNoOfHrs) : 0;
  const actualOutputPerHr = manDayMinutes > 0 ? Math.round((outputPcs / manDayMinutes) * 60) : 0;

  const shiftLabel = shifts.find(s => s.ShiftCode === shift)?.ShiftName || shift;
  const lineLabel  = lineCode ? (lines.find(l => l.LineCode === lineCode)?.ShortName || lineCode) : `All Lines · ${data.length}`;
  const maxOffStd  = Math.max(s.SectionSWGNWTime, s.SectionSWGBDTime, s.SectionSWGRwTime, s.SectionSWGIdleTime, s.SectionSWGNPTimeLine, 0.01);

  return (
    <ThemeCtx.Provider value={C}>
      <style>{`
/* ── ProCon Typography System ─────────────────────────────────── */
/* font1 = Card Heading */
.font1 {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.2px;
  line-height: 1.3;
}
/* font2 = Sub Heading */
.font2 {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
  line-height: 1.3;
}
/* font3 = Content Value */
.font3 {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
}
/* font4 = Sub Content Label */
.font4 {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.8px;
  line-height: 1.3;
}
.pc-card-icon {
  font-size: 15px;
  line-height: 1;
  opacity: 0.9;
  flex-shrink: 0;
}
.pc-view-report {
  padding: 5px 12px;
  font-size: 11px;
  font-weight: 700;
  font-family: 'Inter', 'Segoe UI', sans-serif;
  background: transparent;
  color: #fff;
  border: 1.5px solid rgba(255,255,255,0.6);
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  letter-spacing: 0.2px;
  transition: background 0.15s;
}
.pc-view-report:hover { background: rgba(255,255,255,0.18); }
/* ── end typography ─────────────────────────────────────────── */

input::placeholder { color: #1565C0; }
        input::-webkit-input-placeholder { color: #1565C0; }
        input:-moz-placeholder { color: #1565C0; }
        input::-moz-placeholder { color: #1565C0; }

        /* Date picker styling */
        input[type="date"] { color: #1565C0; }
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(0.4) sepia(0.6) saturate(2) hue-rotate(200deg);
          cursor: pointer;
        }

        /* Select/combo box styling */
        select {
          color: #1565C0;
          background: transparent;
        }
        select:focus {
          outline: none;
        }
        option {
          background: #fff;
          color: #1565C0;
          font-weight: 500;
        }
        option:checked {
          background: #1565C0;
          color: #fff;
          font-weight: 600;
        }
        option:hover {
          background: rgba(21, 101, 192, 0.15);
        }

        /* For blue background selects */
        select[style*="color: rgb(255, 255, 255)"] {
          color: #fff !important;
        }
        select[style*="color: rgb(255, 255, 255)"] option {
          color: #1565C0;
          background: #fff;
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: C.bg, fontFamily: 'Inter, Segoe UI, sans-serif', color: C.text }}>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

          {/* Single row header with ProCon logo, company name, and filters */}
          <div style={{
            display: 'flex', alignItems: 'center',
            borderBottom: '1px solid #c5d8ef',
            position: 'sticky', top: 0, zIndex: 50,
            background: '#1565C0', height: 60, gap: 20, paddingLeft: 16, paddingRight: 20
          }}>
            {/* ProCon Logo */}
            <span style={{
              background: '#fff', borderRadius: 8, padding: '5px 14px',
              display: 'inline-flex', alignItems: 'center', flexShrink: 0
            }}>
              <span style={{
                fontFamily: "'Futura XBlk BT', 'Futura', 'Century Gothic', Impact, sans-serif",
                fontSize: 18, fontWeight: 900, letterSpacing: 2, lineHeight: 1
              }}>
                <span style={{ color: '#1A4F9C' }}>Pro</span>
                <span style={{ color: '#00AEEF' }}>Con</span>
                <sup style={{ fontSize: 10, verticalAlign: 'super', letterSpacing: 0, color: '#00AEEF' }}>®</sup>
              </span>
            </span>

            {/* Company name and refresh info */}
            <div style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0,
              borderRight: '1px solid rgba(255,255,255,0.2)', paddingRight: 20
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>
                {session?.companyName || 'Production Dashboard'}
              </div>
              {refreshInfo && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1, whiteSpace: 'nowrap' }}>
                  {`${refreshInfo.lineName} · ${refreshInfo.date} · ${refreshInfo.shift} · ${refreshInfo.user} · ${refreshInfo.time}`}
                </div>
              )}
            </div>

            {/* Filters – flex: 1 to fill remaining space */}
            <div style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              gap: 10
            }}>
              <FilterField label="Date" required error={!dateInput} onBlue>
                <input
                  type="date"
                  value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                  style={{...filterInputStyle, accentColor: '#fff', color: '#fff'}}
                />
              </FilterField>
              <FilterField label="Shift" required onBlue>
                <select value={shift} onChange={e => setShift(e.target.value)} style={{ ...filterInputStyle, cursor: 'pointer', color: '#fff', accentColor: '#fff', colorScheme: 'light', backgroundColor: 'transparent' }}>
                  <option value="" style={{ background: '#fff', color: '#1565C0' }}>-- Select Shift --</option>
                  {shifts.length === 0 ? (
                    <option value="001" style={{ background: '#fff', color: '#1565C0' }}>Shift A</option>
                  ) : (
                    shifts.map(s => (
                      <option key={s.ShiftCode} value={s.ShiftCode} style={{ background: '#fff', color: '#1565C0' }}>
                        {s.ShiftName}
                      </option>
                    ))
                  )}
                </select>
              </FilterField>
              <FilterField label="Line" required style={{ minWidth: 130 }} onBlue>
                <select value={lineCode} onChange={e => setLineCode(e.target.value)}
                  style={{ ...filterInputStyle, cursor: 'pointer', color: '#fff', accentColor: '#fff', colorScheme: 'light', backgroundColor: 'transparent' }}>
                  <option value="" style={{ background: '#fff', color: '#1565C0' }}>-- Select Line --</option>
                  {lines.map(l => (
                    <option key={l.LineCode} value={l.LineCode} style={{ background: '#fff', color: '#1565C0' }}>{l.ShortName}</option>
                  ))}
                </select>
              </FilterField>
              <button
                onClick={fetchData}
                disabled={!dateInput || !shift || !lineCode}
                style={{
                  padding: '8px 18px', borderRadius: 6, border: '2px solid #fff',
                  background: (!dateInput || !shift || !lineCode) ? '#999' : '#1565C0',
                  color: '#fff',
                  fontSize: 12, fontWeight: 700,
                  cursor: (!dateInput || !shift || !lineCode) ? 'not-allowed' : 'pointer',
                  marginTop: 10, flexShrink: 0,
                  opacity: (!dateInput || !shift || !lineCode) ? 0.6 : 1
                }}
              >
                Refresh
              </button>
              <button
                onClick={toggleTheme}
                style={{
                  padding: '8px 12px', borderRadius: 6,
                  border: '2px solid rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.15)', color: '#fff',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  marginTop: 10, flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                {theme === 'dark' ? '☀ Light' : '🌙 Dark'}
              </button>
              <button
                onClick={onLogout}
                style={{
                  padding: '8px 12px', borderRadius: 6,
                  border: '2px solid rgba(239,68,68,0.5)',
                  background: 'rgba(239,68,68,0.15)', color: '#ffaaaa',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  marginTop: 10, flexShrink: 0,
                }}
              >
                ⏻ Logout
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '14px 18px', flex: 1 }}>

            {error && (
              <div style={{ background: C.redDim, color: C.red, borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
                Error: {error}
              </div>
            )}

            {loading && (
              <div style={{ textAlign: 'center', padding: 100, color: C.textSub, fontSize: 14 }}>Loading...</div>
            )}

            {!loading && !error && data.length === 0 && (
              <div style={{ textAlign: 'center', padding: 100, color: C.textSub, fontSize: 14 }}>
                No data found for {dateInput} — {shiftLabel}
              </div>
            )}

            {!loading && data.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* All four cards in one row */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>

                  {/* Operators */}
                  {(() => {
                    const r = 26, circ = 2 * Math.PI * r;
                    const dashOffset = circ * (1 - Math.min(100, attRate) / 100);
                    const wsUpPct = totalWS > 0 ? Math.round((activeWS / totalWS) * 100) : 0;
                    const manDays = efficiencyData?.manDays || 0;
                    return (
                      <div style={{ flex: 1, borderRadius: 14, border: `1px solid ${C.cardBorder}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
                        {/* Blue header */}
                        <div style={{ background: '#1565C0', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="pc-card-icon">🧑‍🏭</span>
                          <span className="font1" style={{ color: '#fff' }}>Operators</span>
                        </div>
                        {/* Middle section — 2×2 grid: (0,0)TotalWS (0,1)ClockedMins (1,0)AttRate (1,1)ManDays */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, background: C.card }}>
                          {/* (0,0) Total WS */}
                          <div style={{ borderRight: `1px solid ${C.cardBorder}`, borderBottom: `1px solid ${C.cardBorder}`, padding: '8px 14px 6px' }}>
                            <div style={{ fontSize: 32, fontWeight: 800, color: '#1565C0', lineHeight: 1 }}>{Math.round(totalWS)}</div>
                            <div style={{ fontSize: 10, color: C.textSub, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>🖥</span> Total workstations
                            </div>
                          </div>
                          {/* (0,1) Clocked Mins */}
                          <div style={{ borderBottom: `1px solid ${C.cardBorder}`, padding: '8px 14px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: C.textSub, letterSpacing: 1.0, marginBottom: 3 }}>Clocked Mins</div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: '#1565C0', lineHeight: 1 }}>
                              {efficiencyData?.shiftDetails?.ManDayMinutes || 0}
                            </div>
                          </div>
                          {/* (1,0) Att Rate gauge */}
                          <div style={{ borderRight: `1px solid ${C.cardBorder}`, padding: '6px 14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: C.textSub, letterSpacing: 1.2, marginBottom: 4 }}>Att Rate</div>
                            <svg width={66} height={66}>
                              <circle cx={33} cy={33} r={r} fill="none" stroke={C.progressTrack} strokeWidth={4} />
                              <circle cx={33} cy={33} r={r} fill="none" stroke="#1565C0" strokeWidth={4}
                                strokeDasharray={circ} strokeDashoffset={dashOffset}
                                strokeLinecap="round" transform="rotate(-90, 33, 33)"
                              />
                              <text x={33} y={29} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={800} fill="#1565C0">{Math.round(attRate)}</text>
                              <text x={33} y={44} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={600} fill={C.textSub}>Att %</text>
                            </svg>
                          </div>
                          {/* (1,1) Man Days */}
                          <div style={{ padding: '6px 14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: C.textSub, letterSpacing: 1.2, marginBottom: 4 }}>Man Days</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: '#1565C0', lineHeight: 1 }}>{Number(manDays).toFixed(1)}</div>
                          </div>
                        </div>
                        {/* Bottom — 3 stat columns */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: C.card, borderTop: `1px solid ${C.cardBorder}` }}>
                          {[
                            { label: 'Active WS', value: Math.round(activeWS), badge: `↑ ${wsUpPct}% up`, badgeColor: C.green, badgeBg: C.greenDim },
                            { label: 'Present',   value: Math.round(prsOprs),  badge: 'On Duty',           badgeColor: C.green, badgeBg: C.greenDim },
                            { label: 'Absent',    value: Math.round(absOprs),  badge: 'Off Duty',          badgeColor: C.red,   badgeBg: C.redDim   },
                          ].map(({ label, value, badge, badgeColor, badgeBg }, i) => (
                            <div key={label} style={{ textAlign: 'center', padding: '7px 6px', borderLeft: i > 0 ? `1px solid ${C.cardBorder}` : 'none' }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: C.textSub, letterSpacing: 1.1, marginBottom: 3 }}>{label}</div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: '#1565C0', lineHeight: 1, marginBottom: 4 }}>{value}</div>
                              <span style={{ fontSize: 9, fontWeight: 700, color: badgeColor, background: badgeBg, borderRadius: 4, padding: '2px 6px' }}>{badge}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Target vs Actual — new design */}
                  {(() => {
                    const pcsPct  = s.LineTargetPcs   > 0 ? Math.min(100, (outputPcs          / s.LineTargetPcs)   * 100) : 0;
                    const hrPct   = targetOutputPerHr > 0 ? Math.min(100, (actualOutputPerHr  / targetOutputPerHr) * 100) : 0;
                    const effPct  = s.LineTargetEff   > 0 ? Math.min(100, (onsEff             / Number(s.LineTargetEff)) * 100) : 0;
                    const pcsGap  = Math.round(outputPcs - s.LineTargetPcs);
                    const hrGap   = actualOutputPerHr - targetOutputPerHr;
                    const effGap  = Math.round(onsEff - Number(s.LineTargetEff));
                    const gc = v => v >= 0 ? C.green : C.red;
                    const Bar = ({ pct, color, full }) => (
                      <div style={{ background: C.progressTrack, borderRadius: 3, height: 5, overflow: 'hidden', marginTop: 5 }}>
                        <div style={{ width: `${full ? 100 : Math.min(100, Math.max(0, pct))}%`, height: '100%', background: color, borderRadius: 3 }} />
                      </div>
                    );
                    const CG = ({ pct }) => {
                      const r = 20, circ = 2 * Math.PI * r, col = effColor(pct);
                      return (
                        <svg width={46} height={46}>
                          <circle cx={23} cy={23} r={r} fill="none" stroke={C.progressTrack} strokeWidth={2} />
                          <circle cx={23} cy={23} r={r} fill="none" stroke={col} strokeWidth={2}
                            strokeDasharray={circ}
                            strokeDashoffset={circ * (1 - Math.min(100, Math.max(0, pct)) / 100)}
                            strokeLinecap="round" transform="rotate(-90, 23, 23)"
                          />
                          <text x={23} y={23} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={700} fill={col}>
                            {pct.toFixed(1)}%
                          </text>
                        </svg>
                      );
                    };
                    const headerValColor = taEff >= 80 ? '#4ade80' : taEff >= 60 ? '#fbbf24' : '#f87171';
                    const rows = [
                      { icon: '📤', label: 'Pcs',       target: Math.round(s.LineTargetPcs).toLocaleString(), actual: Math.round(outputPcs).toLocaleString(),    pct: pcsPct, gap: pcsGap, suf: '' },
                      { icon: '⏱', label: 'Output/hr',  target: targetOutputPerHr.toLocaleString(),          actual: actualOutputPerHr.toLocaleString(),         pct: hrPct,  gap: hrGap,  suf: '/hr' },
                      { icon: '⚡', label: 'Eff %',     target: `${Number(s.LineTargetEff).toFixed(1)}%`,    actual: `${onsEff.toFixed(1)}%`,                    pct: effPct, gap: effGap, suf: '%' },
                    ];
                    return (
                      <div style={{ flex: 2, borderRadius: 14, border: `1px solid ${C.cardBorder}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
                        {/* Blue header */}
                        <div style={{ background: '#1565C0', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="pc-card-icon">🆚</span>
                            <div>
                              <div className="font1" style={{ color: '#fff', fontSize: 15 }}>Target vs Actual</div>
                              <div className="font2" style={{ color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{outputSectionName}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="font4" style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>Curr Target vs Actuals</div>
                            <div className="font3" style={{ fontSize: 15, fontWeight: 800, color: headerValColor }}>
                              {Math.round(fCurrTargetPcs).toLocaleString()} vs {Math.round(outputPcs).toLocaleString()}
                              <span style={{ marginLeft: 7 }}>= {taEff.toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                        {/* Column headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: '105px 1fr 1fr 80px', padding: '6px 16px', background: C.card, borderBottom: `1px solid ${C.cardBorder}` }}>
                          <div />
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#1565C0', letterSpacing: 1, textAlign: 'center' }}>Target</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.amber,   letterSpacing: 1, textAlign: 'center' }}>Actual</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1, textAlign: 'center' }}>vs Target</div>
                        </div>
                        {/* Data rows */}
                        <div style={{ flex: 1, background: C.card, display: 'flex', flexDirection: 'column' }}>
                          {rows.map(({ icon, label, target, actual, pct, gap, suf }, i) => (
                            <div key={label} style={{ display: 'grid', gridTemplateColumns: '105px 1fr 1fr 80px', padding: '3px 16px', alignItems: 'center', borderBottom: i < rows.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                              {/* Label */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 16, color: C.textSub }}>{icon}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{label}</span>
                              </div>
                              {/* Target */}
                              <div style={{ padding: '0 10px' }}>
                                <div style={{ fontSize: 18, fontWeight: 700, color: '#1565C0', textAlign: 'center' }}>{target}</div>
                              </div>
                              {/* Actual */}
                              <div style={{ padding: '0 10px' }}>
                                <div style={{ fontSize: 18, fontWeight: 700, color: effColor(pct), textAlign: 'center' }}>{actual}</div>
                                <Bar pct={pct} color={effColor(pct)} />
                                <div style={{ fontSize: 9, color: C.textSub, textAlign: 'center', marginTop: 2 }}>{pct.toFixed(1)}%</div>
                              </div>
                              {/* VS Target */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                <CG pct={pct} />
                                <div style={{ fontSize: 10, fontWeight: 700, color: gc(gap) }}>
                                  {gap >= 0 ? '↑' : '↓'} {gap > 0 ? '+' : ''}{gap}{suf}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Feeding - WIP */}
                  {/* Feeding - WIP */}
                  {(() => {
                    const availMinsWithoutBreak = efficiencyData?.shiftDetails?.AvailableMinsWithOutBreakMins || 0;
                    const manDays = efficiencyData?.manDays || 0;
                    const estOutput = isSameDate && availMinsWithoutBreak > 0
                      ? Math.round(outputPcs + ((shiftTime - availMinsWithoutBreak) * (outputPcs / availMinsWithoutBreak)))
                      : Math.round(outputPcs);
                    const productivityPerPerson = manDays > 0 ? Math.round(outputPcs / manDays) : 0;
                    const SubCard = ({ label, value, bg, color, onClick }) => (
                      <div style={{ flex: 1, background: bg, borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: 1.1, textAlign: 'center' }}>{label}</div>
                        {onClick ? (
                          <button onClick={onClick} style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}>{value}</button>
                        ) : (
                          <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, textAlign: 'center' }}>{value}</div>
                        )}
                      </div>
                    );
                    return (
                      <div style={{ flex: 1, borderRadius: 14, border: `1px solid ${C.cardBorder}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
                        {/* Blue header */}
                        <div style={{ background: '#1565C0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="pc-card-icon">📦</span>
                          <span className="font1" style={{ color: '#fff' }}>Feeding — WIP</span>
                        </div>
                        {/* 2×2 sub-cards */}
                        <div style={{ flex: 1, background: C.card, padding: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                            <SubCard label="Feeding"               value={Math.round(s.LineIssuedPcs).toLocaleString()} bg="rgba(21,101,192,0.08)" color="#1565C0" />
                            <SubCard label="WIP"                   value={Math.round(wipPcs).toLocaleString()}          bg="rgba(245,158,11,0.10)" color={C.amber} onClick={() => { setWipReportData([]); setShowWipReport(true); }} />
                          </div>
                          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                            <SubCard label="Est. Output"           value={estOutput.toLocaleString()}                   bg="rgba(34,197,94,0.08)"  color={C.green} />
                            <SubCard label="Productivity / Person" value={productivityPerPerson.toLocaleString()}       bg="rgba(139,92,246,0.08)" color="#7c3aed" />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>

                {/* Active Production Order row */}
                {styleDetails.length > 0 && (
                  <Card title="Active Production Order" icon="📋">
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['Buyer', 'Style No', 'P.O. No', 'P.O. Date', 'Ex-Factory Date', 'Order Qty', 'Running Days', 'Cum. Prodn Pcs'].map((h, i) => (
                              <th key={h} style={{
                                fontSize: 12, fontWeight: 700, color: C.textSub,
                                letterSpacing: 0.5,
                                padding: '6px 14px 10px 0', textAlign: i >= 4 ? 'center' : 'left',
                                borderBottom: `2px solid ${C.cardBorder}`, whiteSpace: 'nowrap',
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {styleDetails.map((row, i) => (
                            <tr key={i} style={{ background: i % 2 === 1 ? C.tealDim : 'transparent' }}>
                              {[
                                row.Buyer,
                                row.StyleNo,
                                row.PoNo,
                                row.PoDate,
                                row.ExFactoryDate || '—',
                                (row.OrderQty || 0).toLocaleString(),
                                row.RunningDays,
                                (row.CumPrdnPcs || 0).toLocaleString(),
                              ].map((val, j) => (
                                <td key={j} style={{
                                  fontSize: 14, fontWeight: j >= 5 ? 700 : 500,
                                  color: C.text, padding: '10px 14px 10px 0',
                                  textAlign: j >= 4 ? 'center' : 'left',
                                }}>{val}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {/* Row 3 — Line Wise Hourly Production: flex:2 wide, left-aligned with Attendance card */}
                {lineWiseHourly.data.length > 0 && (() => {
                  const lwhData = lineWiseHourly.data;
                  const PALETTE = ['#1565C0','#D32F2F','#2E7D32','#E65100','#6A1B9A','#00695C','#0277BD','#558B2F','#4527A0','#6D4C41','#C62828','#00838F'];
                  const lineNames = [...new Set(lwhData.map(r => r.LineName))].sort();
                  const hours = lineWiseHourly.allHours.length > 0
                    ? lineWiseHourly.allHours
                    : [...new Set(lwhData.map(r => r.HrNo))].sort((a, b) => a - b);
                  const targetByLine = {};
                  lwhData.forEach(r => { targetByLine[r.LineName] = r.TargetPerHr || 0; });
                  const chartData = hours.map(hr => {
                    const row = { hr: `Hr ${hr}` };
                    lineNames.forEach(name => {
                      row[name] = 0;
                      row[`${name} Target`] = targetByLine[name] || 0;
                    });
                    lwhData.filter(r => r.HrNo === hr).forEach(r => { row[r.LineName] = r.OutputPcs; });
                    return row;
                  });
                  const grandTotal = lwhData.reduce((s, r) => s + (r.OutputPcs || 0), 0);
                  return (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                      <Card
                        title="Hourly Production"
                        icon="📈"
                        badge={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="font3" style={{ color: '#fff' }}>{grandTotal.toLocaleString()} pcs</span>
                            <button className="pc-view-report" onClick={() => setShowHourlyReport(true)}>View Report</button>
                          </div>
                        }
                        style={{ flex: 2, minWidth: 0 }}
                      >
                        <ResponsiveContainer width="100%" height={140}>
                          <ComposedChart data={chartData} margin={{ top: 16, right: 10, left: 0, bottom: 2 }} barCategoryGap="10%" barGap={1}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.cardBorder} vertical={false} />
                            <XAxis dataKey="hr" tick={{ fontSize: 10, fill: C.textSub }} axisLine={{ stroke: C.cardBorder }} tickLine={false} height={18} />
                            <YAxis tick={{ fontSize: 10, fill: C.textSub }} axisLine={false} tickLine={false} width={36} />
                            {lineNames.map((name, i) => [
                              <Bar key={`bar_${name}`} dataKey={name} radius={[3, 3, 0, 0]} maxBarSize={48}>
                                {chartData.map((entry, idx) => {
                                  const tgt = entry[`${name} Target`] || 0;
                                  const val = entry[name] || 0;
                                  const color = tgt === 0 ? PALETTE[i % PALETTE.length] : val >= tgt ? C.green : C.red;
                                  return <Cell key={`cell_${idx}`} fill={color} />;
                                })}
                                <LabelList
                                  dataKey={name}
                                  content={({ x, y, value, index, width }) => {
                                    if (!value) return <g key={`lbl_${index}`} />;
                                    const target = chartData[index]?.[`${name} Target`] || 0;
                                    const color = target === 0 ? C.text : value >= target ? C.green : C.red;
                                    return (
                                      <text key={`lbl_${index}`} x={x + (width || 0) / 2} y={y - 4} fill={color} fontSize={9} textAnchor="middle" fontWeight={700}>
                                        {value}
                                      </text>
                                    );
                                  }}
                                />
                              </Bar>,
                              <Line
                                key={`tgt_${name}`}
                                dataKey={`${name} Target`}
                                stroke={PALETTE[i % PALETTE.length]}
                                strokeWidth={2}
                                strokeDasharray="6 3"
                                dot={(props) => {
                                  const { cx, cy, index, value } = props;
                                  if (index !== chartData.length - 1 || !value) return <g key={`d_${index}`} />;
                                  return (
                                    <g key={`d_${index}`}>
                                      <circle cx={cx} cy={cy} r={3} fill={PALETTE[i % PALETTE.length]} />
                                      <text x={cx} y={cy - 7} fill={PALETTE[i % PALETTE.length]} fontSize={9} textAnchor="middle" fontWeight={700}>{value}</text>
                                    </g>
                                  );
                                }}
                                activeDot={false}
                              />,
                            ])}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </Card>
                      {/* OEE Card */}
                      {(() => {
                        const oeeR = 50, oeeCirc = 2 * Math.PI * oeeR;
                        const oeeCol = oeeScore >= 80 ? C.green : oeeScore >= 60 ? C.amber : C.red;
                        const oeeDashOffset = oeeCirc * (1 - Math.min(100, Math.max(0, oeeScore)) / 100);
                        return (
                          <div style={{ flex: 1, minWidth: 0, borderRadius: 14, border: `1px solid ${C.cardBorder}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', background: C.card }}>
                            {/* Header */}
                            <div style={{ padding: '9px 16px', background: '#1565C0', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="pc-card-icon">🎯</span>
                              <div>
                                <div className="font1" style={{ color: '#fff' }}>OEE Overview</div>
                                <div className="font2" style={{ color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Overall Equipment Effectiveness</div>
                              </div>
                            </div>
                            {/* Circular gauge */}
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0 6px' }}>
                              <svg width={120} height={120}>
                                <circle cx={60} cy={60} r={oeeR} fill="none" stroke={C.progressTrack} strokeWidth={8} />
                                <circle cx={60} cy={60} r={oeeR} fill="none" stroke={oeeCol} strokeWidth={8}
                                  strokeDasharray={oeeCirc} strokeDashoffset={oeeDashOffset}
                                  strokeLinecap="round" transform="rotate(-90, 60, 60)"
                                />
                                <text x={60} y={55} textAnchor="middle" dominantBaseline="central" fontSize={20} fontWeight={800} fill={oeeCol}>{oeeScore.toFixed(1)}%</text>
                                <text x={60} y={74} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600} fill={C.textSub}>OEE Score</text>
                              </svg>
                            </div>
                            {/* 3 metric boxes */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, padding: '0 10px 12px' }}>
                              {[
                                { label: 'Availability', value: oeeAvailability, color: C.green },
                                { label: 'Performance',  value: oeePerformance,  color: '#1565C0' },
                                { label: 'Quality',      value: oeeQuality,      color: C.amber },
                              ].map(({ label, value, color }) => (
                                <div key={label} style={{ background: C.tealDim, borderRadius: 8, padding: '8px 6px', textAlign: 'center', border: `1px solid ${C.cardBorder}` }}>
                                  <div style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1 }}>{value.toFixed(1)}%</div>
                                  <div style={{ fontSize: 9, fontWeight: 600, color: C.textSub, marginTop: 3, letterSpacing: 0.8 }}>{label}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* Row 4 — Histogram */}
                {histogramData.data.length > 0 && (() => {
                  const { data: hData, target, bpt, ucl, lcl } = histogramData;
                  const chartWidth = Math.max(700, hData.length * 68);
                  const barColor = (pcs) => pcs >= target ? '#22c55e' : pcs >= bpt ? '#eab308' : '#ef4444';
                  return (
                    <Card
                      title="Histogram — Operation-wise Production"
                      icon="📊"
                      badge={
                        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>▬ UCL — 100% ({target})</span>
                          <span style={{ fontSize: 11, color: '#ca8a04', fontWeight: 600 }}>▬ BPT — 80% ({bpt})</span>
                          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>▬ LCL — 60% ({lcl})</span>
                          <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>■ ≥ UCL</span>
                          <span style={{ fontSize: 11, color: '#eab308', fontWeight: 600 }}>■ ≥ BPT</span>
                          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>■ &lt; BPT</span>
                        </div>
                      }
                    >
                      <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                        <ComposedChart
                          width={chartWidth} height={420}
                          data={hData.map(r => ({ ...r, UCL: target, BPT: bpt, LCL: lcl }))}
                          margin={{ top: 24, right: 16, left: 0, bottom: 72 }}
                          barCategoryGap="20%"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={C.cardBorder} vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 9, fill: C.textSub, angle: -45, textAnchor: 'end' }}
                            axisLine={{ stroke: C.cardBorder }} tickLine={false}
                            height={72} interval={0}
                          />
                          <YAxis tick={{ fontSize: 10, fill: C.textSub }} axisLine={false} tickLine={false} width={40} />
                          <Tooltip
                            contentStyle={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 12 }}
                            labelStyle={{ color: C.text, fontWeight: 700 }}
                            itemStyle={{ color: C.textSub }}
                            formatter={(val, name) => [val.toLocaleString(), name]}
                          />
                          <Bar dataKey="pcs" name="Prod. Pcs" maxBarSize={40} radius={[3,3,0,0]}>
                            {hData.map((entry, i) => (
                              <Cell key={`hcell_${i}`} fill={barColor(entry.pcs)} />
                            ))}
                            <LabelList dataKey="pcs" position="top" style={{ fontSize: 9, fontWeight: 700, fill: C.textSub }} />
                          </Bar>
                          <Line dataKey="UCL" name={`UCL 100% (${target})`} stroke="#16a34a" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                          <Line dataKey="BPT" name={`BPT 80% (${bpt})`}     stroke="#ca8a04" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                          <Line dataKey="LCL" name={`LCL 60% (${lcl})`}     stroke="#ef4444" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                        </ComposedChart>
                      </div>
                    </Card>
                  );
                })()}

                {/* Row 5 — Top & Low Performing Operators */}
                {(topOperators.top.length > 0 || topOperators.bottom.length > 0) && (() => {
                  const OpTable = ({ rows, accent, label, icon }) => (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        background: accent, borderRadius: '10px 10px 0 0',
                        padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <span className="pc-card-icon" style={{ fontSize: 20 }}>{icon}</span>
                        <span className="font1" style={{ color: '#fff', letterSpacing: 0.5 }}>{label}</span>
                      </div>
                      <div style={{ border: `1px solid ${C.cardBorder}`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden', background: C.card }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: C.tealDim }}>
                              <th style={{ fontSize: 10, fontWeight: 700, color: C.textSub, padding: '7px 10px', textAlign: 'center', width: 36 }}>#</th>
                              <th style={{ fontSize: 10, fontWeight: 700, color: C.textSub, padding: '7px 10px', textAlign: 'left' }}>Operator</th>
                              <th style={{ fontSize: 10, fontWeight: 700, color: C.textSub, padding: '7px 10px', textAlign: 'center' }}>Emp No</th>
                              <th style={{ fontSize: 10, fontWeight: 700, color: C.textSub, padding: '7px 14px 7px 0', textAlign: 'right' }}>Eff %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, i) => (
                              <tr key={r.EmployeeCode} style={{ background: i % 2 === 0 ? 'transparent' : C.tealDim }}>
                                <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: 22, height: 22, borderRadius: '50%',
                                    background: accent, color: '#fff', fontSize: 11, fontWeight: 800,
                                  }}>{i + 1}</span>
                                </td>
                                <td style={{ padding: '9px 10px' }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.EmployeeName}</div>
                                  {r.OperationNames && (
                                    <div style={{ fontSize: 10, color: C.textSub, marginTop: 2 }}>{r.OperationNames}</div>
                                  )}
                                </td>
                                <td style={{ fontSize: 12, fontWeight: 500, color: C.textSub, textAlign: 'center', padding: '9px 10px' }}>{r.EmployeeNo}</td>
                                <td style={{ fontSize: 14, fontWeight: 800, color: accent, textAlign: 'right', padding: '9px 14px 9px 0' }}>{Number(r.Eff).toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                  return (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <OpTable rows={topOperators.top}    accent="#16a34a" label="Top Performers"    icon="👍" />
                      <OpTable rows={topOperators.bottom} accent="#dc2626" label="Needs Improvement" icon="👎" />
                    </div>
                  );
                })()}

                {/* Row 6 — Quality Info + DHU */}
                {dhuData.length > 0 && (() => {
                  const endLine = dhuData.find(r => r.ProcessCode === '004') || {};
                  const totalChecked = endLine.CheckedPcs || 0;
                  const totalDefects = (endLine.ReWorkPcs || 0) + (endLine.RejectedPcs || 0);
                  const totalDHU = totalChecked > 0 ? ((totalDefects / totalChecked) * 100).toFixed(1) : '—';
                  const dhuPct = (checked, defects) => checked > 0 ? ((defects / checked) * 100).toFixed(1) + '%' : '—';
                  const PINK   = '#f472b6';
                  const MAROON = '#991b1b';
                  const DYELLOW = '#ca8a04';
                  const qualRows = [
                    { label: 'EndLine CHK', pass: Math.round((s.LineCHKPassedPcs||0)+(s.LineCHKPassedPcsOT||0)), rw: Math.round(s.SectionCHKReworkPcs||0), rj: Math.round(s.SectionCHKRejectedPcs||0) },
                    { label: 'AQL',         pass: Math.round((s.LineAQLPassedPcs||0)+(s.LineAQLPassedPcsOT||0)), rw: Math.round(s.SectionAQLReworkPcs||0), rj: Math.round(s.SectionAQLRejectedPcs||0) },
                    { label: 'Finishing',   pass: Math.round((s.LineFINPassedPcs||0)+(s.LineFINPassedPcsOT||0)), rw: Math.round(s.SectionFINReworkPcs||0), rj: Math.round(s.SectionFINRejectedPcs||0) },
                    { label: 'Packing',     pass: Math.round((s.LinePKGPassedPcs||0)+(s.LinePKGPassedPcsOT||0)), rw: Math.round(s.SectionPKGReworkPcs||0), rj: Math.round(s.SectionPKGRejectedPcs||0) },
                  ];
                  return (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                      {/* Quality Info */}
                      <Card title="Quality Info" icon="💎" style={{ flex: 1, minWidth: 0 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              {['', 'Checked', 'Passed', 'RW', 'RJ'].map((h, i) => (
                                <th key={h} style={{
                                  fontSize: 11, fontWeight: 700, color: C.textSub,
                                  letterSpacing: 0.5,
                                  padding: '0 4px 10px', textAlign: i === 0 ? 'left' : 'center',
                                  borderBottom: `2px solid ${C.cardBorder}`,
                                }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {qualRows.map(({ label, pass, rw, rj }, i) => {
                              const checked = pass + rw + rj;
                              const fmt = (v) => checked > 0
                                ? `${v.toLocaleString()} (${Math.round((v / checked) * 100)}%)`
                                : v.toLocaleString();
                              return (
                                <tr key={label} style={{ background: i % 2 === 1 ? C.tealDim : 'transparent' }}>
                                  <td style={{ fontSize: 12, fontWeight: 600, color: C.text, padding: '9px 4px 9px 0', whiteSpace: 'nowrap' }}>{label}</td>
                                  <td style={{ fontSize: 13, fontWeight: 700, color: C.text,  textAlign: 'center', padding: '9px 4px' }}>{checked.toLocaleString()}</td>
                                  <td style={{ fontSize: 13, fontWeight: 700, color: C.green, textAlign: 'center', padding: '9px 4px' }}>{fmt(pass)}</td>
                                  <td style={{ fontSize: 13, fontWeight: 700, color: C.amber, textAlign: 'center', padding: '9px 4px' }}>{fmt(rw)}</td>
                                  <td style={{ fontSize: 13, fontWeight: 700, color: C.red,   textAlign: 'center', padding: '9px 4px' }}>{fmt(rj)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </Card>
                      {/* DHU */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <Card
                          title="DHU"
                          icon="🩺"
                          badge={<span className="font3" style={{ fontSize: 22, fontWeight: 800, color: '#f97316' }}>{totalDHU}{totalDHU !== '—' ? '%' : ''}</span>}
                          style={{ flex: 1 }}
                        >
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <th style={{ padding: '4px 12px 0 0', borderBottom: `2px solid ${C.cardBorder}` }} />
                                  <th style={{ fontSize: 11, fontWeight: 700, color: C.textSub, letterSpacing: 0.5, padding: '4px 10px 0', textAlign: 'center', borderBottom: `2px solid ${C.cardBorder}` }}>Checked Pcs</th>
                                  <th colSpan={2} style={{ fontSize: 11, fontWeight: 700, color: PINK, letterSpacing: 0.5, padding: '4px 10px 0', textAlign: 'center', borderBottom: `2px solid ${C.cardBorder}` }}>RW</th>
                                  <th colSpan={2} style={{ fontSize: 11, fontWeight: 700, color: MAROON, letterSpacing: 0.5, padding: '4px 10px 0', textAlign: 'center', borderBottom: `2px solid ${C.cardBorder}` }}>RJ</th>
                                </tr>
                                <tr>
                                  <th style={{ padding: '2px 12px 8px 0', borderBottom: `1px solid ${C.cardBorder}` }} />
                                  <th style={{ padding: '2px 10px 8px', borderBottom: `1px solid ${C.cardBorder}` }} />
                                  <th style={{ fontSize: 10, fontWeight: 600, color: C.textSub, textAlign: 'center', padding: '2px 10px 8px', borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: 'nowrap' }}>Defect Pcs</th>
                                  <th style={{ fontSize: 10, fontWeight: 600, color: C.textSub, textAlign: 'center', padding: '2px 10px 8px', borderBottom: `1px solid ${C.cardBorder}` }}>DHU %</th>
                                  <th style={{ fontSize: 10, fontWeight: 600, color: C.textSub, textAlign: 'center', padding: '2px 10px 8px', borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: 'nowrap' }}>Defect Pcs</th>
                                  <th style={{ fontSize: 10, fontWeight: 600, color: C.textSub, textAlign: 'center', padding: '2px 10px 8px', borderBottom: `1px solid ${C.cardBorder}` }}>DHU %</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[{ label: 'EndLine Checking', d: endLine }].map(({ label, d }, i) => (
                                  <tr key={label} style={{ background: i % 2 === 1 ? C.tealDim : 'transparent' }}>
                                    <td style={{ fontSize: 13, fontWeight: 600, color: C.text, padding: '10px 12px 10px 0', whiteSpace: 'nowrap' }}>{label}</td>
                                    <td style={{ fontSize: 14, fontWeight: 700, color: C.text,  textAlign: 'center', padding: '10px' }}>{(d.CheckedPcs  || 0).toLocaleString()}</td>
                                    <td style={{ fontSize: 14, fontWeight: 700, color: PINK,    textAlign: 'center', padding: '10px' }}>{(d.ReWorkPcs   || 0).toLocaleString()}</td>
                                    <td style={{ fontSize: 14, fontWeight: 700, color: PINK,    textAlign: 'center', padding: '10px' }}>{dhuPct(d.CheckedPcs, d.ReWorkPcs)}</td>
                                    <td style={{ fontSize: 14, fontWeight: 700, color: MAROON,  textAlign: 'center', padding: '10px' }}>{(d.RejectedPcs || 0).toLocaleString()}</td>
                                    <td style={{ fontSize: 14, fontWeight: 700, color: MAROON,  textAlign: 'center', padding: '10px' }}>{dhuPct(d.CheckedPcs, d.RejectedPcs)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Card>
                      </div>
                    </div>
                  );
                })()}

                {/* Row 7 — Defect Analysis + Top 5 RW Operators */}
                {(qcDefects.length > 0 || topRwOperators.length > 0) && (() => {
                  const BAR_COLORS = ['#ef4444','#f97316','#eab308','#3b82f6','#22c55e','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f59e0b'];
                  return (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                      {/* Defect Analysis */}
                      {qcDefects.length > 0 && (() => {
                        const total = qcDefects.reduce((s, r) => s + (r.DefectPcs || 0), 0);
                        return (
                          <Card
                            title="Defect Analysis"
                            icon="🔍"
                            badge={<span className="font2" style={{ color: 'rgba(255,255,255,0.85)' }}>Defect breakdown by type</span>}
                            style={{ flex: 1, minWidth: 0 }}
                          >
                            <div style={{ fontSize: 11, color: C.textSub, marginBottom: 12 }}>
                              Today's defect breakdown by type (Total: <b style={{ color: C.text }}>{total.toLocaleString()}</b> defects)
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {qcDefects.filter(row => (row.DefectPcs || 0) > 0).slice(0, 5).map((row, i) => {
                                const pct = total > 0 ? Math.round((row.DefectPcs / total) * 100) : 0;
                                const color = BAR_COLORS[i % BAR_COLORS.length];
                                return (
                                  <div key={row.DefectsDesc} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ minWidth: 140, fontSize: 12, fontWeight: 500, color: C.text, flexShrink: 0 }}>{row.DefectsDesc}</div>
                                    <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 6, height: 22, position: 'relative' }}>
                                      <div style={{
                                        width: `${pct}%`, minWidth: pct > 0 ? 6 : 0,
                                        height: '100%', background: color, borderRadius: 6,
                                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                                        paddingRight: pct >= 10 ? 6 : 0, overflow: 'hidden', transition: 'width 0.4s ease',
                                      }}>
                                        {pct >= 10 && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{pct}%</span>}
                                      </div>
                                      {pct > 0 && pct < 10 && (
                                        <span style={{ position: 'absolute', left: `calc(${pct}% + 5px)`, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{pct}%</span>
                                      )}
                                    </div>
                                    <div style={{ width: 36, fontSize: 11, fontWeight: 600, color: C.textSub, textAlign: 'right', flexShrink: 0 }}>{row.DefectPcs}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </Card>
                        );
                      })()}
                      {/* Top 5 RW Operators */}
                      {topRwOperators.length > 0 && (
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ background: '#1565C0', borderRadius: '10px 10px 0 0', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="pc-card-icon" style={{ fontSize: 18 }}>🔁</span>
                            <span className="font1" style={{ color: '#fff' }}>Top 5 RW Operators</span>
                            <span className="font2" style={{ color: 'rgba(255,255,255,0.75)', marginLeft: 4 }}>Sewing Operators</span>
                          </div>
                          <div style={{ border: `1px solid ${C.cardBorder}`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden', background: C.card }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: C.tealDim }}>
                                  {['#', 'Sewing Operator', 'RW Pcs'].map((h, i) => (
                                    <th key={h} style={{ fontSize: 10, fontWeight: 700, color: C.textSub, padding: '7px 10px', textAlign: i === 0 ? 'center' : i === 1 ? 'left' : 'right' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {topRwOperators.map((r, i) => (
                                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : C.tealDim }}>
                                    <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: '#f97316', color: '#fff', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                                    </td>
                                    <td style={{ padding: '9px 10px' }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.SewingOperator || '—'}</div>
                                      {r.SewingOperation && (
                                        <div style={{ fontSize: 10, color: C.textSub, marginTop: 2 }}>{r.SewingOperation}</div>
                                      )}
                                    </td>
                                    <td style={{ fontSize: 14, fontWeight: 800, color: '#f97316', textAlign: 'right', padding: '9px 14px 9px 0' }}>{Math.round(r.ReworkPcs || 0).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Row 7 — BreakDown & NoWork */}
                {(() => {
                  const BdNwTable = ({ rows, minsLabel }) => {
                    const total = rows.reduce((s, r) => s + (Number(r.BDMins) || 0), 0);
                    return (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: C.tealDim }}>
                            {['WsNo', 'Reason', minsLabel].map((h, i) => (
                              <th key={h} style={{
                                padding: '6px 10px', fontSize: 11, fontWeight: 700,
                                color: C.textSub, letterSpacing: 0.5,
                                textAlign: i === 0 ? 'center' : i === 1 ? 'left' : 'right',
                                borderBottom: `2px solid ${C.cardBorder}`,
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, ri) => (
                            <tr key={ri} style={{ background: ri % 2 === 1 ? C.tealDim : 'transparent' }}>
                              <td style={{ padding: '6px 10px', fontSize: 12, color: C.textSub, textAlign: 'center', borderBottom: `1px solid ${C.cardBorder}` }}>{r.WsNo}</td>
                              <td style={{ padding: '6px 10px', fontSize: 12, color: C.text, borderBottom: `1px solid ${C.cardBorder}` }}>{r.ReasonName}</td>
                              <td style={{ padding: '6px 10px', fontSize: 12, fontWeight: 600, color: C.text, textAlign: 'right', borderBottom: `1px solid ${C.cardBorder}` }}>{Number(r.BDMins).toFixed(0)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: `2px solid ${C.cardBorder}`, background: C.tealDim }}>
                            <td colSpan={2} style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, color: C.textSub }}>Total</td>
                            <td style={{ padding: '6px 10px', fontSize: 13, fontWeight: 800, color: C.teal, textAlign: 'right' }}>{total.toFixed(0)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    );
                  };
                  const bdTotal = bdNwData.bd.reduce((s, r) => s + (Number(r.BDMins) || 0), 0);
                  const nwTotal = bdNwData.nw.reduce((s, r) => s + (Number(r.BDMins) || 0), 0);
                  return (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <Card
                        title="BreakDown"
                        icon="🔧"
                        badge={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="font3" style={{ color: '#ffaaaa' }}>{bdTotal.toFixed(0)} Mins</span>
                            <button className="pc-view-report" onClick={() => setShowBdReport(true)}>View Report</button>
                          </div>
                        }
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <BdNwTable rows={bdNwData.bd} minsLabel="BD Mins" />
                      </Card>
                      <Card
                        title="NoWork"
                        icon="🕐"
                        badge={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="font3" style={{ color: '#fde68a' }}>{nwTotal.toFixed(0)} Mins</span>
                            <button className="pc-view-report" onClick={() => setShowNwReport(true)}>View Report</button>
                          </div>
                        }
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <BdNwTable rows={bdNwData.nw} minsLabel="NW Mins" />
                      </Card>
                    </div>
                  );
                })()}

                {/* Row 8+9 — DownTime Analysis (50%) + Alerts stacked (50%) */}
                {(() => {
                  const g = (f) => s[f] || 0;
                  const idleTime = g('SectionSWGIdleTime')+g('SectionSWGIdleTimeOT')+g('SectionCHKIdleTime')+g('SectionCHKIdleTimeOT')+g('SectionAQLIdleTime')+g('SectionAQLIdleTimeOT')+g('SectionFINIdleTime')+g('SectionFINIdleTimeOT')+g('SectionPKGIdleTime')+g('SectionPKGIdleTimeOT');
                  const nwTime  = g('SectionSWGNWTime')+g('SectionSWGNWTimeOT')+g('SectionCHKNWTime')+g('SectionCHKNWTimeOT')+g('SectionAQLNWTime')+g('SectionAQLNWTimeOT')+g('SectionFINNWTime')+g('SectionFINNWTimeOT')+g('SectionPKGNWTime')+g('SectionPKGNWTimeOT');
                  const bdTime  = g('SectionSWGBDTime')+g('SectionSWGBDTimeOT')+g('SectionCHKBDTime')+g('SectionCHKBDTimeOT')+g('SectionAQLBDTime')+g('SectionAQLBDTimeOT')+g('SectionFINBDTime')+g('SectionFINBDTimeOT')+g('SectionPKGBDTime')+g('SectionPKGBDTimeOT');
                  const rwTime  = g('SectionSWGRwTime')+g('SectionSWGRwTimeOT');
                  const oprNpt  = g('SectionSWGNPTimeOPR')+g('SectionSWGNPTimeOPROT')+g('SectionCHKNPTimeOPR')+g('SectionCHKNPTimeOPROT')+g('SectionAQLNPTimeOPR')+g('SectionAQLNPTimeOPROT')+g('SectionFINNPTimeOPR')+g('SectionFINNPTimeOPROT')+g('SectionPKGNPTimeOPR')+g('SectionPKGNPTimeOPROT');
                  const lineNpt = g('SectionSWGNPTimeLine')+g('SectionSWGNPTimeLineOT')+g('SectionCHKNPTimeLine')+g('SectionCHKNPTimeLineOT')+g('SectionAQLNPTimeLine')+g('SectionAQLNPTimeLineOT')+g('SectionFINNPTimeLine')+g('SectionFINNPTimeLineOT')+g('SectionPKGNPTimeLine')+g('SectionPKGNPTimeLineOT');
                  const clockedMins = Math.round(manDayMinutes * activeWS);
                  const pct = (val) => clockedMins > 0 ? Math.round((val / clockedMins) * 100) : 0;
                  const fmt = (val) => Math.round(val).toLocaleString();
                  const items = [
                    { label: 'Idle Time',  value: idleTime, color: '#3b82f6' },
                    { label: 'NoWork Time',value: nwTime,   color: '#f97316' },
                    { label: 'BD Time',    value: bdTime,   color: '#ef4444' },
                    { label: 'RW Time',    value: rwTime,   color: '#8b5cf6' },
                    { label: 'OPR NPT',   value: oprNpt,   color: '#06b6d4', onClick: () => { setOprNptReportData([]); setShowOprNptReport(true); } },
                    { label: 'Line NPT',   value: lineNpt,  color: '#22c55e' },
                  ];

                  const openAlert = (alertType, reportType, title) => {
                    setAlertReportConfig({ alertType, reportType, title });
                    setAlertReportData([]);
                    setShowAlertReport(true);
                  };
                  const AlertCard = ({ title, received, attended, alertType, accentColor, icon }) => {
                    const pending = received - attended > 0 ? received - attended : 0;
                    return (
                    <Card
                      title={title}
                      icon={icon}
                      style={{ flex: 1 }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
                        <div style={{ background: C.tealDim, borderRadius: 10, padding: '10px 10px', border: `1px solid ${C.cardBorder}`, textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1.1, marginBottom: 6 }}>Received</div>
                          <button onClick={() => openAlert(alertType, 'received', `${title} — Alert Received Report`)}
                            style={{ fontSize: 24, fontWeight: 800, color: accentColor, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0, display: 'block', width: '100%', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}>
                            {Math.round(received)}
                          </button>
                          <div style={{ fontSize: 10, color: C.textSub, marginTop: 4 }}>click to view</div>
                        </div>
                        <div style={{ background: C.tealDim, borderRadius: 10, padding: '10px 10px', border: `1px solid ${C.cardBorder}`, textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1.1, marginBottom: 6 }}>Attended</div>
                          <button onClick={() => openAlert(alertType, 'attended', `${title} — Alert Attended Report`)}
                            style={{ fontSize: 24, fontWeight: 800, color: received > 0 ? (attended >= received ? C.green : C.amber) : C.text, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0, display: 'block', width: '100%', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}>
                            {Math.round(attended)}
                          </button>
                          <div style={{ fontSize: 10, color: C.textSub, marginTop: 4 }}>click to view</div>
                        </div>
                        <div style={{ background: pending > 0 ? C.redDim : C.tealDim, borderRadius: 10, padding: '10px 10px', border: `1px solid ${pending > 0 ? C.red : C.cardBorder}`, textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1.1, marginBottom: 6 }}>Pending</div>
                          <button
                            onClick={() => openAlert(alertType, 'pending', `${title} — Pending Alerts`)}
                            style={{ fontSize: 24, fontWeight: 800, color: pending > 0 ? C.red : C.green, lineHeight: 1, background: 'none', border: 'none', padding: 0, display: 'block', width: '100%',
                              cursor: 'pointer',
                              textDecoration: 'underline dotted', textUnderlineOffset: 4 }}>
                            {Math.round(pending)}
                          </button>
                          <div style={{ fontSize: 10, color: C.textSub, marginTop: 4 }}>click to view</div>
                        </div>
                      </div>
                    </Card>
                    );
                  };

                  return (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                      {/* Left: DownTime Analysis — 50% */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <Card
                          title="DownTime Analysis"
                          icon="📉"
                          badge={<span className="font2" style={{ color: 'rgba(255,255,255,0.85)' }}>Lost time breakdown</span>}
                          style={{ flex: 1 }}
                        >
                          <div style={{ fontSize: 11, color: C.textSub, marginBottom: 10 }}>
                            Clocked Minutes : <b style={{ color: C.text }}>{clockedMins.toLocaleString()}</b>
                            &nbsp;&nbsp;(ManDay {Math.round(manDayMinutes)} mins × {activeWS} active WS)
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {items.map(({ label, value, color, onClick }) => {
                              const p = pct(value);
                              return (
                                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{ minWidth: 100, fontSize: 12, fontWeight: 500, color: C.text, flexShrink: 0 }}>{label}</div>
                                  <div style={{ flex: 1, background: C.tealDim, borderRadius: 6, height: 22, position: 'relative' }}>
                                    <div style={{ width: `${p}%`, minWidth: p > 0 ? 6 : 0, height: '100%', background: color, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: p >= 10 ? 6 : 0, overflow: 'hidden', transition: 'width 0.4s ease' }}>
                                      {p >= 10 && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{p}%</span>}
                                    </div>
                                    {p > 0 && p < 10 && (
                                      <span style={{ position: 'absolute', left: `calc(${p}% + 5px)`, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color: color, whiteSpace: 'nowrap' }}>{p}%</span>
                                    )}
                                  </div>
                                  <div
                                    onClick={onClick}
                                    style={{ width: 50, fontSize: 11, fontWeight: 600, textAlign: 'right', flexShrink: 0,
                                      color: onClick ? color : C.textSub,
                                      cursor: onClick ? 'pointer' : 'default',
                                      textDecoration: onClick ? 'underline dotted' : 'none',
                                      textUnderlineOffset: 3,
                                    }}
                                  >{fmt(value)}</div>
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      </div>
                      {/* Right: Alerts stacked — 50% */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <AlertCard title="Maintenance Alerts" received={s.MechAlertReceived || 0} attended={s.MechAlertAttended || 0} alertType="mech" accentColor="#f97316" icon="🔔" />
                        <AlertCard title="Supervisor Alerts"  received={s.SuprAlertReceived || 0} attended={s.SuprAlertAttended || 0} alertType="supr" accentColor="#8b5cf6" icon="📢" />
                      </div>
                    </div>
                  );
                })()}

              </div>
            )}
          </div>
        </div>
      </div>
      {/* Hourly Production — Operator / Operation Wise Report Modal */}
      {showHourlyReport && (() => {
        // Build pivot: group by operation first, then by employee within each operation
        const rawData = oprReportData;
        const dataHrs = [...new Set(rawData.map(r => Number(r.HrNo)))].filter(h => h > 0).sort((a, b) => a - b);
        const allHrs = lineWiseHourly.allHours.length > 0 ? lineWiseHourly.allHours : dataHrs;

        // Employee-level rows keyed by opr+employee
        const empMap = {};
        const oprOrder = [];
        const oprEmpMap = {};
        rawData.forEach(r => {
          const oprKey = `${r.OprSeqNo}|${r.GroupCode}|${r.OperationCode}`;
          const empKey = `${oprKey}|${r.EmployeeCode}`;
          if (!empMap[empKey]) {
            empMap[empKey] = { GroupName: r.GroupName, OperationName: r.OperationName, OprSeqNo: r.OprSeqNo, EmployeeName: r.EmployeeName, hrs: {} };
            if (!oprEmpMap[oprKey]) { oprEmpMap[oprKey] = []; oprOrder.push(oprKey); }
            oprEmpMap[oprKey].push(empKey);
          }
          empMap[empKey].hrs[Number(r.HrNo)] = (empMap[empKey].hrs[Number(r.HrNo)] || 0) + (Number(r.SewnPcs) || 0);
        });
        // oprGroups: [{oprKey, employees:[rowObj, ...]}, ...]
        const oprGroups = oprOrder.map(oprKey => ({ oprKey, employees: oprEmpMap[oprKey].map(k => empMap[k]) }));
        const rowTotal = (row) => allHrs.reduce((s, h) => s + (row.hrs[h] || 0), 0);

        const th = (content, extra = {}) => ({
          padding: '8px 10px', fontSize: 11, fontWeight: 700, color: C.textSub,
          letterSpacing: 0.5,
          background: C.tealDim, borderBottom: `2px solid ${C.cardBorder}`,
          whiteSpace: 'nowrap', textAlign: 'center', ...extra,
        });
        const td = (extra = {}) => ({
          padding: '6px 10px', fontSize: 12, borderBottom: `1px solid ${C.cardBorder}`,
          whiteSpace: 'nowrap', textAlign: 'center', ...extra,
        });

        const lineName = lines.find(l => l.LineCode === lineCode)?.ShortName || lineCode;
        const shiftName = shifts.find(s => s.ShiftCode === shift)?.ShiftName || shift;
        const [yy, mo, dd2] = dateInput.split('-');
        const displayDate = `${dd2}/${mo}/${yy}`;

        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowHourlyReport(false); }}
          >
            <div style={{
              background: C.card, borderRadius: 16, padding: '24px 24px 16px',
              width: 'min(98vw, 1100px)', maxHeight: '90vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 48px rgba(0,0,0,0.32)', border: `1px solid ${C.cardBorder}`,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: C.teal, letterSpacing: 0.3 }}>
                    Hourly Production
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 2 }}>
                    Operation / Operator Wise Report
                  </div>
                  <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>
                    {lineName} &nbsp;|&nbsp; {shiftName} &nbsp;|&nbsp; {displayDate}
                  </div>
                </div>
                <button
                  onClick={() => setShowHourlyReport(false)}
                  style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.textSub }}
                >✕ Close</button>
              </div>

              {/* Body */}
              {oprReportLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, fontSize: 14 }}>
                  Loading...
                </div>
              ) : oprGroups.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, fontSize: 14 }}>
                  No data available
                </div>
              ) : (
                <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
                  <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', width: 'max-content' }}>
                    <thead>
                      <tr>
                        <th style={th({ textAlign: 'left', position: 'sticky', left: 0, zIndex: 2 })}>Group</th>
                        <th style={th({ textAlign: 'left' })}>Operation</th>
                        <th style={th()}>Seq</th>
                        <th style={th({ textAlign: 'left' })}>Operator</th>
                        {allHrs.map(h => <th key={h} style={th()}>Hr {h}</th>)}
                        <th style={th({ color: C.teal })}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oprGroups.map((opr, oi) => {
                        const span = opr.employees.length;
                        const stripe = oi % 2 === 1 ? C.tealDim : 'transparent';
                        const stripeSolid = oi % 2 === 1 ? C.tealDim : C.card;
                        const subTotalHrs = allHrs.map(h => opr.employees.reduce((s, row) => s + (row.hrs[h] || 0), 0));
                        const subTotal = subTotalHrs.reduce((s, v) => s + v, 0);
                        const subTotalBg = oi % 2 === 1 ? '#1e3a3a' : '#1a2e2e';
                        return [
                          ...opr.employees.map((row, ei) => (
                            <tr key={`${oi}_${ei}`} style={{ background: stripe }}>
                              {ei === 0 && (
                                <td rowSpan={span} style={td({ textAlign: 'left', fontWeight: 600, color: C.text, verticalAlign: 'middle', position: 'sticky', left: 0, zIndex: 1, background: stripeSolid, borderRight: `1px solid ${C.cardBorder}` })}>{row.GroupName}</td>
                              )}
                              {ei === 0 && (
                                <td rowSpan={span} style={td({ textAlign: 'left', color: C.text, verticalAlign: 'middle' })}>{row.OperationName}</td>
                              )}
                              {ei === 0 && (
                                <td rowSpan={span} style={td({ color: C.textSub, verticalAlign: 'middle' })}>{row.OprSeqNo}</td>
                              )}
                              <td style={td({ textAlign: 'left', color: C.text })}>{row.EmployeeName}</td>
                              {allHrs.map(h => {
                                const val = row.hrs[h] || 0;
                                return (
                                  <td key={h} style={td({ fontWeight: 400, color: val > 0 ? C.text : C.cardBorder })}>
                                    {val > 0 ? val : '—'}
                                  </td>
                                );
                              })}
                              <td style={td({ fontWeight: 400, color: C.teal })}>{rowTotal(row).toLocaleString()}</td>
                            </tr>
                          )),
                          ...(span > 1 ? [
                            <tr key={`${oi}_sub`} style={{ background: '#60a5fa', borderTop: `2px solid #60a5fa` }}>
                              <td colSpan={3} style={td({ textAlign: 'right', fontWeight: 700, color: '#1e3a5f', fontSize: 11, letterSpacing: 0.5, position: 'sticky', left: 0, zIndex: 1, background: '#60a5fa' })}>Sub Total</td>
                              <td style={td({ background: '#60a5fa' })} />
                              {subTotalHrs.map((val, i) => (
                                <td key={i} style={td({ fontWeight: 700, color: val > 0 ? '#1e3a5f' : '#94a3b8', background: '#60a5fa' })}>
                                  {val > 0 ? val.toLocaleString() : '—'}
                                </td>
                              ))}
                              <td style={td({ fontWeight: 800, color: '#1e3a5f', background: '#60a5fa' })}>{subTotal.toLocaleString()}</td>
                            </tr>
                          ] : []),
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* BreakDown / NoWork Detail Report Modal */}
      {[
        { show: showBdReport, setShow: setShowBdReport, data: bdReportData, loading: bdReportLoading, title: 'BreakDown', minsLabel: 'BD Mins', accentColor: '#ef4444' },
        { show: showNwReport, setShow: setShowNwReport, data: nwReportData, loading: nwReportLoading, title: 'NoWork',    minsLabel: 'NW Mins', accentColor: '#f59e0b' },
      ].map(({ show, setShow, data, loading, title, minsLabel, accentColor }) =>
        show ? (
          <div
            key={title}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShow(false); }}
          >
            <div style={{ background: C.card, borderRadius: 16, padding: '24px 24px 16px', width: 'min(98vw, 1100px)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 48px rgba(0,0,0,0.32)', border: `1px solid ${C.cardBorder}` }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: accentColor }}>{title}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 2 }}>Detail Report</div>
                  <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>
                    {lines.find(l => l.LineCode === lineCode)?.ShortName || lineCode}
                    &nbsp;|&nbsp;{shifts.find(s => s.ShiftCode === shift)?.ShiftName || shift}
                    &nbsp;|&nbsp;{(() => { const [yy,mo,dd2] = dateInput.split('-'); return `${dd2}/${mo}/${yy}`; })()}
                  </div>
                </div>
                <button onClick={() => setShow(false)} style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.textSub }}>✕ Close</button>
              </div>

              {/* Body */}
              {loading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, fontSize: 14 }}>Loading...</div>
              ) : data.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, fontSize: 14 }}>No data available</div>
              ) : (
                <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
                  <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', width: 'max-content' }}>
                    <thead>
                      <tr>
                        {['WsNo', 'Emp No', 'Employee Name', 'Reason', 'Start Time', 'End Time', minsLabel].map((h, i) => (
                          <th key={h} style={{
                            padding: '8px 10px', fontSize: 11, fontWeight: 700, color: C.textSub,
                            letterSpacing: 0.5,
                            background: C.tealDim, borderBottom: `2px solid ${C.cardBorder}`,
                            whiteSpace: 'nowrap',
                            textAlign: i === 0 ? 'center' : i >= 3 ? 'right' : 'left',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((r, ri) => (
                        <tr key={ri} style={{ background: ri % 2 === 1 ? C.tealDim : 'transparent' }}>
                          <td style={{ padding: '6px 10px', fontSize: 12, color: C.textSub, textAlign: 'center', borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: 'nowrap' }}>{r.WsNo}</td>
                          <td style={{ padding: '6px 10px', fontSize: 12, color: C.textSub, textAlign: 'left',   borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: 'nowrap' }}>{r.EmployeeNo}</td>
                          <td style={{ padding: '6px 10px', fontSize: 12, color: C.text,    textAlign: 'left',   borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: 'nowrap' }}>{r.EmployeeName}</td>
                          <td style={{ padding: '6px 10px', fontSize: 12, color: C.text,    textAlign: 'left',   borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: 'nowrap' }}>{r.ReasonName}</td>
                          <td style={{ padding: '6px 10px', fontSize: 12, color: C.textSub, textAlign: 'right',  borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: 'nowrap' }}>{r.StartTime}</td>
                          <td style={{ padding: '6px 10px', fontSize: 12, color: C.textSub, textAlign: 'right',  borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: 'nowrap' }}>{r.EndTime}</td>
                          <td style={{ padding: '6px 10px', fontSize: 12, fontWeight: 600, color: accentColor, textAlign: 'right', borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: 'nowrap' }}>{Number(r.BDMins).toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null
      )}

      {/* WIP — Operation Wise Chart Modal */}
      {showWipReport && (() => {
        const lineName  = lines.find(l => l.LineCode === lineCode)?.ShortName || lineCode;
        const maxLabelLen = Math.max(...wipReportData.map(r => (r.name || '').length), 1);
        const bottomMargin = Math.min(160, Math.max(100, maxLabelLen * 4));
        const chartW    = Math.max(700, wipReportData.length * 70);
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setShowWipReport(false); }}
          >
            <div style={{ background: C.card, borderRadius: 16, padding: '22px 24px 18px', width: 'min(98vw, 1000px)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 48px rgba(0,0,0,0.32)', border: `1px solid ${C.cardBorder}` }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.amber }}>WIP — Operation Wise</div>
                  <div style={{ fontSize: 11, color: C.textSub, marginTop: 3 }}>{lineName} &nbsp;|&nbsp; Work In Progress by operation</div>
                </div>
                <button onClick={() => setShowWipReport(false)} style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.textSub }}>✕ Close</button>
              </div>
              {/* Body */}
              {wipReportLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, fontSize: 14 }}>Loading...</div>
              ) : wipReportData.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, fontSize: 14 }}>No WIP data available</div>
              ) : (
                <div style={{ overflowX: 'auto', flex: 1 }}>
                  <BarChart width={chartW} height={400} data={wipReportData} margin={{ top: 22, right: 16, left: 0, bottom: bottomMargin }} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke={C.cardBorder} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: C.textSub, angle: -45, textAnchor: 'end' }} axisLine={{ stroke: C.cardBorder }} tickLine={false} height={bottomMargin} interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: C.textSub }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip
                      contentStyle={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: C.text, fontWeight: 700 }}
                      formatter={(v) => [v.toLocaleString(), 'WIP Pcs']}
                    />
                    <Bar dataKey="pcs" name="WIP Pcs" radius={[4, 4, 0, 0]} maxBarSize={48} fill={C.amber}>
                      <LabelList dataKey="pcs" position="top" style={{ fontSize: 10, fontWeight: 700, fill: C.textSub }} />
                    </Bar>
                  </BarChart>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* OPR NPT Report Modal */}
      {showOprNptReport && (() => {
        const lineName  = lines.find(l => l.LineCode === lineCode)?.ShortName || lineCode;
        const shiftName = shifts.find(s => s.ShiftCode === shift)?.ShiftName || shift;
        const [yy, mo, dd2] = dateInput.split('-');
        const displayDate = `${dd2}/${mo}/${yy}`;
        const totalMins = oprNptReportData.reduce((a, r) => a + (r.totalMins || 0), 0);
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setShowOprNptReport(false); }}>
            <div style={{ background: C.card, borderRadius: 16, padding: '24px 24px 16px', width: 'min(98vw, 680px)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 48px rgba(0,0,0,0.32)', border: `1px solid ${C.cardBorder}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#06b6d4' }}>OPR NPT Report</div>
                  <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>{lineName} &nbsp;|&nbsp; {shiftName} &nbsp;|&nbsp; {displayDate}</div>
                </div>
                <button onClick={() => setShowOprNptReport(false)}
                  style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.textSub }}>
                  ✕ Close
                </button>
              </div>
              {oprNptReportLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, fontSize: 14 }}>Loading...</div>
              ) : oprNptReportData.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, fontSize: 14 }}>No OPR NPT data available</div>
              ) : (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Break / Period', 'Type', 'Operators', 'NPT Mins'].map((h, i) => (
                          <th key={h} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: C.textSub, letterSpacing: 0.5, background: C.tealDim, borderBottom: `2px solid ${C.cardBorder}`, textAlign: i >= 2 ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {oprNptReportData.map((r, i) => (
                        <tr key={i} style={{ background: i % 2 === 1 ? C.tealDim : 'transparent' }}>
                          <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 600, color: C.text, borderBottom: `1px solid ${C.cardBorder}` }}>{r.breakName}</td>
                          <td style={{ padding: '9px 12px', fontSize: 13, color: C.textSub, borderBottom: `1px solid ${C.cardBorder}` }}>{r.type}</td>
                          <td style={{ padding: '9px 12px', fontSize: 14, fontWeight: 700, color: C.text, textAlign: 'center', borderBottom: `1px solid ${C.cardBorder}` }}>{r.noOfOprs}</td>
                          <td style={{ padding: '9px 12px', fontSize: 14, fontWeight: 700, color: '#06b6d4', textAlign: 'center', borderBottom: `1px solid ${C.cardBorder}` }}>{r.totalMins}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${C.cardBorder}`, background: C.tealDim }}>
                        <td colSpan={3} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: C.textSub }}>Total OPR NPT</td>
                        <td style={{ padding: '8px 12px', fontSize: 15, fontWeight: 800, color: '#06b6d4', textAlign: 'center' }}>{totalMins}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Alert Received / Attended Report Modal */}
      {showAlertReport && (() => {
        const isAttended = alertReportConfig.reportType === 'attended';
        const accentColor = alertReportConfig.alertType === 'supr' ? '#8b5cf6' : '#f97316';
        const [yy, mo, dd2] = dateInput.split('-');
        const displayDate = `${dd2}/${mo}/${yy}`;
        const lineName  = lines.find(l => l.LineCode === lineCode)?.ShortName || lineCode;
        const shiftName = shifts.find(s => s.ShiftCode === shift)?.ShiftName || shift;

        const receivedCols  = ['Section Name', 'Process', 'W.S.No', 'Operator No', 'Operator Name', 'Alert Received Time', 'Attended'];
        const attendedCols  = ['Section Name', 'Process', 'W.S.No', 'Operator No', 'Operator Name', 'Alert Received Time', 'Mechanic No', 'Mechanic Name', 'Alert Attended Time', 'Diff Time'];
        const columns = isAttended ? attendedCols : receivedCols;

        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowAlertReport(false); }}
          >
            <div style={{ background: C.card, borderRadius: 16, padding: '24px 24px 16px', width: 'min(98vw, 1100px)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 48px rgba(0,0,0,0.32)', border: `1px solid ${C.cardBorder}` }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: accentColor }}>{alertReportConfig.title}</div>
                  <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>
                    {lineName} &nbsp;|&nbsp; {shiftName} &nbsp;|&nbsp; {displayDate}
                  </div>
                </div>
                <button
                  onClick={() => setShowAlertReport(false)}
                  style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.textSub }}
                >✕ Close</button>
              </div>
              {/* Body */}
              {alertReportLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, fontSize: 14 }}>Loading...</div>
              ) : alertReportData.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, fontSize: 14 }}>No data available</div>
              ) : (
                <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
                  <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', width: '100%' }}>
                    <thead>
                      <tr>
                        {columns.map((h, i) => (
                          <th key={h} style={{
                            padding: '8px 10px', fontSize: 11, fontWeight: 700, color: C.textSub,
                            letterSpacing: 0.5,
                            background: C.tealDim, borderBottom: `2px solid ${C.cardBorder}`,
                            whiteSpace: 'nowrap',
                            textAlign: ['W.S.No', 'Operator No', 'Mechanic No', 'Diff Time'].includes(h) ? 'center' : 'left',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {alertReportData.map((r, ri) => (
                        <tr key={ri} style={{ background: ri % 2 === 1 ? C.tealDim : 'transparent' }}>
                          {columns.map((col, ci) => {
                            const val = r[col] ?? '—';
                            const center = ['W.S.No', 'Operator No', 'Mechanic No', 'Diff Time'].includes(col);
                            const isBool = col === 'Attended';
                            const color = isBool
                              ? (val === 'Yes' ? C.green : C.red)
                              : col === 'Diff Time' ? accentColor : C.text;
                            return (
                              <td key={ci} style={{
                                padding: '6px 10px', fontSize: 12,
                                color, fontWeight: isBool || col === 'Diff Time' ? 700 : 400,
                                textAlign: center ? 'center' : 'left',
                                borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: 'nowrap',
                              }}>{val}</td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

    </ThemeCtx.Provider>
  );
}
