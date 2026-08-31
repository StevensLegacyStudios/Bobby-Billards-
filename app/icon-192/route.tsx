import { ImageResponse } from "next/og";

import { AppIconMark } from "@/lib/app-icon";

// The 192x192 size the web app manifest wants for Android's "Install app" /
// Add to Home Screen prompt — not one of Next's special icon filenames, so
// this is just a plain route that renders the same mark at that size.
export async function GET() {
  return new ImageResponse(<AppIconMark size={192} />, { width: 192, height: 192 });
}
