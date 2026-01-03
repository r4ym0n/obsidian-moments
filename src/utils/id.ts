/**
 * Block ID Generation Utilities
 * 
 * Generates unique block IDs for Moments entries.
 * Format: m-<random alphanumeric> (6-10 chars)
 * Must comply with Obsidian block id rules: no spaces, no special chars.
 */

/** Prefix for all Moments block IDs */
export const BLOCK_ID_PREFIX = "m-";

/** Characters used for generating random part */
const CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Generate a random alphanumeric string
 */
function randomString(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

/**
 * Generate a unique block ID for a moment entry
 * Format: m-<6 chars random>
 * 
 * @param existingIds - Set of existing IDs to avoid collisions
 * @returns A unique block ID string
 */
export function generateBlockId(existingIds?: Set<string>): string {
  const maxAttempts = 100;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const id = BLOCK_ID_PREFIX + randomString(6);
    
    if (!existingIds || !existingIds.has(id)) {
      return id;
    }
  }
  
  // Fallback: use timestamp + random for guaranteed uniqueness
  return BLOCK_ID_PREFIX + Date.now().toString(36) + randomString(3);
}

/**
 * Check if a string is a valid Moments block ID
 */
export function isValidBlockId(id: string): boolean {
  return /^m-[a-z0-9]+$/.test(id);
}

/**
 * Extract block ID from a line of text
 * Block ID format: ^m-xxxxx (at end of line, with optional leading whitespace)
 */
export function extractBlockId(line: string): string | null {
  const match = line.match(/\^(m-[a-z0-9]+)\s*$/);
  return match?.[1] ?? null;
}

/**
 * Remove block ID from a string (safety net for display)
 * Handles both inline block IDs and standalone block ID lines
 */
export function removeBlockId(str: string): string {
  // Remove block ID that appears at the end of a line (inline or on its own line)
  return str
    .replace(/\s*\^m-[a-z0-9]+\s*$/gm, "") // Remove from end of lines
    .replace(/^\^m-[a-z0-9]+\s*$/gm, "")   // Remove standalone block ID lines
    .trim();
}

/**
 * Strip block ID from content and return both the content and the ID if found
 */
export function stripBlockIdFromContent(content: string): { content: string; blockId: string | null } {
  // First check for inline block ID (on the same line as content)
  const inlineMatch = content.match(/\s*\^(m-[a-z0-9]+)\s*$/);
  if (inlineMatch && inlineMatch[1]) {
    return {
      content: content.replace(/\s*\^m-[a-z0-9]+\s*$/, "").trim(),
      blockId: inlineMatch[1],
    };
  }
  
  // Check for block ID on its own line at the end
  const lines = content.split("\n");
  const lastLine = lines[lines.length - 1]?.trim() ?? "";
  const lastLineMatch = lastLine.match(/^\^(m-[a-z0-9]+)$/);
  
  if (lastLineMatch && lastLineMatch[1]) {
    lines.pop();
    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") {
      lines.pop();
    }
    return {
      content: lines.join("\n").trim(),
      blockId: lastLineMatch[1],
    };
  }
  
  return { content: content.trim(), blockId: null };
}
