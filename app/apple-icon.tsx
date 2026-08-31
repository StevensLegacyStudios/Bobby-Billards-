import { ImageResponse } from "next/og";

import { AppIconMark } from "@/lib/app-icon";

// 180x180 is Apple's recommended home-screen icon size — this is what
// actually shows up when someone taps Share → Add to Home Screen on iOS.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconMark size={180} />, size);
}
