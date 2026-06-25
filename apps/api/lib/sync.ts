import { v4 as uuidv4 } from 'uuid';
import { getTransactions, getAccounts } from './plaid';
import { getRows, appendRows, findRow, updateRow, getSettingsMap } from './sheets';
import type { SyncResult } from '@fynance/shared/types';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function runSync(): Promise<SyncResult> {
  const settings = await getSettingsMap();

  const accessTokenKeys = Object.keys(settings).filter((k) => k.startsWith('plaid_access_token'));
  const accessTokens = accessTokenKeys.map((k) => settings[k]).filter(Boolean);

  if (accessTokens.length === 0) {
    return { newTransactions: 0, accountsUpdated: 0, lastSync: new Date().toISOString() };
  }

  const endDate = formatDate(new Date());
  const startDate = formatDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));

  const { rows: existingTxns } = await getRows<{ plaid_transaction_id: string }>('transactions');
  const existingIds = new Set(existingTxns.map((t) => t.plaid_transaction_id).filter(Boolean));

  let totalNewTxns = 0;
  let totalAccountsUpdated = 0;

  for (const accessToken of accessTokens) {
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
    UTILITIES: 'Utilities',
    SUBSCRIPTIONS: 'Subscriptions',
    INCOME: 'Income',
    TRANSFER: 'Transfer',
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
