import { create } from 'zustand';
import type { DashboardData, NewTransaction } from '@fynance/shared/types';
import * as api from './api';

interface FinanceStore {
  dashboard: DashboardData | null;
  isLoading: boolean;
  isSyncing: boolean;
  lastSynced: string | null;
  error: string | null;
  needsRefresh: boolean;

  loadDashboard: () => Promise<void>;
  syncNow: () => Promise<void>;
  addManualTransaction: (txn: NewTransaction) => Promise<void>;
  updateCategory: (id: string, category: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  setNeedsRefresh: (val: boolean) => void;
  clearError: () => void;
}

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  dashboard: null,
  isLoading: false,
  isSyncing: false,
  lastSynced: null,
  error: null,
  needsRefresh: false,

  loadDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.fetchDashboard();
      set({ dashboard: data, lastSynced: data.lastSynced, isLoading: false, needsRefresh: false });
    } catch (e: any) {
      set({ error: e.message || 'Failed to load dashboard', isLoading: false });
    }
  },

  syncNow: async () => {
    set({ isSyncing: true, error: null });
    try {
      const result = await api.triggerSync();
      set({ lastSynced: result.lastSync, isSyncing: false, needsRefresh: true });
      await get().loadDashboard();
    } catch (e: any) {
      set({ error: e.message || 'Sync failed', isSyncing: false });
    }
  },

  addManualTransaction: async (txn: NewTransaction) => {
    try {
      await api.addTransaction(txn);
      set({ needsRefresh: true });
    } catch (e: any) {
      set({ error: e.message || 'Failed to add transaction' });
      throw e;
    }
  },

  updateCategory: async (id: string, category: string) => {
    try {
      await api.updateTransaction({ id, category });
      set({ needsRefresh: true });
    } catch (e: any) {
      set({ error: e.message || 'Failed to update transaction' });
    }
  },

  deleteTransaction: async (id: string) => {
    try {
      await api.deleteTransaction(id);
      set({ needsRefresh: true });
    } catch (e: any) {
      set({ error: e.message || 'Failed to delete transaction' });
    }
  },

  setNeedsRefresh: (val: boolean) => set({ needsRefresh: val }),
  clearError: () => set({ error: null }),
}));
