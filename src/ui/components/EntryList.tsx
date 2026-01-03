/**
 * Entry List Component
 * 
 * Displays a list of moment entries with optional search filtering.
 * Supports pagination via "Load more" button for performance.
 */

import { useEffect, useState, useCallback } from "preact/hooks";
import type { MomentEntry } from "../../types";
import { useStateManager, useSettings } from "../context";
import { EntryCard } from "./EntryCard";
import { SearchBox } from "./SearchBox";

export function EntryList() {
  const stateManager = useStateManager();
  const settings = useSettings();
  const [entries, setEntries] = useState<MomentEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [displayLimit, setDisplayLimit] = useState(settings.maxRenderCount);

  // Subscribe to state changes
  useEffect(() => {
    // Initial load
    setEntries(stateManager.getEntries());
    setTotalCount(stateManager.getAllEntries().length);

    // Subscribe to updates
    const unsubscribe = stateManager.subscribe((newEntries) => {
      setEntries(newEntries);
      setTotalCount(stateManager.getAllEntries().length);
    });

    return unsubscribe;
  }, [stateManager]);

  // Reset display limit when settings change
  useEffect(() => {
    setDisplayLimit(settings.maxRenderCount);
  }, [settings.maxRenderCount]);

  const isFiltered = stateManager.getSearchQuery().length > 0;
  
  // Calculate how many entries to show
  const entriesToShow = displayLimit > 0 
    ? entries.slice(0, displayLimit)
    : entries;
  
  const hasMore = displayLimit > 0 && entries.length > displayLimit;
  const remainingCount = entries.length - entriesToShow.length;

  const handleLoadMore = useCallback(() => {
    // Load 50 more entries
    setDisplayLimit((prev) => prev + 50);
  }, []);

  const handleLoadAll = useCallback(() => {
    // Remove limit
    setDisplayLimit(0);
  }, []);

  return (
    <>
      <SearchBox />
      <div className="moments-list-wrapper">
        {entries.length === 0 ? (
          <div className="moments-empty-state">
            <div className="moments-empty-state-icon">
              {isFiltered ? "🔍" : "✨"}
            </div>
            <p>{isFiltered ? "No matching moments" : "No moments yet"}</p>
            <p style={{ fontSize: "var(--font-ui-smaller)" }}>
              {isFiltered
                ? "Try a different search term"
                : "Capture your first thought above"}
            </p>
          </div>
        ) : (
          <div className="moments-list">
            {entriesToShow.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
            
            {hasMore && (
              <div className="moments-list-pagination">
                <div className="moments-list-more">
                  Showing {entriesToShow.length} of {entries.length} moments
                  {!isFiltered && totalCount > entries.length && (
                    <span> ({totalCount} total)</span>
                  )}
                </div>
                <div className="moments-list-pagination-buttons">
                  <button
                    className="moments-load-more-btn"
                    onClick={handleLoadMore}
                  >
                    Load more ({Math.min(50, remainingCount)})
                  </button>
                  {remainingCount > 50 && (
                    <button
                      className="moments-load-all-btn"
                      onClick={handleLoadAll}
                    >
                      Load all ({remainingCount})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
