import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';

interface MetricCardProps {
  label: string;
  value: string;
  icon: string;
  iconColor: string;
  subtitle?: string;
  onPress?: () => void;
}

export function MetricCard({ label, value, icon, iconColor, subtitle, onPress }: MetricCardProps) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <MaterialCommunityIcons name={icon as any} size={18} color={iconColor} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={[styles.value, { color: iconColor }]}>{value}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  value: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
});
