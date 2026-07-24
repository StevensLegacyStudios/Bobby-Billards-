export type ClothQuality =
  | "simonis_860"
  | "simonis_760"
  | "championship_tour"
  | "standard_felt"
  | "worn_felt";

export type PocketWidth = "4.5in_pro_cut" | "4.75in_standard" | "5in_bar_box" | "oversized";

export type CueSpacing = "full_clearance" | "comfortable" | "tight_walls" | "wall_bound";

export interface TableSpecification {
  label: string;
  brand: string;
  size: "7ft" | "8ft" | "9ft" | "10ft";
  count: number;
  verified_at?: string;
}

export interface Venue {
  id: string;
  name: string;
  phone: string | null;
  hours: Record<string, string> | null;
  rating: number | null;
  lat: number;
  lng: number;
  cloth_quality: string | null;
  pocket_widths: string | null;
  cue_spacing: string | null;
  is_verified: boolean;
  table_specifications: TableSpecification[] | null;
  /** Populated by the get_venues_in_corridor RPC. */
  distance_from_route_m?: number;
}

export interface VenueValidation {
  venue_id: string;
  cloth_quality: ClothQuality;
  pocket_widths: PocketWidth;
  cue_spacing: CueSpacing;
  notes?: string;
}

export interface Trip {
  id: string;
  origin: string;
  destination: string;
  /** [lng, lat] pairs describing the route polyline. */
  polyline: [number, number][];
  buffer_meters: number;
  created_at: string;
}

/** Table-space coordinate on the normalized 2:1 slate canvas. X ∈ [0, 200], Y ∈ [0, 100]. */
export type TablePoint = [number, number];

export interface TrajectorySegment {
  from: TablePoint;
  to: TablePoint;
  kind: "cue_travel" | "object_travel" | "bank_reflection" | "ghost_aim";
}

export interface TrajectoryPayload {
  segments: TrajectorySegment[];
  cutAngleDeg: number;
  feasible: boolean;
  difficulty: "easy" | "moderate" | "hard" | "very_hard";
  notes: string[];
}

export interface CvDetection {
  label: "cue_ball" | "object_ball" | "pocket" | "table_corner";
  confidence: number;
  /** Pixel-space bounding box [x, y, w, h] on the 640x640 input frame. */
  bbox: [number, number, number, number];
  /** Projected table-space coordinate after homography. */
  tablePoint?: TablePoint;
}

export type SubscriptionTier = "free" | "premium";

export interface AdCampaign {
  id: string;
  venue_id: string;
  venue_name: string;
  bid_cpc_cents: number;
  daily_budget_cents: number;
  spent_today_cents: number;
  status: "active" | "paused" | "budget_exhausted";
}

export interface VenueEvent {
  id: string;
  venue_id: string;
  kind: "tournament" | "bracket" | "special";
  title: string;
  starts_at: string;
  details: string;
}
