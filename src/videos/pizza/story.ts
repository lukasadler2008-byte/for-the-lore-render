// Timeline of "The 10,000 bitcoin pizza": 16 voice lines cut into ~38 shots (every 1-3 s), timed to
// public/pizza/words.json ({word, start, end, line}). Re-timing = replace words.json (+ voice.wav): VOICE_SEC / TOTAL follow the
// last word of that file; shot edges come from lineStart(n) and word beats wt(line, word[, nth]) / wtf(line, word, frac) /
// lf(line, u), which fall back to a fraction of the line when the recogniser spelled a word differently ("307" ->
// "three hundred seven"). No seconds are hard-coded anywhere. Cameras are analytic functions of the shot progress.
import WORDS from "../../../public/pizza/words.json";

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
export type SetId = "mountain" | "studio" | "street" | "room" | "jroom" | "shop" | "arcade";
export const INSIDE: SetId[] = ["studio", "room", "jroom", "shop", "arcade"];
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
export type CamCtx = { f: number; a: number; b: number; t: number; u: number };
type CamShot = Partial<Cam> & { pos: V3; look: V3 };
export type ShotDef = { id: number; line: number; sub: number; a: number; b: number; set: SetId; light: Light; sunAz?: number; sunEl?: number; cam: (c: CamCtx) => CamShot; cInf?: number; focus?: (c: CamCtx) => V3 };
type Spec = { line: number; t0: number; set: SetId; light: Light; cam: (c: CamCtx) => CamShot; sunAz?: number; sunEl?: number; cInf?: number; focus?: (c: CamCtx) => V3 };


// ---------------- places (world coordinates, shared by sets / cast / cameras) ----------------
export const BIG = { x: 0, z: -100, s: 140 };           // the gold mountain (hook + line 14)
export const SUMMIT_Y = 154;
export const DOOR = { L: [-1.95, 0.16, -5.0] as V3, D: [-0.85, 0.16, -4.35] as V3 }; // Laszlo at his door, the delivery guy on the porch
export const CAR: V3 = [5.5, 0, 8.2];
export const RL: V3 = [-0.25, 0, -3.35];                 // Laszlo beside his desk (room)
export const CRT: V3 = [-1.85, 1.05, -4.15];             // his monitor screen centre
export const DESKPILE: V3 = [-1.0, 0.76, -4.15];         // coin pile on the desk
export const RJ: V3 = [0.75, 0, -3.35];                  // Jeremy beside his desk (jroom)
export const CRTJ: V3 = [1.75, 1.05, -4.15];
export const SOFA: V3 = [3.35, 0.3, 2.6];                // Laszlo on the sofa (sits)
export const TABLE: V3 = [2.0, 0.46, 2.6];               // coffee table top
export const SCL = { x: 0, y: 0, z: -1.2, s: 1.6 };      // studio balance scale
export const PED: V3 = [0, 0, -2.2];                     // studio pedestal
export const CASHIER: V3 = [1.0, 0, -3.35];
export const CUST: V3 = [0.2, 0, -0.85];
export const CAB: V3 = [0, 0, -6.5];                     // arcade cabinet the token goes into (slot at z -6.0)
// beats
export const tScaleTip = () => wt(9, "bitcoin") - 0.1;
export const tipA = (t: number) => -0.42 * smooth((t - tScaleTip()) / 1.4);

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

const SUMMIT: V3 = [0, SUMMIT_Y + 2, BIG.z];
const RCAM = { pos: [0.7, 1.55, 0.6] as V3, look: [-1.0, 1.05, -3.9] as V3 };
const SPEC: Spec[] = [
  // 1 hook: pizza for coins at the door -> lid opens -> boxes on top of a mountain of gold, one continuous zoom-out
  { line: 1, t0: 0, set: "street", light: "day", sunAz: 140, sunEl: 30, cam: mv([-0.6, 1.55, -1.2], [-1.0, 1.5, -2.0], [-1.45, 1.25, -4.8], [-1.4, 1.2, -4.8], 46, 42, 0.03, -0.02) },
  { line: 1, t0: wt(1, "for"), set: "street", light: "day", sunAz: 140, sunEl: 30, cam: mv([-0.95, 2.15, -2.4], [-1.15, 2.05, -2.85], [-1.62, 0.95, -4.65], [-1.62, 0.95, -4.65], 46, 42, -0.04, 0.02) },
  { line: 1, t0: wt(1, "today"), set: "mountain", light: "golden", sunAz: 155, sunEl: 13, cam: mv([4.5, SUMMIT_Y + 1.0, -84], [12, 40, 150], [0, SUMMIT_Y + 3.5, BIG.z], [0, 100, BIG.z], 40, 66, -0.02, 0.03) },
  // 2 May 2010, Florida, Laszlo at home, hungry
  { line: 2, t0: lineStart(2), set: "street", light: "day", sunAz: 130, sunEl: 32, cam: mv([-9, 7.5, 16], [-5, 3.2, 11.5], [0, 2.5, -8], [0, 2.0, -8], 58, 52, 0.04, 0) },
  { line: 2, t0: wt(2, "programmer"), set: "room", light: "day", cam: mv([1.4, 1.75, 1.6], [0.7, 1.6, 0.4], [-0.9, 1.15, -3.9], [-0.9, 1.15, -3.9], 54, 50) },
  { line: 2, t0: wt(2, "and") , set: "room", light: "day", cam: mv([0.1, 1.6, -1.2], [-0.05, 1.6, -1.75], [-0.25, 1.55, -3.35], [-0.25, 1.55, -3.35], 40, 38, 0.05, 0.02) },
  // 3 coins out of the computer
  { line: 3, t0: lineStart(3), set: "room", light: "day", cam: orb([-1.0, 0, -3.9], 3.6, 3.2, 1.7, 1.5, 0.55, 0.1, [-1.0, 1.05, -4.0], 50, 48) },
  { line: 3, t0: wt(3, "computer"), set: "room", light: "day", cam: mv([-1.2, 1.35, -2.2], [-1.45, 1.2, -2.75], [-1.75, 1.0, -4.15], [-1.75, 1.0, -4.15], 46, 42, -0.05, 0) },
  // 4 the problem: nobody accepts it
  { line: 4, t0: lineStart(4), set: "room", light: "day", cam: mv([0.25, 1.55, -1.5], [0.05, 1.55, -1.9], [-0.25, 1.4, -3.35], [-0.25, 1.4, -3.35], 42, 40, -0.04, 0.02) },
  { line: 4, t0: wt(4, "nobody"), set: "shop", light: "day", cam: mv([2.8, 1.75, 3.8], [2.0, 1.6, 2.7], [0.6, 1.15, -2.2], [0.6, 1.15, -2.2], 52, 48) },
  // 5 he posts the offer
  { line: 5, t0: lineStart(5), set: "room", light: "night", cam: mv([0.2, 1.7, -1.6], [-0.4, 1.55, -2.4], [-1.85, 1.05, -4.2], [-1.85, 1.05, -4.2], 50, 44, 0.03, -0.02) },
  { line: 5, t0: wt(5, "ten"), set: "room", light: "night", cam: mv([-1.5, 2.05, -1.9], [-1.6, 2.0, -2.25], [-1.8, 1.45, -3.75], [-1.8, 1.5, -3.75], 52, 48) },
  // 6 four days, nobody bites
  { line: 6, t0: lineStart(6), set: "room", light: "day", cam: mv(RCAM.pos, [0.5, 1.5, 0.0], RCAM.look, RCAM.look, 50, 48) },
  { line: 6, t0: wt(6, "no"), set: "room", light: "night", cam: mv([0.6, 1.4, -0.6], [0.3, 1.35, -1.0], [-1.0, 1.0, -3.8], [-1.0, 1.0, -3.8], 48, 44, -0.03, 0) },
  // 7 Jeremy says yes, the pizzas arrive, he gets the coins
  { line: 7, t0: lineStart(7), set: "jroom", light: "night", cam: mv([-0.7, 1.55, 0.9], [-0.3, 1.5, 0.1], [1.4, 1.15, -3.8], [1.4, 1.15, -3.8], 54, 50) },
  { line: 7, t0: wt(7, "says"), set: "jroom", light: "night", cam: mv([0.5, 1.6, -1.6], [0.6, 1.6, -1.95], [0.75, 1.55, -3.35], [0.75, 1.55, -3.35], 40, 38, 0.04, -0.02) },
  { line: 7, t0: wt(7, "orders"), set: "street", light: "golden", sunAz: 150, sunEl: 10, cam: mv([3.5, 1.5, 3.5], [1.5, 1.5, 1.0], [-1.2, 1.2, -4.6], [-1.4, 1.2, -4.7], 56, 50) },
  { line: 7, t0: wt(7, "gets"), set: "jroom", light: "night", cam: orb([1.6, 0, -3.9], 3.2, 2.8, 1.6, 1.5, -0.5, -0.1, [1.5, 1.05, -4.0], 50, 48) },
  // 8 the fair trade on a balance scale
  { line: 8, t0: lineStart(8), set: "studio", light: "day", cam: mv([0, 2.6, 9.5], [0, 2.5, 8.2], [0, 2.4, -1.2], [0, 2.4, -1.2], 56, 54) },
  { line: 8, t0: wt(8, "worth"), set: "studio", light: "day", cam: mv([-1.4, 2.9, 2.2], [-1.9, 2.8, 1.6], [-2.56, 2.2, -1.2], [-2.56, 2.2, -1.2], 46, 42, 0.03, 0) },
  { line: 8, t0: wt(8, "for", 0), set: "studio", light: "day", cam: orb([0, 0, -1.2], 9.5, 8.5, 2.3, 2.6, 0.35, -0.3, [0, 2.0, -1.2], 54, 52) },
  // 9 bitcoin didn't stay cheap
  { line: 9, t0: lineStart(9), set: "studio", light: "day", cam: mv([1.5, 1.6, 8.0], [0.5, 1.2, 10.5], [-0.8, 2.6, -1.2], [-0.8, 2.8, -1.2], 54, 60, 0.0, -0.06) },
  { line: 9, t0: wt(9, "stay"), set: "studio", light: "day", cam: mv([-2.5, 1.6, 3.4], [-2.6, 1.6, 2.9], [-2.9, 1.55, 1.0], [-2.9, 1.55, 1.0], 40, 36, 0.05, -0.02) },
  // 10 it gets worse: more pizza deals for months
  { line: 10, t0: lineStart(10), set: "room", light: "golden", cam: mv([0.6, 1.55, 6.0], [0.9, 1.4, 5.2], [3.2, 1.0, 2.6], [3.2, 1.0, 2.6], 46, 42, -0.03, 0.02) },
  { line: 10, t0: wt(10, "laszlo"), set: "street", light: "night", cam: mv([-0.4, 1.6, -1.4], [-0.7, 1.55, -2.0], [-1.45, 1.25, -4.8], [-1.45, 1.2, -4.8], 48, 44) },
  { line: 10, t0: wt(10, "kept"), set: "room", light: "day", cam: mv([1.2, 1.2, -0.4], [1.0, 1.4, -0.9], [0.9, 1.0, -3.6], [0.9, 2.6, -3.6], 54, 58) },
  // 11 Jeremy spent his 10,000 coins
  { line: 11, t0: lineStart(11), set: "jroom", light: "day", cam: mv([0.2, 1.55, -1.2], [0.4, 1.55, -1.7], [0.75, 1.45, -3.35], [0.75, 1.45, -3.35], 44, 40, 0.05, -0.03) },
  { line: 11, t0: wt(11, "spent"), set: "shop", light: "day", cam: mv([-1.2, 1.6, 3.0], [-0.6, 1.5, 2.2], [0.6, 1.2, -2.2], [0.6, 1.2, -2.2], 52, 48) },
  { line: 11, t0: wt(11, "four"), set: "shop", light: "day", cam: mv([1.6, 1.85, -0.3], [1.3, 1.75, -0.7], [0.6, 1.1, -2.1], [0.6, 1.1, -2.1], 44, 40, -0.03, 0.02) },
  // 12 like arcade tokens; nobody believed it until someone used it
  { line: 12, t0: lineStart(12), set: "arcade", light: "night", cam: mv([2.2, 1.7, 5.4], [1.4, 1.55, 4.0], [-0.3, 1.3, -2.5], [-0.3, 1.3, -2.5], 56, 52) },
  { line: 12, t0: wt(12, "arcade"), set: "arcade", light: "night", cam: mv([-0.9, 1.45, -3.6], [-0.7, 1.4, -4.1], [0.2, 1.15, -6.05], [0.2, 1.15, -6.05], 48, 44, 0.04, 0) },
  { line: 12, t0: wt(12, "nobody"), set: "arcade", light: "night", cam: orb([0, 0, 0.2], 4.6, 4.2, 1.6, 1.5, -0.35, 0.25, [0, 1.35, 0.2], 50, 48) },
  { line: 12, t0: wt(12, "until"), set: "arcade", light: "night", cam: mv([0.4, 1.5, -3.2], [0.2, 1.45, -3.7], [0, 1.4, -6.2], [0, 1.45, -6.2], 50, 46) },
  // 13 the first real purchase, on a pedestal
  { line: 13, t0: lineStart(13), set: "studio", light: "day", cam: mv([0, 2.2, 6.5], [0, 1.9, 4.0], [0, 1.3, PED[2]], [0, 1.35, PED[2]], 52, 46) },
  { line: 13, t0: wt(13, "bitcoin"), set: "studio", light: "day", cam: orb([0, 0, PED[2]], 4.8, 4.2, 2.0, 1.7, -0.6, 0.4, [0, 1.3, PED[2]], 50, 48) },
  // 14 at the peak: a billion dollars
  { line: 14, t0: lineStart(14), set: "mountain", light: "golden", sunAz: 150, sunEl: 12, cam: mv([0, 25, 130], [0, 170, 45], [0, 60, BIG.z], [0, SUMMIT_Y, BIG.z], 58, 50, 0.04, 0) },
  { line: 14, t0: wt(14, "worth"), set: "mountain", light: "golden", sunAz: 150, sunEl: 12, cam: orb(SUMMIT, 34, 60, SUMMIT_Y + 10, SUMMIT_Y + 26, 0.3, 1.1, SUMMIT, 50, 58) },
  // 15 no regrets
  { line: 15, t0: lineStart(15), set: "room", light: "golden", cam: mv([1.4, 1.3, 4.6], [1.7, 1.25, 4.1], [3.35, 1.05, 2.6], [3.35, 1.05, 2.6], 44, 40, 0.03, -0.01) },
  // 16 the most expensive pizza, eaten in one evening
  { line: 16, t0: lineStart(16), set: "room", light: "night", cam: mv([0.1, 1.7, 4.8], [0.5, 1.5, 4.2], [2.3, 0.6, 2.5], [2.3, 0.65, 2.5], 48, 44, -0.03, 0) },
  { line: 16, t0: wt(16, "was"), set: "room", light: "night", cam: mv([1.6, 1.4, 4.4], [-1.5, 2.4, 5.6], [3.2, 0.8, 2.6], [2.4, 1.0, 1.0], 44, 62) },
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
