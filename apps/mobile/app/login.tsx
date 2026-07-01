import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { setDemoMode, resetDemoDb } from '@/lib/demo';
import { API_BASE_URL } from '@/lib/api';
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
      await setDemoMode(false);
      await SecureStore.setItemAsync('api_token', password);

      const res = await fetch(`${API_BASE_URL}/api/accounts`, {
        headers: { Authorization: `Bearer ${password}` },
      });

      if (!res.ok) {
        await SecureStore.deleteItemAsync('api_token');
        setError(res.status === 401 ? 'Invalid password' : `Server error (${res.status})`);
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

  async function handleDemoMode() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetDemoDb();
    await setDemoMode(true);
    await SecureStore.setItemAsync('api_token', 'demo');
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.logoCircle}>
          <MaterialCommunityIcons name="wallet" size={36} color={colors.green} />
        </View>
        <Text style={styles.title}>Fynance</Text>
        <Text style={styles.subtitle}>Personal Finance Command Center</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (error) setError('');
            }}
            onSubmitEditing={handleLogin}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Unlock" onPress={handleLogin} loading={loading} />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.demoButton} onPress={handleDemoMode} activeOpacity={0.7}>
            <MaterialCommunityIcons name="test-tube" size={18} color={colors.blue} />
            <Text style={styles.demoText}>Try Demo Mode</Text>
          </TouchableOpacity>
          <Text style={styles.demoHint}>Explore the app with sample data — no server needed</Text>
        </View>
      </View>

      <Text style={styles.footer}>{API_BASE_URL ? `API: ${API_BASE_URL}` : 'EXPO_PUBLIC_API_URL not set — use Demo Mode'}</Text>
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
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.greenDim,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.hero,
    fontWeight: '700',
    color: colors.text,
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.blueDim,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  demoText: {
    color: colors.blue,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  demoHint: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  footer: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingBottom: spacing.xxl,
  },
});
