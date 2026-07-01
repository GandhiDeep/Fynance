import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { fetchCategories, updateCategoryBudget } from '@/lib/api';
import { useFinanceStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { Badge } from '@/components/ui/Badge';
import type { Category } from '@/lib/types';

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);
  const { setNeedsRefresh } = useFinanceStore();

  const load = useCallback(async () => {
    try {
      const data = await fetchCategories();
      setCategories(data.categories);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  function openEdit(cat: Category) {
    setEditing(cat);
    setBudget(String(cat.monthly_budget || ''));
  }

  async function handleSave() {
    if (!editing) return;
    const amount = parseFloat(budget);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Invalid Budget', 'Enter a valid amount (0 to remove the budget).');
      return;
    }

    setSaving(true);
    try {
      await updateCategoryBudget(editing.name, amount);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(null);
      setNeedsRefresh(true);
      await load();
    } catch {
      Alert.alert('Error', 'Failed to update budget.');
    } finally {
      setSaving(false);
    }
  }

  const totalBudget = categories.reduce((sum, c) => sum + (c.monthly_budget || 0), 0);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Category Budgets" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Monthly Budgets</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalBudget)}</Text>
        </View>

        {loading ? (
          <View style={{ gap: spacing.md }}>
            <SkeletonLoader width="100%" height={60} />
            <SkeletonLoader width="100%" height={60} />
            <SkeletonLoader width="100%" height={60} />
          </View>
        ) : (
          categories.map((cat) => (
            <TouchableOpacity key={cat.name} style={styles.catRow} onPress={() => openEdit(cat)} activeOpacity={0.7}>
              <CategoryIcon icon={cat.icon} color={cat.color} />
              <View style={styles.catInfo}>
                <Text style={styles.catName}>{cat.name}</Text>
                <Badge label={cat.type} />
              </View>
              <Text style={[styles.catBudget, !cat.monthly_budget && { color: colors.textTertiary }]}>
                {cat.monthly_budget ? `${formatCurrency(cat.monthly_budget)}/mo` : 'no budget'}
              </Text>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <BottomSheet visible={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <View style={styles.form}>
            <View style={styles.sheetHeader}>
              <CategoryIcon icon={editing.icon} color={editing.color} />
              <Text style={styles.sheetTitle}>{editing.name}</Text>
            </View>

            <Text style={styles.fieldLabel}>Monthly budget (0 = no budget)</Text>
            <TextInput
              style={styles.input}
              value={budget}
              onChangeText={setBudget}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
            />

            <Button title="Save Budget" onPress={handleSave} loading={saving} />
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
  catRow: {
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
  catInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  catName: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  catBudget: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  form: {
    gap: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
