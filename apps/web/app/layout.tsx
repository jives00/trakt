import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/top-nav";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Trakt",
  description: "Personal media tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <AuthProvider>
          <TopNav />
          <main className="pt-16 min-h-screen flex flex-col">
            {children}
            <footer className="bg-black border-t border-white/5 mt-12">
              <div className="max-w-page mx-auto px-margin-page py-10 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex flex-col items-center md:items-start gap-1">
                  <span className="text-white font-bold italic tracking-tighter">TRAKT</span>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/30">© {new Date().getFullYear()} Personal Media Tracker</p>
                </div>
                <div className="flex gap-6">
                  {["Terms", "Privacy", "Help", "API Status"].map((link) => (
                    <a key={link} href="#" className="text-[10px] uppercase tracking-[0.15em] font-semibold text-white/30 hover:text-[#e8002d] transition-colors">{link}</a>
                  ))}
                </div>
              </div>
            </footer>
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
