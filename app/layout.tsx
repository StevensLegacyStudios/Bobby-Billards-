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
