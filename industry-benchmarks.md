# Industry Benchmarks Reference

Default benchmarks for COGS%, Manpower%, and OpEx% by industry segment.
These populate the Assumptions sheet and are used to flag outliers in the Dashboard.

---

## Table of Contents

1. [F&B / Hospitality Benchmarks](#fb--hospitality-benchmarks)
2. [Retail Benchmarks](#retail-benchmarks)
3. [Professional Services Benchmarks](#professional-services-benchmarks)
4. [General / Mixed Industry](#general--mixed-industry)
5. [How to Use These Benchmarks](#how-to-use-these-benchmarks)

---

## F&B / Hospitality Benchmarks

The default industry for 1-Group operations.

### COGS

| Metric | Casual Dining | Fine Dining | Catering/Events | Quick Service | Bars/Lounges |
|---|---|---|---|---|---|
| Food Cost % | 28–35% | 25–32% | 22–30% | 30–38% | 25–35% |
| Bev Cost % (Alcoholic) | 18–24% | 20–28% | 15–22% | 20–28% | 18–25% |
| Bev Cost % (Non-Alc) | 10–18% | 12–20% | 10–15% | 15–22% | 10–18% |
| Combined F&B COGS % | 25–32% | 24–30% | 20–28% | 28–35% | 22–30% |

**Default target for 1-Group**: Combined COGS 28% | Food 30% | Bev 22%

### Manpower

| Metric | Casual Dining | Fine Dining | Catering/Events | Quick Service | Bars/Lounges |
|---|---|---|---|---|---|
| Total Staff Cost % of Rev | 25–32% | 30–38% | 28–35% | 22–28% | 20–28% |
| Basic Salary % of Rev | 18–24% | 22–28% | 20–26% | 16–22% | 15–22% |
| CPF/Pension % of Salary | 17% (SG) | 17% (SG) | 17% (SG) | 17% (SG) | 17% (SG) |
| Benefits % of Rev | 2–4% | 3–5% | 2–4% | 1–3% | 1–3% |
| Revenue per Employee (monthly) | $8K–$15K | $10K–$20K | $12K–$25K | $8K–$12K | $10K–$18K |

**Default target for 1-Group**: Manpower 30% of Revenue

### Operating Expenses

| Expense Category | % of Revenue | Notes |
|---|---|---|
| Rent & Occupancy | 8–15% | Location-dependent; SG typically 10–15% |
| Utilities | 2–5% | Electricity is largest component |
| Repairs & Maintenance | 1–3% | Older premises = higher |
| Cleaning & Hygiene | 1–2% | Regulatory compliance driven |
| Marketing & Advertising | 2–5% | Higher for new outlets |
| Insurance | 0.5–1.5% | |
| Professional Fees | 0.5–2% | Audit, legal, consulting |
| IT & Technology | 1–3% | POS, reservations, etc. |
| Depreciation | 3–8% | Capital-intensive operations |
| Bank Charges / Merchant Fees | 1–3% | Card transactions |

### Profitability

| Metric | Casual Dining | Fine Dining | Catering/Events |
|---|---|---|---|
| Gross Profit % | 65–75% | 68–76% | 70–80% |
| EBITDA % | 10–18% | 8–15% | 15–25% |
| Net Profit % | 5–12% | 3–10% | 10–20% |

### Prime Cost Rule (F&B)
**COGS + Manpower should not exceed 60–65% of Revenue.**
This is the single most important ratio in F&B management.

```python
HOSPITALITY_DEFAULTS = {
    'food_cost_target': 0.30,
    'bev_cost_target': 0.22,
    'combined_cogs_target': 0.28,
    'manpower_target': 0.30,
    'prime_cost_target': 0.60,
    'rent_target': 0.12,
    'ebitda_target': 0.15,
    'net_profit_target': 0.08,
    'variance_pct_threshold': 0.15,
    'variance_abs_threshold': 5000,
}
```

---

## Retail Benchmarks

### COGS

| Metric | Fashion/Apparel | Electronics | Grocery | Specialty |
|---|---|---|---|---|
| COGS % | 45–65% | 65–80% | 70–85% | 40–60% |
| Gross Margin % | 35–55% | 20–35% | 15–30% | 40–60% |

### Manpower

| Metric | Range |
|---|---|
| Total Staff Cost % of Rev | 10–20% |
| Revenue per Employee (monthly) | $15K–$40K |

### Operating Expenses

| Expense Category | % of Revenue |
|---|---|
| Rent & Occupancy | 5–15% |
| Marketing | 3–8% |
| Depreciation | 2–5% |
| EBITDA | 8–15% |
| Net Profit | 3–10% |

```python
RETAIL_DEFAULTS = {
    'combined_cogs_target': 0.55,
    'manpower_target': 0.15,
    'rent_target': 0.10,
    'ebitda_target': 0.12,
    'net_profit_target': 0.06,
    'variance_pct_threshold': 0.15,
    'variance_abs_threshold': 5000,
}
```

---

## Professional Services Benchmarks

### Revenue and COGS

| Metric | Consulting | Legal/Accounting | IT Services | Agencies |
|---|---|---|---|---|
| COGS % (direct labour) | 40–55% | 35–50% | 45–60% | 50–65% |
| Gross Margin % | 45–60% | 50–65% | 40–55% | 35–50% |

### Manpower

| Metric | Range |
|---|---|
| Total Staff Cost % of Rev | 55–75% |
| Revenue per Employee (monthly) | $12K–$30K |

### Operating Expenses

| Expense Category | % of Revenue |
|---|---|
| Rent & Occupancy | 3–8% |
| Marketing | 2–5% |
| Technology | 3–8% |
| EBITDA | 15–30% |
| Net Profit | 10–25% |

```python
PROFESSIONAL_SERVICES_DEFAULTS = {
    'combined_cogs_target': 0.50,
    'manpower_target': 0.65,
    'rent_target': 0.05,
    'ebitda_target': 0.20,
    'net_profit_target': 0.15,
    'variance_pct_threshold': 0.15,
    'variance_abs_threshold': 10000,
}
```

---

## General / Mixed Industry

When the industry is unknown or doesn't fit the above categories:

```python
GENERAL_DEFAULTS = {
    'combined_cogs_target': 0.40,
    'manpower_target': 0.25,
    'rent_target': 0.08,
    'ebitda_target': 0.15,
    'net_profit_target': 0.08,
    'variance_pct_threshold': 0.15,
    'variance_abs_threshold': 5000,
}
```

---

## How to Use These Benchmarks

### In the Assumptions Sheet
Pre-populate the Assumptions sheet with the appropriate industry defaults.
Mark all values in **blue text** (user-editable hardcodes per xlsx skill standards).

```python
def get_industry_defaults(industry='hospitality'):
    """Return benchmark defaults for the given industry."""
    DEFAULTS = {
        'hospitality': HOSPITALITY_DEFAULTS,
        'retail': RETAIL_DEFAULTS,
        'professional_services': PROFESSIONAL_SERVICES_DEFAULTS,
        'general': GENERAL_DEFAULTS,
    }
    return DEFAULTS.get(industry.lower(), GENERAL_DEFAULTS)
```

### Traffic Light Logic (Dashboard)
Compare actual metrics against targets:

| Condition | Colour | Meaning |
|---|---|---|
| Actual ≤ Target | 🟢 Green | On target or better |
| Target < Actual ≤ Target + 3% | 🟡 Amber | Watch — close to exceeding |
| Actual > Target + 3% | 🔴 Red | Over target — action needed |

For profitability metrics (GP%, EBITDA%, Net Profit%), reverse the logic:
actual below target = red, above = green.

### Variance Flagging
Flag any expense line where:
- MoM % change > `variance_pct_threshold` (default 15%), OR
- MoM $ change > `variance_abs_threshold` (default $5,000)

Both thresholds are configurable in the Assumptions sheet.

### Singapore-Specific Notes
- CPF employer contribution rate: 17% of ordinary wages (for employees ≤55 years)
- Stepped rates for older employees: 55–60 = 14.5%, 60–65 = 11%, 65–70 = 8.5%, >70 = 7.5%
- Foreign worker levy: varies by sector and dependency ratio ($300–$950/month)
- S-Pass levy: $650/month
- GST rate: 9% (from 1 Jan 2024)
