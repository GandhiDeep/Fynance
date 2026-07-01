import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchTransactions } from '@/lib/api';
import { useFinanceStore } from '@/lib/store';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { getShortMonthName, getCurrentMonthYear, formatCurrency, formatDateFull } from '@/lib/utils';
import { TransactionItem } from '@/components/cards/TransactionItem';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { DEFAULT_CATEGORIES } from '@fynance/shared/constants';
import type { Transaction } from '@/lib/types';

const CURRENT = getCurrentMonthYear();
const MONTHS = Array.from({ length: CURRENT.month }, (_, i) => ({
  value: i + 1,
  label: getShortMonthName(i),
})).reverse();

interface Totals {
  sumIncome: number;
  sumExpenses: number;
  total: number;
}

function groupByDate(txns: Transaction[]): { title: string; data: Transaction[] }[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txns) {
    const list = groups.get(t.date) || [];
    list.push(t);
    groups.set(t.date, list);
  }
  return [...groups.entries()].map(([date, data]) => ({ title: date, data }));
}

export default function TransactionsScreen() {
  const { needsRefresh, setNeedsRefresh, updateCategory, deleteTransaction } = useFinanceStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totals, setTotals] = useState<Totals>({ sumIncome: 0, sumExpenses: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT.month);
  const [selectedYear] = useState(CURRENT.year);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const insets = useSafeAreaInsets();

  // Pagination state lives in refs so onEndReached always sees fresh values.
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (pageToLoad: number, reset: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const data = await fetchTransactions({
          month: selectedMonth,
          year: selectedYear,
          category: selectedCategory || undefined,
          search: debouncedSearch || undefined,
          page: pageToLoad,
          limit: 50,
        });
        setTransactions((prev) => (reset ? data.transactions : [...prev, ...data.transactions]));
        setTotals({ sumIncome: data.sumIncome ?? 0, sumExpenses: data.sumExpenses ?? 0, total: data.total });
        pageRef.current = pageToLoad;
        hasMoreRef.current = pageToLoad < data.totalPages;
      } catch (e) {
        console.error(e);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [selectedMonth, selectedYear, selectedCategory, debouncedSearch]
  );

  useEffect(() => {
    load(1, true);
  }, [selectedMonth, selectedCategory, debouncedSearch]);

  useEffect(() => {
    if (needsRefresh) {
      load(1, true);
      setNeedsRefresh(false);
    }
  }, [needsRefresh]);

  const handleEndReached = () => {
    if (hasMoreRef.current && !loadingRef.current) {
      load(pageRef.current + 1, false);
    }
  };

  const handleRecategorize = async (category: string) => {
    if (!selectedTxn) return;
    await updateCategory(selectedTxn.id, category);
    setSelectedTxn(null);
    load(1, true);
  };

  const handleDelete = async () => {
    if (!selectedTxn) return;
    await deleteTransaction(selectedTxn.id);
    setSelectedTxn(null);
    load(1, true);
  };

  const sections = groupByDate(transactions);

  return (
    <View style={styles.container}>
      <View style={[styles.headerSection, { paddingTop: insets.top + spacing.lg }]}>
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

        {/* Month summary */}
        {totals.total > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryCount}>{totals.total} transactions</Text>
            <View style={styles.summaryAmounts}>
              <Text style={[styles.summaryValue, { color: colors.green }]}>
                +{formatCurrency(totals.sumIncome)}
              </Text>
              <Text style={[styles.summaryValue, { color: colors.red }]}>
                −{formatCurrency(totals.sumExpenses)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Transaction List, grouped by date */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.txnRow}>
            <TransactionItem transaction={item} onPress={setSelectedTxn} />
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <Text style={styles.dateHeader}>{formatDateFull(section.title)}</Text>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="receipt" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No transactions found</Text>
              <Text style={styles.emptySub}>Try a different month or clear your filters</Text>
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
              {formatDateFull(selectedTxn.date)} — {selectedTxn.category} — {selectedTxn.source}
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryCount: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  summaryAmounts: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryValue: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  dateHeader: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
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
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptySub: {
    fontSize: fontSize.sm,
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
