/**
 * Media Sleep Timer - Popup Script
 * Handles UI interactions, countdown calculation, and background communication.
 */

// DOM Elements
const countdownDisplay = document.getElementById('countdownDisplay');
const countdownLabel = document.getElementById('countdownLabel');
const statusBadge = document.getElementById('statusBadge');
const statusBadgeText = document.getElementById('statusBadgeText');
const btnPauseNow = document.getElementById('btnPauseNow');
const btnCancelTimer = document.getElementById('btnCancelTimer');
const statusBanner = document.getElementById('statusBanner');
const bannerIcon = document.getElementById('bannerIcon');
const bannerText = document.getElementById('bannerText');
const presetButtons = document.querySelectorAll('.preset-btn');
const customMinutesInput = document.getElementById('customMinutes');
const btnStartCustom = document.getElementById('btnStartCustom');
const specificTimeInput = document.getElementById('specificTime');
const btnStartSpecific = document.getElementById('btnStartSpecific');
const specificHint = document.getElementById('specificHint');
const tabsCountText = document.getElementById('tabsCountText');
const timerCard = document.querySelector('.timer-card');

// Local state
let timerInterval = null;
let currentEndTime = null;
let isRunning = false;
let toastTimeout = null;

// Initialize on popup open
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadState();
  updateOpenTabsInfo();
});

/**
 * Attaches UI event listeners
 */
function setupEventListeners() {
  // Preset buttons
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.getAttribute('data-minutes'), 10);
      if (minutes > 0) {
        startTimerWithMinutes(minutes);
      }
    });
  });

  // Custom minutes input
  btnStartCustom.addEventListener('click', () => {
    const mins = parseInt(customMinutesInput.value, 10);
    if (isNaN(mins) || mins <= 0) {
      showToast('Vui lòng nhập số phút hợp lệ (> 0)', 'warning');
      customMinutesInput.focus();
      return;
    }
    if (mins > 1440) {
      showToast('Thời gian tối đa là 1440 phút (24 giờ)', 'warning');
      return;
    }
    startTimerWithMinutes(mins);
    customMinutesInput.value = '';
  });

  customMinutesInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnStartCustom.click();
    }
  });

  // Specific time input
  specificTimeInput.addEventListener('input', updateSpecificTimeHint);

  btnStartSpecific.addEventListener('click', () => {
    const timeVal = specificTimeInput.value;
    if (!timeVal) {
      showToast('Vui lòng chọn giờ cụ thể', 'warning');
      specificTimeInput.focus();
      return;
    }

    const [hours, minutes] = timeVal.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    let isTomorrow = false;
    if (target.getTime() <= now.getTime()) {
      // If time has already passed today, set for tomorrow
      target.setDate(target.getDate() + 1);
      isTomorrow = true;
    }

    const durationMs = target.getTime() - now.getTime();
    startTimerWithEndTime(target.getTime(), durationMs, `${timeVal} ${isTomorrow ? '(ngày mai)' : '(hôm nay)'}`);
  });

  // Cancel timer
  btnCancelTimer.addEventListener('click', () => {
    cancelTimer();
  });

  // Pause now
  btnPauseNow.addEventListener('click', () => {
    triggerPauseNow();
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      loadState();
    }
  });

  // Listen for runtime messages (e.g. alarm finished)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'MEDIA_PAUSED') {
      handlePauseFinished(message.result);
    }
  });
}

/**
 * Dynamically hints if specific time chosen is for today or tomorrow
 */
function updateSpecificTimeHint() {
  const timeVal = specificTimeInput.value;
  if (!timeVal) {
    specificHint.textContent = 'Hôm nay / Ngày mai';
    return;
  }
  const [h, m] = timeVal.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);

  if (target.getTime() <= now.getTime()) {
    specificHint.textContent = 'Sẽ hẹn vào ngày mai';
    specificHint.style.color = '#fbbf24';
  } else {
    specificHint.textContent = 'Sẽ hẹn vào hôm nay';
    specificHint.style.color = '#34d399';
  }
}

/**
 * Loads timer state from chrome.storage.local
 */
async function loadState() {
  try {
    const data = await chrome.storage.local.get(['timerRunning', 'endTime', 'lastResult']);
    
    if (data.timerRunning && data.endTime && data.endTime > Date.now()) {
      isRunning = true;
      currentEndTime = data.endTime;
      startCountdownLoop();
      btnCancelTimer.disabled = false;
      timerCard.classList.add('active-timer');
    } else {
      isRunning = false;
      currentEndTime = null;
      stopCountdownLoop();
      btnCancelTimer.disabled = true;
      timerCard.classList.remove('active-timer');

      if (data.lastResult) {
        handlePauseFinished(data.lastResult, false);
      } else {
        setIdleUI();
      }
    }
  } catch (err) {
    console.error('Error loading state:', err);
    setIdleUI();
  }
}

/**
 * Starts timer with a given number of minutes
 */
function startTimerWithMinutes(minutes) {
  const durationMs = minutes * 60 * 1000;
  const endTime = Date.now() + durationMs;
  startTimerWithEndTime(endTime, durationMs, `${minutes} phút`);
}

/**
 * Starts timer and syncs with background service worker
 */
function startTimerWithEndTime(endTime, durationMs, labelText) {
  chrome.runtime.sendMessage({
    action: 'START_TIMER',
    durationMs: durationMs,
    endTime: endTime
  }, (response) => {
    if (response && response.success) {
      currentEndTime = endTime;
      isRunning = true;
      btnCancelTimer.disabled = false;
      timerCard.classList.add('active-timer');
      startCountdownLoop();
      showToast(`Đã hẹn giờ dừng sau ${labelText}`, 'success');
    } else {
      showToast('Không thể bắt đầu hẹn giờ', 'warning');
    }
  });
}

/**
 * Cancels active timer
 */
function cancelTimer() {
  chrome.runtime.sendMessage({ action: 'CANCEL_TIMER' }, (response) => {
    isRunning = false;
    currentEndTime = null;
    stopCountdownLoop();
    btnCancelTimer.disabled = true;
    timerCard.classList.remove('active-timer');
    setIdleUI();
    showToast('Đã hủy hẹn giờ', 'info');
  });
}

/**
 * Triggers immediate pause on all supported media tabs
 */
function triggerPauseNow() {
  btnPauseNow.disabled = true;
  btnPauseNow.classList.add('loading');

  chrome.runtime.sendMessage({ action: 'PAUSE_NOW' }, (response) => {
    btnPauseNow.disabled = false;
    btnPauseNow.classList.remove('loading');

    if (response && response.result) {
      handlePauseFinished(response.result, true);
    } else {
      showToast('Đã gửi lệnh dừng phát', 'info');
    }
    updateOpenTabsInfo();
  });
}

/**
 * Displays the result of pausing media tabs
 */
function handlePauseFinished(result, showToastMessage = true) {
  const count = result.pausedTabsCount || 0;
  const isAlarm = result.triggeredBy === 'alarm';

  let msg = '';
  if (count > 0) {
    msg = `Đã dừng phát trên ${count} tab.`;
  } else {
    msg = 'Không tìm thấy media đang phát.';
  }

  countdownDisplay.textContent = '00:00:00';
  countdownLabel.textContent = isAlarm ? `⏰ Hết giờ — ${msg}` : msg;

  updateBadgeStatus('idle', 'Đã dừng');

  if (showToastMessage) {
    showToast(msg, count > 0 ? 'success' : 'info');
  }
}

/**
 * Starts the 1-second countdown tick loop
 */
function startCountdownLoop() {
  stopCountdownLoop();
  updateCountdownTick(); // Immediate initial tick
  timerInterval = setInterval(updateCountdownTick, 1000);
}

/**
 * Stops countdown tick loop
 */
function stopCountdownLoop() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/**
 * Recomputes remaining time based on (endTime - Date.now())
 */
function updateCountdownTick() {
  if (!currentEndTime) {
    stopCountdownLoop();
    return;
  }

  const remainingMs = currentEndTime - Date.now();

  if (remainingMs <= 0) {
    stopCountdownLoop();
    isRunning = false;
    btnCancelTimer.disabled = true;
    timerCard.classList.remove('active-timer');
    countdownDisplay.textContent = '00:00:00';
    countdownLabel.textContent = 'Đang xử lý dừng media...';
    updateBadgeStatus('idle', 'Hết giờ');
    return;
  }

  // Format HH:MM:SS
  countdownDisplay.textContent = formatMsToHMS(remainingMs);

  // Subtitle showing exact scheduled time
  const targetDate = new Date(currentEndTime);
  const timeStr = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  countdownLabel.textContent = `Đang hẹn giờ — Sẽ dừng lúc ${timeStr}`;

  // Status badge update (warn if under 5 minutes)
  if (remainingMs <= 5 * 60 * 1000) {
    updateBadgeStatus('ending', 'Sắp hết giờ');
  } else {
    updateBadgeStatus('running', 'Đang hẹn giờ');
  }
}

/**
 * Sets UI to idle state (no active timer)
 */
function setIdleUI() {
  countdownDisplay.textContent = '00:00:00';
  countdownLabel.textContent = 'Chưa đặt hẹn giờ';
  updateBadgeStatus('idle', 'Chưa đặt');
  btnCancelTimer.disabled = true;
}

/**
 * Updates status badge visual styling
 */
function updateBadgeStatus(state, text) {
  statusBadge.className = 'status-badge';
  if (state === 'running') {
    statusBadge.classList.add('status-running');
  } else if (state === 'ending') {
    statusBadge.classList.add('status-ending');
  } else {
    statusBadge.classList.add('status-idle');
  }
  statusBadgeText.textContent = text;
}

/**
 * Queries background for supported tabs count
 */
function updateOpenTabsInfo() {
  chrome.runtime.sendMessage({ action: 'GET_TABS_INFO' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      tabsCountText.textContent = 'Hỗ trợ: YouTube, Spotify, SoundCloud';
      return;
    }
    const count = response.count || 0;
    if (count > 0) {
      tabsCountText.textContent = `Phát hiện: ${count} tab media đang mở`;
    } else {
      tabsCountText.textContent = 'Không có tab media nào đang mở';
    }
  });
}

/**
 * Helper to convert milliseconds to 00:00:00 format
 */
function formatMsToHMS(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

/**
 * Displays a toast banner
 */
function showToast(message, type = 'info') {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    alarm: '⏰'
  };

  bannerIcon.textContent = icons[type] || 'ℹ️';
  bannerText.textContent = message;
  statusBanner.classList.remove('hidden');

  toastTimeout = setTimeout(() => {
    statusBanner.classList.add('hidden');
  }, 4000);
}
