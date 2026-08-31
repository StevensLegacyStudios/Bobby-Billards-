import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { SiteNav } from "@/components/site-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Buddy Billiards — Billiard Routing & Spatial Intelligence",
    template: "%s | Buddy Billiards",
  },
  description:
    "Find verified billiard rooms along your route, validate table conditions, and train shots on an AI-powered 3D table.",
  // Manifest + icon/apple-icon <link> tags are auto-injected by Next from
  // app/manifest.ts, app/icon.tsx, and app/apple-icon.tsx — this is the
  // part those file conventions don't cover: the older Safari-specific tags
  // that make "Add to Home Screen" launch full-screen with no address bar
  // instead of just a bookmark shortcut into a regular browser tab.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Buddy Billiards",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1a14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:pb-12">
          {children}
        </main>
      </body>
    </html>
  );
}
