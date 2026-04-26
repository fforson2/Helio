"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Camera, Check, Maximize2, Pause, Play, RotateCcw, Volume2 } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */

export type PropertyStats = {
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  propertyType: "single_family" | "condo" | "townhouse" | "multi_family" | "land";
  pool: boolean;
  garage: boolean;
  basement: boolean;
  stories: number;
};

export type Tour3DViewProps = {
  photos: string[];
  addressLine: string;
  description: string;
  propertyStats?: PropertyStats;
  className?: string;
};

type V3 = [number, number, number];

/* ─────────────────────────────────────────────────────────────
   Scene configuration derived from listing data
───────────────────────────────────────────────────────────── */

type Palette = {
  wall: string; floor: string; ceil: string;
  trim: string; accent: string; counter: string;
};

type SceneConfig = {
  rw: number;       // room width
  rh: number;       // room height (ceiling)
  zoneLen: number;  // length of each zone
  zones: ZoneType[];
  palette: Palette;
  furnitureGrade: "basic" | "mid" | "luxury";
  totalLen: number;
  duration: number;
};

type ZoneType = "entry" | "living" | "kitchen" | "bedroom" | "pool" | "garage";

function buildConfig(s: PropertyStats): SceneConfig {
  // Room width: condos narrower, large sqft wider
  const rw = s.propertyType === "condo" ? 6
    : s.propertyType === "townhouse" ? 7
    : s.sqft > 3000 ? 11 : s.sqft > 1800 ? 9 : 7.5;

  // Ceiling height
  const rh = s.stories > 1 ? 3.6 : s.sqft > 2500 ? 3.2 : 2.8;

  // Zone list
  const zones: ZoneType[] = ["entry", "living", "kitchen"];
  const bedroomCount = Math.min(s.beds, 4);
  for (let i = 0; i < bedroomCount; i++) zones.push("bedroom");
  if (s.pool) zones.push("pool");
  if (s.garage && s.propertyType !== "condo") zones.push("garage");

  // Zone length scales with sqft
  const zoneLen = s.sqft > 3000 ? 9 : s.sqft > 1500 ? 7.5 : 6;

  const totalLen = zones.length * zoneLen;

  // Camera duration: 4s per zone, min 12s
  const duration = Math.max(12, zones.length * 4);

  // Color palette from yearBuilt
  let palette: Palette;
  if (s.yearBuilt < 1970) {
    palette = { wall: "#d6c9b0", floor: "#6b4a2a", ceil: "#e8dece", trim: "#b8a888", accent: "#8b6344", counter: "#c0a070" };
  } else if (s.yearBuilt < 1995) {
    palette = { wall: "#e0d8cc", floor: "#9e7d5a", ceil: "#f0ece4", trim: "#c4b898", accent: "#7a6248", counter: "#ccc0a8" };
  } else if (s.yearBuilt < 2010) {
    palette = { wall: "#ede8e0", floor: "#b89870", ceil: "#f8f6f2", trim: "#d0c8b8", accent: "#6b5c48", counter: "#d8d0c0" };
  } else {
    palette = { wall: "#f2eeea", floor: "#c8b090", ceil: "#fafaf8", trim: "#ddd8d0", accent: "#5a5248", counter: "#e8e4dc" };
  }

  // Furniture grade from price
  const furnitureGrade: "basic" | "mid" | "luxury" =
    s.price > 1_200_000 ? "luxury" : s.price > 600_000 ? "mid" : "basic";

  return { rw, rh, zoneLen, zones, palette, furnitureGrade, totalLen, duration };
}

/* ─────────────────────────────────────────────────────────────
   Reusable box primitive
───────────────────────────────────────────────────────────── */

function B({ p, s, c, roughness = 0.8, metalness = 0 }: {
  p: V3; s: V3; c: string; roughness?: number; metalness?: number;
}) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

/* ─────────────────────────────────────────────────────────────
   Shared furniture components (grade-aware)
───────────────────────────────────────────────────────────── */

function Sofa({ p, rot, grade }: { p: V3; rot?: V3; grade: string }) {
  const col = grade === "luxury" ? "#3d4f3a" : grade === "mid" ? "#5a6b52" : "#6b7060";
  const dk  = grade === "luxury" ? "#2e3d2c" : grade === "mid" ? "#4d5e46" : "#5a5e52";
  return (
    <group position={p} rotation={rot}>
      <B p={[0, 0.22, 0]}   s={[2.2, 0.28, 0.9]}  c={col} roughness={0.9} />
      <B p={[0, 0.55, -0.38]} s={[2.2, 0.5, 0.16]} c={dk}  roughness={0.9} />
      <B p={[-1, 0.35, 0]}  s={[0.2, 0.28, 0.9]}   c={dk}  roughness={0.9} />
      <B p={[1,  0.35, 0]}  s={[0.2, 0.28, 0.9]}   c={dk}  roughness={0.9} />
      {grade !== "basic" && <>
        <B p={[-0.45, 0.4, 0.06]} s={[0.8, 0.08, 0.7]} c={col} />
        <B p={[0.45,  0.4, 0.06]} s={[0.8, 0.08, 0.7]} c={col} />
      </>}
    </group>
  );
}

function CoffeeTable({ p, grade }: { p: V3; grade: string }) {
  const top = grade === "luxury" ? "#b8a88a" : "#8b7355";
  const leg = grade === "luxury" ? "#6b5c40" : "#7a6548";
  return (
    <group position={p}>
      <B p={[0, 0.38, 0]} s={[1, 0.05, 0.55]} c={top} roughness={grade === "luxury" ? 0.3 : 0.7} metalness={grade === "luxury" ? 0.1 : 0} />
      {([-0.4, 0.4] as number[]).flatMap(x => [-0.22, 0.22].map(z =>
        <B key={`${x}${z}`} p={[x, 0.19, z] as V3} s={[0.06, 0.32, 0.06]} c={leg} />
      ))}
    </group>
  );
}

function TV({ p, rot, grade }: { p: V3; rot?: V3; grade: string }) {
  const w = grade === "luxury" ? 1.8 : 1.4;
  return (
    <group position={p} rotation={rot}>
      <B p={[0, 0.32, 0]} s={[w + 0.2, 0.55, 0.38]} c="#2e2e2e" roughness={0.5} />
      <B p={[0, 0.32, 0.01]} s={[w + 0.18, 0.05, 0.32]} c="#222" roughness={0.4} />
      <B p={[0, 1.4, -0.1]}  s={[w, 0.75, 0.06]}       c="#111" roughness={0.2} metalness={0.3} />
      <B p={[0, 0.95, -0.04]} s={[0.12, 0.08, 0.12]}   c="#252525" />
    </group>
  );
}

function KitchenCounter({ p, len, grade }: { p: V3; len: number; grade: string }) {
  const cab = grade === "luxury" ? "#e8e4dc" : grade === "mid" ? "#d8d0c0" : "#c8c0b0";
  const top = grade === "luxury" ? "#d0ccc4" : grade === "mid" ? "#c0b8a8" : "#b8b0a0";
  return (
    <group position={p}>
      <B p={[0, 0.46, 0]} s={[0.65, 0.92, len]}   c={cab} roughness={0.7} />
      <B p={[0.05, 0.94, 0]} s={[0.7, 0.05, len + 0.1]} c={top} roughness={grade === "luxury" ? 0.2 : 0.6} metalness={grade === "luxury" ? 0.05 : 0} />
      <B p={[-0.05, 1.8, 0]} s={[0.45, 0.7, len]} c={cab} roughness={0.7} />
    </group>
  );
}

function Island({ p, grade }: { p: V3; grade: string }) {
  const cab = grade === "luxury" ? "#2a2a2a" : grade === "mid" ? "#d0c8b8" : "#c4bcaa";
  const top = grade === "luxury" ? "#e0e0e0" : "#d4ccbc";
  return (
    <group position={p}>
      <B p={[0, 0.46, 0]} s={[1.6, 0.92, 0.8]} c={cab} roughness={0.6} />
      <B p={[0, 0.94, 0]} s={[1.7, 0.05, 0.9]} c={top} roughness={grade === "luxury" ? 0.15 : 0.5} metalness={grade === "luxury" ? 0.1 : 0} />
      {([-0.55, 0.55] as number[]).map(x =>
        <mesh key={x} position={[x, 0.4, 0.72]}>
          <cylinderGeometry args={[0.14, 0.14, 0.72, 8]} />
          <meshStandardMaterial color={grade === "luxury" ? "#888" : "#6b6b6b"} metalness={0.4} roughness={0.3} />
        </mesh>
      )}
    </group>
  );
}

function Fridge({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <B p={[0, 1.05, 0]} s={[0.82, 2.1, 0.72]} c="#e4e4e4" roughness={0.4} metalness={0.1} />
      <B p={[0.39, 1.35, 0.02]} s={[0.04, 0.55, 0.04]} c="#aaa" metalness={0.5} roughness={0.3} />
      <B p={[0.39, 0.5,  0.02]} s={[0.04, 0.45, 0.04]} c="#aaa" metalness={0.5} roughness={0.3} />
    </group>
  );
}

function Bed({ p, rot, grade }: { p: V3; rot?: V3; grade: string }) {
  const frame = grade === "luxury" ? "#1a1a1a" : grade === "mid" ? "#6b4226" : "#7a5535";
  const sheet = grade === "luxury" ? "#f8f6f2" : "#f0ece5";
  const pillow = grade === "luxury" ? "#ffffff" : "#f5f2ee";
  const size: V3 = grade === "luxury" ? [1.8, 0.38, 2.2] : [1.6, 0.35, 2.1];
  return (
    <group position={p} rotation={rot}>
      <B p={[0, 0.22, 0]}   s={size}                         c={frame} roughness={0.6} />
      <B p={[0, 0.44, 0]}   s={[size[0]-0.1, 0.14, size[2]-0.05]} c={sheet} roughness={0.9} />
      <B p={[0, 0.54, 0.06]} s={[size[0]-0.2, 0.07, size[2]-0.25]} c={sheet} roughness={0.9} />
      <B p={[0, 0.73, -size[2]/2+0.08]} s={[size[0], 0.85, 0.1]} c={frame} roughness={0.6} />
      {[-0.38, 0.38].map(x =>
        <B key={x} p={[x, 0.58, -size[2]/2+0.35] as V3} s={[0.5, 0.13, 0.38]} c={pillow} roughness={0.95} />
      )}
    </group>
  );
}

function Nightstand({ p, grade }: { p: V3; grade: string }) {
  const col = grade === "luxury" ? "#1a1a1a" : "#7a6548";
  const lampShade = grade === "luxury" ? "#f0e8d0" : "#f5e6c8";
  return (
    <group position={p}>
      <B p={[0, 0.32, 0]} s={[0.48, 0.58, 0.42]} c={col} roughness={grade === "luxury" ? 0.4 : 0.7} />
      <B p={[0, 0.63, 0]} s={[0.5, 0.04, 0.44]}  c={col} roughness={0.5} />
      <mesh position={[0, 0.84, 0]}>
        <cylinderGeometry args={[0.04, 0.07, 0.28, 8]} />
        <meshStandardMaterial color="#c0b090" />
      </mesh>
      <mesh position={[0, 1.04, 0]}>
        <coneGeometry args={[0.16, 0.22, 8]} />
        <meshStandardMaterial color={lampShade} emissive={lampShade} emissiveIntensity={0.18} />
      </mesh>
      <pointLight position={[0, 1, 0]} intensity={0.5} color="#fff5e0" distance={3} decay={2} />
    </group>
  );
}

function Dresser({ p, rot, grade }: { p: V3; rot?: V3; grade: string }) {
  const col = grade === "luxury" ? "#1e1e1e" : "#7a6548";
  const handle = grade === "luxury" ? "#999" : "#aaa";
  return (
    <group position={p} rotation={rot}>
      <B p={[0, 0.52, 0]} s={[1.3, 0.98, 0.48]} c={col} roughness={0.6} />
      <B p={[0, 1.02, 0]} s={[1.35, 0.04, 0.5]} c={col} roughness={0.4} />
      {[0.25, 0.55, 0.8].map(y =>
        <B key={y} p={[0, y, 0.26] as V3} s={[0.22, 0.04, 0.04]} c={handle} metalness={0.5} roughness={0.3} />
      )}
    </group>
  );
}

function Window({ p, rot, size = [1.2, 1.1] as [number, number] }: {
  p: V3; rot?: V3; size?: [number, number];
}) {
  return (
    <group position={p} rotation={rot}>
      <mesh>
        <planeGeometry args={size} />
        <meshStandardMaterial color="#c5dff0" emissive="#a0c8e8" emissiveIntensity={0.35} transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[size[0], 0.045, 0.035]} />
        <meshStandardMaterial color="#d4c8b0" />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[0.045, size[1], 0.035]} />
        <meshStandardMaterial color="#d4c8b0" />
      </mesh>
      <pointLight position={[0, 0, 1.5]} intensity={2} color="#fff8f0" distance={5} decay={2} />
    </group>
  );
}

function CeilingLight({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <pointLight intensity={1.8} color="#fff5e0" distance={5} decay={2} />
      <mesh>
        <cylinderGeometry args={[0.13, 0.2, 0.07, 8]} />
        <meshStandardMaterial color="#f5e6c8" emissive="#f5e6c8" emissiveIntensity={0.55} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   Dynamic room shell
───────────────────────────────────────────────────────────── */

function RoomShell({ cfg }: { cfg: SceneConfig }) {
  const { rw, rh, palette, totalLen, zones, zoneLen } = cfg;
  const hw = rw / 2;

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, totalLen / 2]} receiveShadow>
        <planeGeometry args={[rw, totalLen]} />
        <meshStandardMaterial color={palette.floor} roughness={0.9} />
      </mesh>
      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, rh, totalLen / 2]}>
        <planeGeometry args={[rw, totalLen]} />
        <meshStandardMaterial color={palette.ceil} roughness={1} />
      </mesh>
      {/* Front wall with doorway */}
      <B p={[-2, rh / 2, 0]}   s={[rw / 2 - 0.6, rh, 0.15]}     c={palette.wall} />
      <B p={[2,  rh / 2, 0]}   s={[rw / 2 - 0.6, rh, 0.15]}     c={palette.wall} />
      <B p={[0,  rh - 0.3, 0]} s={[1.1, 0.6, 0.15]}              c={palette.wall} />
      {/* Back wall */}
      <B p={[0, rh / 2, totalLen]} s={[rw, rh, 0.15]} c={palette.wall} />
      {/* Side walls */}
      <B p={[-hw, rh / 2, totalLen / 2]} s={[0.15, rh, totalLen]} c={palette.wall} />
      <B p={[ hw, rh / 2, totalLen / 2]} s={[0.15, rh, totalLen]} c={palette.wall} />
      {/* Trim */}
      <B p={[-hw + 0.04, 0.06, totalLen / 2]} s={[0.04, 0.12, totalLen]} c={palette.trim} />
      <B p={[ hw - 0.04, 0.06, totalLen / 2]} s={[0.04, 0.12, totalLen]} c={palette.trim} />
      {/* Windows — left wall, one per zone */}
      {zones.map((_, i) => {
        const z = i * zoneLen + zoneLen / 2;
        return <Window key={`wl${i}`} p={[-hw + 0.02, rh * 0.6, z]} rot={[0, Math.PI / 2, 0]} />;
      })}
      {/* Windows — right wall, alternate zones */}
      {zones.filter((_, i) => i % 2 === 1).map((_, i) => {
        const z = (i * 2 + 1) * zoneLen + zoneLen / 2;
        return <Window key={`wr${i}`} p={[hw - 0.02, rh * 0.6, z]} rot={[0, -Math.PI / 2, 0]} />;
      })}
      {/* Ceiling lights */}
      {zones.map((_, i) => (
        <CeilingLight key={`cl${i}`} p={[0, rh - 0.04, i * zoneLen + zoneLen / 2]} />
      ))}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   Zone renderers
───────────────────────────────────────────────────────────── */

function EntryZone({ z0, cfg }: { z0: number; cfg: SceneConfig }) {
  const { palette, furnitureGrade: g } = cfg;
  const zc = z0 + cfg.zoneLen / 2;
  return (
    <group>
      {/* Door frame */}
      <B p={[-0.65, cfg.rh / 2 - 0.15, z0 + 0.08]} s={[0.12, cfg.rh - 0.3, 0.12]} c={palette.trim} />
      <B p={[ 0.65, cfg.rh / 2 - 0.15, z0 + 0.08]} s={[0.12, cfg.rh - 0.3, 0.12]} c={palette.trim} />
      <B p={[0, cfg.rh - 0.2, z0 + 0.08]}           s={[1.5, 0.12, 0.12]}           c={palette.trim} />
      {/* Entry rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, zc]}>
        <planeGeometry args={[cfg.rw * 0.5, cfg.zoneLen * 0.7]} />
        <meshStandardMaterial color={g === "luxury" ? "#8a7060" : "#9a8878"} roughness={1} />
      </mesh>
      {/* Console table */}
      <B p={[cfg.rw / 2 - 0.45, 0.72, zc - 0.5]} s={[0.35, 1.3, 0.9]} c={palette.accent} roughness={0.6} />
      <B p={[cfg.rw / 2 - 0.45, 1.38, zc - 0.5]} s={[0.4, 0.05, 1]}   c={g === "luxury" ? "#c0c0c0" : palette.accent} roughness={g === "luxury" ? 0.2 : 0.6} />
    </group>
  );
}

function LivingZone({ z0, cfg }: { z0: number; cfg: SceneConfig }) {
  const { rw, furnitureGrade: g, palette } = cfg;
  const zc = z0 + cfg.zoneLen / 2;
  return (
    <group>
      {/* Rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-rw * 0.1, 0.003, zc]}>
        <planeGeometry args={[rw * 0.7, cfg.zoneLen * 0.8]} />
        <meshStandardMaterial color={g === "luxury" ? "#6a5a4a" : "#8b7d6b"} roughness={1} />
      </mesh>
      <Sofa p={[-rw / 2 + 1.4, 0, zc - 0.5]} rot={[0, Math.PI / 2, 0]} grade={g} />
      <CoffeeTable p={[-rw * 0.05, 0, zc]} grade={g} />
      <TV p={[rw / 2 - 0.3, 0, zc]} rot={[0, -Math.PI / 2, 0]} grade={g} />
      {/* Accent light */}
      <pointLight position={[rw / 2 - 1, cfg.rh - 0.5, zc]} intensity={0.8} color="#ffe8c0" distance={4} decay={2} />
      {/* Art on back wall */}
      <B p={[-rw * 0.15, cfg.rh * 0.65, z0 + cfg.zoneLen - 0.08]} s={[1.4, 0.9, 0.04]} c={g === "luxury" ? "#d4c8b0" : "#c4b8a0"} />
    </group>
  );
}

function KitchenZone({ z0, cfg }: { z0: number; cfg: SceneConfig }) {
  const { rw, furnitureGrade: g, palette } = cfg;
  const zc = z0 + cfg.zoneLen / 2;
  return (
    <group>
      {/* Tile floor overlay */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, zc]}>
        <planeGeometry args={[rw, cfg.zoneLen]} />
        <meshStandardMaterial color={palette.counter} roughness={0.8} />
      </mesh>
      <KitchenCounter p={[-rw / 2 + 0.38, 0, zc]} len={cfg.zoneLen * 0.85} grade={g} />
      <Island p={[rw * 0.15, 0, zc]} grade={g} />
      <Fridge p={[rw / 2 - 0.5, 0, z0 + 1]} />
      {/* Under-cabinet light */}
      <pointLight position={[-rw / 2 + 0.7, 1.05, zc]} intensity={1.2} color="#fff8e0" distance={3.5} decay={2} />
    </group>
  );
}

function BedroomZone({ z0, index, cfg }: { z0: number; index: number; cfg: SceneConfig }) {
  const { rw, furnitureGrade: g } = cfg;
  const zc = z0 + cfg.zoneLen / 2;
  const side = index % 2 === 0 ? 1 : -1; // alternate bed sides
  const rugColor = g === "luxury" ? "#6a5e52" : g === "mid" ? "#8a7a6a" : "#9a8e80";
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[side * rw * 0.12, 0.003, zc]}>
        <planeGeometry args={[rw * 0.6, cfg.zoneLen * 0.75]} />
        <meshStandardMaterial color={rugColor} roughness={1} />
      </mesh>
      <Bed p={[side * rw * 0.1, 0, zc]} rot={[0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0]} grade={g} />
      <Nightstand p={[side * rw * 0.1 + side * 1.1, 0, zc - 0.6]} grade={g} />
      <Nightstand p={[side * rw * 0.1 + side * 1.1, 0, zc + 0.6]} grade={g} />
      <Dresser p={[-side * (rw / 2 - 0.5), 0, zc - 1]} rot={[0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]} grade={g} />
    </group>
  );
}

function PoolZone({ z0, cfg }: { z0: number; cfg: SceneConfig }) {
  const { rw, rh } = cfg;
  const zc = z0 + cfg.zoneLen / 2;
  const pw = rw * 0.7;
  const pl = cfg.zoneLen * 0.65;
  return (
    <group>
      {/* Pool water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, zc]}>
        <planeGeometry args={[pw, pl]} />
        <meshStandardMaterial color="#4da8d8" transparent opacity={0.82} roughness={0.05} metalness={0.1} />
      </mesh>
      {/* Pool surround */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, zc]}>
        <planeGeometry args={[pw + 1.5, pl + 1.5]} />
        <meshStandardMaterial color="#d4cfc4" roughness={0.8} />
      </mesh>
      {/* Glass walls */}
      {[-rw / 2 + 0.1, rw / 2 - 0.1].map((x, i) => (
        <mesh key={i} position={[x, rh / 2, zc]}>
          <planeGeometry args={[0.05, rh]} />
          <meshStandardMaterial color="#a0d0f0" transparent opacity={0.3} roughness={0.05} />
        </mesh>
      ))}
      {/* Pool light */}
      <pointLight position={[0, 0.3, zc]} intensity={1.5} color="#40b0e0" distance={pw + 1} decay={2} />
    </group>
  );
}

function GarageZone({ z0, cfg }: { z0: number; cfg: SceneConfig }) {
  const { rw, rh, palette } = cfg;
  const zc = z0 + cfg.zoneLen / 2;
  return (
    <group>
      {/* Concrete floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, zc]}>
        <planeGeometry args={[rw, cfg.zoneLen]} />
        <meshStandardMaterial color="#b0aaa0" roughness={1} />
      </mesh>
      {/* Car silhouette */}
      <B p={[0, 0.62, zc]} s={[1.8, 1.1, 4.2]} c="#555"   roughness={0.5} />
      <B p={[0, 1.22, zc + 0.2]} s={[1.6, 0.5, 2.4]} c="#666" roughness={0.4} />
      {/* Overhead garage door (closed) */}
      <B p={[0, rh / 2, z0 + cfg.zoneLen - 0.1]} s={[rw - 0.2, rh, 0.08]} c={palette.trim} roughness={0.6} />
      {/* Workbench */}
      <B p={[-rw / 2 + 0.35, 0.82, zc + 1.5]} s={[0.5, 1.5, 1.2]} c={palette.accent} />
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   Walkthrough camera on CatmullRom spline
───────────────────────────────────────────────────────────── */

function WalkthroughCamera({
  cfg, playingRef, progressRef, resetRef,
}: {
  cfg: SceneConfig;
  playingRef: { current: boolean };
  progressRef: { current: number };
  resetRef: { current: boolean };
}) {
  const { camera } = useThree();
  const elapsed = useRef(0);
  const EYE = 1.62;

  const [posCurve, lookCurve] = useMemo(() => {
    const { zones, zoneLen } = cfg;
    const posPoints: THREE.Vector3[] = [];
    const lookPoints: THREE.Vector3[] = [];

    // Start just inside doorway
    posPoints.push(new THREE.Vector3(0, EYE, 0.4));
    lookPoints.push(new THREE.Vector3(0, EYE - 0.1, 4));

    zones.forEach((zone, i) => {
      const z0 = i * zoneLen;
      const zc = z0 + zoneLen / 2;
      const ze = z0 + zoneLen;

      switch (zone) {
        case "entry":
          posPoints.push(new THREE.Vector3(0, EYE, z0 + zoneLen * 0.3));
          lookPoints.push(new THREE.Vector3(0, EYE - 0.05, zc));
          posPoints.push(new THREE.Vector3(cfg.rw * 0.15, EYE, zc));
          lookPoints.push(new THREE.Vector3(-cfg.rw * 0.2, EYE + 0.1, ze));
          break;
        case "living":
          posPoints.push(new THREE.Vector3(-cfg.rw * 0.1, EYE, z0 + zoneLen * 0.25));
          lookPoints.push(new THREE.Vector3(-cfg.rw * 0.3, EYE - 0.1, zc));
          posPoints.push(new THREE.Vector3(0, EYE, zc));
          lookPoints.push(new THREE.Vector3(cfg.rw * 0.3, EYE - 0.15, zc));
          posPoints.push(new THREE.Vector3(cfg.rw * 0.1, EYE, ze - zoneLen * 0.2));
          lookPoints.push(new THREE.Vector3(0, EYE - 0.05, ze));
          break;
        case "kitchen":
          posPoints.push(new THREE.Vector3(cfg.rw * 0.15, EYE, z0 + zoneLen * 0.2));
          lookPoints.push(new THREE.Vector3(-cfg.rw * 0.25, EYE + 0.1, zc));
          posPoints.push(new THREE.Vector3(0, EYE, zc));
          lookPoints.push(new THREE.Vector3(cfg.rw * 0.2, EYE - 0.05, zc));
          break;
        case "bedroom":
          posPoints.push(new THREE.Vector3(-cfg.rw * 0.05, EYE, z0 + zoneLen * 0.15));
          lookPoints.push(new THREE.Vector3(cfg.rw * 0.15, EYE - 0.1, zc));
          posPoints.push(new THREE.Vector3(cfg.rw * 0.05, EYE, zc));
          lookPoints.push(new THREE.Vector3(-cfg.rw * 0.2, EYE - 0.15, zc));
          break;
        case "pool":
          posPoints.push(new THREE.Vector3(0, EYE, z0 + zoneLen * 0.2));
          lookPoints.push(new THREE.Vector3(0, EYE - 0.3, zc));
          posPoints.push(new THREE.Vector3(cfg.rw * 0.25, EYE + 0.2, zc));
          lookPoints.push(new THREE.Vector3(-cfg.rw * 0.2, 0.2, zc));
          break;
        case "garage":
          posPoints.push(new THREE.Vector3(0, EYE, z0 + zoneLen * 0.25));
          lookPoints.push(new THREE.Vector3(0, EYE - 0.1, zc));
          break;
      }
    });

    // End point slightly back
    posPoints.push(new THREE.Vector3(0, EYE + 0.3, cfg.totalLen - 0.5));
    lookPoints.push(new THREE.Vector3(0, EYE, cfg.totalLen * 0.6));

    return [
      new THREE.CatmullRomCurve3(posPoints),
      new THREE.CatmullRomCurve3(lookPoints),
    ] as const;
  }, [cfg]);

  useFrame((_, dt) => {
    if (resetRef.current) { elapsed.current = 0; resetRef.current = false; }
    if (playingRef.current) elapsed.current = Math.min(elapsed.current + dt, cfg.duration);
    const t = Math.min(elapsed.current / cfg.duration, 0.9999);
    camera.position.copy(posCurve.getPointAt(t));
    camera.lookAt(lookCurve.getPointAt(t));
    progressRef.current = elapsed.current / cfg.duration;
  });

  return null;
}

/* ─────────────────────────────────────────────────────────────
   Full scene
───────────────────────────────────────────────────────────── */

function Scene({
  cfg, playingRef, progressRef, resetRef,
}: {
  cfg: SceneConfig;
  playingRef: { current: boolean };
  progressRef: { current: number };
  resetRef: { current: boolean };
}) {
  let bedroomIdx = 0;
  return (
    <>
      <color attach="background" args={["#111"]} />
      <ambientLight intensity={0.18} />
      <RoomShell cfg={cfg} />
      {cfg.zones.map((zone, i) => {
        const z0 = i * cfg.zoneLen;
        switch (zone) {
          case "entry":   return <EntryZone   key={i} z0={z0} cfg={cfg} />;
          case "living":  return <LivingZone  key={i} z0={z0} cfg={cfg} />;
          case "kitchen": return <KitchenZone key={i} z0={z0} cfg={cfg} />;
          case "bedroom": return <BedroomZone key={i} z0={z0} index={bedroomIdx++} cfg={cfg} />;
          case "pool":    return <PoolZone    key={i} z0={z0} cfg={cfg} />;
          case "garage":  return <GarageZone  key={i} z0={z0} cfg={cfg} />;
        }
      })}
      <WalkthroughCamera cfg={cfg} playingRef={playingRef} progressRef={progressRef} resetRef={resetRef} />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main export
───────────────────────────────────────────────────────────── */

const DEFAULT_STATS: PropertyStats = {
  price: 750_000, beds: 3, baths: 2, sqft: 1800,
  yearBuilt: 2005, propertyType: "single_family",
  pool: false, garage: true, basement: false, stories: 1,
};

function GlCapture({ glRef }: { glRef: React.MutableRefObject<THREE.WebGLRenderer | null> }) {
  const { gl } = useThree();
  glRef.current = gl;
  return null;
}

export function Tour3DView({ addressLine, description, propertyStats, className }: Tour3DViewProps) {
  const stats = propertyStats ?? DEFAULT_STATS;
  const cfg = useMemo(() => buildConfig(stats), [stats]);

  const [playing, setPlaying] = useState(true);
  const [ready, setReady]     = useState(false);
  const [dp, setDp]           = useState(0);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  const playingRef   = useRef(true);
  const progressRef  = useRef(0);
  const resetRef     = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const glRef        = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => { playingRef.current = playing; }, [playing]);

  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => setDp(progressRef.current), 80);
    return () => clearInterval(id);
  }, [ready]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") { e.preventDefault(); setPlaying((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const elapsed = dp * cfg.duration;
  const fmt = (s: number) => `0:${Math.floor(s).toString().padStart(2, "0")}`;

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen().catch(() => {});
  }, []);

  const handleSave = useCallback(async () => {
    if (!glRef.current || saving) return;
    setSaving(true);
    try {
      const imageData = glRef.current.domElement.toDataURL("image/png");
      const publicId = `tour-${addressLine.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 60)}-${Date.now()}`;
      await fetch("/api/tour/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, publicId }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }, [addressLine, saving]);

  // Zone label for current position
  const currentZone = cfg.zones[Math.min(Math.floor(dp * cfg.zones.length), cfg.zones.length - 1)];
  const zoneLabel: Record<string, string> = {
    entry: "Entryway", living: "Living Room", kitchen: "Kitchen",
    bedroom: "Bedroom", pool: "Pool Area", garage: "Garage",
  };

  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 max-h-[min(54vh,28rem)] rounded-xl overflow-hidden border border-border/40 bg-[#111]"
      >
        <Canvas
          camera={{ position: [0, 1.62, 0.4], fov: 72 }}
          dpr={[1, 1.5]}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.1;
            setReady(true);
          }}
        >
          <Suspense fallback={null}>
            <Scene cfg={cfg} playingRef={playingRef} progressRef={progressRef} resetRef={resetRef} />
          </Suspense>
          <GlCapture glRef={glRef} />
        </Canvas>

        {/* Zone label */}
        {ready && (
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/50 text-white/80 text-[10px] font-medium backdrop-blur-sm">
            {zoneLabel[currentZone] ?? currentZone}
          </div>
        )}

        {/* Three.js badge */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600/90 text-white text-[10px] font-medium backdrop-blur-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
          Three.js
        </div>

        {/* Loading */}
        {!ready && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#111]">
            <div className="w-8 h-8 border-2 border-primary/60 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Player controls */}
        <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/70 to-transparent pt-5">
          <div className="px-3 mb-0.5">
            <div className="w-full h-0.5 bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-[width] duration-150 ease-linear"
                style={{ width: `${dp * 100}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between px-3 pb-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPlaying((v) => !v)} className="text-white/90 hover:text-white">
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <span className="text-white/70 text-[10px] tabular-nums font-medium">
                {fmt(elapsed)} / {fmt(cfg.duration)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="text-white/40 cursor-default">
                <Volume2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="text-white/60 hover:text-white disabled:opacity-40"
                title="Save to Cloudinary"
              >
                {saved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={handleFullscreen} className="text-white/60 hover:text-white">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 mt-3 shrink-0">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs"
          onClick={() => { resetRef.current = true; setPlaying(true); }}>
          <RotateCcw className="w-3.5 h-3.5" />
          Restart
        </Button>
        {stats && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground ml-1">
            <span>${stats.price.toLocaleString()}</span>
            <span className="opacity-40">·</span>
            <span>{stats.beds}bd/{stats.baths}ba</span>
            <span className="opacity-40">·</span>
            <span>{stats.sqft.toLocaleString()} sqft</span>
            <span className="opacity-40">·</span>
            <span>{cfg.zones.length} rooms</span>
          </div>
        )}
        {description && (
          <p className="text-[11px] text-muted-foreground/40 italic ml-auto truncate max-w-[38%]">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
