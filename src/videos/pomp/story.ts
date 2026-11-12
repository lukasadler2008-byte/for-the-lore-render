// Timeline of "Pompeii": 16 voice lines cut into ~40 shots (every 1-3 s), timed to
// public/pomp/words.json ({word, start, end, line}). Re-timing = replace words.json (+ voice.wav): VOICE_SEC / TOTAL follow the
// last word of that file; shot edges come from lineStart(n) and word beats wt(line, word[, nth]) / wtf(line, word, frac) /
// lf(line, u), which fall back to a fraction of the line when the recogniser spelled a word differently ("307" ->
// "three hundred seven"). No seconds are hard-coded anywhere. Cameras are analytic functions of the shot progress.
import WORDS from "../../../public/pomp/words.json";

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
const NLINES = 16;
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
export type SetId = "pomp" | "ash" | "dig";
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
const GOLD = { sunAz: 150, sunEl: 12 };
const DAY = { sunAz: 125, sunEl: 48 };
const NIGHT = { sunAz: 150, sunEl: 40 };
const SPEC: Spec[] = [
  // 1 hook: a calm market street, the mountain behind; the shrug on "stayed anyway"
  { line: 1, t0: 0, set: "pomp", light: "day", ...DAY, cam: mv([-2.5, 1.7, 24], [-1.5, 1.8, 19], [0, 22, -120], [0, 24, -120], 56, 52, 0.02, -0.01) },
  { line: 1, t0: wt(1, "stayed"), set: "pomp", light: "day", ...DAY, cam: mv([0.6, 1.7, 6.5], [0.2, 1.75, 4.2], [0, 2.0, 0], [0, 2.0, 0], 46, 34) },
  // 2 the 62 AD earthquake, then the bird's-eye city
  { line: 2, t0: lineStart(2), set: "pomp", light: "day", ...DAY, cam: shake(mv([-3, 1.6, 14], [-2, 1.6, 11], [2, 3, -6], [2, 3, -6], 58, 58), 0.14) },
  { line: 2, t0: wt(2, "city"), set: "pomp", light: "day", ...DAY, cam: mv([0, 40, 50], [0, 33, 38], [0, 0, -30], [0, 0, -34], 58, 54) },
  // 3 nobody knew: puzzled faces, then the tilt up to the mountain
  { line: 3, t0: lineStart(3), set: "pomp", light: "day", ...DAY, cam: mv([2, 1.5, 6], [1.4, 1.55, 5.4], [-0.5, 1.6, 0], [-0.5, 1.6, 0], 44, 42) },
  { line: 3, t0: wt(3, "mountain"), set: "pomp", light: "day", ...DAY, cam: mv([0, 1.6, 10], [0, 1.8, 8], [0, 3, -30], [0, 120, -420], 60, 56) },
  // 4 79 AD: calm mountain, then the blast (fast push-in)
  { line: 4, t0: lineStart(4), set: "pomp", light: "day", ...DAY, cam: mv([0, 1.4, 6], [0, 1.5, 4], [0, 100, -420], [0, 110, -420], 62, 60) },
  { line: 4, t0: wt(4, "exploded"), set: "pomp", light: "golden", ...GOLD, cam: mv([0, 3, 0], [0, 14, -70], [0, 195, -420], [0, 235, -420], 60, 40) },
  // 5 the column of ash
  { line: 5, t0: lineStart(5), set: "pomp", light: "golden", ...GOLD, cam: mv([0, 1.6, 8], [0, 1.7, 6], [0, 180, -420], [0, 380, -420], 66, 64) },
  { line: 5, t0: wt(5, "over"), set: "pomp", light: "golden", ...GOLD, cam: mv([30, 1.0, 30], [12, 2.0, 20], [0, 360, -420], [0, 640, -420], 72, 78) },
  // 6 pumice rain: people run (side tracking), others huddle at a door
  { line: 6, t0: lineStart(6), set: "pomp", light: "golden", ...GOLD, cam: mv([-9, 1.5, 0], [-9, 1.5, 16], [0, 1.7, -2], [0, 1.7, 14], 54, 54) },
  { line: 6, t0: wt(6, "others"), set: "pomp", light: "golden", ...GOLD, cam: mv([-1.5, 1.5, -1.6], [-0.8, 1.55, -2.4], [6.5, 1.3, -6], [6.5, 1.3, -6], 46, 44) },
  // 7 the deadly mistake: push-in on the closed door
  { line: 7, t0: lineStart(7), set: "pomp", light: "golden", ...GOLD, cam: mv([0.5, 1.5, 1.5], [4.6, 1.4, -4.2], [6, 1.3, -6], [6, 1.3, -6], 48, 30) },
  // 8 midnight: wide, flank, the rushing wave, the chase
  { line: 8, t0: lineStart(8), set: "pomp", light: "night", ...NIGHT, cam: mv([0, 1.2, 4], [0, 1.3, 3], [0, 120, -420], [0, 150, -420], 62, 60) },
  { line: 8, t0: wt(8, "wave"), set: "pomp", light: "night", ...NIGHT, cam: mv([330, 150, -250], [300, 160, -230], [0, 120, -300], [0, 60, -260], 60, 56) },
  { line: 8, t0: wt(8, "rushed"), set: "pomp", light: "night", ...NIGHT, cam: whipIn(mv([0, 1.8, -22], [0, 2.0, -24], [0, 70, -260], [0, 50, -240], 58, 52), 1) },
  { line: 8, t0: wt(8, "hundred"), set: "pomp", light: "night", ...NIGHT, cam: mv([0, 2.0, -22], [0, 2.2, 14], [0, 5, -80], [0, 6, -40], 62, 66) },
  // 9 it killed everyone: top-down as the wave sweeps over, then the silent street
  { line: 9, t0: lineStart(9), set: "pomp", light: "night", ...NIGHT, cam: mv([0, 46, 4], [0, 48, 0], [0, 0, -14], [0, 0, -18], 58, 58, 0, 0) },
  { line: 9, t0: wt(9, "touched"), set: "pomp", light: "night", ...NIGHT, cam: mv([0, 1.5, 12], [0, 1.5, 6], [0, 2, -20], [0, 2.5, -20], 52, 46) },
  // 10 buried under twenty feet of ash
  { line: 10, t0: lineStart(10), set: "ash", light: "day", sunAz: 110, sunEl: 40, cam: mv([-20, 3, 30], [-14, 26, 20], [0, 2, -30], [0, 0, -40], 58, 56) },
  { line: 10, t0: wt(10, "buried"), set: "ash", light: "day", sunAz: 110, sunEl: 40, cam: mv([4, 1.4, 12], [3, 1.5, 10], [0, 1.0, 0], [0, 1.2, -4], 50, 46) },
  // 11 forgotten for sixteen hundred years (time passes: day -> golden)
  { line: 11, t0: lineStart(11), set: "ash", light: "day", sunAz: 90, sunEl: 55, cam: mv([0, 6, 40], [0, 5, 26], [0, 3, -30], [0, 3, -30], 56, 50) },
  { line: 11, t0: wt(11, "sixteen"), set: "ash", light: "golden", sunAz: 165, sunEl: 8, cam: mv([30, 3, 10], [26, 3, 6], [0, 2, -20], [0, 2, -20], 50, 46) },
  // 12 diggers find it, the city is preserved
  { line: 12, t0: lineStart(12), set: "dig", light: "day", sunAz: 130, sunEl: 48, cam: mv([4.5, 1.8, 4.5], [3, 2.0, 3], [0, 1.2, -4], [0, 0.6, -6], 54, 48, 0.03, -0.02) },
  { line: 12, t0: wt(12, "city"), set: "pomp", light: "day", ...DAY, cam: whipIn(mv([0, 1.7, 20], [0, 1.9, 2], [0, 3, -60], [0, 4, -80], 58, 50), -1) },
  // 13 bread in the ovens, graffiti on the walls
  { line: 13, t0: lineStart(13), set: "pomp", light: "day", ...DAY, cam: mv([0.5, 1.5, -26], [-2.2, 1.0, -29.6], [-4.0, 0.75, -33], [-4.0, 0.75, -33], 44, 32) },
  { line: 13, t0: wt(13, "graffiti"), set: "pomp", light: "day", ...DAY, cam: whipIn(mv([-2, 1.6, -8], [-2, 1.6, -26], [-6.0, 1.6, -10], [-6.0, 1.6, -26], 50, 50), 1) },
  // 14 the plaster molds
  { line: 14, t0: lineStart(14), set: "ash", light: "day", sunAz: 120, sunEl: 40, cam: mv([0, 9, 6], [0, 13, 3], [0, 0, -2], [0, 0, -3], 50, 48) },
  { line: 14, t0: wt(14, "perfect"), set: "ash", light: "day", sunAz: 120, sunEl: 40, cam: mv([3.4, 1.7, 4.6], [1.9, 1.0, 2.8], [0, 0.2, -0.4], [0, 0.2, -0.4], 44, 34) },
  // 15 today: the quiet mountain, then the crowd that lives under it
  { line: 15, t0: lineStart(15), set: "pomp", light: "day", ...DAY, cam: mv([0, 1.6, 40], [0, 2.0, 34], [0, 110, -420], [0, 114, -420], 62, 58) },
  { line: 15, t0: wt(15, "nearly"), set: "pomp", light: "day", ...DAY, cam: mv([0, 30, 24], [0, 34, 16], [0, 0, -16], [0, 0, -20], 56, 52) },
  // 16 the lesson: one person, the mountain above, slow push-in
  { line: 16, t0: lineStart(16), set: "pomp", light: "golden", sunAz: 160, sunEl: 8, cam: mv([0.9, 1.4, 5.5], [0.7, 1.45, 4.8], [0.2, 4, -40], [0.2, 6, -40], 54, 50) },
  { line: 16, t0: wt(16, "choose"), set: "pomp", light: "golden", sunAz: 160, sunEl: 8, cam: mv([-3.5, 1.0, 6], [-1.2, 1.5, 3], [0, 1.6, 0], [0, 6, -30], 48, 34) },
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
