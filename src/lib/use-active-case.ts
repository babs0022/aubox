import { useEffect, useState } from "react";
import { getActiveCaseId } from "./case-client";

export const useActiveCaseId = (): string | null => {
  const [activeCaseId, setActiveCaseId] = useState<string | null>(() => getActiveCaseId());

  useEffect(() => {
    // Listen for custom event (dispatched by CasePicker)
    const handleCaseChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ caseId: string | null }>;
      setActiveCaseId(customEvent.detail.caseId);
    };

    window.addEventListener("caseswitched", handleCaseChange);
    return () => window.removeEventListener("caseswitched", handleCaseChange);
  }, []);

  return activeCaseId;
};
