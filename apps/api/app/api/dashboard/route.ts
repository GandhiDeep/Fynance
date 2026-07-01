import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { batchGet } from '@/lib/sheets';
import { computeDashboard } from '@/lib/compute';
import { SHEET_TABS } from '@fynance/shared/constants';

export async function GET(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const data = await batchGet([
      SHEET_TABS.TRANSACTIONS,
      SHEET_TABS.ACCOUNTS,
      SHEET_TABS.CATEGORIES,
      SHEET_TABS.GOALS,
      SHEET_TABS.RECURRING,
      SHEET_TABS.SETTINGS,
      SHEET_TABS.MONTHLY_PLANS,
    ]);

    const dashboard = computeDashboard({
      transactions: data[SHEET_TABS.TRANSACTIONS]?.rows || [],
      accounts: data[SHEET_TABS.ACCOUNTS]?.rows || [],
      categories: data[SHEET_TABS.CATEGORIES]?.rows || [],
      goals: data[SHEET_TABS.GOALS]?.rows || [],
      recurring: data[SHEET_TABS.RECURRING]?.rows || [],
      settings: data[SHEET_TABS.SETTINGS]?.rows || [],
      monthly_plans: data[SHEET_TABS.MONTHLY_PLANS]?.rows || [],
    });

    return NextResponse.json(dashboard);
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
