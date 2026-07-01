import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fetchGoals, createGoal, updateGoal, deleteGoal } from '@/lib/api';
import { useFinanceStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import type { Goal } from '@/lib/types';

interface GoalForm {
  name: string;
  target: string;
  current: string;
  deadline: string;
}

const EMPTY_FORM: GoalForm = { name: '', target: '', current: '', deadline: '' };

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [form, setForm] = useState<GoalForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { setNeedsRefresh } = useFinanceStore();

  const load = useCallback(async () => {
    try {
      const data = await fetchGoals();
      setGoals(data.goals);
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

  function openEdit(goal: Goal) {
    setEditing(goal);
    setForm({
      name: goal.name,
      target: String(goal.target_amount),
      current: String(goal.current_amount),
      deadline: goal.deadline,
    });
    setSheetOpen(true);
  }

  async function handleSave() {
    const target = parseFloat(form.target);
    if (!form.name.trim() || isNaN(target) || target <= 0) {
      Alert.alert('Missing Info', 'Goal name and a target amount are required.');
      return;
    }
    if (form.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(form.deadline)) {
      Alert.alert('Invalid Date', 'Deadline must be YYYY-MM-DD.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateGoal({
          id: editing.id,
          name: form.name.trim(),
          target_amount: target,
          current_amount: parseFloat(form.current) || 0,
          deadline: form.deadline,
        });
      } else {
        await createGoal({
          name: form.name.trim(),
          target_amount: target,
          current_amount: parseFloat(form.current) || 0,
          deadline: form.deadline,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSheetOpen(false);
      setNeedsRefresh(true);
      await load();
    } catch {
      Alert.alert('Error', 'Failed to save goal.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!editing) return;
    Alert.alert('Delete Goal', `Delete "${editing.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(editing.id);
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
        title="Goals"
        right={
          <TouchableOpacity onPress={openAdd} hitSlop={8}>
            <MaterialCommunityIcons name="plus" size={24} color={colors.green} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={{ gap: spacing.md }}>
            <SkeletonLoader width="100%" height={100} />
            <SkeletonLoader width="100%" height={100} />
          </View>
        ) : goals.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="bullseye-arrow" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No goals yet</Text>
            <Button title="Add Your First Goal" onPress={openAdd} />
          </View>
        ) : (
          goals.map((goal) => {
            const pct = goal.target_amount > 0 ? Math.round((goal.current_amount / goal.target_amount) * 100) : 0;
            return (
              <TouchableOpacity key={goal.id} style={styles.card} onPress={() => openEdit(goal)} activeOpacity={0.7}>
                <View style={styles.cardHeader}>
                  <Text style={styles.goalName}>{goal.name}</Text>
                  <Text style={[styles.goalPct, { color: pct >= 100 ? colors.green : colors.blue }]}>{pct}%</Text>
                </View>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 100 ? colors.green : colors.blue },
                    ]}
                  />
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.goalAmounts}>
                    {formatCurrency(goal.current_amount)} of {formatCurrency(goal.target_amount)}
                  </Text>
                  {goal.deadline ? <Text style={styles.goalDeadline}>by {goal.deadline}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View style={styles.form}>
          <Text style={styles.sheetTitle}>{editing ? 'Edit Goal' : 'New Goal'}</Text>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="e.g. Emergency Fund"
            placeholderTextColor={colors.textTertiary}
          />

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Target $</Text>
              <TextInput
                style={styles.input}
                value={form.target}
                onChangeText={(v) => setForm((f) => ({ ...f, target: v }))}
                placeholder="10000"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Saved so far $</Text>
              <TextInput
                style={styles.input}
                value={form.current}
                onChangeText={(v) => setForm((f) => ({ ...f, current: v }))}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Deadline (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={form.deadline}
            onChangeText={(v) => setForm((f) => ({ ...f, deadline: v }))}
            placeholder="2026-12-31"
            placeholderTextColor={colors.textTertiary}
          />

          <Button title={editing ? 'Save Changes' : 'Create Goal'} onPress={handleSave} loading={saving} />
          {editing && <Button title="Delete Goal" onPress={handleDelete} variant="danger" />}
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  goalName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  goalPct: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalAmounts: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  goalDeadline: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
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
});
