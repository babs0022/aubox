"use client";

import { useState } from "react";
import { SidebarStateProvider } from "@/components/dashboard/sidebar-state";
import BrandMark from "@/components/brand/BrandMark";

type CollapsibleSidebarProps = {
  children: React.ReactNode;
};

export default function CollapsibleSidebar({ children }: CollapsibleSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const childrenArray = Array.isArray(children) ? children : [children];
  const content = childrenArray;

  return (
    <div className="relative hidden shrink-0 overflow-visible lg:block">
      <SidebarStateProvider value={{ collapsed }}>
        <aside
          className={`relative h-full bg-[var(--paper)] transition-[width,padding] duration-300 lg:flex lg:flex-col ${
            collapsed ? "w-20 p-3" : "w-80 p-5"
          }`}
        >
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-px bg-[var(--line)]" />
          <div className="pointer-events-none absolute -right-[10px] top-0 h-7 w-7 rounded-tr-2xl bg-[var(--paper)]" />

          <div className={collapsed ? "px-1" : ""}>
            <BrandMark href="/dashboard" compact={collapsed} showText={!collapsed} />
          </div>

          <div className={`${collapsed ? "mt-3" : "mt-4"} min-h-0 flex-1`}>{content}</div>
        </aside>
        <div className="absolute right-2 top-4 z-30">
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] bg-white shadow-sm transition-colors hover:border-[var(--accent)] hover:bg-[var(--paper)]"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--ink)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {collapsed ? (
                <>
                  <path d="M9 6l6 6-6 6" />
                  <path d="M5 6l6 6-6 6" />
                </>
              ) : (
                <>
                  <path d="M15 6l-6 6 6 6" />
                  <path d="M19 6l-6 6 6 6" />
                </>
              )}
            </svg>
          </button>
        </div>
      </SidebarStateProvider>
    </div>
  );
}
