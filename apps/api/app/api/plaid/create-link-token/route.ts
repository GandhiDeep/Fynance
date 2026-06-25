import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { createLinkToken } from '@/lib/plaid';

export async function POST(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  try {
    const linkToken = await createLinkToken();
    return NextResponse.json({ link_token: linkToken });
  } catch (error) {
    console.error('Create link token error:', error);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
