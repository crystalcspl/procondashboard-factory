require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  database: 'ProConMasters_001',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
  connectionTimeout: 15000,
  requestTimeout: 30000,
};

async function run() {
  const pool = await sql.connect(config);

  // Check all PcsSAM pre-calculated fields for BOTH lines
  console.log('\n=== Pre-calculated PcsSAM fields for lines 008 and 043 ===');
  const r1 = await pool.request()
    .input('qdate', sql.VarChar(20), '26/05/2026')
    .query(`
      SELECT LineCode, StyleCodeStg,
        LineSWGSewnPcs, LineCHKPassedPcs,
        LineSWGPcsSAM,
        LineSWGCHKPCSSAM,
        LineSWGCHKAQLPCSSAM,
        LineSWGCHKAQLFINPCSSAM,
        LineSWGCHKAQLFINPKGPCSSAM,
        SectionSWGPcsSAM,
        SectionCHKPcsSAM
      FROM [ProConTrans_001_2026_2027]..T_FactLineProduction
      WHERE CAST(LDate AS DATE) = CONVERT(DATE, @qdate, 103)
        AND ShiftCode = '003'
        AND LineCode IN ('008', '043')
      ORDER BY LineCode
    `);
  console.log(JSON.stringify(r1.recordset, null, 2));

  await pool.close();
}

run().catch(err => { console.error('ERROR:', err.message); });
