const BASE = 'https://secure.splitwise.com/api/v3.0';

export function isSplitwiseConfigured(): boolean {
  return !!(process.env.SPLITWISE_API_KEY && process.env.SPLITWISE_USER_ID);
}

async function swFetch(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${process.env.SPLITWISE_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Splitwise ${path} failed: ${res.status}`);
  }
  return res.json();
}

export interface SplitwiseExpense {
  id: number;
  date: string; // YYYY-MM-DD
  description: string;
  owedShare: number; // what the current user owes for this expense
}

export async function getRecentExpenses(daysBack = 3): Promise<SplitwiseExpense[]> {
  const userId = process.env.SPLITWISE_USER_ID;
  const datedAfter = new Date(Date.now() - daysBack * 86400000).toISOString();
  const data = await swFetch(`/get_expenses?limit=50&dated_after=${encodeURIComponent(datedAfter)}`);

  const expenses: SplitwiseExpense[] = [];
  for (const exp of data.expenses || []) {
    if (exp.deleted_at) continue;
    if (exp.payment) continue; // settle-up payments aren't spending
    const me = (exp.users || []).find((u: any) => String(u.user_id) === String(userId));
    if (!me) continue;
    const owedShare = parseFloat(me.owed_share) || 0;
    if (owedShare <= 0) continue;
    expenses.push({
      id: exp.id,
      date: (exp.date || '').slice(0, 10),
      description: exp.description || 'Splitwise expense',
      owedShare,
    });
  }
  return expenses;
}

export async function getNetBalance(): Promise<{ youOwe: number; owedToYou: number }> {
  const data = await swFetch('/get_friends');
  let youOwe = 0;
  let owedToYou = 0;
  for (const friend of data.friends || []) {
    for (const bal of friend.balance || []) {
      const amount = parseFloat(bal.amount) || 0;
      if (amount > 0) owedToYou += amount;
      else youOwe += Math.abs(amount);
    }
  }
  return {
    youOwe: Math.round(youOwe * 100) / 100,
    owedToYou: Math.round(owedToYou * 100) / 100,
  };
}
