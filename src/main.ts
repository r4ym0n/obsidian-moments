/**
 * Moments Plugin - Main Entry Point
 * 
 * A minimalist flash note / fleeting thoughts capture plugin.
 * Markdown-backed, enter-to-save, seamlessly integrated with Obsidian.
 */

import { around } from "monkey-around";
import { MarkdownView, Plugin, TFile, ViewState, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, MomentsSettings, MomentsSettingTab } from "./settings";
import { MomentsView } from "./view/MomentsView";
import { MOMENTS_VIEW_TYPE, MOMENTS_ICON } from "./view/MomentsViewTypes";
import { registerCommands } from "./commands";
import { ensureMomentsFile } from "./storage/momentsIO";
import { FRONTMATTER_KEY } from "./storage/momentsFormat";

/**
 * Get Obsidian's internal MarkdownEditor class for rich text editing
 */
function getEditorClass(app: any) {
  const md = app.embedRegistry.embedByExtension.md(
    { app, containerEl: createDiv(), state: {} },
    null,
    ''
  );

  md.load();
  md.editable = true;
  md.showEditor();

  const MarkdownEditor = Object.getPrototypeOf(Object.getPrototypeOf(md.editMode)).constructor;

  md.unload();

  return MarkdownEditor;
}

export default class MomentsPlugin extends Plugin {
  settings: MomentsSettings;
  
  /** Tracks view mode (markdown vs moments) per leaf/file */
  momentsFileModes: Record<string, string> = {};
  
  /** Obsidian's internal MarkdownEditor class for input fields */
  MarkdownEditor: any;
  
  /** Flag to track plugin loaded state */
  private _loaded = false;

  async onload() {
    await this.loadSettings();

    // Get Obsidian's MarkdownEditor class for rich input
    this.MarkdownEditor = getEditorClass(this.app);

    // Register the Moments view
    this.registerView(
      MOMENTS_VIEW_TYPE,
      (leaf) => new MomentsView(leaf, this)
    );

    // Register settings tab
    this.addSettingTab(new MomentsSettingTab(this.app, this));

    // Register commands
    registerCommands(this);

    // Add ribbon icon
    this.addRibbonIcon(MOMENTS_ICON, "Open Moments", async () => {
      await this.activateMomentsView();
    });

    // Register monkey patches for view type interception
    this.registerMonkeyPatches();

    // Register file menu events
    this.registerFileMenuEvents();

    // Register vault events for file sync
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        // Notify any open Moments views of file changes
        if (file.path === this.settings.storagePath) {
          this.app.workspace.getLeavesOfType(MOMENTS_VIEW_TYPE).forEach((leaf) => {
            const view = leaf.view as MomentsView;
            if (view.file?.path === file.path && view.stateManager) {
              view.stateManager.onExternalModify();
            }
          });
        }
      })
    );

    this._loaded = true;
  }

  onunload() {
    this._loaded = false;
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    
    // Notify all open views of settings change
    this.app.workspace.getLeavesOfType(MOMENTS_VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view as MomentsView;
      view.onSettingsChange();
    });
  }

  /**
   * Register monkey patches to intercept file opening
   * This makes Moments files open in Moments view by default
   */
  registerMonkeyPatches() {
    const self = this;

    // Monkey patch WorkspaceLeaf to open Moments files with MomentsView by default
    this.register(
      around(WorkspaceLeaf.prototype, {
        // When a leaf is detached, clean up the file mode tracking
        detach(next) {
          return function (this: WorkspaceLeaf) {
            const state = this.view?.getState();

            if (state?.file && self.momentsFileModes[(this as any).id || state.file]) {
              delete self.momentsFileModes[(this as any).id || state.file];
            }

            return next.apply(this);
          };
        },

        // Intercept setViewState to redirect Moments files to MomentsView
        setViewState(next) {
          return function (this: WorkspaceLeaf, state: ViewState, ...rest: unknown[]) {
            const stateFile = (state.state as { file?: string })?.file;
            
            if (
              // Don't intercept during shutdown
              self._loaded &&
              // Only intercept markdown view type
              state.type === "markdown" &&
              stateFile &&
              // Don't intercept if user explicitly chose markdown view
              self.momentsFileModes[(this as any).id || stateFile] !== "markdown"
            ) {
              // Check if this file has the moments frontmatter key
              const cache = self.app.metadataCache.getCache(stateFile);

              if (cache?.frontmatter && cache.frontmatter[FRONTMATTER_KEY]) {
                // Redirect to Moments view
                const newState = {
                  ...state,
                  type: MOMENTS_VIEW_TYPE,
                };

                self.momentsFileModes[stateFile] = MOMENTS_VIEW_TYPE;

                return next.apply(this, [newState, ...rest]);
              }
            }

            return next.apply(this, [state, ...rest]);
          };
        },
      })
    );
  }

  /**
   * Register file menu events for context menu items
   */
  registerFileMenuEvents() {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
        // Skip link context menus
        if (source === "link-context-menu") return;

        const fileIsFile = file instanceof TFile;
        const leafIsMarkdown = leaf?.view instanceof MarkdownView;
        const leafIsMoments = leaf?.view instanceof MomentsView;

        // When viewing a Moments file as markdown, offer to open as Moments
        if (
          fileIsFile &&
          leafIsMarkdown &&
          ["more-options", "pane-more-options", "tab-header"].includes(source) &&
          this.hasMomentsFrontmatter(file)
        ) {
          menu.addItem((item) => {
            item
              .setTitle("Open as Moments")
              .setIcon(MOMENTS_ICON)
              .setSection("pane")
              .onClick(() => {
                if (leaf) {
                  this.momentsFileModes[(leaf as any).id || file.path] = MOMENTS_VIEW_TYPE;
                  this.setMomentsView(leaf);
                }
              });
          });
        }

        // When viewing as Moments and right-clicking tab/header, offer markdown
        if (
          fileIsFile &&
          leafIsMoments &&
          ["pane-more-options", "tab-header"].includes(source)
        ) {
          menu.addItem((item) => {
            item
              .setTitle("Open as markdown")
              .setIcon("lucide-file-text")
              .setSection("pane")
              .onClick(() => {
                if (leaf) {
                  this.momentsFileModes[(leaf as any).id || file.path] = "markdown";
                  this.setMarkdownView(leaf);
                }
              });
          });
        }
      })
    );
  }

  /**
   * Check if a file has the moments-plugin frontmatter
   */
  hasMomentsFrontmatter(file: TFile): boolean {
    const cache = this.app.metadataCache.getFileCache(file);
    return !!(cache?.frontmatter && cache.frontmatter[FRONTMATTER_KEY]);
  }

  /**
   * Switch a leaf to markdown view
   */
  async setMarkdownView(leaf: WorkspaceLeaf, focus = true) {
    await leaf.setViewState(
      {
        type: "markdown",
        state: leaf.view.getState(),
        popstate: true,
      } as ViewState,
      { focus }
    );
  }

  /**
   * Switch a leaf to Moments view
   */
  async setMomentsView(leaf: WorkspaceLeaf) {
    await leaf.setViewState({
      type: MOMENTS_VIEW_TYPE,
      state: leaf.view.getState(),
      popstate: true,
    } as ViewState);
  }

  /**
   * Activate or open the Moments view
   */
  async activateMomentsView(): Promise<void> {
    const { workspace } = this.app;

    // Ensure the moments file exists
    const fileResult = await ensureMomentsFile(
      this.app,
      this.settings.storagePath,
      this.settings.autoCreateFile
    );

    if (!fileResult.success || !fileResult.data) {
      console.error("Failed to open Moments:", fileResult.error);
      return;
    }

    const file = fileResult.data;

    // Check if view is already open
    const existingLeaves = workspace.getLeavesOfType(MOMENTS_VIEW_TYPE);

    for (const leaf of existingLeaves) {
      const view = leaf.view as MomentsView;
      if (view.file?.path === file.path) {
        workspace.setActiveLeaf(leaf, { focus: true });
        return;
      }
    }

    // Open new view
    const leaf = workspace.getLeaf("tab");
    await leaf.openFile(file, { state: { type: MOMENTS_VIEW_TYPE } });
    
    await leaf.setViewState({
      type: MOMENTS_VIEW_TYPE,
      state: { file: file.path },
    });

    workspace.setActiveLeaf(leaf, { focus: true });
  }
}
