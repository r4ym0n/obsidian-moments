/**
 * Obsidian Editor Component
 * 
 * Wraps Obsidian's internal MarkdownEditor class to provide
 * full autocomplete support for [[links]], #tags, etc.
 * 
 * Based on Kanban plugin's MarkdownEditor implementation.
 */

import { Extension, Prec } from "@codemirror/state";
import { EditorView, ViewUpdate, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { insertBlankLine } from "@codemirror/commands";
import { useRef, useEffect } from "preact/hooks";
import { Platform } from "obsidian";
import { usePlugin, useMomentsContext } from "../context";

interface ObsidianEditorProps {
  /** Ref to access the EditorView instance */
  editorRef?: { current: EditorView | undefined };
  /** Called when Enter is pressed. Return true to prevent default behavior */
  onEnter?: (cm: EditorView, mod: boolean, shift: boolean) => boolean;
  /** Called when Escape is pressed */
  onEscape?: (cm: EditorView) => void;
  /** Called when content is submitted (via button or configured key) */
  onSubmit?: (cm: EditorView) => void;
  /** Called when content changes */
  onChange?: (update: ViewUpdate) => void;
  /** Initial value */
  value?: string;
  /** CSS class name */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
}

const noop = () => {};

/**
 * Create app proxy that disables certain features
 */
function getEditorAppProxy(app: any) {
  return new Proxy(app, {
    get(target, prop, receiver) {
      if (prop === "vault") {
        return new Proxy(app.vault, {
          get(vaultTarget, vaultProp, receiver) {
            if (vaultProp === "config") {
              return new Proxy((app.vault as any).config, {
                get(configTarget, configProp, receiver) {
                  if (["showLineNumber", "foldHeading", "foldIndent"].includes(configProp as string)) {
                    return false;
                  }
                  return Reflect.get(configTarget, configProp, receiver);
                },
              });
            }
            return Reflect.get(vaultTarget, vaultProp, receiver);
          },
        });
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Create markdown controller that mimics MarkdownView
 */
function getMarkdownController(
  app: any,
  file: any,
  getEditor: () => any
): Record<string, any> {
  return {
    app,
    showSearch: noop,
    toggleMode: noop,
    onMarkdownScroll: noop,
    getMode: () => "source",
    scroll: 0,
    editMode: null,
    get editor() {
      return getEditor();
    },
    get file() {
      return file;
    },
    get path() {
      return file?.path || "";
    },
  };
}

export function ObsidianEditor({
  editorRef,
  onEnter,
  onEscape,
  onSubmit,
  onChange,
  value,
  className,
  placeholder,
}: ObsidianEditorProps) {
  const plugin = usePlugin();
  const { app, sourcePath } = useMomentsContext();
  const elRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<EditorView>();
  const editorInstanceRef = useRef<any>(null);

  // Store callbacks in refs to avoid recreating the editor class
  const onEnterRef = useRef(onEnter);
  const onEscapeRef = useRef(onEscape);
  const onChangeRef = useRef(onChange);
  
  // Update refs when callbacks change
  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const el = elRef.current;
    if (!el || !plugin.MarkdownEditor) {
      console.warn("ObsidianEditor: Missing element or MarkdownEditor class");
      return;
    }

    const file = app.vault.getAbstractFileByPath(sourcePath);
    
    // Create custom editor class extending MarkdownEditor (like Kanban)
    class MomentsEditor extends plugin.MarkdownEditor {
      isMomentsEditor = true;

      updateBottomPadding() {
        // Disable bottom padding updates
      }

      onUpdate(update: ViewUpdate, changed: boolean) {
        super.onUpdate(update, changed);
        if (onChangeRef.current) {
          onChangeRef.current(update);
        }
      }

      buildLocalExtensions(): Extension[] {
        const extensions = super.buildLocalExtensions();

        // Add Enter keymap handler (exactly like Kanban)
        const makeEnterHandler = (mod: boolean, shift: boolean) => (cm: EditorView) => {
          if (onEnterRef.current) {
            const didRun = onEnterRef.current(cm, mod, shift);
            if (didRun) return true;
          }
          // Default: smart indent list or blank line
          if (this.app.vault.getConfig("smartIndentList")) {
            this.editor.newlineAndIndentContinueMarkdownList();
          } else {
            insertBlankLine(cm as any);
          }
          return true;
        };

        extensions.push(
          Prec.highest(
            keymap.of([
              {
                key: "Enter",
                run: makeEnterHandler(false, false),
                shift: makeEnterHandler(false, true),
                preventDefault: true,
              },
              {
                key: "Mod-Enter",
                run: makeEnterHandler(true, false),
                shift: makeEnterHandler(true, true),
                preventDefault: true,
              },
              {
                key: "Escape",
                run: (cm) => {
                  if (onEscapeRef.current) {
                    onEscapeRef.current(cm);
                  }
                  return false; // Match Kanban's behavior
                },
                preventDefault: true,
              },
            ])
          )
        );

        // Add placeholder if provided
        if (placeholder) {
          extensions.push(placeholderExt(placeholder));
        }

        return extensions;
      }
    }

    // Create controller that mimics MarkdownView (like Kanban)
    const controller = getMarkdownController(app, file, () => editorInstanceRef.current?.editor);
    
    // Create proxied app
    const appProxy = getEditorAppProxy(app);

    // Create editor using plugin.addChild for proper lifecycle management
    const editor = plugin.addChild(
      new (MomentsEditor as any)(appProxy, el, controller)
    );
    
    editorInstanceRef.current = editor;
    controller.editMode = editor;

    // Get CodeMirror EditorView
    const cm: EditorView = editor.cm;
    internalRef.current = cm;
    if (editorRef) {
      editorRef.current = cm;
    }

    // Set initial value
    editor.set(value || "");

    // Focus after a short delay
    requestAnimationFrame(() => {
      cm?.focus();
    });

    // Mobile keyboard handling
    const onShow = () => {
      el.scrollIntoView({ block: "end" });
    };

    if (Platform.isMobile) {
      cm.dom.win.addEventListener("keyboardDidShow", onShow);
    }

    // Cleanup
    return () => {
      if (Platform.isMobile) {
        cm.dom.win.removeEventListener("keyboardDidShow", onShow);
      }
      plugin.removeChild(editor);
      editorInstanceRef.current = null;
      internalRef.current = undefined;
      if (editorRef) {
        editorRef.current = undefined;
      }
    };
  }, [app, sourcePath, placeholder, plugin]);

  return (
    <>
      <div
        ref={elRef}
        className={`moments-obsidian-editor ${className || ""}`}
      />
      {Platform.isMobile && onSubmit && (
        <button
          onClick={() => internalRef.current && onSubmit(internalRef.current)}
          className="moments-submit-button mod-cta"
        >
          Submit
        </button>
      )}
    </>
  );
}

/**
 * Get the text content from an EditorView
 */
export function getEditorContent(cm: EditorView | undefined): string {
  return cm?.state.doc.toString() || "";
}

/**
 * Clear the content of an EditorView
 */
export function clearEditor(cm: EditorView | undefined): void {
  if (!cm) return;
  cm.dispatch({
    changes: {
      from: 0,
      to: cm.state.doc.length,
      insert: "",
    },
  });
}

/**
 * Set the content of an EditorView
 */
export function setEditorContent(cm: EditorView | undefined, content: string): void {
  if (!cm) return;
  cm.dispatch({
    changes: {
      from: 0,
      to: cm.state.doc.length,
      insert: content,
    },
  });
}
