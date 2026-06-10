-- ============================================================================
-- EFFICIENCY CALCULATION TEST QUERIES
-- ProCon Dashboard Test Suite
-- ============================================================================

-- ============================================================================
-- 1. VERIFY EFFICIENCY CONFIGURATION EXISTS
-- ============================================================================

-- Check M_BundleSettings for LineEffDefaultSettings
SELECT TOP 10
    BundleID,
    LineCode,
    LineEffDefaultSettings,
    ModifiedDate
FROM [ProConMasters_001]..M_BundleSettings
WHERE LineEffDefaultSettings IS NOT NULL AND LineEffDefaultSettings != ''
ORDER BY ModifiedDate DESC;

-- Sample output expected:
-- BundleID | LineCode | LineEffDefaultSettings           | ModifiedDate
-- 1        | L001     | 1,3,12345,8,12,16,Y,25,YYYY      | 2026-05-25 10:30:00


-- ============================================================================
-- 2. VERIFY SHIFT MASTER DATA
-- ============================================================================

-- Check shift configuration
SELECT
    ShiftCode,
    ShiftName,
    ShiftTime,
    ShiftOverTime,
    StartTime,
    EndTime,
    Active
FROM [ProConMasters_001]..M_Shift
WHERE Active = 'Y'
ORDER BY ShiftCode;

-- Sample output:
-- ShiftCode | ShiftName | ShiftTime | ShiftOverTime | StartTime | EndTime | Active
-- 001       | Shift A   | 480       | 0             | 09:00     | 17:00   | Y
-- 002       | Shift B   | 480       | 0             | 17:00     | 01:00   | Y
-- 003       | Shift C   | 480       | 0             | 01:00     | 09:00   | Y


-- ============================================================================
-- 3. VERIFY PRODUCTION DATA FIELDS EXIST
-- ============================================================================

-- Check T_FactLineProduction has all required fields
SELECT TOP 1
    LDate,
    LineCode,
    ShiftCode,
    -- Line-wise fields
    LineSWGPcsSAM,
    LineSWGPcsSAMOT,
    LineSWGProdTime,
    LineSWGProdTimeOT,
    LineSWGCHKPCSSAM,
    LineSWGCHKPCSSAMOT,
    -- Section-wise SAM fields
    SectionSWGPcsSAM,
    SectionSWGPcsSAMOT,
    SectionCHKPcsSAM,
    SectionCHKPcsSAMOT,
    SectionAQLPcsSAM,
    SectionAQLPcsSAMOT,
    SectionFINPcsSAM,
    SectionFINPcsSAMOT,
    SectionPKGPcsSAM,
    SectionPKGPcsSAMOT,
    -- Worked minutes
    SectionSWGWorkedMins,
    SectionSWGWorkedMinsOT,
    SectionCHKWorkedMins,
    SectionCHKWorkedMinsOT,
    -- Off-standard times (sample - Idle Time)
    SectionSWGIdleTime,
    SectionSWGIdleTimeOT,
    SectionCHKIdleTime,
    SectionCHKIdleTimeOT,
    -- Workstation metrics
    SectionSWGCapacityWs,
    SectionSWGActualWs,
    SectionSWGOprsAtt
FROM [ProConTrans_001_2026_2027]..T_FactLineProduction
WHERE CONVERT(VARCHAR, LDate, 101) = CONVERT(DateTime, '25/05/2026', 103)
  AND ShiftCode = '001'
ORDER BY LineCode;


-- ============================================================================
-- 4. TEST QUERY: SINGLE LINE PRODUCTION DATA
-- ============================================================================

-- Fetch production data for a specific line (L001), shift (001), date (25/05/2026)
SELECT
    a.LDate,
    a.LineCode,
    a.ShiftCode,
    -- Numerator fields: SAM/PcsSAM across all sections
    SUM(a.SectionSWGPcsSAM) AS SectionSWGPcsSAM,
    SUM(a.SectionSWGPcsSAMOT) AS SectionSWGPcsSAMOT,
    SUM(a.SectionCHKPcsSAM) AS SectionCHKPcsSAM,
    SUM(a.SectionCHKPcsSAMOT) AS SectionCHKPcsSAMOT,
    SUM(a.SectionAQLPcsSAM) AS SectionAQLPcsSAM,
    SUM(a.SectionAQLPcsSAMOT) AS SectionAQLPcsSAMOT,
    SUM(a.SectionFINPcsSAM) AS SectionFINPcsSAM,
    SUM(a.SectionFINPcsSAMOT) AS SectionFINPcsSAMOT,
    SUM(a.SectionPKGPcsSAM) AS SectionPKGPcsSAM,
    SUM(a.SectionPKGPcsSAMOT) AS SectionPKGPcsSAMOT,
    -- Denominator fields: Worked minutes
    SUM(a.SectionSWGWorkedMins) AS SectionSWGWorkedMins,
    SUM(a.SectionSWGWorkedMinsOT) AS SectionSWGWorkedMinsOT,
    SUM(a.SectionCHKWorkedMins) AS SectionCHKWorkedMins,
    SUM(a.SectionCHKWorkedMinsOT) AS SectionCHKWorkedMinsOT,
    SUM(a.SectionAQLWorkedMins) AS SectionAQLWorkedMins,
    SUM(a.SectionAQLWorkedMinsOT) AS SectionAQLWorkedMinsOT,
    SUM(a.SectionFINWorkedMins) AS SectionFINWorkedMins,
    SUM(a.SectionFINWorkedMinsOT) AS SectionFINWorkedMinsOT,
    SUM(a.SectionPKGWorkedMins) AS SectionPKGWorkedMins,
    SUM(a.SectionPKGWorkedMinsOT) AS SectionPKGWorkedMinsOT,
    -- Off-Standard Time: Idle
    SUM(a.SectionSWGIdleTime) AS SectionSWGIdleTime,
    SUM(a.SectionSWGIdleTimeOT) AS SectionSWGIdleTimeOT,
    SUM(a.SectionCHKIdleTime) AS SectionCHKIdleTime,
    SUM(a.SectionCHKIdleTimeOT) AS SectionCHKIdleTimeOT,
    SUM(a.SectionAQLIdleTime) AS SectionAQLIdleTime,
    SUM(a.SectionAQLIdleTimeOT) AS SectionAQLIdleTimeOT,
    SUM(a.SectionFINIdleTime) AS SectionFINIdleTime,
    SUM(a.SectionFINIdleTimeOT) AS SectionFINIdleTimeOT,
    SUM(a.SectionPKGIdleTime) AS SectionPKGIdleTime,
    SUM(a.SectionPKGIdleTimeOT) AS SectionPKGIdleTimeOT,
    -- Off-Standard Time: Non-Working
    SUM(a.SectionSWGNWTime) AS SectionSWGNWTime,
    SUM(a.SectionSWGNWTimeOT) AS SectionSWGNWTimeOT,
    SUM(a.SectionCHKNWTime) AS SectionCHKNWTime,
    SUM(a.SectionCHKNWTimeOT) AS SectionCHKNWTimeOT,
    SUM(a.SectionAQLNWTime) AS SectionAQLNWTime,
    SUM(a.SectionAQLNWTimeOT) AS SectionAQLNWTimeOT,
    SUM(a.SectionFINNWTime) AS SectionFINNWTime,
    SUM(a.SectionFINNWTimeOT) AS SectionFINNWTimeOT,
    SUM(a.SectionPKGNWTime) AS SectionPKGNWTime,
    SUM(a.SectionPKGNWTimeOT) AS SectionPKGNWTimeOT,
    -- Off-Standard Time: Breakdown
    SUM(a.SectionSWGBDTime) AS SectionSWGBDTime,
    SUM(a.SectionSWGBDTimeOT) AS SectionSWGBDTimeOT,
    SUM(a.SectionCHKBDTime) AS SectionCHKBDTime,
    SUM(a.SectionCHKBDTimeOT) AS SectionCHKBDTimeOT,
    SUM(a.SectionAQLBDTime) AS SectionAQLBDTime,
    SUM(a.SectionAQLBDTimeOT) AS SectionAQLBDTimeOT,
    SUM(a.SectionFINBDTime) AS SectionFINBDTime,
    SUM(a.SectionFINBDTimeOT) AS SectionFINBDTimeOT,
    SUM(a.SectionPKGBDTime) AS SectionPKGBDTime,
    SUM(a.SectionPKGBDTimeOT) AS SectionPKGBDTimeOT,
    -- Workstation metrics
    SUM(a.SectionSWGCapacityWs) AS SectionSWGCapacityWs,
    SUM(a.SectionCHKCapacityWs) AS SectionCHKCapacityWs,
    SUM(a.SectionAQLCapacityWs) AS SectionAQLCapacityWs,
    SUM(a.SectionFINCapacityWs) AS SectionFINCapacityWs,
    SUM(a.SectionPKGCapacityWs) AS SectionPKGCapacityWs,
    SUM(a.SectionSWGOprsAtt) AS SectionSWGOprsAtt,
    SUM(a.SectionCHKOprsAtt) AS SectionCHKOprsAtt,
    SUM(a.SectionAQLOprsAtt) AS SectionAQLOprsAtt,
    SUM(a.SectionFINOprsAtt) AS SectionFINOprsAtt,
    SUM(a.SectionPKGOprsAtt) AS SectionPKGOprsAtt
FROM [ProConTrans_001_2026_2027]..T_FactLineProduction a
WHERE CONVERT(VARCHAR, a.LDate, 101) = CONVERT(DateTime, '25/05/2026', 103)
  AND a.ShiftCode = '001'
  AND a.LineCode = 'L001'
GROUP BY a.LDate, a.LineCode, a.ShiftCode;


-- ============================================================================
-- 5. TEST QUERY: CALCULATE EFFICIENCY METRICS MANUALLY
-- ============================================================================

-- Manual efficiency calculation for verification
-- Use this to compare backend calculated efficiency
WITH EffData AS (
    SELECT
        CONVERT(VARCHAR, a.LDate, 101) AS ReportDate,
        a.LineCode,
        a.ShiftCode,
        -- Numerator: Total earned minutes (sum of all section SAMs)
        (SUM(a.SectionSWGPcsSAM) + SUM(a.SectionCHKPcsSAM) +
         SUM(a.SectionAQLPcsSAM) + SUM(a.SectionFINPcsSAM) +
         SUM(a.SectionPKGPcsSAM)) AS TotalEarnedMins,
        -- Denominator: Total worked minutes (before off-standard deduction)
        ((SUM(a.SectionSWGWorkedMins) + SUM(a.SectionCHKWorkedMins) +
          SUM(a.SectionAQLWorkedMins) + SUM(a.SectionFINWorkedMins) +
          SUM(a.SectionPKGWorkedMins)) * 60) AS TotalWorkedMins,
        -- Off-Standard Deductions
        (SUM(a.SectionSWGIdleTime) + SUM(a.SectionSWGNWTime) +
         SUM(a.SectionSWGBDTime) + SUM(a.SectionCHKIdleTime) +
         SUM(a.SectionCHKNWTime) + SUM(a.SectionCHKBDTime) +
         SUM(a.SectionAQLIdleTime) + SUM(a.SectionAQLNWTime) +
         SUM(a.SectionAQLBDTime) + SUM(a.SectionFINIdleTime) +
         SUM(a.SectionFINNWTime) + SUM(a.SectionFINBDTime) +
         SUM(a.SectionPKGIdleTime) + SUM(a.SectionPKGNWTime) +
         SUM(a.SectionPKGBDTime)) AS OffStandardMins
    FROM [ProConTrans_001_2026_2027]..T_FactLineProduction a
    WHERE CONVERT(VARCHAR, a.LDate, 101) = CONVERT(DateTime, '25/05/2026', 103)
      AND a.ShiftCode = '001'
      AND a.LineCode = 'L001'
    GROUP BY a.LDate, a.LineCode, a.ShiftCode
)
SELECT
    ReportDate,
    LineCode,
    ShiftCode,
    ROUND(TotalEarnedMins, 2) AS EarnedMinutes,
    ROUND(TotalWorkedMins, 2) AS WorkedMinutes,
    ROUND(OffStandardMins, 2) AS OffStandardDeduction,
    ROUND((TotalWorkedMins - OffStandardMins), 2) AS NetAvailableMinutes,
    CASE
        WHEN (TotalWorkedMins - OffStandardMins) <= 0 THEN 0
        ELSE ROUND((TotalEarnedMins / (TotalWorkedMins - OffStandardMins)) * 100, 0)
    END AS CalculatedEfficiency
FROM EffData;


-- ============================================================================
-- 6. TEST QUERY: VERIFY ALL REQUIRED COLUMNS EXIST
-- ============================================================================

-- Check if all required columns exist in T_FactLineProduction
-- This is a schema validation query
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'T_FactLineProduction'
  AND TABLE_SCHEMA = 'dbo'
  AND COLUMN_NAME IN (
      -- SAM fields
      'LineSWGPcsSAM', 'LineSWGPcsSAMOT',
      'LineSWGCHKPCSSAM', 'LineSWGCHKPCSSAMOT',
      'SectionSWGPcsSAM', 'SectionSWGPcsSAMOT',
      'SectionCHKPcsSAM', 'SectionCHKPcsSAMOT',
      'SectionAQLPcsSAM', 'SectionAQLPcsSAMOT',
      'SectionFINPcsSAM', 'SectionFINPcsSAMOT',
      'SectionPKGPcsSAM', 'SectionPKGPcsSAMOT',
      -- Worked minutes
      'SectionSWGWorkedMins', 'SectionSWGWorkedMinsOT',
      'SectionCHKWorkedMins', 'SectionCHKWorkedMinsOT',
      'SectionAQLWorkedMins', 'SectionAQLWorkedMinsOT',
      'SectionFINWorkedMins', 'SectionFINWorkedMinsOT',
      'SectionPKGWorkedMins', 'SectionPKGWorkedMinsOT',
      -- Off-standard times
      'SectionSWGIdleTime', 'SectionSWGIdleTimeOT',
      'SectionSWGNWTime', 'SectionSWGNWTimeOT',
      'SectionSWGBDTime', 'SectionSWGBDTimeOT',
      'SectionCHKIdleTime', 'SectionCHKIdleTimeOT',
      'SectionCHKNWTime', 'SectionCHKNWTimeOT',
      'SectionCHKBDTime', 'SectionCHKBDTimeOT',
      -- Workstation metrics
      'SectionSWGCapacityWs', 'SectionSWGOprsAtt'
  )
ORDER BY COLUMN_NAME;


-- ============================================================================
-- 7. DATA QUALITY CHECK
-- ============================================================================

-- Check for null values in critical columns
SELECT
    LineCode,
    ShiftCode,
    CONVERT(VARCHAR, LDate, 101) AS ReportDate,
    COUNT(*) AS RecordCount,
    SUM(CASE WHEN SectionSWGPcsSAM IS NULL THEN 1 ELSE 0 END) AS NullSWGPcsSAM,
    SUM(CASE WHEN SectionSWGWorkedMins IS NULL THEN 1 ELSE 0 END) AS NullSWGWorkedMins,
    SUM(CASE WHEN SectionSWGIdleTime IS NULL THEN 1 ELSE 0 END) AS NullSWGIdleTime
FROM [ProConTrans_001_2026_2027]..T_FactLineProduction
WHERE CONVERT(VARCHAR, LDate, 101) = CONVERT(DateTime, CONVERT(VARCHAR, GETDATE(), 103), 103)
GROUP BY LineCode, ShiftCode, LDate
HAVING COUNT(*) > 0;


-- ============================================================================
-- 8. CONFIGURATION VARIATION TEST
-- ============================================================================

-- Test with different configuration codes to verify settings load correctly
-- Expected output: Each row shows different efficiency type (24=Gross, 25=Net, etc.)
SELECT
    LineEffDefaultSettings,
    -- Extract and display each field
    SUBSTRING(LineEffDefaultSettings, 1, CHARINDEX(',', LineEffDefaultSettings)-1) AS Output,
    SUBSTRING(LineEffDefaultSettings, CHARINDEX(',', LineEffDefaultSettings)+1, 1) AS SAM,
    CASE
        WHEN LineEffDefaultSettings LIKE '%25,%' THEN 'Net'
        WHEN LineEffDefaultSettings LIKE '%24,%' THEN 'Gross'
        WHEN LineEffDefaultSettings LIKE '%28,%' THEN 'Target vs Actual'
        ELSE 'Unknown'
    END AS EfficiencyType
FROM [ProConMasters_001]..M_BundleSettings
WHERE LineEffDefaultSettings IS NOT NULL AND LineEffDefaultSettings != ''
LIMIT 5;


-- ============================================================================
-- 9. PERFORMANCE BASELINE TEST
-- ============================================================================

-- Get baseline query performance (should complete in < 100ms)
SET STATISTICS TIME ON;
SET STATISTICS IO ON;

SELECT
    COUNT(*) AS TotalRecords,
    COUNT(DISTINCT LineCode) AS UniqueLines,
    COUNT(DISTINCT ShiftCode) AS UniqueShifts,
    MIN(LDate) AS EarliestDate,
    MAX(LDate) AS LatestDate
FROM [ProConTrans_001_2026_2027]..T_FactLineProduction;

SET STATISTICS TIME OFF;
SET STATISTICS IO OFF;


-- ============================================================================
-- 10. EXPECTED EFFICIENCY VALUES
-- ============================================================================

-- Reference values for testing (when efficiency calculation is correct)
-- Efficiency should generally be:
-- < 60%  = Poor
-- 60-70% = Needs Improvement
-- 70-80% = Satisfactory
-- 80-90% = Good
-- ≥ 90%  = Excellent

-- Sample expected output from manual calculation:
-- ReportDate | LineCode | ShiftCode | EarnedMinutes | WorkedMinutes | OffStandardDeduction | NetAvailableMinutes | CalculatedEfficiency
-- 25/05/2026 | L001     | 001       | 1250.00       | 2880.00       | 90.00                | 2790.00             | 45
-- 25/05/2026 | L001     | 001       | 2400.00       | 3000.00       | 150.00               | 2850.00             | 84

-- ============================================================================
-- NOTES FOR TESTING
-- ============================================================================
/*
1. Replace dates ('25/05/2026') with current test date
2. Replace line codes ('L001') with actual line codes in your system
3. Run queries 1-3 first to verify data exists
4. Run query 4 to see raw production data
5. Run query 5 to manually calculate efficiency
6. Compare backend result with manual calculation from query 5
7. Run query 8 to test with different configurations
8. Monitor query 9 for performance issues

Expected results:
- All queries should return data (not empty)
- Calculated efficiency should be 0-100%
- OffStandardDeduction should never exceed WorkedMinutes
- Query execution time should be < 500ms
*/
