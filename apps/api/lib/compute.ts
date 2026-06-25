import type {
  Transaction,
  Account,
  Category,
  Goal,
  RecurringBill,
  DashboardData,
  CategorySpending,
  GoalProgress,
  UpcomingBill,
} from '@fynance/shared/types';

function parseNum(val: string | number): number {
  if (typeof val === 'number') return val;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function parseBool(val: string | boolean): boolean {
  if (typeof val === 'boolean') return val;
  return val === 'true' || val === 'TRUE';
}

interface RawSheetData {
  transactions: Record<string, string>[];
  accounts: Record<string, string>[];
  categories: Record<string, string>[];
  goals: Record<string, string>[];
  recurring: Record<string, string>[];
  settings: Record<string, string>[];
}

export function computeDashboard(data: RawSheetData): DashboardData {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const transactions: Transaction[] = data.transactions.map((r) => ({
    id: r.id,
    date: r.date,
    description: r.description,
    amount: parseNum(r.amount),
    category: r.category,
    source: r.source as Transaction['source'],
    account: r.account,
    plaid_transaction_id: r.plaid_transaction_id,
  }));

  const accounts: Account[] = data.accounts.map((r) => ({
    id: r.id,
    name: r.name,
    institution: r.institution,
    type: r.type as Account['type'],
    balance: parseNum(r.balance),
    currency: r.currency,
    plaid_account_id: r.plaid_account_id,
    updated_at: r.updated_at,
  }));

  const categories: Category[] = data.categories.map((r) => ({
    name: r.name,
    type: r.type as Category['type'],
    monthly_budget: parseNum(r.monthly_budget),
    color: r.color,
    icon: r.icon,
  }));

  const goals: Goal[] = data.goals.map((r) => ({
    id: r.id,
    name: r.name,
    target_amount: parseNum(r.target_amount),
    current_amount: parseNum(r.current_amount),
    deadline: r.deadline,
    priority: parseNum(r.priority),
    linked_account: r.linked_account,
  }));

  const recurring: RecurringBill[] = data.recurring.map((r) => ({
    id: r.id,
    name: r.name,
    amount: parseNum(r.amount),
    due_day: parseNum(r.due_day),
    category: r.category,
    account: r.account,
    active: parseBool(r.active),
  }));

  const settingsMap: Record<string, string> = {};
  data.settings.forEach((r) => {
    if (r.key) settingsMap[r.key] = r.value;
  });

  const monthTxns = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const income = monthTxns.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const spent = Math.abs(monthTxns.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
  const saved = income - spent;
  const savingsRate = income > 0 ? Math.round((saved / income) * 100) : 0;

  const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);

  const lastMonth = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthTxns = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
  });
  const lastMonthNetWorth = netWorth; // Approximation — would need historical snapshots for accuracy
  const lastMonthSpent = Math.abs(lastMonthTxns.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
  const netWorthChange = lastMonthNetWorth > 0 ? 0 : 0; // Placeholder — needs historical data

  const categoryMap = new Map(categories.map((c) => [c.name, c]));

  const spendingByCategory: CategorySpending[] = [];
  const categorySpendMap = new Map<string, number>();
  monthTxns
    .filter((t) => t.amount < 0)
    .forEach((t) => {
      const current = categorySpendMap.get(t.category) || 0;
      categorySpendMap.set(t.category, current + Math.abs(t.amount));
    });

  categorySpendMap.forEach((amount, catName) => {
    const cat = categoryMap.get(catName);
    const budget = cat?.monthly_budget || 0;
    spendingByCategory.push({
      category: catName,
      spent: Math.round(amount * 100) / 100,
      budget,
      percentage: budget > 0 ? Math.round((amount / budget) * 100) : 0,
      color: cat?.color || '#9CA3AF',
      icon: cat?.icon || 'dots-horizontal',
    });
  });

  spendingByCategory.sort((a, b) => b.spent - a.spent);

  const budgetAlerts = spendingByCategory.filter((c) => c.budget > 0 && c.percentage >= 80);

  const bufferPct = parseNum(settingsMap.emergency_buffer_pct || '10');
  const monthlyIncome = parseNum(settingsMap.monthly_income || '0');
  const fixedBills = recurring.filter((r) => r.active).reduce((sum, r) => sum + r.amount, 0);
  const buffer = Math.round(monthlyIncome * (bufferPct / 100));
  const investable = Math.max(0, monthlyIncome - fixedBills - spent + income - buffer);

  const goalProgress: GoalProgress[] = goals.map((g) => {
    const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
    const deadlineDate = new Date(g.deadline);
    const daysRemaining = Math.max(0, Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const daysSinceStart = Math.max(1, Math.ceil((now.getTime() - new Date(currentYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24)));
    const expectedPct = daysRemaining > 0 ? Math.round(((daysSinceStart) / (daysSinceStart + daysRemaining)) * 100) : 100;

    return {
      id: g.id,
      name: g.name,
      current: g.current_amount,
      target: g.target_amount,
      percentage: pct,
      daysRemaining,
      onTrack: pct >= expectedPct,
    };
  });

  const today = now.getDate();
  const upcomingBills: UpcomingBill[] = recurring
    .filter((r) => r.active)
    .map((r) => {
      let dueDay = r.due_day;
      let dueMonth = currentMonth;
      let dueYear = currentYear;

      if (dueDay < today) {
        dueMonth++;
        if (dueMonth > 11) {
          dueMonth = 0;
          dueYear++;
        }
      }

      const dueDate = new Date(dueYear, dueMonth, dueDay);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: r.id,
        name: r.name,
        amount: r.amount,
        dueDate: dueDate.toISOString().split('T')[0],
        daysUntilDue,
        category: r.category,
      };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    .slice(0, 5);

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7);

  return {
    netWorth: Math.round(netWorth * 100) / 100,
    netWorthChange,
    accountCount: accounts.length,
    income: Math.round(income * 100) / 100,
    spent: Math.round(spent * 100) / 100,
    saved: Math.round(saved * 100) / 100,
    savingsRate,
    investable: Math.round(investable * 100) / 100,
    spendingByCategory: spendingByCategory.slice(0, 5),
    budgetAlerts,
    goals: goalProgress,
    upcomingBills,
    recentTransactions,
    lastSynced: settingsMap.last_sync || null,
  };
}
