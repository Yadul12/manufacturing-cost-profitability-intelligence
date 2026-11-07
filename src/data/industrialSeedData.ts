export type SectorType =
  | 'Cement Systems'
  | 'Sugar Processing'
  | 'Mining & Material Handling'
  | 'Thermal Energy';

export interface ProductionRecordItem {
  id: string;
  ownerId: string;
  month: string; // YYYY-MM
  plantId: string;
  plantName: string;
  sector: SectorType;
  productId: string;
  productName: string;
  productionLine: string;
  unitsProduced: number;
  sellingPricePerUnit: number;
  revenue: number;
  budgetedCost: number;
  rawMaterialCost: number;
  directLabourCost: number;
  energyCost: number;
  maintenanceCost: number;
  logisticsCost: number;
  inventoryHoldingCost: number;
  overheadCost: number;
  machineHoursAvailable: number;
  machineHoursUsed: number;
  rawMaterialInputTons: number;
  rawMaterialNetTons: number;
  energyKwhConsumed: number;
  benchmarkEnergyKwhPerUnit: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavedScenarioItem {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  targetSector: string;
  rawMaterialDeltaPct: number;
  energyDeltaPct: number;
  volumeDeltaPct: number;
  labourDeltaPct: number;
  utilisationTargetPct: number;
  sellingPriceDeltaPct: number;
  projectedGrossMarginPct: number;
  projectedAnnualSavingsUsd: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OptimisationStatusItem {
  id: string;
  ownerId: string;
  recommendationCode: string;
  status: 'Proposed' | 'Approved' | 'In Progress' | 'Implemented';
  ownerNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PlantMetadata {
  plantId: string;
  plantName: string;
  location: string;
  primarySectors: SectorType[];
  annualCapacityTons: number;
  isoCertifications: string;
}

export const PLANTS_CATALOG: PlantMetadata[] = [
  {
    plantId: 'PLT-PUN-01',
    plantName: 'Pune Heavy Engineering & Boilers Complex',
    location: 'Pimpri-Chinchwad, Maharashtra',
    primarySectors: ['Thermal Energy', 'Sugar Processing'],
    annualCapacityTons: 48000,
    isoCertifications: 'ISO 9001 · ASME U/S Stamp · ISO 50001',
  },
  {
    plantId: 'PLT-HYD-02',
    plantName: 'Hyderabad Mineral & Material Handling Works',
    location: 'Medchal, Telangana',
    primarySectors: ['Mining & Material Handling'],
    annualCapacityTons: 42000,
    isoCertifications: 'ISO 9001 · ISO 14001 · DIN EN 1090',
  },
  {
    plantId: 'PLT-NGP-03',
    plantName: 'Nagpur Integrated Cement & Kiln Systems Plant',
    location: 'Butibori MIDC, Maharashtra',
    primarySectors: ['Cement Systems'],
    annualCapacityTons: 55000,
    isoCertifications: 'ISO 9001 · ISO 45001 · EN 13445',
  },
  {
    plantId: 'PLT-BLR-04',
    plantName: 'Bengaluru Precision Drives & Process Skids Foundry',
    location: 'Peenya Industrial Area, Karnataka',
    primarySectors: ['Sugar Processing', 'Thermal Energy'],
    annualCapacityTons: 31000,
    isoCertifications: 'ISO 9001 · AGMA 2001 · ISO 50001',
  },
];

export interface ProductSpecification {
  productId: string;
  productName: string;
  sector: SectorType;
  plantId: string;
  plantName: string;
  productionLine: string;
  baseMonthlyUnits: number;
  sellingPricePerUnit: number;
  budgetedUnitCost: number;
  // Base cost structure per unit (USD)
  baseRawMaterialUnit: number;
  baseDirectLabourUnit: number;
  baseEnergyUnit: number;
  baseMaintenanceUnit: number;
  baseLogisticsUnit: number;
  baseInventoryUnit: number;
  baseOverheadUnit: number;
  // Operational telemetry baselines
  machineHoursAvailable: number;
  baseUtilisationRatio: number;
  netWeightTonsPerUnit: number;
  baseScrapRatePct: number;
  benchmarkEnergyKwhPerUnit: number;
  actualEnergyMultiplier: number;
}

export const PRODUCTS_CATALOG: ProductSpecification[] = [
  {
    productId: 'PRD-CEM-101',
    productName: '5000 TPD Rotary Kiln & Preheater Assembly',
    sector: 'Cement Systems',
    plantId: 'PLT-NGP-03',
    plantName: 'Nagpur Integrated Cement & Kiln Systems Plant',
    productionLine: 'BAY-KILN-A1',
    baseMonthlyUnits: 4,
    sellingPricePerUnit: 685000,
    budgetedUnitCost: 495000,
    baseRawMaterialUnit: 248000,
    baseDirectLabourUnit: 64000,
    baseEnergyUnit: 46000,
    baseMaintenanceUnit: 29000,
    baseLogisticsUnit: 38000,
    baseInventoryUnit: 22000,
    baseOverheadUnit: 54000,
    machineHoursAvailable: 720,
    baseUtilisationRatio: 0.86,
    netWeightTonsPerUnit: 145,
    baseScrapRatePct: 8.4,
    benchmarkEnergyKwhPerUnit: 285000,
    actualEnergyMultiplier: 1.03,
  },
  {
    productId: 'PRD-CEM-102',
    productName: 'VRMS-42 Vertical Roller Grinding Mill',
    sector: 'Cement Systems',
    plantId: 'PLT-NGP-03',
    plantName: 'Nagpur Integrated Cement & Kiln Systems Plant',
    productionLine: 'BAY-VRM-B2',
    baseMonthlyUnits: 5,
    sellingPricePerUnit: 520000,
    budgetedUnitCost: 398000,
    baseRawMaterialUnit: 196000,
    baseDirectLabourUnit: 52000,
    baseEnergyUnit: 41000,
    baseMaintenanceUnit: 27000,
    baseLogisticsUnit: 29000,
    baseInventoryUnit: 19000,
    baseOverheadUnit: 42000,
    machineHoursAvailable: 720,
    baseUtilisationRatio: 0.81,
    netWeightTonsPerUnit: 112,
    baseScrapRatePct: 9.8,
    benchmarkEnergyKwhPerUnit: 240000,
    actualEnergyMultiplier: 1.08,
  },
  {
    productId: 'PRD-SUG-201',
    productName: '8000 TCD Diffuser & Tandem Mill System',
    sector: 'Sugar Processing',
    plantId: 'PLT-PUN-01',
    plantName: 'Pune Heavy Engineering & Boilers Complex',
    productionLine: 'BAY-SUG-C1',
    baseMonthlyUnits: 6,
    sellingPricePerUnit: 410000,
    budgetedUnitCost: 328000,
    baseRawMaterialUnit: 162000,
    baseDirectLabourUnit: 46000,
    baseEnergyUnit: 31000,
    baseMaintenanceUnit: 23000,
    baseLogisticsUnit: 24000,
    baseInventoryUnit: 16000,
    baseOverheadUnit: 33000,
    machineHoursAvailable: 680,
    baseUtilisationRatio: 0.79,
    netWeightTonsPerUnit: 88,
    baseScrapRatePct: 10.2,
    benchmarkEnergyKwhPerUnit: 190000,
    actualEnergyMultiplier: 1.06,
  },
  {
    // LOW-MARGIN PRODUCT (~5.4% Gross Margin due to high SS-316L plate scrap & high WIP inventory holding)
    productId: 'PRD-SUG-202',
    productName: 'Continuous Vacuum Pan & Centrifugal Skid',
    sector: 'Sugar Processing',
    plantId: 'PLT-BLR-04',
    plantName: 'Bengaluru Precision Drives & Process Skids Foundry',
    productionLine: 'BAY-SKID-D1',
    baseMonthlyUnits: 8,
    sellingPricePerUnit: 235000,
    budgetedUnitCost: 204000,
    baseRawMaterialUnit: 109000,
    baseDirectLabourUnit: 31000,
    baseEnergyUnit: 19500,
    baseMaintenanceUnit: 15500,
    baseLogisticsUnit: 13500,
    baseInventoryUnit: 14500, // Excessive WIP holding
    baseOverheadUnit: 19200,
    machineHoursAvailable: 640,
    baseUtilisationRatio: 0.67, // Under-utilized bay
    netWeightTonsPerUnit: 42,
    baseScrapRatePct: 14.9, // High stainless steel nesting wastage
    benchmarkEnergyKwhPerUnit: 110000,
    actualEnergyMultiplier: 1.16,
  },
  {
    productId: 'PRD-MIN-301',
    productName: '2400 TPH Bucket Wheel Stacker-Reclaimer',
    sector: 'Mining & Material Handling',
    plantId: 'PLT-HYD-02',
    plantName: 'Hyderabad Mineral & Material Handling Works',
    productionLine: 'BAY-MHS-E1',
    baseMonthlyUnits: 3,
    sellingPricePerUnit: 920000,
    budgetedUnitCost: 685000,
    baseRawMaterialUnit: 338000,
    baseDirectLabourUnit: 89000,
    baseEnergyUnit: 58000,
    baseMaintenanceUnit: 41000,
    baseLogisticsUnit: 56000,
    baseInventoryUnit: 31000,
    baseOverheadUnit: 76000,
    machineHoursAvailable: 720,
    baseUtilisationRatio: 0.84,
    netWeightTonsPerUnit: 210,
    baseScrapRatePct: 9.1,
    benchmarkEnergyKwhPerUnit: 360000,
    actualEnergyMultiplier: 1.04,
  },
  {
    // LOSS-MAKING PRODUCT (~ -4.9% Gross Margin due to manganese casting scrap, arc furnace energy spike, & breakdown maintenance)
    productId: 'PRD-MIN-302',
    productName: 'Primary Gyratory Crusher & Apron Feeder',
    sector: 'Mining & Material Handling',
    plantId: 'PLT-HYD-02',
    plantName: 'Hyderabad Mineral & Material Handling Works',
    productionLine: 'BAY-CRUSH-E2',
    baseMonthlyUnits: 4,
    sellingPricePerUnit: 480000,
    budgetedUnitCost: 432000,
    baseRawMaterialUnit: 246000, // Manganese steel casting overrun
    baseDirectLabourUnit: 64000,
    baseEnergyUnit: 54000, // Excessive heat-treatment furnace draw
    baseMaintenanceUnit: 43000, // Heavy CNC vertical borer breakdowns
    baseLogisticsUnit: 31000,
    baseInventoryUnit: 23000,
    baseOverheadUnit: 42500,
    machineHoursAvailable: 720,
    baseUtilisationRatio: 0.58, // High idle capacity due to unplanned maintenance downtime
    netWeightTonsPerUnit: 118,
    baseScrapRatePct: 17.4, // Severe casting riser/machining scrap
    benchmarkEnergyKwhPerUnit: 255000,
    actualEnergyMultiplier: 1.34, // 34% above thermodynamic benchmark
  },
  {
    productId: 'PRD-THM-401',
    productName: '120 TPH CFBC Biomass & Coal Thermal Boiler',
    sector: 'Thermal Energy',
    plantId: 'PLT-PUN-01',
    plantName: 'Pune Heavy Engineering & Boilers Complex',
    productionLine: 'BAY-BOILER-F1',
    baseMonthlyUnits: 4,
    sellingPricePerUnit: 840000,
    budgetedUnitCost: 598000,
    baseRawMaterialUnit: 294000,
    baseDirectLabourUnit: 78000,
    baseEnergyUnit: 52000,
    baseMaintenanceUnit: 34000,
    baseLogisticsUnit: 45000,
    baseInventoryUnit: 27000,
    baseOverheadUnit: 72000,
    machineHoursAvailable: 720,
    baseUtilisationRatio: 0.88,
    netWeightTonsPerUnit: 175,
    baseScrapRatePct: 7.8,
    benchmarkEnergyKwhPerUnit: 320000,
    actualEnergyMultiplier: 1.02,
  },
  {
    // LOW-MARGIN PRODUCT (~8.8% Gross Margin due to high logistics & plate warpage rework)
    productId: 'PRD-THM-402',
    productName: 'Flue Gas Desulphurisation & ESP Module',
    sector: 'Thermal Energy',
    plantId: 'PLT-BLR-04',
    plantName: 'Bengaluru Precision Drives & Process Skids Foundry',
    productionLine: 'BAY-ESP-F2',
    baseMonthlyUnits: 5,
    sellingPricePerUnit: 360000,
    budgetedUnitCost: 308000,
    baseRawMaterialUnit: 158000,
    baseDirectLabourUnit: 44000,
    baseEnergyUnit: 29000,
    baseMaintenanceUnit: 24000,
    baseLogisticsUnit: 28500,
    baseInventoryUnit: 17500,
    baseOverheadUnit: 27000,
    machineHoursAvailable: 680,
    baseUtilisationRatio: 0.71,
    netWeightTonsPerUnit: 76,
    baseScrapRatePct: 13.1,
    benchmarkEnergyKwhPerUnit: 175000,
    actualEnergyMultiplier: 1.19,
  },
];

export const MONTHS_12_HISTORY = [
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
];

// Deterministic seasonal & commodity cycle multipliers across the 12 months
const MONTHLY_FACTORS: Record<
  string,
  {
    steelIndex: number;
    energyTariffIndex: number;
    volumeMultiplier: number;
    maintenanceSpike: number;
  }
> = {
  '2025-11': { steelIndex: 0.97, energyTariffIndex: 0.96, volumeMultiplier: 1.0, maintenanceSpike: 0.95 },
  '2025-12': { steelIndex: 0.98, energyTariffIndex: 0.98, volumeMultiplier: 1.05, maintenanceSpike: 0.98 },
  '2026-01': { steelIndex: 1.00, energyTariffIndex: 1.01, volumeMultiplier: 0.95, maintenanceSpike: 1.02 },
  '2026-02': { steelIndex: 1.02, energyTariffIndex: 1.00, volumeMultiplier: 1.0, maintenanceSpike: 1.00 },
  '2026-03': { steelIndex: 1.03, energyTariffIndex: 1.04, volumeMultiplier: 1.12, maintenanceSpike: 1.06 },
  '2026-04': { steelIndex: 1.05, energyTariffIndex: 1.08, volumeMultiplier: 0.92, maintenanceSpike: 1.14 },
  '2026-05': { steelIndex: 1.04, energyTariffIndex: 1.11, volumeMultiplier: 0.96, maintenanceSpike: 1.08 },
  '2026-06': { steelIndex: 1.01, energyTariffIndex: 1.06, volumeMultiplier: 1.02, maintenanceSpike: 1.01 },
  '2026-07': { steelIndex: 0.99, energyTariffIndex: 1.02, volumeMultiplier: 1.04, maintenanceSpike: 0.97 },
  '2026-08': { steelIndex: 1.01, energyTariffIndex: 1.03, volumeMultiplier: 1.00, maintenanceSpike: 1.04 },
  '2026-09': { steelIndex: 1.03, energyTariffIndex: 1.05, volumeMultiplier: 1.08, maintenanceSpike: 1.03 },
  '2026-10': { steelIndex: 1.02, energyTariffIndex: 1.04, volumeMultiplier: 1.06, maintenanceSpike: 1.00 },
};

/**
 * Generates the reproducible 96-record (12 months x 8 products) synthetic industrial dataset.
 */
export function generateSyntheticIndustrialDataset(ownerId = 'demo-user'): ProductionRecordItem[] {
  const records: ProductionRecordItem[] = [];

  MONTHS_12_HISTORY.forEach((month, mIdx) => {
    const factor = MONTHLY_FACTORS[month];

    PRODUCTS_CATALOG.forEach((spec, pIdx) => {
      // Deterministic slight variation per product-month
      const wave = 1 + Math.sin((mIdx + 1) * 0.7 + pIdx * 1.1) * 0.035;
      const unitsProduced = Math.max(
        1,
        Math.round(spec.baseMonthlyUnits * factor.volumeMultiplier * wave)
      );

      const sellingPricePerUnit = Math.round(spec.sellingPricePerUnit);
      const revenue = Math.round(unitsProduced * sellingPricePerUnit);
      const budgetedCost = Math.round(unitsProduced * spec.budgetedUnitCost);

      // Compute 7 cost categories with realistic operational dynamics
      const rawMaterialCost = Math.round(
        unitsProduced * spec.baseRawMaterialUnit * factor.steelIndex * wave
      );
      const directLabourCost = Math.round(
        unitsProduced * spec.baseDirectLabourUnit * (0.98 + 0.02 * wave)
      );
      const energyCost = Math.round(
        unitsProduced * spec.baseEnergyUnit * factor.energyTariffIndex * spec.actualEnergyMultiplier
      );

      // Inject an abnormal maintenance & energy outlier on PRD-MIN-302 in 2026-04 and 2026-08
      const isOutlierMonth =
        (spec.productId === 'PRD-MIN-302' && (month === '2026-04' || month === '2026-08')) ||
        (spec.productId === 'PRD-SUG-202' && month === '2026-05');
      const outlierPenalty = isOutlierMonth ? 1.28 : 1.0;

      const maintenanceCost = Math.round(
        unitsProduced * spec.baseMaintenanceUnit * factor.maintenanceSpike * outlierPenalty
      );
      const logisticsCost = Math.round(
        unitsProduced * spec.baseLogisticsUnit * (0.96 + 0.04 * factor.steelIndex)
      );
      const inventoryHoldingCost = Math.round(
        unitsProduced * spec.baseInventoryUnit * (isOutlierMonth ? 1.18 : 1.0)
      );
      // Overheads are largely semi-fixed per bay
      const overheadCost = Math.round(
        spec.baseMonthlyUnits * spec.baseOverheadUnit * (0.85 + 0.15 * (unitsProduced / spec.baseMonthlyUnits))
      );

      const machineHoursAvailable = spec.machineHoursAvailable;
      const utilisationRatio = Math.min(
        0.96,
        Math.max(
          0.45,
          spec.baseUtilisationRatio * (unitsProduced / spec.baseMonthlyUnits) * (isOutlierMonth ? 0.88 : 1.0)
        )
      );
      const machineHoursUsed = Math.round(machineHoursAvailable * utilisationRatio);

      const rawMaterialNetTons = Number((unitsProduced * spec.netWeightTonsPerUnit).toFixed(1));
      const scrapRatio = (spec.baseScrapRatePct / 100) * (isOutlierMonth ? 1.15 : 1.0);
      const rawMaterialInputTons = Number((rawMaterialNetTons / (1 - scrapRatio)).toFixed(1));

      const benchmarkEnergyKwhPerUnit = spec.benchmarkEnergyKwhPerUnit;
      const energyKwhConsumed = Math.round(
        unitsProduced *
          benchmarkEnergyKwhPerUnit *
          spec.actualEnergyMultiplier *
          (isOutlierMonth ? 1.12 : 1.0)
      );

      const recordId = `REC_${month}_${spec.productId}`;

      records.push({
        id: recordId,
        ownerId,
        month,
        plantId: spec.plantId,
        plantName: spec.plantName,
        sector: spec.sector,
        productId: spec.productId,
        productName: spec.productName,
        productionLine: spec.productionLine,
        unitsProduced,
        sellingPricePerUnit,
        revenue,
        budgetedCost,
        rawMaterialCost,
        directLabourCost,
        energyCost,
        maintenanceCost,
        logisticsCost,
        inventoryHoldingCost,
        overheadCost,
        machineHoursAvailable,
        machineHoursUsed,
        rawMaterialInputTons,
        rawMaterialNetTons,
        energyKwhConsumed,
        benchmarkEnergyKwhPerUnit,
      });
    });
  });

  return records;
}

export const DOCUMENTED_ASSUMPTIONS = [
  {
    code: 'ASM-01',
    category: 'Variable vs. Fixed Cost Decomposition',
    formula: 'C_var = C_RM + C_DL + C_EN + C_LG + 0.40 * C_MN; C_fix = C_OH + C_IH + 0.60 * C_MN',
    rationale:
      'In heavy industrial fabrication, 40% of machine maintenance scales with spindle/arc hours (consumables, tooling wear), while 60% represents scheduled statutory overhaul and calibration.',
  },
  {
    code: 'ASM-02',
    category: 'Metallurgical Scrap & Nesting Tolerance',
    formula: 'Scrap_% = ((Input_Tons - Net_Tons) / Input_Tons) * 100; Benchmark <= 11.5%',
    rationale:
      'CNC oxy-fuel/plasma plate nesting and casting riser allowances in heavy boiler and kiln shell fabrication have an engineering tolerance of 8.0%–11.5%. Rates above 11.5% signal nesting or foundry defects.',
  },
  {
    code: 'ASM-03',
    category: 'Specific Energy Consumption (SEC)',
    formula: 'SEC_Variance_% = ((Actual_kWh / Units) - Benchmark_kWh) / Benchmark_kWh * 100',
    rationale:
      'Benchmarked against ISO 50001 thermal stress-relieving furnace and submerged-arc welding curves. Deviations > 12% indicate furnace refractory heat loss, idle transformer draw, or low power factor.',
  },
  {
    code: 'ASM-04',
    category: 'Machine Capacity Absorption & OEE',
    formula: 'Utilisation_% = (Machine_Hours_Used / Machine_Hours_Available) * 100; Target >= 78.0%',
    rationale:
      'Heavy horizontal boring mills and rotary kiln shell rollers require >= 78% utilisation to fully absorb fixed depreciation and bay overheads.',
  },
  {
    code: 'ASM-05',
    category: 'Capital Budgeting & Payback Valuation',
    formula: 'Payback_Months = (Implementation_Cost / Annual_Savings) * 12; 3Yr_NPV @ 10% WACC',
    rationale:
      'Cost-optimisation initiatives are ranked by risk-adjusted ROI and payback period using a 10.0% industrial Weighted Average Cost of Capital (WACC).',
  },
];
