import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinanceStore } from '@/lib/store';
import { fetchAccounts, getPlaidLinkUrl } from '@/lib/api';
import { isDemoMode, setDemoMode } from '@/lib/demo';
import { formatCurrency, getRelativeDate } from '@/lib/utils';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import type { Account } from '@/lib/types';

const ACCOUNT_TYPE_ICONS: Record<string, string> = {
  chequing: 'bank',
  savings: 'piggy-bank',
  credit: 'credit-card',
  investment: 'chart-line',
  loan: 'hand-coin',
};

export default function MoreScreen() {
  const { lastSynced, isSyncing, syncNow } = useFinanceStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [netWorth, setNetWorth] = useState(0);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [demo, setDemo] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
      isDemoMode().then(setDemo);
    }, [])
  );

  async function loadAccounts() {
    try {
      const data = await fetchAccounts();
      setAccounts(data.accounts);
      setNetWorth(data.netWorth);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAccounts(false);
    }
  }

  async function handleSync() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await syncNow();
    loadAccounts();
  }

  async function handleConnectBank() {
    if (demo) {
      Alert.alert('Demo Mode', 'Bank connections are disabled in demo mode. Log in with your password to connect a real bank.');
      return;
    }
    try {
      const url = await getPlaidLinkUrl();
      await WebBrowser.openBrowserAsync(url);
      // Balances update after the user finishes in the browser and syncs.
      Alert.alert('Connected?', 'Once you finish in the browser, run Sync Now to pull your accounts.');
    } catch {
      Alert.alert('Error', 'Could not open the bank connection page.');
    }
  }

  async function handleLogout() {
    await setDemoMode(false);
    await SecureStore.deleteItemAsync('api_token');
    router.replace('/login');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.title}>More</Text>

      {demo && (
        <View style={styles.demoBanner}>
          <MaterialCommunityIcons name="test-tube" size={16} color={colors.blue} />
          <Text style={styles.demoText}>Demo mode — sample data only</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.demoExit}>Exit</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Accounts Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accounts</Text>
        <View style={styles.card}>
          <View style={styles.netWorthRow}>
            <View>
              <Text style={styles.netWorthLabel}>Total Net Worth</Text>
              <Text style={styles.netWorthValue}>{formatCurrency(netWorth)}</Text>
            </View>
            <TouchableOpacity style={styles.connectButton} onPress={handleConnectBank} activeOpacity={0.7}>
              <MaterialCommunityIcons name="bank-plus" size={16} color={colors.green} />
              <Text style={styles.connectText}>Connect Bank</Text>
            </TouchableOpacity>
          </View>

          {loadingAccounts ? (
            <ActivityIndicator color={colors.green} style={{ padding: spacing.lg }} />
          ) : accounts.length === 0 ? (
            <Text style={styles.emptyAccounts}>No accounts yet — connect a bank or add balances to your sheet.</Text>
          ) : (
            accounts.map((acct, i) => (
              <View key={acct.id} style={[styles.accountRow, i === accounts.length - 1 && { borderBottomWidth: 0 }]}>
                <MaterialCommunityIcons
                  name={(ACCOUNT_TYPE_ICONS[acct.type] || 'bank') as any}
                  size={20}
                  color={colors.textSecondary}
                />
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{acct.name}</Text>
                  <Text style={styles.accountMeta}>
                    {acct.institution}{acct.institution ? ' — ' : ''}{acct.type}
                  </Text>
                </View>
                <View style={styles.accountRight}>
                  <Text style={[styles.accountBalance, { color: acct.balance >= 0 ? colors.text : colors.red }]}>
                    {formatCurrency(acct.balance)}
                  </Text>
                  <Text style={styles.accountUpdated}>
                    {acct.updated_at ? getRelativeDate(acct.updated_at) : 'never'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Sync & Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync & Data</Text>
        <View style={styles.card}>
          <View style={styles.syncRow}>
            <View>
              <Text style={styles.syncLabel}>Last Synced</Text>
              <Text style={styles.syncValue}>
                {lastSynced ? getRelativeDate(lastSynced) : 'Never'}
              </Text>
            </View>
            <Button title={isSyncing ? 'Syncing...' : 'Sync Now'} onPress={handleSync} loading={isSyncing} variant="secondary" />
          </View>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manage</Text>
        <View style={styles.card}>
          <MenuItem icon="cog" label="Settings" subtitle="Income, buffer, TFSA/RRSP room" onPress={() => router.push('/settings')} />
          <MenuItem icon="calendar-clock" label="Recurring Bills" subtitle="Rent, subscriptions, utilities" onPress={() => router.push('/recurring')} />
          <MenuItem icon="bullseye-arrow" label="Goals" subtitle="Savings targets and progress" onPress={() => router.push('/goals')} />
          <MenuItem icon="tag-multiple" label="Category Budgets" subtitle="Monthly limits per category" onPress={() => router.push('/categories')} last />
        </View>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <Button title={demo ? 'Exit Demo Mode' : 'Log Out'} onPress={handleLogout} variant="danger" />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function MenuItem({ icon, label, subtitle, onPress, last }: { icon: string; label: string; subtitle: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity style={[menuStyles.item, last && { borderBottomWidth: 0 }]} onPress={onPress} activeOpacity={0.6}>
      <MaterialCommunityIcons name={icon as any} size={22} color={colors.textSecondary} />
      <View style={menuStyles.info}>
        <Text style={menuStyles.label}>{label}</Text>
        <Text style={menuStyles.subtitle}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
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
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xl,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.blueDim,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  demoText: {
    flex: 1,
    color: colors.blue,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  demoExit: {
    color: colors.blue,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  netWorthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  netWorthLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  netWorthValue: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.greenDim,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  connectText: {
    color: colors.green,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  emptyAccounts: {
    padding: spacing.lg,
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  accountMeta: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  accountRight: {
    alignItems: 'flex-end',
  },
  accountBalance: {
    fontSize: fontSize.md,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  accountUpdated: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  syncLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  syncValue: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
    marginTop: 2,
  },
});

const menuStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },
});
