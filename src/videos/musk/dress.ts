// Practical light pools per shot (world coordinates; world.ts moves them into view space).
import { V3, SHOTS } from "./story";

export type Pool = { p: V3; c: [number, number, number]; r: number };
const WARM: [number, number, number] = [1.5, 0.9, 0.38];
export const poolsAt = (id: number, t: number): Pool[] => {
  const fl = 1 + 0.1 * Math.sin(t * 9), s = SHOTS[id - 1];
  switch (s.set) {
    case "pizzeria": return [{ p: [-1.5, 2.2, 1.5], c: [1.6 * fl, 1.0 * fl, 0.4 * fl], r: 6 }, { p: [3, 2.2, 1], c: WARM, r: 5 }];
    case "garage": return [{ p: [-3, 3, -1], c: WARM, r: 6 }];
    case "studio": return [{ p: [0, 3, 0], c: [1.3, 1.1, 0.8], r: 7 }];
    default: return [];
  }
};
