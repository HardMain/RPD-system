import { createContext, useContext } from "react";

const RpdEditorContext = createContext(null);

export function RpdEditorProvider({ value, children }) {
  return <RpdEditorContext.Provider value={value}>{children}</RpdEditorContext.Provider>;
}

export function useRpdEditor() {
  const ctx = useContext(RpdEditorContext);
  if (!ctx) throw new Error("useRpdEditor must be used inside RpdEditorProvider");
  return ctx;
}
