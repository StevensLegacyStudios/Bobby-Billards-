import type { AdCampaign, Trip, Venue, VenueEvent } from "./types";

/**
 * Seed venues along the Stockton → San Jose corridor (I-5 / I-580 / I-680).
 * Used as a fallback when Supabase credentials are not configured, and
 * mirrored by supabase/seed.sql for real deployments.
 */
export const DEMO_VENUES: Venue[] = [
  {
    id: "6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0001",
    name: "Delta Rail Billiards",
    phone: "+1 (209) 555-0134",
    hours: { "mon-thu": "12pm-12am", "fri-sat": "12pm-2am", sun: "12pm-10pm" },
    rating: 4.7,
    lat: 37.9577,
    lng: -121.2908,
    cloth_quality: "simonis_860",
    pocket_widths: "4.5in_pro_cut",
    cue_spacing: "full_clearance",
    is_verified: true,
    table_specifications: [
      { label: "Verified 9ft Diamond Tables", brand: "Diamond", size: "9ft", count: 8 },
      { label: "7ft Bar Boxes", brand: "Diamond", size: "7ft", count: 4 },
    ],
  },
  {
    id: "6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0002",
    name: "Manteca Cue Club",
    phone: "+1 (209) 555-0177",
    hours: { daily: "2pm-11pm" },
    rating: 4.1,
    lat: 37.7974,
    lng: -121.216,
    cloth_quality: "standard_felt",
    pocket_widths: "5in_bar_box",
    cue_spacing: "comfortable",
    is_verified: false,
    table_specifications: null,
  },
  {
    id: "6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0003",
    name: "Tracy Corner Pocket",
    phone: "+1 (209) 555-0158",
    hours: { daily: "11am-1am" },
    rating: 3.9,
    lat: 37.7397,
    lng: -121.4252,
    cloth_quality: "worn_felt",
    pocket_widths: "oversized",
    cue_spacing: "tight_walls",
    is_verified: false,
    table_specifications: null,
  },
  {
    id: "6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0004",
    name: "Livermore Slate House",
    phone: "+1 (925) 555-0142",
    hours: { "mon-sun": "10am-12am" },
    rating: 4.5,
    lat: 37.6819,
    lng: -121.768,
    cloth_quality: "simonis_760",
    pocket_widths: "4.75in_standard",
    cue_spacing: "full_clearance",
    is_verified: true,
    table_specifications: [
      { label: "Verified 9ft Brunswick Gold Crowns", brand: "Brunswick", size: "9ft", count: 6 },
    ],
  },
  {
    id: "6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0005",
    name: "Fremont Bank Shot Lounge",
    phone: "+1 (510) 555-0168",
    hours: { daily: "4pm-2am" },
    rating: 4.2,
    lat: 37.5485,
    lng: -121.9886,
    cloth_quality: "championship_tour",
    pocket_widths: "4.75in_standard",
    cue_spacing: "comfortable",
    is_verified: false,
    table_specifications: null,
  },
  {
    id: "6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0006",
    name: "San Jose Golden Break",
    phone: "+1 (408) 555-0191",
    hours: { "mon-thu": "11am-1am", "fri-sun": "11am-3am" },
    rating: 4.8,
    lat: 37.3382,
    lng: -121.8863,
    cloth_quality: "simonis_860",
    pocket_widths: "4.5in_pro_cut",
    cue_spacing: "full_clearance",
    is_verified: true,
    table_specifications: [
      { label: "Verified 9ft Diamond Tables", brand: "Diamond", size: "9ft", count: 12 },
      { label: "10ft Snooker", brand: "Rasson", size: "10ft", count: 2 },
    ],
  },
  {
    id: "6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0007",
    name: "Sacramento Rack Room",
    phone: "+1 (916) 555-0122",
    hours: { daily: "12pm-12am" },
    rating: 4.0,
    lat: 38.5816,
    lng: -121.4944,
    cloth_quality: "standard_felt",
    pocket_widths: "4.75in_standard",
    cue_spacing: "comfortable",
    is_verified: false,
    table_specifications: null,
  },
];

/** Rough geocoder for the demo corridor cities. */
export const DEMO_CITIES: Record<string, [number, number]> = {
  stockton: [-121.2908, 37.9577],
  manteca: [-121.216, 37.7974],
  tracy: [-121.4252, 37.7397],
  livermore: [-121.768, 37.6819],
  fremont: [-121.9886, 37.5485],
  "san jose": [-121.8863, 37.3382],
  sacramento: [-121.4944, 38.5816],
  modesto: [-120.9969, 37.6391],
  oakland: [-122.2712, 37.8044],
  "san francisco": [-122.4194, 37.7749],
};

export const DEMO_EVENTS: VenueEvent[] = [
  {
    id: "evt-001",
    venue_id: "6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0001",
    kind: "tournament",
    title: "Delta Rail Weekly 9-Ball Open",
    starts_at: "2026-07-14T19:00:00-07:00",
    details: "Open field, BCA rules, calcutta before the draw.",
    recurs_weekly: true,
    weekday: 2, // Every Tuesday
    entry_fee_cents: 2000,
    race_format: "Race to 5",
    fargo_range: "Under 650",
  },
  {
    id: "evt-002",
    venue_id: "6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0006",
    kind: "bracket",
    title: "Golden Break Summer Bracket — Round of 32",
    starts_at: "2026-08-08T12:00:00-07:00",
    details: "Double elimination, alternating break, live stream on table 1.",
    recurs_weekly: false,
    weekday: null,
    entry_fee_cents: 4000,
    race_format: "Race to 7",
    fargo_range: null,
  },
  {
    id: "evt-003",
    venue_id: "6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0006",
    kind: "special",
    title: "Happy Hour: half-price table time",
    starts_at: "2026-07-17T16:00:00-07:00",
    details: "Fridays 4–6pm, includes house cue rental.",
    recurs_weekly: true,
    weekday: 5, // Every Friday
    entry_fee_cents: null,
    race_format: null,
    fargo_range: null,
  },
  {
    id: "evt-004",
    venue_id: "6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0004",
    kind: "tournament",
    title: "Slate House Saturday 8-Ball",
    starts_at: "2026-07-11T13:00:00-07:00",
    details: "Handicapped bracket on the Gold Crowns, cash payouts top four.",
    recurs_weekly: true,
    weekday: 6, // Every Saturday
    entry_fee_cents: 1500,
    race_format: "Race to 4",
    fargo_range: "Under 600",
  },
];

export const DEMO_CAMPAIGNS: AdCampaign[] = [
  {
    id: "cmp-001",
    venue_id: "6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0001",
    venue_name: "Delta Rail Billiards",
    bid_cpc_cents: 85,
    daily_budget_cents: 2500,
    spent_today_cents: 680,
    status: "active",
  },
  {
    id: "cmp-002",
    venue_id: "6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0006",
    venue_name: "San Jose Golden Break",
    bid_cpc_cents: 120,
    daily_budget_cents: 4000,
    spent_today_cents: 3940,
    status: "active",
  },
  {
    id: "cmp-003",
    venue_id: "6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0004",
    venue_name: "Livermore Slate House",
    bid_cpc_cents: 45,
    daily_budget_cents: 1000,
    spent_today_cents: 1000,
    status: "budget_exhausted",
  },
];

export const DEMO_TRIP: Trip = {
  id: "demo-stockton-sj",
  origin: "Stockton",
  destination: "San Jose",
  polyline: [
    [-121.2908, 37.9577],
    [-121.216, 37.7974],
    [-121.4252, 37.7397],
    [-121.768, 37.6819],
    [-121.9886, 37.5485],
    [-121.8863, 37.3382],
  ],
  buffer_meters: 8000,
  created_at: "2026-07-01T00:00:00Z",
};

export function findDemoVenue(id: string): Venue | undefined {
  return DEMO_VENUES.find((v) => v.id === id);
}
