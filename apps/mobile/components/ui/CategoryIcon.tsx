import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, spacing } from '@/lib/theme';

interface CategoryIconProps {
  icon: string;
  color: string;
  size?: number;
}

export function CategoryIcon({ icon, color, size = 20 }: CategoryIconProps) {
  return (
    <View style={[styles.container, { backgroundColor: color + '22' }]}>
      <MaterialCommunityIcons name={icon as any} size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
