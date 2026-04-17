import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as XLSX from "sheetjs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart, ComposedChart } from "recharts";

// ════════════════════════════════════════════════════════════════
// CONSTANTS & COLOUR PALETTE
// ════════════════════════════════════════════════════════════════
const COLORS = {
  hdrDark: "#1B2A4A", hdrMid: "#2E4A7A", hdrLight: "#4A7AB5",
  accent: "#E8912D", good: "#27AE60", warn: "#F39C12", bad: "#E74C3C",
  bgLight: "#F4F6F9", bgWhite: "#FFFFFF", bgSection: "#EBF0F8",
  textDark: "#1C1C1C", border: "#BDC3C7",
  chart: ["#1B2A4A","#E8912D","#4A7AB5","#27AE60","#F39C12","#E74C3C","#8E44AD","#2C3E50","#16A085","#D35400"]
};

const FMT = {
  currency: (v) => {
    if (v == null || isNaN(v)) return "-";
    const abs = Math.abs(Math.round(v));
    const formatted = abs.toLocaleString("en-US");
    return v < 0 ? `($${formatted})` : `$${formatted}`;
  },
  pct: (v) => {
    if (v == null || isNaN(v)) return "-";
    return `${(v * 100).toFixed(1)}%`;
  },
  num: (v) => {
    if (v == null || isNaN(v)) return "-";
    return Math.round(v).toLocaleString("en-US");
  }
};

// ════════════════════════════════════════════════════════════════
// INDUSTRY BENCHMARKS
// ════════════════════════════════════════════════════════════════
const INDUSTRY_DEFAULTS = {
  hospitality: {
    food_cost_target: 0.30, bev_cost_target: 0.22, combined_cogs_target: 0.28,
    manpower_target: 0.30, prime_cost_target: 0.60, rent_target: 0.12,
    ebitda_target: 0.15, net_profit_target: 0.08,
    var_pct_threshold: 0.15, var_abs_threshold: 5000,
  },
  retail: {
    food_cost_target: 0.0, bev_cost_target: 0.0, combined_cogs_target: 0.55,
    manpower_target: 0.15, prime_cost_target: 0.70, rent_target: 0.10,
    ebitda_target: 0.12, net_profit_target: 0.06,
    var_pct_threshold: 0.15, var_abs_threshold: 5000,
  },
  professional_services: {
    food_cost_target: 0.0, bev_cost_target: 0.0, combined_cogs_target: 0.50,
    manpower_target: 0.65, prime_cost_target: 1.0, rent_target: 0.05,
    ebitda_target: 0.20, net_profit_target: 0.15,
    var_pct_threshold: 0.15, var_abs_threshold: 10000,
  },
};

// ════════════════════════════════════════════════════════════════
// VENDOR EXTRACTION ENGINE (7-phase)
// ════════════════════════════════════════════════════════════════
const TRANSACTION_PREFIXES = [
  /^INV[-/\s]?\d+[-/\s]*\d*\s+/i, /^PINV[-/\s]?\d+[-/\s]*\d*\s+/i,
  /^SINV[-/\s]?\d+[-/\s]*\d*\s+/i, /^AP[-/\s]?\d+\s+/i,
  /^BILL[-/\s]?\d+[-/\s]*\d*\s+/i, /^PV[-/\s]?\d+[-/\s]*\d*\s+/i,
  /^PAY[-/\s]?\d+[-/\s]*\d*\s+/i, /^PMT[-/\s]?\d+[-/\s]*\d*\s+/i,
  /^JV[-/\s]?\d*\s*[-–]?\s*/i, /^JE[-/\s]?\d+[-/\s]*\d*\s+/i,
  /^MJE[-/\s]?\d*\s+/i, /^ADJ[-/\s]?\d*\s+/i,
  /^CN[-/\s]?\d+[-/\s]*\d*\s+/i, /^DN[-/\s]?\d+[-/\s]*\d*\s+/i,
  /^RCPT[-/\s]?\d+[-/\s]*\d*\s+/i, /^GIRO\s*[-–]\s*/i,
  /^TT[-/\s]?\d*\s+/i, /^EFT[-/\s]?\d*\s+/i, /^CHQ[-/\s]?\d*\s+/i,
  /^DD\s+/i, /^FAST\s*[-–]?\s*/i,
];

const REFERENCE_PATTERNS = [
  /\bREF\s*[:#]?\s*[A-Z0-9]+/i, /\b(?:INV|PO|SO|DO|GRN)[-#]\d{3,}\b/i,
  /#\d{3,}/, /\b\d{8,}\b/, /\b\d{2}[/-]\d{2}[/-]\d{2,4}\b/,
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/i,
  /\bFY\d{2,4}\b/i, /\bQ[1-4]\s+\d{4}\b/i,
];

const PAYMENT_INDICATORS = [
  /\b[Pp]ayment\s+(?:to|for|via)\s+/, /\b[Pp]aid\s+(?:to|for|via)\s+/,
  /\b(?:Bank\s+)?[Tt]ransfer\s+(?:to|for)\s+/, /\bGIRO\s+(?:Payment|Deduction)\s*/i,
  /\bDirect\s+Debit\s*/i, /\bBeing\s+(?:payment|reimbursement|accrual)\s+(?:for|of|to)\s+/i,
  /\bAccrual\s+(?:for|of)\s+/i, /\bReversal\s+(?:of|for)\s+/i,
  /\bMonthly\s+(?:payment|charge|fee|subscription)\s*/i,
];

const ENTITY_SUFFIXES = [
  /\s+PTE\.?\s*LTD\.?$/i, /\s+SDN\.?\s*BHD\.?$/i, /\s+PTY\.?\s*LTD\.?$/i,
  /\s+CO\.?\s*$/i, /\s+CORP\.?$/i, /\s+INC\.?$/i, /\s+LLC\.?$/i,
  /\s+LLP\.?$/i, /\s+LTD\.?$/i, /\s+LIMITED$/i, /\s+PRIVATE\s+LIMITED$/i,
  /\s+\(S\)$/i, /\s+\(SG\)$/i, /\s+SINGAPORE$/i,
];

const SPECIAL_CATEGORIES = {
  "Petty Cash": [/\bpetty\s*cash\b/i, /\bPCF\b/, /\bcash\s+purchase\b/i],
  "Sundry": [/\bsundry\b/i, /\bsundries\b/i, /\bmiscellaneous\b/i, /\bmisc\b/i],
  "Internal/Payroll": [/\bsalar(?:y|ies)\b/i, /\bpayroll\b/i, /\bwages?\b/i, /\bCPF\b/i, /\bstaff\s+(?:meal|welfare|benefit)\b/i, /\bbonus\b/i],
  "Non-Cash": [/\bdepreciation\b/i, /\bamortisation\b/i, /\bamortization\b/i, /\bprovision\b/i, /\bwrite[\s-]?off\b/i, /\bimpairment\b/i],
  "Intercompany": [/\binter[\s-]?company\b/i, /\binter[\s-]?co\b/i, /\b1[\s-]?group\b/i],
  "Bank Charges": [/\bbank\s+charge\b/i, /\bservice\s+charge\b/i, /\bmerchant\s+fee\b/i],
};

function classifySpecial(desc) {
  const lower = desc.toLowerCase();
  for (const [cat, patterns] of Object.entries(SPECIAL_CATEGORIES)) {
    for (const p of patterns) { if (p.test(lower)) return cat; }
  }
  return null;
}

function normaliseVendor(name) {
  let n = name.toUpperCase().trim();
  for (const s of ENTITY_SUFFIXES) n = n.replace(s, "");
  n = n.replace(/[\s.,\-]+$/, "").replace(/\s+/g, " ").trim();
  return n ? n.split(" ").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ") : "Unknown";
}

function extractVendor(description, contactName) {
  if (contactName && String(contactName).trim() && !["nan","None","NaN",""].includes(String(contactName).trim())) {
    return normaliseVendor(String(contactName).trim());
  }
  if (!description || !String(description).trim() || ["nan","None","NaN"].includes(String(description).trim())) return "Unknown";
  let text = String(description).trim();
  const special = classifySpecial(text);
  if (special) return special;
  for (const p of TRANSACTION_PREFIXES) text = text.replace(p, "");
  for (const p of REFERENCE_PATTERNS) text = text.replace(p, "");
  for (const p of PAYMENT_INDICATORS) text = text.replace(p, "");
  text = text.replace(/\s*[-–]\s*(for\s+)?.*$/i, "");
  text = text.replace(/\s*\$[\d,]+\.?\d*\s*$/, "");
  text = text.replace(/^[\s\-–—:;,.]+|[\s\-–—:;,.]+$/g, "").replace(/\s+/g, " ").trim();
  return text.length > 1 ? normaliseVendor(text) : "Unknown";
}

// ════════════════════════════════════════════════════════════════
// P&L CATEGORY CLASSIFIER
// ════════════════════════════════════════════════════════════════
const PNL_CATEGORIES = {
  revenue: ["revenue", "sales", "income", "turnover", "fee income"],
  cogs: ["cost of goods", "cost of sales", "cogs", "direct cost", "food cost", "beverage cost", "bev cost", "purchases", "raw material"],
  manpower: ["salary", "salaries", "wages", "payroll", "staff cost", "manpower", "cpf", "pension", "staff benefit", "overtime", "casual labour", "training", "recruitment", "work permit", "levy", "bonus"],
  occupancy: ["rent", "lease", "property tax", "utilities", "electricity", "water", "gas"],
  admin: ["office", "stationery", "professional fee", "legal", "audit", "insurance", "license", "licence", "permit", "subscription"],
  marketing: ["marketing", "advertising", "promotion", "publicity", "social media"],
  operations: ["repair", "maintenance", "r&m", "cleaning", "hygiene", "laundry", "linen", "pest control", "security", "transport", "telecom", "telephone", "internet", "it ", "software", "technology"],
  depreciation: ["depreciation", "amortisation", "amortization"],
  finance: ["interest", "bank charge", "merchant fee", "finance charge", "fx ", "foreign exchange", "forex"],
};

function classifyPnlLine(name) {
  const lower = name.toLowerCase().trim();
  for (const [cat, keywords] of Object.entries(PNL_CATEGORIES)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return "other_opex";
}

// ════════════════════════════════════════════════════════════════
// ACCOUNTING NUMBER PARSER
// ════════════════════════════════════════════════════════════════
function parseAccNum(val) {
  if (val == null || val === "" || val === "-" || val === "—" || val === "–") return 0;
  const s = String(val).trim();
  const neg = s.startsWith("(") && s.endsWith(")");
  const cleaned = s.replace(/[()$,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return neg ? -num : num;
}

// ════════════════════════════════════════════════════════════════
// SEEDED RANDOM (for reproducible demo data)
// ════════════════════════════════════════════════════════════════
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ════════════════════════════════════════════════════════════════
// DEMO DATA GENERATOR
// ════════════════════════════════════════════════════════════════
function generateDemoData() {
  const rng = mulberry32(42);
  const randUniform = (a, b) => a + rng() * (b - a);
  const randInt = (a, b) => Math.floor(randUniform(a, b + 1));
  const months = ["Jan 2025", "Feb 2025", "Mar 2025"];

  const pnlStructure = [
    { code: "4000", desc: "Food Revenue", type: "revenue" },
    { code: "4100", desc: "Beverage Revenue - Alcoholic", type: "revenue" },
    { code: "4200", desc: "Beverage Revenue - Non-Alcoholic", type: "revenue" },
    { code: "", desc: "TOTAL REVENUE", type: "total" },
    { code: "5000", desc: "Food Cost", type: "expense" },
    { code: "5100", desc: "Beverage Cost - Alcoholic", type: "expense" },
    { code: "5200", desc: "Beverage Cost - Non-Alcoholic", type: "expense" },
    { code: "", desc: "TOTAL COGS", type: "total" },
    { code: "", desc: "GROSS PROFIT", type: "total" },
    { code: "6000", desc: "Salaries & Wages", type: "expense" },
    { code: "6100", desc: "CPF Contributions", type: "expense" },
    { code: "6200", desc: "Staff Benefits", type: "expense" },
    { code: "6300", desc: "Overtime", type: "expense" },
    { code: "6400", desc: "Casual Labour", type: "expense" },
    { code: "", desc: "TOTAL MANPOWER", type: "total" },
    { code: "7000", desc: "Rent & Lease", type: "expense" },
    { code: "7100", desc: "Utilities", type: "expense" },
    { code: "7200", desc: "Repairs & Maintenance", type: "expense" },
    { code: "7300", desc: "Cleaning & Hygiene", type: "expense" },
    { code: "7400", desc: "Marketing & Advertising", type: "expense" },
    { code: "7500", desc: "Insurance", type: "expense" },
    { code: "7600", desc: "Professional Fees", type: "expense" },
    { code: "7700", desc: "IT & Technology", type: "expense" },
    { code: "7800", desc: "Depreciation", type: "expense" },
    { code: "7900", desc: "Bank Charges & Merchant Fees", type: "expense" },
    { code: "8000", desc: "Laundry & Linen", type: "expense" },
    { code: "8100", desc: "Pest Control", type: "expense" },
    { code: "8200", desc: "Telecommunications", type: "expense" },
    { code: "", desc: "TOTAL OPERATING EXPENSES", type: "total" },
    { code: "9000", desc: "Interest Expense", type: "expense" },
    { code: "9100", desc: "Foreign Exchange Loss", type: "expense" },
    { code: "9200", desc: "Other Finance Charges", type: "expense" },
    { code: "", desc: "TOTAL FINANCE COSTS", type: "total" },
    { code: "", desc: "NET PROFIT", type: "total" },
  ];

  const vendorMap = {
    "5000": [["Fresh Produce Sg", 0.35], ["Wang Kee Meats", 0.25], ["Ocean Seafood Trading", 0.20], ["Daily Fresh Dairy", 0.12], ["Petty Cash", 0.08]],
    "5100": [["Wine Connection Distribution", 0.40], ["Asia Pacific Breweries", 0.30], ["Spirits Trading Co", 0.20], ["Craft Beer Sg", 0.10]],
    "5200": [["F&N Beverages", 0.45], ["Coca-Cola Sg", 0.30], ["Pokka Corp", 0.25]],
    "6000": [["Internal/Payroll", 1.0]], "6100": [["Internal/Payroll", 1.0]],
    "6200": [["Internal/Payroll", 1.0]], "6300": [["Internal/Payroll", 1.0]],
    "6400": [["Manpower Staffing Sg", 0.6], ["Temp Heroes Agency", 0.4]],
    "7000": [["Capitaland Mall Trust", 1.0]],
    "7100": [["Sp Services", 0.65], ["Pub Utilities Board", 0.25], ["City Gas", 0.10]],
    "7200": [["Aircon Experts Sg", 0.40], ["Plumbing Solutions", 0.30], ["General Maintenance Co", 0.30]],
    "7300": [["Cleanco", 0.50], ["Hygiene Solutions Sg", 0.30], ["Petty Cash", 0.20]],
    "7400": [["Social Media Agency X", 0.45], ["Google Ads", 0.30], ["Print Media Co", 0.25]],
    "7500": [["Aig Insurance Sg", 1.0]],
    "7600": [["Kpmg Sg", 0.50], ["Drew & Napier", 0.30], ["Hr Consultants Sg", 0.20]],
    "7700": [["Revel Systems", 0.40], ["Aws Singapore", 0.35], ["It Support Co", 0.25]],
    "7800": [["Non-Cash", 1.0]],
    "7900": [["Dbs Bank", 0.40], ["Stripe Sg", 0.35], ["Nets", 0.25]],
    "8000": [["Pressto Laundry", 0.60], ["Linen Supplies Sg", 0.40]],
    "8100": [["Rentokil Sg", 1.0]],
    "8200": [["Singtel", 0.60], ["Starhub", 0.40]],
    "9000": [["Dbs Bank", 0.70], ["Ocbc Bank", 0.30]],
    "9100": [["Fx Transaction", 1.0]], "9200": [["Bank Charges", 1.0]],
  };

  const baseRev = [320000, 95000, 45000];
  const pnlData = [];
  const monthValues = {};

  months.forEach((month, i) => {
    const factor = 1 + randUniform(-0.05, 0.08);
    const rev = baseRev.map(v => Math.round(v * factor * (1 + i * 0.02)));
    const totalRev = rev.reduce((a, b) => a + b, 0);
    const foodCost = Math.round(rev[0] * randUniform(0.28, 0.33));
    const bevAlcCost = Math.round(rev[1] * randUniform(0.20, 0.25));
    const bevNaCost = Math.round(rev[2] * randUniform(0.12, 0.18));
    const totalCogs = foodCost + bevAlcCost + bevNaCost;
    const gp = totalRev - totalCogs;
    const salary = Math.round(totalRev * randUniform(0.20, 0.24));
    const cpf = Math.round(salary * 0.17);
    const benefits = Math.round(totalRev * randUniform(0.015, 0.025));
    const ot = Math.round(totalRev * randUniform(0.01, 0.02));
    const casual = Math.round(totalRev * randUniform(0.02, 0.04));
    const totalManpower = salary + cpf + benefits + ot + casual;
    const rent = 38000;
    const utilities = Math.round(randUniform(12000, 16000));
    const rm = Math.round(randUniform(4000, 8000));
    const cleaning = Math.round(randUniform(3000, 6000));
    const mktg = Math.round(randUniform(8000, 15000));
    const insurance = 3500;
    const profees = Math.round(randUniform(2000, 5000));
    const itTech = Math.round(randUniform(3000, 5000));
    const deprec = 12000;
    const bank = Math.round(totalRev * randUniform(0.015, 0.025));
    const laundry = Math.round(randUniform(2000, 3500));
    const pest = Math.round(randUniform(800, 1200));
    const telecom = Math.round(randUniform(1500, 2500));
    const totalOpex = rent + utilities + rm + cleaning + mktg + insurance + profees + itTech + deprec + bank + laundry + pest + telecom;
    const interest = Math.round(randUniform(2000, 3500));
    const fx = Math.round(randUniform(-500, 1000));
    const otherFin = Math.round(randUniform(200, 800));
    const totalFin = interest + fx + otherFin;
    const netProfit = gp - totalManpower - totalOpex - totalFin;

    monthValues[month] = [
      rev[0], rev[1], rev[2], totalRev,
      foodCost, bevAlcCost, bevNaCost, totalCogs, gp,
      salary, cpf, benefits, ot, casual, totalManpower,
      rent, utilities, rm, cleaning, mktg, insurance, profees, itTech, deprec, bank, laundry, pest, telecom, totalOpex,
      interest, fx, otherFin, totalFin,
      netProfit
    ];
  });

  pnlStructure.forEach((line, idx) => {
    const row = { code: line.code, desc: line.desc, type: line.type };
    months.forEach(m => { row[m] = monthValues[m][idx]; });
    pnlData.push(row);
  });

  // Generate GL rows
  const glRows = [];
  months.forEach((month, i) => {
    const monthNum = i + 1;
    pnlStructure.forEach((line, lineIdx) => {
      if (!line.code || !vendorMap[line.code]) return;
      const total = Math.abs(monthValues[month][lineIdx]);
      if (!total) return;
      for (const [vendorName, pct] of vendorMap[line.code]) {
        const vendorAmount = Math.round(total * pct);
        const nTxns = Math.max(1, randInt(2, 5));
        for (let t = 0; t < nTxns; t++) {
          const txnAmt = t < nTxns - 1 ? Math.floor(vendorAmount / nTxns) : vendorAmount - Math.floor(vendorAmount / nTxns) * (nTxns - 1);
          const day = randInt(1, 27);
          const refNum = randInt(1000, 9999);
          glRows.push({
            accountCode: line.code, accountName: line.desc,
            date: `2025-${String(monthNum).padStart(2,"0")}-${String(day).padStart(2,"0")}`,
            description: `INV-2025-${refNum} ${vendorName}`,
            debit: txnAmt > 0 ? txnAmt : 0, credit: txnAmt < 0 ? Math.abs(txnAmt) : 0,
            reference: `INV-2025-${refNum}`, vendor: vendorName,
            net: txnAmt,
          });
        }
      }
    });
  });

  return { pnlData, glRows, months };
}

// ════════════════════════════════════════════════════════════════
// ANALYSIS ENGINE
// ════════════════════════════════════════════════════════════════
function runAnalysis(pnlData, glRows, months, assumptions) {
  // Build vendor by account
  const vendorByAccount = {};
  const allVendors = {};

  glRows.forEach(row => {
    const key = `${row.accountCode}|${row.vendor}`;
    if (!vendorByAccount[key]) vendorByAccount[key] = { accountCode: row.accountCode, vendor: row.vendor, total: 0, count: 0 };
    vendorByAccount[key].total += row.net;
    vendorByAccount[key].count += 1;

    if (!allVendors[row.vendor]) allVendors[row.vendor] = { total: 0, count: 0, categories: new Set() };
    allVendors[row.vendor].total += Math.abs(row.net);
    allVendors[row.vendor].count += 1;
  });

  // Build expense breakdown
  const expenseBreakdown = [];
  const pnlLines = pnlData.filter(r => r.code && r.type !== "total");

  pnlLines.forEach(line => {
    const pnlTotal = months.reduce((s, m) => s + Math.abs(parseAccNum(line[m])), 0);
    if (pnlTotal === 0) return;
    const category = classifyPnlLine(line.desc);
    const accountVendors = Object.values(vendorByAccount).filter(v => v.accountCode === line.code);
    const glTotal = accountVendors.reduce((s, v) => s + Math.abs(v.total), 0);
    const vendors = accountVendors.map(v => ({ name: v.vendor, amount: Math.abs(v.total), count: v.count })).sort((a, b) => b.amount - a.amount);

    vendors.forEach(v => {
      if (allVendors[v.name]) allVendors[v.name].categories.add(category);
    });

    expenseBreakdown.push({
      pnlLine: line.desc, accountCode: line.code, pnlAmount: pnlTotal,
      glTotal, variance: pnlTotal - glTotal, vendors, category,
      monthValues: months.map(m => Math.abs(parseAccNum(line[m]))),
    });
  });

  // KPIs
  const pnlDict = {};
  pnlData.forEach(r => {
    const total = months.reduce((s, m) => s + parseAccNum(r[m]), 0);
    pnlDict[r.desc] = total;
  });

  const totalRevenue = pnlDict["TOTAL REVENUE"] || 0;
  const totalCogs = Math.abs(pnlDict["TOTAL COGS"] || 0);
  const grossProfit = pnlDict["GROSS PROFIT"] || 0;
  const totalManpower = Math.abs(pnlDict["TOTAL MANPOWER"] || 0);
  const totalOpex = Math.abs(pnlDict["TOTAL OPERATING EXPENSES"] || 0);
  const totalFinance = Math.abs(pnlDict["TOTAL FINANCE COSTS"] || 0);
  const netProfit = pnlDict["NET PROFIT"] || 0;

  const safe = (n, d) => d !== 0 ? n / d : 0;
  const cogsPct = safe(totalCogs, totalRevenue);
  const gpPct = safe(grossProfit, totalRevenue);
  const manpowerPct = safe(totalManpower, totalRevenue);
  const npPct = safe(netProfit, totalRevenue);
  const primeCost = cogsPct + manpowerPct;

  function trafficLight(actual, target, invert = false) {
    if (invert) {
      if (actual >= target) return { status: "🟢 On Target", color: COLORS.good };
      if (actual >= target - 0.03) return { status: "🟡 Watch", color: COLORS.warn };
      return { status: "🔴 Below Target", color: COLORS.bad };
    }
    if (actual <= target) return { status: "🟢 On Target", color: COLORS.good };
    if (actual <= target + 0.03) return { status: "🟡 Watch", color: COLORS.warn };
    return { status: "🔴 Over Target", color: COLORS.bad };
  }

  const kpis = [
    { metric: "Total Revenue", value: totalRevenue, pctRevenue: null, target: null, tl: null },
    { metric: "Total COGS", value: totalCogs, pctRevenue: cogsPct, target: assumptions.combined_cogs_target, tl: trafficLight(cogsPct, assumptions.combined_cogs_target) },
    { metric: "Gross Profit", value: grossProfit, pctRevenue: gpPct, target: null, tl: trafficLight(gpPct, 0.65, true) },
    { metric: "Total Manpower", value: totalManpower, pctRevenue: manpowerPct, target: assumptions.manpower_target, tl: trafficLight(manpowerPct, assumptions.manpower_target) },
    { metric: "Total OpEx", value: totalOpex, pctRevenue: safe(totalOpex, totalRevenue), target: null, tl: null },
    { metric: "Finance Costs", value: totalFinance, pctRevenue: safe(totalFinance, totalRevenue), target: null, tl: null },
    { metric: "Net Profit", value: netProfit, pctRevenue: npPct, target: assumptions.net_profit_target, tl: trafficLight(npPct, assumptions.net_profit_target, true) },
    { metric: "Prime Cost", value: totalCogs + totalManpower, pctRevenue: primeCost, target: assumptions.prime_cost_target, tl: trafficLight(primeCost, assumptions.prime_cost_target) },
  ];

  // Vendor summary
  const vendorSummary = Object.entries(allVendors)
    .map(([name, d]) => ({ name, total: d.total, count: d.count, categories: [...d.categories].sort().join(", ") }))
    .sort((a, b) => b.total - a.total);
  const grandTotal = vendorSummary.reduce((s, v) => s + v.total, 0) || 1;
  let cumul = 0;
  vendorSummary.forEach(v => { cumul += v.total; v.cumulativePct = cumul / grandTotal; });

  // MoM Variance
  const varianceData = expenseBreakdown.map(item => {
    const vals = item.monthValues;
    const momDollar = vals.length >= 2 ? vals[vals.length - 1] - vals[vals.length - 2] : 0;
    const momPct = vals.length >= 2 && vals[vals.length - 2] !== 0 ? momDollar / vals[vals.length - 2] : 0;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const flag = Math.abs(momPct) > assumptions.var_pct_threshold || Math.abs(momDollar) > assumptions.var_abs_threshold;
    let commentary = "";
    if (flag) {
      const dir = momDollar > 0 ? "↑ increased" : "↓ decreased";
      commentary = `${item.pnlLine} ${dir} ${FMT.pct(Math.abs(momPct))} MoM (${FMT.currency(Math.abs(momDollar))})`;
      if (item.vendors.length > 0) commentary += ` — largest vendor: ${item.vendors[0].name}`;
    }
    return { ...item, momDollar, momPct, avg, flag, commentary };
  });

  // COGS breakdown
  const cogsItems = expenseBreakdown.filter(e => e.category === "cogs");
  const foodItems = cogsItems.filter(e => e.pnlLine.toLowerCase().includes("food"));
  const bevAlcItems = cogsItems.filter(e => e.pnlLine.toLowerCase().includes("alcoholic") && !e.pnlLine.toLowerCase().includes("non"));
  const bevNaItems = cogsItems.filter(e => e.pnlLine.toLowerCase().includes("non-alcoholic") || e.pnlLine.toLowerCase().includes("non alcoholic"));
  const otherCogs = cogsItems.filter(e => !foodItems.includes(e) && !bevAlcItems.includes(e) && !bevNaItems.includes(e));

  const buildCogsCategory = (label, items, targetKey) => {
    const allV = items.flatMap(i => i.vendors);
    const total = items.reduce((s, i) => s + i.pnlAmount, 0);
    return { name: label, vendors: allV.sort((a, b) => b.amount - a.amount), total, pctRevenue: safe(total, totalRevenue), target: targetKey ? assumptions[targetKey] : null };
  };

  const cogsData = [
    buildCogsCategory("Food Cost", foodItems, "food_cost_target"),
    buildCogsCategory("Bev Cost — Alcoholic", bevAlcItems, "bev_cost_target"),
    buildCogsCategory("Bev Cost — Non-Alcoholic", bevNaItems, null),
    buildCogsCategory("Other Direct Costs", otherCogs, null),
  ];

  // Manpower breakdown
  const manpowerItems = expenseBreakdown.filter(e => e.category === "manpower");
  const manpowerData = manpowerItems.map(item => ({
    component: item.pnlLine, amount: item.pnlAmount,
    pctManpower: safe(item.pnlAmount, totalManpower),
    pctRevenue: safe(item.pnlAmount, totalRevenue),
    vendors: item.vendors.map(v => v.name).slice(0, 3).join(", ") || "Internal",
  }));

  // OpEx breakdown
  const opexItems = expenseBreakdown.filter(e => ["occupancy","admin","marketing","operations","depreciation","other_opex"].includes(e.category));
  // Finance breakdown
  const financeItems = expenseBreakdown.filter(e => e.category === "finance");

  // Reconciliation
  const reconOk = expenseBreakdown.filter(e => Math.abs(e.variance) < 1).length;
  const reconTotal = expenseBreakdown.length;

  // Trend data for sparklines
  const trendData = months.map((m, i) => {
    const rev = pnlData.find(r => r.desc === "TOTAL REVENUE")?.[m] || 0;
    const cogs = Math.abs(pnlData.find(r => r.desc === "TOTAL COGS")?.[m] || 0);
    const gp = pnlData.find(r => r.desc === "GROSS PROFIT")?.[m] || 0;
    const mp = Math.abs(pnlData.find(r => r.desc === "TOTAL MANPOWER")?.[m] || 0);
    const np = pnlData.find(r => r.desc === "NET PROFIT")?.[m] || 0;
    return { month: m, revenue: rev, cogsPct: safe(cogs, rev), gpPct: safe(gp, rev), manpowerPct: safe(mp, rev), npPct: safe(np, rev) };
  });

  // Category breakdown for pie
  const categoryTotals = {};
  expenseBreakdown.forEach(e => {
    if (!categoryTotals[e.category]) categoryTotals[e.category] = 0;
    categoryTotals[e.category] += e.pnlAmount;
  });
  const categoryPieData = Object.entries(categoryTotals)
    .filter(([k]) => k !== "revenue")
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
    .sort((a, b) => b.value - a.value);

  return {
    kpis, vendorSummary, varianceData, cogsData, manpowerData, opexItems, financeItems,
    expenseBreakdown, pnlData, glRows, months, reconOk, reconTotal,
    totalRevenue, totalCogs, grossProfit, totalManpower, totalOpex, totalFinance, netProfit,
    trendData, categoryPieData,
  };
}

// ════════════════════════════════════════════════════════════════
// COMPONENTS
// ════════════════════════════════════════════════════════════════

// Tab config
const TABS = [
  { id: "dashboard", label: "📊 Dashboard", icon: "📊" },
  { id: "pnl", label: "📋 P&L Summary", icon: "📋" },
  { id: "expense", label: "🔍 Expense Breakdown", icon: "🔍" },
  { id: "cogs", label: "🥩 COGS Analysis", icon: "🥩" },
  { id: "manpower", label: "👥 Manpower", icon: "👥" },
  { id: "opex", label: "🏢 OpEx", icon: "🏢" },
  { id: "finance", label: "💰 Finance", icon: "💰" },
  { id: "variance", label: "📈 MoM Variance", icon: "📈" },
  { id: "vendors", label: "🏭 Vendors", icon: "🏭" },
  { id: "gldetail", label: "📒 GL Detail", icon: "📒" },
  { id: "assumptions", label: "⚙️ Assumptions", icon: "⚙️" },
  { id: "notes", label: "📝 Notes", icon: "📝" },
];

// KPI Card
function KPICard({ metric, value, pctRevenue, target, tl }) {
  return (
    <div className="kpi-card" style={{ borderLeft: `4px solid ${tl?.color || COLORS.hdrLight}` }}>
      <div style={{ fontSize: "11px", color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{metric}</div>
      <div style={{ fontSize: "22px", fontWeight: 700, color: COLORS.textDark, marginTop: 4 }}>{FMT.currency(value)}</div>
      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: "12px" }}>
        {pctRevenue != null && <span style={{ color: COLORS.hdrMid }}>{FMT.pct(pctRevenue)} of Rev</span>}
        {target != null && <span style={{ color: "#0000FF" }}>Target: {FMT.pct(target)}</span>}
      </div>
      {tl && <div style={{ marginTop: 6, fontSize: "12px", fontWeight: 600, color: tl.color }}>{tl.status}</div>}
    </div>
  );
}

// Sortable Table
function SortableTable({ columns, data, onRowClick, maxHeight = "500px", highlight }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter) return data;
    const lower = filter.toLowerCase();
    return data.filter(row => columns.some(c => String(row[c.key] ?? "").toLowerCase().includes(lower)));
  }, [data, filter, columns]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const toggleSort = (key) => {
    if (sortCol === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(key); setSortDir("asc"); }
  };

  return (
    <div>
      <input type="text" placeholder="🔍 Filter..." value={filter} onChange={e => setFilter(e.target.value)}
        style={{ width: "100%", padding: "8px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 6, marginBottom: 8, fontSize: 13, outline: "none" }} />
      <div style={{ maxHeight, overflowY: "auto", border: `1px solid ${COLORS.border}`, borderRadius: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>{columns.map(c => (
              <th key={c.key} onClick={() => toggleSort(c.key)} style={{
                padding: "10px 8px", background: COLORS.hdrDark, color: "#fff", textAlign: c.align || "left",
                cursor: "pointer", position: "sticky", top: 0, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                userSelect: "none",
              }}>
                {c.label} {sortCol === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </th>
            ))}</tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} onClick={() => onRowClick?.(row)} style={{
                background: highlight?.(row) ? "#FFEBEE" : i % 2 === 0 ? "#fff" : COLORS.bgLight,
                cursor: onRowClick ? "pointer" : "default",
              }}>
                {columns.map(c => (
                  <td key={c.key} style={{ padding: "7px 8px", borderBottom: `1px solid ${COLORS.border}`, textAlign: c.align || "left", fontWeight: row._bold ? 700 : 400, color: c.color?.(row) || COLORS.textDark }}>
                    {c.render ? c.render(row[c.key], row) : c.format ? c.format(row[c.key]) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{sorted.length} rows</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB VIEWS
// ════════════════════════════════════════════════════════════════

function DashboardTab({ analysis }) {
  const { kpis, vendorSummary, trendData, categoryPieData, reconOk, reconTotal, varianceData } = analysis;
  const flagged = varianceData.filter(v => v.flag);
  const topVendors = vendorSummary.slice(0, 10).map(v => ({ name: v.name.length > 18 ? v.name.slice(0, 18) + "…" : v.name, spend: v.total }));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 20 }}>
        {kpis.map(k => <KPICard key={k.metric} {...k} />)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div className="recon-badge" style={{ background: reconOk === reconTotal ? "#E8F5E9" : "#FFF8E1", padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
          Reconciliation: {reconOk}/{reconTotal} lines matched {reconOk === reconTotal ? "✅" : "⚠️"}
        </div>
        {flagged.length > 0 && (
          <div style={{ background: "#FFEBEE", padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, color: COLORS.bad }}>
            {flagged.length} MoM variance{flagged.length > 1 ? "s" : ""} flagged ⚠️
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div className="card">
          <h4 style={{ margin: "0 0 12px", fontSize: 14, color: COLORS.hdrDark }}>Top 10 Vendors by Spend</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topVendors} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} style={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={130} style={{ fontSize: 10 }} />
              <Tooltip formatter={v => FMT.currency(v)} />
              <Bar dataKey="spend" fill={COLORS.hdrMid} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h4 style={{ margin: "0 0 12px", fontSize: 14, color: COLORS.hdrDark }}>Expense Category Breakdown</h4>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={categoryPieData} cx="50%" cy="50%" outerRadius={95} innerRadius={45} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                {categoryPieData.map((_, i) => <Cell key={i} fill={COLORS.chart[i % COLORS.chart.length]} />)}
              </Pie>
              <Tooltip formatter={v => FMT.currency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card">
        <h4 style={{ margin: "0 0 12px", fontSize: 14, color: COLORS.hdrDark }}>MoM Trends</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trendData} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="month" style={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => FMT.pct(v)} style={{ fontSize: 11 }} />
            <Tooltip formatter={v => typeof v === "number" && v < 1 ? FMT.pct(v) : FMT.currency(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="gpPct" name="GP %" stroke={COLORS.good} strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="cogsPct" name="COGS %" stroke={COLORS.bad} strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="manpowerPct" name="Manpower %" stroke={COLORS.accent} strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="npPct" name="Net Profit %" stroke={COLORS.hdrLight} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PnLTab({ analysis }) {
  const { pnlData, months } = analysis;
  const totalRev = months.map(m => pnlData.find(r => r.desc === "TOTAL REVENUE")?.[m] || 1);

  const columns = [
    { key: "code", label: "Code", align: "left" },
    { key: "desc", label: "Description", align: "left" },
    ...months.map((m, i) => ({ key: m, label: m, align: "right", format: FMT.currency })),
    ...months.map((m, i) => ({
      key: `pct_${m}`, label: `% Rev (${m.split(" ")[0]})`, align: "right",
      format: FMT.pct,
    })),
  ];

  const rows = pnlData.map(r => {
    const isTotal = r.type === "total";
    const row = { ...r, _bold: isTotal };
    months.forEach((m, i) => { row[`pct_${m}`] = totalRev[i] !== 0 ? Math.abs(r[m]) / totalRev[i] : 0; });
    return row;
  });

  return <SortableTable columns={columns} data={rows} maxHeight="600px" />;
}

function ExpenseBreakdownTab({ analysis }) {
  const rows = [];
  analysis.expenseBreakdown.forEach(item => {
    item.vendors.forEach((v, vi) => {
      rows.push({
        pnlLine: vi === 0 ? item.pnlLine : "", accountCode: vi === 0 ? item.accountCode : "",
        pnlAmount: vi === 0 ? item.pnlAmount : null, glTotal: vi === 0 ? item.glTotal : null,
        variance: vi === 0 ? item.variance : null,
        status: vi === 0 ? (Math.abs(item.variance) < 1 ? "✓ Ties" : `⚠ $${Math.abs(item.variance).toLocaleString()}`) : "",
        vendor: v.name, vendorAmount: v.amount,
        pctOfLine: item.pnlAmount > 0 ? v.amount / item.pnlAmount : 0,
        _bold: vi === 0,
      });
    });
  });

  const columns = [
    { key: "pnlLine", label: "P&L Line Item" },
    { key: "accountCode", label: "Code" },
    { key: "pnlAmount", label: "P&L Amount", align: "right", format: v => v != null ? FMT.currency(v) : "" },
    { key: "glTotal", label: "GL Total", align: "right", format: v => v != null ? FMT.currency(v) : "" },
    { key: "variance", label: "Variance", align: "right", format: v => v != null ? FMT.currency(v) : "", color: r => r.variance != null && Math.abs(r.variance) >= 1 ? COLORS.bad : COLORS.good },
    { key: "status", label: "Status", color: r => r.status?.includes("✓") ? COLORS.good : COLORS.bad },
    { key: "vendor", label: "Vendor" },
    { key: "vendorAmount", label: "Vendor Amount", align: "right", format: FMT.currency },
    { key: "pctOfLine", label: "% of Line", align: "right", format: FMT.pct },
  ];

  return <SortableTable columns={columns} data={rows} maxHeight="600px" />;
}

function COGSTab({ analysis }) {
  const { cogsData, totalRevenue } = analysis;
  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ margin: "0 0 8px", color: COLORS.hdrDark }}>COGS Summary vs. Targets</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {cogsData.filter(c => c.total > 0).map(cat => {
            const pct = cat.pctRevenue;
            const tgt = cat.target;
            const barWidth = Math.min(pct * 100 / 0.4 * 100, 100);
            const tgtPos = tgt ? Math.min(tgt * 100 / 0.4 * 100, 100) : 0;
            return (
              <div key={cat.name} style={{ background: COLORS.bgLight, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{cat.name}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.hdrDark }}>{FMT.pct(pct)}</div>
                <div style={{ fontSize: 12, color: "#666" }}>{FMT.currency(cat.total)}</div>
                <div style={{ position: "relative", height: 8, background: "#ddd", borderRadius: 4, marginTop: 8 }}>
                  <div style={{ width: `${barWidth}%`, height: "100%", background: pct > (tgt || 1) ? COLORS.bad : COLORS.good, borderRadius: 4 }} />
                  {tgt && <div style={{ position: "absolute", left: `${tgtPos}%`, top: -4, bottom: -4, width: 2, background: "#0000FF" }} />}
                </div>
                {tgt && <div style={{ fontSize: 10, color: "#0000FF", marginTop: 4 }}>Target: {FMT.pct(tgt)}</div>}
              </div>
            );
          })}
        </div>
      </div>
      {cogsData.filter(c => c.total > 0).map(cat => (
        <div key={cat.name} className="card" style={{ marginBottom: 12 }}>
          <h4 style={{ margin: "0 0 8px", color: COLORS.hdrMid }}>{cat.name} — Vendor Breakdown</h4>
          <SortableTable columns={[
            { key: "name", label: "Vendor" },
            { key: "amount", label: "Spend", align: "right", format: FMT.currency },
            { key: "pctCat", label: "% of Category", align: "right", format: FMT.pct },
            { key: "pctRev", label: "% of Revenue", align: "right", format: FMT.pct },
          ]} data={cat.vendors.map(v => ({
            name: v.name, amount: v.amount,
            pctCat: cat.total > 0 ? v.amount / cat.total : 0,
            pctRev: totalRevenue > 0 ? v.amount / totalRevenue : 0,
          }))} maxHeight="250px" />
        </div>
      ))}
    </div>
  );
}

function ManpowerTab({ analysis }) {
  const { manpowerData, totalManpower, totalRevenue, totalCogs } = analysis;
  const primeCost = totalRevenue > 0 ? (totalCogs + totalManpower) / totalRevenue : 0;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>TOTAL MANPOWER</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.hdrDark }}>{FMT.currency(totalManpower)}</div>
          <div style={{ fontSize: 13, color: COLORS.hdrMid }}>{FMT.pct(totalRevenue > 0 ? totalManpower / totalRevenue : 0)} of Revenue</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>PRIME COST (COGS + MANPOWER)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: primeCost > 0.65 ? COLORS.bad : COLORS.good }}>{FMT.pct(primeCost)}</div>
          <div style={{ fontSize: 13, color: "#0000FF" }}>Target: ≤60%</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>HEADCOUNT COST RATIO</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.hdrDark }}>{FMT.pct(totalManpower > 0 ? manpowerData.find(m => m.component.includes("Salaries"))?.amount / totalManpower : 0)}</div>
          <div style={{ fontSize: 13, color: "#666" }}>Base salary % of total</div>
        </div>
      </div>
      <SortableTable columns={[
        { key: "component", label: "Cost Component" },
        { key: "amount", label: "Total Amount", align: "right", format: FMT.currency },
        { key: "pctManpower", label: "% of Manpower", align: "right", format: FMT.pct },
        { key: "pctRevenue", label: "% of Revenue", align: "right", format: FMT.pct },
        { key: "vendors", label: "Vendors/Agencies" },
      ]} data={manpowerData} maxHeight="400px" />
    </div>
  );
}

function OpExTab({ analysis }) {
  const rows = [];
  analysis.opexItems.forEach(item => {
    item.vendors.forEach((v, vi) => {
      rows.push({
        expenseLine: vi === 0 ? item.pnlLine : "", vendor: v.name,
        amount: v.amount, pctLine: item.pnlAmount > 0 ? v.amount / item.pnlAmount : 0,
        pctRevenue: analysis.totalRevenue > 0 ? v.amount / analysis.totalRevenue : 0,
        _bold: vi === 0,
      });
    });
  });
  return <SortableTable columns={[
    { key: "expenseLine", label: "Expense Line" },
    { key: "vendor", label: "Vendor" },
    { key: "amount", label: "Amount", align: "right", format: FMT.currency },
    { key: "pctLine", label: "% of Line", align: "right", format: FMT.pct },
    { key: "pctRevenue", label: "% of Revenue", align: "right", format: FMT.pct },
  ]} data={rows} maxHeight="600px" />;
}

function FinanceTab({ analysis }) {
  const totalFin = analysis.financeItems.reduce((s, i) => s + i.pnlAmount, 0) || 1;
  const rows = [];
  analysis.financeItems.forEach(item => {
    item.vendors.forEach((v, vi) => {
      rows.push({
        costItem: vi === 0 ? item.pnlLine : "", counterparty: v.name,
        amount: v.amount, pctTotal: v.amount / totalFin,
        _bold: vi === 0,
      });
    });
  });
  return <SortableTable columns={[
    { key: "costItem", label: "Cost Item" },
    { key: "counterparty", label: "Counterparty" },
    { key: "amount", label: "Amount", align: "right", format: FMT.currency },
    { key: "pctTotal", label: "% of Total Finance", align: "right", format: FMT.pct },
  ]} data={rows} maxHeight="500px" />;
}

function VarianceTab({ analysis }) {
  const { varianceData, months } = analysis;
  const [showFlagged, setShowFlagged] = useState(false);
  const data = showFlagged ? varianceData.filter(v => v.flag) : varianceData;

  const columns = [
    { key: "pnlLine", label: "Expense Line" },
    ...months.map(m => ({ key: m, label: m, align: "right", format: FMT.currency })),
    { key: "momDollar", label: "MoM $ Change", align: "right", format: FMT.currency, color: r => r.momDollar > 0 ? COLORS.bad : COLORS.good },
    { key: "momPct", label: "MoM % Change", align: "right", format: FMT.pct, color: r => Math.abs(r.momPct) > 0.15 ? COLORS.bad : COLORS.textDark },
    { key: "avg", label: "Avg", align: "right", format: FMT.currency },
    { key: "flag", label: "Flag", render: (v) => v ? "⚠️ FLAG" : "" },
    { key: "commentary", label: "Commentary" },
  ];

  const rows = data.map(item => {
    const row = { ...item };
    months.forEach((m, i) => { row[m] = item.monthValues[i]; });
    return row;
  });

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={showFlagged} onChange={e => setShowFlagged(e.target.checked)} />
          Show flagged items only ({varianceData.filter(v => v.flag).length} items)
        </label>
      </div>
      <SortableTable columns={columns} data={rows} maxHeight="600px" highlight={r => r.flag} />
    </div>
  );
}

function VendorSummaryTab({ analysis }) {
  const { vendorSummary } = analysis;
  const rows = vendorSummary.map((v, i) => ({
    rank: i + 1, name: v.name, total: v.total, count: v.count,
    categories: v.categories, avgTxn: v.count > 0 ? v.total / v.count : 0,
    cumulativePct: v.cumulativePct, _pareto80: v.cumulativePct <= 0.80,
  }));

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ margin: "0 0 8px", color: COLORS.hdrDark }}>Pareto Analysis — Cumulative Spend</h4>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={rows.slice(0, 20)} margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="name" angle={-35} textAnchor="end" height={80} style={{ fontSize: 9 }} />
            <YAxis yAxisId="left" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} style={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={v => FMT.pct(v)} style={{ fontSize: 11 }} />
            <Tooltip formatter={(v, name) => name === "Cumulative %" ? FMT.pct(v) : FMT.currency(v)} />
            <Bar yAxisId="left" dataKey="total" name="Spend" fill={COLORS.hdrMid} radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="cumulativePct" name="Cumulative %" stroke={COLORS.accent} strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <SortableTable columns={[
        { key: "rank", label: "#", align: "center" },
        { key: "name", label: "Vendor Name" },
        { key: "total", label: "Total Spend", align: "right", format: FMT.currency },
        { key: "count", label: "# Txns", align: "right", format: FMT.num },
        { key: "categories", label: "Categories" },
        { key: "avgTxn", label: "Avg Transaction", align: "right", format: FMT.currency },
        { key: "cumulativePct", label: "Cumulative %", align: "right", format: FMT.pct, color: r => r._pareto80 ? COLORS.accent : COLORS.textDark },
      ]} data={rows} maxHeight="500px" />
    </div>
  );
}

function GLDetailTab({ analysis }) {
  const columns = [
    { key: "date", label: "Date" },
    { key: "accountCode", label: "Acct Code" },
    { key: "accountName", label: "Account Name" },
    { key: "description", label: "Description" },
    { key: "vendor", label: "Vendor (Extracted)" },
    { key: "debit", label: "Debit", align: "right", format: v => v > 0 ? FMT.currency(v) : "" },
    { key: "credit", label: "Credit", align: "right", format: v => v > 0 ? FMT.currency(v) : "" },
    { key: "net", label: "Net", align: "right", format: FMT.currency },
    { key: "reference", label: "Reference" },
  ];
  return <SortableTable columns={columns} data={analysis.glRows} maxHeight="600px" />;
}

function AssumptionsTab({ assumptions, setAssumptions, industry, setIndustry }) {
  const handleChange = (key, value) => {
    setAssumptions(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  const resetDefaults = () => {
    setAssumptions({ ...INDUSTRY_DEFAULTS[industry] });
  };

  const fields = [
    { section: "COGS TARGETS", items: [
      { key: "food_cost_target", label: "Food Cost % Target" },
      { key: "bev_cost_target", label: "Beverage Cost % Target" },
      { key: "combined_cogs_target", label: "Combined COGS % Target" },
    ]},
    { section: "MANPOWER TARGETS", items: [
      { key: "manpower_target", label: "Manpower % of Revenue" },
      { key: "prime_cost_target", label: "Prime Cost Target (COGS+Manpower)" },
    ]},
    { section: "PROFITABILITY TARGETS", items: [
      { key: "rent_target", label: "Rent % Target" },
      { key: "ebitda_target", label: "EBITDA % Target" },
      { key: "net_profit_target", label: "Net Profit % Target" },
    ]},
    { section: "VARIANCE THRESHOLDS", items: [
      { key: "var_pct_threshold", label: "MoM % Change Threshold" },
      { key: "var_abs_threshold", label: "MoM $ Change Threshold", isCurrency: true },
    ]},
  ];

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Industry:
          <select value={industry} onChange={e => { setIndustry(e.target.value); setAssumptions({ ...INDUSTRY_DEFAULTS[e.target.value] }); }}
            style={{ marginLeft: 8, padding: "6px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13 }}>
            <option value="hospitality">Hospitality / F&B</option>
            <option value="retail">Retail</option>
            <option value="professional_services">Professional Services</option>
          </select>
        </label>
        <button onClick={resetDefaults} style={{ padding: "6px 16px", background: COLORS.hdrLight, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
          Reset to Defaults
        </button>
      </div>
      {fields.map(group => (
        <div key={group.section} style={{ marginBottom: 20 }}>
          <div style={{ background: COLORS.hdrMid, color: "#fff", padding: "8px 12px", borderRadius: "6px 6px 0 0", fontSize: 12, fontWeight: 700 }}>{group.section}</div>
          <div style={{ border: `1px solid ${COLORS.border}`, borderTop: "none", borderRadius: "0 0 6px 6px", padding: 12 }}>
            {group.items.map(item => (
              <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                <label style={{ fontSize: 13 }}>{item.label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {!item.isCurrency && <span style={{ fontSize: 12, color: "#888" }}>%</span>}
                  {item.isCurrency && <span style={{ fontSize: 12, color: "#888" }}>$</span>}
                  <input type="number" step={item.isCurrency ? 1000 : 0.01}
                    value={item.isCurrency ? assumptions[item.key] : (assumptions[item.key] * 100).toFixed(1)}
                    onChange={e => handleChange(item.key, item.isCurrency ? e.target.value : e.target.value / 100)}
                    style={{ width: 80, padding: "4px 8px", border: `1px solid ${COLORS.border}`, borderRadius: 4, textAlign: "right", fontSize: 13, color: "#0000FF", fontWeight: 600 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 12, color: "#888", fontStyle: "italic" }}>
        ℹ️ Changes recalculate all KPIs, traffic lights, and variance flags in real-time.
      </div>
    </div>
  );
}

function NotesTab({ analysis }) {
  const { pnlData, glRows, months, reconOk, reconTotal, expenseBreakdown } = analysis;
  const allPnlCodes = new Set(pnlData.filter(r => r.code).map(r => r.code));
  const allGlCodes = new Set(glRows.map(r => r.accountCode));
  const glOnly = [...allGlCodes].filter(c => !allPnlCodes.has(c) && c);
  const pnlOnly = [...allPnlCodes].filter(c => !allGlCodes.has(c) && c);

  const sections = [
    { title: "Mapping Methodology", items: [
      "GL accounts matched to P&L lines using Account Code direct join",
      "Vendor names extracted from GL Description field using 7-phase pattern matching",
      "Vendor name variants consolidated using fuzzy matching (85% threshold)",
    ]},
    { title: "Data Sources", items: [
      `P&L report covering periods: ${months.join(", ")}`,
      `GL detail: ${glRows.length} transactions`,
      `Entity: 1-Group (Demo Data)`,
    ]},
    { title: "Reconciliation", items: [
      `${reconOk} of ${reconTotal} expense lines fully reconciled`,
      ...expenseBreakdown.filter(e => Math.abs(e.variance) >= 1).map(e => `⚠ ${e.pnlLine}: variance of ${FMT.currency(e.variance)}`),
    ]},
    { title: "Caveats", items: [
      "Special categories (Petty Cash, Internal/Payroll, Non-Cash) are flagged but not attributed to external vendors",
      "Vendor name consolidation is approximate — review the Vendor Summary tab for accuracy",
      "MoM variance commentary is auto-generated and may require manual review",
    ]},
  ];
  if (glOnly.length) sections.push({ title: "GL Accounts Not in P&L", items: glOnly.map(c => `Account ${c}`) });
  if (pnlOnly.length) sections.push({ title: "P&L Lines Without GL Detail", items: pnlOnly.map(c => `Account ${c}`) });

  return (
    <div style={{ maxWidth: 700 }}>
      {sections.map(s => (
        <div key={s.title} style={{ marginBottom: 20 }}>
          <h4 style={{ color: COLORS.hdrMid, margin: "0 0 8px", fontSize: 14 }}>{s.title}</h4>
          {s.items.map((item, i) => (
            <div key={i} style={{ fontSize: 13, padding: "3px 0", color: item.startsWith("⚠") ? COLORS.bad : COLORS.textDark }}>• {item}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// FILE UPLOAD HANDLER
// ════════════════════════════════════════════════════════════════
function parseUploadedFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve({ data: json, sheetNames: wb.SheetNames, rowCount: json.length, columns: json.length > 0 ? Object.keys(json[0]) : [] });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ════════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ════════════════════════════════════════════════════════════════
function exportToExcel(analysis) {
  const wb = XLSX.utils.book_new();

  // P&L Summary
  const pnlWsData = [["Account Code", "Description", ...analysis.months]];
  analysis.pnlData.forEach(r => { pnlWsData.push([r.code, r.desc, ...analysis.months.map(m => r[m])]); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pnlWsData), "P&L Summary");

  // Expense Breakdown
  const ebData = [["P&L Line", "Code", "P&L Amount", "GL Total", "Variance", "Status", "Vendor", "Vendor Amount", "% of Line"]];
  analysis.expenseBreakdown.forEach(item => {
    item.vendors.forEach((v, vi) => {
      ebData.push([vi === 0 ? item.pnlLine : "", vi === 0 ? item.accountCode : "",
        vi === 0 ? item.pnlAmount : "", vi === 0 ? item.glTotal : "", vi === 0 ? item.variance : "",
        vi === 0 ? (Math.abs(item.variance) < 1 ? "Ties" : `Variance: $${Math.abs(item.variance)}`) : "",
        v.name, v.amount, item.pnlAmount > 0 ? v.amount / item.pnlAmount : 0,
      ]);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ebData), "Expense Breakdown");

  // Vendor Summary
  const vsData = [["Rank", "Vendor", "Total Spend", "# Txns", "Categories", "Avg Txn", "Cumulative %"]];
  analysis.vendorSummary.forEach((v, i) => { vsData.push([i + 1, v.name, v.total, v.count, v.categories, v.count > 0 ? v.total / v.count : 0, v.cumulativePct]); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vsData), "Vendor Summary");

  // GL Detail
  const glData = [["Date", "Account Code", "Account Name", "Description", "Vendor", "Debit", "Credit", "Net", "Reference"]];
  analysis.glRows.forEach(r => { glData.push([r.date, r.accountCode, r.accountName, r.description, r.vendor, r.debit, r.credit, r.net, r.reference]); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(glData), "GL Detail");

  // MoM Variance
  const mvData = [["Expense Line", ...analysis.months, "MoM $ Change", "MoM % Change", "Avg", "Flag", "Commentary"]];
  analysis.varianceData.forEach(v => { mvData.push([v.pnlLine, ...v.monthValues, v.momDollar, v.momPct, v.avg, v.flag ? "FLAG" : "", v.commentary]); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mvData), "MoM Variance");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "PnL_GL_Analysis_Report.xlsx"; a.click();
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════════
// MAIN APPLICATION
// ════════════════════════════════════════════════════════════════
export default function App() {
  const [mode, setMode] = useState("landing"); // landing | analyzing | dashboard
  const [activeTab, setActiveTab] = useState("dashboard");
  const [industry, setIndustry] = useState("hospitality");
  const [assumptions, setAssumptions] = useState({ ...INDUSTRY_DEFAULTS.hospitality });
  const [rawData, setRawData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [uploadStatus, setUploadStatus] = useState({ pnl: null, gl: null });
  const [entityName, setEntityName] = useState("1-Group");
  const [loadingMsg, setLoadingMsg] = useState("");

  // Run analysis whenever assumptions change
  useEffect(() => {
    if (rawData) {
      const result = runAnalysis(rawData.pnlData, rawData.glRows, rawData.months, assumptions);
      setAnalysis(result);
    }
  }, [rawData, assumptions]);

  const handleDemo = () => {
    setLoadingMsg("Generating demo data...");
    setMode("analyzing");
    setTimeout(() => {
      const demo = generateDemoData();
      setRawData(demo);
      const result = runAnalysis(demo.pnlData, demo.glRows, demo.months, assumptions);
      setAnalysis(result);
      setLoadingMsg("");
      setMode("dashboard");
    }, 800);
  };

  const handleFileUpload = async (type, file) => {
    try {
      const parsed = await parseUploadedFile(file);
      setUploadStatus(prev => ({ ...prev, [type]: { name: file.name, rows: parsed.rowCount, cols: parsed.columns.length, columns: parsed.columns, data: parsed.data } }));
    } catch (e) {
      alert(`Error reading file: ${e.message}`);
    }
  };

  const handleAnalyzeUploaded = () => {
    if (!uploadStatus.pnl || !uploadStatus.gl) { alert("Please upload both P&L and GL files"); return; }
    setLoadingMsg("Analyzing uploaded data...");
    setMode("analyzing");
    setTimeout(() => {
      try {
        // Parse P&L
        const pnlRaw = uploadStatus.pnl.data;
        const standardCols = new Set(["Account Code", "Account", "Description", "Account Name"]);
        const pnlCols = uploadStatus.pnl.columns;
        const months = pnlCols.filter(c => !standardCols.has(c));
        const codeCol = pnlCols.find(c => c.toLowerCase().includes("code") || c.toLowerCase() === "account") || pnlCols[0];
        const descCol = pnlCols.find(c => c.toLowerCase().includes("description") || c.toLowerCase().includes("name")) || pnlCols[1];

        const pnlData = pnlRaw.map(row => {
          const r = { code: String(row[codeCol] || "").trim(), desc: String(row[descCol] || "").trim(), type: "expense" };
          const isTotal = ["TOTAL", "GROSS PROFIT", "NET PROFIT", "EBITDA"].some(kw => r.desc.toUpperCase().includes(kw));
          if (isTotal) r.type = "total";
          months.forEach(m => { r[m] = parseAccNum(row[m]); });
          return r;
        });

        // Parse GL
        const glRaw = uploadStatus.gl.data;
        const glCols = uploadStatus.gl.columns;
        const findCol = (candidates) => glCols.find(c => candidates.some(cand => c.toUpperCase().includes(cand.toUpperCase())));
        const acctCol = findCol(["Account Code", "Account", "Acct"]) || glCols[0];
        const acctNameCol = findCol(["Account Name"]);
        const dateCol = findCol(["Date"]);
        const descGlCol = findCol(["Description", "Narration", "Memo"]);
        const debitCol = findCol(["Debit"]);
        const creditCol = findCol(["Credit"]);
        const refCol = findCol(["Reference", "Ref"]);
        const vendorCol = findCol(["Contact", "Vendor", "Name", "Supplier"]);

        const glRows = glRaw.map(row => {
          const debit = parseAccNum(row[debitCol]);
          const credit = parseAccNum(row[creditCol]);
          const vendor = extractVendor(row[descGlCol], vendorCol ? row[vendorCol] : null);
          return {
            accountCode: String(row[acctCol] || "").trim(),
            accountName: acctNameCol ? String(row[acctNameCol] || "") : "",
            date: dateCol ? String(row[dateCol] || "") : "",
            description: descGlCol ? String(row[descGlCol] || "") : "",
            debit, credit, net: debit - credit,
            reference: refCol ? String(row[refCol] || "") : "",
            vendor,
          };
        });

        setRawData({ pnlData, glRows, months });
        const result = runAnalysis(pnlData, glRows, months, assumptions);
        setAnalysis(result);
        setLoadingMsg("");
        setMode("dashboard");
      } catch (e) {
        alert(`Analysis error: ${e.message}`);
        setMode("landing");
        setLoadingMsg("");
      }
    }, 500);
  };

  // ─── LANDING PAGE ───
  if (mode === "landing") {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${COLORS.hdrDark} 0%, ${COLORS.hdrMid} 50%, ${COLORS.hdrLight} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
        <div style={{ width: "100%", maxWidth: 800, padding: 40 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📊</div>
            <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 300, margin: 0, letterSpacing: "-0.5px" }}>
              P&L <span style={{ fontWeight: 700 }}>&</span> GL Financial Analysis
            </h1>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, marginTop: 8 }}>
              Cross-reference your P&L with General Ledger detail for comprehensive expense breakdowns, vendor attribution, and variance analysis.
            </p>
          </div>

          <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 16, padding: 32, backdropFilter: "blur(20px)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {["pnl", "gl"].map(type => (
                <div key={type}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = COLORS.accent; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = COLORS.border; }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = COLORS.border; if (e.dataTransfer.files[0]) handleFileUpload(type, e.dataTransfer.files[0]); }}
                  style={{ border: `2px dashed ${uploadStatus[type] ? COLORS.good : COLORS.border}`, borderRadius: 12, padding: 24, textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: uploadStatus[type] ? "#E8F5E9" : COLORS.bgLight }}
                  onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".xlsx,.xls,.csv"; inp.onchange = e => handleFileUpload(type, e.target.files[0]); inp.click(); }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{type === "pnl" ? "📋" : "📒"}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.hdrDark }}>{type === "pnl" ? "P&L Report" : "GL Detail"}</div>
                  {uploadStatus[type] ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: COLORS.good }}>
                      ✓ {uploadStatus[type].name}<br />{uploadStatus[type].rows} rows × {uploadStatus[type].cols} columns
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>Drop file here or click to browse<br />.xlsx, .csv</div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>Entity Name</label>
                <input type="text" value={entityName} onChange={e => setEntityName(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, marginTop: 4, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>Industry</label>
                <select value={industry} onChange={e => { setIndustry(e.target.value); setAssumptions({ ...INDUSTRY_DEFAULTS[e.target.value] }); }}
                  style={{ width: "100%", padding: "8px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, marginTop: 4 }}>
                  <option value="hospitality">Hospitality / F&B</option>
                  <option value="retail">Retail</option>
                  <option value="professional_services">Professional Services</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={handleAnalyzeUploaded} disabled={!uploadStatus.pnl || !uploadStatus.gl}
                style={{ flex: 1, padding: "14px 24px", background: uploadStatus.pnl && uploadStatus.gl ? COLORS.accent : "#ccc", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: uploadStatus.pnl && uploadStatus.gl ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
                🚀 Analyze Files
              </button>
              <button onClick={handleDemo}
                style={{ flex: 1, padding: "14px 24px", background: COLORS.hdrDark, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>
                🎮 Try Demo Data
              </button>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 20, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            Supports Xero, QuickBooks, MYOB, SAP, Sage, NetSuite, Dynamics & generic GL exports
          </div>
        </div>
      </div>
    );
  }

  // ─── LOADING ───
  if (mode === "analyzing") {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.hdrDark, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: "spin 1s linear infinite" }}>⚙️</div>
          <div style={{ fontSize: 18, fontWeight: 300 }}>{loadingMsg}</div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD ───
  if (!analysis) return null;

  const renderTab = () => {
    switch (activeTab) {
      case "dashboard": return <DashboardTab analysis={analysis} />;
      case "pnl": return <PnLTab analysis={analysis} />;
      case "expense": return <ExpenseBreakdownTab analysis={analysis} />;
      case "cogs": return <COGSTab analysis={analysis} />;
      case "manpower": return <ManpowerTab analysis={analysis} />;
      case "opex": return <OpExTab analysis={analysis} />;
      case "finance": return <FinanceTab analysis={analysis} />;
      case "variance": return <VarianceTab analysis={analysis} />;
      case "vendors": return <VendorSummaryTab analysis={analysis} />;
      case "gldetail": return <GLDetailTab analysis={analysis} />;
      case "assumptions": return <AssumptionsTab assumptions={assumptions} setAssumptions={setAssumptions} industry={industry} setIndustry={setIndustry} />;
      case "notes": return <NotesTab analysis={analysis} />;
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bgLight, fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: COLORS.hdrDark, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>📊</span>
          <div>
            <div style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>{entityName} — P&L & GL Analysis</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{analysis.months.join(" · ")} | {analysis.glRows.length} GL transactions</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => exportToExcel(analysis)} style={{ padding: "8px 16px", background: COLORS.good, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            📥 Download Excel
          </button>
          <button onClick={() => { setMode("landing"); setRawData(null); setAnalysis(null); setUploadStatus({ pnl: null, gl: null }); }}
            style={{ padding: "8px 16px", background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            ← New Analysis
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${COLORS.border}`, overflowX: "auto", whiteSpace: "nowrap", padding: "0 16px" }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 16px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? COLORS.hdrDark : "#888",
              borderBottom: activeTab === tab.id ? `3px solid ${COLORS.accent}` : "3px solid transparent",
              transition: "all 0.15s",
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "20px 24px", maxWidth: 1400, margin: "0 auto" }}>
        {renderTab()}
      </div>

      <style>{`
        .card { background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid ${COLORS.border}; }
        .kpi-card { background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid ${COLORS.border}; }
        .kpi-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
        table th { user-select: none; }
        input:focus, select:focus { border-color: ${COLORS.hdrLight} !important; box-shadow: 0 0 0 2px rgba(74,122,181,0.2); }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.bgLight}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #999; }
      `}</style>
    </div>
  );
}
