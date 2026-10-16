import fs from 'fs';
import { google } from 'googleapis';

const creds = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));
const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = '1PETlMXFGuKl7-n84yRwuYbKS5xrPl79ykV9FyfzprYk';

async function fixExisting() {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties.title'
  });
  const sheetName = meta.data.sheets[0].properties.title;
  console.log(`Discovered active sheet tab: "${sheetName}"`);
  const escaped = sheetName.replace(/'/g, "''");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${escaped}'!A1:H8`
  });

  const rows = res.data.values;
  console.log('Total rows retrieved:', rows.length);

  // We want to update Col A (id) to 1, 2, 3, 4, 5, 6, 7 for rows 2..8
  // And for rows 5, 6, 7, 8 move their existing Col A value (story_...) into Col H (Story ID)
  const updates = [];

  for (let i = 1; i < rows.length; i++) {
    const rowNum = i + 1;
    const currentA = rows[i][0] || '';
    const currentH = rows[i][7] || '';
    const seqNum = i;

    // Check if currentA was a story_ ID
    let newH = currentH;
    if (currentA.startsWith('story_') && !currentH) {
      newH = currentA;
    }

    updates.push({
      range: `'${escaped}'!A${rowNum}`,
      values: [[seqNum]]
    });

    if (newH !== currentH) {
      updates.push({
        range: `'${escaped}'!H${rowNum}`,
        values: [[newH]]
      });
    }
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates
    }
  });

  console.log('Successfully updated existing rows 2..8 with sequenced numbers and Story IDs!');
}

fixExisting().catch(console.error);
