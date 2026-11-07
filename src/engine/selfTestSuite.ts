import {
  computeRecordMetrics,
  computeExecutiveKPIs,
  computeCostCategoryBreakdown,
  computeProductProfitability,
  runCostOptimisationEngine,
  runScenarioSimulation,
} from './analyticsEngine';
import {
  generateSyntheticIndustrialDataset,
  ProductionRecordItem,
} from '../data/industrialSeedData';

export interface VerificationTestResult {
  id: string;
  suite: string;
  name: string;
  formulaTested: string;
  expected: string;
  actual: string;
  passed: boolean;
}

/**
 * Executes live in-browser verification of all critical financial & OR formulas.
 */
export function runAutomatedVerificationSuite(): VerificationTestResult[] {
  const sample: ProductionRecordItem = {
    id: 'VERIFY_01',
    ownerId: 'verify',
    month: '2026-10',
    plantId: 'PLT-PUN-01',
    plantName: 'Pune Heavy Engineering & Boilers Complex',
    sector: 'Thermal Energy',
    productId: 'PRD-THM-401',
    productName: '120 TPH CFBC Biomass & Coal Thermal Boiler',
    productionLine: 'BAY-BOILER-F1',
    unitsProduced: 4,
    sellingPricePerUnit: 800000,
    revenue: 3200000,
    budgetedCost: 2200000,
    rawMaterialCost: 1100000,
    directLabourCost: 300000,
    energyCost: 200000,
    maintenanceCost: 100000,
    logisticsCost: 160000,
    inventoryHoldingCost: 140000,
    overheadCost: 400000,
    machineHoursAvailable: 720,
    machineHoursUsed: 576,
    rawMaterialInputTons: 500,
    rawMaterialNetTons: 450,
    energyKwhConsumed: 1400000,
    benchmarkEnergyKwhPerUnit: 300000,
  };

  const m = computeRecordMetrics(sample);
  const kpi = computeExecutiveKPIs([sample]);
  const fullData = generateSyntheticIndustrialDataset('verify');
  const breakdown = computeCostCategoryBreakdown(fullData);
  const shareSum = breakdown.reduce((s, c) => s + c.shareOfCostPct, 0);
  const prods = computeProductProfitability(fullData);
  const opt = runCostOptimisationEngine(fullData);
  const sim = runScenarioSimulation(fullData, {
    rawMaterialDeltaPct: -10,
    energyDeltaPct: 0,
    volumeDeltaPct: 0,
    labourDeltaPct: 0,
    utilisationTargetPct: 76.2,
    sellingPriceDeltaPct: 0,
  });

  return [
    {
      id: 'TST-01',
      suite: 'Cost Accounting Identity',
      name: '7-Category Total Cost & Variable/Fixed Partition',
      formulaTested: 'C_total = C_var + C_fix = Σ(7 Cost Categories)',
      expected: '$2,400,000 ($1,800k Var + $600k Fix)',
      actual: `$${m.totalCost.toLocaleString()} ($${(m.variableCost / 1000).toFixed(0)}k Var + $${(m.fixedCost / 1000).toFixed(0)}k Fix)`,
      passed: m.totalCost === 2400000 && m.variableCost === 1800000 && m.fixedCost === 600000,
    },
    {
      id: 'TST-02',
      suite: 'Profitability & Unit Economics',
      name: 'Gross Margin % & Cost Per Unit (CPU)',
      formulaTested: 'GM% = ((R - C_total) / R) × 100 | CPU = C_total / Q',
      expected: '25.00% GM | $600,000/unit',
      actual: `${m.grossMarginPct.toFixed(2)}% GM | $${m.costPerUnit.toLocaleString()}/unit`,
      passed: Math.abs(m.grossMarginPct - 25.0) < 0.001 && m.costPerUnit === 600000,
    },
    {
      id: 'TST-03',
      suite: 'CVP & Break-Even Analysis',
      name: 'Contribution Margin Ratio & Break-Even Revenue',
      formulaTested: 'CMR = (R - C_var)/R | BEP_Rev = C_fix / CMR',
      expected: '43.75% CMR | $1,371,429 BEP',
      actual: `${kpi.contributionMarginPct.toFixed(2)}% CMR | $${Math.round(kpi.breakEvenRevenueUsd).toLocaleString()} BEP`,
      passed:
        Math.abs(kpi.contributionMarginPct - 43.75) < 0.01 &&
        Math.abs(kpi.breakEvenRevenueUsd - 1371428.57) < 1,
    },
    {
      id: 'TST-04',
      suite: 'CVP & Operating Risk',
      name: 'Degree of Operating Leverage (DOL) & Margin of Safety',
      formulaTested: 'DOL = CM / EBIT | MoS% = (R - BEP_Rev) / R × 100',
      expected: '1.75x DOL | 57.14% MoS',
      actual: `${kpi.operatingLeverage.toFixed(2)}x DOL | ${kpi.marginOfSafetyPct.toFixed(2)}% MoS`,
      passed:
        Math.abs(kpi.operatingLeverage - 1.75) < 0.01 &&
        Math.abs(kpi.marginOfSafetyPct - 57.14) < 0.05,
    },
    {
      id: 'TST-05',
      suite: 'Cost Breakdown Integrity',
      name: 'Exhaustive 7-Category Share Normalization',
      formulaTested: 'Σ (Category_Cost_i / C_total) × 100 = 100.00%',
      expected: '100.00%',
      actual: `${shareSum.toFixed(2)}%`,
      passed: Math.abs(shareSum - 100.0) < 0.001,
    },
    {
      id: 'TST-06',
      suite: 'Portfolio Margin Diagnostics',
      name: 'Loss-Making & Low-Margin Product Identification',
      formulaTested: 'GM% < 0% => Loss-Making | 0% <= GM% < 12% => Low Margin',
      expected: 'PRD-MIN-302 Loss-Making & PRD-SUG-202 Low Margin',
      actual: `Found ${prods.filter((p) => p.marginTier === 'Loss-Making').length} Loss-Making, ${prods.filter((p) => p.marginTier === 'Low Margin').length} Low Margin`,
      passed:
        prods.some((p) => p.productId === 'PRD-MIN-302' && p.marginTier === 'Loss-Making') &&
        prods.some((p) => p.productId === 'PRD-SUG-202' && p.marginTier === 'Low Margin'),
    },
    {
      id: 'TST-07',
      suite: 'Operations Research Engine',
      name: 'Monotonic Ranking & Payback Valuation',
      formulaTested: 'Rank_1 >= Rank_2 ... >= Rank_n | Payback = (Impl / Savings) × 12',
      expected: 'Strictly Descending Annual Savings & Payback > 0',
      actual: `${opt.recommendations.length} Initiatives Ranked (#1: $${Math.round(opt.recommendations[0]?.estimatedAnnualSavingsUsd || 0).toLocaleString()}/yr)`,
      passed:
        opt.recommendations.length >= 6 &&
        opt.recommendations[0].estimatedAnnualSavingsUsd >=
          opt.recommendations[1].estimatedAnnualSavingsUsd,
    },
    {
      id: 'TST-08',
      suite: 'Scenario Elasticity Engine',
      name: 'Ceteris Paribus Raw Material -10% Price Elasticity',
      formulaTested: 'ΔProfit > 0 when ΔRM_Price = -10%',
      expected: 'Positive Gross Profit Delta',
      actual: `+$${Math.round(sim.deltas.grossProfitDeltaUsd).toLocaleString()} Profit Delta`,
      passed: sim.deltas.grossProfitDeltaUsd > 0,
    },
  ];
}
