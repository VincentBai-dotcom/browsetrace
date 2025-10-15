import type { EventPayload } from "../shared/types";

// Background script for BrowseTrace extension
console.log("BrowseTrace background script loaded");

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
