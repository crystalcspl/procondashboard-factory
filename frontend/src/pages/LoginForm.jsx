import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { saveSession } from '../utils/auth';

const PRIMARY = '#1565C0';
const CARD_BG = '#F0F4FF';

// ── SVG icons ──────────────────────────────────────────────────────────────────
const GridIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={PRIMARY}>
    <path d="M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z" />
  </svg>
);

const GridAltIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={PRIMARY}>
    <path d="M20 3H4v2h16V3zm1 4H3c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h18c.55 0 1-.45 1-1V8c0-.55-.45-1-1-1zm-1 4H4v-2h16v2zm0 4H4v2h16v-2zm1 4H3c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h18c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1zm-1 4H4v-2h16v2z" />
  </svg>
);

const PersonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={PRIMARY}>
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={PRIMARY}>
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
  </svg>
);

const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#6b7280">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#6b7280">
    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
  </svg>
);

// ── Outlined field — same component pattern as ConnectionSettings ──────────────
function OutlinedField({ label, required, icon, right, children }) {
  return (
    <div style={{ position: 'relative', marginBottom: 26 }}>
      <span style={{
        position: 'absolute', top: -10,
        left: icon ? 40 : 13,
        background: CARD_BG, padding: '0 4px',
        fontSize: 12, fontWeight: 500, color: PRIMARY,
        lineHeight: 1, zIndex: 2, pointerEvents: 'none',
      }}>
        {label}
        {required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
      </span>

      {icon && (
        <span style={{
          position: 'absolute', left: 13, top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex', alignItems: 'center', zIndex: 2,
        }}>
          {icon}
        </span>
      )}

      {right && (
        <span style={{
          position: 'absolute', right: 10, top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex', alignItems: 'center', zIndex: 2,
        }}>
          {right}
        </span>
      )}

      <div style={{
        border: `1.5px solid ${PRIMARY}`,
        borderRadius: 6, display: 'flex', alignItems: 'center',
        paddingLeft:  icon  ? 42 : 14,
        paddingRight: right ? 44 : 14,
        background: CARD_BG,
      }}>
        {children}
      </div>
    </div>
  );
}

const inputStyle = {
  flex: 1, border: 'none', outline: 'none',
  padding: '13px 0', fontSize: 15,
  color: '#333', background: 'transparent', width: '100%',
  fontFamily: 'inherit',
};

const selectStyle = {
  flex: 1, border: 'none', outline: 'none',
  padding: '13px 0', fontSize: 15,
  color: '#333', background: 'transparent', width: '100%',
  fontFamily: 'inherit', cursor: 'pointer',
  appearance: 'none', WebkitAppearance: 'none',
};

// ── Page ───────────────────────────────────────────────────────────────────────
export default function LoginForm({ onLogin, onSettings }) {
  const [masters,   setMasters]   = useState([]);
  const [transacts, setTransacts] = useState([]);
  const [masterCode, setMasterCode] = useState('');
  const [transDB,   setTransDB]   = useState('');
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [showPwd,   setShowPwd]   = useState(false);
  const [mastersLoading, setMastersLoading] = useState(true);
  const [transLoading,   setTransLoading]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    setMastersLoading(true);
    axios.get('/api/auth/masters')
      .then(r => {
        setMasters(r.data);
        if (r.data.length > 0) setMasterCode(r.data[0].CompanyCode);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load company list.'))
      .finally(() => setMastersLoading(false));
  }, []);

  useEffect(() => {
    if (!masterCode) return;
    setTransLoading(true);
    setTransDB('');
    setTransacts([]);
    axios.get(`/api/auth/transactions?companyCode=${masterCode}`)
      .then(r => {
        setTransacts(r.data);
        if (r.data.length > 0) setTransDB(r.data[0].DBName);
      })
      .catch(() => setTransacts([]))
      .finally(() => setTransLoading(false));
  }, [masterCode]);

  const selectedMaster = masters.find(m => m.CompanyCode === masterCode) || null;

  const handleLogin = async () => {
    if (!selectedMaster || !transDB || !username || !password) {
      setError('All fields are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', {
        companyCode:  selectedMaster.CompanyCode,
        masterDB:     selectedMaster.DBName,
        transDB,
        username,
        password,
        companyName:  selectedMaster.CompanyName,
      });
      saveSession(res.data.user);
      onLogin();
    } catch (e) {
      setError(e.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onKey = e => { if (e.key === 'Enter') handleLogin(); };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#E3EEF9',
      fontFamily: 'Inter, Segoe UI, sans-serif',
    }}>
      {/* App header */}
      <div style={{ background: '#1565C0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px' }}>
        <span style={{
          background: '#fff', borderRadius: 8, padding: '5px 14px',
          display: 'inline-flex', alignItems: 'center',
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
        <button
          onClick={onSettings}
          title="Connection Settings"
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: '#fff', cursor: 'pointer', fontSize: 18,
            width: 36, height: 36, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ⚙
        </button>
      </div>

      {/* Card */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 20px 60px' }}>
        <div style={{
          background: CARD_BG, borderRadius: 18,
          padding: '38px 42px', width: '100%', maxWidth: 490,
          boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
        }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', background: PRIMARY,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', boxShadow: '0 4px 14px rgba(21,101,192,0.45)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="#fff">
                <path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z" />
              </svg>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
              <span style={{
                background: '#fff', borderRadius: 8, padding: '5px 14px',
                display: 'inline-flex', alignItems: 'center',
              }}>
                <span style={{
                  fontFamily: "'Futura XBlk BT', 'Futura', 'Century Gothic', Impact, sans-serif",
                  fontSize: 22, fontWeight: 900, letterSpacing: 2, lineHeight: 1,
                }}>
                  <span style={{ color: '#1A4F9C' }}>Pro</span>
                  <span style={{ color: '#00AEEF' }}>Con</span>
                  <sup style={{ fontSize: 12, verticalAlign: 'super', letterSpacing: 0, color: '#00AEEF' }}>®</sup>
                </span>
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Sign in to continue</div>
          </div>

          {/* Masters Database */}
          <OutlinedField
            label={mastersLoading ? 'Masters Database  (loading...)' : 'Masters Database'}
            icon={<GridIcon />}
          >
            <select
              value={masterCode}
              onChange={e => setMasterCode(e.target.value)}
              style={selectStyle}
            >
              {masters.map(m => (
                <option key={m.CompanyCode} value={m.CompanyCode}>
                  {m.CompanyCode} - {m.DBName}
                </option>
              ))}
            </select>
          </OutlinedField>

          {/* Transaction Database */}
          <OutlinedField
            label={transLoading ? 'Transaction Database  (loading...)' : 'Transaction Database'}
            icon={<GridAltIcon />}
          >
            <select
              value={transDB}
              onChange={e => setTransDB(e.target.value)}
              style={selectStyle}
            >
              {transacts.map(t => (
                <option key={t.DBName} value={t.DBName}>{t.DBName}</option>
              ))}
              {!transLoading && transacts.length === 0 && (
                <option disabled value="">— select a master first —</option>
              )}
            </select>
          </OutlinedField>

          <hr style={{ border: 'none', borderTop: '1px solid #CBD5E1', margin: '6px 0 28px' }} />

          {/* Username */}
          <OutlinedField label="Username" required icon={<PersonIcon />}>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={onKey}
              style={inputStyle}
            />
          </OutlinedField>

          {/* Password */}
          <OutlinedField
            label="Password"
            required
            icon={<LockIcon />}
            right={
              <button
                tabIndex={-1}
                onClick={() => setShowPwd(s => !s)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
              >
                {showPwd ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          >
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={onKey}
              style={inputStyle}
            />
          </OutlinedField>

          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA',
              color: '#DC2626', borderRadius: 8,
              padding: '10px 14px', fontSize: 13, marginBottom: 20,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 8,
              border: 'none', background: loading ? '#93C5FD' : PRIMARY,
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

        </div>
      </div>
    </div>
  );
}
