/**
 * Moments State Manager
 * 
 * Manages the in-memory state of moments entries and coordinates
 * with the storage layer for persistence.
 */

import { App, TFile } from "obsidian";
import type { MomentEntry, ParsedMomentsDoc, EntrySpan, DeletedEntryInfo } from "../types";
import type { MomentsSettings } from "../settings";
import {
  parseMomentsDoc,
  insertEntry,
  replaceEntrySpan,
  deleteEntrySpan,
  moveToArchive,
  getEntryBlockText,
} from "../storage/momentsFormat";
import { readMomentsFile, writeMomentsFile } from "../storage/momentsIO";

/**
 * Callback type for state change notifications
 */
export type StateChangeCallback = (entries: MomentEntry[]) => void;

/**
 * State Manager for Moments entries
 */
export class MomentsStateManager {
  private app: App;
  private file: TFile;
  private settings: MomentsSettings;
  
  /** Current parsed state */
  private parsed: ParsedMomentsDoc | null = null;
  
  /** Subscribers for state changes */
  private subscribers: Set<StateChangeCallback> = new Set();
  
  /** Write queue for serializing file operations */
  private writeQueue: Promise<void> = Promise.resolve();
  
  /** Flag to track if we triggered the last modification */
  private selfModified = false;
  
  /** Last deleted entry info for undo */
  private lastDeleted: DeletedEntryInfo | null = null;
  
  /** Search query for filtering */
  private searchQuery = "";
  
  constructor(app: App, file: TFile, settings: MomentsSettings) {
    this.app = app;
    this.file = file;
    this.settings = settings;
  }
  
  /**
   * Initialize the state manager by loading the file
   */
  async initialize(): Promise<void> {
    await this.reload();
  }
  
  /**
   * Reload state from file
   */
  async reload(): Promise<void> {
    const result = await readMomentsFile(this.app, this.file);
    
    if (result.success && result.data !== undefined) {
      this.parsed = parseMomentsDoc(result.data, this.settings.timestampFormat);
      this.notifySubscribers();
    }
  }
  
  /**
   * Update settings reference
   */
  updateSettings(settings: MomentsSettings): void {
    this.settings = settings;
  }
  
  /**
   * Get current entries (filtered if search is active)
   */
  getEntries(): MomentEntry[] {
    if (!this.parsed) return [];
    
    let entries = [...this.parsed.entries];
    
    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      entries = entries.filter(e => 
        e.rawWithPrefix.toLowerCase().includes(query)
      );
    }
    
    // Apply max render limit
    if (this.settings.maxRenderCount > 0) {
      entries = entries.slice(0, this.settings.maxRenderCount);
    }
    
    return entries;
  }
  
  /**
   * Get all entries (unfiltered)
   */
  getAllEntries(): MomentEntry[] {
    return this.parsed?.entries ?? [];
  }
  
  /**
   * Get archived entries
   */
  getArchivedEntries(): MomentEntry[] {
    return this.parsed?.archiveEntries ?? [];
  }
  
  /**
   * Set search query for filtering
   */
  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.notifySubscribers();
  }
  
  /**
   * Get current search query
   */
  getSearchQuery(): string {
    return this.searchQuery;
  }
  
  /**
   * Add a new entry
   */
  async addEntry(content: string): Promise<void> {
    if (!this.parsed) return;
    
    const trimmedContent = this.settings.trimInput ? content.trim() : content;
    if (!trimmedContent) return;
    
    await this.queueWrite(async (currentText) => {
      return insertEntry(
        currentText,
        trimmedContent,
        this.settings.insertion,
        this.settings.timestampFormat
      );
    });
  }
  
  /**
   * Update an existing entry
   */
  async updateEntry(id: string, newContent: string): Promise<void> {
    if (!this.parsed) return;
    
    const span = this.parsed.spans.get(id);
    if (!span) return;
    
    const trimmedContent = this.settings.trimInput ? newContent.trim() : newContent;
    if (!trimmedContent) return;
    
    await this.queueWrite(async (currentText) => {
      return replaceEntrySpan(
        currentText,
        span,
        trimmedContent,
        this.settings.timestampFormat,
        true // keep original timestamp
      );
    });
  }
  
  /**
   * Delete an entry
   */
  async deleteEntry(id: string): Promise<void> {
    if (!this.parsed) return;
    
    const span = this.parsed.spans.get(id);
    if (!span) return;
    
    // Store for undo
    const currentText = this.parsed.originalText;
    const entryBlock = getEntryBlockText(currentText, span);
    
    // Find previous entry for insertion hint
    const entries = this.parsed.entries;
    const index = entries.findIndex(e => e.id === id);
    let insertionHint: DeletedEntryInfo["insertionHint"] = "prepend";
    let afterId: string | undefined;
    
    if (index > 0) {
      const prevEntry = entries[index - 1];
      if (prevEntry) {
        insertionHint = "afterId";
        afterId = prevEntry.id;
      }
    } else if (index === 0 && entries.length > 1) {
      insertionHint = "prepend";
    }
    
    this.lastDeleted = {
      entryBlock,
      insertionHint,
      afterId,
      deletedAt: Date.now(),
    };
    
    if (this.settings.softDeleteToArchive) {
      await this.queueWrite(async (text) => {
        return moveToArchive(text, span, this.settings.timestampFormat);
      });
    } else {
      await this.queueWrite(async (text) => {
        return deleteEntrySpan(text, span);
      });
    }
  }
  
  /**
   * Undo the last delete operation
   */
  async undoLastDelete(): Promise<boolean> {
    if (!this.lastDeleted) return false;
    
    // Check if undo has expired (5 minutes)
    if (Date.now() - this.lastDeleted.deletedAt > 5 * 60 * 1000) {
      this.lastDeleted = null;
      return false;
    }
    
    const deleted = this.lastDeleted;
    this.lastDeleted = null;
    
    await this.queueWrite(async (currentText) => {
      // Simple re-insert at the appropriate position
      // For now, just prepend (full position restore is complex)
      const lines = currentText.split("\n");
      
      // Find insertion point after frontmatter
      let insertIndex = 0;
      let inFrontmatter = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line !== undefined && line.trim() === "---") {
          if (!inFrontmatter) {
            inFrontmatter = true;
          } else {
            insertIndex = i + 1;
            break;
          }
        }
      }
      
      // Insert the entry block
      lines.splice(insertIndex + 1, 0, "", deleted.entryBlock);
      
      return lines.join("\n");
    });
    
    return true;
  }
  
  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    if (!this.lastDeleted) return false;
    return Date.now() - this.lastDeleted.deletedAt <= 5 * 60 * 1000;
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(callback: StateChangeCallback): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  
  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {
    const entries = this.getEntries();
    this.subscribers.forEach(cb => cb(entries));
  }
  
  /**
   * Queue a write operation (serializes file writes)
   */
  private async queueWrite(
    transform: (currentText: string) => Promise<string> | string
  ): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        // Read current file content
        const result = await readMomentsFile(this.app, this.file);
        if (!result.success || result.data === undefined) {
          console.error("Failed to read file for write:", result.error);
          return;
        }
        
        // Transform content
        const newContent = await transform(result.data);
        
        // Mark as self-modified to avoid re-parsing loop
        this.selfModified = true;
        
        // Write back
        const writeResult = await writeMomentsFile(this.app, this.file, newContent);
        if (!writeResult.success) {
          console.error("Failed to write file:", writeResult.error);
          return;
        }
        
        // Re-parse to update state
        this.parsed = parseMomentsDoc(newContent, this.settings.timestampFormat);
        this.notifySubscribers();
        
      } finally {
        this.selfModified = false;
      }
    });
    
    await this.writeQueue;
  }
  
  /**
   * Handle external file modification
   */
  async onExternalModify(): Promise<void> {
    // Skip if we triggered this modification
    if (this.selfModified) return;
    
    await this.reload();
  }
  
  /**
   * Get parsing errors (if any)
   */
  getErrors(): Array<{ message: string; context?: string }> {
    return this.parsed?.errors ?? [];
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    this.subscribers.clear();
    this.parsed = null;
    this.lastDeleted = null;
  }
}

