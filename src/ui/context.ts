/**
 * Preact Context for Moments UI
 * 
 * Provides access to the state manager and settings throughout the component tree.
 */

import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { MomentsStateManager } from "../state/MomentsStateManager";
import type { MomentsSettings } from "../settings";
import type { App } from "obsidian";
import type MomentsPlugin from "../main";

/**
 * Context value interface
 */
export interface MomentsContextValue {
  /** The state manager instance */
  stateManager: MomentsStateManager;
  
  /** Current plugin settings */
  settings: MomentsSettings;
  
  /** Obsidian app instance */
  app: App;
  
  /** Source path for markdown rendering */
  sourcePath: string;
  
  /** Plugin instance (for MarkdownEditor access) */
  plugin: MomentsPlugin;
}

/**
 * Moments context
 */
export const MomentsContext = createContext<MomentsContextValue | null>(null);

/**
 * Hook to access the Moments context
 * Throws if used outside of MomentsContext.Provider
 */
export function useMomentsContext(): MomentsContextValue {
  const context = useContext(MomentsContext);
  
  if (!context) {
    throw new Error("useMomentsContext must be used within a MomentsContext.Provider");
  }
  
  return context;
}

/**
 * Hook to access just the state manager
 */
export function useStateManager(): MomentsStateManager {
  return useMomentsContext().stateManager;
}

/**
 * Hook to access just the settings
 */
export function useSettings(): MomentsSettings {
  return useMomentsContext().settings;
}

/**
 * Hook to access just the Obsidian app
 */
export function useApp(): App {
  return useMomentsContext().app;
}

/**
 * Hook to access the plugin instance
 */
export function usePlugin(): MomentsPlugin {
  return useMomentsContext().plugin;
}
