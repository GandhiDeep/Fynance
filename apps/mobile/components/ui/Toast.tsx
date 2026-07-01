import React, { useEffect } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinanceStore } from '@/lib/store';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';

/** Global error banner fed by the store; auto-dismisses after 4s. */
export function Toast() {
  const { error, clearError } = useFinanceStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, 4000);
    return () => clearTimeout(timer);
  }, [error]);

  if (!error) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.toast, { top: insets.top + spacing.sm }]}
    >
      <TouchableOpacity style={styles.inner} onPress={clearError} activeOpacity={0.8}>
        <MaterialCommunityIcons name="alert-circle" size={18} color={colors.red} />
        <Text style={styles.text} numberOfLines={2}>
          {error}
        </Text>
        <MaterialCommunityIcons name="close" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 1000,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  text: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.sm,
  },
});
