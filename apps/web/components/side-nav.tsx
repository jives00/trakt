"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/calendar", label: "Calendar", icon: "calendar_today" },
  { href: "/progress", label: "Progress", icon: "trending_up" },
  { href: "/collection", label: "Collection", icon: "video_library" },
  { href: "/lists", label: "Lists", icon: "format_list_bulleted" },
  { href: "/ratings", label: "Ratings", icon: "star" },
  { href: "/stats", label: "Stats", icon: "bar_chart" },
  { href: "/shows", label: "Shows", icon: "tv" },
  { href: "/movies", label: "Movies", icon: "movie" },
  { href: "/search", label: "Search", icon: "search" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-[#181818]/90 backdrop-blur-xl border-r border-white/5 flex-col py-6 z-40 overflow-y-auto">
      <nav className="flex flex-col gap-1 px-3">
        {navLinks.map((link) => {
          const active = link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-[#e8002d]/20 to-transparent text-[#e8002d] border-l-4 border-[#e8002d] transition-all duration-200"
                  : "flex items-center gap-3 px-4 py-3 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-all duration-200"
              }
            >
              <span className="material-symbols-outlined text-xl">{link.icon}</span>
              <span className="font-sans uppercase tracking-widest text-xs font-bold">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
