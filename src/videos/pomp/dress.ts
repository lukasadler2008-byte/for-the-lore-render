// Practical light pools per shot (world coordinates; world.ts moves them into view space).
import { V3, SHOTS } from "./story";

export type Pool = { p: V3; c: [number, number, number]; r: number };
const WARM: [number, number, number] = [1.6, 0.8, 0.3];
export const poolsAt = (id: number, t: number): Pool[] => {
  const fl = 1 + 0.12 * Math.sin(t * 9), s = SHOTS[id - 1];
  if (s.light === "night") return [-5.2, 5.2].flatMap((x) => [10, -12, -34].map((z) => ({ p: [x, 2.8, z] as V3, c: [WARM[0] * fl, WARM[1] * fl, WARM[2] * fl] as [number, number, number], r: 9 })));
  return [];
};
