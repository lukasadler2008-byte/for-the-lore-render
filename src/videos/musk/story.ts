// Timeline of "How Elon Musk Became the Richest Person": 18 voice lines cut into 46 shots (every 1-3 s), timed to
// public/musk/words.json ({word, start, end, line}). Re-timing = replace words.json (+ voice.wav): VOICE_SEC / TOTAL follow the
// last word of that file; shot edges come from lineStart(n) and word beats wt(line, word[, nth]) / wtf(line, word, frac) /
// lf(line, u), which fall back to a fraction of the line when the recogniser spelled a word differently ("307" ->
// "three hundred seven"). No seconds are hard-coded anywhere. Cameras are analytic functions of the shot progress.
import WORDS from "../../../public/musk/words.json";

export const FPS = 30;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const easeIn = (u: number) => clamp01(u) ** 2.2;

type Word = { word: string; start: number; end: number; line: number };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const WL = (WORDS as Word[]).map((w) => ({ ...w, word: norm(w.word) }));
/** the voice track ends with the last spoken word of words.json */
export const VOICE_SEC = WL.reduce((m, w) => Math.max(m, w.end), 0) || 90;
export const HOLD_SEC = 0.9; // the finale holds its last picture after the last word
export const TOTAL = Math.ceil((VOICE_SEC + HOLD_SEC) * FPS) + 3;
const NLINES = 18;
const inLine = (n: number) => WL.filter((w) => w.line === n);
export const lineStart = (n: number) => { const l = inLine(n); return l.length ? l[0].start : (VOICE_SEC * (n - 1)) / NLINES; };
export const lineEnd = (n: number) => { const l = inLine(n); return l.length ? l[l.length - 1].end : (VOICE_SEC * n) / NLINES; };
/** start of the nth occurrence of `word` in `line`; a missing word falls back to `frac` of the way through the line */
export const wtf = (line: number, word: string, frac: number, nth = 0) => {
  const m = inLine(line).filter((w) => w.word === norm(word));
  return m.length ? (m[nth] ?? m[0]).start : lineStart(line) + frac * (lineEnd(line) - lineStart(line));
};
export const wt = (line: number, word: string, nth = 0) => wtf(line, word, 0, nth);
/** a point `u` (0..1) through a line */
export const lf = (line: number, u: number) => lineStart(line) + u * (lineEnd(line) - lineStart(line));
export const F = (s: number) => Math.round(s * FPS);

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type SetId = "mountain" | "office" | "beach" | "hangar" | "pad" | "garage" | "cliff" | "studio" | "pizzeria" | "city" | "track";
export const INSIDE: SetId[] = ["office", "hangar", "garage", "studio"];
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
export type CamCtx = { f: number; a: number; b: number; t: number; u: number };
type CamShot = Partial<Cam> & { pos: V3; look: V3 };
export type ShotDef = { id: number; line: number; sub: number; a: number; b: number; set: SetId; light: Light; sunAz?: number; sunEl?: number; cam: (c: CamCtx) => CamShot; cInf?: number; focus?: (c: CamCtx) => V3 };
type Spec = { line: number; t0: number; set: SetId; light: Light; cam: (c: CamCtx) => CamShot; sunAz?: number; sunEl?: number; cInf?: number; focus?: (c: CamCtx) => V3 };

// ---------------- places (world coordinates, shared by sets / cast / cameras) ----------------
export const BIG = { x: 0, z: -100, s: 140 };           // the gigantic hook mountain
export const HILL: V3 = [0, 0, -10];                    // gold hill under the winners' podium
export const HILL_S = 14;
export const PAGE_X = 24;                               // Page's smaller pile
export const STACK_X = -24;                             // three small piles stacked for scale
export const SMALL_S = 4.6;
export const OFF = { musk: [-0.9, 0, -2.6] as V3, buyer: [1.3, 0, -2.6] as V3, wallZ: -4.7 };
export const BEACH_CH: V3 = [0, 0, 0];
export const ROCK_S = 12;
export const SLOT: V3[] = [[-14, 0, -30], [0, 0, -30], [14, 0, -30]];
export const HANGAR_ROCKET: V3 = [3, 0.75, -10];
export const HOPPER: V3 = [-2.0, 2.9, -6.5];
export const PALLET: V3 = [-5.2, 0.26, -3.8];
export const DESK: V3 = [8, 1.07, 4];
export const GARAGE_CAR: V3 = [1.5, 0, -1.4];
export const BANK: V3 = [-3.3, 0.95, -4.8];
export const PIZZA = { x: 0, z: -3.2, s0: 2.6 };
export const TOWER = { x: -5.6, z: -12, h206: 6.0, h1000: 29.0, blk: 1.85 };
export const BTOWER: V3 = [16, 0, -40];
export const TRACK = { x0: -8, finish: 22, podium: 31 };

// ---------------- shared beats ----------------
const PAD_REF = 0;
void PAD_REF;
/** the three failing rockets of line 5 (ignition / failure times) and the successful fourth of line 8 */
const t5 = () => {
  const i0 = wtf(5, "launched", 0.2), i1 = wtf(5, "so", 0.4, 0), i2 = wtf(5, "so", 0.5, 1);
  return { i: [i0, i1, i2], f0: Math.max(i0 + 1.15, wtf(5, "failed", 0.4)) };
};
export const rocketIgn = (k: number) => t5().i[k];
export const rocketBoom = () => t5().f0;
export type RS = { y: number; tilt: number; flame: number; vis: boolean; phase: "idle" | "burn" | "dead" | "fizz" | "stall" | "fall" };
export const rocketState = (k: number, t: number): RS => {
  const T = t5(), tau = t - T.i[k];
  if (tau < 0) return { y: 0, tilt: 0, flame: 0, vis: true, phase: "idle" };
  if (k === 0) {
    if (t >= T.f0) return { y: 0, tilt: 0, flame: 0, vis: false, phase: "dead" };
    return { y: 9 * tau * tau, tilt: 0.95 * smooth((tau - 0.35) / 0.8), flame: 1.5 + 1.2 * smooth(tau), vis: true, phase: "burn" };
  }
  if (k === 1) {
    const sp = Math.max(0, Math.sin(tau * 15) * Math.sin(tau * 6.3) + 0.35) * (1 - smooth(tau / 1.9));
    return { y: 2.4 * Math.sin(Math.PI * clamp01(tau / 2.1)) * (1 - 0.1 * Math.sin(tau * 17)), tilt: 0.05 * Math.sin(tau * 9) + 0.1 * smooth((tau - 1.2) / 1.0), flame: 1.8 * sp, vis: true, phase: "fizz" };
  }
  const rise = 6 * smooth(tau / 1.0), fall = tau > 1.5 ? 9 * (tau - 1.5) ** 2 : 0;
  const y = Math.max(0, rise - fall), flame = tau < 1.25 ? 2.0 * (1 - 0.3 * smooth(tau - 0.6)) : 0;
  return { y, tilt: tau > 1.35 ? 1.25 * smooth((tau - 1.35) / 0.9) : 0.02 * Math.sin(tau * 11), flame, vis: true, phase: tau > 1.5 ? "fall" : "stall" };
};
export const r4Ign = () => lineStart(8) + 0.15;
export const r4Alt = (t: number) => { const tau = Math.max(0, t - r4Ign()); return 17 * tau ** 2.15; };
/** height of the rising gold tower of line 12 (metres): 206 mark, hold, then past the 1000 mark */
export const towerH = (t: number) => {
  const tA = wtf(12, "billion", 0.3) + 0.25, tS = lineStart(12) + 0.1, tB = Math.max(tA + 0.5, wtf(12, "passed", 0.55)), tC = Math.max(tB + 0.9, wtf(12, "trillion", 0.8) + 0.1);
  if (t < tS) return 0;
  if (t < tB) return TOWER.h206 * easeOut((t - tS) / Math.max(0.5, tA - tS)) + 0.15 * Math.sin(t * 3);
  return TOWER.h206 + (TOWER.h1000 + 3.5 - TOWER.h206) * smooth((t - tB) / (tC - tB + 0.8));
};
export const hitTimes12 = () => ({ t206: wtf(12, "billion", 0.3) + 0.1, t1000: Math.max(wtf(12, "passed", 0.55) + 0.9, wtf(12, "trillion", 0.8)) });
/** the two sprinters of line 13: x position along the track */
export const runX = (who: "musk" | "bezos", t: number) => {
  const A = lineStart(13), P = wtf(13, "passed", 0.35), k = (t - A);
  const d = -2.4 + 4.0 * smooth(k / Math.max(1.2, P - A + 0.8));
  return TRACK.x0 + 6.4 * k + (who === "musk" ? d : 0);
};

// ---------------- camera helpers ----------------
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const lin = (u: number) => u;
const mv = (p0: V3, p1: V3, l0: V3, l1: V3, fov0 = 46, fov1 = fov0, roll0 = 0, roll1 = roll0, ease: (u: number) => number = glide) => (c: CamCtx): CamShot => {
  const k = ease(c.u);
  return { pos: lerp3(p0, p1, k), look: lerp3(l0, l1, k), fov: fov0 + (fov1 - fov0) * k, roll: roll0 + (roll1 - roll0) * k };
};
const orb = (ctr: V3, r0: number, r1: number, h0: number, h1: number, a0: number, a1: number, look: V3 | ((c: CamCtx) => V3), fov0 = 46, fov1 = fov0, roll = 0, ease: (u: number) => number = lin) => (c: CamCtx): CamShot => {
  const k = ease(c.u), a = a0 + (a1 - a0) * k, r = r0 + (r1 - r0) * k;
  return { pos: [ctr[0] + Math.sin(a) * r, h0 + (h1 - h0) * k, ctr[2] + Math.cos(a) * r], look: typeof look === "function" ? look(c) : look, fov: fov0 + (fov1 - fov0) * k, roll };
};
const rotYaw = (p: V3, l: V3, ang: number): V3 => { const x = l[0] - p[0], z = l[2] - p[2], c = Math.cos(ang), s = Math.sin(ang); return [p[0] + x * c - z * s, l[1], p[2] + x * s + z * c]; };
/** whip pan at the end of a shot */
const whipOut = (fn: (c: CamCtx) => CamShot, dir: number, from = 0.78) => (c: CamCtx): CamShot => {
  const s = fn(c), k = smooth((c.u - from) / (1 - from)) ** 1.6;
  return { ...s, look: k > 0 ? rotYaw(s.pos, s.look, dir * 1.55 * k) : s.look, roll: (s.roll ?? 0) + dir * 0.16 * k };
};
/** whip pan at the start of a shot (arrives from the side) */
const whipIn = (fn: (c: CamCtx) => CamShot, dir: number, to = 0.22) => (c: CamCtx): CamShot => {
  const s = fn(c), k = (1 - smooth(c.u / to)) ** 1.6;
  return { ...s, look: k > 0.001 ? rotYaw(s.pos, s.look, dir * 1.55 * k) : s.look, roll: (s.roll ?? 0) + dir * 0.16 * k };
};
const topOf = (x: number, z: number, fy: (t: number) => number, dy = 0): ((c: CamCtx) => V3) => (c) => [x, fy(c.f / FPS) + dy, z];

// the first / second sub-shot boundaries of each line, from word beats
const SUMMIT: V3 = [0, BIG.s * 1.06 + 8, BIG.z];
const SPEC: Spec[] = [
  // 1 hook: mountain of gold with tiny Musk on top, then the pile turns into translucent company slices
  { line: 1, t0: 0, set: "mountain", light: "golden", sunAz: 160, sunEl: 12, cam: mv([0, 4, 175], [6, 46, 118], [0, 70, BIG.z], [0, 128, BIG.z], 64, 56, 0, 0.03) },
  { line: 1, t0: wtf(1, "and", 0.5), set: "mountain", light: "golden", sunAz: 150, sunEl: 14, cam: orb(SUMMIT, 38, 26, 156, 160, 0.2, 1.5, SUMMIT, 50, 42) },
  { line: 1, t0: wtf(1, "pieces", 0.8), set: "mountain", light: "golden", sunAz: 150, sunEl: 14, cam: mv([-6, 3, 72], [4, 9, 52], [0, 22, -80], [0, 30, -80], 62, 54, -0.06, 0.04) },
  // 2 1999 office: buyer, briefcase, 307 bars -> 22
  { line: 2, t0: lineStart(2), set: "office", light: "day", cam: mv([-6.2, 1.4, 6.4], [-2.2, 1.55, 1.8], [-1.0, 1.4, -3.5], [-2.8, 1.5, -3.5], 56, 52) },
  { line: 2, t0: wtf(2, "sold", 0.4), set: "office", light: "day", cam: mv([0.6, 0.6, 3.4], [0.2, 0.9, 1.9], [0.2, 1.7, -3.2], [0.2, 1.9, -3.4], 56, 52, 0.03, -0.02) },
  { line: 2, t0: wtf(2, "share", 0.8) - 0.1, set: "office", light: "day", cam: mv([1.6, 1.3, 2.9], [-0.2, 1.45, 0.9], [-0.4, 1.6, -2.6], [-0.4, 1.6, -2.4], 52, 44), cInf: 5, focus: () => [-0.5, 1.6, -2.4] },
  // 3 payments start-up bubble, the auction giant gobbles it, Musk gets the bag
  { line: 3, t0: lineStart(3), set: "office", light: "day", cam: orb([0.4, 0, -2.6], 5.0, 4.0, 1.5, 1.8, -0.9, 0.5, [0.3, 1.7, -2.6], 52, 48) },
  { line: 3, t0: wtf(3, "and", 0.5), set: "office", light: "day", cam: whipIn(mv([-2.4, 0.5, 3.4], [-0.6, 1.0, 2.4], [3.0, 3.6, -5.0], [2.6, 3.5, -5.0], 66, 60, 0.06, -0.04), -1) },
  { line: 3, t0: wtf(3, "musk", 0.8), set: "office", light: "day", cam: mv([-0.3, 1.6, 2.2], [-0.45, 1.45, 1.1], [-0.4, 1.55, -2.5], [-0.4, 1.5, -2.5], 46, 38) },
  // 4 beach / yank / hangar
  { line: 4, t0: lineStart(4), set: "beach", light: "golden", sunAz: 170, sunEl: 10, cam: mv([2.4, 0.55, 4.6], [0.9, 0.95, 2.9], [0.0, 1.05, 0], [0.0, 1.1, 0], 50, 44) },
  { line: 4, t0: wtf(4, "unluckily", 0.2), set: "beach", light: "golden", sunAz: 170, sunEl: 10, cam: (c) => { const k = smooth(c.u); return { pos: [0.4 + 7 * k, 1.2, 5.0], look: [0 + 9 * k, 1.1, 0], fov: 52, roll: 0.05 * k }; } },
  { line: 4, t0: wtf(4, "spent", 0), set: "hangar", light: "day", cam: orb([-1.5, 0, -6], 8.5, 7.0, 2.0, 3.0, -0.6, 0.55, [-1.2, 2.6, -6.2], 58, 54) },
  // 5 three rockets fail (rapid cuts)
  { line: 5, t0: lineStart(5), set: "pad", light: "day", cam: mv([-10, 1.4, -1.5], [-11, 2.0, -3.5], [-13, 6, -30], [-13, 12, -30], 56, 50, 0.02, -0.04, lin) },
  { line: 5, t0: wtf(5, "so", 0.4, 0), set: "pad", light: "day", cam: mv([4, 1.2, -7], [2, 1.6, -9], [0, 5, -30], [0, 6, -30], 52, 46, -0.07, 0.05, lin) },
  { line: 5, t0: wtf(5, "so", 0.4, 1), set: "pad", light: "day", cam: mv([18, 1.6, -3], [15.5, 2.0, -6], [14, 4, -30], [14, 8, -30], 52, 48, 0.05, -0.05, lin) },
  // 6 garage: piggy bank, little electric car
  { line: 6, t0: lineStart(6), set: "garage", light: "day", cam: mv([-2.6, 1.5, 2.4], [-3.4, 1.45, 0.3], [-4.4, 1.3, -4.5], [-4.2, 1.45, -4.6], 48, 42) },
  { line: 6, t0: wtf(6, "into", 0.5), set: "garage", light: "day", cam: orb(GARAGE_CAR, 4.6, 3.5, 0.55, 0.9, -0.5, 0.5, [GARAGE_CAR[0], 0.55, GARAGE_CAR[2]], 50, 46) },
  // 7 2008: almost empty stacks + candle, then both companies on the cliff edge
  { line: 7, t0: lineStart(7), set: "cliff", light: "golden", sunAz: 165, sunEl: 8, cam: mv([0.2, 3.6, 14.5], [0.2, 3.9, 13.2], [0, 4.0, 5.5], [0, 4.3, 5.0], 50, 44, -0.05, 0.04) },
  { line: 7, t0: wtf(7, "close", 0.5), set: "cliff", light: "golden", sunAz: 165, sunEl: 8, cam: mv([-0.8, 2.4, 9.5], [-0.4, 2.2, 7.5], [0, 1.2, -4.5], [0, 1.6, -4.5], 60, 56, 0.05, -0.03) },
  // 8 fourth rocket POV, NASA contract
  { line: 8, t0: lineStart(8), set: "pad", light: "day", cam: (c) => { const t = c.f / FPS, y = r4Alt(t); return { pos: [3.2, y + 7, -26], look: [-2, Math.max(0, y - 38), -26], fov: 68, roll: 0.07 }; } },
  { line: 8, t0: wtf(8, "and", 0.5), set: "pad", light: "day", cam: orb([8.5, 0, 3.4], 7.0, 6.2, 1.5, 2.2, -0.2, 0.9, [8.8, 2.8, 3.6], 56, 50) },
  // 9 puzzled, question marks
  { line: 9, t0: lineStart(9), set: "studio", light: "day", cam: mv([0.5, 1.8, 1.7], [0.15, 1.75, 1.15], [0, 1.72, 0], [0, 1.74, 0], 38, 34, 0.14, 0.09), cInf: 7, focus: () => [0, 1.72, 0] },
  { line: 9, t0: wtf(9, "make", 0.4), set: "studio", light: "day", cam: mv([0.3, 1.0, 3.2], [3.0, 2.6, 7.4], [0, 1.6, 0], [0, 1.9, 0], 52, 56, -0.08, 0.1) },
  // 10 night pizzeria
  { line: 10, t0: lineStart(10), set: "pizzeria", light: "night", cam: mv([-4.5, 1.2, 7.2], [-1.4, 1.5, 4.6], [1.0, 2.0, -3], [1.6, 2.3, -3], 54, 50, 0.04, -0.03) },
  { line: 10, t0: wtf(10, "like", 0.15), set: "pizzeria", light: "night", cam: orb([PIZZA.x + 0.3, 0, PIZZA.z], 7.2, 5.6, 1.4, 2.3, 1.0, -0.6, [0.4, 2.2, PIZZA.z], 52, 46) },
  { line: 10, t0: wtf(10, "if", 0.5), set: "pizzeria", light: "night", cam: mv([1.5, 0.5, 6.0], [0.6, 1.8, 3.8], [0.5, 3.0, -3], [0.5, 4.6, -3], 62, 58, 0.05, -0.06) },
  { line: 10, t0: wtf(10, "even", 0.4), set: "pizzeria", light: "night", cam: mv([0.2, 1.1, 3.4], [-3.5, 3.2, 10.5], [0.3, 2.4, -3], [0.2, 3.8, -3], 56, 62) },
  // 11 pie charts of Tesla and SpaceX
  { line: 11, t0: lineStart(11), set: "studio", light: "day", cam: orb([0, 0, -1.2], 7.4, 6.2, 4.8, 5.4, -0.3, 0.3, [0, 0.7, -1.4], 56, 52) },
  { line: 11, t0: wtf(11, "so", 0.55, 0), set: "studio", light: "day", cam: mv([0.2, 3.4, 6.8], [0, 4.2, 5.0], [0, 1.0, -1.5], [0, 1.4, -1.5], 58, 54, -0.05, 0.05) },
  // 12 rising gold tower with measuring pole
  { line: 12, t0: lineStart(12), set: "city", light: "golden", sunAz: 150, sunEl: 14, cam: (c) => { const t = c.f / FPS, h = towerH(t), k = glide(c.u); return { pos: [-1.2 + 1.5 * k, 1.6 + 2.0 * k, 7.0 - 1.5 * k], look: [TOWER.x - 1.2, 0.7 * h + 1.0, TOWER.z], fov: 58, roll: 0.03 }; } },
  { line: 12, t0: wtf(12, "and", 0.5), set: "city", light: "golden", sunAz: 150, sunEl: 14, cam: (c) => { const t = c.f / FPS, h = towerH(t), k = glide(c.u); return { pos: [-2.4 + 1.0 * k, 3.5 + 0.55 * h, 2.5 + 1.6 * k], look: [TOWER.x - 1.0, 0.92 * h + 1.5, TOWER.z], fov: 64 + 8 * k, roll: -0.06 * k }; } },
  // 13 race: Musk overtakes Bezos, podium flips
  { line: 13, t0: lineStart(13), set: "track", light: "day", cam: (c) => { const t = c.f / FPS, xm = (runX("musk", t) + runX("bezos", t)) / 2; return { pos: [xm + 2.5, 0.85, 9.2], look: [xm + 1.2, 1.3, 1.5], fov: 54 }; } },
  { line: 13, t0: wtf(13, "passed", 0.35) - 0.35, set: "track", light: "day", cam: (c) => { const t = c.f / FPS, xm = (runX("musk", t) + runX("bezos", t)) / 2; return { pos: [xm + 7.5 - 1.5 * c.u, 0.7, 2.6], look: [xm, 1.4, 2.1], fov: 58, roll: 0.05 }; } },
  { line: 13, t0: wtf(13, "become", 0.5), set: "track", light: "day", cam: orb([TRACK.podium, 0, 1], 8.0, 6.2, 1.4, 2.6, 0.5, -0.5, [TRACK.podium, 1.9, 1], 56, 52) },
  // 14 bought the bubble tower with a truck of gold
  { line: 14, t0: lineStart(14), set: "city", light: "day", cam: mv([6, 1.2, -6], [10.5, 3.0, -10], [BTOWER[0], 28, BTOWER[2]], [BTOWER[0], 40, BTOWER[2]], 66, 62, 0.04, -0.03) },
  { line: 14, t0: wtf(14, "bought", 0.55), set: "city", light: "day", cam: (c) => { const k = glide(c.u); return { pos: [-15 + 8 * k, 6 + 5 * k, -2 - 10 * k], look: [-6 + 8 * k, 1.2, 3 - 24 * k], fov: 56, roll: -0.05 }; } },
  { line: 14, t0: wtf(14, "which", 0.55), set: "city", light: "day", cam: mv([-9, 2.5, 6], [3, 30, 20], [BTOWER[0] - 2, 8, BTOWER[2] + 14], [BTOWER[0], 28, BTOWER[2]], 58, 62) },
  // 15-17 gold hill with winners' podium, crown; Page; envelope
  { line: 15, t0: lineStart(15), set: "mountain", light: "golden", sunAz: 150, sunEl: 12, cam: mv([0, 1.6, 12.5], [1.5, 4, 10.5], [0, 15, HILL[2]], [0, 19, HILL[2]], 68, 60, 0.04, -0.03) },
  { line: 15, t0: wtf(15, "net", 0.5), set: "mountain", light: "golden", sunAz: 150, sunEl: 12, cam: orb([0, 0, HILL[2]], 24, 20, 12, 15, 0.2, 1.4, [0, 15.5, HILL[2]], 58, 52) },
  { line: 16, t0: lineStart(16), set: "mountain", light: "golden", sunAz: 150, sunEl: 12, cam: whipIn(mv([6, 3, 14], [16, 4.5, 12], [14, 5, -8], [PAGE_X - 1, 6, -8], 60, 54), -1, 0.18) },
  { line: 16, t0: wtf(16, "that's", 0.6), set: "mountain", light: "golden", sunAz: 150, sunEl: 12, cam: mv([0, 5, 33], [0, 12, 44], [0, 8, -8], [0, 9, -8], 64, 70) },
  { line: 17, t0: lineStart(17), set: "mountain", light: "golden", sunAz: 150, sunEl: 12, cam: orb([0.8, 0, 9.5], 6.2, 4.4, 1.3, 1.6, 1.0, -0.5, [0.8, 2.3, 9.5], 52, 46) },
  { line: 17, t0: wtf(17, "with", 0.7), set: "mountain", light: "golden", sunAz: 150, sunEl: 12, cam: mv([0.6, 0.55, 13.6], [0.3, 0.7, 12.8], [0.1, 0.9, 10.5], [0.4, 1.0, 10.0], 52, 44), cInf: 5, focus: () => [-0.4, 0.3, 11.2] },
  // 18 finale: Musk on top of the rocket, wrecks smoking in front
  { line: 18, t0: lineStart(18), set: "pad", light: "golden", sunAz: 160, sunEl: 12, cam: mv([-9, 1.0, 11], [-3, 2.0, 3], [0, 9, -30], [0, 12, -34], 62, 58, 0.05, -0.02) },
  { line: 18, t0: wtf(18, "betting", 0.4), set: "pad", light: "golden", sunAz: 160, sunEl: 12, cam: orb([0, 0, -34], 20, 15, 8, 14, 0.9, -0.4, [0, 13.5, -34], 52, 46) },
  { line: 18, t0: wtf(18, "surviving", 0.5), set: "pad", light: "golden", sunAz: 160, sunEl: 12, cam: mv([5, 2.4, 17], [1, 3.4, 13.5], [0, 8.5, -26], [0, 9.5, -30], 56, 50) },
];
const starts = SPEC.map((s, i) => (i === 0 ? 0 : Math.max(F(s.t0), 1)));
for (let i = 1; i < starts.length; i++) starts[i] = Math.max(starts[i], starts[i - 1] + 8); // a shot is never shorter than 8 frames
export const SHOTS: ShotDef[] = SPEC.map((s, i) => {
  const sub = SPEC.slice(0, i).filter((x) => x.line === s.line).length;
  return { id: i + 1, line: s.line, sub, a: starts[i], b: i + 1 < SPEC.length ? starts[i + 1] : TOTAL, set: s.set, light: s.light, sunAz: s.sunAz, sunEl: s.sunEl, cam: s.cam, cInf: s.cInf, focus: s.focus };
});
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** hard cuts; one layer per frame */
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];
export const camAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1], len = Math.max(1, s.b - s.a), c: CamCtx = { f, a: s.a, b: s.b, t: (f - s.a) / FPS, u: clamp01((f - s.a) / len) };
  const r = s.cam(c);
  return { pos: r.pos, look: r.look, fov: r.fov ?? 46, roll: r.roll ?? 0 };
};
export const dofAt = (f: number) => {
  const s = shotAt(f), c: CamCtx = { f, a: s.a, b: s.b, t: (f - s.a) / FPS, u: clamp01((f - s.a) / Math.max(1, s.b - s.a)) };
  return { cInf: s.cInf ?? 0, focus: s.focus ? () => s.focus!(c) : undefined };
};
export { topOf };
