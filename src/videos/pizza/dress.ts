// Practical light pools per shot (world coordinates; world.ts moves them into view space).
import { V3, SHOTS } from "./story";

export type Pool = { p: V3; c: [number, number, number]; r: number };
const WARM: [number, number, number] = [1.5, 0.9, 0.38];
export const poolsAt = (id: number, t: number): Pool[] => {
  const fl = 1 + 0.1 * Math.sin(t * 9), s = SHOTS[id - 1];
  switch (s.set) {
    case "room": return s.light === "night" ? [{ p: [-1.85, 1.1, -3.6], c: [0.5 * fl, 1.3 * fl, 0.8 * fl], r: 3.5 }, { p: [-0.8, 1.3, -4.0], c: WARM, r: 3.5 }, { p: [4.4, 1.6, 4.6], c: WARM, r: 4 }] : [{ p: [-0.8, 1.3, -4.0], c: [0.8, 0.55, 0.25], r: 3 }];
    case "jroom": return s.light === "night" ? [{ p: [1.75, 1.1, -3.6], c: [0.4 * fl, 1.0 * fl, 1.5 * fl], r: 3.5 }, { p: [3.6, 1.1, 3.4], c: [1.0, 0.5, 1.2], r: 3 }] : [];
    case "shop": return [{ p: [-3.0, 1.0, -4.4], c: [1.8 * fl, 0.8 * fl, 0.25 * fl], r: 4.5 }, { p: [0, 2.6, -2.1], c: WARM, r: 5 }];
    case "arcade": return [{ p: [-3, 2.0, -5], c: [1.4, 0.3, 0.9], r: 6 }, { p: [3, 2.0, -5], c: [0.3, 1.1, 1.5], r: 6 }, { p: [0, 2.5, 1], c: [0.8, 0.4, 1.2], r: 6 }];
    case "street": return s.light === "night" ? [{ p: [-0.7, 2.1, -4.9], c: [1.8, 1.2, 0.5], r: 4 }] : [];
    case "studio": return [{ p: [0, 3, 0], c: [1.3, 1.1, 0.8], r: 7 }];
    default: return [];
  }
};
