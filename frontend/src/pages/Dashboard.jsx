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
  text: '#1565C0', textSub: '#1976D2', textMuted: '#64B5F6',
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
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function toDisplayDate(s) { const [y, m, d] = s.split('-'); return `${d}/${MONTHS[parseInt(m,10)-1]}/${y}`; }
function fmtDate(v) {
  if (!v) return '—';
  // SQL Server format 103: dd/mm/yyyy
  const f103 = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (f103) return `${f103[1]}/${MONTHS[parseInt(f103[2],10)-1]}/${f103[3]}`;
  // ISO: yyyy-mm-dd[T...]
  const iso = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${MONTHS[parseInt(iso[2],10)-1]}/${iso[1]}`;
  const d = new Date(v);
  if (isNaN(d)) return v;
  return `${String(d.getDate()).padStart(2,'0')}/${MONTHS[d.getMonth()]}/${d.getFullYear()}`;
}
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
function Card({ title, subtitle, icon, badge, style, bodyStyle, headerBg, children }) {
  const C = useContext(ThemeCtx);
  return (
    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.cardBorder}`, overflow: 'hidden', ...style }}>
      <div style={{
        background: headerBg || '#1565C0', borderRadius: '10px 10px 0 0',
        padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {icon && <span style={{ fontSize: 17 }}>{icon}</span>}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>{subtitle}</div>}
        </div>
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
        height: 32, boxSizing: 'border-box',
      }}>{children}</div>
    </div>
  );
}

const VT_LABELS = [['4','Style'],['3','Style-Po'],['2','Style-Po-Color'],['1','Style-Po-Color-Size']];

// Each pipeline stage has its own accent color; sectionStart marks the first group of a new stage
const DPR_DATA_GROUPS = [
  { label: 'Cutting',    color: '#b45309', sectionStart: true,  cols: [{ label: 'Today', f: 'CuttingToday', wip: false }, { label: 'Cum', f: 'CuttingCum', wip: false }, { label: 'Bal',  f: 'CuttingBalance', wip: true }] },
  { label: 'Feeding',    color: '#6d28d9', sectionStart: true,  cols: [{ label: 'Today', f: 'FeedingToday', wip: false }, { label: 'Cum', f: 'FeedingCum',  wip: false }, { label: 'WIP',  f: 'FeedingWIP',     wip: true }] },
  { label: 'Sewing',     color: '#1565C0', sectionStart: true,  cols: [{ label: 'Today', f: 'SewnToday',    wip: false }, { label: 'Cum', f: 'SewnCum',      wip: false }, { label: 'WIP',  f: 'SewnWIP',         wip: true }] },
  { label: 'QC Passed',  color: '#0891b2', sectionStart: true,  cols: [{ label: 'Today', f: 'ChkPassedToday', wip: false }, { label: 'Cum', f: 'ChkPassedCum', wip: false }] },
  { label: 'QC Rej',     color: '#0e7490', sectionStart: false, cols: [{ label: 'Today', f: 'ChkRejToday',   wip: false }, { label: 'Cum', f: 'ChkRejCum',    wip: false }] },
  { label: 'QC WIP',     color: '#155e75', sectionStart: false, cols: [{ label: 'WIP',   f: 'ChkWIP',        wip: true  }] },
  { label: 'AQL Passed', color: '#047857', sectionStart: true,  cols: [{ label: 'Today', f: 'AQLPassedToday', wip: false }, { label: 'Cum', f: 'AQLPassedCum', wip: false }] },
  { label: 'AQL Rej',    color: '#065f46', sectionStart: false, cols: [{ label: 'Today', f: 'AQLRejToday',    wip: false }, { label: 'Cum', f: 'AQLRejCum',    wip: false }] },
  { label: 'AQL WIP',    color: '#064e3b', sectionStart: false, cols: [{ label: 'WIP',   f: 'AQLWIP',         wip: true  }] },
  { label: 'Fin Passed', color: '#9a3412', sectionStart: true,  cols: [{ label: 'Today', f: 'FinPassedToday', wip: false }, { label: 'Cum', f: 'FinPassedCum', wip: false }] },
  { label: 'Fin Rej',    color: '#7c2d12', sectionStart: false, cols: [{ label: 'Today', f: 'FinRejToday',    wip: false }, { label: 'Cum', f: 'FinRejCum',    wip: false }] },
  { label: 'Fin WIP',    color: '#6c2a10', sectionStart: false, cols: [{ label: 'WIP',   f: 'FinWIP',         wip: true  }] },
  { label: 'Packing',    color: '#be185d', sectionStart: true,  cols: [{ label: 'Today', f: 'PkgToday',       wip: false }, { label: 'Cum', f: 'PkgCum',       wip: false }, { label: 'WIP', f: 'PkgWIP',         wip: true }] },
  { label: 'Despatch',   color: '#1e40af', sectionStart: true,  cols: [{ label: 'Today', f: 'DespatchToday',  wip: false }, { label: 'Cum', f: 'DespatchCum',  wip: false }, { label: 'WIP', f: 'DespatchWIP',    wip: true }] },
];
const DPR_ALL_DATA_FIELDS = DPR_DATA_GROUPS.flatMap(g => g.cols.map(c => c.f));
// Flat list of every data column annotated with its group color, section-start flag, and wip flag
const DPR_FLAT_COLS = DPR_DATA_GROUPS.flatMap(g =>
  g.cols.map((c, ci) => ({ ...c, color: g.color, sectionStart: ci === 0 && g.sectionStart }))
);

const DPR_ID_COLS = {
  '1': [{ label: 'Style No', f: 'StyleNo' }, { label: 'P.O. No', f: 'PoNo' }, { label: 'Destination', f: 'DestinationName' }, { label: 'Color', f: 'ColorName' }, { label: 'Size', f: 'SizeName' }, { label: 'Order Qty', f: 'OrderQty', num: true }],
  '2': [{ label: 'Style No', f: 'StyleNo' }, { label: 'P.O. No', f: 'PoNo' }, { label: 'Destination', f: 'DestinationName' }, { label: 'Color', f: 'ColorName' }, { label: 'Order Qty', f: 'OrderQty', num: true }],
  '3': [{ label: 'Style No', f: 'StyleNo' }, { label: 'P.O. No', f: 'PoNo' }, { label: 'Destination', f: 'DestinationName' }, { label: 'Order Qty', f: 'OrderQty', num: true }],
  '4': [{ label: 'Style No', f: 'StyleNo' }, { label: 'Order Qty', f: 'OrderQty', num: true }],
};

function dprSumRows(rows) {
  return DPR_ALL_DATA_FIELDS.reduce(
    (acc, f) => { acc[f] = rows.reduce((s, r) => s + (Number(r[f]) || 0), 0); return acc; },
    { OrderQty: rows.reduce((s, r) => s + (Number(r.OrderQty) || 0), 0) }
  );
}

function DPRModal({ open, onClose, rows, loading, error, viewType, onViewTypeChange, dateInput, shift, shifts, masterDB, transDB }) {
  const C = useContext(ThemeCtx);

  // ── Staged filter state (applied only on Refresh) ────────────────
  const [localVt,    setLocalVt]    = useState(viewType);
  const [localDate,  setLocalDate]  = useState(dateInput);
  const [localShift, setLocalShift] = useState(shift);

  // ── Cascade filter state ──────────────────────────────────────────
  const [buyers,      setBuyers]      = useState([]);
  const [buyerStyles, setBuyerStyles] = useState([]);
  const [buyerPos,    setBuyerPos]    = useState([]);
  const [selBuyer,    setSelBuyer]    = useState('');
  const [selStyle,    setSelStyle]    = useState('');
  const [selPo,       setSelPo]       = useState('');

  useEffect(() => {
    if (!open) return;
    setLocalVt(viewType);
    setLocalDate(dateInput);
    setLocalShift(shift);
    setSelBuyer(''); setSelStyle(''); setSelPo(''); setBuyerStyles([]); setBuyerPos([]);
    const p = new URLSearchParams({ masterDB, transDB });
    axios.get(`/api/dashboard/dpr-buyers?${p}`)
      .then(r => setBuyers(r.data || [])).catch(() => setBuyers([]));
  }, [open]); // eslint-disable-line

  useEffect(() => {
    setBuyerStyles([]); setSelStyle(''); setBuyerPos([]); setSelPo('');
    if (!selBuyer) return;
    const p = new URLSearchParams({ masterDB, transDB, buyerCode: selBuyer });
    axios.get(`/api/dashboard/dpr-styles?${p}`)
      .then(r => setBuyerStyles(r.data || [])).catch(() => setBuyerStyles([]));
  }, [selBuyer]); // eslint-disable-line

  useEffect(() => {
    setBuyerPos([]); setSelPo('');
    if (!selBuyer || !selStyle) return;
    const p = new URLSearchParams({ masterDB, transDB, buyerCode: selBuyer, styleCode: selStyle });
    axios.get(`/api/dashboard/dpr-pos?${p}`)
      .then(r => setBuyerPos(r.data || [])).catch(() => setBuyerPos([]));
  }, [selStyle]); // eslint-disable-line

  if (!open) return null;

  // ── Derived ───────────────────────────────────────────────────────
  const idCols       = DPR_ID_COLS[viewType];
  const leadingCount = idCols.length - 1;  // all idCols except OrderQty
  const grandTotal   = dprSumRows(rows);
  const borderB      = `1px solid ${C.tableBorder}`;
  const idThBase     = { padding: '5px 9px', fontSize: 10, fontWeight: 700, background: '#1565C0', color: '#fff', whiteSpace: 'nowrap', textAlign: 'center', borderBottom: '2px solid rgba(255,255,255,0.25)', borderRight: `1px solid rgba(255,255,255,0.2)` };
  const idTdBase     = { padding: '5px 9px', fontSize: 11, whiteSpace: 'nowrap', borderBottom: borderB, borderRight: `1px solid ${C.tableBorder}`, verticalAlign: 'top' };

  // ── Cell components ───────────────────────────────────────────────
  const DataCell = ({ col, value }) => {
    const v = Number(value) || 0;
    return (
      <td style={{
        padding: '5px 8px', fontSize: 11, textAlign: 'right', whiteSpace: 'nowrap',
        borderBottom: borderB,
        borderLeft: col.sectionStart ? `2px solid ${col.color}` : `1px solid ${C.tableBorder}`,
        color: v < 0 ? '#dc2626' : v === 0 ? C.textMuted : C.text,
        fontWeight: v < 0 ? 700 : 400,
        fontStyle: col.wip ? 'italic' : 'normal',
        background: col.wip ? `${col.color}08` : 'transparent',
      }}>
        {v === 0 ? '—' : v.toLocaleString()}
      </td>
    );
  };

  const SubTotalCell = ({ col, value, bg, textCol }) => {
    const v = Number(value) || 0;
    return (
      <td style={{
        padding: '5px 8px', fontSize: 11, fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap',
        borderBottom: borderB,
        borderLeft: col.sectionStart ? `2px solid ${col.color}` : `1px solid ${C.tableBorder}`,
        color: v < 0 ? '#dc2626' : v === 0 ? C.textMuted : (textCol || '#1565C0'),
        background: bg || '#EFF6FF',
        fontStyle: col.wip ? 'italic' : 'normal',
      }}>
        {v === 0 ? '—' : v.toLocaleString()}
      </td>
    );
  };

  const GrandTotalCell = ({ col, value }) => {
    const v = Number(value) || 0;
    return (
      <td style={{
        padding: '5px 8px', fontSize: 11, fontWeight: 800, textAlign: 'right', whiteSpace: 'nowrap',
        borderLeft: col.sectionStart ? `2px solid rgba(255,255,255,0.4)` : `1px solid rgba(255,255,255,0.15)`,
        color: v < 0 ? '#fca5a5' : v === 0 ? 'rgba(255,255,255,0.35)' : '#fff',
        background: '#1565C0',
        fontStyle: col.wip ? 'italic' : 'normal',
      }}>
        {v === 0 ? '—' : v.toLocaleString()}
      </td>
    );
  };

  // ── Helpers ───────────────────────────────────────────────────────
  const groupConsec = (arr, keyFn) => {
    const result = [];
    arr.forEach(item => {
      const key = keyFn(item);
      const last = result[result.length - 1];
      if (last && last.key === key) last.items.push(item);
      else result.push({ key, items: [item] });
    });
    return result;
  };

  // covered leading id-cols by subtotal level (StyleNo=1, PoNo+Dest=2 more, Color=1 more)
  const COVERED = { 0: 0, 1: 1, 2: 3, 3: 4 };

  const SUB_STYLES = [
    { bg: '#DBEAFE', text: '#1565C0', border: '#BFDBFE' },
    { bg: '#EFF6FF', text: '#1e40af', border: '#BFDBFE' },
    { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
    { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' },
  ];

  // ── Pre-compute flat row list with rowSpan values ─────────────────
  // For each descriptor:
  //   type='data': bSpan=null(covered)|N, sSpan=null|N, pSpan=null|N|undefined(N/A), cSpan=null|N|undefined
  //   type='sub':  level, rows, label

  const colTtl = (cg) => cg.items.length + (cg.items.length > 1 ? 1 : 0);

  const poTtl = (pg) => {
    if (viewType === '2') return pg.items.length + (pg.items.length > 1 ? 1 : 0);
    const cgs = groupConsec(pg.items, r => r.ColorCode);
    return pg.items.length + cgs.filter(c => c.items.length > 1).length + (cgs.length > 1 ? 1 : 0);
  };

  const styleTtl = (sg) => {
    const n = sg.items.length;
    if (viewType === '3') return n + (n > 1 ? 1 : 0);
    const pgs = groupConsec(sg.items, r => r.PoSlNo);
    if (viewType === '2') {
      return n + pgs.filter(pg => pg.items.length > 1).length + (pgs.length > 1 ? 1 : 0);
    }
    let tot = n;
    pgs.forEach(pg => {
      const cgs = groupConsec(pg.items, r => r.ColorCode);
      tot += cgs.filter(c => c.items.length > 1).length + (cgs.length > 1 ? 1 : 0);
    });
    return tot + (pgs.length > 1 ? 1 : 0);
  };

  const buyerTtl = (items) => {
    if (viewType === '4') return items.length + (items.length > 1 ? 1 : 0);
    const sgs = groupConsec(items, r => r.StyleCode);
    let n = items.length;
    if (viewType === '3') {
      return n + sgs.filter(sg => sg.items.length > 1).length + (sgs.length > 1 ? 1 : 0);
    }
    if (viewType === '2') {
      sgs.forEach(sg => {
        const pgs = groupConsec(sg.items, r => r.PoSlNo);
        n += pgs.filter(pg => pg.items.length > 1).length + (pgs.length > 1 ? 1 : 0);
      });
      return n + (sgs.length > 1 ? 1 : 0);
    }
    sgs.forEach(sg => {
      const pgs = groupConsec(sg.items, r => r.PoSlNo);
      pgs.forEach(pg => {
        const cgs = groupConsec(pg.items, r => r.ColorCode);
        n += cgs.filter(c => c.items.length > 1).length + (cgs.length > 1 ? 1 : 0);
      });
      n += pgs.length > 1 ? 1 : 0;
    });
    return n + (sgs.length > 1 ? 1 : 0);
  };

  const flat = [];
  const bgGroups = groupConsec(rows, r => r.BuyerCode);

  bgGroups.forEach((buyer, bi) => {
    const bSpan = buyerTtl(buyer.items);
    let firstB = true;

    if (viewType === '4') {
      buyer.items.forEach((row, ri) => {
        flat.push({ type: 'data', key: `${bi}-${ri}`, row, bSpan: firstB ? bSpan : null, sSpan: 1 });
        firstB = false;
      });
      if (buyer.items.length > 1)
        flat.push({ type: 'sub', key: `sb-${bi}`, level: 0, rows: buyer.items, label: `${buyer.items[0].BuyerName} — Total` });
      return;
    }

    const sgs = groupConsec(buyer.items, r => r.StyleCode);
    sgs.forEach((sg, si) => {
      const sSpan = styleTtl(sg);
      let firstS = true;

      if (viewType === '3') {
        sg.items.forEach((row, ri) => {
          flat.push({ type: 'data', key: `${bi}-${si}-${ri}`, row, bSpan: firstB ? bSpan : null, sSpan: firstS ? sSpan : null, pSpan: 1 });
          firstB = false; firstS = false;
        });
        if (sg.items.length > 1)
          flat.push({ type: 'sub', key: `ss-${bi}-${si}`, level: 1, rows: sg.items, label: `${sg.items[0].StyleNo} — Sub Total` });
        return;
      }

      const pgs = groupConsec(sg.items, r => r.PoSlNo);
      pgs.forEach((pg, pi) => {
        const pSpan = poTtl(pg);
        let firstP = true;

        if (viewType === '2') {
          pg.items.forEach((row, ri) => {
            flat.push({ type: 'data', key: `${bi}-${si}-${pi}-${ri}`, row, bSpan: firstB ? bSpan : null, sSpan: firstS ? sSpan : null, pSpan: firstP ? pSpan : null, cSpan: 1 });
            firstB = false; firstS = false; firstP = false;
          });
          if (pg.items.length > 1)
            flat.push({ type: 'sub', key: `sp-${bi}-${si}-${pi}`, level: 2, rows: pg.items, label: `PO: ${pg.items[0].PoNo} — Sub Total` });
          return;
        }

        // vt='1'
        const cgs = groupConsec(pg.items, r => r.ColorCode);
        cgs.forEach((cg, ci_) => {
          const cSpan = colTtl(cg);
          let firstC = true;
          cg.items.forEach((row, ri) => {
            flat.push({ type: 'data', key: `${bi}-${si}-${pi}-${ci_}-${ri}`, row, bSpan: firstB ? bSpan : null, sSpan: firstS ? sSpan : null, pSpan: firstP ? pSpan : null, cSpan: firstC ? cSpan : null });
            firstB = false; firstS = false; firstP = false; firstC = false;
          });
          if (cg.items.length > 1)
            flat.push({ type: 'sub', key: `sc-${bi}-${si}-${pi}-${ci_}`, level: 3, rows: cg.items, label: `${cg.items[0].ColorName} — Sub Total` });
        });
        if (cgs.length > 1)
          flat.push({ type: 'sub', key: `sp-${bi}-${si}-${pi}`, level: 2, rows: pg.items, label: `PO: ${pg.items[0].PoNo} — Sub Total` });
      });
      if (pgs.length > 1)
        flat.push({ type: 'sub', key: `ss-${bi}-${si}`, level: 1, rows: sg.items, label: `${sg.items[0].StyleNo} — Sub Total` });
    });
    if (sgs.length > 1)
      flat.push({ type: 'sub', key: `sb-${bi}`, level: 0, rows: buyer.items, label: `${buyer.items[0].BuyerName} — Total` });
  });

  // ── Row renderers ─────────────────────────────────────────────────
  let rowIdx = 0;

  const renderDataRow_ = (desc) => {
    const { row } = desc;
    const bg = rowIdx++ % 2 === 0 ? C.tableRow : C.tableRowAlt;
    const rs = (n) => n > 1 ? n : undefined;

    return (
      <tr key={desc.key} style={{ background: bg }}>
        {/* Buyer — sticky */}
        {desc.bSpan !== null && (
          <td rowSpan={rs(desc.bSpan)} style={{
            padding: '7px 10px', fontWeight: 800, fontSize: 11, color: '#1565C0',
            verticalAlign: 'top', whiteSpace: 'nowrap',
            position: 'sticky', left: 0, zIndex: 1, background: bg,
            borderBottom: borderB, borderRight: '3px solid #1565C030',
            boxShadow: '2px 0 6px rgba(21,101,192,0.08)',
          }}>{row.BuyerName}</td>
        )}
        {/* StyleNo */}
        {desc.sSpan !== null && (
          <td rowSpan={rs(desc.sSpan)} style={{ ...idTdBase, fontWeight: 600, color: C.blue }}>{row.StyleNo || '—'}</td>
        )}
        {/* PoNo + Destination (vt ≠ '4') */}
        {viewType !== '4' && desc.pSpan !== null && (
          <>
            <td rowSpan={rs(desc.pSpan)} style={{ ...idTdBase, color: C.textSub }}>{row.PoNo || '—'}</td>
            <td rowSpan={rs(desc.pSpan)} style={{ ...idTdBase, color: C.textSub }}>{row.DestinationName || '—'}</td>
          </>
        )}
        {/* ColorName (vt '1' or '2') */}
        {(viewType === '1' || viewType === '2') && desc.cSpan !== null && (
          <td rowSpan={rs(desc.cSpan)} style={{ ...idTdBase, color: C.textSub }}>{row.ColorName || '—'}</td>
        )}
        {/* SizeName (vt '1') */}
        {viewType === '1' && (
          <td style={{ ...idTdBase, color: C.textSub }}>{row.SizeName || '—'}</td>
        )}
        {/* OrderQty */}
        <td style={{ ...idTdBase, textAlign: 'right', fontWeight: 600, color: C.text }}>{Number(row.OrderQty || 0).toLocaleString()}</td>
        {/* Pipeline data */}
        {DPR_FLAT_COLS.map((col, ci) => <DataCell key={ci} col={col} value={row[col.f] || 0} />)}
      </tr>
    );
  };

  const renderSubRow_ = (desc) => {
    const sub  = dprSumRows(desc.rows);
    const s    = SUB_STYLES[desc.level] || SUB_STYLES[0];
    const lblCols = leadingCount - COVERED[desc.level];

    return (
      <tr key={desc.key} style={{ background: s.bg, borderTop: `2px solid ${s.border}` }}>
        <td colSpan={lblCols} style={{
          padding: '6px 10px', fontWeight: desc.level === 0 ? 800 : 700, fontSize: 11, color: s.text,
          whiteSpace: 'nowrap', background: s.bg,
          borderBottom: borderB, borderRight: `1px solid ${C.tableBorder}`,
        }}>{desc.label}</td>
        <td style={{ ...idTdBase, fontWeight: 700, textAlign: 'right', background: s.bg, color: s.text }}>{Number(sub.OrderQty || 0).toLocaleString()}</td>
        {DPR_FLAT_COLS.map((col, ci) => <SubTotalCell key={ci} col={col} value={sub[col.f] || 0} bg={s.bg} textCol={s.text} />)}
      </tr>
    );
  };

  // ── Combo select style ────────────────────────────────────────────
  const cmbStyle = {
    padding: '4px 8px', fontSize: 11, borderRadius: 5,
    background: C.card, color: C.text, border: `1px solid ${C.tableBorder}`,
    cursor: 'pointer', minWidth: 140, maxWidth: 210,
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 16, paddingBottom: 16, overflow: 'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: C.card, borderRadius: 12, width: 'min(98vw, 1900px)', maxHeight: '94vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 56px rgba(0,0,0,0.45)', border: `1px solid ${C.cardBorder}` }}>

        {/* ── Modal header ── */}
        <div style={{ background: 'linear-gradient(135deg,#1565C0,#0d47a1)', borderRadius: '12px 12px 0 0', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: 0.3 }}>Daily Production Report</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{localDate ? toDisplayDate(localDate) : '—'} &nbsp;·&nbsp; Shift {shifts.find(s => s.ShiftCode === localShift)?.ShiftName || localShift}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 7, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff' }}>✕ Close</button>
        </div>

        {/* ── View type selector ── */}
        <div style={{ padding: '8px 20px', background: C.tableTh, borderBottom: `1px solid ${C.tableBorder}`, display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textSub, marginRight: 4 }}>View :</span>
          {VT_LABELS.map(([k, label]) => (
            <button key={k} onClick={() => setLocalVt(k)} style={{
              padding: '4px 14px', fontSize: 11, fontWeight: 700, borderRadius: 20, cursor: 'pointer',
              border: `1.5px solid ${localVt === k ? '#1565C0' : C.tableBorder}`,
              background: localVt === k ? '#1565C0' : C.card,
              color: localVt === k ? '#fff' : C.textSub,
              transition: 'all 0.15s',
              boxShadow: localVt === k ? '0 2px 8px rgba(21,101,192,0.3)' : 'none',
            }}>{label}</button>
          ))}
          {loading && <span style={{ fontSize: 11, color: C.textSub, marginLeft: 8, fontStyle: 'italic' }}>Loading…</span>}
          {!loading && rows.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textSub }}>{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* ── Filter bar ── */}
        <div style={{ padding: '7px 20px', background: C.card, borderBottom: `2px solid ${C.tableBorder}`, display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textSub }}>Filter :</span>
          <input
            type="date" value={localDate}
            onChange={e => setLocalDate(e.target.value)}
            style={{ padding: '4px 8px', fontSize: 11, borderRadius: 5, background: C.card, color: C.text, border: `1px solid ${C.tableBorder}`, cursor: 'pointer' }}
          />
          <select value={localShift} onChange={e => setLocalShift(e.target.value)} style={cmbStyle}>
            {shifts.map(s => <option key={s.ShiftCode} value={s.ShiftCode}>{s.ShiftName || s.ShiftCode}</option>)}
          </select>
          <span style={{ color: C.tableBorder, margin: '0 2px', fontSize: 14 }}>|</span>
          <select value={selBuyer} onChange={e => { setSelBuyer(e.target.value); setSelStyle(''); setSelPo(''); }} style={cmbStyle}>
            <option value="">All Buyers</option>
            {buyers.map(b => <option key={b.BuyerCode} value={b.BuyerCode}>{b.BuyerName}{b.ShortName ? ` (${b.ShortName})` : ''}</option>)}
          </select>
          <select value={selStyle} onChange={e => { setSelStyle(e.target.value); setSelPo(''); }} disabled={!selBuyer} style={{ ...cmbStyle, opacity: selBuyer ? 1 : 0.5 }}>
            <option value="">All Styles</option>
            {buyerStyles.map(s => <option key={s.StyleCode} value={s.StyleCode}>{s.StyleNo}</option>)}
          </select>
          <select value={selPo} onChange={e => setSelPo(e.target.value)} disabled={!selStyle} style={{ ...cmbStyle, opacity: selStyle ? 1 : 0.5 }}>
            <option value="">All POs</option>
            {buyerPos.map(p => <option key={p.PoSlNo} value={p.PoSlNo}>{p.PoNo}{p.DestinationName ? ` — ${p.DestinationName}` : ''}</option>)}
          </select>
          {(selBuyer || selStyle || selPo) && (
            <button onClick={() => { setSelBuyer(''); setSelStyle(''); setSelPo(''); }} style={{
              fontSize: 10, padding: '3px 9px', borderRadius: 4, cursor: 'pointer', fontWeight: 600,
              background: 'transparent', color: C.red, border: `1px solid ${C.red}50`,
            }}>✕ Clear</button>
          )}
          <button
            onClick={() => onViewTypeChange(localVt, { buyerCode: selBuyer, styleCode: selStyle, poSlNo: selPo }, localDate, localShift)}
            style={{
              marginLeft: 'auto', padding: '5px 16px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer',
              background: '#1565C0', color: '#fff', border: 'none',
              boxShadow: '0 2px 8px rgba(21,101,192,0.35)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >🔄 Refresh</button>
        </div>

        {/* ── Table ── */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {error ? (
            <div style={{ padding: 28, color: C.red, fontSize: 13, textAlign: 'center' }}>⚠ {error}</div>
          ) : rows.length === 0 && !loading ? (
            <div style={{ padding: 36, color: C.textSub, fontSize: 13, textAlign: 'center' }}>No production data for this date / shift.</div>
          ) : (
            <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: '100%', tableLayout: 'auto' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
                <tr>
                  <th style={{ ...idThBase, minWidth: 120, position: 'sticky', left: 0, zIndex: 4, background: '#0d47a1' }} rowSpan={2}>Buyer</th>
                  {idCols.map(c => (
                    <th key={c.f} style={{ ...idThBase, minWidth: c.f === 'StyleNo' ? 110 : c.f === 'DestinationName' ? 100 : c.f === 'PoNo' ? 85 : 70 }} rowSpan={2}>{c.label}</th>
                  ))}
                  {DPR_DATA_GROUPS.map((g, i) => (
                    <th key={i} colSpan={g.cols.length} style={{
                      padding: '6px 8px', fontSize: 10, fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap',
                      background: g.color, color: '#fff',
                      borderLeft: g.sectionStart ? '3px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.2)',
                      borderBottom: '1px solid rgba(255,255,255,0.3)',
                      letterSpacing: 0.5,
                    }}>{g.label}</th>
                  ))}
                </tr>
                <tr>
                  {DPR_FLAT_COLS.map((c, i) => (
                    <th key={i} style={{
                      padding: '4px 7px', fontSize: 9, fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap', minWidth: 52,
                      background: c.color + '22', color: c.color,
                      borderLeft: c.sectionStart ? `3px solid ${c.color}` : `1px solid ${c.color}33`,
                      borderBottom: `2px solid ${c.color}`,
                      fontStyle: c.wip ? 'italic' : 'normal', letterSpacing: 0.3,
                    }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flat.map(desc => desc.type === 'data' ? renderDataRow_(desc) : renderSubRow_(desc))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={1 + leadingCount} style={{
                    padding: '7px 12px', fontWeight: 800, fontSize: 12, color: '#fff',
                    background: '#1565C0', whiteSpace: 'nowrap',
                    position: 'sticky', left: 0, zIndex: 1,
                    letterSpacing: 0.4, borderTop: '3px solid #0d47a1',
                  }}>Grand Total</td>
                  <td style={{ padding: '7px 9px', fontWeight: 800, fontSize: 12, textAlign: 'right', background: '#1565C0', color: '#fff', borderTop: '3px solid #0d47a1', borderLeft: `1px solid rgba(255,255,255,0.2)` }}>
                    {Number(grandTotal.OrderQty || 0).toLocaleString()}
                  </td>
                  {DPR_FLAT_COLS.map((col, ci) => <GrandTotalCell key={ci} col={col} value={grandTotal[col.f] || 0} />)}
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const filterInputStyle = {
  flex: 1, border: 'none', outline: 'none', padding: '0 10px',
  fontSize: 12, color: '#fff', background: 'transparent', fontFamily: 'inherit',
  height: '100%',
};
const filterSelectStyle = {
  flex: 1, border: 'none', outline: 'none', padding: '0 8px',
  fontSize: 12, color: '#fff', background: 'transparent',
  fontFamily: 'inherit', cursor: 'pointer', height: '100%',
};

// ── Main Dashboard ─────────────────────────────────────────────────
export default function Dashboard({ onLogout }) {
  const [theme, setTheme]       = useState(() => localStorage.getItem('procon-theme') || 'light');
  const [dateInput, setDateInput] = useState(todayISO);
  const [shift, setShift]       = useState('001');
  const [shifts, setShifts]     = useState([]);
  const [factoryData, setFactoryData] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [dhuData,      setDhuData]      = useState([]);
  const [qcDefects,    setQcDefects]    = useState([]);
  const [lineWiseHourly, setLineWiseHourly] = useState({ section: 'Sewing', data: [], allHours: [] });
  const [bdNwData, setBdNwData] = useState({ bd: [], nw: [] });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [refreshInfo, setRefreshInfo] = useState(null);
  const [savedOprs, setSavedOprs] = useState({ present: 0, abs: 0, hasValue: false });
  const [savedLineOprs, setSavedLineOprs] = useState({});
  const [linesPopup, setLinesPopup] = useState(null); // { styleNo, poNo, buyer, lines: [...] }
  const [dprOpen,    setDprOpen]    = useState(false);
  const [dprViewType,setDprViewType]= useState('4');
  const [dprRows,    setDprRows]    = useState([]);
  const [dprLoading, setDprLoading] = useState(false);
  const [dprError,   setDprError]   = useState(null);

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
        const linesData = effRes.data?.lines || [];
        const isBreak   = effRes.data?.isBreakTime || false;
        if (linesData.length > 0 && !isBreak) {
          const fac      = effRes.data?.factory || {};
          const presOprs = fac.presentOprs || 0;
          const aws      = fac.activeWs    || 0;
          setSavedOprs({ present: presOprs, abs: Math.max(0, aws - presOprs), hasValue: true });
          const oprsMap = {};
          linesData.forEach(l => { oprsMap[l.lineCode] = l.operators || 0; });
          setSavedLineOprs(oprsMap);
        }
        const now = new Date();
        setRefreshInfo({
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          user: session?.username || '',
          date: toDisplayDate(dateInput),
          shiftName: shifts.find(s => s.ShiftCode === shift)?.ShiftName || shift,
        });
        // Non-critical calls — silently ignore failures
        axios.get(`/api/dashboard/linewise-hourly?${p}`)
          .then(r => setLineWiseHourly(r.data || { section: 'Sewing', data: [], allHours: [] }))
          .catch(() => {});
        axios.get(`/api/dashboard/bd-nw?${p}`)
          .then(r => setBdNwData(r.data || { bd: [], nw: [] }))
          .catch(() => {});
        axios.get(`/api/dashboard/dhu?${p}`)
          .then(r => setDhuData(r.data || []))
          .catch(() => setDhuData([]));
        axios.get(`/api/dashboard/qc-defects?${p}`)
          .then(r => setQcDefects(r.data || []))
          .catch(() => setQcDefects([]));
      })
      .catch(err => setError(err.response?.data?.error || err.message || 'Fetch failed'))
      .finally(() => setLoading(false));
  }, [dateInput, shift, masterDB, transDB, session]);


  const handleLogout = useCallback(() => { clearSession(); if (onLogout) onLogout(); }, [onLogout]);

  const fetchDpr = useCallback((vt, filters = {}, date = dateInput, sh = shift) => {
    if (!date || !sh) return;
    setDprLoading(true); setDprError(null);
    const params = { date: toApiDate(date), shift: sh, masterDB, transDB, viewType: vt };
    if (filters.buyerCode) params.buyerCode = filters.buyerCode;
    if (filters.styleCode) params.styleCode = filters.styleCode;
    if (filters.poSlNo)    params.poSlNo    = filters.poSlNo;
    const p = new URLSearchParams(params);
    axios.get(`/api/dashboard/dpr?${p}`)
      .then(r => setDprRows(r.data || []))
      .catch(e => setDprError(e.response?.data?.error || e.message || 'Failed'))
      .finally(() => setDprLoading(false));
  }, [dateInput, shift, masterDB, transDB]);

  const openDpr = useCallback(() => {
    setDprOpen(true);
    setDprViewType('4');
    fetchDpr('4');
  }, [fetchDpr]);

  // ── Derived values ─────────────────────────────────────────────
  const factory    = factoryData?.factory || {};
  const lines      = factoryData?.lines   || [];
  const shiftElapsed  = factoryData?.shiftElapsed || 0;
  const flags      = factoryData?.flags   || {};
  const outputName = flags.I_L_Output_QC        ? 'End Line Checking'
                   : flags.I_L_Output_AQL       ? 'AQL'
                   : flags.I_L_Output_Finishing ? 'Finishing'
                   : flags.I_L_Output_Packing   ? 'Packing'
                   : 'Sewing';
  const isSameDate    = factoryData?.metadata?.isSameDate || false;
  const shiftTime     = factory.shiftTime || 480;

  const totalWs       = factory.totalWs    || 0;
  const activeWs      = factory.activeWs   || 0;
  const presentOprs   = factory.presentOprs || 0;
  const displayTotalWs = totalWs > 0 ? totalWs : presentOprs;
  const absOprs       = Math.max(0, activeWs - presentOprs);
  const attRate       = activeWs > 0 ? (presentOprs / activeWs) * 100 : 0;

  // Mirror linewise: during break show last pre-break snapshot; save only when NOT in break
  const isBreakTime        = factoryData?.isBreakTime || false;
  const displayPresentOprs = (isBreakTime && savedOprs.hasValue) ? savedOprs.present : Math.round(presentOprs);
  const displayAbsOprs     = (isBreakTime && savedOprs.hasValue) ? savedOprs.abs     : Math.round(absOprs);
  const displayAttRate     = activeWs > 0 ? (displayPresentOprs / activeWs) * 100 : attRate;

  const netElapsed    = factory.manDayMinutes || shiftElapsed;
  const currTargetPcs = isSameDate && shiftTime > 0
    ? Math.round((factory.target || 0) * (netElapsed / shiftTime))
    : (factory.target || 0);
  const outputPcs     = factory.output || 0;
  const taEff         = currTargetPcs > 0 ? Math.round(outputPcs / currTargetPcs * 100) : 0;
  const targetOutputPerHr = shiftTime > 0 ? (factory.target || 0) / (shiftTime / 60) : 0;
  const actualOutputPerHr = shiftElapsed > 0 ? outputPcs / (shiftElapsed / 60) : 0;
  const targetEff     = factory.targetEff || 0;

  const shiftTimeTillNow = isSameDate ? shiftElapsed : shiftTime;
  const activeWsOee     = factory.activeWs || 0;
  const oeeAvailability = activeWsOee > 0 && shiftTimeTillNow > 0
    ? Math.min(100, Math.round((factory.availMins || 0) / (shiftTimeTillNow * activeWsOee) * 100))
    : 0;
  const oeePerformance  = (factory.availMins || 0) > 0
    ? Math.min(100, Math.round((factory.earnedMins || 0) / factory.availMins * 100))
    : 0;
  const chkChecked      = (factory.chkPassed||0)+(factory.chkRw||0)+(factory.chkRj||0);
  const oeeQuality      = chkChecked > 0 ? Math.min(100, Math.round((factory.chkPassed||0) / chkChecked * 100)) : 0;
  const oeeScore        = Math.round((oeeAvailability/100) * (oeePerformance/100) * (oeeQuality/100) * 100);

  const wsUpPct   = totalWs > 0 ? Math.round(activeWs / totalWs * 100) : 0;
  const pcsGap    = Math.round(outputPcs - currTargetPcs);
  const hrGap     = parseFloat((actualOutputPerHr - targetOutputPerHr).toFixed(1));
  const effGap    = Math.round((factory.efficiency || 0) - targetEff);
  const taColor   = taEff >= 80 ? '#4ade80' : taEff >= 60 ? '#fbbf24' : '#f87171';

  const sortedByEff  = [...lines].sort((a, b) => b.efficiency - a.efficiency);
  const top5Lines    = sortedByEff.slice(0, 5);
  const linesWithOutput  = sortedByEff.filter(l => (l.output || 0) > 0);
  const bottom5WithOutput = linesWithOutput.slice(-Math.min(5, linesWithOutput.length)).reverse();
  const bottom5Lines = bottom5WithOutput.length > 0
    ? bottom5WithOutput
    : sortedByEff.slice(-Math.min(5, sortedByEff.length)).reverse();

  const factoryManDayMins = factory.manDayMinutes || shiftElapsed;
  const clockedMins = Math.round(factoryManDayMins * activeWs);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 58, maxWidth: 1600, margin: '0 auto', paddingTop: 6, paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              {/* ProCon logo */}
              <span style={{
                background: '#fff', borderRadius: 8, padding: '5px 14px',
                display: 'inline-flex', alignItems: 'center', flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: "'Futura XBlk BT', 'Futura', 'Century Gothic', Impact, sans-serif",
                  fontSize: 20, fontWeight: 900, letterSpacing: 2,
                }}>
                  <span style={{ color: '#1A4F9C' }}>Pro</span>
                  <span style={{ color: '#00AEEF' }}>Con</span>
                  <sup style={{ fontSize: 11, verticalAlign: 'super', letterSpacing: 0, color: '#00AEEF' }}>®</sup>
                </span>
              </span>
              {/* Company name + dashboard title + filter values + last refresh */}
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: 14, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 24 }}>
                {/* Left: company + filter values */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {session?.companyName && (
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: 0.3, lineHeight: 1.35 }}>{session.companyName}</div>
                  )}
                  {refreshInfo && (
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.75)', lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                      {refreshInfo.date} · {refreshInfo.shiftName}
                    </div>
                  )}
                </div>
                {/* Right: dashboard title + last refresh */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: 0.3, lineHeight: 1.35 }}>ProConDashBoard - Factory</div>
                  <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.65)', lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                    {refreshInfo ? `Last refresh: ${refreshInfo.time}` : 'Last refresh: —'}
                  </div>
                </div>
              </div>
            </div>
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
                style={{ height: 32, marginTop: 8, boxSizing: 'border-box', background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 6, padding: '0 12px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                {loading ? '⟳' : '↻'} Refresh
              </button>
              <button onClick={toggleTheme}
                style={{ height: 32, width: 32, marginTop: 8, boxSizing: 'border-box', background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 6, padding: 0, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {theme === 'dark' ? '☀' : '🌙'}
              </button>
              <button onClick={handleLogout} title="Logout"
                style={{ height: 32, width: 32, marginTop: 8, boxSizing: 'border-box', background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.5)', color: '#ffaaaa', borderRadius: 6, padding: 0, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}>
                ⏻
              </button>
            </div>
          </div>
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
                    const dashOff = circ * (1 - Math.min(100, displayAttRate) / 100);
                    return (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                          <div style={{ background: C.tealDim, borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 26, fontWeight: 800, color: C.teal, lineHeight: 1 }}>{fmt(displayTotalWs)}</div>
                            <div style={{ fontSize: 10, color: C.textSub, marginTop: 4 }}>🖥 Total workstations</div>
                          </div>
                          <div style={{ background: C.blueDim, borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: C.textSub, letterSpacing: 1, marginBottom: 4 }}>Clocked Mins</div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: C.blue, lineHeight: 1 }}>{fmt(factoryManDayMins)}</div>
                          </div>
                          <div style={{ background: C.tealDim, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 9, fontWeight: 700, color: C.textSub, letterSpacing: 1, marginBottom: 4 }}>Att Rate</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: effColor(C, displayAttRate), lineHeight: 1 }}>{fmt(displayAttRate, 1)} <span style={{ fontSize: 11 }}>Att %</span></div>
                            </div>
                            <svg width={60} height={60} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                              <circle cx={30} cy={30} r={r} fill="none" stroke={C.progressTrack} strokeWidth={4} />
                              <circle cx={30} cy={30} r={r} fill="none" stroke={effColor(C, displayAttRate)} strokeWidth={4}
                                strokeDasharray={circ} strokeDashoffset={dashOff}
                                strokeLinecap="round" transform="rotate(-90 30 30)" />
                            </svg>
                          </div>
                          <div style={{ background: C.purpleDim, borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: C.textSub, letterSpacing: 1, marginBottom: 4 }}>Man Days</div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: C.purple, lineHeight: 1 }}>{fmt(factory.manDays, 1)}</div>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                          {[
                            { label: 'Active WS', value: fmt(activeWs || displayTotalWs), color: C.teal,  badge: `↑ ${wsUpPct}% up`, badgeColor: C.green, badgeBg: C.greenDim },
                            { label: 'Present',   value: fmt(displayPresentOprs),          color: C.green, badge: 'On Duty',          badgeColor: C.green, badgeBg: C.greenDim },
                            { label: 'Absent',    value: fmt(displayAbsOprs),              color: C.red,   badge: 'Off Duty',         badgeColor: C.red,   badgeBg: C.redDim   },
                          ].map(({ label, value, color, badge, badgeColor, badgeBg }) => (
                            <div key={label} style={{ background: C.tealDim, borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: C.textSub, letterSpacing: 0.8, marginBottom: 3 }}>{label}</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
                              <span style={{ fontSize: 9, fontWeight: 700, color: badgeColor, background: badgeBg, borderRadius: 4, padding: '2px 6px' }}>{badge}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </Card>

                {/* Target vs Actual card */}
                <Card title="Target vs Actual" subtitle="All Lines" icon="🆚"
                  badge={
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>
                        <span style={{ color: 'rgba(255,255,255,0.75)', marginRight: 4 }}>({outputName})</span>
                        Curr Target vs Actuals
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: taColor }}>
                        {fmt(currTargetPcs)} vs {fmt(outputPcs)} = {taEff}%
                      </div>
                    </div>
                  }
                  style={{ flex: 2, minWidth: 0 }} bodyStyle={{ padding: 0 }}>
                  {/* Column headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr 80px', padding: '6px 14px', borderBottom: `1px solid ${C.cardBorder}` }}>
                    <div />
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#1565C0', letterSpacing: 1, textAlign: 'center' }}>Target</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.amber,   letterSpacing: 1, textAlign: 'center' }}>Actual</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1, textAlign: 'center' }}>vs Target</div>
                  </div>
                  {/* Data rows */}
                  {[
                    { icon: '📤', label: 'Pcs',       target: fmt(factory.target),       actual: fmt(outputPcs),                   pct: (factory.target||0) > 0 ? outputPcs / factory.target * 100 : 0,        gap: Math.round(outputPcs - (factory.target||0)), suf: '' },
                    { icon: '⏱',  label: 'Output/hr', target: fmt(targetOutputPerHr, 1), actual: fmt(actualOutputPerHr, 1),        pct: targetOutputPerHr > 0 ? actualOutputPerHr / targetOutputPerHr * 100 : 0, gap: hrGap,  suf: '/hr' },
                    { icon: '⚡', label: 'Eff %',     target: fmt(targetEff, 1) + '%',   actual: fmt(factory.efficiency, 1) + '%', pct: targetEff > 0 ? (factory.efficiency || 0) / targetEff * 100 : 0,          gap: effGap, suf: '%' },
                  ].map(({ icon, label, target, actual, pct, gap, suf }, i, arr) => {
                    const col = effColor(C, pct);
                    const gc  = v => v >= 0 ? C.green : C.red;
                    return (
                      <div key={label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr 80px', padding: '4px 14px', alignItems: 'center', borderBottom: i < arr.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 15 }}>{icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.textSub }}>{label}</span>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#1565C0', textAlign: 'center' }}>{target}</div>
                        <div style={{ padding: '0 6px' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: C.amber, textAlign: 'center' }}>{actual}</div>
                          <ProgBar pct={pct} color={col} />
                          <div style={{ fontSize: 9, color: C.textSub, textAlign: 'center', marginTop: 2 }}>{pct.toFixed(1)}%</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <CG pct={pct} color={col} size={46} />
                          <div style={{ fontSize: 10, fontWeight: 700, color: gc(gap) }}>
                            {gap >= 0 ? '↑' : '↓'} {gap > 0 ? '+' : ''}{gap}{suf}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </Card>

                {/* Feeding + WIP card */}
                <Card title="Feeding — WIP" icon="🔄"
                  style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
                  bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' }}>
                  {[
                    { label: 'Feeding', value: fmt(factory.feeding), bg: C.greenDim, color: C.green },
                    { label: 'WIP',     value: fmt(factory.wip),     bg: C.amberDim, color: C.amber },
                  ].map(({ label, value, bg, color }) => (
                    <div key={label} style={{
                      flex: 1, background: bg, borderRadius: 10, padding: '8px 12px',
                      border: `1px solid ${color}22`, textAlign: 'center',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                      <div style={{ fontSize: 10, color: C.textSub, marginTop: 3 }}>pcs</div>
                    </div>
                  ))}
                </Card>

              </div>

              {/* ── Row 2: Active Production Orders — style-level ── */}
              <Card title="Active Production Orders" icon="📋"
                badge={
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.75)', marginRight: 5 }}>({outputName})</span>
                    {activeOrders.length} styles
                  </span>
                }
                bodyStyle={{ padding: 0 }}>
                <div style={{ overflowY: 'auto', maxHeight: 320 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: C.tableTh }}>
                        {[
                          { h: 'Buyer', align: 'left' },
                          { h: 'Style No', align: 'left' },
                          { h: 'P.O. No', align: 'left' },
                          { h: 'P.O. Date', align: 'right' },
                          { h: 'Ex-Factory Date', align: 'right' },
                          { h: 'Order Qty', align: 'right' },
                          { h: 'Prodn Pcs', align: 'right' },
                          { h: 'Lines', align: 'center' },
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
                          <td style={{ padding: '6px 10px', color: C.textSub }}>{o.buyer || '—'}</td>
                          <td style={{ padding: '6px 10px', color: C.blue, fontWeight: 600 }}>{o.styleNo || '—'}</td>
                          <td style={{ padding: '6px 10px', color: C.textSub }}>{o.poNo || '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: C.textSub }}>{fmtDate(o.poDate)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: o.exFactoryDate ? C.amber : C.textMuted, fontWeight: o.exFactoryDate ? 600 : 400 }}>{fmtDate(o.exFactoryDate)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: C.text }}>{o.orderQty ? fmt(o.orderQty) : '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: C.green, fontWeight: 600 }}>{o.prodnPcs ? fmt(o.prodnPcs) : '—'}</td>
                          {/* Lines button — last column */}
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            <button
                              onClick={() => setLinesPopup(o)}
                              style={{
                                background: C.blueDim, color: '#1565C0', border: `1px solid rgba(21,101,192,0.3)`,
                                borderRadius: 5, padding: '3px 10px', fontSize: 11,
                                fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                              }}
                            >{o.lines.length} Line{o.lines.length !== 1 ? 's' : ''}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* ── Row 3: Hourly Production + OEE ── */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', height: 260 }}>
                <Card title="Hourly Production" icon="📊"
                  badge={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                        <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.75)', marginRight: 5 }}>({outputName})</span>
                        Total: {fmt(outputPcs)} pcs
                      </span>
                      <button
                        onClick={openDpr}
                        style={{
                          background: 'rgba(255,255,255,0.18)', color: '#fff',
                          border: '1px solid rgba(255,255,255,0.5)', borderRadius: 6,
                          padding: '3px 10px', fontSize: 11, fontWeight: 700,
                          cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: 0.3,
                        }}
                      >View DPR</button>
                    </span>
                  }
                  style={{ flex: 2, minWidth: 0, display: 'flex', flexDirection: 'column' }}
                  bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  {hourlyChartData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 30, color: C.textSub, fontSize: 13 }}>No hourly data</div>
                  ) : (
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={hourlyChartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.cardBorder} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textSub }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: C.textSub }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.text, fontWeight: 600 }} />
                          <Bar dataKey="output" name="Output" radius={[3, 3, 0, 0]}>
                            {hourlyChartData.map((d, i) => (
                              <Cell key={i} fill={d.output >= d.target ? C.green : C.red} />
                            ))}
                          </Bar>
                          <RLine type="monotone" dataKey="target" name="Target/hr" stroke={C.amber} strokeWidth={2} dot={false} strokeDasharray="5 4" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>

                <Card title="OEE Overview" subtitle="Overall Equipment Effectiveness" icon="⚙️" style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 6px' }}>
                    {(() => {
                      const R = 46, SIZE = 108, circ = 2 * Math.PI * R;
                      const off = circ * (1 - Math.min(100, oeeScore) / 100);
                      const col = effColor(C, oeeScore);
                      return (
                        <svg width={SIZE} height={SIZE}>
                          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={C.progressTrack} strokeWidth={8} />
                          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={col} strokeWidth={8}
                            strokeDasharray={circ} strokeDashoffset={off}
                            strokeLinecap="round" transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`} />
                          <text x={SIZE/2} y={SIZE/2-5} textAnchor="middle" dominantBaseline="central" fontSize={20} fontWeight={800} fill={col}>{oeeScore.toFixed(1)}%</text>
                          <text x={SIZE/2} y={SIZE/2+14} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600} fill={C.textSub}>OEE Score</text>
                        </svg>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[
                      { label: 'Availability', value: oeeAvailability, color: C.green },
                      { label: 'Performance',  value: oeePerformance,  color: '#1565C0' },
                      { label: 'Quality',      value: oeeQuality,      color: C.amber },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: C.tealDim, borderRadius: 8, padding: '8px 6px', textAlign: 'center', border: `1px solid ${C.cardBorder}` }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1 }}>{Math.round(value)}%</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: C.textSub, marginTop: 3, letterSpacing: 0.8 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* ── Row 4: Top 5 Lines + Needs Improvement (colored headers) ── */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                {[
                  { title: 'Top Performing Lines', icon: '👍', rows: top5Lines, accent: '#16a34a', rankBg: '#dcfce7', rankColor: '#15803d' },
                  { title: 'Needs Improvement', icon: '👎', rows: bottom5Lines, accent: '#dc2626', rankBg: '#fee2e2', rankColor: '#991b1b' },
                ].map(({ title, icon, rows, accent, rankBg, rankColor }) => (
                  <div key={title} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ background: accent, borderRadius: '10px 10px 0 0', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 17 }}>{icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1 }}>{title}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{rows.length} lines</span>
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
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: C.textSub }}>{fmt(isBreakTime && savedLineOprs[line.lineCode] != null ? savedLineOprs[line.lineCode] : line.operators)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Row 5: Quality Info + DHU (left, stacked) | Defect Analysis (right) ── */}
              {(() => {
                const qualRows = [
                  { label: 'EndLine CHK', pass: factory.chkPassed||0, rw: factory.chkRw||0, rj: factory.chkRj||0 },
                  { label: 'AQL',         pass: factory.aqlPassed||0, rw: factory.aqlRw||0, rj: factory.aqlRj||0 },
                  { label: 'Finishing',   pass: factory.finPassed||0, rw: factory.finRw||0, rj: factory.finRj||0 },
                  { label: 'Packing',     pass: factory.pkgPassed||0, rw: factory.pkgRw||0, rj: factory.pkgRj||0 },
                ];
                const hasQual    = qualRows.some(r => r.pass + r.rw + r.rj > 0);
                const hasDefects = qcDefects.length > 0;
                if (!hasQual && !hasDefects) return null;

                const PINK   = '#f472b6';
                const MAROON = '#991b1b';
                const endLine  = dhuData.find(r => r.ProcessCode === '004') || {};
                const totalChk = endLine.CheckedPcs || 0;
                const totalDef = (endLine.ReWorkPcs || 0) + (endLine.RejectedPcs || 0);
                const totalDHU = totalChk > 0 ? ((totalDef / totalChk) * 100).toFixed(1) : '—';
                const dhuPct   = (checked, defects) => checked > 0 ? ((defects / checked) * 100).toFixed(1) + '%' : '—';

                const BAR_COLORS = ['#ef4444','#f97316','#eab308','#3b82f6','#22c55e','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f59e0b'];
                const defTotal   = qcDefects.reduce((s, r) => s + (r.DefectPcs || 0), 0);

                return (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                    {/* Left column: Quality Info on top, DHU below */}
                    {hasQual && (
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <Card title="Quality Info" icon="💎" style={{ flex: 'none' }}>
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
                        {dhuData.length > 0 && (
                          <Card title="DHU" icon="🩺"
                            badge={<span style={{ fontSize: 22, fontWeight: 800, color: '#f97316' }}>{totalDHU}{totalDHU !== '—' ? '%' : ''}</span>}
                            style={{ flex: 'none' }}>
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
                        )}
                      </div>
                    )}
                    {/* Right column: Defect Analysis */}
                    {hasDefects && (
                      <Card title="Defect Analysis" icon="🔍"
                        badge={<span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Defect breakdown by type</span>}
                        style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: C.textSub, marginBottom: 12 }}>
                          Factory defect breakdown — Total: <b style={{ color: C.text }}>{defTotal.toLocaleString()}</b> defects
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {qcDefects.filter(r => (r.DefectPcs || 0) > 0).slice(0, 8).map((row, i) => {
                            const pct   = defTotal > 0 ? Math.round((row.DefectPcs / defTotal) * 100) : 0;
                            const color = BAR_COLORS[i % BAR_COLORS.length];
                            return (
                              <div key={row.DefectsDesc} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ minWidth: 160, fontSize: 12, fontWeight: 500, color: C.text, flexShrink: 0 }}>{row.DefectsDesc}</div>
                                <div style={{ flex: 1, background: C.progressTrack, borderRadius: 6, height: 22, position: 'relative' }}>
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
                                <div style={{ width: 40, fontSize: 11, fontWeight: 600, color: C.textSub, textAlign: 'right', flexShrink: 0 }}>{row.DefectPcs}</div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    )}
                  </div>
                );
              })()}

              {/* ── Row 5c: BreakDown + NoWork ── */}
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

              {/* ── Row 6: DownTime Analysis ── */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                <Card title="DownTime Analysis" icon="📉"
                  style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: C.textSub, marginBottom: 10 }}>
                    Clocked Minutes: <b style={{ color: C.text }}>{clockedMins.toLocaleString()}</b>
                    &nbsp;(Shift {fmt(factoryManDayMins)} mins × {activeWs} active WS)
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
              </div>


            </div>
          )}
        </div>

        {/* ── DPR Modal ── */}
        <DPRModal
          open={dprOpen}
          onClose={() => setDprOpen(false)}
          rows={dprRows}
          loading={dprLoading}
          error={dprError}
          viewType={dprViewType}
          onViewTypeChange={(vt, filters = {}, date, sh) => { setDprViewType(vt); fetchDpr(vt, filters, date, sh); }}
          dateInput={dateInput}
          shift={shift}
          shifts={shifts}
          masterDB={masterDB}
          transDB={transDB}
        />

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
                      {['#', 'Line', 'Prodn Pcs', 'Running Days'].map((h, i) => (
                        <th key={h} style={{
                          padding: '8px 12px', fontSize: 11, fontWeight: 700, color: C.textSub,
                          textAlign: i >= 2 ? 'right' : 'left',
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
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: C.green }}>{fmt(l.prodnPcs)}</td>
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
