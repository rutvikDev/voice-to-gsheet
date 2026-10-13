import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1s9CqUGiXMsGFncCJJ7d002kWkCETk09rP1rkwSy2I9Y';
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Sheet1';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory session log for live UI activity feed
const sessionStories = [];

/**
 * Auto-detect and load any Service Account JSON file in the project folder
 */
function getServiceAccountCredentials() {
  // 1. Check environment variables
  const envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const envKey = process.env.GOOGLE_PRIVATE_KEY;
  if (envEmail && envKey) {
    return {
      clientEmail: envEmail,
      privateKey: envKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, ''),
      source: 'env'
    };
  }

  // 2. Scan project directory for any service account json file
  try {
    const files = fs.readdirSync(__dirname);
    for (const file of files) {
      if (file.endsWith('.json') && !file.includes('package')) {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
          if (content.type === 'service_account' && content.client_email && content.private_key) {
            return {
              clientEmail: content.client_email,
              privateKey: content.private_key,
              fileName: file,
              source: 'file'
            };
          }
        } catch (e) {
          // ignore parsing error for non-service account files
        }
      }
    }
  } catch (err) {
    console.warn('Error reading directory for service account:', err);
  }

  return null;
}

/**
 * Ensure header row exists on target Google Sheet
 */
async function ensureHeaders(sheets) {
  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:D1`
    });

    if (!existing.data.values || existing.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:D1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['Timestamp', 'Story Topic', 'Short Description', 'Language']]
        }
      });
      console.log(`[SHEETS] Headers written to ${SHEET_NAME}!A1:D1`);
    }
  } catch (err) {
    // If sheet isn't shared yet or headers already exist
    console.warn('[SHEETS] Header check note:', err.message);
  }
}

/**
 * Append row to Google Sheet via Service Account
 */
async function appendStoryToSheet(saCreds, rowData) {
  const auth = new google.auth.JWT({
    email: saCreds.clientEmail,
    key: saCreds.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Try checking headers
  await ensureHeaders(sheets);

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:D`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [rowData]
    }
  });

  return response.data;
}

/**
 * GET /api/status - Check backend status and service account status
 */
app.get('/api/status', (req, res) => {
  const sa = getServiceAccountCredentials();

  res.json({
    status: 'online',
    hasServiceAccount: Boolean(sa),
    serviceAccountEmail: sa ? sa.clientEmail : null,
    spreadsheetId: SPREADSHEET_ID,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=0`,
    totalEntriesLogged: sessionStories.length
  });
});

/**
 * GET /api/history - Return recent submissions in the session
 */
app.get('/api/history', (req, res) => {
  res.json({
    entries: sessionStories.slice(-20).reverse()
  });
});

/**
 * POST /api/submit - Receive Story Topic & Short Description and write to Google Sheet
 */
app.post('/api/submit', async (req, res) => {
  try {
    const { topic, description, text, language = 'en-US', timestamp = new Date().toISOString() } = req.body;

    const cleanTopic = (topic || '').trim();
    const cleanDesc = (description || text || '').trim();

    if (!cleanTopic && !cleanDesc) {
      return res.status(400).json({
        success: false,
        error: 'Please enter at least a Topic or a Short Description for the story.'
      });
    }

    const formattedTimestamp = new Date(timestamp).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    });

    const rowData = [formattedTimestamp, cleanTopic, cleanDesc, language];
    const sa = getServiceAccountCredentials();

    let syncedToSheet = false;
    let message = '';

    if (sa) {
      try {
        await appendStoryToSheet(sa, rowData);
        syncedToSheet = true;
        message = 'Story successfully written directly to your Google Sheet!';
      } catch (sheetError) {
        console.error('Google Sheets API Error:', sheetError);
        // If the sheet hasn't been shared with the service account yet
        if (sheetError.code === 403 || sheetError.message?.includes('permission')) {
          throw new Error(
            `Permission denied: Please open your Google Sheet, click 'Share' (top right), and add this Service Account email as Editor: ${sa.clientEmail}`
          );
        } else if (sheetError.code === 404) {
          throw new Error(`Google Sheet not found. Please verify spreadsheet ID: ${SPREADSHEET_ID}`);
        } else {
          throw sheetError;
        }
      }
    } else {
      message = 'Story logged locally. Please provide your Service Account JSON file to sync live rows directly into your Google Sheet.';
    }

    const entry = {
      id: Date.now().toString(),
      topic: cleanTopic || '(Untitled Topic)',
      description: cleanDesc,
      timestamp: formattedTimestamp,
      language,
      syncedToSheet,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=0`,
      success: true
    };

    sessionStories.push(entry);

    return res.json({
      success: true,
      message,
      syncedToSheet,
      entry
    });
  } catch (error) {
    console.error('Error submitting story to Google Sheet:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to write story to Google Sheet.'
    });
  }
});

// Fallback to index.html for SPA/root routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  const sa = getServiceAccountCredentials();
  console.log(`🚀 Voice to Google Sheet app running at http://localhost:${PORT}`);
  console.log(`📊 Target Sheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=0`);
  if (sa) {
    console.log(`🛡️ Service Account configured: ${sa.clientEmail}`);
  } else {
    console.log(`⚠️ Waiting for Service Account JSON or credentials`);
  }
});
