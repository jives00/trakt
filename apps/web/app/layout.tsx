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
          <main className="max-w-page mx-auto px-margin-page py-stack-lg">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
