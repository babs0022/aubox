"use client";

import Link from "next/link";
import { getActiveCaseId } from "@/lib/case-client";
import { usePathname } from "next/navigation";
import { useActiveCaseId } from "@/lib/use-active-case";
import { useSidebarState } from "@/components/dashboard/sidebar-state";

type IconProps = {
  className?: string;
};

const OverviewIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 3h8v8H3z" />
    <path d="M13 3h8v5h-8z" />
    <path d="M13 10h8v11h-8z" />
    <path d="M3 13h8v8H3z" />
  </svg>
);

const WalletIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 7a2 2 0 0 1 2-2h14a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M16 13h4" />
    <circle cx="16" cy="13" r="1" />
  </svg>
);

const TraceIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 6h6" />
    <path d="M14 6h6" />
    <path d="M7 6v12" />
    <path d="M7 18h10" />
    <path d="M13 14l4 4-4 4" />
  </svg>
);

const ClusterIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="12" cy="18" r="2" />
    <path d="M8 7.5l2.5 7" />
    <path d="M16 7.5l-2.5 7" />
    <path d="M8 6h8" />
  </svg>
);

const TimelineIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12h18" />
    <circle cx="7" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="17" cy="12" r="2" />
  </svg>
);

const GraphIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="5" cy="18" r="2" />
    <circle cx="12" cy="6" r="2" />
    <circle cx="19" cy="14" r="2" />
    <path d="M7 17l4-9" />
    <path d="M13.5 7.5l4 5" />
  </svg>
);

const ReportIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8" />
    <path d="M8 17h6" />
  </svg>
);

const SocialIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 5.8a8.5 8.5 0 0 1-2.4.7 4.2 4.2 0 0 0 1.8-2.3 8.5 8.5 0 0 1-2.7 1A4.2 4.2 0 0 0 11.5 9v.9A11.9 11.9 0 0 1 3 5.1a4.2 4.2 0 0 0 1.3 5.6A4.2 4.2 0 0 1 2.8 10v.1a4.2 4.2 0 0 0 3.4 4.1c-.4.1-.8.2-1.2.2-.3 0-.6 0-.8-.1a4.2 4.2 0 0 0 3.9 2.9A8.5 8.5 0 0 1 2 18.8 12 12 0 0 0 8.5 20c7.9 0 12.2-6.6 12.2-12.3V7A8.8 8.8 0 0 0 22 5.8z" />
  </svg>
);

const TokenIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9h6" />
    <path d="M9 15h6" />
    <path d="M12 7v10" />
  </svg>
);

const ArtifactIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 7l-5-5H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8" />
    <path d="M8 17h6" />
  </svg>
);

const GuideIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z" />
    <path d="M8 7h8" />
    <path d="M8 11h8" />
  </svg>
);

const CasesIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 7h8l2 2h8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M3 7V5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2" />
  </svg>
);

type NavItem = {
  href: string;
  label: string;
  icon: (props: IconProps) => React.JSX.Element;
  caseScoped?: boolean;
};

const toolItems: NavItem[] = [
  { href: "/profile-address", label: "Profile Address", icon: WalletIcon, caseScoped: true },
  { href: "/trace-funds", label: "Trace Funds", icon: TraceIcon, caseScoped: true },
  { href: "/cluster-entities", label: "Cluster Entities", icon: ClusterIcon, caseScoped: true },
  { href: "/token-movement", label: "Token Movement", icon: TokenIcon, caseScoped: true },
  { href: "/social-investigation", label: "Social Investigation", icon: SocialIcon, caseScoped: true },
  { href: "/artifacts", label: "Artifact Manager", icon: ArtifactIcon, caseScoped: true },
  { href: "/build-timeline", label: "Build Timeline", icon: TimelineIcon, caseScoped: true },
  { href: "/evidence-graph", label: "Evidence Graph", icon: GraphIcon, caseScoped: true },
  { href: "/generate-report", label: "Generate Report", icon: ReportIcon, caseScoped: true },
];

const resourceItems: NavItem[] = [
  { href: "", label: "Overview", icon: OverviewIcon, caseScoped: true },
  { href: "/guide", label: "Guide", icon: GuideIcon },
  { href: "/dashboard/cases", label: "Cases", icon: CasesIcon },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const { collapsed } = useSidebarState();
  const activeCaseIdHook = useActiveCaseId();
  const activeCaseId = activeCaseIdHook || getActiveCaseId();
  const supportHref = "mailto:support@aubox.app";

  const resolveHref = (item: NavItem) => {
    if (!item.caseScoped) return item.href;
    if (!activeCaseId) return "/dashboard/cases";
    const normalized = item.href.startsWith("/") ? item.href : `/${item.href}`;
    return `/dashboard/cases/${activeCaseId}${normalized}`;
  };

  const navClass = (href: string) => {
    const isActive = pathname === href;
    return `group flex items-center rounded-lg border text-sm font-semibold transition ${
      collapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2"
    } ${
      isActive
        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
        : "border-transparent bg-white text-[var(--ink)] hover:border-[var(--line)]"
    }`;
  };

  return (
    <aside className="flex h-full w-full min-w-0 flex-col">
      <div>
        {!collapsed ? <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Tools</p> : null}
        <nav className="mt-3 flex flex-col gap-2">
          {toolItems.map((item) => {
            const href = resolveHref(item);
            return (
            <Link key={item.label} href={href} className={navClass(href)} title={item.label} aria-label={item.label}>
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-5">
        {!collapsed ? <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Resources</p> : null}
        <nav className="mt-3 flex flex-col gap-2">
          {resourceItems.map((item) => {
            const href = resolveHref(item);
            return (
            <Link key={item.label} href={href} className={navClass(href)} title={item.label} aria-label={item.label}>
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="text-xs">{item.label}</span> : null}
            </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto pt-4">
        <a
          href={supportHref}
          className={`block rounded-lg border border-transparent text-[var(--muted)] transition hover:border-[var(--line)] hover:bg-white hover:text-[var(--ink)] ${
            collapsed ? "px-2 py-2 text-center text-[11px]" : "px-3 py-2 text-xs"
          }`}
          title="Need help? Contact support"
          aria-label="Need help? Contact support"
        >
          {collapsed ? "Support" : "Need help? Contact support"}
        </a>
      </div>
    </aside>
  );
}
