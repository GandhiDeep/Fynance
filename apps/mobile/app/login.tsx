import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';

export default function LoginScreen() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin() {
    if (!password.trim()) {
      setError('Enter your password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await SecureStore.setItemAsync('api_token', password);

      const baseUrl = process.env.EXPO_PUBLIC_API_URL;
      const res = await fetch(`${baseUrl}/api/dashboard`, {
        headers: { Authorization: `Bearer ${password}` },
      });

      if (!res.ok) {
        await SecureStore.deleteItemAsync('api_token');
        setError('Invalid password');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (e) {
      await SecureStore.deleteItemAsync('api_token');
      setError('Cannot connect to server');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Fynance</Text>
        <Text style={styles.subtitle}>Personal Finance Command Center</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
            autoFocus
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Unlock" onPress={handleLogin} loading={loading} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    fontSize: fontSize.hero,
    fontWeight: '700',
    color: colors.green,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xxxl,
  },
  form: {
    gap: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    fontSize: fontSize.lg,
    color: colors.text,
    textAlign: 'center',
  },
  error: {
    color: colors.red,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
