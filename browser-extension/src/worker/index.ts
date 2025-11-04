import type { EventPayload, NavigateEventData } from "../shared/types";

// Background script for BrowseTrace extension
console.log("BrowseTrace background script loaded");

// Track the last active tab for tab switch detection
let lastActiveTabId: number | null = null;

// Change this to your local collector (port/path can be anything you run)
const BASE_URL = "http://127.0.0.1:8123";
const ENDPOINT = `${BASE_URL}/events`;
const HEALTH_ENDPOINT = `${BASE_URL}/healthz`;

// Health check cache
let isHealthy = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // Check every 30 seconds

/**
 * Check if the local server is healthy
 */
async function checkHealth(): Promise<boolean> {
  const now = Date.now();

  // Use cached health status if checked recently
  if (isHealthy && now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return true;
  }

  try {
    await fetch(HEALTH_ENDPOINT, {
      method: "GET",
      mode: "no-cors",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    // With no-cors mode, we can't read the response, but if fetch succeeds, assume healthy
    isHealthy = true;
    lastHealthCheck = now;
    console.log("Health check passed");
    return true;
  } catch (e) {
    console.log(`Health check failed: ${e}`);
    isHealthy = false;
    return false;
  }
}

/**
 * Forward events to your local daemon.
 * - Uses mode: "no-cors" so you don't need to set up CORS on the daemon.
 * - We omit Content-Type so the browser will send an opaque request; the body
 *   is still the JSON string (server should parse it as JSON even if header is missing).
 */
async function sendToLocalhost(payload: { events: EventPayload[] }) {
  try {
    // Check health before sending events
    const healthy = await checkHealth();
    if (!healthy) {
      console.log("Server not healthy, skipping event send");
      return;
    }

    console.log(payload);
    await fetch(ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      // Don't set non-simple headers with no-cors; just send the JSON string.
      body: JSON.stringify(payload),
      // keepalive is ignored in SW, but harmless:
      keepalive: true,
    });
  } catch (e) {
    console.log(`Failed to send to Local host due to ${e}`);
  }
}

// Accept a long-lived Port from content scripts.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "events") return;

  port.onMessage.addListener((msg) => {
    // Expect either { type: "event", event: {...} } or
    // { type: "batch", events: [...] } — send as-is with a minimal wrapper.
    if (msg?.type === "batch" && Array.isArray(msg.events)) {
      sendToLocalhost({ events: msg.events });
    } else if (msg?.type === "event" && msg.event) {
      sendToLocalhost({ events: [msg.event] });
    }
  });
});

// Tab switch detection - emits navigation events when switching between tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    // Check if capture is paused
    const { paused = false } = await chrome.storage.local.get("paused");
    if (paused) {
      // Update last active tab even when paused
      lastActiveTabId = activeInfo.tabId;
      return;
    }

    const toTabId = activeInfo.tabId;
    const fromTabId = lastActiveTabId;

    // Get the new tab information
    const toTab = await chrome.tabs.get(toTabId);

    // Only emit if we have a valid URL for the new tab
    if (
      !toTab.url ||
      toTab.url.startsWith("chrome://") ||
      toTab.url.startsWith("edge://")
    ) {
      lastActiveTabId = toTabId;
      return;
    }

    let fromUrl: string | null = null;

    // Get the previous tab information if it exists
    if (fromTabId !== null) {
      try {
        const fromTab = await chrome.tabs.get(fromTabId);
        // Only use the URL if it's not a restricted URL
        if (
          fromTab.url &&
          !fromTab.url.startsWith("chrome://") &&
          !fromTab.url.startsWith("edge://")
        ) {
          fromUrl = fromTab.url;
        }
      } catch (e) {
        // Previous tab might have been closed, that's okay
        console.log(`Previous tab ${fromTabId} not available:`, e);
      }
    }

    // Create a navigation event for the tab switch
    const now = Date.now();
    const event: EventPayload = {
      ts_utc: now,
      ts_iso: new Date(now).toISOString(),
      url: toTab.url,
      title: toTab.title || null,
      type: "navigate",
      data: {
        from: fromUrl,
        to: toTab.url,
      } as NavigateEventData,
      session_id: "tab-switch",
    };

    // Send the tab switch event
    await sendToLocalhost({ events: [event] });
    console.log(`Tab switch: ${fromUrl || "(none)"} → ${toTab.url}`);
  } catch (e) {
    console.log(`Tab switch detection error:`, e);
  } finally {
    // Always update the last active tab
    lastActiveTabId = activeInfo.tabId;
  }
});
