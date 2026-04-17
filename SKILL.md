---
name: pnl-gl-agent
description: >
  Excel-powered P&L and General Ledger financial analysis agent. Trigger whenever the user mentions P&L analysis, profit and loss, income statement, expense breakdown, vendor spend, supplier costs, GL detail, GL reconciliation, COGS analysis, food cost, beverage cost, manpower analysis, staff costs, payroll, operating expenses, OpEx, finance costs, month-on-month variance, expense trends, or MoM analysis. Also trigger when the user uploads financial spreadsheets or PDFs and asks about costs, expenses, vendors, suppliers, profitability, or margins. Always use for: expense breakdowns with vendor detail, reconciling P&L to GL, cost trend analysis, identifying top vendors by spend, or building financial analysis workbooks. Complements cogs-agent (event-level COGS); this skill covers full P&L-to-GL reconciliation across ALL expense categories with vendor drill-downs.
compatibility: "Requires bash_tool, create_file, present_files. Python packages: openpyxl, pandas."
---

# 1-Group: P&L & General Ledger Financial Analysis Agent

This skill cross-references Profit & Loss statements with General Ledger detail reports to produce
comprehensive expense breakdowns with vendor/supplier attribution, COGS analysis, manpower analysis,
and month-on-month variance tracking — all in a professional Excel workbook.

## Quick Start

1. **Assess what data the user has** → see [Step 1: Assess Inputs](#step-1-assess-inputs)
2. **Parse and clean both data sources** → see [Step 2: Parse & Clean Data](#step-2-parse--clean-data)
3. **Build the analysis workbook** → see [Step 3: Build the Analysis](#step-3-build-the-analysis)
4. **Validate and present** → see [Step 4: Validate & Present](#step-4-validate--present)

For vendor name extraction logic, read `references/vendor-extraction-patterns.md` before Step 2.
For GL column recognition across accounting systems, read `references/gl-column-schemas.md`.
For account mapping between GL and P&L, read `references/account-mapping-guide.md`.
For industry benchmarks, read `references/industry-benchmarks.md`.

---

## Agent Workflow

### Step 1: Assess Inputs

Check what files the user has provided or can provide:

- **P&L report** (Excel/CSV/PDF) — which periods does it cover?
- **GL detail report** (Excel/CSV/PDF) — which periods does it cover?
- Do the periods match between P&L and GL?
- Is there an existing chart of accounts or account code mapping?
- What entity/outlet is this for?
- What industry? Default to F&B/Hospitality for 1-Group, but support any industry.

If the user provides only one of the two files, explain why both are needed and what each contributes:
the P&L gives the summary structure; the GL gives the transactional detail with vendor names.

### Step 2: Parse & Clean Data

#### Loading the P&L

Detect the P&L hierarchy regardless of naming conventions:

```
Revenue / Sales / Turnover / Income
├── Cost of Goods Sold / COGS / Cost of Sales / Direct Costs
├── = Gross Profit
├── Operating Expenses / Overheads / Admin Expenses / Other Expenses
│   ├── Manpower / Staff Costs / Salaries & Wages / Payroll
│   ├── Rent & Occupancy
│   ├── Utilities
│   ├── ... (all other OpEx lines)
│   └── Depreciation & Amortisation
├── = EBITDA (if shown)
├── Finance Costs / Interest Expense / Non-Operating
├── = Profit Before Tax / EBT
├── Tax
└── = Net Profit / Net Income
```

Parsing rules:
- Identify each line item and its account code (if present in a leading column)
- Detect multi-period columns (Jan, Feb... or Q1, Q2... or Monthly + YTD)
- Detect subtotals vs. individual line items — subtotals often have bold formatting, indentation patterns, or keywords like "Total", "Sub-total", "Net"
- Handle accounting-format negatives: parentheses `(1,234)` = negative
- Strip currency symbols and thousand separators during numeric conversion
- Flag any line items that are ambiguous for user confirmation

#### Loading the GL

Read `references/gl-column-schemas.md` first to identify the accounting system format.

Core columns to identify (names vary by system):
- **Account Code** — 4-digit, 5-digit, or alphanumeric
- **Account Name** — the GL account description
- **Date** — transaction date
- **Description / Narration / Memo** — THIS is where vendor names live
- **Debit** — debit amount
- **Credit** — credit amount
- **Reference** — invoice/journal number

Parsing rules:
- Auto-detect column headers even if they're not in row 1 (some exports have metadata rows above)
- Handle merged cells and multi-level headers
- If Debit and Credit are separate columns, calculate net movement
- If a single "Amount" column exists, determine sign convention (positive = debit typically)
- Group all transactions by Account Code for mapping to P&L

#### Vendor Name Extraction

This is the highest-value and hardest capability. Read `references/vendor-extraction-patterns.md`
for the full regex library. The core logic:

1. Take the GL Description/Narration field
2. Strip standard prefixes: INV, PV, JV, CN, DN, GIRO, TT, EFT, CHQ, DD, AP, AR, RCPT
3. Strip invoice/reference numbers (patterns like INV-2024-001, #12345, REF:ABC)
4. Strip dates embedded in descriptions
5. Strip payment method indicators (Bank Transfer, GIRO Payment, Direct Debit)
6. What remains is typically the vendor/supplier name
7. Normalise: uppercase, strip "PTE LTD", "PTE. LTD.", "SDN BHD", "CO.", "INC.", trailing punctuation
8. Fuzzy-match to consolidate variants (e.g., "CLEANCO", "CLEAN CO", "CleanCo Pte Ltd" → one vendor)
9. Flag special categories: "Petty Cash", "Sundry", "Cash", "Miscellaneous", "Internal Transfer"

#### Building the Account Mapping

Match GL accounts to P&L line items:
- **Best case**: Both P&L and GL share account codes — direct join
- **Common case**: P&L has summary names, GL has codes — use the GL Account Name field to match to P&L line descriptions
- **Manual case**: Neither matches cleanly — present a mapping table for the user to confirm

Flag any:
- GL accounts with transactions that don't map to any P&L line
- P&L lines that have no corresponding GL transactions (may indicate journal entries or consolidation adjustments)

### Step 3: Build the Analysis

Run `scripts/build_pnl_gl_report.py` or construct the workbook programmatically using the patterns
in that script. The workbook must have these sheets:

```
Workbook: [Entity Name] — P&L & GL Analysis — [Period]
├── 📊 Dashboard              → KPI summary, charts, top vendors, trend indicators
├── 📋 P&L Summary            → Clean restated P&L with period columns
├── 🔍 Expense Breakdown      → Every P&L expense line → vendor/supplier drill-down
├── 🥩 COGS Analysis          → COGS by category and vendor, cost %s, benchmarks
├── 👥 Manpower Analysis      → Staff cost breakdown, ratios, per-head metrics
├── 🏢 OpEx Analysis          → Operating overhead line-by-line with vendors
├── 💰 Finance Costs          → Interest, FX, exceptional items with counterparties
├── 📈 MoM Variance           → Month-on-month changes with flags and auto-commentary
├── 🏭 Vendor Summary         → All vendors ranked by total spend, category, frequency
├── 📒 GL Detail              → Raw GL data (cleaned and formatted) for audit trail
├── ⚙️ Assumptions            → Configurable inputs: targets, thresholds, benchmarks
└── 📝 Notes & Methodology    → Mapping logic, unmatched items, caveats
```

#### Sheet Specifications

**📊 Dashboard**
- Revenue summary (total and by outlet if multi-outlet)
- COGS summary with % of revenue
- Gross Profit and GP%
- Total Operating Expenses and % of revenue
- EBITDA and EBITDA margin
- Net Profit and Net Profit margin
- Top 10 vendors/suppliers by total spend (horizontal bar chart)
- Top 5 expense categories by value (pie or donut chart)
- MoM trend mini-charts for Revenue, GP%, COGS%, Manpower%, Net Profit
- Traffic-light indicators: Green (within target), Amber (within 3% of target), Red (exceeds target)
- All targets reference the Assumptions sheet

**📋 P&L Summary**
- Clean restated P&L with one column per period
- Account codes in column A (if available), descriptions in column B, amounts from column C onward
- Subtotals and totals with Excel SUM formulas
- % of Revenue column for each period
- YTD totals if monthly data provided

**🔍 Expense Breakdown**
The core deliverable. Structure for each P&L expense line:

| P&L Line Item | Account Code | P&L Amount | GL Total | Variance | Vendor | Vendor Amount | % of Line |
|---|---|---|---|---|---|---|---|
| Cleaning & Hygiene | 5210 | $45,230 | $45,230 | $0 ✓ | CleanCo Pte Ltd | $18,500 | 40.9% |
| | | | | | Hygiene Solutions | $12,730 | 28.1% |
| | | | | | ABC Cleaning | $8,000 | 17.7% |
| | | | | | Sundry/Petty Cash | $6,000 | 13.3% |

- Variance column flags non-zero differences in red
- Vendor amounts must SUM to GL Total (verified with formulas)
- GL Total must equal P&L Amount (flagged if not)

**🥩 COGS Analysis**
- Food costs by supplier with Food Cost %
- Beverage costs (Alcoholic / Non-Alcoholic) by supplier with Bev Cost %
- Other direct costs by supplier
- Combined COGS % with benchmark comparison from Assumptions sheet
- Default benchmarks (from `references/industry-benchmarks.md`):
  - Food Cost: 28–35% (Fine Dining 25–32%, Catering 22–30%)
  - Bev Cost: 18–24% (Fine Dining 20–28%, Catering 15–22%)
  - Combined: 25–32%

**👥 Manpower Analysis**
- Basic salaries & wages
- CPF / pension / social security contributions
- Staff benefits (medical, insurance, etc.)
- Overtime
- Casual / part-time / temp labour (by agency if identifiable)
- Training costs
- Recruitment costs
- Work permits / levies
- Total Manpower Cost and Manpower % of Revenue
- Revenue per Employee (if headcount data available — ask user)
- Manpower cost per cover (if cover count available — ask user)
- Benchmark: Manpower typically 25–35% of revenue in F&B

**🏢 OpEx Analysis**
Every operating expense line not covered by COGS or Manpower, each with full vendor drill-down:
Rent, Utilities, R&M, Cleaning, Laundry, Marketing, IT, Insurance, Professional Fees, Licenses,
Office Supplies, Transport, Telecom, Entertainment, Depreciation, Bank Charges, Music Licenses,
Pest Control, Security, Waste Disposal, and any others present in the P&L.

**💰 Finance Costs**
- Interest expenses by lender
- Loan-related charges
- FX gains/losses
- Other finance charges
- One-off / exceptional items (clearly flagged)

**📈 MoM Variance**
For every expense line and category across all periods:
- Value per month side-by-side
- Absolute change ($) between consecutive months
- Percentage change (%) between consecutive months
- Average, Min, Max, Std Dev across the full period
- Conditional formatting: flag >15% MoM change OR >$5,000 absolute change (thresholds from Assumptions)
- **Auto-commentary column**: plain-English explanation generated by analysing which vendor drove the change
  - Example: "Cleaning costs ↑34% MoM — driven by $6,200 increase from CleanCo Pte Ltd (possible one-off deep clean or price increase)"
- Trend arrows: ↑ red for expense increases, ↓ green for expense decreases

**🏭 Vendor Summary**
- All vendors ranked by total spend (descending)
- Columns: Vendor Name, Total Spend, # of Transactions, Expense Categories, Avg Transaction Size, First Seen, Last Seen
- Pareto analysis: cumulative % column to identify vendors comprising 80% of spend

**📒 GL Detail**
- Full cleaned GL data for audit trail
- Columns: Date, Account Code, Account Name, Description (original), Vendor (extracted), Debit, Credit, Net, Reference
- Filterable with auto-filter headers
- Sorted by Account Code then Date

**⚙️ Assumptions**
All configurable inputs in one place (blue text for user-editable cells):
- COGS targets: Food Cost % target, Bev Cost % target, Combined target
- Manpower target: Staff Cost % of Revenue target
- Variance thresholds: MoM % threshold (default 15%), MoM $ threshold (default $5,000)
- Industry: F&B / Retail / Professional Services / Other
- Entity name, reporting currency, fiscal year start month

**📝 Notes & Methodology**
- Explanation of mapping logic used (account code match vs. name match)
- List of unmatched GL accounts (if any)
- List of P&L lines with no GL detail (if any)
- Vendor name consolidation decisions made
- Any data quality issues encountered
- Source file names and dates

### Step 4: Validate & Present

Before presenting the workbook:

1. **Formula validation**: Run `python /mnt/skills/public/xlsx/scripts/recalc.py output.xlsx` — must return zero errors
2. **Reconciliation check**: For every expense line, verify: SUM(vendor amounts) = GL Total = P&L Amount
3. **Completeness check**: Every P&L expense line should have at least one vendor; flag lines with "Unmatched" vendors
4. **Present findings** as a concise summary:
   - Total Revenue, Gross Profit, GP%, EBITDA, Net Profit
   - Top 5 expense categories by value
   - Top 5 vendors by spend
   - Largest MoM variances (top 3 flagged items)
   - Any reconciliation discrepancies found
   - COGS % vs benchmark (over/under and by how much)
   - Manpower % vs benchmark

---

## Excel Formatting Standards

Follow the xlsx skill standards rigorously:

### Colour Coding
- **Blue text** (RGB: 0,0,255): Hardcoded inputs in Assumptions sheet and user-editable cells
- **Black text** (RGB: 0,0,0): All formulas and calculations
- **Green text** (RGB: 0,128,0): Cross-sheet references (e.g., pulling targets from Assumptions)
- **Red text on yellow bg**: Variance flags exceeding threshold

### Number Formatting
- Currency: `$#,##0;($#,##0);"-"` — parentheses for negatives, dash for zero
- Percentages: `0.0%` — one decimal
- Integers: `#,##0`
- Years/months: text format to avoid thousand separators

### Layout
- Arial 10pt throughout
- Freeze panes: freeze Row 1 (header) + Column A-B (labels) on data sheets
- Auto-filter on all header rows
- Column widths auto-adjusted to content
- Gridlines OFF on Dashboard, ON on data sheets
- Section headers: dark navy fill with white bold text
- Alternating row shading on data sheets for readability

### Formulas Over Hardcodes
Every calculated value must be an Excel formula, not a Python-computed constant. This ensures the
workbook updates dynamically if the user changes source data. The only hardcoded values should be
in the Assumptions sheet (marked in blue) and raw data cells from the GL/P&L import.

---

## Data Source Handling

### Excel / CSV Input
```python
import pandas as pd

# P&L — try reading with flexible header detection
df_pnl = pd.read_excel(pnl_path, header=None)
# Scan first 10 rows to find the actual header row
# Look for keywords: "Revenue", "Sales", "Account", "Description", or month names

# GL — similar approach
df_gl = pd.read_excel(gl_path, header=None)
# Look for keywords: "Account", "Date", "Description", "Debit", "Credit", "Narration"
```

### PDF Input
If the user provides PDF files, use the pdf-reading skill patterns:
```bash
pdftotext -layout input.pdf - | head -50   # Check if text-extractable
```
Then use pdfplumber for table extraction:
```python
import pdfplumber
with pdfplumber.open(pdf_path) as pdf:
    for page in pdf.pages:
        tables = page.extract_tables()
```

### Accounting Number Formats
```python
def parse_accounting_number(val):
    """Convert accounting-format strings to float.
    Handles: (1,234.56), $1,234.56, -1234.56, 1234, blanks"""
    if pd.isna(val) or str(val).strip() in ('', '-', '—'):
        return 0.0
    s = str(val).strip()
    negative = s.startswith('(') and s.endswith(')')
    s = s.replace('(', '').replace(')', '').replace('$', '').replace(',', '').replace(' ', '')
    try:
        result = float(s)
        return -result if negative else result
    except ValueError:
        return 0.0
```

---

## Reference Files

Read these before starting the analysis:

- **`references/vendor-extraction-patterns.md`** — Regex patterns and fuzzy-matching logic for extracting vendor names from GL descriptions. READ THIS BEFORE Step 2.
- **`references/gl-column-schemas.md`** — Expected column names for GL exports from Xero, QuickBooks, MYOB, SAP, Sage, NetSuite, Sun Systems, Microsoft Dynamics. READ THIS when parsing GL files.
- **`references/account-mapping-guide.md`** — How to map GL account codes to P&L line items across different chart-of-accounts structures.
- **`references/industry-benchmarks.md`** — Default benchmarks for COGS%, Manpower%, OpEx% by industry segment. Used to populate the Assumptions sheet and flag outliers.
