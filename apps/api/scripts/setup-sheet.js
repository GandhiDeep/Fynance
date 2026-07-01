/**
 * Fynance — one-time Google Sheet setup.
 *
 * Builds the 7 tabs the API expects, writes their header rows, and seeds the
 * default categories + settings. Idempotent: safe to run more than once — it
 * only adds tabs/headers that are missing and never overwrites existing data.
 *
 * Reads GOOGLE_CREDENTIALS + SHEET_ID from apps/api/.env.local.
 * Run from the repo root:  node apps/api/scripts/setup-sheet.js
 */
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const ENV_PATH = path.join(__dirname, '..', '.env.local');

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

// Header row for each tab — order matches the columns the code reads/writes.
const SCHEMA = {
  transactions: ['id', 'date', 'description', 'amount', 'category', 'source', 'account', 'plaid_transaction_id'],
  accounts: ['id', 'name', 'institution', 'type', 'balance', 'currency', 'plaid_account_id', 'updated_at'],
  categories: ['name', 'type', 'monthly_budget', 'color', 'icon'],
  goals: ['id', 'name', 'target_amount', 'current_amount', 'deadline', 'priority', 'linked_account'],
  recurring: ['id', 'name', 'amount', 'due_day', 'category', 'account', 'active'],
  settings: ['key', 'value'],
  monthly_plans: ['month', 'income', 'fixed_bills', 'variable_spending', 'buffer', 'investable', 'allocation', 'locked'],
};

// Seed rows (mirror packages/shared/constants.ts DEFAULT_CATEGORIES).
const SEED = {
  categories: [
    ['Food & Dining', 'discretionary', 450, '#F97316', 'silverware-fork-knife'],
    ['Groceries', 'essential', 400, '#22C55E', 'cart'],
    ['Transport', 'essential', 200, '#3B82F6', 'car'],
    ['Rent', 'essential', 0, '#8B5CF6', 'home'],
    ['Utilities', 'essential', 150, '#06B6D4', 'lightning-bolt'],
    ['Entertainment', 'discretionary', 200, '#EC4899', 'movie-open'],
    ['Subscriptions', 'discretionary', 100, '#A855F7', 'refresh'],
    ['Shopping', 'discretionary', 300, '#F59E0B', 'shopping'],
    ['Health', 'essential', 100, '#EF4444', 'heart-pulse'],
    ['Income', 'income', 0, '#10B981', 'cash-plus'],
    ['Transfer', 'savings', 0, '#6B7280', 'bank-transfer'],
    ['Splitwise', 'discretionary', 0, '#14B8A6', 'account-group'],
    ['Other', 'discretionary', 0, '#9CA3AF', 'dots-horizontal'],
  ],
  settings: [
    ['monthly_income', '0'],
    ['emergency_buffer_pct', '10'],
  ],
};

async function main() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error(`✗ Cannot find ${ENV_PATH}`);
    process.exit(1);
  }
  const env = loadEnv(ENV_PATH);

  let creds;
  try {
    creds = JSON.parse(env.GOOGLE_CREDENTIALS || '{}');
  } catch (e) {
    console.error('✗ GOOGLE_CREDENTIALS is not valid JSON:', e.message);
    process.exit(1);
  }
  if (!creds.private_key || creds.private_key.length < 100) {
    console.error('✗ GOOGLE_CREDENTIALS looks like a placeholder (no real private_key).');
    console.error('  Paste your real service-account JSON into apps/api/.env.local first.');
    process.exit(1);
  }
  if (!env.SHEET_ID) {
    console.error('✗ SHEET_ID is missing in .env.local');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = env.SHEET_ID;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabs = (meta.data.sheets || []).map((s) => s.properties.title);
  console.log('Existing tabs:', existingTabs.join(', ') || '(none)');

  const wanted = Object.keys(SCHEMA);

  // Create any missing tabs. Reuse a leftover default "Sheet1" once instead of
  // leaving an empty stray tab behind.
  const requests = [];
  let reusedDefault = false;
  for (const tab of wanted) {
    if (existingTabs.includes(tab)) continue;
    const leftover = meta.data.sheets.find((s) => s.properties.title === 'Sheet1');
    if (!reusedDefault && leftover && !wanted.includes('Sheet1')) {
      requests.push({
        updateSheetProperties: { properties: { sheetId: leftover.properties.sheetId, title: tab }, fields: 'title' },
      });
      reusedDefault = true;
    } else {
      requests.push({ addSheet: { properties: { title: tab } } });
    }
  }
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    console.log(`Created ${requests.length} missing tab(s).`);
  }

  // Write headers (+ seed rows) for any tab that is still empty.
  for (const [tab, headers] of Object.entries(SCHEMA)) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A1:1` });
    const hasHeader = res.data.values && res.data.values[0] && res.data.values[0].length > 0;
    if (hasHeader) {
      console.log(`• ${tab}: already has a header row — left untouched`);
      continue;
    }
    const values = [headers, ...(SEED[tab] || [])];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
    const seeded = (SEED[tab] || []).length;
    console.log(`✓ ${tab}: headers written${seeded ? ` + ${seeded} seed row(s)` : ''}`);
  }

  console.log('\nDone — your Google Sheet is ready for the API.');
}

main().catch((e) => {
  console.error('Setup failed:', e.message || e);
  process.exit(1);
});
