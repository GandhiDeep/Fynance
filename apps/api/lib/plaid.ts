import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';

let plaidClient: PlaidApi | null = null;

function getClient(): PlaidApi {
  if (plaidClient) return plaidClient;

  const config = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
        'PLAID-SECRET': process.env.PLAID_SECRET || '',
      },
    },
  });

  plaidClient = new PlaidApi(config);
  return plaidClient;
}

export async function createLinkToken(): Promise<string> {
  const client = getClient();
  const res = await client.linkTokenCreate({
    user: { client_user_id: 'personal-user' },
    client_name: 'Fynance',
    products: [Products.Transactions],
    country_codes: [CountryCode.Ca, CountryCode.Us],
    language: 'en',
  });
  return res.data.link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<string> {
  const client = getClient();
  const res = await client.itemPublicTokenExchange({
    public_token: publicToken,
  });
  return res.data.access_token;
}

export async function getTransactions(accessToken: string, startDate: string, endDate: string) {
  const client = getClient();
  const res = await client.transactionsGet({
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
    options: { count: 500, offset: 0 },
  });
  return res.data.transactions;
}

export async function getAccounts(accessToken: string) {
  const client = getClient();
  const res = await client.accountsBalanceGet({
    access_token: accessToken,
  });
  return res.data.accounts;
}
