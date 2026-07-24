"use client";

import { useCallback, useEffect, useState } from "react";

import {
  listOfflineCorridors,
  removeOfflineCorridor,
  saveCorridorOffline,
} from "@/lib/offline/db";
import type { Trip, Venue } from "@/lib/types";

export function useOfflineMaps() {
  const [savedTripIds, setSavedTripIds] = useState<Set<string>>(new Set());
  const [totalBytes, setTotalBytes] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    return listOfflineCorridors()
      .then((corridors) => {
        setSavedTripIds(new Set(corridors.map((c) => c.tripId)));
        setTotalBytes(corridors.reduce((sum, c) => sum + c.sizeBytes, 0));
      })
      .catch(() => {
        // IndexedDB unavailable (private browsing, SSR) — degrade silently.
      });
  }, []);

  useEffect(() => {
    let active = true;
    listOfflineCorridors()
      .then((corridors) => {
        if (!active) return;
        setSavedTripIds(new Set(corridors.map((c) => c.tripId)));
        setTotalBytes(corridors.reduce((sum, c) => sum + c.sizeBytes, 0));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const download = useCallback(
    async (trip: Trip, venues: Venue[]) => {
      setBusy(true);
      try {
        await saveCorridorOffline(trip, venues);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const remove = useCallback(
    async (tripId: string) => {
      setBusy(true);
      try {
        await removeOfflineCorridor(tripId);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  return { savedTripIds, totalBytes, busy, download, remove };
}
