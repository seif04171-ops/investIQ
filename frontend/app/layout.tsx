import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/bricolage-grotesque";
import { AuthProvider } from "@/lib/auth-context";
import { GlossaryProvider } from "@/lib/glossary-context";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "InvestIQ — Understand the market before it moves your money",
  description:
    "The investing app that explains itself. News matched to your holdings, a portfolio that teaches you, and a tutor that knows what you own.",
};

export const viewport: Viewport = {
  themeColor: "#07080B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-ink antialiased">
        <AuthProvider>
          <GlossaryProvider>
            <ToastProvider>{children}</ToastProvider>
          </GlossaryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
