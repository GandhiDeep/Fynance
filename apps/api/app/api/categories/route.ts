import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { getRows, findRow, updateRow } from '@/lib/sheets';
import type { Category } from '@fynance/shared/types';

export async function GET(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const { rows } = await getRows<Record<string, string>>('categories');
    const categories: Category[] = rows.map((r) => ({
      name: r.name,
      type: r.type as Category['type'],
      monthly_budget: parseFloat(r.monthly_budget) || 0,
      color: r.color,
      icon: r.icon,
    }));

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Categories GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, monthly_budget } = body;

    if (!name || monthly_budget === undefined) {
      return NextResponse.json({ error: 'name and monthly_budget are required' }, { status: 400 });
    }

    const found = await findRow('categories', 'name', name);
    if (!found) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    await updateRow('categories', found.rowIndex, {
      ...found.data,
      monthly_budget: String(monthly_budget),
    });

    return NextResponse.json({ message: 'Budget updated' });
  } catch (error) {
    console.error('Categories PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}
