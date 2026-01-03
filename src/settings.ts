/**
 * Moments Plugin - Settings
 * 
 * Defines the plugin settings interface, defaults, and settings tab UI.
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type MomentsPlugin from "./main";

/**
 * Plugin settings interface
 */
export interface MomentsSettings {
  // Storage
  /** Path to the moments file (relative to vault root) */
  storagePath: string;
  /** Auto-create the file if it doesn't exist */
  autoCreateFile: boolean;
  /** Where to insert new entries */
  insertion: "prepend" | "append";

  // Input behavior
  /** Enter key behavior: save immediately or require shift */
  enterBehavior: "enterToSave" | "shiftEnterToSave";
  /** Trim whitespace from input before saving */
  trimInput: boolean;
  /** Auto-focus the input when opening the view */
  autoFocusInput: boolean;

  // Editing
  /** Enable double-click to edit entries */
  enableDoubleClickEdit: boolean;
  /** Edit mode: inline in the list or modal dialog */
  editMode: "inline" | "modal";
  /** Show confirmation before deleting */
  confirmBeforeDelete: boolean;
  /** Show undo toast after delete */
  enableUndoToast: boolean;
  /** Undo toast duration in milliseconds */
  undoToastDuration: number;

  // Display
  /** Show timestamps in entries */
  showTimestamps: boolean;
  /** Timestamp format (moment.js format string) */
  timestampFormat: string;
  /** Maximum entries to render (for performance) */
  maxRenderCount: number;

  // Search
  /** Show the search box */
  showSearch: boolean;
  /** Search debounce delay in ms */
  searchDebounceMs: number;

  // Archive
  /** Soft delete to archive instead of permanent delete */
  softDeleteToArchive: boolean;
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: MomentsSettings = {
  // Storage
  storagePath: "Moments.md",
  autoCreateFile: true,
  insertion: "prepend",

  // Input behavior
  enterBehavior: "enterToSave",
  trimInput: true,
  autoFocusInput: true,

  // Editing
  enableDoubleClickEdit: true,
  editMode: "inline",
  confirmBeforeDelete: false,
  enableUndoToast: true,
  undoToastDuration: 5000,

  // Display
  showTimestamps: true,
  timestampFormat: "YYYY-MM-DD HH:mm",
  maxRenderCount: 200,

  // Search
  showSearch: true,
  searchDebounceMs: 200,

  // Archive
  softDeleteToArchive: false,
};

/**
 * Settings tab for the Moments plugin
 */
export class MomentsSettingTab extends PluginSettingTab {
  plugin: MomentsPlugin;

  constructor(app: App, plugin: MomentsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
    const { containerEl } = this;
		containerEl.empty();

    containerEl.createEl("h2", { text: "Moments Settings" });

    // === Storage Section ===
    containerEl.createEl("h3", { text: "Storage" });

    new Setting(containerEl)
      .setName("Storage file path")
      .setDesc("Path to the markdown file where moments are stored (relative to vault root)")
      .addText((text) =>
        text
          .setPlaceholder("Moments.md")
          .setValue(this.plugin.settings.storagePath)
          .onChange(async (value) => {
            this.plugin.settings.storagePath = value || DEFAULT_SETTINGS.storagePath;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Auto-create file")
      .setDesc("Automatically create the storage file if it doesn't exist")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoCreateFile)
          .onChange(async (value) => {
            this.plugin.settings.autoCreateFile = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("New entry position")
      .setDesc("Where to insert new entries in the file")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("prepend", "Top (newest first)")
          .addOption("append", "Bottom (oldest first)")
          .setValue(this.plugin.settings.insertion)
          .onChange(async (value: "prepend" | "append") => {
            this.plugin.settings.insertion = value;
            await this.plugin.saveSettings();
          })
      );

    // === Input Behavior Section ===
    containerEl.createEl("h3", { text: "Input behavior" });

    new Setting(containerEl)
      .setName("Enter key behavior")
      .setDesc("Choose what happens when you press Enter")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("enterToSave", "Enter to save, Shift+Enter for new line")
          .addOption("shiftEnterToSave", "Shift+Enter to save, Enter for new line")
          .setValue(this.plugin.settings.enterBehavior)
          .onChange(async (value: "enterToSave" | "shiftEnterToSave") => {
            this.plugin.settings.enterBehavior = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Trim whitespace")
      .setDesc("Remove leading and trailing whitespace from input")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.trimInput)
          .onChange(async (value) => {
            this.plugin.settings.trimInput = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Auto-focus input")
      .setDesc("Automatically focus the input field when opening the view")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoFocusInput)
          .onChange(async (value) => {
            this.plugin.settings.autoFocusInput = value;
            await this.plugin.saveSettings();
          })
      );

    // === Editing Section ===
    containerEl.createEl("h3", { text: "Editing" });

    new Setting(containerEl)
      .setName("Double-click to edit")
      .setDesc("Enable editing entries by double-clicking them")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableDoubleClickEdit)
          .onChange(async (value) => {
            this.plugin.settings.enableDoubleClickEdit = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Edit mode")
      .setDesc("How to edit entries")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("inline", "Inline (edit in place)")
          .addOption("modal", "Modal (popup dialog)")
          .setValue(this.plugin.settings.editMode)
          .onChange(async (value: "inline" | "modal") => {
            this.plugin.settings.editMode = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Confirm before delete")
      .setDesc("Show a confirmation dialog before deleting entries")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.confirmBeforeDelete)
          .onChange(async (value) => {
            this.plugin.settings.confirmBeforeDelete = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show undo toast")
      .setDesc("Show an undo option after deleting an entry")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableUndoToast)
          .onChange(async (value) => {
            this.plugin.settings.enableUndoToast = value;
            await this.plugin.saveSettings();
          })
      );

    // === Display Section ===
    containerEl.createEl("h3", { text: "Display" });

    new Setting(containerEl)
      .setName("Show timestamps")
      .setDesc("Display timestamps on entries")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showTimestamps)
          .onChange(async (value) => {
            this.plugin.settings.showTimestamps = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Timestamp format")
      .setDesc("Format for timestamps (moment.js format)")
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD HH:mm")
          .setValue(this.plugin.settings.timestampFormat)
          .onChange(async (value) => {
            this.plugin.settings.timestampFormat = value || DEFAULT_SETTINGS.timestampFormat;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Maximum entries to display")
      .setDesc("Limit the number of entries rendered for performance (0 = no limit)")
      .addText((text) =>
        text
          .setPlaceholder("200")
          .setValue(String(this.plugin.settings.maxRenderCount))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            this.plugin.settings.maxRenderCount = isNaN(num) ? DEFAULT_SETTINGS.maxRenderCount : num;
            await this.plugin.saveSettings();
          })
      );

    // === Search Section ===
    containerEl.createEl("h3", { text: "Search" });

    new Setting(containerEl)
      .setName("Show search box")
      .setDesc("Display the search/filter box in the view")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showSearch)
          .onChange(async (value) => {
            this.plugin.settings.showSearch = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Search debounce (ms)")
      .setDesc("Delay before filtering starts after typing")
      .addText((text) =>
        text
          .setPlaceholder("200")
          .setValue(String(this.plugin.settings.searchDebounceMs))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            this.plugin.settings.searchDebounceMs = isNaN(num) ? DEFAULT_SETTINGS.searchDebounceMs : num;
            await this.plugin.saveSettings();
          })
      );

    // === Archive Section ===
    containerEl.createEl("h3", { text: "Archive" });

		new Setting(containerEl)
      .setName("Soft delete to archive")
      .setDesc("Move deleted entries to an archive section instead of removing them permanently")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.softDeleteToArchive)
				.onChange(async (value) => {
            this.plugin.settings.softDeleteToArchive = value;
					await this.plugin.saveSettings();
          })
      );
	}
}
