"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type UserMenuProps = {
  displayName: string;
  initials: string;
  isAdmin: boolean;
  profileIcon?: string;
};

export default function UserMenu({ displayName, initials, isAdmin, profileIcon }: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
      setOpen(false);
    }
  };

  const menuItemClass =
    "dash-frame-soft block px-3 py-2 text-xs uppercase tracking-[0.08em] text-[var(--ink)] hover:bg-[var(--background)]";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="dash-frame flex items-center gap-3 px-3 py-2 hover:border-[var(--line-strong)]"
      >
        {profileIcon ? (
          <Image
            src={profileIcon}
            alt="Profile"
            width={36}
            height={36}
            className="h-9 w-9 border border-[var(--accent-strong)] object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center border border-[var(--accent-strong)] bg-[var(--accent)] text-sm font-bold text-white">
            {initials || "U"}
          </div>
        )}
        <div className="text-right">
          <p className="text-xs text-[var(--muted)]">Signed in as</p>
          <p className="text-sm font-semibold text-[var(--ink)]">@{displayName}</p>
        </div>
      </button>

      {open ? (
        <div className="dash-frame absolute right-0 z-30 mt-2 w-60 p-2 shadow-lg">
          <Link href="/profile" className={menuItemClass} onClick={() => setOpen(false)}>
            Profile
          </Link>
          {isAdmin ? (
            <Link href="/dashboard/admin" className={menuItemClass} onClick={() => setOpen(false)}>
              Management
            </Link>
          ) : null}
          <Link href="/dashboard/billing" className={menuItemClass} onClick={() => setOpen(false)}>
            Billing
          </Link>
          <Link href="/dashboard/invites" className={menuItemClass} onClick={() => setOpen(false)}>
            Invite Codes
          </Link>
          <Link href="/dashboard/support" className={menuItemClass} onClick={() => setOpen(false)}>
            Support
          </Link>
          <Link href="/dashboard/settings" className={menuItemClass} onClick={() => setOpen(false)}>
            Settings
          </Link>
          <Link href="/dashboard/resources" className={menuItemClass} onClick={() => setOpen(false)}>
            Resources
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="mt-2 block w-full border border-[var(--accent-strong)] bg-[var(--accent)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--paper)] hover:bg-[var(--accent-strong)] disabled:opacity-50"
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
