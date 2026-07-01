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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinanceStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { MetricCard } from '@/components/cards/MetricCard';
import { TransactionItem } from '@/components/cards/TransactionItem';
import { BillCard } from '@/components/cards/BillCard';
import { SpendingChart } from '@/components/charts/SpendingChart';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { Button } from '@/components/ui/Button';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function DashboardScreen() {
  const { dashboard, isLoading, isSyncing, loadDashboard, syncNow, needsRefresh, error } = useFinanceStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
      <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.skeletonContainer}>
          <SkeletonLoader width="60%" height={32} />
          <SkeletonLoader width="100%" height={110} style={{ marginTop: spacing.lg }} />
          <View style={styles.skeletonRow}>
            <SkeletonLoader width="48%" height={90} />
            <SkeletonLoader width="48%" height={90} />
          </View>
          <View style={styles.skeletonRow}>
            <SkeletonLoader width="48%" height={90} />
            <SkeletonLoader width="48%" height={90} />
          </View>
          <SkeletonLoader width="100%" height={200} style={{ marginTop: spacing.lg }} />
        </View>
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View style={[styles.container, styles.errorState, { paddingTop: insets.top }]}>
        <MaterialCommunityIcons name="cloud-off-outline" size={56} color={colors.textTertiary} />
        <Text style={styles.errorTitle}>Couldn't load your dashboard</Text>
        <Text style={styles.errorSub}>{error || 'Check your connection and try again.'}</Text>
        <Button title="Retry" onPress={loadDashboard} style={{ minWidth: 160 }} />
      </View>
    );
  }

  const trendUp = dashboard.netWorthChange >= 0;
  const spendDelta = dashboard.spentLastMonth > 0
    ? Math.round(((dashboard.spent - dashboard.spentLastMonth) / dashboard.spentLastMonth) * 100)
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
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
        <View>
          <Text style={styles.headerGreeting}>{greeting()}</Text>
          <Text style={styles.headerDate}>{todayLabel()}</Text>
        </View>
        <View style={[styles.syncDot, { backgroundColor: dashboard.lastSynced ? colors.green : colors.amber }]} />
      </View>

      {/* Net Worth */}
      <View style={styles.netWorthCard}>
        <Text style={styles.netWorthLabel}>Net Worth</Text>
        <Text style={styles.netWorthValue}>{formatCurrency(dashboard.netWorth)}</Text>
        <View style={styles.netWorthFooter}>
          {dashboard.netWorthChange !== 0 && (
            <View style={styles.trendRow}>
              <MaterialCommunityIcons
                name={trendUp ? 'trending-up' : 'trending-down'}
                size={14}
                color={trendUp ? colors.green : colors.red}
              />
              <Text style={[styles.trendText, { color: trendUp ? colors.green : colors.red }]}>
                {trendUp ? '+' : ''}{dashboard.netWorthChange}% from last month
              </Text>
            </View>
          )}
          <Text style={styles.netWorthSub}>across {dashboard.accountCount} accounts</Text>
        </View>
      </View>

      {/* Key Metrics */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricsRow}>
          <MetricCard label="Income" value={formatCurrency(dashboard.income)} icon="cash-plus" iconColor={colors.green} />
          <MetricCard
            label="Spent"
            value={formatCurrency(dashboard.spent)}
            icon="cash-minus"
            iconColor={colors.red}
            subtitle={spendDelta !== null ? `${spendDelta >= 0 ? '+' : ''}${spendDelta}% vs last month` : undefined}
          />
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
            subtitle="tap to plan"
            onPress={() => router.push('/plan')}
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
              <MaterialCommunityIcons
                name={alert.percentage >= 100 ? 'alert-circle' : 'alert'}
                size={18}
                color={alert.percentage >= 100 ? colors.red : colors.amber}
              />
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

      {/* Splitwise */}
      {dashboard.splitwise && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Splitwise</Text>
          <View style={[styles.card, styles.splitwiseCard]}>
            <View style={styles.splitwiseCol}>
              <Text style={styles.splitwiseLabel}>You owe</Text>
              <Text style={[styles.splitwiseValue, { color: colors.red }]}>
                {formatCurrency(dashboard.splitwise.youOwe)}
              </Text>
            </View>
            <View style={styles.splitwiseDivider} />
            <View style={styles.splitwiseCol}>
              <Text style={styles.splitwiseLabel}>Owed to you</Text>
              <Text style={[styles.splitwiseValue, { color: colors.green }]}>
                {formatCurrency(dashboard.splitwise.owedToYou)}
              </Text>
            </View>
            <View style={styles.splitwiseDivider} />
            <View style={styles.splitwiseCol}>
              <Text style={styles.splitwiseLabel}>Net</Text>
              <Text style={[styles.splitwiseValue, { color: dashboard.splitwise.net >= 0 ? colors.green : colors.red }]}>
                {dashboard.splitwise.net >= 0 ? '+' : ''}{formatCurrency(dashboard.splitwise.net)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Goals */}
      {dashboard.goals.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Goals</Text>
            <TouchableOpacity onPress={() => router.push('/goals')}>
              <Text style={styles.seeAll}>Manage</Text>
            </TouchableOpacity>
          </View>
          {dashboard.goals.map((goal) => (
            <View key={goal.id} style={[styles.card, { marginBottom: spacing.sm }]}>
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
                {formatCurrency(goal.current)} / {formatCurrency(goal.target)}
                {goal.daysRemaining > 0 ? ` — ${goal.daysRemaining} days left` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Upcoming Bills */}
      {dashboard.upcomingBills.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Bills</Text>
            <TouchableOpacity onPress={() => router.push('/recurring')}>
              <Text style={styles.seeAll}>Manage</Text>
            </TouchableOpacity>
          </View>
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
  },
  skeletonContainer: {
    padding: spacing.lg,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  errorSub: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerGreeting: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  headerDate: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
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
  netWorthFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  netWorthSub: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
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
    alignItems: 'center',
    gap: spacing.sm,
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
  splitwiseCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitwiseCol: {
    flex: 1,
    alignItems: 'center',
  },
  splitwiseLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  splitwiseValue: {
    fontSize: fontSize.md,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  splitwiseDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
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
