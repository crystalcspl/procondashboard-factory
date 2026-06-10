const sql = require('mssql');

const pools = new Map();

function buildConfig(conn, database) {
  return {
    server: conn.server,
    database: database || conn.dbname || 'ProConDB',
    user: conn.username,
    password: conn.password,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };
}

async function getPool(conn, database) {
  const db  = database || 'ProConDB';
  const key = `${conn.server}|${conn.username}|${db}`;

  if (pools.has(key)) {
    const existing = pools.get(key);
    if (existing.connected) return existing;
    pools.delete(key);
  }

  const pool = new sql.ConnectionPool(buildConfig(conn, db));
  await pool.connect();
  pools.set(key, pool);
  return pool;
}

// Parse the base64-encoded connection config from the X-DB-Config request header.
function parseConnHeader(req) {
  const header = req.headers['x-db-config'];
  if (!header) throw new Error('Missing X-DB-Config header — please log in again.');
  return JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
}

// Validate a database name to prevent SQL injection via dynamic DB names.
function validateDbName(name) {
  if (!name || !/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Invalid database name: "${name}"`);
  }
  return name;
}

function getServerConn() {
  return {
    server:   process.env.DB_SERVER   || '',
    dbname:   process.env.DB_NAME     || '',
    username: process.env.DB_USER     || '',
    password: process.env.DB_PASSWORD || '',
  };
}

module.exports = { getPool, parseConnHeader, getServerConn, validateDbName, sql };
