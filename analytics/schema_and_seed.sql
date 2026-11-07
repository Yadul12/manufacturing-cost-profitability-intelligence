-- =============================================================================
-- Manufacturing Cost Optimisation & Profitability Intelligence Platform
-- Reproducible PostgreSQL Schema & Analytical Views (DDL + Sample Seed)
-- =============================================================================

CREATE TABLE IF NOT EXISTS plants (
    plant_id VARCHAR(32) PRIMARY KEY,
    plant_name VARCHAR(120) NOT NULL,
    location VARCHAR(120) NOT NULL,
    annual_capacity_tons INTEGER NOT NULL CHECK (annual_capacity_tons > 0),
    iso_certifications VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    product_id VARCHAR(32) PRIMARY KEY,
    product_name VARCHAR(120) NOT NULL,
    sector VARCHAR(40) NOT NULL CHECK (
        sector IN ('Cement Systems', 'Sugar Processing', 'Mining & Material Handling', 'Thermal Energy')
    ),
    plant_id VARCHAR(32) NOT NULL REFERENCES plants(plant_id),
    production_line VARCHAR(64) NOT NULL,
    standard_selling_price_usd NUMERIC(14, 2) NOT NULL CHECK (standard_selling_price_usd > 0),
    standard_budget_unit_cost_usd NUMERIC(14, 2) NOT NULL CHECK (standard_budget_unit_cost_usd > 0),
    benchmark_energy_kwh_per_unit NUMERIC(14, 2) NOT NULL CHECK (benchmark_energy_kwh_per_unit > 0)
);

CREATE TABLE IF NOT EXISTS monthly_production_costs (
    record_id VARCHAR(64) PRIMARY KEY,
    month CHAR(7) NOT NULL CHECK (month ~ '^202[0-9]-(0[1-9]|1[0-2])$'),
    plant_id VARCHAR(32) NOT NULL REFERENCES plants(plant_id),
    product_id VARCHAR(32) NOT NULL REFERENCES products(product_id),
    units_produced NUMERIC(10, 2) NOT NULL CHECK (units_produced > 0),
    selling_price_per_unit NUMERIC(14, 2) NOT NULL CHECK (selling_price_per_unit > 0),
    revenue NUMERIC(16, 2) NOT NULL CHECK (revenue >= 0),
    budgeted_cost NUMERIC(16, 2) NOT NULL CHECK (budgeted_cost >= 0),
    raw_material_cost NUMERIC(16, 2) NOT NULL CHECK (raw_material_cost >= 0),
    direct_labour_cost NUMERIC(16, 2) NOT NULL CHECK (direct_labour_cost >= 0),
    energy_cost NUMERIC(16, 2) NOT NULL CHECK (energy_cost >= 0),
    maintenance_cost NUMERIC(16, 2) NOT NULL CHECK (maintenance_cost >= 0),
    logistics_cost NUMERIC(16, 2) NOT NULL CHECK (logistics_cost >= 0),
    inventory_holding_cost NUMERIC(16, 2) NOT NULL CHECK (inventory_holding_cost >= 0),
    overhead_cost NUMERIC(16, 2) NOT NULL CHECK (overhead_cost >= 0),
    machine_hours_available NUMERIC(10, 2) NOT NULL CHECK (machine_hours_available > 0),
    machine_hours_used NUMERIC(10, 2) NOT NULL CHECK (machine_hours_used >= 0 AND machine_hours_used <= machine_hours_available),
    raw_material_input_tons NUMERIC(12, 2) NOT NULL CHECK (raw_material_input_tons > 0),
    raw_material_net_tons NUMERIC(12, 2) NOT NULL CHECK (raw_material_net_tons > 0 AND raw_material_net_tons <= raw_material_input_tons),
    energy_kwh_consumed NUMERIC(16, 2) NOT NULL CHECK (energy_kwh_consumed >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Database-Backed Analytical View for Product Profitability & CVP Break-Even Analysis
CREATE OR REPLACE VIEW vw_product_profitability_cvp AS
WITH base_agg AS (
    SELECT
        p.product_id,
        p.product_name,
        p.sector,
        pl.plant_name,
        p.production_line,
        SUM(m.units_produced) AS total_units,
        SUM(m.revenue) AS total_revenue,
        SUM(m.budgeted_cost) AS total_budgeted_cost,
        SUM(
            m.raw_material_cost + m.direct_labour_cost + m.energy_cost +
            m.maintenance_cost + m.logistics_cost + m.inventory_holding_cost + m.overhead_cost
        ) AS total_actual_cost,
        SUM(
            m.raw_material_cost + m.direct_labour_cost + m.energy_cost +
            m.logistics_cost + (0.40 * m.maintenance_cost)
        ) AS total_variable_cost,
        SUM(
            m.overhead_cost + m.inventory_holding_cost + (0.60 * m.maintenance_cost)
        ) AS total_fixed_cost,
        SUM(m.machine_hours_used) / NULLIF(SUM(m.machine_hours_available), 0) * 100.0 AS machine_utilisation_pct,
        (SUM(m.raw_material_input_tons) - SUM(m.raw_material_net_tons)) / NULLIF(SUM(m.raw_material_input_tons), 0) * 100.0 AS scrap_rate_pct
    FROM monthly_production_costs m
    JOIN products p ON m.product_id = p.product_id
    JOIN plants pl ON m.plant_id = pl.plant_id
    GROUP BY p.product_id, p.product_name, p.sector, pl.plant_name, p.production_line
)
SELECT
    *,
    (total_revenue - total_actual_cost) AS gross_profit,
    ROUND(((total_revenue - total_actual_cost) / NULLIF(total_revenue, 0)) * 100.0, 2) AS gross_margin_pct,
    (total_revenue - total_variable_cost) AS contribution_margin,
    ROUND(((total_revenue - total_variable_cost) / NULLIF(total_revenue, 0)) * 100.0, 2) AS contribution_margin_pct,
    ROUND(total_actual_cost / NULLIF(total_units, 0), 2) AS cost_per_unit,
    ROUND(
        total_fixed_cost / NULLIF((total_revenue - total_variable_cost) / NULLIF(total_revenue, 0), 0),
        2
    ) AS break_even_revenue_usd,
    CASE
        WHEN (total_revenue - total_actual_cost) < 0 THEN 'Loss-Making'
        WHEN ((total_revenue - total_actual_cost) / NULLIF(total_revenue, 0)) * 100.0 < 12.0 THEN 'Low Margin'
        WHEN ((total_revenue - total_actual_cost) / NULLIF(total_revenue, 0)) * 100.0 >= 22.0 THEN 'High Margin'
        ELSE 'Healthy'
    END AS margin_classification
FROM base_agg;
