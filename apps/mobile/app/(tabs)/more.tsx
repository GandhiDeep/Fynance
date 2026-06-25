import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useFinanceStore } from '@/lib/store';
import { fetchAccounts } from '@/lib/api';
import { formatCurrency, getRelativeDate } from '@/lib/utils';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import type { Account } from '@/lib/types';

export default function MoreScreen() {
  const { lastSynced, isSyncing, syncNow } = useFinanceStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [netWorth, setNetWorth] = useState(0);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadAccounts();
  }, []);

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

  async function handleLogout() {
    await SecureStore.deleteItemAsync('api_token');
    router.replace('/login');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>More</Text>

      {/* Accounts Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accounts</Text>
        <View style={styles.card}>
          <View style={styles.netWorthRow}>
            <Text style={styles.netWorthLabel}>Total Net Worth</Text>
            <Text style={styles.netWorthValue}>{formatCurrency(netWorth)}</Text>
          </View>

          {loadingAccounts ? (
            <ActivityIndicator color={colors.green} style={{ padding: spacing.lg }} />
          ) : (
            accounts.map((acct) => (
              <View key={acct.id} style={styles.accountRow}>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{acct.name}</Text>
                  <Text style={styles.accountMeta}>
                    {acct.institution} — {acct.type}
                  </Text>
                </View>
                <View style={styles.accountRight}>
                  <Text style={[styles.accountBalance, { color: acct.balance >= 0 ? colors.green : colors.red }]}>
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
        <View style={styles.card}>
          <MenuItem icon="cog" label="Settings" subtitle="Currency, income, budget" onPress={() => {}} />
          <MenuItem icon="calendar-clock" label="Recurring Bills" subtitle="Manage monthly bills" onPress={() => {}} />
          <MenuItem icon="bullseye-arrow" label="Goals" subtitle="Savings targets" onPress={() => {}} />
          <MenuItem icon="tag-multiple" label="Categories" subtitle="Budget per category" onPress={() => {}} />
        </View>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <Button title="Log Out" onPress={handleLogout} variant="danger" />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function MenuItem({ icon, label, subtitle, onPress }: { icon: string; label: string; subtitle: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={menuStyles.item} onPress={onPress} activeOpacity={0.6}>
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
    paddingTop: 60,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xl,
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
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
