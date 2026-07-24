"use client";

import dynamic from "next/dynamic";

import type { BilliardCanvasProps } from "./billiard-canvas";

/**
 * Client-side-only loader for the WebGL canvas: keeps three.js out of the
 * server bundle and defers the ~150KB gzipped 3D chunk until the canvas
 * actually scrolls into a page.
 */
const BilliardCanvas = dynamic(() => import("./billiard-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[340px] w-full items-center justify-center rounded-xl border border-border bg-black/90 text-sm text-muted-foreground sm:h-[420px]">
      Racking the table…
    </div>
  ),
});

export default function BilliardCanvasLazy(props: BilliardCanvasProps) {
  return <BilliardCanvas {...props} />;
}
