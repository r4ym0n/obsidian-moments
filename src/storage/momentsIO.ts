/**
 * Moments IO - Vault File Operations
 * 
 * Handles reading and writing the Moments file to the vault.
 * Provides a clean interface for file operations with error handling.
 */

import { App, TFile, TFolder, normalizePath } from "obsidian";
import { createBasicFrontmatter, FRONTMATTER_KEY } from "./momentsFormat";

/**
 * Result of a file operation
 */
export interface FileOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Ensure the Moments file exists, creating it if necessary
 * 
 * @param app - Obsidian app instance
 * @param path - Path to the moments file
 * @param autoCreate - Whether to auto-create if missing
 * @returns The file if it exists/was created, or null
 */
export async function ensureMomentsFile(
  app: App,
  path: string,
  autoCreate: boolean
): Promise<FileOperationResult<TFile>> {
  const normalizedPath = normalizePath(path);
  
  // Check if file exists
  const existingFile = app.vault.getAbstractFileByPath(normalizedPath);
  
  if (existingFile instanceof TFile) {
    return { success: true, data: existingFile };
  }
  
  if (!autoCreate) {
    return { 
      success: false, 
      error: `File not found: ${normalizedPath}` 
    };
  }
  
  // Create the file
  try {
    // Ensure parent folder exists
    const folderPath = normalizedPath.substring(0, normalizedPath.lastIndexOf("/"));
    if (folderPath) {
      await ensureFolder(app, folderPath);
    }
    
    // Create file with basic frontmatter
    const content = createBasicFrontmatter();
    const file = await app.vault.create(normalizedPath, content);
    
    return { success: true, data: file };
  } catch (e) {
    return { 
      success: false, 
      error: `Failed to create file: ${e instanceof Error ? e.message : String(e)}` 
    };
  }
}

/**
 * Ensure a folder exists, creating it if necessary
 */
async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const normalizedPath = normalizePath(folderPath);
  const existing = app.vault.getAbstractFileByPath(normalizedPath);
  
  if (existing instanceof TFolder) {
    return;
  }
  
  // Create folder recursively
  await app.vault.createFolder(normalizedPath);
}

/**
 * Read the contents of the Moments file
 * 
 * @param app - Obsidian app instance
 * @param file - The file to read
 * @returns File contents or error
 */
export async function readMomentsFile(
  app: App,
  file: TFile
): Promise<FileOperationResult<string>> {
  try {
    const content = await app.vault.read(file);
    return { success: true, data: content };
  } catch (e) {
    return {
      success: false,
      error: `Failed to read file: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Write content to the Moments file
 * 
 * @param app - Obsidian app instance
 * @param file - The file to write
 * @param content - New content
 * @returns Success or error
 */
export async function writeMomentsFile(
  app: App,
  file: TFile,
  content: string
): Promise<FileOperationResult> {
  try {
    await app.vault.modify(file, content);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: `Failed to write file: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Check if a file is a Moments file by checking its frontmatter
 * 
 * @param app - Obsidian app instance
 * @param file - File to check
 * @returns True if the file has moments-plugin: true in frontmatter
 */
export async function isMomentsFile(app: App, file: TFile): Promise<boolean> {
  try {
    const content = await app.vault.read(file);
    
    // Quick check for frontmatter key
    if (!content.includes(FRONTMATTER_KEY)) {
      return false;
    }
    
    // Parse frontmatter
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      return false;
    }
    
    const frontmatter = match[1];
    if (!frontmatter) {
      return false;
    }
    
    return frontmatter.includes(`${FRONTMATTER_KEY}: true`) || 
           frontmatter.includes(`${FRONTMATTER_KEY}:true`);
  } catch {
    return false;
  }
}

/**
 * Get a TFile by path, returning null if not found or not a file
 */
export function getFileByPath(app: App, path: string): TFile | null {
  const normalizedPath = normalizePath(path);
  const file = app.vault.getAbstractFileByPath(normalizedPath);
  return file instanceof TFile ? file : null;
}
