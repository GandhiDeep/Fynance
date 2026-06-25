import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { exchangePublicToken } from '@/lib/plaid';
import { getSettingsMap, updateSetting } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const { public_token } = await request.json();

    if (!public_token) {
      return NextResponse.json({ error: 'public_token is required' }, { status: 400 });
    }

    const accessToken = await exchangePublicToken(public_token);

    const settings = await getSettingsMap();
    const existingTokenKeys = Object.keys(settings).filter((k) => k.startsWith('plaid_access_token'));
    const nextIndex = existingTokenKeys.length + 1;
    await updateSetting(`plaid_access_token_${nextIndex}`, accessToken);

    return NextResponse.json({ message: 'Bank connected successfully' });
  } catch (error) {
    console.error('Exchange token error:', error);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
