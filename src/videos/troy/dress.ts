// Practical light pools per shot (world coordinates; world.ts moves them into view space).
import { V3, SHOTS } from "./story";

export type Pool = { p: V3; c: [number, number, number]; r: number };
const WARM: [number, number, number] = [1.6, 0.8, 0.3];
export const poolsAt = (id: number, t: number): Pool[] => {
  const fl = 1 + 0.12 * Math.sin(t * 9), s = SHOTS[id - 1];
  if (s.set === "troy" && s.light === "night") return [{ p: [0, 3, -44], c: [WARM[0] * fl, WARM[1] * fl, WARM[2] * fl], r: 9 }, { p: [-7, 1.5, -38], c: WARM, r: 6 }, { p: [7, 1.5, -38], c: WARM, r: 6 }, { p: [0, 3, -25], c: WARM, r: 7 }, { p: [0, 2, -8], c: [1.4 * fl, 0.7, 0.25], r: 9 }];
  if (s.light === "night" || s.set === "camp") return [{ p: [-6, 1.5, 5], c: WARM, r: 6 }];
  return [];
};
