import type {
  Transaction,
  Account,
  Category,
  Goal,
  RecurringBill,
  DashboardData,
  CategorySpending,
  GoalProgress,
  UpcomingBill,
  PlanData,
  PlanAllocation,
  SplitwiseBalance,
} from '@fynance/shared/types';

export function parseNum(val: string | number | undefined): number {
  if (typeof val === 'number') return val;
  const n = parseFloat(val || '');
  return isNaN(n) ? 0 : n;
}

function parseBool(val: string | boolean): boolean {
  if (typeof val === 'boolean') return val;
  return val === 'true' || val === 'TRUE';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Dates in the sheet are YYYY-MM-DD strings. Never parse them with new Date()
// for month grouping — UTC parsing shifts them a day in negative-offset zones.
export function monthKeyOf(dateStr: string): string {
  return (dateStr || '').slice(0, 7);
}

export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export interface RawSheetData {
  transactions: Record<string, string>[];
  accounts: Record<string, string>[];
  categories: Record<string, string>[];
  goals: Record<string, string>[];
  recurring: Record<string, string>[];
  settings: Record<string, string>[];
  monthly_plans?: Record<string, string>[];
}

export interface ParsedSheetData {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  goals: Goal[];
  recurring: RecurringBill[];
  settings: Record<string, string>;
  plans: Record<string, string>[];
}

export function parseSheetData(data: RawSheetData): ParsedSheetData {
  const transactions: Transaction[] = data.transactions.map((r) => ({
    id: r.id,
    date: r.date,
    description: r.description,
    amount: parseNum(r.amount),
    category: r.category,
    source: r.source as Transaction['source'],
    account: r.account,
    plaid_transaction_id: r.plaid_transaction_id,
  }));

  const accounts: Account[] = data.accounts.map((r) => ({
    id: r.id,
    name: r.name,
    institution: r.institution,
    type: r.type as Account['type'],
    balance: parseNum(r.balance),
    currency: r.currency,
    plaid_account_id: r.plaid_account_id,
    updated_at: r.updated_at,
  }));

  const categories: Category[] = data.categories.map((r) => ({
    name: r.name,
    type: r.type as Category['type'],
    monthly_budget: parseNum(r.monthly_budget),
    color: r.color,
    icon: r.icon,
  }));

  const goals: Goal[] = data.goals.map((r) => ({
    id: r.id,
    name: r.name,
    target_amount: parseNum(r.target_amount),
    current_amount: parseNum(r.current_amount),
    deadline: r.deadline,
    priority: parseNum(r.priority),
    linked_account: r.linked_account,
  }));

  const recurring: RecurringBill[] = data.recurring.map((r) => ({
    id: r.id,
    name: r.name,
    amount: parseNum(r.amount),
    due_day: parseNum(r.due_day),
    category: r.category,
    account: r.account,
    active: parseBool(r.active),
  }));

  const settings: Record<string, string> = {};
  data.settings.forEach((r) => {
    if (r.key) settings[r.key] = r.value;
  });

  return { transactions, accounts, categories, goals, recurring, settings, plans: data.monthly_plans || [] };
}

function txnsInMonth(transactions: Transaction[], monthKey: string): Transaction[] {
  return transactions.filter((t) => monthKeyOf(t.date) === monthKey);
}

function expensesOf(txns: Transaction[]): number {
  return Math.abs(txns.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
}

function incomeOf(txns: Transaction[]): number {
  return txns.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
}

// A recurring bill counts as "paid" this month when an expense's description
// mentions the bill name (Plaid descriptions rarely match exactly).
function billPaidIn(txns: Transaction[], bill: RecurringBill): boolean {
  const name = bill.name.toLowerCase();
  return txns.some((t) => t.amount < 0 && t.description.toLowerCase().includes(name));
}

function billSpendOf(txns: Transaction[], bills: RecurringBill[]): number {
  return Math.abs(
    txns
      .filter((t) => t.amount < 0 && bills.some((b) => t.description.toLowerCase().includes(b.name.toLowerCase())))
      .reduce((sum, t) => sum + t.amount, 0)
  );
}

export function computePlan(parsed: ParsedSheetData, monthKey: string, now: Date = new Date()): PlanData {
  const { transactions, recurring, settings, plans } = parsed;
  const activeBills = recurring.filter((r) => r.active);
  const monthTxns = txnsInMonth(transactions, monthKey);

  const expectedIncome = parseNum(settings.monthly_income);
  const actualIncome = round2(incomeOf(monthTxns));
  const fixedBills = round2(activeBills.reduce((sum, b) => sum + b.amount, 0));

  const bills = activeBills
    .map((b) => ({
      name: b.name,
      amount: b.amount,
      dueDay: b.due_day,
      paid: billPaidIn(monthTxns, b),
    }))
    .sort((a, b) => a.dueDay - b.dueDay);

  // Variable spending = expenses that aren't payments of the recurring bills.
  const variableOf = (key: string) => {
    const txns = txnsInMonth(transactions, key);
    return Math.max(0, expensesOf(txns) - billSpendOf(txns, activeBills));
  };

  const prev3 = [1, 2, 3].map((d) => variableOf(shiftMonthKey(monthKey, -d)));
  const monthsWithData = prev3.filter((v) => v > 0);
  const variableAvg3Mo = round2(
    monthsWithData.length > 0 ? monthsWithData.reduce((a, b) => a + b, 0) / monthsWithData.length : 0
  );

  const variableSoFar = round2(variableOf(monthKey));

  const isCurrentMonth = monthKey === currentMonthKey(now);
  const totalDays = daysInMonth(monthKey);
  let variableProjected: number;
  if (!isCurrentMonth) {
    variableProjected = variableSoFar;
  } else {
    const dayOfMonth = Math.max(1, now.getDate());
    const projected = (variableSoFar / dayOfMonth) * totalDays;
    // Early in the month a couple of purchases produce wild projections —
    // blend with the 3-month average until enough of the month has elapsed.
    const weight = Math.min(1, dayOfMonth / 10);
    variableProjected = round2(projected * weight + (variableAvg3Mo || projected) * (1 - weight));
  }

  const incomeBasis = expectedIncome > 0 ? expectedIncome : actualIncome;
  const bufferPct = parseNum(settings.emergency_buffer_pct || '10');
  const buffer = round2(incomeBasis * (bufferPct / 100));
  const investable = round2(Math.max(0, incomeBasis - fixedBills - variableProjected - buffer));

  const rooms = {
    tfsa: parseNum(settings.tfsa_room),
    rrsp: parseNum(settings.rrsp_room),
    fhsa: parseNum(settings.fhsa_room),
  };

  const savedPlan = plans.find((p) => p.month === monthKey);
  let allocation: PlanAllocation;
  let locked = false;
  if (savedPlan) {
    locked = parseBool(savedPlan.locked);
    try {
      const parsedAlloc = JSON.parse(savedPlan.allocation || '{}');
      allocation = {
        tfsa: parseNum(parsedAlloc.tfsa),
        rrsp: parseNum(parsedAlloc.rrsp),
        fhsa: parseNum(parsedAlloc.fhsa),
        emergency: parseNum(parsedAlloc.emergency),
        fun: parseNum(parsedAlloc.fun),
      };
    } catch {
      allocation = suggestAllocation(investable, rooms);
    }
  } else {
    allocation = suggestAllocation(investable, rooms);
  }

  return {
    month: monthKey,
    expectedIncome,
    actualIncome,
    fixedBills,
    bills,
    variableAvg3Mo,
    variableSoFar,
    variableProjected,
    bufferPct,
    buffer,
    investable,
    allocation,
    locked,
    saved: !!savedPlan,
    rooms,
  };
}

// Waterfall: registered accounts by room first, then the rest to emergency.
export function suggestAllocation(investable: number, rooms: { tfsa: number; rrsp: number; fhsa: number }): PlanAllocation {
  let remaining = investable;
  const take = (room: number) => {
    const amt = Math.max(0, Math.min(remaining, room));
    remaining = round2(remaining - amt);
    return round2(amt);
  };
  const tfsa = take(rooms.tfsa);
  const fhsa = take(rooms.fhsa);
  const rrsp = take(rooms.rrsp);
  return { tfsa, rrsp, fhsa, emergency: round2(remaining), fun: 0 };
}

export function computeDashboard(data: RawSheetData, now: Date = new Date()): DashboardData {
  const parsed = parseSheetData(data);
  const { transactions, accounts, categories, goals, recurring, settings } = parsed;

  const thisMonth = currentMonthKey(now);
  const lastMonth = shiftMonthKey(thisMonth, -1);
  const monthTxns = txnsInMonth(transactions, thisMonth);

  const income = round2(incomeOf(monthTxns));
  const spent = round2(expensesOf(monthTxns));
  const saved = round2(income - spent);
  const savingsRate = income > 0 ? Math.round((saved / income) * 100) : 0;

  const netWorth = round2(accounts.reduce((sum, a) => sum + a.balance, 0));
  const spentLastMonth = round2(expensesOf(txnsInMonth(transactions, lastMonth)));

  // Sync snapshots net worth per month into settings (networth_YYYY-MM);
  // compare against last month's snapshot when it exists.
  const prevNetWorth = parseNum(settings[`networth_${lastMonth}`]);
  const netWorthChange = prevNetWorth !== 0 ? round2(((netWorth - prevNetWorth) / Math.abs(prevNetWorth)) * 100) : 0;

  const categoryMap = new Map(categories.map((c) => [c.name, c]));

  const categorySpendMap = new Map<string, number>();
  monthTxns
    .filter((t) => t.amount < 0)
    .forEach((t) => {
      categorySpendMap.set(t.category, (categorySpendMap.get(t.category) || 0) + Math.abs(t.amount));
    });

  const spendingByCategory: CategorySpending[] = [];
  categorySpendMap.forEach((amount, catName) => {
    const cat = categoryMap.get(catName);
    const budget = cat?.monthly_budget || 0;
    spendingByCategory.push({
      category: catName,
      spent: round2(amount),
      budget,
      percentage: budget > 0 ? Math.round((amount / budget) * 100) : 0,
      color: cat?.color || '#9CA3AF',
      icon: cat?.icon || 'dots-horizontal',
    });
  });
  spendingByCategory.sort((a, b) => b.spent - a.spent);

  const budgetAlerts = spendingByCategory.filter((c) => c.budget > 0 && c.percentage >= 80);

  const plan = computePlan(parsed, thisMonth, now);

  const goalProgress: GoalProgress[] = goals
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((g) => {
      const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;

      let daysRemaining = 0;
      let onTrack = true;
      if (g.deadline && /^\d{4}-\d{2}-\d{2}$/.test(g.deadline)) {
        const deadlineDate = new Date(g.deadline + 'T00:00:00');
        daysRemaining = Math.max(0, Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000));
        // Without a start date, pace against a year-long runway to the deadline.
        const daysSinceStart = Math.max(1, 365 - daysRemaining);
        const expectedPct = daysRemaining > 0 ? Math.min(100, Math.round((daysSinceStart / 365) * 100)) : 100;
        onTrack = pct >= expectedPct;
      }

      return {
        id: g.id,
        name: g.name,
        current: g.current_amount,
        target: g.target_amount,
        percentage: pct,
        daysRemaining,
        onTrack,
      };
    });

  const today = now.getDate();
  const upcomingBills: UpcomingBill[] = recurring
    .filter((r) => r.active)
    .map((r) => {
      let dueMonthKey = thisMonth;
      if (r.due_day < today) dueMonthKey = shiftMonthKey(thisMonth, 1);
      const [y, m] = dueMonthKey.split('-').map(Number);
      const clampedDay = Math.min(r.due_day, daysInMonth(dueMonthKey));
      const dueDate = new Date(y, m - 1, clampedDay);
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const daysUntilDue = Math.round((dueDate.getTime() - startOfToday.getTime()) / 86400000);

      return {
        id: r.id,
        name: r.name,
        amount: r.amount,
        dueDate: `${dueMonthKey}-${String(clampedDay).padStart(2, '0')}`,
        daysUntilDue,
        category: r.category,
      };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    .slice(0, 5);

  const recentTransactions = [...transactions]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 7);

  let splitwise: SplitwiseBalance | null = null;
  if (settings.splitwise_you_owe !== undefined || settings.splitwise_owed_to_you !== undefined) {
    const youOwe = parseNum(settings.splitwise_you_owe);
    const owedToYou = parseNum(settings.splitwise_owed_to_you);
    splitwise = { youOwe, owedToYou, net: round2(owedToYou - youOwe) };
  }

  return {
    netWorth,
    netWorthChange,
    accountCount: accounts.length,
    income,
    spent,
    saved,
    savingsRate,
    investable: plan.investable,
    spentLastMonth,
    spendingByCategory: spendingByCategory.slice(0, 5),
    budgetAlerts,
    goals: goalProgress,
    upcomingBills,
    recentTransactions,
    splitwise,
    lastSynced: settings.last_sync || null,
  };
}
