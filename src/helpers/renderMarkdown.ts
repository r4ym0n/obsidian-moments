/**
 * Markdown Rendering Helpers
 * 
 * Event binding for rendered markdown content, following Kanban plugin's approach.
 * Binds delegated event handlers to handle clicks on internal links, external links, and tags.
 */

import { Keymap, Menu } from "obsidian";
import type { MomentsView } from "../view/MomentsView";

/**
 * Parse link information from an anchor element
 */
function parseLink(el: HTMLElement): { href: string; displayText: string } | null {
  const href = el.getAttr("data-href") || el.getAttr("href");
  if (!href) return null;

  return {
    href,
    displayText: el.getText().trim(),
  };
}

/**
 * Apply checkbox indexes for task list items
 * This enables proper checkbox toggling in markdown content
 */
export function applyCheckboxIndexes(dom: HTMLElement): void {
  const checkboxes = dom.querySelectorAll<HTMLInputElement>(".task-list-item-checkbox");
  checkboxes.forEach((checkbox, index) => {
    checkbox.dataset.checkboxIndex = String(index);
  });
}

/**
 * Bind markdown event handlers to the view's content element
 * 
 * Handles:
 * - Internal link clicks (single click to navigate)
 * - Internal link hover (show preview popup)
 * - Internal link context menu
 * - External link clicks
 * - External link context menu
 * - Tag clicks (open global search)
 * 
 * Uses event delegation so dynamically added content will work automatically.
 */
export function bindMarkdownEvents(view: MomentsView): void {
  const { contentEl, app } = view;
  const file = view.file;

  if (!file) return;

  const sourcePath = file.path;

  // Internal link click handler
  const onLinkClick = (evt: MouseEvent, targetEl: HTMLElement) => {
    // Only handle left click (0) and middle click (1)
    if (evt.button !== 0 && evt.button !== 1) return;

    const link = parseLink(targetEl);
    if (!link) return;

    evt.preventDefault();
    evt.stopPropagation();

    // Open the link, respecting modifier keys (Ctrl/Cmd for new pane)
    app.workspace.openLinkText(link.href, sourcePath, Keymap.isModEvent(evt));
  };

  // Register internal link click handler
  contentEl.on("click", "a.internal-link", onLinkClick);
  
  // Register middle-click handler for opening in new pane
  contentEl.on("auxclick", "a.internal-link", onLinkClick);

  // Prevent drag on internal links (would interfere with card drag)
  contentEl.on("dragstart", "a.internal-link", (evt: DragEvent) => {
    evt.preventDefault();
  });

  // Internal link context menu
  contentEl.on("contextmenu", "a.internal-link", (evt: PointerEvent, targetEl: HTMLElement) => {
    const link = parseLink(targetEl);
    if (!link) return;

    const menu = new Menu();
    // Add standard sections for link context menu
    (menu as any).addSections(["title", "open", "action", "view", "info", "", "danger"]);
    // Use Obsidian's built-in link context menu handler
    (app.workspace as any).handleLinkContextMenu(menu, link.href, sourcePath);
    menu.showAtMouseEvent(evt);
  });

  // Internal link hover - show preview popup
  contentEl.on("mouseover", "a.internal-link", (evt: MouseEvent, targetEl: HTMLElement) => {
    const link = parseLink(targetEl);
    if (!link) return;

    app.workspace.trigger("hover-link", {
      event: evt,
      source: "preview",
      hoverParent: view,
      targetEl,
      linktext: link.href,
      sourcePath,
    });
  });

  // External link click handler
  contentEl.on("click", "a.external-link", (evt: MouseEvent, targetEl: HTMLElement) => {
    const link = parseLink(targetEl);
    if (!link) return;

    evt.preventDefault();
    evt.stopPropagation();

    // Validate the URL
    if (!link.href || link.href.contains(" ")) return;
    try {
      new URL(link.href);
    } catch (e) {
      return;
    }

    // Open external link, respecting modifier keys
    const paneType = Keymap.isModEvent(evt);
    const clickTarget = typeof paneType === "boolean" ? "" : paneType;
    window.open(link.href, clickTarget);
  });

  // External link context menu
  contentEl.on("contextmenu", "a.external-link", (evt: PointerEvent, targetEl: HTMLElement) => {
    const link = parseLink(targetEl);
    if (!link) return;

    const menu = new Menu();
    (menu as any).addSections([
      "title",
      "open",
      "selection",
      "clipboard",
      "action",
      "view",
      "info",
      "",
      "danger",
    ]);
    // Use Obsidian's built-in external link context menu handler
    (app.workspace as any).handleExternalLinkContextMenu(menu, link.href);
    menu.showAtMouseEvent(evt);
  });

  // Tag click handler - open global search
  contentEl.on("click", "a.tag", (evt: MouseEvent, targetEl: HTMLElement) => {
    if (evt.button !== 0) return;

    evt.preventDefault();
    evt.stopPropagation();

    const tag = targetEl.getText();
    const searchPlugin = (app as any).internalPlugins.getPluginById("global-search");

    if (searchPlugin) {
      searchPlugin.instance.openGlobalSearch(`tag:${tag}`);
    }
  });
}

