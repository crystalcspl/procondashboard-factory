const express = require('express');
const router  = express.Router();
const { getPool, getServerConn, validateDbName, sql } = require('../db/dynamicPool');
const EfficiencyCalculator = require('../services/efficiencyCalculator');

// Simple TTL cache for rarely-changing lookups (M_BundleSettings, M_Shift, etc.)
const _cache = new Map();
function cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > e.ttl) { _cache.delete(key); return null; }
  return e.data;
}
function cacheSet(key, data, ttlMs = 60000) {
  _cache.set(key, { data, ts: Date.now(), ttl: ttlMs });
}

// Pending-promise map so parallel calls for identical params share one DB hit
const _pending = new Map();

// Comprehensive shared query — covers all columns needed by /production AND /efficiency.
// Called once per refresh; result cached 10s and deduped across concurrent requests.
async function fetchProductionData(conn, masterDB, transDB, date, shift, lineCode) {
  const cacheKey = `prod:${masterDB}:${transDB}:${date}:${shift}:${lineCode}`;

  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  if (_pending.has(cacheKey)) return _pending.get(cacheKey);

  const promise = (async () => {
    const pool = await getPool(conn, transDB);
    const result = await pool.request()
      .input('qdate',    sql.VarChar(20), date)
      .input('shift',    sql.VarChar(10), shift)
      .input('lineCode', sql.VarChar(20), lineCode)
      .query(`
        SELECT
          a.LDate, a.LineCode, b.ShortName AS LineName, b.LineIndex, a.ShiftCode,
          AVG(a.AvailMins)                                                           AS AvailMins,
          AVG(a.AvailMinsOT)                                                         AS AvailMinsOT,
          IsNull(Sum(a.SectionIssuedPcs),0)                                          As SectionIssuedPcs,
          IsNull(Sum(a.LineIssuedPcs),0)                                             As LineIssuedPcs,
          IsNull(Sum(a.LineTargetPcs),0)                                             As LineTargetPcs,
          IsNull(Sum(a.SectionTargetPcs),0)                                          As SectionTargetPcs,
          IsNull(Avg(a.SectionTargetEff),0)                                          As SectionTargetEff,
          IsNull(Avg(a.LineTargetEff),0)                                             As LineTargetEff,
          IsNull(Sum(a.SectionSWGOprsAtt),0)                                         As SectionSWGOprsAtt,
          IsNull(Sum(a.SectionSWGOprsAttOT),0)                                       As SectionSWGOprsAttOT,
          IsNull(Sum(a.SectionCHKOprsAtt),0)                                         As SectionCHKOprsAtt,
          IsNull(Sum(a.SectionCHKOprsAttOT),0)                                       As SectionCHKOprsAttOT,
          IsNull(Sum(a.SectionAQLOprsAtt),0)                                         As SectionAQLOprsAtt,
          IsNull(Sum(a.SectionAQLOprsAttOT),0)                                       As SectionAQLOprsAttOT,
          IsNull(Sum(a.SectionFINOprsAtt),0)                                         As SectionFINOprsAtt,
          IsNull(Sum(a.SectionFINOprsAttOT),0)                                       As SectionFINOprsAttOT,
          IsNull(Sum(a.SectionPKGOprsAtt),0)                                         As SectionPKGOprsAtt,
          IsNull(Sum(a.SectionPKGOprsAttOT),0)                                       As SectionPKGOprsAttOT,
          IsNull(Sum(a.SectionSWGCapacityWs),0)                                      As SectionSWGCapacityWs,
          IsNull(Sum(a.SectionSWGActualWs),0)                                        As SectionSWGActualWs,
          IsNull(Sum(a.SectionCHKCapacityWs),0)                                      As SectionCHKCapacityWs,
          IsNull(Sum(a.SectionCHKActualWs),0)                                        As SectionCHKActualWs,
          IsNull(Sum(a.SectionAQLCapacityWs),0)                                      As SectionAQLCapacityWs,
          IsNull(Sum(a.SectionAQLActualWs),0)                                        As SectionAQLActualWs,
          IsNull(Sum(a.SectionFINCapacityWs),0)                                      As SectionFINCapacityWs,
          IsNull(Sum(a.SectionFINActualWs),0)                                        As SectionFINActualWs,
          IsNull(Sum(a.SectionPKGCapacityWs),0)                                      As SectionPKGCapacityWs,
          IsNull(Sum(a.SectionPKGActualWs),0)                                        As SectionPKGActualWs,
          IsNull(Sum(a.SectionSWGOprsLoggedIn),0)                                    As SectionSWGOprsLoggedIn,
          IsNull(Sum(a.SectionCHKOprsLoggedIn),0)                                    As SectionCHKOprsLoggedIn,
          IsNull(Sum(a.SectionAQLOprsLoggedIn),0)                                    As SectionAQLOprsLoggedIn,
          IsNull(Sum(a.SectionFINOprsLoggedIn),0)                                    As SectionFINOprsLoggedIn,
          IsNull(Sum(a.SectionPKGOprsLoggedIn),0)                                    As SectionPKGOprsLoggedIn,
          IsNull(Sum(a.SectionSWGOnStdPcsSAM),0)                                     As SectionSWGOnStdPcsSAM,
          IsNull(Sum(a.SectionSWGWorkedMins / 60.0),0)                               As SectionSWGWorkedMins,
          IsNull(Sum(a.SectionSWGWorkedMinsOT / 60.0),0)                             As SectionSWGWorkedMinsOT,
          IsNull(Sum(a.SectionCHKWorkedMins / 60.0),0)                               As SectionCHKWorkedMins,
          IsNull(Sum(a.SectionCHKWorkedMinsOT / 60.0),0)                             As SectionCHKWorkedMinsOT,
          IsNull(Sum(a.SectionAQLWorkedMins / 60.0),0)                               As SectionAQLWorkedMins,
          IsNull(Sum(a.SectionAQLWorkedMinsOT / 60.0),0)                             As SectionAQLWorkedMinsOT,
          IsNull(Sum(a.SectionFINWorkedMins / 60.0),0)                               As SectionFINWorkedMins,
          IsNull(Sum(a.SectionFINWorkedMinsOT / 60.0),0)                             As SectionFINWorkedMinsOT,
          IsNull(Sum(a.SectionPKGWorkedMins / 60.0),0)                               As SectionPKGWorkedMins,
          IsNull(Sum(a.SectionPKGWorkedMinsOT / 60.0),0)                             As SectionPKGWorkedMinsOT,
          IsNull(Sum(a.SectionSWGPcsSAM),0)                                          As SectionSWGPcsSAM,
          IsNull(Sum(a.SectionSWGPcsSAMOT),0)                                        As SectionSWGPcsSAMOT,
          IsNull(Sum(a.SectionCHKPcsSAM),0)                                          As SectionCHKPcsSAM,
          IsNull(Sum(a.SectionCHKPcsSAMOT),0)                                        As SectionCHKPcsSAMOT,
          IsNull(Sum(a.SectionAQLPcsSAM),0)                                          As SectionAQLPcsSAM,
          IsNull(Sum(a.SectionAQLPcsSAMOT),0)                                        As SectionAQLPcsSAMOT,
          IsNull(Sum(a.SectionFINPcsSAM),0)                                          As SectionFINPcsSAM,
          IsNull(Sum(a.SectionFINPcsSAMOT),0)                                        As SectionFINPcsSAMOT,
          IsNull(Sum(a.SectionPKGPcsSAM),0)                                          As SectionPKGPcsSAM,
          IsNull(Sum(a.SectionPKGPcsSAMOT),0)                                        As SectionPKGPcsSAMOT,
          IsNull(Sum(a.LineSWGPcsSAM),0)                                             As LineSWGPcsSAM,
          IsNull(Sum(a.LineSWGPcsSAMOT),0)                                           As LineSWGPcsSAMOT,
          IsNull(Sum(a.LineSWGProdTime / 60.0),0)                                    As LineSWGProdTime,
          IsNull(Sum(a.LineSWGProdTimeOT / 60.0),0)                                  As LineSWGProdTimeOT,
          IsNull(Sum(a.LineSWGCHKPCSSAM),0)                                          As LineSWGCHKPCSSAM,
          IsNull(Sum(a.LineSWGCHKPCSSAMOT),0)                                        As LineSWGCHKPCSSAMOT,
          IsNull(Sum(a.LineSWGCHKProdTime / 60.0),0)                                 As LineSWGCHKProdTime,
          IsNull(Sum(a.LineSWGCHKProdTimeOT / 60.0),0)                               As LineSWGCHKProdTimeOT,
          IsNull(Sum(a.LineSWGCHKAQLPCSSAM),0)                                       As LineSWGCHKAQLPCSSAM,
          IsNull(Sum(a.LineSWGCHKAQLPCSSAMOT),0)                                     As LineSWGCHKAQLPCSSAMOT,
          IsNull(Sum(a.LineSWGCHKAQLProdTime / 60.0),0)                              As LineSWGCHKAQLProdTime,
          IsNull(Sum(a.LineSWGCHKAQLProdTimeOT / 60.0),0)                            As LineSWGCHKAQLProdTimeOT,
          IsNull(Sum(a.LineSWGCHKAQLFINPCSSAM),0)                                    As LineSWGCHKAQLFINPCSSAM,
          IsNull(Sum(a.LineSWGCHKAQLFINPCSSAMOT),0)                                  As LineSWGCHKAQLFINPCSSAMOT,
          IsNull(Sum(a.LineSWGCHKAQLFINProdTime / 60.0),0)                           As LineSWGCHKAQLFINProdTime,
          IsNull(Sum(a.LineSWGCHKAQLFINProdTimeOT / 60.0),0)                         As LineSWGCHKAQLFINProdTimeOT,
          IsNull(Sum(a.LineSWGCHKAQLFINPKGPCSSAM),0)                                 As LineSWGCHKAQLFINPKGPCSSAM,
          IsNull(Sum(a.LineSWGCHKAQLFINPKGPCSSAMOT),0)                               As LineSWGCHKAQLFINPKGPCSSAMOT,
          IsNull(Sum(a.LineSWGCHKAQLFINPKGProdTime / 60.0),0)                        As LineSWGCHKAQLFINPKGProdTime,
          IsNull(Sum(a.LineSWGCHKAQLFINPKGProdTimeOT / 60.0),0)                      As LineSWGCHKAQLFINPKGProdTimeOT,
          IsNull(Sum(a.SectionSWGSewnPcs),0)                                          As SectionSWGSewnPcs,
          IsNull(Sum(a.SectionSWGProdTime / 60.0),0)                                  As SectionSWGProdTime,
          IsNull(Sum(a.LineSWGSewnPcs),0)                                             As LineSWGSewnPcs,
          IsNull(Sum(a.LineSWGSewnPcsOT),0)                                           As LineSWGSewnPcsOT,
          IsNull(Sum(a.LineCHKPassedPcs),0)                                           As LineCHKPassedPcs,
          IsNull(Sum(a.LineCHKPassedPcsOT),0)                                         As LineCHKPassedPcsOT,
          IsNull(Sum(a.LineAQLPassedPcs),0)                                           As LineAQLPassedPcs,
          IsNull(Sum(a.LineAQLPassedPcsOT),0)                                         As LineAQLPassedPcsOT,
          IsNull(Sum(a.LineFINPassedPcs),0)                                           As LineFINPassedPcs,
          IsNull(Sum(a.LineFINPassedPcsOT),0)                                         As LineFINPassedPcsOT,
          IsNull(Sum(a.LinePKGPassedPcs),0)                                           As LinePKGPassedPcs,
          IsNull(Sum(a.LinePKGPassedPcsOT),0)                                         As LinePKGPassedPcsOT,
          IsNull(Sum(a.SectionSWGIdleTime / 60.0),0)                                  As SectionSWGIdleTime,
          IsNull(Sum(a.SectionSWGIdleTimeOT / 60.0),0)                                As SectionSWGIdleTimeOT,
          IsNull(Sum(a.SectionSWGNWTime / 60.0),0)                                    As SectionSWGNWTime,
          IsNull(Sum(a.SectionSWGNWTimeOT / 60.0),0)                                  As SectionSWGNWTimeOT,
          IsNull(Sum(a.SectionSWGBDTime / 60.0),0)                                    As SectionSWGBDTime,
          IsNull(Sum(a.SectionSWGBDTimeOT / 60.0),0)                                  As SectionSWGBDTimeOT,
          IsNull(Sum(a.SectionSWGRwTime / 60.0),0)                                    As SectionSWGRwTime,
          IsNull(Sum(a.SectionSWGRwTimeOT / 60.0),0)                                  As SectionSWGRwTimeOT,
          IsNull(Sum(a.SectionSWGNPTimeLine / 60.0),0)                                As SectionSWGNPTimeLine,
          IsNull(Sum(a.SectionSWGNPTimeLineOT / 60.0),0)                              As SectionSWGNPTimeLineOT,
          IsNull(Sum(a.SectionSWGNPTimeOPR / 60.0),0)                                 As SectionSWGNPTimeOPR,
          IsNull(Sum(a.SectionSWGNPTimeOPROT / 60.0),0)                               As SectionSWGNPTimeOPROT,
          IsNull(Sum(a.SectionCHKIdleTime / 60.0),0)                                  As SectionCHKIdleTime,
          IsNull(Sum(a.SectionCHKIdleTimeOT / 60.0),0)                                As SectionCHKIdleTimeOT,
          IsNull(Sum(a.SectionCHKNWTime / 60.0),0)                                    As SectionCHKNWTime,
          IsNull(Sum(a.SectionCHKNWTimeOT / 60.0),0)                                  As SectionCHKNWTimeOT,
          IsNull(Sum(a.SectionCHKBDTime / 60.0),0)                                    As SectionCHKBDTime,
          IsNull(Sum(a.SectionCHKBDTimeOT / 60.0),0)                                  As SectionCHKBDTimeOT,
          IsNull(Sum(a.SectionCHKNPTimeLine / 60.0),0)                                As SectionCHKNPTimeLine,
          IsNull(Sum(a.SectionCHKNPTimeLineOT / 60.0),0)                              As SectionCHKNPTimeLineOT,
          IsNull(Sum(a.SectionCHKNPTimeOPR / 60.0),0)                                 As SectionCHKNPTimeOPR,
          IsNull(Sum(a.SectionCHKNPTimeOPROT / 60.0),0)                               As SectionCHKNPTimeOPROT,
          IsNull(Sum(a.SectionAQLIdleTime / 60.0),0)                                  As SectionAQLIdleTime,
          IsNull(Sum(a.SectionAQLIdleTimeOT / 60.0),0)                                As SectionAQLIdleTimeOT,
          IsNull(Sum(a.SectionAQLNWTime / 60.0),0)                                    As SectionAQLNWTime,
          IsNull(Sum(a.SectionAQLNWTimeOT / 60.0),0)                                  As SectionAQLNWTimeOT,
          IsNull(Sum(a.SectionAQLBDTime / 60.0),0)                                    As SectionAQLBDTime,
          IsNull(Sum(a.SectionAQLBDTimeOT / 60.0),0)                                  As SectionAQLBDTimeOT,
          IsNull(Sum(a.SectionAQLNPTimeLine / 60.0),0)                                As SectionAQLNPTimeLine,
          IsNull(Sum(a.SectionAQLNPTimeLineOT / 60.0),0)                              As SectionAQLNPTimeLineOT,
          IsNull(Sum(a.SectionAQLNPTimeOPR / 60.0),0)                                 As SectionAQLNPTimeOPR,
          IsNull(Sum(a.SectionAQLNPTimeOPROT / 60.0),0)                               As SectionAQLNPTimeOPROT,
          IsNull(Sum(a.SectionFINIdleTime / 60.0),0)                                  As SectionFINIdleTime,
          IsNull(Sum(a.SectionFINIdleTimeOT / 60.0),0)                                As SectionFINIdleTimeOT,
          IsNull(Sum(a.SectionFINNWTime / 60.0),0)                                    As SectionFINNWTime,
          IsNull(Sum(a.SectionFINNWTimeOT / 60.0),0)                                  As SectionFINNWTimeOT,
          IsNull(Sum(a.SectionFINBDTime / 60.0),0)                                    As SectionFINBDTime,
          IsNull(Sum(a.SectionFINBDTimeOT / 60.0),0)                                  As SectionFINBDTimeOT,
          IsNull(Sum(a.SectionFINNPTimeLine / 60.0),0)                                As SectionFINNPTimeLine,
          IsNull(Sum(a.SectionFINNPTimeLineOT / 60.0),0)                              As SectionFINNPTimeLineOT,
          IsNull(Sum(a.SectionFINNPTimeOPR / 60.0),0)                                 As SectionFINNPTimeOPR,
          IsNull(Sum(a.SectionFINNPTimeOPROT / 60.0),0)                               As SectionFINNPTimeOPROT,
          IsNull(Sum(a.SectionPKGIdleTime / 60.0),0)                                  As SectionPKGIdleTime,
          IsNull(Sum(a.SectionPKGIdleTimeOT / 60.0),0)                                As SectionPKGIdleTimeOT,
          IsNull(Sum(a.SectionPKGNWTime / 60.0),0)                                    As SectionPKGNWTime,
          IsNull(Sum(a.SectionPKGNWTimeOT / 60.0),0)                                  As SectionPKGNWTimeOT,
          IsNull(Sum(a.SectionPKGBDTime / 60.0),0)                                    As SectionPKGBDTime,
          IsNull(Sum(a.SectionPKGBDTimeOT / 60.0),0)                                  As SectionPKGBDTimeOT,
          IsNull(Sum(a.SectionPKGNPTimeLine / 60.0),0)                                As SectionPKGNPTimeLine,
          IsNull(Sum(a.SectionPKGNPTimeLineOT / 60.0),0)                              As SectionPKGNPTimeLineOT,
          IsNull(Sum(a.SectionPKGNPTimeOPR / 60.0),0)                                 As SectionPKGNPTimeOPR,
          IsNull(Sum(a.SectionPKGNPTimeOPROT / 60.0),0)                               As SectionPKGNPTimeOPROT,
          IsNull(Sum(a.SectionCHKLoadingPcs),0)                                       As SectionCHKLoadingPcs,
          IsNull(Sum(a.SectionCHKRejectedPcs),0)                                      As SectionCHKRejectedPcs,
          IsNull(Sum(a.SectionCHKReworkPcs),0)                                        As SectionCHKReworkPcs,
          IsNull(Sum(a.SectionCHKPassedPcs),0)                                        As SectionCHKPassedPcs,
          IsNull(Sum(a.SectionCHKPassedPcsOT),0)                                      As SectionCHKPassedPcsOT,
          IsNull(Sum(a.SectionAQLRejectedPcs),0)                                      As SectionAQLRejectedPcs,
          IsNull(Sum(a.SectionAQLReworkPcs),0)                                        As SectionAQLReworkPcs,
          IsNull(Sum(a.SectionAQLPassedPcs),0)                                        As SectionAQLPassedPcs,
          IsNull(Sum(a.SectionAQLPassedPcsOT),0)                                      As SectionAQLPassedPcsOT,
          IsNull(Sum(a.SectionFINRejectedPcs),0)                                      As SectionFINRejectedPcs,
          IsNull(Sum(a.SectionFINReworkPcs),0)                                        As SectionFINReworkPcs,
          IsNull(Sum(a.SectionFINPassedPcs),0)                                        As SectionFINPassedPcs,
          IsNull(Sum(a.SectionFINPassedPcsOT),0)                                      As SectionFINPassedPcsOT,
          IsNull(Sum(a.SectionPKGRejectedPcs),0)                                      As SectionPKGRejectedPcs,
          IsNull(Sum(a.SectionPKGReworkPcs),0)                                        As SectionPKGReworkPcs,
          IsNull(Sum(a.SectionPKGPassedPcs),0)                                        As SectionPKGPassedPcs,
          IsNull(Sum(a.SectionPKGPassedPcsOT),0)                                      As SectionPKGPassedPcsOT,
          IsNull(Sum(a.MechAlertReceived),0)                                           As MechAlertReceived,
          IsNull(Sum(a.MechAlertAttended),0)                                           As MechAlertAttended,
          IsNull(Sum(a.SuprAlertReceived),0)                                           As SuprAlertReceived,
          IsNull(Sum(a.SuprAlertAttended),0)                                           As SuprAlertAttended,
          MAX(a.StyleCodeStg)                                                          As StyleCodeStg,
          MAX(a.PoSlNoStg)                                                             As PoSlNoStg,
          IsNull((
            Select Count(*) FROM [${masterDB}]..M_LineDt AS ld2 WITH (NOLOCK)
            Where (ld2.ALineCode = a.LineCode) AND (ld2.CatCode <= '996') AND (ld2.RLoginType = 'OPLI')
              And (ld2.FOperationCode <> '99999') And (ld2.FOperationCode <> '99998')
              And (Convert(VarChar, ld2.LoginDateTime, 101) = CONVERT(DateTime, a.LDate, 103))
          ), 0) AS CurrNoOfOprsLoggedIn,
          IsNull((
            Select Count(*) FROM [${masterDB}]..M_QcLineDt AS qd2 WITH (NOLOCK)
            Where (qd2.ALineCode = a.LineCode) And (qd2.RLoginType = 'OPLI')
              And (Convert(VarChar, qd2.LoginDateTime, 101) = CONVERT(DateTime, a.LDate, 103))
          ), 0) AS CurrNoOfQcOprsLoggedIn,
          IsNull((
            Select IsNull(Sum(DateDiff(minute, ld.IEndDateTime, GetDate())), 0)
                 + IsNull(Sum(DateDiff(minute, ld.iBSWEndDateTime, GetDate())), 0)
            From [${masterDB}]..M_LineDt AS ld WITH (NOLOCK)
            Where (ld.ALineCode = a.LineCode)
              And (ld.CatCode <= '996') And (ld.RLoginType = 'OPLI')
              And (ld.FOperationCode <> '99999') And (ld.FOperationCode <> '99998')
              And (Convert(VarChar, ld.LoginDateTime, 101) = Convert(VarChar, a.LDate, 101))
          ), 0) AS CurrWorkedHrs,
          IsNull((
            Select IsNull(Sum(DateDiff(minute, qd.IEndDateTime, GetDate())), 0)
                 + IsNull(Sum(DateDiff(minute, qd.iBSWEndDateTime, GetDate())), 0)
            From [${masterDB}]..M_QcLineDt AS qd WITH (NOLOCK)
            Where (qd.ALineCode = a.LineCode)
              And (qd.UnitId Not In (Select UnitID From [${masterDB}]..M_IMUnit WITH (NOLOCK) Where Active = 'Y'))
              And (qd.RLoginType = 'OPLI') And (qd.MechSuprCode = '')
              And (Convert(VarChar, qd.LoginDateTime, 101) = Convert(VarChar, a.LDate, 101))
          ), 0) AS QCCurrWorkedHrs,
          IsNull((
            SELECT COUNT(LineCode) FROM [${masterDB}]..M_Hrs WITH (NOLOCK)
            WHERE LineCode = a.LineCode
              AND ShiftCode = a.ShiftCode
              AND WeekDayName = DATENAME(WEEKDAY, CONVERT(DATETIME, @qdate, 103))
              AND OtHour = 'N'
          ), 0) AS LineNoOfHrs
        FROM [${transDB}]..T_FactLineProduction AS a WITH (NOLOCK)
        INNER JOIN [${masterDB}]..M_LineHd AS b WITH (NOLOCK) ON a.LineCode = b.LineCode
        WHERE Convert(VarChar, LDate, 101) = CONVERT(DateTime, @qdate, 103)
          AND (a.ShiftCode = @shift)
          AND (b.LineType = 'S')
          AND (@lineCode = '' OR a.LineCode = @lineCode)
        GROUP BY a.LDate, a.LineCode, a.ShiftCode, b.ShortName, b.LineIndex
        ORDER BY b.LineIndex
      `);

    cacheSet(cacheKey, result.recordset, 10000);
    _pending.delete(cacheKey);
    return result.recordset;
  })();

  _pending.set(cacheKey, promise);
  promise.catch(() => _pending.delete(cacheKey));
  return promise;
}

function resolveContext(req) {
  const conn     = getServerConn();
  const masterDB = validateDbName(req.query.masterDB || process.env.MASTER_DB || 'ProConMasters_001');
  const transDB  = validateDbName(req.query.transDB  || process.env.TRANS_DB  || 'ProConTrans_001_2026_2027');
  return { conn, masterDB, transDB };
}

router.get('/lines', async (req, res) => {
  try {
    const { conn, masterDB } = resolveContext(req);
    const pool = await getPool(conn, masterDB);
    const result = await pool.request().query(`
      SELECT LineCode, ShortName, LineIndex
      FROM [${masterDB}]..M_LineHd
      WHERE LineType = 'S'
      ORDER BY LineIndex
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/shifts', async (req, res) => {
  try {
    const { conn, masterDB } = resolveContext(req);
    const pool = await getPool(conn, masterDB);
    const result = await pool.request().query(`
      SELECT ShiftCode, ShiftName
      FROM [${masterDB}]..M_Shift
      WHERE Active = 'Y'
      ORDER BY ShiftCode
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/production', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);

    const today = new Date();
    const dd    = String(today.getDate()).padStart(2, '0');
    const mm    = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy  = today.getFullYear();
    const defaultDate = `${dd}/${mm}/${yyyy}`;

    const { date = defaultDate, shift = '001', lineCode = '' } = req.query;

    const rows = await fetchProductionData(conn, masterDB, transDB, date, shift, lineCode);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'Production data not found' });
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/styledetails', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { date, shift, lineCode } = req.query;
    if (!date || !shift || !lineCode) return res.json([]);

    // Step 1: StyleCodeStg + PoSlNoStg from the shared cached production query (no extra DB hit)
    const prodRows = await fetchProductionData(conn, masterDB, transDB, date, shift, lineCode);
    if (!prodRows.length) return res.json([]);
    const { StyleCodeStg, PoSlNoStg } = prodRows[0];
    if (!StyleCodeStg) return res.json([]);

    const styleCodes = StyleCodeStg.split(',').map(s => s.trim()).filter(Boolean);
    const poSlNos    = (PoSlNoStg || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!styleCodes.length) return res.json([]);

    const pool = await getPool(conn, transDB);

    // Sanitised IN lists (values come from our own DB, not user input)
    const styleIn = styleCodes.map(s => `'${s.replace(/'/g, "''")}'`).join(',');
    const poIn    = poSlNos.length ? poSlNos.map(p => `'${p.replace(/'/g, "''")}'`).join(',') : `''`;

    // Financial year from report date (Indian FY: Apr–Mar)
    const [d, m, y] = date.split('/').map(Number);
    const fyStartYear = m >= 4 ? y : y - 1;
    const fyStart = `${fyStartYear}-04-01`;
    const fyEnd   = `${fyStartYear + 1}-03-31`;

    // Step 2: style details from V_StylePoHd
    const styleResult = await pool.request().query(`
      SELECT StyleCode, PoSlNo, BuyerName AS Buyer, StyleNo,
             PoNo, CONVERT(VARCHAR(10), PoDate, 103) AS PoDate, OrderQty,
             CONVERT(VARCHAR(10), ExFactoryDate, 103) AS ExFactoryDate
      FROM [${masterDB}]..V_StylePoHd WITH (NOLOCK)
      WHERE StyleCode IN (${styleIn}) AND PoSlNo IN (${poIn})
    `);

    // Step 3 & 4: running days + cumulative production per style/PO from T_FactStyleProduction
    const cumResult = await pool.request()
      .input('lc2',    sql.VarChar(20), lineCode)
      .input('fyStart', sql.VarChar(20), fyStart)
      .input('fyEnd',   sql.VarChar(20), fyEnd)
      .query(`
        SELECT StyleCode, PoSlNo,
               SUM(SewnPcs + OTSewnPcs) AS CumPrdnPcs,
               COUNT(DISTINCT ProdnDate) AS RunningDays
        FROM [${transDB}]..T_FactStyleProduction WITH (NOLOCK)
        WHERE ProdnDate >= @fyStart AND ProdnDate <= @fyEnd
          AND StyleCode IN (${styleIn}) AND PoSlNo IN (${poIn})
          AND LineCode = @lc2
        GROUP BY StyleCode, PoSlNo
      `);

    const cumMap = {};
    const rdMap  = {};
    cumResult.recordset.forEach(r => {
      const key = `${r.StyleCode}_${r.PoSlNo}`;
      cumMap[key] = r.CumPrdnPcs;
      rdMap[key]  = r.RunningDays;
    });

    const rows = styleResult.recordset
      .map(s => ({
        Buyer:          s.Buyer,
        StyleNo:        s.StyleNo,
        PoNo:           s.PoNo,
        PoDate:         s.PoDate,
        ExFactoryDate:  s.ExFactoryDate || '',
        OrderQty:       s.OrderQty,
        RunningDays:    rdMap[`${s.StyleCode}_${s.PoSlNo}`]  || 0,
        CumPrdnPcs:     cumMap[`${s.StyleCode}_${s.PoSlNo}`] || 0,
      }))
      .filter(r => r.CumPrdnPcs > 0);

    res.json(rows);
  } catch (err) {
    console.error('[STYLE DETAILS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/dhu', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { date, shift, lineCode = '' } = req.query;
    if (!date || !shift) return res.json([]);

    const [, m] = date.split('/').map(Number);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const tableName  = `T_QcProductionDt_${monthNames[m - 1]}`;

    const pool = await getPool(conn, transDB);
    const result = await pool.request()
      .input('qdate',    sql.VarChar(20), date)
      .input('shiftCode', sql.VarChar(10), shift)
      .input('lineCode', sql.VarChar(20), lineCode)
      .query(`
        SELECT c.ProcessCode,
               SUM(a.CheckedPcs)  AS CheckedPcs,
               SUM(a.ReWorkPcs)   AS ReWorkPcs,
               SUM(a.RejectedPcs) AS RejectedPcs
        FROM [${transDB}]..[${tableName}] a
        INNER JOIN [${masterDB}]..M_QcOperationSeq b
          ON a.StyleCode = b.StyleCode AND a.GroupCode = b.GroupCode AND a.QcOperationCode = b.QcOperationCode
        INNER JOIN [${masterDB}]..M_QcOperation c
          ON a.QcOperationCode = c.QcOperationCode
        WHERE CAST(a.ProdnDate AS DATE) = CONVERT(DATE, @qdate, 103)
          AND a.ShiftCode = @shiftCode
          AND (@lineCode = '' OR a.LineCode = @lineCode)
          AND c.ProcessCode IN ('004','005')
        GROUP BY c.ProcessCode
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('[DHU] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/qc-defects', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { date, shift, lineCode = '' } = req.query;
    if (!date || !shift) return res.json([]);

    const [, m] = date.split('/').map(Number);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const tableName  = `T_QcProductionDt_${monthNames[m - 1]}`;

    const pool = await getPool(conn, transDB);
    const result = await pool.request()
      .input('qdate',     sql.VarChar(20), date)
      .input('shiftCode', sql.VarChar(10), shift)
      .input('lineCode',  sql.VarChar(20), lineCode)
      .query(`
        SELECT d.DefectsDesc,
               SUM(a.ReWorkPcs + a.RejectedPcs) AS DefectPcs
        FROM [${transDB}]..[${tableName}] a
        INNER JOIN [${masterDB}]..M_QcOperationSeq b
          ON a.StyleCode = b.StyleCode AND a.GroupCode = b.GroupCode AND a.QcOperationCode = b.QcOperationCode
        INNER JOIN [${masterDB}]..M_QcOperation c
          ON a.QcOperationCode = c.QcOperationCode
        INNER JOIN [${masterDB}]..M_Defects d
          ON a.DefectCode = d.DefectsCode
        WHERE CAST(a.ProdnDate AS DATE) = CONVERT(DATE, @qdate, 103)
          AND a.ShiftCode = @shiftCode
          AND (@lineCode = '' OR a.LineCode = @lineCode)
          AND c.ProcessCode = '004'
        GROUP BY d.DefectsDesc
        HAVING SUM(a.ReWorkPcs + a.RejectedPcs) > 0
        ORDER BY SUM(a.ReWorkPcs + a.RejectedPcs) DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('[QC-DEFECTS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/histogram', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { date, shift, lineCode } = req.query;
    if (!date || !shift || !lineCode) return res.json({ data: [], target: 0, ucl: 0, lcl: 0 });

    const [dd, mm, yyyy] = date.split('/').map(Number);
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const swgTbl = `T_ProductionHd_${MONTHS[mm - 1]}`;
    const qcTbl  = `T_QcProductionHd_${MONTHS[mm - 1]}`;
    const ds     = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;

    const pool       = await getPool(conn, transDB);
    const masterPool = await getPool(conn, masterDB);

    // Line target for the shift
    const tgtResult = await pool.request()
      .input('ds',       sql.VarChar(20), ds)
      .input('shift',    sql.VarChar(10), shift)
      .input('lineCode', sql.VarChar(20), lineCode)
      .query(`
        SELECT SUM(ISNULL(LineTargetPcs, 0)) AS LineTargetPcs
        FROM [${transDB}]..T_FactLineProduction WITH (NOLOCK)
        WHERE CONVERT(DATE, LDate) = @ds AND ShiftCode = @shift AND LineCode = @lineCode
      `);
    const lineTarget = Number((tgtResult.recordset[0] || {}).LineTargetPcs) || 0;
    const bpt = Math.round(lineTarget * 0.80);
    const ucl = lineTarget;
    const lcl = Math.round(lineTarget * 0.60);

    // Sewing operations
    const swgResult = await pool.request()
      .input('ds2',       sql.VarChar(20), ds)
      .input('shift2',    sql.VarChar(10), shift)
      .input('lineCode2', sql.VarChar(20), lineCode)
      .query(`
        SELECT mo.OperationName AS OpName, os.OprSeqNo,
               ISNULL(SUM(a.SewnPcs), 0) AS ProdPcs
        FROM [${transDB}]..[${swgTbl}] a WITH (NOLOCK)
        INNER JOIN [${masterDB}]..M_OperationSeq os WITH (NOLOCK)
          ON a.StyleCode = os.StyleCode AND a.GroupCode = os.GroupCode AND a.OperationCode = os.OperationCode
        INNER JOIN [${masterDB}]..M_Operation mo WITH (NOLOCK)
          ON a.OperationCode = mo.OperationCode
        WHERE CONVERT(DATE, a.ProdnDate) = @ds2
          AND a.ShiftCode = @shift2 AND a.LineCode = @lineCode2 AND a.HrNo > 0
        GROUP BY mo.OperationName, os.OprSeqNo
        ORDER BY os.OprSeqNo
      `);

    // QC operations
    const qcResult = await pool.request()
      .input('ds3',       sql.VarChar(20), ds)
      .input('shift3',    sql.VarChar(10), shift)
      .input('lineCode3', sql.VarChar(20), lineCode)
      .query(`
        SELECT qo.QcOperationName AS OpName, qs.OprSeqNo,
               ISNULL(SUM(a.PassedPcs), 0) AS ProdPcs
        FROM [${transDB}]..[${qcTbl}] a WITH (NOLOCK)
        INNER JOIN [${masterDB}]..M_QcOperationSeq qs WITH (NOLOCK)
          ON a.StyleCode = qs.StyleCode AND a.GroupCode = qs.GroupCode AND a.QcOperationCode = qs.QcOperationCode
        INNER JOIN [${masterDB}]..M_QcOperation qo WITH (NOLOCK)
          ON a.QcOperationCode = qo.QcOperationCode
        WHERE CONVERT(DATE, a.ProdnDate) = @ds3
          AND a.ShiftCode = @shift3 AND a.LineCode = @lineCode3 AND a.HrNo > 0
        GROUP BY qo.QcOperationName, qs.OprSeqNo
        ORDER BY qs.OprSeqNo
      `);

    const data = [
      ...swgResult.recordset.map(r => ({ name: r.OpName, pcs: r.ProdPcs })),
      ...qcResult.recordset.map(r =>  ({ name: r.OpName, pcs: r.ProdPcs })),
    ];

    res.json({ data, target: lineTarget, bpt, ucl, lcl });
  } catch (err) {
    console.error('[HISTOGRAM] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/linewise-hourly', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { date, shift, lineCode = '' } = req.query;
    if (!date || !shift) return res.json({ section: 'Sewing', data: [] });

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const [dd, mm, yyyy] = date.split('/').map(Number);
    const swgTbl = `T_ProductionHD_${MONTHS[mm - 1]}`;
    const qcTbl  = `T_QcProductionHD_${MONTHS[mm - 1]}`;
    const ds     = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;

    const masterPool = await getPool(conn, masterDB);
    const pool       = await getPool(conn, transDB);

    // Determine output section from M_BundleSettings (cached, shared with /efficiency)
    let outputSection = 'Sewing';
    let processCode   = null;  // null → sewing path
    try {
      const settingsCacheKey = `bundle_settings:${masterDB}`;
      let lwhConfigString = cacheGet(settingsCacheKey);
      if (!lwhConfigString) {
        const settingsResult = await masterPool.request().query(`
          SELECT TOP 1 LineEffDefaultSettings
          FROM [${masterDB}]..M_BundleSettings
          WHERE LineEffDefaultSettings IS NOT NULL AND LineEffDefaultSettings != ''
        `);
        if (settingsResult.recordset.length > 0) {
          lwhConfigString = settingsResult.recordset[0].LineEffDefaultSettings;
          cacheSet(settingsCacheKey, lwhConfigString);
        }
      }
      if (lwhConfigString) {
        const calc = new EfficiencyCalculator(false);
        calc.dispEffSettings(lwhConfigString);
        if      (calc.I_L_Output_QC        === 1) { outputSection = 'EndLine CHK'; processCode = '004'; }
        else if (calc.I_L_Output_AQL       === 1) { outputSection = 'AQL';         processCode = '005'; }
        else if (calc.I_L_Output_Finishing === 1) { outputSection = 'Finishing';   processCode = '006'; }
        else if (calc.I_L_Output_Packing   === 1) { outputSection = 'Packing';     processCode = '007'; }
      }
    } catch (_) { /* default to sewing */ }

    let prodResult;
    if (processCode === null) {
      // Sewing hourly output
      prodResult = await pool.request()
        .input('ds',       sql.VarChar(20), ds)
        .input('shift',    sql.VarChar(10), shift)
        .input('lineCode', sql.VarChar(20), lineCode)
        .query(`
          SELECT ISNULL(lh.ShortName, p.linecode) AS LineName,
                 p.linecode AS LineCode,
                 TRY_CAST(p.HrNo AS INT) AS HrNo,
                 SUM(p.SewnPcs) AS OutputPcs
          FROM [${transDB}]..[${swgTbl}] p WITH (NOLOCK)
          INNER JOIN [${masterDB}]..M_OperationSeq os WITH (NOLOCK)
            ON p.StyleCode = os.StyleCode AND p.GroupCode = os.GroupCode
           AND p.OperationCode = os.OperationCode
          LEFT JOIN [${masterDB}]..M_LineHd lh WITH (NOLOCK) ON p.linecode = lh.linecode
          WHERE CONVERT(DATE, p.ProdnDate) = @ds
            AND os.StyleFinOpr = 'Y'
            AND p.ShiftCode = @shift
            AND (@lineCode = '' OR p.linecode = @lineCode)
          GROUP BY lh.ShortName, p.linecode, p.HrNo
          ORDER BY p.linecode, TRY_CAST(p.HrNo AS INT)
        `);
    } else {
      // EndLine CHK / AQL / Finishing / Packing hourly output
      prodResult = await pool.request()
        .input('ds',          sql.VarChar(20), ds)
        .input('shift',       sql.VarChar(10), shift)
        .input('lineCode',    sql.VarChar(20), lineCode)
        .input('processCode', sql.VarChar(10), processCode)
        .query(`
          SELECT ISNULL(lh.ShortName, p.linecode) AS LineName,
                 p.linecode AS LineCode,
                 TRY_CAST(p.HrNo AS INT) AS HrNo,
                 ISNULL(SUM(p.PassedPcs), 0) AS OutputPcs
          FROM [${transDB}]..[${qcTbl}] p WITH (NOLOCK)
          INNER JOIN [${masterDB}]..M_QcOperationSeq os WITH (NOLOCK)
            ON p.StyleCode = os.StyleCode AND p.GroupCode = os.GroupCode
           AND p.QcOperationCode = os.QcOperationCode
          LEFT JOIN [${masterDB}]..M_LineHd lh WITH (NOLOCK) ON p.linecode = lh.linecode
          WHERE CONVERT(DATE, p.ProdnDate) = @ds
            AND os.QcStyleFinOpr = 'Y'
            AND p.ShiftCode = @shift
            AND (@lineCode = '' OR p.linecode = @lineCode)
            AND os.ProcessCode = @processCode
          GROUP BY lh.ShortName, p.linecode, p.HrNo
          ORDER BY p.linecode, TRY_CAST(p.HrNo AS INT)
        `);
    }

    // Target per hour per line from T_FactLineProduction (same for all sections)
    const tgtResult = await pool.request()
      .input('ds2',       sql.VarChar(20), ds)
      .input('shift2',    sql.VarChar(10), shift)
      .input('lineCode2', sql.VarChar(20), lineCode)
      .query(`
        SELECT a.LineCode,
               SUM(ISNULL(a.LineTargetPcs, 0)) AS LineTargetPcs,
               ISNULL((
                 SELECT COUNT(h.LineCode)
                 FROM [${masterDB}]..M_Hrs h WITH (NOLOCK)
                 WHERE h.LineCode  = a.LineCode
                   AND h.ShiftCode = a.ShiftCode
                   AND h.WeekDayName = DATENAME(WEEKDAY, CONVERT(DATE, @ds2))
                   AND h.OtHour = 'N'
               ), 1) AS LineNoOfHrs
        FROM [${transDB}]..T_FactLineProduction a WITH (NOLOCK)
        WHERE CONVERT(DATE, a.LDate) = CONVERT(DATE, @ds2)
          AND a.ShiftCode = @shift2
          AND (@lineCode2 = '' OR a.LineCode = @lineCode2)
        GROUP BY a.LineCode, a.ShiftCode
      `);

    const targetMap = {};
    tgtResult.recordset.forEach(r => {
      const hrs = Math.max(1, Number(r.LineNoOfHrs) || 1);
      targetMap[r.LineCode] = Math.round(Number(r.LineTargetPcs) / hrs);
    });

    const data = prodResult.recordset.map(r => ({
      ...r,
      TargetPerHr: targetMap[r.LineCode] || 0,
    }));

    // Full hour series from M_Hrs (weekday + shift + line)
    const hrsResult = await masterPool.request()
      .input('ds3',       sql.VarChar(20), ds)
      .input('shift3',    sql.VarChar(10), shift)
      .input('lineCode3', sql.VarChar(20), lineCode)
      .query(`
        SELECT DISTINCT TRY_CAST(HrNo AS INT) AS HrNo
        FROM [${masterDB}]..M_Hrs WITH (NOLOCK)
        WHERE WeekDayName = DATENAME(WEEKDAY, CONVERT(DATE, @ds3))
          AND ShiftCode   = @shift3
          AND (@lineCode3 = '' OR LineCode = @lineCode3)
          AND OtHour = 'N'
        ORDER BY TRY_CAST(HrNo AS INT)
      `);
    const allHours = hrsResult.recordset.map(r => r.HrNo).filter(h => h != null);

    res.json({ section: outputSection, data, allHours });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/hourly-opr-operation', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { date, shift, lineCode = '' } = req.query;
    if (!date || !shift) return res.json([]);

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const [dd, mm, yyyy] = date.split('/').map(Number);
    const swgTbl = `T_ProductionHD_${MONTHS[mm - 1]}`;
    const ds     = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;

    const pool = await getPool(conn, transDB);

    const result = await pool.request()
      .input('ds',       sql.VarChar(20), ds)
      .input('shift',    sql.VarChar(10), shift)
      .input('lineCode', sql.VarChar(20), lineCode)
      .query(`
        SELECT
          g1.GroupName,       p.GroupCode,
          g2.GroupName  AS SubGroupName, os.LGroupCode AS SubGroupCode,
          p.OperationCode,    ISNULL(op.OperationName, p.OperationCode) AS OperationName,
          os.OprSeqNo,
          ISNULL(e.EmployeeName, p.EmployeeCode) AS EmployeeName, p.EmployeeCode,
          CAST(p.HrNo AS VARCHAR(10)) AS HrNo,
          SUM(p.SewnPcs) AS SewnPcs
        FROM [${transDB}]..[${swgTbl}] p WITH (NOLOCK)
        INNER JOIN [${masterDB}]..M_OperationSeq os WITH (NOLOCK)
          ON p.StyleCode = os.StyleCode AND p.GroupCode = os.GroupCode
         AND p.OperationCode = os.OperationCode
        INNER JOIN [${masterDB}]..M_Group g1 WITH (NOLOCK) ON os.GroupCode  = g1.GroupCode
        INNER JOIN [${masterDB}]..M_Group g2 WITH (NOLOCK) ON os.LGroupCode = g2.GroupCode
        LEFT  JOIN [${masterDB}]..M_Operation op WITH (NOLOCK) ON p.OperationCode = op.OperationCode
        LEFT  JOIN [${masterDB}]..M_Employee  e  WITH (NOLOCK) ON p.EmployeeCode  = e.EmployeeCode
        WHERE CONVERT(DATE, p.ProdnDate) = @ds
          AND p.ShiftCode = @shift
          AND (@lineCode = '' OR p.linecode = @lineCode)
        GROUP BY g1.GroupName, p.GroupCode, g2.GroupName, os.LGroupCode,
                 p.OperationCode, op.OperationName, os.OprSeqNo,
                 e.EmployeeName, p.EmployeeCode, p.HrNo
        ORDER BY TRY_CAST(os.OprSeqNo AS INT), TRY_CAST(p.HrNo AS INT)
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('[HOURLY-OPR-OPERATION] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/bd-nw', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { date, shift, lineCode = '' } = req.query;
    if (!date || !shift) return res.json({ bd: [], nw: [] });

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const [dd, mm, yyyy] = date.split('/').map(Number);
    const bdTbl = `T_DownTimeHd_${MONTHS[mm - 1]}`;
    const nwTbl = `T_NoWorkTimeHd_${MONTHS[mm - 1]}`;
    const ds    = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;

    const pool = await getPool(conn, transDB);

    const bdResult = await pool.request()
      .input('ds',       sql.VarChar(20), ds)
      .input('shift',    sql.VarChar(10), shift)
      .input('lineCode', sql.VarChar(20), lineCode)
      .query(`
        SELECT a.DownTimeCode + a.ReasonCode AS DTCode,
               b.WsNo, c.ReasonName,
               ROUND(SUM(a.TotalSecs / 60.0), 2) AS BDMins
        FROM [${transDB}]..[${bdTbl}] a WITH (NOLOCK)
        INNER JOIN [${masterDB}]..M_LineDt b WITH (NOLOCK) ON a.WsAutoId = b.WSAutoId
        INNER JOIN [${masterDB}]..M_DownTimeReason c WITH (NOLOCK)
          ON a.DownTimeCode = c.DownTimeCode AND a.ReasonCode = c.ReasonCode
        WHERE CONVERT(DATE, a.DTDate) = @ds
          AND a.ShiftCode = @shift
          AND (@lineCode = '' OR a.LineCode = @lineCode)
        GROUP BY a.DownTimeCode + a.ReasonCode, b.WsNo, c.ReasonName
        ORDER BY b.WsNo
      `);

    const nwResult = await pool.request()
      .input('ds2',       sql.VarChar(20), ds)
      .input('shift2',    sql.VarChar(10), shift)
      .input('lineCode2', sql.VarChar(20), lineCode)
      .query(`
        SELECT a.DownTimeCode + a.ReasonCode AS DTCode,
               b.WsNo, c.ReasonName,
               ROUND(SUM(a.TotalSecs / 60.0), 2) AS BDMins
        FROM [${transDB}]..[${nwTbl}] a WITH (NOLOCK)
        INNER JOIN [${masterDB}]..M_LineDt b WITH (NOLOCK) ON a.WsAutoId = b.WSAutoId
        INNER JOIN [${masterDB}]..M_DownTimeReason c WITH (NOLOCK)
          ON a.DownTimeCode = c.DownTimeCode AND a.ReasonCode = c.ReasonCode
        WHERE CONVERT(DATE, a.DTDate) = @ds2
          AND a.ShiftCode = @shift2
          AND (@lineCode2 = '' OR a.LineCode = @lineCode2)
        GROUP BY a.DownTimeCode + a.ReasonCode, b.WsNo, c.ReasonName
        ORDER BY b.WsNo
      `);

    res.json({ bd: bdResult.recordset, nw: nwResult.recordset });
  } catch (err) {
    console.error('[BD-NW] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/bd-nw-detail', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { date, shift, lineCode = '', type = 'bd' } = req.query;
    if (!date || !shift) return res.json([]);

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const [dd, mm, yyyy] = date.split('/').map(Number);
    const month    = MONTHS[mm - 1];
    const dtTbl    = type === 'nw' ? `T_NoWorkTimeHd_${month}` : `T_DownTimeHd_${month}`;
    const loginTbl = `T_EmpLoginDt_${month}`;
    const ds       = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;

    const pool = await getPool(conn, transDB);

    const result = await pool.request()
      .input('ds',       sql.VarChar(20), ds)
      .input('shift',    sql.VarChar(10), shift)
      .input('lineCode', sql.VarChar(20), lineCode)
      .query(`
        SELECT
          ISNULL(d.LineName, a.LineCode)                              AS LineName,
          ISNULL(b.EmployeeNo,   '')                                  AS EmployeeNo,
          ISNULL(b.EmployeeName, a.EmployeeCode)                      AS EmployeeName,
          ISNULL(e.WsNo, '')                                          AS WsNo,
          (SELECT SUM(c.HrsWorked / 60.0)
           FROM [${transDB}]..[${loginTbl}] c WITH (NOLOCK)
           WHERE CONVERT(DATE, c.LDate) = CONVERT(DATE, a.DTDate)
             AND c.ShiftCode    = a.ShiftCode
             AND c.LineCode     = a.LineCode
             AND c.EmployeeCode = a.EmployeeCode
          )                                                           AS WorkedMins,
          a.DownTimeCode, a.ReasonCode,
          ISNULL(f.ReasonName, a.DownTimeCode + a.ReasonCode)         AS ReasonName,
          CONVERT(VARCHAR(8), a.StartDateTime, 108)                   AS StartTime,
          CONVERT(VARCHAR(8), a.EndDateTime,   108)                   AS EndTime,
          ROUND(a.TotalSecs / 60.0, 2)                                AS BDMins
        FROM [${transDB}]..[${dtTbl}] a WITH (NOLOCK)
        INNER JOIN [${masterDB}]..V_Employee          b WITH (NOLOCK) ON a.EmployeeCode = b.EmployeeCode
        INNER JOIN [${masterDB}]..M_LineHd            d WITH (NOLOCK) ON a.LineCode     = d.LineCode
        INNER JOIN [${masterDB}]..M_LineDt            e WITH (NOLOCK) ON a.WsAutoId     = e.WsAutoId
        LEFT  JOIN [${masterDB}]..M_DownTimeReason    f WITH (NOLOCK) ON a.DownTimeCode = f.DownTimeCode
                                                                      AND a.ReasonCode   = f.ReasonCode
        WHERE CONVERT(DATE, a.DTDate) = @ds
          AND a.ShiftCode = @shift
          AND (@lineCode = '' OR a.LineCode = @lineCode)
          AND d.LineType = 'S'
        ORDER BY d.LineIndex, b.EmployeeName, a.StartDateTime
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('[BD-NW-DETAIL] SQL Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/wip', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { lineCode = '' } = req.query;

    if (!lineCode) return res.json({ wipPcs: 0 });

    const pool = await getPool(conn, transDB);
    const result = await pool.request()
      .input('lineCode', sql.VarChar(20), lineCode)
      .query(`
        SELECT ISNULL(SUM(a.BundlePcs), 0) AS WipPcs
        FROM [${masterDB}]..T_Tags AS a WITH (NOLOCK)
        INNER JOIN [${masterDB}]..M_StyleHd AS c WITH (NOLOCK)
          ON a.BuyerCode = c.BuyerCode AND a.StyleCode = c.StyleCode
        INNER JOIN [${masterDB}]..M_StylePoHd AS d WITH (NOLOCK)
          ON a.BuyerCode = d.BuyerCode AND a.StyleCode = d.StyleCode AND a.PoSlNo = d.PoSlNo
        WHERE (a.TagID <> '')
          AND (a.TagStatus = 'U')
          AND (a.Status = 'I')
          AND (a.TagType = 'BD')
          AND (a.LastOprCode <> '9999')
          AND (c.StyleClosed = 'N')
          AND (d.PoClosed = 'N')
          AND a.IssuedLineCode = @lineCode
          AND a.GroupCode = (
            SELECT GroupCode FROM [${masterDB}]..M_OperationSeq WITH (NOLOCK)
            WHERE StyleFinOpr = 'Y' AND Cancelled = 'N' AND StyleCode = a.StyleCode
          )
          AND (a.LastOprSeqNo < (
            SELECT MAX(OprSeqNo) FROM [${masterDB}]..M_OperationSeq WITH (NOLOCK)
            WHERE Cancelled <> 'Y' AND StyleCode = a.StyleCode AND GroupCode = a.GroupCode
          ))
      `);

    res.json({ wipPcs: result.recordset[0]?.WipPcs || 0 });
  } catch (err) {
    console.error('[WIP] Error:', err.message);
    res.status(500).json({ error: err.message, wipPcs: 0 });
  }
});

router.get('/efficiency', async (req, res) => {
  const startTime = Date.now();
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const enableDebug = req.query.debug === 'true';

    const today = new Date();
    const dd    = String(today.getDate()).padStart(2, '0');
    const mm    = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy  = today.getFullYear();
    const defaultDate = `${dd}/${mm}/${yyyy}`;

    const { date = defaultDate, shift = '001' } = req.query;

    const pool = await getPool(conn, masterDB);

    // ===== DETERMINE SameDate vs NotSameDate =====
    let I_L_SameDate = 0;
    let I_L_NotSameDate = 0;
    let currentShiftCode = null;
    let minutesSinceShiftStart = 0;

    const isSameDate = date === defaultDate;

    if (isSameDate) {
      const currentTimeResult = await pool.request()
        .input('shiftCode', sql.VarChar(10), shift)
        .query(`
          DECLARE @CurrentTime TIME = CONVERT(TIME, GETDATE());
          SELECT TOP 1 ShiftCode,
            CONVERT(VARCHAR(8), CStartTime, 108) AS CStartTime,
            CONVERT(VARCHAR(8), CEndTime, 108) AS CEndTime
          FROM [${masterDB}]..M_ShiftHd
          WHERE ShiftCode = @shiftCode
            AND CAST(CStartTime AS TIME) <= @CurrentTime
            AND CAST(CEndTime AS TIME) >= @CurrentTime
          ORDER BY ShiftCode DESC
        `);

      if (currentTimeResult.recordset && currentTimeResult.recordset.length > 0) {
        currentShiftCode = currentTimeResult.recordset[0].ShiftCode;
        I_L_SameDate = 1;
        const shiftStartTime = currentTimeResult.recordset[0].CStartTime;
        const now = new Date();
        const [sh, sm] = shiftStartTime.split(':').map(Number);
        const shiftStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0);
        minutesSinceShiftStart = Math.floor((now - shiftStartDate) / 60000);
      } else {
        I_L_NotSameDate = 1;
      }
    } else {
      I_L_NotSameDate = 1;
    }

    // ===== BATCH BREAK QUERY — one row per line (SameDate only) =====
    const breakMap = {};
    let isBreakTime = false;
    let factoryBreakMins = 0;
    if (I_L_SameDate) {
      const breakBatch = await pool.request()
        .input('shiftCode', sql.VarChar(10), shift)
        .query(`
          DECLARE @CurrentTime TIME = CONVERT(TIME, GETDATE());
          DECLARE @WeekDay INT = DATEPART(WEEKDAY, GETDATE());
          SELECT LineCode,
                 ISNULL(SUM(
                   CASE WHEN CAST(BreakStartTime AS TIME) <= @CurrentTime
                        THEN DATEDIFF(MINUTE, CAST(BreakStartTime AS TIME), CAST(BreakEndTime AS TIME))
                        ELSE 0
                   END
                 ), 0) AS BreakMinsTillNow
          FROM [${masterDB}]..M_ShiftLineBreak
          WHERE ShiftCode = @shiftCode AND Active = 'Y' AND WeekDayNo = @WeekDay
          GROUP BY LineCode
        `);
      breakBatch.recordset.forEach(r => { breakMap[r.LineCode] = r.BreakMinsTillNow; });
      factoryBreakMins = Object.values(breakMap).length > 0 ? Math.max(...Object.values(breakMap)) : 0;

      // Detect if current time falls within any active break window
      const breakCheck = await pool.request()
        .input('shiftCode', sql.VarChar(10), shift)
        .query(`
          DECLARE @CTime TIME = CONVERT(TIME, GETDATE());
          DECLARE @WDay  INT  = DATEPART(WEEKDAY, GETDATE());
          SELECT COUNT(*) AS InBreak
          FROM [${masterDB}]..M_ShiftLineBreak
          WHERE ShiftCode = @shiftCode AND Active = 'Y' AND WeekDayNo = @WDay
            AND @CTime BETWEEN CAST(BreakStartTime AS TIME) AND CAST(BreakEndTime AS TIME)
        `);
      isBreakTime = (breakCheck.recordset[0]?.InBreak || 0) > 0;
    }

    // ===== EFFICIENCY SETTINGS =====
    const settingsCacheKey = `bundle_settings:${masterDB}`;
    let configString = cacheGet(settingsCacheKey);
    if (!configString) {
      const settingsResult = await pool.request().query(`
        SELECT TOP 1 LineEffDefaultSettings
        FROM [${masterDB}]..M_BundleSettings
        WHERE LineEffDefaultSettings IS NOT NULL AND LineEffDefaultSettings != ''
      `);
      if (!settingsResult.recordset || settingsResult.recordset.length === 0) {
        return res.status(400).json({ error: 'Efficiency Settings Not Found' });
      }
      configString = settingsResult.recordset[0].LineEffDefaultSettings;
      cacheSet(settingsCacheKey, configString);
    }

    const calculator = new EfficiencyCalculator(enableDebug);
    try {
      calculator.dispEffSettings(configString);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid efficiency settings' });
    }

    // ===== FETCH ALL LINES PRODUCTION DATA =====
    const prodRows = await fetchProductionData(conn, masterDB, transDB, date, shift, '');
    if (!prodRows || prodRows.length === 0) {
      return res.json({
        lines: [], factory: {}, shiftElapsed: minutesSinceShiftStart,
        metadata: { isSameDate: isSameDate, calculationTime: `${Date.now()-startTime}ms`, timestamp: new Date().toISOString() },
      });
    }

    // ===== SHIFT MASTER =====
    const shiftResult = await pool.request()
      .input('shiftCode', sql.VarChar(10), shift)
      .query(`
        SELECT TOP 1 ShiftCode, ShiftTime, ShiftOverTime
        FROM [${masterDB}]..M_Shift
        WHERE ShiftCode = @shiftCode
      `);
    const shiftData = shiftResult.recordset[0] || { ShiftCode: shift, ShiftTime: 480, ShiftOverTime: 0 };

    // ===== HELPERS =====
    function getOutputPcs(calc, row) {
      if (calc.I_L_Output_Sewing)    return (row.LineSWGSewnPcs || 0)           + (calc.I_L_WithOT ? (row.LineSWGSewnPcsOT || 0) : 0);
      if (calc.I_L_Output_QC)        return (row.LineCHKPassedPcs || 0)         + (calc.I_L_WithOT ? (row.LineCHKPassedPcsOT || 0) : 0);
      if (calc.I_L_Output_AQL)       return (row.LineAQLPassedPcs || 0)         + (calc.I_L_WithOT ? (row.LineAQLPassedPcsOT || 0) : 0);
      if (calc.I_L_Output_Finishing) return (row.LineFINPassedPcs || 0)         + (calc.I_L_WithOT ? (row.LineFINPassedPcsOT || 0) : 0);
      if (calc.I_L_Output_Packing)   return (row.LinePKGPassedPcs || 0)         + (calc.I_L_WithOT ? (row.LinePKGPassedPcsOT || 0) : 0);
      return 0;
    }

    function getOperators(calc, row) {
      if (calc.I_L_SameDate) {
        return (row.CurrNoOfOprsLoggedIn || 0) + (row.CurrNoOfQcOprsLoggedIn || 0);
      }
      return (row.SectionSWGOprsLoggedIn || 0) + (row.SectionCHKOprsLoggedIn || 0) +
             (row.SectionAQLOprsLoggedIn || 0) + (row.SectionFINOprsLoggedIn || 0) +
             (row.SectionPKGOprsLoggedIn || 0);
    }

    // ===== PER-LINE LOOP =====
    const lines = [];
    let totalEarnedMins = 0, totalAvailMins = 0, totalOutput = 0, totalTarget = 0, totalManDays = 0;
    let totalWs = 0, totalActiveWs = 0, totalPresentOprs = 0, totalFeeding = 0, totalWip = 0;
    let totalChkPassed = 0, totalChkRw = 0, totalChkRj = 0;
    let totalAqlPassed = 0, totalAqlRw = 0, totalAqlRj = 0;
    let totalFinPassed = 0, totalFinRw = 0, totalFinRj = 0;
    let totalPkgPassed = 0, totalPkgRw = 0, totalPkgRj = 0;
    let totalIdleTime = 0, totalNwTime = 0, totalBdTime = 0, totalRwTime = 0, totalNptOpr = 0, totalNptLine = 0;
    let totalMechRx = 0, totalMechAtt = 0, totalSuprRx = 0, totalSuprAtt = 0;
    let totalTargetEff = 0;

    for (const lineRow of prodRows) {
      const lineBreakMins         = I_L_SameDate ? (breakMap[lineRow.LineCode] || 0) : 0;
      const lineAvailWithoutBreak = I_L_SameDate ? (minutesSinceShiftStart - lineBreakMins) : 0;

      const lineResult = calculator.calculate(lineRow, shiftData, {
        reportDate:                    date,
        shiftCode:                     shift,
        currentShiftCode:              currentShiftCode || shift,
        breakMinsTillNow:              lineBreakMins,
        isSameDate:                    I_L_SameDate === 1,
        isNotSameDate:                 I_L_NotSameDate === 1,
        availableMinsWithBreakMins:    minutesSinceShiftStart,
        availableMinsWithOutBreakMins: lineAvailWithoutBreak,
      });

      const outputPcs = getOutputPcs(calculator, lineRow);
      const target    = lineRow.LineTargetPcs || 0;
      const operators = getOperators(calculator, lineRow);
      const withOT    = calculator.I_L_WithOT;
      const g = (f) => lineRow[f] || 0;

      const lineAllWs      = g('SectionSWGCapacityWs')+g('SectionCHKCapacityWs')+g('SectionAQLCapacityWs')+g('SectionFINCapacityWs')+g('SectionPKGCapacityWs');
      const lineAllActiveWs= g('SectionSWGActualWs')+g('SectionCHKActualWs')+g('SectionAQLActualWs')+g('SectionFINActualWs')+g('SectionPKGActualWs');
      const lineAllOprs    = I_L_SameDate
        ? (g('CurrNoOfOprsLoggedIn') + g('CurrNoOfQcOprsLoggedIn'))
        : (g('SectionSWGOprsLoggedIn')+g('SectionCHKOprsLoggedIn')+g('SectionAQLOprsLoggedIn')+g('SectionFINOprsLoggedIn')+g('SectionPKGOprsLoggedIn'));

      lines.push({
        lineCode:      lineRow.LineCode,
        lineName:      lineRow.LineName,
        efficiency:    lineResult.efficiency,
        earnedMins:    lineResult.earnedMinutes,
        availMins:     lineResult.availableMinutes,
        output:        outputPcs,
        target,
        operators,
        manDays:       lineResult.manDays,
        manDayMinutes: lineResult.shiftDetails.ManDayMinutes,
        feeding:       g('SectionIssuedPcs'),
        wip:           g('SectionCHKLoadingPcs'),
        totalWs:       lineAllWs,
        presentOprs:   lineAllOprs,
      });

      totalEarnedMins  += lineResult.earnedMinutes;
      totalAvailMins   += lineResult.availableMinutes;
      totalOutput      += outputPcs;
      totalTarget      += target;
      totalManDays     += lineResult.manDays;
      totalWs          += lineAllWs;
      totalActiveWs    += lineAllActiveWs;
      totalPresentOprs += lineAllOprs;
      totalFeeding     += g('SectionIssuedPcs');
      totalWip         += g('SectionCHKLoadingPcs');
      totalTargetEff   += g('LineTargetEff');

      totalChkPassed += g('LineCHKPassedPcs') + (withOT ? g('LineCHKPassedPcsOT') : 0);
      totalChkRw     += g('SectionCHKReworkPcs');
      totalChkRj     += g('SectionCHKRejectedPcs');
      totalAqlPassed += g('LineAQLPassedPcs') + (withOT ? g('LineAQLPassedPcsOT') : 0);
      totalAqlRw     += g('SectionAQLReworkPcs');
      totalAqlRj     += g('SectionAQLRejectedPcs');
      totalFinPassed += g('LineFINPassedPcs') + (withOT ? g('LineFINPassedPcsOT') : 0);
      totalFinRw     += g('SectionFINReworkPcs');
      totalFinRj     += g('SectionFINRejectedPcs');
      totalPkgPassed += g('LinePKGPassedPcs') + (withOT ? g('LinePKGPassedPcsOT') : 0);
      totalPkgRw     += g('SectionPKGReworkPcs');
      totalPkgRj     += g('SectionPKGRejectedPcs');

      totalIdleTime += g('SectionSWGIdleTime')+g('SectionSWGIdleTimeOT')+g('SectionCHKIdleTime')+g('SectionCHKIdleTimeOT')+g('SectionAQLIdleTime')+g('SectionAQLIdleTimeOT')+g('SectionFINIdleTime')+g('SectionFINIdleTimeOT')+g('SectionPKGIdleTime')+g('SectionPKGIdleTimeOT');
      totalNwTime   += g('SectionSWGNWTime')+g('SectionSWGNWTimeOT')+g('SectionCHKNWTime')+g('SectionCHKNWTimeOT')+g('SectionAQLNWTime')+g('SectionAQLNWTimeOT')+g('SectionFINNWTime')+g('SectionFINNWTimeOT')+g('SectionPKGNWTime')+g('SectionPKGNWTimeOT');
      totalBdTime   += g('SectionSWGBDTime')+g('SectionSWGBDTimeOT')+g('SectionCHKBDTime')+g('SectionCHKBDTimeOT')+g('SectionAQLBDTime')+g('SectionAQLBDTimeOT')+g('SectionFINBDTime')+g('SectionFINBDTimeOT')+g('SectionPKGBDTime')+g('SectionPKGBDTimeOT');
      totalRwTime   += g('SectionSWGRwTime')+g('SectionSWGRwTimeOT');
      totalNptOpr   += g('SectionSWGNPTimeOPR')+g('SectionSWGNPTimeOPROT')+g('SectionCHKNPTimeOPR')+g('SectionCHKNPTimeOPROT')+g('SectionAQLNPTimeOPR')+g('SectionAQLNPTimeOPROT')+g('SectionFINNPTimeOPR')+g('SectionFINNPTimeOPROT')+g('SectionPKGNPTimeOPR')+g('SectionPKGNPTimeOPROT');
      totalNptLine  += g('SectionSWGNPTimeLine')+g('SectionSWGNPTimeLineOT')+g('SectionCHKNPTimeLine')+g('SectionCHKNPTimeLineOT')+g('SectionAQLNPTimeLine')+g('SectionAQLNPTimeLineOT')+g('SectionFINNPTimeLine')+g('SectionFINNPTimeLineOT')+g('SectionPKGNPTimeLine')+g('SectionPKGNPTimeLineOT');

      totalMechRx  += g('MechAlertReceived');
      totalMechAtt += g('MechAlertAttended');
      totalSuprRx  += g('SuprAlertReceived');
      totalSuprAtt += g('SuprAlertAttended');
    }

    const factoryEfficiency = totalAvailMins > 0
      ? Math.round(totalEarnedMins / totalAvailMins * 100)
      : 0;

    const duration = Date.now() - startTime;

    res.json({
      lines,
      factory: {
        efficiency:   factoryEfficiency,
        output:       totalOutput,
        target:       totalTarget,
        manDays:      Math.round(totalManDays * 10) / 10,
        earnedMins:   totalEarnedMins,
        availMins:    totalAvailMins,
        totalWs:      totalWs,
        activeWs:     totalActiveWs,
        presentOprs:  totalPresentOprs,
        feeding:      totalFeeding,
        wip:          totalWip,
        targetEff:    prodRows.length > 0 ? Math.round(totalTargetEff / prodRows.length) : 0,
        shiftTime:    shiftData.ShiftTime || 480,
        manDayMinutes: I_L_SameDate ? (minutesSinceShiftStart - factoryBreakMins) : (shiftData.ShiftTime || 480),
        chkPassed: totalChkPassed, chkRw: totalChkRw, chkRj: totalChkRj,
        aqlPassed: totalAqlPassed, aqlRw: totalAqlRw, aqlRj: totalAqlRj,
        finPassed: totalFinPassed, finRw: totalFinRw, finRj: totalFinRj,
        pkgPassed: totalPkgPassed, pkgRw: totalPkgRw, pkgRj: totalPkgRj,
        idleTime: totalIdleTime, nwTime: totalNwTime, bdTime: totalBdTime,
        rwTime: totalRwTime, nptOpr: totalNptOpr, nptLine: totalNptLine,
        mechAlertReceived: totalMechRx, mechAlertAttended: totalMechAtt,
        suprAlertReceived: totalSuprRx, suprAlertAttended: totalSuprAtt,
      },
      shiftElapsed: minutesSinceShiftStart,
      isBreakTime,
      flags: calculator.getFlags(),
      metadata: {
        calculationTime: `${duration}ms`,
        timestamp:       new Date().toISOString(),
        isSameDate:      I_L_SameDate === 1,
      },
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('[FACTORY EFFICIENCY] Error:', err.message);
    res.status(500).json({ error: err.message, duration: `${duration}ms` });
  }
});

router.get('/top-operators', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { date, shift, lineCode } = req.query;
    if (!date || !shift || !lineCode) return res.json({ top: [], bottom: [] });

    const [dd, mm, yyyy] = date.split('/').map(Number);
    const MONTHS    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const loginTbl  = `T_EmpLoginDt_${MONTHS[mm - 1]}`;
    const ds        = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;

    const pool = await getPool(conn, transDB);
    const prodDtTbl = `T_ProductionDt_${MONTHS[mm - 1]}`;

    // Check SQL Server major version in Node.js to pick correct aggregation syntax
    const verResult  = await pool.request().query(
      `SELECT CAST(SUBSTRING(CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(20)),1,
        CHARINDEX('.',CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(20)))-1) AS INT) AS MajorVersion`
    );
    const majorVersion = verResult.recordset[0]?.MajorVersion || 0;

    const opNamesExpr = majorVersion >= 14
      // SQL Server 2017+ — STRING_AGG with DISTINCT via derived table
      ? `(SELECT STRING_AGG(t.OpName, ' | ')
          FROM (SELECT DISTINCT mo2.OperationName AS OpName
                FROM [${transDB}]..[${prodDtTbl}] pd2 WITH (NOLOCK)
                INNER JOIN [${masterDB}]..M_Operation mo2 WITH (NOLOCK)
                  ON pd2.OperationCode = mo2.OperationCode
                WHERE CONVERT(DATE, pd2.ProdnDate) = @ds
                  AND pd2.ShiftCode    = @shift
                  AND pd2.LineCode     = @lineCode
                  AND pd2.EmployeeCode = z.EmployeeCode
               ) t)`
      // SQL Server 2008-2016 — STUFF + FOR XML PATH
      : `STUFF((SELECT ' | ' + mo3.OperationName
               FROM [${transDB}]..[${prodDtTbl}] pd3 WITH (NOLOCK)
               INNER JOIN [${masterDB}]..M_Operation mo3 WITH (NOLOCK)
                 ON pd3.OperationCode = mo3.OperationCode
               WHERE CONVERT(DATE, pd3.ProdnDate) = @ds
                 AND pd3.ShiftCode    = @shift
                 AND pd3.LineCode     = @lineCode
                 AND pd3.EmployeeCode = z.EmployeeCode
               GROUP BY mo3.OperationName
               FOR XML PATH(''), TYPE).value('.','NVARCHAR(MAX)'), 1, 3, '')`;

    const result = await pool.request()
      .input('ds',       sql.VarChar(20), ds)
      .input('shift',    sql.VarChar(10), shift)
      .input('lineCode', sql.VarChar(20), lineCode)
      .query(`
        SELECT z.EmployeeCode, z.EmployeeName, z.EmployeeNo,
               CASE WHEN SUM(z.AvailMins) <= 0 THEN 0
                    ELSE ROUND(SUM(z.PcsSam) / SUM(z.AvailMins) * 100, 2)
               END AS Eff,
               ${opNamesExpr} AS OperationNames
        FROM (
          SELECT a.EmployeeCode, e.EmployeeName, e.EmployeeNo,
                 SUM(a.PcsSam)    AS PcsSam,
                 SUM(a.AvailMins) AS AvailMins
          FROM [${transDB}]..[${loginTbl}] a WITH (NOLOCK)
          INNER JOIN [${masterDB}]..M_Employee e WITH (NOLOCK)
            ON a.EmployeeCode = e.EmployeeCode
          WHERE CONVERT(DATE, a.LDate) = @ds
            AND a.ShiftCode = @shift
            AND a.LineCode  = @lineCode
            AND e.Active    = 'Y'
          GROUP BY a.EmployeeCode, e.EmployeeName, e.EmployeeNo
        ) z
        GROUP BY z.EmployeeCode, z.EmployeeName, z.EmployeeNo
        HAVING CASE WHEN SUM(z.AvailMins) <= 0 THEN 0
                    ELSE ROUND(SUM(z.PcsSam) / SUM(z.AvailMins) * 100, 2)
               END > 0
        ORDER BY Eff DESC
      `);

    const all      = result.recordset;
    const top      = all.slice(0, 5);
    const topCodes = new Set(top.map(r => r.EmployeeCode));
    const bottom   = all.filter(r => !topCodes.has(r.EmployeeCode)).slice(-5).reverse();

    res.json({ top, bottom });
  } catch (err) {
    console.error('[TOP-OPERATORS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/wip-report', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { lineCode = '', date, shift } = req.query;
    if (!lineCode || !date || !shift) return res.json([]);

    // Step 1: get StyleCodeStg from active production (same as /styledetails)
    const transPool = await getPool(conn, transDB);
    const stgResult = await transPool.request()
      .input('qdate',     sql.VarChar(20), date)
      .input('shiftCode', sql.VarChar(10), shift)
      .input('lineCode',  sql.VarChar(20), lineCode)
      .query(`
        SELECT TOP 1 StyleCodeStg
        FROM [${transDB}]..T_FactLineProduction WITH (NOLOCK)
        WHERE CAST(LDate AS DATE) = CONVERT(DATE, @qdate, 103)
          AND ShiftCode = @shiftCode AND LineCode = @lineCode
          AND StyleCodeStg <> ''
      `);

    if (!stgResult.recordset.length) return res.json([]);
    const styleCodes = stgResult.recordset[0].StyleCodeStg
      .split(',').map(s => s.trim()).filter(Boolean);
    if (!styleCodes.length) return res.json([]);
    const styleIn = styleCodes.map(s => `'${s.replace(/'/g, "''")}'`).join(',');

    const masterPool = await getPool(conn, masterDB);

    // Step 2: fetch ordered operations for each style (mirrors M_WIPOprSeq + V_StyleOperation)
    const oprMap  = {};  // key: StyleCode_GroupCode → [ {OperationCode, OperationName, GroupName, OprSeqNo}, ... ]
    const wipAcc  = {};  // key: StyleCode_GroupCode_OperationCode → { name, group, seqNo, BundlePcs, ProdnPcs }

    for (const sc of styleCodes) {
      const opRes = await masterPool.request()
        .input('sc', sql.VarChar(20), sc)
        .query(`
          SELECT os.GroupCode, os.OperationCode,
                 ISNULL(mo.OperationName, os.OperationCode) AS OperationName,
                 ISNULL(mg.GroupName,     os.GroupCode)     AS GroupName,
                 TRY_CAST(os.GrpSeqNo AS INT)               AS GrpSeqNo,
                 TRY_CAST(os.OprSeqNo AS INT)               AS OprSeqNo
          FROM [${masterDB}]..M_OperationSeq os WITH (NOLOCK)
          LEFT JOIN [${masterDB}]..M_Operation mo WITH (NOLOCK) ON os.OperationCode = mo.OperationCode
          LEFT JOIN [${masterDB}]..M_Group     mg WITH (NOLOCK) ON os.GroupCode     = mg.GroupCode
          WHERE os.StyleCode = @sc AND os.Cancelled = 'N'
          ORDER BY os.GrpSeqNo, os.OprSeqNo
        `);
      for (const row of opRes.recordset) {
        const gk  = `${sc}_${row.GroupCode}`;
        const wk  = `${gk}_${row.OperationCode}`;
        if (!oprMap[gk]) oprMap[gk] = [];
        oprMap[gk].push({ OperationCode: row.OperationCode, seqNo: row.OprSeqNo });
        // Prefix style code so same-named ops from different styles stay distinct in the chart
        const displayName = styleCodes.length > 1
          ? `${sc}: ${row.OperationName}`
          : row.OperationName;
        wipAcc[wk] = { styleCode: sc, name: displayName, group: row.GroupName, grpSeqNo: row.GrpSeqNo || 0, seqNo: row.OprSeqNo || 0, BundlePcs: 0, ProdnPcs: 0 };
      }
    }

    // Step 3: fetch tags with COprCodeStg / COprPcsStg (mirrors T_Tags query in VB.NET)
    const tagRes = await masterPool.request()
      .input('lineCode', sql.VarChar(20), lineCode)
      .query(`
        SELECT t.StyleCode, t.GroupCode,
               ISNULL(t.BundlePcs, 0)    AS BundlePcs,
               ISNULL(t.COprCodeStg, '') AS COprCodeStg,
               ISNULL(t.COprPcsStg,  '') AS COprPcsStg,
               t.LastOprSeqNo
        FROM [${masterDB}]..T_Tags t WITH (NOLOCK)
        INNER JOIN [${masterDB}]..M_StyleHd sh WITH (NOLOCK) ON t.StyleCode = sh.StyleCode
        WHERE t.TagID <> '' AND t.Status = 'I' AND t.TagStatus = 'U'
          AND t.TagType = 'BD' AND t.LastOprCode <> '9999'
          AND sh.StyleClosed = 'N'
          AND t.IssuedLineCode = @lineCode
          AND t.StyleCode IN (${styleIn})
          AND EXISTS (
            SELECT 1 FROM [${masterDB}]..V_StylePoHd sph WITH (NOLOCK)
            WHERE sph.BuyerCode = t.BuyerCode AND sph.StyleCode = t.StyleCode
              AND sph.PoSlNo = t.PoSlNo AND sph.PoClosed = 'N'
          )
          AND t.LastOprSeqNo < (
            SELECT MAX(os2.OprSeqNo)
            FROM [${masterDB}]..M_OperationSeq os2 WITH (NOLOCK)
            WHERE os2.Cancelled <> 'Y'
              AND os2.StyleCode = t.StyleCode AND os2.GroupCode = t.GroupCode
          )
      `);

    // Step 4: WIP algorithm
    // LastOprSeqNo = last operation the bundle ENTERED (not necessarily finished).
    // COprCodeStg  = per-op piece counts.
    //
    // Placement rule:
    //   - If cPcs[LastOprSeqNo op] == bundlePcs → bundle FINISHED that op → place at NEXT op
    //   - Otherwise                             → bundle IS AT that op    → place at SAME op
    // ProdnPcs at placement op = cPcs for that op (partial pieces already done there).
    for (const tag of tagRes.recordset) {
      const gk  = `${tag.StyleCode}_${tag.GroupCode}`;
      const ops = oprMap[gk] || [];
      if (!ops.length) continue;

      const bundlePcs = Number(tag.BundlePcs) || 0;
      const lastSeq   = Number(tag.LastOprSeqNo) || 0;

      // Find the op corresponding to LastOprSeqNo
      const currentIdx = lastSeq > 0 ? ops.findIndex(o => o.seqNo === lastSeq) : -1;

      // Parse COprCodeStg once
      let cCodes = [], cPcs = [];
      if (tag.COprCodeStg.trim() !== '') {
        cCodes = tag.COprCodeStg.split(',').map(s => s.trim());
        cPcs   = tag.COprPcsStg.split(',').map(s => Math.round(parseFloat(s) || 0));
      }

      // How many pieces completed the current op?
      let cPcsAtCurrent = 0;
      if (currentIdx >= 0) {
        const ci = cCodes.indexOf(ops[currentIdx].OperationCode);
        if (ci >= 0) cPcsAtCurrent = cPcs[ci];
      }

      // Determine placement
      let placeIdx;
      if (currentIdx === -1) {
        placeIdx = 0; // seqno not found → first op
      } else if (cPcsAtCurrent >= bundlePcs) {
        placeIdx = currentIdx + 1; // fully done → moved to next op
      } else {
        placeIdx = currentIdx; // not done / partial → still at this op
      }

      if (placeIdx >= ops.length) continue;

      const placedOpCode = ops[placeIdx].OperationCode;
      const wk = `${gk}_${placedOpCode}`;
      if (!wipAcc[wk]) continue;

      wipAcc[wk].BundlePcs += bundlePcs;

      // ProdnPcs = pieces already processed at placement op
      if (placeIdx === currentIdx) {
        // Bundle is AT the current op — partial pieces already done there
        wipAcc[wk].ProdnPcs += cPcsAtCurrent;
      } else {
        // Bundle moved to next op — check if that op also has some partial pieces
        const ci = cCodes.indexOf(placedOpCode);
        if (ci >= 0) wipAcc[wk].ProdnPcs += cPcs[ci];
      }
    }

    // Step 5: compute WIP per (StyleCode, GroupCode, OperationCode) — keep full wk as key
    // so operations from different styles never merge into the same bucket.
    const resultMap = {};
    for (const [wk, acc] of Object.entries(wipAcc)) {
      const wipPcs = Math.round(acc.BundlePcs - acc.ProdnPcs);
      resultMap[wk] = { styleCode: acc.styleCode, name: acc.name, group: acc.group, grpSeqNo: acc.grpSeqNo, seqNo: acc.seqNo, pcs: wipPcs > 0 ? wipPcs : 0 };
    }

    const allData = Object.values(resultMap)
      .sort((a, b) =>
        a.styleCode.localeCompare(b.styleCode) ||
        a.grpSeqNo  - b.grpSeqNo               ||
        a.seqNo     - b.seqNo
      );

    // Only include styles where at least one operation has WIP > 0.
    // If all ops for a style are 0, suppress the entire style.
    const styleHasWip = {};
    allData.forEach(r => { if (r.pcs > 0) styleHasWip[r.styleCode] = true; });
    const data = allData.filter(r => styleHasWip[r.styleCode]);

    res.json(data);
  } catch (err) {
    console.error('[WIP-REPORT] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/alert-report', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { date, shift, lineCode = '', alertType = 'mech', reportType = 'received' } = req.query;
    if (!date || !shift || !lineCode) return res.json([]);

    const alertTable = alertType === 'supr' ? 'T_SAlert' : 'T_MAlert';
    const pool = await getPool(conn, transDB);

    let result;
    if (reportType === 'pending') {
      // Same as received report but only unattended alerts (Attended = No)
      result = await pool.request()
        .input('qdate',    sql.VarChar(20), date)
        .input('shift',    sql.VarChar(10), shift)
        .input('lineCode', sql.VarChar(20), lineCode)
        .query(`
          SELECT
            d.SectionName                                                    AS [Section Name],
            e.ProcessName                                                    AS [Process],
            c.WSNo                                                           AS [W.S.No],
            b.EmployeeNo                                                     AS [Operator No],
            b.EmployeeName                                                   AS [Operator Name],
            CONVERT(VARCHAR(20), a.AlertRecdDateTime, 120)                   AS [Alert Received Time],
            'No'                                                             AS [Attended]
          FROM [${transDB}]..[${alertTable}] AS a WITH (NOLOCK)
          INNER JOIN [${masterDB}]..M_Employee  AS b WITH (NOLOCK) ON a.EmployeeCode = b.EmployeeCode
          INNER JOIN [${masterDB}]..M_LineDt    AS c WITH (NOLOCK) ON a.WsAutoId     = c.WSAutoId
          INNER JOIN [${masterDB}]..M_Section   AS d WITH (NOLOCK) ON a.SectionCode  = d.SectionCode
          INNER JOIN [${masterDB}]..M_Process   AS e WITH (NOLOCK) ON a.ProcessCode  = e.ProcessCode
          WHERE CONVERT(DATE, a.AlertRecdDateTime) = CONVERT(DATE, @qdate, 103)
            AND a.ShiftCode = @shift
            AND a.LineCode  = @lineCode
            AND a.AttendedDateTime IS NULL
          ORDER BY c.WSNo, b.EmployeeNo
        `);
    } else if (reportType === 'attended') {
      result = await pool.request()
        .input('qdate',    sql.VarChar(20), date)
        .input('shift',    sql.VarChar(10), shift)
        .input('lineCode', sql.VarChar(20), lineCode)
        .query(`
          SELECT
            d.SectionName                                                             AS [Section Name],
            f.ProcessName                                                             AS [Process],
            c.WSNo                                                                    AS [W.S.No],
            b.EmployeeNo                                                              AS [Operator No],
            b.EmployeeName                                                            AS [Operator Name],
            CONVERT(VARCHAR(20), a.AlertRecdDateTime, 120)                            AS [Alert Received Time],
            e.EmployeeNo                                                              AS [Mechanic No],
            e.EmployeeName                                                            AS [Mechanic Name],
            CONVERT(VARCHAR(20), a.AttendedDateTime, 120)                             AS [Alert Attended Time],
            CONVERT(VARCHAR(8), DATEADD(SECOND,
              DATEDIFF(SECOND, a.AlertRecdDateTime, a.AttendedDateTime), 0), 108)     AS [Diff Time]
          FROM [${transDB}]..[${alertTable}] AS a WITH (NOLOCK)
          INNER JOIN [${masterDB}]..M_Employee  AS b WITH (NOLOCK) ON a.EmployeeCode  = b.EmployeeCode
          INNER JOIN [${masterDB}]..M_Employee  AS e WITH (NOLOCK) ON a.MEmployeeCode = e.EmployeeCode
          INNER JOIN [${masterDB}]..M_LineDt    AS c WITH (NOLOCK) ON a.WsAutoId      = c.WSAutoId
          INNER JOIN [${masterDB}]..M_Section   AS d WITH (NOLOCK) ON a.SectionCode   = d.SectionCode
          INNER JOIN [${masterDB}]..M_Process   AS f WITH (NOLOCK) ON a.ProcessCode   = f.ProcessCode
          WHERE CONVERT(DATE, a.AlertRecdDateTime) = CONVERT(DATE, @qdate, 103)
            AND a.ShiftCode = @shift
            AND a.LineCode  = @lineCode
            AND a.AttendedDateTime IS NOT NULL
          ORDER BY c.WSNo, b.EmployeeNo
        `);
    } else {
      result = await pool.request()
        .input('qdate',    sql.VarChar(20), date)
        .input('shift',    sql.VarChar(10), shift)
        .input('lineCode', sql.VarChar(20), lineCode)
        .query(`
          SELECT
            d.SectionName                                                    AS [Section Name],
            e.ProcessName                                                    AS [Process],
            c.WSNo                                                           AS [W.S.No],
            b.EmployeeNo                                                     AS [Operator No],
            b.EmployeeName                                                   AS [Operator Name],
            CONVERT(VARCHAR(20), a.AlertRecdDateTime, 120)                   AS [Alert Received Time],
            CASE WHEN a.AttendedDateTime IS NOT NULL THEN 'Yes' ELSE 'No' END AS [Attended]
          FROM [${transDB}]..[${alertTable}] AS a WITH (NOLOCK)
          INNER JOIN [${masterDB}]..M_Employee  AS b WITH (NOLOCK) ON a.EmployeeCode = b.EmployeeCode
          INNER JOIN [${masterDB}]..M_LineDt    AS c WITH (NOLOCK) ON a.WsAutoId     = c.WSAutoId
          INNER JOIN [${masterDB}]..M_Section   AS d WITH (NOLOCK) ON a.SectionCode  = d.SectionCode
          INNER JOIN [${masterDB}]..M_Process   AS e WITH (NOLOCK) ON a.ProcessCode  = e.ProcessCode
          WHERE CONVERT(DATE, a.AlertRecdDateTime) = CONVERT(DATE, @qdate, 103)
            AND a.ShiftCode = @shift
            AND a.LineCode  = @lineCode
          ORDER BY c.WSNo, b.EmployeeNo
        `);
    }

    res.json(result.recordset);
  } catch (err) {
    console.error('[ALERT-REPORT] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/oprnpt-report', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { date, shift, lineCode } = req.query;
    if (!date || !shift || !lineCode) return res.json([]);

    // date arrives as DD/MM/YYYY
    const [dd, mm, yyyy] = date.split('/');
    const dateObj = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
    const weekdays = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const weekdayName = weekdays[dateObj.getDay()];
    const monthNames  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const empTable    = `T_EmpLoginHd_${monthNames[dateObj.getMonth()]}`;

    const masterPool = await getPool(conn, masterDB);
    const transPool  = await getPool(conn, transDB);

    // Fetch break definitions for this shift / line / weekday
    const breaksRes = await masterPool.request()
      .input('shiftCode',   sql.VarChar(10), shift)
      .input('lineCode',    sql.VarChar(20), lineCode)
      .input('weekdayName', sql.VarChar(20), weekdayName)
      .query(`
        SELECT *,
               CONVERT(varchar(8), BreakStartTime, 108) AS BStartStr,
               CONVERT(varchar(8), BreakEndTime,   108) AS BEndStr
        FROM [${masterDB}]..M_ShiftLineBreak WITH (NOLOCK)
        WHERE ShiftCode   = @shiftCode
          AND LineCode    = @lineCode
          AND WeekdayName = @weekdayName
        ORDER BY BreakStartTime
      `);

    const breaks = breaksRes.recordset;
    if (!breaks.length) return res.json([]);

    // Helper: subtract 1 second from HH:MM:SS string
    const subOneSec = (t) => {
      if (!t) return t;
      const [h, m, s] = t.split(':').map(Number);
      let ts = h * 3600 + m * 60 + s - 1;
      if (ts < 0) ts = 0;
      return `${String(Math.floor(ts/3600)).padStart(2,'0')}:${String(Math.floor((ts%3600)/60)).padStart(2,'0')}:${String(ts%60).padStart(2,'0')}`;
    };

    // Try transDB first (VB.NET used ProConTrans), fall back to masterDB
    const runEmpQuery = async (qFn) => {
      try { return await qFn(transPool, transDB); }
      catch (e) { return qFn(masterPool, masterDB); }
    };

    // Classify breaks
    const b998      = breaks.find(b => b.BreakCode === '998');
    const b999      = breaks.find(b => b.BreakCode === '999');
    const regBreaks = breaks.filter(b => b.BreakCode !== '998' && b.BreakCode !== '999');

    const results = [];

    // For break 998: BreakEndTime = actual shift start (late-login cutoff, e.g. 07:59:00)
    //                BreakStartTime = pre-shift allowance start (e.g. 07:57:00) — not used
    // Morning window: LogInDateTime > BreakEndTime(998)  AND  < subOneSec(BreakStartTime(firstRegBreak))
    const morningWinStart = b998?.BEndStr  || b998?.BStartStr || '00:00:00';
    const morningWinEnd   = regBreaks.length > 0 ? subOneSec(regBreaks[0].BStartStr) : '23:59:59';

    // --- 998: Late Login at Shift Start ---
    // WHERE LogInDateTime > morningWinStart AND < morningWinEnd
    // LateMins = DATEDIFF(minute, morningWinStart, MIN(LogIn))
    if (b998) {
      const r = await runEmpQuery((pool, db) => pool.request()
        .input('lineCode',  sql.VarChar(20), lineCode)
        .input('shiftCode', sql.VarChar(10), shift)
        .input('qdate',     sql.VarChar(20), date)
        .input('winStart',  sql.VarChar(8),  morningWinStart)
        .input('winEnd',    sql.VarChar(8),  morningWinEnd)
        .query(`
          SELECT ISNULL(COUNT(EmployeeCode), 0) AS NoOfOprs,
                 ISNULL(SUM(LateMins), 0)       AS TotalMins
          FROM (
            SELECT EmployeeCode,
                   DATEDIFF(minute, @winStart,
                     CONVERT(varchar(8), MIN(LogInDateTime), 108)) AS LateMins
            FROM [${db}]..${empTable} WITH (NOLOCK)
            WHERE LineCode  = @lineCode AND ShiftCode = @shiftCode
              AND CAST(LDate AS DATE) = CONVERT(DATE, @qdate, 103)
              AND CONVERT(varchar(8), LogInDateTime, 108) > @winStart
              AND CONVERT(varchar(8), LogInDateTime, 108) < @winEnd
            GROUP BY EmployeeCode
          ) x
        `));
      results.push({ breakName: b998.BreakName || b998.BreakCode, type: 'Late Login (Shift Start)',
        noOfOprs: r.recordset[0]?.NoOfOprs || 0,
        totalMins: Math.round(r.recordset[0]?.TotalMins || 0) });
    }


    res.json(results);
  } catch (err) {
    console.error('[OPRNPT-REPORT] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/top-rw-operators', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { date, shift, lineCode } = req.query;
    if (!date || !shift || !lineCode) return res.json([]);

    const [dd, mm, yyyy] = date.split('/').map(Number);
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // QC table: current month
    const qcTable = `T_QcProductionDt_${MONTHS[mm - 1]}`;

    // Production sewing table: current month + previous month
    // (a bundle may have been sewn last month and QC'd this month)
    const prevMm       = mm === 1 ? 12 : mm - 1;
    const prodTable    = `T_ProductionDt_${MONTHS[mm - 1]}`;
    const prodTablePrev = `T_ProductionDt_${MONTHS[prevMm - 1]}`;

    const pool = await getPool(conn, transDB);
    const result = await pool.request()
      .input('qdate',     sql.VarChar(20), date)
      .input('shiftCode', sql.VarChar(10), shift)
      .input('lineCode',  sql.VarChar(20), lineCode)
      .query(`
        SELECT TOP 5 x.SewingOperator, x.SewingOperation, SUM(x.ReworkPcs) AS ReworkPcs
        FROM (
          SELECT
            ISNULL((
              SELECT TOP 1 (bb.EmployeeNo + ' - ' + bb.EmployeeName)
              FROM (
                SELECT EmployeeCode, StyleCode, GroupCode, BundleID, FromPlyNo, OperationCode
                FROM [${transDB}]..[${prodTable}] WITH (NOLOCK)
                UNION ALL
                SELECT EmployeeCode, StyleCode, GroupCode, BundleID, FromPlyNo, OperationCode
                FROM [${transDB}]..[${prodTablePrev}] WITH (NOLOCK)
              ) aa
              INNER JOIN [${masterDB}]..M_Employee bb WITH (NOLOCK)
                ON aa.EmployeeCode = bb.EmployeeCode
              WHERE aa.StyleCode     = a.StyleCode
                AND aa.GroupCode     = a.GroupCode
                AND aa.BundleID      = a.BundleId
                AND aa.FromPlyNo     = a.FromPlyNo
                AND aa.OperationCode = a.OperationCode
            ), '') AS SewingOperator,
            ISNULL((
              SELECT TOP 1 op.OperationName
              FROM [${masterDB}]..M_Operation op WITH (NOLOCK)
              WHERE op.OperationCode = a.OperationCode
            ), '') AS SewingOperation,
            a.BundleId, a.BundleNo,
            SUM(a.ReworkPcs) AS ReworkPcs
          FROM [${transDB}]..[${qcTable}] a WITH (NOLOCK)
          WHERE CAST(a.ProdnDate AS DATE) = CONVERT(DATE, @qdate, 103)
            AND a.ShiftCode       = @shiftCode
            AND a.LineCode        = @lineCode
            AND a.QcOperationCode = '0002'
          GROUP BY a.BundleId, a.BundleNo, a.StyleCode, a.GroupCode, a.FromPlyNo, a.OperationCode
        ) x
        GROUP BY x.SewingOperator, x.SewingOperation
        HAVING SUM(x.ReworkPcs) > 0
        ORDER BY SUM(x.ReworkPcs) DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('[TOP-RW-OPERATORS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/active-orders', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { date, shift } = req.query;
    if (!date || !shift) return res.json([]);

    const prodRows = await fetchProductionData(conn, masterDB, transDB, date, shift, '');
    if (!prodRows.length) return res.json([]);

    // Build style/PO → lines map (one entry per unique styleCode+poSlNo combination)
    const styleLineMap = {};
    for (const row of prodRows) {
      if (!row.StyleCodeStg) continue;
      const styleCodes = row.StyleCodeStg.split(',').map(s => s.trim()).filter(Boolean);
      const poSlNos    = (row.PoSlNoStg || '').split(',').map(s => s.trim()).filter(Boolean);
      for (let i = 0; i < styleCodes.length; i++) {
        const styleCode = styleCodes[i];
        const poSlNo    = poSlNos[i] || poSlNos[0] || '';
        if (!styleCode) continue;
        const key = `${styleCode}_${poSlNo}`;
        if (!styleLineMap[key]) styleLineMap[key] = { styleCode, poSlNo, lines: [] };
        // avoid duplicate lines (same line may appear if multiple styles listed)
        if (!styleLineMap[key].lines.find(l => l.lineCode === row.LineCode)) {
          styleLineMap[key].lines.push({ lineCode: row.LineCode, lineName: row.LineName });
        }
      }
    }
    if (!Object.keys(styleLineMap).length) return res.json([]);

    const allStyles  = [...new Set(Object.values(styleLineMap).map(v => v.styleCode))];
    const allPoSlNos = [...new Set(Object.values(styleLineMap).map(v => v.poSlNo).filter(Boolean))];
    const pool       = await getPool(conn, masterDB);
    const styleIn    = allStyles.map(s  => `'${s.replace(/'/g, "''")}'`).join(',');
    const poIn       = allPoSlNos.length ? allPoSlNos.map(p => `'${p.replace(/'/g, "''")}'`).join(',') : `''`;

    // Style master with P.O. Date
    const styleResult = await pool.request().query(`
      SELECT StyleCode, PoSlNo, BuyerName AS Buyer, StyleNo,
             PoNo, CONVERT(VARCHAR(10), PoDate, 103) AS PoDate,
             CONVERT(VARCHAR(10), ExFactoryDate, 103) AS ExFactoryDate, OrderQty
      FROM [${masterDB}]..V_StylePoHd WITH (NOLOCK)
      WHERE StyleCode IN (${styleIn}) AND PoSlNo IN (${poIn})
    `);
    const styleDetailMap = {};
    styleResult.recordset.forEach(r => { styleDetailMap[`${r.StyleCode}_${r.PoSlNo}`] = r; });

    // Cumulative production + per-line running days (FY-wide)
    const [d, m, y] = date.split('/').map(Number);
    const fyStartYear = m >= 4 ? y : y - 1;
    const fyStart = `${fyStartYear}-04-01`;
    const fyEnd   = `${fyStartYear + 1}-03-31`;
    const transPool = await getPool(conn, transDB);

    // Determine which output column to use (same logic as /efficiency)
    let cumPcsExpr = 'SewnPcs + OTSewnPcs';
    const settingsCacheKey = `bundle_settings:${masterDB}`;
    let cfgStr = cacheGet(settingsCacheKey);
    if (!cfgStr) {
      try {
        const cfgPool = await getPool(conn, masterDB);
        const cfgResult = await cfgPool.request().query(`
          SELECT TOP 1 LineEffDefaultSettings
          FROM [${masterDB}]..M_BundleSettings
          WHERE LineEffDefaultSettings IS NOT NULL AND LineEffDefaultSettings != ''
        `);
        cfgStr = cfgResult.recordset[0]?.LineEffDefaultSettings || null;
        if (cfgStr) cacheSet(settingsCacheKey, cfgStr);
      } catch (_) {}
    }
    if (cfgStr) {
      try {
        const cfgCalc = new EfficiencyCalculator(false);
        cfgCalc.dispEffSettings(cfgStr);
        if      (cfgCalc.I_L_Output_QC        === 1) cumPcsExpr = 'QcPassedPcs + QcOtPassedPcs';
        else if (cfgCalc.I_L_Output_AQL       === 1) cumPcsExpr = 'QcAqlPassedPcs + QcOtAqlPassedPcs';
        else if (cfgCalc.I_L_Output_Finishing === 1) cumPcsExpr = 'QcFinishingPassedPcs + QcFinishingOTPassedPcs';
        else if (cfgCalc.I_L_Output_Packing   === 1) cumPcsExpr = 'QcPackingPassedPcs + QcPackingOTPassedPcs';
      } catch (_) {}
    }

    // FY cumulative production per style/PO/line from T_FactStyleProduction
    const cumResult = await transPool.request()
      .input('fyStart', sql.VarChar(20), fyStart)
      .input('fyEnd',   sql.VarChar(20), fyEnd)
      .query(`
        SELECT StyleCode, PoSlNo, LineCode,
               SUM(${cumPcsExpr}) AS CumPrdnPcs,
               COUNT(DISTINCT ProdnDate) AS RunningDays
        FROM [${transDB}]..T_FactStyleProduction WITH (NOLOCK)
        WHERE ProdnDate >= @fyStart AND ProdnDate <= @fyEnd
          AND StyleCode IN (${styleIn}) AND PoSlNo IN (${poIn})
        GROUP BY StyleCode, PoSlNo, LineCode
      `);

    const cumMap     = {};  // `${sc}_${po}` → total factory pcs
    const rdMap      = {};  // `${sc}_${po}_${lc}` → per-line running days
    const linePcsMap = {};  // `${sc}_${po}_${lc}` → per-line cumulative pcs
    cumResult.recordset.forEach(r => {
      const k = `${r.StyleCode}_${r.PoSlNo}`;
      cumMap[k]                        = (cumMap[k] || 0) + (r.CumPrdnPcs || 0);
      rdMap[`${k}_${r.LineCode}`]      = r.RunningDays || 0;
      linePcsMap[`${k}_${r.LineCode}`] = r.CumPrdnPcs  || 0;
    });

    const result = [];
    for (const [key, sl] of Object.entries(styleLineMap)) {
      const detail = styleDetailMap[key];
      if (!detail) continue;
      result.push({
        styleCode:     sl.styleCode,
        poSlNo:        sl.poSlNo,
        buyer:         detail.Buyer         || '',
        styleNo:       detail.StyleNo       || '',
        poNo:          detail.PoNo          || '',
        poDate:        detail.PoDate        || '',
        exFactoryDate: detail.ExFactoryDate || '',
        orderQty:      detail.OrderQty      || 0,
        prodnPcs:      cumMap[key]          || 0,
        lines: sl.lines.map(l => ({
          lineCode:    l.lineCode,
          lineName:    l.lineName,
          prodnPcs:    linePcsMap[`${key}_${l.lineCode}`] || 0,
          runningDays: rdMap[`${key}_${l.lineCode}`] || 0,
        })),
      });
    }

    // Sort by ex-factory date ascending (soonest deadline first)
    result.sort((a, b) => {
      if (a.exFactoryDate && b.exFactoryDate) {
        const parse = (s) => { const [dd,mm,yy] = s.split('/').map(Number); return new Date(yy,mm-1,dd); };
        return parse(a.exFactoryDate) - parse(b.exFactoryDate);
      }
      return a.exFactoryDate ? -1 : 1;
    });

    res.json(result);
  } catch (err) {
    console.error('[ACTIVE-ORDERS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/dpr', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { date, shift, viewType = '4', buyerCode = '', styleCode = '', poSlNo = '' } = req.query;
    if (!date || !shift) return res.json([]);

    const [, m, y] = date.split('/').map(Number);
    const fyStartYear = m >= 4 ? y : y - 1;
    const fyStart = `${fyStartYear}-04-01`;

    const vt = ['1','2','3','4'].includes(String(viewType)) ? String(viewType) : '4';

    const grpMaster = {
      '1': `v.BuyerCode, v.BuyerName, v.StyleCode, v.StyleNo, v.PoSlNo, v.PoNo, v.ColorCode, v.ColorName, v.SizeCode, v.SizeName`,
      '2': `v.BuyerCode, v.BuyerName, v.StyleCode, v.StyleNo, v.PoSlNo, v.PoNo, v.ColorCode, v.ColorName`,
      '3': `v.BuyerCode, v.BuyerName, v.StyleCode, v.StyleNo, v.PoSlNo, v.PoNo`,
      '4': `v.BuyerCode, v.StyleCode`,
    };
    const selMaster = {
      '1': `v.BuyerCode, v.BuyerName, v.StyleCode, v.StyleNo, v.PoSlNo, v.PoNo, v.ColorCode, v.ColorName, v.SizeCode, v.SizeName, MAX(ISNULL(v.OrderQty,0)) AS OrderQty, MAX(v.DestinationName) AS DestinationName`,
      '2': `v.BuyerCode, v.BuyerName, v.StyleCode, v.StyleNo, v.PoSlNo, v.PoNo, v.ColorCode, v.ColorName, SUM(ISNULL(v.OrderQty,0)) AS OrderQty, MAX(v.DestinationName) AS DestinationName`,
      '3': `v.BuyerCode, v.BuyerName, v.StyleCode, v.StyleNo, v.PoSlNo, v.PoNo, SUM(ISNULL(v.OrderQty,0)) AS OrderQty, MAX(v.DestinationName) AS DestinationName`,
      '4': `v.BuyerCode, MAX(v.BuyerName) AS BuyerName, v.StyleCode, MAX(v.StyleNo) AS StyleNo, SUM(ISNULL(v.OrderQty,0)) AS OrderQty`,
    };
    const grpTrans = {
      '1': `BuyerCode, StyleCode, PoSlNo, ColorCode, SizeCode`,
      '2': `BuyerCode, StyleCode, PoSlNo, ColorCode`,
      '3': `BuyerCode, StyleCode, PoSlNo`,
      '4': `BuyerCode, StyleCode`,
    };
    const selCols = {
      '1': `m.BuyerCode, m.BuyerName, m.StyleCode, m.StyleNo, m.PoSlNo, m.PoNo, m.ColorCode, m.ColorName, m.SizeCode, m.SizeName, m.OrderQty, m.DestinationName,`,
      '2': `m.BuyerCode, m.BuyerName, m.StyleCode, m.StyleNo, m.PoSlNo, m.PoNo, m.ColorCode, m.ColorName, m.OrderQty, m.DestinationName,`,
      '3': `m.BuyerCode, m.BuyerName, m.StyleCode, m.StyleNo, m.PoSlNo, m.PoNo, m.OrderQty, m.DestinationName,`,
      '4': `m.BuyerCode, m.BuyerName, m.StyleCode, m.StyleNo, m.OrderQty,`,
    };
    const joinCondCut = {
      '1': `c.BuyerCode=m.BuyerCode AND c.StyleCode=m.StyleCode AND c.PoSlNo=m.PoSlNo AND c.ColorCode=m.ColorCode AND c.SizeCode=m.SizeCode`,
      '2': `c.BuyerCode=m.BuyerCode AND c.StyleCode=m.StyleCode AND c.PoSlNo=m.PoSlNo AND c.ColorCode=m.ColorCode`,
      '3': `c.BuyerCode=m.BuyerCode AND c.StyleCode=m.StyleCode AND c.PoSlNo=m.PoSlNo`,
      '4': `c.BuyerCode=m.BuyerCode AND c.StyleCode=m.StyleCode`,
    };
    const joinCondProd = {
      '1': `p.BuyerCode=m.BuyerCode AND p.StyleCode=m.StyleCode AND p.PoSlNo=m.PoSlNo AND p.ColorCode=m.ColorCode AND p.SizeCode=m.SizeCode`,
      '2': `p.BuyerCode=m.BuyerCode AND p.StyleCode=m.StyleCode AND p.PoSlNo=m.PoSlNo AND p.ColorCode=m.ColorCode`,
      '3': `p.BuyerCode=m.BuyerCode AND p.StyleCode=m.StyleCode AND p.PoSlNo=m.PoSlNo`,
      '4': `p.BuyerCode=m.BuyerCode AND p.StyleCode=m.StyleCode`,
    };
    const joinCondDesp = {
      '1': `d.BuyerCode=m.BuyerCode AND d.StyleCode=m.StyleCode AND d.PoSlNo=m.PoSlNo AND d.ColorCode=m.ColorCode AND d.SizeCode=m.SizeCode`,
      '2': `d.BuyerCode=m.BuyerCode AND d.StyleCode=m.StyleCode AND d.PoSlNo=m.PoSlNo AND d.ColorCode=m.ColorCode`,
      '3': `d.BuyerCode=m.BuyerCode AND d.StyleCode=m.StyleCode AND d.PoSlNo=m.PoSlNo`,
      '4': `d.BuyerCode=m.BuyerCode AND d.StyleCode=m.StyleCode`,
    };
    const orderBy = {
      '1': `m.BuyerName, m.StyleNo, m.PoNo, m.ColorName, m.SizeName`,
      '2': `m.BuyerName, m.StyleNo, m.PoNo, m.ColorName`,
      '3': `m.BuyerName, m.StyleNo, m.PoNo`,
      '4': `m.BuyerName, m.StyleNo`,
    };

    const query = `
      ;WITH Master AS (
        SELECT ${selMaster[vt]}
        FROM [${masterDB}]..V_StylePoHdDt v WITH (NOLOCK)
        WHERE v.PoClosed = 'N' AND v.StyleClosed = 'N'
          AND (@buyerCode = '' OR v.BuyerCode = @buyerCode)
          AND (@styleCode = '' OR v.StyleCode = @styleCode)
          AND (@poSlNo    = '' OR v.PoSlNo    = @poSlNo)
        GROUP BY ${grpMaster[vt]}
      ),
      Cut AS (
        SELECT ${grpTrans[vt]},
          ISNULL(SUM(CASE WHEN CONVERT(DATE,ProdnDate)=CONVERT(DATE,@date,103) AND ShiftCode=@shift THEN CutPcs ELSE 0 END),0) AS CutToday,
          ISNULL(SUM(CASE WHEN ProdnDate>=@fyStart AND CONVERT(DATE,ProdnDate)<=CONVERT(DATE,@date,103) THEN CutPcs ELSE 0 END),0) AS CutCum
        FROM [${transDB}]..T_FactStyleCutting WITH (NOLOCK)
        WHERE ProdnDate >= @fyStart AND CONVERT(DATE,ProdnDate) <= CONVERT(DATE,@date,103)
        GROUP BY ${grpTrans[vt]}
      ),
      Prod AS (
        SELECT ${grpTrans[vt]},
          ISNULL(SUM(CASE WHEN CONVERT(DATE,ProdnDate)=CONVERT(DATE,@date,103) AND ShiftCode=@shift THEN IssuedPcs         ELSE 0 END),0) AS FedToday,
          ISNULL(SUM(CASE WHEN ProdnDate>=@fyStart AND CONVERT(DATE,ProdnDate)<=CONVERT(DATE,@date,103) THEN IssuedPcs         ELSE 0 END),0) AS FedCum,
          ISNULL(SUM(CASE WHEN CONVERT(DATE,ProdnDate)=CONVERT(DATE,@date,103) AND ShiftCode=@shift THEN SewnPcs+OTSewnPcs ELSE 0 END),0) AS SewnToday,
          ISNULL(SUM(CASE WHEN ProdnDate>=@fyStart AND CONVERT(DATE,ProdnDate)<=CONVERT(DATE,@date,103) THEN SewnPcs+OTSewnPcs ELSE 0 END),0) AS SewnCum,
          ISNULL(SUM(CASE WHEN CONVERT(DATE,ProdnDate)=CONVERT(DATE,@date,103) AND ShiftCode=@shift THEN QcPassedPcs      ELSE 0 END),0) AS ChkPasToday,
          ISNULL(SUM(CASE WHEN ProdnDate>=@fyStart AND CONVERT(DATE,ProdnDate)<=CONVERT(DATE,@date,103) THEN QcPassedPcs      ELSE 0 END),0) AS ChkPasCum,
          ISNULL(SUM(CASE WHEN CONVERT(DATE,ProdnDate)=CONVERT(DATE,@date,103) AND ShiftCode=@shift THEN QcRejectedPcs    ELSE 0 END),0) AS ChkRejToday,
          ISNULL(SUM(CASE WHEN ProdnDate>=@fyStart AND CONVERT(DATE,ProdnDate)<=CONVERT(DATE,@date,103) THEN QcRejectedPcs    ELSE 0 END),0) AS ChkRejCum,
          ISNULL(SUM(CASE WHEN CONVERT(DATE,ProdnDate)=CONVERT(DATE,@date,103) AND ShiftCode=@shift THEN QCAQLPassedPcs   ELSE 0 END),0) AS AQLPasToday,
          ISNULL(SUM(CASE WHEN ProdnDate>=@fyStart AND CONVERT(DATE,ProdnDate)<=CONVERT(DATE,@date,103) THEN QCAQLPassedPcs   ELSE 0 END),0) AS AQLPasCum,
          ISNULL(SUM(CASE WHEN CONVERT(DATE,ProdnDate)=CONVERT(DATE,@date,103) AND ShiftCode=@shift THEN QCAQLRejectedPcs ELSE 0 END),0) AS AQLRejToday,
          ISNULL(SUM(CASE WHEN ProdnDate>=@fyStart AND CONVERT(DATE,ProdnDate)<=CONVERT(DATE,@date,103) THEN QCAQLRejectedPcs ELSE 0 END),0) AS AQLRejCum,
          ISNULL(SUM(CASE WHEN CONVERT(DATE,ProdnDate)=CONVERT(DATE,@date,103) AND ShiftCode=@shift THEN QCFinishingPassedPcs   ELSE 0 END),0) AS FinPasToday,
          ISNULL(SUM(CASE WHEN ProdnDate>=@fyStart AND CONVERT(DATE,ProdnDate)<=CONVERT(DATE,@date,103) THEN QCFinishingPassedPcs   ELSE 0 END),0) AS FinPasCum,
          ISNULL(SUM(CASE WHEN CONVERT(DATE,ProdnDate)=CONVERT(DATE,@date,103) AND ShiftCode=@shift THEN QCFinishingRejectedPcs ELSE 0 END),0) AS FinRejToday,
          ISNULL(SUM(CASE WHEN ProdnDate>=@fyStart AND CONVERT(DATE,ProdnDate)<=CONVERT(DATE,@date,103) THEN QCFinishingRejectedPcs ELSE 0 END),0) AS FinRejCum,
          ISNULL(SUM(CASE WHEN CONVERT(DATE,ProdnDate)=CONVERT(DATE,@date,103) AND ShiftCode=@shift THEN QCPackingPassedPcs ELSE 0 END),0) AS PkgToday,
          ISNULL(SUM(CASE WHEN ProdnDate>=@fyStart AND CONVERT(DATE,ProdnDate)<=CONVERT(DATE,@date,103) THEN QCPackingPassedPcs ELSE 0 END),0) AS PkgCum
        FROM [${transDB}]..T_FactStyleProduction WITH (NOLOCK)
        WHERE ProdnDate >= @fyStart AND CONVERT(DATE,ProdnDate) <= CONVERT(DATE,@date,103)
        GROUP BY ${grpTrans[vt]}
      ),
      Desp AS (
        SELECT ${grpTrans[vt]},
          ISNULL(SUM(CASE WHEN CONVERT(DATE,DocDate)=CONVERT(DATE,@date,103) AND ShiftCode=@shift THEN DespatchPcs ELSE 0 END),0) AS DespToday,
          ISNULL(SUM(CASE WHEN CONVERT(DATE,DocDate)>=CONVERT(DATE,@fyStart) AND CONVERT(DATE,DocDate)<=CONVERT(DATE,@date,103) THEN DespatchPcs ELSE 0 END),0) AS DespCum
        FROM [${transDB}]..V_Despatch WITH (NOLOCK)
        WHERE CONVERT(DATE,DocDate) >= CONVERT(DATE,@fyStart)
          AND CONVERT(DATE,DocDate) <= CONVERT(DATE,@date,103)
          AND Cancelled <> 'Y'
        GROUP BY ${grpTrans[vt]}
      )
      SELECT
        ${selCols[vt]}
        ISNULL(c.CutToday, 0)                                                       AS CuttingToday,
        ISNULL(c.CutCum,   0)                                                       AS CuttingCum,
        m.OrderQty - ISNULL(c.CutCum, 0)                                           AS CuttingBalance,
        ISNULL(p.FedToday, 0)                                                       AS FeedingToday,
        ISNULL(p.FedCum,   0)                                                       AS FeedingCum,
        ISNULL(c.CutCum,   0) - ISNULL(p.FedCum,    0)                            AS FeedingWIP,
        ISNULL(p.SewnToday,0)                                                       AS SewnToday,
        ISNULL(p.SewnCum,  0)                                                       AS SewnCum,
        ISNULL(p.FedCum,   0) - ISNULL(p.SewnCum,   0)                            AS SewnWIP,
        ISNULL(p.ChkPasToday,0)                                                     AS ChkPassedToday,
        ISNULL(p.ChkPasCum,  0)                                                     AS ChkPassedCum,
        ISNULL(p.ChkRejToday,0)                                                     AS ChkRejToday,
        ISNULL(p.ChkRejCum,  0)                                                     AS ChkRejCum,
        ISNULL(p.SewnCum,  0) - ISNULL(p.ChkPasCum,0) - ISNULL(p.ChkRejCum,  0)  AS ChkWIP,
        ISNULL(p.AQLPasToday,0)                                                     AS AQLPassedToday,
        ISNULL(p.AQLPasCum,  0)                                                     AS AQLPassedCum,
        ISNULL(p.AQLRejToday,0)                                                     AS AQLRejToday,
        ISNULL(p.AQLRejCum,  0)                                                     AS AQLRejCum,
        ISNULL(p.ChkPasCum,  0) - ISNULL(p.AQLPasCum,0) - ISNULL(p.AQLRejCum,0)  AS AQLWIP,
        ISNULL(p.FinPasToday,0)                                                     AS FinPassedToday,
        ISNULL(p.FinPasCum,  0)                                                     AS FinPassedCum,
        ISNULL(p.FinRejToday,0)                                                     AS FinRejToday,
        ISNULL(p.FinRejCum,  0)                                                     AS FinRejCum,
        ISNULL(p.AQLPasCum,  0) - ISNULL(p.FinPasCum,0) - ISNULL(p.FinRejCum,0)  AS FinWIP,
        ISNULL(p.PkgToday, 0)                                                       AS PkgToday,
        ISNULL(p.PkgCum,   0)                                                       AS PkgCum,
        ISNULL(p.FinPasCum,  0) - ISNULL(p.PkgCum,  0)                            AS PkgWIP,
        ISNULL(d.DespToday,0)                                                       AS DespatchToday,
        ISNULL(d.DespCum,  0)                                                       AS DespatchCum,
        ISNULL(p.PkgCum,   0) - ISNULL(d.DespCum,  0)                             AS DespatchWIP
      FROM  Master m
      LEFT JOIN Cut  c ON ${joinCondCut[vt]}
      LEFT JOIN Prod p ON ${joinCondProd[vt]}
      LEFT JOIN Desp d ON ${joinCondDesp[vt]}
      WHERE ISNULL(c.CutCum,0) + ISNULL(p.SewnCum,0) + ISNULL(d.DespCum,0) > 0
      ORDER BY ${orderBy[vt]}
    `;

    const pool = await getPool(conn, transDB);
    const result = await pool.request()
      .input('date',      sql.VarChar(20), date)
      .input('shift',     sql.VarChar(10), shift)
      .input('fyStart',   sql.VarChar(20), fyStart)
      .input('buyerCode', sql.VarChar(30), buyerCode)
      .input('styleCode', sql.VarChar(30), styleCode)
      .input('poSlNo',    sql.VarChar(30), poSlNo)
      .query(query);

    res.json(result.recordset);
  } catch (err) {
    console.error('[DPR] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DPR cascade lookups ───────────────────────────────────────────────────────

router.get('/dpr-buyers', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const pool = await getPool(conn, transDB);
    const result = await pool.request().query(`
      SELECT BuyerCode, BuyerName, ShortName
      FROM [${masterDB}]..M_Buyer WITH (NOLOCK)
      WHERE Active = 'Y'
      ORDER BY BuyerName
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('[DPR-BUYERS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/dpr-styles', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { buyerCode } = req.query;
    if (!buyerCode) return res.json([]);
    const pool = await getPool(conn, transDB);
    const result = await pool.request()
      .input('buyerCode', sql.VarChar(30), buyerCode)
      .query(`
        SELECT StyleCode, StyleNo
        FROM [${masterDB}]..M_StyleHd WITH (NOLOCK)
        WHERE BuyerCode = @buyerCode AND Active = 'Y' AND StyleClosed = 'N'
        ORDER BY StyleNo
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('[DPR-STYLES] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/dpr-pos', async (req, res) => {
  try {
    const { conn, masterDB, transDB } = resolveContext(req);
    const { buyerCode, styleCode } = req.query;
    if (!buyerCode || !styleCode) return res.json([]);
    const pool = await getPool(conn, transDB);
    const result = await pool.request()
      .input('buyerCode', sql.VarChar(30), buyerCode)
      .input('styleCode', sql.VarChar(30), styleCode)
      .query(`
        SELECT PoSlNo, PoNo, CONVERT(VARCHAR(10), PoDate, 103) AS PoDate, DestinationName
        FROM [${masterDB}]..V_StylePoHd WITH (NOLOCK)
        WHERE BuyerCode = @buyerCode AND StyleCode = @styleCode AND PoClosed = 'N'
        ORDER BY PoNo
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('[DPR-POS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
