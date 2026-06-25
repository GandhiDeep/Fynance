import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { formatCurrency } from '@/lib/utils';
import type { UpcomingBill } from '@/lib/types';

interface BillCardProps {
  bill: UpcomingBill;
}

export function BillCard({ bill }: BillCardProps) {
  const isUrgent = bill.daysUntilDue <= 2;
  const borderColor = isUrgent ? colors.red : colors.border;

  return (
    <View style={[styles.card, { borderColor }]}>
      <View style={styles.left}>
        <Text style={styles.name}>{bill.name}</Text>
        <Text style={styles.due}>
          {bill.daysUntilDue === 0
            ? 'Due today'
            : bill.daysUntilDue === 1
              ? 'Due tomorrow'
              : `Due in ${bill.daysUntilDue} days`}
        </Text>
      </View>
      <Text style={[styles.amount, isUrgent && { color: colors.red }]}>
        {formatCurrency(bill.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
  },
  left: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  due: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  amount: {
    fontSize: fontSize.lg,
    color: colors.text,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
