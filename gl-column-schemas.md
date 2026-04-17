# GL Column Schemas Reference

Expected column names and positions for General Ledger exports from major accounting systems.
Use these to auto-detect the accounting system and map columns correctly.

---

## Table of Contents

1. [Auto-Detection Strategy](#auto-detection-strategy)
2. [Xero](#xero)
3. [QuickBooks Online / Desktop](#quickbooks)
4. [MYOB](#myob)
5. [SAP Business One / S4HANA](#sap)
6. [Sage](#sage)
7. [NetSuite](#netsuite)
8. [Sun Systems](#sun-systems)
9. [Microsoft Dynamics](#microsoft-dynamics)
10. [Generic / Unknown System](#generic--unknown-system)
11. [Column Mapping Code](#column-mapping-code)

---

## Auto-Detection Strategy

Scan the first 10 rows and all column headers for system-specific keywords:

```python
SYSTEM_SIGNATURES = {
    'xero': ['Xero', 'GST Amount', 'Tax Rate', 'Tracking Category'],
    'quickbooks': ['QuickBooks', 'Split', 'Memo', 'Class', 'Clr'],
    'myob': ['MYOB', 'Card Name', 'Tax Code', 'Job', 'Inclusive'],
    'sap': ['SAP', 'Document Number', 'Posting Key', 'Business Partner', 'Company Code'],
    'sage': ['Sage', 'Nominal Code', 'Nominal Name', 'Details', 'T/C'],
    'netsuite': ['NetSuite', 'Internal ID', 'Subsidiary', 'Department', 'Class'],
    'sun': ['Sun', 'Analysis', 'T-Code', 'Journal Source'],
    'dynamics': ['Dynamics', 'Posting Group', 'Document Type', 'Bal. Account'],
}
```

---

## Xero

### GL Detail / Account Transactions Export

| Standard Column | Alternatives | Type | Role |
|---|---|---|---|
| `Account` | `Account Code` | str | GL account code |
| `Account Name` | | str | GL account description |
| `Date` | `Transaction Date` | date | Transaction date |
| `Description` | `Narration` | str | Free text — parse for vendor |
| `Contact` | `Contact Name`, `Name` | str | **Best vendor source** — use if present |
| `Reference` | `Ref` | str | Invoice/payment reference |
| `Debit` | `Debit Amount` | float | Debit amount |
| `Credit` | `Credit Amount` | float | Credit amount |
| `Gross` | `Amount`, `Net Amount` | float | Single amount (may replace Debit/Credit) |
| `GST Amount` | `Tax Amount` | float | Tax component |
| `Tax Rate` | | str | Tax code applied |
| `Source` | `Source Type` | str | INV, BILL, SPEND, MAN JNL, etc. |
| `Tracking Category 1` | | str | Department/outlet tracking |
| `Tracking Category 2` | | str | Additional tracking |

**Notes:**
- Xero exports often have a "Contact" column — this IS the vendor name. Use it directly.
- "Source" column tells you the transaction type (BILL = supplier invoice, SPEND = expense claim).
- GST is usually on separate rows; watch for double-counting.

---

## QuickBooks

### QuickBooks Online — General Ledger Report

| Standard Column | Alternatives | Type | Role |
|---|---|---|---|
| `Account` | `Account #` | str | Account code (if enabled) |
| `Account Name` | `Account` | str | Account description |
| `Date` | `Trans Date`, `Transaction Date` | date | Transaction date |
| `Memo` | `Memo/Description` | str | Free text description |
| `Name` | `Payee`, `Vendor` | str | **Best vendor source** |
| `Num` | `Ref No.`, `Ref #` | str | Check/reference number |
| `Debit` | | float | Debit amount |
| `Credit` | | float | Credit amount |
| `Amount` | `Balance` | float | Net amount |
| `Split` | | str | Contra account |
| `Class` | | str | Classification |
| `Type` | `Transaction Type` | str | Bill, Check, Expense, Journal Entry |

**Notes:**
- QBO's "Name" column is the vendor. Always prefer it over Memo parsing.
- "Type" column helps classify: "Bill" and "Expense" are vendor transactions.
- Desktop exports may have slightly different column names.

---

## MYOB

### MYOB AccountRight / Essentials GL Export

| Standard Column | Alternatives | Type | Role |
|---|---|---|---|
| `Account Number` | `Acct No.`, `Account #` | str | GL account code |
| `Account Name` | | str | Account description |
| `Date` | | date | Transaction date |
| `Memo` | `Description` | str | Free text |
| `Card Name` | `Name` | str | **Best vendor source** — contact card name |
| `Debit` | `Debit Amount` | float | |
| `Credit` | `Credit Amount` | float | |
| `Amount` | | float | Net (if single column) |
| `Tax Code` | `GST Code` | str | Tax treatment |
| `Inclusive` | `Tax Inclusive` | bool | Whether amounts include GST |
| `Job` | `Job Number` | str | Job/project tracking |
| `Source` | `Journal Type` | str | Sale, Purchase, General |

**Notes:**
- MYOB "Card Name" = vendor/customer name. Use directly.
- GST may be inclusive — check the "Inclusive" flag to avoid inflating expenses.
- MYOB Essentials exports are simpler than AccountRight.

---

## SAP

### SAP Business One / S/4HANA GL Export

| Standard Column | Alternatives | Type | Role |
|---|---|---|---|
| `G/L Account` | `Account`, `GL Account` | str | Account code (often 6-10 digits) |
| `G/L Account Name` | `Account Name`, `Description` | str | Account description |
| `Posting Date` | `Document Date`, `Date` | date | Transaction date |
| `Document Number` | `Doc. No.` | str | SAP document number |
| `Reference` | `Ref. 1`, `Reference 1` | str | External reference |
| `Text` | `Line Item Text`, `Description` | str | Transaction description |
| `Business Partner` | `Vendor`, `Vendor Name`, `BP Name` | str | **Best vendor source** |
| `Vendor Number` | `BP Code` | str | Vendor master code |
| `Debit` | `Debit Amount`, `Debit/Credit` | float | |
| `Credit` | `Credit Amount` | float | |
| `Amount in LC` | `Local Currency Amt` | float | Amount in local currency |
| `Company Code` | | str | Entity identifier |
| `Posting Key` | | str | Transaction type code |
| `Cost Center` | | str | Cost centre allocation |

**Notes:**
- SAP has the richest vendor data — "Business Partner" or "Vendor Name" column is definitive.
- Document numbers follow SAP patterns (1400000001, etc.)
- Multiple company codes = multi-entity; filter by entity.
- Posting Keys: 40=Debit, 50=Credit (for GL), 31=Vendor Invoice, 21=Customer Invoice.

---

## Sage

### Sage 50 / Sage Intacct GL Export

| Standard Column | Alternatives | Type | Role |
|---|---|---|---|
| `Nominal Code` | `N/C`, `Account Code` | str | GL account code |
| `Nominal Name` | `Account Name`, `N/C Name` | str | Account description |
| `Date` | `Transaction Date` | date | Transaction date |
| `Details` | `Description`, `Narrative` | str | Free text — parse for vendor |
| `Supplier` | `Supplier Name`, `Name` | str | Vendor name (purchase ledger) |
| `Reference` | `Ref` | str | Document reference |
| `T/C` | `Tax Code` | str | Tax code |
| `Debit` | | float | |
| `Credit` | | float | |
| `Bank Rec.` | | str | Bank reconciliation status |
| `Type` | `Trans Type` | str | SI, SC, PI, PC, BP, BR, JD, JC |

**Notes:**
- Sage "Supplier" column exists in purchase ledger reports — use directly.
- General ledger reports may not have "Supplier" — fall back to "Details" parsing.
- Type codes: PI=Purchase Invoice, PC=Purchase Credit, BP=Bank Payment.

---

## NetSuite

### NetSuite GL Detail / Transaction Search Export

| Standard Column | Alternatives | Type | Role |
|---|---|---|---|
| `Account` | `Account Number` | str | Account code |
| `Account Name` | `Account: Name` | str | Account description |
| `Date` | `Transaction Date`, `Date Created` | date | |
| `Memo` | `Description` | str | Free text description |
| `Name` | `Entity`, `Entity: Name`, `Vendor` | str | **Best vendor source** |
| `Internal ID` | `Transaction ID` | str | NetSuite internal ID |
| `Document Number` | `Tran. #`, `Number` | str | Transaction reference |
| `Debit` | `Debit Amount` | float | |
| `Credit` | `Credit Amount` | float | |
| `Amount` | | float | Net amount |
| `Subsidiary` | | str | Entity/subsidiary |
| `Department` | | str | Department allocation |
| `Class` | | str | Classification |
| `Location` | | str | Location/outlet |

**Notes:**
- NetSuite "Name" or "Entity" column = vendor. Use directly.
- "Subsidiary" is critical for multi-entity groups.
- Saved searches may have custom column names.

---

## Sun Systems

### Sun Systems GL Transaction Export

| Standard Column | Alternatives | Type | Role |
|---|---|---|---|
| `Account Code` | `Account`, `Acct` | str | GL account code |
| `Account Name` | `Description` | str | Account description |
| `Transaction Date` | `Date`, `Trans Date` | date | |
| `Description` | `Narrative`, `Line Description` | str | Free text — parse for vendor |
| `Analysis 1` | `T1`, `Analysis Code 1` | str | May contain vendor/department |
| `Analysis 2` | `T2`, `Analysis Code 2` | str | Secondary analysis |
| `Debit` | `Debit Amount` | float | |
| `Credit` | `Credit Amount` | float | |
| `Journal Source` | `Source`, `Jnl Source` | str | Transaction source |
| `T-Code` | `Transaction Code` | str | Transaction type |
| `Period` | `Accounting Period` | str | Posting period |

**Notes:**
- Sun Systems rarely has a clean vendor column — rely on Description parsing.
- "Analysis" fields may encode vendor codes; cross-reference with a vendor master if available.
- Journal Source indicates origin: AP, AR, GL, FA, etc.

---

## Microsoft Dynamics

### D365 Business Central / Finance GL Export

| Standard Column | Alternatives | Type | Role |
|---|---|---|---|
| `G/L Account No.` | `Account No.`, `Account` | str | Account code |
| `G/L Account Name` | `Account Name`, `Name` | str | Account description |
| `Posting Date` | `Document Date` | date | |
| `Description` | | str | Free text |
| `Document Type` | `Doc. Type` | str | Invoice, Payment, Credit Memo, etc. |
| `Document No.` | `Doc. No.` | str | Document reference |
| `Vendor Name` | `Account Name` (for vendor entries) | str | Vendor (when from AP) |
| `Vendor No.` | `Account No.` (for vendor entries) | str | Vendor code |
| `Debit Amount` | `Debit` | float | |
| `Credit Amount` | `Credit` | float | |
| `Amount` | | float | Net amount |
| `Posting Group` | `Gen. Posting Group` | str | Transaction classification |
| `Bal. Account No.` | | str | Contra account |
| `Dimension 1` | `Global Dim. 1`, `Department` | str | Dimension value |
| `Dimension 2` | `Global Dim. 2`, `Project` | str | Dimension value |

**Notes:**
- "Vendor Name" column available in vendor ledger entries — use directly.
- GL entries may not have vendor name — fall back to Description parsing.
- Document Type helps classify: Invoice/Credit Memo from vendors.

---

## Generic / Unknown System

When the accounting system can't be identified, use this universal detection approach:

```python
UNIVERSAL_COLUMN_MAP = {
    # Account identifiers
    'account_code': ['Account Code', 'Account', 'Acct', 'Account No', 'Account Number',
                     'Account #', 'GL Account', 'Nominal Code', 'N/C', 'G/L Account'],
    'account_name': ['Account Name', 'Account Description', 'Description', 'Nominal Name',
                     'G/L Account Name', 'Account: Name'],

    # Date
    'date': ['Date', 'Transaction Date', 'Trans Date', 'Posting Date', 'Document Date',
             'Entry Date', 'Value Date'],

    # Description / Narration (parse for vendor if no vendor column)
    'description': ['Description', 'Narration', 'Memo', 'Details', 'Narrative', 'Text',
                    'Line Description', 'Memo/Description', 'Particulars', 'Reference Description'],

    # Vendor / Contact (prefer this over description parsing)
    'vendor': ['Contact', 'Contact Name', 'Name', 'Vendor', 'Vendor Name', 'Supplier',
               'Supplier Name', 'Card Name', 'Payee', 'Entity', 'Business Partner',
               'BP Name', 'Entity: Name', 'Account Name'],

    # Amounts
    'debit': ['Debit', 'Debit Amount', 'Dr', 'Dr Amount', 'Debit (Base)'],
    'credit': ['Credit', 'Credit Amount', 'Cr', 'Cr Amount', 'Credit (Base)'],
    'amount': ['Amount', 'Net Amount', 'Gross', 'Amount in LC', 'Balance', 'Value'],

    # Reference
    'reference': ['Reference', 'Ref', 'Ref No.', 'Ref #', 'Document Number', 'Doc. No.',
                  'Num', 'Invoice Number', 'Transaction ID', 'Internal ID'],

    # Transaction type
    'type': ['Type', 'Transaction Type', 'Source', 'Source Type', 'Trans Type',
             'Document Type', 'Journal Source', 'T-Code'],
}
```

---

## Column Mapping Code

```python
def detect_gl_columns(df):
    """Auto-detect GL column mapping from a DataFrame.
    Returns dict: role → column_name."""
    mapping = {}
    headers = [str(c).strip() for c in df.columns]
    headers_upper = [h.upper() for h in headers]

    for role, candidates in UNIVERSAL_COLUMN_MAP.items():
        for candidate in candidates:
            if candidate.upper() in headers_upper:
                idx = headers_upper.index(candidate.upper())
                mapping[role] = headers[idx]
                break

    # Validate minimum required columns
    required = ['date', 'description', 'account_code']
    # Must have either debit/credit pair OR single amount column
    has_amounts = ('debit' in mapping and 'credit' in mapping) or 'amount' in mapping

    missing = [r for r in required if r not in mapping]
    if missing or not has_amounts:
        return None, missing + ([] if has_amounts else ['debit/credit or amount'])

    return mapping, []
```
