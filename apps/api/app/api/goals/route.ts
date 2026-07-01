import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { validateAuth } from '@/lib/auth';
import { getRows, appendRow, findRow, updateRow, deleteRow } from '@/lib/sheets';
import type { Goal } from '@fynance/shared/types';

export async function GET(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const { rows } = await getRows<Record<string, string>>('goals');
    const goals: Goal[] = rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        target_amount: parseFloat(r.target_amount) || 0,
        current_amount: parseFloat(r.current_amount) || 0,
        deadline: r.deadline,
        priority: parseInt(r.priority) || 99,
        linked_account: r.linked_account,
      }))
      .sort((a, b) => a.priority - b.priority);

    return NextResponse.json({ goals });
  } catch (error) {
    console.error('Goals GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, target_amount, current_amount, deadline, priority, linked_account } = body;

    if (!name || !target_amount) {
      return NextResponse.json({ error: 'name and target_amount are required' }, { status: 400 });
    }

    const { rows } = await getRows<Record<string, string>>('goals');
    const goal = {
      id: uuidv4(),
      name,
      target_amount: String(target_amount),
      current_amount: String(current_amount || 0),
      deadline: deadline || '',
      priority: String(priority ?? rows.length + 1),
      linked_account: linked_account || '',
    };

    await appendRow('goals', goal);
    return NextResponse.json({ id: goal.id, message: 'Goal created' }, { status: 201 });
  } catch (error) {
    console.error('Goals POST error:', error);
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
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

    const found = await findRow('goals', 'id', id);
    if (!found) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const allowed = ['name', 'target_amount', 'current_amount', 'deadline', 'priority', 'linked_account'];
    const updated = { ...found.data };
    for (const key of allowed) {
      if (updates[key] !== undefined) updated[key] = String(updates[key]);
    }

    await updateRow('goals', found.rowIndex, updated);
    return NextResponse.json({ message: 'Goal updated' });
  } catch (error) {
    console.error('Goals PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
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

    const found = await findRow('goals', 'id', id);
    if (!found) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    await deleteRow('goals', found.rowIndex);
    return NextResponse.json({ message: 'Goal deleted' });
  } catch (error) {
    console.error('Goals DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
  }
}
