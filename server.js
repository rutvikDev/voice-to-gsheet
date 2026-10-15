import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1PETlMXFGuKl7-n84yRwuYbKS5xrPl79ykV9FyfzprYk';
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Sheet1';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory session log for live UI activity feed
const sessionStories = [];

// 104 Master Column schema matching the user's Google Sheet
const DEFAULT_SHEET_HEADERS = [
  'id',
  'Slug',
  'Status',
  'Image Featured',
  'Categories',
  'Service Categories',
  'Location Address',
  'Story ID',
  'Regions',
  'Top Room_Cards_Heading',
  'Top Room_Cards_Number',
  'Top Room_Cards_Suffix',
  'Top Room_Cards_Info',
  'Number Of Episodes',
  'Story Video',
  'Story Title',
  'Story sub heading',
  'Story Description',
  'Timeline timeline_date',
  'Timeline timeline_data',
  'Rennovation Progress',
  'Started Date',
  'End Date',
  'Status',
  'Location',
  'Owner Sub Heading',
  'Owner Heading',
  'Owner Description',
  'Owners Cards_card_highlight',
  'Owners Cards_owner_card_text',
  'Owners Cards_card_bottom_text',
  'Plan Sub Heading',
  'Plan Heading',
  'Plan Description',
  'Plan Cards_plan_number',
  'Plan Cards_plan_heading',
  'Plan Cards_plan_text',
  'Challange Sub Heading',
  'Challange Heading',
  'Challange Description',
  'Percent Number',
  'Percent Text',
  'Challange Cards_challenge_card_number',
  'Challange Cards_challange_card_heading',
  'Challange Cards_challange_card_sub_heading',
  'Challange Cards_challange_card_text',
  'Makeover Heading',
  'Makeover Description',
  'Before Image',
  'After Image',
  'Makeover Cards_makover_card_heading',
  'Makeover Cards_makerover_card_text',
  'Features Title',
  'Makeover Features_makeover_feature',
  'Material Sub Heading',
  'Material Heading',
  'Material Description',
  'Material Cards_material_image',
  'Material Cards_material_card_title',
  'Material Cards_material_card_description',
  'Budget Range',
  'Planning Sub Heading',
  'Planning Heading',
  'Planning Points Points_label',
  'Planning Points Points_value',
  'Planning Description',
  'Where money went subheading',
  'Where money went Heading',
  'Where money went Description',
  'Money Progress Bars_progress_title',
  'Money Progress Bars_progress_value',
  'Project band range',
  'Project band text',
  'Project band sub heading',
  'Project band percentage',
  'Project Media Sub Heading',
  'Project Media Heading',
  'Project Media Description',
  'Media First Image',
  'First Image Caption',
  'Media Second Image',
  'Second Image Caption',
  'Media Third Image',
  'Third Image Caption',
  'Project Media_project_media_image',
  'Project Media_project_media_caption',
  'Room Cards_room_card_image',
  'Room Cards_room_card_image_caption',
  'Room Cards_room_card_sub_title',
  'Room Cards_room_card_title',
  'Room Cards_room_card_description',
  'Room Cards_room_card_features',
  'Map Address',
  'Map Sub Heading',
  'Map Heading',
  'Map Description',
  'Map Points_map_point',
  'Review Heading',
  'Story Reviews_reviews_text',
  'Story Reviews_review_footer_text',
  'Story Reviews_review_initials',
  'Story Reviews_review_star_rating',
  'contact_info'
];

/**
 * Auto-detect and load any Service Account JSON file in the project folder
 */
function getServiceAccountCredentials() {
  // 1. Check for entire JSON in environment variable (easiest for Render deployment)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      if (parsed.client_email && parsed.private_key) {
        return {
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, '\n'),
          source: 'env_json'
        };
      }
    } catch (e) {
      console.warn('Could not parse GOOGLE_SERVICE_ACCOUNT_JSON:', e.message);
    }
  }

  // 2. Check individual environment variables
  const envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const envKey = process.env.GOOGLE_PRIVATE_KEY;
  if (envEmail && envKey) {
    return {
      clientEmail: envEmail,
      privateKey: envKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, ''),
      source: 'env'
    };
  }

  // 3. Scan project directory for any service account json file
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
 * Generate clean URL-safe slug from text
 */
function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Generate a rich, descriptive slug for each unique story.
 * Format: {id}-{key-words-from-all-fields}
 * Example: 8110-diane-lane-richmond-va-full-renovation-new-design-preview
 *
 * Extracts meaningful keywords from title, subheading, description, challenge,
 * plan, and makeover, ensuring each story receives a unique, descriptive slug
 * instead of just copying the story title.
 */
function generateStorySlug(sequenceId, data) {
  const title = (data.storyTitle || data.topic || data.title || '').trim();
  const subHeading = (data.storySubHeading || data.subheading || data.storySubheading || '').trim();
  const description = (data.storyDescription || data.description || data.text || '').trim();
  const challenge = (data.challengeDescription || data.challangeDescription || data.challenge || '').trim();
  const plan = (data.planDescription || data.plan || '').trim();
  const makeover = (data.makeoverDescription || data.makeover || '').trim();

  // Combine all available text sources for keyword extraction
  const allText = [title, subHeading, description, challenge, plan, makeover].filter(Boolean).join(' ');

  // Common filler words to exclude from slugs
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'it', 'its', 'this', 'that', 'was',
    'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall',
    'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'too', 'very', 'just',
    'about', 'above', 'after', 'again', 'all', 'also', 'am', 'any', 'are',
    'as', 'because', 'before', 'between', 'both', 'each', 'few', 'he', 'her',
    'here', 'him', 'his', 'how', 'i', 'into', 'me', 'more', 'my', 'our',
    'out', 'over', 'own', 'same', 'she', 'some', 'such', 'their', 'them',
    'there', 'these', 'they', 'through', 'under', 'up', 'we', 'what', 'when',
    'where', 'which', 'while', 'who', 'whom', 'why', 'you', 'your'
  ]);

  // Extract meaningful keywords: lowercase, remove non-alphanumeric, filter stop words
  const words = allText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));

  // Deduplicate while preserving order
  const seen = new Set();
  const uniqueWords = [];
  for (const word of words) {
    if (!seen.has(word)) {
      seen.add(word);
      uniqueWords.push(word);
    }
  }

  // Check if first word is already a numeric prefix (e.g., '8110' from an address)
  const hasLeadingNumber = /^\d{2,6}$/.test(uniqueWords[0] || '');

  // Calculate 4-digit unique numeric prefix (e.g. 8110 for story 10, or 8100 + seqId)
  let numericPrefix = '';
  if (!hasLeadingNumber) {
    const seq = Number(sequenceId) || 1;
    const prefixNum = seq >= 1000 ? seq : (8100 + seq);
    numericPrefix = `${prefixNum}-`;
  }

  // Take up to 10 keywords for a concise but descriptive slug
  let slugBody = uniqueWords.slice(0, 10).join('-');
  if (!slugBody) {
    slugBody = 'story-case-study';
  }

  return `${numericPrefix}${slugBody}`;
}

/**
 * Convert 1-based column number into spreadsheet letter (e.g., 1 -> 'A', 26 -> 'Z', 27 -> 'AA', 104 -> 'CZ')
 */
function getColumnLetter(colIndex1Based) {
  let temp = colIndex1Based;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter || 'A';
}

/**
 * Normalize string for fuzzy matching column names
 */
function normalizeKey(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Ensure header row exists on target Google Sheet and retrieve active headers
 */
async function ensureHeaders(sheets) {
  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!1:1`
    });

    if (!existing.data.values || existing.data.values.length === 0 || existing.data.values[0].length === 0) {
      const lastCol = getColumnLetter(DEFAULT_SHEET_HEADERS.length);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:${lastCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [DEFAULT_SHEET_HEADERS]
        }
      });
      console.log(`[SHEETS] Wrote master 104 headers to ${SHEET_NAME}!A1:${lastCol}1`);
      return DEFAULT_SHEET_HEADERS;
    }

    return existing.data.values[0];
  } catch (err) {
    console.warn('[SHEETS] Header check note:', err.message);
    return DEFAULT_SHEET_HEADERS;
  }
}

/**
 * Calculate next sequence number for column A ('id')
 */
async function getNextSequenceNumber(sheets) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`
    });
    const rows = res.data.values || [];
    if (rows.length <= 1) {
      return 1;
    }
    let maxId = 0;
    for (let i = 1; i < rows.length; i++) {
      const cell = rows[i][0];
      const parsed = parseInt(cell, 10);
      if (!isNaN(parsed) && parsed > maxId) {
        maxId = parsed;
      }
    }
    return maxId > 0 ? maxId + 1 : rows.length;
  } catch (err) {
    console.warn('[SHEETS] Sequence number calculation note:', err.message);
    return 1;
  }
}

/**
 * Map incoming submission data to the exact columns of the Google Sheet
 */
function mapSubmissionToRow(headers, data, sequenceNumber = 1) {
  const cleanStoryTitle = (data.storyTitle || data['Story Title'] || data.topic || data.title || '').trim();
  const cleanStorySubHeading = (data.storySubHeading || data['Story sub heading'] || data['Story Sub Heading'] || data.subheading || data.storySubheading || '').trim();
  const cleanStoryDescription = (data.storyDescription || data['Story Description'] || data.description || data.text || '').trim();
  const cleanChallengeDesc = (data.challengeDescription || data['Challange Description'] || data['Challenge Description'] || data.challangeDescription || data.challenge || '').trim();
  const cleanPlanDesc = (data.planDescription || data['Plan Description'] || data.plan || '').trim();
  const cleanMakeoverDesc = (data.makeoverDescription || data['Makeover Description'] || data.makeover || '').trim();
  const cleanOwnerDesc = (data.ownerDescription || data['Owner Description'] || data.ownerQuotes || data.ownerTestimonials || data.quotes || '').trim();
  const cleanOwnerQuotes = (data.ownersCardsOwnerCardText || data['Owners Cards_owner_card_text'] || data.ownerCardText || '').trim();

  // Story ID: unique string identifier saved in 'Story ID' column
  // [COMMENTED OUT] Automatic default entry disabled - only save what user speaks
  // const generatedStoryId = data.storyId || data.StoryID || data.story_id ||
  //   (typeof data.id === 'string' && data.id.startsWith('story_') ? data.id : `story_${Date.now()}`);

  // Sequenced numeric ID for column A ('id')
  // [COMMENTED OUT] Automatic default entry disabled - only save what user speaks
  // const seqId = typeof data.id === 'number'
  //   ? data.id
  //   : (!isNaN(parseInt(data.id, 10)) && !String(data.id).startsWith('story_')
  //       ? parseInt(data.id, 10)
  //       : sequenceNumber);

  // [COMMENTED OUT] Automatic default entry disabled - only save what user speaks
  // const generatedSlug = data.slug || data.Slug || generateStorySlug(seqId, data);

  // Normalized key dictionary of all incoming payload values
  const normalizedData = {};
  for (const [k, v] of Object.entries(data)) {
    // Skip internal metadata so only user-spoken field values are mapped to sheet
    if (k === 'language' || k === 'timestamp') continue;
    if (v !== undefined && v !== null && v !== '') {
      normalizedData[normalizeKey(k)] = v;
    }
  }

  const row = new Array(headers.length).fill('');
  const mappedSummary = [];

  headers.forEach((header, colIndex) => {
    const h = (header || '').trim();
    const hNorm = normalizeKey(h);

    let assignedValue = '';

    // [COMMENTED OUT] Automatic default entries - only show what user speaks in field, no automatic entry
    /*
    if (hNorm === 'id' && colIndex === 0) {
      // Column A (Col 1): Sequenced numeric ID
      assignedValue = seqId;
    } else if (hNorm === 'storyid') {
      // Column H (Col 8): Story ID
      assignedValue = generatedStoryId;
    } else if (hNorm === 'slug' && colIndex === 1) {
      assignedValue = generatedSlug;
    } else if (hNorm === 'status' && colIndex === 2) {
      assignedValue = data.status || data.Status || 'Draft';
    } else
    */
    if (hNorm === 'storytitle') {
      assignedValue = cleanStoryTitle;
    } else if (hNorm === 'storysubheading') {
      assignedValue = cleanStorySubHeading;
    } else if (hNorm === 'storydescription') {
      assignedValue = cleanStoryDescription;
    } else if (hNorm === 'challangedescription' || hNorm === 'challengedescription') {
      assignedValue = cleanChallengeDesc;
    } else if (hNorm === 'plandescription') {
      assignedValue = cleanPlanDesc;
    } else if (hNorm === 'makeoverdescription') {
      assignedValue = cleanMakeoverDesc;
    } else if (hNorm === 'ownerdescription') {
      // Primary mapping for the 7th field: Owner Description
      assignedValue = cleanOwnerDesc;
    } else if (hNorm === 'ownerscardsownercardtext') {
      // Card text mapping if explicitly provided
      assignedValue = cleanOwnerQuotes;
    } else if (normalizedData[hNorm] !== undefined) {
      // Spoken value for any column matching user inputs (including id, slug, status, storyId)
      assignedValue = String(normalizedData[hNorm]);
    }

    if (assignedValue !== '') {
      row[colIndex] = assignedValue;
      mappedSummary.push({
        column: colIndex + 1,
        letter: getColumnLetter(colIndex + 1),
        header: h,
        preview: String(assignedValue).substring(0, 40)
      });
    }
  });

  return {
    row,
    mappedSummary,
    sequenceNumber: normalizedData['id'] || '',
    generatedStoryId: normalizedData['storyid'] || '',
    generatedSlug: normalizedData['slug'] || ''
  };
}

/**
 * Append row to Google Sheet via Service Account
 */
async function appendStoryToSheet(saCreds, submissionData) {
  const auth = new google.auth.JWT({
    email: saCreds.clientEmail,
    key: saCreds.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Ensure/fetch headers from Google Sheet
  const headers = await ensureHeaders(sheets);

  // 2. Compute next sequential numeric ID for Column A ('id')
  // [COMMENTED OUT] Automatic sequence calculation disabled
  // const nextSeq = await getNextSequenceNumber(sheets);

  // 3. Map payload to the exact columns of the sheet
  const { row, mappedSummary, sequenceNumber, generatedStoryId, generatedSlug } = mapSubmissionToRow(headers, submissionData);

  // 4. Append to the full width range
  const lastColLetter = getColumnLetter(headers.length);
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:${lastColLetter}`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [row]
    }
  });

  console.log(`[SHEETS] Appended row #${sequenceNumber} (Story ID: ${generatedStoryId}) to ${response.data.updates?.updatedRange || 'sheet'}`);
  console.log(`[SHEETS] Field mappings:\n` + mappedSummary.map(m => `  • Col ${m.letter} (${m.header}): "${m.preview}"`).join('\n'));

  return {
    appendResult: response.data,
    mappedSummary,
    sequenceNumber,
    generatedStoryId,
    generatedSlug,
    totalColumns: headers.length
  };
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
 * POST /api/submit - Receive Story Fields and write to Google Sheet
 */
app.post('/api/submit', async (req, res) => {
  try {
    const {
      storyTitle,
      storySubHeading,
      storyDescription,
      challengeDescription,
      planDescription,
      makeoverDescription,
      ownerDescription,
      ownerQuotes,
      // Backwards compatibility with previous field names
      topic,
      description,
      text,
      language = 'en-IN',
      timestamp = new Date().toISOString()
    } = req.body;

    const cleanStoryTitle = (storyTitle || req.body['Story Title'] || topic || '').trim();
    const cleanStorySubHeading = (storySubHeading || req.body['Story sub heading'] || req.body['Story Sub Heading'] || '').trim();
    const cleanStoryDescription = (storyDescription || req.body['Story Description'] || description || text || '').trim();
    const cleanChallengeDesc = (challengeDescription || req.body['Challange Description'] || req.body['Challenge Description'] || '').trim();
    const cleanPlanDesc = (planDescription || req.body['Plan Description'] || '').trim();
    const cleanMakeoverDesc = (makeoverDescription || req.body['Makeover Description'] || '').trim();
    const cleanOwnerDesc = (ownerDescription || req.body['Owner Description'] || ownerQuotes || '').trim();

    // Check if ANY field in the entire payload has content (core + extended)
    const hasAnyContent = Object.entries(req.body).some(([k, v]) => {
      if (k === 'language' || k === 'timestamp') return false;
      return typeof v === 'string' && v.trim().length > 0;
    });

    if (!hasAnyContent) {
      return res.status(400).json({
        success: false,
        error: 'Please enter or speak into at least one field before saving to Google Sheets.'
      });
    }

    // Clean, readable timestamp: e.g. "14-Oct-2026 12:15 PM"
    const now = timestamp ? new Date(timestamp) : new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? String(hours).padStart(2, '0') : '12';
    const displayTimestamp = `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;

    const sa = getServiceAccountCredentials();

    let syncedToSheet = false;
    let message = '';
    let sheetResult = null;

    if (sa) {
      try {
        sheetResult = await appendStoryToSheet(sa, {
          ...req.body,
          storyTitle: cleanStoryTitle,
          storySubHeading: cleanStorySubHeading,
          storyDescription: cleanStoryDescription,
          challengeDescription: cleanChallengeDesc,
          planDescription: cleanPlanDesc,
          makeoverDescription: cleanMakeoverDesc,
          ownerDescription: cleanOwnerDesc,
          ownerQuotes: cleanOwnerDesc,
          timestamp: displayTimestamp
        });
        syncedToSheet = true;
        message = 'Story case study successfully saved into the correct Google Sheet fields!';
      } catch (sheetError) {
        console.error('Google Sheets API Error:', sheetError);
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
      // [COMMENTED OUT] Automatic fallbacks disabled - reflect user input only
      // id: sheetResult?.sequenceNumber || (sessionStories.length + 1),
      // storyId: sheetResult?.generatedStoryId || `story_${Date.now()}`,
      // slug: sheetResult?.generatedSlug || slugify(cleanStoryTitle),
      // storyTitle: cleanStoryTitle || '(Untitled Story)',
      id: sheetResult?.sequenceNumber || req.body.id || req.body['id'] || '',
      storyId: sheetResult?.generatedStoryId || req.body.storyId || req.body['Story ID'] || '',
      slug: sheetResult?.generatedSlug || req.body.slug || req.body['Slug'] || '',
      storyTitle: cleanStoryTitle || '',
      storySubHeading: cleanStorySubHeading,
      storyDescription: cleanStoryDescription,
      challengeDescription: cleanChallengeDesc,
      planDescription: cleanPlanDesc,
      makeoverDescription: cleanMakeoverDesc,
      ownerDescription: cleanOwnerDesc,
      ownerQuotes: cleanOwnerDesc,
      timestamp: displayTimestamp,
      language,
      syncedToSheet,
      mappedSummary: sheetResult?.mappedSummary || [],
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
  console.log(`🚀 Voice to Google Sheet app running at http://localhost:${PORT}`);
});
