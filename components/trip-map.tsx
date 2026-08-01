"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";

import type { LngLat } from "@/lib/geo";
import { formatMiles } from "@/lib/units";
import type { Venue } from "@/lib/types";

import "leaflet/dist/leaflet.css";

export interface TripMapProps {
  route: LngLat[];
  bufferMeters: number;
  venues: Venue[];
  origin?: { name: string; lngLat: LngLat };
  destination?: { name: string; lngLat: LngLat };
  className?: string;
}

/**
 * Interactive corridor map: the driving route, the detour buffer band, and
 * every matched venue — so a trip can be planned visually. Leaflet only ever
 * runs client-side (this component is loaded with next/dynamic, ssr: false).
 */
export default function TripMap({
  route,
  bufferMeters,
  venues,
  origin,
  destination,
  className,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: true,
        });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }).addTo(mapRef.current);
        layersRef.current = L.layerGroup().addTo(mapRef.current);
      }

      const map = mapRef.current;
      const layers = layersRef.current!;
      layers.clearLayers();

      const toLatLng = ([lng, lat]: LngLat): [number, number] => [lat, lng];

      if (route.length >= 2) {
        // Corridor band: the route offset left+right by the buffer distance.
        const band = corridorPolygon(route, bufferMeters);
        L.polygon(band.map(toLatLng), {
          color: "#34d399",
          weight: 1,
          opacity: 0.35,
          fillColor: "#34d399",
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(layers);

        L.polyline(route.map(toLatLng), {
          color: "#fbbf24",
          weight: 3.5,
          opacity: 0.9,
        }).addTo(layers);
      }

      const endpointIcon = (label: string, bg: string) =>
        L.divIcon({
          className: "",
          html: `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${bg};color:#0c0a09;font:700 12px/1 system-ui;border:2px solid #fafaf9;box-shadow:0 1px 6px rgba(0,0,0,.55)">${label}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

      if (origin) {
        L.marker(toLatLng(origin.lngLat), { icon: endpointIcon("A", "#fbbf24") })
          .bindPopup(`<strong>${escapeHtml(origin.name)}</strong><br/>Start`)
          .addTo(layers);
      }
      if (destination) {
        L.marker(toLatLng(destination.lngLat), { icon: endpointIcon("B", "#fbbf24") })
          .bindPopup(`<strong>${escapeHtml(destination.name)}</strong><br/>Destination`)
          .addTo(layers);
      }

      const venueIcon = (verified: boolean) =>
        L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;border-radius:9999px;background:${verified ? "#34d399" : "#a8a29e"};border:2.5px solid #0c0a09;box-shadow:0 0 0 2px ${verified ? "rgba(52,211,153,.4)" : "rgba(168,162,158,.35)"},0 1px 6px rgba(0,0,0,.5)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

      for (const v of venues) {
        const detour =
          v.distance_from_route_m != null ? `${formatMiles(v.distance_from_route_m)} off route` : "";
        const specs = v.table_specifications?.[0]?.label ?? v.cloth_quality?.replaceAll("_", " ") ?? "";
        L.marker([v.lat, v.lng], { icon: venueIcon(v.is_verified) })
          .bindPopup(
            `<div style="min-width:170px">
              <a href="/venues/${v.id}" style="font-weight:700">${escapeHtml(v.name)}</a><br/>
              ${v.rating ? `${v.rating} &#9733;` : "unrated"}${detour ? ` &middot; ${detour}` : ""}
              ${specs ? `<br/><span style="opacity:.75">${escapeHtml(specs)}</span>` : ""}
              ${v.is_verified ? '<br/><span style="color:#34d399;font-weight:600">&#10003; Verified conditions</span>' : ""}
            </div>`
          )
          .addTo(layers);
      }

      const fitPoints: [number, number][] = [
        ...route.map(toLatLng),
        ...venues.map((v) => [v.lat, v.lng] as [number, number]),
      ];
      if (fitPoints.length > 0) {
        map.fitBounds(L.latLngBounds(fitPoints), {
          padding: [36, 36],
          // A single venue pin shouldn't zoom to rooftop level.
          maxZoom: route.length >= 2 ? 18 : 14,
        });
      }
      // Leaflet mis-sizes when mounted into a container that was just laid out.
      setTimeout(() => map.invalidateSize(), 50);
    })();

    return () => {
      cancelled = true;
    };
  }, [route, bufferMeters, venues, origin, destination]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  return (
    <div
      ref={containerRef}
      className={className ?? "h-[420px] w-full rounded-xl"}
      style={{ background: "#111" }}
    />
  );
}

/** Offset the route left and right by `meters` to draw the corridor band. */
function corridorPolygon(route: LngLat[], meters: number): LngLat[] {
  const latRef = (route[0][1] * Math.PI) / 180;
  const mPerDegLng = 111_320 * Math.cos(latRef);
  const mPerDegLat = 110_540;

  const left: LngLat[] = [];
  const right: LngLat[] = [];

  for (let i = 0; i < route.length; i++) {
    const prev = route[Math.max(0, i - 1)];
    const next = route[Math.min(route.length - 1, i + 1)];
    // Segment direction in local meters.
    let dx = (next[0] - prev[0]) * mPerDegLng;
    let dy = (next[1] - prev[1]) * mPerDegLat;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    // Perpendicular normal.
    const nx = -dy;
    const ny = dx;
    const offLng = (nx * meters) / mPerDegLng;
    const offLat = (ny * meters) / mPerDegLat;
    left.push([route[i][0] + offLng, route[i][1] + offLat]);
    right.push([route[i][0] - offLng, route[i][1] - offLat]);
  }
  return [...left, ...right.reverse()];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
