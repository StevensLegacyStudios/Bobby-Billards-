import type { ReactNode } from "react";

import { OBJECT_BALL_COLORS, POCKETS, TABLE } from "@/lib/engine/trajectory";
import type { TablePoint } from "@/lib/types";

/**
 * Small static top-down SVG schematics — no drag, no solver — used where a
 * quick picture communicates faster than a paragraph: the Drills tab's
 * mini setup diagram, and the Kicking Systems tab's "how it actually
 * works" illustrations.
 */

const W = TABLE.width;
const H = TABLE.height;
const M = 10;

function RailsAndDiamonds() {
  // Purely illustrative diamond sights — evenly spaced, not laser-accurate.
  const longRailX = Array.from({ length: 8 }, (_, i) => (W / 8) * (i + 0.5));
  const shortRailY = Array.from({ length: 4 }, (_, i) => (H / 4) * (i + 0.5));
  return (
    <g>
      <rect x={-M} y={-M} width={W + 2 * M} height={H + 2 * M} rx={5} fill="#78350f" />
      <rect x={-2} y={-2} width={W + 4} height={H + 4} fill="#14532d" />
      <rect x={0} y={0} width={W} height={H} fill="#166534" />
      {longRailX.map((x) => (
        <g key={`d-top-${x}`}>
          <circle cx={x} cy={-M / 2} r={1.4} fill="#fde68a" opacity={0.8} />
          <circle cx={x} cy={H + M / 2} r={1.4} fill="#fde68a" opacity={0.8} />
        </g>
      ))}
      {shortRailY.map((y) => (
        <g key={`d-side-${y}`}>
          <circle cx={-M / 2} cy={y} r={1.4} fill="#fde68a" opacity={0.8} />
          <circle cx={W + M / 2} cy={y} r={1.4} fill="#fde68a" opacity={0.8} />
        </g>
      ))}
      {Object.values(POCKETS).map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={5} fill="#0a0a0a" />
      ))}
    </g>
  );
}

function Frame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="space-y-1.5">
      <svg
        viewBox={`${-M} ${-M} ${W + 2 * M} ${H + 2 * M}`}
        className="w-full rounded-lg"
        role="img"
        aria-label={label}
      >
        {children}
      </svg>
      {label && <p className="text-center text-xs text-muted-foreground">{label}</p>}
    </div>
  );
}

/** Ball-layout schematic used on the Drills tab — cue + numbered object balls. */
export function DrillDiagram({ cue, objects }: { cue: TablePoint; objects: TablePoint[] }) {
  return (
    <Frame>
      <RailsAndDiamonds />
      {objects.map((p, i) => (
        <g key={i}>
          <circle
            cx={p[0]}
            cy={p[1]}
            r={4}
            fill={OBJECT_BALL_COLORS[i % OBJECT_BALL_COLORS.length]}
            stroke="#00000055"
            strokeWidth={0.5}
          />
          <text x={p[0]} y={p[1] + 1.6} textAnchor="middle" fontSize={4} fill="#fff" fontWeight={700}>
            {i + 1}
          </text>
        </g>
      ))}
      <circle cx={cue[0]} cy={cue[1]} r={4} fill="#fafafa" stroke="#a1a1aa" strokeWidth={0.5} />
    </Frame>
  );
}

/** Mirror system: reflect the target across the rail, aim dead at the reflection. */
export function MirrorSystemDiagram() {
  const cue: TablePoint = [30, 78];
  const target: TablePoint = [150, 78];
  const mirrored: TablePoint = [150, 22];
  const contact: TablePoint = [90, 0];

  return (
    <Frame label="Aim at the reflection — the rail bounces the angle back for free">
      <RailsAndDiamonds />
      {/* mirrored (ghost) target beyond the rail */}
      <circle cx={mirrored[0]} cy={mirrored[1]} r={4} fill="#dc2626" opacity={0.3} strokeDasharray="1.5 1.5" stroke="#dc2626" />
      <text x={mirrored[0]} y={mirrored[1] - 7} textAnchor="middle" fontSize={5} fill="#facc15">
        mirror image
      </text>
      <line x1={target[0]} y1={target[1]} x2={mirrored[0]} y2={mirrored[1]} stroke="#64748b" strokeWidth={0.6} strokeDasharray="2 2" />
      {/* aim line: cue straight through contact to the mirrored point */}
      <line x1={cue[0]} y1={cue[1]} x2={mirrored[0]} y2={mirrored[1]} stroke="#facc15" strokeWidth={0.9} strokeDasharray="2 2" opacity={0.6} />
      <line x1={cue[0]} y1={cue[1]} x2={contact[0]} y2={contact[1]} stroke="#facc15" strokeWidth={1.4} />
      <line x1={contact[0]} y1={contact[1]} x2={target[0]} y2={target[1]} stroke="#22d3ee" strokeWidth={1.4} />
      <circle cx={target[0]} cy={target[1]} r={4} fill="#dc2626" stroke="#00000055" strokeWidth={0.5} />
      <circle cx={cue[0]} cy={cue[1]} r={4} fill="#fafafa" stroke="#a1a1aa" strokeWidth={0.5} />
    </Frame>
  );
}

/** Two-to-one: the table is 2 units long for every 1 unit wide. */
export function TwoToOneSystemDiagram() {
  const cue: TablePoint = [40, 92];
  const target: TablePoint = [200, 12];

  return (
    <Frame label="The table is exactly twice as long as it is wide — use that ratio to aim">
      <RailsAndDiamonds />
      <line x1={cue[0]} y1={cue[1]} x2={target[0]} y2={target[1]} stroke="#facc15" strokeWidth={1.2} />
      {/* the 2:1 grid this line rides: 2 across for every 1 up */}
      <line x1={40} y1={92} x2={90} y2={42} stroke="#38bdf8" strokeWidth={0.5} strokeDasharray="1.5 1.5" />
      <line x1={90} y1={42} x2={90} y2={92} stroke="#38bdf8" strokeWidth={0.5} strokeDasharray="1.5 1.5" />
      <text x={65} y={98} textAnchor="middle" fontSize={4.5} fill="#38bdf8">
        2 across
      </text>
      <text x={96} y={70} fontSize={4.5} fill="#38bdf8">
        1 up
      </text>
      <circle cx={target[0]} cy={target[1]} r={4} fill="#dc2626" stroke="#00000055" strokeWidth={0.5} />
      <circle cx={cue[0]} cy={cue[1]} r={4} fill="#fafafa" stroke="#a1a1aa" strokeWidth={0.5} />
    </Frame>
  );
}

/** Corner-5: numbered reference points along the rails for 3-rail kicks. */
export function CornerFiveSystemDiagram() {
  const corner: TablePoint = [0, 100];
  const cue: TablePoint = [0, 100];
  const firstRailAim: TablePoint = [80, 0];
  const target: TablePoint = [200, 40];

  return (
    <Frame label="Number the corner 5, number the rails, aim through the diamond that matches your math">
      <RailsAndDiamonds />
      {[0, 1, 2, 3, 4].map((n) => (
        <text key={`top-${n}`} x={(W / 4) * n} y={-3} textAnchor="middle" fontSize={4.5} fill="#facc15">
          {n}
        </text>
      ))}
      <text x={corner[0] + 6} y={corner[1] - 3} fontSize={5} fill="#facc15" fontWeight={700}>
        5 (start)
      </text>
      <line x1={cue[0]} y1={cue[1]} x2={firstRailAim[0]} y2={firstRailAim[1]} stroke="#facc15" strokeWidth={1.2} />
      <line x1={firstRailAim[0]} y1={firstRailAim[1]} x2={target[0]} y2={target[1]} stroke="#22d3ee" strokeWidth={1.2} />
      <circle cx={firstRailAim[0]} cy={firstRailAim[1]} r={1.6} fill="#facc15" />
      <circle cx={target[0]} cy={target[1]} r={4} fill="#dc2626" stroke="#00000055" strokeWidth={0.5} />
      <circle cx={cue[0]} cy={cue[1]} r={4} fill="#fafafa" stroke="#a1a1aa" strokeWidth={0.5} />
    </Frame>
  );
}
