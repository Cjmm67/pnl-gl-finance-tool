# Account Mapping Guide

How to map General Ledger account codes to Profit & Loss line items across different
chart-of-accounts structures.

---

## Table of Contents

1. [Mapping Strategy](#mapping-strategy)
2. [Standard Account Code Ranges](#standard-account-code-ranges)
3. [P&L Category Detection](#pl-category-detection)
4. [Name-Based Matching](#name-based-matching)
5. [Handling Unmapped Accounts](#handling-unmapped-accounts)
6. [Multi-Entity Considerations](#multi-entity-considerations)

---

## Mapping Strategy

There are three ways to match GL accounts to P&L lines, in order of preference:

### 1. Direct Code Match (Best)
Both the P&L and GL include account codes. Join on the code.

```python
# P&L has: Account Code | Description | Jan | Feb | ...
# GL has:  Account Code | Date | Description | Debit | Credit
# → Direct join on Account Code
```

### 2. Code-Range Match
The P&L shows summary lines that aggregate ranges of GL accounts. Use standard code ranges
to classify GL accounts into P&L categories.

### 3. Name Match (Fallback)
Neither source has matching codes. Use fuzzy matching on account names / descriptions.

---

## Standard Account Code Ranges

Most chart-of-accounts structures follow a numbering convention. These are the common ranges
across different systems (4-digit and 5-digit examples):

### 4-Digit Systems (Xero, QBO, MYOB, Sage default)

| Code Range | P&L Category | Description |
|---|---|---|
| 1000–1999 | (Balance Sheet) | Assets — skip for P&L |
| 2000–2999 | (Balance Sheet) | Liabilities — skip for P&L |
| 3000–3999 | (Balance Sheet) | Equity — skip for P&L |
| 4000–4999 | Revenue | Sales, service income, other income |
| 5000–5499 | COGS | Cost of goods sold, direct costs |
| 5500–5999 | COGS / Direct Labour | Direct labour may sit here |
| 6000–6499 | Manpower | Salaries, wages, benefits, CPF |
| 6500–6999 | Occupancy | Rent, utilities, property costs |
| 7000–7499 | Admin & General | Office, professional fees, insurance |
| 7500–7999 | Sales & Marketing | Advertising, promotions, commissions |
| 8000–8499 | Operations | R&M, cleaning, laundry, IT, telecom |
| 8500–8999 | Depreciation & Amortisation | Non-cash charges |
| 9000–9499 | Finance Costs | Interest, bank charges, FX |
| 9500–9999 | Other / Exceptional | One-offs, write-offs, tax |

### 5-Digit Systems (SAP, NetSuite, Dynamics default)

| Code Range | P&L Category |
|---|---|
| 10000–19999 | Assets |
| 20000–29999 | Liabilities |
| 30000–39999 | Equity |
| 40000–49999 | Revenue |
| 50000–54999 | COGS |
| 55000–59999 | Direct Labour / COGS |
| 60000–64999 | Manpower |
| 65000–69999 | Occupancy |
| 70000–74999 | Admin & General |
| 75000–79999 | Sales & Marketing |
| 80000–84999 | Operations |
| 85000–89999 | Depreciation |
| 90000–94999 | Finance Costs |
| 95000–99999 | Other / Exceptional |

### Hospitality / F&B Specific (USALI-inspired)

The Uniform System of Accounts for the Lodging Industry (USALI) and its restaurant
equivalents use a department-based structure:

| Code Range | Category | Sub-Category |
|---|---|---|
| 4000–4099 | Revenue | Food Revenue |
| 4100–4199 | Revenue | Beverage Revenue — Alcoholic |
| 4200–4299 | Revenue | Beverage Revenue — Non-Alcoholic |
| 4300–4399 | Revenue | Other Revenue (corkage, room hire, etc.) |
| 5000–5099 | COGS | Food Cost |
| 5100–5199 | COGS | Beverage Cost — Alcoholic |
| 5200–5299 | COGS | Beverage Cost — Non-Alcoholic |
| 5300–5399 | COGS | Other Direct Costs (packaging, consumables) |
| 6000–6099 | Manpower | Salaries & Wages |
| 6100–6149 | Manpower | CPF / Pension |
| 6150–6199 | Manpower | Staff Benefits |
| 6200–6249 | Manpower | Overtime |
| 6250–6299 | Manpower | Casual / Temp Labour |
| 6300–6349 | Manpower | Training |
| 6350–6399 | Manpower | Recruitment, Work Permits |

---

## P&L Category Detection

When account codes aren't available, classify GL accounts into P&L categories using
the account name / description field.

```python
PNL_CATEGORY_KEYWORDS = {
    'revenue': {
        'keywords': ['revenue', 'sales', 'income', 'turnover', 'fee income',
                     'service income', 'corkage', 'room hire', 'cover charge',
                     'delivery income'],
        'exclude': ['other income', 'interest income']  # → classify separately
    },
    'cogs': {
        'keywords': ['cost of goods', 'cost of sales', 'cogs', 'direct cost',
                     'food cost', 'beverage cost', 'bev cost', 'purchases',
                     'raw material', 'ingredients', 'packaging', 'consumable',
                     'paper goods', 'cleaning supplies used'],
        'exclude': ['cleaning services']  # → that's OpEx
    },
    'manpower': {
        'keywords': ['salary', 'salaries', 'wages', 'payroll', 'staff cost',
                     'manpower', 'cpf', 'pension', 'superannuation', 'epf',
                     'socso', 'staff benefit', 'medical', 'overtime', 'ot ',
                     'casual labour', 'temp staff', 'part-time', 'training',
                     'recruitment', 'work permit', 'levy', 'bonus', 'commission',
                     'allowance', 'staff meal', 'staff insurance',
                     'worker compensation', 'leave encashment'],
        'exclude': ['staff welfare']  # could be OpEx depending on chart
    },
    'occupancy': {
        'keywords': ['rent', 'lease', 'property tax', 'utilities', 'electricity',
                     'water', 'gas', 'refuse', 'waste disposal', 'common area',
                     'service charge building', 'rates'],
        'exclude': []
    },
    'admin_general': {
        'keywords': ['office', 'stationery', 'printing', 'postage', 'courier',
                     'professional fee', 'legal', 'audit', 'consulting',
                     'accounting', 'secretarial', 'insurance', 'license',
                     'licence', 'permit', 'subscription', 'membership',
                     'director fee'],
        'exclude': ['music license']  # → Operations
    },
    'sales_marketing': {
        'keywords': ['marketing', 'advertising', 'promotion', 'publicity',
                     'social media', 'pr ', 'public relation', 'agency fee',
                     'photography', 'design', 'branding', 'event marketing',
                     'influencer', 'sponsorship', 'commission expense'],
        'exclude': []
    },
    'operations': {
        'keywords': ['repair', 'maintenance', 'r&m', 'cleaning', 'hygiene',
                     'laundry', 'linen', 'uniform', 'pest control', 'security',
                     'transport', 'delivery', 'courier', 'telecom',
                     'telephone', 'internet', 'it ', 'software', 'technology',
                     'music license', 'entertainment', 'flowers', 'decoration',
                     'guest supplies', 'amenities', 'equipment rental'],
        'exclude': []
    },
    'depreciation': {
        'keywords': ['depreciation', 'amortisation', 'amortization',
                     'write-off', 'write off', 'impairment'],
        'exclude': []
    },
    'finance': {
        'keywords': ['interest', 'bank charge', 'merchant fee', 'transaction fee',
                     'credit card charge', 'loan', 'finance charge', 'fx ',
                     'foreign exchange', 'forex', 'currency', 'swift charge'],
        'exclude': ['interest income']  # → Other Income
    },
    'other': {
        'keywords': ['provision', 'bad debt', 'donation', 'fine', 'penalty',
                     'loss on disposal', 'extraordinary', 'exceptional',
                     'prior year', 'tax', 'income tax', 'corporate tax'],
        'exclude': []
    }
}

def classify_account(account_name):
    """Classify a GL account name into a P&L category."""
    name_lower = account_name.lower().strip()
    for category, config in PNL_CATEGORY_KEYWORDS.items():
        # Check exclusions first
        if any(exc in name_lower for exc in config['exclude']):
            continue
        if any(kw in name_lower for kw in config['keywords']):
            return category
    return 'unclassified'
```

---

## Name-Based Matching

When matching P&L summary line names to GL account names, use this approach:

```python
from difflib import SequenceMatcher

def match_pnl_to_gl(pnl_lines, gl_accounts, threshold=0.65):
    """Match P&L line descriptions to GL account names.
    Returns: {pnl_line: [matching_gl_accounts]}"""
    mapping = {}
    for pnl_line in pnl_lines:
        pnl_clean = pnl_line.lower().strip()
        matches = []
        for gl_acct in gl_accounts:
            gl_clean = gl_acct['name'].lower().strip()

            # Exact substring match
            if pnl_clean in gl_clean or gl_clean in pnl_clean:
                matches.append(gl_acct)
                continue

            # Fuzzy match
            ratio = SequenceMatcher(None, pnl_clean, gl_clean).ratio()
            if ratio >= threshold:
                matches.append(gl_acct)

        mapping[pnl_line] = matches

    return mapping
```

The threshold of 0.65 is intentionally lower than vendor matching (0.85) because P&L summary
names are often abbreviated versions of GL account names (e.g., "R&M" = "Repairs & Maintenance").

---

## Handling Unmapped Accounts

After mapping, there will typically be two types of orphans:

### GL Accounts with No P&L Match
These are usually balance sheet accounts that appeared in the GL export (asset purchases,
liability movements, equity adjustments). Filter these out by checking account code ranges
or looking for balance-sheet keywords.

If they're genuinely P&L accounts that couldn't be matched:
1. List them in the Notes & Methodology sheet
2. Group them under "Other / Unclassified Expenses"
3. Ask the user to manually assign them

### P&L Lines with No GL Detail
These typically arise from:
- **Consolidation adjustments**: entries made at group level, not in the subsidiary GL
- **Journal entries**: year-end accruals, provisions, revaluations
- **Different periods**: P&L may include a month not covered by the GL export
- **Intercompany eliminations**: removed at consolidation

List these in the Notes & Methodology sheet and flag them as "No GL detail — possible
consolidation or period mismatch."

---

## Multi-Entity Considerations

For groups like 1-Group with multiple outlets/entities:

- Each entity may have its own GL but share a consolidated P&L
- The P&L may have columns per outlet/entity
- GL exports may need to be loaded per entity and tagged

When processing multi-entity:
1. Ask the user: "Is this a single-entity or consolidated report?"
2. If consolidated: request GL exports per entity, or a combined GL with an entity identifier column
3. Tag all GL transactions with the entity name
4. Match per entity where possible, flag cross-entity charges
5. Intercompany transactions should be classified as [INTERCOMPANY] vendor category
