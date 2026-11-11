// Timeline of "The Trojan Horse": 17 voice lines cut into ~40 shots (every 1-3 s), timed to
// public/troy/words.json ({word, start, end, line}). Re-timing = replace words.json (+ voice.wav): VOICE_SEC / TOTAL follow the
// last word of that file; shot edges come from lineStart(n) and word beats wt(line, word[, nth]) / wtf(line, word, frac) /
// lf(line, u), which fall back to a fraction of the line when the recogniser spelled a word differently ("307" ->
// "three hundred seven"). No seconds are hard-coded anywhere. Cameras are analytic functions of the shot progress.
import WORDS from "../../../public/troy/words.json";

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
const NLINES = 17;
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
export type SetId = "camp" | "troy" | "dig";
export const INSIDE: SetId[] = [];
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
export type CamCtx = { f: number; a: number; b: number; t: number; u: number };
type CamShot = Partial<Cam> & { pos: V3; look: V3 };
export type ShotDef = { id: number; line: number; sub: number; a: number; b: number; set: SetId; light: Light; sunAz?: number; sunEl?: number; cam: (c: CamCtx) => CamShot; cInf?: number; focus?: (c: CamCtx) => V3 };
type Spec = { line: number; t0: number; set: SetId; light: Light; cam: (c: CamCtx) => CamShot; sunAz?: number; sunEl?: number; cInf?: number; focus?: (c: CamCtx) => V3 };

// ---------------- places (world coordinates) ----------------
export const GATE_Z = -22;
export const HORSE_S = 1.25;
export const PLAZA_Z = -44;
export const smoothstep = smooth;
// horse z-position (heading -z): outside at -6, dragged through the gate on line 6, parked in the plaza afterwards
export const HORSE_OUT = -6;
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

/** earthquake shake */
const shake = (fn: (c: CamCtx) => CamShot, amp = 0.07) => (c: CamCtx): CamShot => { const s = fn(c), k = amp * Math.min(1, c.t * 4); return { ...s, pos: [s.pos[0] + k * Math.sin(c.f * 1.9), s.pos[1] + k * Math.sin(c.f * 2.7 + 1), s.pos[2]], roll: (s.roll ?? 0) + 0.02 * Math.sin(c.f * 2.3) }; };
const SPEC: Spec[] = [
  // 1 hook: the horse is hauled through the gate
  { line: 1, t0: 0, set: "troy", light: "golden", sunAz: 150, sunEl: 12, cam: mv([3.5, 1.0, -31], [2.0, 1.5, -28], [0, 4.3, -17], [0, 4.7, -17], 54, 48, 0.05, -0.02) },
  { line: 1, t0: wt(1, "pulling"), set: "troy", light: "golden", sunAz: 150, sunEl: 12, cam: mv([17, 2.8, 8], [9, 3.4, -2], [0, 4, -18], [0, 4.2, -19], 52, 46, -0.04, 0.02) },
  { line: 1, t0: wt(1, "gates"), set: "troy", light: "golden", sunAz: 150, sunEl: 12, cam: mv([0.5, 1.0, 1.0], [0.2, 2.8, -7], [0, 3.6, -18], [0, 3.8, -22], 44, 52, 0.0, 0.05) },
  // 2 ten years of failed sieges
  { line: 2, t0: lineStart(2), set: "camp", light: "day", sunAz: 120, sunEl: 40, cam: mv([-9, 3.4, 19], [-3, 3.0, 12.5], [0, 1.7, 2], [1, 1.7, 0], 54, 50, 0.03, 0) },
  { line: 2, t0: wt(2, "break"), set: "troy", light: "day", sunAz: 130, sunEl: 40, cam: mv([-6, 3.0, 14], [-2, 3.6, 8], [0, 6, -22], [0, 6.5, -22], 56, 50, -0.03, 0.02) },
  // 3 the empty camp, the horse outside
  { line: 3, t0: lineStart(3), set: "camp", light: "golden", sunAz: 160, sunEl: 9, cam: mv([4, 2.2, 36], [0, 2.6, 25], [0, 2.2, 0], [0, 2.2, -3], 54, 50, -0.03, 0.02) },
  { line: 3, t0: wt(3, "giant"), set: "troy", light: "golden", sunAz: 155, sunEl: 10, cam: mv([8, 0.8, 8], [4, 1.0, 5], [0, 3.2, -6], [0, 5.4, -6], 54, 56, 0.05, 0) },
  // 4 Sinon, a gift for Athena
  { line: 4, t0: lineStart(4), set: "troy", light: "golden", sunAz: 150, sunEl: 12, cam: mv([-1.2, 1.6, 1.6], [-0.4, 1.7, 0.5], [-0.6, 1.5, -3.0], [-0.4, 1.6, -3.0], 40, 38, 0.04, -0.02) },
  { line: 4, t0: wt(4, "gift"), set: "troy", light: "golden", sunAz: 150, sunEl: 12, cam: mv([5.5, 1.2, 4.2], [3.5, 2.2, 2.0], [0, 3.6, -6], [0, 4.2, -6], 52, 46, -0.05, 0.02) },
  // 5 Laocoon warns
  { line: 5, t0: lineStart(5), set: "troy", light: "golden", sunAz: 150, sunEl: 12, cam: mv([1.5, 1.5, 3.8], [0.8, 1.7, 2.8], [-0.2, 1.6, -1.0], [-0.2, 1.6, -1.0], 38, 34, 0.04, -0.02) },
  { line: 5, t0: wt(5, "dont"), set: "troy", light: "golden", sunAz: 150, sunEl: 12, cam: mv([-6, 1.2, 4.0], [-3.5, 1.6, 2.5], [0, 2.4, -5], [0, 3.2, -6], 54, 48, -0.03, 0.03) },
  // 6 nobody listens, the Trojans drag the horse inside
  { line: 6, t0: lineStart(6), set: "troy", light: "golden", sunAz: 150, sunEl: 12, cam: mv([-1.5, 1.6, 4.2], [0.5, 1.8, 3.2], [1.5, 1.7, -1.5], [0, 1.7, -2.5], 50, 46, 0.03, -0.02) },
  { line: 6, t0: wt(6, "drag"), set: "troy", light: "golden", sunAz: 150, sunEl: 12, cam: mv([11, 2.4, -4], [10, 3.0, -12], [0, 3.2, -9], [0, 3.8, -17], 54, 50, -0.04, 0.02) },
  { line: 6, t0: wt(6, "inside"), set: "troy", light: "golden", sunAz: 150, sunEl: 12, cam: mv([-6, 2.0, -30], [-3, 2.4, -28], [0, 3.8, -22], [0, 3.8, -24], 56, 50, 0.04, 0) },
  // 7 night: soldiers climb out and open the gates
  { line: 7, t0: lineStart(7), set: "troy", light: "night", sunAz: 150, sunEl: 40, cam: mv([8, 1.3, -34], [5, 1.6, -38], [0, 3, PLAZA_Z], [0, 3.4, PLAZA_Z], 56, 50, 0.04, -0.02) },
  { line: 7, t0: wt(7, "hidden"), set: "troy", light: "night", sunAz: 150, sunEl: 40, cam: mv([-4.2, 1.0, -39.5], [-3.5, 1.2, -41.0], [0, 1.8, PLAZA_Z - 0.4], [0, 1.9, PLAZA_Z - 0.4], 50, 44, -0.05, 0.02) },
  { line: 7, t0: wt(7, "climb"), set: "troy", light: "night", sunAz: 150, sunEl: 40, cam: mv([4.5, 1.4, -48.5], [3.2, 1.8, -47.0], [0, 1.2, PLAZA_Z - 0.2], [0, 1.0, PLAZA_Z - 0.2], 48, 44, 0.04, -0.03) },
  { line: 7, t0: wt(7, "open"), set: "troy", light: "night", sunAz: 150, sunEl: 40, cam: mv([-9.5, 1.8, -36], [-7, 2.0, -34], [0, 2.8, -24], [0, 3.0, -21], 56, 52, -0.04, 0.02) },
  // 8 by morning, Troy burns
  { line: 8, t0: lineStart(8), set: "troy", light: "golden", sunAz: 170, sunEl: 6, cam: mv([-12, 21, 30], [-8, 24, 20], [0, 5, -46], [0, 8, -48], 56, 52, 0.03, -0.02) },
  { line: 8, t0: wt(8, "burning"), set: "troy", light: "golden", sunAz: 170, sunEl: 6, cam: mv([2, 2.2, -29], [1, 3.0, -32], [-16, 6, -46], [-17, 9, -48], 52, 58, -0.05, 0.03) },
  // 9 Homer tells the story at the Greek campfire; the soldiers see no horse in it
  { line: 9, t0: lineStart(9), set: "camp", light: "golden", sunAz: 160, sunEl: 8, cam: orb([2, 0, 4], 9, 7, 2.6, 1.8, 0.6, 1.3, [2, 1.3, 4], 54, 48) },
  { line: 9, t0: wt(9, "homers"), set: "camp", light: "golden", sunAz: 160, sunEl: 8, cam: mv([4.4, 1.4, 10.4], [3.4, 1.5, 9.0], [2, 1.5, 6.6], [2, 1.55, 6.6], 38, 33, 0.04, -0.02) },
  { line: 9, t0: wt(9, "never"), set: "camp", light: "golden", sunAz: 160, sunEl: 8, cam: mv([-1.5, 1.5, 6.5], [0, 1.7, 5.8], [2.2, 2.4, 3.0], [2.2, 2.8, 3.0], 52, 48, -0.04, 0.02) },
  // 10 Virgil on the temple steps, twelve hundred years of candle later
  { line: 10, t0: lineStart(10), set: "troy", light: "golden", sunAz: 170, sunEl: 8, cam: mv([-3, 1.8, -60.5], [-1.8, 1.9, -61.8], [0, 1.8, -66], [0, 1.9, -66], 44, 38, 0.04, -0.02) },
  { line: 10, t0: wt(10, "roman"), set: "troy", light: "golden", sunAz: 170, sunEl: 8, cam: mv([4, 1.9, -54.5], [2.6, 2.0, -56], [0, 2.4, -66], [0, 2.6, -66], 50, 46, -0.04, 0.02) },
  { line: 10, t0: wt(10, "twelve"), set: "troy", light: "night", sunAz: 150, sunEl: 40, cam: mv([2.4, 1.7, -61], [1.4, 1.8, -62], [-0.8, 1.8, -65.6], [-0.8, 1.8, -65.6], 38, 32, 0.0, 0.05) },
  { line: 10, t0: wt(10, "later"), set: "troy", light: "golden", sunAz: 175, sunEl: 5, cam: mv([-5, 1.8, -58.5], [-3, 2.6, -60], [0, 2.6, -66], [0, 3.4, -66], 50, 44, -0.05, 0.03) },
  // 11 Troy was real: Turkey, a busy dig, the burned layer, the flashback
  { line: 11, t0: lineStart(11), set: "dig", light: "day", sunAz: 130, sunEl: 48, cam: mv([-10, 5.5, 15], [-6, 4.0, 11], [0, 0, -6], [0, -0.5, -8], 56, 52, 0.03, 0) },
  { line: 11, t0: wt(11, "ruins"), set: "dig", light: "day", sunAz: 130, sunEl: 48, cam: mv([12, 2.4, 14], [8, 2.2, 10], [-2, 1, 4], [-2, 1, 4], 56, 50, -0.04, 0.02) },
  { line: 11, t0: wt(11, "diggers"), set: "dig", light: "day", sunAz: 130, sunEl: 48, cam: mv([2.5, 0.6, -2.2], [1.6, 0.2, -4.0], [-0.5, -1.2, -9.5], [-0.5, -1.2, -9.5], 46, 42, 0.04, -0.03) },
  { line: 11, t0: wt(11, "burned"), set: "dig", light: "golden", sunAz: 150, sunEl: 10, cam: mv([3.4, -0.9, -5.2], [2.6, -1.0, -6.2], [0, -1.0, -12.9], [0, -1.1, -12.9], 52, 46, -0.04, 0.02) },
  // 12 nobody has found a horse
  { line: 12, t0: lineStart(12), set: "dig", light: "day", sunAz: 130, sunEl: 48, cam: mv([4.5, 1.8, 4.5], [3, 2.0, 3], [0, 1.2, -4], [0, 0.6, -6], 54, 48, 0.03, -0.02) },
  { line: 12, t0: wt(12, "ever"), set: "dig", light: "day", sunAz: 130, sunEl: 48, cam: mv([-2.4, 1.5, 6.0], [-0.9, 1.6, 4.8], [0.4, 1.4, 1.0], [0.4, 1.6, 1.0], 40, 36, -0.03, 0.02) },
  // 13 where did the story come from
  { line: 13, t0: lineStart(13), set: "dig", light: "day", sunAz: 130, sunEl: 48, cam: orb([-0.4, 0, 2.5], 5.0, 3.8, 1.5, 2.0, -0.6, 0.3, [-0.4, 1.5, 2.5], 48, 42) },
  { line: 13, t0: wt(13, "story"), set: "dig", light: "day", sunAz: 130, sunEl: 48, cam: mv([-1.6, 1.3, 6.4], [-1.2, 1.5, 4.8], [-0.4, 2.0, 2.5], [-0.4, 2.6, 2.5], 36, 30, 0.04, -0.03) },
  // 14 siege machine, earthquake, Poseidon and his sea horses
  { line: 14, t0: lineStart(14), set: "troy", light: "day", sunAz: 130, sunEl: 40, cam: mv([-20, 3.4, 12], [-16, 3.8, 4], [-6, 4, 2], [-6, 4.6, -4], 56, 50, 0.03, -0.02) },
  { line: 14, t0: wt(14, "even"), set: "troy", light: "day", sunAz: 130, sunEl: 40, cam: shake(mv([10, 1.8, 8], [7, 2.4, 5], [-4, 6, -22], [-4, 7, -22], 56, 52, 0.0, 0.0)) },
  { line: 14, t0: wt(14, "since"), set: "camp", light: "golden", sunAz: 160, sunEl: 8, cam: mv([-4.0, 1.6, -31], [-3.2, 2.2, -32], [0, 3.2, -41], [0, 5.2, -41], 58, 54, 0.04, -0.02) },
  { line: 14, t0: wt(14, "horses"), set: "camp", light: "golden", sunAz: 160, sunEl: 8, cam: mv([-6, 1.3, -33], [5, 1.5, -33], [-12, 1.8, -39.5], [12, 1.8, -39.5], 52, 52, 0.04, -0.04) },
  { line: 14, t0: wt(14, "earthquakes"), set: "camp", light: "golden", sunAz: 160, sunEl: 8, cam: shake(mv([6, 1.4, -33.5], [3, 1.7, -35], [8, 2.2, -39.5], [8, 2.2, -39.5], 48, 44, -0.04, 0.03), 0.1) },
  // 15 maybe the walls fell and a story made it a trick
  { line: 15, t0: lineStart(15), set: "troy", light: "day", sunAz: 130, sunEl: 40, cam: shake(mv([-12, 3.0, 9], [-8, 4.2, 4], [-5, 5.5, -22], [-5, 4.5, -22], 56, 52, -0.04, 0.03), 0.09) },
  { line: 15, t0: wt(15, "story"), set: "troy", light: "golden", sunAz: 150, sunEl: 12, cam: mv([-3.0, 1.5, 2.4], [-1.8, 1.7, 1.6], [-0.4, 1.8, -1.0], [-0.4, 2.2, -1.0], 40, 36, 0.04, -0.02) },
  { line: 15, t0: wt(15, "trick"), set: "troy", light: "golden", sunAz: 150, sunEl: 12, cam: mv([2.5, 1.0, 0.6], [1.5, 1.6, -3.0], [0, 3.6, -14], [0, 3.8, -14], 44, 42, 0.04, -0.02) },
  // 16 the lesson: the Trojans celebrate around the horse
  { line: 16, t0: lineStart(16), set: "troy", light: "golden", sunAz: 160, sunEl: 7, cam: mv([-9, 1.8, 6], [-5, 2.0, 2.0], [0, 3.0, -8], [0, 3.4, -10], 54, 48, 0.04, -0.02) },
  { line: 16, t0: wt(16, "same"), set: "troy", light: "golden", sunAz: 160, sunEl: 7, cam: mv([0.4, 0.7, -2.0], [0.2, 1.3, -4.4], [0, 3.2, -8.0], [0, 3.6, -8.0], 50, 44, 0.0, 0.04) },
  // 17 the strongest walls mean nothing if you let the enemy in yourself
  { line: 17, t0: lineStart(17), set: "troy", light: "golden", sunAz: 160, sunEl: 7, cam: mv([-12, 1.0, 14], [-6, 1.4, 6], [-6, 7, -22], [-4, 8, -22], 58, 54, 0.05, -0.02) },
  { line: 17, t0: wt(17, "nothing"), set: "troy", light: "night", sunAz: 150, sunEl: 40, cam: mv([0, 2.0, -30], [0, 2.4, -34], [0, 3.2, -44], [0, 3.4, -44], 50, 46, 0.0, 0.0) },
  { line: 17, t0: wt(17, "enemy"), set: "troy", light: "night", sunAz: 150, sunEl: 40, cam: mv([4.5, 1.4, -48.5], [3.4, 1.8, -47.5], [0, 1.2, -44.2], [0, 1.0, -44.2], 48, 44, 0.04, -0.03) },
  { line: 17, t0: wt(17, "yourself"), set: "troy", light: "night", sunAz: 150, sunEl: 40, cam: mv([0, 2.6, -33], [0, 14, -14], [0, 3.4, -44], [0, 5, -50], 52, 60, 0.0, 0.0) },
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
