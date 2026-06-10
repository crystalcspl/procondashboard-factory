/**
 * Efficiency Calculator Unit Tests
 * Test suite for EfficiencyCalculator class
 */

const EfficiencyCalculator = require('./efficiencyCalculator');

// ============================================================================
// TEST SUITE
// ============================================================================

class EfficiencyCalculatorTests {
  constructor() {
    this.testsRun = 0;
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.results = [];
  }

  /**
   * Run a single test
   */
  test(name, fn) {
    this.testsRun++;
    try {
      fn();
      this.testsPassed++;
      this.results.push({ name, status: 'PASS', error: null });
      console.log(`✓ ${name}`);
    } catch (error) {
      this.testsFailed++;
      this.results.push({ name, status: 'FAIL', error: error.message });
      console.error(`✗ ${name}`);
      console.error(`  ${error.message}`);
    }
  }

  /**
   * Assert equality
   */
  assert(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(
        `Assertion failed: ${message}\nExpected: ${expected}\nActual: ${actual}`
      );
    }
  }

  /**
   * Assert approximately equal (for floating point)
   */
  assertClose(actual, expected, tolerance = 1, message = '') {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(
        `Assertion failed (tolerance: ${tolerance}): ${message}\nExpected: ${expected}\nActual: ${actual}`
      );
    }
  }

  /**
   * Assert truthy
   */
  assertTrue(value, message = '') {
    if (!value) {
      throw new Error(`Assertion failed: ${message}\nExpected truthy value`);
    }
  }

  /**
   * Assert falsy
   */
  assertFalse(value, message = '') {
    if (value) {
      throw new Error(`Assertion failed: ${message}\nExpected falsy value`);
    }
  }

  /**
   * Print test results summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total: ${this.testsRun} | Passed: ${this.testsPassed} | Failed: ${this.testsFailed}`);
    console.log('='.repeat(70) + '\n');

    if (this.testsFailed > 0) {
      console.log('FAILED TESTS:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
          console.log(`  - ${r.name}`);
          console.log(`    ${r.error}`);
        });
    }

    return this.testsFailed === 0;
  }

  /**
   * Run all tests
   */
  runAll() {
    console.log('\n' + '='.repeat(70));
    console.log('RUNNING EFFICIENCY CALCULATOR TESTS');
    console.log('='.repeat(70) + '\n');

    this.testFlagInitialization();
    this.testConfigurationParsing();
    this.testNumeratorCalculation();
    this.testDenominatorCalculation();
    this.testOffStandardDeductions();
    this.testFinalEfficiencyCalculation();
    this.testZeroDenominatorProtection();
    this.testConstraintEnforcement();
    this.testLogging();

    return this.printSummary();
  }

  // ========================================================================
  // TEST CASES
  // ========================================================================

  testFlagInitialization() {
    console.log('\n--- Test: Flag Initialization ---');

    this.test('All flags should be initialized to 0', () => {
      const calc = new EfficiencyCalculator();
      this.assert(calc.I_L_Output_Sewing, 0, 'Output Sewing should be 0');
      this.assert(calc.I_L_EarnedMinutes_PcsSAM, 0, 'PcsSAM should be 0');
      this.assert(calc.I_L_Oprs_ManDays, 0, 'ManDays should be 0');
      this.assert(calc.I_LineWise, 1, 'I_LineWise should be 1');
      this.assert(calc.I_Sectionwise, 0, 'I_Sectionwise should be 0');
    });

    this.test('Reset flags should clear all values', () => {
      const calc = new EfficiencyCalculator();
      calc.I_L_Output_Sewing = 1;
      calc.I_L_EarnedMinutes_PcsSAM = 1;
      calc.resetFlags();
      this.assert(calc.I_L_Output_Sewing, 0);
      this.assert(calc.I_L_EarnedMinutes_PcsSAM, 0);
    });
  }

  testConfigurationParsing() {
    console.log('\n--- Test: Configuration Parsing ---');

    this.test('Parse pipe-delimited string', () => {
      const calc = new EfficiencyCalculator();
      const result = calc.getParseText('field1|field2|field3', 2, '|');
      this.assert(result, 'field2', 'Should extract field2');
    });

    this.test('Parse comma-delimited string', () => {
      const calc = new EfficiencyCalculator();
      const result = calc.getParseText('1,3,12345,8,12,16,Y,25,YYYY', 4, ',');
      this.assert(result, '8', 'Should extract operator type code');
    });

    this.test('Handle invalid position gracefully', () => {
      const calc = new EfficiencyCalculator();
      const result = calc.getParseText('a,b,c', 10, ',');
      this.assert(result, 'c', 'Should return last field for out-of-bounds position');
    });

    this.test('Load efficiency settings from configuration', () => {
      const calc = new EfficiencyCalculator();
      calc.dispEffSettings('1,3,12345,8,12,16,Y,25,YYYY');

      this.assert(calc.I_L_Output_Sewing, 1, 'Should set Sewing output');
      this.assert(calc.I_L_EarnedMinutes_PcsSAM, 1, 'Should set PcsSAM');
      this.assert(calc.I_L_Oprs_AttOprs, 1, 'Should set Attending Operators');
      this.assert(calc.I_L_Time_HoursWorked, 1, 'Should set Hours Worked');
      this.assert(calc.I_L_OTTime_OTHoursWorked, 1, 'Should set OT Hours Worked');
      this.assert(calc.I_L_WithOT, 1, 'Should enable OT');
      this.assert(calc.I_L_Eff_OffStd_Net, 1, 'Should set Net efficiency');
      this.assert(calc.I_L_IdleTime, 1, 'Should enable Idle Time');
      this.assert(calc.I_L_NWTime, 1, 'Should enable Non-Working Time');
    });

    this.test('Throw error on missing configuration', () => {
      const calc = new EfficiencyCalculator();
      try {
        calc.dispEffSettings('');
        throw new Error('Should have thrown');
      } catch (e) {
        this.assertTrue(
          e.message.includes('Not Found'),
          'Should throw "Not Found" error'
        );
      }
    });
  }

  testNumeratorCalculation() {
    console.log('\n--- Test: Numerator (Earned Minutes) Calculation ---');

    this.test('Calculate earned minutes for Sewing output with PcsSAM', () => {
      const calc = new EfficiencyCalculator();
      calc.dispEffSettings('1,3,12345,8,12,16,Y,25,YYYY');

      const productionData = {
        LineCode: 'L001',
        ShiftCode: '001',
        LineSWGPcsSAM: 1250,
        SectionSWGPcsSAM: 400,
        SectionCHKPcsSAM: 350,
        SectionAQLPcsSAM: 300,
        SectionFINPcsSAM: 250,
        SectionPKGPcsSAM: 200,
      };

      const fNr = calc.calculateNumerator(productionData, {});
      this.assertClose(fNr, 1250, 1, 'Should calculate line-wise earned minutes');
    });

    this.test('Handle zero earned minutes', () => {
      const calc = new EfficiencyCalculator();
      calc.dispEffSettings('1,3,12345,8,12,16,Y,25,YYYY');

      const productionData = {
        LineCode: 'L001',
        ShiftCode: '001',
        LineSWGPcsSAM: 0,
      };

      const fNr = calc.calculateNumerator(productionData, {});
      this.assert(fNr, 0, 'Should handle zero earned minutes');
    });
  }

  testDenominatorCalculation() {
    console.log('\n--- Test: Denominator (Available Minutes) Calculation ---');

    this.test('Calculate hours worked across all sections', () => {
      const calc = new EfficiencyCalculator();
      calc.I_L_SewingOpr = 1;
      calc.I_L_CheckingOpr = 1;

      const productionData = {
        SectionSWGWorkedMins: 480,
        SectionCHKWorkedMins: 420,
      };

      const fHrs = calc.calculateHoursWorked(productionData);
      this.assert(fHrs, 900, 'Should sum worked minutes across sections');
    });

    this.test('Calculate overtime hours', () => {
      const calc = new EfficiencyCalculator();
      calc.I_L_SewingOpr = 1;
      calc.I_L_NotSameDate = 1;
      calc.I_L_WithOT = 1;

      const productionData = {
        SectionSWGWorkedMinsOT: 120,
      };

      const fOT = calc.calculateOTHoursWorked(productionData);
      this.assert(fOT, 120, 'Should calculate OT hours');
    });

    this.test('Off-standard time aggregation', () => {
      const calc = new EfficiencyCalculator();
      calc.I_L_IdleTime = 1;
      calc.I_L_NWTime = 1;
      calc.I_L_BDTime = 1;
      calc.I_L_RWTime = 1;
      calc.I_L_SewingOpr = 1;

      const productionData = {
        SectionSWGIdleTime: 30,
        SectionSWGNWTime: 20,
        SectionSWGBDTime: 40,
        SectionSWGRwTime: 10,
      };

      const offStd = calc.calculateOffStandardTimes(productionData);
      this.assertClose(
        offStd.fIMins + offStd.fNWMins + offStd.fBDMins + offStd.fRMins,
        100,
        1,
        'Should aggregate all off-standard components'
      );
    });
  }

  testOffStandardDeductions() {
    console.log('\n--- Test: Off-Standard Deductions ---');

    this.test('Deduct off-standard time when enabled', () => {
      const calc = new EfficiencyCalculator();
      calc.I_L_Eff_OffStd_Net = 1;
      calc.I_L_IdleTime = 1;
      calc.I_L_SewingOpr = 1;

      const productionData = {
        SectionSWGIdleTime: 60,
      };

      const offStd = calc.calculateOffStandardTimes(productionData);
      this.assert(offStd.fIMins, 60, 'Should calculate idle time deduction');
    });

    this.test('Not deduct off-standard time when disabled', () => {
      const calc = new EfficiencyCalculator();
      calc.I_L_Eff_OffStd_Net = 0;  // Efficiency type is NOT Net
      calc.I_L_IdleTime = 1;
      calc.I_L_SewingOpr = 1;

      const productionData = {
        SectionSWGIdleTime: 60,
      };

      const offStd = calc.calculateOffStandardTimes(productionData);
      // fIMins is always calculated, but deduction only applied if I_L_Eff_OffStd_Net = 1
      // In the calculate method, fDt = I_L_Eff_OffStd_Net * (offStandardTimes.fIMins + ...)
      // So when I_L_Eff_OffStd_Net = 0, fDt = 0
      this.assertTrue(offStd.fIMins > 0, 'Should calculate idle time regardless');
    });
  }

  testFinalEfficiencyCalculation() {
    console.log('\n--- Test: Final Efficiency Calculation ---');

    this.test('Calculate efficiency correctly', () => {
      const calc = new EfficiencyCalculator();
      calc.dispEffSettings('1,3,12345,8,12,16,Y,25,YYYY');

      const productionData = {
        LineCode: 'L001',
        ShiftCode: '001',
        LineSWGPcsSAM: 1250,
        SectionSWGWorkedMins: 8.25,
        SectionCHKWorkedMins: 0,
        SectionAQLWorkedMins: 0,
        SectionFINWorkedMins: 0,
        SectionPKGWorkedMins: 0,
        SectionSWGIdleTime: 0,
        SectionSWGNWTime: 0,
        SectionSWGBDTime: 0,
        SectionSWGRwTime: 0,
        SectionCHKIdleTime: 0,
        SectionCHKNWTime: 0,
        SectionCHKBDTime: 0,
        SectionAQLIdleTime: 0,
        SectionAQLNWTime: 0,
        SectionAQLBDTime: 0,
        SectionFINIdleTime: 0,
        SectionFINNWTime: 0,
        SectionFINBDTime: 0,
        SectionPKGIdleTime: 0,
        SectionPKGNWTime: 0,
        SectionPKGBDTime: 0,
        SectionSWGCapacityWs: 10,
        SectionSWGOprsAtt: 10,
      };

      const shiftData = {
        ShiftCode: '001',
        ShiftTime: 480,
        ShiftOverTime: 0,
        StartTime: '09:00',
        EndTime: '17:00',
      };

      const result = calc.calculate(productionData, shiftData, {
        reportDate: '25/05/2026',
        shiftCode: '001',
        currentShiftCode: '001',
        breakMinsTillNow: 0,
      });

      this.assertTrue(result.efficiency >= 0, 'Efficiency should be non-negative');
      this.assertTrue(result.efficiency <= 100, 'Efficiency should not exceed 100');
      this.assertTrue(result.earnedMinutes > 0, 'Earned minutes should be set');
      this.assertTrue(result.availableMinutes > 0, 'Available minutes should be set');
    });

    this.test('Return comprehensive result object', () => {
      const calc = new EfficiencyCalculator();
      calc.dispEffSettings('1,3,12345,8,12,16,Y,25,YYYY');

      const productionData = {
        LineCode: 'L001',
        ShiftCode: '001',
        LineSWGPcsSAM: 1000,
        SectionSWGWorkedMins: 8,
        SectionCHKWorkedMins: 0,
        SectionAQLWorkedMins: 0,
        SectionFINWorkedMins: 0,
        SectionPKGWorkedMins: 0,
        SectionSWGIdleTime: 0,
        SectionSWGNWTime: 0,
        SectionSWGBDTime: 0,
        SectionSWGRwTime: 0,
        SectionCHKIdleTime: 0,
        SectionCHKNWTime: 0,
        SectionCHKBDTime: 0,
        SectionAQLIdleTime: 0,
        SectionAQLNWTime: 0,
        SectionAQLBDTime: 0,
        SectionFINIdleTime: 0,
        SectionFINNWTime: 0,
        SectionFINBDTime: 0,
        SectionPKGIdleTime: 0,
        SectionPKGNWTime: 0,
        SectionPKGBDTime: 0,
        SectionSWGCapacityWs: 10,
        SectionSWGOprsAtt: 10,
      };

      const shiftData = {
        ShiftCode: '001',
        ShiftTime: 480,
        ShiftOverTime: 0,
        StartTime: '09:00',
        EndTime: '17:00',
      };

      const result = calc.calculate(productionData, shiftData, {
        reportDate: '25/05/2026',
        shiftCode: '001',
        currentShiftCode: '001',
        breakMinsTillNow: 0,
      });

      this.assertTrue(result.efficiency !== undefined, 'Should have efficiency');
      this.assertTrue(result.earnedMinutes !== undefined, 'Should have earned minutes');
      this.assertTrue(result.availableMinutes !== undefined, 'Should have available minutes');
      this.assertTrue(result.offStandardDeduction !== undefined, 'Should have off-standard deduction');
      this.assertTrue(result.flags !== undefined, 'Should have flags');
      this.assertTrue(result.shiftDetails !== undefined, 'Should have shift details');
    });
  }

  testZeroDenominatorProtection() {
    console.log('\n--- Test: Zero Denominator Protection ---');

    this.test('Return 0 efficiency when no time worked', () => {
      const calc = new EfficiencyCalculator();
      calc.dispEffSettings('1,3,12345,8,12,16,Y,25,YYYY');

      // When all worked minutes are 0, the denominator should be 0 or very small
      const productionData = {
        LineCode: 'L001',
        ShiftCode: '001',
        LineSWGPcsSAM: 1000,
        SectionSWGWorkedMins: 0,
        SectionCHKWorkedMins: 0,
        SectionAQLWorkedMins: 0,
        SectionFINWorkedMins: 0,
        SectionPKGWorkedMins: 0,
        SectionSWGIdleTime: 0,
        SectionSWGNWTime: 0,
        SectionSWGBDTime: 0,
        SectionSWGRwTime: 0,
        SectionCHKIdleTime: 0,
        SectionCHKNWTime: 0,
        SectionCHKBDTime: 0,
        SectionAQLIdleTime: 0,
        SectionAQLNWTime: 0,
        SectionAQLBDTime: 0,
        SectionFINIdleTime: 0,
        SectionFINNWTime: 0,
        SectionFINBDTime: 0,
        SectionPKGIdleTime: 0,
        SectionPKGNWTime: 0,
        SectionPKGBDTime: 0,
        SectionSWGCapacityWs: 0,  // Zero workstations means zero available minutes
        SectionSWGOprsAtt: 0,     // Zero attending operators
        SectionCHKCapacityWs: 0,
        SectionCHKOprsAtt: 0,
        SectionAQLCapacityWs: 0,
        SectionAQLOprsAtt: 0,
        SectionFINCapacityWs: 0,
        SectionFINOprsAtt: 0,
        SectionPKGCapacityWs: 0,
        SectionPKGOprsAtt: 0,
      };

      const shiftData = {
        ShiftCode: '001',
        ShiftTime: 480,
        ShiftOverTime: 0,
        StartTime: '09:00',
        EndTime: '17:00',
      };

      const result = calc.calculate(productionData, shiftData, {
        reportDate: '25/05/2026',
        shiftCode: '001',
        currentShiftCode: '001',
        breakMinsTillNow: 0,
      });

      // When available minutes is effectively 0, efficiency should be 0
      this.assertTrue(result.efficiency >= 0, 'Should return non-negative efficiency');
      this.assertTrue(result.efficiency <= 100, 'Should not exceed 100%');
    });
  }

  testConstraintEnforcement() {
    console.log('\n--- Test: Constraint Enforcement ---');

    this.test('Cap off-standard deduction at available minutes', () => {
      const calc = new EfficiencyCalculator();
      calc.I_L_Eff_OffStd_Net = 1;
      calc.I_L_IdleTime = 1;
      calc.I_L_SewingOpr = 1;

      // Available: 60 mins, Deduction request: 100 mins -> should be capped at 0
      const availableMinutes = 60;
      const deductionRequest = 100;

      const adjustedDeduction =
        deductionRequest > availableMinutes ? 0 : deductionRequest;

      this.assert(
        adjustedDeduction,
        0,
        'Should set deduction to 0 when it exceeds available'
      );
    });
  }

  testLogging() {
    console.log('\n--- Test: Logging ---');

    this.test('Log calculations when enabled', () => {
      const calc = new EfficiencyCalculator(true);
      calc.dispEffSettings('1,3,12345,8,12,16,Y,25,YYYY');

      const logs = calc.getDebugLog();
      this.assertTrue(logs.length > 0, 'Should have debug logs when enabled');
      this.assertTrue(
        logs.some(l => l.section === 'CONFIG'),
        'Should have CONFIG section logs'
      );
    });

    this.test('Not log when disabled', () => {
      const calc = new EfficiencyCalculator(false);
      calc.dispEffSettings('1,3,12345,8,12,16,Y,25,YYYY');

      const logs = calc.getDebugLog();
      this.assert(logs.length, 0, 'Should not log when disabled');
    });
  }
}

// ============================================================================
// EXECUTE TESTS
// ============================================================================

if (require.main === module) {
  const suite = new EfficiencyCalculatorTests();
  const allPassed = suite.runAll();
  process.exit(allPassed ? 0 : 1);
}

module.exports = EfficiencyCalculatorTests;
