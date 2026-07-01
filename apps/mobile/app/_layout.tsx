import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toast } from '@/components/ui/Toast';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthed && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthed && inAuthGroup) {
      router.replace('/');
    }
  }, [isReady, isAuthed, segments]);

  async function checkAuth() {
    const token = await SecureStore.getItemAsync('api_token');
    setIsAuthed(!!token);
    setIsReady(true);
  }

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="goals" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="recurring" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="categories" options={{ animation: 'slide_from_right' }} />
      </Stack>
      <Toast />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
