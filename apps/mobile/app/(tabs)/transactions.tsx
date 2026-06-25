import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fetchTransactions } from '@/lib/api';
import { useFinanceStore } from '@/lib/store';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { getShortMonthName, getCurrentMonthYear } from '@/lib/utils';
import { TransactionItem } from '@/components/cards/TransactionItem';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { DEFAULT_CATEGORIES } from '@fynance/shared/constants';
import type { Transaction } from '@/lib/types';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: getShortMonthName(i),
}));

export default function TransactionsScreen() {
  const { needsRefresh, setNeedsRefresh, updateCategory, deleteTransaction } = useFinanceStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthYear().month);
  const [selectedYear] = useState(getCurrentMonthYear().year);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadTransactions = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    setLoading(true);
    try {
      const data = await fetchTransactions({
        month: selectedMonth,
        year: selectedYear,
        category: selectedCategory || undefined,
        search: search || undefined,
        page: p,
        limit: 50,
      });
      setTransactions(reset ? data.transactions : [...transactions, ...data.transactions]);
      setHasMore(p < data.totalPages);
      if (reset) setPage(1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, selectedCategory, search, page]);

  useEffect(() => {
    loadTransactions(true);
  }, [selectedMonth, selectedCategory, search]);

  useEffect(() => {
    if (needsRefresh) {
      loadTransactions(true);
      setNeedsRefresh(false);
    }
  }, [needsRefresh]);

  const handleRecategorize = async (category: string) => {
    if (!selectedTxn) return;
    await updateCategory(selectedTxn.id, category);
    setSelectedTxn(null);
    loadTransactions(true);
  };

  const handleDelete = async () => {
    if (!selectedTxn) return;
    await deleteTransaction(selectedTxn.id);
    setSelectedTxn(null);
    loadTransactions(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.title}>Activity</Text>

        {/* Month Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
          {MONTHS.map((m) => (
            <TouchableOpacity
              key={m.value}
              style={[styles.monthPill, selectedMonth === m.value && styles.monthPillActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedMonth(m.value);
              }}
            >
              <Text style={[styles.monthText, selectedMonth === m.value && styles.monthTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          <TouchableOpacity
            style={[styles.catChip, !selectedCategory && styles.catChipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.catText, !selectedCategory && styles.catTextActive]}>All</Text>
          </TouchableOpacity>
          {DEFAULT_CATEGORIES.filter((c) => c.type !== 'income').map((cat) => (
            <TouchableOpacity
              key={cat.name}
              style={[styles.catChip, selectedCategory === cat.name && styles.catChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedCategory(selectedCategory === cat.name ? null : cat.name);
              }}
            >
              <MaterialCommunityIcons name={cat.icon as any} size={14} color={selectedCategory === cat.name ? colors.background : cat.color} />
              <Text style={[styles.catText, selectedCategory === cat.name && styles.catTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search */}
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Transaction List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.txnRow}>
            <TransactionItem transaction={item} onPress={setSelectedTxn} />
          </View>
        )}
        contentContainerStyle={styles.listContent}
        onEndReached={() => {
          if (hasMore && !loading) {
            setPage((p) => p + 1);
            loadTransactions();
          }
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="receipt" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No transactions found</Text>
            </View>
          ) : null
        }
        ListFooterComponent={loading ? <ActivityIndicator color={colors.green} style={{ padding: spacing.lg }} /> : null}
      />

      {/* Transaction Action Sheet */}
      <BottomSheet visible={!!selectedTxn} onClose={() => setSelectedTxn(null)}>
        {selectedTxn && (
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>{selectedTxn.description}</Text>
            <Text style={styles.sheetSubtitle}>
              {selectedTxn.category} — {selectedTxn.source}
            </Text>

            <Text style={styles.sheetLabel}>Re-categorize</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {DEFAULT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.name}
                  style={[styles.sheetCat, selectedTxn.category === cat.name && { borderColor: cat.color }]}
                  onPress={() => handleRecategorize(cat.name)}
                >
                  <MaterialCommunityIcons name={cat.icon as any} size={16} color={cat.color} />
                  <Text style={styles.sheetCatText}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Button title="Delete Transaction" onPress={handleDelete} variant="danger" style={{ marginTop: spacing.xl }} />
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerSection: {
    padding: spacing.lg,
    paddingTop: 60,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  monthScroll: {
    flexGrow: 0,
  },
  monthPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthPillActive: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  monthText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  monthTextActive: {
    color: '#FFFFFF',
  },
  catScroll: {
    flexGrow: 0,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  catText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  catTextActive: {
    color: colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  txnRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl * 2,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
  },
  sheetContent: {
    gap: spacing.md,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  sheetSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  sheetLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
  },
  sheetCat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sheetCatText: {
    fontSize: fontSize.xs,
    color: colors.text,
  },
});
