import type { Category } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Food & Dining', type: 'discretionary', monthly_budget: 450, color: '#F97316', icon: 'silverware-fork-knife' },
  { name: 'Groceries', type: 'essential', monthly_budget: 400, color: '#22C55E', icon: 'cart' },
  { name: 'Transport', type: 'essential', monthly_budget: 200, color: '#3B82F6', icon: 'car' },
  { name: 'Rent', type: 'essential', monthly_budget: 0, color: '#8B5CF6', icon: 'home' },
  { name: 'Utilities', type: 'essential', monthly_budget: 150, color: '#06B6D4', icon: 'lightning-bolt' },
  { name: 'Entertainment', type: 'discretionary', monthly_budget: 200, color: '#EC4899', icon: 'movie-open' },
  { name: 'Subscriptions', type: 'discretionary', monthly_budget: 100, color: '#A855F7', icon: 'refresh' },
  { name: 'Shopping', type: 'discretionary', monthly_budget: 300, color: '#F59E0B', icon: 'shopping' },
  { name: 'Health', type: 'essential', monthly_budget: 100, color: '#EF4444', icon: 'heart-pulse' },
  { name: 'Income', type: 'income', monthly_budget: 0, color: '#10B981', icon: 'cash-plus' },
  { name: 'Transfer', type: 'savings', monthly_budget: 0, color: '#6B7280', icon: 'bank-transfer' },
  { name: 'Splitwise', type: 'discretionary', monthly_budget: 0, color: '#14B8A6', icon: 'account-group' },
  { name: 'Other', type: 'discretionary', monthly_budget: 0, color: '#9CA3AF', icon: 'dots-horizontal' },
];

export const ACCOUNT_TYPES = ['chequing', 'savings', 'credit', 'investment', 'loan'] as const;

export const SHEET_TABS = {
  TRANSACTIONS: 'transactions',
  ACCOUNTS: 'accounts',
  CATEGORIES: 'categories',
  GOALS: 'goals',
  RECURRING: 'recurring',
  SETTINGS: 'settings',
  MONTHLY_PLANS: 'monthly_plans',
} as const;

export const CANADA_TAX_LIMITS_2026 = {
  TFSA_ANNUAL: 7000,
  FHSA_ANNUAL: 8000,
  FHSA_LIFETIME: 40000,
};
