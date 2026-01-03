/**
 * Markdown Renderer Component
 * 
 * Renders markdown content using Obsidian's native MarkdownRenderer.
 * Follows Kanban plugin's approach with proper class structure:
 * - Outer wrapper: moments-markdown-preview-wrapper
 * - Inner container: markdown-preview-view markdown-rendered moments-markdown-preview-view
 * 
 * Supports internal links, tags, embeds, and other Obsidian syntax.
 */

import { useRef, useEffect } from "preact/hooks";
import { MarkdownRenderer as ObsidianMarkdownRenderer, Component, getLinkpath } from "obsidian";
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

