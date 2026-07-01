import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize } from '@/lib/theme';

const TABS: { name: string; title: string; icon: string; iconOutline: string }[] = [
  { name: 'index', title: 'Home', icon: 'view-dashboard', iconOutline: 'view-dashboard-outline' },
  { name: 'transactions', title: 'Activity', icon: 'format-list-bulleted', iconOutline: 'format-list-bulleted' },
  { name: 'add', title: 'Add', icon: 'plus-circle', iconOutline: 'plus-circle-outline' },
  { name: 'plan', title: 'Plan', icon: 'target', iconOutline: 'target' },
  { name: 'more', title: 'More', icon: 'menu', iconOutline: 'menu' },
];

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: '600',
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size, focused }) => (
              <MaterialCommunityIcons
                name={(focused ? tab.icon : tab.iconOutline) as any}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
