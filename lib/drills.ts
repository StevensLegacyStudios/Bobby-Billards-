import type { TablePoint } from "./types";

/**
 * Practice drill library — the drills serious players actually run
 * (popularized by Dr. Dave / Billiard University and pro practice routines).
 * Layouts are on the canonical 2:1 slate canvas (X ∈ [0,200], Y ∈ [0,100]);
 * the foot spot is at [150, 50], the head string at X = 50.
 */

export interface Drill {
  key: string;
  name: string;
  tagline: string;
  setup: string;
  goal: string;
  scoring: string;
  /** Natural max for a scoring pass, when the drill has an obvious one. */
  maxScore?: number;
  layout: {
    cue: TablePoint;
    objects: TablePoint[];
  };
}

/** 9-ball diamond rack with the apex on the foot spot. */
function nineBallRack(): TablePoint[] {
  const apex: TablePoint = [150, 50];
  const dx = 5.2; // row spacing toward the foot rail
  const dy = 3.1; // half ball-gap across a row
  return [
    apex,
    [apex[0] + dx, 50 - dy],
    [apex[0] + dx, 50 + dy],
    [apex[0] + 2 * dx, 50 - 2 * dy],
    [apex[0] + 2 * dx, 50],
    [apex[0] + 2 * dx, 50 + 2 * dy],
    [apex[0] + 3 * dx, 50 - dy],
    [apex[0] + 3 * dx, 50 + dy],
    [apex[0] + 4 * dx, 50],
  ];
}

export const DRILLS: Drill[] = [
  {
    key: "mighty-x",
    name: "The Mighty X",
    tagline: "The pro favorite for straight cueing and cue-ball control",
    setup:
      "Object ball on the center spot. Shoot it straight into a corner pocket from positions fanned across the opposite end of the table — each shot from a different angle forms the X.",
    goal: "Pocket the ball AND land the cue ball exactly where you called it: stop, one diamond of follow, or one diamond of draw.",
    scoring:
      "10 shots per pass: 1 point for the pocket, 1 for the cue-ball target. 16+ / 20 means your fundamentals are tournament-ready.",
    maxScore: 20,
    layout: {
      cue: [55, 82],
      objects: [[100, 50]],
    },
  },
  {
    key: "ghost",
    name: "Playing the Ghost",
    tagline: "The classic self-rating race — you vs. a perfect opponent",
    setup:
      "Rack 9-ball. Break, take ball in hand, and run the table in rotation. Any miss and the rack goes to 'the ghost.' Race to 7.",
    goal: "Run out. Every rack you finish beats the ghost; every miss loses the rack instantly.",
    scoring:
      "Track your score across races. Beating the 9-ball ghost consistently ≈ 600+ Fargo speed. Too hard? Play the 5-ball or 7-ball ghost and work up — that's the progressive version.",
    maxScore: 7,
    layout: {
      cue: [40, 60],
      objects: nineBallRack(),
    },
  },
  {
    key: "wagon-wheel",
    name: "Wagon Wheel",
    tagline: "Position play — send the cue ball anywhere on command",
    setup:
      "Object ball a diamond from the side pocket, cue ball in the same spot every time. Pocket the ball in the side, then send the cue ball to a different 'spoke' target around the table each shot.",
    goal: "Hit every spoke of the wheel: each rail target, using follow, draw, and english as needed.",
    scoring:
      "1 point per spoke reached within one ball's width. 6 targets per cycle — a full wheel with no misses is shortstop level.",
    maxScore: 6,
    layout: {
      cue: [70, 75],
      objects: [[100, 35], [30, 12], [60, 8], [140, 8], [170, 30], [170, 70], [140, 92]],
    },
  },
  {
    key: "line-of-balls",
    name: "Progressive Line-Up",
    tagline: "Run-out rhythm and small-area position",
    setup:
      "Line up 5 balls along the center string a half-diamond apart. Ball in hand to start. Pocket them in any order — but the cue ball may never touch a rail.",
    goal: "Clear the line using only stop, stun, and small follow/draw. Rails are a foul — that's the drill.",
    scoring:
      "Cleared it? Add a ball next round (progressive). Failed? Remove one. Your steady-state ball count is your score — 7+ is strong.",
    layout: {
      cue: [70, 70],
      objects: [[90, 50], [110, 50], [130, 50], [150, 50], [170, 50]],
    },
  },
  {
    key: "stop-follow-draw",
    name: "Stop / Follow / Draw Ladder",
    tagline: "The speed-control ladder every rating exam starts with",
    setup:
      "Straight-in shot, cue ball to object ball to corner pocket all on one line, two diamonds apart.",
    goal: "Same shot ten times: dead stop ×3, then exactly one diamond of follow ×3, then one, two, three diamonds of draw.",
    scoring:
      "Cue ball must finish within one ball's width of the called distance. 8/10 at three diamonds apart, then move the shot a diamond longer.",
    maxScore: 10,
    layout: {
      cue: [60, 65],
      objects: [[120, 43]],
    },
  },
  {
    key: "lag-ladder",
    name: "Lag & Speed Zones",
    tagline: "Win the lag, kill your position speed",
    setup:
      "Cue ball on the head string. Lag off the foot rail and back up the table. Imagine three zones: past the head string, within a diamond of the head rail, frozen to the rail.",
    goal: "Land the returning cue ball inside the called zone — the same touch that floats you into perfect shape.",
    scoring:
      "10 lags: 1 point inside a diamond, 2 points within half a diamond of the head rail. 14+ is pro-lag territory.",
    maxScore: 20,
    layout: {
      cue: [50, 50],
      objects: [],
    },
  },
  {
    key: "rail-cuts",
    name: "Rail Cut Shots",
    tagline: "The shots that separate bar players from league players",
    setup:
      "Object ball frozen (or nearly frozen) to the long rail, two diamonds from the corner. Cue ball out in the middle of the table.",
    goal: "Cut it down the rail into the corner. Then move the cue ball one diamond tougher and repeat.",
    scoring:
      "5 makes from each of 4 cue-ball positions. Rail-frozen balls want a firm stroke and a touch of inside english — log which positions leak points.",
    maxScore: 20,
    layout: {
      cue: [100, 60],
      objects: [[160, 6]],
    },
  },
];

/** Kicking & banking systems reference — the math behind the Shot Lab solvers. */
export const SYSTEMS = [
  {
    key: "mirror",
    name: "Mirror System (1-rail kicks & banks)",
    body: "Reflect your target across the cushion and shoot dead at the reflection — the rail contact lands where the incident angle equals the rebound angle. This is what the Kick mode solver draws. Caveats the pros know: firm speed shortens the rebound (cushions compress), running english lengthens it, and dirty rails play short. Calibrate on your table with a medium-speed rolling ball.",
  },
  {
    key: "two-to-one",
    name: "Two-to-One System",
    body: "The table is exactly 2:1, so a ball hit at the right angle travels two diamonds along the table for every one diamond across. Going up and down the long way: aim through a point two diamonds over per diamond up. It's the fastest way to kick at balls up-table without memorizing anything.",
  },
  {
    key: "corner-5",
    name: "Corner-5 (3-rail kicks, running english)",
    body: "The classic 3-cushion system. Number your origin: shooting from the corner = 5, each diamond along the short rail adds 1, each diamond up the long rail subtracts ½. Number the third rail 1–4 from the far corner. Aim through the first-rail diamond equal to (your number − target third-rail number), with medium speed and about one tip of running english. Corner-5 says: from the corner (5), to arrive at third-rail diamond 3, aim through first-rail diamond 2. Every table plays a little long or short — calibrate the reference shot first.",
  },
];
