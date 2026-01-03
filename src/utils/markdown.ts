/**
 * Markdown Utilities
 * 
 * Helper functions for markdown processing and rendering.
 */

/** Tag regex: matches #tag format (Obsidian style) */
const TAG_REGEX = /#[a-zA-Z0-9_\-/]+/g;

/**
 * Check if content contains any markdown syntax that needs rendering
 * 
 * This is a quick check to avoid expensive MarkdownRenderer calls
 * for plain text content.
 */
export function containsMarkdownSyntax(content: string): boolean {
  // Check for common markdown patterns
  const markdownPatterns = [
    /\[\[.+?\]\]/, // Internal links
    /\[.+?\]\(.+?\)/, // External links
    /#[a-zA-Z0-9_\-/]+/, // Tags
    /\*\*.+?\*\*/, // Bold
    /\*.+?\*/, // Italic (but not just asterisks)
    /_.+?_/, // Italic with underscore
    /~~.+?~~/, // Strikethrough
    /`.+?`/, // Inline code
    /^>\s/, // Block quote
    /^[-*]\s/, // List item
    /^\d+\.\s/, // Numbered list
    /^#{1,6}\s/, // Headings
    /!\[\[.+?\]\]/, // Embeds
    /!\[.+?\]\(.+?\)/, // Images
  ];

  return markdownPatterns.some((pattern) => pattern.test(content));
}

/**
 * Extract tags from content
 * Returns both the tags array and the content with tags removed
 */
export function extractTags(content: string): { tags: string[]; contentWithoutTags: string } {
  const tags: string[] = [];
  const matches = content.matchAll(TAG_REGEX);
  
  for (const match of matches) {
    const tag = match[0];
    // Avoid duplicates
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }
  
  // Remove tags from content (also remove any trailing whitespace after tags)
  let contentWithoutTags = content
    .replace(new RegExp(`\\s*${TAG_REGEX.source}`, 'g'), '')
    .trim();
  
  // Clean up multiple spaces/newlines left behind
  contentWithoutTags = contentWithoutTags
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Collapse multiple blank lines
    .replace(/  +/g, ' ') // Collapse multiple spaces
    .trim();
  
  return { tags, contentWithoutTags };
}

/**
 * Check if content contains tags
 */
export function hasTags(content: string): boolean {
  return TAG_REGEX.test(content);
}

/**
 * Escape special regex characters in a string
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highlight search matches in text (for plain text content)
 * Returns HTML with <mark> tags around matches
 */
export function highlightMatches(text: string, query: string): string {
  if (!query) return text;

  const escapedQuery = escapeRegex(query);
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  return text.replace(regex, '<span class="moments-highlight">$1</span>');
}

