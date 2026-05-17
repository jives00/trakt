import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/top-nav";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trakt - Personal Media Tracker",
  description: "Personal media tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" data-theme="red-dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:FILL@0..1" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var valid = ['red-dark','blue-dark','red-light','blue-light'];
              var t = localStorage.getItem('theme');
              if (t && valid.indexOf(t) !== -1) {
                document.documentElement.setAttribute('data-theme', t);
              }
            } catch(e) {}
          })();
        ` }} />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <TopNav />
            <main className="pt-16 min-h-screen flex flex-col">
              {children}
              <footer className="bg-surface-container-lowest border-t border-outline-variant/30 mt-12">
                <div className="max-w-page mx-auto px-margin-page py-10 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex flex-col items-center md:items-start gap-1">
                    <div className="flex items-center gap-2">
                      <img src="/logo-glyph.svg" alt="" width={22} height={22} className="shrink-0" />
                      <span className="text-on-surface font-bold italic tracking-tighter">TRAKT</span>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-on-surface/30">© {new Date().getFullYear()} Personal Media Tracker</p>
                  </div>
                </div>
              </footer>
            </main>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
