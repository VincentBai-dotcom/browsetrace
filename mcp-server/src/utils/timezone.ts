/**
 * Timezone utilities for converting UTC timestamps to local time
 */

// Cache the timezone to avoid repeated lookups
const LOCAL_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Reusable formatter instance for performance (avoids creating new formatter per conversion)
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
  timeZone: LOCAL_TIMEZONE,
  timeZoneName: 'short',
});

/**
 * Get the system's local timezone
 */
export function getLocalTimezone(): string {
  return LOCAL_TIMEZONE;
}

/**
 * Format a timestamp in human-readable local time
 * @param timestamp - Unix timestamp in milliseconds or ISO string
 * @returns Formatted string like "Nov 16, 2025 3:30:45 PM PST"
 */
export function formatLocalTime(timestamp: number | string): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  return dateFormatter.format(date);
}

/**
 * Get timezone abbreviation (e.g., "PST", "EST")
 */
export function getTimezoneAbbreviation(): string {
  const parts = dateFormatter.formatToParts(new Date());
  const tzPart = parts.find(part => part.type === 'timeZoneName');
  return tzPart?.value || 'UTC';
}
