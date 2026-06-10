-- Query to fetch shift details for fShiftDetails object population
-- Joins M_Shift, M_ShiftHd, and M_ShiftLineBreak tables

SELECT
    -- From M_Shift table
    sh.ShiftCode,
    sh.ShiftName,
    sh.ShiftTime,
    sh.ShiftOverTime,
    sh.StartTime,
    sh.EndTime,
    sh.BreakTime,

    -- From M_ShiftHd table
    shd.AccountDate,
    shd.ShiftHeadID,
    shd.ShiftDate,

    -- From M_ShiftLineBreak table
    slb.LineCode,
    slb.ShiftLineBreakID,
    slb.BreakMins,
    slb.BreakStartTime,
    slb.BreakEndTime

FROM
    ProConMasters_001..M_Shift sh
    LEFT JOIN ProConMasters_001..M_ShiftHd shd ON sh.ShiftCode = shd.ShiftCode
    LEFT JOIN ProConMasters_001..M_ShiftLineBreak slb ON shd.ShiftHeadID = slb.ShiftHeadID

WHERE
    sh.ShiftCode = @ShiftCode
    AND shd.ShiftDate = @ReportDate
    AND slb.LineCode = @LineCode

ORDER BY
    slb.BreakStartTime
