import { describe, it, expect } from 'vitest';
import {
  monthKeyOf,
  currentMonthKey,
  shiftMonthKey,
  parseSheetData,
  computeDashboard,
  computePlan,
  suggestAllocation,
  type RawSheetData,
} from '../lib/compute';

// Fixed "now": July 15, 2026 (a Wednesday), local time.
const NOW = new Date(2026, 6, 15, 12, 0, 0);

function txn(over: Partial<Record<string, string>>): Record<string, string> {
  return {
    id: 't1',
    date: '2026-07-10',
    description: 'Test',
    amount: '-10',
    category: 'Other',
    source: 'manual',
    account: '',
    plaid_transaction_id: '',
    ...over,
  };
}

function baseData(over: Partial<RawSheetData> = {}): RawSheetData {
  return {
    transactions: [],
    accounts: [],
    categories: [],
    goals: [],
    recurring: [],
    settings: [],
    monthly_plans: [],
    ...over,
  };
}

describe('month key helpers', () => {
  it('extracts month from a date string without timezone shifts', () => {
    // new Date('2026-07-01').getMonth() shifts to June in UTC-negative zones;
    // string slicing must not.
    expect(monthKeyOf('2026-07-01')).toBe('2026-07');
    expect(monthKeyOf('2026-12-31')).toBe('2026-12');
  });

  it('computes current month key from a local date', () => {
    expect(currentMonthKey(NOW)).toBe('2026-07');
  });

  it('shifts month keys across year boundaries', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
    expect(shiftMonthKey('2026-07', -3)).toBe('2026-04');
  });
});

describe('parseSheetData', () => {
  it('parses numbers and handles empty cells', () => {
    const parsed = parseSheetData(
      baseData({
        transactions: [txn({ amount: '-42.50' }), txn({ id: 't2', amount: '' })],
        accounts: [{ id: 'a1', name: 'X', institution: '', type: 'chequing', balance: '1000.55', currency: 'CAD', plaid_account_id: '', updated_at: '' }],
      })
    );
    expect(parsed.transactions[0].amount).toBe(-42.5);
    expect(parsed.transactions[1].amount).toBe(0);
    expect(parsed.accounts[0].balance).toBe(1000.55);
  });
});

describe('computeDashboard', () => {
  it('filters income/spending to the current month only', () => {
    const dash = computeDashboard(
      baseData({
        transactions: [
          txn({ id: '1', date: '2026-07-01', amount: '2000' }), // this month income
          txn({ id: '2', date: '2026-07-05', amount: '-500' }), // this month expense
          txn({ id: '3', date: '2026-06-30', amount: '-999' }), // last month
          txn({ id: '4', date: '2026-08-01', amount: '-999' }), // next month
        ],
      }),
      NOW
    );
    expect(dash.income).toBe(2000);
    expect(dash.spent).toBe(500);
    expect(dash.saved).toBe(1500);
    expect(dash.savingsRate).toBe(75);
    expect(dash.spentLastMonth).toBe(999);
  });

  it('sums net worth across accounts including negative balances', () => {
    const dash = computeDashboard(
      baseData({
        accounts: [
          { id: 'a', name: 'Chq', institution: '', type: 'chequing', balance: '5000', currency: 'CAD', plaid_account_id: '', updated_at: '' },
          { id: 'b', name: 'CC', institution: '', type: 'credit', balance: '-1500', currency: 'CAD', plaid_account_id: '', updated_at: '' },
        ],
      }),
      NOW
    );
    expect(dash.netWorth).toBe(3500);
    expect(dash.accountCount).toBe(2);
  });

  it('flags budget alerts at 80%+ of budget', () => {
    const dash = computeDashboard(
      baseData({
        transactions: [txn({ date: '2026-07-03', amount: '-90', category: 'Food' })],
        categories: [{ name: 'Food', type: 'discretionary', monthly_budget: '100', color: '#fff', icon: 'x' }],
      }),
      NOW
    );
    expect(dash.budgetAlerts).toHaveLength(1);
    expect(dash.budgetAlerts[0].percentage).toBe(90);
  });

  it('rolls bills already due this month into next month', () => {
    const dash = computeDashboard(
      baseData({
        recurring: [
          { id: 'r1', name: 'Rent', amount: '1500', due_day: '1', category: 'Rent', account: '', active: 'true' },
          { id: 'r2', name: 'Phone', amount: '45', due_day: '20', category: 'Utilities', account: '', active: 'true' },
        ],
      }),
      NOW // July 15
    );
    const rent = dash.upcomingBills.find((b) => b.name === 'Rent')!;
    const phone = dash.upcomingBills.find((b) => b.name === 'Phone')!;
    expect(rent.dueDate).toBe('2026-08-01'); // day 1 already passed
    expect(phone.dueDate).toBe('2026-07-20'); // day 20 still ahead
    expect(phone.daysUntilDue).toBe(5);
  });

  it('ignores inactive recurring bills', () => {
    const dash = computeDashboard(
      baseData({
        recurring: [{ id: 'r1', name: 'Old Gym', amount: '50', due_day: '20', category: 'Health', account: '', active: 'false' }],
      }),
      NOW
    );
    expect(dash.upcomingBills).toHaveLength(0);
  });

  it('exposes splitwise balance when synced settings exist', () => {
    const dash = computeDashboard(
      baseData({
        settings: [
          { key: 'splitwise_you_owe', value: '50' },
          { key: 'splitwise_owed_to_you', value: '80' },
        ],
      }),
      NOW
    );
    expect(dash.splitwise).toEqual({ youOwe: 50, owedToYou: 80, net: 30 });
  });

  it('returns null splitwise when never synced', () => {
    const dash = computeDashboard(baseData(), NOW);
    expect(dash.splitwise).toBeNull();
  });
});

describe('computePlan', () => {
  const planData = () =>
    parseSheetData(
      baseData({
        transactions: [
          // income
          txn({ id: 'i1', date: '2026-07-03', amount: '2450', description: 'Payroll', category: 'Income' }),
          // bill payment (matches recurring "Rent")
          txn({ id: 'b1', date: '2026-07-01', amount: '-1500', description: 'Rent', category: 'Rent' }),
          // variable spending this month
          txn({ id: 'v1', date: '2026-07-05', amount: '-200', description: 'Groceries run', category: 'Groceries' }),
          // previous months variable spending
          txn({ id: 'p1', date: '2026-06-10', amount: '-600', description: 'Stuff', category: 'Shopping' }),
          txn({ id: 'p2', date: '2026-05-10', amount: '-400', description: 'Stuff', category: 'Shopping' }),
        ],
        recurring: [{ id: 'r1', name: 'Rent', amount: '1500', due_day: '1', category: 'Rent', account: '', active: 'true' }],
        settings: [
          { key: 'monthly_income', value: '5000' },
          { key: 'emergency_buffer_pct', value: '10' },
          { key: 'tfsa_room', value: '1000' },
        ],
      })
    );

  it('separates fixed bills from variable spending', () => {
    const plan = computePlan(planData(), '2026-07', NOW);
    expect(plan.fixedBills).toBe(1500);
    expect(plan.variableSoFar).toBe(200); // rent payment excluded
    expect(plan.bills[0].paid).toBe(true); // rent matched by description
  });

  it('computes investable as income − bills − variable − buffer', () => {
    const plan = computePlan(planData(), '2026-07', NOW);
    expect(plan.expectedIncome).toBe(5000);
    expect(plan.buffer).toBe(500);
    // investable = 5000 − 1500 − variableProjected − 500, never negative
    expect(plan.investable).toBe(
      Math.max(0, Math.round((5000 - 1500 - plan.variableProjected - 500) * 100) / 100)
    );
    expect(plan.investable).toBeGreaterThan(0);
  });

  it('falls back to actual income when no expected income is set', () => {
    const parsed = planData();
    parsed.settings.monthly_income = '';
    const plan = computePlan(parsed, '2026-07', NOW);
    expect(plan.actualIncome).toBe(2450);
    expect(plan.buffer).toBe(245); // 10% of actual income
  });

  it('uses actuals (not projections) for past months', () => {
    const plan = computePlan(planData(), '2026-06', NOW);
    expect(plan.variableProjected).toBe(plan.variableSoFar);
  });

  it('reads a saved plan allocation and lock state', () => {
    const parsed = planData();
    parsed.plans.push({
      month: '2026-07',
      income: '5000',
      fixed_bills: '1500',
      variable_spending: '600',
      buffer: '500',
      investable: '2400',
      allocation: '{"tfsa":1000,"rrsp":900,"fhsa":0,"emergency":500,"fun":0}',
      locked: 'true',
    });
    const plan = computePlan(parsed, '2026-07', NOW);
    expect(plan.locked).toBe(true);
    expect(plan.saved).toBe(true);
    expect(plan.allocation.tfsa).toBe(1000);
    expect(plan.allocation.rrsp).toBe(900);
  });
});

describe('suggestAllocation', () => {
  it('fills registered rooms first, remainder to emergency', () => {
    const alloc = suggestAllocation(3000, { tfsa: 1000, rrsp: 5000, fhsa: 500 });
    expect(alloc.tfsa).toBe(1000);
    expect(alloc.fhsa).toBe(500);
    expect(alloc.rrsp).toBe(1500);
    expect(alloc.emergency).toBe(0);
  });

  it('sends everything to emergency when no room is set', () => {
    const alloc = suggestAllocation(800, { tfsa: 0, rrsp: 0, fhsa: 0 });
    expect(alloc.emergency).toBe(800);
  });

  it('totals exactly the investable amount', () => {
    const alloc = suggestAllocation(1234.56, { tfsa: 400, rrsp: 300, fhsa: 200 });
    const total = alloc.tfsa + alloc.rrsp + alloc.fhsa + alloc.emergency + alloc.fun;
    expect(Math.round(total * 100) / 100).toBe(1234.56);
  });
});
