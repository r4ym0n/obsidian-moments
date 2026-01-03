/**
 * Moments Commands
 * 
 * Registers all plugin commands with Obsidian.
 */

import { WorkspaceLeaf } from "obsidian";
import type MomentsPlugin from "../main";
import { MOMENTS_VIEW_TYPE } from "../view/MomentsViewTypes";
import { MomentsView } from "../view/MomentsView";
import { ensureMomentsFile } from "../storage/momentsIO";

/**
 * Register all Moments commands
 */
export function registerCommands(plugin: MomentsPlugin): void {
  // Open Moments view
  plugin.addCommand({
    id: "open",
    name: "Open Moments",
    callback: () => openMomentsView(plugin),
  });
  
  // Quick capture - open and focus input
  plugin.addCommand({
    id: "capture",
    name: "Quick capture",
    callback: async () => {
      const view = await openMomentsView(plugin);
      if (view) {
        view.focusInput();
      }
    },
  });
  
  // Toggle search
  plugin.addCommand({
    id: "toggle-search",
    name: "Toggle search",
    checkCallback: (checking: boolean) => {
      const view = plugin.app.workspace.getActiveViewOfType(MomentsView);
      if (view) {
        if (!checking) {
          view.focusSearch();
        }
        return true;
      }
      return false;
    },
  });
}

/**
 * Open or activate the Moments view
 */
async function openMomentsView(plugin: MomentsPlugin): Promise<MomentsView | null> {
  const { workspace } = plugin.app;
  
  // Ensure the moments file exists
  const fileResult = await ensureMomentsFile(
    plugin.app,
    plugin.settings.storagePath,
    plugin.settings.autoCreateFile
  );
  
  if (!fileResult.success || !fileResult.data) {
    console.error("Failed to open Moments:", fileResult.error);
    return null;
  }
  
  const file = fileResult.data;
  
  // Check if view is already open
  const existingLeaves = workspace.getLeavesOfType(MOMENTS_VIEW_TYPE);
  
  for (const leaf of existingLeaves) {
    const view = leaf.view as MomentsView;
    if (view.file?.path === file.path) {
      // Already open, just activate
      workspace.setActiveLeaf(leaf, { focus: true });
      return view;
    }
  }
  
  // Open new view
  const leaf = workspace.getLeaf("tab");
  await leaf.openFile(file, { state: { type: MOMENTS_VIEW_TYPE } });
  
  // The view type might not be set yet, so set it
  await leaf.setViewState({
    type: MOMENTS_VIEW_TYPE,
    state: { file: file.path },
  });
  
  workspace.setActiveLeaf(leaf, { focus: true });
  
  return leaf.view as MomentsView;
}

/**
 * Get or create a leaf for the Moments view
 */
export function getMomentsLeaf(plugin: MomentsPlugin): WorkspaceLeaf {
  const { workspace } = plugin.app;
  
  // Check for existing leaf
  const existingLeaves = workspace.getLeavesOfType(MOMENTS_VIEW_TYPE);
  const existingLeaf = existingLeaves[0];
  if (existingLeaf) {
    return existingLeaf;
  }
  
  // Create new leaf
  return workspace.getLeaf("tab");
}

