import React, { useState, useEffect, useMemo } from 'react';
import {
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Cpu,
  Sliders,
  FileSpreadsheet,
  Calculator,
  Plus,
  Download,
  FileText,
  Sun,
  Moon,
  RotateCcw,
  LogIn,
  LogOut,
  CloudUpload,
  Search,
  Building2,
  Trash2,
  BookmarkPlus,
} from 'lucide-react';
import {
  auth,
  db,
  signInWithGoogle,
  signOutUser,
  handleFirestoreError,
  OperationType,
  sanitizeString,
  BLUEPRINT_CONSTRAINTS,
} from './lib/firebase';
import {
  PLANTS_CATALOG,
  PRODUCTS_CATALOG,
  MONTHS_12_HISTORY,
  ProductionRecordItem,
  SavedScenarioItem,
  OptimisationStatusItem,
  SectorType,
  generateSyntheticIndustrialDataset,
} from './data/industrialSeedData';
import {
  computeExecutiveKPIs,
  computeMonthlyTrends,
  computeCostCategoryBreakdown,
  computeProductProfitability,
  computePlantProfitability,
  runCostOptimisationEngine,
  runScenarioSimulation,
  ScenarioParameters,
  computeRecordMetrics,
} from './engine/analyticsEngine';
import { PlotlyChart } from './components/PlotlyChart';
import { FormulaAuditModal } from './components/FormulaAuditModal';
import { RecordEntryModal } from './components/RecordEntryModal';
import {
  exportToExcelWorkbook,
  exportToExecutivePdf,
} from './services/reportExportService';

type ModuleTabId =
  | 'overview'
  | 'breakdown'
  | 'profitability'
  | 'optimisation'
  | 'simulator'
  | 'reporting';

const MODULE_NAV: Array<{
  id: ModuleTabId;
  index: string;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'overview', index: '01', label: 'Executive Overview', shortLabel: 'Overview', icon: BarChart3 },
  { id: 'breakdown', index: '02', label: 'Cost Breakdown', shortLabel: 'Costs', icon: PieChart },
  { id: 'profitability', index: '03', label: 'Profitability & CVP', shortLabel: 'Profitability', icon: TrendingUp },
  { id: 'optimisation', index: '04', label: 'Optimisation Engine', shortLabel: 'Optimisation', icon: Cpu },
  { id: 'simulator', index: '05', label: 'Scenario Simulator', shortLabel: 'Simulator', icon: Sliders },
  { id: 'reporting', index: '06', label: 'Financial Reporting', shortLabel: 'Reporting', icon: FileSpreadsheet },
];

export default function App() {
  // Theme state (default dark industrial slate)
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Active Navigation Module
  const [activeModule, setActiveModule] = useState<ModuleTabId>('overview');

  // Currency Format Multiplier (USD vs INR Crores @ 1 USD = 84 INR)
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'INR_CR'>('USD');

  const formatMoney = (usdValue: number, compact = false): string => {
    if (currencyMode === 'INR_CR') {
      // 1 Crore INR = 10,000,000 INR = ~119,047.6 USD
      const inrCr = (usdValue * 84) / 10000000;
      const sign = inrCr < 0 ? '-' : '';
      return `${sign}₹${Math.abs(inrCr).toFixed(2)} Cr`;
    }
    const sign = usdValue < 0 ? '-' : '';
    const abs = Math.abs(usdValue);
    if (compact && abs >= 1000000) {
      return `${sign}$${(abs / 1000000).toFixed(2)}M`;
    }
    if (compact && abs >= 1000) {
      return `${sign}$${(abs / 1000).toFixed(0)}k`;
    }
    return `${sign}$${Math.round(abs).toLocaleString()}`;
  };

  // Global Analytical Filters
  const [selectedPlant, setSelectedPlant] = useState<string>('ALL');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');
  const [startMonth, setStartMonth] = useState<string>('2025-11');
  const [endMonth, setEndMonth] = useState<string>('2026-10');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // Image fallback states
  const [facilityImgBroken, setFacilityImgBroken] = useState(false);
  const [avatarImgBroken, setAvatarImgBroken] = useState(false);

  // Firebase Auth & Firestore State
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudRecords, setCloudRecords] = useState<ProductionRecordItem[]>([]);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenarioItem[]>([]);
  const [optStatuses, setOptStatuses] = useState<Record<string, OptimisationStatusItem>>({});
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);

  // Local Synthetic Baseline Dataset (96 records: 12 months x 8 products)
  const [localRecords, setLocalRecords] = useState<ProductionRecordItem[]>(() =>
    generateSyntheticIndustrialDataset('local-baseline')
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Subscribe to Firestore collections when user is authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setCloudRecords([]);
      setSavedScenarios([]);
      return;
    }

    const qRecords = query(
      collection(db, 'production_records'),
      where('ownerId', '==', user.uid)
    );
    const unsubRecords = onSnapshot(
      qRecords,
      (snap) => {
        const items: ProductionRecordItem[] = [];
        snap.forEach((d) => items.push({ ...(d.data() as ProductionRecordItem), id: d.id }));
        setCloudRecords(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'production_records')
    );

    const qScenarios = query(
      collection(db, 'saved_scenarios'),
      where('ownerId', '==', user.uid)
    );
    const unsubScenarios = onSnapshot(
      qScenarios,
      (snap) => {
        const items: SavedScenarioItem[] = [];
        snap.forEach((d) => items.push({ ...(d.data() as SavedScenarioItem), id: d.id }));
        setSavedScenarios(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'saved_scenarios')
    );

    const qStatuses = query(
      collection(db, 'optimisation_statuses'),
      where('ownerId', '==', user.uid)
    );
    const unsubStatuses = onSnapshot(
      qStatuses,
      (snap) => {
        const map: Record<string, OptimisationStatusItem> = {};
        snap.forEach((d) => {
          const item = { ...(d.data() as OptimisationStatusItem), id: d.id };
          map[item.recommendationCode] = item;
        });
        setOptStatuses(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'optimisation_statuses')
    );

    return () => {
      unsubRecords();
      unsubScenarios();
      unsubStatuses();
    };
  }, [authReady, user]);

  // Active Master Dataset: merge baseline records with any cloud records or local edits
  const activeMasterRecords = useMemo(() => {
    if (user && cloudRecords.length > 0) {
      const merged = new Map<string, ProductionRecordItem>();
      localRecords.forEach((r) => merged.set(r.id, r));
      cloudRecords.forEach((r) => merged.set(r.id, r));
      return Array.from(merged.values());
    }
    return localRecords;
  }, [user, cloudRecords, localRecords]);

  // Filtered Dataset driving ALL 6 modules
  const filteredRecords = useMemo(() => {
    return activeMasterRecords.filter((r) => {
      if (selectedPlant !== 'ALL' && r.plantId !== selectedPlant) return false;
      if (selectedSector !== 'ALL' && r.sector !== selectedSector) return false;
      if (selectedProduct !== 'ALL' && r.productId !== selectedProduct) return false;
      if (r.month < startMonth || r.month > endMonth) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const match =
          r.productName.toLowerCase().includes(q) ||
          r.plantName.toLowerCase().includes(q) ||
          r.sector.toLowerCase().includes(q) ||
          r.productId.toLowerCase().includes(q) ||
          r.productionLine.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [
    activeMasterRecords,
    selectedPlant,
    selectedSector,
    selectedProduct,
    startMonth,
    endMonth,
    searchQuery,
  ]);

  // Core Database-Backed Analytical Computations
  const executiveKPIs = useMemo(() => computeExecutiveKPIs(filteredRecords), [filteredRecords]);
  const monthlyTrends = useMemo(() => computeMonthlyTrends(filteredRecords), [filteredRecords]);
  const costCategories = useMemo(
    () => computeCostCategoryBreakdown(filteredRecords),
    [filteredRecords]
  );
  const productProfitability = useMemo(
    () => computeProductProfitability(filteredRecords),
    [filteredRecords]
  );
  const plantProfitability = useMemo(
    () => computePlantProfitability(filteredRecords),
    [filteredRecords]
  );
  const optimisationResult = useMemo(
    () => runCostOptimisationEngine(filteredRecords),
    [filteredRecords]
  );

  // Module 3: CVP Product Focus Selector
  const [cvpFocusProductId, setCvpFocusProductId] = useState<string>('PRD-CEM-101');
  const cvpProductRow = useMemo(() => {
    return (
      productProfitability.find((p) => p.productId === cvpFocusProductId) ||
      productProfitability[0] ||
      null
    );
  }, [productProfitability, cvpFocusProductId]);

  // Module 5: Scenario Simulator State
  const [scenarioParams, setScenarioParams] = useState<ScenarioParameters>({
    rawMaterialDeltaPct: -6,
    energyDeltaPct: -8,
    volumeDeltaPct: 8,
    labourDeltaPct: 0,
    utilisationTargetPct: 84,
    sellingPriceDeltaPct: 3,
  });
  const [scenarioNameInput, setScenarioNameInput] = useState('FY27 Procurement & Kiln Heat Recovery Plan');
  const [scenarioDescInput, setScenarioDescInput] = useState(
    'Negotiate -6% steel consignment, -8% waste-heat recovery energy reduction, +8% volume, and 84% OEE.'
  );

  const scenarioComparison = useMemo(
    () => runScenarioSimulation(filteredRecords, scenarioParams),
    [filteredRecords, scenarioParams]
  );

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedPlant('ALL');
    setSelectedSector('ALL');
    setSelectedProduct('ALL');
    setStartMonth('2025-11');
    setEndMonth('2026-10');
    setSearchQuery('');
  };

  const showBanner = (msg: string) => {
    setNotificationBanner(msg);
    setTimeout(() => setNotificationBanner(null), 4000);
  };

  // Seed / Sync 96 synthetic records into user's Firestore collection
  const handleSeedCloudDatabase = async () => {
    if (!user) {
      showBanner('Please sign in with Google first to sync records to your cloud database.');
      return;
    }
    setIsSyncingCloud(true);
    try {
      const seedItems = generateSyntheticIndustrialDataset(user.uid);
      const batch = writeBatch(db);
      for (const item of seedItems) {
        const docId = `${user.uid.slice(0, 12)}_${item.id}`;
        const ref = doc(db, 'production_records', docId);
        const { id: _unused, ...rest } = item;
        batch.set(ref, {
          ...rest,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      showBanner('Synced 96 historical industrial production & cost records to Firestore.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'production_records');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Save or update a single production record
  const handleSaveProductionRecord = async (
    newRec: Omit<ProductionRecordItem, 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    // Always update local state immediately for zero-latency responsiveness
    setLocalRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === newRec.id);
      const fullItem: ProductionRecordItem = {
        ...newRec,
        ownerId: user?.uid || 'local-baseline',
      };
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = fullItem;
        return copy;
      }
      return [fullItem, ...prev];
    });

    if (user) {
      const docId = `${user.uid.slice(0, 12)}_${newRec.id}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const ref = doc(db, 'production_records', docId);
      try {
        await setDoc(ref, {
          ownerId: user.uid,
          month: newRec.month,
          plantId: sanitizeString(newRec.plantId, 32),
          plantName: sanitizeString(newRec.plantName, BLUEPRINT_CONSTRAINTS.PLANT_NAME_MAX_LEN),
          sector: newRec.sector,
          productId: sanitizeString(newRec.productId, 32),
          productName: sanitizeString(
            newRec.productName,
            BLUEPRINT_CONSTRAINTS.PRODUCT_NAME_MAX_LEN
          ),
          productionLine: sanitizeString(
            newRec.productionLine,
            BLUEPRINT_CONSTRAINTS.LINE_MAX_LEN
          ),
          unitsProduced: Number(newRec.unitsProduced),
          sellingPricePerUnit: Number(newRec.sellingPricePerUnit),
          revenue: Number(newRec.revenue),
          budgetedCost: Number(newRec.budgetedCost),
          rawMaterialCost: Number(newRec.rawMaterialCost),
          directLabourCost: Number(newRec.directLabourCost),
          energyCost: Number(newRec.energyCost),
          maintenanceCost: Number(newRec.maintenanceCost),
          logisticsCost: Number(newRec.logisticsCost),
          inventoryHoldingCost: Number(newRec.inventoryHoldingCost),
          overheadCost: Number(newRec.overheadCost),
          machineHoursAvailable: Number(newRec.machineHoursAvailable),
          machineHoursUsed: Number(newRec.machineHoursUsed),
          rawMaterialInputTons: Number(newRec.rawMaterialInputTons),
          rawMaterialNetTons: Number(newRec.rawMaterialNetTons),
          energyKwhConsumed: Number(newRec.energyKwhConsumed),
          benchmarkEnergyKwhPerUnit: Number(newRec.benchmarkEnergyKwhPerUnit),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showBanner(`Saved record ${newRec.id} to Cloud Firestore.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `production_records/${docId}`);
      }
    } else {
      showBanner(`Updated record ${newRec.id} in active workspace.`);
    }
  };

  // Update status of a Cost Optimisation Recommendation
  const handleUpdateRecommendationStatus = async (
    recommendationCode: string,
    newStatus: 'Proposed' | 'Approved' | 'In Progress' | 'Implemented',
    noteText?: string
  ) => {
    const currentNote =
      noteText !== undefined
        ? noteText
        : optStatuses[recommendationCode]?.ownerNote || 'Reviewed by manufacturing finance team.';

    // Update local state immediately
    setOptStatuses((prev) => ({
      ...prev,
      [recommendationCode]: {
        id: recommendationCode,
        ownerId: user?.uid || 'local-user',
        recommendationCode,
        status: newStatus,
        ownerNote: currentNote,
      },
    }));

    if (user) {
      const docId = `${user.uid.slice(0, 12)}_${recommendationCode}`.replace(
        /[^a-zA-Z0-9_\-]/g,
        '_'
      );
      const ref = doc(db, 'optimisation_statuses', docId);
      try {
        await setDoc(ref, {
          ownerId: user.uid,
          recommendationCode: sanitizeString(recommendationCode, 64),
          status: newStatus,
          ownerNote: sanitizeString(currentNote, BLUEPRINT_CONSTRAINTS.OPT_NOTE_MAX_LEN),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showBanner(`Initiative ${recommendationCode} marked as ${newStatus}.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `optimisation_statuses/${docId}`);
      }
    } else {
      showBanner(`Initiative ${recommendationCode} marked as ${newStatus}.`);
    }
  };

  // Save Scenario Snapshot
  const handleSaveScenarioSnapshot = async () => {
    const cleanName = sanitizeString(
      scenarioNameInput || 'Custom Scenario',
      BLUEPRINT_CONSTRAINTS.SCENARIO_NAME_MAX_LEN
    );
    const cleanDesc = sanitizeString(
      scenarioDescInput || 'Custom parameter sensitivity run',
      BLUEPRINT_CONSTRAINTS.SCENARIO_DESC_MAX_LEN
    );
    const scenarioId = `SCEN_${Date.now()}`;

    const newItem: SavedScenarioItem = {
      id: scenarioId,
      ownerId: user?.uid || 'local-user',
      name: cleanName,
      description: cleanDesc,
      targetSector: selectedSector,
      rawMaterialDeltaPct: scenarioParams.rawMaterialDeltaPct,
      energyDeltaPct: scenarioParams.energyDeltaPct,
      volumeDeltaPct: scenarioParams.volumeDeltaPct,
      labourDeltaPct: scenarioParams.labourDeltaPct,
      utilisationTargetPct: scenarioParams.utilisationTargetPct,
      sellingPriceDeltaPct: scenarioParams.sellingPriceDeltaPct,
      projectedGrossMarginPct: Number(scenarioComparison.simulated.grossMarginPct.toFixed(2)),
      projectedAnnualSavingsUsd: Math.round(scenarioComparison.deltas.grossProfitDeltaUsd),
    };

    if (user) {
      const ref = doc(db, 'saved_scenarios', scenarioId);
      try {
        const { id: _unused, ...payload } = newItem;
        await setDoc(ref, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showBanner(`Saved scenario "${cleanName}" to Firestore.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `saved_scenarios/${scenarioId}`);
      }
    } else {
      setSavedScenarios((prev) => [newItem, ...prev]);
      showBanner(`Saved scenario "${cleanName}" to workspace.`);
    }
  };

  const handleDeleteScenario = async (scenId: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, 'saved_scenarios', scenId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `saved_scenarios/${scenId}`);
      }
    } else {
      setSavedScenarios((prev) => prev.filter((s) => s.id !== scenId));
    }
  };

  const filterSummaryText = useMemo(() => {
    const plantLabel =
      selectedPlant === 'ALL'
        ? 'All 4 Plants'
        : PLANTS_CATALOG.find((p) => p.plantId === selectedPlant)?.plantName || selectedPlant;
    const sectorLabel = selectedSector === 'ALL' ? 'All 4 Sectors' : selectedSector;
    const prodLabel = selectedProduct === 'ALL' ? 'All 8 Product Lines' : selectedProduct;
    return `${plantLabel} · ${sectorLabel} · ${prodLabel} · Period ${startMonth} to ${endMonth}`;
  }, [selectedPlant, selectedSector, selectedProduct, startMonth, endMonth]);

  const handleTriggerExcelExport = () => {
    exportToExcelWorkbook({
      filterSummary: filterSummaryText,
      kpis: executiveKPIs,
      costCategories,
      productRows: productProfitability,
      plantRows: plantProfitability,
      recommendations: optimisationResult.recommendations,
      records: filteredRecords,
      statusMap: optStatuses,
    });
    showBanner('Downloaded multi-sheet Excel financial report (.xlsx).');
  };

  const handleTriggerPdfExport = () => {
    exportToExecutivePdf({
      filterSummary: filterSummaryText,
      kpis: executiveKPIs,
      costCategories,
      productRows: productProfitability,
      plantRows: plantProfitability,
      recommendations: optimisationResult.recommendations,
      records: filteredRecords,
      statusMap: optStatuses,
    });
    showBanner('Downloaded executive board PDF report (.pdf).');
  };

  const downloadTextArtifact = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentModuleObj =
    MODULE_NAV.find((m) => m.id === activeModule) || MODULE_NAV[0];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* LEFT SIDEBAR NAVIGATION (268px fixed on desktop) */}
      <aside className="w-full lg:w-[268px] shrink-0 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between">
        <div>
          {/* Brand Title */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">
              Vanguard Industrial
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cost &amp; Profitability Intelligence
            </div>
          </div>

          {/* Primary Module Navigation */}
          <nav className="p-3 space-y-1 flex lg:flex-col overflow-x-auto" aria-label="Main modules">
            {MODULE_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveModule(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="font-mono text-[11px] opacity-75">{item.index}.</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Industrial Facility Card with Verified Asset & Fallback */}
          <div className="hidden lg:block mx-4 my-3 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-950/60">
            <div className="relative h-28 w-full bg-slate-900 overflow-hidden">
              {!facilityImgBroken ? (
                <img
                  src="/src/assets/images/plant_facility_overview_1794076896453.jpg"
                  alt="Integrated Rotary Kiln, Thermal Boiler and Bulk Material Handling Complex"
                  referrerPolicy="no-referrer"
                  onError={() => setFacilityImgBroken(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-slate-400">
                  <Building2 className="w-8 h-8" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent flex items-end p-3">
                <div className="text-[11px] text-white leading-tight">
                  <div className="font-semibold">4 Integrated Manufacturing Plants</div>
                  <div className="text-slate-300 font-mono mt-0.5">
                    Cement · Sugar · Mining · Thermal
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Active Dataset:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">
                  {filteredRecords.length} / {activeMasterRecords.length} rows
                </span>
              </div>
              <div className="flex justify-between">
                <span>Annual Capacity:</span>
                <span className="font-mono text-slate-800 dark:text-slate-300">176,000 MT</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Controls: Theme, Currency & Cloud Persistence Auth */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          {/* Currency & Theme Switchers */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
              <button
                onClick={() => setCurrencyMode('USD')}
                className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-md transition-colors whitespace-nowrap ${
                  currencyMode === 'USD'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                USD ($)
              </button>
              <button
                onClick={() => setCurrencyMode('INR_CR')}
                className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-md transition-colors whitespace-nowrap ${
                  currencyMode === 'INR_CR'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                INR (Cr)
              </button>
            </div>

            <button
              onClick={() => setIsDark(!isDark)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Toggle Light / Dark Theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{isDark ? 'Light' : 'Dark'}</span>
            </button>
          </div>

          {/* Executive User / Cloud Sync Section */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {!avatarImgBroken ? (
                      <img
                        src={
                          user.photoURL ||
                          '/src/assets/images/avatar_industrial_director_1794076893940.jpg'
                        }
                        alt="Operations Finance Director Avatar"
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarImgBroken(true)}
                        className="w-7 h-7 rounded-full object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-xs font-bold shrink-0">
                        {user.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="truncate">
                      <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                        {user.displayName || 'Industrial Director'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {cloudRecords.length} Cloud Records Synced
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => signOutUser()}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Sign out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={handleSeedCloudDatabase}
                  disabled={isSyncingCloud}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  {isSyncingCloud ? 'Syncing 96 Records...' : 'Sync 12-Mo Seed to Cloud'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {!avatarImgBroken ? (
                    <img
                      src="/src/assets/images/avatar_industrial_director_1794076893940.jpg"
                      alt="Director Profile"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarImgBroken(true)}
                      className="w-7 h-7 rounded-full object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                      VP
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                    Sign in to persist custom scenarios
                  </div>
                </div>
                <button
                  onClick={() => signInWithGoogle()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 hover:opacity-90 whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE CANVAS */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP BAR CONTRACT: Breadcrumb on Left, Primary Actions on Right */}
        <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          {/* Zone 1: Breadcrumb Trail */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Manufacturing Intelligence
            </span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {currentModuleObj.index}. {currentModuleObj.label}
            </span>
            <span aria-hidden="true" className="hidden md:inline">
              ·
            </span>
            <span className="hidden md:inline font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {filterSummaryText}
            </span>
          </div>

          {/* Zone 2: Quick Module Switch Links on large screens */}
          <nav className="hidden xl:flex items-center gap-5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {MODULE_NAV.slice(0, 5).map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveModule(m.id)}
                className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${
                  activeModule === m.id
                    ? 'text-slate-900 dark:text-amber-400 underline underline-offset-4'
                    : ''
                }`}
              >
                {m.shortLabel}
              </button>
            ))}
          </nav>

          {/* Zone 3: Primary Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsFormulaModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Formulas &amp; Tests
            </button>
            <button
              onClick={() => setIsRecordModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Cost Record
            </button>
          </div>
        </header>

        {/* NOTIFICATION TOAST BANNER */}
        {notificationBanner && (
          <div className="px-6 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-medium flex items-center justify-between">
            <span>{notificationBanner}</span>
            <button
              onClick={() => setNotificationBanner(null)}
              className="text-xs underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* GLOBAL INTERACTIVE FILTER BAR */}
        <section
          aria-label="Global data filters"
          className="px-6 py-3 bg-slate-100/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs"
        >
          {/* Plant Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-plant" className="text-slate-500 dark:text-slate-400 font-medium">
              Plant:
            </label>
            <select
              id="filter-plant"
              value={selectedPlant}
              onChange={(e) => setSelectedPlant(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="ALL">All Plants (4 Facilities)</option>
              {PLANTS_CATALOG.map((pl) => (
                <option key={pl.plantId} value={pl.plantId}>
                  {pl.plantId} · {pl.plantName}
                </option>
              ))}
            </select>
          </div>

          {/* Sector Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-sector" className="text-slate-500 dark:text-slate-400 font-medium">
              Sector:
            </label>
            <select
              id="filter-sector"
              value={selectedSector}
              onChange={(e) => {
                setSelectedSector(e.target.value);
                setSelectedProduct('ALL');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="ALL">All Industrial Sectors (4)</option>
              <option value="Cement Systems">Cement Systems</option>
              <option value="Sugar Processing">Sugar Processing</option>
              <option value="Mining & Material Handling">Mining &amp; Material Handling</option>
              <option value="Thermal Energy">Thermal Energy</option>
            </select>
          </div>

          {/* Product Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-product" className="text-slate-500 dark:text-slate-400 font-medium">
              Product:
            </label>
            <select
              id="filter-product"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium max-w-[230px] truncate"
            >
              <option value="ALL">All Product Lines (8)</option>
              {PRODUCTS_CATALOG.filter(
                (p) => selectedSector === 'ALL' || p.sector === selectedSector
              ).map((p) => (
                <option key={p.productId} value={p.productId}>
                  {p.productId} · {p.productName}
                </option>
              ))}
            </select>
          </div>

          {/* Period Range */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Period:</span>
            <select
              aria-label="Start month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono"
            >
              {MONTHS_12_HISTORY.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="text-slate-400">to</span>
            <select
              aria-label="End month"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono"
            >
              {MONTHS_12_HISTORY.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter equipment, bay, plant..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          {/* Reset Filters */}
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </section>

        {/* MAIN CONTENT VIEWPORT */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {filteredRecords.length === 0 ? (
            <div className="p-12 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-center space-y-3">
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                No Manufacturing Cost Records Match Your Active Filters
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Adjust the Plant, Sector, Product Line, or Reporting Month range above, or reset all filters to restore the 96-record historical baseline.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <>
              {/* ====================================================================
                  MODULE 1: EXECUTIVE OVERVIEW
              ==================================================================== */}
              {activeModule === 'overview' && (
                <div className="space-y-6">
                  {/* Top KPI Strip (6 Cards, Single-Elevation Depth, Explicit Formula Subtitles) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    {/* KPI 1: Total Production Cost */}
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Total Production Cost
                      </div>
                      <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                        {formatMoney(executiveKPIs.totalProductionCost, true)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1.5">
                        Budget: {formatMoney(executiveKPIs.totalBudgetedCost, true)}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1">
                        Formula: Σ(7 Cost Categories)
                      </div>
                    </div>

                    {/* KPI 2: Total Revenue */}
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Realized Revenue
                      </div>
                      <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                        {formatMoney(executiveKPIs.totalRevenue, true)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1.5">
                        Output: {executiveKPIs.totalUnitsProduced.toLocaleString()} Eq. Units
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1">
                        Formula: Σ(Units × Price)
                      </div>
                    </div>

                    {/* KPI 3: Gross Profit & Margin */}
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Gross Profit &amp; Margin
                      </div>
                      <div
                        className={`text-xl font-bold font-mono tabular-nums mt-1 ${
                          executiveKPIs.grossProfit >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatMoney(executiveKPIs.grossProfit, true)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-1.5">
                        Gross Margin: {executiveKPIs.grossMarginPct.toFixed(2)}%
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1">
                        Formula: (Rev - Cost) / Rev
                      </div>
                    </div>

                    {/* KPI 4: Cost Per Unit Produced */}
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Cost Per Unit Produced
                      </div>
                      <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                        {formatMoney(executiveKPIs.costPerUnit, false)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1.5">
                        Avg Price: {formatMoney(executiveKPIs.revenuePerUnit, false)}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1">
                        Formula: Total_Cost / Σ(Units)
                      </div>
                    </div>

                    {/* KPI 5: Actual vs Budget Variance */}
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Actual vs. Budget Variance
                      </div>
                      <div
                        className={`text-xl font-bold font-mono tabular-nums mt-1 ${
                          executiveKPIs.budgetVarianceUsd <= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {executiveKPIs.budgetVarianceUsd > 0 ? '+' : ''}
                        {formatMoney(executiveKPIs.budgetVarianceUsd, true)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-1.5">
                        Variance: {executiveKPIs.budgetVariancePct > 0 ? '+' : ''}
                        {executiveKPIs.budgetVariancePct.toFixed(2)}% vs Std
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1">
                        Formula: C_actual - C_budget
                      </div>
                    </div>

                    {/* KPI 6: Identified Annual Savings Opportunity */}
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Recoverable Cost Savings
                      </div>
                      <div className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                        {formatMoney(
                          optimisationResult.recommendations.reduce(
                            (s, r) => s + r.estimatedAnnualSavingsUsd,
                            0
                          ),
                          true
                        )}
                        /yr
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-1.5">
                        {optimisationResult.recommendations.length} Ranked Initiatives
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1">
                        Click Optimisation Engine →
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Monthly Cost & Actual vs Budget Trends + Product Profitability */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Chart 1: Monthly Cost, Budget & Revenue Trends (7 cols) */}
                    <div className="lg:col-span-7 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Monthly Production Cost, Standard Budget &amp; Gross Margin Trend
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            12-month trajectory comparing Actual Cost vs. Budgeted Cost (bars) and Gross Margin % (line)
                          </p>
                        </div>
                        <span className="text-xs font-mono text-slate-500">
                          {monthlyTrends.length} Months
                        </span>
                      </div>
                      <PlotlyChart
                        isDark={isDark}
                        height={330}
                        data={[
                          {
                            x: monthlyTrends.map((m) => m.month),
                            y: monthlyTrends.map((m) => Math.round(m.budgetedCost)),
                            type: 'bar',
                            name: 'Budgeted Cost ($)',
                            marker: { color: isDark ? '#334155' : '#cbd5e1' },
                          },
                          {
                            x: monthlyTrends.map((m) => m.month),
                            y: monthlyTrends.map((m) => Math.round(m.totalCost)),
                            type: 'bar',
                            name: 'Actual Production Cost ($)',
                            marker: { color: '#f59e0b' },
                          },
                          {
                            x: monthlyTrends.map((m) => m.month),
                            y: monthlyTrends.map((m) => Math.round(m.revenue)),
                            type: 'scatter',
                            mode: 'lines+markers',
                            name: 'Realized Revenue ($)',
                            line: { color: '#10b981', width: 2.5 },
                            marker: { size: 6 },
                          },
                          {
                            x: monthlyTrends.map((m) => m.month),
                            y: monthlyTrends.map((m) => Number(m.grossMarginPct.toFixed(2))),
                            type: 'scatter',
                            mode: 'lines+markers',
                            name: 'Gross Margin (%)',
                            yaxis: 'y2',
                            line: { color: '#38bdf8', width: 2, dash: 'dot' },
                            marker: { size: 5 },
                          },
                        ]}
                        layout={{
                          barmode: 'group',
                          yaxis: { title: 'USD ($)' },
                          yaxis2: {
                            title: 'Gross Margin (%)',
                            overlaying: 'y',
                            side: 'right',
                            ticksuffix: '%',
                          },
                        }}
                      />
                    </div>

                    {/* Chart 2: Product-Wise Profitability & Margin Comparison (5 cols) */}
                    <div className="lg:col-span-5 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Product-Wise Gross Margin (%) Ranking
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Highlights High-Margin, Low-Margin (&lt;12%), and Loss-Making (&lt;0%) lines
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveModule('profitability')}
                          className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          CVP Drill-Down →
                        </button>
                      </div>
                      <PlotlyChart
                        isDark={isDark}
                        height={330}
                        data={[
                          {
                            y: productProfitability.map((p) => p.productId),
                            x: productProfitability.map((p) =>
                              Number(p.grossMarginPct.toFixed(2))
                            ),
                            text: productProfitability.map(
                              (p) => `${p.grossMarginPct.toFixed(1)}% (${p.productName})`
                            ),
                            type: 'bar',
                            orientation: 'h',
                            name: 'Gross Margin %',
                            marker: {
                              color: productProfitability.map((p) =>
                                p.grossMarginPct < 0
                                  ? '#ef4444'
                                  : p.grossMarginPct < 12
                                  ? '#f59e0b'
                                  : '#10b981'
                              ),
                            },
                          },
                        ]}
                        layout={{
                          margin: { l: 95, r: 20, t: 20, b: 40 },
                          xaxis: { title: 'Gross Margin (%)', ticksuffix: '%' },
                          yaxis: { autorange: 'reversed' },
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 3: Plant-Wise Executive Performance Matrix */}
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Manufacturing Plant Financial &amp; Operational Performance Matrix
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Click any plant row to filter the entire platform to that facility
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        Unit: {currencyMode === 'USD' ? 'USD ($)' : 'INR Crores (₹ Cr)'}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <th className="py-2.5 px-3">Plant Code &amp; Facility Name</th>
                            <th className="py-2.5 px-3 text-right">Units</th>
                            <th className="py-2.5 px-3 text-right">Realized Revenue</th>
                            <th className="py-2.5 px-3 text-right">Actual Cost</th>
                            <th className="py-2.5 px-3 text-right">Budget Variance</th>
                            <th className="py-2.5 px-3 text-right">Gross Profit</th>
                            <th className="py-2.5 px-3 text-right">Gross Margin</th>
                            <th className="py-2.5 px-3 text-right">Machine Util.</th>
                            <th className="py-2.5 px-3 text-right">Scrap Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-mono tabular-nums">
                          {plantProfitability.map((pl) => (
                            <tr
                              key={pl.plantId}
                              onClick={() =>
                                setSelectedPlant(
                                  selectedPlant === pl.plantId ? 'ALL' : pl.plantId
                                )
                              }
                              className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              <td className="py-3 px-3 font-sans">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                  {pl.plantName}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {pl.plantId}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right">{pl.unitsProduced}</td>
                              <td className="py-3 px-3 text-right">
                                {formatMoney(pl.revenue)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {formatMoney(pl.totalCost)}
                              </td>
                              <td
                                className={`py-3 px-3 text-right ${
                                  pl.budgetVarianceUsd > 0
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {pl.budgetVarianceUsd > 0 ? '+' : ''}
                                {formatMoney(pl.budgetVarianceUsd)}
                              </td>
                              <td
                                className={`py-3 px-3 text-right font-semibold ${
                                  pl.grossProfit >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {formatMoney(pl.grossProfit)}
                              </td>
                              <td className="py-3 px-3 text-right font-semibold">
                                {pl.grossMarginPct.toFixed(2)}%
                              </td>
                              <td className="py-3 px-3 text-right">
                                {pl.machineUtilisationPct.toFixed(1)}%
                              </td>
                              <td
                                className={`py-3 px-3 text-right ${
                                  pl.scrapRatePct > 12.0
                                    ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                    : ''
                                }`}
                              >
                                {pl.scrapRatePct.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ====================================================================
                  MODULE 2: MANUFACTURING COST BREAKDOWN (7 CATEGORIES)
              ==================================================================== */}
              {activeModule === 'breakdown' && (
                <div className="space-y-6">
                  {/* 7 Cost Category Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                    {costCategories.map((cat) => (
                      <div
                        key={cat.key}
                        className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          <span>{cat.code}</span>
                          <span>{cat.nature}</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                          {cat.label}
                        </div>
                        <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1.5">
                          {formatMoney(cat.totalUsd, true)}
                        </div>
                        <div className="text-[11px] font-mono text-amber-600 dark:text-amber-400 mt-1">
                          {cat.shareOfCostPct.toFixed(1)}% of Total Cost
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {formatMoney(cat.costPerUnitUsd)} / unit
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Charts: 7-Category Pareto Breakdown & Monthly Stacked Evolution */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        7-Category Manufacturing Cost Pareto Distribution
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        Proportional expenditure across Raw Material, Labour, Overheads, Energy, Logistics, Maintenance &amp; Inventory
                      </p>
                      <PlotlyChart
                        isDark={isDark}
                        height={340}
                        data={[
                          {
                            labels: costCategories.map((c) => c.label),
                            values: costCategories.map((c) => Math.round(c.totalUsd)),
                            type: 'pie',
                            hole: 0.52,
                            textinfo: 'percent',
                            marker: {
                              colors: [
                                '#f59e0b',
                                '#38bdf8',
                                '#6366f1',
                                '#10b981',
                                '#ec4899',
                                '#ef4444',
                                '#94a3b8',
                              ],
                            },
                          },
                        ]}
                        layout={{
                          margin: { t: 20, b: 20, l: 20, r: 20 },
                          showlegend: true,
                        }}
                      />
                    </div>

                    <div className="lg:col-span-7 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Monthly Cost Category Composition Trend
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        Stacked monthly progression across all 7 production expense drivers
                      </p>
                      <PlotlyChart
                        isDark={isDark}
                        height={340}
                        data={[
                          {
                            x: monthlyTrends.map((m) => m.month),
                            y: monthlyTrends.map((m) => Math.round(m.rawMaterialCost)),
                            name: 'Raw Material',
                            type: 'bar',
                            marker: { color: '#f59e0b' },
                          },
                          {
                            x: monthlyTrends.map((m) => m.month),
                            y: monthlyTrends.map((m) => Math.round(m.directLabourCost)),
                            name: 'Direct Labour',
                            type: 'bar',
                            marker: { color: '#38bdf8' },
                          },
                          {
                            x: monthlyTrends.map((m) => m.month),
                            y: monthlyTrends.map((m) => Math.round(m.overheadCost)),
                            name: 'Overheads',
                            type: 'bar',
                            marker: { color: '#6366f1' },
                          },
                          {
                            x: monthlyTrends.map((m) => m.month),
                            y: monthlyTrends.map((m) => Math.round(m.energyCost)),
                            name: 'Energy',
                            type: 'bar',
                            marker: { color: '#10b981' },
                          },
                          {
                            x: monthlyTrends.map((m) => m.month),
                            y: monthlyTrends.map((m) => Math.round(m.logisticsCost)),
                            name: 'Logistics',
                            type: 'bar',
                            marker: { color: '#ec4899' },
                          },
                          {
                            x: monthlyTrends.map((m) => m.month),
                            y: monthlyTrends.map((m) => Math.round(m.maintenanceCost)),
                            name: 'Maintenance',
                            type: 'bar',
                            marker: { color: '#ef4444' },
                          },
                          {
                            x: monthlyTrends.map((m) => m.month),
                            y: monthlyTrends.map((m) => Math.round(m.inventoryHoldingCost)),
                            name: 'Inventory Holding',
                            type: 'bar',
                            marker: { color: '#94a3b8' },
                          },
                        ]}
                        layout={{
                          barmode: 'stack',
                          yaxis: { title: 'Monthly Cost (USD)' },
                        }}
                      />
                    </div>
                  </div>

                  {/* Plant-by-Plant 7-Category Cost Comparison Table */}
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                      Facility-Wise 7-Category Manufacturing Expense Ledger
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Granular cost accounting matrix across Raw Materials, Direct Labour, Energy, Maintenance, Logistics, Inventory Holding, and Overheads
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <th className="py-2.5 px-3">Plant Facility</th>
                            <th className="py-2.5 px-3 text-right">Raw Material</th>
                            <th className="py-2.5 px-3 text-right">Direct Labour</th>
                            <th className="py-2.5 px-3 text-right">Energy &amp; Elec.</th>
                            <th className="py-2.5 px-3 text-right">Maintenance</th>
                            <th className="py-2.5 px-3 text-right">Logistics</th>
                            <th className="py-2.5 px-3 text-right">Inventory Hold.</th>
                            <th className="py-2.5 px-3 text-right">Overheads</th>
                            <th className="py-2.5 px-3 text-right">Total Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-mono tabular-nums">
                          {plantProfitability.map((pl) => (
                            <tr
                              key={pl.plantId}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            >
                              <td className="py-3 px-3 font-sans font-medium text-slate-900 dark:text-slate-100">
                                {pl.plantName}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {formatMoney(pl.rawMaterialCost, true)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {formatMoney(pl.directLabourCost, true)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {formatMoney(pl.energyCost, true)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {formatMoney(pl.maintenanceCost, true)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {formatMoney(pl.logisticsCost, true)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {formatMoney(pl.inventoryHoldingCost, true)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {formatMoney(pl.overheadCost, true)}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                                {formatMoney(pl.totalCost, true)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ====================================================================
                  MODULE 3: PROFITABILITY & COST-VOLUME-PROFIT (CVP) ANALYSIS
              ==================================================================== */}
              {activeModule === 'profitability' && (
                <div className="space-y-6">
                  {/* CVP Portfolio Summary KPIs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Contribution Margin ($)
                      </div>
                      <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                        {formatMoney(executiveKPIs.contributionMargin, true)}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        CM Ratio: {executiveKPIs.contributionMarginPct.toFixed(2)}%
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Break-Even Revenue (BEP)
                      </div>
                      <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                        {formatMoney(executiveKPIs.breakEvenRevenueUsd, true)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-1">
                        BEP Volume: {executiveKPIs.breakEvenUnits.toFixed(1)} Units
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Margin of Safety (%)
                      </div>
                      <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                        {executiveKPIs.marginOfSafetyPct.toFixed(2)}%
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-1">
                        Buffer Above Break-Even
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Operating Leverage (DOL)
                      </div>
                      <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                        {executiveKPIs.operatingLeverage.toFixed(2)}x
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-1">
                        Formula: CM / Gross Profit
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Underperforming Products
                      </div>
                      <div className="text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
                        {
                          productProfitability.filter(
                            (p) =>
                              p.marginTier === 'Loss-Making' || p.marginTier === 'Low Margin'
                          ).length
                        }{' '}
                        Lines
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-1">
                        {
                          productProfitability.filter((p) => p.marginTier === 'Loss-Making')
                            .length
                        }{' '}
                        Loss-Making ·{' '}
                        {
                          productProfitability.filter((p) => p.marginTier === 'Low Margin')
                            .length
                        }{' '}
                        Low Margin
                      </div>
                    </div>
                  </div>

                  {/* Interactive CVP Break-Even Chart + Low-Margin / Loss-Making Diagnostic */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Interactive Cost-Volume-Profit (CVP) Break-Even Graph (7 cols) */}
                    <div className="lg:col-span-7 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div>
                          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Cost-Volume-Profit (CVP) &amp; Break-Even Analysis Curve
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Models Total Revenue vs. Total Cost (Fixed + Variable × Volume) to pinpoint Break-Even Volume
                          </p>
                        </div>
                        <select
                          aria-label="Select product for CVP chart"
                          value={cvpProductRow?.productId || ''}
                          onChange={(e) => setCvpFocusProductId(e.target.value)}
                          className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                        >
                          {productProfitability.map((p) => (
                            <option key={p.productId} value={p.productId}>
                              {p.productId} · {p.productName} (GM: {p.grossMarginPct.toFixed(1)}%)
                            </option>
                          ))}
                        </select>
                      </div>

                      {cvpProductRow && (() => {
                        const maxQ = Math.max(
                          Math.ceil(cvpProductRow.unitsProduced * 1.4),
                          Math.ceil(cvpProductRow.breakEvenUnits * 1.3),
                          10
                        );
                        const qSteps = Array.from({ length: 21 }, (_, i) =>
                          Math.round((maxQ * i) / 20)
                        );
                        const revLine = qSteps.map(
                          (q) => Math.round(q * cvpProductRow.sellingPricePerUnit)
                        );
                        const totalCostLine = qSteps.map((q) =>
                          Math.round(
                            cvpProductRow.fixedCost + q * cvpProductRow.variableCostPerUnit
                          )
                        );
                        const fixedCostLine = qSteps.map(() =>
                          Math.round(cvpProductRow.fixedCost)
                        );

                        return (
                          <>
                            <PlotlyChart
                              isDark={isDark}
                              height={310}
                              data={[
                                {
                                  x: qSteps,
                                  y: revLine,
                                  type: 'scatter',
                                  mode: 'lines',
                                  name: 'Total Revenue ($)',
                                  line: { color: '#10b981', width: 2.5 },
                                },
                                {
                                  x: qSteps,
                                  y: totalCostLine,
                                  type: 'scatter',
                                  mode: 'lines',
                                  name: 'Total Cost (Fixed + Var)',
                                  line: { color: '#ef4444', width: 2.5 },
                                },
                                {
                                  x: qSteps,
                                  y: fixedCostLine,
                                  type: 'scatter',
                                  mode: 'lines',
                                  name: 'Fixed Cost Floor',
                                  line: { color: '#64748b', width: 1.5, dash: 'dash' },
                                },
                                {
                                  x: [Number(cvpProductRow.breakEvenUnits.toFixed(1))],
                                  y: [Math.round(cvpProductRow.breakEvenRevenueUsd)],
                                  type: 'scatter',
                                  mode: 'markers',
                                  name: 'Break-Even Point',
                                  marker: { color: '#f59e0b', size: 11, symbol: 'diamond' },
                                },
                                {
                                  x: [cvpProductRow.unitsProduced],
                                  y: [Math.round(cvpProductRow.revenue)],
                                  type: 'scatter',
                                  mode: 'markers',
                                  name: 'Actual Realized Volume',
                                  marker: { color: '#38bdf8', size: 10, symbol: 'circle' },
                                },
                              ]}
                              layout={{
                                xaxis: { title: 'Production Volume (Units)' },
                                yaxis: { title: 'Cumulative Value (USD)' },
                              }}
                            />
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs font-mono">
                              <div>
                                <span className="text-slate-500 block">Unit Price:</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {formatMoney(cvpProductRow.sellingPricePerUnit)}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Unit Variable Cost:</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {formatMoney(cvpProductRow.variableCostPerUnit)}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Break-Even Volume:</span>
                                <span className="font-semibold text-amber-600 dark:text-amber-400">
                                  {cvpProductRow.breakEvenUnits.toFixed(1)} Units
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Actual Volume:</span>
                                <span className="font-semibold text-sky-600 dark:text-sky-400">
                                  {cvpProductRow.unitsProduced} Units (MoS:{' '}
                                  {cvpProductRow.marginOfSafetyPct.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Low-Margin & Loss-Making Products Diagnostic Panel (5 cols) */}
                    <div className="lg:col-span-5 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Low-Margin &amp; Loss-Making Product Diagnostics
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                          Automated identification of products with negative gross margin (&lt;0%) or sub-threshold margin (&lt;12%)
                        </p>

                        <div className="space-y-3">
                          {productProfitability
                            .filter(
                              (p) =>
                                p.marginTier === 'Loss-Making' || p.marginTier === 'Low Margin'
                            )
                            .map((item) => (
                              <div
                                key={item.productId}
                                className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                      {item.productName}
                                    </div>
                                    <div className="text-[11px] font-mono text-slate-500">
                                      {item.productId} · {item.plantName} · {item.productionLine}
                                    </div>
                                  </div>
                                  <span
                                    className={`text-xs font-mono font-bold whitespace-nowrap ${
                                      item.marginTier === 'Loss-Making'
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-amber-600 dark:text-amber-400'
                                    }`}
                                  >
                                    {item.marginTier}: {item.grossMarginPct.toFixed(2)}%
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 text-[11px] font-mono">
                                  <div>
                                    <span className="text-slate-500 block">Gross Profit</span>
                                    <span
                                      className={
                                        item.grossProfit >= 0
                                          ? 'text-slate-800 dark:text-slate-200'
                                          : 'text-rose-600 dark:text-rose-400 font-semibold'
                                      }
                                    >
                                      {formatMoney(item.grossProfit, true)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block">Scrap Rate</span>
                                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                      {item.scrapRatePct.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block">Energy vs Std</span>
                                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                      +{item.energyExcessPct.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">
                          View targeted turnaround actions in Module 04
                        </span>
                        <button
                          onClick={() => setActiveModule('optimisation')}
                          className="font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          Open Optimisation Engine →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Full Product-Wise Profitability & CVP Table */}
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                      Product-Wise Profitability, Contribution Margin &amp; Break-Even Matrix
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Click any product row to load its interactive Cost-Volume-Profit curve above
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <th className="py-2.5 px-3">Product Line &amp; Sector</th>
                            <th className="py-2.5 px-3 text-right">Units</th>
                            <th className="py-2.5 px-3 text-right">Revenue</th>
                            <th className="py-2.5 px-3 text-right">Variable Cost</th>
                            <th className="py-2.5 px-3 text-right">Fixed Cost</th>
                            <th className="py-2.5 px-3 text-right">Contrib. Margin %</th>
                            <th className="py-2.5 px-3 text-right">Gross Profit</th>
                            <th className="py-2.5 px-3 text-right">Gross Margin %</th>
                            <th className="py-2.5 px-3 text-right">BEP Units</th>
                            <th className="py-2.5 px-3 text-right">Margin Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-mono tabular-nums">
                          {productProfitability.map((p) => (
                            <tr
                              key={p.productId}
                              onClick={() => setCvpFocusProductId(p.productId)}
                              className={`cursor-pointer transition-colors ${
                                cvpFocusProductId === p.productId
                                  ? 'bg-amber-500/10'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              <td className="py-3 px-3 font-sans">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                  {p.productName}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {p.productId} · {p.sector} · {p.productionLine}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right">{p.unitsProduced}</td>
                              <td className="py-3 px-3 text-right">
                                {formatMoney(p.revenue, true)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {formatMoney(p.variableCost, true)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {formatMoney(p.fixedCost, true)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {p.contributionMarginPct.toFixed(1)}%
                              </td>
                              <td
                                className={`py-3 px-3 text-right font-semibold ${
                                  p.grossProfit >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {formatMoney(p.grossProfit, true)}
                              </td>
                              <td
                                className={`py-3 px-3 text-right font-bold ${
                                  p.grossMarginPct < 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : p.grossMarginPct < 12
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {p.grossMarginPct.toFixed(2)}%
                              </td>
                              <td className="py-3 px-3 text-right">
                                {p.breakEvenUnits.toFixed(1)}
                              </td>
                              <td className="py-3 px-3 text-right font-sans font-medium">
                                <span
                                  className={
                                    p.marginTier === 'Loss-Making'
                                      ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                      : p.marginTier === 'Low Margin'
                                      ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                      : 'text-emerald-600 dark:text-emerald-400'
                                  }
                                >
                                  {p.marginTier}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ====================================================================
                  MODULE 4: COST OPTIMISATION ENGINE
              ==================================================================== */}
              {activeModule === 'optimisation' && (
                <div className="space-y-6">
                  {/* 6 Inefficiency Vector Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
                    {optimisationResult.categorySummary.map((vec) => (
                      <div
                        key={vec.category}
                        className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      >
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {vec.incidentCount} Actionable Lines
                        </div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-1">
                          {vec.category}
                        </div>
                        <div className="text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1.5">
                          {formatMoney(vec.recoverableAnnualSavingsUsd, true)}/yr
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-1">
                          Excess Base: {formatMoney(vec.totalExcessCostUsd, true)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Capital Budgeting Chart: Savings vs Payback Period & Category Share */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Capital Budgeting Matrix: Payback Period (Months) vs. Annual Savings ($)
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        Bubble size proportional to 3-Year Net Present Value (NPV @ 10% WACC)
                      </p>
                      <PlotlyChart
                        isDark={isDark}
                        height={320}
                        data={[
                          {
                            x: optimisationResult.recommendations.map(
                              (r) => r.paybackPeriodMonths
                            ),
                            y: optimisationResult.recommendations.map(
                              (r) => r.estimatedAnnualSavingsUsd
                            ),
                            text: optimisationResult.recommendations.map(
                              (r) =>
                                `#${r.rank} ${r.code}: ${r.title}<br>Savings: $${r.estimatedAnnualSavingsUsd.toLocaleString()}/yr | Payback: ${r.paybackPeriodMonths} mo`
                            ),
                            mode: 'markers',
                            type: 'scatter',
                            name: 'Optimisation Initiatives',
                            marker: {
                              size: optimisationResult.recommendations.map((r) =>
                                Math.max(12, Math.min(36, Math.sqrt(r.threeYearNpvUsd) / 38))
                              ),
                              color: optimisationResult.recommendations.map((r) =>
                                r.priority === 'Critical'
                                  ? '#ef4444'
                                  : r.priority === 'High'
                                  ? '#f59e0b'
                                  : '#10b981'
                              ),
                              opacity: 0.85,
                            },
                          },
                        ]}
                        layout={{
                          xaxis: { title: 'Payback Period (Months — Lower is Faster ROI)' },
                          yaxis: { title: 'Estimated Annual Savings (USD)' },
                        }}
                      />
                    </div>

                    <div className="lg:col-span-5 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Recoverable Annual Savings by Inefficiency Category
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        Quantifies annual cost-reduction potential across all 6 diagnostic pillars
                      </p>
                      <PlotlyChart
                        isDark={isDark}
                        height={320}
                        data={[
                          {
                            y: optimisationResult.categorySummary.map((c) => c.category),
                            x: optimisationResult.categorySummary.map(
                              (c) => c.recoverableAnnualSavingsUsd
                            ),
                            type: 'bar',
                            orientation: 'h',
                            marker: { color: '#f59e0b' },
                          },
                        ]}
                        layout={{
                          margin: { l: 175, r: 20, t: 20, b: 40 },
                          xaxis: { title: 'Annual Savings Potential (USD)' },
                        }}
                      />
                    </div>
                  </div>

                  {/* Ranked Cost-Reduction Recommendations Roadmap */}
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Ranked Cost-Reduction Recommendations &amp; Implementation Tracker
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Ranked by Estimated Annual Savings · Includes CapEx/OpEx Implementation Cost, Payback Period, 3-Year NPV @ 10% WACC, and Approval Workflow
                        </p>
                      </div>
                      <div className="text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold">
                        Total Portfolio Savings:{' '}
                        {formatMoney(
                          optimisationResult.recommendations.reduce(
                            (s, r) => s + r.estimatedAnnualSavingsUsd,
                            0
                          )
                        )}
                        /yr
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <th className="py-2.5 px-3">Rank</th>
                            <th className="py-2.5 px-3">Initiative, Diagnostic &amp; Engineering Action</th>
                            <th className="py-2.5 px-3">Inefficiency Vector</th>
                            <th className="py-2.5 px-3 text-right">Baseline vs Target</th>
                            <th className="py-2.5 px-3 text-right">Est. Annual Savings</th>
                            <th className="py-2.5 px-3 text-right">Impl. Cost</th>
                            <th className="py-2.5 px-3 text-right">Payback</th>
                            <th className="py-2.5 px-3 text-right">3-Yr NPV</th>
                            <th className="py-2.5 px-3 text-right">Priority</th>
                            <th className="py-2.5 px-3 text-right">Workflow Stage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                          {optimisationResult.recommendations.map((rec) => {
                            const currentStatus =
                              optStatuses[rec.code]?.status || 'Proposed';
                            return (
                              <tr
                                key={rec.code}
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                              >
                                <td className="py-3.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                                  #{rec.rank}
                                </td>
                                <td className="py-3.5 px-3 max-w-md">
                                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                                    {rec.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    {rec.diagnosticSummary}
                                  </div>
                                  <div className="text-[11px] text-slate-700 dark:text-slate-300 mt-1">
                                    <span className="font-semibold">Action: </span>
                                    {rec.engineeringAction}
                                  </div>
                                </td>
                                <td className="py-3.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                                  <div>{rec.category}</div>
                                  <div className="text-[11px] font-mono text-slate-500">
                                    {rec.plantId} · {rec.productionLine}
                                  </div>
                                </td>
                                <td className="py-3.5 px-3 text-right font-mono">
                                  <div className="text-rose-600 dark:text-rose-400">
                                    {rec.currentBaselineMetric}
                                  </div>
                                  <div className="text-emerald-600 dark:text-emerald-400 text-[11px]">
                                    → {rec.targetBenchmarkMetric}
                                  </div>
                                </td>
                                <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatMoney(rec.estimatedAnnualSavingsUsd)}/yr
                                </td>
                                <td className="py-3.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                  {formatMoney(rec.implementationCostUsd)}
                                </td>
                                <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                                  {rec.paybackPeriodMonths.toFixed(1)} mo
                                </td>
                                <td className="py-3.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                  {formatMoney(rec.threeYearNpvUsd, true)}
                                </td>
                                <td className="py-3.5 px-3 text-right font-mono font-semibold">
                                  <span
                                    className={
                                      rec.priority === 'Critical'
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : rec.priority === 'High'
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                    }
                                  >
                                    {rec.priority}
                                  </span>
                                </td>
                                <td className="py-3.5 px-3 text-right">
                                  <select
                                    aria-label={`Status for ${rec.code}`}
                                    value={currentStatus}
                                    onChange={(e) =>
                                      handleUpdateRecommendationStatus(
                                        rec.code,
                                        e.target.value as any
                                      )
                                    }
                                    className="px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium"
                                  >
                                    <option value="Proposed">Proposed</option>
                                    <option value="Approved">Approved</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Implemented">Implemented</option>
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Statistical Cost Outlier & Anomaly Detection Table */}
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                      Statistical Anomaly &amp; Abnormal Production Cost Detection Log (Z-Score &amp; SEC Outliers)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Flags monthly shop-floor records where unit production cost, specific energy consumption, or scrap rate breached statistical control limits
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <th className="py-2.5 px-3">Record ID</th>
                            <th className="py-2.5 px-3">Month</th>
                            <th className="py-2.5 px-3">Plant &amp; Product Line</th>
                            <th className="py-2.5 px-3">Detected Anomaly Vector</th>
                            <th className="py-2.5 px-3 text-right">Z-Score</th>
                            <th className="py-2.5 px-3 text-right">Observed Metric</th>
                            <th className="py-2.5 px-3 text-right">Engineering Benchmark</th>
                            <th className="py-2.5 px-3 text-right">Estimated Excess Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-mono tabular-nums">
                          {optimisationResult.anomalies.slice(0, 12).map((anom, i) => (
                            <tr
                              key={`${anom.recordId}_${anom.category}_${i}`}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            >
                              <td className="py-2.5 px-3 text-slate-500">{anom.recordId}</td>
                              <td className="py-2.5 px-3">{anom.month}</td>
                              <td className="py-2.5 px-3 font-sans">
                                <div className="font-medium text-slate-900 dark:text-slate-100">
                                  {anom.productName}
                                </div>
                                <div className="text-[11px] text-slate-500">{anom.plantName}</div>
                              </td>
                              <td className="py-2.5 px-3 font-sans text-amber-600 dark:text-amber-400 font-medium">
                                {anom.category}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                                +{anom.zScore.toFixed(2)}σ
                              </td>
                              <td className="py-2.5 px-3 text-right">{anom.actualMetricLabel}</td>
                              <td className="py-2.5 px-3 text-right text-slate-500">
                                {anom.benchmarkMetricLabel}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                                {formatMoney(anom.excessCostUsd)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ====================================================================
                  MODULE 5: SCENARIO SIMULATOR (WHAT-IF SENSITIVITY ENGINE)
              ==================================================================== */}
              {activeModule === 'simulator' && (
                <div className="space-y-6">
                  {/* Top Control Strip & Presets */}
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Multi-Variable Cost &amp; Profitability Scenario Simulator
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Adjust Raw Material prices, Energy tariffs, Volume, Direct Labour, Machine Utilisation, and Selling Prices to simulate P&amp;L impact
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() =>
                            setScenarioParams({
                              rawMaterialDeltaPct: 0,
                              energyDeltaPct: 0,
                              volumeDeltaPct: 0,
                              labourDeltaPct: 0,
                              utilisationTargetPct: Number(
                                executiveKPIs.avgMachineUtilisationPct.toFixed(1)
                              ),
                              sellingPriceDeltaPct: 0,
                            })
                          }
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Reset to Baseline
                        </button>
                        <button
                          onClick={() =>
                            setScenarioParams({
                              rawMaterialDeltaPct: -7,
                              energyDeltaPct: -10,
                              volumeDeltaPct: 8,
                              labourDeltaPct: 0,
                              utilisationTargetPct: 85,
                              sellingPriceDeltaPct: 3,
                            })
                          }
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                        >
                          Preset: Full Optimisation Target
                        </button>
                        <button
                          onClick={() =>
                            setScenarioParams({
                              rawMaterialDeltaPct: 14,
                              energyDeltaPct: 18,
                              volumeDeltaPct: -8,
                              labourDeltaPct: 6,
                              utilisationTargetPct: 68,
                              sellingPriceDeltaPct: 0,
                            })
                          }
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/25"
                        >
                          Preset: Commodity &amp; Energy Shock
                        </button>
                      </div>
                    </div>

                    {/* 6 Interactive Sliders */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2 border-t border-slate-200 dark:border-slate-800">
                      {/* 1. Raw Material Prices */}
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between text-xs mb-2">
                          <label
                            htmlFor="sim-rm"
                            className="font-semibold text-slate-800 dark:text-slate-200"
                          >
                            1. Raw Material Prices (Δ%)
                          </label>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            {scenarioParams.rawMaterialDeltaPct > 0 ? '+' : ''}
                            {scenarioParams.rawMaterialDeltaPct}%
                          </span>
                        </div>
                        <input
                          id="sim-rm"
                          type="range"
                          min={-30}
                          max={40}
                          step={1}
                          value={scenarioParams.rawMaterialDeltaPct}
                          onChange={(e) =>
                            setScenarioParams((p) => ({
                              ...p,
                              rawMaterialDeltaPct: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-amber-500"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                          <span>-30% Deflation</span>
                          <span>0% Base</span>
                          <span>+40% Spike</span>
                        </div>
                      </div>

                      {/* 2. Energy & Electricity Tariffs */}
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between text-xs mb-2">
                          <label
                            htmlFor="sim-energy"
                            className="font-semibold text-slate-800 dark:text-slate-200"
                          >
                            2. Energy &amp; Electricity Cost (Δ%)
                          </label>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            {scenarioParams.energyDeltaPct > 0 ? '+' : ''}
                            {scenarioParams.energyDeltaPct}%
                          </span>
                        </div>
                        <input
                          id="sim-energy"
                          type="range"
                          min={-30}
                          max={40}
                          step={1}
                          value={scenarioParams.energyDeltaPct}
                          onChange={(e) =>
                            setScenarioParams((p) => ({
                              ...p,
                              energyDeltaPct: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-amber-500"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                          <span>-30% Solar/Recuperation</span>
                          <span>0% Base</span>
                          <span>+40% Tariff</span>
                        </div>
                      </div>

                      {/* 3. Production Volume */}
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between text-xs mb-2">
                          <label
                            htmlFor="sim-vol"
                            className="font-semibold text-slate-800 dark:text-slate-200"
                          >
                            3. Production Volume (Δ%)
                          </label>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            {scenarioParams.volumeDeltaPct > 0 ? '+' : ''}
                            {scenarioParams.volumeDeltaPct}%
                          </span>
                        </div>
                        <input
                          id="sim-vol"
                          type="range"
                          min={-30}
                          max={40}
                          step={1}
                          value={scenarioParams.volumeDeltaPct}
                          onChange={(e) =>
                            setScenarioParams((p) => ({
                              ...p,
                              volumeDeltaPct: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-amber-500"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                          <span>-30% Contraction</span>
                          <span>0% Base</span>
                          <span>+40% Expansion</span>
                        </div>
                      </div>

                      {/* 4. Direct Labour Costs */}
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between text-xs mb-2">
                          <label
                            htmlFor="sim-labour"
                            className="font-semibold text-slate-800 dark:text-slate-200"
                          >
                            4. Direct Labour Rate (Δ%)
                          </label>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            {scenarioParams.labourDeltaPct > 0 ? '+' : ''}
                            {scenarioParams.labourDeltaPct}%
                          </span>
                        </div>
                        <input
                          id="sim-labour"
                          type="range"
                          min={-25}
                          max={35}
                          step={1}
                          value={scenarioParams.labourDeltaPct}
                          onChange={(e) =>
                            setScenarioParams((p) => ({
                              ...p,
                              labourDeltaPct: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-amber-500"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                          <span>-25% Automation</span>
                          <span>0% Base</span>
                          <span>+35% Wage Hike</span>
                        </div>
                      </div>

                      {/* 5. Machine Utilisation Target */}
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between text-xs mb-2">
                          <label
                            htmlFor="sim-util"
                            className="font-semibold text-slate-800 dark:text-slate-200"
                          >
                            5. Machine Utilisation Target (%)
                          </label>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            {scenarioParams.utilisationTargetPct}%
                          </span>
                        </div>
                        <input
                          id="sim-util"
                          type="range"
                          min={50}
                          max={95}
                          step={1}
                          value={scenarioParams.utilisationTargetPct}
                          onChange={(e) =>
                            setScenarioParams((p) => ({
                              ...p,
                              utilisationTargetPct: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-amber-500"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                          <span>50% Idle</span>
                          <span>Base: {executiveKPIs.avgMachineUtilisationPct.toFixed(0)}%</span>
                          <span>95% World-Class</span>
                        </div>
                      </div>

                      {/* 6. Selling Prices */}
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between text-xs mb-2">
                          <label
                            htmlFor="sim-price"
                            className="font-semibold text-slate-800 dark:text-slate-200"
                          >
                            6. Equipment Selling Prices (Δ%)
                          </label>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            {scenarioParams.sellingPriceDeltaPct > 0 ? '+' : ''}
                            {scenarioParams.sellingPriceDeltaPct}%
                          </span>
                        </div>
                        <input
                          id="sim-price"
                          type="range"
                          min={-25}
                          max={30}
                          step={1}
                          value={scenarioParams.sellingPriceDeltaPct}
                          onChange={(e) =>
                            setScenarioParams((p) => ({
                              ...p,
                              sellingPriceDeltaPct: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-amber-500"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                          <span>-25% Discount</span>
                          <span>0% Base</span>
                          <span>+30% Repricing</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Simulated Impact KPI Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs text-slate-500">Simulated Total Cost</div>
                      <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                        {formatMoney(scenarioComparison.simulated.totalProductionCost, true)}
                      </div>
                      <div
                        className={`text-[11px] font-mono mt-1 ${
                          scenarioComparison.deltas.totalCostDeltaUsd <= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {scenarioComparison.deltas.totalCostDeltaUsd > 0 ? '+' : ''}
                        {formatMoney(scenarioComparison.deltas.totalCostDeltaUsd, true)} (
                        {scenarioComparison.deltas.totalCostDeltaPct.toFixed(1)}%)
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs text-slate-500">Simulated Revenue</div>
                      <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                        {formatMoney(scenarioComparison.simulated.totalRevenue, true)}
                      </div>
                      <div className="text-[11px] font-mono text-sky-600 dark:text-sky-400 mt-1">
                        {scenarioComparison.deltas.revenueDeltaUsd >= 0 ? '+' : ''}
                        {formatMoney(scenarioComparison.deltas.revenueDeltaUsd, true)} (
                        {scenarioComparison.deltas.revenueDeltaPct.toFixed(1)}%)
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs text-slate-500">Simulated Gross Profit</div>
                      <div
                        className={`text-xl font-bold font-mono tabular-nums mt-1 ${
                          scenarioComparison.simulated.grossProfit >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatMoney(scenarioComparison.simulated.grossProfit, true)}
                      </div>
                      <div
                        className={`text-[11px] font-mono font-semibold mt-1 ${
                          scenarioComparison.deltas.grossProfitDeltaUsd >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        Net Impact:{' '}
                        {scenarioComparison.deltas.grossProfitDeltaUsd >= 0 ? '+' : ''}
                        {formatMoney(scenarioComparison.deltas.grossProfitDeltaUsd, true)}
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs text-slate-500">Simulated Gross Margin</div>
                      <div className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                        {scenarioComparison.simulated.grossMarginPct.toFixed(2)}%
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-1">
                        {scenarioComparison.deltas.grossMarginDeltaPts >= 0 ? '+' : ''}
                        {scenarioComparison.deltas.grossMarginDeltaPts.toFixed(2)} pts vs Base (
                        {scenarioComparison.baseline.grossMarginPct.toFixed(1)}%)
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs text-slate-500">Simulated Cost / Unit</div>
                      <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                        {formatMoney(scenarioComparison.simulated.costPerUnit)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-1">
                        {scenarioComparison.deltas.costPerUnitDeltaUsd >= 0 ? '+' : ''}
                        {formatMoney(scenarioComparison.deltas.costPerUnitDeltaUsd)} / unit
                      </div>
                    </div>
                  </div>

                  {/* Charts: Profit Bridge Waterfall & Tornado Sensitivity */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Gross Profit Bridge Waterfall (Baseline → Simulated Profit)
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        Decomposes the exact profit variance contributed by Volume/Price, Raw Materials, Labour, Energy, and Utilisation
                      </p>
                      <PlotlyChart
                        isDark={isDark}
                        height={320}
                        data={[
                          {
                            type: 'waterfall',
                            orientation: 'v',
                            x: scenarioComparison.waterfallBridge.map((w) => w.step),
                            y: scenarioComparison.waterfallBridge.map((w) => w.valueUsd),
                            measure: scenarioComparison.waterfallBridge.map((w) => w.measure),
                            decreasing: { marker: { color: '#ef4444' } },
                            increasing: { marker: { color: '#10b981' } },
                            totals: { marker: { color: '#f59e0b' } },
                          },
                        ]}
                        layout={{
                          yaxis: { title: 'Gross Profit (USD)' },
                        }}
                      />
                    </div>

                    <div className="lg:col-span-5 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Tornado Sensitivity Analysis (±10% Ceteris Paribus Swing)
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        Ranks parameters by absolute dollar impact on Gross Profit for a ±10% change
                      </p>
                      <PlotlyChart
                        isDark={isDark}
                        height={320}
                        data={[
                          {
                            y: scenarioComparison.tornadoSensitivity.map((t) => t.lever),
                            x: scenarioComparison.tornadoSensitivity.map(
                              (t) => t.downside10PctProfitImpactUsd
                            ),
                            name: 'Adverse 10% Swing',
                            type: 'bar',
                            orientation: 'h',
                            marker: { color: '#ef4444' },
                          },
                          {
                            y: scenarioComparison.tornadoSensitivity.map((t) => t.lever),
                            x: scenarioComparison.tornadoSensitivity.map(
                              (t) => t.upside10PctProfitImpactUsd
                            ),
                            name: 'Favorable 10% Swing',
                            type: 'bar',
                            orientation: 'h',
                            marker: { color: '#10b981' },
                          },
                        ]}
                        layout={{
                          barmode: 'relative',
                          margin: { l: 155, r: 20, t: 20, b: 40 },
                          xaxis: { title: 'Gross Profit Impact (USD)' },
                          yaxis: { autorange: 'reversed' },
                        }}
                      />
                    </div>
                  </div>

                  {/* Save Scenario & Saved Scenarios Comparison */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Save Scenario Snapshot to Database
                      </h2>
                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="block text-slate-500 mb-1">Scenario Name</label>
                          <input
                            type="text"
                            value={scenarioNameInput}
                            onChange={(e) => setScenarioNameInput(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">
                            Assumptions &amp; Notes
                          </label>
                          <textarea
                            rows={2}
                            value={scenarioDescInput}
                            onChange={(e) => setScenarioDescInput(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <button
                          onClick={handleSaveScenarioSnapshot}
                          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 font-medium hover:opacity-90"
                        >
                          <BookmarkPlus className="w-4 h-4" />
                          Save Scenario Snapshot
                        </button>
                      </div>

                      {savedScenarios.length > 0 && (
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Saved Scenarios ({savedScenarios.length})
                          </div>
                          {savedScenarios.map((s) => (
                            <div
                              key={s.id}
                              className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2 text-xs"
                            >
                              <div
                                onClick={() =>
                                  setScenarioParams({
                                    rawMaterialDeltaPct: s.rawMaterialDeltaPct,
                                    energyDeltaPct: s.energyDeltaPct,
                                    volumeDeltaPct: s.volumeDeltaPct,
                                    labourDeltaPct: s.labourDeltaPct,
                                    utilisationTargetPct: s.utilisationTargetPct,
                                    sellingPriceDeltaPct: s.sellingPriceDeltaPct,
                                  })
                                }
                                className="cursor-pointer flex-1 truncate"
                              >
                                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                  {s.name}
                                </div>
                                <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                                  Sim GM: {s.projectedGrossMarginPct}% | ΔProfit:{' '}
                                  {formatMoney(s.projectedAnnualSavingsUsd, true)}
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteScenario(s.id)}
                                className="p-1 text-slate-400 hover:text-rose-500"
                                title="Delete scenario"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Product-by-Product Simulated Margin Table */}
                    <div className="lg:col-span-7 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        Product-Wise Baseline vs. Simulated Profitability Impact
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        Shows how the active scenario transforms unit economics across all 8 equipment lines
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                              <th className="py-2 px-3">Product Line</th>
                              <th className="py-2 px-3 text-right">Baseline GM %</th>
                              <th className="py-2 px-3 text-right">Simulated GM %</th>
                              <th className="py-2 px-3 text-right">Baseline Profit</th>
                              <th className="py-2 px-3 text-right">Simulated Profit</th>
                              <th className="py-2 px-3 text-right">Net Profit Δ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-mono tabular-nums">
                            {scenarioComparison.simulatedProducts.map((sp) => (
                              <tr
                                key={sp.productId}
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                              >
                                <td className="py-2.5 px-3 font-sans">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {sp.productName}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500">
                                    {sp.productId} · {sp.sector}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {sp.baselineMarginPct.toFixed(1)}%
                                </td>
                                <td
                                  className={`py-2.5 px-3 text-right font-bold ${
                                    sp.simulatedMarginPct < 0
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {sp.simulatedMarginPct.toFixed(1)}%
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {formatMoney(sp.baselineProfitUsd, true)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold">
                                  {formatMoney(sp.simulatedProfitUsd, true)}
                                </td>
                                <td
                                  className={`py-2.5 px-3 text-right font-semibold ${
                                    sp.profitDeltaUsd >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {sp.profitDeltaUsd >= 0 ? '+' : ''}
                                  {formatMoney(sp.profitDeltaUsd, true)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ====================================================================
                  MODULE 6: FINANCIAL REPORTING & GRANULAR COST LEDGER
              ==================================================================== */}
              {activeModule === 'reporting' && (
                <div className="space-y-6">
                  {/* Export Cards: Excel, PDF, SQL & Python */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                          MULTI-SHEET WORKBOOK (.XLSX)
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                          Executive Excel Financial Pack
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          7 structured tabs: Executive KPIs, 7-Category Cost Breakdown, Product CVP Matrix, Plant Ledger, Ranked Optimisation Roadmap, Monthly Ledger, and Model Assumptions.
                        </p>
                      </div>
                      <button
                        onClick={handleTriggerExcelExport}
                        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download Excel Workbook (.xlsx)
                      </button>
                    </div>

                    <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-mono text-amber-600 dark:text-amber-400">
                          BOARD PRESENTATION (.PDF)
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                          Management Profitability &amp; Savings Brief
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          2-page landscape PDF containing executive KPI summary, 7-category cost table, product profitability matrix, and capital payback schedule.
                        </p>
                      </div>
                      <button
                        onClick={handleTriggerPdfExport}
                        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Download Executive PDF (.pdf)
                      </button>
                    </div>

                    <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-mono text-sky-600 dark:text-sky-400">
                          POSTGRESQL SCHEMA &amp; VIEWS (.SQL)
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                          Reproducible PostgreSQL Setup
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Complete DDL tables (<code className="font-mono">plants</code>, <code className="font-mono">products</code>, <code className="font-mono">monthly_production_costs</code>) and CVP analytical views (<code className="font-mono">vw_product_profitability_cvp</code>).
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const sqlRows = filteredRecords
                            .slice(0, 25)
                            .map(
                              (r) =>
                                `INSERT INTO monthly_production_costs VALUES ('${r.id}', '${r.month}', '${r.plantId}', '${r.productId}', ${r.unitsProduced}, ${r.sellingPricePerUnit}, ${r.revenue}, ${r.budgetedCost}, ${r.rawMaterialCost}, ${r.directLabourCost}, ${r.energyCost}, ${r.maintenanceCost}, ${r.logisticsCost}, ${r.inventoryHoldingCost}, ${r.overheadCost}, ${r.machineHoursAvailable}, ${r.machineHoursUsed}, ${r.rawMaterialInputTons}, ${r.rawMaterialNetTons}, ${r.energyKwhConsumed}, NOW());`
                            )
                            .join('\n');
                          downloadTextArtifact(
                            'schema_and_seed.sql',
                            `-- PostgreSQL Reproducible DDL & Sample Seed\n-- Generated from Manufacturing Cost Optimisation Platform\n\n${sqlRows}\n`
                          );
                          showBanner('Downloaded reproducible PostgreSQL script (schema_and_seed.sql).');
                        }}
                        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download PostgreSQL Setup (.sql)
                      </button>
                    </div>

                    <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                          FORMULA &amp; TEST VERIFICATION
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                          KPI Formula &amp; Unit Test Suite
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Inspect all documented accounting &amp; operations research equations and execute the 8-test automated verification suite.
                        </p>
                      </div>
                      <button
                        onClick={() => setIsFormulaModalOpen(true)}
                        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Calculator className="w-4 h-4" />
                        Open Formula &amp; Test Audit
                      </button>
                    </div>
                  </div>

                  {/* Granular Monthly Production & Cost Ledger Table */}
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Granular Monthly Production &amp; Cost Database Ledger ({filteredRecords.length} Records)
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Showing database records backing all executive KPIs, cost breakdowns, and optimisation models
                        </p>
                      </div>
                      <button
                        onClick={() => setIsRecordModalOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Log / Edit Monthly Record
                      </button>
                    </div>

                    <div className="overflow-x-auto max-h-[480px]">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 z-10">
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <th className="py-2.5 px-3">Month</th>
                            <th className="py-2.5 px-3">Plant &amp; Product</th>
                            <th className="py-2.5 px-3 text-right">Units</th>
                            <th className="py-2.5 px-3 text-right">Revenue</th>
                            <th className="py-2.5 px-3 text-right">Raw Mat.</th>
                            <th className="py-2.5 px-3 text-right">Labour</th>
                            <th className="py-2.5 px-3 text-right">Energy</th>
                            <th className="py-2.5 px-3 text-right">Maint.</th>
                            <th className="py-2.5 px-3 text-right">Total Cost</th>
                            <th className="py-2.5 px-3 text-right">Gross Margin</th>
                            <th className="py-2.5 px-3 text-right">Util %</th>
                            <th className="py-2.5 px-3 text-right">Scrap %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-mono tabular-nums">
                          {filteredRecords.map((rec) => {
                            const m = computeRecordMetrics(rec);
                            return (
                              <tr
                                key={rec.id}
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                              >
                                <td className="py-2.5 px-3">{rec.month}</td>
                                <td className="py-2.5 px-3 font-sans">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {rec.productName}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500">
                                    {rec.plantId} · {rec.sector}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right">{rec.unitsProduced}</td>
                                <td className="py-2.5 px-3 text-right">
                                  {formatMoney(rec.revenue, true)}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {formatMoney(rec.rawMaterialCost, true)}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {formatMoney(rec.directLabourCost, true)}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {formatMoney(rec.energyCost, true)}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {formatMoney(rec.maintenanceCost, true)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold">
                                  {formatMoney(m.totalCost, true)}
                                </td>
                                <td
                                  className={`py-2.5 px-3 text-right font-bold ${
                                    m.grossMarginPct < 0
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : m.grossMarginPct < 12
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {m.grossMarginPct.toFixed(1)}%
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {m.machineUtilisationPct.toFixed(0)}%
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {m.scrapRatePct.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* QUIET EDITORIAL FOOTER */}
        <footer className="px-6 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Manufacturing Cost Optimisation &amp; Profitability Intelligence Platform · Independent Portfolio Decision-Support System
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsFormulaModalOpen(true)}
              className="hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-2"
            >
              KPI Formulas &amp; Assumptions
            </button>
            <button
              onClick={handleTriggerExcelExport}
              className="hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-2"
            >
              Export Excel (.xlsx)
            </button>
            <button
              onClick={handleTriggerPdfExport}
              className="hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-2"
            >
              Export PDF (.pdf)
            </button>
          </div>
        </footer>
      </div>

      {/* MODALS */}
      <FormulaAuditModal
        isOpen={isFormulaModalOpen}
        onClose={() => setIsFormulaModalOpen(false)}
      />
      <RecordEntryModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSaveRecord={handleSaveProductionRecord}
      />
    </div>
  );
}
