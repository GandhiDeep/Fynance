import { v4 as uuidv4 } from 'uuid';
import { getTransactions, getAccounts } from './plaid';
import { getRows, appendRows, findRow, updateRow, getSettingsMap, updateSetting } from './sheets';
import { isSplitwiseConfigured, getRecentExpenses, getNetBalance } from './splitwise';
import { currentMonthKey } from './compute';
import type { SyncResult } from '@fynance/shared/types';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function runSync(): Promise<SyncResult> {
  const settings = await getSettingsMap();

  const accessTokenKeys = Object.keys(settings).filter((k) => k.startsWith('plaid_access_token'));
  const accessTokens = accessTokenKeys.map((k) => settings[k]).filter(Boolean);

  const endDate = formatDate(new Date());
  const startDate = formatDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));

  const { rows: existingTxns } = await getRows<{ plaid_transaction_id: string }>('transactions');
  const existingIds = new Set(existingTxns.map((t) => t.plaid_transaction_id).filter(Boolean));

  let totalNewTxns = 0;
  let totalAccountsUpdated = 0;
  const errors: string[] = [];

  for (const accessToken of accessTokens) {
    try {
      const transactions = await getTransactions(accessToken, startDate, endDate);
      const newTxns = transactions
        .filter((t) => !existingIds.has(t.transaction_id))
        .map((t) => ({
          id: uuidv4(),
          date: t.date,
          description: t.merchant_name || t.name,
          amount: -t.amount, // Plaid: positive = debit; we want negative = expense
          category: mapPlaidCategory(t.personal_finance_category?.primary || ''),
          source: 'plaid',
          account: t.account_id,
          plaid_transaction_id: t.transaction_id,
        }));

      if (newTxns.length > 0) {
        await appendRows('transactions', newTxns);
        newTxns.forEach((t) => existingIds.add(t.plaid_transaction_id));
        totalNewTxns += newTxns.length;
      }

      const accounts = await getAccounts(accessToken);
      for (const acct of accounts) {
        const existing = await findRow('accounts', 'plaid_account_id', acct.account_id);
        const accountData = {
          id: existing?.data.id || uuidv4(),
          name: existing?.data.name || acct.name,
          institution: existing?.data.institution || '',
          type: mapAccountType(acct.type || ''),
          balance: acct.balances.current ?? 0,
          currency: acct.balances.iso_currency_code || 'CAD',
          plaid_account_id: acct.account_id,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          await updateRow('accounts', existing.rowIndex, accountData);
        } else {
          await appendRows('accounts', [accountData]);
        }
        totalAccountsUpdated++;
      }
    } catch (e: any) {
      // One dead token shouldn't kill the whole sync run.
      console.error('Plaid sync failed for a token:', e?.message || e);
      errors.push(`plaid: ${e?.message || 'unknown error'}`);
    }
  }

  if (isSplitwiseConfigured()) {
    try {
      const expenses = await getRecentExpenses(3);
      const newSwTxns = expenses
        .filter((e) => !existingIds.has(`sw_${e.id}`))
        .map((e) => ({
          id: uuidv4(),
          date: e.date,
          description: e.description,
          amount: -e.owedShare,
          category: 'Splitwise',
          source: 'splitwise',
          account: 'Splitwise',
          plaid_transaction_id: `sw_${e.id}`,
        }));

      if (newSwTxns.length > 0) {
        await appendRows('transactions', newSwTxns);
        totalNewTxns += newSwTxns.length;
      }

      const balance = await getNetBalance();
      await updateSetting('splitwise_you_owe', String(balance.youOwe));
      await updateSetting('splitwise_owed_to_you', String(balance.owedToYou));
    } catch (e: any) {
      console.error('Splitwise sync failed:', e?.message || e);
      errors.push(`splitwise: ${e?.message || 'unknown error'}`);
    }
  }

  // Snapshot this month's net worth so the dashboard can show a real
  // month-over-month trend once two snapshots exist.
  try {
    const { rows: accountRows } = await getRows<{ balance: string }>('accounts');
    const netWorth = accountRows.reduce((sum, r) => sum + (parseFloat(r.balance) || 0), 0);
    await updateSetting(`networth_${currentMonthKey()}`, String(Math.round(netWorth * 100) / 100));
  } catch (e: any) {
    console.error('Net worth snapshot failed:', e?.message || e);
  }

  return {
    newTransactions: totalNewTxns,
    accountsUpdated: totalAccountsUpdated,
    lastSync: new Date().toISOString(),
  };
}

function mapPlaidCategory(primary: string): string {
  const mapping: Record<string, string> = {
    FOOD_AND_DRINK: 'Food & Dining',
    TRANSPORTATION: 'Transport',
    ENTERTAINMENT: 'Entertainment',
    SHOPPING: 'Shopping',
    HEALTH: 'Health',
    RENT: 'Rent',
    RENT_AND_UTILITIES: 'Rent',
    UTILITIES: 'Utilities',
    SUBSCRIPTIONS: 'Subscriptions',
    INCOME: 'Income',
    TRANSFER: 'Transfer',
    TRANSFER_IN: 'Transfer',
    TRANSFER_OUT: 'Transfer',
    LOAN_PAYMENTS: 'Other',
    GENERAL_MERCHANDISE: 'Shopping',
    GROCERIES: 'Groceries',
  };
  return mapping[primary] || 'Other';
}

function mapAccountType(type: string): string {
  const mapping: Record<string, string> = {
    depository: 'chequing',
    credit: 'credit',
    loan: 'loan',
    investment: 'investment',
  };
  return mapping[type] || 'chequing';
}
