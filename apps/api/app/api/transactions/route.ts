import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { validateAuth } from '@/lib/auth';
import { getRows, appendRow, findRow, updateRow, deleteRow } from '@/lib/sheets';
import type { Transaction } from '@fynance/shared/types';

export async function GET(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const { rows } = await getRows<Record<string, string>>('transactions');

    let transactions = rows.map((r) => ({
      id: r.id,
      date: r.date,
      description: r.description,
      amount: parseFloat(r.amount) || 0,
      category: r.category,
      source: r.source as Transaction['source'],
      account: r.account,
      plaid_transaction_id: r.plaid_transaction_id,
    }));

    if (month && year) {
      const key = `${year}-${String(parseInt(month)).padStart(2, '0')}`;
      transactions = transactions.filter((t) => (t.date || '').slice(0, 7) === key);
    }

    if (category) {
      transactions = transactions.filter((t) => t.category === category);
    }

    if (search) {
      const s = search.toLowerCase();
      transactions = transactions.filter((t) => t.description.toLowerCase().includes(s));
    }

    transactions.sort((a, b) => (a.date < b.date ? 1 : -1));

    const total = transactions.length;
    const start = (page - 1) * limit;
    const paginated = transactions.slice(start, start + limit);

    const sumIncome = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const sumExpenses = Math.abs(transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));

    return NextResponse.json({
      transactions: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      sumIncome: Math.round(sumIncome * 100) / 100,
      sumExpenses: Math.round(sumExpenses * 100) / 100,
    });
  } catch (error) {
    console.error('Transactions GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { date, description, amount, category, account } = body;

    if (!date || !description || amount === undefined || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const transaction = {
      id: uuidv4(),
      date,
      description,
      amount: String(amount),
      category,
      source: 'manual',
      account: account || '',
      plaid_transaction_id: '',
    };

    await appendRow('transactions', transaction);

    return NextResponse.json({ id: transaction.id, message: 'Transaction added' }, { status: 201 });
  } catch (error) {
    console.error('Transactions POST error:', error);
    return NextResponse.json({ error: 'Failed to add transaction' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, category, description } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const found = await findRow('transactions', 'id', id);
    if (!found) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const updated = { ...found.data };
    if (category !== undefined) updated.category = category;
    if (description !== undefined) updated.description = description;

    await updateRow('transactions', found.rowIndex, updated);

    return NextResponse.json({ message: 'Transaction updated' });
  } catch (error) {
    console.error('Transactions PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
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

    const found = await findRow('transactions', 'id', id);
    if (!found) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    await deleteRow('transactions', found.rowIndex);

    return NextResponse.json({ message: 'Transaction deleted' });
  } catch (error) {
    console.error('Transactions DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
