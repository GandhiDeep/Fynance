# Testing Fynance

Three ways to test, from zero-setup to full end-to-end.

## 1. Demo mode (no backend needed)

The fastest way to test the mobile app — works offline in Expo Go.

```bash
npm run dev:mobile        # from repo root
```

Scan the QR code, then tap **Try Demo Mode** on the login screen. The whole
app runs against ~3.5 months of realistic in-memory data: dashboard, activity
filters/search, add/edit/delete transactions, the monthly Plan screen, goals,
recurring bills, category budgets, and settings all work. Mutations persist
for the session. A blue banner in the **More** tab reminds you it's demo data;
tap **Exit** to leave.

## 2. Unit tests (financial math)

The dashboard/plan computations (`apps/api/lib/compute.ts`) are pure functions
with a vitest suite covering month filtering, budgets, upcoming-bill rollover,
investable computation, and allocation suggestions:

```bash
npm run test --workspace=apps/api          # single run
npm run test:watch --workspace=apps/api    # watch mode
```

## 3. API smoke test (real backend)

Checks every endpoint against a running API and prints pass/fail + latency.
Reads `APP_SECRET` from `apps/api/.env.local`.

```bash
# against local dev server (npm run dev:api in another terminal)
npm run smoke --workspace=apps/api

# against production
npm run smoke --workspace=apps/api -- --base https://fynance-api-phi.vercel.app

# also exercise POST/PATCH/DELETE with a self-cleaning test transaction
npm run smoke --workspace=apps/api -- --write
```

## Seeding the Google Sheet with sample data

To test the real end-to-end stack (app → API → Sheet) without connecting a
bank, fill the Sheet with the same style of demo data:

```bash
npm run setup-sheet --workspace=apps/api   # one-time: creates tabs + headers
npm run seed --workspace=apps/api          # ~200 transactions, accounts, goals, bills
```

The seed script refuses to run twice (it tags rows with `seed-` ids); pass
`--force` to append anyway. Delete seeded rows by filtering the
`plaid_transaction_id` column for the `seed-` prefix in Google Sheets.

## Manual checklist

- **Login**: wrong password → "Invalid password"; unreachable API → "Cannot connect to server"; footer shows which API URL the build points at.
- **Dashboard**: pull-to-refresh triggers a sync; the Investable card opens the Plan tab; failures show a toast + retry screen.
- **Plan**: allocation total turns amber when it doesn't match investable; Lock → inputs disable; Unlock from the banner.
- **Connect Bank** (More tab): opens the `/link` page in the browser; needs `PLAID_CLIENT_ID`/`PLAID_SECRET` set on the API (use `PLAID_ENV=sandbox` and Plaid's `user_good`/`pass_good` sandbox login).
- **Cron sync**: `vercel.json` schedules `/api/sync` daily at 12:00 UTC; it accepts either `CRON_SECRET` or `APP_SECRET` as bearer token.
