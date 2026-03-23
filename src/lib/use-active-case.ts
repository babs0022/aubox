import { useEffect, useState } from "react";
import { ACTIVE_CASE_KEY, getActiveCaseId } from "./case-client";

export const useActiveCaseId = (): string | null => {
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Initialize from localStorage
    setActiveCaseId(getActiveCaseId());
    setMounted(true);

    // Listen for custom event (dispatched by CasePicker)
    const handleCaseChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ caseId: string | null }>;
      setActiveCaseId(customEvent.detail.caseId);
    };

    window.addEventListener("caseswitched", handleCaseChange);
    return () => window.removeEventListener("caseswitched", handleCaseChange);
  }, []);

  // Only return value after mount to avoid hydration mismatch
  return mounted ? activeCaseId : null;
};
