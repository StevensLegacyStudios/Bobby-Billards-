"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { TABLE, POCKETS } from "@/lib/engine/trajectory";
import type { TablePoint, TrajectoryPayload, TrajectorySegment } from "@/lib/types";

/**
 * WebGL 3D shot canvas.
 *
 * World mapping: the 2:1 slate canvas (X ∈ [0,200], Y ∈ [0,100]) maps onto
 * the XZ plane at 1/50 scale, centered at the origin, Y up. All geometry is
 * primitive (boxes, cylinders, spheres) — no external assets — so the bundle
 * stays lean for mobile browsers.
 */

const S = 1 / 50;
const BALL_R = TABLE.ballRadius * S;
const TABLE_W = TABLE.width * S; // 4 world units
const TABLE_H = TABLE.height * S; // 2 world units

function toWorld([x, y]: TablePoint, elevation = BALL_R): [number, number, number] {
  return [(x - TABLE.width / 2) * S, elevation, (y - TABLE.height / 2) * S];
}

const SEGMENT_STYLE: Record<
  TrajectorySegment["kind"],
  { color: string; dashed: boolean; width: number }
> = {
  cue_travel: { color: "#fef08a", dashed: false, width: 2.5 },
  ghost_aim: { color: "#94a3b8", dashed: true, width: 1.5 },
  object_travel: { color: "#fb923c", dashed: false, width: 2.5 },
  bank_reflection: { color: "#22d3ee", dashed: false, width: 2.5 },
};

function Slate() {
  return (
    <mesh position={[0, -0.025, 0]} receiveShadow>
      <boxGeometry args={[TABLE_W, 0.05, TABLE_H]} />
      <meshStandardMaterial color="#166534" roughness={0.9} />
    </mesh>
  );
}

function Cushions() {
  const railH = 0.09;
  const railT = 0.12;
  const gap = 0.16; // pocket opening
  const segX = TABLE_W / 2 - 1.5 * gap; // length of each long-rail cushion segment

  const cushionMat = <meshStandardMaterial color="#14532d" roughness={0.8} />;
  const woodMat = <meshStandardMaterial color="#78350f" roughness={0.6} />;

  return (
    <group>
      {/* Long rails: two segments each, split at the side pockets. */}
      {[-1, 1].map((side) =>
        [-1, 1].map((half) => (
          <mesh
            key={`long-${side}-${half}`}
            position={[half * (segX / 2 + gap), railH / 2, side * (TABLE_H / 2 + railT / 2)]}
          >
            <boxGeometry args={[segX, railH, railT]} />
            {cushionMat}
          </mesh>
        ))
      )}
      {/* Short rails. */}
      {[-1, 1].map((side) => (
        <mesh key={`short-${side}`} position={[side * (TABLE_W / 2 + railT / 2), railH / 2, 0]}>
          <boxGeometry args={[railT, railH, TABLE_H - 2 * gap]} />
          {cushionMat}
        </mesh>
      ))}
      {/* Outer wooden frame. */}
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[TABLE_W + 2.6 * railT, 0.04, TABLE_H + 2.6 * railT]} />
        {woodMat}
      </mesh>
      {/* Legs. */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`leg-${sx}-${sz}`}
            position={[sx * (TABLE_W / 2 - 0.2), -0.45, sz * (TABLE_H / 2 - 0.15)]}
          >
            <boxGeometry args={[0.14, 0.85, 0.14]} />
            {woodMat}
          </mesh>
        ))
      )}
    </group>
  );
}

function Pockets() {
  return (
    <group>
      {Object.values(POCKETS).map((p, i) => {
        const [x, , z] = toWorld(p as TablePoint, 0);
        return (
          <mesh key={i} position={[x, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.11, 24]} />
            <meshStandardMaterial color="#0a0a0a" />
          </mesh>
        );
      })}
    </group>
  );
}

function Ball({
  point,
  color,
  label,
}: {
  point: TablePoint;
  color: string;
  label?: string;
}) {
  void label;
  return (
    <mesh position={toWorld(point)} castShadow>
      <sphereGeometry args={[BALL_R, 24, 24]} />
      <meshStandardMaterial color={color} roughness={0.15} metalness={0.05} />
    </mesh>
  );
}

/** A marker sphere that repeatedly runs the full trajectory path. */
function ShotRunner({ path }: { path: [number, number, number][] }) {
  const ref = useRef<THREE.Mesh>(null);
  const { points, lengths, total } = useMemo(() => {
    const pts = path.map((p) => new THREE.Vector3(...p));
    const lens: number[] = [];
    let sum = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = pts[i].distanceTo(pts[i + 1]);
      lens.push(l);
      sum += l;
    }
    return { points: pts, lengths: lens, total: sum };
  }, [path]);

  useFrame(({ clock }) => {
    if (!ref.current || total === 0) return;
    const speed = 1.2; // world units per second
    let d = (clock.getElapsedTime() * speed) % total;
    for (let i = 0; i < lengths.length; i++) {
      if (d <= lengths[i]) {
        ref.current.position.lerpVectors(points[i], points[i + 1], d / lengths[i]);
        return;
      }
      d -= lengths[i];
    }
  });

  if (points.length < 2) return null;
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[BALL_R * 0.7, 16, 16]} />
      <meshStandardMaterial color="#fefce8" emissive="#facc15" emissiveIntensity={0.7} />
    </mesh>
  );
}

function TrajectoryLines({ trajectory }: { trajectory: TrajectoryPayload }) {
  const runnerPath = useMemo(() => {
    const travel = trajectory.segments.filter((s) => s.kind !== "ghost_aim");
    if (travel.length === 0) return [];
    const pts: [number, number, number][] = [toWorld(travel[0].from)];
    for (const seg of travel) pts.push(toWorld(seg.to));
    return pts;
  }, [trajectory]);

  return (
    <group>
      {trajectory.segments.map((seg, i) => {
        const style = SEGMENT_STYLE[seg.kind];
        return (
          <Line
            key={i}
            points={[toWorld(seg.from), toWorld(seg.to)]}
            color={style.color}
            lineWidth={style.width}
            dashed={style.dashed}
            dashScale={12}
          />
        );
      })}
      <ShotRunner path={runnerPath} />
    </group>
  );
}

export interface BilliardCanvasProps {
  cue?: TablePoint;
  objects?: TablePoint[];
  trajectory?: TrajectoryPayload | null;
  className?: string;
}

export default function BilliardCanvas({
  cue = [50, 50],
  objects = [[140, 40]],
  trajectory = null,
  className,
}: BilliardCanvasProps) {
  const objectColors = ["#dc2626", "#2563eb", "#7c3aed", "#db2777", "#0d9488"];

  return (
    <div className={className ?? "h-[340px] w-full sm:h-[420px]"}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 3.2, 3.4], fov: 42 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
      >
        <color attach="background" args={["#09090b"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 5, 2]} intensity={1.4} castShadow />
        <pointLight position={[-3, 3, -2]} intensity={0.4} />

        <Slate />
        <Cushions />
        <Pockets />

        <Ball point={cue} color="#fafafa" label="cue" />
        {objects.map((p, i) => (
          <Ball key={i} point={p} color={objectColors[i % objectColors.length]} />
        ))}

        {trajectory && trajectory.segments.length > 0 && (
          <TrajectoryLines trajectory={trajectory} />
        )}

        {/* Orbit constrained so the camera can never clip below the slate or
            inside the table volume. */}
        <OrbitControls
          enablePan={false}
          minDistance={2.4}
          maxDistance={7}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2.25}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
