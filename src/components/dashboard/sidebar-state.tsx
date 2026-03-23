"use client";

import { createContext, useContext } from "react";

type SidebarState = {
  collapsed: boolean;
};

const SidebarStateContext = createContext<SidebarState>({ collapsed: false });

export function SidebarStateProvider({
  value,
  children,
}: {
  value: SidebarState;
  children: React.ReactNode;
}) {
  return <SidebarStateContext.Provider value={value}>{children}</SidebarStateContext.Provider>;
}

export function useSidebarState() {
  return useContext(SidebarStateContext);
}
