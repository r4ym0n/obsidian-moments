/**
 * Moments Plugin - Core Types
 * 
 * These types define the data model for the plugin.
 * The Markdown file is the single source of truth (SoT).
 */

/** Entry ID - Obsidian block id format: "m-xxxxx" */
export type EntryId = string;

/**
 * A single moment entry parsed from markdown
 */
export interface MomentEntry {
  /** Unique block id (e.g., "m-abc123") */
  id: EntryId;
  
  /** Creation timestamp in epoch milliseconds */
  createdAt: number;
  
  /** Raw markdown content WITHOUT list marker and WITHOUT block id line */
  raw: string;
  
  /** Markdown content including optional timestamp prefix (what user sees in editor) */
  rawWithPrefix: string;
  
  /** Flag for entries missing block id (need to be fixed on next edit) */
  idMissing?: boolean;
}

/**
 * Span tracking for minimal-diff updates
 * Records the exact position of an entry in the source text
 */
export interface EntrySpan {
  /** Entry ID this span belongs to */
  id: EntryId;
  
  /** Start offset in source text (inclusive) */
  start: number;
  
  /** End offset in source text (exclusive) */
  end: number;
}

/**
 * Result of parsing a Moments markdown document
 */
export interface ParsedMomentsDoc {
  /** Parsed frontmatter key-value pairs */
  frontmatter: Record<string, unknown>;
  
  /** Active entries (not archived) */
  entries: MomentEntry[];
  
  /** Archived entries (after the archive separator) */
  archiveEntries: MomentEntry[];
  
  /** Parsing errors encountered */
  errors: Array<{ message: string; context?: string }>;
  
  /** Original source text snapshot */
  originalText: string;
  
  /** Map of entry id to its span in source text */
  spans: Map<EntryId, EntrySpan>;
  
  /** Offset where the archive section starts (-1 if no archive) */
  archiveStartOffset: number;
}

/**
 * Information about a deleted entry for undo functionality
 */
export interface DeletedEntryInfo {
  /** The raw entry block text (can be re-inserted) */
  entryBlock: string;
  
  /** Where to re-insert: prepend, append, or after a specific entry */
  insertionHint: 'prepend' | 'append' | 'afterId';
  
  /** If insertionHint is 'afterId', the id of the entry to insert after */
  afterId?: EntryId;
  
  /** Timestamp of deletion for expiration */
  deletedAt: number;
}

