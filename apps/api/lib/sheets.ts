import { google, sheets_v4 } from 'googleapis';

let sheetsClient: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

function getSheetId(): string {
  return process.env.SHEET_ID || '';
}

function rowToObject<T>(headers: string[], row: string[]): T {
  const obj: Record<string, string> = {};
  headers.forEach((header, i) => {
    obj[header] = row[i] || '';
  });
  return obj as unknown as T;
}

function objectToRow(headers: string[], obj: Record<string, unknown>): string[] {
  return headers.map((h) => String(obj[h] ?? ''));
}

export async function getRows<T>(tabName: string): Promise<{ headers: string[]; rows: T[] }> {
  const client = getClient();
  const res = await client.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: tabName,
  });

  const values = res.data.values || [];
  if (values.length === 0) return { headers: [], rows: [] };

  const headers = values[0] as string[];
  const rows = values.slice(1).map((row) => rowToObject<T>(headers, row as string[]));
  return { headers, rows };
}

export async function batchGet(tabNames: string[]): Promise<Record<string, { headers: string[]; rows: Record<string, string>[] }>> {
  const client = getClient();
  const res = await client.spreadsheets.values.batchGet({
    spreadsheetId: getSheetId(),
    ranges: tabNames,
  });

  const result: Record<string, { headers: string[]; rows: Record<string, string>[] }> = {};

  (res.data.valueRanges || []).forEach((range, i) => {
    const values = range.values || [];
    const tabName = tabNames[i];

    if (values.length === 0) {
      result[tabName] = { headers: [], rows: [] };
      return;
    }

    const headers = values[0] as string[];
    const rows = values.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, j) => {
        obj[header] = (row as string[])[j] || '';
      });
      return obj;
    });

    result[tabName] = { headers, rows };
  });

  return result;
}

export async function appendRow(tabName: string, data: Record<string, unknown>): Promise<void> {
  const { headers } = await getRows(tabName);
  if (headers.length === 0) return;

  const client = getClient();
  await client.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: tabName,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [objectToRow(headers, data)],
    },
  });
}

export async function appendRows(tabName: string, dataList: Record<string, unknown>[]): Promise<void> {
  if (dataList.length === 0) return;

  const { headers } = await getRows(tabName);
  if (headers.length === 0) return;

  const client = getClient();
  await client.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: tabName,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: dataList.map((data) => objectToRow(headers, data)),
    },
  });
}

export async function findRow(tabName: string, column: string, value: string): Promise<{ rowIndex: number; data: Record<string, string> } | null> {
  const { headers, rows } = await getRows<Record<string, string>>(tabName);
  const idx = rows.findIndex((row) => row[column] === value);
  if (idx === -1) return null;
  return { rowIndex: idx + 2, data: rows[idx] }; // +2: 1-indexed + header row
}

export async function updateRow(tabName: string, rowIndex: number, data: Record<string, unknown>): Promise<void> {
  const { headers } = await getRows(tabName);
  if (headers.length === 0) return;

  const client = getClient();
  await client.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `${tabName}!A${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [objectToRow(headers, data)],
    },
  });
}

export async function deleteRow(tabName: string, rowIndex: number): Promise<void> {
  const client = getClient();
  const spreadsheet = await client.spreadsheets.get({
    spreadsheetId: getSheetId(),
  });

  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === tabName
  );
  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) return;

  await client.spreadsheets.batchUpdate({
    spreadsheetId: getSheetId(),
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // 0-indexed
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });
}

export async function getSettingsMap(): Promise<Record<string, string>> {
  const { rows } = await getRows<{ key: string; value: string }>('settings');
  const map: Record<string, string> = {};
  rows.forEach((row) => {
    if (row.key) map[row.key] = row.value;
  });
  return map;
}

export async function updateSetting(key: string, value: string): Promise<void> {
  const found = await findRow('settings', 'key', key);
  if (found) {
    await updateRow('settings', found.rowIndex, { key, value });
  } else {
    await appendRow('settings', { key, value });
  }
}
