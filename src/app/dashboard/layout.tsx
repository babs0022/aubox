import { getUserFromSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admins";
import { getUserById } from "@/lib/azure";
import SidebarNav from "@/components/dashboard/SidebarNav";
import UserMenu from "@/components/dashboard/UserMenu";
import CollapsibleSidebar from "@/components/dashboard/CollapsibleSidebar";
import HeaderCaseSwitcher from "@/components/dashboard/HeaderCaseSwitcher";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserFromSession();
  const fullUser = user?.sub ? await getUserById(user.sub) : null;
  const displayName = user?.username || user?.name || user?.email || "investigator";
  const isAdmin = isAdminEmail(user?.email);
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="dashboard-shell flex h-screen w-full overflow-hidden">
      <CollapsibleSidebar>
        <SidebarNav />
      </CollapsibleSidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="dash-frame border-l-0 border-r-0 border-t-0 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <HeaderCaseSwitcher />
            </div>
            <div className="flex items-center gap-2">
              <UserMenu displayName={displayName} initials={initials} isAdmin={isAdmin} profileIcon={fullUser?.profileIcon} />
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
