import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Play, FileCode2, Calculator, Database } from 'lucide-react';
import { KPI_FORMULA_REGISTRY } from '../engine/analyticsEngine';
import { DOCUMENTED_ASSUMPTIONS } from '../data/industrialSeedData';
import { runAutomatedVerificationSuite, VerificationTestResult } from '../engine/selfTestSuite';

interface FormulaAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FormulaAuditModal: React.FC<FormulaAuditModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'formulas' | 'assumptions' | 'tests' | 'sql_python'>('formulas');
  const [testResults, setTestResults] = useState<VerificationTestResult[]>(() =>
    runAutomatedVerificationSuite()
  );

  if (!isOpen) return null;

  const handleRerunTests = () => {
    setTestResults(runAutomatedVerificationSuite());
  };

  const allPassed = testResults.every((t) => t.passed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-5xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Engineering &amp; Financial Formula Audit, Assumptions &amp; Automated Verification
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Zero hardcoded KPIs · Database-backed calculations · Explicit CVP &amp; Operations Research definitions
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('formulas')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'formulas'
                ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            KPI Formula Registry ({KPI_FORMULA_REGISTRY.length})
          </button>
          <button
            onClick={() => setActiveTab('assumptions')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'assumptions'
                ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Industrial &amp; Accounting Assumptions ({DOCUMENTED_ASSUMPTIONS.length})
          </button>
          <button
            onClick={() => setActiveTab('tests')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'tests'
                ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            Automated Calculation Test Suite ({testResults.filter((t) => t.passed).length}/{testResults.length} Passed)
          </button>
          <button
            onClick={() => setActiveTab('sql_python')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'sql_python'
                ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            Python (Scikit-Learn) &amp; PostgreSQL Architecture
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'formulas' && (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <th className="py-3 px-4">KPI Name</th>
                    <th className="py-3 px-4">Symbol</th>
                    <th className="py-3 px-4">Mathematical Formula</th>
                    <th className="py-3 px-4">Unit</th>
                    <th className="py-3 px-4">Module</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {KPI_FORMULA_REGISTRY.map((item) => (
                    <tr
                      key={item.kpi}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {item.kpi}
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-700 dark:text-amber-400">
                        {item.symbol}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {item.formula}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {item.unit}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {item.module}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'assumptions' && (
            <div className="space-y-3">
              {DOCUMENTED_ASSUMPTIONS.map((asm) => (
                <div
                  key={asm.code}
                  className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/40"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">
                      {asm.code} · {asm.category}
                    </span>
                    <span className="font-mono">{asm.formula}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {asm.rationale}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tests' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950/50">
                <div className="flex items-center gap-3">
                  {allPassed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {allPassed
                        ? 'All 8 Automated Calculation & Operations Research Invariants Verified'
                        : 'Verification Warning Detected'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Executes deterministic assertions against Cost Accounting, CVP Break-Even, Scrap Yield, Ranking Monotonicity, and Scenario Elasticity.
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleRerunTests}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-amber-500 dark:text-slate-950 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  Re-Run Verification Suite
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Test Suite &amp; Invariant</th>
                      <th className="py-2.5 px-3">Formula Audited</th>
                      <th className="py-2.5 px-3">Expected</th>
                      <th className="py-2.5 px-3">Actual Computed</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {testResults.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono text-slate-500">{t.id}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{t.name}</div>
                          <div className="text-slate-500 dark:text-slate-400">{t.suite}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                          {t.formulaTested}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {t.expected}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                          {t.actual}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">
                          {t.passed ? (
                            <span className="text-emerald-600 dark:text-emerald-400">PASS</span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400">FAIL</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'sql_python' && (
            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950/60">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Hybrid Cloud Persistence &amp; Reproducible Analytical Pipeline
                </h3>
                <p className="leading-relaxed text-slate-600 dark:text-slate-400">
                  Live interactive state is persisted in real time via Google Cloud Firestore (with Zero-Trust ABAC security rules in <code className="font-mono">firestore.rules</code>), while the repository includes the complete reproducible PostgreSQL DDL &amp; CVP View (<code className="font-mono">analytics/schema_and_seed.sql</code>) and Python Pandas / NumPy / Scikit-Learn Ridge Regression &amp; Isolation Forest pipeline (<code className="font-mono">analytics/cost_optimisation_pipeline.py</code>).
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto">
                  <div className="text-amber-400 font-semibold mb-2">
                    analytics/cost_optimisation_pipeline.py (Scikit-Learn + Pandas)
                  </div>
                  <pre>{`# Ridge Regression Expected Cost & IsolationForest Anomaly Engine
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X_operational_drivers)

ridge = Ridge(alpha=1.0, random_state=42)
ridge.fit(X_scaled, y_unit_cost)
df["expected_cost_per_unit"] = ridge.predict(X_scaled)
df["cost_residual_usd"] = df["cost_per_unit"] - df["expected_cost_per_unit"]

iso = IsolationForest(contamination=0.10, random_state=42)
df["is_anomaly"] = iso.fit_predict(
    df[["cost_residual_usd", "scrap_rate_pct", "energy_excess_pct"]]
) == -1`}</pre>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto">
                  <div className="text-emerald-400 font-semibold mb-2">
                    analytics/schema_and_seed.sql (PostgreSQL CVP View)
                  </div>
                  <pre>{`CREATE OR REPLACE VIEW vw_product_profitability_cvp AS
SELECT
  product_id, product_name, sector, plant_name,
  (total_revenue - total_actual_cost) AS gross_profit,
  ROUND(((total_revenue - total_actual_cost)
    / NULLIF(total_revenue, 0)) * 100.0, 2) AS gross_margin_pct,
  ROUND(total_fixed_cost / NULLIF(
    (total_revenue - total_variable_cost) / NULLIF(total_revenue, 0), 0
  ), 2) AS break_even_revenue_usd
FROM base_agg;`}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
