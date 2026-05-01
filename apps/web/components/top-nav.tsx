import Link from "next/link";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/search", label: "Search" },
  { href: "/history", label: "History" },
  { href: "/calendar", label: "Schedule" },
  { href: "/watchlist", label: "Watchlist" },
];

export function TopNav() {
  return (
    <header className="fixed top-0 z-50 w-full h-16 border-b border-white/5 bg-[#0f0f0f]/80 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-page items-center justify-between px-margin-page py-4">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-2xl font-black italic tracking-tighter text-primary-container uppercase"
          >
            TRAKT
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
