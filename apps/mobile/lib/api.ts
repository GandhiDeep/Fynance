import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import type {
  DashboardData,
  Transaction,
  NewTransaction,
  SyncResult,
  Account,
  TransactionFilters,
} from '@fynance/shared/types';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
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
}

interface AccountsResponse {
  accounts: Account[];
  netWorth: number;
}

export const fetchDashboard = () =>
  api.get<DashboardData>('/api/dashboard').then((r) => r.data);

export const fetchTransactions = (params: TransactionFilters) =>
  api.get<PaginatedTransactions>('/api/transactions', { params }).then((r) => r.data);

export const addTransaction = (data: NewTransaction) =>
  api.post<{ id: string }>('/api/transactions', data).then((r) => r.data);

export const updateTransaction = (data: { id: string; category?: string; description?: string }) =>
  api.patch('/api/transactions', data).then((r) => r.data);

export const deleteTransaction = (id: string) =>
  api.delete(`/api/transactions?id=${id}`).then((r) => r.data);

export const triggerSync = () =>
  api.post<SyncResult>('/api/sync').then((r) => r.data);

export const fetchAccounts = () =>
  api.get<AccountsResponse>('/api/accounts').then((r) => r.data);

export const createPlaidLinkToken = () =>
  api.post<{ link_token: string }>('/api/plaid/create-link-token').then((r) => r.data);

export const exchangePlaidToken = (publicToken: string) =>
  api.post('/api/plaid/exchange-token', { public_token: publicToken }).then((r) => r.data);
