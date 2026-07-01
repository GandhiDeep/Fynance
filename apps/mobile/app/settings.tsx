import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { fetchSettings, updateSettings } from '@/lib/api';
import { useFinanceStore } from '@/lib/store';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

interface Field {
  key: 'monthly_income' | 'emergency_buffer_pct' | 'tfsa_room' | 'rrsp_room' | 'fhsa_room';
  label: string;
  hint: string;
  prefix?: string;
  suffix?: string;
}

const FIELDS: Field[] = [
  { key: 'monthly_income', label: 'Expected Monthly Income', hint: 'Used to compute your investable amount', prefix: '$' },
  { key: 'emergency_buffer_pct', label: 'Emergency Buffer', hint: 'Percent of income kept aside each month', suffix: '%' },
  { key: 'tfsa_room', label: 'TFSA Room Remaining', hint: 'Update each January or after contributing', prefix: '$' },
  { key: 'rrsp_room', label: 'RRSP Room Remaining', hint: 'From your CRA notice of assessment', prefix: '$' },
  { key: 'fhsa_room', label: 'FHSA Room Remaining', hint: '$8,000/yr limit, $40,000 lifetime', prefix: '$' },
];

export default function SettingsScreen() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { setNeedsRefresh } = useFinanceStore();

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchSettings();
        setValues({
          monthly_income: String(s.monthly_income),
          emergency_buffer_pct: String(s.emergency_buffer_pct),
          tfsa_room: String(s.tfsa_room),
          rrsp_room: String(s.rrsp_room),
          fhsa_room: String(s.fhsa_room),
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    const updates: Record<string, number> = {};
    for (const field of FIELDS) {
      const n = parseFloat(values[field.key]);
      if (isNaN(n) || n < 0) {
        Alert.alert('Invalid Value', `"${field.label}" must be a non-negative number.`);
        return;
      }
      updates[field.key] = n;
    }

    setSaving(true);
    try {
      await updateSettings(updates);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNeedsRefresh(true);
      Alert.alert('Saved', 'Settings updated.');
    } catch {
      Alert.alert('Error', 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Settings" />

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={{ gap: spacing.md }}>
            <SkeletonLoader width="100%" height={80} />
            <SkeletonLoader width="100%" height={80} />
            <SkeletonLoader width="100%" height={80} />
          </View>
        ) : (
          <>
            {FIELDS.map((field) => (
              <View key={field.key} style={styles.fieldCard}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <Text style={styles.fieldHint}>{field.hint}</Text>
                <View style={styles.inputRow}>
                  {field.prefix && <Text style={styles.affix}>{field.prefix}</Text>}
                  <TextInput
                    style={styles.input}
                    value={values[field.key] || ''}
                    onChangeText={(v) => setValues((vals) => ({ ...vals, [field.key]: v }))}
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textTertiary}
                    selectTextOnFocus
                  />
                  {field.suffix && <Text style={styles.affix}>{field.suffix}</Text>}
                </View>
              </View>
            ))}

            <Button title="Save Settings" onPress={handleSave} loading={saving} style={{ marginTop: spacing.md }} />
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  fieldCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  fieldHint: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
  },
  affix: {
    color: colors.textTertiary,
    fontSize: fontSize.md,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
});
