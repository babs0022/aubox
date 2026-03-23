export const ACTIVE_CASE_KEY = "aubox_active_case_id";

export const getActiveCaseId = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_CASE_KEY);
};

export const setActiveCaseId = (caseId: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_CASE_KEY, caseId);
};

export const clearActiveCaseId = (): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_CASE_KEY);
};
