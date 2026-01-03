/**
 * Markdown Renderer Component
 * 
 * Renders markdown content using Obsidian's native MarkdownRenderer.
 * Follows Kanban plugin's approach with proper class structure:
 * - Outer wrapper: moments-markdown-preview-wrapper
 * - Inner container: markdown-preview-view markdown-rendered moments-markdown-preview-view
 * 
 * Supports internal links, tags, embeds, and other Obsidian syntax.
 * Handles click events for links directly to ensure proper navigation.
 */

import { useRef, useEffect } from "preact/hooks";
import { MarkdownRenderer as ObsidianMarkdownRenderer, Component, getLinkpath, Keymap, Menu } from "obsidian";
import { useApp, useMomentsContext } from "../context";

interface MarkdownRendererProps {
  /** The markdown content to render */
  content: string;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Resolve internal links to mark unresolved ones
 */
function resolveLinks(containerEl: HTMLElement, app: any, sourcePath: string) {
  const internalLinkEls = containerEl.findAll("a.internal-link");
  for (const internalLinkEl of internalLinkEls) {
    const href = internalLinkEl.getAttr("data-href") || internalLinkEl.getAttr("href");
    if (!href) continue;
    
    const path = getLinkpath(href);
    const file = app.metadataCache.getFirstLinkpathDest(path, sourcePath);
    internalLinkEl.toggleClass("is-unresolved", !file);
  }
}

/**
 * Apply checkbox indexes for task lists (similar to Kanban)
 */
function applyCheckboxIndexes(dom: HTMLElement) {
  const checkboxes = dom.querySelectorAll<HTMLInputElement>(
    ".task-list-item-checkbox"
  );
  checkboxes.forEach((checkbox, index) => {
    checkbox.dataset.checkboxIndex = String(index);
  });
}

/**
 * Parse link info from an anchor element
 */
function parseLink(el: HTMLElement): { href: string; displayText: string } | null {
  const href = el.getAttr("data-href") || el.getAttr("href");
  if (!href) return null;
  return { href, displayText: el.getText().trim() };
}

/**
 * Bind click handlers directly to links in the rendered markdown
 * This ensures clicks work properly even within Preact components
 */
function bindLinkHandlers(containerEl: HTMLElement, app: any, sourcePath: string) {
  // Internal links
  const internalLinks = containerEl.findAll("a.internal-link");
  for (const link of internalLinks) {
    // Click handler for navigation
    link.addEventListener("click", (evt: MouseEvent) => {
      if (evt.button !== 0 && evt.button !== 1) return;
      
      const linkInfo = parseLink(link);
      if (!linkInfo) return;
      
      evt.preventDefault();
      evt.stopPropagation();
      
      app.workspace.openLinkText(linkInfo.href, sourcePath, Keymap.isModEvent(evt));
    });
    
    // Middle click handler
    link.addEventListener("auxclick", (evt: MouseEvent) => {
      if (evt.button !== 1) return;
      
      const linkInfo = parseLink(link);
      if (!linkInfo) return;
      
      evt.preventDefault();
      evt.stopPropagation();
      
      app.workspace.openLinkText(linkInfo.href, sourcePath, Keymap.isModEvent(evt));
    });
    
    // Hover handler for preview popup
    link.addEventListener("mouseover", (evt: MouseEvent) => {
      const linkInfo = parseLink(link);
      if (!linkInfo) return;
      
      app.workspace.trigger("hover-link", {
        event: evt,
        source: "preview",
        hoverParent: { hoverPopover: null },
        targetEl: link,
        linktext: linkInfo.href,
        sourcePath,
      });
    });
    
    // Context menu handler
    link.addEventListener("contextmenu", (evt: MouseEvent) => {
      const linkInfo = parseLink(link);
      if (!linkInfo) return;
      
      evt.preventDefault();
      evt.stopPropagation();
      
      const menu = new Menu();
      (menu as any).addSections(["title", "open", "action", "view", "info", "", "danger"]);
      (app.workspace as any).handleLinkContextMenu(menu, linkInfo.href, sourcePath);
      menu.showAtMouseEvent(evt);
    });
    
    // Prevent drag
    link.addEventListener("dragstart", (evt: DragEvent) => {
      evt.preventDefault();
    });
  }
  
  // External links
  const externalLinks = containerEl.findAll("a.external-link");
  for (const link of externalLinks) {
    link.addEventListener("click", (evt: MouseEvent) => {
      const linkInfo = parseLink(link);
      if (!linkInfo) return;
      
      evt.preventDefault();
      evt.stopPropagation();
      
      if (!linkInfo.href || linkInfo.href.contains(" ")) return;
      try {
        new URL(linkInfo.href);
      } catch (e) {
        return;
      }
      
      const paneType = Keymap.isModEvent(evt);
      const clickTarget = typeof paneType === "boolean" ? "" : paneType;
      window.open(linkInfo.href, clickTarget);
    });
    
    link.addEventListener("contextmenu", (evt: MouseEvent) => {
      const linkInfo = parseLink(link);
      if (!linkInfo) return;
      
      evt.preventDefault();
      evt.stopPropagation();
      
      const menu = new Menu();
      (menu as any).addSections(["title", "open", "selection", "clipboard", "action", "view", "info", "", "danger"]);
      (app.workspace as any).handleExternalLinkContextMenu(menu, linkInfo.href);
      menu.showAtMouseEvent(evt);
    });
  }
  
  // Tag links - open global search
  const tagLinks = containerEl.findAll("a.tag");
  for (const link of tagLinks) {
    link.addEventListener("click", (evt: MouseEvent) => {
      if (evt.button !== 0) return;
      
      evt.preventDefault();
      evt.stopPropagation();
      
      const tag = link.getText();
      const searchPlugin = (app as any).internalPlugins.getPluginById("global-search");
      if (searchPlugin) {
        searchPlugin.instance.openGlobalSearch(`tag:${tag}`);
      }
    });
  }
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const componentRef = useRef<Component | null>(null);
  const app = useApp();
  const { sourcePath } = useMomentsContext();

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Clear previous content
    wrapper.empty();

    // Create inner container with Kanban-style classes
    // markdown-preview-view markdown-rendered moments-markdown-preview-view
    const containerEl = wrapper.createDiv(
      "markdown-preview-view markdown-rendered moments-markdown-preview-view"
    );

    // Create a component for lifecycle management
    const component = new Component();
    componentRef.current = component;
    component.load();

    // Render markdown into the container
    ObsidianMarkdownRenderer.render(
      app,
      content,
      containerEl,
      sourcePath,
      component
    ).then(() => {
      // Post-processing after render
      resolveLinks(containerEl, app, sourcePath);
      applyCheckboxIndexes(containerEl);
      // Bind click handlers directly to links
      bindLinkHandlers(containerEl, app, sourcePath);
    });

    // Cleanup
    return () => {
      component.unload();
      componentRef.current = null;
    };
  }, [content, app, sourcePath]);

  return (
    <div
      ref={wrapperRef}
      className={`moments-markdown-preview-wrapper ${className ?? ""}`}
    />
  );
}

