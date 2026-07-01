import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinanceStore } from '@/lib/store';
import { fetchAccounts } from '@/lib/api';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { DEFAULT_CATEGORIES } from '@fynance/shared/constants';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AddTransactionScreen() {
  const [amount, setAmount] = useState('');
  const [isExpense, setIsExpense] = useState(true);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [date, setDate] = useState(isoDaysAgo(0));
  const [account, setAccount] = useState('');
  const [accountNames, setAccountNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { addManualTransaction, setNeedsRefresh } = useFinanceStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchAccounts()
      .then((data) => setAccountNames(data.accounts.map((a) => a.name)))
      .catch(() => {});
  }, []);

  const dateChips = [
    { label: 'Today', value: isoDaysAgo(0) },
    { label: 'Yesterday', value: isoDaysAgo(1) },
    { label: '2 days ago', value: isoDaysAgo(2) },
  ];

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please enter a description.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Invalid Date', 'Date must be YYYY-MM-DD.');
      return;
    }

    setSaving(true);
    try {
      await addManualTransaction({
        date,
        description: description.trim(),
        amount: isExpense ? -parsedAmount : parsedAmount,
        category,
        account,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNeedsRefresh(true);

      setAmount('');
      setDescription('');
      setCategory('Other');
      setIsExpense(true);
      setDate(isoDaysAgo(0));

      router.back();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to save transaction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.title}>Add Transaction</Text>

        {/* Amount */}
        <View style={styles.amountSection}>
          <TouchableOpacity
            style={styles.signToggle}
            onPress={() => {
              Haptics.selectionAsync();
              setIsExpense(!isExpense);
            }}
          >
            <Text style={[styles.sign, { color: isExpense ? colors.red : colors.green }]}>
              {isExpense ? '−' : '+'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.dollar}>$</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            autoFocus
          />
        </View>
        <Text style={styles.amountHint}>{isExpense ? 'Expense' : 'Income'} — tap the sign to switch</Text>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={styles.textInput}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Coffee at Tim's"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Date */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Date</Text>
          <View style={styles.dateChips}>
            {dateChips.map((chip) => (
              <TouchableOpacity
                key={chip.label}
                style={[styles.dateChip, date === chip.value && styles.dateChipActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setDate(chip.value);
                }}
              >
                <Text style={[styles.dateChipText, date === chip.value && styles.dateChipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.textInput}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Account */}
        {accountNames.length > 0 && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {accountNames.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={[styles.dateChip, account === name && styles.dateChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setAccount(account === name ? '' : name);
                  }}
                >
                  <Text style={[styles.dateChipText, account === name && styles.dateChipTextActive]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Category Grid */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.categoryGrid}>
            {DEFAULT_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.name}
                style={[
                  styles.categoryItem,
                  category === cat.name && { borderColor: cat.color, backgroundColor: cat.color + '15' },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setCategory(cat.name);
                }}
              >
                <MaterialCommunityIcons
                  name={cat.icon as any}
                  size={22}
                  color={category === cat.name ? cat.color : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryName,
                    category === cat.name && { color: cat.color },
                  ]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button title="Save Transaction" onPress={handleSave} loading={saving} style={{ marginTop: spacing.xl }} />
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
    padding: spacing.xl,
    paddingBottom: 40,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xxl,
  },
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  amountHint: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xxl,
  },
  signToggle: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sign: {
    fontSize: 28,
    fontWeight: '700',
  },
  dollar: {
    fontSize: fontSize.hero,
    color: colors.textTertiary,
    fontWeight: '300',
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text,
    minWidth: 100,
    fontVariant: ['tabular-nums'],
  },
  field: {
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text,
  },
  dateChips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  dateChipActive: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  dateChipText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  dateChipTextActive: {
    color: '#FFFFFF',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryItem: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  categoryName: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
