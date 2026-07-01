import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { getSettingsMap, updateSetting } from '@/lib/sheets';

// Only these keys are exposed/editable from the app; plaid tokens and
// internal snapshots stay server-side.
const EDITABLE_KEYS = [
  'monthly_income',
  'emergency_buffer_pct',
  'tfsa_room',
  'rrsp_room',
  'fhsa_room',
  'currency',
] as const;

export async function GET(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const map = await getSettingsMap();
    const settings = {
      monthly_income: parseFloat(map.monthly_income) || 0,
      emergency_buffer_pct: parseFloat(map.emergency_buffer_pct) || 10,
      tfsa_room: parseFloat(map.tfsa_room) || 0,
      rrsp_room: parseFloat(map.rrsp_room) || 0,
      fhsa_room: parseFloat(map.fhsa_room) || 0,
      currency: map.currency || 'CAD',
    };
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const entries = Object.entries(body).filter(([key]) =>
      (EDITABLE_KEYS as readonly string[]).includes(key)
    );

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No editable settings provided' }, { status: 400 });
    }

    for (const [key, value] of entries) {
      await updateSetting(key, String(value));
    }

    return NextResponse.json({ message: 'Settings updated' });
  } catch (error) {
    console.error('Settings PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
