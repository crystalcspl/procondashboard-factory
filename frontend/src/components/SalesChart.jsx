import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

const styles = {
  card: {
    background: '#fff',
    borderRadius: 10,
    padding: '24px 28px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  title: { fontSize: 15, fontWeight: 600, marginBottom: 20, color: '#1a1a2e' },
};

export default function SalesChart({ data }) {
  return (
    <div style={styles.card}>
      <div style={styles.title}>Monthly Revenue</div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, 'Revenue']} />
          <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
