import React from 'react';

const styles = {
  card: {
    background: '#fff',
    borderRadius: 10,
    padding: '24px 28px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    flex: 1,
    minWidth: 180,
  },
  label: { fontSize: 13, color: '#888', marginBottom: 8 },
  value: { fontSize: 32, fontWeight: 700, color: '#1a1a2e' },
};

export default function StatsCard({ label, value, prefix = '', suffix = '' }) {
  return (
    <div style={styles.card}>
      <div style={styles.label}>{label}</div>
      <div style={styles.value}>
        {prefix}{value !== null && value !== undefined ? value.toLocaleString() : '—'}{suffix}
      </div>
    </div>
  );
}
