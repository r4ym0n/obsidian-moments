/**
 * Capture Input Component
 * 
 * Text input for quickly capturing new moments.
 * Uses Obsidian's MarkdownEditor for full autocomplete support.
 * Supports Enter-to-save or Shift+Enter-to-save based on settings.
 */

import { EditorView } from "@codemirror/view";
import { useRef, useCallback } from "preact/hooks";
import { useSettings, useStateManager } from "../context";
import { ObsidianEditor, getEditorContent, clearEditor } from "./ObsidianEditor";

export function CaptureInput() {
  const settings = useSettings();
  const stateManager = useStateManager();
  const editorRef = useRef<EditorView>();

  const handleSave = useCallback(async () => {
    const content = getEditorContent(editorRef.current)?.trim();
    if (!content) return;

    await stateManager.addEntry(content);
    clearEditor(editorRef.current);
    
    // Keep focus on editor
    editorRef.current?.focus();
  }, [stateManager]);

  const handleEnter = useCallback(
    (cm: EditorView, mod: boolean, shift: boolean): boolean => {
      if (settings.enterBehavior === "enterToSave") {
        // Enter saves, Shift+Enter creates new line
        if (!shift && !mod) {
          handleSave();
          return true;
        }
      } else {
        // Shift+Enter saves, Enter creates new line
        if (shift) {
          handleSave();
          return true;
        }
      }
      return false; // Allow default behavior (new line)
    },
    [settings.enterBehavior, handleSave]
  );

  const handleEscape = useCallback((cm: EditorView) => {
    // Clear input on escape
    clearEditor(cm);
  }, []);

  const placeholderText =
    settings.enterBehavior === "enterToSave"
      ? "Capture a moment... (Enter to save)"
      : "Capture a moment... (Shift+Enter to save)";

  return (
    <div className="moments-capture-wrapper">
      <ObsidianEditor
        editorRef={editorRef}
        className="moments-capture-input"
        placeholder={placeholderText}
        onEnter={handleEnter}
        onEscape={handleEscape}
        onSubmit={handleSave}
      />
      <div className="moments-capture-hint">
        {settings.enterBehavior === "enterToSave"
          ? "Press Enter to save, Shift+Enter for new line"
          : "Press Shift+Enter to save, Enter for new line"}
      </div>
    </div>
  );
}
