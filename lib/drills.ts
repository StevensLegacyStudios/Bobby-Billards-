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

/**
 * Kicking & banking systems reference. Rewritten in plain language on
 * purpose — each one pairs with a picture (see table-diagram.tsx) instead
 * of leaning on billiards jargon to carry the idea.
 */
export const SYSTEMS = [
  {
    key: "mirror",
    name: "The Mirror Trick (1-rail kicks & banks)",
    short: "Picture your target's reflection on the other side of the rail, and shoot straight at that.",
    body: "Imagine the rail is a mirror. Your object ball has a reflection on the far side of it, the same distance behind the rail as the real ball is in front. Aim your cue ball dead straight at that mirror-image spot. Wherever your aim line crosses the rail is exactly where the ball needs to bounce — because a rail bounces a ball the same way a mirror bounces light: the angle coming in matches the angle going out. This is exactly what the Kick mode solver draws for you. A couple of things that throw it off in real life: hitting hard makes the bounce a little shorter (the cushion squeezes), spin on the cue ball bends the bounce, and older, dirty rails grip more and play short. Try it once at medium speed with no spin to see how your table plays, then adjust.",
  },
  {
    key: "two-to-one",
    name: "The 2-for-1 Rule",
    short: "The table is twice as long as it is wide, so every step you go up costs two steps sideways.",
    body: "A pool table is exactly twice as long as it is wide. That means if you're aiming a ball up the length of the table, for every one \"step\" it needs to travel across, it travels two steps up. So to hit a target that's far up-table, pick the point on the rail that's twice as far over (in the direction you need) as it is up, and aim there. It sounds like math, but it's really just remembering \"two over for every one up\" — no measuring, no calculator, and it works for kicking at any ball near the top of the table from anywhere near the bottom.",
  },
  {
    key: "corner-5",
    name: "Corner-Five (bouncing off 3 rails)",
    short: "Start counting from the corner, hit the numbered spot on the first rail that matches your math.",
    body: "This one's for when a ball needs to bounce off three different rails to reach its target — think billiards trick-shot territory. Here's the plain version: the corner you're shooting from is your starting number, 5. Every marked spot (\"diamond\") you move along the short rail from there adds 1 to your number; every diamond you move up the long rail subtracts a half. On the far rail — the one your ball eventually needs to land near — number the diamonds 1 through 4 starting from the corner across from you. Take your starting number, subtract the far-rail number you're trying to hit, and aim your first bounce through the diamond with that result. Example: starting at the corner (5), aiming to land near far-rail diamond 3, you'd aim your first bounce through diamond 2. Hit it with medium speed and a touch of spin in the direction of travel. Every table runs a little long or short, so test it on a shot you already know before trusting it in a game.",
  },
];
