import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchPlan, savePlan } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import type { PlanData, PlanAllocation } from '@/lib/types';

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
}

const ALLOCATION_FIELDS: { key: keyof PlanAllocation; label: string; icon: string; roomKey?: 'tfsa' | 'rrsp' | 'fhsa' }[] = [
  { key: 'tfsa', label: 'TFSA', icon: 'leaf', roomKey: 'tfsa' },
  { key: 'rrsp', label: 'RRSP', icon: 'chart-line', roomKey: 'rrsp' },
  { key: 'fhsa', label: 'FHSA', icon: 'home-plus', roomKey: 'fhsa' },
  { key: 'emergency', label: 'Emergency Fund', icon: 'shield-check' },
  { key: 'fun', label: 'Fun Money', icon: 'party-popper' },
];

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(currentMonthKey());
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alloc, setAlloc] = useState<Record<keyof PlanAllocation, string>>({
    tfsa: '0',
    rrsp: '0',
    fhsa: '0',
    emergency: '0',
    fun: '0',
  });

  const loadPlan = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const data = await fetchPlan(m);
      setPlan(data);
      setAlloc({
        tfsa: String(data.allocation.tfsa),
        rrsp: String(data.allocation.rrsp),
        fhsa: String(data.allocation.fhsa),
        emergency: String(data.allocation.emergency),
        fun: String(data.allocation.fun),
      });
    } catch (e) {
      console.error(e);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlan(month);
  }, [month]);

  const changeMonth = (delta: number) => {
    Haptics.selectionAsync();
    setMonth((m) => shiftMonth(m, delta));
  };

  const allocTotal = Object.values(alloc).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const allocDiff = plan ? Math.round((allocTotal - plan.investable) * 100) / 100 : 0;

  async function handleSave(lock: boolean) {
    if (!plan) return;
    setSaving(true);
    try {
      await savePlan(month, {
        income: plan.expectedIncome || plan.actualIncome,
        fixed_bills: plan.fixedBills,
        variable_spending: plan.variableProjected,
        buffer: plan.buffer,
        investable: plan.investable,
        allocation: {
          tfsa: parseFloat(alloc.tfsa) || 0,
          rrsp: parseFloat(alloc.rrsp) || 0,
          fhsa: parseFloat(alloc.fhsa) || 0,
          emergency: parseFloat(alloc.emergency) || 0,
          fun: parseFloat(alloc.fun) || 0,
        },
        locked: lock,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadPlan(month);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlock() {
    if (!plan) return;
    setSaving(true);
    try {
      await savePlan(month, {
        allocation: plan.allocation,
        locked: false,
      });
      await loadPlan(month);
    } catch {
      Alert.alert('Error', 'Failed to unlock plan.');
    } finally {
      setSaving(false);
    }
  }

  const locked = plan?.locked || false;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      {/* Header with month navigation */}
      <View style={styles.header}>
        <Text style={styles.title}>Plan</Text>
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.monthArrow} onPress={() => changeMonth(-1)}>
            <MaterialCommunityIcons name="chevron-left" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
          <TouchableOpacity style={styles.monthArrow} onPress={() => changeMonth(1)}>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading || !plan ? (
        <View style={{ gap: spacing.lg }}>
          <SkeletonLoader width="100%" height={90} />
          <SkeletonLoader width="100%" height={160} />
          <SkeletonLoader width="100%" height={120} />
          <SkeletonLoader width="100%" height={200} />
        </View>
      ) : (
        <>
          {locked && (
            <View style={styles.lockedBanner}>
              <MaterialCommunityIcons name="lock" size={16} color={colors.amber} />
              <Text style={styles.lockedText}>This plan is locked</Text>
              <TouchableOpacity onPress={handleUnlock}>
                <Text style={styles.unlockLink}>Unlock</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Income */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Income</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Expected</Text>
              <Text style={styles.rowValue}>{formatCurrency(plan.expectedIncome)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Actual so far</Text>
              <Text style={[styles.rowValue, { color: colors.green }]}>{formatCurrency(plan.actualIncome)}</Text>
            </View>
            {plan.expectedIncome > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Difference</Text>
                <Text style={[styles.rowValue, { color: plan.actualIncome >= plan.expectedIncome ? colors.green : colors.textTertiary }]}>
                  {plan.actualIncome >= plan.expectedIncome ? '+' : ''}
                  {formatCurrency(plan.actualIncome - plan.expectedIncome)}
                </Text>
              </View>
            )}
          </View>

          {/* Fixed Bills */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Fixed Bills</Text>
              <Text style={styles.cardTitleValue}>{formatCurrency(plan.fixedBills)}</Text>
            </View>
            {plan.bills.length === 0 ? (
              <Text style={styles.emptyText}>No recurring bills set up yet.</Text>
            ) : (
              plan.bills.map((bill) => (
                <View key={bill.name} style={styles.row}>
                  <View style={styles.billLeft}>
                    <MaterialCommunityIcons
                      name={bill.paid ? 'check-circle' : 'circle-outline'}
                      size={18}
                      color={bill.paid ? colors.green : colors.textTertiary}
                    />
                    <Text style={styles.rowLabel}>{bill.name}</Text>
                    <Text style={styles.billDue}>day {bill.dueDay}</Text>
                  </View>
                  <Text style={styles.rowValue}>{formatCurrency(bill.amount)}</Text>
                </View>
              ))
            )}
          </View>

          {/* Variable Spending */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Variable Spending</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>3-month average</Text>
              <Text style={styles.rowValue}>{formatCurrency(plan.variableAvg3Mo)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>This month so far</Text>
              <Text style={styles.rowValue}>{formatCurrency(plan.variableSoFar)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Projected end of month</Text>
              <Text style={[styles.rowValue, { color: colors.amber }]}>{formatCurrency(plan.variableProjected)}</Text>
            </View>
          </View>

          {/* Buffer */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Buffer ({plan.bufferPct}%)</Text>
              <Text style={styles.cardTitleValue}>{formatCurrency(plan.buffer)}</Text>
            </View>
            <Text style={styles.emptyText}>Kept aside for surprises before investing.</Text>
          </View>

          {/* Investable hero */}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>What You Can Invest</Text>
            <Text style={styles.heroValue}>{formatCurrency(plan.investable)}</Text>
            <Text style={styles.heroFormula}>
              income − bills − variable − buffer
            </Text>
          </View>

          {/* Allocation */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Allocation</Text>
            {ALLOCATION_FIELDS.map((field) => {
              const room = field.roomKey ? plan.rooms[field.roomKey] : null;
              return (
                <View key={field.key} style={styles.allocRow}>
                  <View style={styles.allocLeft}>
                    <MaterialCommunityIcons name={field.icon as any} size={18} color={colors.blue} />
                    <View>
                      <Text style={styles.rowLabel}>{field.label}</Text>
                      {room !== null && (
                        <Text style={styles.roomText}>
                          {room > 0 ? `${formatCurrency(room)} room left` : 'no room set'}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.allocInputWrap}>
                    <Text style={styles.allocDollar}>$</Text>
                    <TextInput
                      style={[styles.allocInput, locked && { color: colors.textTertiary }]}
                      value={alloc[field.key]}
                      onChangeText={(v) => setAlloc((a) => ({ ...a, [field.key]: v }))}
                      keyboardType="decimal-pad"
                      editable={!locked}
                      selectTextOnFocus
                    />
                  </View>
                </View>
              );
            })}

            <View style={[styles.allocTotalRow, { borderTopColor: colors.border }]}>
              <Text style={styles.allocTotalLabel}>Total allocated</Text>
              <Text
                style={[
                  styles.allocTotalValue,
                  { color: Math.abs(allocDiff) < 1 ? colors.green : colors.amber },
                ]}
              >
                {formatCurrency(allocTotal)}
              </Text>
            </View>
            {Math.abs(allocDiff) >= 1 && (
              <Text style={styles.allocWarning}>
                {allocDiff > 0
                  ? `${formatCurrency(allocDiff)} over your investable amount`
                  : `${formatCurrency(Math.abs(allocDiff))} left unallocated`}
              </Text>
            )}
          </View>

          {!locked && (
            <View style={styles.actions}>
              <Button title="Save Plan" onPress={() => handleSave(false)} loading={saving} style={{ flex: 1 }} />
              <Button
                title="Lock Plan"
                onPress={() =>
                  Alert.alert('Lock Plan', 'Locking finalizes this month. You can unlock later.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Lock', onPress: () => handleSave(true) },
                  ])
                }
                variant="secondary"
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  monthArrow: {
    padding: spacing.sm,
  },
  monthLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.amberDim,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  lockedText: {
    flex: 1,
    color: colors.amber,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  unlockLink: {
    color: colors.amber,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  rowValue: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  billLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  billDue: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  heroCard: {
    backgroundColor: colors.blueDim,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heroLabel: {
    fontSize: fontSize.sm,
    color: colors.blue,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroValue: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  heroFormula: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  allocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  allocLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  roomText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },
  allocInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
  },
  allocDollar: {
    color: colors.textTertiary,
    fontSize: fontSize.md,
  },
  allocInput: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    paddingVertical: spacing.sm,
    minWidth: 70,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  allocTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  allocTotalLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  allocTotalValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  allocWarning: {
    fontSize: fontSize.xs,
    color: colors.amber,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
