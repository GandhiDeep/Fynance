import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { formatCurrency } from '@/lib/utils';
import type { CategorySpending } from '@/lib/types';

interface SpendingChartProps {
  data: CategorySpending[];
}

export function SpendingChart({ data }: SpendingChartProps) {
  const maxSpent = Math.max(...data.map((d) => d.spent), 1);

  return (
    <View style={styles.container}>
      {data.map((item) => (
        <View key={item.category} style={styles.row}>
          <View style={styles.labelContainer}>
            <Text style={styles.label} numberOfLines={1}>
              {item.category}
            </Text>
            <Text style={styles.amount}>{formatCurrency(item.spent)}</Text>
          </View>
          <View style={styles.barBackground}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.round((item.spent / maxSpent) * 100)}%`,
                  backgroundColor: item.color,
                },
              ]}
            />
            {item.budget > 0 && (
              <View
                style={[
                  styles.budgetMark,
                  { left: `${Math.min(100, Math.round((item.budget / maxSpent) * 100))}%` },
                ]}
              />
            )}
          </View>
          {item.budget > 0 && (
            <Text
              style={[
                styles.percentage,
                { color: item.percentage >= 100 ? colors.red : item.percentage >= 80 ? colors.amber : colors.textTertiary },
              ]}
            >
              {item.percentage}%
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  row: {
    gap: spacing.xs,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  amount: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  barBackground: {
    height: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetMark: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 12,
    backgroundColor: colors.textTertiary,
  },
  percentage: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textAlign: 'right',
  },
});
