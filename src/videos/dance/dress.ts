// Practical light pools per shot (world coordinates; world.ts moves them into view space): chandeliers, lanterns,
// lamps, torches, candles and the saint's glow.
import { V3, STATUE, wt } from "./story";

export type Pool = { p: V3; c: [number, number, number]; r: number };
const WARM: [number, number, number] = [1.5, 0.9, 0.38];
const DIM: [number, number, number] = [0.9, 0.52, 0.22];
export const poolsAt = (id: number, t: number): Pool[] => {
  switch (id) {
    case 8: case 9: {
      const fl = id === 9 ? 0.08 * Math.sin(t * 25) : 0;
      return [{ p: [0, 5.5, 8], c: [WARM[0] + fl, WARM[1], WARM[2]], r: 8 }, { p: [0, 5.5, -2], c: WARM, r: 8 }, { p: [-6, 3, -13], c: WARM, r: 6 }, { p: [6, 3, -13], c: WARM, r: 6 }];
    }
    case 13: return [{ p: [-4, 2.4, 14], c: DIM, r: 5 }, { p: [4.5, 2.4, 4], c: DIM, r: 5 }, { p: [-4, 2.4, -4], c: DIM, r: 5 }, { p: [0, 3.2, -2], c: [0.3, 0.2, 0.55], r: 5 }];
    case 14: return [{ p: [-6, 2.1, 1.6], c: [1.6, 1.0, 0.45], r: 6 }, { p: [6, 2.1, 1.6], c: [1.6, 1.0, 0.45], r: 6 }, { p: [3.6, 0.8, 3.8], c: [1.2, 0.7, 0.3], r: 3 }];
    case 15: return [{ p: [-8, 2.4, 6], c: [1.6, 0.8, 0.3], r: 6 }, { p: [8, 2.4, 6], c: [1.6, 0.8, 0.3], r: 6 }, { p: [-8, 2.4, -6], c: [1.6, 0.8, 0.3], r: 6 }, { p: [8, 2.4, -6], c: [1.6, 0.8, 0.3], r: 6 }];
    case 16: return [{ p: [0.5, 2.6, 1.2], c: [1.6, 0.95, 0.4], r: 4.5 }, { p: [-1.6, 2.4, -1.5], c: DIM, r: 4 }];
    case 18: {
      const g = 1 + 0.5 * Math.max(0, Math.min(1, (t - wt(18, "saint")) / 1.5));
      return [{ p: [STATUE[0], 2.4, STATUE[2] + 3], c: [1.5 * g, 1.0 * g, 0.4 * g], r: 9 }, { p: [-3, 1.4, -7], c: WARM, r: 4 }, { p: [3, 1.4, -7], c: WARM, r: 4 }];
    }
    default: return [];
  }
};
