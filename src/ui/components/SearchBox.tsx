/**
 * Search Box Component
 * 
 * Filter entries by search query with debouncing.
 */

import { useRef, useState, useCallback, useEffect } from "preact/hooks";
import { useSettings, useStateManager } from "../context";
import { debounce } from "../../utils/debounce";

export function SearchBox() {
  const settings = useSettings();
  const stateManager = useStateManager();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(stateManager.getSearchQuery());

  // Create debounced search function
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      stateManager.setSearchQuery(query);
    }, settings.searchDebounceMs),
    [stateManager, settings.searchDebounceMs]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleInput = useCallback(
    (e: Event) => {
      const target = e.target as HTMLInputElement;
      const newValue = target.value;
      setValue(newValue);
      debouncedSearch(newValue);
    },
    [debouncedSearch]
  );

  const handleClear = useCallback(() => {
    setValue("");
    stateManager.setSearchQuery("");
    inputRef.current?.focus();
  }, [stateManager]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClear();
    }
  }, [handleClear]);

  if (!settings.showSearch) {
    return null;
  }

  return (
    <div className="moments-search-wrapper">
      <svg
        className="moments-search-icon"
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        className="moments-search-input"
        placeholder="Search moments..."
        value={value}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
      />
      {value && (
        <button
          className="moments-search-clear"
          onClick={handleClear}
          aria-label="Clear search"
          title="Clear"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

