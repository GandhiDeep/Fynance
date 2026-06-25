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

export interface DashboardData {
  netWorth: number;
  netWorthChange: number;
  accountCount: number;
  income: number;
  spent: number;
  saved: number;
  savingsRate: number;
  investable: number;
  spendingByCategory: CategorySpending[];
  budgetAlerts: CategorySpending[];
  goals: GoalProgress[];
  upcomingBills: UpcomingBill[];
  recentTransactions: Transaction[];
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
