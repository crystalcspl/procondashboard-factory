/**
 * Efficiency Calculation Service
 * Implements the comprehensive efficiency calculation system based on SRS
 */

class EfficiencyCalculator {
  constructor(enableLogging = false) {
    this.resetFlags();
    this.enableLogging = enableLogging;
    this.debugLog = [];
  }

  /**
   * Internal logging method
   */
  log(section, message, data = null) {
    if (!this.enableLogging) return;
    const entry = { section, message, data, timestamp: new Date().toISOString() };
    this.debugLog.push(entry);
    // console.log suppressed — check this.debugLog for entries
  }

  /**
   * Get all debug logs
   */
  getDebugLog() {
    return this.debugLog;
  }

  /**
   * Reset all form-level flags to 0
   */
  resetFlags() {
    // Output Stage Flags
    this.I_L_Output_Sewing = 0;
    this.I_L_Output_QC = 0;
    this.I_L_Output_AQL = 0;
    this.I_L_Output_Finishing = 0;
    this.I_L_Output_Packing = 0;

    // SAM Type Flags
    this.I_L_EarnedMinutes_PcsSAM = 0;
    this.I_L_CycleTime_ProdTime = 0;
    this.I_L_StyleSAM = 0;

    // Section Reader Flags
    this.I_L_SewingOpr = 0;
    this.I_L_CheckingOpr = 0;
    this.I_L_AQLOpr = 0;
    this.I_L_FinishingOpr = 0;
    this.I_L_PackingOpr = 0;

    // Operator Type Flags
    this.I_L_Oprs_ManDays = 0;
    this.I_L_Oprs_AttOprs = 0;
    this.I_L_Oprs_NoOfWs = 0;

    // Time Format Flags (Without Overtime)
    this.I_L_Time_ShiftTime = 0;
    this.I_L_Time_HoursWorked = 0;
    this.I_L_Time_HoursWorked_Line_NP_Time = 0;
    this.I_L_Time_HoursWorked_Opr_NP_Time = 0;

    // Overtime Time Format Flags
    this.I_L_OTTime_OTShiftTime = 0;
    this.I_L_OTTime_OTHoursWorked = 0;
    this.I_L_OTTime_OTHoursWorked_Line_NP_Time = 0;
    this.I_L_OTTime_OTHoursWorked_Opr_NP_Time = 0;

    // Overtime Inclusion Flags
    this.I_L_WithOT = 0;
    this.I_L_WithOutOT = 0;

    // Off-Standard Time Component Flags
    this.I_L_IdleTime = 0;
    this.I_L_NWTime = 0;
    this.I_L_BDTime = 0;
    this.I_L_RWTime = 0;

    // Efficiency Type Flags
    this.I_L_Eff_OffStd_Gross = 0;
    this.I_L_Eff_OffStd_Net = 0;
    this.I_L_Eff_OnStd_Gross = 0;
    this.I_L_Eff_OnStd_Net = 0;
    this.I_L_Eff_TargetVsActual = 0;

    // Calculation Control Flags
    this.I_L_Eff_OT = 0;
    this.I_LineWise = 1;
    this.I_Sectionwise = 0;
    this.I_L_SameDate = 0;
    this.I_L_NotSameDate = 0;

    // Configuration Storage
    this.I_L_Eff_Default_Settings = '';
  }

  /**
   * Parse delimited strings
   * @param {string} pString - Source string
   * @param {number} pPosition - Field position (1-indexed)
   * @param {string} pDelimiter - Delimiter character
   * @returns {string} Parsed field value
   */
  getParseText(pString, pPosition, pDelimiter = '|') {
    if (!pString || pString.trim === '') {
      return '';
    }

    const parts = pString.split(pDelimiter);

    if (pPosition <= 0 || parts.length === 1) {
      pPosition = 1;
    }

    if (pPosition > parts.length) {
      return parts[parts.length - 1].trim();
    }

    return parts[pPosition - 1].trim();
  }

  /**
   * Load efficiency settings from configuration string
   * @param {string} configString - Configuration string from M_BundleSettings
   */
  dispEffSettings(configString) {
    if (!configString || !configString.trim()) {
      throw new Error('Efficiency Settings Not Found');
    }

    this.resetFlags();
    this.log('CONFIG', 'Loading efficiency settings', { configString });

    this.I_L_Eff_Default_Settings = this.getParseText(configString, 1, '|');
    const mStg = this.I_L_Eff_Default_Settings;

    // Parse 9 fields from configuration string
    const fPcs = this.getParseText(mStg, 1, ',');
    const fSAM = this.getParseText(mStg, 2, ',');
    const fReaderType = this.getParseText(mStg, 3, ',');
    const fOprs = this.getParseText(mStg, 4, ',');
    const fAvailMins = this.getParseText(mStg, 5, ',');
    const fOTAvailMins = this.getParseText(mStg, 6, ',');
    const fIncludeOT = this.getParseText(mStg, 7, ',');
    const fEff = this.getParseText(mStg, 8, ',');
    const fOffStdTime = this.getParseText(mStg, 9, ',');

    this.log('CONFIG', 'Parsed configuration fields', {
      Output: fPcs,
      SAM: fSAM,
      Sections: fReaderType,
      Operators: fOprs,
      TimeFormat: fAvailMins,
      OTFormat: fOTAvailMins,
      IncludeOT: fIncludeOT,
      EffType: fEff,
      OffStd: fOffStdTime
    });

    // Step 4: Set Output Stage Flag
    if (fPcs === '1') this.I_L_Output_Sewing = 1;
    else if (fPcs === '2') this.I_L_Output_QC = 1;
    else if (fPcs === '26') this.I_L_Output_AQL = 1;
    else if (fPcs === '27') this.I_L_Output_Finishing = 1;
    else if (fPcs === '28') this.I_L_Output_Packing = 1;

    // Step 5: Set SAM Type Flag
    if (fSAM === '3') this.I_L_EarnedMinutes_PcsSAM = 1;
    else if (fSAM === '4') this.I_L_CycleTime_ProdTime = 1;
    else if (fSAM === '5') this.I_L_StyleSAM = 1;

    // Step 6: Set Operator Type Flag
    if (fOprs === '6') this.I_L_Oprs_ManDays = 1;
    else if (fOprs === '8') this.I_L_Oprs_AttOprs = 1;
    else if (fOprs === '7') this.I_L_Oprs_NoOfWs = 1;

    // Step 7: Set Section Reader Flags
    for (let i = 0; i < fReaderType.length; i++) {
      const char = fReaderType[i];
      if (char === '1') this.I_L_SewingOpr = 1;
      else if (char === '2') this.I_L_CheckingOpr = 1;
      else if (char === '3') this.I_L_AQLOpr = 1;
      else if (char === '4') this.I_L_FinishingOpr = 1;
      else if (char === '5') this.I_L_PackingOpr = 1;
    }

    // Step 8: Set Base Time Format Flag
    if (fAvailMins === '11') this.I_L_Time_ShiftTime = 1;
    else if (fAvailMins === '12') this.I_L_Time_HoursWorked = 1;
    else if (fAvailMins === '13') this.I_L_Time_HoursWorked_Line_NP_Time = 1;
    else if (fAvailMins === '14') this.I_L_Time_HoursWorked_Opr_NP_Time = 1;

    // Step 9: Set Overtime Time Format Flag
    if (fOTAvailMins === '15') this.I_L_OTTime_OTShiftTime = 1;
    else if (fOTAvailMins === '16') this.I_L_OTTime_OTHoursWorked = 1;
    else if (fOTAvailMins === '17') this.I_L_OTTime_OTHoursWorked_Line_NP_Time = 1;
    else if (fOTAvailMins === '18') this.I_L_OTTime_OTHoursWorked_Opr_NP_Time = 1;

    // Step 10: Set Overtime Inclusion Flags
    if (fIncludeOT === 'Y') {
      this.I_L_WithOT = 1;
      this.I_L_Eff_OT = 1;
    } else if (fIncludeOT === 'N') {
      this.I_L_WithOutOT = 1;
      this.I_L_Eff_OT = 0;
    }

    // Step 11: Set Efficiency Type Flag
    if (fEff === '24') this.I_L_Eff_OffStd_Gross = 1;
    else if (fEff === '25') this.I_L_Eff_OffStd_Net = 1;
    else if (fEff === '26') this.I_L_Eff_OnStd_Gross = 1;
    else if (fEff === '27') this.I_L_Eff_OnStd_Net = 1;
    else if (fEff === '28') this.I_L_Eff_TargetVsActual = 1;

    // Step 12: Set Off-Standard Component Flags
    if (fOffStdTime.length > 0 && fOffStdTime[0] === 'Y') this.I_L_IdleTime = 1;
    if (fOffStdTime.length > 1 && fOffStdTime[1] === 'Y') this.I_L_NWTime = 1;
    if (fOffStdTime.length > 2 && fOffStdTime[2] === 'Y') this.I_L_BDTime = 1;
    if (fOffStdTime.length > 3 && fOffStdTime[3] === 'Y') this.I_L_RWTime = 1;
  }

  /**
   * Initialize shift details for current or historical data
   * @param {Object} shiftData - Shift data from database
   * @param {Object} reportData - Report date and shift info
   * @param {Object} productionData - Production data record
   * @returns {Object} fShiftDetails object
   */
  initializeShiftDetails(shiftData, reportData, productionData) {
    const now = new Date();
    const reportDate = new Date(reportData.reportDate);
    const currentDate = new Date();

    currentDate.setHours(0, 0, 0, 0);
    reportDate.setHours(0, 0, 0, 0);

    const fShiftDetails = {
      ShiftCode: shiftData.ShiftCode || '',
      ShiftTime: shiftData.ShiftTime || 480,
      ShiftOverTime: shiftData.ShiftOverTime || 0,
      StartTime: shiftData.StartTime || '09:00',
      EndTime: shiftData.EndTime || '17:00',
      ShiftHeadID: shiftData.ShiftHeadID || 0,
      AccountDate: shiftData.AccountDate || reportData.reportDate,
      BreakMinsTillNow: 0,
      AvailableMinsWithBreakMins: 0,
      AvailableMinsWithOutBreakMins: 0,
      ManDayMinutes: 0
    };

    // Determine if calculation is for current shift or historical data
    if (reportData.isSameDate) {
      // SAME DATE AND SHIFT: Current shift in progress
      this.I_L_SameDate = 1;
      this.I_L_NotSameDate = 0;

      fShiftDetails.BreakMinsTillNow = reportData.breakMinsTillNow || 0;
      fShiftDetails.AvailableMinsWithBreakMins = reportData.availableMinsWithBreakMins || 0;
      fShiftDetails.AvailableMinsWithOutBreakMins = reportData.availableMinsWithOutBreakMins || 0;
    } else {
      // HISTORICAL DATA: Past shift or different date
      this.I_L_SameDate = 0;
      this.I_L_NotSameDate = 1;

      fShiftDetails.AvailableMinsWithOutBreakMins = fShiftDetails.ShiftTime;
    }

    // SameDate: elapsed shift time minus breaks; NotSameDate: full ShiftTime (matches VB.NET)
    fShiftDetails.ManDayMinutes = reportData.isSameDate
      ? fShiftDetails.AvailableMinsWithOutBreakMins
      : fShiftDetails.ShiftTime;

    // Safety checks: prevent division by zero
    if (fShiftDetails.ShiftTime === 0) fShiftDetails.ShiftTime = 1;
    if (fShiftDetails.ManDayMinutes === 0) fShiftDetails.ManDayMinutes = 1;

    return fShiftDetails;
  }

  /**
   * Helper: Parse time string (HH:MM) to minutes
   */
  parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  }

  /**
   * Calculate Style-wise SAM (SRS Steps 1-2)
   * Called when I_L_StyleSAM = 1
   * @param {Array} styles - Array of style objects with StyleCode and pieces
   * @param {Object} styleDetails - Map of style codes to SAM values
   * @returns {Object} { fTotalStylePcsSam, fTotalStyleOTPcsSam }
   */
  calculateStyleSAM(styles, styleDetails) {
    let fTotalStylePcsSam = 0;
    let fTotalStyleOTPcsSam = 0;

    for (const style of styles) {
      const styleCode = style.StyleCodeStg;
      const pieces = style.pieces || 0;
      const piecesOT = style.piecesOT || 0;

      if (!styleDetails[styleCode]) {
        this.log('STYLE_SAM', 'Style not found in details', { styleCode });
        continue;
      }

      const detail = styleDetails[styleCode];
      const fSAM_Sewing = detail.SWG_OprSAM || 0;
      const fSAM_Checking = detail.CHK_OprSAM || 0;
      const fSAM_AQL = detail.AQL_OprSAM || 0;
      const fSAM_Finishing = detail.FIN_OprSAM || 0;
      const fSAM_Packing = detail.PKG_OprSAM || 0;

      // Accumulate SAM based on output stage (SRS Step 2)
      if (this.I_L_Output_Sewing) {
        fTotalStylePcsSam += fSAM_Sewing * pieces;
        fTotalStyleOTPcsSam += fSAM_Sewing * piecesOT;
      } else if (this.I_L_Output_QC) {
        const cumSAM = fSAM_Sewing + fSAM_Checking;
        fTotalStylePcsSam += cumSAM * pieces;
        fTotalStyleOTPcsSam += cumSAM * piecesOT;
      } else if (this.I_L_Output_AQL) {
        const cumSAM = fSAM_Sewing + fSAM_Checking + fSAM_AQL;
        fTotalStylePcsSam += cumSAM * pieces;
        fTotalStyleOTPcsSam += cumSAM * piecesOT;
      } else if (this.I_L_Output_Finishing) {
        const cumSAM = fSAM_Sewing + fSAM_Checking + fSAM_AQL + fSAM_Finishing;
        fTotalStylePcsSam += cumSAM * pieces;
        fTotalStyleOTPcsSam += cumSAM * piecesOT;
      } else if (this.I_L_Output_Packing) {
        const cumSAM = fSAM_Sewing + fSAM_Checking + fSAM_AQL + fSAM_Finishing + fSAM_Packing;
        fTotalStylePcsSam += cumSAM * pieces;
        fTotalStyleOTPcsSam += cumSAM * piecesOT;
      }
    }

    this.log('STYLE_SAM', 'Style SAM calculated', {
      fTotalStylePcsSam,
      fTotalStyleOTPcsSam
    });

    return { fTotalStylePcsSam, fTotalStyleOTPcsSam };
  }

  /**
   * Calculate numerator (earned minutes)
   * @param {Object} productionData - Production data from database
   * @param {Object} styleData - Style SAM data (if StyleSAM mode)
   * @returns {number} Earned minutes
   */
  calculateNumerator(productionData) {
    // StyleSAM (SAM=5) uses the same pre-calculated DB fields as PcsSAM (SAM=1).
    // The collection engine writes style-weighted LineSWG*PCSSAM values in real-time,
    // handling multi-style lines correctly — no runtime SAM lookup needed.
    const pcsSamFlag = this.I_L_EarnedMinutes_PcsSAM + this.I_L_StyleSAM;

    let fNr = 0;

    if (this.I_L_Output_Sewing) {
      fNr +=
        pcsSamFlag * (productionData.LineSWGPcsSAM || 0) +
        pcsSamFlag * this.I_L_WithOT * (productionData.LineSWGPcsSAMOT || 0) +
        this.I_L_CycleTime_ProdTime * (productionData.LineSWGProdTime || 0) +
        this.I_L_CycleTime_ProdTime * this.I_L_WithOT * (productionData.LineSWGProdTimeOT || 0);
    } else if (this.I_L_Output_QC) {
      fNr +=
        pcsSamFlag * (productionData.LineSWGCHKPCSSAM || 0) +
        pcsSamFlag * this.I_L_WithOT * (productionData.LineSWGCHKPCSSAMOT || 0) +
        this.I_L_CycleTime_ProdTime * (productionData.LineSWGCHKProdTime || 0) +
        this.I_L_CycleTime_ProdTime * this.I_L_WithOT * (productionData.LineSWGCHKProdTimeOT || 0);
    } else if (this.I_L_Output_AQL) {
      fNr +=
        pcsSamFlag * (productionData.LineSWGCHKAQLPCSSAM || 0) +
        pcsSamFlag * this.I_L_WithOT * (productionData.LineSWGCHKAQLPCSSAMOT || 0) +
        this.I_L_CycleTime_ProdTime * (productionData.LineSWGCHKAQLProdTime || 0) +
        this.I_L_CycleTime_ProdTime * this.I_L_WithOT * (productionData.LineSWGCHKAQLProdTimeOT || 0);
    } else if (this.I_L_Output_Finishing) {
      fNr +=
        pcsSamFlag * (productionData.LineSWGCHKAQLFINPCSSAM || 0) +
        pcsSamFlag * this.I_L_WithOT * (productionData.LineSWGCHKAQLFINPCSSAMOT || 0) +
        this.I_L_CycleTime_ProdTime * (productionData.LineSWGCHKAQLFINProdTime || 0) +
        this.I_L_CycleTime_ProdTime * this.I_L_WithOT * (productionData.LineSWGCHKAQLFINProdTimeOT || 0);
    } else if (this.I_L_Output_Packing) {
      fNr +=
        pcsSamFlag * (productionData.LineSWGCHKAQLFINPKGPCSSAM || 0) +
        pcsSamFlag * this.I_L_WithOT * (productionData.LineSWGCHKAQLFINPKGPCSSAMOT || 0) +
        this.I_L_CycleTime_ProdTime * (productionData.LineSWGCHKAQLFINPKGProdTime || 0) +
        this.I_L_CycleTime_ProdTime * this.I_L_WithOT * (productionData.LineSWGCHKAQLFINPKGProdTimeOT || 0);
    }

    return this.I_LineWise * fNr;
  }

  /**
   * Calculate hours worked across sections (in minutes).
   * For SameDate, adds real-time CurrWorkedHrs from M_LineDt / M_QcLineDt subqueries.
   */
  calculateHoursWorked(productionData) {
    return (
      this.I_L_SewingOpr   * (productionData.SectionSWGWorkedMins || 0) +
      this.I_L_CheckingOpr * (productionData.SectionCHKWorkedMins || 0) +
      this.I_L_AQLOpr      * (productionData.SectionAQLWorkedMins || 0) +
      this.I_L_FinishingOpr * (productionData.SectionFINWorkedMins || 0) +
      this.I_L_PackingOpr  * (productionData.SectionPKGWorkedMins || 0) +
      this.I_L_SewingOpr   * this.I_L_SameDate * (productionData.CurrWorkedHrs   || 0) +
      this.I_L_CheckingOpr * this.I_L_SameDate * (productionData.QCCurrWorkedHrs || 0)
    );
  }

  /**
   * Calculate overtime hours worked
   */
  calculateOTHoursWorked(productionData) {
    return (
      this.I_L_SewingOpr *
        this.I_L_NotSameDate *
        this.I_L_WithOT *
        (productionData.SectionSWGWorkedMinsOT || 0) +
      this.I_L_CheckingOpr *
        this.I_L_NotSameDate *
        this.I_L_WithOT *
        (productionData.SectionCHKWorkedMinsOT || 0) +
      this.I_L_AQLOpr *
        this.I_L_NotSameDate *
        this.I_L_WithOT *
        (productionData.SectionAQLWorkedMinsOT || 0) +
      this.I_L_FinishingOpr *
        this.I_L_NotSameDate *
        this.I_L_WithOT *
        (productionData.SectionFINWorkedMinsOT || 0) +
      this.I_L_PackingOpr *
        this.I_L_NotSameDate *
        this.I_L_WithOT *
        (productionData.SectionPKGWorkedMinsOT || 0)
    );
  }

  /**
   * Calculate Line NPT (Non-Productive Time)
   */
  calculateLineNPT(productionData) {
    return (
      this.I_L_SewingOpr * (productionData.SectionSWGNPTimeLine || 0) +
      this.I_L_SewingOpr *
        this.I_L_WithOT *
        (productionData.SectionSWGNPTimeLineOT || 0) +
      this.I_L_CheckingOpr * (productionData.SectionCHKNPTimeLine || 0) +
      this.I_L_CheckingOpr *
        this.I_L_WithOT *
        (productionData.SectionCHKNPTimeLineOT || 0) +
      this.I_L_AQLOpr * (productionData.SectionAQLNPTimeLine || 0) +
      this.I_L_AQLOpr *
        this.I_L_WithOT *
        (productionData.SectionAQLNPTimeLineOT || 0) +
      this.I_L_FinishingOpr * (productionData.SectionFINNPTimeLine || 0) +
      this.I_L_FinishingOpr *
        this.I_L_WithOT *
        (productionData.SectionFINNPTimeLineOT || 0) +
      this.I_L_PackingOpr * (productionData.SectionPKGNPTimeLine || 0) +
      this.I_L_PackingOpr *
        this.I_L_WithOT *
        (productionData.SectionPKGNPTimeLineOT || 0)
    );
  }

  /**
   * Calculate Operator NPT (Non-Productive Time) - Operator-level variant
   * SRS Step 8: Used when I_L_Time_HoursWorked_Opr_NP_Time = 1
   */
  calculateOperatorNPT(productionData) {
    return (
      this.I_L_SewingOpr * (productionData.SectionSWGNPTimeOPR || 0) +
      this.I_L_SewingOpr *
        this.I_L_WithOT *
        (productionData.SectionSWGNPTimeOPROT || 0) +
      this.I_L_CheckingOpr * (productionData.SectionCHKNPTimeOPR || 0) +
      this.I_L_CheckingOpr *
        this.I_L_WithOT *
        (productionData.SectionCHKNPTimeOPROT || 0) +
      this.I_L_AQLOpr * (productionData.SectionAQLNPTimeOPR || 0) +
      this.I_L_AQLOpr *
        this.I_L_WithOT *
        (productionData.SectionAQLNPTimeOPROT || 0) +
      this.I_L_FinishingOpr * (productionData.SectionFINNPTimeOPR || 0) +
      this.I_L_FinishingOpr *
        this.I_L_WithOT *
        (productionData.SectionFINNPTimeOPROT || 0) +
      this.I_L_PackingOpr * (productionData.SectionPKGNPTimeOPR || 0) +
      this.I_L_PackingOpr *
        this.I_L_WithOT *
        (productionData.SectionPKGNPTimeOPROT || 0)
    );
  }

  /**
   * Calculate off-standard time components
   */
  calculateOffStandardTimes(productionData) {
    const fIMins =
      this.I_L_IdleTime *
      (this.I_L_SewingOpr * (productionData.SectionSWGIdleTime || 0) +
        this.I_L_SewingOpr *
          this.I_L_WithOT *
          (productionData.SectionSWGIdleTimeOT || 0) +
        this.I_L_CheckingOpr * (productionData.SectionCHKIdleTime || 0) +
        this.I_L_CheckingOpr *
          this.I_L_WithOT *
          (productionData.SectionCHKIdleTimeOT || 0) +
        this.I_L_AQLOpr * (productionData.SectionAQLIdleTime || 0) +
        this.I_L_AQLOpr *
          this.I_L_WithOT *
          (productionData.SectionAQLIdleTimeOT || 0) +
        this.I_L_FinishingOpr * (productionData.SectionFINIdleTime || 0) +
        this.I_L_FinishingOpr *
          this.I_L_WithOT *
          (productionData.SectionFINIdleTimeOT || 0) +
        this.I_L_PackingOpr * (productionData.SectionPKGIdleTime || 0) +
        this.I_L_PackingOpr *
          this.I_L_WithOT *
          (productionData.SectionPKGIdleTimeOT || 0));

    const fNWMins =
      this.I_L_NWTime *
      (this.I_L_SewingOpr * (productionData.SectionSWGNWTime || 0) +
        this.I_L_SewingOpr *
          this.I_L_WithOT *
          (productionData.SectionSWGNWTimeOT || 0) +
        this.I_L_CheckingOpr * (productionData.SectionCHKNWTime || 0) +
        this.I_L_CheckingOpr *
          this.I_L_WithOT *
          (productionData.SectionCHKNWTimeOT || 0) +
        this.I_L_AQLOpr * (productionData.SectionAQLNWTime || 0) +
        this.I_L_AQLOpr *
          this.I_L_WithOT *
          (productionData.SectionAQLNWTimeOT || 0) +
        this.I_L_FinishingOpr * (productionData.SectionFINNWTime || 0) +
        this.I_L_FinishingOpr *
          this.I_L_WithOT *
          (productionData.SectionFINNWTimeOT || 0) +
        this.I_L_PackingOpr * (productionData.SectionPKGNWTime || 0) +
        this.I_L_PackingOpr *
          this.I_L_WithOT *
          (productionData.SectionPKGNWTimeOT || 0));

    const fBDMins =
      this.I_L_BDTime *
      (this.I_L_SewingOpr * (productionData.SectionSWGBDTime || 0) +
        this.I_L_SewingOpr *
          this.I_L_WithOT *
          (productionData.SectionSWGBDTimeOT || 0) +
        this.I_L_CheckingOpr * (productionData.SectionCHKBDTime || 0) +
        this.I_L_CheckingOpr *
          this.I_L_WithOT *
          (productionData.SectionCHKBDTimeOT || 0) +
        this.I_L_AQLOpr * (productionData.SectionAQLBDTime || 0) +
        this.I_L_AQLOpr *
          this.I_L_WithOT *
          (productionData.SectionAQLBDTimeOT || 0) +
        this.I_L_FinishingOpr * (productionData.SectionFINBDTime || 0) +
        this.I_L_FinishingOpr *
          this.I_L_WithOT *
          (productionData.SectionFINBDTimeOT || 0) +
        this.I_L_PackingOpr * (productionData.SectionPKGBDTime || 0) +
        this.I_L_PackingOpr *
          this.I_L_WithOT *
          (productionData.SectionPKGBDTimeOT || 0));

    const fRMins =
      this.I_L_RWTime *
      (this.I_L_SewingOpr * (productionData.SectionSWGRwTime || 0) +
        this.I_L_SewingOpr *
          this.I_L_WithOT *
          (productionData.SectionSWGRwTimeOT || 0));

    return { fIMins, fNWMins, fBDMins, fRMins };
  }

  /**
   * Calculate Man Days — matches VB.NET fManDays formula exactly.
   * fHrsWorked already includes SameDate CurrWorkedHrs (from calculateHoursWorked).
   * For NotSameDate: adds SWG OT unconditionally, other sections' OT only when WithOT=1.
   * All values are in minutes (seconds÷60 applied in SQL).
   */
  calculateManDays(productionData, fHrsWorked, fShiftDetails) {
    // VB formula: ManDays = SectionSWGOprsLoggedIn + CurrWorkedHrs / ManDayMinutes
    // OprsLoggedIn (from T_Fact last write) counts each logged-in operator as one full day.
    // CurrWorkedHrs adds the real-time fraction for currently active operators.
    const oprsLoggedIn =
      this.I_L_SewingOpr    * (productionData.SectionSWGOprsLoggedIn || 0) +
      this.I_L_CheckingOpr  * (productionData.SectionCHKOprsLoggedIn || 0) +
      this.I_L_AQLOpr       * (productionData.SectionAQLOprsLoggedIn || 0) +
      this.I_L_FinishingOpr * (productionData.SectionFINOprsLoggedIn || 0) +
      this.I_L_PackingOpr   * (productionData.SectionPKGOprsLoggedIn || 0);

    const currWorked =
      this.I_L_SewingOpr   * this.I_L_SameDate * (productionData.CurrWorkedHrs   || 0) +
      this.I_L_CheckingOpr * this.I_L_SameDate * (productionData.QCCurrWorkedHrs || 0);

    const otMins =
      this.I_L_NotSameDate * (productionData.SectionSWGWorkedMinsOT || 0) +
      this.I_L_NotSameDate * this.I_L_WithOT * (productionData.SectionCHKWorkedMinsOT || 0) +
      this.I_L_NotSameDate * this.I_L_WithOT * (productionData.SectionAQLWorkedMinsOT || 0) +
      this.I_L_NotSameDate * this.I_L_WithOT * (productionData.SectionFINWorkedMinsOT || 0) +
      this.I_L_NotSameDate * this.I_L_WithOT * (productionData.SectionPKGWorkedMinsOT || 0);

    const md = fShiftDetails.ManDayMinutes;
    if (md === 0) return 0;
    return Math.round(((oprsLoggedIn * md + currWorked + otMins) / md) * 10) / 10;
  }

  /**
   * Calculate workstation metrics
   */
  calculateWorkstationMetrics(productionData) {
    const fNoOFWsPlanned =
      this.I_L_SewingOpr * (productionData.SectionSWGCapacityWs || 0) +
      this.I_L_CheckingOpr * (productionData.SectionCHKCapacityWs || 0) +
      this.I_L_AQLOpr * (productionData.SectionAQLCapacityWs || 0) +
      this.I_L_FinishingOpr * (productionData.SectionFINCapacityWs || 0) +
      this.I_L_PackingOpr * (productionData.SectionPKGCapacityWs || 0);

    const fLineOprAtt =
      this.I_L_SewingOpr * (productionData.SectionSWGOprsAtt || 0) +
      this.I_L_CheckingOpr * (productionData.SectionCHKOprsAtt || 0) +
      this.I_L_AQLOpr * (productionData.SectionAQLOprsAtt || 0) +
      this.I_L_FinishingOpr * (productionData.SectionFINOprsAtt || 0) +
      this.I_L_PackingOpr * (productionData.SectionPKGOprsAtt || 0);

    const fLineOprAttOT =
      this.I_L_SewingOpr * (productionData.SectionSWGOprsAttOT || 0) +
      this.I_L_CheckingOpr * (productionData.SectionCHKOprsAttOT || 0) +
      this.I_L_AQLOpr * (productionData.SectionAQLOprsAttOT || 0) +
      this.I_L_FinishingOpr * (productionData.SectionFINOprsAttOT || 0) +
      this.I_L_PackingOpr * (productionData.SectionPKGOprsAttOT || 0);

    return { fNoOFWsPlanned, fLineOprAtt, fLineOprAttOT };
  }

  /**
   * Calculate available minutes (denominator base) — matches VB.NET fOperatorsXAvailableMinutes.
   * SameDate: uses ManDayMinutes (elapsed shift time minus breaks), not full ShiftTime.
   * NotSameDate: uses ShiftTime (ManDayMinutes = ShiftTime for historical records).
   */
  calculateAvailableMinutes(
    fShiftDetails,
    fManDays,
    fHrsWorked,
    fOTHrsWorked,
    fLineNPT,
    fOperatorNPT,
    fNoOFWsPlanned,
    fLineOprAtt,
    fLineOprAttOT
  ) {
    let fDr = 0;
    const md = fShiftDetails.ManDayMinutes; // elapsed mins (SameDate) or ShiftTime (NotSameDate)

    // ── SameDate branch ──────────────────────────────────────────────────────
    if (this.I_L_SameDate) {
      if (this.I_L_Oprs_ManDays && this.I_L_Time_ShiftTime) {
        fDr += md * fManDays;                        // ManDayMinutes × ManDays ≈ fHrsWorked
      }
      if (this.I_L_Oprs_ManDays && this.I_L_Time_HoursWorked) {
        fDr += fHrsWorked;
      }
      if (this.I_L_Oprs_ManDays && this.I_L_Time_HoursWorked_Line_NP_Time) {
        fDr += fHrsWorked + fLineNPT;
      }
      if (this.I_L_Oprs_ManDays && this.I_L_Time_HoursWorked_Opr_NP_Time) {
        fDr += fHrsWorked + fOperatorNPT;
      }
      if (this.I_L_Oprs_AttOprs) {
        fDr += md * fLineOprAtt;
      }
      if (this.I_L_Oprs_NoOfWs) {
        fDr += md * fNoOFWsPlanned;
      }
    }

    // ── NotSameDate without OT ────────────────────────────────────────────────
    if (this.I_L_NotSameDate && this.I_L_WithOutOT) {
      const st = fShiftDetails.ShiftTime;
      if (this.I_L_Oprs_ManDays && this.I_L_Time_ShiftTime) {
        fDr += st * fManDays;
      }
      if (this.I_L_Oprs_ManDays && this.I_L_Time_HoursWorked) {
        fDr += fHrsWorked;
      }
      if (this.I_L_Oprs_ManDays && this.I_L_Time_HoursWorked_Line_NP_Time) {
        fDr += fHrsWorked + fLineNPT;
      }
      if (this.I_L_Oprs_ManDays && this.I_L_Time_HoursWorked_Opr_NP_Time) {
        fDr += fHrsWorked + fOperatorNPT;
      }
      if (this.I_L_Oprs_AttOprs) {
        fDr += st * fLineOprAtt;
      }
      if (this.I_L_Oprs_NoOfWs) {
        fDr += st * fNoOFWsPlanned;
      }
    }

    // ── NotSameDate with OT ───────────────────────────────────────────────────
    if (this.I_L_NotSameDate && this.I_L_WithOT) {
      const st   = fShiftDetails.ShiftTime;
      const otST = st + fShiftDetails.ShiftOverTime;

      if (this.I_L_Oprs_ManDays && this.I_L_Time_ShiftTime && this.I_L_OTTime_OTShiftTime) {
        fDr += otST * fManDays;
      }
      if (this.I_L_Oprs_ManDays && this.I_L_Time_ShiftTime && this.I_L_OTTime_OTHoursWorked) {
        fDr += st * fManDays + fShiftDetails.ShiftOverTime;
      }
      if (this.I_L_Oprs_ManDays && this.I_L_Time_HoursWorked) {
        fDr += fHrsWorked + fOTHrsWorked;
      }
      if (this.I_L_Oprs_ManDays && this.I_L_Time_HoursWorked_Line_NP_Time) {
        fDr += fHrsWorked + fOTHrsWorked + fLineNPT;
      }
      if (this.I_L_Oprs_ManDays && this.I_L_Time_HoursWorked_Opr_NP_Time) {
        fDr += fHrsWorked + fOTHrsWorked + fOperatorNPT;
      }
      if (this.I_L_Oprs_AttOprs) {
        fDr += (st * fLineOprAtt) + (fShiftDetails.ShiftOverTime * fLineOprAttOT);
      }
      if (this.I_L_Oprs_NoOfWs && this.I_L_OTTime_OTShiftTime) {
        fDr += otST * fNoOFWsPlanned;
      }
      if (this.I_L_Oprs_NoOfWs && this.I_L_OTTime_OTHoursWorked) {
        fDr += st * fNoOFWsPlanned + fOTHrsWorked;
      }
    }

    return fDr;
  }

  /**
   * Calculate final efficiency
   */
  calculate(productionData, shiftData, reportData) {
    try {
      this.log('CALC', 'Starting efficiency calculation', {
        lineCode: productionData.LineCode,
        shift: productionData.ShiftCode,
        sameDate: this.I_L_SameDate,
        notSameDate: this.I_L_NotSameDate
      });

      // Initialize shift details
      const fShiftDetails = this.initializeShiftDetails(
        shiftData,
        reportData,
        productionData
      );
      this.log('SHIFT', 'Shift details initialized', fShiftDetails);

      // Calculate components
      const fNr = this.calculateNumerator(productionData);
      this.log('NUMERATOR', 'Earned minutes calculated', { fNr });

      const fHrsWorked = this.calculateHoursWorked(productionData);
      this.log('HOURS_WORKED', 'Hours worked aggregated', { fHrsWorked });

      const fOTHrsWorked = this.calculateOTHoursWorked(productionData);
      this.log('OT_HOURS', 'OT hours worked calculated', { fOTHrsWorked });

      const fLineNPT = this.calculateLineNPT(productionData);
      this.log('NPT', 'Non-productive time calculated', { fLineNPT });

      const fOperatorNPT = this.calculateOperatorNPT(productionData);
      this.log('OPERATOR_NPT', 'Operator NPT calculated', { fOperatorNPT });

      const offStandardTimes = this.calculateOffStandardTimes(productionData);
      this.log('OFF_STANDARD', 'Off-standard times aggregated', offStandardTimes);

      const { fNoOFWsPlanned, fLineOprAtt, fLineOprAttOT } =
        this.calculateWorkstationMetrics(productionData);
      this.log('WORKSTATIONS', 'Workstation metrics calculated', {
        fNoOFWsPlanned,
        fLineOprAtt,
        fLineOprAttOT
      });

      // Calculate Man Days (must be before calculateAvailableMinutes)
      const fManDays = this.calculateManDays(
        productionData,
        fHrsWorked,
        fShiftDetails
      );
      this.log('MAN_DAYS', 'Man days calculated', { fManDays });

      // Calculate available minutes
      const fOperatorsXAvailableMinutes = this.calculateAvailableMinutes(
        fShiftDetails,
        fManDays,
        fHrsWorked,
        fOTHrsWorked,
        fLineNPT,
        fOperatorNPT,
        fNoOFWsPlanned,
        fLineOprAtt,
        fLineOprAttOT
      );
      this.log('AVAILABLE', 'Available minutes calculated', {
        fOperatorsXAvailableMinutes
      });

      // Calculate off-standard deduction
      const fDt = this.I_L_Eff_OffStd_Net *
        (offStandardTimes.fIMins +
          offStandardTimes.fNWMins +
          offStandardTimes.fRMins +
          offStandardTimes.fBDMins);
      this.log('DEDUCTION', 'Off-standard deduction', {
        fDt,
        isNetEfficiency: this.I_L_Eff_OffStd_Net
      });

      // Constraint: cannot deduct more than available
      const adjustedFDt =
        fDt > fOperatorsXAvailableMinutes ? 0 : fDt;
      if (fDt > fOperatorsXAvailableMinutes) {
        this.log('CONSTRAINT', 'Deduction exceeds available, setting to 0', {
          original: fDt,
          available: fOperatorsXAvailableMinutes
        });
      }

      // Calculate final denominator
      const fDr = Math.max(0, fOperatorsXAvailableMinutes - adjustedFDt);
      this.log('DENOMINATOR', 'Final denominator calculated', { fDr });

      // Calculate efficiency
      let feff = 0;
      if (fDr > 0) {
        feff = Math.round((fNr / fDr) * 100);
      }

      this.log('FINAL', 'Efficiency calculation complete', {
        efficiency: feff,
        earnedMinutes: fNr,
        availableMinutes: fDr,
        calculation: `(${fNr} / ${fDr}) * 100 = ${feff}%`
      });

      return {
        efficiency: feff,
        earnedMinutes: fNr,
        availableMinutes: fDr,
        offStandardDeduction: adjustedFDt,
        hoursWorked: fHrsWorked,
        manDays: fManDays,
        shiftDetails: fShiftDetails,
        flags: this.getFlags(),
        debugLog: this.enableLogging ? this.debugLog : undefined
      };
    } catch (error) {
      console.error('Efficiency calculation error:', error);
      this.log('ERROR', 'Calculation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all current flags
   */
  getFlags() {
    return {
      I_L_Output_Sewing: this.I_L_Output_Sewing,
      I_L_Output_QC: this.I_L_Output_QC,
      I_L_Output_AQL: this.I_L_Output_AQL,
      I_L_Output_Finishing: this.I_L_Output_Finishing,
      I_L_Output_Packing: this.I_L_Output_Packing,
      I_L_EarnedMinutes_PcsSAM: this.I_L_EarnedMinutes_PcsSAM,
      I_L_CycleTime_ProdTime: this.I_L_CycleTime_ProdTime,
      I_L_StyleSAM: this.I_L_StyleSAM,
      I_L_SewingOpr: this.I_L_SewingOpr,
      I_L_CheckingOpr: this.I_L_CheckingOpr,
      I_L_AQLOpr: this.I_L_AQLOpr,
      I_L_FinishingOpr: this.I_L_FinishingOpr,
      I_L_PackingOpr: this.I_L_PackingOpr,
      I_L_Oprs_ManDays: this.I_L_Oprs_ManDays,
      I_L_Oprs_AttOprs: this.I_L_Oprs_AttOprs,
      I_L_Oprs_NoOfWs: this.I_L_Oprs_NoOfWs,
      I_L_Time_ShiftTime: this.I_L_Time_ShiftTime,
      I_L_Time_HoursWorked: this.I_L_Time_HoursWorked,
      I_L_Time_HoursWorked_Line_NP_Time:
        this.I_L_Time_HoursWorked_Line_NP_Time,
      I_L_Time_HoursWorked_Opr_NP_Time:
        this.I_L_Time_HoursWorked_Opr_NP_Time,
      I_L_OTTime_OTShiftTime: this.I_L_OTTime_OTShiftTime,
      I_L_OTTime_OTHoursWorked: this.I_L_OTTime_OTHoursWorked,
      I_L_OTTime_OTHoursWorked_Line_NP_Time:
        this.I_L_OTTime_OTHoursWorked_Line_NP_Time,
      I_L_OTTime_OTHoursWorked_Opr_NP_Time:
        this.I_L_OTTime_OTHoursWorked_Opr_NP_Time,
      I_L_WithOT: this.I_L_WithOT,
      I_L_WithOutOT: this.I_L_WithOutOT,
      I_L_IdleTime: this.I_L_IdleTime,
      I_L_NWTime: this.I_L_NWTime,
      I_L_BDTime: this.I_L_BDTime,
      I_L_RWTime: this.I_L_RWTime,
      I_L_Eff_OffStd_Gross: this.I_L_Eff_OffStd_Gross,
      I_L_Eff_OffStd_Net: this.I_L_Eff_OffStd_Net,
      I_L_Eff_OnStd_Gross: this.I_L_Eff_OnStd_Gross,
      I_L_Eff_OnStd_Net: this.I_L_Eff_OnStd_Net,
      I_L_Eff_TargetVsActual: this.I_L_Eff_TargetVsActual,
      I_L_Eff_OT: this.I_L_Eff_OT,
      I_LineWise: this.I_LineWise,
      I_Sectionwise: this.I_Sectionwise,
      I_L_SameDate: this.I_L_SameDate,
      I_L_NotSameDate: this.I_L_NotSameDate,
      I_L_Eff_Default_Settings: this.I_L_Eff_Default_Settings
    };
  }
}

module.exports = EfficiencyCalculator;
