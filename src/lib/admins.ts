const ADMIN_EMAILS = new Set([
  "team@aubox.app",
  "elijah@aubox.app",
  "babseli933@gmail.com",
]);

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
};

export const getAdminEmails = (): string[] => Array.from(ADMIN_EMAILS);
