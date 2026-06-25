import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { getRows } from '@/lib/sheets';
import type { Account } from '@fynance/shared/types';

export async function GET(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const { rows } = await getRows<Record<string, string>>('accounts');

    const accounts: Account[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      institution: r.institution,
      type: r.type as Account['type'],
      balance: parseFloat(r.balance) || 0,
      currency: r.currency || 'CAD',
      plaid_account_id: r.plaid_account_id,
      updated_at: r.updated_at,
    }));

    const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);

    return NextResponse.json({ accounts, netWorth: Math.round(netWorth * 100) / 100 });
  } catch (error) {
    console.error('Accounts error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}
