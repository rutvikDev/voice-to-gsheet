/**
 * SpeakStory - Client Application
 * Features:
 * - All 93 fields in one continuous, uncategorized legal pad flow (exact Google Sheet sequence 1 to 93)
 * - 100% reliable Native Speech Recognition Engine (ZERO getUserMedia mic hardware locks)
 * - True character-by-character live speech transcription (interim + final streaming)
 * - Click or focus on any field to speak or write
 * - Eraser clear button with instant mic re-arming
 * - Fast in-place field search / jump filter across all 93 fields
 * - Google Cloud Service Account direct sync to Google Sheets
 * - Web Audio harmonic feedback chimes
 */

// Dialect configuration (Defaults to en-IN for Indian English accuracy)
let selectedDialect = 'en-IN';

// ═══════════════════════════════════════════════════════════════════════════════
// MASTER 93 FIELDS CONFIGURATION (Exact Google Sheet sequence 1 to 93)
// Non-media columns matching the user's prompt exactly
// ═══════════════════════════════════════════════════════════════════════════════

const FIELDS_CONFIG = [
  { key: 'id', label: 'id', type: 'text', placeholder: 'e.g. 1 or custom sequential ID' },
  { key: 'slug', label: 'Slug', type: 'text', placeholder: 'e.g. highland-victorian-revival' },
  { key: 'status', label: 'Status', type: 'text', placeholder: 'e.g. Draft, Published, Review' },
  { key: 'categories', label: 'Categories', type: 'text', placeholder: 'e.g. Kitchen, Living Room, Full Home' },
  { key: 'serviceCategories', label: 'Service Categories', type: 'text', placeholder: 'e.g. Renovation, Architecture' },
  { key: 'locationAddress', label: 'Location Address', type: 'text', placeholder: 'e.g. 123 Oak Street, Richmond VA' },
  { key: 'storyId', label: 'Story ID', type: 'text', placeholder: 'Auto-generated or custom story ID' },
  { key: 'regions', label: 'Regions', type: 'text', placeholder: 'e.g. Northeast, West Coast' },
  { key: 'topRoomCardsHeading', label: 'Top Room_Cards_Heading', type: 'text', placeholder: 'e.g. Kitchen Transformation' },
  { key: 'topRoomCardsNumber', label: 'Top Room_Cards_Number', type: 'text', placeholder: 'e.g. 01' },
  { key: 'topRoomCardsSuffix', label: 'Top Room_Cards_Suffix', type: 'text', placeholder: 'e.g. rooms renovated' },
  { key: 'topRoomCardsInfo', label: 'Top Room_Cards_Info', type: 'text', placeholder: 'e.g. Complete remodel with custom cabinetry' },
  { key: 'numberOfEpisodes', label: 'Number Of Episodes', type: 'text', placeholder: 'e.g. 6' },
  { key: 'storyTitle', label: 'Story Title', type: 'text', placeholder: 'e.g. The Highland Victorian Revival' },
  { key: 'storySubHeading', label: 'Story sub heading', type: 'text', placeholder: 'e.g. From cramped vintage kitchen to sunlit oasis' },
  { key: 'storyDescription', label: 'Story Description', type: 'textarea', placeholder: 'Speak or write the background narrative... Built in 1928, this historic home...' },
  { key: 'timelineDate', label: 'Timeline timeline_date', type: 'text', placeholder: 'e.g. Jan 2024 - Aug 2024' },
  { key: 'timelineData', label: 'Timeline timeline_data', type: 'textarea', placeholder: 'Speak or write milestone dates and phase descriptions...' },
  { key: 'rennovationProgress', label: 'Rennovation Progress', type: 'text', placeholder: 'e.g. 75%' },
  { key: 'startedDate', label: 'Started Date', type: 'text', placeholder: 'e.g. Jan 15, 2024' },
  { key: 'endDate', label: 'End Date', type: 'text', placeholder: 'e.g. Aug 30, 2024' },
  { key: 'statusTimeline', label: 'Status', type: 'text', placeholder: 'e.g. In Progress, Completed' },
  { key: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Richmond, VA' },
  { key: 'ownerSubHeading', label: 'Owner Sub Heading', type: 'text', placeholder: 'e.g. Meet the Homeowners' },
  { key: 'ownerHeading', label: 'Owner Heading', type: 'text', placeholder: 'e.g. The Johnson Family' },
  { key: 'ownerDescription', label: 'Owner Description', type: 'textarea', placeholder: 'Speak or write homeowner story, background, and quotes...' },
  { key: 'ownersCardsCardHighlight', label: 'Owners Cards_card_highlight', type: 'text', placeholder: 'e.g. First-time renovators' },
  { key: 'ownersCardsOwnerCardText', label: 'Owners Cards_owner_card_text', type: 'textarea', placeholder: 'Owner card narrative text...' },
  { key: 'ownersCardsCardBottomText', label: 'Owners Cards_card_bottom_text', type: 'text', placeholder: 'e.g. 15 years in the home' },
  { key: 'planSubHeading', label: 'Plan Sub Heading', type: 'text', placeholder: 'e.g. The Design Strategy' },
  { key: 'planHeading', label: 'Plan Heading', type: 'text', placeholder: 'e.g. Modern Open-Concept Vision' },
  { key: 'planDescription', label: 'Plan Description', type: 'textarea', placeholder: 'Speak or write the design solutions... Open the sightlines with recessed steel beams...' },
  { key: 'planCardsPlanNumber', label: 'Plan Cards_plan_number', type: 'text', placeholder: 'e.g. 01' },
  { key: 'planCardsPlanHeading', label: 'Plan Cards_plan_heading', type: 'text', placeholder: 'e.g. Structural Redesign' },
  { key: 'planCardsPlanText', label: 'Plan Cards_plan_text', type: 'textarea', placeholder: 'Plan card description and strategy notes...' },
  { key: 'challangeSubHeading', label: 'Challange Sub Heading', type: 'text', placeholder: 'e.g. Key Obstacles' },
  { key: 'challangeHeading', label: 'Challange Heading', type: 'text', placeholder: 'e.g. Structural & Design Challenges' },
  { key: 'challengeDescription', label: 'Challange Description', type: 'textarea', placeholder: 'Speak the challenges... Cramped galley layout, load-bearing walls blocking natural daylight...' },
  { key: 'percentNumber', label: 'Percent Number', type: 'text', placeholder: 'e.g. 85' },
  { key: 'percentText', label: 'Percent Text', type: 'text', placeholder: 'e.g. of budget allocated to structural work' },
  { key: 'challangeCardsChallengeCardNumber', label: 'Challange Cards_challenge_card_number', type: 'text', placeholder: 'e.g. 01' },
  { key: 'challangeCardsCardHeading', label: 'Challange Cards_challange_card_heading', type: 'text', placeholder: 'e.g. Load-Bearing Walls' },
  { key: 'challangeCardsCardSubHeading', label: 'Challange Cards_challange_card_sub_heading', type: 'text', placeholder: 'e.g. Engineering Required' },
  { key: 'challangeCardsCardText', label: 'Challange Cards_challange_card_text', type: 'textarea', placeholder: 'Challenge card narrative description...' },
  { key: 'makeoverHeading', label: 'Makeover Heading', type: 'text', placeholder: 'e.g. Before & After Reveal' },
  { key: 'makeoverDescription', label: 'Makeover Description', type: 'textarea', placeholder: 'Speak the finished result... A sunlit open floorplan with bespoke fluted millwork...' },
  { key: 'makeoverCardsMakoverCardHeading', label: 'Makeover Cards_makover_card_heading', type: 'text', placeholder: 'e.g. Kitchen Island' },
  { key: 'makeoverCardsMakeoverCardText', label: 'Makeover Cards_makerover_card_text', type: 'textarea', placeholder: 'Makeover card description...' },
  { key: 'featuresTitle', label: 'Features Title', type: 'text', placeholder: 'e.g. Bespoke Millwork & Stone' },
  { key: 'makeoverFeaturesMakeoverFeature', label: 'Makeover Features_makeover_feature', type: 'textarea', placeholder: 'Transformation feature details...' },
  { key: 'materialSubHeading', label: 'Material Sub Heading', type: 'text', placeholder: 'e.g. Quality Craftsmanship' },
  { key: 'materialHeading', label: 'Material Heading', type: 'text', placeholder: 'e.g. Curated Material Selection' },
  { key: 'materialDescription', label: 'Material Description', type: 'textarea', placeholder: 'Speak or write material specifications...' },
  { key: 'materialCardsCardTitle', label: 'Material Cards_material_card_title', type: 'text', placeholder: 'e.g. Calacatta Gold Marble' },
  { key: 'materialCardsCardDescription', label: 'Material Cards_material_card_description', type: 'textarea', placeholder: 'Material details and supplier notes...' },
  { key: 'budgetRange', label: 'Budget Range', type: 'text', placeholder: 'e.g. $75,000 - $100,000' },
  { key: 'planningSubHeading', label: 'Planning Sub Heading', type: 'text', placeholder: 'e.g. Cost Breakdown' },
  { key: 'planningHeading', label: 'Planning Heading', type: 'text', placeholder: 'e.g. Smart Renovation Planning' },
  { key: 'planningPointsLabel', label: 'Planning Points Points_label', type: 'text', placeholder: 'e.g. Architecture, Labor, Materials' },
  { key: 'planningPointsValue', label: 'Planning Points Points_value', type: 'text', placeholder: 'e.g. 20%, 45%, 35%' },
  { key: 'planningDescription', label: 'Planning Description', type: 'textarea', placeholder: 'Planning overview and financial breakdown notes...' },
  { key: 'whereMoneyWentSubheading', label: 'Where money went subheading', type: 'text', placeholder: 'e.g. Financial Allocation' },
  { key: 'whereMoneyWentHeading', label: 'Where money went Heading', type: 'text', placeholder: 'e.g. Budget Distribution' },
  { key: 'whereMoneyWentDescription', label: 'Where money went Description', type: 'textarea', placeholder: 'Details on where the budget was spent...' },
  { key: 'moneyProgressBarsTitle', label: 'Money Progress Bars_progress_title', type: 'text', placeholder: 'e.g. Cabinetry, Flooring, Plumbing' },
  { key: 'moneyProgressBarsValue', label: 'Money Progress Bars_progress_value', type: 'text', placeholder: 'e.g. 35, 25, 20' },
  { key: 'projectBandRange', label: 'Project band range', type: 'text', placeholder: 'e.g. Mid-to-High Range' },
  { key: 'projectBandText', label: 'Project band text', type: 'text', placeholder: 'e.g. Premium Architectural Renovation' },
  { key: 'projectBandSubHeading', label: 'Project band sub heading', type: 'text', placeholder: 'e.g. Value-focused investment' },
  { key: 'projectBandPercentage', label: 'Project band percentage', type: 'text', placeholder: 'e.g. 92%' },
  { key: 'projectMediaSubHeading', label: 'Project Media Sub Heading', type: 'text', placeholder: 'e.g. Visual Gallery' },
  { key: 'projectMediaHeading', label: 'Project Media Heading', type: 'text', placeholder: 'e.g. Project Documentation' },
  { key: 'projectMediaDescription', label: 'Project Media Description', type: 'textarea', placeholder: 'Media gallery overview description...' },
  { key: 'firstImageCaption', label: 'First Image Caption', type: 'text', placeholder: 'e.g. Front façade after restoration' },
  { key: 'secondImageCaption', label: 'Second Image Caption', type: 'text', placeholder: 'e.g. Open-plan kitchen and dining area' },
  { key: 'thirdImageCaption', label: 'Third Image Caption', type: 'text', placeholder: 'e.g. Custom walnut millwork detail' },
  { key: 'projectMediaCaption', label: 'Project Media_project_media_caption', type: 'text', placeholder: 'e.g. Architectural overview photograph' },
  { key: 'roomCardsImageCaption', label: 'Room Cards_room_card_image_caption', type: 'text', placeholder: 'e.g. Master suite bay window view' },
  { key: 'roomCardsSubTitle', label: 'Room Cards_room_card_sub_title', type: 'text', placeholder: 'e.g. Primary Suite' },
  { key: 'roomCardsTitle', label: 'Room Cards_room_card_title', type: 'text', placeholder: 'e.g. Master Bedroom & Bath' },
  { key: 'roomCardsDescription', label: 'Room Cards_room_card_description', type: 'textarea', placeholder: 'Room card narrative description...' },
  { key: 'roomCardsFeatures', label: 'Room Cards_room_card_features', type: 'textarea', placeholder: 'e.g. Custom closet, radiant heated floors, soak tub' },
  { key: 'mapAddress', label: 'Map Address', type: 'text', placeholder: 'e.g. 452 Elmwood Terrace, Richmond, VA' },
  { key: 'mapSubHeading', label: 'Map Sub Heading', type: 'text', placeholder: 'e.g. Project Location' },
  { key: 'mapHeading', label: 'Map Heading', type: 'text', placeholder: 'e.g. Neighborhood Context' },
  { key: 'mapDescription', label: 'Map Description', type: 'textarea', placeholder: 'Location and neighborhood notes...' },
  { key: 'mapPointsMapPoint', label: 'Map Points_map_point', type: 'text', placeholder: 'e.g. Walking distance to Carytown & parks' },
  { key: 'reviewHeading', label: 'Review Heading', type: 'text', placeholder: 'e.g. Client Feedback' },
  { key: 'storyReviewsText', label: 'Story Reviews_reviews_text', type: 'textarea', placeholder: 'Speak or write client review testimonial...' },
  { key: 'storyReviewsFooterText', label: 'Story Reviews_review_footer_text', type: 'text', placeholder: 'e.g. Verified Homeowner, Richmond VA' },
  { key: 'storyReviewsInitials', label: 'Story Reviews_review_initials', type: 'text', placeholder: 'e.g. M.J.' },
  { key: 'storyReviewsStarRating', label: 'Story Reviews_review_star_rating', type: 'text', placeholder: 'e.g. 5' },
  { key: 'contactInfo', label: 'contact_info', type: 'textarea', placeholder: 'Contact information, phone, email, inquiries...' }
];

// Mapping from JS field key to exact Google Sheet column header
const FIELD_TO_HEADER_MAP = {};
FIELDS_CONFIG.forEach((f) => {
  FIELD_TO_HEADER_MAP[f.key] = f.label;
});

// Central Registry of all 93 fields and their DOM elements
const FIELDS = {};

/**
 * Dynamically build all 93 fields into #allFieldsContainer in one continuous flow
 */
function buildAllFields() {
  const container = document.getElementById('allFieldsContainer');
  if (!container) return;

  container.innerHTML = '';

  FIELDS_CONFIG.forEach((fieldDef, index) => {
    const fieldNum = index + 1;
    const fieldKey = fieldDef.key;
    const isMultiLine = fieldDef.type === 'textarea';

    const inputId = `${fieldKey}Input`;
    const wrapperId = `${fieldKey}Wrapper`;
    const clearBtnId = `clear${fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)}Btn`;
    const micBadgeId = `micBadge_${fieldKey}`;

    const row = document.createElement('section');
    row.className = 'notepad-row';
    row.dataset.fieldIndex = fieldNum;
    row.dataset.fieldKey = fieldKey;
    row.dataset.fieldLabel = fieldDef.label.toLowerCase();

    row.innerHTML = `
      <div class="row-header">
        <label for="${inputId}" class="ruled-label">
          <span class="handwritten-number">${fieldNum}.</span>
          <span class="label-heading">${fieldDef.label}</span>
        </label>
        <div class="corner-mic-badge" id="${micBadgeId}" title="Recording active on ${fieldDef.label}">
          <span class="live-dot"></span>
          <span class="rec-label">Recording</span>
        </div>
      </div>

      <div class="paper-input-container ${isMultiLine ? 'field-multi-line' : 'field-single-line'}" id="${wrapperId}">
        ${isMultiLine ? `
          <textarea id="${inputId}" class="paper-ruled-textarea"
            placeholder="${fieldDef.placeholder}" rows="3" spellcheck="true"></textarea>
        ` : `
          <input type="text" id="${inputId}" class="paper-text-input"
            placeholder="${fieldDef.placeholder}" autocomplete="off" spellcheck="true" />
        `}
        <div class="input-actions-right ${isMultiLine ? 'desc-actions' : ''}">
          <button type="button" id="${clearBtnId}" class="paper-action-btn clear-btn hidden"
            title="Erase ${fieldDef.label}" aria-label="Clear ${fieldDef.label}">
            <svg class="eraser-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    `;

    container.appendChild(row);

    // Register in central FIELDS dictionary
    FIELDS[fieldKey] = {
      id: fieldKey,
      index: fieldNum,
      name: fieldDef.label,
      isMultiLine: isMultiLine,
      rowEl: row,
      input: row.querySelector(`#${inputId}`),
      wrapper: row.querySelector(`#${wrapperId}`),
      clearBtn: row.querySelector(`#${clearBtnId}`),
      micBadge: row.querySelector(`#${micBadgeId}`)
    };
  });

  // Backward-compatibility aliases for legacy core fields
  FIELDS.ownerQuotes = FIELDS.ownerDescription;
}

// Build all fields immediately
buildAllFields();

// UI Controls & Indicators
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const btnSpinner = document.getElementById('btnSpinner');

const fieldSearchInput = document.getElementById('fieldSearchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const visibleFieldCount = document.getElementById('visibleFieldCount');

const toastMessage = document.getElementById('toastMessage');
const toastTitle = document.getElementById('toastTitle');
const toastSubtitle = document.getElementById('toastSubtitle');
const toastCloseBtn = document.getElementById('toastCloseBtn');

// Speech Recognition Engine State
let recognition = null;
let activeRecordingField = null; // Key of active field or null
let isUserIntentRecording = false;
let restartTimeout = null;
let baseTextAtSessionStart = '';
let hasSpokenInSession = false;

// Device Detection
const isMobileDevice = (() => {
  const ua = navigator.userAgent || navigator.vendor || window.opera || '';
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|Silk/i;
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
  return mobileRegex.test(ua) || (isTouch && window.innerWidth <= 1024);
})();

/**
 * Clean immediate duplicated words/phrases generated by mobile speech engines
 */
function cleanDuplicateWords(text) {
  if (!text) return '';
  let cleaned = text.replace(/\b(\w+)(?:[,\s]+\1\b)+/gi, '$1');
  cleaned = cleaned.replace(/\b(\w+\s+\w+)(?:[,\s]+\1\b)+/gi, '$1');
  return cleaned;
}

/**
 * Seam Stitcher: Stitches existing base text with newly spoken text without boundary duplication
 */
function appendSpokenText(baseText, spokenText) {
  if (!baseText) return spokenText;
  if (!spokenText) return baseText;

  const baseTrimmed = baseText.trim();
  const spokenTrimmed = spokenText.trim();

  if (baseTrimmed.toLowerCase().endsWith(spokenTrimmed.toLowerCase())) {
    return baseTrimmed;
  }

  const baseWords = baseTrimmed.split(/\s+/);
  const spokenWords = spokenTrimmed.split(/\s+/);
  const cleanWord = (w) => w.replace(/[^\w]/g, '').toLowerCase();

  const maxOverlap = Math.min(3, baseWords.length, spokenWords.length);
  let overlapCount = 0;

  for (let n = maxOverlap; n >= 1; n--) {
    const baseTail = baseWords.slice(-n).map(cleanWord).join(' ');
    const spokenHead = spokenWords.slice(0, n).map(cleanWord).join(' ');
    if (baseTail && baseTail === spokenHead) {
      overlapCount = n;
      break;
    }
  }

  if (overlapCount > 0) {
    const nonOverlappingSpoken = spokenWords.slice(overlapCount).join(' ');
    if (!nonOverlappingSpoken) return baseTrimmed;
    return baseTrimmed + ' ' + nonOverlappingSpoken;
  }

  return baseTrimmed + ' ' + spokenTrimmed;
}

// Web Audio Pleasant Synthesized Chimes (Cosmetic feedback)
let chimeAudioCtx = null;
function playTone(type = 'start') {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!chimeAudioCtx) {
      chimeAudioCtx = new AudioContextClass();
    }
    if (chimeAudioCtx.state === 'suspended') {
      chimeAudioCtx.resume();
    }

    const osc = chimeAudioCtx.createOscillator();
    const gain = chimeAudioCtx.createGain();
    osc.connect(gain);
    gain.connect(chimeAudioCtx.destination);

    const now = chimeAudioCtx.currentTime;
    if (type === 'start') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'stop') {
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(330, now + 0.12);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.18);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (err) {
    // Cosmetic audio only
  }
}

/**
 * Start Speech Recognition targeting a specific input
 * CRITICAL: Zero getUserMedia locks to ensure 100% exclusive audio transmission
 */
function startFieldRecording(fieldKey, isSilentRestart = false) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast(
      'Browser Speech Not Supported',
      'Please open this app in Google Chrome or Microsoft Edge for live voice typing.',
      'error'
    );
    return;
  }

  const fieldConfig = FIELDS[fieldKey];
  if (!fieldConfig || !fieldConfig.input) return;

  cleanUpExistingRecognition();

  activeRecordingField = fieldKey;
  isUserIntentRecording = true;
  hasSpokenInSession = false;

  // Snapshot current input value so speech appends naturally
  baseTextAtSessionStart = fieldConfig.input.value ? fieldConfig.input.value.trim() + ' ' : '';

  if (fieldConfig.wrapper) {
    fieldConfig.wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  try {
    recognition = new SpeechRecognition();
    recognition.continuous = !isMobileDevice;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = selectedDialect;

    recognition.onstart = () => {
      if (!isSilentRestart) {
        playTone('start');
      }

      // Highlight active wrapper and show recording badge
      Object.keys(FIELDS).forEach((key) => {
        const item = FIELDS[key];
        if (item && item.wrapper && item.micBadge) {
          if (key === fieldKey) {
            item.wrapper.classList.add('recording');
            item.micBadge.classList.add('active-recording');
          } else {
            item.wrapper.classList.remove('recording');
            item.micBadge.classList.remove('active-recording');
          }
        }
      });
    };

    recognition.onspeechstart = () => {
      hasSpokenInSession = true;
    };

    recognition.onresult = (event) => {
      if (!isUserIntentRecording || activeRecordingField !== fieldKey) return;

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptChunk = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcriptChunk;
        } else {
          interimTranscript += transcriptChunk;
        }
      }

      const targetInput = fieldConfig.input;
      if (!targetInput) return;

      let rawSpoken = (finalTranscript + interimTranscript).trim();
      let cleanedSpoken = isMobileDevice ? cleanDuplicateWords(rawSpoken) : rawSpoken;

      if (cleanedSpoken.length > 0) {
        hasSpokenInSession = true;
        const stitched = appendSpokenText(baseTextAtSessionStart, cleanedSpoken);
        targetInput.value = stitched;
        targetInput.scrollTop = targetInput.scrollHeight;
        updateFieldStates();
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        return; // Normal pause in speech, onend handles it
      }
      if (event.error === 'aborted') {
        return;
      }
      if (event.error === 'not-allowed') {
        showToast(
          'Microphone Permission Needed',
          'Please allow microphone access in your browser address bar to speak.',
          'error'
        );
        stopRecording();
      }
    };

    recognition.onend = () => {
      if (isUserIntentRecording && activeRecordingField === fieldKey) {
        if (fieldConfig.input && fieldConfig.input.value) {
          baseTextAtSessionStart = fieldConfig.input.value.trim() + ' ';
        }

        const restartDelay = isMobileDevice ? 180 : 100;
        restartTimeout = setTimeout(() => {
          if (isUserIntentRecording && activeRecordingField) {
            startFieldRecording(activeRecordingField, true);
          }
        }, restartDelay);
      } else {
        cleanUpUI();
      }
    };

    recognition.start();

  } catch (err) {
    console.error('[SpeechEngine] Failed to start:', err);
    isUserIntentRecording = false;
    cleanUpUI();
  }
}

/**
 * Cleanly stop recording session
 */
function stopRecording() {
  isUserIntentRecording = false;
  playTone('stop');

  cleanUpExistingRecognition();
  cleanUpUI();

  Object.keys(FIELDS).forEach((key) => {
    const f = FIELDS[key];
    if (f && f.input) {
      f.input.value = f.input.value.trim();
    }
  });

  updateFieldStates();
}

function cleanUpExistingRecognition() {
  if (restartTimeout) {
    clearTimeout(restartTimeout);
    restartTimeout = null;
  }

  if (recognition) {
    recognition.onstart = null;
    recognition.onspeechstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try { recognition.stop(); } catch (e) { }
    try { recognition.abort(); } catch (e) { }
    recognition = null;
  }
}

function cleanUpUI() {
  activeRecordingField = null;

  Object.keys(FIELDS).forEach((key) => {
    const item = FIELDS[key];
    if (item) {
      if (item.wrapper) item.wrapper.classList.remove('recording');
      if (item.micBadge) item.micBadge.classList.remove('active-recording');
    }
  });
}

/**
 * Update UI character counts, clear buttons, and submit button state
 */
function updateFieldStates() {
  let hasAnyContent = false;

  Object.keys(FIELDS).forEach((key) => {
    const field = FIELDS[key];
    if (!field || !field.input) return;

    const val = field.input.value;
    const trimmed = val.trim();

    if (trimmed.length > 0) {
      hasAnyContent = true;
    }

    if (field.clearBtn) {
      if (val.length > 0) {
        field.clearBtn.classList.remove('hidden');
      } else {
        field.clearBtn.classList.add('hidden');
      }
    }

    if (field.isMultiLine) {
      if (!trimmed) {
        field.input.style.overflowY = 'hidden';
      } else {
        field.input.style.overflowY = field.input.scrollHeight > field.input.clientHeight ? 'auto' : 'hidden';
      }
    }
  });

  submitBtn.disabled = !hasAnyContent;
}

/**
 * Clear a specific field and immediately activate voice recording
 */
function clearField(fieldKey) {
  const field = FIELDS[fieldKey];
  if (!field || !field.input) return;

  field.input.value = '';
  baseTextAtSessionStart = '';
  updateFieldStates();

  field.input.focus();

  cleanUpExistingRecognition();
  startFieldRecording(fieldKey);
}

/**
 * Submit All Filled Fields to Google Sheet
 */
async function handleSubmitStory() {
  const payload = {};

  FIELDS_CONFIG.forEach((f) => {
    const field = FIELDS[f.key];
    if (field && field.input) {
      const val = field.input.value.trim();
      if (val) {
        payload[f.label] = val;
      }
    }
  });

  // Backward compatibility keys for server mapping
  payload.storyTitle = (FIELDS.storyTitle?.input?.value || '').trim();
  payload.storySubHeading = (FIELDS.storySubHeading?.input?.value || '').trim();
  payload.storyDescription = (FIELDS.storyDescription?.input?.value || '').trim();
  payload.challengeDescription = (FIELDS.challengeDescription?.input?.value || '').trim();
  payload.planDescription = (FIELDS.planDescription?.input?.value || '').trim();
  payload.makeoverDescription = (FIELDS.makeoverDescription?.input?.value || '').trim();
  payload.ownerDescription = (FIELDS.ownerDescription?.input?.value || '').trim();
  payload.ownerQuotes = (FIELDS.ownerDescription?.input?.value || '').trim();
  payload.language = selectedDialect;
  payload.timestamp = new Date().toISOString();

  const hasContent = Object.entries(payload).some(([k, val]) => {
    return typeof val === 'string' && val.length > 0 && k !== 'language' && k !== 'timestamp';
  });

  if (!hasContent) {
    showToast('Empty Manuscript', 'Please dictate or write into at least one field before saving.', 'error');
    return;
  }

  if (isUserIntentRecording) {
    stopRecording();
  }

  submitBtn.disabled = true;
  submitBtnText.textContent = 'Sending to Google Sheet...';
  btnSpinner.classList.remove('hidden');

  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to save story to Google Sheet.');
    }

    playTone('success');

    showToast(
      'Data Sent to Google Sheet!',
      data.message || 'Row appended successfully to Google Sheet.',
      'success'
    );

    // Reset inputs
    Object.keys(FIELDS).forEach((key) => {
      if (FIELDS[key]?.input) {
        FIELDS[key].input.value = '';
      }
    });
    baseTextAtSessionStart = '';
    updateFieldStates();

  } catch (error) {
    console.error('Submission error:', error);
    showToast(
      'Sync Notice',
      error.message || 'Could not connect to Google Sheet backend.',
      'error'
    );
  } finally {
    submitBtnText.textContent = 'Send to Google Sheet';
    btnSpinner.classList.add('hidden');
    updateFieldStates();
  }
}

/**
 * Toast Helper
 */
let toastTimeout = null;
function showToast(title, subtitle, type = 'success') {
  if (toastTimeout) clearTimeout(toastTimeout);

  toastTitle.textContent = title;
  toastSubtitle.textContent = subtitle;

  toastMessage.classList.remove('hidden', 'error');
  if (type === 'error') {
    toastMessage.classList.add('error');
    document.getElementById('toastIcon').innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ef4444" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    `;
  } else {
    document.getElementById('toastIcon').innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10b981" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `;
  }

  toastTimeout = setTimeout(() => {
    toastMessage.classList.add('hidden');
  }, 7000);
}

/* ==========================================================================
   Event Listeners Setup
   ========================================================================== */

function setupFieldListeners() {
  Object.keys(FIELDS).forEach((key) => {
    const field = FIELDS[key];
    if (!field || !field.wrapper) return;

    // Click anywhere on the field wrapper focuses input and starts recording
    field.wrapper.addEventListener('click', (e) => {
      if (e.target.closest('.clear-btn')) return;

      if (document.activeElement !== field.input && field.input) {
        field.input.focus();
      }

      if (activeRecordingField !== key || !isUserIntentRecording) {
        startFieldRecording(key);
      }
    });

    // Input focus triggers recording
    if (field.input) {
      field.input.addEventListener('focus', () => {
        if (activeRecordingField !== key || !isUserIntentRecording) {
          startFieldRecording(key);
        }
      });

      field.input.addEventListener('input', (e) => {
        if (e.isTrusted) {
          baseTextAtSessionStart = field.input.value ? field.input.value.trim() + ' ' : '';
        }
        updateFieldStates();
      });
    }

    // Clear eraser button
    if (field.clearBtn) {
      field.clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearField(key);
      });
    }

    // Corner mic badge toggle
    if (field.micBadge) {
      field.micBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isUserIntentRecording && activeRecordingField === key) {
          stopRecording();
        } else {
          if (field.input) field.input.focus();
          startFieldRecording(key);
        }
      });
    }
  });
}

// Search / Quick Jump Filter across all 93 fields
function setupSearchFilter() {
  if (!fieldSearchInput) return;

  const handleFilter = () => {
    const query = fieldSearchInput.value.trim().toLowerCase();
    let count = 0;

    if (query) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }

    FIELDS_CONFIG.forEach((f) => {
      const field = FIELDS[f.key];
      if (!field || !field.rowEl) return;

      const label = f.label.toLowerCase();
      const numStr = String(field.index);
      const isMatch = !query || label.includes(query) || numStr === query;

      if (isMatch) {
        field.rowEl.style.display = '';
        count++;
      } else {
        field.rowEl.style.display = 'none';
      }
    });

    if (visibleFieldCount) {
      visibleFieldCount.textContent = count;
    }
  };

  fieldSearchInput.addEventListener('input', handleFilter);

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      fieldSearchInput.value = '';
      handleFilter();
      fieldSearchInput.focus();
    });
  }
}

// Stop recording when clicking outside any input box
document.addEventListener('click', (e) => {
  if (!isUserIntentRecording) return;
  const clickedInputBox = e.target.closest('.paper-input-container');
  if (!clickedInputBox) {
    if (e.target.closest('#fieldSearchBar')) return;
    stopRecording();
  }
});

// Dynamic Date Stamp
function updateCurrentDate() {
  const todayStamp = document.getElementById('todayStamp');
  if (todayStamp) {
    const today = new Date();
    todayStamp.textContent = today.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}

// Keyboard Shortcuts: Ctrl+Enter or Cmd+Enter to submit
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!submitBtn.disabled) {
      handleSubmitStory();
    }
  }
});

// Submit Button
submitBtn.addEventListener('click', handleSubmitStory);

// Toast Close
toastCloseBtn.addEventListener('click', () => {
  toastMessage.classList.add('hidden');
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupFieldListeners();
  setupSearchFilter();
  updateCurrentDate();
  updateFieldStates();
  console.log(`[SpeakStory] All 93 fields initialized in one continuous flow.`);
});

// Also run listeners setup immediately since app.js is loaded at bottom of page
setupFieldListeners();
setupSearchFilter();
updateCurrentDate();
updateFieldStates();
