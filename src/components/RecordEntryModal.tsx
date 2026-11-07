import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import {
  PRODUCTS_CATALOG,
  ProductionRecordItem,
} from '../data/industrialSeedData';

interface RecordEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveRecord: (record: Omit<ProductionRecordItem, 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export const RecordEntryModal: React.FC<RecordEntryModalProps> = ({
  isOpen,
  onClose,
  onSaveRecord,
}) => {
  const [selectedProductId, setSelectedProductId] = useState(PRODUCTS_CATALOG[0].productId);
  const [month, setMonth] = useState('2026-10');
  const [unitsProduced, setUnitsProduced] = useState(4);
  const [sellingPricePerUnit, setSellingPricePerUnit] = useState(685000);
  const [budgetedCost, setBudgetedCost] = useState(1980000);
  const [rawMaterialCost, setRawMaterialCost] = useState(992000);
  const [directLabourCost, setDirectLabourCost] = useState(256000);
  const [energyCost, setEnergyCost] = useState(184000);
  const [maintenanceCost, setMaintenanceCost] = useState(116000);
  const [logisticsCost, setLogisticsCost] = useState(152000);
  const [inventoryHoldingCost, setInventoryHoldingCost] = useState(88000);
  const [overheadCost, setOverheadCost] = useState(216000);
  const [machineHoursAvailable, setMachineHoursAvailable] = useState(720);
  const [machineHoursUsed, setMachineHoursUsed] = useState(610);
  const [rawMaterialInputTons, setRawMaterialInputTons] = useState(635);
  const [rawMaterialNetTons, setRawMaterialNetTons] = useState(580);
  const [energyKwhConsumed, setEnergyKwhConsumed] = useState(1180000);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const selectedSpec =
    PRODUCTS_CATALOG.find((p) => p.productId === selectedProductId) || PRODUCTS_CATALOG[0];

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const spec = PRODUCTS_CATALOG.find((p) => p.productId === prodId);
    if (spec) {
      const u = spec.baseMonthlyUnits;
      setUnitsProduced(u);
      setSellingPricePerUnit(spec.sellingPricePerUnit);
      setBudgetedCost(u * spec.budgetedUnitCost);
      setRawMaterialCost(u * spec.baseRawMaterialUnit);
      setDirectLabourCost(u * spec.baseDirectLabourUnit);
      setEnergyCost(u * spec.baseEnergyUnit);
      setMaintenanceCost(u * spec.baseMaintenanceUnit);
      setLogisticsCost(u * spec.baseLogisticsUnit);
      setInventoryHoldingCost(u * spec.baseInventoryUnit);
      setOverheadCost(u * spec.baseOverheadUnit);
      setMachineHoursAvailable(spec.machineHoursAvailable);
      setMachineHoursUsed(Math.round(spec.machineHoursAvailable * spec.baseUtilisationRatio));
      const netT = u * spec.netWeightTonsPerUnit;
      setRawMaterialNetTons(netT);
      setRawMaterialInputTons(Math.round(netT / (1 - spec.baseScrapRatePct / 100)));
      setEnergyKwhConsumed(Math.round(u * spec.benchmarkEnergyKwhPerUnit * spec.actualEnergyMultiplier));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!/^202[0-9]-(0[1-9]|1[0-2])$/.test(month)) {
      setErrorMsg('Month must be in YYYY-MM format between 2020-01 and 2029-12.');
      return;
    }
    if (unitsProduced <= 0) {
      setErrorMsg('Units produced must be greater than zero.');
      return;
    }
    if (machineHoursUsed > machineHoursAvailable) {
      setErrorMsg('Machine hours used cannot exceed machine hours available.');
      return;
    }
    if (rawMaterialNetTons > rawMaterialInputTons) {
      setErrorMsg('Net finished tons cannot exceed gross raw material input tons.');
      return;
    }

    setIsSubmitting(true);
    try {
      const revenue = Math.round(unitsProduced * sellingPricePerUnit);
      const recordId = `REC_${month}_${selectedSpec.productId}`;
      await onSaveRecord({
        id: recordId,
        month,
        plantId: selectedSpec.plantId,
        plantName: selectedSpec.plantName,
        sector: selectedSpec.sector,
        productId: selectedSpec.productId,
        productName: selectedSpec.productName,
        productionLine: selectedSpec.productionLine,
        unitsProduced: Number(unitsProduced),
        sellingPricePerUnit: Number(sellingPricePerUnit),
        revenue,
        budgetedCost: Number(budgetedCost),
        rawMaterialCost: Number(rawMaterialCost),
        directLabourCost: Number(directLabourCost),
        energyCost: Number(energyCost),
        maintenanceCost: Number(maintenanceCost),
        logisticsCost: Number(logisticsCost),
        inventoryHoldingCost: Number(inventoryHoldingCost),
        overheadCost: Number(overheadCost),
        machineHoursAvailable: Number(machineHoursAvailable),
        machineHoursUsed: Number(machineHoursUsed),
        rawMaterialInputTons: Number(rawMaterialInputTons),
        rawMaterialNetTons: Number(rawMaterialNetTons),
        energyKwhConsumed: Number(energyKwhConsumed),
        benchmarkEnergyKwhPerUnit: selectedSpec.benchmarkEnergyKwhPerUnit,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save production record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const computedTotalCost =
    Number(rawMaterialCost) +
    Number(directLabourCost) +
    Number(energyCost) +
    Number(maintenanceCost) +
    Number(logisticsCost) +
    Number(inventoryHoldingCost) +
    Number(overheadCost);
  const computedRevenue = Number(unitsProduced) * Number(sellingPricePerUnit);
  const computedProfit = computedRevenue - computedTotalCost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Log / Update Monthly Production &amp; 7-Category Cost Record
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Validated against schema invariants and persisted to database
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Industrial Product Line
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              >
                {PRODUCTS_CATALOG.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.productId} — {p.productName} ({p.sector})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reporting Month (YYYY-MM)
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Units Produced
              </label>
              <input
                type="number"
                min={1}
                step="1"
                value={unitsProduced}
                onChange={(e) => setUnitsProduced(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Selling Price / Unit (USD)
              </label>
              <input
                type="number"
                min={1000}
                value={sellingPricePerUnit}
                onChange={(e) => setSellingPricePerUnit(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Budgeted Total Cost (USD)
              </label>
              <input
                type="number"
                min={1000}
                value={budgetedCost}
                onChange={(e) => setBudgetedCost(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
              7-Category Manufacturing Cost Breakdown (USD)
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Raw Material Cost', val: rawMaterialCost, set: setRawMaterialCost },
                { label: 'Direct Labour Cost', val: directLabourCost, set: setDirectLabourCost },
                { label: 'Energy & Electricity', val: energyCost, set: setEnergyCost },
                { label: 'Machine Maintenance', val: maintenanceCost, set: setMaintenanceCost },
                { label: 'Logistics & Freight', val: logisticsCost, set: setLogisticsCost },
                { label: 'Inventory Holding', val: inventoryHoldingCost, set: setInventoryHoldingCost },
                { label: 'Production Overheads', val: overheadCost, set: setOverheadCost },
              ].map((item) => (
                <div key={item.label}>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">
                    {item.label}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={item.val}
                    onChange={(e) => item.set(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Shop-Floor Operational Telemetry
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  Machine Hours Avail.
                </label>
                <input
                  type="number"
                  min={1}
                  value={machineHoursAvailable}
                  onChange={(e) => setMachineHoursAvailable(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  Machine Hours Used
                </label>
                <input
                  type="number"
                  min={0}
                  value={machineHoursUsed}
                  onChange={(e) => setMachineHoursUsed(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  Gross Input Steel (Tons)
                </label>
                <input
                  type="number"
                  min={1}
                  step="0.1"
                  value={rawMaterialInputTons}
                  onChange={(e) => setRawMaterialInputTons(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  Net Finished Weight (Tons)
                </label>
                <input
                  type="number"
                  min={1}
                  step="0.1"
                  value={rawMaterialNetTons}
                  onChange={(e) => setRawMaterialNetTons(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono">
            <div>
              <span className="text-slate-500">Computed Revenue: </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                ${computedRevenue.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Total Cost: </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                ${computedTotalCost.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Gross Profit: </span>
              <span
                className={`font-semibold ${
                  computedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                ${computedProfit.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSubmitting ? 'Saving...' : 'Save Production Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
