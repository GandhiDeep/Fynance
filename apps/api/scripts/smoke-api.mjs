/**
 * Fynance — API smoke test. Hits every endpoint and prints pass/fail.
 *
 *   npm run smoke --workspace=apps/api                       # local dev server
 *   npm run smoke --workspace=apps/api -- --base https://fynance-api-phi.vercel.app
 *   npm run smoke --workspace=apps/api -- --write            # also POST/PATCH/DELETE a test transaction
 *
 * Reads APP_SECRET from apps/api/.env.local.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', '.env.local');

const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const BASE = baseIdx >= 0 ? args[baseIdx + 1].replace(/\/$/, '') : 'http://localhost:3000';
const WRITE = args.includes('--write');

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv(ENV_PATH);
const SECRET = process.env.APP_SECRET || env.APP_SECRET;
if (!SECRET) {
  console.error('✗ APP_SECRET not found in apps/api/.env.local or environment');
  process.exit(1);
}

const results = [];

async function check(name, method, url, { body, headers, expectStatus = 200, validate } = {}) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        Authorization: `Bearer ${SECRET}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const ms = Date.now() - start;
    let ok = res.status === expectStatus;
    let detail = `${res.status}`;
    let data = null;
    try {
      data = await res.json();
    } catch {}
    if (ok && validate && data) {
      const problem = validate(data);
      if (problem) {
        ok = false;
        detail += ` — ${problem}`;
      }
    }
    results.push({ name, ok, ms, detail });
    return data;
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - start, detail: e.message });
    return null;
  }
}

const now = new Date();
const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

console.log(`Smoke testing ${BASE}\n`);

// Auth must be enforced
await check('auth rejected without token', 'GET', '/api/dashboard', {
  headers: { Authorization: 'Bearer wrong-token' },
  expectStatus: 401,
});

// Read endpoints
await check('GET /api/dashboard', 'GET', '/api/dashboard', {
  validate: (d) => (typeof d.netWorth !== 'number' ? 'missing netWorth' : null),
});
await check('GET /api/transactions', 'GET', `/api/transactions?month=${now.getMonth() + 1}&year=${now.getFullYear()}&limit=5`, {
  validate: (d) => (!Array.isArray(d.transactions) ? 'missing transactions[]' : null),
});
await check('GET /api/accounts', 'GET', '/api/accounts', {
  validate: (d) => (!Array.isArray(d.accounts) ? 'missing accounts[]' : null),
});
await check('GET /api/goals', 'GET', '/api/goals', {
  validate: (d) => (!Array.isArray(d.goals) ? 'missing goals[]' : null),
});
await check('GET /api/recurring', 'GET', '/api/recurring', {
  validate: (d) => (!Array.isArray(d.bills) ? 'missing bills[]' : null),
});
await check('GET /api/categories', 'GET', '/api/categories', {
  validate: (d) => (!Array.isArray(d.categories) ? 'missing categories[]' : null),
});
await check('GET /api/settings', 'GET', '/api/settings', {
  validate: (d) => (typeof d.monthly_income !== 'number' ? 'missing monthly_income' : null),
});
await check(`GET /api/plan/${monthKey}`, 'GET', `/api/plan/${monthKey}`, {
  validate: (d) => (typeof d.investable !== 'number' ? 'missing investable' : null),
});
await check('GET /api/plan rejects bad month', 'GET', '/api/plan/not-a-month', { expectStatus: 400 });

// Write round-trip (opt-in)
if (WRITE) {
  const created = await check('POST /api/transactions', 'POST', '/api/transactions', {
    body: {
      date: `${monthKey}-15`,
      description: 'SMOKE TEST — safe to delete',
      amount: -1.23,
      category: 'Other',
      account: '',
    },
    expectStatus: 201,
    validate: (d) => (!d.id ? 'missing id' : null),
  });

  if (created?.id) {
    await check('PATCH /api/transactions', 'PATCH', '/api/transactions', {
      body: { id: created.id, category: 'Shopping' },
    });
    await check('DELETE /api/transactions', 'DELETE', `/api/transactions?id=${created.id}`);
  }
} else {
  console.log('(read-only — pass --write to test POST/PATCH/DELETE round-trip)\n');
}

// Report
let failed = 0;
for (const r of results) {
  const icon = r.ok ? '✓' : '✗';
  console.log(`${icon} ${r.name.padEnd(38)} ${String(r.ms).padStart(5)}ms  ${r.ok ? '' : r.detail}`);
  if (!r.ok) failed++;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed > 0 ? 1 : 0);
