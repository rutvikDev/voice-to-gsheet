/**
 * Voice to Google Sheets - Client Application
 * Features:
 * - Web Speech API (webkitSpeechRecognition) with continuous listening & interim real-time preview
 * - Audio feedback (Web Audio API synthesized chimes)
 * - Editable transcript with live word/character counters
 * - Keyboard shortcuts (Ctrl+Enter / Cmd+Enter to submit)
 * - Google Sheets backend submission with visual status updates
 * - Live session activity log & setup guide modal
 */

// DOM Elements
const transcriptionInput = document.getElementById('transcriptionInput');
const textareaWrapper = document.getElementById('textareaWrapper');
const micBtn = document.getElementById('micBtn');
const clearBtn = document.getElementById('clearBtn');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const btnSpinner = document.getElementById('btnSpinner');
const languageSelect = document.getElementById('languageSelect');
const listeningIndicator = document.getElementById('listeningIndicator');
const charCount = document.getElementById('charCount');
const wordCount = document.getElementById('wordCount');
const toastMessage = document.getElementById('toastMessage');
const toastTitle = document.getElementById('toastTitle');
const toastSubtitle = document.getElementById('toastSubtitle');
const toastCloseBtn = document.getElementById('toastCloseBtn');
const entriesList = document.getElementById('entriesList');
const emptyState = document.getElementById('emptyState');
const historyBadgeCount = document.getElementById('historyBadgeCount');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const connectionStatusBtn = document.getElementById('connectionStatusBtn');
const statusBadgeText = document.getElementById('statusBadgeText');
const instructionsBtn = document.getElementById('instructionsBtn');
const googleAuthBtn = document.getElementById('googleAuthBtn');
const openSheetLink = document.getElementById('openSheetLink');
const guideModal = document.getElementById('guideModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalDoneBtn = document.getElementById('modalDoneBtn');
const modalTestConnectionBtn = document.getElementById('modalTestConnectionBtn');

// Speech Recognition State
let recognition = null;
let isRecording = false;
let finalTranscriptBeforeStart = '';
let activeInterimTranscript = '';

// Audio context for pleasant UI feedback tones
let audioCtx = null;

function playTone(type = 'start') {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'start') {
      // Pleasant rising chime
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'stop') {
      // Gentle lowering tone
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(330, now + 0.15);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'success') {
      // Cheerful double chime
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (err) {
    // Audio feedback is purely enhancement; silent fallback
  }
}

/**
 * Initialize Speech Recognition using standard or WebKit vendor prefix
 */
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast(
      'Speech Recognition Not Supported',
      'Your browser does not natively support the Web Speech API. Please open this app in Google Chrome, Microsoft Edge, Safari, or Opera for speech recognition.',
      'error'
    );
    micBtn.disabled = true;
    micBtn.title = 'Speech Recognition not supported in this browser';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.lang = languageSelect.value;

  recognition.onstart = () => {
    isRecording = true;
    playTone('start');
    micBtn.classList.add('active');
    textareaWrapper.classList.add('recording');
    listeningIndicator.classList.remove('hidden');
    micBtn.setAttribute('title', 'Listening... Click to stop microphone');
    finalTranscriptBeforeStart = transcriptionInput.value ? transcriptionInput.value.trim() + ' ' : '';
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let completedTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcriptPiece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        completedTranscript += transcriptPiece + ' ';
      } else {
        interimTranscript += transcriptPiece;
      }
    }

    if (completedTranscript) {
      finalTranscriptBeforeStart += completedTranscript;
    }

    // Capitalize first character if string starts
    let combined = (finalTranscriptBeforeStart + interimTranscript).trimStart();
    if (combined.length > 0) {
      combined = combined.charAt(0).toUpperCase() + combined.slice(1);
    }

    transcriptionInput.value = combined;
    updateCounters();
  };

  recognition.onerror = (event) => {
    console.warn('Speech recognition error event:', event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showToast(
        'Microphone Access Denied',
        'Please grant microphone permissions in your browser address bar to use speech recognition.',
        'error'
      );
    } else if (event.error === 'no-speech') {
      // Normal when the user paused speaking; recognition will keep waiting
      return;
    } else {
      showToast('Speech Recognition Warning', `Error details: ${event.error}`, 'error');
    }
    stopRecording();
  };

  recognition.onend = () => {
    if (isRecording) {
      // If user intended to continue speaking but browser stopped due to silence,
      // restart automatically if still marked as recording
      try {
        recognition.start();
        return;
      } catch (e) {
        // Fallback to stopping gracefully
      }
    }
    stopRecording();
  };
}

/**
 * Toggle Microphone Recording
 */
function toggleRecording() {
  if (!recognition) {
    initSpeechRecognition();
    if (!recognition) return;
  }

  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  try {
    recognition.lang = languageSelect.value;
    recognition.start();
  } catch (err) {
    console.error('Error starting recognition:', err);
    // If recognition is in invalid state, re-instantiate
    initSpeechRecognition();
    try {
      recognition.start();
    } catch (e) {
      showToast('Microphone Error', 'Could not initialize speech recognition. Check microphone permissions.', 'error');
    }
  }
}

function stopRecording() {
  isRecording = false;
  playTone('stop');
  micBtn.classList.remove('active');
  textareaWrapper.classList.remove('recording');
  listeningIndicator.classList.add('hidden');
  micBtn.setAttribute('title', 'Click to speak (Microphone)');

  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {}
  }

  // Trim whitespace neatly
  transcriptionInput.value = transcriptionInput.value.trim();
  updateCounters();
}

/**
 * Update character and word counters, handle button enable states
 */
function updateCounters() {
  const text = transcriptionInput.value;
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  charCount.textContent = `${chars} character${chars === 1 ? '' : 's'}`;
  wordCount.textContent = `${words} word${words === 1 ? '' : 's'}`;

  // Toggle Clear button visibility
  if (chars > 0) {
    clearBtn.classList.remove('hidden');
    submitBtn.disabled = false;
  } else {
    clearBtn.classList.add('hidden');
    submitBtn.disabled = true;
  }
}

/**
 * Clear text field
 */
function handleClear() {
  if (isRecording) {
    stopRecording();
  }
  transcriptionInput.value = '';
  finalTranscriptBeforeStart = '';
  transcriptionInput.focus();
  updateCounters();
}

/**
 * Submit Transcribed Text to Google Sheet
 */
async function handleSubmit() {
  const text = transcriptionInput.value.trim();
  if (!text) {
    showToast('Empty Text', 'Please speak or enter text before submitting.', 'error');
    return;
  }

  if (isRecording) {
    stopRecording();
  }

  // Set loading state on button
  submitBtn.disabled = true;
  submitBtnText.textContent = 'Syncing to Google Sheets...';
  btnSpinner.classList.remove('hidden');

  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        language: languageSelect.value,
        timestamp: new Date().toISOString()
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to submit entry to Google Sheet.');
    }

    playTone('success');

    // Show appropriate success message based on integration mode
    const modeBadge = data.mode === 'service_account' 
      ? 'Google Sheets API (Live Sync)' 
      : data.mode === 'webhook' 
        ? 'Apps Script Webhook (Live Sync)' 
        : 'Demo Mode (Session Log)';

    showToast(
      'Entry Recorded Successfully!',
      `${data.message} [${modeBadge}]`,
      'success'
    );

    // Add entry to UI activity log
    if (data.entry) {
      addEntryToFeed(data.entry);
    }

    // Reset textarea for next speech entry
    transcriptionInput.value = '';
    finalTranscriptBeforeStart = '';
    updateCounters();

  } catch (error) {
    console.error('Submission error:', error);
    showToast(
      'Sync Failed',
      error.message || 'Could not connect to Google Sheet backend.',
      'error'
    );
  } finally {
    submitBtnText.textContent = 'Submit to Google Sheet';
    btnSpinner.classList.add('hidden');
    // Button state re-evaluated by updateCounters
    updateCounters();
  }
}

/**
 * Add submitted row to the activity feed
 */
function addEntryToFeed(entry) {
  if (emptyState) {
    emptyState.classList.add('hidden');
  }

  const card = document.createElement('div');
  card.className = 'entry-card';

  const isDemo = entry.mode === 'demo';
  const badgeClass = isDemo ? 'entry-badge demo' : 'entry-badge synced';
  const badgeLabel = isDemo ? '🟡 Demo Mode' : '🟢 Google Sheet Synced';

  card.innerHTML = `
    <div class="entry-header">
      <span class="entry-time">${escapeHtml(entry.timestamp)}</span>
      <span class="${badgeClass}">${badgeLabel}</span>
    </div>
    <div class="entry-text">${escapeHtml(entry.text)}</div>
    <div class="entry-footer">
      <span class="entry-lang">Language: ${escapeHtml(entry.language || 'en-US')}</span>
      <button class="entry-copy-btn" title="Copy text to clipboard">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy
      </button>
    </div>
  `;

  // Attach copy button action
  const copyBtn = card.querySelector('.entry-copy-btn');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(entry.text).then(() => {
      copyBtn.innerHTML = '✓ Copied';
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg> Copy
        `;
      }, 1800);
    });
  });

  // Prepend new card
  entriesList.insertBefore(card, entriesList.firstChild);

  // Update count badge
  const currentCount = entriesList.querySelectorAll('.entry-card').length;
  historyBadgeCount.textContent = currentCount;
}

/**
 * Fetch backend status and connection health
 */
async function checkBackendStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    if (data.isConfigured) {
      connectionStatusBtn.className = 'status-badge online';
      googleAuthBtn.classList.add('hidden');
      if (data.details && data.details.sheetUrl) {
        openSheetLink.href = data.details.sheetUrl;
        openSheetLink.classList.remove('hidden');
      }
      if (data.integrationType === 'oauth') {
        statusBadgeText.textContent = `🟢 Sheet Connected (OAuth)`;
      } else if (data.integrationType === 'service_account') {
        statusBadgeText.textContent = `🟢 Sheet Connected (API)`;
      } else {
        statusBadgeText.textContent = `🟢 Sheet Connected (Webhook)`;
      }
    } else if (data.needsAuth) {
      connectionStatusBtn.className = 'status-badge demo';
      statusBadgeText.textContent = '🟡 Connect Google Account';
      googleAuthBtn.classList.remove('hidden');
      openSheetLink.classList.add('hidden');
    } else {
      connectionStatusBtn.className = 'status-badge demo';
      statusBadgeText.textContent = '🟡 Demo Mode (Setup Guide)';
      googleAuthBtn.classList.add('hidden');
      openSheetLink.classList.add('hidden');
    }

    return data;
  } catch (err) {
    connectionStatusBtn.className = 'status-badge';
    statusBadgeText.textContent = '⚪ Server Offline';
    return null;
  }
}

/**
 * Fetch past entries on load
 */
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    if (data.entries && data.entries.length > 0) {
      if (emptyState) emptyState.classList.add('hidden');
      data.entries.forEach(entry => addEntryToFeed(entry));
    }
  } catch (e) {
    // Silent fallback
  }
}

/**
 * Toast Notification Helper
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
  }, 6000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==========================================================================
   Event Listeners
   ========================================================================== */

// Microphone Click
micBtn.addEventListener('click', toggleRecording);

// Clear Button Click
clearBtn.addEventListener('click', handleClear);

// Submit Button Click
submitBtn.addEventListener('click', handleSubmit);

// Input Typing / Pasting
transcriptionInput.addEventListener('input', updateCounters);

// Keyboard Shortcut: Ctrl+Enter or Cmd+Enter to submit
transcriptionInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!submitBtn.disabled) {
      handleSubmit();
    }
  }
});

// Language change handler
languageSelect.addEventListener('change', () => {
  if (recognition) {
    recognition.lang = languageSelect.value;
    if (isRecording) {
      // Restart with new language dialect
      stopRecording();
      setTimeout(startRecording, 150);
    }
  }
});

// Toast Close
toastCloseBtn.addEventListener('click', () => {
  toastMessage.classList.add('hidden');
});

// Clear History
clearHistoryBtn.addEventListener('click', () => {
  const cards = entriesList.querySelectorAll('.entry-card');
  cards.forEach(card => card.remove());
  if (emptyState) emptyState.classList.remove('hidden');
  historyBadgeCount.textContent = '0';
});

// Guide Modal Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    const targetId = btn.getAttribute('data-tab');
    const targetPane = document.getElementById(targetId);
    if (targetPane) targetPane.classList.add('active');
  });
});

// Guide Modal open / close
function openModal() {
  guideModal.classList.remove('hidden');
}

function closeModal() {
  guideModal.classList.add('hidden');
}

instructionsBtn.addEventListener('click', openModal);
connectionStatusBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
modalDoneBtn.addEventListener('click', closeModal);

modalTestConnectionBtn.addEventListener('click', async () => {
  modalTestConnectionBtn.textContent = 'Testing...';
  const data = await checkBackendStatus();
  modalTestConnectionBtn.textContent = 'Test Connection';
  if (data && data.isConfigured) {
    alert(`Connected successfully! Method: ${data.integrationType.toUpperCase()}`);
  } else {
    alert('Currently in Demo Mode. Provide either GOOGLE_SHEET_WEBHOOK_URL or Google Service Account keys in .env or Render dashboard to connect.');
  }
});

guideModal.addEventListener('click', (e) => {
  if (e.target === guideModal) {
    closeModal();
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initSpeechRecognition();
  updateCounters();
  checkBackendStatus();
  loadHistory();

  // Handle OAuth redirect return
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('auth_success') === 'true') {
    playTone('success');
    const sheetId = urlParams.get('sheetId');
    showToast(
      '🎉 Google Sheet Connected & Created!',
      sheetId ? `Your Google Sheet was created in your Drive. Entries will sync live!` : 'Google account connected successfully!',
      'success'
    );
    // Clean up query string in browser bar
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (urlParams.get('auth_error')) {
    showToast(
      'Google Authorization Failed',
      decodeURIComponent(urlParams.get('auth_error')),
      'error'
    );
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
