// Timeline of "The Dancing Plague of 1518": one shot per voice line (19 lines), timed to public/dance/words.json
// ({word, start, end, line}). Re-timing: replace words.json (and voice.wav); shot edges and story beats are looked up
// by (line, word) with wt() / RW(), so every constant below follows. Camera grammar as in the Pisa short:
// slow push-ins on every hold, smoothstep glides, hard cuts only on big reframes, dutch tilts for drama.
import WORDS from "../../../public/dance/words.json";

export const FPS = 30;
export const VOICE_SEC = 65.9;
export const TOTAL = Math.ceil(VOICE_SEC * FPS) + 3;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

type Word = { word: string; start: number; end: number; line: number };
const WL = WORDS as Word[];
export const wt = (line: number, word: string, nth = 0) => {
  const m = WL.filter((w) => w.line === line && w.word.toLowerCase() === word);
  return (m[nth] ?? m[0] ?? WL.find((w) => w.line === line)!).start;
};
export const lineStart = (n: number) => WL.find((w) => w.line === n)!.start;
export const lineEnd = (n: number) => { const l = WL.filter((w) => w.line === n); return l[l.length - 1].end; };
export const F = (s: number) => Math.round(s * FPS);
export const LEAD_F = 2;
export const R = (s: number) => F(s) - LEAD_F;
export const RW = (line: number, word: string, nth = 0) => R(wt(line, word, nth));

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type SetId = "street" | "square" | "hall" | "famine" | "room" | "chapel";
export type Crowd = "hook" | "step" | "bench" | "morning" | "laugh" | "keeps" | "grow" | "hall" | "frantic" | "doctors" | "ban" | "freeze" | "famine" | "yawn" | "ripple" | "bread" | "sleep" | "chapel" | "band";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetId; crowd: Crowd; sunAz?: number; sunEl?: number };
type ShotSpec = Omit<ShotDef, "id" | "a" | "b">;
const SPEC: ShotSpec[] = [
  { set: "street", light: "day", crowd: "hook", sunAz: 70 },         // 1 crane over Strasbourg down to Troffea, crowd behind
  { set: "street", light: "day", crowd: "step", sunAz: 70 },         // 2 steps out of the door, starts to dance
  { set: "street", light: "day", crowd: "bench", sunAz: 70 },        // 3 no music: the empty bench
  { set: "street", light: "golden", crowd: "morning", sunAz: 130, sunEl: 20 },   // 4 evening -> morning, bags under the eyes
  { set: "street", light: "day", crowd: "laugh", sunAz: 70 },        // 5 neighbours laugh
  { set: "street", light: "day", crowd: "keeps", sunAz: 70 },        // 6 she doesn't (dutch tilt)
  { set: "square", light: "day", crowd: "grow", sunAz: 70 },         // 7 thirty -> four hundred
  { set: "hall", light: "golden", crowd: "hall", sunAz: 165, sunEl: 35 },                   // 8 guild hall, musicians
  { set: "hall", light: "golden", crowd: "frantic", sunAz: 165, sunEl: 35 },                // 9 worse
  { set: "street", light: "day", crowd: "doctors", sunAz: 70 },      // 10 doctor + priest
  { set: "square", light: "golden", crowd: "ban", sunAz: 140, sunEl: 18 },       // 11 ban the music, march in red shoes
  { set: "square", light: "golden", crowd: "freeze", sunAz: 140, sunEl: 18 },    // 12 freeze, one looks at us
  { set: "famine", light: "night", crowd: "famine" },                // 13 famine street
  { set: "room", light: "night", crowd: "yawn", sunAz: 160, sunEl: 40 },                    // 14 yawn domino
  { set: "square", light: "night", crowd: "ripple" },                // 15 fear ripples through the dancers
  { set: "famine", light: "night", crowd: "bread" },                 // 16 moldy bread, doubt
  { set: "square", light: "golden", crowd: "sleep", sunAz: 140, sunEl: 16 },     // 17 dancers drop asleep
  { set: "chapel", light: "golden", crowd: "chapel", sunAz: 165, sunEl: 35 },               // 18 chapel on the mountain
  { set: "square", light: "day", crowd: "band", sunAz: 70 },         // 19 council in front of the band
];
const starts = SPEC.map((_, i) => (i === 0 ? 0 : F(lineStart(i + 1)) - LEAD_F));
export const SHOTS: ShotDef[] = SPEC.map((s, i) => ({ id: i + 1, a: starts[i], b: i + 1 < SPEC.length ? starts[i + 1] : TOTAL, ...s }));
/** crossfades (frames) at place changes */
export const XFADE: Record<number, number> = { 7: 10, 8: 10, 10: 10, 11: 10, 13: 8, 14: 8, 15: 8, 16: 8, 17: 10, 18: 12, 19: 12 };

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- places ----------------
export const TRO: V3 = [0, 0, 12];            // Frau Troffea's spot in the street
export const DOOR: V3 = [-5.5, 0, 6.9];       // her front door (house on the left, facing +x)
export const BENCH: V3 = [-3.4, 0, 5.2];      // the empty musicians' bench
export const STAGE_Z = -12, STAGE_Y = 0.9;    // guild hall stage
export const DOC: V3 = [-1.3, 0, 8];
export const PRIEST: V3 = [1.5, 0, 8];
export const COUNCIL: V3 = [-1.4, 0, 4];
export const DANCER: V3 = [0.5, 0, 5.2];      // the dancer who looks at us (shot 12)
export const LOAF: V3 = [0, 0.95, 0];
export const STATUE: V3 = [0, 0, -9];

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
  // 1 crane: rooftops + spire -> down to Troffea, then pull back to show the crowd behind her
  1: [
    { f: 0, s: () => ({ pos: [6, 40, 62], look: [0, 24, -60], fov: 46 }) },
    { f: 4, dur: 70, s: () => ({ pos: [2.8, 2.3, 27], look: [0, 1.5, 8], fov: 40 }) },
    { f: RW(1, "month"), dur: 36, s: () => ({ pos: [3.6, 2.6, 34], look: [0, 2.2, 0], fov: 42 }) },
    { f: RW(1, "hundreds") - 4, dur: 40, s: () => ({ pos: [5, 3.4, 44], look: [0, 3.0, -8], fov: 46, roll: 0.03 }) },
  ],
  2: [
    { f: A(2), s: (f) => dolly([4.4, 1.7, 13], [-4.6, 1.5, 7], pushK(f, A(2), 0.0016), { fov: 42 }) },
    { f: RW(2, "steps") - 6, dur: 40, s: (f) => dolly([4.2, 1.8, 17.5], [-1.2, 1.4, 9.5], pushK(f, RW(2, "steps"), 0.0018), { fov: 42 }) },
  ],
  3: [
    { f: A(3), s: (f) => dolly([0.9, 1.5, 15.6], [0, 1.45, 12], pushK(f, A(3), 0.0025), { fov: 36 }) },
    { f: RW(3, "reason") - 16, dur: 24, s: () => ({ pos: [0.9, 1.35, 15.6], look: [BENCH[0] + 0.6, 0.8, BENCH[2]], fov: 40, roll: -0.04 }) },
  ],
  4: [
    { f: A(4), s: (f) => dolly([-2.8, 1.1, 18], [0.2, 1.5, 11], pushK(f, A(4), 0.0016), { fov: 42 }) },
    { f: RW(4, "morning") - 8, dur: 30, s: (f) => dolly([0.9, 1.5, 15.4], [0, 1.55, 12], pushK(f, RW(4, "morning"), 0.0028), { fov: 34 }) },
  ],
  5: [{ f: A(5), s: (f) => dolly([0.3, 1.5, 15.2], [0, 1.45, 9], pushK(f, A(5), 0.003), { fov: 40, roll: 0.02 }) }],
  6: [{ f: A(6), s: (f) => dolly([1.0, 1.25, 14.6], [0, 1.4, 11.5], pushK(f, A(6), 0.004), { fov: 38, roll: 0.16 }) }],
  7: [
    { f: A(7), s: (f) => dolly([2.5, 1.6, 9.5], [0, 1.5, -2], pushK(f, A(7), 0.0018), { fov: 44 }) },
    { f: RW(7, "august") - 10, dur: 70, s: () => ({ pos: [0, 15, 38], look: [0, 0.5, -2], fov: 44, roll: 0.03 }) },
  ],
  8: [
    { f: A(8), s: (f) => dolly([0, 2.3, 15], [0, 1.7, -8], pushK(f, A(8), 0.0018), { fov: 44 }) },
    { f: RW(8, "hire") - 6, dur: 34, s: (f) => dolly([0.8, 2.3, -3], [0, 2.0, STAGE_Z], pushK(f, RW(8, "hire"), 0.0025), { fov: 40 }) },
  ],
  9: [{ f: A(9), s: (f) => dolly([-4, 2.1, 12.5], [1.2, 1.9, -9], pushK(f, A(9), 0.003), { fov: 46, roll: -0.1 }) }],
  10: [
    { f: A(10), s: (f) => dolly([-0.2, 1.6, 15.8], [DOC[0] - 0.6, 1.9, DOC[2]], pushK(f, A(10), 0.002), { fov: 38 }) },
    { f: RW(10, "priests") - 6, dur: 22, s: (f) => dolly([0.4, 1.6, 15.8], [PRIEST[0], 1.7, PRIEST[2]], pushK(f, RW(10, "priests"), 0.002), { fov: 38, roll: -0.03 }) },
  ],
  11: [
    { f: A(11), s: (f) => dolly([0.9, 1.7, 10.5], [COUNCIL[0] + 0.2, 1.65, COUNCIL[2]], pushK(f, A(11), 0.002), { fov: 52 }) },
    { f: RW(11, "marches") - 10, cut: true, s: (f) => dolly([-3, 1.6, 17], [-2, 1.2, 0], pushK(f, RW(11, "marches"), 0.002), { fov: 44, roll: 0.03 }) },
    { f: RW(11, "red") - 6, dur: 18, s: () => ({ pos: [3.5, 0.45, 6], look: [1.6, 0.3, 0.5], fov: 38, roll: -0.05 }) },
  ],
  12: [
    { f: A(12), s: (f) => dolly([0, 2.6, 18], [0, 1.5, 0], pushK(f, A(12), 0.002), { fov: 44, roll: 0.05 }) },
    { f: RW(12, "makes") - 4, dur: 36, s: (f) => dolly([0.6, 1.6, 9.2], [DANCER[0], 1.6, DANCER[2]], pushK(f, RW(12, "makes"), 0.002), { fov: 34 }) },
  ],
  13: [
    { f: A(13), s: (f) => dolly([0, 2.0, 17.5], [0, 2.2, -1], pushK(f, A(13), 0.002), { fov: 44 }) },
    { f: RW(13, "famine") - 10, dur: 40, s: (f) => dolly([-3.5, 1.4, 12], [3, 1.5, 3], pushK(f, RW(13, "famine"), 0.002), { fov: 44, roll: -0.04 }) },
    { f: RW(13, "terrified") - 10, dur: 36, s: () => ({ pos: [0, 1.4, 16], look: [0, 3.4, -2], fov: 46, roll: 0.03 }) },
  ],
  14: [{ f: A(14), s: (f) => dolly([0, 1.1, 8.8], [0, 1.15, 0], pushK(f, A(14), 0.0025), { fov: 34, roll: -0.03 }) }],
  15: [
    { f: A(15), s: (f) => dolly([0, 6, 24], [0, 0.8, 0], pushK(f, A(15), 0.002), { fov: 44, roll: 0.04 }) },
    { f: RW(15, "legs") - 12, dur: 24, s: () => ({ pos: [1.4, 0.55, 8.5], look: [0.4, 0.5, 3.5], fov: 40, roll: -0.04 }) },
  ],
  16: [
    { f: A(16), s: (f) => dolly([0.3, 1.45, 5.2], [0, 1.15, 0], pushK(f, A(16), 0.0028), { fov: 40 }) },
    { f: RW(16, "experts") - 6, dur: 26, s: () => ({ pos: [0.8, 1.9, 8], look: [0, 1.9, -3], fov: 42, roll: 0.04 }) },
  ],
  17: [{ f: A(17), s: (f) => dolly([0, 3.2, 19], [0, 0.9, 0], pushK(f, A(17), 0.002), { fov: 44, roll: -0.03 }) }],
  18: [
    { f: A(18), s: (f) => dolly([0, 1.4, 7], [0, 2.4, -9], pushK(f, A(18), 0.002), { fov: 40 }) },
    { f: RW(18, "saint") - 8, dur: 36, s: (f) => dolly([0.2, 1.0, 1.0], [0, 3.0, -9], pushK(f, RW(18, "saint"), 0.002), { fov: 36, roll: 0.03 }) },
  ],
  19: [{ f: A(19), s: (f) => dolly([0.5, 1.7, 9], [0, 1.5, 0.5], pushK(f, A(19), 0.0025), { fov: 40, roll: 0.02 }) }],
};
export const camAt = (id: number, f: number): Cam => run(C[id], f);

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const at = (p: V3, y = 1.5) => (): V3 => [p[0], y, p[2]];
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: A(2), cInf: 8, focus: at(TRO, 1.5) },
  { f: A(3), cInf: 11, focus: at(TRO, 1.5) },
  { f: RW(3, "reason") - 14, cInf: 9, focus: at(BENCH, 0.7) },
  { f: A(4), cInf: 0 },
  { f: A(5), cInf: 10, focus: () => [0, 1.5, 11] },
  { f: A(6), cInf: 12, focus: at(TRO, 1.45) },
  { f: A(7), cInf: 0 },
  { f: A(10), cInf: 10, focus: at(DOC, 1.7) },
  { f: RW(10, "priests") - 4, cInf: 10, focus: at(PRIEST, 1.7) },
  { f: A(11), cInf: 0 },
  { f: A(12), cInf: 0 },
  { f: RW(12, "makes"), cInf: 12, focus: at(DANCER, 1.6) },
  { f: A(13), cInf: 0 },
  { f: A(14), cInf: 8, focus: () => [0, 1.15, 0] },
  { f: A(15), cInf: 0 },
  { f: A(16), cInf: 12, focus: () => [0, 1.1, 0] },
  { f: RW(16, "experts"), cInf: 0 },
  { f: A(17), cInf: 0 },
  { f: A(18), cInf: 0 },
  { f: RW(18, "saint"), cInf: 7, focus: () => [0, 2.6, -9] },
  { f: A(19), cInf: 9, focus: () => [0, 1.6, 0.5] },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
