// Timeline of "The Microwave Accident": one shot per voice line (19 lines), timed to public/micro/words.json
// ({word, start, end, line}). Re-timing: replace words.json (and voice.wav); VOICE_SEC / TOTAL follow the last word of the
// file, shot edges come from lineStart(n), story beats from wt(line, word) / wtf(line, word, fraction) which fall back to
// a fraction of the line when the recogniser spelled the word differently ("2,600" -> "twenty six hundred"). No seconds
// are hard-coded anywhere in the film. Camera grammar as in the dance short: slow push-ins on holds, glides between
// framings, dutch tilts for drama.
import WORDS from "../../../public/micro/words.json";

export const FPS = 30;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

type Word = { word: string; start: number; end: number; line: number };
const WL = WORDS as Word[];
/** the voice track ends with the last spoken word of words.json */
export const VOICE_SEC = WL.reduce((m, w) => Math.max(m, w.end), 0) || 60;
export const TOTAL = Math.ceil(VOICE_SEC * FPS) + 3;
const NLINES = 19;
const inLine = (n: number) => WL.filter((w) => w.line === n);
export const lineStart = (n: number) => { const l = inLine(n); return l.length ? l[0].start : (VOICE_SEC * (n - 1)) / NLINES; };
export const lineEnd = (n: number) => { const l = inLine(n); return l.length ? l[l.length - 1].end : (VOICE_SEC * n) / NLINES; };
/** start of the nth occurrence of `word` in `line` (first word of the line when absent) */
export const wt = (line: number, word: string, nth = 0) => {
  const m = inLine(line).filter((w) => w.word.toLowerCase() === word);
  return m.length ? (m[nth] ?? m[0]).start : lineStart(line);
};
/** same, but a missing word falls back to `frac` of the way through the line */
export const wtf = (line: number, word: string, frac: number, nth = 0) => {
  const m = inLine(line).filter((w) => w.word.toLowerCase() === word);
  return m.length ? (m[nth] ?? m[0]).start : lineStart(line) + frac * (lineEnd(line) - lineStart(line));
};
/** a point `u` (0..1) through a line */
export const lf = (line: number, u: number) => lineStart(line) + u * (lineEnd(line) - lineStart(line));
export const F = (s: number) => Math.round(s * FPS);
export const LEAD_F = 2;
export const R = (s: number) => F(s) - LEAD_F;
export const RW = (line: number, word: string, nth = 0) => R(wt(line, word, nth));
export const RWF = (line: number, word: string, frac: number, nth = 0) => R(wtf(line, word, frac, nth));
export const RL = (line: number, u: number) => R(lf(line, u));

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type SetId = "lab" | "factory" | "plant" | "kitchen" | "suburb" | "showroom" | "yard";
export type Crowd = "walk" | "coin" | "gate" | "hand" | "line" | "cheer" | "goo" | "sad" | "pop" | "egg" | "ponder" | "molec" | "radar" | "stuck"
  | "family" | "podium" | "dusk" | "desk" | "melt";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetId; crowd: Crowd; sunAz?: number; sunEl?: number };
type ShotSpec = Omit<ShotDef, "id" | "a" | "b">;
const SPEC: ShotSpec[] = [
  { set: "yard", light: "golden", crowd: "walk", sunAz: 150, sunEl: 30 },       // 1 Spencer walks past the big radar dish, candy sags in his pocket
  { set: "lab", light: "golden", crowd: "coin", sunAz: 150, sunEl: 38 },        // 2 two coins in his palm, shrug
  { set: "plant", light: "day", crowd: "gate", sunAz: 70 },                     // 3 factory building, Spencer enters
  { set: "factory", light: "day", crowd: "hand", sunAz: 95, sunEl: 55 },        // 4 hand-made magnetrons, few on the shelf
  { set: "factory", light: "day", crowd: "line", sunAz: 95, sunEl: 55 },        // 5 conveyor speeds up, crate stacks grow
  { set: "factory", light: "day", crowd: "cheer", sunAz: 95, sunEl: 55 },       // 6 boss pats his shoulder, workers cheer
  { set: "lab", light: "golden", crowd: "goo", sunAz: 150, sunEl: 38 },         // 7 next to the running magnetron, chocolate goo
  { set: "lab", light: "golden", crowd: "sad", sunAz: 150, sunEl: 38 },         // 8 ruined snack, then the lightbulb
  { set: "lab", light: "golden", crowd: "pop", sunAz: 150, sunEl: 38 },         // 9 popcorn pops
  { set: "lab", light: "golden", crowd: "egg", sunAz: 150, sunEl: 38 },         // 10 egg bursts at the coworker
  { set: "lab", light: "golden", crowd: "ponder", sunAz: 150, sunEl: 38 },      // 11 puzzled close-up
  { set: "showroom", light: "night", crowd: "molec", sunAz: 60, sunEl: 40 },    // 12 night-blue molecules + rubbing hands
  { set: "showroom", light: "day", crowd: "radar", sunAz: 70 },                 // 13 the 1947 Radarange
  { set: "kitchen", light: "day", crowd: "stuck", sunAz: 60, sunEl: 55 },       // 14 does not fit through the door
  { set: "kitchen", light: "golden", crowd: "family", sunAz: 150, sunEl: 38 },  // 15 1967 countertop microwave
  { set: "showroom", light: "day", crowd: "podium", sunAz: 70 },                // 16 microwaves outsell gas ranges
  { set: "suburb", light: "golden", crowd: "dusk", sunAz: 25, sunEl: 6 },       // 17 glowing kitchen windows
  { set: "lab", light: "golden", crowd: "desk", sunAz: 150, sunEl: 38 },        // 18 the 2 dollar envelope
  { set: "lab", light: "golden", crowd: "melt", sunAz: 150, sunEl: 38 },        // 19 melted bar beside the magnetron
];
const starts = SPEC.map((_, i) => (i === 0 ? 0 : F(lineStart(i + 1)) - LEAD_F));
export const SHOTS: ShotDef[] = SPEC.map((s, i) => ({ id: i + 1, a: starts[i], b: i + 1 < SPEC.length ? starts[i + 1] : TOTAL, ...s }));
/** crossfades (frames) at place changes */
export const XFADE: Record<number, number> = { 2: 10, 3: 10, 4: 10, 7: 10, 12: 10, 13: 8, 14: 10, 15: 8, 16: 10, 17: 12, 18: 12 };

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- places ----------------
// lab: back wall z = -6, wall bench z -5.9..-4.6, central bench x -0.2..3.6 z -3.1..-2.0 (top y 0.97)
export const MAG: V3 = [3.15, 0.97, -2.55];           // the magnetron on the bench end (drawn 1.5x)
export const MAG_S = 1.5;
export const RADAR_CAB: V3 = [-4.0, 0, -3.2];
export const SP2: V3 = [-0.3, 0, -2.0];                 // close-up spot
export const SP7: V3 = [4.0, 0, -1.7];             // Spencer right of the magnetron (his pocket side faces it)
export const SP9: V3 = [4.0, 0, -2.0];
export const SP11: V3 = [2.05, 0, -3.1];
export const CW_BENCH: V3 = [1.55, 0, -3.3];         // the coworker behind the bench, left of the egg
export const BOWL: V3 = [2.3, 0.97, -2.35];
export const EGG: V3 = [2.45, 1.1, -2.45];
export const MELT19: V3 = [2.5, 0.97, -2.2];
// yard (shot 1)
export const YARD_Z = 1.0;
export const yardX = (t: number) => -1.45 + 0.27 * t;
// factory
export const BELT_X = 14;
export const HAND_X = [-17.8, -15.9, -14.0];
export const SHELF: V3 = [-15.9, 0, -8.5];
export const SP_CHEER: V3 = [10.35, 0, 1.4];
export const BOSS_CHEER: V3 = [9.5, 0, 1.4];
// showroom
export const MAG12: V3 = [-1.0, 0.95, -0.4];
export const CHUNK: V3 = [0.35, 2.0, -1.0];
export const HANDS12: V3 = [0.45, 0.75, 0.2];
export const RANGE: V3 = [0, 0, -2];
export const MPILE: V3 = [-1.3, 0, -1.4];
export const SPILE: V3 = [1.7, 0, -1.4];
// kitchen
export const DOOR_Z = 0.85;
export const KMW: V3 = [0.3, 0.93, -2.35];
export const KMW_S = 1.9;
export const walkX = (t: number) => yardX(t);
export const SP_WALK_Z = YARD_Z;

// ---------------- beats shared by cast / props ----------------
/** crate stack k (0..11) of shot 5 grows from the word "two" to "hundred" of "two thousand six hundred" */
export const stackGrow = (k: number, t: number) => {
  const t0 = wtf(5, "two", 0.55, 1) - 0.1, t1 = wtf(5, "hundred", 0.9) + 0.25, st = t0 + (t1 - t0) * (k / 12) * 0.85;
  return smooth((t - st) / 0.55);
};
export const pieceRows = (t: number) => Math.min(3, Math.floor(3 * smooth((t - lf(4, 0.5)) / Math.max(0.8, lf(4, 0.95) - lf(4, 0.5)))) + (t > lf(4, 0.5) ? 1 : 0));
/** belt speed (m/s) integral: slow, then fast from "faster" */
export const beltDist = (t: number) => {
  const u = (t - wtf(5, "faster", 0.3)) / 1.0;
  return 1.6 * t + 6 * (u <= 0 ? 0 : u >= 1 ? u - 0.5 : u * u * u - (u * u * u * u) / 2);
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const pushK = (f: number, f0: number, rate: number) => Math.exp(-rate * Math.max(0, f - f0));
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const A = (id: number) => SHOTS[id - 1].a;

const C: Record<number, Key[]> = {
  // 1 Spencer and his pocket first, then in close on the bar (candy bar ... melted)
  1: [
    { f: 0, s: (f) => { const t = f / FPS, x = yardX(t); return { pos: [x * 0.7 + 0.35, 1.25, 5.1 - 0.1 * t], look: [x + 0.05, 1.5, YARD_Z], fov: 46 }; } },
    { f: RW(1, "candy"), dur: 46, s: (f) => { const t = f / FPS, x = yardX(t); return { pos: [x - 0.3, 1.25, 4.6], look: [x - 0.1, 1.1, YARD_Z], fov: 42 }; } },
  ],
  2: [{ f: A(2), s: (f) => dolly([0.5, 1.4, 2.7], [0.3, 1.25, -2.0], pushK(f, A(2), 0.0014), { fov: 44 }) }],
  3: [{ f: A(3), s: (f) => dolly([-5.0, 1.8, 1.2], [-0.8, 3.0, -11.5], pushK(f, A(3), 0.0012), { fov: 54 }) }],
  4: [{ f: A(4), s: (f) => dolly([-15.9, 1.3, 2.3], [-15.9, 1.5, -8.0], pushK(f, A(4), 0.0014), { fov: 54 }) }],
  5: [{ f: A(5), s: (f) => dolly([8.6, 1.6, 7.4], [17, 2.6, -3.5], pushK(f, A(5), 0.0014), { fov: 54 }) }],
  6: [{ f: A(6), s: (f) => dolly([9.9, 1.5, 5.6], [9.9, 1.55, 1.4], pushK(f, A(6), 0.0018), { fov: 40, roll: 0.02 }) }],
  7: [
    { f: A(7), s: (f) => dolly([3.7, 1.35, 1.3], [3.75, 1.1, -2.0], pushK(f, A(7), 0.0014), { fov: 46 }) },
    { f: RW(7, "chocolate") - 4, dur: 40, s: (f) => dolly([3.7, 1.15, 1.5], [3.75, 1.05, -1.7], pushK(f, RW(7, "chocolate"), 0.0014), { fov: 44 }) },
  ],
  8: [{ f: A(8), s: (f) => dolly([-0.1, 1.45, 3.4], [SP2[0], 1.35, SP2[2]], pushK(f, A(8), 0.0014), { fov: 40 }) }],
  9: [{ f: A(9), s: (f) => dolly([2.85, 1.45, 0.7], [2.9, 1.2, -2.5], pushK(f, A(9), 0.0016), { fov: 44 }) }],
  10: [
    { f: A(10), s: (f) => dolly([2.4, 1.5, 1.9], [2.4, 1.25, -2.9], pushK(f, A(10), 0.0014), { fov: 52 }) },
    { f: RW(10, "exploded") - 6, dur: 22, s: (f) => dolly([2.2, 1.5, 1.6], [2.0, 1.3, -2.9], pushK(f, RW(10, "exploded"), 0.002), { fov: 44, roll: -0.04 }) },
  ],
  11: [{ f: A(11), s: (f) => dolly([2.5, 1.5, 1.4], [2.5, 1.35, -3.0], pushK(f, A(11), 0.0016), { fov: 42, roll: 0.06 }) }],
  12: [
    { f: A(12), s: (f) => dolly([0.4, 1.5, 6.4], [0.4, 1.5, -1], pushK(f, A(12), 0.0012), { fov: 56 }) },
    { f: RW(12, "rubbing") - 14, dur: 28, s: (f) => dolly([0.4, 1.2, 5.2], [0.4, 1.3, -0.4], pushK(f, RW(12, "rubbing"), 0.0014), { fov: 52 }) },
  ],
  13: [{ f: A(13), s: (f) => {
      const k = glide((f - A(13)) / (SHOTS[12].b - A(13)));
      return { pos: [-0.7 + 0.5 * k, 1.1 + 0.5 * k, 8.0 - 1.8 * k], look: [-0.6, 1.5, -2], fov: 56 };
    } }],
  14: [{ f: A(14), s: (f) => dolly([2.4, 1.5, 1.6], [-3.7, 1.3, 0.1], pushK(f, A(14), 0.0014), { fov: 52, roll: -0.03 }) }],
  15: [{ f: A(15), s: (f) => dolly([0.3, 1.4, 4.8], [0.3, 1.25, -2.4], pushK(f, A(15), 0.0016), { fov: 50 }) }],
  16: [{ f: A(16), s: (f) => dolly([0.3, 1.5, 6.4], [0.2, 1.1, -1.5], pushK(f, A(16), 0.0016), { fov: 56, roll: -0.02 }) }],
  17: [{ f: A(17), s: (f) => { const t = (f - A(17)) / FPS, z = 22 - 1.6 * t; return { pos: [-3.2, 1.7, z], look: [8, 0.6, z - 9], fov: 78 }; } }],
  18: [{ f: A(18), s: (f) => dolly([0.4, 1.3, 3.0], [0.4, 1.15, -2.0], pushK(f, A(18), 0.002), { fov: 44 }) }],
  19: [{ f: A(19), s: (f) => dolly([2.7, 1.3, 0.9], [2.7, 1.05, -2.3], pushK(f, A(19), 0.0014), { fov: 40 }) }],
};
export const camAt = (id: number, f: number): Cam => run(C[id], f);

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: A(2), cInf: 8, focus: () => [SP2[0], 1.4, SP2[2]] },
  { f: A(3), cInf: 0 },
  { f: A(8), cInf: 8, focus: () => [SP2[0], 1.3, SP2[2]] },
  { f: A(9), cInf: 0 },
  { f: A(11), cInf: 8, focus: () => [SP11[0], 1.35, SP11[2]] },
  { f: A(12), cInf: 0 },
  { f: A(15), cInf: 7, focus: () => [0.3, 1.2, -2.35] },
  { f: A(16), cInf: 0 },
  { f: A(18), cInf: 7, focus: () => [0.1, 1.2, -2.0] },
  { f: A(19), cInf: 7, focus: () => [2.5, 1.0, -2.2] },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export const tEggStart = () => wtf(10, "tried", 0.3);
export const tEggSwell = () => wtf(10, "egg", 0.5);
export const tEggBurst = () => wtf(10, "exploded", 0.62);
