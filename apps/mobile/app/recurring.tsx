import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fetchRecurring, createRecurring, updateRecurring, deleteRecurring } from '@/lib/api';
import { useFinanceStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { DEFAULT_CATEGORIES } from '@fynance/shared/constants';
import type { RecurringBill } from '@/lib/types';

interface BillForm {
  name: string;
  amount: string;
  dueDay: string;
  category: string;
}

const EMPTY_FORM: BillForm = { name: '', amount: '', dueDay: '', category: 'Subscriptions' };
const BILL_CATEGORIES = DEFAULT_CATEGORIES.filter((c) => c.type !== 'income');

export default function RecurringScreen() {
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringBill | null>(null);
  const [form, setForm] = useState<BillForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { setNeedsRefresh } = useFinanceStore();

  const load = useCallback(async () => {
    try {
      const data = await fetchRecurring();
      setBills(data.bills);
      setMonthlyTotal(data.monthlyTotal);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSheetOpen(true);
  }

  function openEdit(bill: RecurringBill) {
    setEditing(bill);
    setForm({
      name: bill.name,
      amount: String(bill.amount),
      dueDay: String(bill.due_day),
      category: bill.category,
    });
    setSheetOpen(true);
  }

  async function handleToggle(bill: RecurringBill, active: boolean) {
    Haptics.selectionAsync();
    setBills((bs) => bs.map((b) => (b.id === bill.id ? { ...b, active } : b)));
    try {
      await updateRecurring({ id: bill.id, active });
      setNeedsRefresh(true);
      await load();
    } catch {
      await load();
    }
  }

  async function handleSave() {
    const amount = parseFloat(form.amount);
    const dueDay = parseInt(form.dueDay);
    if (!form.name.trim() || isNaN(amount) || amount <= 0) {
      Alert.alert('Missing Info', 'Bill name and amount are required.');
      return;
    }
    if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
      Alert.alert('Invalid Day', 'Due day must be between 1 and 31.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateRecurring({
          id: editing.id,
          name: form.name.trim(),
          amount,
          due_day: dueDay,
          category: form.category,
        });
      } else {
        await createRecurring({
          name: form.name.trim(),
          amount,
          due_day: dueDay,
          category: form.category,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSheetOpen(false);
      setNeedsRefresh(true);
      await load();
    } catch {
      Alert.alert('Error', 'Failed to save bill.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!editing) return;
    Alert.alert('Delete Bill', `Delete "${editing.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRecurring(editing.id);
          setSheetOpen(false);
          setNeedsRefresh(true);
          await load();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Recurring Bills"
        right={
          <TouchableOpacity onPress={openAdd} hitSlop={8}>
            <MaterialCommunityIcons name="plus" size={24} color={colors.green} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Monthly Total (active)</Text>
          <Text style={styles.totalValue}>{formatCurrency(monthlyTotal)}</Text>
        </View>

        {loading ? (
          <View style={{ gap: spacing.md }}>
            <SkeletonLoader width="100%" height={70} />
            <SkeletonLoader width="100%" height={70} />
          </View>
        ) : bills.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="calendar-clock" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No recurring bills yet</Text>
            <Button title="Add Your First Bill" onPress={openAdd} />
          </View>
        ) : (
          bills.map((bill) => {
            const cat = DEFAULT_CATEGORIES.find((c) => c.name === bill.category);
            return (
              <TouchableOpacity
                key={bill.id}
                style={[styles.billRow, !bill.active && { opacity: 0.45 }]}
                onPress={() => openEdit(bill)}
                activeOpacity={0.7}
              >
                <CategoryIcon icon={cat?.icon || 'calendar-clock'} color={cat?.color || colors.textSecondary} />
                <View style={styles.billInfo}>
                  <Text style={styles.billName}>{bill.name}</Text>
                  <Text style={styles.billMeta}>
                    day {bill.due_day} — {bill.category}
                  </Text>
                </View>
                <Text style={styles.billAmount}>{formatCurrency(bill.amount)}</Text>
                <Switch
                  value={bill.active}
                  onValueChange={(v) => handleToggle(bill, v)}
                  trackColor={{ false: colors.surfaceLight, true: colors.greenDim }}
                  thumbColor={bill.active ? colors.green : colors.textTertiary}
                />
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View style={styles.form}>
          <Text style={styles.sheetTitle}>{editing ? 'Edit Bill' : 'New Recurring Bill'}</Text>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="e.g. Netflix"
            placeholderTextColor={colors.textTertiary}
          />

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Amount $</Text>
              <TextInput
                style={styles.input}
                value={form.amount}
                onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))}
                placeholder="16.99"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Due day (1–31)</Text>
              <TextInput
                style={styles.input}
                value={form.dueDay}
                onChangeText={(v) => setForm((f) => ({ ...f, dueDay: v }))}
                placeholder="15"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {BILL_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.name}
                style={[styles.catChip, form.category === cat.name && { borderColor: cat.color, backgroundColor: cat.color + '15' }]}
                onPress={() => setForm((f) => ({ ...f, category: cat.name }))}
              >
                <MaterialCommunityIcons name={cat.icon as any} size={14} color={cat.color} />
                <Text style={styles.catChipText}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Button title={editing ? 'Save Changes' : 'Add Bill'} onPress={handleSave} loading={saving} />
          {editing && <Button title="Delete Bill" onPress={handleDelete} variant="danger" />}
        </View>
      </BottomSheet>
    </View>
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
  totalCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  billInfo: {
    flex: 1,
  },
  billName: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  billMeta: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },
  billAmount: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
  },
  form: {
    gap: spacing.md,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: -spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  catChipText: {
    fontSize: fontSize.xs,
    color: colors.text,
  },
});
