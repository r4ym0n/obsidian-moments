/**
 * Moments App - Main Preact Component
 * 
 * The root component that assembles the Moments UI.
 */

import { MomentsContext, type MomentsContextValue } from "./context";
import { CaptureInput } from "./components/CaptureInput";
import { EntryList } from "./components/EntryList";

interface MomentsAppProps {
  context: MomentsContextValue;
}

/**
 * Main Moments application component
 */
export function MomentsApp({ context }: MomentsAppProps) {
  return (
    <MomentsContext.Provider value={context}>
      <div className="moments-container">
        <CaptureInput />
        <EntryList />
      </div>
    </MomentsContext.Provider>
  );
}
