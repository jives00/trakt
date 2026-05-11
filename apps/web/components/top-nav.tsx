"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const topNavLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/history", label: "History" },
  { href: "/calendar", label: "Schedule" },
];

const avatarDropdownLinks = [
  { href: "/progress", label: "Progress" },
  { href: "/collection", label: "Collection" },
  { href: "/lists", label: "Lists" },
  { href: "/stats", label: "Stats" },
  { href: "/settings", label: "Settings" },
];

export function TopNav() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-white/20 bg-[#0f0f0f]/80 backdrop-blur-2xl">
      <div className="flex h-full items-center justify-between px-8 gap-8">
        {/* Left: Logo + Search Bar */}
        <div className="flex items-center gap-6 flex-1 min-w-0">
          <Link
            href="/"
            className="text-2xl font-black italic tracking-tighter text-white uppercase whitespace-nowrap"
          >
            TRAKT
          </Link>
          <form onSubmit={handleSubmit} className="flex-1 min-w-0">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies and shows…"
              className="w-full rounded-full border border-white/20 bg-white/5 px-4 py-2 text-white placeholder:text-white/40 focus:border-accent focus:outline-none transition-colors text-sm"
            />
          </form>
        </div>

        {/* Middle: Nav Links */}
        <nav className="hidden lg:flex items-center gap-8">
          {topNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-white font-medium transition-colors hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right: Avatar Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden border border-white/20 hover:border-white/40 transition-colors bg-white/5"
          >
            <Image
              src="/avatar.jpg"
              alt="User avatar"
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </button>
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-[#181818] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
              {avatarDropdownLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setShowDropdown(false)}
                  className="block w-full text-left px-4 py-3 text-white hover:bg-white/10 transition-colors text-sm font-medium border-b border-white/5 last:border-b-0"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

