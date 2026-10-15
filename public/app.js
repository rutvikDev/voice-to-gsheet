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
let baseTextAtSessionStart = '';
let hasSpokenInSession = false;

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
function startFieldRecording(fieldKey) {
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
  hasSpokenInSession = false;

  // Snapshot current input value so speech appends naturally
  baseTextAtSessionStart = fieldConfig.input.value ? fieldConfig.input.value.trim() + ' ' : '';

  try {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true; // Enables live real-time character typing
    recognition.maxAlternatives = 1;
    recognition.lang = selectedDialect;

    console.log(`[SpeechEngine] Started listening for ${fieldConfig.name} in ${selectedDialect}`);

    recognition.onstart = () => {
      playTone('start');

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
     * Captures both finalized and interim (real-time in-flight) words.
     */
    recognition.onresult = (event) => {
      hasSpokenInSession = true;
      let currentFinal = '';
      let interim = '';

      for (let i = 0; i < event.results.length; ++i) {
        const res = event.results[i];
        if (res && res[0]) {
          if (res.isFinal) {
            currentFinal += res[0].transcript + ' ';
          } else {
            interim += res[0].transcript;
          }
        }
      }

      const spokenContent = (currentFinal + interim).trim();
      if (!spokenContent) return;

      // Update text field in real-time
      const combined = (baseTextAtSessionStart + spokenContent).trimStart();
      const formatted = combined.charAt(0).toUpperCase() + combined.slice(1);

      if (fieldConfig.input) {
        fieldConfig.input.value = formatted;
      }

      if (listeningFieldText) {
        const words = spokenContent.split(' ');
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

      // If user is still recording, seamlessly continue listening for the next sentence
      if (isUserIntentRecording && activeRecordingField) {
        const currentField = FIELDS[activeRecordingField];
        if (currentField && currentField.input) {
          baseTextAtSessionStart = currentField.input.value ? currentField.input.value.trim() + ' ' : '';
        }

        restartTimeout = setTimeout(() => {
          if (isUserIntentRecording && activeRecordingField) {
            try {
              recognition.start();
            } catch (err) {
              startFieldRecording(activeRecordingField);
            }
          }
        }, 100);
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

  // Trim trailing spaces and update states
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
 * Clear a specific field
 */
function clearField(fieldKey) {
  if (isUserIntentRecording && activeRecordingField === fieldKey) {
    stopRecording();
  }

  const field = FIELDS[fieldKey];
  if (field && field.input) {
    field.input.value = '';
    baseTextAtSessionStart = '';
    field.input.focus();
  }

  updateFieldStates();
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
  submitBtnText.textContent = 'Sealing & Syncing to Sheets...';
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
      'Story Sealed & Inked!',
      data.message || 'Row appended successfully to Google Sheet.',
      'success'
    );

    // Reset inputs
    Object.keys(FIELDS).forEach((key) => {
      if (FIELDS[key].input) {
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
    submitBtnText.textContent = 'Seal & Sync to Google Sheets';
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

// Set up field click listeners (Click to record for that specific field)
Object.keys(FIELDS).forEach((key) => {
  const field = FIELDS[key];
  if (!field || !field.wrapper) return;

  // Clicking anywhere on the field wrapper starts/stops recording for this field
  field.wrapper.addEventListener('click', (e) => {
    // If clicked on clear eraser button, do not toggle recording
    if (e.target.closest('.clear-btn')) return;
    toggleFieldRecording(key);
  });

  // Clear button click listener
  if (field.clearBtn) {
    field.clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearField(key);
    });
  }

  // Input typing listener
  if (field.input) {
    field.input.addEventListener('input', updateFieldStates);
  }
});

// Stop recording when clicking outside anywhere of the input box
document.addEventListener('click', (e) => {
  if (!isUserIntentRecording) return;
  const clickedInputBox = e.target.closest('.paper-input-container');
  if (!clickedInputBox) {
    console.log('[SpeechEngine] Clicked outside input box -> stopping recording');
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  updateCurrentDate();
  updateFieldStates();
  console.log('[SpeakStory] Ready. Minimal corner recording indicators active.');
});
