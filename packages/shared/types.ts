export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  source: 'plaid' | 'splitwise' | 'manual';
  account: string;
  plaid_transaction_id: string;
}

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: 'chequing' | 'savings' | 'credit' | 'investment' | 'loan';
  balance: number;
  currency: string;
  plaid_account_id: string;
  updated_at: string;
}

export interface Category {
  name: string;
  type: 'essential' | 'discretionary' | 'income' | 'savings';
  monthly_budget: number;
  color: string;
  icon: string;
}

export interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  priority: number;
  linked_account: string;
}

export interface RecurringBill {
  id: string;
  name: string;
  amount: number;
  due_day: number;
  category: string;
  account: string;
  active: boolean;
}

export interface MonthlyPlan {
  month: string;
  income: number;
  fixed_bills: number;
  variable_spending: number;
  buffer: number;
  investable: number;
  allocation: string;
  locked: boolean;
}

export interface SettingsEntry {
  key: string;
  value: string;
}

export interface CategorySpending {
  category: string;
  spent: number;
  budget: number;
  percentage: number;
  color: string;
  icon: string;
}

export interface SplitwiseBalance {
  youOwe: number;
  owedToYou: number;
  net: number;
}

export interface DashboardData {
  netWorth: number;
  netWorthChange: number;
  accountCount: number;
  income: number;
  spent: number;
  saved: number;
  savingsRate: number;
  investable: number;
  spentLastMonth: number;
  spendingByCategory: CategorySpending[];
  budgetAlerts: CategorySpending[];
  goals: GoalProgress[];
  upcomingBills: UpcomingBill[];
  recentTransactions: Transaction[];
  splitwise: SplitwiseBalance | null;
  lastSynced: string | null;
}

export interface GoalProgress {
  id: string;
  name: string;
  current: number;
  target: number;
  percentage: number;
  daysRemaining: number;
  onTrack: boolean;
}

export interface UpcomingBill {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  category: string;
}

export interface SyncResult {
  newTransactions: number;
  accountsUpdated: number;
  lastSync: string;
}

export interface NewTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string;
}

export interface TransactionFilters {
  month?: number;
  year?: number;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PlanAllocation {
  tfsa: number;
  rrsp: number;
  fhsa: number;
  emergency: number;
  fun: number;
}

export interface PlanData {
  month: string; // YYYY-MM
  expectedIncome: number;
  actualIncome: number;
  fixedBills: number;
  bills: { name: string; amount: number; dueDay: number; paid: boolean }[];
  variableAvg3Mo: number;
  variableSoFar: number;
  variableProjected: number;
  bufferPct: number;
  buffer: number;
  investable: number;
  allocation: PlanAllocation;
  locked: boolean;
  saved: boolean; // true if a plan row exists in the sheet
  rooms: {
    tfsa: number;
    rrsp: number;
    fhsa: number;
  };
}

export interface AppSettings {
  monthly_income: number;
  emergency_buffer_pct: number;
  tfsa_room: number;
  rrsp_room: number;
  fhsa_room: number;
  currency: string;
}

export interface NewGoal {
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
}

export interface NewRecurringBill {
  name: string;
  amount: number;
  due_day: number;
  category: string;
}
