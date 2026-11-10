// Practical light pools per shot (world coordinates; world.ts moves them into view space).
import { V3, MAG, MAG12, KMW } from "./story";

export type Pool = { p: V3; c: [number, number, number]; r: number };
const WARM: [number, number, number] = [1.5, 0.9, 0.38];
const BLUE: [number, number, number] = [0.5, 0.9, 1.6];
export const poolsAt = (id: number, t: number): Pool[] => {
  const fl = 1 + 0.1 * Math.sin(t * 9);
  switch (id) {
    case 1: case 2: case 8: case 11: case 18: case 19: return [{ p: [2.6, 2.2, -2.5], c: WARM, r: 6 }];
    case 7: case 9: case 10: return [{ p: [2.6, 2.2, -2.5], c: WARM, r: 6 }, { p: [MAG[0], MAG[1] + 0.4, MAG[2] + 0.5], c: [BLUE[0] * fl, BLUE[1] * fl, BLUE[2] * fl], r: 3 }];
    case 12: return [{ p: [MAG12[0], MAG12[1] + 0.5, MAG12[2] + 0.6], c: [BLUE[0] * fl, BLUE[1] * fl, BLUE[2] * fl], r: 4 }, { p: [0.4, 1.4, 0.2], c: [1.4, 0.7, 0.3], r: 4 }];
    case 15: return [{ p: [KMW[0], KMW[1] + 0.3, KMW[2] + 0.6], c: [1.6 * fl, 1.0 * fl, 0.4 * fl], r: 4 }, { p: [-1.5, 2.3, -1.5], c: WARM, r: 5 }];
    case 14: return [{ p: [-1.5, 2.3, -1.5], c: WARM, r: 5 }];
    case 16: case 13: return [{ p: [0.5, 2.6, 1.2], c: WARM, r: 5 }];
    case 17: return [-6, -2, 2, 6].map((x) => ({ p: [x * 3, 1.6, -4] as V3, c: [1.6, 1.0, 0.4] as [number, number, number], r: 5 }));
    case 3: case 4: case 5: case 6: return [];
    default: return [];
  }
};
