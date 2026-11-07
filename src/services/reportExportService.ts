import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ProductionRecordItem,
  DOCUMENTED_ASSUMPTIONS,
} from '../data/industrialSeedData';
import {
  ExecutiveKPIs,
  CostCategoryBreakdown,
  ProductProfitabilityRow,
  PlantProfitabilityRow,
  CostRecommendation,
  computeRecordMetrics,
} from '../engine/analyticsEngine';

export interface FullReportPayload {
  filterSummary: string;
  kpis: ExecutiveKPIs;
  costCategories: CostCategoryBreakdown[];
  productRows: ProductProfitabilityRow[];
  plantRows: PlantProfitabilityRow[];
  recommendations: CostRecommendation[];
  records: ProductionRecordItem[];
  statusMap: Record<string, { status: string; ownerNote: string }>;
}

/**
 * Generates and downloads a multi-sheet industrial financial & operations Excel workbook (.xlsx).
 */
export function exportToExcelWorkbook(payload: FullReportPayload) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive Summary & CVP KPIs
  const execData = [
    ['MANUFACTURING COST OPTIMISATION & PROFITABILITY INTELLIGENCE PLATFORM'],
    ['Report Scope / Active Filters:', payload.filterSummary],
    ['Generated Timestamp (UTC):', new Date().toISOString()],
    [],
    ['KPI Metric', 'Value', 'Unit', 'Documented Accounting Formula'],
    ['Total Production Cost', Math.round(payload.kpis.totalProductionCost), 'USD', 'Σ (C_RM + C_DL + C_EN + C_MN + C_LG + C_IH + C_OH)'],
    ['Total Realized Revenue', Math.round(payload.kpis.totalRevenue), 'USD', 'Σ (Units_Produced × Selling_Price_Per_Unit)'],
    ['Gross Profit', Math.round(payload.kpis.grossProfit), 'USD', 'Total_Revenue - Total_Production_Cost'],
    ['Gross Margin %', Number(payload.kpis.grossMarginPct.toFixed(2)), '%', '(Gross_Profit / Total_Revenue) × 100'],
    ['Cost Per Unit Produced', Math.round(payload.kpis.costPerUnit), 'USD/Unit', 'Total_Production_Cost / Σ Units_Produced'],
    ['Budgeted Production Cost', Math.round(payload.kpis.totalBudgetedCost), 'USD', 'Σ Standard_Budgeted_Cost'],
    ['Budget Variance ($)', Math.round(payload.kpis.budgetVarianceUsd), 'USD', 'Actual_Cost - Budgeted_Cost'],
    ['Budget Variance (%)', Number(payload.kpis.budgetVariancePct.toFixed(2)), '%', '((Actual_Cost - Budgeted_Cost) / Budgeted_Cost) × 100'],
    ['Contribution Margin ($)', Math.round(payload.kpis.contributionMargin), 'USD', 'Total_Revenue - Total_Variable_Cost'],
    ['Contribution Margin Ratio (%)', Number(payload.kpis.contributionMarginPct.toFixed(2)), '%', '(Contribution_Margin / Total_Revenue) × 100'],
    ['Break-Even Revenue', Math.round(payload.kpis.breakEvenRevenueUsd), 'USD', 'Total_Fixed_Cost / Contribution_Margin_Ratio'],
    ['Break-Even Volume', Number(payload.kpis.breakEvenUnits.toFixed(1)), 'Units', 'Total_Fixed_Cost / (Price_Per_Unit - Variable_Cost_Per_Unit)'],
    ['Margin of Safety (%)', Number(payload.kpis.marginOfSafetyPct.toFixed(2)), '%', '((Actual_Revenue - Break_Even_Revenue) / Actual_Revenue) × 100'],
    ['Degree of Operating Leverage', Number(payload.kpis.operatingLeverage.toFixed(2)), 'x', 'Contribution_Margin / Gross_Profit'],
    ['Average Machine Utilisation', Number(payload.kpis.avgMachineUtilisationPct.toFixed(2)), '%', '(Σ Machine_Hours_Used / Σ Machine_Hours_Available) × 100'],
    ['Average Metallic Scrap Rate', Number(payload.kpis.avgScrapRatePct.toFixed(2)), '%', '((Σ Input_Tons - Σ Net_Tons) / Σ Input_Tons) × 100'],
  ];
  const wsExec = XLSX.utils.aoa_to_sheet(execData);
  XLSX.utils.book_append_sheet(wb, wsExec, '1_Executive_KPIs');

  // Sheet 2: Manufacturing Cost Breakdown
  const catRows = payload.costCategories.map((c) => ({
    'Cost Code': c.code,
    'Cost Category': c.label,
    'Cost Behavior': c.nature,
    'Total Expenditure (USD)': Math.round(c.totalUsd),
    'Share of Total Cost (%)': Number(c.shareOfCostPct.toFixed(2)),
    'Share of Revenue (%)': Number(c.shareOfRevenuePct.toFixed(2)),
    'Cost Per Unit (USD)': Math.round(c.costPerUnitUsd),
  }));
  const wsCat = XLSX.utils.json_to_sheet(catRows);
  XLSX.utils.book_append_sheet(wb, wsCat, '2_Cost_Breakdown');

  // Sheet 3: Product Profitability & CVP Matrix
  const prodSheetRows = payload.productRows.map((p) => ({
    'Product ID': p.productId,
    'Product Name': p.productName,
    'Sector': p.sector,
    'Plant': p.plantName,
    'Production Line': p.productionLine,
    'Units Produced': p.unitsProduced,
    'Revenue (USD)': Math.round(p.revenue),
    'Total Cost (USD)': Math.round(p.totalCost),
    'Gross Profit (USD)': Math.round(p.grossProfit),
    'Gross Margin (%)': Number(p.grossMarginPct.toFixed(2)),
    'Contribution Margin (%)': Number(p.contributionMarginPct.toFixed(2)),
    'Cost Per Unit (USD)': Math.round(p.costPerUnit),
    'Break-Even Units': Number(p.breakEvenUnits.toFixed(1)),
    'Break-Even Revenue (USD)': Math.round(p.breakEvenRevenueUsd),
    'Margin of Safety (%)': Number(p.marginOfSafetyPct.toFixed(2)),
    'Scrap Rate (%)': Number(p.scrapRatePct.toFixed(2)),
    'Machine Utilisation (%)': Number(p.machineUtilisationPct.toFixed(1)),
    'Classification': p.marginTier,
  }));
  const wsProd = XLSX.utils.json_to_sheet(prodSheetRows);
  XLSX.utils.book_append_sheet(wb, wsProd, '3_Product_Profitability');

  // Sheet 4: Plant Comparison
  const plantSheetRows = payload.plantRows.map((pl) => ({
    'Plant ID': pl.plantId,
    'Plant Name': pl.plantName,
    'Units Produced': pl.unitsProduced,
    'Revenue (USD)': Math.round(pl.revenue),
    'Total Cost (USD)': Math.round(pl.totalCost),
    'Budgeted Cost (USD)': Math.round(pl.budgetedCost),
    'Budget Variance (USD)': Math.round(pl.budgetVarianceUsd),
    'Gross Profit (USD)': Math.round(pl.grossProfit),
    'Gross Margin (%)': Number(pl.grossMarginPct.toFixed(2)),
    'Machine Utilisation (%)': Number(pl.machineUtilisationPct.toFixed(1)),
    'Scrap Rate (%)': Number(pl.scrapRatePct.toFixed(1)),
  }));
  const wsPlant = XLSX.utils.json_to_sheet(plantSheetRows);
  XLSX.utils.book_append_sheet(wb, wsPlant, '4_Plant_Profitability');

  // Sheet 5: Cost Optimisation Recommendations
  const recSheetRows = payload.recommendations.map((r) => ({
    'Rank': r.rank,
    'Initiative Code': r.code,
    'Priority': r.priority,
    'Status': payload.statusMap[r.code]?.status || 'Proposed',
    'Inefficiency Vector': r.category,
    'Initiative Title': r.title,
    'Plant': r.plantName,
    'Product Line': r.productName,
    'Baseline Metric': r.currentBaselineMetric,
    'Target Benchmark': r.targetBenchmarkMetric,
    'Est. Annual Savings (USD)': r.estimatedAnnualSavingsUsd,
    'Implementation Cost (USD)': r.implementationCostUsd,
    'Payback Period (Months)': r.paybackPeriodMonths,
    '3-Yr NPV @ 10% WACC (USD)': r.threeYearNpvUsd,
    'Est. IRR (%)': r.irrPct,
    'Engineering Action Plan': r.engineeringAction,
    'Management Note': payload.statusMap[r.code]?.ownerNote || '',
  }));
  const wsRec = XLSX.utils.json_to_sheet(recSheetRows);
  XLSX.utils.book_append_sheet(wb, wsRec, '5_Optimisation_Roadmap');

  // Sheet 6: Granular Monthly Production Ledger
  const ledgerRows = payload.records.map((r) => {
    const m = computeRecordMetrics(r);
    return {
      'Record ID': r.id,
      'Month': r.month,
      'Plant ID': r.plantId,
      'Plant Name': r.plantName,
      'Sector': r.sector,
      'Product ID': r.productId,
      'Product Name': r.productName,
      'Line': r.productionLine,
      'Units': r.unitsProduced,
      'Revenue (USD)': r.revenue,
      'Budgeted Cost (USD)': r.budgetedCost,
      'Total Actual Cost (USD)': m.totalCost,
      'Gross Profit (USD)': m.grossProfit,
      'Gross Margin (%)': Number(m.grossMarginPct.toFixed(2)),
      'Raw Material (USD)': r.rawMaterialCost,
      'Direct Labour (USD)': r.directLabourCost,
      'Energy (USD)': r.energyCost,
      'Maintenance (USD)': r.maintenanceCost,
      'Logistics (USD)': r.logisticsCost,
      'Inventory Holding (USD)': r.inventoryHoldingCost,
      'Overheads (USD)': r.overheadCost,
      'Machine Util (%)': Number(m.machineUtilisationPct.toFixed(1)),
      'Scrap Rate (%)': Number(m.scrapRatePct.toFixed(1)),
    };
  });
  const wsLedger = XLSX.utils.json_to_sheet(ledgerRows);
  XLSX.utils.book_append_sheet(wb, wsLedger, '6_Monthly_Cost_Ledger');

  // Sheet 7: Documented Assumptions
  const wsAssump = XLSX.utils.json_to_sheet(DOCUMENTED_ASSUMPTIONS);
  XLSX.utils.book_append_sheet(wb, wsAssump, '7_Model_Assumptions');

  XLSX.writeFile(
    wb,
    `Manufacturing_Cost_Intelligence_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

/**
 * Generates and downloads an executive board-ready PDF report (.pdf).
 */
export function exportToExecutivePdf(payload: FullReportPayload) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 842, 68, 'F');
  doc.setTextColor(248, 250, 252);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(
    'MANUFACTURING COST OPTIMISATION & PROFITABILITY INTELLIGENCE REPORT',
    36,
    30
  );
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Scope: ${payload.filterSummary}   |   Generated: ${new Date().toISOString().slice(0, 16)} UTC   |   Database Records Analysed: ${payload.kpis.recordCount}`,
    36,
    48
  );

  // Section 1: Executive KPIs
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Executive Financial & Operational Summary', 36, 92);

  autoTable(doc, {
    startY: 100,
    margin: { left: 36, right: 36 },
    head: [
      [
        'Total Revenue',
        'Total Prod. Cost',
        'Gross Profit',
        'Gross Margin',
        'Cost / Unit',
        'Budget Variance',
        'Break-Even Rev.',
        'Margin of Safety',
        'Machine Util.',
      ],
    ],
    body: [
      [
        `$${Math.round(payload.kpis.totalRevenue).toLocaleString()}`,
        `$${Math.round(payload.kpis.totalProductionCost).toLocaleString()}`,
        `$${Math.round(payload.kpis.grossProfit).toLocaleString()}`,
        `${payload.kpis.grossMarginPct.toFixed(2)}%`,
        `$${Math.round(payload.kpis.costPerUnit).toLocaleString()}`,
        `$${Math.round(payload.kpis.budgetVarianceUsd).toLocaleString()} (${payload.kpis.budgetVariancePct >= 0 ? '+' : ''}${payload.kpis.budgetVariancePct.toFixed(1)}%)`,
        `$${Math.round(payload.kpis.breakEvenRevenueUsd).toLocaleString()}`,
        `${payload.kpis.marginOfSafetyPct.toFixed(1)}%`,
        `${payload.kpis.avgMachineUtilisationPct.toFixed(1)}%`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8.5, fontStyle: 'bold' },
  });

  // Section 2: 7-Category Cost Breakdown
  const afterKpiY = (doc as any).lastAutoTable.finalY + 18;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Manufacturing Cost Structure Breakdown (7 Core Categories)', 36, afterKpiY);

  autoTable(doc, {
    startY: afterKpiY + 6,
    margin: { left: 36, right: 36 },
    head: [
      [
        'Code',
        'Cost Category',
        'Behavior',
        'Total Spend (USD)',
        '% of Total Cost',
        '% of Revenue',
        'Cost / Unit (USD)',
      ],
    ],
    body: payload.costCategories.map((c) => [
      c.code,
      c.label,
      c.nature,
      `$${Math.round(c.totalUsd).toLocaleString()}`,
      `${c.shareOfCostPct.toFixed(2)}%`,
      `${c.shareOfRevenuePct.toFixed(2)}%`,
      `$${Math.round(c.costPerUnitUsd).toLocaleString()}`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
  });

  // Section 3: Product Profitability & CVP Matrix
  const afterCatY = (doc as any).lastAutoTable.finalY + 18;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Product-Wise Profitability & Break-Even Matrix', 36, afterCatY);

  autoTable(doc, {
    startY: afterCatY + 6,
    margin: { left: 36, right: 36 },
    head: [
      [
        'Product ID',
        'Product Line',
        'Sector',
        'Units',
        'Revenue',
        'Total Cost',
        'Gross Profit',
        'GM %',
        'CM %',
        'BEP Rev.',
        'Scrap %',
        'Tier',
      ],
    ],
    body: payload.productRows.map((p) => [
      p.productId,
      p.productName,
      p.sector,
      String(p.unitsProduced),
      `$${Math.round(p.revenue).toLocaleString()}`,
      `$${Math.round(p.totalCost).toLocaleString()}`,
      `$${Math.round(p.grossProfit).toLocaleString()}`,
      `${p.grossMarginPct.toFixed(1)}%`,
      `${p.contributionMarginPct.toFixed(1)}%`,
      `$${Math.round(p.breakEvenRevenueUsd).toLocaleString()}`,
      `${p.scrapRatePct.toFixed(1)}%`,
      p.marginTier,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5 },
  });

  // Page 2: Ranked Cost-Reduction Recommendations
  doc.addPage();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 842, 48, 'F');
  doc.setTextColor(248, 250, 252);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(
    '4. Operations Research Cost-Optimisation Roadmap & Capital Payback Schedule',
    36,
    30
  );

  autoTable(doc, {
    startY: 64,
    margin: { left: 36, right: 36 },
    head: [
      [
        'Rank',
        'Code',
        'Priority',
        'Status',
        'Inefficiency Category',
        'Initiative & Engineering Action',
        'Annual Savings',
        'Impl. Cost',
        'Payback',
        '3-Yr NPV (10%)',
      ],
    ],
    body: payload.recommendations.slice(0, 14).map((r) => [
      `#${r.rank}`,
      r.code,
      r.priority,
      payload.statusMap[r.code]?.status || 'Proposed',
      r.category,
      `${r.title}\nAction: ${r.engineeringAction}`,
      `$${r.estimatedAnnualSavingsUsd.toLocaleString()}/yr`,
      `$${r.implementationCostUsd.toLocaleString()}`,
      `${r.paybackPeriodMonths.toFixed(1)} mo`,
      `$${r.threeYearNpvUsd.toLocaleString()}`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [180, 83, 9], textColor: 255, fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      5: { cellWidth: 260 },
    },
  });

  doc.save(
    `Manufacturing_Profitability_Executive_Brief_${new Date().toISOString().slice(0, 10)}.pdf`
  );
}
