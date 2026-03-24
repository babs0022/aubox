import Link from "next/link";
import { getUserFromSession } from "@/lib/auth";
import SidebarNav from "@/components/dashboard/SidebarNav";
import LogoutButton from "@/components/dashboard/LogoutButton";
import CollapsibleSidebar from "@/components/dashboard/CollapsibleSidebar";
import HeaderCaseSwitcher from "@/components/dashboard/HeaderCaseSwitcher";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserFromSession();
  const displayName = user?.username || user?.name || user?.email || "investigator";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="flex min-h-screen w-full overflow-hidden">
      <CollapsibleSidebar>
        <SidebarNav />
      </CollapsibleSidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[var(--line)] bg-[var(--paper)] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <HeaderCaseSwitcher />
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/profile"
                className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2 hover:border-[var(--accent)]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
                  {initials || "U"}
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--muted)]">Signed in as</p>
                  <p className="text-sm font-semibold text-[var(--ink)]">@{displayName}</p>
                </div>
              </Link>
              <LogoutButton />
            </div>
          </div>
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <div className="mb-5 lg:hidden">
            <SidebarNav />
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
