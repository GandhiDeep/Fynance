import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { isDemoMode, demoApi } from './demo';
import type {
  DashboardData,
  Transaction,
  NewTransaction,
  SyncResult,
  Account,
  Goal,
  RecurringBill,
  Category,
  PlanData,
  PlanAllocation,
  AppSettings,
  TransactionFilters,
} from '@fynance/shared/types';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('api_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface PaginatedTransactions {
  transactions: Transaction[];
  total: number;
  page: number;
  totalPages: number;
  sumIncome: number;
  sumExpenses: number;
}

interface AccountsResponse {
  accounts: Account[];
  netWorth: number;
}

export const fetchDashboard = async (): Promise<DashboardData> => {
  if (await isDemoMode()) return demoApi.fetchDashboard();
  return api.get<DashboardData>('/api/dashboard').then((r) => r.data);
};

export const fetchTransactions = async (params: TransactionFilters): Promise<PaginatedTransactions> => {
  if (await isDemoMode()) return demoApi.fetchTransactions(params);
  return api.get<PaginatedTransactions>('/api/transactions', { params }).then((r) => r.data);
};

export const addTransaction = async (data: NewTransaction): Promise<{ id: string }> => {
  if (await isDemoMode()) return demoApi.addTransaction(data);
  return api.post<{ id: string }>('/api/transactions', data).then((r) => r.data);
};

export const updateTransaction = async (data: { id: string; category?: string; description?: string }) => {
  if (await isDemoMode()) return demoApi.updateTransaction(data);
  return api.patch('/api/transactions', data).then((r) => r.data);
};

export const deleteTransaction = async (id: string) => {
  if (await isDemoMode()) return demoApi.deleteTransaction(id);
  return api.delete(`/api/transactions?id=${id}`).then((r) => r.data);
};

export const triggerSync = async (): Promise<SyncResult> => {
  if (await isDemoMode()) return demoApi.triggerSync();
  return api.post<SyncResult>('/api/sync').then((r) => r.data);
};

export const fetchAccounts = async (): Promise<AccountsResponse> => {
  if (await isDemoMode()) return demoApi.fetchAccounts();
  return api.get<AccountsResponse>('/api/accounts').then((r) => r.data);
};

// --- Plan ---

export const fetchPlan = async (month: string): Promise<PlanData> => {
  if (await isDemoMode()) return demoApi.fetchPlan(month);
  return api.get<PlanData>(`/api/plan/${month}`).then((r) => r.data);
};

export const savePlan = async (
  month: string,
  data: {
    income?: number;
    fixed_bills?: number;
    variable_spending?: number;
    buffer?: number;
    investable?: number;
    allocation: PlanAllocation;
    locked?: boolean;
  }
) => {
  if (await isDemoMode()) return demoApi.savePlan(month, data);
  return api.post(`/api/plan/${month}`, data).then((r) => r.data);
};

// --- Goals ---

export const fetchGoals = async (): Promise<{ goals: Goal[] }> => {
  if (await isDemoMode()) return demoApi.fetchGoals();
  return api.get<{ goals: Goal[] }>('/api/goals').then((r) => r.data);
};

export const createGoal = async (data: { name: string; target_amount: number; current_amount: number; deadline: string }) => {
  if (await isDemoMode()) return demoApi.createGoal(data);
  return api.post('/api/goals', data).then((r) => r.data);
};

export const updateGoal = async (data: { id: string } & Partial<Omit<Goal, 'id'>>) => {
  if (await isDemoMode()) return demoApi.updateGoal(data);
  return api.patch('/api/goals', data).then((r) => r.data);
};

export const deleteGoal = async (id: string) => {
  if (await isDemoMode()) return demoApi.deleteGoal(id);
  return api.delete(`/api/goals?id=${id}`).then((r) => r.data);
};

// --- Recurring bills ---

export const fetchRecurring = async (): Promise<{ bills: RecurringBill[]; monthlyTotal: number }> => {
  if (await isDemoMode()) return demoApi.fetchRecurring();
  return api.get<{ bills: RecurringBill[]; monthlyTotal: number }>('/api/recurring').then((r) => r.data);
};

export const createRecurring = async (data: { name: string; amount: number; due_day: number; category: string }) => {
  if (await isDemoMode()) return demoApi.createRecurring(data);
  return api.post('/api/recurring', data).then((r) => r.data);
};

export const updateRecurring = async (data: { id: string } & Partial<Omit<RecurringBill, 'id'>>) => {
  if (await isDemoMode()) return demoApi.updateRecurring(data);
  return api.patch('/api/recurring', data).then((r) => r.data);
};

export const deleteRecurring = async (id: string) => {
  if (await isDemoMode()) return demoApi.deleteRecurring(id);
  return api.delete(`/api/recurring?id=${id}`).then((r) => r.data);
};

// --- Categories ---

export const fetchCategories = async (): Promise<{ categories: Category[] }> => {
  if (await isDemoMode()) return demoApi.fetchCategories();
  return api.get<{ categories: Category[] }>('/api/categories').then((r) => r.data);
};

export const updateCategoryBudget = async (name: string, monthly_budget: number) => {
  if (await isDemoMode()) return demoApi.updateCategoryBudget(name, monthly_budget);
  return api.patch('/api/categories', { name, monthly_budget }).then((r) => r.data);
};

// --- Settings ---

export const fetchSettings = async (): Promise<AppSettings> => {
  if (await isDemoMode()) return demoApi.fetchSettings();
  return api.get<AppSettings>('/api/settings').then((r) => r.data);
};

export const updateSettings = async (updates: Partial<AppSettings>) => {
  if (await isDemoMode()) return demoApi.updateSettings(updates);
  return api.patch('/api/settings', updates).then((r) => r.data);
};

// --- Plaid ---

/** URL of the browser-based bank connection page; secret rides in the hash. */
export async function getPlaidLinkUrl(): Promise<string> {
  const token = (await SecureStore.getItemAsync('api_token')) || '';
  return `${API_BASE_URL}/link#s=${encodeURIComponent(token)}`;
}
