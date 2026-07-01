/**
 * Demo mode — the entire app running against realistic in-memory data.
 * No API, no Google Sheet, no network. Enable from the login screen.
 * Mutations (add/edit/delete) work and persist for the session.
 */
import * as SecureStore from 'expo-secure-store';
import { DEFAULT_CATEGORIES } from '@fynance/shared/constants';
import type {
  DashboardData,
  Transaction,
  Account,
  Goal,
  RecurringBill,
  Category,
  PlanData,
  PlanAllocation,
  AppSettings,
  SyncResult,
  NewTransaction,
  TransactionFilters,
} from '@fynance/shared/types';

const DEMO_KEY = 'demo_mode';
let demoCache: boolean | null = null;

export async function isDemoMode(): Promise<boolean> {
  if (demoCache !== null) return demoCache;
  demoCache = (await SecureStore.getItemAsync(DEMO_KEY)) === '1';
  return demoCache;
}

export async function setDemoMode(enabled: boolean): Promise<void> {
  demoCache = enabled;
  if (enabled) {
    await SecureStore.setItemAsync(DEMO_KEY, '1');
  } else {
    await SecureStore.deleteItemAsync(DEMO_KEY);
  }
}

// ---------------------------------------------------------------------------
// Fixture generation (seeded so every session looks the same)
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

const MERCHANTS: { name: string; category: string; min: number; max: number; weight: number }[] = [
  { name: 'Tim Hortons', category: 'Food & Dining', min: 4, max: 14, weight: 5 },
  { name: "McDonald's", category: 'Food & Dining', min: 10, max: 17, weight: 3 },
  { name: 'Aroma Espresso Bar', category: 'Food & Dining', min: 6, max: 13, weight: 2 },
  { name: 'Sukoshi Ramen', category: 'Food & Dining', min: 20, max: 38, weight: 2 },
  { name: 'Loblaws', category: 'Groceries', min: 45, max: 125, weight: 3 },
  { name: 'No Frills', category: 'Groceries', min: 28, max: 85, weight: 3 },
  { name: 'Costco Wholesale', category: 'Groceries', min: 95, max: 190, weight: 1 },
  { name: 'Presto Fare', category: 'Transport', min: 3.35, max: 3.35, weight: 5 },
  { name: 'Uber Trip', category: 'Transport', min: 12, max: 32, weight: 2 },
  { name: 'Petro-Canada', category: 'Transport', min: 44, max: 72, weight: 1 },
  { name: 'Cineplex', category: 'Entertainment', min: 16, max: 32, weight: 1 },
  { name: 'Steam Purchase', category: 'Entertainment', min: 9, max: 42, weight: 1 },
  { name: 'Amazon.ca', category: 'Shopping', min: 14, max: 95, weight: 2 },
  { name: 'Uniqlo', category: 'Shopping', min: 29, max: 88, weight: 1 },
  { name: 'Shoppers Drug Mart', category: 'Health', min: 8, max: 36, weight: 2 },
];

const SPLITWISE_ITEMS = ['Dinner with Sam', 'Groceries split', 'Cottage weekend', 'Concert tickets', 'Utilities split'];

interface DemoDb {
  transactions: Transaction[];
  accounts: Account[];
  goals: Goal[];
  recurring: RecurringBill[];
  categories: Category[];
  settings: AppSettings;
  plans: Map<string, { allocation: PlanAllocation; locked: boolean }>;
  lastSync: string;
}

let db: DemoDb | null = null;
let idCounter = 1000;

function nextId(): string {
  return `demo-${idCounter++}`;
}

function buildDb(): DemoDb {
  const rand = mulberry32(42);
  const now = new Date();
  const transactions: Transaction[] = [];

  const recurring: RecurringBill[] = [
    { id: nextId(), name: 'Rent', amount: 1500, due_day: 1, category: 'Rent', account: 'TD Chequing', active: true },
    { id: nextId(), name: 'Netflix', amount: 16.99, due_day: 5, category: 'Subscriptions', account: 'Amex Cobalt', active: true },
    { id: nextId(), name: 'Freedom Mobile', amount: 45, due_day: 15, category: 'Utilities', account: 'TD Chequing', active: true },
    { id: nextId(), name: 'Spotify', amount: 10.99, due_day: 20, category: 'Subscriptions', account: 'Amex Cobalt', active: true },
    { id: nextId(), name: 'GoodLife Fitness', amount: 42, due_day: 28, category: 'Health', account: 'TD Chequing', active: true },
  ];

  // ~110 days of history: paycheques, bills on their due days, and 0–2
  // weighted random merchant purchases per day.
  const totalWeight = MERCHANTS.reduce((s, m) => s + m.weight, 0);
  const pickMerchant = () => {
    let roll = rand() * totalWeight;
    for (const m of MERCHANTS) {
      roll -= m.weight;
      if (roll <= 0) return m;
    }
    return MERCHANTS[0];
  };

  for (let daysAgo = 110; daysAgo >= 0; daysAgo--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
    const date = iso(d);

    // Bi-weekly paycheque on Fridays
    if (d.getDay() === 5 && Math.floor(daysAgo / 7) % 2 === 0) {
      transactions.push({
        id: nextId(),
        date,
        description: 'Payroll Deposit — ACME CORP',
        amount: 2450,
        category: 'Income',
        source: 'plaid',
        account: 'TD Chequing',
        plaid_transaction_id: `demo-pay-${date}`,
      });
    }

    for (const bill of recurring) {
      if (d.getDate() === bill.due_day) {
        transactions.push({
          id: nextId(),
          date,
          description: bill.name,
          amount: -bill.amount,
          category: bill.category,
          source: 'plaid',
          account: bill.account,
          plaid_transaction_id: `demo-bill-${bill.name}-${date}`,
        });
      }
    }

    const purchases = rand() < 0.25 ? 0 : rand() < 0.6 ? 1 : 2;
    for (let i = 0; i < purchases; i++) {
      const m = pickMerchant();
      const amount = Math.round((m.min + rand() * (m.max - m.min)) * 100) / 100;
      transactions.push({
        id: nextId(),
        date,
        description: m.name,
        amount: -amount,
        category: m.category,
        source: 'plaid',
        account: rand() < 0.5 ? 'Amex Cobalt' : 'TD Chequing',
        plaid_transaction_id: `demo-txn-${date}-${i}`,
      });
    }

    // Occasional Splitwise expense
    if (rand() < 0.05) {
      const item = SPLITWISE_ITEMS[Math.floor(rand() * SPLITWISE_ITEMS.length)];
      transactions.push({
        id: nextId(),
        date,
        description: item,
        amount: -Math.round((15 + rand() * 60) * 100) / 100,
        category: 'Splitwise',
        source: 'splitwise',
        account: 'Splitwise',
        plaid_transaction_id: `sw_demo-${date}`,
      });
    }
  }

  transactions.sort((a, b) => (a.date < b.date ? 1 : -1));

  const nowIso = new Date().toISOString();
  const accounts: Account[] = [
    { id: nextId(), name: 'TD Chequing', institution: 'TD Bank', type: 'chequing', balance: 4230.55, currency: 'CAD', plaid_account_id: 'demo-1', updated_at: nowIso },
    { id: nextId(), name: 'TD Savings', institution: 'TD Bank', type: 'savings', balance: 12800, currency: 'CAD', plaid_account_id: 'demo-2', updated_at: nowIso },
    { id: nextId(), name: 'Amex Cobalt', institution: 'American Express', type: 'credit', balance: -642.18, currency: 'CAD', plaid_account_id: 'demo-3', updated_at: nowIso },
    { id: nextId(), name: 'Wealthsimple TFSA', institution: 'Wealthsimple', type: 'investment', balance: 18450.32, currency: 'CAD', plaid_account_id: 'demo-4', updated_at: nowIso },
  ];

  const in8Months = new Date(now.getFullYear(), now.getMonth() + 8, 15);
  const in11Months = new Date(now.getFullYear(), now.getMonth() + 11, 1);
  const in5Months = new Date(now.getFullYear(), now.getMonth() + 5, 1);
  const goals: Goal[] = [
    { id: nextId(), name: 'Emergency Fund', target_amount: 10000, current_amount: 6500, deadline: iso(in8Months), priority: 1, linked_account: 'TD Savings' },
    { id: nextId(), name: 'Japan Trip', target_amount: 4000, current_amount: 1250, deadline: iso(in11Months), priority: 2, linked_account: '' },
    { id: nextId(), name: 'New Laptop', target_amount: 2500, current_amount: 900, deadline: iso(in5Months), priority: 3, linked_account: '' },
  ];

  return {
    transactions,
    accounts,
    goals,
    recurring,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    settings: {
      monthly_income: 4900,
      emergency_buffer_pct: 10,
      tfsa_room: 4200,
      rrsp_room: 11000,
      fhsa_room: 8000,
      currency: 'CAD',
    },
    plans: new Map(),
    lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  };
}

function getDb(): DemoDb {
  if (!db) db = buildDb();
  return db;
}

export function resetDemoDb(): void {
  db = null;
}

function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Demo API — mirrors lib/api.ts signatures
// ---------------------------------------------------------------------------

export const demoApi = {
  async fetchDashboard(): Promise<DashboardData> {
    const d = getDb();
    const now = new Date();
    const thisMonth = currentMonthKey();
    const lastMonth = shiftMonthKey(thisMonth, -1);

    const monthTxns = d.transactions.filter((t) => monthKeyOf(t.date) === thisMonth);
    const income = round2(monthTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0));
    const spent = round2(Math.abs(monthTxns.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)));
    const saved = round2(income - spent);
    const netWorth = round2(d.accounts.reduce((s, a) => s + a.balance, 0));
    const spentLastMonth = round2(
      Math.abs(
        d.transactions
          .filter((t) => monthKeyOf(t.date) === lastMonth && t.amount < 0)
          .reduce((s, t) => s + t.amount, 0)
      )
    );

    const catMap = new Map(d.categories.map((c) => [c.name, c]));
    const spendMap = new Map<string, number>();
    monthTxns
      .filter((t) => t.amount < 0)
      .forEach((t) => spendMap.set(t.category, (spendMap.get(t.category) || 0) + Math.abs(t.amount)));

    const spendingByCategory = [...spendMap.entries()]
      .map(([category, amt]) => {
        const cat = catMap.get(category);
        const budget = cat?.monthly_budget || 0;
        return {
          category,
          spent: round2(amt),
          budget,
          percentage: budget > 0 ? Math.round((amt / budget) * 100) : 0,
          color: cat?.color || '#9CA3AF',
          icon: cat?.icon || 'dots-horizontal',
        };
      })
      .sort((a, b) => b.spent - a.spent);

    const plan = await this.fetchPlan(thisMonth);

    const today = now.getDate();
    const upcomingBills = d.recurring
      .filter((r) => r.active)
      .map((r) => {
        const dueMonthKey = r.due_day < today ? shiftMonthKey(thisMonth, 1) : thisMonth;
        const [y, m] = dueMonthKey.split('-').map(Number);
        const dueDate = new Date(y, m - 1, r.due_day);
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return {
          id: r.id,
          name: r.name,
          amount: r.amount,
          dueDate: iso(dueDate),
          daysUntilDue: Math.round((dueDate.getTime() - startOfToday.getTime()) / 86400000),
          category: r.category,
        };
      })
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
      .slice(0, 5);

    const goals = d.goals.map((g) => {
      const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
      const deadline = new Date(g.deadline + 'T00:00:00');
      const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 86400000));
      const expectedPct = Math.min(100, Math.round(((365 - daysRemaining) / 365) * 100));
      return { id: g.id, name: g.name, current: g.current_amount, target: g.target_amount, percentage: pct, daysRemaining, onTrack: pct >= expectedPct };
    });

    return delay({
      netWorth,
      netWorthChange: 3.2,
      accountCount: d.accounts.length,
      income,
      spent,
      saved,
      savingsRate: income > 0 ? Math.round((saved / income) * 100) : 0,
      investable: plan.investable,
      spentLastMonth,
      spendingByCategory: spendingByCategory.slice(0, 5),
      budgetAlerts: spendingByCategory.filter((c) => c.budget > 0 && c.percentage >= 80),
      goals,
      upcomingBills,
      recentTransactions: d.transactions.slice(0, 7),
      splitwise: { youOwe: 84.5, owedToYou: 132.25, net: 47.75 },
      lastSynced: d.lastSync,
    });
  },

  async fetchTransactions(params: TransactionFilters) {
    const d = getDb();
    let txns = [...d.transactions];

    if (params.month && params.year) {
      const key = `${params.year}-${String(params.month).padStart(2, '0')}`;
      txns = txns.filter((t) => monthKeyOf(t.date) === key);
    }
    if (params.category) txns = txns.filter((t) => t.category === params.category);
    if (params.search) {
      const s = params.search.toLowerCase();
      txns = txns.filter((t) => t.description.toLowerCase().includes(s));
    }

    const page = params.page || 1;
    const limit = params.limit || 50;
    const start = (page - 1) * limit;

    const sumIncome = round2(txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0));
    const sumExpenses = round2(Math.abs(txns.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)));

    return delay({
      transactions: txns.slice(start, start + limit),
      total: txns.length,
      page,
      totalPages: Math.max(1, Math.ceil(txns.length / limit)),
      sumIncome,
      sumExpenses,
    });
  },

  async addTransaction(data: NewTransaction) {
    const d = getDb();
    const txn: Transaction = {
      id: nextId(),
      date: data.date,
      description: data.description,
      amount: data.amount,
      category: data.category,
      source: 'manual',
      account: data.account,
      plaid_transaction_id: '',
    };
    d.transactions.push(txn);
    d.transactions.sort((a, b) => (a.date < b.date ? 1 : -1));
    return delay({ id: txn.id });
  },

  async updateTransaction(data: { id: string; category?: string; description?: string }) {
    const d = getDb();
    const txn = d.transactions.find((t) => t.id === data.id);
    if (txn) {
      if (data.category !== undefined) txn.category = data.category;
      if (data.description !== undefined) txn.description = data.description;
    }
    return delay({ message: 'updated' });
  },

  async deleteTransaction(id: string) {
    const d = getDb();
    d.transactions = d.transactions.filter((t) => t.id !== id);
    return delay({ message: 'deleted' });
  },

  async triggerSync(): Promise<SyncResult> {
    const d = getDb();
    d.lastSync = new Date().toISOString();
    return delay({ newTransactions: 0, accountsUpdated: d.accounts.length, lastSync: d.lastSync }, 900);
  },

  async fetchAccounts() {
    const d = getDb();
    return delay({
      accounts: d.accounts,
      netWorth: round2(d.accounts.reduce((s, a) => s + a.balance, 0)),
    });
  },

  async fetchPlan(month: string): Promise<PlanData> {
    const d = getDb();
    const now = new Date();
    const monthTxns = d.transactions.filter((t) => monthKeyOf(t.date) === month);
    const activeBills = d.recurring.filter((r) => r.active);

    const expectedIncome = d.settings.monthly_income;
    const actualIncome = round2(monthTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0));
    const fixedBills = round2(activeBills.reduce((s, b) => s + b.amount, 0));

    const bills = activeBills
      .map((b) => ({
        name: b.name,
        amount: b.amount,
        dueDay: b.due_day,
        paid: monthTxns.some((t) => t.amount < 0 && t.description.toLowerCase().includes(b.name.toLowerCase())),
      }))
      .sort((a, b) => a.dueDay - b.dueDay);

    const variableOf = (key: string) => {
      const txns = d.transactions.filter((t) => monthKeyOf(t.date) === key && t.amount < 0);
      const total = Math.abs(txns.reduce((s, t) => s + t.amount, 0));
      const billsPaid = Math.abs(
        txns
          .filter((t) => activeBills.some((b) => t.description.toLowerCase().includes(b.name.toLowerCase())))
          .reduce((s, t) => s + t.amount, 0)
      );
      return Math.max(0, total - billsPaid);
    };

    const prev3 = [1, 2, 3].map((i) => variableOf(shiftMonthKey(month, -i))).filter((v) => v > 0);
    const variableAvg3Mo = round2(prev3.length ? prev3.reduce((a, b) => a + b, 0) / prev3.length : 0);
    const variableSoFar = round2(variableOf(month));

    const isCurrent = month === currentMonthKey();
    let variableProjected = variableSoFar;
    if (isCurrent) {
      const [y, m] = month.split('-').map(Number);
      const totalDays = new Date(y, m, 0).getDate();
      const dayOfMonth = Math.max(1, now.getDate());
      const projected = (variableSoFar / dayOfMonth) * totalDays;
      const weight = Math.min(1, dayOfMonth / 10);
      variableProjected = round2(projected * weight + (variableAvg3Mo || projected) * (1 - weight));
    }

    const incomeBasis = expectedIncome > 0 ? expectedIncome : actualIncome;
    const buffer = round2(incomeBasis * (d.settings.emergency_buffer_pct / 100));
    const investable = round2(Math.max(0, incomeBasis - fixedBills - variableProjected - buffer));

    const rooms = { tfsa: d.settings.tfsa_room, rrsp: d.settings.rrsp_room, fhsa: d.settings.fhsa_room };
    const savedPlan = d.plans.get(month);

    let allocation: PlanAllocation;
    if (savedPlan) {
      allocation = savedPlan.allocation;
    } else {
      let remaining = investable;
      const take = (room: number) => {
        const amt = Math.max(0, Math.min(remaining, room));
        remaining = round2(remaining - amt);
        return round2(amt);
      };
      const tfsa = take(rooms.tfsa);
      const fhsa = take(rooms.fhsa);
      const rrsp = take(rooms.rrsp);
      allocation = { tfsa, rrsp, fhsa, emergency: round2(remaining), fun: 0 };
    }

    return delay({
      month,
      expectedIncome,
      actualIncome,
      fixedBills,
      bills,
      variableAvg3Mo,
      variableSoFar,
      variableProjected,
      bufferPct: d.settings.emergency_buffer_pct,
      buffer,
      investable,
      allocation,
      locked: savedPlan?.locked || false,
      saved: !!savedPlan,
      rooms,
    });
  },

  async savePlan(month: string, data: { allocation: PlanAllocation; locked?: boolean }) {
    const d = getDb();
    d.plans.set(month, { allocation: data.allocation, locked: data.locked || false });
    return delay({ message: 'Plan saved', month });
  },

  async fetchGoals() {
    const d = getDb();
    return delay({ goals: [...d.goals].sort((a, b) => a.priority - b.priority) });
  },

  async createGoal(data: { name: string; target_amount: number; current_amount: number; deadline: string }) {
    const d = getDb();
    const goal: Goal = {
      id: nextId(),
      name: data.name,
      target_amount: data.target_amount,
      current_amount: data.current_amount || 0,
      deadline: data.deadline,
      priority: d.goals.length + 1,
      linked_account: '',
    };
    d.goals.push(goal);
    return delay({ id: goal.id });
  },

  async updateGoal(data: { id: string } & Partial<Goal>) {
    const d = getDb();
    const goal = d.goals.find((g) => g.id === data.id);
    if (goal) Object.assign(goal, { ...data, id: goal.id });
    return delay({ message: 'updated' });
  },

  async deleteGoal(id: string) {
    const d = getDb();
    d.goals = d.goals.filter((g) => g.id !== id);
    return delay({ message: 'deleted' });
  },

  async fetchRecurring() {
    const d = getDb();
    const bills = [...d.recurring].sort((a, b) => a.due_day - b.due_day);
    return delay({
      bills,
      monthlyTotal: round2(bills.filter((b) => b.active).reduce((s, b) => s + b.amount, 0)),
    });
  },

  async createRecurring(data: { name: string; amount: number; due_day: number; category: string }) {
    const d = getDb();
    const bill: RecurringBill = {
      id: nextId(),
      name: data.name,
      amount: data.amount,
      due_day: data.due_day,
      category: data.category || 'Subscriptions',
      account: '',
      active: true,
    };
    d.recurring.push(bill);
    return delay({ id: bill.id });
  },

  async updateRecurring(data: { id: string } & Partial<RecurringBill>) {
    const d = getDb();
    const bill = d.recurring.find((b) => b.id === data.id);
    if (bill) Object.assign(bill, { ...data, id: bill.id });
    return delay({ message: 'updated' });
  },

  async deleteRecurring(id: string) {
    const d = getDb();
    d.recurring = d.recurring.filter((b) => b.id !== id);
    return delay({ message: 'deleted' });
  },

  async fetchCategories() {
    const d = getDb();
    return delay({ categories: d.categories });
  },

  async updateCategoryBudget(name: string, monthly_budget: number) {
    const d = getDb();
    const cat = d.categories.find((c) => c.name === name);
    if (cat) cat.monthly_budget = monthly_budget;
    return delay({ message: 'updated' });
  },

  async fetchSettings(): Promise<AppSettings> {
    const d = getDb();
    return delay({ ...d.settings });
  },

  async updateSettings(updates: Partial<AppSettings>) {
    const d = getDb();
    Object.assign(d.settings, updates);
    return delay({ message: 'updated' });
  },
};
