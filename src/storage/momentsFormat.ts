/**
 * Moments Format - Markdown Parsing and Serialization
 * 
 * Handles parsing Moments markdown files and serializing back to markdown.
 * The file format is the single source of truth (SoT).
 * 
 * File format:
 * ---
 * moments-plugin: true
 * ---
 * 
 * - 2026-01-02 10:21 This is a moment #tag [[Link]]
 *   Second line of content
 *   ^m-abc123
 * 
 * - 2026-01-02 09:15 Another moment
 *   ^m-def456
 * 
 * ***
 * ## Archive
 * - archived entry...
 *   ^m-xyz789
 */

import type { MomentEntry, ParsedMomentsDoc, EntrySpan, EntryId } from "../types";
import { generateBlockId, extractBlockId, stripBlockIdFromContent } from "../utils/id";
import { extractTimestampPrefix, now, formatTimestamp } from "../utils/time";

/** Frontmatter key that identifies a Moments file */
export const FRONTMATTER_KEY = "moments-plugin";

/** Archive section separator */
const ARCHIVE_SEPARATOR = "***";

/** Archive section heading */
const ARCHIVE_HEADING = "## Archive";

/** Regex to match list item start */
const LIST_ITEM_REGEX = /^- /;

/** Regex to match frontmatter boundaries */
const FRONTMATTER_REGEX = /^---\s*$/;

/**
 * Parse a Moments markdown document
 * 
 * @param text - Raw markdown text
 * @param timestampFormat - Format string for parsing timestamps
 * @returns Parsed document with entries and spans
 */
export function parseMomentsDoc(
  text: string,
  timestampFormat: string = "YYYY-MM-DD HH:mm"
): ParsedMomentsDoc {
  const result: ParsedMomentsDoc = {
    frontmatter: {},
    entries: [],
    archiveEntries: [],
    errors: [],
    originalText: text,
    spans: new Map(),
    archiveStartOffset: -1,
  };

  const lines = text.split("\n");
  let lineOffset = 0; // Track byte offset in original text
  
  let inFrontmatter = false;
  let frontmatterStarted = false;
  let frontmatterContent = "";
  
  let inArchive = false;
  let currentEntry: {
    lines: string[];
    startOffset: number;
    endOffset: number;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const lineStart = lineOffset;
    const lineEnd = lineOffset + line.length;
    
    // Track frontmatter
    if (FRONTMATTER_REGEX.test(line)) {
      if (!frontmatterStarted) {
        frontmatterStarted = true;
        inFrontmatter = true;
        lineOffset = lineEnd + 1; // +1 for newline
        continue;
      } else if (inFrontmatter) {
        inFrontmatter = false;
        result.frontmatter = parseFrontmatter(frontmatterContent);
        lineOffset = lineEnd + 1;
        continue;
      }
    }
    
    if (inFrontmatter) {
      frontmatterContent += (frontmatterContent ? "\n" : "") + line;
      lineOffset = lineEnd + 1;
      continue;
    }
    
    // Check for archive separator
    if (line.trim() === ARCHIVE_SEPARATOR) {
      // Finalize current entry before archive
      if (currentEntry) {
        const entry = finalizeEntry(currentEntry, timestampFormat, result.spans, result.errors);
        if (entry) {
          result.entries.push(entry);
        }
        currentEntry = null;
      }
      
      result.archiveStartOffset = lineStart;
      inArchive = true;
      lineOffset = lineEnd + 1;
      continue;
    }
    
    // Skip archive heading
    if (inArchive && line.trim() === ARCHIVE_HEADING) {
      lineOffset = lineEnd + 1;
      continue;
    }
    
    // Check for list item start
    if (LIST_ITEM_REGEX.test(line)) {
      // Finalize previous entry
      if (currentEntry) {
        const entry = finalizeEntry(currentEntry, timestampFormat, result.spans, result.errors);
        if (entry) {
          if (inArchive) {
            result.archiveEntries.push(entry);
          } else {
            result.entries.push(entry);
          }
        }
      }
      
      // Start new entry
      currentEntry = {
        lines: [line.substring(2)], // Remove "- " prefix
        startOffset: lineStart,
        endOffset: lineEnd,
      };
    } else if (currentEntry) {
      // Continuation line (must be indented)
      if (line.startsWith("  ") || line.trim() === "") {
        currentEntry.lines.push(line.startsWith("  ") ? line.substring(2) : line);
        currentEntry.endOffset = lineEnd;
      } else if (line.trim() !== "") {
        // Non-indented, non-empty line ends the entry
        const entry = finalizeEntry(currentEntry, timestampFormat, result.spans, result.errors);
        if (entry) {
          if (inArchive) {
            result.archiveEntries.push(entry);
          } else {
            result.entries.push(entry);
          }
        }
        currentEntry = null;
      }
    }
    
    lineOffset = lineEnd + 1; // +1 for newline
  }
  
  // Finalize last entry
  if (currentEntry) {
    const entry = finalizeEntry(currentEntry, timestampFormat, result.spans, result.errors);
    if (entry) {
      if (inArchive) {
        result.archiveEntries.push(entry);
      } else {
        result.entries.push(entry);
      }
    }
  }
  
  return result;
}

/**
 * Finalize an entry from collected lines
 */
function finalizeEntry(
  raw: { lines: string[]; startOffset: number; endOffset: number },
  timestampFormat: string,
  spans: Map<EntryId, EntrySpan>,
  errors: Array<{ message: string; context?: string }>
): MomentEntry | null {
  if (raw.lines.length === 0) return null;
  
  // Check last line for block id
  let blockId: string | null = null;
  const contentLines = [...raw.lines];
  
  const lastLine = contentLines[contentLines.length - 1];
  if (lastLine !== undefined) {
    const extractedId = extractBlockId(lastLine);
    
    if (extractedId) {
      blockId = extractedId;
      
      // Check if block id is on its own line or inline with content
      const isStandaloneBlockId = lastLine.trim() === `^${extractedId}`;
      
      if (isStandaloneBlockId) {
        // Block ID is on its own line, remove the entire line
        contentLines.pop();
        // Trim trailing empty lines
        while (contentLines.length > 0) {
          const last = contentLines[contentLines.length - 1];
          if (last !== undefined && last.trim() === "") {
            contentLines.pop();
          } else {
            break;
          }
        }
      } else {
        // Block ID is inline with content, just strip the ID
        contentLines[contentLines.length - 1] = lastLine.replace(/\s*\^m-[a-z0-9]+\s*$/, "");
      }
    }
  }
  
  let rawWithPrefix = contentLines.join("\n");
  
  if (rawWithPrefix.trim() === "") {
    return null; // Skip empty entries
  }
  
  // Safety net: use stripBlockIdFromContent to ensure no block IDs remain
  const stripped = stripBlockIdFromContent(rawWithPrefix);
  if (!blockId && stripped.blockId) {
    blockId = stripped.blockId;
  }
  rawWithPrefix = stripped.content || rawWithPrefix;
  
  // Try to extract timestamp from prefix
  const { timestamp, remainingText } = extractTimestampPrefix(rawWithPrefix, timestampFormat);
  
  // Also strip block ID from remaining text as safety net
  const strippedRemaining = stripBlockIdFromContent(remainingText || "");
  const cleanRaw = strippedRemaining.content || (remainingText || rawWithPrefix);
  
  // Generate block id if missing
  const idMissing = !blockId;
  if (!blockId) {
    blockId = generateBlockId(new Set(spans.keys()));
  }
  
  const entry: MomentEntry = {
    id: blockId,
    createdAt: timestamp ?? now(),
    raw: cleanRaw,
    rawWithPrefix,
    idMissing,
  };
  
  // Record span
  spans.set(blockId, {
    id: blockId,
    start: raw.startOffset,
    end: raw.endOffset,
  });
  
  if (idMissing) {
    errors.push({
      message: `Entry missing block id, assigned: ${blockId}`,
      context: rawWithPrefix.substring(0, 50),
    });
  }
  
  return entry;
}

/**
 * Parse YAML-like frontmatter (simple key: value pairs)
 */
function parseFrontmatter(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const line of content.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value: unknown = line.substring(colonIndex + 1).trim();
      
      // Basic type coercion
      if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (typeof value === "string" && /^\d+$/.test(value)) value = parseInt(value, 10);
      
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Create a new entry block string
 * 
 * @param content - The entry content
 * @param timestampFormat - Format for the timestamp prefix
 * @param blockId - Optional specific block id (generates one if not provided)
 * @returns Formatted entry block string (without leading "- ")
 */
export function createEntryBlock(
  content: string,
  timestampFormat: string,
  blockId?: string
): string {
  const id = blockId ?? generateBlockId();
  const timestamp = formatTimestamp(now(), timestampFormat);
  
  // Build entry with timestamp prefix
  const lines = content.split("\n");
  const firstLine = lines[0] ?? "";
  const formattedFirstLine = `${timestamp} ${firstLine}`;
  
  // Format continuation lines with proper indentation
  const formattedLines = [formattedFirstLine];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined) {
      formattedLines.push(line);
    }
  }
  
  // Add block id on its own line
  formattedLines.push(`^${id}`);
  
  return formattedLines.join("\n");
}

/**
 * Create basic frontmatter for a new Moments file
 */
export function createBasicFrontmatter(): string {
  return `---\n${FRONTMATTER_KEY}: true\n---\n\n`;
}

/**
 * Insert a new entry into the document text
 * 
 * @param text - Current document text
 * @param entryContent - The entry content (without list marker or block id)
 * @param position - Where to insert: "prepend" or "append"
 * @param timestampFormat - Format for timestamp
 * @returns Updated document text
 */
export function insertEntry(
  text: string,
  entryContent: string,
  position: "prepend" | "append",
  timestampFormat: string
): string {
  const entryBlock = createEntryBlock(entryContent, timestampFormat);
  const formattedEntry = formatEntryAsListItem(entryBlock);
  
  // Find insertion point
  const parsed = parseMomentsDoc(text, timestampFormat);
  
  if (position === "prepend") {
    // Insert after frontmatter
    const frontmatterEnd = findFrontmatterEnd(text);
    const insertPoint = frontmatterEnd >= 0 ? frontmatterEnd : 0;
    
    // Ensure proper spacing
    const before = text.substring(0, insertPoint);
    const after = text.substring(insertPoint);
    
    const needsNewlineBefore = before.length > 0 && !before.endsWith("\n\n");
    const needsNewlineAfter = after.length > 0 && !after.startsWith("\n");
    
    return (
      before +
      (needsNewlineBefore ? "\n" : "") +
      formattedEntry +
      (needsNewlineAfter ? "\n" : "") +
      after
    );
  } else {
    // Append before archive (if exists) or at end
    if (parsed.archiveStartOffset >= 0) {
      const before = text.substring(0, parsed.archiveStartOffset);
      const after = text.substring(parsed.archiveStartOffset);
      
      return before.trimEnd() + "\n\n" + formattedEntry + "\n\n" + after;
    } else {
      return text.trimEnd() + "\n\n" + formattedEntry + "\n";
    }
  }
}

/**
 * Replace an entry's content using its span
 * 
 * @param text - Current document text
 * @param span - The entry's span in the document
 * @param newContent - New content (without list marker or block id)
 * @param timestampFormat - Format for timestamp
 * @param keepOriginalTimestamp - Whether to preserve the original timestamp
 * @returns Updated document text
 */
export function replaceEntrySpan(
  text: string,
  span: EntrySpan,
  newContent: string,
  timestampFormat: string,
  keepOriginalTimestamp: boolean = true
): string {
  // Re-parse to get current entry data
  const parsed = parseMomentsDoc(text, timestampFormat);
  const existingEntry = parsed.entries.find(e => e.id === span.id) 
    ?? parsed.archiveEntries.find(e => e.id === span.id);
  
  let entryBlock: string;
  
  if (keepOriginalTimestamp && existingEntry) {
    // Preserve original timestamp
    const timestamp = formatTimestamp(existingEntry.createdAt, timestampFormat);
    const lines = newContent.split("\n");
    const firstLine = lines[0] ?? "";
    const formattedLines = [`${timestamp} ${firstLine}`, ...lines.slice(1), `^${span.id}`];
    entryBlock = formattedLines.join("\n");
  } else {
    entryBlock = createEntryBlock(newContent, timestampFormat, span.id);
  }
  
  const formattedEntry = formatEntryAsListItem(entryBlock);
  
  const before = text.substring(0, span.start);
  const after = text.substring(span.end + 1); // +1 to skip the newline
  
  return before + formattedEntry + (after.startsWith("\n") ? "" : "\n") + after;
}

/**
 * Delete an entry using its span
 * 
 * @param text - Current document text
 * @param span - The entry's span to delete
 * @returns Updated document text
 */
export function deleteEntrySpan(text: string, span: EntrySpan): string {
  const before = text.substring(0, span.start);
  let after = text.substring(span.end + 1); // +1 to include newline
  
  // Clean up extra blank lines
  if (before.endsWith("\n\n") && after.startsWith("\n")) {
    after = after.substring(1);
  }
  
  return before + after;
}

/**
 * Move an entry to the archive section
 * 
 * @param text - Current document text
 * @param span - The entry's span to archive
 * @param timestampFormat - Timestamp format
 * @returns Updated document text
 */
export function moveToArchive(
  text: string,
  span: EntrySpan,
  timestampFormat: string
): string {
  const parsed = parseMomentsDoc(text, timestampFormat);
  const entry = parsed.entries.find(e => e.id === span.id);
  
  if (!entry) {
    return text; // Entry not found, return unchanged
  }
  
  // Get the raw entry block from original text
  const entryBlock = text.substring(span.start, span.end + 1);
  
  // Remove from current position
  let newText = deleteEntrySpan(text, span);
  
  // Add archive section if it doesn't exist
  if (parsed.archiveStartOffset < 0) {
    newText = newText.trimEnd() + `\n\n${ARCHIVE_SEPARATOR}\n${ARCHIVE_HEADING}\n\n`;
  }
  
  // Append to archive
  newText = newText.trimEnd() + "\n" + entryBlock + "\n";
  
  return newText;
}

/**
 * Format an entry block as a list item with proper indentation
 */
function formatEntryAsListItem(entryBlock: string): string {
  const lines = entryBlock.split("\n");
  const formatted = lines.map((line, i) => {
    if (i === 0) {
      return `- ${line}`;
    }
    return `  ${line}`;
  });
  return formatted.join("\n");
}

/**
 * Find the end offset of frontmatter in text
 */
function findFrontmatterEnd(text: string): number {
  const lines = text.split("\n");
  let inFrontmatter = false;
  let offset = 0;
  
  for (const line of lines) {
    if (FRONTMATTER_REGEX.test(line)) {
      if (!inFrontmatter) {
        inFrontmatter = true;
      } else {
        return offset + line.length + 1; // Include the closing ---
      }
    }
    offset += line.length + 1;
  }
  
  return -1;
}

/**
 * Get the raw text block for an entry (for undo purposes)
 */
export function getEntryBlockText(text: string, span: EntrySpan): string {
  return text.substring(span.start, span.end + 1);
}
