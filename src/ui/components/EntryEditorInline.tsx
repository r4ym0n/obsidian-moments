/**
 * Entry Editor Inline Component
 * 
 * Inline editor for editing moment entries.
 * Uses Obsidian's MarkdownEditor for full autocomplete support.
 */

import { EditorView } from "@codemirror/view";
import { useRef, useState, useCallback, useEffect } from "preact/hooks";
import type { MomentEntry } from "../../types";
import { useStateManager, useSettings } from "../context";
import { ObsidianEditor, getEditorContent, setEditorContent } from "./ObsidianEditor";

interface EntryEditorInlineProps {
  entry: MomentEntry;
  onClose: () => void;
}

export function EntryEditorInline({ entry, onClose }: EntryEditorInlineProps) {
  const stateManager = useStateManager();
  const settings = useSettings();
  const editorRef = useRef<EditorView>();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const content = getEditorContent(editorRef.current)?.trim();
    if (!content) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      await stateManager.updateEntry(entry.id, content);
      onClose();
    } finally {
      setIsSaving(false);
    }
  }, [entry.id, stateManager, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleEnter = useCallback(
    (cm: EditorView, mod: boolean, shift: boolean): boolean => {
      if (settings.enterBehavior === "enterToSave" && !shift && !mod) {
        handleSave();
        return true;
      } else if (settings.enterBehavior === "shiftEnterToSave" && shift) {
        handleSave();
        return true;
      }
      return false; // Allow default behavior (new line)
    },
    [settings.enterBehavior, handleSave]
  );

  const handleEscape = useCallback((cm: EditorView) => {
    handleCancel();
  }, [handleCancel]);

  return (
    <div className="moments-editor-inline">
      <ObsidianEditor
        editorRef={editorRef}
        className="moments-editor-textarea"
        value={entry.raw}
        onEnter={handleEnter}
        onEscape={handleEscape}
        onSubmit={handleSave}
      />
      <div className="moments-editor-actions">
        {/* <button
          className="moments-editor-btn moments-editor-btn-cancel"
          onClick={handleCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          className="moments-editor-btn moments-editor-btn-save"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save"}
        </button> */}
      </div>
    </div>
  );
}
