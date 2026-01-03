/**
 * Entry Card Component
 * 
 * Displays a single moment entry with timestamp and actions.
 * Supports double-click to edit (inline or modal based on settings).
 * Supports right-click context menu for edit/delete.
 * Renders markdown content using Obsidian's native renderer.
 * Tags are extracted and displayed in the card footer.
 */

import { useCallback, useState, useMemo } from "preact/hooks";
import { Menu, Notice } from "obsidian";
import type { MomentEntry } from "../../types";
import { useSettings, useStateManager, useApp } from "../context";
import { formatTimestamp, relativeTime } from "../../utils/time";
import { EntryEditorInline } from "./EntryEditorInline";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { containsMarkdownSyntax, extractTags } from "../../utils/markdown";
import { removeBlockId } from "../../utils/id";

interface EntryCardProps {
  entry: MomentEntry;
}

/**
 * Tags component - displays tags in the card footer
 * Clicking a tag opens global search
 */
function Tags({ tags }: { tags: string[] }) {
  const app = useApp();
  
  if (!tags.length) return null;
  
  const handleTagClick = (e: MouseEvent, tag: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Open global search with tag
    (app as any).internalPlugins
      ?.getPluginById?.("global-search")
      ?.instance?.openGlobalSearch?.(`tag:${tag}`);
  };
  
  return (
    <div className="moments-entry-tags">
      {tags.map((tag, i) => (
        <a
          key={i}
          href={tag}
          className="tag moments-entry-tag"
          onClick={(e) => handleTagClick(e as unknown as MouseEvent, tag)}
        >
          <span>{tag[0]}</span>
          {tag.slice(1)}
        </a>
      ))}
    </div>
  );
}

export function EntryCard({ entry }: EntryCardProps) {
  const settings = useSettings();
  const stateManager = useStateManager();
  const [isEditing, setIsEditing] = useState(false);

  const handleDelete = useCallback(async () => {
    if (settings.confirmBeforeDelete) {
      if (!confirm("Delete this moment?")) {
        return;
      }
    }
    
    await stateManager.deleteEntry(entry.id);
    
    // Show undo toast if enabled
    if (settings.enableUndoToast) {
      const notice = new Notice("Moment deleted. Click to undo.", settings.undoToastDuration);
      
      // Make notice clickable for undo
      const noticeEl = (notice as unknown as { noticeEl: HTMLElement }).noticeEl;
      noticeEl.style.cursor = "pointer";
      noticeEl.addEventListener("click", async () => {
        const undone = await stateManager.undoLastDelete();
        notice.hide();
        if (undone) {
          new Notice("Moment restored.", 2000);
        }
      });
    }
  }, [entry.id, settings.confirmBeforeDelete, settings.enableUndoToast, settings.undoToastDuration, stateManager]);

  const handleDoubleClick = useCallback(() => {
    if (!settings.enableDoubleClickEdit) return;
    
    if (settings.editMode === "inline") {
      setIsEditing(true);
    } else {
      // Modal editing - for now, fall back to inline
      // Can be enhanced later with a proper modal
      setIsEditing(true);
    }
  }, [settings.enableDoubleClickEdit, settings.editMode]);

  const handleEditClose = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Context menu handler (right-click)
  const handleContextMenu = useCallback((e: MouseEvent) => {
    // Don't show context menu if clicking on a link
    const target = e.target as HTMLElement;
    if (
      target instanceof HTMLAnchorElement &&
      (target.hasClass("internal-link") || target.hasClass("external-link"))
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const menu = new Menu();

    // Edit option
    menu.addItem((item) => {
      item
        .setIcon("lucide-edit")
        .setTitle("Edit")
        .onClick(() => {
          setIsEditing(true);
        });
    });

    // Delete option
    menu.addItem((item) => {
      item
        .setIcon("lucide-trash-2")
        .setTitle("Delete")
        .onClick(() => {
          handleDelete();
        });
    });

    menu.showAtMouseEvent(e);
  }, [handleDelete]);

  const timestamp = settings.showTimestamps
    ? formatTimestamp(entry.createdAt, settings.timestampFormat)
    : null;

  const relTime = relativeTime(entry.createdAt);

  // Clean content: ensure no block IDs are displayed (safety net)
  const cleanContent = useMemo(() => removeBlockId(entry.raw), [entry.raw]);

  // Extract tags from content and get content without tags
  const { tags, contentWithoutTags } = useMemo(
    () => extractTags(cleanContent),
    [cleanContent]
  );

  // Display content with tags removed (tags shown in footer)
  const displayContent = contentWithoutTags;

  // Check if content has markdown that needs rendering
  const hasMarkdown = containsMarkdownSyntax(displayContent);

  // Render inline editor if editing
  if (isEditing) {
    return (
      <div className="moments-entry is-editing" data-id={entry.id}>
        {timestamp && (
          <div className="moments-entry-timestamp" title={relTime}>
            {timestamp}
          </div>
        )}
        <EntryEditorInline entry={entry} onClose={handleEditClose} />
      </div>
    );
  }

  return (
    <div
      className="moments-entry"
      data-id={entry.id}
      onDblClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {timestamp && (
        <div className="moments-entry-timestamp" title={relTime}>
          {timestamp}
        </div>
      )}
      <div className="moments-entry-content">
        {hasMarkdown ? (
          <MarkdownRenderer content={displayContent} />
        ) : (
          // Plain text - just render as-is (preserves whitespace)
          <span style={{ whiteSpace: "pre-wrap" }}>{displayContent}</span>
        )}
      </div>
      {/* Tags footer - only shown if there are tags */}
      {tags.length > 0 && (
        <div className="moments-entry-footer">
          <Tags tags={tags} />
        </div>
      )}
      <div className="moments-entry-actions">
        {settings.enableDoubleClickEdit && (
          <button
            className="moments-entry-action-btn"
            onClick={() => setIsEditing(true)}
            aria-label="Edit moment"
            title="Edit"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
        )}
        <button
          className="moments-entry-action-btn is-danger"
          onClick={handleDelete}
          aria-label="Delete moment"
          title="Delete"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
