import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { batchGet, findRow, updateRow, appendRow } from '@/lib/sheets';
import { parseSheetData, computePlan } from '@/lib/compute';
import { SHEET_TABS } from '@fynance/shared/constants';

const MONTH_RE = /^\d{4}-\d{2}$/;

export async function GET(request: NextRequest, { params }: { params: Promise<{ month: string }> }) {
  const authError = validateAuth(request);
  if (authError) return authError;

  const { month } = await params;
  if (!MONTH_RE.test(month)) {
    return NextResponse.json({ error: 'Month must be YYYY-MM' }, { status: 400 });
  }

  try {
    const data = await batchGet([
      SHEET_TABS.TRANSACTIONS,
      SHEET_TABS.RECURRING,
      SHEET_TABS.SETTINGS,
      SHEET_TABS.MONTHLY_PLANS,
    ]);

    const parsed = parseSheetData({
      transactions: data[SHEET_TABS.TRANSACTIONS]?.rows || [],
      accounts: [],
      categories: [],
      goals: [],
      recurring: data[SHEET_TABS.RECURRING]?.rows || [],
      settings: data[SHEET_TABS.SETTINGS]?.rows || [],
      monthly_plans: data[SHEET_TABS.MONTHLY_PLANS]?.rows || [],
    });

    return NextResponse.json(computePlan(parsed, month));
  } catch (error) {
    console.error('Plan GET error:', error);
    return NextResponse.json({ error: 'Failed to load plan' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ month: string }> }) {
  const authError = validateAuth(request);
  if (authError) return authError;

  const { month } = await params;
  if (!MONTH_RE.test(month)) {
    return NextResponse.json({ error: 'Month must be YYYY-MM' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { income, fixed_bills, variable_spending, buffer, investable, allocation, locked } = body;

    const existing = await findRow(SHEET_TABS.MONTHLY_PLANS, 'month', month);
    if (existing && existing.data.locked === 'true' && locked !== false) {
      return NextResponse.json({ error: 'Plan is locked. Unlock it first.' }, { status: 409 });
    }

    const row = {
      month,
      income: String(income ?? existing?.data.income ?? 0),
      fixed_bills: String(fixed_bills ?? existing?.data.fixed_bills ?? 0),
      variable_spending: String(variable_spending ?? existing?.data.variable_spending ?? 0),
      buffer: String(buffer ?? existing?.data.buffer ?? 0),
      investable: String(investable ?? existing?.data.investable ?? 0),
      allocation: allocation ? JSON.stringify(allocation) : existing?.data.allocation || '{}',
      locked: String(locked ?? false),
    };

    if (existing) {
      await updateRow(SHEET_TABS.MONTHLY_PLANS, existing.rowIndex, row);
    } else {
      await appendRow(SHEET_TABS.MONTHLY_PLANS, row);
    }

    return NextResponse.json({ message: 'Plan saved', month });
  } catch (error) {
    console.error('Plan POST error:', error);
    return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 });
  }
}
