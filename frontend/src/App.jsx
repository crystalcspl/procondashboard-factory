import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Dashboard from './pages/Dashboard';
import LoginForm from './pages/LoginForm';
import ConnectionSettings from './pages/ConnectionSettings';
import { loadSession, clearSession } from './utils/auth';

export default function App() {
  const [screen, setScreen] = useState('loading');

  useEffect(() => {
    axios.get('/api/auth/is-configured')
      .then(r => {
        if (!r.data.configured) { setScreen('connection'); return; }
        const session = loadSession();
        setScreen(session ? 'dashboard' : 'login');
      })
      .catch(() => setScreen('connection'));
  }, []);

  if (screen === 'loading') return null;

  if (screen === 'connection') {
    return (
      <ConnectionSettings
        onSaved={() => setScreen('login')}
        onBack={loadSession() ? () => setScreen('login') : null}
      />
    );
  }

  if (screen === 'login') {
    return (
      <LoginForm
        onLogin={() => setScreen('dashboard')}
        onSettings={() => {
          clearSession();
          setScreen('connection');
        }}
      />
    );
  }

  return (
    <Dashboard
      onLogout={() => {
        clearSession();
        setScreen('login');
      }}
    />
  );
}
