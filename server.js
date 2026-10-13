import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory session log for live UI activity feed
const sessionSubmissions = [];

/**
 * Helper to get clean private key regardless of how it was formatted in .env or Render
 */
function getFormattedPrivateKey() {
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!key) return null;
  // If user pasted with literal \n strings or wrapped in quotes
  return key.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '');
}

/**
 * Determine Google Sheet integration method
 */
function getIntegrationConfig() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getFormattedPrivateKey();
  const sheetId = process.env.GOOGLE_SHEET_ID || process.env.SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;

  if (clientEmail && privateKey && sheetId) {
    return {
      type: 'service_account',
      clientEmail,
      privateKey,
      sheetId,
      sheetName
    };
  }

  if (webhookUrl) {
    return {
      type: 'webhook',
      webhookUrl
    };
  }

  return {
    type: 'demo'
  };
}

/**
 * Append row to Google Sheets via Service Account API
 */
async function appendViaServiceAccount(config, rowData) {
  const auth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: config.sheetId,
    range: `${config.sheetName}!A:C`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [rowData]
    }
  });

  return response.data;
}

/**
 * Append row to Google Sheets via Apps Script Webhook
 */
async function appendViaWebhook(webhookUrl, data) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Apps Script responded with ${response.status}: ${errorText}`);
  }

  return await response.json().catch(() => ({ status: 'success' }));
}

/**
 * GET /api/status - Check backend status and credentials setup
 */
app.get('/api/status', (req, res) => {
  const config = getIntegrationConfig();
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const sheetId = process.env.GOOGLE_SHEET_ID || process.env.SPREADSHEET_ID;

  res.json({
    status: 'online',
    integrationType: config.type,
    isConfigured: config.type !== 'demo',
    details: {
      hasClientEmail: Boolean(clientEmail),
      hasPrivateKey: Boolean(process.env.GOOGLE_PRIVATE_KEY),
      hasSheetId: Boolean(sheetId),
      hasWebhookUrl: Boolean(process.env.GOOGLE_SHEET_WEBHOOK_URL),
      clientEmail: clientEmail ? `${clientEmail.substring(0, 4)}...${clientEmail.slice(-15)}` : null,
      sheetId: sheetId ? `${sheetId.substring(0, 6)}...${sheetId.slice(-6)}` : null,
      sheetName: process.env.GOOGLE_SHEET_NAME || 'Sheet1'
    },
    totalEntriesLogged: sessionSubmissions.length
  });
});

/**
 * GET /api/history - Return recent submissions in the session
 */
app.get('/api/history', (req, res) => {
  res.json({
    entries: sessionSubmissions.slice(-20).reverse()
  });
});

/**
 * POST /api/submit - Receive speech text and write to Google Sheet
 */
app.post('/api/submit', async (req, res) => {
  try {
    const { text, language = 'en-US', timestamp = new Date().toISOString() } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Text content is required and cannot be empty.'
      });
    }

    const cleanText = text.trim();
    const formattedTimestamp = new Date(timestamp).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    });

    const rowData = [formattedTimestamp, cleanText, language];
    const config = getIntegrationConfig();

    let syncResult = null;
    let message = '';

    if (config.type === 'service_account') {
      syncResult = await appendViaServiceAccount(config, rowData);
      message = 'Successfully written directly to Google Sheet via Google Sheets API!';
    } else if (config.type === 'webhook') {
      syncResult = await appendViaWebhook(config.webhookUrl, {
        timestamp: formattedTimestamp,
        text: cleanText,
        language
      });
      message = 'Successfully sent to Google Sheet via Google Apps Script Webhook!';
    } else {
      // Demo / preview mode
      message = 'Saved in Demo Mode. To connect directly to your Google Sheet, add Google Service Account credentials or Google Apps Script Webhook URL in your .env or Render dashboard.';
    }

    const entry = {
      id: Date.now().toString(),
      text: cleanText,
      timestamp: formattedTimestamp,
      language,
      mode: config.type,
      success: true
    };

    sessionSubmissions.push(entry);

    return res.json({
      success: true,
      message,
      mode: config.type,
      entry
    });
  } catch (error) {
    console.error('Error submitting to Google Sheet:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to write entry to Google Sheet.',
      hint: 'Make sure your Google Service Account has Editor access to the spreadsheet and the Google Sheets API is enabled.'
    });
  }
});

// Fallback to index.html for SPA/root routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Voice to Google Sheet app running at http://localhost:${PORT}`);
  console.log(`📡 Integration mode: ${getIntegrationConfig().type.toUpperCase()}`);
});
