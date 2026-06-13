require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes      = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;
const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
  app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://localhost:3001'] }));
}
app.use(express.json());

app.use('/api/auth',      authRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve React app in production
if (!isDev) {
  const distPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
