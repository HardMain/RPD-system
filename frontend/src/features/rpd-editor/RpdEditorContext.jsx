import { createContext, useContext } from "react";

/* Общий контекст для всех inline-редакторов разделов (SectionEditor, LiteratureEditor и т.д.).
   Они работают в рамках одного RpdEditor и нуждаются в: текущей РПД, флагах прав/режима,
   функциях reload/autoFill, локальном состоянии текстовых полей. Передавать всё это
   пропсами через 9 компонентов было бы шумно. */
const RpdEditorContext = createContext(null);

export function RpdEditorProvider({ value, children }) {
  return <RpdEditorContext.Provider value={value}>{children}</RpdEditorContext.Provider>;
}

export function useRpdEditor() {
  const ctx = useContext(RpdEditorContext);
  if (!ctx) throw new Error("useRpdEditor must be used inside RpdEditorProvider");
  return ctx;
}
