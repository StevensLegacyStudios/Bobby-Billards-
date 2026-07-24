"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { Trip, Venue } from "@/lib/types";

/**
 * IndexedDB synchronization manager (Premium feature).
 *
 * When a Premium user flags a route for offline download we serialize the
 * PostGIS corridor geometry, the matched venues, and placeholder map tiles
 * into IndexedDB so the trip remains fully browsable on disconnected rural
 * stretches.
 */

interface BobbyBilliardsDB extends DBSchema {
  corridors: {
    key: string;
    value: {
      tripId: string;
      trip: Trip;
      venues: Venue[];
      savedAt: number;
      sizeBytes: number;
    };
  };
  tiles: {
    key: string;
    value: {
      key: string;
      tripId: string;
      z: number;
      x: number;
      y: number;
      blob: Blob;
    };
    indexes: { byTrip: string };
  };
}

const DB_NAME = "bobby-billiards-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BobbyBilliardsDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<BobbyBilliardsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("corridors", { keyPath: "tripId" });
        const tiles = db.createObjectStore("tiles", { keyPath: "key" });
        tiles.createIndex("byTrip", "tripId");
      },
    });
  }
  return dbPromise;
}

/** Persist a corridor (trip + matched venues + coarse tile pyramid) locally. */
export async function saveCorridorOffline(trip: Trip, venues: Venue[]): Promise<void> {
  const db = await getDb();
  const payload = {
    tripId: trip.id,
    trip,
    venues,
    savedAt: Date.now(),
    sizeBytes: new Blob([JSON.stringify({ trip, venues })]).size,
  };
  await db.put("corridors", payload);

  // Cache a coarse tile pyramid over the corridor bounding box. Real map
  // tiles would be fetched from the tile server; offline-first we store
  // deterministic vector placeholders so rendering never hard-fails.
  const tx = db.transaction("tiles", "readwrite");
  for (const z of [8, 10]) {
    for (const [lng, lat] of trip.polyline) {
      const x = lngToTileX(lng, z);
      const y = latToTileY(lat, z);
      const key = `${trip.id}/${z}/${x}/${y}`;
      await tx.store.put({
        key,
        tripId: trip.id,
        z,
        x,
        y,
        blob: new Blob([JSON.stringify({ z, x, y, corridor: trip.id })], {
          type: "application/json",
        }),
      });
    }
  }
  await tx.done;
}

export async function listOfflineCorridors() {
  const db = await getDb();
  return db.getAll("corridors");
}

export async function getOfflineCorridor(tripId: string) {
  const db = await getDb();
  return db.get("corridors", tripId);
}

export async function removeOfflineCorridor(tripId: string): Promise<void> {
  const db = await getDb();
  await db.delete("corridors", tripId);
  const tx = db.transaction("tiles", "readwrite");
  for (const key of await tx.store.index("byTrip").getAllKeys(tripId)) {
    await tx.store.delete(key);
  }
  await tx.done;
}

function lngToTileX(lng: number, zoom: number) {
  return Math.floor(((lng + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom
  );
}
