# Vendor Name Extraction Patterns

This is the most critical reference file in the skill. GL description fields are messy, inconsistent,
and vary wildly across accounting systems. This document provides the regex patterns, normalisation
logic, and fuzzy-matching strategies for reliably extracting vendor/supplier names.

---

## Table of Contents

1. [GL Description Anatomy](#gl-description-anatomy)
2. [Phase 1: Strip Known Prefixes](#phase-1-strip-known-prefixes)
3. [Phase 2: Strip Reference Numbers](#phase-2-strip-reference-numbers)
4. [Phase 3: Strip Payment Method Indicators](#phase-3-strip-payment-method-indicators)
5. [Phase 4: Extract the Vendor Name](#phase-4-extract-the-vendor-name)
6. [Phase 5: Normalise](#phase-5-normalise)
7. [Phase 6: Fuzzy Consolidation](#phase-6-fuzzy-consolidation)
8. [Phase 7: Special Categories](#phase-7-special-categories)
9. [System-Specific Patterns](#system-specific-patterns)
10. [Complete Python Implementation](#complete-python-implementation)

---

## GL Description Anatomy

Typical GL description formats encountered in the wild:

```
"INV-2024-001 CleanCo Pte Ltd"              → Vendor: CleanCo Pte Ltd
"Payment to ABC Supplies Ref:TT20240115"     → Vendor: ABC Supplies
"GIRO - Singtel Monthly Dec 2024"            → Vendor: Singtel
"PV-0892 Fresh Produce SG - Jan delivery"    → Vendor: Fresh Produce SG
"JV - Accrual for CleanCo Dec services"      → Vendor: CleanCo
"AP001234 WANG KEE FRESH MEATS PTE LTD"      → Vendor: Wang Kee Fresh Meats
"DD Maybank Loan Interest Jan 2025"          → Vendor: Maybank (flag as lender)
"Petty Cash - Office supplies 15/01/25"      → Vendor: Petty Cash (special category)
"Salary Jan 2025"                            → Vendor: Internal/Payroll
"Staff meal allowance"                        → Vendor: Internal/Staff
"Bank charges - DBS Jan 2025"               → Vendor: DBS
"Depreciation - Kitchen equipment"           → Vendor: N/A (non-cash)
```

---

## Phase 1: Strip Known Prefixes

Document/transaction type prefixes that appear at the start of GL descriptions.

```python
TRANSACTION_PREFIXES = [
    # Accounts Payable / Invoices
    r'^INV[-/\s]?\d*\s*',           # INV-2024-001, INV 1234, INV-
    r'^PINV[-/\s]?\d*\s*',          # Purchase Invoice
    r'^SINV[-/\s]?\d*\s*',          # Sales Invoice (less common in expenses)
    r'^AP[-/\s]?\d*\s*',            # AP001234
    r'^BILL[-/\s]?\d*\s*',          # BILL-001 (Xero/QBO)

    # Payment Vouchers / Payments
    r'^PV[-/\s]?\d*\s*',            # PV-0892
    r'^PAY[-/\s]?\d*\s*',           # PAY-001
    r'^PMT[-/\s]?\d*\s*',           # PMT-2024-001
    r'^PYMT[-/\s]?\d*\s*',

    # Journal Entries
    r'^JV[-/\s]?\d*\s*',            # JV-001
    r'^JE[-/\s]?\d*\s*',            # JE-2024-001
    r'^MJE[-/\s]?\d*\s*',           # Manual Journal Entry
    r'^ADJ[-/\s]?\d*\s*',           # Adjustment

    # Credit/Debit Notes
    r'^CN[-/\s]?\d*\s*',            # CN-001
    r'^DN[-/\s]?\d*\s*',            # DN-001
    r'^CRN[-/\s]?\d*\s*',

    # Receipts
    r'^RCPT[-/\s]?\d*\s*',          # RCPT-001
    r'^REC[-/\s]?\d*\s*',
    r'^OR[-/\s]?\d*\s*',            # Official Receipt

    # Banking
    r'^GIRO\s*[-–]\s*',             # GIRO - Vendor
    r'^TT[-/\s]?\d*\s*',            # Telegraphic Transfer
    r'^EFT[-/\s]?\d*\s*',           # Electronic Funds Transfer
    r'^CHQ[-/\s]?\d*\s*',           # Cheque
    r'^DD\s+',                       # Direct Debit
    r'^BACS\s*',                     # UK bank transfer
    r'^FAST\s*[-–]?\s*',            # SG fast transfer
]
```

---

## Phase 2: Strip Reference Numbers

Reference numbers, invoice numbers, and dates embedded anywhere in the description.

```python
REFERENCE_PATTERNS = [
    r'\bREF\s*[:#]?\s*\w+',                     # Ref:TT20240115, REF ABC123
    r'\b(INV|PO|SO|DO|GRN)[-#]?\d{3,}\b',       # INV-2024-001, PO#12345
    r'#\d{3,}',                                   # #12345
    r'\b\d{8,}\b',                                # Long numeric strings (bank refs)
    r'\b\d{2}[/-]\d{2}[/-]\d{2,4}\b',           # Dates: 15/01/25, 01-15-2025
    r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{2,4}\b',  # Mon YYYY
    r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{2,4}\b',
    r'\b20\d{2}\b',                               # Year: 2024, 2025
    r'\bFY\d{2,4}\b',                             # FY2024, FY24
    r'\bQ[1-4]\s*\d{0,4}\b',                     # Q1, Q1 2024
]
```

---

## Phase 3: Strip Payment Method Indicators

Phrases that describe HOW the payment was made, not WHO was paid.

```python
PAYMENT_INDICATORS = [
    r'\b(?:Payment|Paid)\s+(?:to|for|via)\s+',   # "Payment to", "Paid for"
    r'\b(?:Bank\s+)?Transfer\s+(?:to|for)\s+',
    r'\bGIRO\s+(?:Payment|Deduction)\s*',
    r'\bDirect\s+Debit\s*',
    r'\bAuto[\s-]?Pay\s*',
    r'\bStanding\s+Order\s*',
    r'\bOnline\s+(?:Payment|Banking)\s*',
    r'\bCredit\s+Card\s+(?:Payment|Charge)\s*',
    r'\bBeing\s+(?:payment|reimbursement|accrual)\s+(?:for|of|to)\s+',
    r'\bAccrual\s+(?:for|of)\s+',
    r'\bReversal\s+(?:of|for)\s+',
    r'\bMonthly\s+(?:payment|charge|fee|subscription)\s*',
    r'\b[-–]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(?:delivery|services?|charges?|payment|invoice)\s*',
]
```

---

## Phase 4: Extract the Vendor Name

After stripping all the noise, the remaining text is the candidate vendor name.
Additional cleanup:

```python
def extract_vendor_core(cleaned_text):
    """After phases 1-3, extract the core vendor name."""
    text = cleaned_text.strip()

    # Remove trailing descriptions that aren't vendor names
    text = re.sub(r'\s*[-–]\s*(for\s+)?.*$', '', text, flags=re.IGNORECASE)

    # Remove trailing period amounts: "... $1,234.56"
    text = re.sub(r'\s*\$[\d,]+\.?\d*\s*$', '', text)

    # Remove leading/trailing punctuation and whitespace
    text = re.sub(r'^[\s\-–—:;,\.]+|[\s\-–—:;,\.]+$', '', text)

    # Collapse multiple spaces
    text = re.sub(r'\s+', ' ', text).strip()

    return text if len(text) > 1 else 'UNKNOWN'
```

---

## Phase 5: Normalise

Standardise vendor names for grouping.

```python
ENTITY_SUFFIXES = [
    r'\s+PTE\.?\s*LTD\.?$',
    r'\s+SDN\.?\s*BHD\.?$',
    r'\s+PTY\.?\s*LTD\.?$',
    r'\s+CO\.?\s*$',
    r'\s+CORP\.?$',
    r'\s+INC\.?$',
    r'\s+LLC\.?$',
    r'\s+LLP\.?$',
    r'\s+LP\.?$',
    r'\s+LTD\.?$',
    r'\s+LIMITED$',
    r'\s+PRIVATE\s+LIMITED$',
    r'\s+\(S\)$',              # (S) for Singapore entities
    r'\s+\(SG\)$',
    r'\s+\(M\)$',              # (M) for Malaysia entities
    r'\s+SINGAPORE$',
    r'\s+S\'PORE$',
]

def normalise_vendor(name):
    """Normalise vendor name for grouping."""
    n = name.upper().strip()
    for suffix in ENTITY_SUFFIXES:
        n = re.sub(suffix, '', n, flags=re.IGNORECASE)
    # Remove trailing punctuation
    n = re.sub(r'[\s\.\,\-]+$', '', n)
    # Collapse whitespace
    n = re.sub(r'\s+', ' ', n).strip()
    return n
```

---

## Phase 6: Fuzzy Consolidation

After normalisation, similar names may still exist. Use fuzzy matching to merge them.

```python
from difflib import SequenceMatcher

def fuzzy_group_vendors(vendor_list, threshold=0.85):
    """Group similar vendor names. Returns dict: canonical_name → [variants]."""
    groups = {}
    sorted_vendors = sorted(vendor_list, key=lambda x: (-len(x), x))

    for vendor in sorted_vendors:
        matched = False
        for canonical in groups:
            ratio = SequenceMatcher(None, vendor.upper(), canonical.upper()).ratio()
            if ratio >= threshold:
                groups[canonical].append(vendor)
                matched = True
                break
        if not matched:
            groups[vendor] = [vendor]

    return groups
```

The threshold of 0.85 works well for most cases. Lower it to 0.80 if vendor names have many
abbreviation variants; raise to 0.90 if false merges are occurring.

After fuzzy consolidation, present the vendor mapping to the user for confirmation before
finalising the workbook. Show: "I've consolidated these vendor name variants — please confirm
or correct."

---

## Phase 7: Special Categories

Some GL descriptions don't have external vendors. Classify these separately:

```python
SPECIAL_CATEGORIES = {
    'PETTY_CASH': [r'\bpetty\s*cash\b', r'\bPCF\b', r'\bcash\s+purchase\b'],
    'SUNDRY': [r'\bsundry\b', r'\bsundries\b', r'\bmiscellaneous\b', r'\bmisc\b'],
    'INTERNAL': [r'\bsalar(?:y|ies)\b', r'\bpayroll\b', r'\bwages?\b', r'\bCPF\b',
                 r'\bstaff\s+(?:meal|welfare|benefit)\b', r'\bbonus\b', r'\bleave\b'],
    'NON_CASH': [r'\bdepreciation\b', r'\bamortisation\b', r'\bamortization\b',
                 r'\bprovision\b', r'\bwrite[\s-]?off\b', r'\bimpairment\b',
                 r'\bunrealised\b', r'\bunrealized\b'],
    'INTERCOMPANY': [r'\binter[\s-]?company\b', r'\binter[\s-]?co\b', r'\brelated\s+party\b',
                     r'\b1[\s-]?group\b', r'\bICO\b'],
    'BANK_CHARGES': [r'\bbank\s+charge\b', r'\bservice\s+charge\b', r'\bmerchant\s+fee\b',
                     r'\btransaction\s+fee\b', r'\bswift\s+charge\b'],
}

def classify_special(description):
    """Return special category if description matches, else None."""
    desc_lower = description.lower()
    for category, patterns in SPECIAL_CATEGORIES.items():
        for pattern in patterns:
            if re.search(pattern, desc_lower):
                return category
    return None
```

---

## System-Specific Patterns

### Xero
- Description format: usually clean, vendor name often in "Name" or "Contact" column separate from description
- If Contact column exists, prefer it over description parsing
- Journal descriptions: "Manual Journal - [description]"

### QuickBooks / QBO
- "Memo" field contains free text; "Name" field has the vendor
- If "Name" column is available, use it directly — it's the cleanest source
- Expense descriptions: "[Vendor Name] : [Account Name]"

### MYOB
- "Card Name" column = vendor name (use directly)
- Description/Memo is supplementary
- GST component may be split into separate rows

### SAP
- "Vendor Name" / "Business Partner" column exists in most exports
- Description: "Invoice [number] [vendor]"
- Long text field may contain more detail
- Vendor codes (V000123) can be cross-referenced to vendor master

### Sage
- "Supplier" column usually available in purchase ledger exports
- "Details" field: "[Reference] [Description]"
- Nominal code = account code

### NetSuite
- "Name" or "Entity" column = vendor
- "Memo" field for additional context
- Subsidiary/entity column for multi-entity

### Sun Systems
- "Description" field is primary
- Often formatted: "[Account Code] - [Description]"
- Vendor name may be in a separate "Analysis" field

### Microsoft Dynamics (D365 / Business Central)
- "Vendor Name" or "Account Name" column
- Description: "[Document Type] [Number] [Vendor]"
- Posting groups indicate vendor category

---

## Complete Python Implementation

```python
import re
from difflib import SequenceMatcher

class VendorExtractor:
    """Extract and normalise vendor names from GL descriptions."""

    def __init__(self, fuzzy_threshold=0.85):
        self.threshold = fuzzy_threshold
        self._compile_patterns()

    def _compile_patterns(self):
        self.prefix_re = [re.compile(p, re.IGNORECASE) for p in TRANSACTION_PREFIXES]
        self.ref_re = [re.compile(p, re.IGNORECASE) for p in REFERENCE_PATTERNS]
        self.payment_re = [re.compile(p, re.IGNORECASE) for p in PAYMENT_INDICATORS]
        self.suffix_re = [re.compile(p, re.IGNORECASE) for p in ENTITY_SUFFIXES]

    def extract(self, description, contact_name=None):
        """Extract vendor name from a GL description.
        If a contact_name column value is provided and non-empty, prefer it."""
        if contact_name and str(contact_name).strip() not in ('', 'nan', 'None'):
            return self.normalise(str(contact_name).strip())

        if not description or str(description).strip() in ('', 'nan', 'None'):
            return 'UNKNOWN'

        text = str(description).strip()

        # Check special categories first
        special = classify_special(text)
        if special:
            return f'[{special}]'

        # Phase 1: Strip prefixes
        for pattern in self.prefix_re:
            text = pattern.sub('', text)

        # Phase 2: Strip references
        for pattern in self.ref_re:
            text = pattern.sub('', text)

        # Phase 3: Strip payment indicators
        for pattern in self.payment_re:
            text = pattern.sub('', text)

        # Phase 4: Extract core name
        name = extract_vendor_core(text)

        # Phase 5: Normalise
        return self.normalise(name)

    def normalise(self, name):
        n = name.upper().strip()
        for pattern in self.suffix_re:
            n = pattern.sub('', n)
        n = re.sub(r'[\s\.\,\-]+$', '', n)
        n = re.sub(r'\s+', ' ', n).strip()
        return n.title() if n else 'UNKNOWN'

    def consolidate(self, vendor_amounts):
        """Given {vendor_name: total_amount}, consolidate similar names.
        Returns {canonical: {total: float, variants: [str]}}."""
        groups = fuzzy_group_vendors(list(vendor_amounts.keys()), self.threshold)
        result = {}
        for canonical, variants in groups.items():
            total = sum(vendor_amounts.get(v, 0) for v in variants)
            result[canonical] = {'total': total, 'variants': variants}
        return result
```

---

## Testing Vendor Extraction

Test cases to verify the extractor works correctly:

| GL Description | Expected Vendor |
|---|---|
| `INV-2024-001 CleanCo Pte Ltd` | CleanCo |
| `Payment to ABC Supplies Ref:TT20240115` | Abc Supplies |
| `GIRO - Singtel Monthly Dec 2024` | Singtel |
| `PV-0892 Fresh Produce SG - Jan delivery` | Fresh Produce Sg |
| `Petty Cash - Office supplies 15/01/25` | [PETTY_CASH] |
| `Salary Jan 2025` | [INTERNAL] |
| `Depreciation - Kitchen equipment` | [NON_CASH] |
| `Bank charges - DBS Jan 2025` | Dbs |
| `AP001234 WANG KEE FRESH MEATS PTE LTD` | Wang Kee Fresh Meats |
| `DD Maybank Loan Interest Jan 2025` | Maybank |
| `JV - Accrual for CleanCo Dec services` | Cleanco |
| `1-Group intercompany charge` | [INTERCOMPANY] |
