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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory session log for live UI activity feed
const sessionSubmissions = [];

/**
 * Helper to update or append variables in .env file
 */
function updateEnvFile(key, value) {
  try {
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
    process.env[key] = value;
    console.log(`[ENV] Successfully persisted ${key} to .env`);
  } catch (err) {
    console.error(`[ENV] Failed to update .env:`, err);
  }
}

/**
 * Helper to get clean private key regardless of how it was formatted
 */
function getFormattedPrivateKey() {
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!key) return null;
  return key.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '');
}

/**
 * Determine Google Sheet integration method
 */
function getIntegrationConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/auth/gmail/callback`;

  // 1. OAuth 2.0 with active refresh token and Sheet ID
  if (clientId && clientSecret && refreshToken && sheetId) {
    return {
      type: 'oauth',
      clientId,
      clientSecret,
      refreshToken,
      sheetId,
      sheetName,
      redirectUri
    };
  }

  // 2. OAuth configured with client credentials but pending user sign-in
  if (clientId && clientSecret && (!refreshToken || !sheetId)) {
    return {
      type: 'oauth_needs_auth',
      clientId,
      clientSecret,
      sheetId,
      redirectUri
    };
  }

  // 3. Service Account
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getFormattedPrivateKey();
  if (clientEmail && privateKey && sheetId) {
    return {
      type: 'service_account',
      clientEmail,
      privateKey,
      sheetId,
      sheetName
    };
  }

  // 4. Webhook
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (webhookUrl) {
    return {
      type: 'webhook',
      webhookUrl
    };
  }

  // 5. Demo fallback
  return {
    type: 'demo'
  };
}

/**
 * Helper to get OAuth2 Client
 */
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/auth/gmail/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Google Client ID and Client Secret are not configured in .env');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Append row via OAuth 2.0
 */
async function appendViaOAuth(config, rowData) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: config.refreshToken });

  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

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
 * Append row via Service Account API
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
 * Append row via Webhook
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
 * =========================================================================
 * OAuth Routes
 * =========================================================================
 */

// Step 1: Redirect user to Google Authorization consent screen
app.get('/api/auth/google', (req, res) => {
  try {
    const oauth2Client = getOAuth2Client();
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    res.status(500).send(`Failed to start Google Auth: ${error.message}`);
  }
});

// Step 2: Google redirects back to this callback (registered in Google Cloud console)
app.get('/api/auth/gmail/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect('/?auth_error=No_code_received');
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (tokens.refresh_token) {
      updateEnvFile('GOOGLE_REFRESH_TOKEN', tokens.refresh_token);
    }

    let sheetId = process.env.GOOGLE_SHEET_ID;

    // If no Google Sheet ID is set yet, automatically create one in user's Google Drive!
    if (!sheetId) {
      console.log('Creating a new Google Sheet for voice transcripts...');
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
      const createRes = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: 'Voice to Google Sheets - Voice Log'
          },
          sheets: [
            {
              properties: {
                title: 'Sheet1'
              }
            }
          ]
        }
      });

      sheetId = createRes.data.spreadsheetId;
      updateEnvFile('GOOGLE_SHEET_ID', sheetId);

      // Add header row with styled labels
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Sheet1!A1:C1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['Timestamp', 'Speech Transcript', 'Language / Notes']]
        }
      });
      console.log(`Created new Google Sheet with ID: ${sheetId}`);
    }

    res.redirect(`/?auth_success=true&sheetId=${sheetId}`);
  } catch (err) {
    console.error('OAuth Callback Error:', err);
    res.redirect(`/?auth_error=${encodeURIComponent(err.message || 'OAuth failed')}`);
  }
});

/**
 * GET /api/status - Check backend status and credentials setup
 */
app.get('/api/status', (req, res) => {
  const config = getIntegrationConfig();
  const sheetId = process.env.GOOGLE_SHEET_ID;

  res.json({
    status: 'online',
    integrationType: config.type,
    isConfigured: config.type === 'oauth' || config.type === 'service_account' || config.type === 'webhook',
    needsAuth: config.type === 'oauth_needs_auth',
    details: {
      hasClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
      hasRefreshToken: Boolean(process.env.GOOGLE_REFRESH_TOKEN),
      hasSheetId: Boolean(sheetId),
      sheetId: sheetId || null,
      sheetUrl: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null,
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

    let message = '';

    if (config.type === 'oauth') {
      await appendViaOAuth(config, rowData);
      message = 'Successfully written to your Google Sheet via Google OAuth!';
    } else if (config.type === 'service_account') {
      await appendViaServiceAccount(config, rowData);
      message = 'Successfully written directly to Google Sheet via Google Sheets API!';
    } else if (config.type === 'webhook') {
      await appendViaWebhook(config.webhookUrl, {
        timestamp: formattedTimestamp,
        text: cleanText,
        language
      });
      message = 'Successfully sent to Google Sheet via Google Apps Script Webhook!';
    } else {
      // Demo / needs auth mode
      message = config.type === 'oauth_needs_auth'
        ? 'OAuth configured! Click "Connect with Google" above to link your Google Sheet.'
        : 'Saved in Demo Mode. Connect your Google account to sync live rows.';
    }

    const entry = {
      id: Date.now().toString(),
      text: cleanText,
      timestamp: formattedTimestamp,
      language,
      mode: config.type,
      sheetUrl: process.env.GOOGLE_SHEET_ID ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit` : null,
      success: true
    };

    sessionSubmissions.push(entry);

    return res.json({
      success: true,
      message,
      mode: config.type,
      sheetUrl: entry.sheetUrl,
      entry
    });
  } catch (error) {
    console.error('Error submitting to Google Sheet:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to write entry to Google Sheet.'
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
