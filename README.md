# P&L & GL Financial Analysis Tool

A comprehensive Profit & Loss and General Ledger financial analysis tool built for 1-Group hospitality operations.

## Features

- **P&L Upload & Parsing** — Drag-and-drop Excel/CSV P&L reports with automatic structure detection
- **GL Upload & Parsing** — General Ledger detail with vendor/supplier extraction
- **P&L-to-GL Reconciliation** — Automated matching of P&L line items to GL transactions
- **Vendor/Supplier Drill-Down** — Top vendors by spend per expense category
- **COGS Analysis** — Food cost, beverage cost, and other direct cost breakdowns
- **Manpower Analysis** — Staff costs, headcount-derived metrics, overtime tracking
- **Month-on-Month Variance** — Trend analysis with MoM absolute and percentage changes
- **Industry Benchmarking** — Compare against F&B industry benchmarks
- **Excel Export** — Multi-sheet workbook output with formatted analysis

## Project Files

| File | Purpose |
|------|---------|
| `build_pnl_gl_report.py` | Core Python script for building the analysis workbook |
| `pnl-gl-finance-tool.jsx` | React frontend component |
| `SKILL.md` | Claude skill definition and instructions |
| `account-mapping-guide.md` | Chart of accounts mapping reference |
| `gl-column-schemas.md` | GL column detection schemas |
| `vendor-extraction-patterns.md` | Vendor name extraction patterns |
| `industry-benchmarks.md` | F&B industry benchmark data |
| `pnlglagentdemooutput.xlsx` | Demo output workbook |

## Tech Stack

- **Frontend**: React + Tailwind CSS
- **Backend Processing**: Python (openpyxl, pandas)
- **Deployment**: Vercel (planned)

## License

Private — 1-Group internal use.
