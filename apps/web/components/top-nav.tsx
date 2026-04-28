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
    <header className="sticky top-0 z-50 w-full border-b border-outline-variant bg-surface-container-lowest/80 backdrop-blur-xl">
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
