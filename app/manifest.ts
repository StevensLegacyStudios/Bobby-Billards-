import type { MetadataRoute } from "next";

/**
 * Web App Manifest — this is what turns "Add to Home Screen" from a plain
 * bookmark shortcut (browser-chrome screenshot as the icon, opens in a full
 * browser tab) into a real installed-looking app: a proper icon, its own
 * name under the icon, and it launches full-screen with no address bar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Buddy Billiards",
    short_name: "Buddy Billiards",
    description:
      "Find verified billiard rooms along your route, validate table conditions, and train shots on an AI-powered 3D table.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1a14",
    theme_color: "#0f1a14",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
