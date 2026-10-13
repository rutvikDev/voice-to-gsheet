/**
 * Storyteller Studio - Client Application
 * Robust Speech Recognition with zero false abort warnings,
 * independent Topic & Description recording, and direct Google Sheet sync.
 */

// DOM Elements
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

const connectionStatusBadge = document.getElementById('connectionStatusBadge');
const statusBadgeText = document.getElementById('statusBadgeText');
const openSheetLink = document.getElementById('openSheetLink');

// Speech Recognition Engine State
let recognition = null;
let activeRecordingField = null; // 'topic' | 'desc' | null
let isUserIntentRecording = false;
let restartTimeout = null;
let baseTextBeforeSpeech = '';

// Web Audio Feedback (synthesized tones)
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
  } catch (err) {}
}

/**
 * Toggle recording on a specified field ('topic' or 'desc')
 */
async function toggleFieldRecording(fieldName) {
  // If already recording on this field, stop
  if (isUserIntentRecording && activeRecordingField === fieldName) {
    stopRecording();
    return;
  }

  // If recording on another field, stop first then switch
  if (isUserIntentRecording) {
    stopRecording();
    setTimeout(() => {
      startFieldRecording(fieldName);
    }, 200);
    return;
  }

  startFieldRecording(fieldName);
}

/**
 * Start speech recognition targeting a specific input
 */
async function startFieldRecording(fieldName) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast(
      'Browser Not Supported',
      'Please open this app in Google Chrome or Microsoft Edge for native speech recognition support.',
      'error'
    );
    return;
  }

  // Request microphone permission if not yet granted
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release stream immediately; SpeechRecognition handles audio capture
      stream.getTracks().forEach(track => track.stop());
    }
  } catch (permErr) {
    console.warn('Microphone permission query notice:', permErr);
    if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
      showToast(
        'Microphone Blocked',
        'Please click the microphone icon in your browser address bar and choose "Allow".',
        'error'
      );
      return;
    }
  }

  // Clean up any stale instances or timers
  cleanUpExistingRecognition();

  activeRecordingField = fieldName;
  isUserIntentRecording = true;

  // Save current text to append to
  if (fieldName === 'topic') {
    baseTextBeforeSpeech = topicInput.value ? topicInput.value.trim() + ' ' : '';
  } else {
    baseTextBeforeSpeech = descInput.value ? descInput.value.trim() + ' ' : '';
  }

  // Create a brand new clean SpeechRecognition instance
  try {
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
      } else if (activeRecordingField === 'desc') {
        listeningFieldText.textContent = 'Listening to Description...';
        descMicBtn.classList.add('active');
        descWrapper.classList.add('recording');
        descMicBtn.setAttribute('title', 'Listening... Click to stop');
      }
    };

    recognition.onresult = (event) => {
      let interim = '';
      let completed = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          completed += text + ' ';
        } else {
          interim += text;
        }
      }

      if (completed) {
        baseTextBeforeSpeech += completed;
      }

      let combined = (baseTextBeforeSpeech + interim).trimStart();
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
      console.log('[SpeechRecognition] Event status:', event.error);

      // 'aborted' and 'no-speech' are harmless lifecycle events in Web Speech API
      // Do NOT show error alerts for them!
      if (event.error === 'aborted' || event.error === 'no-speech') {
        return;
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        showToast(
          'Microphone Blocked',
          'Please allow microphone access in your browser address bar.',
          'error'
        );
        stopRecording();
      } else if (event.error === 'network') {
        // Subtle reconnect
        console.warn('Network glitch in speech recognition; will reconnect automatically.');
      } else {
        console.warn('Non-fatal speech recognition event:', event.error);
      }
    };

    recognition.onend = () => {
      // If the user hasn't explicitly stopped recording,
      // restart with a brief debounce so the browser audio subsystem resets cleanly
      if (isUserIntentRecording && activeRecordingField) {
        restartTimeout = setTimeout(() => {
          if (isUserIntentRecording && activeRecordingField) {
            try {
              startFieldRecording(activeRecordingField);
            } catch (err) {
              console.warn('Restart exception:', err);
            }
          }
        }, 150);
      } else {
        cleanUpUI();
      }
    };

    recognition.start();

  } catch (err) {
    console.error('Failed to start speech recognition:', err);
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

  // Trim trailing whitespace
  topicInput.value = topicInput.value.trim();
  descInput.value = descInput.value.trim();
  updateFieldStates();
}

function cleanUpExistingRecognition() {
  if (restartTimeout) {
    clearTimeout(restartTimeout);
    restartTimeout = null;
  }

  if (recognition) {
    // Nullify listeners to prevent trailing events
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.stop();
    } catch (e) {}
    try {
      recognition.abort();
    } catch (e) {}
    recognition = null;
  }
}

function cleanUpUI() {
  activeRecordingField = null;
  activeFieldPill.classList.add('hidden');

  topicMicBtn.classList.remove('active');
  topicWrapper.classList.remove('recording');
  topicMicBtn.setAttribute('title', 'Speak Story Topic (Microphone)');

  descMicBtn.classList.remove('active');
  descWrapper.classList.remove('recording');
  descMicBtn.setAttribute('title', 'Speak Short Description (Microphone)');
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
  if (isUserIntentRecording && activeRecordingField === 'topic') stopRecording();
  topicInput.value = '';
  baseTextBeforeSpeech = '';
  topicInput.focus();
  updateFieldStates();
}

function clearDesc() {
  if (isUserIntentRecording && activeRecordingField === 'desc') stopRecording();
  descInput.value = '';
  baseTextBeforeSpeech = '';
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

  if (isUserIntentRecording) {
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
    baseTextBeforeSpeech = '';
    updateFieldStates();

  } catch (error) {
    console.error('Submission error:', error);
    showToast(
      'Sync Notice',
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

  const badgeClass = entry.syncedToSheet ? 'entry-badge synced' : 'entry-badge demo';
  const badgeLabel = entry.syncedToSheet ? '🟢 Google Sheet Synced' : '🟡 Local Log';

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

    if (data.hasServiceAccount) {
      connectionStatusBadge.className = 'status-badge online';
      statusBadgeText.textContent = `🟢 Sheet Ready`;
    } else {
      connectionStatusBadge.className = 'status-badge demo';
      statusBadgeText.textContent = `🟡 Add Service Account`;
    }

    if (data.sheetUrl) {
      openSheetLink.href = data.sheetUrl;
    }

    return data;
  } catch (err) {
    connectionStatusBadge.className = 'status-badge demo';
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
  if (isUserIntentRecording && activeRecordingField) {
    const current = activeRecordingField;
    stopRecording();
    setTimeout(() => startFieldRecording(current), 200);
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
  updateFieldStates();
  checkBackendStatus();
  loadHistory();
});
