# Manufacturing Cost Optimisation & Profitability Intelligence Platform

An enterprise-grade industrial decision-support, cost accounting, and operations research platform designed for heavy engineering and process manufacturing enterprises across **Cement Systems**, **Sugar Processing**, **Mining & Material Handling**, and **Thermal Energy**.

> **Disclaimer**: This application uses synthetic industrial manufacturing data inspired by heavy engineering sectors. It is an independent portfolio project and is not affiliated with, endorsed by, or connected to TKIL Industries or any commercial entity.

---

## 1. System Architecture

1. **Interactive Web Application & Decision-Support Engine (`src/engine/analyticsEngine.ts` + `src/App.tsx`)**:
   - Built with **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Plotly.js (`plotly.js-dist-min`)**.
   - **Zero Hardcoded KPIs**: Every metric, chart, Cost-Volume-Profit (CVP) break-even curve, Z-score anomaly, and scenario projection is dynamically computed from the underlying database records.
2. **Cloud Persistence & Security (`firebase-blueprint.json`, `firestore.rules`, `src/lib/firebase.ts`)**:
   - Real-time persistence via **Google Cloud Firestore** and **Firebase Authentication** (`/production_records`, `/saved_scenarios`, `/optimisation_statuses`).
   - Hardened Zero-Trust Attribute-Based Access Control (ABAC) security rules verified with `@firebase/eslint-plugin-security-rules` and a 12-payload adversarial test suite (`firestore.rules.test.ts`).
3. **Reproducible Python Data Science & PostgreSQL Pipeline (`analytics/`)**:
   - `analytics/cost_optimisation_pipeline.py`: Implements **Pandas**, **NumPy**, and **Scikit-Learn** (`Ridge` regression for expected unit cost modeling and `IsolationForest` for multi-dimensional cost/energy/scrap anomaly detection).
   - `analytics/schema_and_seed.sql`: Reproducible **PostgreSQL** DDL schema (`plants`, `products`, `monthly_production_costs`) with check constraints and analytical CVP view (`vw_product_profitability_cvp`).
4. **Automated Financial Reporting (`src/services/reportExportService.ts`)**:
   - Generates multi-sheet **Excel (`.xlsx`)** workbooks (7 structured sheets) and board-ready landscape **PDF (`.pdf`)** reports.

---

## 2. Mathematical & Cost Accounting Formulas

| KPI / Model | Mathematical Formula |
| :--- | :--- |
| **Total Production Cost ($C_{\text{total}}$)** | $\sum (C_{\text{RM}} + C_{\text{DL}} + C_{\text{EN}} + C_{\text{MN}} + C_{\text{LG}} + C_{\text{IH}} + C_{\text{OH}})$ |
| **Variable Cost Partition ($C_{\text{var}}$)** | $C_{\text{RM}} + C_{\text{DL}} + C_{\text{EN}} + C_{\text{LG}} + 0.40 \cdot C_{\text{MN}}$ |
| **Fixed Cost Partition ($C_{\text{fix}}$)** | $C_{\text{OH}} + C_{\text{IH}} + 0.60 \cdot C_{\text{MN}}$ |
| **Gross Profit & Gross Margin %** | $\text{GP} = R - C_{\text{total}}, \quad \text{GM\%} = \frac{R - C_{\text{total}}}{R} \times 100$ |
| **Cost Per Unit Produced ($\text{CPU}$)** | $\text{CPU} = \frac{C_{\text{total}}}{\sum Q}$ |
| **Budget Variance ($\Delta B, \Delta B\%$)** | $\Delta B = C_{\text{actual}} - C_{\text{budget}}, \quad \Delta B\% = \frac{C_{\text{actual}} - C_{\text{budget}}}{C_{\text{budget}}} \times 100$ |
| **Contribution Margin & Ratio ($\text{CM}, \text{CMR}$)** | $\text{CM} = R - C_{\text{var}}, \quad \text{CMR} = \frac{\text{CM}}{R}$ |
| **Break-Even Point ($\text{BEP}_{\text{units}}, \text{BEP}_{\text{rev}}$)** | $\text{BEP}_{\text{units}} = \frac{C_{\text{fix}}}{P_{\text{unit}} - VC_{\text{unit}}}, \quad \text{BEP}_{\text{rev}} = \frac{C_{\text{fix}}}{\text{CMR}}$ |
| **Margin of Safety ($\text{MoS\%}$)** | $\text{MoS\%} = \frac{R - \text{BEP}_{\text{rev}}}{R} \times 100$ |
| **Degree of Operating Leverage ($\text{DOL}$)** | $\text{DOL} = \frac{\text{CM}}{\text{Gross Profit}}$ |
| **Capital Payback & 3-Yr NPV (10% WACC)** | $\text{Payback (Months)} = \frac{\text{Impl. Cost}}{\text{Annual Savings}} \times 12, \quad \text{NPV} = \sum_{t=1}^{3} \frac{\text{Savings}}{(1.10)^t} - \text{Impl. Cost}$ |

---

## 3. Running Automated Tests

```bash
# Run the Vitest unit test suites (Analytical Calculations + Security Rule Invariants)
npx vitest run

# Run ESLint Firestore Security Rules verification
npx eslint firestore.rules
```
