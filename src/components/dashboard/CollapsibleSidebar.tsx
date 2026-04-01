"use client";

import { useState } from "react";
import { SidebarStateProvider } from "@/components/dashboard/sidebar-state";
import BrandMark from "@/components/brand/BrandMark";

type CollapsibleSidebarProps = {
  children: React.ReactNode;
};

export default function CollapsibleSidebar({ children }: CollapsibleSidebarProps) {
  const [collapsed, setCollapsed] = useState(true);

  const childrenArray = Array.isArray(children) ? children : [children];
  const content = childrenArray;

  return (
    <div
      className="relative hidden shrink-0 overflow-visible lg:block"
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
    >
      <SidebarStateProvider value={{ collapsed }}>
        <aside
          className={`dash-frame sticky top-0 h-screen transition-[width,padding] duration-300 lg:flex lg:flex-col ${
            collapsed ? "w-20 p-3" : "w-80 p-5"
          }`}
        >
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-px bg-[var(--line-strong)]" />

          <div className={collapsed ? "px-1" : ""}>
            <BrandMark href="/" compact={collapsed} showText={!collapsed} />
          </div>

          <div className={`${collapsed ? "mt-3" : "mt-4"} min-h-0 flex-1`}>{content}</div>
        </aside>
      </SidebarStateProvider>
    </div>
  );
}
