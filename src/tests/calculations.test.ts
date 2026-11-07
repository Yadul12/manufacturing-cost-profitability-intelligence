import { describe, it, expect } from 'vitest';
import {
  computeRecordMetrics,
  computeExecutiveKPIs,
  computeCostCategoryBreakdown,
  computeProductProfitability,
  runCostOptimisationEngine,
  runScenarioSimulation,
} from '../engine/analyticsEngine';
import {
  generateSyntheticIndustrialDataset,
  ProductionRecordItem,
} from '../data/industrialSeedData';

const SAMPLE_RECORD: ProductionRecordItem = {
  id: 'TEST_REC_01',
  ownerId: 'user_test',
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

describe('Manufacturing Cost & Profitability Analytical Engine Tests', () => {
  it('1. Accurately calculates total cost, variable/fixed split, and gross margin', () => {
    const m = computeRecordMetrics(SAMPLE_RECORD);
    // Total Cost = 1,100k + 300k + 200k + 100k + 160k + 140k + 400k = 2,400,000
    expect(m.totalCost).toBe(2400000);
    // Variable Cost = 1,100k + 300k + 200k + 160k + 0.4 * 100k = 1,800,000
    expect(m.variableCost).toBe(1800000);
    // Fixed Cost = 400k + 140k + 0.6 * 100k = 600,000
    expect(m.fixedCost).toBe(600000);
    expect(m.variableCost + m.fixedCost).toBe(m.totalCost);

    // Gross Profit = 3,200,000 - 2,400,000 = 800,000 (25.0%)
    expect(m.grossProfit).toBe(800000);
    expect(m.grossMarginPct).toBeCloseTo(25.0, 4);

    // Cost per unit = 2,400,000 / 4 = 600,000
    expect(m.costPerUnit).toBe(600000);

    // Scrap Rate = (500 - 450) / 500 = 10.0%
    expect(m.scrapRatePct).toBeCloseTo(10.0, 4);

    // Machine Utilisation = 576 / 720 = 80.0%
    expect(m.machineUtilisationPct).toBeCloseTo(80.0, 4);
  });

  it('2. Accurately calculates Contribution Margin, Break-Even Point, and Operating Leverage', () => {
    const kpis = computeExecutiveKPIs([SAMPLE_RECORD]);
    // Contribution Margin = 3,200,000 - 1,800,000 = 1,400,000
    expect(kpis.contributionMargin).toBe(1400000);
    // CMR = 1,400,000 / 3,200,000 = 0.4375 (43.75%)
    expect(kpis.contributionMarginPct).toBeCloseTo(43.75, 4);

    // Break-Even Revenue = Fixed Cost (600,000) / CMR (0.4375) = 1,371,428.57
    expect(kpis.breakEvenRevenueUsd).toBeCloseTo(1371428.57, 1);

    // Break-Even Units = 600,000 / (800,000 - 450,000) = 600,000 / 350,000 = 1.7143 units
    expect(kpis.breakEvenUnits).toBeCloseTo(1.7143, 3);

    // Operating Leverage = CM (1,400,000) / Gross Profit (800,000) = 1.75x
    expect(kpis.operatingLeverage).toBeCloseTo(1.75, 4);
  });

  it('3. Ensures Cost Category Breakdown shares sum to exactly 100% of total cost', () => {
    const dataset = generateSyntheticIndustrialDataset('test-owner');
    expect(dataset.length).toBe(96); // 12 months * 8 products
    const breakdown = computeCostCategoryBreakdown(dataset);
    expect(breakdown.length).toBe(7);
    const totalShare = breakdown.reduce((s, c) => s + c.shareOfCostPct, 0);
    expect(totalShare).toBeCloseTo(100.0, 4);
  });

  it('4. Identifies low-margin and loss-making products in the synthetic dataset', () => {
    const dataset = generateSyntheticIndustrialDataset('test-owner');
    const products = computeProductProfitability(dataset);
    const lossMaking = products.filter((p) => p.marginTier === 'Loss-Making');
    const lowMargin = products.filter((p) => p.marginTier === 'Low Margin');

    expect(lossMaking.length).toBeGreaterThanOrEqual(1);
    expect(lossMaking.some((p) => p.productId === 'PRD-MIN-302')).toBe(true);
    expect(lowMargin.length).toBeGreaterThanOrEqual(1);
    expect(lowMargin.some((p) => p.productId === 'PRD-SUG-202')).toBe(true);
  });

  it('5. Generates ranked cost-optimisation recommendations with positive savings and valid payback', () => {
    const dataset = generateSyntheticIndustrialDataset('test-owner');
    const { recommendations, categorySummary } = runCostOptimisationEngine(dataset);
    expect(recommendations.length).toBeGreaterThan(5);
    expect(categorySummary.length).toBe(6);

    for (let i = 0; i < recommendations.length; i++) {
      const rec = recommendations[i];
      expect(rec.rank).toBe(i + 1);
      expect(rec.estimatedAnnualSavingsUsd).toBeGreaterThan(0);
      expect(rec.implementationCostUsd).toBeGreaterThan(0);
      expect(rec.paybackPeriodMonths).toBeGreaterThan(0);
      if (i > 0) {
        expect(recommendations[i - 1].estimatedAnnualSavingsUsd).toBeGreaterThanOrEqual(
          rec.estimatedAnnualSavingsUsd
        );
      }
    }
  });

  it('6. Scenario Simulator correctly reflects raw material price reduction and selling price increase', () => {
    const dataset = generateSyntheticIndustrialDataset('test-owner');
    const simResult = runScenarioSimulation(dataset, {
      rawMaterialDeltaPct: -10,
      energyDeltaPct: -5,
      volumeDeltaPct: 5,
      labourDeltaPct: 0,
      utilisationTargetPct: 84,
      sellingPriceDeltaPct: 4,
    });

    expect(simResult.simulated.grossProfit).toBeGreaterThan(simResult.baseline.grossProfit);
    expect(simResult.simulated.grossMarginPct).toBeGreaterThan(simResult.baseline.grossMarginPct);
    expect(simResult.deltas.grossProfitDeltaUsd).toBeGreaterThan(0);
  });
});
