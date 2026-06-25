import { NextRequest, NextResponse } from 'next/server';
import { validateCronOrAuth } from '@/lib/auth';
import { runSync } from '@/lib/sync';
import { updateSetting } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  const authError = validateCronOrAuth(request);
  if (authError) return authError;

  try {
    const result = await runSync();
    await updateSetting('last_sync', result.lastSync);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
