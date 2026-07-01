import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, spacing } from '@/lib/theme';

interface ScreenHeaderProps {
  title: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, right }: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()} hitSlop={8}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  back: {
    marginRight: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  right: {
    minWidth: 32,
    alignItems: 'flex-end',
  },
});
