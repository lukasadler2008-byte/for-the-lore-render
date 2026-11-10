// Timeline of "The Tower Saved by Bad Ground" (Script #1, Leaning Tower of Pisa): one shot per script sentence,
// timed to the voice word timings in public/pisa/words.json ({word, start, end, line}; line = sentence 1-21).
// Re-timing: replace public/pisa/words.json (and voice.wav) and every constant below follows, because shot edges and
// story beats are looked up by (sentence, word) with wt() / RW() instead of hard-coded frames.
// Camera grammar is the bridge short's (measured from the reference): slow push-ins on every hold, symmetric
// smootherstep glides of 18-40 f, hard cuts on big reframes, 7-frame flip kicks on impacts, no hand-held float.
import WORDS from "../../../public/pisa/words.json";

export const FPS = 30;
export const VOICE_SEC = 64.4;
export const TOTAL = Math.ceil(VOICE_SEC * FPS) + 3;
export const D0 = 0; // ground level (build.ts helpers default to it)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

// ---------------- voice timing ----------------
type Word = { word: string; start: number; end: number; line: number };
const WL = WORDS as Word[];
/** start (s) of the nth occurrence of `word` in sentence `line` (falls back to the sentence start) */
export const wt = (line: number, word: string, nth = 0) => {
  const m = WL.filter((w) => w.line === line && w.word.toLowerCase() === word);
  return (m[nth] ?? m[0] ?? WL.find((w) => w.line === line)!).start;
};
export const lineStart = (n: number) => WL.find((w) => w.line === n)!.start;
export const lineEnd = (n: number) => { const l = WL.filter((w) => w.line === n); return l[l.length - 1].end; };
/** frame of a time in seconds */
export const F = (s: number) => Math.round(s * FPS);
/** visual reactions land 2 frames before their word (reference: 0-3 f early) */
export const LEAD_F = 2;
export const R = (s: number) => F(s) - LEAD_F;
/** reaction frame of a word */
export const RW = (line: number, word: string, nth = 0) => R(wt(line, word, nth));

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type SetId = "piazza" | "site" | "field" | "cutaway" | "bus";
export type Crowd = "tourists" | "masons" | "beppe" | "march" | "battle" | "grandson" | "closing" | "engineer" | "quake" | "bus" | "drill" | "final" | "none";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetId; crowd: Crowd; sunAz?: number; sunEl?: number; barrier?: boolean };
type ShotSpec = Omit<ShotDef, "id" | "a" | "b">;
const SPEC: ShotSpec[] = [
  { set: "piazza", light: "day", crowd: "tourists", sunAz: 135 },     // 1 hook: low wide, small quake, tower barely sways
  { set: "site", light: "day", crowd: "masons" },                      // 2 1173: crane down into the shallow pit
  { set: "site", light: "day", crowd: "beppe" },                       // 3 second floor: tips, bubble slides
  { set: "site", light: "day", crowd: "march" },                       // 4 whip to the city gate, soldiers march out
  { set: "field", light: "day", crowd: "battle" },                     // 5 Pisa vs Lucca, comic shield bonks
  { set: "cutaway", light: "day", crowd: "none", sunAz: 140 },         // 6 cutaway: the mud settles
  { set: "site", light: "day", crowd: "grandson" },                    // 7 1272: taller floors on the low side
  { set: "site", light: "day", crowd: "grandson" },                    // 8 "There. Fixed."
  { set: "piazza", light: "day", crowd: "tourists", sunAz: 135 },     // 9 bent like a banana
  { set: "piazza", light: "golden", crowd: "closing", barrier: true, sunAz: 120 }, // 10 1990, Italy closes it
  { set: "piazza", light: "golden", crowd: "engineer", barrier: true, sunAz: 120 },// 11 engineer gulps
  { set: "piazza", light: "golden", crowd: "quake", barrier: true, sunAz: 120 },   // 12 four strong quakes
  { set: "piazza", light: "golden", crowd: "engineer", barrier: true, sunAz: 120 },// 13 "Wait... how is it still standing?"
  { set: "cutaway", light: "night", crowd: "none" },                   // 14 "You see": the mud cushion
  { set: "cutaway", light: "night", crowd: "none" },                   // 15 different rhythms
  { set: "bus", light: "night", crowd: "bus", sunAz: 160, sunEl: 70 }, // 16 knees locked
  { set: "bus", light: "night", crowd: "bus", sunAz: 160, sunEl: 70 }, // 17 bump hits the spine
  { set: "bus", light: "night", crowd: "bus", sunAz: 160, sunEl: 70 }, // 18 bend them
  { set: "cutaway", light: "night", crowd: "none" },                   // 19 the mud is the tower's bent knees
  { set: "piazza", light: "day", crowd: "drill", barrier: true, sunAz: 120 }, // 20 2001: digging out soil
  { set: "piazza", light: "day", crowd: "final", sunAz: 135 },        // 21 stop on purpose; tourist holds it up
];
const starts = SPEC.map((_, i) => (i === 0 ? 0 : F(lineStart(i + 1)) - LEAD_F));
export const SHOTS: ShotDef[] = SPEC.map((s, i) => ({ id: i + 1, a: starts[i], b: i + 1 < SPEC.length ? starts[i + 1] : TOTAL, ...s }));
/** crossfades (frames) at place / time changes; the night switch at 14 is a hard cut ("You see,"), 19 a match dissolve */
export const XFADE: Record<number, number> = { 5: 8, 6: 10, 7: 10, 9: 10, 10: 12, 16: 8, 19: 14, 20: 12 };
export const FLASH_AT = SHOTS[1].a;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- story physics ----------------
/** tower: 8 levels (ground floor, 6 galleries, bell chamber). build = levels standing (fractional = the top one rising),
 *  lean = base tilt in degrees (top toward -x), curve = correction per level from level 3 up (degrees, the banana),
 *  bell = extra correction of the bell chamber, sink = metres the base sits below ground, sway = extra tilt (quake),
 *  shake = ground jitter in x (m, cutaway). */
export type TowerState = { build: number; lean: number; curve: number; bell: number; sink: number; sway: number; shake: number };
export const TOWER_R = 8.0, H0 = 11, HG = 5.8, HB = 7;
const T = (f: number) => f / FPS;
/** damped sway after each hit */
const quake = (t: number, hits: number[], amp: number, hz: number, decay = 1.6) =>
  hits.reduce((a, h) => a + (t >= h ? amp * Math.sin(2 * Math.PI * hz * (t - h)) * Math.exp(-decay * (t - h)) : 0), 0);
export const Q1 = [wt(1, "earthquakes"), wt(1, "earthquakes") + 0.35];
export const Q12 = [wt(12, "four"), wt(12, "strong"), wt(12, "ones"), wt(12, "hit")];
export const towerAt = (id: number, f: number): TowerState => {
  const t = T(f), base: TowerState = { build: 8, lean: 5.5, curve: 1.0, bell: 1.4, sink: 0.3, sway: 0, shake: 0 };
  switch (id) {
    case 1: return { ...base, lean: 4.5, sway: quake(t, Q1, 0.35, 0.7) };
    case 2: return { ...base, build: 0.06 + 0.1 * smooth((t - wt(2, "starts")) / 3), lean: 0, curve: 0, sink: 0 };
    case 3: { const k = smooth((t - wt(3, "sinking") + 0.07) / 1.1); return { ...base, build: 2, lean: 0.4 + 3.6 * k, curve: 0, sink: 0.2 + 0.6 * k }; }
    case 4: return { ...base, build: 2, lean: 4, curve: 0, sink: 0.8 };
    case 6: { const k = smooth((t - wt(6, "settle")) / 2); return { ...base, build: 3, lean: 4, curve: 0, sink: 0.8 + 0.3 * k }; }
    case 7: case 8: {
      const k = id === 8 ? 1 : smooth((t - wt(7, "every")) / (wt(7, "side") - wt(7, "every") + 0.4));
      return { ...base, build: 3 + k, lean: 4.2, curve: 1.6, sink: 1.1 };
    }
    // banana: base leaning ~7 deg, every upper floor tilted back (cartoon-exaggerated so it reads on a phone)
    case 9: return { ...base, lean: 7, curve: 1.4, bell: 2.0 };
    case 10: case 11: case 13: return { ...base, lean: 7.2, curve: 1.4, bell: 2.0 };
    case 12: return { ...base, lean: 7.2, curve: 1.4, bell: 2.0, sway: quake(t, Q12, 0.7, 0.45, 1.2) };
    case 14: case 15: case 19: {
      const on = id === 15 ? 1 : id === 14 ? smooth((t - wt(14, "cushion") + 0.5) / 1) : 0.6;
      return { ...base, lean: 6.0, sway: 0.7 * on * Math.sin(2 * Math.PI * 0.45 * t), shake: 0.35 * on * Math.sin(2 * Math.PI * 5.5 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 1.3 * t)) };
    }
    case 20: { const k = smooth((t - wt(20, "digging")) / (lineEnd(20) - wt(20, "digging") + 1.5)); return { ...base, lean: 7.2 - 1.6 * k, curve: 1.4, bell: 2.0 }; }
    case 21: return { ...base, lean: 5.6, curve: 1.4, bell: 2.0 };
    default: return base;
  }
};
/** mud cushion squeeze in the cutaway (0 loose .. 1 settled / squashed) */
export const mudAt = (id: number, f: number) => (id === 6 ? smooth((T(f) - wt(6, "settle")) / 2.2) : 1);

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
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });
const A = (id: number) => SHOTS[id - 1].a;

// cast positions shared with cast.ts / world.ts
export const BEPPE: V3 = [4.0, 0, 16.8];
export const GATE: V3 = [-62, 0, 8];          // west gate of the 1173 town (faces +x)
export const GRANDSON: V3 = [2.4, 0, 15.6];
export const OFFICIAL: V3 = [1.6, 0, 14.4];
export const ENGINEER: V3 = [-3.2, 0, 19.0];
export const BARRIER_R = 13;
export const PIT_R = 11;
export const COMMUTER: V3 = [0.38, 0, -0.2];      // bus aisle (bus floor at y = 0, long axis z)
export const FOREMAN: V3 = [12.3, 0, 13.6];    // 2001 crew boss who raises his hand: "stop"
export const TOURIST_END: V3 = [-0.14, 0, 55]; // the "holding it up" tourist

// framings (f -> camera); each pushes in from its key frame
const S1a = (f: number) => zoom([11, 1.0, 66], [-2.5, 25, 0], 52, pushK(f, 0, 0.0022));
const S1b = (f: number) => dolly([5.5, 1.25, 58], [-1, 5, 0], pushK(f, RW(1, "ground"), 0.0025, 0.005, 30), { fov: 46, roll: 0.03 }); // tourists in front, tower behind
const S2a = (f: number) => dolly([11, 12.5, 34], [0.5, 0.2, 8], pushK(f, A(2), 0.002), { fov: 44 });
const S2b = (f: number) => dolly([7.5, 2.4, 22], [0.5, 0.3, 4], pushK(f, RW(2, "foundation"), 0.0025, 0.005, 30), { fov: 42 });
const S3a = (f: number) => dolly([6.6, 1.4, 24.5], [1.6, 3.6, 6], pushK(f, A(3), 0.0022, 0.004, 30), { fov: 52 });
const S4a = (f: number) => dolly([3, 1.7, 23], [0, 6.5, 0], pushK(f, A(4), 0.0025), { fov: 46 });
const S4b = (): Shot => ({ pos: [3, 1.7, 23], look: [-40, 5, 13], fov: 46, roll: -0.05 }); // whip target
const S4c = (f: number) => dolly([-36, 1.75, 17], [-57, 3.2, 8], pushK(f, RW(4, "but") + 9, 0.0025), { fov: 44, roll: 0.03 });
const S5a = (f: number) => dolly([0.3, 1.75, 8.8], [0, 1.35, 0], pushK(f, A(5), 0.0028, 0.006, 30), { fov: 42 });
const S6a = (f: number) => dolly([0, 8, 124], [0, 6, 0], pushK(f, A(6), 0.0018), { fov: 40 });
const S6b = (f: number) => dolly([0, 2, 74], [0, -4, 0], pushK(f, RW(6, "without"), 0.002, 0.005, 30), { fov: 40, roll: -0.04 });
const S7a = (f: number) => dolly([9.5, 1.7, 31], [0.5, 5.5, 0], pushK(f, A(7), 0.0022), { fov: 44 });
const S7b = (f: number) => dolly([9.5, 1.7, 31], [-0.8, 22, 0], pushK(f, RW(7, "every"), 0.002), { fov: 46 });
const S8a = (f: number) => dolly([2.9, 1.62, 18.4], [GRANDSON[0], 1.66, GRANDSON[2]], pushK(f, A(8), 0.003, 0.007, 20), { fov: 34, roll: 0.04 });
const S9a = (): Shot => ({ pos: [1.5, 5, 64], look: [-1.5, 25, 0], fov: 50 });
const S9b = (): Shot => ({ pos: [2, 9, 104], look: [-2, 26, 0], fov: 46 });
const S10a = (f: number) => dolly([8, 1.75, 31], [0.5, 3.2, 12], pushK(f, A(10), 0.0025), { fov: 44 });
const S10b = (f: number) => dolly([4.2, 1.6, 21], [OFFICIAL[0], 1.6, OFFICIAL[2]], pushK(f, RW(10, "italy"), 0.003, 0.006, 25), { fov: 38, roll: -0.04 });
const S11a = (f: number) => dolly([-2.85, 1.6, 21.7], [ENGINEER[0], 1.58, ENGINEER[2]], pushK(f, A(11), 0.003, 0.007, 30), { fov: 34 });
const S11b = (f: number) => dolly([-2.3, 1.5, 21.4], [ENGINEER[0] + 0.15, 1.6, ENGINEER[2]], pushK(f, RW(11, "should"), 0.003), { fov: 34, roll: 0.04 });
const S12a = (f: number) => zoom([15, 2.2, 60], [-1, 22, 0], 50, pushK(f, A(12), 0.0022), { roll: 0.1 });
const S12b = (f: number) => zoom([11, 2.0, 52], [-2, 17, 0], 50, pushK(f, RW(12, "ones"), 0.0025), { roll: -0.06 });
const S13a = (f: number) => dolly([-2.55, 1.5, 21.3], [ENGINEER[0], 1.52, ENGINEER[2]], pushK(f, A(13), 0.003, 0.008, 25), { fov: 32, roll: -0.05 });
const S14a = (f: number) => dolly([0, 5, 120], [0, 9, 0], pushK(f, A(14), 0.0018), { fov: 40 });
const S14b = (f: number) => dolly([0, 0, 66], [0, -5, 0], pushK(f, RW(14, "works"), 0.002, 0.005, 30), { fov: 40 });
const S15a = (f: number) => dolly([0, 3, 92], [0, 4, 0], pushK(f, A(15), 0.0018), { fov: 42, roll: 0.05 });
const S15b = (f: number) => dolly([10, 1, 82], [0, -2, 0], pushK(f, RW(15, "so"), 0.002), { fov: 42, roll: -0.03 });
const S16a = (f: number) => dolly([0.6, 1.55, 4.6], [0.1, 1.2, 0], pushK(f, A(16), 0.003, 0.006, 25), { fov: 46 });
const S17a = (f: number) => dolly([0.7, 1.35, 3.8], [0.1, 1.3, 0], pushK(f, A(17), 0.003), { fov: 46, roll: 0.06 });
const S18a = (f: number) => dolly([0.5, 1.2, 4.3], [0.1, 0.95, 0], pushK(f, A(18), 0.003), { fov: 46, roll: -0.03 });
const S19a = (f: number) => dolly([0, -2, 52], [0, -5, 0], pushK(f, A(19), 0.0035), { fov: 40 });
const S20a = (f: number) => dolly([21, 5.6, 17], [11.5, 0.9, 3.2], pushK(f, A(20), 0.0028), { fov: 46, roll: -0.03 });
const S20b = (f: number) => dolly([38, 3.2, 42], [5, 12, 0], pushK(f, RW(20, "soil"), 0.0025), { fov: 46, roll: 0.03 });
const S21a = (f: number) => dolly([14.8, 1.62, 16.4], [FOREMAN[0], 1.7, FOREMAN[2]], pushK(f, A(21), 0.003, 0.006, 25), { fov: 36 });
const S21b = (f: number) => zoom([1.2, 1.0, 60], [-10.5, 17, 0], 58, pushK(f, RW(21, "because"), 0.0018));
const S21c = (f: number) => zoom([1.9, 1.15, 61.5], [-8.5, 15, 4], 54, pushK(f, RW(21, "just") - 16, 0.0025));

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: RW(1, "ground"), cut: true, s: S1b }],
  2: [{ f: A(2), s: S2a }, { f: RW(2, "foundation") - 18, dur: 40, s: S2b }],
  3: [{ f: A(3), s: S3a }, { f: RW(3, "one"), dur: 20, s: rolled(S3a, 0.07) }],
  4: [{ f: A(4), s: S4a }, { f: RW(4, "but") - 2, dur: 11, s: S4b }, { f: RW(4, "but") + 9, cut: true, s: S4c }],
  5: [{ f: A(5), s: S5a }, { f: RW(5, "hundred") - 10, dur: 22, s: rolled(S5a, -0.06) }],
  6: [{ f: A(6), s: S6a }, { f: RW(6, "without"), cut: true, s: S6b }],
  7: [{ f: A(7), s: S7a }, { f: RW(7, "every") - 14, dur: 40, s: S7b }],
  8: [{ f: A(8), s: S8a }],
  9: [{ f: A(9), s: S9a }, { f: RW(9, "bent") - 20, dur: 40, s: S9b }],
  10: [{ f: A(10), s: S10a }, { f: RW(10, "italy"), cut: true, s: S10b }],
  11: [{ f: A(11), s: S11a }, { f: RW(11, "should") - 10, dur: 30, s: S11b }],
  12: [{ f: A(12), s: S12a }, { f: RW(12, "ones") - 16, dur: 30, s: S12b }],
  13: [{ f: A(13), s: S13a }],
  14: [{ f: A(14), s: S14a }, { f: RW(14, "works"), dur: 34, s: S14b }],
  15: [{ f: A(15), s: S15a }, { f: RW(15, "so") - 20, dur: 40, s: S15b }],
  16: [{ f: A(16), s: S16a }],
  17: [{ f: A(17), s: S17a }],
  18: [{ f: A(18), s: S18a }],
  19: [{ f: A(19), s: S19a }],
  20: [{ f: A(20), s: S20a }, { f: RW(20, "soil") - 12, dur: 30, s: S20b }],
  21: [{ f: A(21), s: S21a }, { f: RW(21, "because"), cut: true, s: S21b }, { f: RW(21, "just") - 16, dur: 36, s: S21c }],
};

// impact kicks: the image offset flips sign every frame and decays to 0 in 7 f; they start LEAD_F before the word
export const BUMP17 = wt(17, "bump"), BUMP18 = wt(18, "ride");
const KICKS: [number, number][] = [
  ...Q1.map((q) => [q, 0.9] as [number, number]),
  [wt(5, "fighting"), 0.5], [wt(5, "hundred"), 0.5],
  ...Q12.map((q, i) => [q, 0.9 + 0.2 * i] as [number, number]),
  [BUMP17, 1.6], [BUMP18, 0.35],
];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + LEAD_F + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const at = (p: V3, y = 1.6) => (): V3 => [p[0], y, p[2]];
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },                                        // hook wide
  { f: RW(1, "ground"), cInf: 6, focus: () => [0, 1.6, 40] }, // low lawn: tourists sharp, tower soft
  { f: A(2), cInf: 0 },                                     // crane down
  { f: A(3), cInf: 10, focus: at(BEPPE) },                  // Beppe + level, tipping stump soft behind
  { f: A(4), cInf: 0 },
  { f: A(5), cInf: 10, focus: () => [0, 1.6, 0] },          // shield bonk MS
  { f: A(6), cInf: 0 },                                     // cutaway (diagram: sharp)
  { f: A(8), cInf: 14, focus: at(GRANDSON, 1.66) },         // "There. Fixed." CU
  { f: A(9), cInf: 0 },
  { f: RW(10, "italy"), cInf: 11, focus: at(OFFICIAL) },
  { f: A(11), cInf: 13, focus: at(ENGINEER, 1.55) },
  { f: A(12), cInf: 0 },
  { f: A(13), cInf: 14, focus: at(ENGINEER, 1.5) },
  { f: A(14), cInf: 0 },
  { f: A(16), cInf: 8, focus: at(COMMUTER, 1.3) },          // bus
  { f: A(19), cInf: 0 },
  { f: A(20), cInf: 6, focus: () => [11, 1.5, 6] },
  { f: A(21), cInf: 12, focus: at(FOREMAN, 1.62) },
  { f: RW(21, "because"), cInf: 0 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => { const d = dofAt(f); return d.focus ? d.focus(f) : camAt(id, f).look; };
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

/** near framing objects (kit = GLB name accepted by build.ts kitClone), visible a <= f < b inside their shot */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  { a: A(10), b: RW(10, "italy"), kit: "plant_bushDetailed", pos: [6.2, 0, 26.6], s: 1.1, yaw: 0.3 },
];
