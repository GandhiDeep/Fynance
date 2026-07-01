/**
 * Fynance — seed the Google Sheet with realistic demo data for testing.
 *
 * Adds ~3 months of transactions, 4 accounts, 3 goals, and 5 recurring bills,
 * plus sensible settings. Refuses to run twice (looks for seeded rows) unless
 * you pass --force.
 *
 * Run from the repo root:  npm run seed --workspace=apps/api
 * Requires apps/api/.env.local with GOOGLE_CREDENTIALS + SHEET_ID
 * (run setup-sheet.js first if the tabs don't exist yet).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { google } = require('googleapis');

const ENV_PATH = path.join(__dirname, '..', '.env.local');
const FORCE = process.argv.includes('--force');

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function uuid() {
  return crypto.randomUUID();
}

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Deterministic PRNG so seeding is reproducible.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MERCHANTS = [
  ['Tim Hortons', 'Food & Dining', 4, 14, 5],
  ["McDonald's", 'Food & Dining', 10, 17, 3],
  ['Sukoshi Ramen', 'Food & Dining', 20, 38, 2],
  ['Loblaws', 'Groceries', 45, 125, 3],
  ['No Frills', 'Groceries', 28, 85, 3],
  ['Costco Wholesale', 'Groceries', 95, 190, 1],
  ['Presto Fare', 'Transport', 3.35, 3.35, 5],
  ['Uber Trip', 'Transport', 12, 32, 2],
  ['Petro-Canada', 'Transport', 44, 72, 1],
  ['Cineplex', 'Entertainment', 16, 32, 1],
  ['Amazon.ca', 'Shopping', 14, 95, 2],
  ['Shoppers Drug Mart', 'Health', 8, 36, 2],
];

const BILLS = [
  ['Rent', 1500, 1, 'Rent'],
  ['Netflix', 16.99, 5, 'Subscriptions'],
  ['Freedom Mobile', 45, 15, 'Utilities'],
  ['Spotify', 10.99, 20, 'Subscriptions'],
  ['GoodLife Fitness', 42, 28, 'Health'],
];

function buildTransactions() {
  const rand = mulberry32(42);
  const now = new Date();
  const rows = [];
  const totalWeight = MERCHANTS.reduce((s, m) => s + m[4], 0);
  const pick = () => {
    let roll = rand() * totalWeight;
    for (const m of MERCHANTS) {
      roll -= m[4];
      if (roll <= 0) return m;
    }
    return MERCHANTS[0];
  };

  for (let daysAgo = 100; daysAgo >= 0; daysAgo--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
    const date = iso(d);

    if (d.getDay() === 5 && Math.floor(daysAgo / 7) % 2 === 0) {
      rows.push([uuid(), date, 'Payroll Deposit — ACME CORP', 2450, 'Income', 'plaid', 'TD Chequing', `seed-pay-${date}`]);
    }

    for (const [name, amount, dueDay, category] of BILLS) {
      if (d.getDate() === dueDay) {
        rows.push([uuid(), date, name, -amount, category, 'plaid', 'TD Chequing', `seed-bill-${name}-${date}`]);
      }
    }

    const purchases = rand() < 0.25 ? 0 : rand() < 0.6 ? 1 : 2;
    for (let i = 0; i < purchases; i++) {
      const [name, category, min, max] = pick();
      const amount = Math.round((min + rand() * (max - min)) * 100) / 100;
      rows.push([uuid(), date, name, -amount, category, 'plaid', rand() < 0.5 ? 'Amex Cobalt' : 'TD Chequing', `seed-txn-${date}-${i}`]);
    }
  }
  return rows;
}

async function main() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error(`✗ Cannot find ${ENV_PATH}`);
    process.exit(1);
  }
  const env = loadEnv(ENV_PATH);
  const creds = JSON.parse(env.GOOGLE_CREDENTIALS || '{}');
  if (!creds.private_key || !env.SHEET_ID) {
    console.error('✗ GOOGLE_CREDENTIALS / SHEET_ID missing in .env.local');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = env.SHEET_ID;

  // Refuse to double-seed.
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'transactions!H:H' });
  const alreadySeeded = (existing.data.values || []).some((r) => (r[0] || '').startsWith('seed-'));
  if (alreadySeeded && !FORCE) {
    console.error('✗ Sheet already contains seeded rows. Pass --force to append anyway.');
    process.exit(1);
  }

  const nowIso = new Date().toISOString();

  const txnRows = buildTransactions();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'transactions',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: txnRows },
  });
  console.log(`✓ transactions: ${txnRows.length} rows`);

  const accountRows = [
    [uuid(), 'TD Chequing', 'TD Bank', 'chequing', 4230.55, 'CAD', '', nowIso],
    [uuid(), 'TD Savings', 'TD Bank', 'savings', 12800, 'CAD', '', nowIso],
    [uuid(), 'Amex Cobalt', 'American Express', 'credit', -642.18, 'CAD', '', nowIso],
    [uuid(), 'Wealthsimple TFSA', 'Wealthsimple', 'investment', 18450.32, 'CAD', '', nowIso],
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'accounts',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: accountRows },
  });
  console.log(`✓ accounts: ${accountRows.length} rows`);

  const now = new Date();
  const deadline = (months, day) => iso(new Date(now.getFullYear(), now.getMonth() + months, day));
  const goalRows = [
    [uuid(), 'Emergency Fund', 10000, 6500, deadline(8, 15), 1, 'TD Savings'],
    [uuid(), 'Japan Trip', 4000, 1250, deadline(11, 1), 2, ''],
    [uuid(), 'New Laptop', 2500, 900, deadline(5, 1), 3, ''],
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'goals',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: goalRows },
  });
  console.log(`✓ goals: ${goalRows.length} rows`);

  const billRows = BILLS.map(([name, amount, dueDay, category]) => [uuid(), name, amount, dueDay, category, 'TD Chequing', true]);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'recurring',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: billRows },
  });
  console.log(`✓ recurring: ${billRows.length} rows`);

  // Update settings in place (key/value pairs).
  const settingsRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'settings!A:B' });
  const settingsRows = settingsRes.data.values || [];
  const wanted = {
    monthly_income: '4900',
    emergency_buffer_pct: '10',
    tfsa_room: '4200',
    rrsp_room: '11000',
    fhsa_room: '8000',
  };
  const toAppend = [];
  for (const [key, value] of Object.entries(wanted)) {
    const idx = settingsRows.findIndex((r) => r[0] === key);
    if (idx >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `settings!A${idx + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[key, value]] },
      });
    } else {
      toAppend.push([key, value]);
    }
  }
  if (toAppend.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'settings',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: toAppend },
    });
  }
  console.log('✓ settings updated');

  console.log('\nDone — open the app (or hit /api/dashboard) to see demo data.');
}

main().catch((e) => {
  console.error('Seed failed:', e.message || e);
  process.exit(1);
});
