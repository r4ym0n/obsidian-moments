/**
 * Moments View
 * 
 * Custom Obsidian view for displaying and interacting with moments.
 * Extends TextFileView to bind to a specific markdown file.
 */

import { Menu, TextFileView, WorkspaceLeaf, TFile } from "obsidian";
import { render } from "preact";
import type MomentsPlugin from "../main";
import { MomentsStateManager } from "../state/MomentsStateManager";
import { MomentsApp } from "../ui/MomentsApp";
import { MOMENTS_VIEW_TYPE, MOMENTS_ICON, MOMENTS_DISPLAY_NAME } from "./MomentsViewTypes";
import type { MomentsContextValue } from "../ui/context";

export class MomentsView extends TextFileView {
  plugin: MomentsPlugin;
  stateManager: MomentsStateManager | null = null;
  private rootEl: HTMLElement | null = null;
  
  constructor(leaf: WorkspaceLeaf, plugin: MomentsPlugin) {
    super(leaf);
    this.plugin = plugin;
  }
  
  getViewType(): string {
    return MOMENTS_VIEW_TYPE;
  }
  
  getIcon(): string {
    return MOMENTS_ICON;
  }
  
  getDisplayText(): string {
    return this.file?.basename ?? MOMENTS_DISPLAY_NAME;
  }
  
  async onOpen(): Promise<void> {
    // Create root container for Preact
    this.rootEl = this.contentEl.createDiv({ cls: "moments-root" });
  }
  
  async onClose(): Promise<void> {
    // Cleanup Preact
    if (this.rootEl) {
      render(null, this.rootEl);
      this.rootEl.remove();
      this.rootEl = null;
    }
    
    // Cleanup state manager
    if (this.stateManager) {
      this.stateManager.destroy();
      this.stateManager = null;
    }
  }
  
  /**
   * Called when the file is loaded
   */
  async onLoadFile(file: TFile): Promise<void> {
    // Initialize state manager
    this.stateManager = new MomentsStateManager(
      this.app,
      file,
      this.plugin.settings
    );
    
    await this.stateManager.initialize();
    
    // Render Preact app
    this.renderApp();
    
    // Auto-focus input if enabled
    if (this.plugin.settings.autoFocusInput) {
      // Defer to next frame to ensure DOM is ready
      requestAnimationFrame(() => {
        this.focusInput();
      });
    }
  }
  
  /**
   * Called when the file is unloaded (switching to different file)
   */
  async onUnloadFile(file: TFile): Promise<void> {
    // Cleanup state manager
    if (this.stateManager) {
      this.stateManager.destroy();
      this.stateManager = null;
    }
    
    // Clear Preact render
    if (this.rootEl) {
      render(null, this.rootEl);
    }
  }
  
  /**
   * Get the current view data (file content)
   * Required by TextFileView
   */
  getViewData(): string {
    return this.data;
  }
  
  /**
   * Set the view data (file content)
   * Called when file content changes externally
   */
  setViewData(data: string, clear: boolean): void {
    this.data = data;
    
    if (clear) {
      // File changed externally, reload state
      this.stateManager?.onExternalModify();
    }
  }
  
  /**
   * Clear the view
   */
  clear(): void {
    this.data = "";
  }
  
  /**
   * Override pane menu to add "Open as markdown" option
   */
  onPaneMenu(menu: Menu, source: string): void {
    if (source !== "more-options") {
      super.onPaneMenu(menu, source);
      return;
    }

    // Add "Open as markdown" option
    menu.addItem((item) => {
      item
        .setTitle("Open as markdown")
        .setIcon("lucide-file-text")
        .setSection("pane")
        .onClick(() => {
          if (this.file) {
            this.plugin.momentsFileModes[(this.leaf as any).id || this.file.path] = "markdown";
            this.plugin.setMarkdownView(this.leaf);
          }
        });
    });

    // Call parent to add default menu items
    super.onPaneMenu(menu, source);
  }
  
  /**
   * Render the Preact application
   */
  private renderApp(): void {
    if (!this.rootEl || !this.stateManager || !this.file) return;
    
    const context: MomentsContextValue = {
      stateManager: this.stateManager,
      settings: this.plugin.settings,
      app: this.app,
      sourcePath: this.file.path,
      plugin: this.plugin,
    };
    
    render(<MomentsApp context={context} />, this.rootEl);
  }
  
  /**
   * Re-render when settings change
   */
  onSettingsChange(): void {
    if (this.stateManager) {
      this.stateManager.updateSettings(this.plugin.settings);
    }
    this.renderApp();
  }
  
  /**
   * Focus the capture input
   */
  focusInput(): void {
    const input = this.contentEl.querySelector<HTMLTextAreaElement>(".moments-capture-input");
    input?.focus();
  }
  
  /**
   * Focus the search input
   */
  focusSearch(): void {
    const input = this.contentEl.querySelector<HTMLInputElement>(".moments-search-input");
    input?.focus();
  }
}
