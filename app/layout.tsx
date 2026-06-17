import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CarMan AI — your personal car finder",
  description:
    "CarMan AI finds real cars you can actually get — ranked by what fits your budget, credit, and commute, with the financing math done for you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
