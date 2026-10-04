/**
 * Media Sleep Timer - Background Service Worker (Manifest V3)
 * Handles alarms, background timer persistence, and multi-tab media pausing.
 */

const ALARM_NAME = 'media-sleep-timer';
const SUPPORTED_MATCH_PATTERNS = [
  'https://www.youtube.com/*',
  'https://music.youtube.com/*',
  'https://soundcloud.com/*',
  'https://open.spotify.com/*'
];

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(async () => {
  await syncStateWithStorage();
});

chrome.runtime.onStartup.addListener(async () => {
  await syncStateWithStorage();
});

/**
 * Ensures alarms and storage remain synchronized (e.g. after browser restart)
 */
async function syncStateWithStorage() {
  try {
    const data = await chrome.storage.local.get(['timerRunning', 'endTime']);
    if (data.timerRunning && data.endTime) {
      const now = Date.now();
      if (data.endTime <= now) {
        // Timer expired while browser was closed/asleep
        await pauseAllMedia(true);
      } else {
        // Re-register alarm if missing
        const existingAlarm = await chrome.alarms.get(ALARM_NAME);
        if (!existingAlarm) {
          chrome.alarms.create(ALARM_NAME, { when: data.endTime });
        }
        updateBadge(data.endTime);
      }
    } else {
      clearBadge();
    }
  } catch (err) {
    console.error('[MediaSleepTimer] Error syncing state:', err);
  }
}

/**
 * Alarm listener - executes when the sleep timer reaches 00:00:00
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('[MediaSleepTimer] Alarm triggered! Pausing media across tabs...');
    await pauseAllMedia(true);
  }
});

/**
 * Message listener for communication with popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  (async () => {
    switch (message.action) {
      case 'START_TIMER': {
        const { durationMs, endTime } = message;
        if (!endTime || endTime <= Date.now()) {
          sendResponse({ success: false, error: 'Invalid end time' });
          return;
        }

        // Set or reset alarm
        await chrome.alarms.clear(ALARM_NAME);
        chrome.alarms.create(ALARM_NAME, { when: endTime });

        // Update storage
        await chrome.storage.local.set({
          timerRunning: true,
          endTime: endTime,
          durationMs: durationMs,
          lastResult: null
        });

        updateBadge(endTime);
        sendResponse({ success: true });
        break;
      }

      case 'CANCEL_TIMER': {
        await chrome.alarms.clear(ALARM_NAME);
        await chrome.storage.local.set({
          timerRunning: false,
          endTime: null,
          durationMs: null
        });

        clearBadge();
        sendResponse({ success: true });
        break;
      }

      case 'PAUSE_NOW': {
        const result = await pauseAllMedia(false);
        sendResponse({ success: true, result });
        break;
      }

      case 'GET_TABS_INFO': {
        const tabs = await getSupportedTabs();
        sendResponse({ success: true, count: tabs.length });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  })();

  // Return true to indicate asynchronous sendResponse
  return true;
});

/**
 * Finds all open tabs matching YouTube, YouTube Music, SoundCloud, Spotify
 */
async function getSupportedTabs() {
  try {
    return await chrome.tabs.query({ url: SUPPORTED_MATCH_PATTERNS });
  } catch (err) {
    console.error('[MediaSleepTimer] Error querying tabs:', err);
    return [];
  }
}

/**
 * Pauses media on all matching tabs.
 * @param {boolean} isFromAlarm - True if triggered by scheduled alarm
 */
async function pauseAllMedia(isFromAlarm) {
  const tabs = await getSupportedTabs();
  let pausedTabsCount = 0;
  let totalChecked = tabs.length;

  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      // Execute pause logic directly inside the target tab
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: executeMediaPauseInTab
      });

      if (injectionResults && injectionResults[0] && injectionResults[0].result) {
        if (injectionResults[0].result.pausedAny) {
          pausedTabsCount++;
        }
      }
    } catch (err) {
      // Tab might be discarding, unloaded, or restricted
      console.warn(`[MediaSleepTimer] Could not execute in tab ${tab.id}:`, err.message);
    }
  }

  // Update storage state
  const resultData = {
    timestamp: Date.now(),
    pausedTabsCount: pausedTabsCount,
    totalCheckedTabs: totalChecked,
    triggeredBy: isFromAlarm ? 'alarm' : 'manual'
  };

  const updatePayload = {
    lastResult: resultData
  };

  if (isFromAlarm) {
    updatePayload.timerRunning = false;
    updatePayload.endTime = null;
    updatePayload.durationMs = null;
    await chrome.alarms.clear(ALARM_NAME);
    clearBadge();
  }

  await chrome.storage.local.set(updatePayload);

  // Broadcast to popup if open
  try {
    chrome.runtime.sendMessage({
      action: 'MEDIA_PAUSED',
      result: resultData
    }).catch(() => {});
  } catch (e) {
    // Popup might be closed
  }

  return resultData;
}

/**
 * Self-contained function injected into supported tabs.
 * Uses a multi-tiered approach to safely pause media without reloading or closing.
 */
function executeMediaPauseInTab() {
  let pausedAny = false;
  const hostname = window.location.hostname;

  // Tier 1: HTML5 Media Elements (<video> and <audio>)
  const mediaElements = Array.from(document.querySelectorAll('video, audio'));
  for (const media of mediaElements) {
    try {
      if (!media.paused && !media.ended && (media.currentTime > 0 || media.readyState > 0)) {
        media.pause();
        pausedAny = true;
      }
    } catch (e) {
      console.warn('[MediaSleepTimer] Error pausing media element:', e);
    }
  }

  // Tier 2: YouTube & YouTube Music fallbacks
  if (hostname.includes('youtube.com')) {
    // 2A. YouTube Movie Player internal API (if available on page)
    try {
      const player = document.getElementById('movie_player');
      if (player && typeof player.getPlayerState === 'function') {
        // 1 = Playing, 3 = Buffering
        if (player.getPlayerState() === 1 || player.getPlayerState() === 3) {
          if (typeof player.pauseVideo === 'function') {
            player.pauseVideo();
            pausedAny = true;
          }
        }
      }
    } catch (e) {}

    // 2B. YouTube desktop video player button fallback
    try {
      const ytpBtn = document.querySelector('.ytp-play-button');
      if (ytpBtn) {
        const label = (ytpBtn.getAttribute('aria-label') || ytpBtn.getAttribute('title') || '').toLowerCase();
        // Only click if it's currently PLAYING (so the button action is to Pause)
        const isPlaying = label.includes('pause') || label.includes('tạm dừng') ||
                          ytpBtn.dataset.titleNoTooltip?.toLowerCase().includes('pause');
        if (isPlaying) {
          ytpBtn.click();
          pausedAny = true;
        }
      }
    } catch (e) {}

    // 2C. YouTube Music play/pause button fallback
    try {
      const ytmBtn = document.querySelector('#play-pause-button, button.play-pause-button, .play-pause-button');
      if (ytmBtn) {
        const label = (ytmBtn.getAttribute('aria-label') || ytmBtn.getAttribute('title') || '').toLowerCase();
        if (label.includes('pause') || label.includes('tạm dừng')) {
          ytmBtn.click();
          pausedAny = true;
        }
      }
    } catch (e) {}
  }

  // Tier 3: Spotify Web Player fallbacks
  if (hostname.includes('spotify.com')) {
    try {
      // Robust selector based on data-testid & aria-label
      const spotifyPlayPause = document.querySelector(
        'button[data-testid="control-button-playpause"], button[aria-label*="Pause"], button[aria-label*="Tạm dừng"]'
      );
      if (spotifyPlayPause) {
        const label = (spotifyPlayPause.getAttribute('aria-label') || '').toLowerCase();
        // Check if currently playing
        const isPlaying = label.includes('pause') || label.includes('tạm dừng');
        if (isPlaying) {
          spotifyPlayPause.click();
          pausedAny = true;
        }
      }
    } catch (e) {}
  }

  // Tier 4: SoundCloud fallbacks
  if (hostname.includes('soundcloud.com')) {
    try {
      const scBtn = document.querySelector('.playControls__play, button.playControl');
      if (scBtn) {
        const title = (scBtn.getAttribute('title') || '').toLowerCase();
        const isPlaying = scBtn.classList.contains('playing') || title.includes('pause') || title.includes('tạm dừng');
        if (isPlaying) {
          scBtn.click();
          pausedAny = true;
        }
      }
    } catch (e) {}
  }

  return {
    success: true,
    pausedAny: pausedAny,
    hostname: hostname
  };
}

/**
 * Updates the extension badge text with remaining time
 */
function updateBadge(endTime) {
  if (!endTime) {
    clearBadge();
    return;
  }
  const remainingMinutes = Math.max(0, Math.ceil((endTime - Date.now()) / 60000));
  if (remainingMinutes > 0) {
    const text = remainingMinutes >= 60 ? `${Math.floor(remainingMinutes / 60)}h` : `${remainingMinutes}m`;
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' }); // Indigo
  } else {
    chrome.action.setBadgeText({ text: '0m' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' }); // Amber
  }
}

/**
 * Clears the extension badge
 */
function clearBadge() {
  chrome.action.setBadgeText({ text: '' });
}
