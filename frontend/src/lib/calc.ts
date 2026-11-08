/**
 * Resilience Rewired: Pure TypeScript Reference Engine
 * Mirrors pipeline/calc.py exactly for client-side <16ms calculation.
 */

export interface ShockParams {
  eiPct: number;          // 0-100% (default 100 for normal, 55 for EI)
  billsUpPct: number;     // 0-100% (default 0, 15 for bills spike)
  repairMonths: number;   // emergency cost as k * S
  oneOffFixed: number;    // fixed one-off cost in $
  durationMonths: number; // default 6
}

export interface SpendMedians {
  card_withdrawals: number;
  transfers_out_other: number;
  cash_withdrawals_genuine: number;
  household_bills: number;
  insurance: number;
  loan_payments: number;
  bank_fees: number;
}

export interface IncomeMedians {
  cash_deposits: number;
  transfers_in: number;
  pension_in: number;
  interest_in: number;
}

export interface AccountSnapshot {
  token: string;
  account_id: number;
  I: number;
  S: number;
  F: number;
  H: number;
  B: number;
  P: number;
  n_months: number;
  base_runway: number;
  layoff_runway: number;
  combo_runway: number;
  furnace_runway: number;
  survives_layoff_6mo: boolean;
  spend_medians: SpendMedians;
  income_medians: IncomeMedians;
  segments: {
    has_loan: boolean;
    has_pension: boolean;
    card_type: string;
    region: string;
    unemployment_rate: number;
    district_id: number;
  };
  history: Array<{
    month: string;
    money_in: number;
    money_out: number;
    avg_daily_balance: number;
    days_below_zero: number;
  }>;
}

/**
 * Computes months of financial runway.
 */
export function calculateRunway(bufferLeft: number, gap: number): number {
  if (bufferLeft <= 0) return 0.0;
  if (gap <= 0) return 120.0;
  const val = bufferLeft / gap;
  return Math.round(Math.min(val, 120.0) * 10) / 10;
}

/**
 * Applies personal and macroeconomic shocks to income and spending.
 */
export function applyShock(
  I: number,
  S: number,
  H: number,
  params: ShockParams
): { incomeAfter: number; spendAfter: number; oneOffCosts: number; bufferLeft: number; gap: number; runway: number } {
  const incomeAfter = (params.eiPct / 100.0) * I;
  const spendAfter = S + (params.billsUpPct / 100.0) * H;
  const oneOffCosts = params.repairMonths * S + params.oneOffFixed;
  return {
    incomeAfter,
    spendAfter,
    oneOffCosts,
    bufferLeft: 0, // calculated with B in caller
    gap: spendAfter - incomeAfter,
    runway: 0,
  };
}

export function computeRunwayUnderShock(
  snapshot: AccountSnapshot,
  params: ShockParams,
  extraCut: number = 0
): {
  incomeAfter: number;
  spendAfter: number;
  oneOffCosts: number;
  bufferLeft: number;
  gap: number;
  runway: number;
  survives: boolean;
} {
  const incomeAfter = (params.eiPct / 100.0) * snapshot.I;
  const spendAfter = snapshot.S + (params.billsUpPct / 100.0) * snapshot.H - extraCut;
  const oneOffCosts = params.repairMonths * snapshot.S + params.oneOffFixed;
  const bufferLeft = snapshot.B - oneOffCosts;
  const gap = spendAfter - incomeAfter;
  const runway = calculateRunway(bufferLeft, gap);
  const survives = runway >= params.durationMonths || gap <= 0;

  return {
    incomeAfter: Math.round(incomeAfter * 100) / 100,
    spendAfter: Math.round(spendAfter * 100) / 100,
    oneOffCosts: Math.round(oneOffCosts * 100) / 100,
    bufferLeft: Math.round(bufferLeft * 100) / 100,
    gap: Math.round(gap * 100) / 100,
    runway,
    survives,
  };
}

export interface GoalPlan {
  surplus: number;
  target3mo: number;
  target6mo: number;
  gapTo3mo: number;
  gapTo6mo: number;
  hasSavingRoom: boolean;
  monthlySave: number;
  monthsTo3mo: number | null;
  monthsTo6mo: number | null;
  message: string;
}

export function calculateGoalPlan(I: number, S: number, B: number, savingsRate: number = 0.5): GoalPlan {
  const surplus = I - S;
  const target3mo = 3 * S;
  const target6mo = 6 * S;
  const gapTo3mo = Math.max(target3mo - B, 0);
  const gapTo6mo = Math.max(target6mo - B, 0);

  if (surplus <= 0) {
    return {
      surplus: Math.round(surplus * 100) / 100,
      target3mo: Math.round(target3mo),
      target6mo: Math.round(target6mo),
      gapTo3mo: Math.round(gapTo3mo),
      gapTo6mo: Math.round(gapTo6mo),
      hasSavingRoom: false,
      monthlySave: 0,
      monthsTo3mo: null,
      monthsTo6mo: null,
      message: "No current monthly surplus. Use the backup plan cuts to create saving capacity.",
    };
  }

  const monthlySave = savingsRate * surplus;
  const monthsTo3mo = monthlySave > 0 && gapTo3mo > 0 ? Math.ceil(gapTo3mo / monthlySave) : 0;
  const monthsTo6mo = monthlySave > 0 && gapTo6mo > 0 ? Math.ceil(gapTo6mo / monthlySave) : 0;

  return {
    surplus: Math.round(surplus * 100) / 100,
    target3mo: Math.round(target3mo),
    target6mo: Math.round(target6mo),
    gapTo3mo: Math.round(gapTo3mo),
    gapTo6mo: Math.round(gapTo6mo),
    hasSavingRoom: true,
    monthlySave: Math.round(monthlySave * 100) / 100,
    monthsTo3mo,
    monthsTo6mo,
    message: `Saving ${Math.round(savingsRate * 100)}% of surplus ($${monthlySave.toFixed(0)}/mo) fills a 6-month buffer in ${monthsTo6mo} months.`,
  };
}

export const DEFAULT_CUT_CAPS: Record<keyof SpendMedians, number> = {
  bank_fees: 1.0,                 // 100%
  card_withdrawals: 0.30,         // 30%
  transfers_out_other: 0.25,      // 25%
  cash_withdrawals_genuine: 0.15, // 15%
  household_bills: 0.05,          // 5%
  insurance: 0.0,                 // 0%
  loan_payments: 0.0,             // 0% (handled via pause loan lever)
};

export interface BackupPlanResult {
  cutNeeded: number;
  totalCutFound: number;
  unmetCut: number;
  allocatedCuts: Record<string, number>;
  runwayAfterCuts: number;
  survivesWithCuts: boolean;
}

export function calculateBackupPlan(
  bufferLeft: number,
  gap: number,
  durationMonths: number,
  spendMedians: SpendMedians
): BackupPlanResult {
  const neededGap = durationMonths > 0 ? bufferLeft / durationMonths : 0;
  const cutNeeded = Math.max(0, gap - neededGap);

  const priorityOrder: Array<keyof SpendMedians> = [
    "bank_fees",
    "card_withdrawals",
    "transfers_out_other",
    "cash_withdrawals_genuine",
    "household_bills",
  ];

  const allocatedCuts: Record<string, number> = {};
  let remainingCut = cutNeeded;

  for (const cat of priorityOrder) {
    const medianVal = spendMedians[cat] || 0;
    const maxPct = DEFAULT_CUT_CAPS[cat] || 0;
    const maxCutAvail = medianVal * maxPct;

    if (maxCutAvail <= 0) continue;

    const actualCut = Math.min(remainingCut, maxCutAvail);
    allocatedCuts[cat] = Math.round(actualCut * 100) / 100;
    remainingCut -= actualCut;

    if (remainingCut <= 0.01) {
      remainingCut = 0;
      break;
    }
  }

  const totalCutFound = Object.values(allocatedCuts).reduce((a, b) => a + b, 0);
  const shortfallAfterCuts = Math.max(0, gap - totalCutFound);
  const runwayAfterCuts = calculateRunway(bufferLeft, shortfallAfterCuts);

  return {
    cutNeeded: Math.round(cutNeeded * 100) / 100,
    totalCutFound: Math.round(totalCutFound * 100) / 100,
    unmetCut: Math.round(remainingCut * 100) / 100,
    allocatedCuts,
    runwayAfterCuts,
    survivesWithCuts: runwayAfterCuts >= durationMonths || shortfallAfterCuts <= 0,
  };
}

export interface Lever {
  name: string;
  deltaSpend: number;
  deltaIncome: number;
  newRunway: number;
  deltaMonths: number;
  description: string;
}

export function calculateLevers(
  snapshot: AccountSnapshot,
  params: ShockParams
): Lever[] {
  const shock = computeRunwayUnderShock(snapshot, params);
  const baseRunway = shock.runway;
  const levers: Lever[] = [];

  // Lever 1: Pause running loan
  if (snapshot.P > 0) {
    const rw = calculateRunway(shock.bufferLeft, Math.max(0, shock.gap - snapshot.P));
    levers.push({
      name: "Pause / Restructure Loan",
      deltaSpend: -snapshot.P,
      deltaIncome: 0,
      newRunway: rw,
      deltaMonths: Math.round((rw - baseRunway) * 10) / 10,
      description: `Pause loan obligations of $${snapshot.P.toFixed(0)}/mo`,
    });
  }

  // Lever 2: 20% Card Cut
  const cardMed = snapshot.spend_medians.card_withdrawals;
  if (cardMed > 0) {
    const cut = 0.20 * cardMed;
    const rw = calculateRunway(shock.bufferLeft, Math.max(0, shock.gap - cut));
    levers.push({
      name: "Cut Card Spending by 20%",
      deltaSpend: -cut,
      deltaIncome: 0,
      newRunway: rw,
      deltaMonths: Math.round((rw - baseRunway) * 10) / 10,
      description: `Reduce non-essential card spend by $${cut.toFixed(0)}/mo`,
    });
  }

  // Lever 3: 10% Cash Cut
  const cashMed = snapshot.spend_medians.cash_withdrawals_genuine;
  if (cashMed > 0) {
    const cut = 0.10 * cashMed;
    const rw = calculateRunway(shock.bufferLeft, Math.max(0, shock.gap - cut));
    levers.push({
      name: "Trim Cash Withdrawals by 10%",
      deltaSpend: -cut,
      deltaIncome: 0,
      newRunway: rw,
      deltaMonths: Math.round((rw - baseRunway) * 10) / 10,
      description: `Reduce cash withdrawals by $${cut.toFixed(0)}/mo (76% of all spend)`,
    });
  }

  // Lever 4: Side Gig / Part-time Income (20% of baseline I)
  const gigInc = 0.20 * snapshot.I;
  if (gigInc > 0) {
    const rw = calculateRunway(shock.bufferLeft, Math.max(0, shock.gap - gigInc));
    levers.push({
      name: "Part-Time / Gig Income (+20%)",
      deltaSpend: 0,
      deltaIncome: gigInc,
      newRunway: rw,
      deltaMonths: Math.round((rw - baseRunway) * 10) / 10,
      description: `Bring in $${gigInc.toFixed(0)}/mo through freelance or part-time work`,
    });
  }

  // Lever 5: Full Backup Plan
  const bp = calculateBackupPlan(shock.bufferLeft, shock.gap, params.durationMonths, snapshot.spend_medians);
  levers.push({
    name: "Execute Full Backup Plan",
    deltaSpend: -bp.totalCutFound,
    deltaIncome: 0,
    newRunway: bp.runwayAfterCuts,
    deltaMonths: Math.round((bp.runwayAfterCuts - baseRunway) * 10) / 10,
    description: `Execute combined category cuts ($${bp.totalCutFound.toFixed(0)}/mo total)`,
  });

  levers.sort((a, b) => b.deltaMonths - a.deltaMonths);
  return levers;
}

