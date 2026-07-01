import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { validateAuth } from '@/lib/auth';
import { getRows, appendRow, findRow, updateRow, deleteRow } from '@/lib/sheets';
import type { RecurringBill } from '@fynance/shared/types';

export async function GET(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const { rows } = await getRows<Record<string, string>>('recurring');
    const bills: RecurringBill[] = rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        amount: parseFloat(r.amount) || 0,
        due_day: parseInt(r.due_day) || 1,
        category: r.category,
        account: r.account,
        active: r.active === 'true' || r.active === 'TRUE',
      }))
      .sort((a, b) => a.due_day - b.due_day);

    const monthlyTotal = bills.filter((b) => b.active).reduce((sum, b) => sum + b.amount, 0);
    return NextResponse.json({ bills, monthlyTotal: Math.round(monthlyTotal * 100) / 100 });
  } catch (error) {
    console.error('Recurring GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch recurring bills' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, amount, due_day, category, account } = body;

    if (!name || !amount || !due_day) {
      return NextResponse.json({ error: 'name, amount and due_day are required' }, { status: 400 });
    }

    const bill = {
      id: uuidv4(),
      name,
      amount: String(amount),
      due_day: String(due_day),
      category: category || 'Subscriptions',
      account: account || '',
      active: 'true',
    };

    await appendRow('recurring', bill);
    return NextResponse.json({ id: bill.id, message: 'Bill created' }, { status: 201 });
  } catch (error) {
    console.error('Recurring POST error:', error);
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const found = await findRow('recurring', 'id', id);
    if (!found) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const allowed = ['name', 'amount', 'due_day', 'category', 'account', 'active'];
    const updated = { ...found.data };
    for (const key of allowed) {
      if (updates[key] !== undefined) updated[key] = String(updates[key]);
    }

    await updateRow('recurring', found.rowIndex, updated);
    return NextResponse.json({ message: 'Bill updated' });
  } catch (error) {
    console.error('Recurring PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const found = await findRow('recurring', 'id', id);
    if (!found) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    await deleteRow('recurring', found.rowIndex);
    return NextResponse.json({ message: 'Bill deleted' });
  } catch (error) {
    console.error('Recurring DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 });
  }
}
