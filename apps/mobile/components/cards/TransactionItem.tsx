import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { Badge } from '@/components/ui/Badge';
import { colors, fontSize, spacing } from '@/lib/theme';
import { formatCurrencyDetailed, formatDate, amountColor } from '@/lib/utils';
import type { Transaction } from '@/lib/types';
import { DEFAULT_CATEGORIES } from '@fynance/shared/constants';

interface TransactionItemProps {
  transaction: Transaction;
  onPress?: (transaction: Transaction) => void;
}

export function TransactionItem({ transaction, onPress }: TransactionItemProps) {
  const cat = DEFAULT_CATEGORIES.find((c) => c.name === transaction.category);
  const icon = cat?.icon || 'dots-horizontal';
  const color = cat?.color || '#9CA3AF';

  return (
    <TouchableOpacity style={styles.container} onPress={() => onPress?.(transaction)} activeOpacity={0.6}>
      <CategoryIcon icon={icon} color={color} />
      <View style={styles.info}>
        <Text style={styles.description} numberOfLines={1}>
          {transaction.description}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.category}>{transaction.category}</Text>
          {transaction.source !== 'manual' && (
            <Badge
              label={transaction.source}
              color={transaction.source === 'plaid' ? colors.blue : colors.purple}
              bgColor={transaction.source === 'plaid' ? colors.blueDim : colors.purpleDim}
            />
          )}
        </View>
      </View>
      <View style={styles.amountContainer}>
        <Text style={[styles.amount, { color: amountColor(transaction.amount) }]}>
          {formatCurrencyDetailed(transaction.amount)}
        </Text>
        <Text style={styles.date}>{formatDate(transaction.date)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  info: {
    flex: 1,
  },
  description: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  category: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: fontSize.md,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  date: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
});
