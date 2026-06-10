import React, { useState } from 'react';
import axios from 'axios';

const PRIMARY  = '#1565C0';
const CARD_BG  = '#FFFFFF';
const PAGE_BG  = '#E3EEF9';

// ── SVG icons ──────────────────────────────────────────────────────────────────
const ServerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={PRIMARY}>
    <path d="M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z" />
  </svg>
);

const DatabaseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={PRIMARY}>
    <path d="M12 3C7.58 3 4 4.79 4 7s3.58 4 8 4 8-1.79 8-4-3.58-4-8-4zm0 9c-4.42 0-8-1.79-8-4v3c0 2.21 3.58 4 8 4s8-1.79 8-4v-3c0 2.21-3.58 4-8 4zm0 5c-4.42 0-8-1.79-8-4v3c0 2.21 3.58 4 8 4s8-1.79 8-4v-3c0 2.21-3.58 4-8 4z" />
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


// ── Outlined field with floating label + left icon + optional right element ────
function OutlinedField({ label, required, icon, right, children }) {
  return (
    <div style={{ position: 'relative', marginBottom: 26 }}>
      {/* Floating label — sits on top of the border line */}
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

      {/* Left icon */}
      {icon && (
        <span style={{
          position: 'absolute', left: 13, top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex', alignItems: 'center', zIndex: 2,
        }}>
          {icon}
        </span>
      )}

      {/* Right element (show/hide toggle, etc.) */}
      {right && (
        <span style={{
          position: 'absolute', right: 10, top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex', alignItems: 'center', zIndex: 2,
        }}>
          {right}
        </span>
      )}

      {/* Bordered container */}
      <div style={{
        border: `1.5px solid ${PRIMARY}`,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
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

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ConnectionSettings({ onSaved, onBack }) {
  const [form,    setForm]    = useState({ server: '', dbname: '', username: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.server || !form.dbname || !form.username || !form.password) {
      setError('All fields are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/auth/save-config', form);
      onSaved();
    } catch (e) {
      setError(e.response?.data?.error || 'Connection failed. Please check your settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, fontFamily: 'Inter, Segoe UI, sans-serif' }}>

      {/* Header */}
      <div style={{ background: PRIMARY, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        {onBack && (
          <button onClick={onBack} style={{
            background: 'none', border: 'none', color: '#fff',
            cursor: 'pointer', fontSize: 22, padding: 0,
            display: 'flex', alignItems: 'center', lineHeight: 1,
          }}>
            ←
          </button>
        )}
        <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Connection Settings</span>
      </div>

      {/* Card */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 20px' }}>
        <div style={{
          background: CARD_BG, borderRadius: 14,
          padding: '36px 40px', width: '100%', maxWidth: 460,
          boxShadow: '0 4px 24px rgba(21,101,192,0.12)',
        }}>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            {/* ProCon® — Futura XBlk BT, two-tone matching logo */}
            <div style={{
              fontFamily: "'Futura XBlk BT', 'Futura', 'Century Gothic', Impact, sans-serif",
              fontSize: 34, fontWeight: 900, letterSpacing: 2, lineHeight: 1,
            }}>
              <span style={{ color: '#1A4F9C' }}>Pro</span>
              <span style={{ color: '#00AEEF' }}>Con</span>
              <sup style={{ fontSize: 14, verticalAlign: 'super', letterSpacing: 0, color: '#00AEEF' }}>®</sup>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginTop: 10 }}>SQL Server Connection</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Configure your database server settings</div>
          </div>

          {/* Server Host */}
          <OutlinedField label="Server Host" required icon={<ServerIcon />}>
            <input
              value={form.server}
              onChange={e => set('server', e.target.value)}
              placeholder="e.g. Crystal1"
              style={inputStyle}
            />
          </OutlinedField>

          {/* Database Name */}
          <OutlinedField label="Database Name" required icon={<DatabaseIcon />}>
            <input
              value={form.dbname}
              onChange={e => set('dbname', e.target.value)}
              placeholder="e.g. ProConDB"
              style={inputStyle}
            />
          </OutlinedField>

          {/* Username */}
          <OutlinedField label="Username" required icon={<PersonIcon />}>
            <input
              value={form.username}
              onChange={e => set('username', e.target.value)}
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
              value={form.password}
              onChange={e => set('password', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
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
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 8,
              border: 'none', background: loading ? '#93C5FD' : PRIMARY,
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Saving...' : 'Save'}
          </button>

        </div>
      </div>
    </div>
  );
}
