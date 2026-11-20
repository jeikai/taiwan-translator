"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth";

const links = [
  { href: "/", label: "Hội thoại" },
  { href: "/text", label: "Gõ chữ" },
  { href: "/history", label: "Lịch sử" },
];

export function NavBar({ user }: { user: SessionUser | null }) {
  const path = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <header className="panel flex shrink-0 items-center gap-1 whitespace-nowrap border-x-0 border-t-0 px-2 py-2 text-sm sm:px-3">
      <span className="mr-1 font-bold sm:mr-2">譯<span className="hidden sm:inline"> Phiên dịch</span></span>
      <nav className="flex gap-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-md px-2 py-1 ${path === l.href ? "bg-[var(--accent-soft)] font-semibold" : ""}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {user ? (
          <>
            <span className="muted hidden sm:inline">{user.name}</span>
            <button className="btn" onClick={logout}>
              Đăng xuất
            </button>
          </>
        ) : (
          <Link className="btn" href="/login">
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}
