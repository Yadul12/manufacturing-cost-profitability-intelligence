import { ProductionRecordItem, SectorType } from '../data/industrialSeedData';

export interface RecordComputedMetrics {
  totalCost: number;
  variableCost: number;
  fixedCost: number;
  grossProfit: number;
  grossMarginPct: number;
  contributionMargin: number;
  contributionMarginRatio: number;
  costPerUnit: number;
  budgetVarianceUsd: number;
  budgetVariancePct: number;
  machineUtilisationPct: number;
  scrapRatePct: number;
  actualEnergyKwhPerUnit: number;
  energyExcessPct: number;
}

/**
 * Computes record-level financial and operational metrics using documented accounting formulas.
 */
export function computeRecordMetrics(rec: ProductionRecordItem): RecordComputedMetrics {
  const totalCost =
    rec.rawMaterialCost +
    rec.directLabourCost +
    rec.energyCost +
    rec.maintenanceCost +
    rec.logisticsCost +
    rec.inventoryHoldingCost +
    rec.overheadCost;

  // ASM-01: Variable vs Fixed decomposition
  const variableCost =
    rec.rawMaterialCost +
    rec.directLabourCost +
    rec.energyCost +
    rec.logisticsCost +
    0.4 * rec.maintenanceCost;

  const fixedCost =
    rec.overheadCost +
    rec.inventoryHoldingCost +
    0.6 * rec.maintenanceCost;

  const grossProfit = rec.revenue - totalCost;
  const grossMarginPct = rec.revenue > 0 ? (grossProfit / rec.revenue) * 100 : 0;

  const contributionMargin = rec.revenue - variableCost;
  const contributionMarginRatio = rec.revenue > 0 ? contributionMargin / rec.revenue : 0;

  const costPerUnit = rec.unitsProduced > 0 ? totalCost / rec.unitsProduced : 0;

  const budgetVarianceUsd = totalCost - rec.budgetedCost;
  const budgetVariancePct =
    rec.budgetedCost > 0 ? (budgetVarianceUsd / rec.budgetedCost) * 100 : 0;

  const machineUtilisationPct =
    rec.machineHoursAvailable > 0
      ? (rec.machineHoursUsed / rec.machineHoursAvailable) * 100
      : 0;

  const scrapRatePct =
    rec.rawMaterialInputTons > 0
      ? ((rec.rawMaterialInputTons - rec.rawMaterialNetTons) / rec.rawMaterialInputTons) * 100
      : 0;

  const actualEnergyKwhPerUnit =
    rec.unitsProduced > 0 ? rec.energyKwhConsumed / rec.unitsProduced : 0;

  const energyExcessPct =
    rec.benchmarkEnergyKwhPerUnit > 0
      ? ((actualEnergyKwhPerUnit - rec.benchmarkEnergyKwhPerUnit) /
          rec.benchmarkEnergyKwhPerUnit) *
        100
      : 0;

  return {
    totalCost,
    variableCost,
    fixedCost,
    grossProfit,
    grossMarginPct,
    contributionMargin,
    contributionMarginRatio,
    costPerUnit,
    budgetVarianceUsd,
    budgetVariancePct,
    machineUtilisationPct,
    scrapRatePct,
    actualEnergyKwhPerUnit,
    energyExcessPct,
  };
}

export interface ExecutiveKPIs {
  recordCount: number;
  totalUnitsProduced: number;
  totalRevenue: number;
  totalProductionCost: number;
  totalBudgetedCost: number;
  grossProfit: number;
  grossMarginPct: number;
  totalVariableCost: number;
  totalFixedCost: number;
  contributionMargin: number;
  contributionMarginPct: number;
  costPerUnit: number;
  revenuePerUnit: number;
  budgetVarianceUsd: number;
  budgetVariancePct: number;
  avgMachineUtilisationPct: number;
  avgScrapRatePct: number;
  totalEnergyKwh: number;
  breakEvenRevenueUsd: number;
  breakEvenUnits: number;
  marginOfSafetyPct: number;
  operatingLeverage: number;
}

export function computeExecutiveKPIs(records: ProductionRecordItem[]): ExecutiveKPIs {
  if (!records.length) {
    return {
      recordCount: 0,
      totalUnitsProduced: 0,
      totalRevenue: 0,
      totalProductionCost: 0,
      totalBudgetedCost: 0,
      grossProfit: 0,
      grossMarginPct: 0,
      totalVariableCost: 0,
      totalFixedCost: 0,
      contributionMargin: 0,
      contributionMarginPct: 0,
      costPerUnit: 0,
      revenuePerUnit: 0,
      budgetVarianceUsd: 0,
      budgetVariancePct: 0,
      avgMachineUtilisationPct: 0,
      avgScrapRatePct: 0,
      totalEnergyKwh: 0,
      breakEvenRevenueUsd: 0,
      breakEvenUnits: 0,
      marginOfSafetyPct: 0,
      operatingLeverage: 0,
    };
  }

  let totalUnitsProduced = 0;
  let totalRevenue = 0;
  let totalProductionCost = 0;
  let totalBudgetedCost = 0;
  let totalVariableCost = 0;
  let totalFixedCost = 0;
  let totalHoursAvail = 0;
  let totalHoursUsed = 0;
  let totalInputTons = 0;
  let totalNetTons = 0;
  let totalEnergyKwh = 0;

  for (const rec of records) {
    const m = computeRecordMetrics(rec);
    totalUnitsProduced += rec.unitsProduced;
    totalRevenue += rec.revenue;
    totalProductionCost += m.totalCost;
    totalBudgetedCost += rec.budgetedCost;
    totalVariableCost += m.variableCost;
    totalFixedCost += m.fixedCost;
    totalHoursAvail += rec.machineHoursAvailable;
    totalHoursUsed += rec.machineHoursUsed;
    totalInputTons += rec.rawMaterialInputTons;
    totalNetTons += rec.rawMaterialNetTons;
    totalEnergyKwh += rec.energyKwhConsumed;
  }

  const grossProfit = totalRevenue - totalProductionCost;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const contributionMargin = totalRevenue - totalVariableCost;
  const contributionMarginRatio = totalRevenue > 0 ? contributionMargin / totalRevenue : 0;
  const contributionMarginPct = contributionMarginRatio * 100;

  const costPerUnit = totalUnitsProduced > 0 ? totalProductionCost / totalUnitsProduced : 0;
  const revenuePerUnit = totalUnitsProduced > 0 ? totalRevenue / totalUnitsProduced : 0;
  const variableCostPerUnit =
    totalUnitsProduced > 0 ? totalVariableCost / totalUnitsProduced : 0;
  const unitContribution = revenuePerUnit - variableCostPerUnit;

  const budgetVarianceUsd = totalProductionCost - totalBudgetedCost;
  const budgetVariancePct =
    totalBudgetedCost > 0 ? (budgetVarianceUsd / totalBudgetedCost) * 100 : 0;

  const avgMachineUtilisationPct =
    totalHoursAvail > 0 ? (totalHoursUsed / totalHoursAvail) * 100 : 0;
  const avgScrapRatePct =
    totalInputTons > 0 ? ((totalInputTons - totalNetTons) / totalInputTons) * 100 : 0;

  const breakEvenRevenueUsd =
    contributionMarginRatio > 0 ? totalFixedCost / contributionMarginRatio : 0;
  const breakEvenUnits =
    unitContribution > 0 ? totalFixedCost / unitContribution : 0;

  const marginOfSafetyPct =
    totalRevenue > 0
      ? ((totalRevenue - breakEvenRevenueUsd) / totalRevenue) * 100
      : 0;

  const operatingLeverage =
    grossProfit !== 0 ? contributionMargin / grossProfit : 0;

  return {
    recordCount: records.length,
    totalUnitsProduced,
    totalRevenue,
    totalProductionCost,
    totalBudgetedCost,
    grossProfit,
    grossMarginPct,
    totalVariableCost,
    totalFixedCost,
    contributionMargin,
    contributionMarginPct,
    costPerUnit,
    revenuePerUnit,
    budgetVarianceUsd,
    budgetVariancePct,
    avgMachineUtilisationPct,
    avgScrapRatePct,
    totalEnergyKwh,
    breakEvenRevenueUsd,
    breakEvenUnits,
    marginOfSafetyPct,
    operatingLeverage,
  };
}

export interface MonthlyTrendRow {
  month: string;
  unitsProduced: number;
  revenue: number;
  totalCost: number;
  budgetedCost: number;
  grossProfit: number;
  grossMarginPct: number;
  costPerUnit: number;
  budgetVarianceUsd: number;
  rawMaterialCost: number;
  directLabourCost: number;
  energyCost: number;
  maintenanceCost: number;
  logisticsCost: number;
  inventoryHoldingCost: number;
  overheadCost: number;
}

export function computeMonthlyTrends(records: ProductionRecordItem[]): MonthlyTrendRow[] {
  const map = new Map<string, MonthlyTrendRow>();

  for (const rec of records) {
    const m = computeRecordMetrics(rec);
    const existing = map.get(rec.month) || {
      month: rec.month,
      unitsProduced: 0,
      revenue: 0,
      totalCost: 0,
      budgetedCost: 0,
      grossProfit: 0,
      grossMarginPct: 0,
      costPerUnit: 0,
      budgetVarianceUsd: 0,
      rawMaterialCost: 0,
      directLabourCost: 0,
      energyCost: 0,
      maintenanceCost: 0,
      logisticsCost: 0,
      inventoryHoldingCost: 0,
      overheadCost: 0,
    };

    existing.unitsProduced += rec.unitsProduced;
    existing.revenue += rec.revenue;
    existing.totalCost += m.totalCost;
    existing.budgetedCost += rec.budgetedCost;
    existing.grossProfit += m.grossProfit;
    existing.rawMaterialCost += rec.rawMaterialCost;
    existing.directLabourCost += rec.directLabourCost;
    existing.energyCost += rec.energyCost;
    existing.maintenanceCost += rec.maintenanceCost;
    existing.logisticsCost += rec.logisticsCost;
    existing.inventoryHoldingCost += rec.inventoryHoldingCost;
    existing.overheadCost += rec.overheadCost;

    map.set(rec.month, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({
      ...row,
      grossMarginPct: row.revenue > 0 ? (row.grossProfit / row.revenue) * 100 : 0,
      costPerUnit: row.unitsProduced > 0 ? row.totalCost / row.unitsProduced : 0,
      budgetVarianceUsd: row.totalCost - row.budgetedCost,
    }));
}

export interface CostCategoryBreakdown {
  key: string;
  label: string;
  code: string;
  totalUsd: number;
  shareOfCostPct: number;
  shareOfRevenuePct: number;
  costPerUnitUsd: number;
  nature: 'Variable' | 'Fixed' | 'Semi-Variable';
}

export function computeCostCategoryBreakdown(
  records: ProductionRecordItem[]
): CostCategoryBreakdown[] {
  let rm = 0;
  let dl = 0;
  let en = 0;
  let mn = 0;
  let lg = 0;
  let ih = 0;
  let oh = 0;
  let units = 0;
  let rev = 0;

  for (const r of records) {
    rm += r.rawMaterialCost;
    dl += r.directLabourCost;
    en += r.energyCost;
    mn += r.maintenanceCost;
    lg += r.logisticsCost;
    ih += r.inventoryHoldingCost;
    oh += r.overheadCost;
    units += r.unitsProduced;
    rev += r.revenue;
  }

  const total = rm + dl + en + mn + lg + ih + oh;

  const rawCategories: Array<{
    key: string;
    label: string;
    code: string;
    totalUsd: number;
    nature: 'Variable' | 'Fixed' | 'Semi-Variable';
  }> = [
    { key: 'rawMaterialCost', label: 'Raw Material Costs', code: 'C_RM', totalUsd: rm, nature: 'Variable' },
    { key: 'directLabourCost', label: 'Direct Fabrication Labour', code: 'C_DL', totalUsd: dl, nature: 'Variable' },
    { key: 'overheadCost', label: 'Production Overheads', code: 'C_OH', totalUsd: oh, nature: 'Fixed' },
    { key: 'energyCost', label: 'Energy & Electricity', code: 'C_EN', totalUsd: en, nature: 'Variable' },
    { key: 'logisticsCost', label: 'Logistics & Heavy Transport', code: 'C_LG', totalUsd: lg, nature: 'Variable' },
    { key: 'maintenanceCost', label: 'Machine Maintenance', code: 'C_MN', totalUsd: mn, nature: 'Semi-Variable' },
    { key: 'inventoryHoldingCost', label: 'Inventory Holding Costs', code: 'C_IH', totalUsd: ih, nature: 'Fixed' },
  ];

  return rawCategories
    .sort((a, b) => b.totalUsd - a.totalUsd)
    .map((c) => ({
      ...c,
      shareOfCostPct: total > 0 ? (c.totalUsd / total) * 100 : 0,
      shareOfRevenuePct: rev > 0 ? (c.totalUsd / rev) * 100 : 0,
      costPerUnitUsd: units > 0 ? c.totalUsd / units : 0,
    }));
}

export interface ProductProfitabilityRow {
  productId: string;
  productName: string;
  sector: SectorType;
  plantId: string;
  plantName: string;
  productionLine: string;
  unitsProduced: number;
  revenue: number;
  totalCost: number;
  budgetedCost: number;
  variableCost: number;
  fixedCost: number;
  grossProfit: number;
  grossMarginPct: number;
  contributionMargin: number;
  contributionMarginPct: number;
  sellingPricePerUnit: number;
  costPerUnit: number;
  variableCostPerUnit: number;
  breakEvenUnits: number;
  breakEvenRevenueUsd: number;
  marginOfSafetyPct: number;
  budgetVarianceUsd: number;
  budgetVariancePct: number;
  machineUtilisationPct: number;
  scrapRatePct: number;
  energyExcessPct: number;
  marginTier: 'High Margin' | 'Healthy' | 'Low Margin' | 'Loss-Making';
}

export function computeProductProfitability(
  records: ProductionRecordItem[]
): ProductProfitabilityRow[] {
  const map = new Map<
    string,
    {
      productId: string;
      productName: string;
      sector: SectorType;
      plantId: string;
      plantName: string;
      productionLine: string;
      unitsProduced: number;
      revenue: number;
      totalCost: number;
      budgetedCost: number;
      variableCost: number;
      fixedCost: number;
      hoursAvail: number;
      hoursUsed: number;
      inputTons: number;
      netTons: number;
      energyKwh: number;
      benchmarkKwhTotal: number;
    }
  >();

  for (const r of records) {
    const m = computeRecordMetrics(r);
    const curr = map.get(r.productId) || {
      productId: r.productId,
      productName: r.productName,
      sector: r.sector,
      plantId: r.plantId,
      plantName: r.plantName,
      productionLine: r.productionLine,
      unitsProduced: 0,
      revenue: 0,
      totalCost: 0,
      budgetedCost: 0,
      variableCost: 0,
      fixedCost: 0,
      hoursAvail: 0,
      hoursUsed: 0,
      inputTons: 0,
      netTons: 0,
      energyKwh: 0,
      benchmarkKwhTotal: 0,
    };

    curr.unitsProduced += r.unitsProduced;
    curr.revenue += r.revenue;
    curr.totalCost += m.totalCost;
    curr.budgetedCost += r.budgetedCost;
    curr.variableCost += m.variableCost;
    curr.fixedCost += m.fixedCost;
    curr.hoursAvail += r.machineHoursAvailable;
    curr.hoursUsed += r.machineHoursUsed;
    curr.inputTons += r.rawMaterialInputTons;
    curr.netTons += r.rawMaterialNetTons;
    curr.energyKwh += r.energyKwhConsumed;
    curr.benchmarkKwhTotal += r.unitsProduced * r.benchmarkEnergyKwhPerUnit;

    map.set(r.productId, curr);
  }

  return Array.from(map.values())
    .map((p) => {
      const grossProfit = p.revenue - p.totalCost;
      const grossMarginPct = p.revenue > 0 ? (grossProfit / p.revenue) * 100 : 0;
      const contributionMargin = p.revenue - p.variableCost;
      const cmRatio = p.revenue > 0 ? contributionMargin / p.revenue : 0;
      const contributionMarginPct = cmRatio * 100;

      const sellingPricePerUnit = p.unitsProduced > 0 ? p.revenue / p.unitsProduced : 0;
      const costPerUnit = p.unitsProduced > 0 ? p.totalCost / p.unitsProduced : 0;
      const variableCostPerUnit = p.unitsProduced > 0 ? p.variableCost / p.unitsProduced : 0;
      const unitCM = sellingPricePerUnit - variableCostPerUnit;

      const breakEvenUnits = unitCM > 0 ? p.fixedCost / unitCM : 0;
      const breakEvenRevenueUsd = cmRatio > 0 ? p.fixedCost / cmRatio : 0;
      const marginOfSafetyPct =
        p.revenue > 0 ? ((p.revenue - breakEvenRevenueUsd) / p.revenue) * 100 : 0;

      const budgetVarianceUsd = p.totalCost - p.budgetedCost;
      const budgetVariancePct =
        p.budgetedCost > 0 ? (budgetVarianceUsd / p.budgetedCost) * 100 : 0;

      const machineUtilisationPct =
        p.hoursAvail > 0 ? (p.hoursUsed / p.hoursAvail) * 100 : 0;
      const scrapRatePct =
        p.inputTons > 0 ? ((p.inputTons - p.netTons) / p.inputTons) * 100 : 0;
      const energyExcessPct =
        p.benchmarkKwhTotal > 0
          ? ((p.energyKwh - p.benchmarkKwhTotal) / p.benchmarkKwhTotal) * 100
          : 0;

      let marginTier: ProductProfitabilityRow['marginTier'] = 'Healthy';
      if (grossMarginPct < 0) marginTier = 'Loss-Making';
      else if (grossMarginPct < 12) marginTier = 'Low Margin';
      else if (grossMarginPct >= 22) marginTier = 'High Margin';

      return {
        productId: p.productId,
        productName: p.productName,
        sector: p.sector,
        plantId: p.plantId,
        plantName: p.plantName,
        productionLine: p.productionLine,
        unitsProduced: p.unitsProduced,
        revenue: p.revenue,
        totalCost: p.totalCost,
        budgetedCost: p.budgetedCost,
        variableCost: p.variableCost,
        fixedCost: p.fixedCost,
        grossProfit,
        grossMarginPct,
        contributionMargin,
        contributionMarginPct,
        sellingPricePerUnit,
        costPerUnit,
        variableCostPerUnit,
        breakEvenUnits,
        breakEvenRevenueUsd,
        marginOfSafetyPct,
        budgetVarianceUsd,
        budgetVariancePct,
        machineUtilisationPct,
        scrapRatePct,
        energyExcessPct,
        marginTier,
      };
    })
    .sort((a, b) => b.grossMarginPct - a.grossMarginPct);
}

export interface PlantProfitabilityRow {
  plantId: string;
  plantName: string;
  unitsProduced: number;
  revenue: number;
  totalCost: number;
  budgetedCost: number;
  grossProfit: number;
  grossMarginPct: number;
  contributionMargin: number;
  contributionMarginPct: number;
  budgetVarianceUsd: number;
  machineUtilisationPct: number;
  scrapRatePct: number;
  rawMaterialCost: number;
  directLabourCost: number;
  energyCost: number;
  maintenanceCost: number;
  logisticsCost: number;
  inventoryHoldingCost: number;
  overheadCost: number;
}

export function computePlantProfitability(
  records: ProductionRecordItem[]
): PlantProfitabilityRow[] {
  const map = new Map<
    string,
    PlantProfitabilityRow & { hoursAvail: number; hoursUsed: number; inputTons: number; netTons: number; varCost: number }
  >();

  for (const r of records) {
    const m = computeRecordMetrics(r);
    const curr = map.get(r.plantId) || {
      plantId: r.plantId,
      plantName: r.plantName,
      unitsProduced: 0,
      revenue: 0,
      totalCost: 0,
      budgetedCost: 0,
      grossProfit: 0,
      grossMarginPct: 0,
      contributionMargin: 0,
      contributionMarginPct: 0,
      budgetVarianceUsd: 0,
      machineUtilisationPct: 0,
      scrapRatePct: 0,
      rawMaterialCost: 0,
      directLabourCost: 0,
      energyCost: 0,
      maintenanceCost: 0,
      logisticsCost: 0,
      inventoryHoldingCost: 0,
      overheadCost: 0,
      hoursAvail: 0,
      hoursUsed: 0,
      inputTons: 0,
      netTons: 0,
      varCost: 0,
    };

    curr.unitsProduced += r.unitsProduced;
    curr.revenue += r.revenue;
    curr.totalCost += m.totalCost;
    curr.budgetedCost += r.budgetedCost;
    curr.grossProfit += m.grossProfit;
    curr.contributionMargin += m.contributionMargin;
    curr.varCost += m.variableCost;
    curr.rawMaterialCost += r.rawMaterialCost;
    curr.directLabourCost += r.directLabourCost;
    curr.energyCost += r.energyCost;
    curr.maintenanceCost += r.maintenanceCost;
    curr.logisticsCost += r.logisticsCost;
    curr.inventoryHoldingCost += r.inventoryHoldingCost;
    curr.overheadCost += r.overheadCost;
    curr.hoursAvail += r.machineHoursAvailable;
    curr.hoursUsed += r.machineHoursUsed;
    curr.inputTons += r.rawMaterialInputTons;
    curr.netTons += r.rawMaterialNetTons;

    map.set(r.plantId, curr);
  }

  return Array.from(map.values())
    .map((p) => ({
      plantId: p.plantId,
      plantName: p.plantName,
      unitsProduced: p.unitsProduced,
      revenue: p.revenue,
      totalCost: p.totalCost,
      budgetedCost: p.budgetedCost,
      grossProfit: p.grossProfit,
      grossMarginPct: p.revenue > 0 ? (p.grossProfit / p.revenue) * 100 : 0,
      contributionMargin: p.contributionMargin,
      contributionMarginPct: p.revenue > 0 ? (p.contributionMargin / p.revenue) * 100 : 0,
      budgetVarianceUsd: p.totalCost - p.budgetedCost,
      machineUtilisationPct: p.hoursAvail > 0 ? (p.hoursUsed / p.hoursAvail) * 100 : 0,
      scrapRatePct: p.inputTons > 0 ? ((p.inputTons - p.netTons) / p.inputTons) * 100 : 0,
      rawMaterialCost: p.rawMaterialCost,
      directLabourCost: p.directLabourCost,
      energyCost: p.energyCost,
      maintenanceCost: p.maintenanceCost,
      logisticsCost: p.logisticsCost,
      inventoryHoldingCost: p.inventoryHoldingCost,
      overheadCost: p.overheadCost,
    }))
    .sort((a, b) => b.grossProfit - a.grossProfit);
}

// ============================================================================
// MODULE 4: COST OPTIMISATION ENGINE & STATISTICAL ANOMALY DIAGNOSTICS
// ============================================================================

export type InefficiencyCategory =
  | 'Excessive Energy Consumption'
  | 'Raw Material Wastage'
  | 'High Maintenance Expenditure'
  | 'Idle Machine Capacity'
  | 'Inventory Inefficiencies'
  | 'Abnormal Production Costs';

export interface CostAnomalyRecord {
  recordId: string;
  month: string;
  plantName: string;
  productId: string;
  productName: string;
  category: InefficiencyCategory;
  zScore: number;
  actualMetricLabel: string;
  benchmarkMetricLabel: string;
  excessCostUsd: number;
}

export interface CostRecommendation {
  code: string;
  rank: number;
  title: string;
  category: InefficiencyCategory;
  plantId: string;
  plantName: string;
  productId: string;
  productName: string;
  productionLine: string;
  diagnosticSummary: string;
  engineeringAction: string;
  currentBaselineMetric: string;
  targetBenchmarkMetric: string;
  affectedCostBaseUsd: number;
  estimatedAnnualSavingsUsd: number;
  implementationCostUsd: number;
  paybackPeriodMonths: number;
  threeYearNpvUsd: number;
  irrPct: number;
  priority: 'Critical' | 'High' | 'Medium';
}

/**
 * Runs statistical Z-score anomaly detection and operations research benchmarking
 * across the database records to generate ranked cost-reduction recommendations.
 */
export function runCostOptimisationEngine(records: ProductionRecordItem[]): {
  recommendations: CostRecommendation[];
  anomalies: CostAnomalyRecord[];
  categorySummary: Array<{
    category: InefficiencyCategory;
    totalExcessCostUsd: number;
    recoverableAnnualSavingsUsd: number;
    incidentCount: number;
  }>;
} {
  if (!records.length) {
    return { recommendations: [], anomalies: [], categorySummary: [] };
  }

  // Annualization factor based on number of unique months in current filtered dataset
  const uniqueMonths = new Set(records.map((r) => r.month)).size || 1;
  const annualMultiplier = 12 / uniqueMonths;

  // 1. Compute per-product mean & stdDev of unit cost for statistical Z-score outlier detection
  const productCostStats = new Map<string, { mean: number; std: number }>();
  const groupedByProduct = new Map<string, ProductionRecordItem[]>();
  for (const r of records) {
    const arr = groupedByProduct.get(r.productId) || [];
    arr.push(r);
    groupedByProduct.set(r.productId, arr);
  }

  groupedByProduct.forEach((recs, prodId) => {
    const cpus = recs.map((r) => computeRecordMetrics(r).costPerUnit);
    const mean = cpus.reduce((s, v) => s + v, 0) / cpus.length;
    const variance =
      cpus.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / Math.max(1, cpus.length - 1);
    const std = Math.sqrt(variance) || mean * 0.03;
    productCostStats.set(prodId, { mean, std });
  });

  const anomalies: CostAnomalyRecord[] = [];

  for (const r of records) {
    const m = computeRecordMetrics(r);
    const stats = productCostStats.get(r.productId)!;
    const zScore = stats.std > 0 ? (m.costPerUnit - stats.mean) / stats.std : 0;

    // Flag statistical unit-cost spikes
    if (zScore >= 1.45 || m.budgetVariancePct >= 14.0) {
      const excessUsd = Math.max(0, m.totalCost - r.budgetedCost);
      anomalies.push({
        recordId: r.id,
        month: r.month,
        plantName: r.plantName,
        productId: r.productId,
        productName: r.productName,
        category: 'Abnormal Production Costs',
        zScore: Number(zScore.toFixed(2)),
        actualMetricLabel: `$${Math.round(m.costPerUnit).toLocaleString()}/unit`,
        benchmarkMetricLabel: `$${Math.round(stats.mean).toLocaleString()}/unit`,
        excessCostUsd: excessUsd,
      });
    }

    // Flag excessive specific energy consumption (> 15% over thermodynamic benchmark)
    if (m.energyExcessPct > 15.0) {
      const excessRatio = (m.energyExcessPct - 5.0) / (100 + m.energyExcessPct);
      anomalies.push({
        recordId: r.id,
        month: r.month,
        plantName: r.plantName,
        productId: r.productId,
        productName: r.productName,
        category: 'Excessive Energy Consumption',
        zScore: Number((m.energyExcessPct / 8.5).toFixed(2)),
        actualMetricLabel: `${Math.round(m.actualEnergyKwhPerUnit).toLocaleString()} kWh/u`,
        benchmarkMetricLabel: `${Math.round(r.benchmarkEnergyKwhPerUnit).toLocaleString()} kWh/u`,
        excessCostUsd: Math.round(r.energyCost * excessRatio),
      });
    }

    // Flag raw material scrap wastage (> 12.5% scrap rate)
    if (m.scrapRatePct > 12.5) {
      const excessScrapPct = m.scrapRatePct - 9.0;
      anomalies.push({
        recordId: r.id,
        month: r.month,
        plantName: r.plantName,
        productId: r.productId,
        productName: r.productName,
        category: 'Raw Material Wastage',
        zScore: Number(((m.scrapRatePct - 9.5) / 2.2).toFixed(2)),
        actualMetricLabel: `${m.scrapRatePct.toFixed(1)}% scrap`,
        benchmarkMetricLabel: `9.0% tolerance`,
        excessCostUsd: Math.round(r.rawMaterialCost * (excessScrapPct / 100)),
      });
    }
  }

  anomalies.sort((a, b) => b.excessCostUsd - a.excessCostUsd);

  // 2. Evaluate product aggregates to synthesize Ranked Cost-Reduction Recommendations
  const productRows = computeProductProfitability(records);
  const rawRecs: Omit<CostRecommendation, 'rank'>[] = [];

  for (const prod of productRows) {
    const prodRecs = groupedByProduct.get(prod.productId) || [];
    const totalEnergyUsd = prodRecs.reduce((s, r) => s + r.energyCost, 0) * annualMultiplier;
    const totalRmUsd = prodRecs.reduce((s, r) => s + r.rawMaterialCost, 0) * annualMultiplier;
    const totalMaintUsd = prodRecs.reduce((s, r) => s + r.maintenanceCost, 0) * annualMultiplier;
    const totalInvUsd = prodRecs.reduce((s, r) => s + r.inventoryHoldingCost, 0) * annualMultiplier;
    const totalOhUsd = prodRecs.reduce((s, r) => s + r.overheadCost, 0) * annualMultiplier;
    const totalDlUsd = prodRecs.reduce((s, r) => s + r.directLabourCost, 0) * annualMultiplier;
    const totalBudgetVarUsd = Math.max(0, prod.budgetVarianceUsd * annualMultiplier);

    // Vector 1: Raw Material Wastage
    if (prod.scrapRatePct > 11.5) {
      const recoverablePct = Math.min(0.085, (prod.scrapRatePct - 8.8) / 100);
      const annualSavings = Math.round(totalRmUsd * recoverablePct * 0.78);
      const implCost = Math.round(annualSavings * 0.42); // CAD/CAM nesting & riser redesign
      rawRecs.push(
        buildRecommendation({
          code: `OPT-RM-${prod.productId}`,
          title: `AI-Nested CNC Plate Cutting & Riser Yield Optimization (${prod.productName})`,
          category: 'Raw Material Wastage',
          prod,
          diagnosticSummary: `Shop-floor metallic scrap rate is ${prod.scrapRatePct.toFixed(1)}% vs 8.8% engineering standard, driving excess alloy/plate consumption.`,
          engineeringAction: `Deploy automated multi-torch CNC nesting software and redesign manganese/alloy casting feeder risers to reduce off-cut scrap by ${(recoverablePct * 100).toFixed(1)}%.`,
          currentBaselineMetric: `${prod.scrapRatePct.toFixed(1)}% Metallic Scrap`,
          targetBenchmarkMetric: `8.8% Target Scrap`,
          affectedCostBaseUsd: Math.round(totalRmUsd),
          annualSavings,
          implCost,
        })
      );
    }

    // Vector 2: Excessive Energy Consumption
    if (prod.energyExcessPct > 10.0) {
      const recoverableShare = Math.min(0.24, (prod.energyExcessPct / (100 + prod.energyExcessPct)) * 0.82);
      const annualSavings = Math.round(totalEnergyUsd * recoverableShare);
      const implCost = Math.round(annualSavings * 0.55); // Waste heat recuperator + VFD drives
      rawRecs.push(
        buildRecommendation({
          code: `OPT-EN-${prod.productId}`,
          title: `Furnace Waste-Heat Recuperation & VFD Harmonic Retrofit (${prod.productionLine})`,
          category: 'Excessive Energy Consumption',
          prod,
          diagnosticSummary: `Specific energy consumption exceeds ISO 50001 thermodynamic baseline by +${prod.energyExcessPct.toFixed(1)}% across heat-treatment and arc bays.`,
          engineeringAction: `Install ceramic regenerative burner recuperators on stress-relieving kilns and Variable Frequency Drives (VFDs) on baghouse ID fans.`,
          currentBaselineMetric: `+${prod.energyExcessPct.toFixed(1)}% vs SEC Std`,
          targetBenchmarkMetric: `<= +2.5% SEC Variance`,
          affectedCostBaseUsd: Math.round(totalEnergyUsd),
          annualSavings,
          implCost,
        })
      );
    }

    // Vector 3: High Maintenance Expenditure
    const maintToLabourRatio = totalDlUsd > 0 ? (totalMaintUsd / totalDlUsd) * 100 : 0;
    if (maintToLabourRatio > 50.0) {
      const annualSavings = Math.round(totalMaintUsd * 0.26);
      const implCost = Math.round(annualSavings * 0.48); // Vibration & thermography CBM
      rawRecs.push(
        buildRecommendation({
          code: `OPT-MN-${prod.productId}`,
          title: `Predictive Vibration & Oil-Tribology Maintenance Program (${prod.productionLine})`,
          category: 'High Maintenance Expenditure',
          prod,
          diagnosticSummary: `Maintenance-to-Direct-Labour ratio reached ${maintToLabourRatio.toFixed(1)}% (threshold 45.0%) due to unplanned vertical borer spindle & crane gear failures.`,
          engineeringAction: `Transition from reactive breakdown repair to continuous piezoelectric vibration telemetry and automated lubrication on heavy CNC boring mills.`,
          currentBaselineMetric: `${maintToLabourRatio.toFixed(1)}% Maint/Labour`,
          targetBenchmarkMetric: `38.0% Maint/Labour`,
          affectedCostBaseUsd: Math.round(totalMaintUsd),
          annualSavings,
          implCost,
        })
      );
    }

    // Vector 4: Idle Machine Capacity
    if (prod.machineUtilisationPct < 74.0) {
      const idleGap = (80.0 - prod.machineUtilisationPct) / 100;
      const annualSavings = Math.round(totalOhUsd * idleGap * 0.55);
      const implCost = Math.round(annualSavings * 0.35); // SMED fixture tooling & subcontract consolidation
      rawRecs.push(
        buildRecommendation({
          code: `OPT-CAP-${prod.productId}`,
          title: `SMED Quick-Changeover Tooling & Bay Load Balancing (${prod.productionLine})`,
          category: 'Idle Machine Capacity',
          prod,
          diagnosticSummary: `Bay machine utilisation averaged ${prod.machineUtilisationPct.toFixed(1)}% (target >= 78.0%), leaving fixed depreciation and bay overheads unabsorbed.`,
          engineeringAction: `Implement Single-Minute Exchange of Die (SMED) modular welding positioners and consolidate inter-bay subcontracted machining jobs onto ${prod.productionLine}.`,
          currentBaselineMetric: `${prod.machineUtilisationPct.toFixed(1)}% OEE Utilisation`,
          targetBenchmarkMetric: `80.0% Target Utilisation`,
          affectedCostBaseUsd: Math.round(totalOhUsd),
          annualSavings,
          implCost,
        })
      );
    }

    // Vector 5: Inventory Holding Inefficiencies
    const invToRmRatio = totalRmUsd > 0 ? (totalInvUsd / totalRmUsd) * 100 : 0;
    if (invToRmRatio > 10.5) {
      const annualSavings = Math.round(totalInvUsd * 0.29);
      const implCost = Math.round(annualSavings * 0.31); // Vendor-managed consignment stock
      rawRecs.push(
        buildRecommendation({
          code: `OPT-INV-${prod.productId}`,
          title: `JIT Mill-Direct Steel Consignment & WIP Buffer Compression (${prod.productName})`,
          category: 'Inventory Inefficiencies',
          prod,
          diagnosticSummary: `Inventory holding cost is ${invToRmRatio.toFixed(1)}% of raw material spend (benchmark <= 9.0%) due to slow-moving specialty plate and sub-assembly queues.`,
          engineeringAction: `Convert high-alloy boiler/skid plates to Vendor-Managed Inventory (VMI) consignment and synchronize sub-assembly takt times to cut WIP dwell by 18 days.`,
          currentBaselineMetric: `${invToRmRatio.toFixed(1)}% Holding/RM`,
          targetBenchmarkMetric: `8.5% Holding/RM`,
          affectedCostBaseUsd: Math.round(totalInvUsd),
          annualSavings,
          implCost,
        })
      );
    }

    // Vector 6: Abnormal Production Cost Overruns (Budget Variance / Loss-Making Re-engineering)
    if (prod.budgetVariancePct > 7.5 || prod.grossMarginPct < 10.0) {
      const annualSavings = Math.round(Math.max(totalBudgetVarUsd * 0.62, prod.totalCost * annualMultiplier * 0.045));
      const implCost = Math.round(annualSavings * 0.52);
      rawRecs.push(
        buildRecommendation({
          code: `OPT-ABN-${prod.productId}`,
          title: `Value Engineering (VAVE) & Sub-Assembly Standardization (${prod.productName})`,
          category: 'Abnormal Production Costs',
          prod,
          diagnosticSummary: `Actual unit cost ($${Math.round(prod.costPerUnit).toLocaleString()}) exceeds budget by +${prod.budgetVariancePct.toFixed(1)}%, compressing gross margin to ${prod.grossMarginPct.toFixed(1)}%.`,
          engineeringAction: `Execute Value Analysis / Value Engineering (VAVE) on structural frames, standardize weld-neck flange tolerances, and renegotiate heavy-haulage multi-axle freight contracts.`,
          currentBaselineMetric: `+${prod.budgetVariancePct.toFixed(1)}% Over Budget`,
          targetBenchmarkMetric: `<= +1.5% Budget Tol.`,
          affectedCostBaseUsd: Math.round(prod.totalCost * annualMultiplier),
          annualSavings,
          implCost,
        })
      );
    }
  }

  // Sort recommendations by Estimated Annual Savings descending and assign rank
  const recommendations: CostRecommendation[] = rawRecs
    .sort((a, b) => b.estimatedAnnualSavingsUsd - a.estimatedAnnualSavingsUsd)
    .map((r, idx) => ({
      ...r,
      rank: idx + 1,
    }));

  // Summarize by the 6 required categories
  const allCategories: InefficiencyCategory[] = [
    'Raw Material Wastage',
    'Excessive Energy Consumption',
    'High Maintenance Expenditure',
    'Idle Machine Capacity',
    'Inventory Inefficiencies',
    'Abnormal Production Costs',
  ];

  const categorySummary = allCategories.map((cat) => {
    const matchingRecs = recommendations.filter((r) => r.category === cat);
    const totalSav = matchingRecs.reduce((s, r) => s + r.estimatedAnnualSavingsUsd, 0);
    const totalExcess = Math.round(totalSav / 0.72);
    return {
      category: cat,
      totalExcessCostUsd: totalExcess,
      recoverableAnnualSavingsUsd: totalSav,
      incidentCount: matchingRecs.length,
    };
  });

  return { recommendations, anomalies, categorySummary };
}

function buildRecommendation(params: {
  code: string;
  title: string;
  category: InefficiencyCategory;
  prod: ProductProfitabilityRow;
  diagnosticSummary: string;
  engineeringAction: string;
  currentBaselineMetric: string;
  targetBenchmarkMetric: string;
  affectedCostBaseUsd: number;
  annualSavings: number;
  implCost: number;
}): Omit<CostRecommendation, 'rank'> {
  const {
    code,
    title,
    category,
    prod,
    diagnosticSummary,
    engineeringAction,
    currentBaselineMetric,
    targetBenchmarkMetric,
    affectedCostBaseUsd,
    annualSavings,
    implCost,
  } = params;

  const paybackPeriodMonths =
    annualSavings > 0 ? Number(((implCost / annualSavings) * 12).toFixed(1)) : 0;

  // 3-Year NPV at 10% WACC: -ImplCost + sum_{t=1..3} AnnualSavings / (1.10)^t
  // Annuity factor for 3 years at 10% = 2.48685
  const threeYearNpvUsd = Math.round(annualSavings * 2.48685 - implCost);

  // Approximate 3-Year IRR %
  const ratio = implCost > 0 ? annualSavings / implCost : 1;
  const irrPct = Number(Math.min(185, Math.max(18, (ratio - 0.33) * 78)).toFixed(1));

  let priority: 'Critical' | 'High' | 'Medium' = 'Medium';
  if (annualSavings >= 450000 || prod.grossMarginPct < 0 || paybackPeriodMonths <= 5.5) {
    priority = 'Critical';
  } else if (annualSavings >= 220000 || paybackPeriodMonths <= 6.8) {
    priority = 'High';
  }

  return {
    code,
    title,
    category,
    plantId: prod.plantId,
    plantName: prod.plantName,
    productId: prod.productId,
    productName: prod.productName,
    productionLine: prod.productionLine,
    diagnosticSummary,
    engineeringAction,
    currentBaselineMetric,
    targetBenchmarkMetric,
    affectedCostBaseUsd,
    estimatedAnnualSavingsUsd: annualSavings,
    implementationCostUsd: implCost,
    paybackPeriodMonths,
    threeYearNpvUsd,
    irrPct,
    priority,
  };
}

// ============================================================================
// MODULE 5: SCENARIO SIMULATOR (MULTI-VARIABLE ELASTICITY & CVP ENGINE)
// ============================================================================

export interface ScenarioParameters {
  rawMaterialDeltaPct: number; // -50 to +100
  energyDeltaPct: number; // -50 to +100
  volumeDeltaPct: number; // -50 to +100
  labourDeltaPct: number; // -50 to +100
  utilisationTargetPct: number; // 40 to 96
  sellingPriceDeltaPct: number; // -50 to +100
}

export interface ScenarioComparisonResult {
  baseline: ExecutiveKPIs;
  simulated: ExecutiveKPIs;
  deltas: {
    revenueDeltaUsd: number;
    revenueDeltaPct: number;
    totalCostDeltaUsd: number;
    totalCostDeltaPct: number;
    grossProfitDeltaUsd: number;
    grossProfitDeltaPct: number;
    grossMarginDeltaPts: number;
    costPerUnitDeltaUsd: number;
    breakEvenRevenueDeltaUsd: number;
  };
  waterfallBridge: Array<{
    step: string;
    valueUsd: number;
    measure: 'absolute' | 'relative' | 'total';
  }>;
  simulatedProducts: Array<{
    productId: string;
    productName: string;
    sector: SectorType;
    baselineMarginPct: number;
    simulatedMarginPct: number;
    baselineProfitUsd: number;
    simulatedProfitUsd: number;
    profitDeltaUsd: number;
  }>;
  tornadoSensitivity: Array<{
    lever: string;
    downside10PctProfitImpactUsd: number;
    upside10PctProfitImpactUsd: number;
  }>;
}

export function runScenarioSimulation(
  records: ProductionRecordItem[],
  params: ScenarioParameters
): ScenarioComparisonResult {
  const baseline = computeExecutiveKPIs(records);

  const volMult = Math.max(0.1, 1 + params.volumeDeltaPct / 100);
  const priceMult = Math.max(0.1, 1 + params.sellingPriceDeltaPct / 100);
  const rmMult = Math.max(0.1, 1 + params.rawMaterialDeltaPct / 100);
  const enMult = Math.max(0.1, 1 + params.energyDeltaPct / 100);
  const dlMult = Math.max(0.1, 1 + params.labourDeltaPct / 100);

  // Utilisation efficiency effect on overhead absorption and base energy waste
  const baselineUtil = baseline.avgMachineUtilisationPct || 76.0;
  const utilDeltaRatio = (params.utilisationTargetPct - baselineUtil) / 100;
  // Higher machine utilisation reduces idle transformer/furnace standby energy and compresses unit maintenance/overhead
  const utilEnergyFactor = Math.max(0.82, 1 - utilDeltaRatio * 0.25);
  const utilOverheadFactor = Math.max(0.84, 1 - utilDeltaRatio * 0.35);

  const simulatedRecords: ProductionRecordItem[] = records.map((r) => {
    const simUnits = Math.max(0.25, r.unitsProduced * volMult);
    const simPrice = r.sellingPricePerUnit * priceMult;
    const simRevenue = simUnits * simPrice;

    // Variable costs scale with volume & respective rate multipliers
    const simRm = r.rawMaterialCost * volMult * rmMult;
    const simDl = r.directLabourCost * volMult * dlMult;
    const simEn = r.energyCost * volMult * enMult * utilEnergyFactor;
    const simLg = r.logisticsCost * volMult;

    // Maintenance is 40% variable with volume, 60% fixed (improved by higher OEE stability)
    const simMn =
      r.maintenanceCost * (0.4 * volMult + 0.6 * Math.max(0.85, 1 - utilDeltaRatio * 0.2));

    // Inventory holding scales partially with volume & raw material price
    const simIh = r.inventoryHoldingCost * (0.5 + 0.5 * volMult * rmMult);

    // Overheads are fixed up to +25% volume step function, modulated by utilisation factor
    const stepCapacityFactor = volMult > 1.25 ? 1 + (volMult - 1.25) * 0.45 : 1.0;
    const simOh = r.overheadCost * stepCapacityFactor * utilOverheadFactor;

    const simHoursUsed = Math.min(
      r.machineHoursAvailable,
      r.machineHoursAvailable * (params.utilisationTargetPct / 100)
    );

    return {
      ...r,
      unitsProduced: simUnits,
      sellingPricePerUnit: simPrice,
      revenue: simRevenue,
      rawMaterialCost: simRm,
      directLabourCost: simDl,
      energyCost: simEn,
      maintenanceCost: simMn,
      logisticsCost: simLg,
      inventoryHoldingCost: simIh,
      overheadCost: simOh,
      machineHoursUsed: simHoursUsed,
    };
  });

  const simulated = computeExecutiveKPIs(simulatedRecords);

  const revenueDeltaUsd = simulated.totalRevenue - baseline.totalRevenue;
  const revenueDeltaPct =
    baseline.totalRevenue > 0 ? (revenueDeltaUsd / baseline.totalRevenue) * 100 : 0;

  const totalCostDeltaUsd = simulated.totalProductionCost - baseline.totalProductionCost;
  const totalCostDeltaPct =
    baseline.totalProductionCost > 0
      ? (totalCostDeltaUsd / baseline.totalProductionCost) * 100
      : 0;

  const grossProfitDeltaUsd = simulated.grossProfit - baseline.grossProfit;
  const grossProfitDeltaPct =
    Math.abs(baseline.grossProfit) > 0
      ? (grossProfitDeltaUsd / Math.abs(baseline.grossProfit)) * 100
      : 0;

  const grossMarginDeltaPts = simulated.grossMarginPct - baseline.grossMarginPct;
  const costPerUnitDeltaUsd = simulated.costPerUnit - baseline.costPerUnit;
  const breakEvenRevenueDeltaUsd =
    simulated.breakEvenRevenueUsd - baseline.breakEvenRevenueUsd;

  // Compute exact Profit Bridge components for Waterfall Chart
  const baseBreakdown = computeCostCategoryBreakdown(records);
  const simBreakdown = computeCostCategoryBreakdown(simulatedRecords);
  const getCatUsd = (arr: CostCategoryBreakdown[], key: string) =>
    arr.find((c) => c.key === key)?.totalUsd || 0;

  const rmEffect = -(getCatUsd(simBreakdown, 'rawMaterialCost') - getCatUsd(baseBreakdown, 'rawMaterialCost'));
  const dlEffect = -(getCatUsd(simBreakdown, 'directLabourCost') - getCatUsd(baseBreakdown, 'directLabourCost'));
  const enEffect = -(getCatUsd(simBreakdown, 'energyCost') - getCatUsd(baseBreakdown, 'energyCost'));
  const otherCostEffect =
    -(simulated.totalProductionCost - baseline.totalProductionCost) -
    (rmEffect + dlEffect + enEffect);

  const waterfallBridge: ScenarioComparisonResult['waterfallBridge'] = [
    { step: 'Baseline Profit', valueUsd: Math.round(baseline.grossProfit), measure: 'absolute' },
    { step: 'Volume & Price Effect', valueUsd: Math.round(revenueDeltaUsd), measure: 'relative' },
    { step: 'Raw Material Impact', valueUsd: Math.round(rmEffect), measure: 'relative' },
    { step: 'Labour Cost Impact', valueUsd: Math.round(dlEffect), measure: 'relative' },
    { step: 'Energy & Tariff Impact', valueUsd: Math.round(enEffect), measure: 'relative' },
    { step: 'Utilisation & Overhead', valueUsd: Math.round(otherCostEffect), measure: 'relative' },
    { step: 'Simulated Profit', valueUsd: Math.round(simulated.grossProfit), measure: 'total' },
  ];

  // Product-by-product comparison
  const baseProds = computeProductProfitability(records);
  const simProds = computeProductProfitability(simulatedRecords);
  const simulatedProducts = baseProds.map((bp) => {
    const sp = simProds.find((p) => p.productId === bp.productId) || bp;
    return {
      productId: bp.productId,
      productName: bp.productName,
      sector: bp.sector,
      baselineMarginPct: bp.grossMarginPct,
      simulatedMarginPct: sp.grossMarginPct,
      baselineProfitUsd: bp.grossProfit,
      simulatedProfitUsd: sp.grossProfit,
      profitDeltaUsd: sp.grossProfit - bp.grossProfit,
    };
  });

  // Tornado Sensitivity: +/- 10% ceteris paribus impact of each lever on Gross Profit
  const baseRmTotal = getCatUsd(baseBreakdown, 'rawMaterialCost');
  const baseDlTotal = getCatUsd(baseBreakdown, 'directLabourCost');
  const baseEnTotal = getCatUsd(baseBreakdown, 'energyCost');

  const tornadoSensitivity: ScenarioComparisonResult['tornadoSensitivity'] = [
    {
      lever: 'Selling Price (±10%)',
      downside10PctProfitImpactUsd: Math.round(-0.1 * baseline.totalRevenue),
      upside10PctProfitImpactUsd: Math.round(0.1 * baseline.totalRevenue),
    },
    {
      lever: 'Raw Material Price (±10%)',
      downside10PctProfitImpactUsd: Math.round(-0.1 * baseRmTotal),
      upside10PctProfitImpactUsd: Math.round(0.1 * baseRmTotal),
    },
    {
      lever: 'Production Volume (±10%)',
      downside10PctProfitImpactUsd: Math.round(-0.1 * baseline.contributionMargin),
      upside10PctProfitImpactUsd: Math.round(0.1 * baseline.contributionMargin),
    },
    {
      lever: 'Direct Labour Rate (±10%)',
      downside10PctProfitImpactUsd: Math.round(-0.1 * baseDlTotal),
      upside10PctProfitImpactUsd: Math.round(0.1 * baseDlTotal),
    },
    {
      lever: 'Energy Tariff (±10%)',
      downside10PctProfitImpactUsd: Math.round(-0.1 * baseEnTotal),
      upside10PctProfitImpactUsd: Math.round(0.1 * baseEnTotal),
    },
  ];

  return {
    baseline,
    simulated,
    deltas: {
      revenueDeltaUsd,
      revenueDeltaPct,
      totalCostDeltaUsd,
      totalCostDeltaPct,
      grossProfitDeltaUsd,
      grossProfitDeltaPct,
      grossMarginDeltaPts,
      costPerUnitDeltaUsd,
      breakEvenRevenueDeltaUsd,
    },
    waterfallBridge,
    simulatedProducts,
    tornadoSensitivity,
  };
}

export const KPI_FORMULA_REGISTRY = [
  {
    kpi: 'Total Production Cost',
    symbol: 'C_total',
    formula: 'Σ (C_RM + C_DL + C_EN + C_MN + C_LG + C_IH + C_OH)',
    unit: 'USD / INR',
    module: 'Executive Overview & Cost Breakdown',
  },
  {
    kpi: 'Gross Profit & Gross Margin %',
    symbol: 'GP / GM%',
    formula: 'GP = Revenue - C_total  |  GM% = ((Revenue - C_total) / Revenue) × 100',
    unit: 'USD & %',
    module: 'Executive Overview & Profitability',
  },
  {
    kpi: 'Cost Per Unit Produced',
    symbol: 'CPU',
    formula: 'CPU = C_total / Σ (Units_Produced)',
    unit: 'USD / Unit',
    module: 'Executive Overview',
  },
  {
    kpi: 'Budget Variance ($ & %)',
    symbol: 'ΔB / ΔB%',
    formula: 'ΔB = C_actual - C_budget  |  ΔB% = ((C_actual - C_budget) / C_budget) × 100',
    unit: 'USD & %',
    module: 'Executive Overview',
  },
  {
    kpi: 'Contribution Margin & CMR',
    symbol: 'CM / CMR',
    formula: 'CM = Revenue - C_var  |  CMR = CM / Revenue  (where C_var = C_RM + C_DL + C_EN + C_LG + 0.4·C_MN)',
    unit: 'USD & Ratio',
    module: 'Profitability & CVP Analysis',
  },
  {
    kpi: 'Break-Even Revenue & Units',
    symbol: 'BEP',
    formula: 'BEP_Rev = C_fix / CMR  |  BEP_Units = C_fix / (P_unit - VC_unit)',
    unit: 'USD & Units',
    module: 'Profitability & CVP Analysis',
  },
  {
    kpi: 'Margin of Safety %',
    symbol: 'MoS%',
    formula: 'MoS% = ((Actual_Revenue - BEP_Rev) / Actual_Revenue) × 100',
    unit: '%',
    module: 'Profitability & CVP Analysis',
  },
  {
    kpi: 'Degree of Operating Leverage',
    symbol: 'DOL',
    formula: 'DOL = Contribution_Margin / Gross_Profit',
    unit: 'Multiplier (x)',
    module: 'Profitability & CVP Analysis',
  },
  {
    kpi: 'Payback Period & 3-Yr NPV',
    symbol: 'Payback / NPV',
    formula: 'Payback (Mo) = (Impl_Cost / Annual_Savings) × 12  |  NPV = Σ [Savings / (1 + 0.10)^t] - Impl_Cost',
    unit: 'Months & USD',
    module: 'Cost Optimisation Engine',
  },
];
