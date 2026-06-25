import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFinanceStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { MetricCard } from '@/components/cards/MetricCard';
import { TransactionItem } from '@/components/cards/TransactionItem';
import { BillCard } from '@/components/cards/BillCard';
import { SpendingChart } from '@/components/charts/SpendingChart';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

export default function DashboardScreen() {
  const { dashboard, isLoading, isSyncing, loadDashboard, syncNow, needsRefresh } = useFinanceStore();
  const router = useRouter();

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (needsRefresh) loadDashboard();
  }, [needsRefresh]);

  const onRefresh = useCallback(async () => {
    await syncNow();
  }, []);

  if (isLoading && !dashboard) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonContainer}>
          <SkeletonLoader width="60%" height={32} />
          <SkeletonLoader width="100%" height={100} style={{ marginTop: spacing.lg }} />
          <View style={styles.skeletonRow}>
            <SkeletonLoader width="48%" height={90} />
            <SkeletonLoader width="48%" height={90} />
          </View>
          <SkeletonLoader width="100%" height={200} style={{ marginTop: spacing.lg }} />
        </View>
      </View>
    );
  }

  if (!dashboard) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isSyncing}
          onRefresh={onRefresh}
          tintColor={colors.green}
          colors={[colors.green]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={[styles.syncDot, { backgroundColor: dashboard.lastSynced ? colors.green : colors.amber }]} />
      </View>

      {/* Net Worth */}
      <View style={styles.netWorthCard}>
        <Text style={styles.netWorthLabel}>Net Worth</Text>
        <Text style={styles.netWorthValue}>{formatCurrency(dashboard.netWorth)}</Text>
        <Text style={styles.netWorthSub}>across {dashboard.accountCount} accounts</Text>
      </View>

      {/* Key Metrics */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricsRow}>
          <MetricCard label="Income" value={formatCurrency(dashboard.income)} icon="cash-plus" iconColor={colors.green} />
          <MetricCard label="Spent" value={formatCurrency(dashboard.spent)} icon="cash-minus" iconColor={colors.red} />
        </View>
        <View style={styles.metricsRow}>
          <MetricCard
            label="Saved"
            value={formatCurrency(dashboard.saved)}
            icon="piggy-bank"
            iconColor={colors.green}
            subtitle={`${dashboard.savingsRate}% rate`}
          />
          <MetricCard
            label="Investable"
            value={formatCurrency(dashboard.investable)}
            icon="chart-line"
            iconColor={colors.blue}
          />
        </View>
      </View>

      {/* Spending by Category */}
      {dashboard.spendingByCategory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spending by Category</Text>
          <View style={styles.card}>
            <SpendingChart data={dashboard.spendingByCategory} />
          </View>
        </View>
      )}

      {/* Budget Alerts */}
      {dashboard.budgetAlerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget Alerts</Text>
          {dashboard.budgetAlerts.map((alert) => (
            <View
              key={alert.category}
              style={[styles.alertCard, { borderColor: alert.percentage >= 100 ? colors.red : colors.amber }]}
            >
              <Text style={styles.alertText}>
                {alert.category}: {formatCurrency(alert.spent)} / {formatCurrency(alert.budget)}
              </Text>
              <Text style={[styles.alertPct, { color: alert.percentage >= 100 ? colors.red : colors.amber }]}>
                {alert.percentage}%
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Goals */}
      {dashboard.goals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goals</Text>
          {dashboard.goals.map((goal) => (
            <View key={goal.id} style={styles.card}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalName}>{goal.name}</Text>
                <Text style={[styles.goalPct, { color: goal.onTrack ? colors.green : colors.amber }]}>
                  {goal.percentage}%
                </Text>
              </View>
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, goal.percentage)}%`,
                      backgroundColor: goal.onTrack ? colors.green : colors.amber,
                    },
                  ]}
                />
              </View>
              <Text style={styles.goalSub}>
                {formatCurrency(goal.current)} / {formatCurrency(goal.target)} — {goal.daysRemaining} days left
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Upcoming Bills */}
      {dashboard.upcomingBills.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Bills</Text>
          <View style={styles.billsList}>
            {dashboard.upcomingBills.map((bill) => (
              <BillCard key={bill.id} bill={bill} />
            ))}
          </View>
        </View>
      )}

      {/* Recent Transactions */}
      {dashboard.recentTransactions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push('/transactions')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            {dashboard.recentTransactions.map((txn) => (
              <TransactionItem key={txn.id} transaction={txn} />
            ))}
          </View>
        </View>
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
    paddingTop: 60,
  },
  skeletonContainer: {
    padding: spacing.lg,
    paddingTop: 60,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  netWorthCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  netWorthLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  netWorthValue: {
    fontSize: fontSize.hero,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  netWorthSub: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  metricsGrid: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  seeAll: {
    fontSize: fontSize.sm,
    color: colors.green,
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  alertText: {
    fontSize: fontSize.sm,
    color: colors.text,
    flex: 1,
  },
  alertPct: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  goalName: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  goalPct: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  progressBg: {
    height: 6,
    backgroundColor: colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalSub: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  billsList: {
    gap: spacing.sm,
  },
});
