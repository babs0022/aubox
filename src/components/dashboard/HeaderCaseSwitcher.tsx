"use client";

import { clearActiveCaseId, getActiveCaseId, setActiveCaseId } from "@/lib/case-client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CaseRecord = {
  id: string;
  title: string;
  targetAddress: string;
  chain: string;
  updatedAt: string;
};

export default function HeaderCaseSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [localActiveCaseId, setLocalActiveCaseId] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const activeCase = useMemo(
    () => cases.find((item) => item.id === localActiveCaseId) || null,
    [cases, localActiveCaseId]
  );

  useEffect(() => {
    const loadCases = async () => {
      try {
        const response = await fetch("/api/cases", { cache: "no-store" });
        if (!response.ok) return;

        const data = await response.json();
        const fetchedCases = Array.isArray(data.cases) ? (data.cases as CaseRecord[]) : [];
        setCases(fetchedCases);

        const stored = getActiveCaseId();
        const firstId = fetchedCases[0]?.id || "";
        const nextActive = stored && fetchedCases.some((item) => item.id === stored) ? stored : firstId;

        setLocalActiveCaseId(nextActive);
        if (nextActive) {
          setActiveCaseId(nextActive);
          window.dispatchEvent(new CustomEvent("caseswitched", { detail: { caseId: nextActive } }));
        }
      } catch {
        // Ignore transient API failures in header context.
      }
    };

    void loadCases();
  }, []);

  const buildCasePath = (caseId: string) => {
    const parts = pathname.split("/").filter(Boolean);
    // /cases/[caseId]/... or /dashboard/cases/[caseId]/...
    if (parts[0] === "cases" && parts[1]) {
      const suffix = parts.slice(2).join("/");
      return suffix ? `/cases/${caseId}/${suffix}` : `/cases/${caseId}`;
    }

    if (parts[0] === "dashboard" && parts[1] === "cases" && parts[2]) {
      const suffix = parts.slice(3).join("/");
      return suffix ? `/cases/${caseId}/${suffix}` : `/cases/${caseId}`;
    }

    return `/cases/${caseId}`;
  };

  const onSelectCase = (caseId: string) => {
    setLocalActiveCaseId(caseId);
    setIsOpen(false);

    if (caseId) {
      setActiveCaseId(caseId);
      router.push(buildCasePath(caseId));
    } else {
      clearActiveCaseId();
      router.push("/cases");
    }

    window.dispatchEvent(new CustomEvent("caseswitched", { detail: { caseId: caseId || null } }));
  };

  return (
    <div className="relative min-w-[260px] max-w-[520px]">
      <p className="dash-kicker">Case</p>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="dash-frame-soft mt-2 flex w-full items-center justify-between px-3 py-2 text-left"
        aria-expanded={isOpen}
      >
        <span className="truncate text-sm font-semibold text-[var(--ink)]">
          {activeCase ? `${activeCase.title} (${activeCase.chain})` : "No case selected"}
        </span>
        <span className="ml-2 text-xs text-[var(--muted)]">{isOpen ? "Hide" : "Show"}</span>
      </button>

      {isOpen ? (
        <div className="dash-frame absolute left-0 right-0 top-[74px] z-30 max-h-64 overflow-auto p-2 shadow-xl">
          {cases.length > 0 ? (
            <div className="space-y-1">
              {cases.map((item) => {
                const isSelected = localActiveCaseId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectCase(item.id)}
                    className={`w-full rounded-lg px-2 py-2 text-left text-xs transition ${
                      isSelected
                        ? "bg-[var(--accent-strong)] text-[var(--paper)]"
                        : "dash-frame-soft text-[var(--ink)] hover:bg-white"
                    }`}
                  >
                    <p className="truncate font-semibold">{item.title}</p>
                    <p className={`truncate ${isSelected ? "opacity-90" : "text-[var(--muted)]"}`}>
                      {item.targetAddress.slice(0, 8)}...{item.targetAddress.slice(-6)}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="dash-frame-soft px-2 py-2 text-xs text-[var(--muted)]">No cases found yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
