import { NextRequest, NextResponse } from 'next/server';

export function validateAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token !== process.env.APP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export function validateCronOrAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token === process.env.CRON_SECRET || token === process.env.APP_SECRET) {
    return null;
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
