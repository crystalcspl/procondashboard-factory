const fs      = require('fs');
const path    = require('path');
const express = require('express');
const router  = express.Router();
const { getPool, getServerConn, validateDbName, sql } = require('../db/dynamicPool');

const ENV_PATH = path.resolve(__dirname, '../../.env');

function writeEnv(values) {
  let content = '';
  try { content = fs.readFileSync(ENV_PATH, 'utf8'); } catch {}
  for (const [key, val] of Object.entries(values)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const line  = `${key}=${val}`;
    if (regex.test(content)) {
      content = content.replace(regex, line);
    } else {
      content += (content.endsWith('\n') ? '' : '\n') + line + '\n';
    }
    process.env[key] = val;
  }
  fs.writeFileSync(ENV_PATH, content, 'utf8');
}

// GET /api/auth/is-configured
router.get('/is-configured', (req, res) => {
  const configured = !!(
    process.env.DB_SERVER &&
    process.env.DB_NAME   &&
    process.env.DB_USER   &&
    process.env.DB_PASSWORD
  );
  res.json({ configured });
});

// POST /api/auth/save-config
// Tests the connection, then persists it to .env on the server.
router.post('/save-config', async (req, res) => {
  const { server, dbname, username, password } = req.body;
  if (!server || !dbname || !username || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    validateDbName(dbname);
    const conn = { server, dbname, username, password };
    const pool = await getPool(conn, dbname);
    await pool.request().query('SELECT 1 AS ok');
    writeEnv({ DB_SERVER: server, DB_NAME: dbname, DB_USER: username, DB_PASSWORD: password });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/masters
router.get('/masters', async (req, res) => {
  try {
    const conn = getServerConn();
    const db   = validateDbName(conn.dbname || 'ProConDB');
    const pool = await getPool(conn, db);
    const result = await pool.request().query(`
      SELECT CompanyCode, CompanyName, DBName
      FROM [${db}].dbo.ProConMasters
      ORDER BY CompanyCode
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/transactions?companyCode=XXX
router.get('/transactions', async (req, res) => {
  const { companyCode } = req.query;
  if (!companyCode) return res.status(400).json({ error: 'companyCode is required.' });
  try {
    const conn = getServerConn();
    const db   = validateDbName(conn.dbname || 'ProConDB');
    const pool = await getPool(conn, db);
    const result = await pool.request()
      .input('companyCode', sql.VarChar(20), companyCode)
      .query(`
        SELECT *
        FROM [${db}].dbo.ProConTrans
        WHERE CompanyCode = @companyCode
        ORDER BY DBName DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { companyCode, masterDB, transDB, username, password, companyName } = req.body;
  if (!masterDB || !transDB || !username || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    validateDbName(masterDB);
    validateDbName(transDB);
    const conn = getServerConn();
    const pool = await getPool(conn, masterDB);
    const result = await pool.request()
      .input('username', sql.VarChar(100), username)
      .input('password', sql.VarChar(100), password)
      .query(`
        SELECT *
        FROM [${masterDB}]..M_UserHd
        WHERE AppType = 'REP'
          AND ProCon_Login_Name = @username
          AND ProCon_Login_Password = @password
      `);
    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const user = result.recordset[0];
    res.json({
      success: true,
      user: {
        companyCode,
        masterDB,
        transDB,
        username,
        companyName: companyName || '',
        displayName: user.UserName || user.ProCon_Login_Name || username,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
