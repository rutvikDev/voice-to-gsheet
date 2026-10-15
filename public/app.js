/**
 * Storyteller Studio - Client Application
 * Features:
 * - 7 Core Narrative Case Study Fields (Story, Challenge, Plan, Makeover, Owners)
 * - 100% Reliable Native & Third-Party Speech Engine (ZERO microphone hardware locks)
 * - True Live Character-by-Character Voice Typing (interim + final streaming)
 * - Click-to-record on each field (exclusive single-field recording)
 * - Smooth auto-restart on pause for long descriptions without drops
 * - Direct Google Cloud Service Account sync to Google Sheet
 * - Instant error diagnostics & audio chime feedback
 */

// Dialect configuration (Defaults to en-IN for Indian accent accuracy)
let selectedDialect = 'en-IN';

// DOM Elements Registry for the 7 Case Study Fields
const FIELDS = {
  storyTitle: {
    id: 'storyTitle',
    input: document.getElementById('storyTitleInput'),
    wrapper: document.getElementById('storyTitleWrapper'),
    clearBtn: document.getElementById('clearStoryTitleBtn'),
    micBadge: document.getElementById('micBadge_storyTitle'),
    name: 'Story Title',
    isMultiLine: false
  },
  storySubHeading: {
    id: 'storySubHeading',
    input: document.getElementById('storySubHeadingInput'),
    wrapper: document.getElementById('storySubHeadingWrapper'),
    clearBtn: document.getElementById('clearStorySubHeadingBtn'),
    micBadge: document.getElementById('micBadge_storySubHeading'),
    name: 'Story Sub Heading',
    isMultiLine: false
  },
  storyDescription: {
    id: 'storyDescription',
    input: document.getElementById('storyDescInput'),
    wrapper: document.getElementById('storyDescWrapper'),
    clearBtn: document.getElementById('clearStoryDescBtn'),
    micBadge: document.getElementById('micBadge_storyDescription'),
    charCount: document.getElementById('storyDescCharCount'),
    wordCount: document.getElementById('storyDescWordCount'),
    name: 'Story Description',
    isMultiLine: true
  },
  challengeDescription: {
    id: 'challengeDescription',
    input: document.getElementById('challengeDescInput'),
    wrapper: document.getElementById('challengeDescWrapper'),
    clearBtn: document.getElementById('clearChallengeDescBtn'),
    micBadge: document.getElementById('micBadge_challengeDescription'),
    charCount: document.getElementById('challengeDescCharCount'),
    wordCount: document.getElementById('challengeDescWordCount'),
    name: 'Challenge Description',
    isMultiLine: true
  },
  planDescription: {
    id: 'planDescription',
    input: document.getElementById('planDescInput'),
    wrapper: document.getElementById('planDescWrapper'),
    clearBtn: document.getElementById('clearPlanDescBtn'),
    micBadge: document.getElementById('micBadge_planDescription'),
    charCount: document.getElementById('planDescCharCount'),
    wordCount: document.getElementById('planDescWordCount'),
    name: 'Plan Description',
    isMultiLine: true
  },
  makeoverDescription: {
    id: 'makeoverDescription',
    input: document.getElementById('makeoverDescInput'),
    wrapper: document.getElementById('makeoverDescWrapper'),
    clearBtn: document.getElementById('clearMakeoverDescBtn'),
    micBadge: document.getElementById('micBadge_makeoverDescription'),
    charCount: document.getElementById('makeoverDescCharCount'),
    wordCount: document.getElementById('makeoverDescWordCount'),
    name: 'Makeover Description',
    isMultiLine: true
  },
  ownerDescription: {
    id: 'ownerDescription',
    input: document.getElementById('ownerDescInput') || document.getElementById('ownerQuotesInput'),
    wrapper: document.getElementById('ownerDescWrapper') || document.getElementById('ownerQuotesWrapper'),
    clearBtn: document.getElementById('clearOwnerDescBtn') || document.getElementById('clearOwnerQuotesBtn'),
    micBadge: document.getElementById('micBadge_ownerDescription') || document.getElementById('micBadge_ownerQuotes'),
    charCount: document.getElementById('ownerDescCharCount') || document.getElementById('ownerQuotesCharCount'),
    wordCount: document.getElementById('ownerDescWordCount') || document.getElementById('ownerQuotesWordCount'),
    name: 'Owner Description',
    isMultiLine: true
  }
};

// Backward-compatibility alias for legacy references
Object.defineProperty(FIELDS, 'ownerQuotes', {
  get() { return FIELDS.ownerDescription; },
  enumerable: false,
  configurable: true
});

// UI Controls & Indicators
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const btnSpinner = document.getElementById('btnSpinner');

const activeFieldPill = document.getElementById('activeFieldPill');
const listeningFieldText = document.getElementById('listeningFieldText');
const micSoundLevelBadge = document.getElementById('micSoundLevelBadge');

const toastMessage = document.getElementById('toastMessage');
const toastTitle = document.getElementById('toastTitle');
const toastSubtitle = document.getElementById('toastSubtitle');
const toastCloseBtn = document.getElementById('toastCloseBtn');

// Speech Recognition Engine State
let recognition = null;
let activeRecordingField = null; // Key of FIELDS or null
let isUserIntentRecording = false;
let restartTimeout = null;

// Mobile detection — Android/iOS handle continuous recognition differently
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Multi-tier cursor-aware speech buffers:
let sessionPrefix = '';         // Text BEFORE the active cursor / insertion point
let sessionSuffix = '';         // Text AFTER the active cursor / insertion point
let sessionFinalText = '';      // Accumulated confirmed final transcripts at current insertion point
let sessionInterimText = '';    // In-flight, unconfirmed interim text (transient, per-cycle)
let lastFinalTranscript = '';   // Last finalized chunk for overlap deduplication
let hasSpokenInSession = false;
let currentCursorPos = -1;      // Current insertion caret position
let currentSelStart = -1;       // Current selection start index
let currentSelEnd = -1;         // Current selection end index
let isProgrammaticCursorUpdate = false; // Flag to prevent programmatic caret set from triggering user move
let cursorDebounceTimer = null;

// Web Audio Pleasant Synthesized Chimes (Cosmetic feedback only)
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
    // Audio feedback is purely cosmetic
  }
}

/**
 * Smart Punctuation and Voice Dictation Formatter
 * Accurately catches spoken punctuation marks and formats spacing & capitalization.
 */
function formatPunctuation(text, isMultiLine = false, isMiddleOfSentence = false) {
  if (!text) return '';
  let str = text;

  // 1. Spoken Punctuation Words to Symbols
  str = str.replace(/\b(full\s*stop)\b/gi, '.');
  str = str.replace(/\b(this|that|the|a|an|time|grace|probationary|short|long|extended)\s+period\b/gi, '$1 __PERIOD_NOUN__');
  str = str.replace(/\bperiod\b/gi, '.');
  str = str.replace(/__PERIOD_NOUN__/g, 'period');

  str = str.replace(/\bcomma\b/gi, ',');
  str = str.replace(/\bquestion\s*mark\b/gi, '?');
  str = str.replace(/\bexclamation\s*(mark|point)\b/gi, '!');
  str = str.replace(/\b(semi[-\s]?colon)\b/gi, ';');
  str = str.replace(/\bcolon\b/gi, ':');
  str = str.replace(/\b(hyphen|em\s*dash|en\s*dash)\b/gi, '-');

  str = str.replace(/\b(open\s*quotes?)\b/gi, '"');
  str = str.replace(/\b(close\s*quotes?)\b/gi, '"');
  str = str.replace(/\bquote\s*unquote\b/gi, '"');
  str = str.replace(/\s*"\s*([^"]+?)\s*"\s*/g, ' "$1" ');

  str = str.replace(/\b(open\s*bracket|open\s*parenthes[ie]s|open\s*paren)\b/gi, '(');
  str = str.replace(/\b(close\s*bracket|close\s*parenthes[ie]s|close\s*paren)\b/gi, ')');
  str = str.replace(/\s*\(\s*([^)]+?)\s*\)\s*/g, ' ($1) ');

  if (isMultiLine) {
    str = str.replace(/\b(new\s*line|next\s*line)\s+of\b/gi, '__LINE_OF__');
    str = str.replace(/\b(new\s*line|next\s*line)\b/gi, '\n');
    str = str.replace(/__LINE_OF__/g, 'new line of');
  } else {
    str = str.replace(/\b(new\s*line|next\s*line)\b/gi, ' ');
  }

  // 2. Clean spaces before punctuation marks
  str = str.replace(/\s+([,.:;?!])/g, '$1');

  // 3. Ensure space after punctuation when followed directly by letters
  str = str.replace(/([,:;?!])([A-Za-z])/g, '$1 $2');
  str = str.replace(/\.([A-Za-z]{2,})/g, '. $1');

  // Collapse multiple spaces (preserving newlines)
  str = str.replace(/[^\S\r\n]{2,}/g, ' ');

  // 4. Clean spaces around newlines
  if (isMultiLine) {
    str = str.replace(/[ \t]*\n[ \t]*/g, '\n');
  }

  // 5. Capitalize first letter of string (only if not middle of sentence)
  if (!isMiddleOfSentence) {
    str = str.replace(/^(\s*)([a-z])/, (m, p1, p2) => p1 + p2.toUpperCase());
  }

  // 6. Capitalize letter after sentence terminators (. ? !)
  str = str.replace(/([.?!]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());

  // 7. Capitalize letter after newline
  if (isMultiLine) {
    str = str.replace(/(\n\s*)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
  }

  return str;
}

/**
 * Assemble full text when inserting speech at an active cursor / selection point.
 * Accurately handles:
 * - Proper spacing before and after inserted words
 * - Smart lowercase/capitalization based on prefix sentence boundaries
 * - Smart punctuation attachment (no space before commas, periods, etc.)
 * - Returns both the assembled text and the new cursor position
 */
function assembleTextAtCursor(prefix, incomingText, suffix, isMultiLine = false) {
  if (!incomingText) {
    return {
      fullText: prefix + suffix,
      cursorOffset: prefix.length
    };
  }

  let textToInsert = incomingText;

  // Determine if insertion point is at the beginning of the text or follows a sentence terminator
  const isStartOfSentence = !prefix || /([.?!]\s*|\n\s*)$/.test(prefix);

  if (!isStartOfSentence) {
    // If inserting into the middle of an existing sentence, convert initial capital to lowercase
    // (except for proper noun pronoun "I", e.g. "I", "I'm", "I'll", "I'd", "I've")
    textToInsert = textToInsert.replace(/^(\s*)([A-Z])(?![A-Z])/, (match, space, letter) => {
      if (letter === 'I' && /^\s*I\b/.test(textToInsert)) return match;
      return space + letter.toLowerCase();
    });
  } else {
    // If inserting at start of sentence, ensure first letter is capitalized
    textToInsert = textToInsert.replace(/^(\s*)([a-z])/, (match, space, letter) => {
      return space + letter.toUpperCase();
    });
  }

  // 1. Spacing between prefix and inserted text
  let left = prefix;
  const insertTrimmedStart = textToInsert.trimStart();
  const insertStartsWithPunct = /^[,\.\?!;:)\-\/]/.test(insertTrimmedStart);

  if (insertStartsWithPunct) {
    // Spoken punctuation mark attaches directly to prefix
    left = left.trimEnd();
  } else if (left && !/\s$/.test(left) && !/\n$/.test(left)) {
    // Need space between prefix word and incoming word
    left = left + ' ';
  }

  // 2. Spacing between inserted text and suffix
  let mid = textToInsert;
  let right = suffix;

  if (right) {
    const rightTrimmedStart = right.trimStart();
    const rightStartsWithPunct = /^[,\.\?!;:)\-\/]/.test(rightTrimmedStart);

    if (rightStartsWithPunct) {
      // Right starts with punctuation (e.g. period, comma): attach directly
      mid = mid.trimEnd();
      right = right.trimStart();
    } else {
      // Right starts with a word/character
      if (mid && !/\s$/.test(mid) && !/\n$/.test(mid) && !/^\s/.test(right)) {
        mid = mid + ' ';
      } else if (/\s$/.test(mid) && /^\s/.test(right)) {
        right = right.trimStart();
      }
    }

    // If mid ends with sentence-terminating punctuation (. ? !), capitalize the following letter in suffix
    if (/[.?!]\s*$/.test(mid)) {
      right = right.replace(/^(\s*)([a-z])/, (m, p1, p2) => p1 + p2.toUpperCase());
    }
  }

  const fullText = left + mid + right;
  const cursorOffset = (left + mid).length;

  return {
    fullText,
    cursorOffset
  };
}

/**
 * Handle user moving or dragging the cursor/selection inside an active input
 */
function handleUserCursorMove(fieldKey) {
  if (isProgrammaticCursorUpdate) return;
  const fieldConfig = FIELDS[fieldKey];
  if (!fieldConfig || !fieldConfig.input) return;

  const input = fieldConfig.input;
  const val = input.value || '';
  const selStart = input.selectionStart ?? val.length;
  const selEnd = input.selectionEnd ?? val.length;

  // If cursor and selection haven't changed from our tracking, do nothing
  if (selStart === currentSelStart && selEnd === currentSelEnd) {
    return;
  }

  console.log(`[SpeechEngine] Cursor updated for ${fieldKey} to [${selStart}, ${selEnd}]`);

  currentSelStart = selStart;
  currentSelEnd = selEnd;
  currentCursorPos = selStart;

  sessionPrefix = val.substring(0, selStart);
  sessionSuffix = val.substring(selEnd);
  sessionFinalText = '';
  sessionInterimText = '';
  lastFinalTranscript = '';

  // Silently restart speech recognition cycle so engine buffer begins fresh at new cursor position
  if (isUserIntentRecording && activeRecordingField === fieldKey) {
    cleanUpExistingRecognition();
    startFieldRecording(fieldKey, true); // true = silent restart
  }
}

/**
 * Smart Word-Boundary Deduplication Helper
 * Mobile browsers (especially Android Chrome) frequently repeat phrases
 * across recognition restart boundaries or cumulative result packets.
 * Detects and strips overlapping prefix between existingText tail and incomingText head.
 */
function appendWithDeduplication(existingText, incomingText) {
  const existing = (existingText || '').trimEnd();
  const incoming = (incomingText || '').trim();

  if (!incoming) return existing ? existing + ' ' : '';
  if (!existing) return incoming + ' ';

  // If incoming starts with punctuation mark, attach directly without extra space
  const startsWithPunctuation = /^[,\.\?!;:)\-\/]/.test(incoming);

  const existingWords = existing.split(/\s+/);
  const incomingWords = incoming.split(/\s+/);

  // Check overlap of up to 12 words between tail of existing and head of incoming
  const maxOverlap = Math.min(existingWords.length, incomingWords.length, 12);
  let overlapFound = 0;

  for (let len = maxOverlap; len >= 1; len--) {
    const tailSlice = existingWords.slice(-len).map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const headSlice = incomingWords.slice(0, len).map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''));

    if (tailSlice.join(' ') === headSlice.join(' ')) {
      overlapFound = len;
      break;
    }
  }

  if (overlapFound > 0) {
    const uniqueWords = incomingWords.slice(overlapFound);
    if (uniqueWords.length === 0) return existing + ' ';
    const separator = /^[,\.\?!;:)\-\/]/.test(uniqueWords[0]) ? '' : ' ';
    return existing + separator + uniqueWords.join(' ') + ' ';
  }

  const separator = startsWithPunctuation ? '' : ' ';
  return existing + separator + incoming + ' ';
}

/**
 * Toggle recording for a specific field by key
 */
function toggleFieldRecording(fieldKey) {
  if (isUserIntentRecording && activeRecordingField === fieldKey) {
    stopRecording();
    return;
  }

  if (isUserIntentRecording) {
    stopRecording();
    setTimeout(() => {
      startFieldRecording(fieldKey);
    }, 150);
    return;
  }

  startFieldRecording(fieldKey);
}

/**
 * Start Speech Recognition targeting a specific input
 * CRITICAL: Zero getUserMedia locks to ensure Bluetooth / Windows audio drivers
 * have 100% exclusive audio transmission to the speech recognition service.
 */
function startFieldRecording(fieldKey, isSilentRestart = false) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast(
      'Browser Speech Not Supported',
      'Please open this app in Google Chrome or Microsoft Edge for native live speech recognition.',
      'error'
    );
    return;
  }

  const fieldConfig = FIELDS[fieldKey];
  if (!fieldConfig || !fieldConfig.input) return;

  cleanUpExistingRecognition();

  activeRecordingField = fieldKey;
  isUserIntentRecording = true;

  if (!isSilentRestart) {
    // First start: snapshot text around cursor position, reset accumulators
    hasSpokenInSession = false;
    const input = fieldConfig.input;
    const val = input ? (input.value || '') : '';
    let selStart = input ? input.selectionStart : val.length;
    let selEnd = input ? input.selectionEnd : val.length;

    if (typeof selStart !== 'number' || typeof selEnd !== 'number' || isNaN(selStart)) {
      selStart = val.length;
      selEnd = val.length;
    }

    sessionPrefix = val.substring(0, selStart);
    sessionSuffix = val.substring(selEnd);
    sessionFinalText = '';
    sessionInterimText = '';
    lastFinalTranscript = '';
    currentCursorPos = selStart;
    currentSelStart = selStart;
    currentSelEnd = selEnd;
  } else {
    // Silent restart after mobile pause: keep prefix, finals & suffix; clear transient interim
    sessionInterimText = '';
  }

  if (fieldConfig.wrapper) {
    fieldConfig.wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  try {
    recognition = new SpeechRecognition();
    recognition.continuous = !isMobile; // Disable continuous on mobile to prevent cumulative transcript arrays
    recognition.interimResults = true; // Enables live real-time character typing
    recognition.maxAlternatives = 1;
    recognition.lang = selectedDialect;
    try {
      recognition.unspokenPunctuation = true; // Request automatic punctuation from speech pause/prosody where supported
    } catch (e) { }

    console.log(`[SpeechEngine] Started listening for ${fieldConfig.name} in ${selectedDialect}${isMobile ? ' (mobile mode)' : ''}`);

    recognition.onstart = () => {
      if (!isSilentRestart) {
        playTone('start');
      }

      // Highlight active wrapper and activate moving corner mic badge
      Object.keys(FIELDS).forEach((key) => {
        const item = FIELDS[key];
        if (item) {
          if (key === fieldKey) {
            if (item.wrapper) item.wrapper.classList.add('recording');
            if (item.micBadge) item.micBadge.classList.add('active-recording');
          } else {
            if (item.wrapper) item.wrapper.classList.remove('recording');
            if (item.micBadge) item.micBadge.classList.remove('active-recording');
          }
        }
      });
    };

    recognition.onspeechstart = () => {
      if (listeningFieldText) {
        listeningFieldText.textContent = 'Transcribing live... Speak naturally';
      }
      if (micSoundLevelBadge) {
        micSoundLevelBadge.textContent = 'Voice Detected ✓';
        micSoundLevelBadge.style.color = '#059669';
      }
    };

    /**
     * LIVE CHARACTER-BY-CHARACTER TYPING ENGINE
     * Uses event.resultIndex to process only NEW results (prevents mobile re-accumulation).
     * Finals committed to sessionFinalText with deduplication.
     * Interims are transient display-only in sessionInterimText.
     */
    recognition.onresult = (event) => {
      hasSpokenInSession = true;
      let cycleFinal = '';
      let cycleInterim = '';

      // Process only NEW results using resultIndex (critical for mobile)
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i];
        if (res && res[0]) {
          if (res.isFinal) {
            cycleFinal += res[0].transcript;
          } else {
            cycleInterim += res[0].transcript;
          }
        }
      }

      const isMiddleOfSentence = !!(sessionPrefix && !/([.?!]\s*|\n\s*)$/.test(sessionPrefix));

      // Commit finalized text with smart punctuation and deduplication
      const cleanFinal = formatPunctuation(cycleFinal.trim(), fieldConfig.isMultiLine, isMiddleOfSentence);
      if (cleanFinal && cleanFinal !== lastFinalTranscript) {
        sessionFinalText = appendWithDeduplication(sessionFinalText, cleanFinal);
        lastFinalTranscript = cleanFinal;
      }

      // Update transient interim (formatted for live display)
      sessionInterimText = formatPunctuation(cycleInterim, fieldConfig.isMultiLine, isMiddleOfSentence);

      // Reconstruct display from clean cursor-aware buffers with smart spacing & positioning
      const activeDictation = (sessionFinalText + sessionInterimText).trim();

      if (fieldConfig.input) {
        const { fullText, cursorOffset } = assembleTextAtCursor(
          sessionPrefix,
          activeDictation,
          sessionSuffix,
          fieldConfig.isMultiLine
        );

        isProgrammaticCursorUpdate = true;
        fieldConfig.input.value = fullText;
        currentCursorPos = cursorOffset;
        currentSelStart = cursorOffset;
        currentSelEnd = cursorOffset;

        try {
          fieldConfig.input.setSelectionRange(cursorOffset, cursorOffset);
        } catch (e) { }

        // Keep active voice text in view when text overflows the input size
        if (!fieldConfig.isMultiLine) {
          if (cursorOffset >= fullText.length - 2) {
            fieldConfig.input.scrollLeft = fieldConfig.input.scrollWidth;
          }
        } else {
          if (cursorOffset >= fullText.length - 10) {
            fieldConfig.input.scrollTop = fieldConfig.input.scrollHeight;
          }
        }

        setTimeout(() => {
          isProgrammaticCursorUpdate = false;
        }, 0);
      }

      if (listeningFieldText) {
        const displayText = (sessionFinalText + sessionInterimText).trim();
        const words = displayText.split(' ');
        const snippet = words.slice(-4).join(' ');
        listeningFieldText.textContent = `✍️ "${snippet}..."`;
      }

      if (micSoundLevelBadge) {
        micSoundLevelBadge.textContent = 'Transcribing ✓';
        micSoundLevelBadge.style.color = '#059669';
      }

      updateFieldStates();
    };

    recognition.onerror = (event) => {
      console.warn('[SpeechEngine] Notice:', event.error);

      // Harmless lifecycle events that happen normally during natural pauses
      if (event.error === 'aborted' || event.error === 'no-speech') {
        return;
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        showToast(
          'Microphone Blocked',
          'Please click the lock/tune icon in your browser address bar and choose "Allow" for Microphone.',
          'error'
        );
        stopRecording();
      } else if (event.error === 'audio-capture') {
        showToast(
          'Microphone Busy',
          'Your microphone hardware is unavailable or in use by another application. Please check Windows Sound settings.',
          'error'
        );
        stopRecording();
      } else if (event.error === 'network') {
        console.warn('[SpeechEngine] Network speech reconnecting...');
      }
    };

    recognition.onend = () => {
      console.log('[SpeechEngine] Recognition cycle ended.');

      // If user is still recording, seamlessly continue listening
      if (isUserIntentRecording && activeRecordingField) {
        // Clear transient interim (either promoted to final or discarded by engine)
        sessionInterimText = '';

        restartTimeout = setTimeout(() => {
          if (isUserIntentRecording && activeRecordingField) {
            startFieldRecording(activeRecordingField, true);
          }
        }, isMobile ? 150 : 100); // Slightly longer delay on mobile for audio driver release
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

  // Reset session buffers
  sessionPrefix = '';
  sessionSuffix = '';
  sessionFinalText = '';
  sessionInterimText = '';
  lastFinalTranscript = '';
  currentCursorPos = -1;
  currentSelStart = -1;
  currentSelEnd = -1;

  // Polish punctuation, trim trailing spaces and update states
  Object.keys(FIELDS).forEach((key) => {
    const f = FIELDS[key];
    if (f && f.input) {
      f.input.value = formatPunctuation(f.input.value, f.isMultiLine).trim();
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

    // Toggle clear button
    if (field.clearBtn) {
      if (val.length > 0) {
        field.clearBtn.classList.remove('hidden');
      } else {
        field.clearBtn.classList.add('hidden');
      }
    }

    // Update word & character stats for textareas
    if (field.isMultiLine) {
      const len = val.length;
      const words = trimmed ? trimmed.split(/\s+/).length : 0;
      if (field.charCount) field.charCount.textContent = `${len} character${len === 1 ? '' : 's'}`;
      if (field.wordCount) field.wordCount.textContent = `${words} word${words === 1 ? '' : 's'}`;

      // Strictly remove scroll on input when there is no text
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

  // Clear value and reset voice snapshot
  field.input.value = '';
  field.input.scrollLeft = 0;
  field.input.scrollTop = 0;
  sessionPrefix = '';
  sessionSuffix = '';
  sessionFinalText = '';
  sessionInterimText = '';
  lastFinalTranscript = '';
  currentCursorPos = 0;
  currentSelStart = 0;
  currentSelEnd = 0;
  updateFieldStates();

  // Focus the input
  field.input.focus();

  // Immediately start speech recognition on this cleared field
  // so whatever the user speaks next is immediately transcribed
  cleanUpExistingRecognition();
  startFieldRecording(fieldKey);
}

/**
 * Submit Story to Google Sheet
 */
async function handleSubmitStory() {
  const payload = {
    storyTitle: FIELDS.storyTitle.input.value.trim(),
    storySubHeading: FIELDS.storySubHeading.input.value.trim(),
    storyDescription: FIELDS.storyDescription.input.value.trim(),
    challengeDescription: FIELDS.challengeDescription.input.value.trim(),
    planDescription: FIELDS.planDescription.input.value.trim(),
    makeoverDescription: FIELDS.makeoverDescription.input.value.trim(),
    ownerDescription: (FIELDS.ownerDescription || FIELDS.ownerQuotes).input.value.trim(),
    ownerQuotes: (FIELDS.ownerDescription || FIELDS.ownerQuotes).input.value.trim(),
    language: selectedDialect,
    timestamp: new Date().toISOString()
  };

  const hasContent = Object.values(payload).some((val) => typeof val === 'string' && val.length > 0 && val !== selectedDialect);

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
      if (FIELDS[key].input) {
        FIELDS[key].input.value = '';
      }
    });
    sessionPrefix = '';
    sessionSuffix = '';
    sessionFinalText = '';
    sessionInterimText = '';
    lastFinalTranscript = '';
    currentCursorPos = -1;
    currentSelStart = -1;
    currentSelEnd = -1;
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
   Event Listeners
   ========================================================================== */

// Set up field listeners
// - First click inside field starts recording immediately with cursor at click/selection position
// - Subsequent clicks/drags inside the field update the cursor insertion point seamlessly
// - Clicking a different field switches recording to that field
// - Clicking outside fields stops recording
Object.keys(FIELDS).forEach((key) => {
  const field = FIELDS[key];
  if (!field || !field.wrapper) return;

  // Clicking anywhere on the field wrapper (or inside the field input)
  field.wrapper.addEventListener('click', (e) => {
    // If clicked on clear eraser button, clearField handles it
    if (e.target.closest('.clear-btn')) return;

    const clickedDirectlyOnInput = (e.target === field.input);

    if (field.input) {
      if (!clickedDirectlyOnInput && document.activeElement !== field.input) {
        field.input.focus();
        // Placed cursor at end if clicked outside the input element itself (e.g. wrapper margin)
        const len = field.input.value.length;
        field.input.setSelectionRange(len, len);
      } else {
        field.input.focus();
      }
    }

    // If already recording this exact field:
    if (isUserIntentRecording && activeRecordingField === key) {
      if (clickedDirectlyOnInput) {
        handleUserCursorMove(key);
      }
      return;
    }

    // Start recording immediately on click (or switch from another field)
    startFieldRecording(key);
  });

  // Focus on input (e.g. keyboard Tab navigation)
  if (field.input) {
    field.input.addEventListener('focus', () => {
      if (activeRecordingField !== key || !isUserIntentRecording) {
        startFieldRecording(key);
      }
    });

    // Listen to user mouse, touch, select, drop interactions to track cursor placement & dragging
    ['mouseup', 'touchend', 'select', 'drop'].forEach((evt) => {
      field.input.addEventListener(evt, () => {
        if (isUserIntentRecording && activeRecordingField === key) {
          setTimeout(() => {
            handleUserCursorMove(key);
          }, 0);
        }
      });
    });

    // Keyboard navigation keys (Arrow keys, Home, End, PageUp, PageDown)
    field.input.addEventListener('keyup', (e) => {
      const navKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];
      if (navKeys.includes(e.key)) {
        if (isUserIntentRecording && activeRecordingField === key) {
          handleUserCursorMove(key);
        }
      }
    });

    // Manual typing/editing: sync session buffers
    field.input.addEventListener('input', (e) => {
      if (e.isTrusted && isUserIntentRecording && activeRecordingField === key) {
        // User typed manually while recording — reset buffers to current cursor location
        const val = field.input.value || '';
        const pos = field.input.selectionStart ?? val.length;
        const endPos = field.input.selectionEnd ?? pos;
        sessionPrefix = val.substring(0, pos);
        sessionSuffix = val.substring(endPos);
        sessionFinalText = '';
        sessionInterimText = '';
        lastFinalTranscript = '';
        currentCursorPos = pos;
        currentSelStart = pos;
        currentSelEnd = endPos;
      }
      updateFieldStates();
    });
  }

  // Clear button click listener
  if (field.clearBtn) {
    field.clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearField(key);
    });
  }

  // Clicking the active corner mic badge allows explicitly stopping recording if desired
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

// Catch any mouse drag-selection that ends anywhere on the document while recording
document.addEventListener('mouseup', () => {
  if (isUserIntentRecording && activeRecordingField) {
    setTimeout(() => {
      handleUserCursorMove(activeRecordingField);
    }, 0);
  }
});

// Selection change observer for cursor dragging across inputs
document.addEventListener('selectionchange', () => {
  if (isUserIntentRecording && activeRecordingField && !isProgrammaticCursorUpdate) {
    const fieldConfig = FIELDS[activeRecordingField];
    if (fieldConfig && fieldConfig.input && document.activeElement === fieldConfig.input) {
      if (cursorDebounceTimer) clearTimeout(cursorDebounceTimer);
      cursorDebounceTimer = setTimeout(() => {
        handleUserCursorMove(activeRecordingField);
      }, 100);
    }
  }
});

// Stop recording when clicking outside fields
document.addEventListener('click', (e) => {
  if (!isUserIntentRecording) return;
  const clickedField = e.target.closest('.paper-input-container, .notepad-row, .corner-mic-badge');
  if (!clickedField) {
    console.log('[SpeechEngine] Clicked outside fields -> stopping recording');
    stopRecording();
  }
});

// Dynamic Date Stamp (Always current runtime date, never hardcoded)
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
updateCurrentDate();

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

/**
 * Enables smooth mouse-wheel horizontal scrolling inside single-line inputs
 * whenever the text exceeds the visible input width, without showing scrollbars.
 */
function initInputScrollHandling() {
  const textInputs = document.querySelectorAll('.paper-text-input');
  textInputs.forEach((input) => {
    input.addEventListener('wheel', (e) => {
      if (input.scrollWidth > input.clientWidth) {
        // Prioritize horizontal trackpad swipe or convert vertical mouse wheel to horizontal scroll
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (delta !== 0) {
          const maxScroll = input.scrollWidth - input.clientWidth;
          const currentScroll = input.scrollLeft;
          const canScrollRight = delta > 0 && currentScroll < maxScroll - 1;
          const canScrollLeft = delta < 0 && currentScroll > 1;

          if (canScrollRight || canScrollLeft) {
            e.preventDefault();
            input.scrollLeft += delta;
          }
        }
      }
    }, { passive: false });
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  updateCurrentDate();
  updateFieldStates();
  initInputScrollHandling();
  console.log('[SpeakStory] Ready. Minimal corner recording indicators active.');
});
