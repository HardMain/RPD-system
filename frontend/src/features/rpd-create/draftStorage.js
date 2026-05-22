const DRAFT_KEY = "createRpdDraft.v1";

export function emptySemester(number) {
  return { number, lecture: 0, lab: 0, practice: 0, ksr: 0, srs: 0, exam: 0, controls: [] };
}

export function loadDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && typeof d === "object" ? d : null;
  } catch { return null; }
}

export function saveDraft(payload) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload)); } catch {}
}

export function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
}
