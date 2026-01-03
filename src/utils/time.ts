/**
 * Time/Timestamp Utilities
 * 
 * Handles timestamp formatting and parsing for Moments entries.
 */

import { moment } from "obsidian";

/**
 * Format a timestamp for display/storage
 * 
 * @param timestamp - Epoch milliseconds
 * @param format - moment.js format string
 * @returns Formatted timestamp string
 */
export function formatTimestamp(timestamp: number, format: string): string {
  return moment(timestamp).format(format);
}

/**
 * Parse a timestamp string to epoch milliseconds
 * 
 * @param str - Timestamp string in known format
 * @param format - moment.js format string used
 * @returns Epoch milliseconds, or null if parsing fails
 */
export function parseTimestamp(str: string, format: string): number | null {
  const parsed = moment(str, format, true);
  return parsed.isValid() ? parsed.valueOf() : null;
}

/**
 * Try to extract timestamp from the beginning of an entry
 * Supports common formats: YYYY-MM-DD HH:mm, YYYY-MM-DD, etc.
 * 
 * @param text - Entry text that may start with a timestamp
 * @param format - Expected format string
 * @returns Object with timestamp (if found) and remaining text
 */
export function extractTimestampPrefix(
  text: string,
  format: string
): { timestamp: number | null; remainingText: string } {
  // Try to match common timestamp patterns at the start
  // Pattern: timestamp followed by space or end
  const formatLength = format.replace(/\[.*?\]/g, "").length;
  
  // Try progressively shorter prefixes
  for (let len = Math.min(formatLength + 5, text.length); len >= formatLength - 2; len--) {
    const prefix = text.substring(0, len).trim();
    const parsed = moment(prefix, format, true);
    
    if (parsed.isValid()) {
      const remaining = text.substring(len).trimStart();
      return {
        timestamp: parsed.valueOf(),
        remainingText: remaining,
      };
    }
  }
  
  return { timestamp: null, remainingText: text };
}

/**
 * Get current timestamp in epoch milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Get a human-readable relative time string
 * e.g., "2 hours ago", "in 3 days"
 */
export function relativeTime(timestamp: number): string {
  return moment(timestamp).fromNow();
}

