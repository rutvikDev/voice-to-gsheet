/**
 * Storyteller Studio - Client Application
 * Features:
 * - Two separate voice recognition fields: Topic & Short Description
 * - Independent microphone buttons on the right side of both inputs
 * - Real-time interim preview & auto-capitalization
 * - Synced directly to Google Sheet: 1s9CqUGiXMsGFncCJJ7d002kWkCETk09rP1rkwSy2I9Y
 * - Pleasant synthesized Web Audio chimes
 */

// DOM Elements - Fields & Buttons
const topicInput = document.getElementById('topicInput');
const topicWrapper = document.getElementById('topicWrapper');
const topicMicBtn = document.getElementById('topicMicBtn');
const clearTopicBtn = document.getElementById('clearTopicBtn');

const descInput = document.getElementById('descInput');
const descWrapper = document.getElementById('descWrapper');
const descMicBtn = document.getElementById('descMicBtn');
const clearDescBtn = document.getElementById('clearDescBtn');

const descCharCount = document.getElementById('descCharCount');
const descWordCount = document.getElementById('descWordCount');

const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const btnSpinner = document.getElementById('btnSpinner');

const languageSelect = document.getElementById('languageSelect');
const activeFieldPill = document.getElementById('activeFieldPill');
const listeningFieldText = document.getElementById('listeningFieldText');

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
const googleAuthBtn = document.getElementById('googleAuthBtn');
const openSheetLink = document.getElementById('openSheetLink');

// State
let recognition = null;
let activeRecordingField = null; // 'topic' | 'desc' | null
let finalTranscriptBeforeStart = '';

// Web Audio Tone Synthesis
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
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'stop') {
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(330, now + 0.15);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (err) {}
}

/**
 * Initialize Speech Recognition
 */
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast(
      'Speech Recognition Notice',
      'Please open this app in Chrome, Edge, Safari, or Opera to use voice recognition.',
      'error'
    );
    topicMicBtn.disabled = true;
    descMicBtn.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.lang = languageSelect.value;

  recognition.onstart = () => {
    playTone('start');
    activeFieldPill.classList.remove('hidden');

    if (activeRecordingField === 'topic') {
      listeningFieldText.textContent = 'Listening to Topic...';
      topicMicBtn.classList.add('active');
      topicWrapper.classList.add('recording');
      topicMicBtn.setAttribute('title', 'Listening... Click to stop');
      finalTranscriptBeforeStart = topicInput.value ? topicInput.value.trim() + ' ' : '';
    } else if (activeRecordingField === 'desc') {
      listeningFieldText.textContent = 'Listening to Description...';
      descMicBtn.classList.add('active');
      descWrapper.classList.add('recording');
      descMicBtn.setAttribute('title', 'Listening... Click to stop');
      finalTranscriptBeforeStart = descInput.value ? descInput.value.trim() + ' ' : '';
    }
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let completedTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        completedTranscript += piece + ' ';
      } else {
        interimTranscript += piece;
      }
    }

    if (completedTranscript) {
      finalTranscriptBeforeStart += completedTranscript;
    }

    let combined = (finalTranscriptBeforeStart + interimTranscript).trimStart();
    if (combined.length > 0) {
      combined = combined.charAt(0).toUpperCase() + combined.slice(1);
    }

    if (activeRecordingField === 'topic') {
      topicInput.value = combined;
    } else if (activeRecordingField === 'desc') {
      descInput.value = combined;
    }

    updateFieldStates();
  };

  recognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showToast(
        'Microphone Permission Required',
        'Please allow microphone access in your browser to speak.',
        'error'
      );
      stopRecording();
    } else if (event.error !== 'no-speech') {
      showToast('Speech Recognition Warning', `Error: ${event.error}`, 'error');
      stopRecording();
    }
  };

  recognition.onend = () => {
    if (activeRecordingField) {
      try {
        recognition.start();
        return;
      } catch (e) {}
    }
    stopRecording();
  };
}

/**
 * Start or stop recording on a specific field
 */
function toggleFieldRecording(fieldName) {
  if (!recognition) {
    initSpeechRecognition();
    if (!recognition) return;
  }

  if (activeRecordingField === fieldName) {
    // Stop recording
    stopRecording();
  } else {
    // If recording on the other field, switch
    if (activeRecordingField) {
      stopRecording();
      setTimeout(() => startFieldRecording(fieldName), 150);
    } else {
      startFieldRecording(fieldName);
    }
  }
}

function startFieldRecording(fieldName) {
  activeRecordingField = fieldName;
  try {
    recognition.lang = languageSelect.value;
    recognition.start();
  } catch (err) {
    console.error('Start recognition failed:', err);
    initSpeechRecognition();
    try {
      recognition.start();
    } catch (e) {}
  }
}

function stopRecording() {
  const previousField = activeRecordingField;
  activeRecordingField = null;

  playTone('stop');
  activeFieldPill.classList.add('hidden');

  topicMicBtn.classList.remove('active');
  topicWrapper.classList.remove('recording');
  topicMicBtn.setAttribute('title', 'Speak Story Topic (Microphone)');

  descMicBtn.classList.remove('active');
  descWrapper.classList.remove('recording');
  descMicBtn.setAttribute('title', 'Speak Short Description (Microphone)');

  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {}
  }

  if (previousField === 'topic') {
    topicInput.value = topicInput.value.trim();
  } else if (previousField === 'desc') {
    descInput.value = descInput.value.trim();
  }

  updateFieldStates();
}

/**
 * Update UI character counts, clear buttons, and submit button
 */
function updateFieldStates() {
  const topicVal = topicInput.value.trim();
  const descVal = descInput.value;

  // Clear button for Topic
  if (topicInput.value.length > 0) {
    clearTopicBtn.classList.remove('hidden');
  } else {
    clearTopicBtn.classList.add('hidden');
  }

  // Clear button & counters for Description
  const descLen = descVal.length;
  const descWords = descVal.trim() ? descVal.trim().split(/\s+/).length : 0;

  descCharCount.textContent = `${descLen} character${descLen === 1 ? '' : 's'}`;
  descWordCount.textContent = `${descWords} word${descWords === 1 ? '' : 's'}`;

  if (descLen > 0) {
    clearDescBtn.classList.remove('hidden');
  } else {
    clearDescBtn.classList.add('hidden');
  }

  // Enable submit button if either field is present
  if (topicVal.length > 0 || descVal.trim().length > 0) {
    submitBtn.disabled = false;
  } else {
    submitBtn.disabled = true;
  }
}

/**
 * Clear actions
 */
function clearTopic() {
  if (activeRecordingField === 'topic') stopRecording();
  topicInput.value = '';
  topicInput.focus();
  updateFieldStates();
}

function clearDesc() {
  if (activeRecordingField === 'desc') stopRecording();
  descInput.value = '';
  descInput.focus();
  updateFieldStates();
}

/**
 * Submit Story to Google Sheet
 */
async function handleSubmitStory() {
  const topic = topicInput.value.trim();
  const description = descInput.value.trim();

  if (!topic && !description) {
    showToast('Empty Form', 'Please enter a Topic or a Short Description before submitting.', 'error');
    return;
  }

  if (activeRecordingField) {
    stopRecording();
  }

  submitBtn.disabled = true;
  submitBtnText.textContent = 'Saving to Google Sheet...';
  btnSpinner.classList.remove('hidden');

  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic,
        description,
        language: languageSelect.value,
        timestamp: new Date().toISOString()
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to save story to Google Sheet.');
    }

    playTone('success');

    showToast(
      'Story Saved Successfully!',
      data.message || 'Row appended to Google Sheet.',
      'success'
    );

    if (data.entry) {
      addStoryToFeed(data.entry);
    }

    // Reset inputs
    topicInput.value = '';
    descInput.value = '';
    updateFieldStates();

  } catch (error) {
    console.error('Submission error:', error);
    showToast(
      'Sync Failed',
      error.message || 'Could not connect to Google Sheet backend.',
      'error'
    );
  } finally {
    submitBtnText.textContent = 'Save Story to Google Sheet';
    btnSpinner.classList.add('hidden');
    updateFieldStates();
  }
}

/**
 * Add story card to session feed
 */
function addStoryToFeed(entry) {
  if (emptyState) emptyState.classList.add('hidden');

  const card = document.createElement('div');
  card.className = 'story-card';

  const isDemo = entry.mode === 'demo' || entry.mode === 'oauth_needs_auth';
  const badgeClass = isDemo ? 'entry-badge demo' : 'entry-badge synced';
  const badgeLabel = isDemo ? '🟡 Local Log' : '🟢 Google Sheet Synced';

  card.innerHTML = `
    <div class="story-card-header">
      <div class="story-card-title">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#a5b4fc" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <span>${escapeHtml(entry.topic || '(Untitled Topic)')}</span>
      </div>
      <span class="${badgeClass}">${badgeLabel}</span>
    </div>
    <div class="story-card-desc">${escapeHtml(entry.description || '(No description provided)')}</div>
    <div class="story-card-footer">
      <span class="story-card-time">${escapeHtml(entry.timestamp)} &bull; ${escapeHtml(entry.language || 'en-US')}</span>
      <button class="story-copy-btn" title="Copy story to clipboard">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy
      </button>
    </div>
  `;

  const copyBtn = card.querySelector('.story-copy-btn');
  copyBtn.addEventListener('click', () => {
    const fullText = `Topic: ${entry.topic}\nDescription: ${entry.description}`;
    navigator.clipboard.writeText(fullText).then(() => {
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

  entriesList.insertBefore(card, entriesList.firstChild);
  const currentCount = entriesList.querySelectorAll('.story-card').length;
  historyBadgeCount.textContent = currentCount;
}

/**
 * Fetch backend status
 */
async function checkBackendStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    if (data.isConfigured) {
      connectionStatusBtn.className = 'status-badge online';
      statusBadgeText.textContent = `🟢 Sheet Connected`;
      googleAuthBtn.classList.add('hidden');
      if (data.details && data.details.sheetUrl) {
        openSheetLink.href = data.details.sheetUrl;
      }
    } else if (data.needsAuth) {
      connectionStatusBtn.className = 'status-badge demo';
      statusBadgeText.textContent = '🟡 Authorize Google';
      googleAuthBtn.classList.remove('hidden');
    } else {
      connectionStatusBtn.className = 'status-badge demo';
      statusBadgeText.textContent = '🟡 Demo Mode';
      googleAuthBtn.classList.add('hidden');
    }

    return data;
  } catch (err) {
    connectionStatusBtn.className = 'status-badge';
    statusBadgeText.textContent = '⚪ Server Offline';
    return null;
  }
}

/**
 * Fetch past entries
 */
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    if (data.entries && data.entries.length > 0) {
      if (emptyState) emptyState.classList.add('hidden');
      data.entries.forEach(entry => addStoryToFeed(entry));
    }
  } catch (e) {}
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

// Microphone Click Events
topicMicBtn.addEventListener('click', () => toggleFieldRecording('topic'));
descMicBtn.addEventListener('click', () => toggleFieldRecording('desc'));

// Clear Events
clearTopicBtn.addEventListener('click', clearTopic);
clearDescBtn.addEventListener('click', clearDesc);

// Input Typing Events
topicInput.addEventListener('input', updateFieldStates);
descInput.addEventListener('input', updateFieldStates);

// Keyboard Shortcuts: Ctrl+Enter to submit
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!submitBtn.disabled) {
      handleSubmitStory();
    }
  }
});

// Language Select change
languageSelect.addEventListener('change', () => {
  if (recognition) {
    recognition.lang = languageSelect.value;
    if (activeRecordingField) {
      const current = activeRecordingField;
      stopRecording();
      setTimeout(() => startFieldRecording(current), 150);
    }
  }
});

// Submit Button
submitBtn.addEventListener('click', handleSubmitStory);

// Toast Close
toastCloseBtn.addEventListener('click', () => {
  toastMessage.classList.add('hidden');
});

// Clear History
clearHistoryBtn.addEventListener('click', () => {
  const cards = entriesList.querySelectorAll('.story-card');
  cards.forEach(card => card.remove());
  if (emptyState) emptyState.classList.remove('hidden');
  historyBadgeCount.textContent = '0';
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initSpeechRecognition();
  updateFieldStates();
  checkBackendStatus();
  loadHistory();

  // Handle OAuth redirect return
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('auth_success') === 'true') {
    playTone('success');
    showToast(
      '🎉 Google Sheet Authorized!',
      'Connected to target spreadsheet. Stories will sync directly into the sheet!',
      'success'
    );
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (urlParams.get('auth_error')) {
    showToast(
      'Google Authorization Notice',
      decodeURIComponent(urlParams.get('auth_error')),
      'error'
    );
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
