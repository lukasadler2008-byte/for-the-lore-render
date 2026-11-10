// The Pisa cast as lit flat sprites in the 3D world (same machinery as the bridge short): every character asks for a
// drawing (key + draw call) each frame; the pool keeps one canvas per distinct drawing. Characters are yaw-only
// billboards shaded by cardShade(); standing ones get a contact blob (+ a sun-direction tail by day). Effects are
// unlit cards. Cards, effects and blobs live on the NOINK layer so the world ink never outlines their quads.
// Roles: Beppe the mason (coif, leather apron) and his grandson (same face, red cap), masons, Pisan soldiers (red,
// white cross) vs Lucca (white over red), the 1990 official, engineers (hard hats, hi-vis), tourists, a bus commuter.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, SKINS, fxBurst, fxShadow, fxContact, fxDrum, fxPuff, Outfit, Expr, FrontOpts, SideOpts, Prop } from "./toon";
import { fxCrow, fxFear, fxVeins, fxDemon, fxX, fxCross, fxSnore, fxLaugh, fxBubble, fxSweat, fxShoes, fxFearRing, fxStatue, fxSpark, fxStink } from "./fxd";
import { FPS, SHOTS, V3, clamp01, smooth, wt, lineStart, RW, TRO, DOOR, BENCH, STAGE_Y, STAGE_Z, DOC, PRIEST, COUNCIL, DANCER, STATUE, Light } from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = { key: string; draw: (p: Pen) => void; x: number; y: number; z: number; scale?: number; mirror?: boolean; yaw?: number; roll?: number; size?: [number, number, number]; far?: boolean };
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

let SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
let LNAME: Light = "day";
const tmp = new THREE.Vector3();
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number) => {
  const f = Math.round(t * FPS);
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts = {}, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return { key, x, y, z, scale, mirror, draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)), size: [w, h, k] };
};
const FRONT = { side: false, mirror: false };

const CONTACT: Record<Light, [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], night: [0.18, 0.18, 0.34] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1, lite = false) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day" && !lite) {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- outfits ----------------
const RED_SHOE = "#d42f2f";
const TROFFEA_O: Outfit = { jacket: "#e6d3a8", dress: "#4f78a8", apron: "#f3ece0", pants: "#4a4038", boots: "#4a3426", hat: "scarf", cap: "#c8323a", skin: SKINS[1] };
const NEIGHBOR = (v: number): Outfit => v % 2
  ? { jacket: "#d9a441", dress: "#7a8f4a", apron: "#efe3c8", pants: "#4a4038", boots: "#4a3426", hat: "scarf", cap: "#3f8f6a", skin: SKINS[0] }
  : { jacket: "#8c5a3a", pants: "#4a4038", boots: "#4a3426", hat: "coif", cap: "#e9dcc0", skin: SKINS[2], moustache: "#4a3020", apron: "#7a4f33" };
const COATS = ["#3f6fb5", "#8c3b4a", "#5d7a3a", "#b5653f", "#2f5f6a", "#7b5ac9", "#c9873a", "#4f8a6a"];
const DRESSES = ["#d9a441", "#c25a7a", "#5a8fc2", "#8a6ab0", "#6aa86a", "#d9803a"];
const DANCE_O = (v: number, red: boolean): Outfit => {
  const w = v % 3 === 1, boots = red ? RED_SHOE : "#4a3426";
  if (w) return { jacket: COATS[(v * 3) % 8], dress: DRESSES[v % 6], apron: v % 2 ? "#efe3c8" : undefined, pants: "#4a4038", boots, hat: v % 2 ? "scarf" : "bonnet", cap: ["#c8323a", "#3f6fb5", "#e9cf8f"][v % 3], skin: SKINS[v % 4] };
  return { jacket: COATS[v % 8], pants: ["#4a4038", "#3b3f52", "#5a4a3c"][v % 3], boots, hat: (["coif", "cap", "hair", "none", "cap", "coif"] as const)[v % 6] === "none" ? null : (["coif", "cap", "hair", "none", "cap", "coif"] as const)[v % 6],
    cap: ["#e9dcc0", "#c9873a", "#7a8f4a", "#c0353a"][v % 4], hair: ["#5a3b2a", "#2a201a", "#d9a441", "#8a5a34"][v % 4], skin: SKINS[(v + 1) % 4], moustache: v % 5 === 2 ? "#4a3426" : undefined, build: v % 11 === 4 ? "kid" : undefined };
};
const COUNCIL_O = (v: number): Outfit => ({ jacket: ["#7a2a3a", "#2f5a4a", "#4a3a78"][v % 3], pants: "#2f2a36", boots: "#1d1b22", hat: "furcap", cap: ["#6a4a36", "#4a3a2a", "#7a5a3c"][v % 3], collar: "#efe8d6", chain: true, build: "stout", skin: SKINS[v % 3], moustache: "#3a2a22" });
const MUSICIAN = (v: number): Outfit => ({ jacket: ["#c8553a", "#3f8f6a", "#5a78c0"][v % 3], pants: "#3b3f52", boots: "#4a3426", hat: "cap", cap: ["#e2b04a", "#c0353a", "#e9dcc0"][v % 3], skin: SKINS[(v + 2) % 4], moustache: v === 0 ? "#3a2a22" : undefined });
const DOCTOR_O: Outfit = { jacket: "#2f2a4a", dress: "#2f2a4a", pants: "#2f2a4a", boots: "#1d1b22", hat: "physician", moustache: "#3a2a22", skin: SKINS[0], build: "stout" };
const PRIEST_O: Outfit = { jacket: "#1c1a22", dress: "#1c1a22", pants: "#1c1a22", boots: "#1d1b22", hat: "calotte", collar: "#f4f0e6", skin: SKINS[2] };
const EXPERT = (v: number): Outfit => ({ ...DOCTOR_O, jacket: ["#2f4a4a", "#4a2f3a"][v % 2], dress: ["#2f4a4a", "#4a2f3a"][v % 2], skin: SKINS[v % 4] });
const SICK = (v: number): Outfit => ({ jacket: ["#7a6a58", "#6a6a74", "#8a7a5a"][v % 3], pants: "#4a4038", boots: "#3a2c22", hat: v % 2 ? "scarf" : "hair", cap: "#8a8a78", hair: "#5a4a3a", skin: "#bcd6a2" });
const FOLK = (v: number): Outfit => ({ jacket: COATS[(v + 2) % 8], pants: "#3b3f52", boots: "#4a3426", hat: v % 2 ? "cap" : "coif", cap: ["#e9dcc0", "#8a6a4a"][v % 2], skin: SKINS[v % 4] });

// ---------------- helpers ----------------
const hz0 = (i: number) => hh(i, 4);
/** one dancer (front view, dance mode): phase from time * cycles/s with a per-dancer offset */
type DOpts = { hz?: number; expr?: Expr; tired?: number; energy?: number; sweat?: number | boolean; roll?: number; scale?: number; frozen?: number; red?: boolean; lite?: boolean; mode?: FrontOpts["mode"]; knee?: number; headTilt?: number; prop?: Prop };
const dancer = (cam: CamInfo, t: number, out: Stage, i: number, x: number, y: number, z: number, o: Outfit, okey: string, op: DOpts = {}) => {
  const ph = op.frozen !== undefined ? op.frozen : ((t * (op.hz ?? 1.5) + hz0(i)) % 1 + 1) % 1;
  const exprs: Expr[] = (op.tired ?? 0) > 0.45 ? ["tired", "pained", "tired"] : ["laugh", "grin", "smile_closed", "grin"];
  const fo: FrontOpts = { mode: op.mode ?? "dance", phase: q(ph, 10), expr: op.expr ?? exprs[i % exprs.length], blink: lidAt(t, i), tired: q(op.tired ?? 0, 4), energy: q(op.energy ?? 1, 4),
    sweat: op.sweat ? 1 : 0, facing: ((i % 3) - 1) as -1 | 0 | 1, knee: op.knee, headTilt: op.headTilt, prop: op.prop };
  const pl = person(cam, { i, o, okey }, x, y, z, FRONT, fo, {}, o.build === "kid" ? 0.72 : op.scale ?? 1);
  if (op.roll) pl.roll = op.roll;
  out.places.push(pl);
  if (!op.roll) blob(out, x, y, z, o.build === "kid" ? 0.72 : 1, 1, op.lite ?? cam.pos.distanceTo(tmp.set(x, y, z)) > 14);
  return pl;
};
/** crowd spiral: i-th spot on a sunflower disc of spacing s around (cx, cz) */
const spot = (i: number, s: number, cx = 0, cz = 0): [number, number] => {
  const r = 0.56 * s * Math.sqrt(i + 0.5), a = i * 2.39996;
  return [cx + r * Math.cos(a), cz + r * Math.sin(a) * 0.9];
};
const outsideOf = (x: number, z: number, d = 14): [number, number] => { const l = Math.hypot(x, z) || 1; return [x + (x / l) * d, z + (z / l) * d]; };
/** birth times of the crowd, from a headcount curve N(t) (binary-search free: scan 1/60 s steps) */
const births = (N: (t: number) => number, t0: number, t1: number, n: number) => {
  const b: number[] = [];
  let i = 0;
  for (let t = t0; t <= t1 && i < n; t += 1 / 60) while (i < n && N(t) >= i + 1) b.push(t), i++;
  while (b.length < n) b.push(t1);
  return b;
};
/** a crowd member walks in from the edge after being born: pos lerp + pop-in */
const arrive = (t: number, born: number, x: number, z: number, d = 12): [number, number, number] => {
  const k = clamp01((t - born) / 0.9), e = 1 - (1 - k) ** 3, [ox, oz] = outsideOf(x, z, d);
  return [ox + (x - ox) * e, oz + (z - oz) * e, clamp01((t - born) / 0.3)];
};
const fxp = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, extra: Partial<FxPlace> = {}) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, ...extra });
const idle = (cam: CamInfo, t: number, out: Stage, i: number, o: Outfit, okey: string, x: number, y: number, z: number, expr: Expr, extra: Partial<FrontOpts> = {}, sc = 1) => {
  out.places.push(person(cam, { i, o, okey }, x, y, z, FRONT, { mode: "stand", expr, blink: lidAt(t, i), ...extra }, {}, sc));
  blob(out, x, y, z, sc);
};

// ---------------- shots ----------------
const T_TRO_STEP = () => wt(2, "steps"), T_TRO_DANCE = () => wt(2, "starts");
const hook = (cam: CamInfo, t: number, out: Stage) => {
  dancer(cam, t, out, 0, TRO[0], 0, TRO[2], TROFFEA_O, "tro", { hz: 1.4, expr: "grin" });
  const N = (u: number) => 2 * smooth((u - wt(1, "month") + 0.3) / 0.8) + 22 * smooth((u - wt(1, "month")) / (wt(1, "hundreds") - wt(1, "month"))) + 40 * smooth((u - wt(1, "hundreds")) / 1.4);
  const bt = births(N, 0, 6, 64);
  for (let k = 0; k < 64; k++) {
    if (t < bt[k]) continue;
    const row = Math.floor(k / 4), file = k % 4, x = (file - 1.5) * 1.5 + (hh(k) - 0.5) * 0.7, z = TRO[2] - 3.4 - row * 1.5 - (hh(k, 2)) * 0.5;
    const [px, pz, sc] = arrive(t, bt[k], x, z, 6);
    dancer(cam, t, out, k + 1, px, 0, pz, DANCE_O(k + 3, false), `c${(k + 3) % 14}`, { hz: 1.5 + 0.2 * hh(k, 3), scale: sc });
  }
};
const step = (cam: CamInfo, t: number, out: Stage) => {
  const ts = T_TRO_STEP(), td = T_TRO_DANCE();
  const k = smooth((t - ts + 0.07) / 1.6);
  const x = DOOR[0] + 0.9 + (-1.2 - DOOR[0] - 0.9 + 4.8) * k * 0 + (4.6 - 0.9 + 0.0) * k * 0 + (-0.2 - (DOOR[0] + 0.9)) * k, z = DOOR[2] + (10.2 - DOOR[2]) * k;
  if (t < td - 0.07) {
    const walking = t > ts - 0.07;
    const view = viewOf(cam, x, z, 1, 0.4);
    const ph = q(((t - ts) * 1.0 % 1 + 1) % 1, 60);
    out.places.push(person(cam, { i: 0, o: TROFFEA_O, okey: "tro" }, x, 0, z, walking ? view : FRONT,
      walking ? { mode: "stroll", phase: ph, expr: "smile_closed", blink: lidAt(t, 0), look: 1 } : { mode: "stand", expr: "neutral", blink: lidAt(t, 0), facing: 1 },
      { mode: "march", phase: ph, expr: "smile_closed", stride: 0.7 * view.fs, stomp: 0.5 }));
    blob(out, x, 0, z);
  } else dancer(cam, t, out, 0, x, 0, z, TROFFEA_O, "tro", { hz: 1.4, expr: "grin" });
  idle(cam, t, out, 1, NEIGHBOR(1), "n1", 3.2, 0, 0.5, "neutral", { facing: -1 });
  idle(cam, t, out, 2, NEIGHBOR(0), "n0", -3.2, 0, -3.5, "neutral", { facing: 1 });
  idle(cam, t, out, 3, FOLK(1), "f1", 3.0, 0, -9, "smile");
};
const bench = (cam: CamInfo, t: number, out: Stage) => {
  dancer(cam, t, out, 0, TRO[0], 0, TRO[2], TROFFEA_O, "tro", { hz: 1.4, expr: "neutral" });
  idle(cam, t, out, 1, NEIGHBOR(0), "n0", -1.5, 0, 6.8, "neutral", { facing: 1 });
  const shrug = t > wt(3, "reason") - 0.07 ? q(Math.sin((t - wt(3, "reason")) * 14) * 0.5 + 0.5, 10) : undefined;
  idle(cam, t, out, 2, NEIGHBOR(1), "n1", -2.8, 0, 8.4, "nervous", { facing: 1, wave: shrug });
};
const morning = (cam: CamInfo, t: number, out: Stage) => {
  const tired = 0.2 * smooth((t - wt(4, "evening")) / 1) + 0.8 * smooth((t - wt(4, "morning") + 0.4) / 0.9);
  dancer(cam, t, out, 0, TRO[0], 0, TRO[2], TROFFEA_O, "tro", { hz: 1.4 - 0.25 * tired, tired, energy: 1 - 0.35 * tired, sweat: tired > 0.6, expr: tired > 0.5 ? "tired" : "grin" });
  idle(cam, t, out, 1, NEIGHBOR(0), "n0", -3.3, 0, 7.5, "smile", { facing: 1 });
};
const laugh = (cam: CamInfo, t: number, out: Stage) => {
  dancer(cam, t, out, 0, 0.4, 0, 3.8, TROFFEA_O, "tro", { hz: 1.4, tired: 0.9, energy: 0.7, expr: "tired", sweat: true });
  const b1 = 0.05 * Math.abs(Math.sin(t * 9)), b2 = 0.05 * Math.abs(Math.sin(t * 9 + 1.3));
  idle(cam, t, out, 1, NEIGHBOR(1), "n1", 0.95, b1, 9.0, "laugh", { facing: -1 });
  idle(cam, t, out, 2, NEIGHBOR(0), "n0", -1.0, b2, 9.6, "laugh", { facing: 1, tilt: q(5 * Math.sin(t * 9), 4) });
  const u = q((t * 1.2) % 1, 30);
  fxp(out, `laugh${u}`, 300, 200, (p) => fxLaugh(p, u), 0.95, 2.1 + b1, 9.0, 1.2, 0.8);
  fxp(out, `laugh${u}`, 300, 200, (p) => fxLaugh(p, u), -1.0, 2.1 + b2, 9.6, 1.2, 0.8);
  if (t > wt(5, "she'll") - 0.07) fxp(out, "bubble", 400, 300, fxBubble, -0.5, 2.9, 9.3, 1.9, 1.4);
};
const keeps = (cam: CamInfo, t: number, out: Stage) => {
  dancer(cam, t, out, 0, TRO[0], 0, TRO[2], TROFFEA_O, "tro", { hz: 1.5, tired: 1, energy: 0.8, sweat: true, expr: "tired" });
  const u = q((t * 2) % 1, 20);
  fxp(out, `sw${u}`, 300, 300, (p) => fxSweat(p, u), TRO[0] - 0.5, 1.7, TRO[2] + 0.2, 1.1, 1.1);
  idle(cam, t, out, 1, NEIGHBOR(1), "n1", 2.4, 0, 8.6, "pained", { facing: -1 });
};

const grow = (cam: CamInfo, t: number, out: Stage) => {
  const N = (u: number) => 3 + 27 * smooth((u - wt(7, "thirty") + 0.2) / 1.1) + 370 * smooth((u - wt(7, "august")) / (wt(7, "hundred") + 0.6 - wt(7, "august")));
  const bt = births(N, lineStart(7) - 3, lineStart(7) + 6, 400), tr = Math.min(1, (t - wt(7, "within")) / 1);
  for (let i = 0; i < 400; i++) {
    if (t < bt[i] - 0.02 && i > 2) continue;
    const [x, z] = spot(i, 1.12, 0, -2), [px, pz, sc] = i < 3 ? [x, z, 1] as [number, number, number] : arrive(t, bt[i], x, z, 10);
    if (tr < 0 && i > 0) continue;
    dancer(cam, t, out, i, px, 0, pz, i === 0 ? TROFFEA_O : DANCE_O(i, false), i === 0 ? "tro" : `c${i % 14}`, { hz: 1.5 + 0.3 * hh(i, 3), scale: sc, lite: true });
  }
};

const MUS_X = [-3.2, 0, 3.2];
const musicians = (cam: CamInfo, t: number, out: Stage, x0: number, y: number, z: number, tired = 0, sweat = false, born = -1, gap = 3.2) => {
  const props: Prop[] = ["drum", "fiddle", "flute"];
  props.forEach((pr, k) => {
    const sc = born < 0 ? 1 : clamp01((t - born - k * 0.15) / 0.3);
    if (sc <= 0) return;
    const fo: FrontOpts = { mode: "dance", phase: q((t * (pr === "drum" ? 2.0 : 1.5) % 1 + 1) % 1, 10), prop: pr, expr: tired > 0.4 ? "pained" : "grin", blink: lidAt(t, 400 + k), energy: 0.4, tired: q(tired, 4), sweat: sweat ? 1 : 0, facing: (k - 1) as -1 | 0 | 1 };
    out.places.push(person(cam, { i: 400 + k, o: MUSICIAN(k), okey: `mu${k}${pr}` }, x0 + (k - 1) * gap, y, z, FRONT, fo, {}, sc));
    blob(out, x0 + (k - 1) * gap, y, z);
  });
  if (sweat) { const u = q((t * 1.6) % 1, 20); for (let k = 0; k < 3; k++) fxp(out, `sw${u}`, 300, 300, (p) => fxSweat(p, u), x0 + (k - 1) * gap, y + 1.9, z + 0.1, 1.2, 1.2); }
};
const councilPoint = (cam: CamInfo, t: number, out: Stage, spots: [number, number, number][], toward: number, i0 = 60, expr: Expr = "smile") => {
  spots.forEach(([x, y, z], k) => {
    const o = COUNCIL_O(k);
    out.places.push(person(cam, { i: i0 + k, o, okey: `co${k}` }, x, y, z, FRONT, { mode: "stand", expr, prop: "point", pt: (x < toward ? 1 : -1) as -1 | 1, blink: lidAt(t, i0 + k), facing: (x < toward ? 1 : -1) as -1 | 1 }));
    blob(out, x, y, z);
  });
};
const hall = (cam: CamInfo, t: number, out: Stage, id: number) => {
  const fr = id === 9;
  const tb = wt(8, "let") - 0.2;
  musicians(cam, t, out, 0, STAGE_Y, STAGE_Z + 2.4, fr ? 0.6 : 0, fr, id === 8 ? wt(8, "hire") : -1);
  councilPoint(cam, t, out, [[-1.9, 0, 5.2], [0.1, 0, 7.4], [2.1, 0, 5.0]], 0.1);
  const n = fr ? 64 : 44, bt = births((u) => 8 + (n - 8) * smooth((u - tb) / 1.4), 0, 40, n);
  for (let i = 0; i < n; i++) {
    const [x, z] = spot(i, 1.45, 0, 2.5);
    const born = id === 9 ? 0 : tb + (i / n) * 1.2, k = id === 9 ? 1 : clamp01((t - born) / 0.4);
    if (k <= 0) continue;
    dancer(cam, t, out, i, x, 0, z, i === 0 ? TROFFEA_O : DANCE_O(i, false), i === 0 ? "tro" : `c${i % 14}`, { hz: fr ? 2.3 : 1.6, energy: fr ? 1 : 0.9, tired: fr ? 0.5 : 0, sweat: fr && i % 2 === 0, scale: k, expr: fr ? (i % 3 === 0 ? "shock" : "pained") : undefined, lite: cam.pos.distanceTo(tmp.set(x, 1, z)) > 14 });
  }
};

const doctors = (cam: CamInfo, t: number, out: Stage) => {
  const tb = wt(10, "blood") - 0.07, tp = wt(10, "demons") - 0.07;
  out.places.push(person(cam, { i: 30, o: DOCTOR_O, okey: "doc" }, DOC[0], 0, DOC[2], FRONT, { mode: "stand", expr: "stern", prop: t > wt(10, "blame") - 0.07 ? "point" : "scroll", pt: -1, blink: lidAt(t, 30), facing: -1 }));
  blob(out, DOC[0], 0, DOC[2], 1.05);
  out.places.push(person(cam, { i: 31, o: PRIEST_O, okey: "priest" }, PRIEST[0], 0, PRIEST[2], FRONT, { mode: "stand", expr: "stern", prop: t > wt(10, "blame", 1) - 0.07 ? "point" : null, pt: 1, blink: lidAt(t, 31), facing: 1 }));
  blob(out, PRIEST[0], 0, PRIEST[2]);
  if (t > tb) { const k = easeOutS((t - tb) / 0.4); fxp(out, "veins", 600, 600, fxVeins, DOC[0] - 1.2, 2.75 + 0.1 * Math.sin(t * 5), DOC[2] - 0.3, 1.7 * k, 1.7 * k); }
  if (t > tp) { const k = easeOutS((t - tp) / 0.4), u = q((t * 0.8) % 1, 20); fxp(out, `demon${u}`, 600, 600, (p) => fxDemon(p, u), PRIEST[0] + 1.6, 2.55, PRIEST[2] - 0.3, 2.0 * k, 2.0 * k); }
  for (let k = 0; k < 14; k++) { const x = (k % 4 - 1.5) * 1.5 + (hh(k) - 0.5) * 0.6, z = 1.5 - Math.floor(k / 4) * 1.8; dancer(cam, t, out, k, x, 0, z, DANCE_O(k + 5, false), `c${(k + 5) % 14}`, { hz: 1.6, tired: 0.5, lite: true }); }
};
const easeOutS = (u: number) => 1 - (1 - clamp01(u)) ** 3;

const ban = (cam: CamInfo, t: number, out: Stage) => {
  const tm = wt(11, "marches") - 0.3, tr = wt(11, "red");
  if (t < tm) {
    councilPoint(cam, t, out, [[COUNCIL[0] + 0.2, 0, COUNCIL[2]], [COUNCIL[0] + 1.3, 0, COUNCIL[2] + 0.5], [COUNCIL[0] + 2.4, 0, COUNCIL[2]]], COUNCIL[0] - 3, 60, "stern");
    fxp(out, "drum", 260, 240, fxDrum, COUNCIL[0] - 1.5, 2.1, COUNCIL[2], 1.5, 1.4);
    if (t > wt(11, "music") - 0.07) { const k = easeOutS((t - wt(11, "music")) / 0.25); fxp(out, "cross", 400, 400, fxCross, COUNCIL[0] - 1.5, 2.1, COUNCIL[2] + 0.05, 1.6 * k, 1.6 * k); }
    for (let k = 0; k < 40; k++) { const [x, z] = spot(k, 1.3, 0, -6); dancer(cam, t, out, k, x, 0, z, DANCE_O(k + 1, true), `r${k % 14}`, { hz: 1.7, tired: 0.6, lite: true, expr: "pained" }); }
    return;
  }
  const front = 3 + 2.2 * (t - tr), ph = ((t * 1.1) % 1 + 1) % 1;
  for (let k = 0; k < 27; k++) {
    const row = Math.floor(k / 3), file = k % 3, x = front - row * 1.45 + (hh(k) - 0.5) * 0.15, z = -1.5 + file * 1.5 + 0.0;
    const who: Who = k < 3 ? { i: 60 + k, o: COUNCIL_O(k), okey: `co${k}` } : { i: k + 100, o: DANCE_O(k, true), okey: `r${k % 14}` };
    const view = viewOf(cam, x, z, 1, 0);
    const p2 = q(ph + 0.11 * (k % 2), 60);
    out.places.push(person(cam, who, x, 0, z, view, { mode: "march", phase: p2, expr: k < 3 ? "stern" : "pained", blink: lidAt(t, k + 100), lift: 50, tired: 0.6 },
      { mode: "march", phase: p2, expr: k < 3 ? "stern" : "pained", stride: view.fs, stomp: 1 }));
    blob(out, x, 0, z, 1, 1, cam.pos.distanceTo(tmp.set(x, 0, z)) > 14);
  }
  if (t > tr - 0.5) { fxp(out, "shoes", 500, 300, fxShoes, 1.0, 0.55, 0.9, 0.9, 0.54); const u = q(((t - tr) * 1.5) % 1, 20); fxp(out, `sp${u}`, 200, 200, (p) => fxSpark(p, u), 0.2, 0.9, 0.9, 0.35, 0.35); fxp(out, `sp${u}`, 200, 200, (p) => fxSpark(p, u), 1.8, 0.95, 0.9, 0.28, 0.28); }
};

const freeze = (cam: CamInfo, t: number, out: Stage) => {
  const tf = wt(12, "what") + 0.12, frozen = t >= tf;
  for (let i = 0; i < 120; i++) {
    const [x, z] = spot(i, 1.3, 0, -3);
    if (Math.hypot(x - DANCER[0], z - DANCER[2]) < 1.3) continue;
    dancer(cam, t, out, i, x, 0, z, DANCE_O(i, true), `r${i % 14}`, { hz: 1.9, tired: 0.6, frozen: frozen ? hh(i, 5) : undefined, expr: frozen ? "nervous" : "pained", lite: true });
  }
  const pl = dancer(cam, t, out, 200, DANCER[0], 0, DANCER[2], DANCE_O(3, true), "r3", { hz: 1.9, tired: 0.6, frozen: frozen ? 0.2 : undefined, expr: frozen ? "shock" : "pained" });
  void pl;
};

const crowPlaces = (out: Stage, t: number) => {
  const perch: [number, number, number][] = [[-6.2, 2.78, 18], [6.2, 2.78, 6], [-6.2, 2.78, -2], [6.2, 2.78, 12], [-6.2, 2.78, 8], [6.2, 2.78, -8]];
  perch.forEach(([x, y, z], i) => { const bob = Math.sin(t * 3 + i) > 0.9 ? 0.05 : 0; fxp(out, "crowP", 300, 300, (p) => fxCrow(p, 0, true), x, y + 0.3 + bob, z, 0.9 * (i % 2 ? -1 : 1), 0.9); });
  for (let i = 0; i < 4; i++) {
    const u = ((t * 0.18 + i * 0.27) % 1 + 1) % 1, x = -14 + 28 * u, y = 6 + 1.2 * Math.sin(i * 2 + t), z = 4 - i * 5, wg = q(0.5 + 0.5 * Math.sin(t * 9 + i), 3);
    fxp(out, `crowF${wg}`, 300, 300, (p) => fxCrow(p, wg), x, y, z, 1.4, 1.4);
  }
  fxp(out, "crowG", 300, 300, (p) => fxCrow(p, 0, true), 1.4, 0.3, 4, -0.7, 0.7);
  fxp(out, "crowG", 300, 300, (p) => fxCrow(p, 0, true), -1.8, 0.3, -6, 0.7, 0.7);
};
const famine = (cam: CamInfo, t: number, out: Stage) => {
  crowPlaces(out, t);
  const sick: [number, number, number][] = [[-4.7, 0, 14], [4.8, 0, 9], [-4.5, 0, 2.5], [4.7, 0, -5], [-4.9, 0, -10], [3.6, 0, 20]];
  sick.forEach(([x, y, z], k) => { out.places.push(person(cam, { i: 70 + k, o: SICK(k), okey: `sk${k}` }, x, y + 0.2, z, FRONT, { mode: "sit", expr: k % 2 ? "sick" : "tired", blink: lidAt(t, 70 + k), tired: 1, headTilt: q(8 * Math.sin(t * 0.9 + k), 4) })); blob(out, x, y, z); });
  for (const [k, x, z] of [[0, -0.9, -2.6], [1, 0.9, -3.4], [2, 0.0, -1.6], [3, 1.9, -1.9]] as const) {
    const trem = q(0.03 * Math.sin(t * 38 + k), 100);
    out.places.push(person(cam, { i: 80 + k, o: FOLK(k + 3), okey: `fo${k}` }, x + trem, 0, z, FRONT, { mode: "stand", expr: k % 2 ? "shock" : "nervous", blink: 0, tilt: q(2 * Math.sin(t * 20 + k), 4) }));
    blob(out, x, 0, z);
  }
  const tf = wt(13, "terrified") - 0.4, kf = 0.55 + 0.45 * smooth((t - tf) / 1.0), u = q((t * 0.5) % 1, 20);
  fxp(out, `fear${u}`, 700, 480, (p) => fxFear(p, u), 0, 4.6 + 0.12 * Math.sin(t * 2), -2.4, 6.4 * kf, 4.4 * kf, { soft: false });
};

const yawn = (cam: CamInfo, t: number, out: Stage) => {
  const t0 = wt(14, "yawn") - 0.1;
  for (let k = 0; k < 5; k++) {
    const s = t0 + 0.34 * k, on = t > s && t < s + 1.0, done = t >= s + 1.0, x = -2.2 + 1.1 * k;
    const lean = on ? q(-6 * Math.sin(((t - s) / 1.0) * Math.PI), 4) : 0;
    out.places.push(person(cam, { i: 90 + k, o: DANCE_O(k * 2 + 1, false), okey: `y${k}` }, x, 0.18, 0.15, FRONT,
      { mode: "sit", expr: on ? "yawn" : done ? "sleep" : "neutral", blink: on ? 0 : done ? 1 : lidAt(t, 90 + k), headTilt: lean, tired: done ? 0.7 : 0.2, facing: (k < 2 ? 1 : k > 2 ? -1 : 0) as -1 | 0 | 1 }));
    blob(out, x, 0.42, 0.15);
    if (on && t - s < 0.5) { const u = q((t - s) * 2, 10); fxp(out, `puff${u}`, 300, 300, (p) => fxPuff(p, u), x + 0.35, 1.45, 0.5, 0.6, 0.6, { soft: true }); }
  }
};

const ripple = (cam: CamInfo, t: number, out: Stage) => {
  const tw = wt(15, "spread") - 0.4, sp = 5.2;
  for (let i = 0; i < 100; i++) {
    const [x, z] = spot(i, 1.4, 0, 0), r = Math.hypot(x, z), ta = tw + r / sp, on = t > ta;
    dancer(cam, t, out, i, x, 0, z, i === 0 ? TROFFEA_O : DANCE_O(i, true), i === 0 ? "tro" : `r${i % 14}`, {
      mode: on ? "dance" : "stand", hz: 2.0, tired: 0.7, energy: on ? 0.9 : 0, expr: on ? (t < ta + 0.5 ? "shock" : "pained") : "nervous", lite: true,
      frozen: on ? undefined : 0, knee: on ? undefined : q(0.3 * Math.abs(Math.sin(t * 30 + i)), 10) * (t > ta - 0.35 ? 1 : 0) });
  }
  const k = clamp01((t - tw) * sp / 12);
  if (t > tw && k < 1) { const u = q(k, 30); fxp(out, `fr${u}`, 600, 600, (p) => fxFearRing(p, u), 0, 0.05, 0, 2 * (1 + 12 * k) + 1, 2 * (1 + 12 * k) + 1, { flat: true, soft: true }); }
};

const bread = (cam: CamInfo, t: number, out: Stage) => {
  const u = q((t * 0.7) % 1, 20);
  fxp(out, `stink${u}`, 200, 300, (p) => fxStink(p, u), 0.2, 1.6, 0.1, 0.6, 0.9, { soft: true });
  if (t > wt(16, "doubt") - 0.07) { const k = easeOutS((t - wt(16, "doubt") + 0.07) / 0.3); fxp(out, "doubtx", 400, 400, fxX, 0, 2.15, 0.3, 1.1 * k, 1.1 * k); }
  const shake = (k: number) => q(7 * Math.sin(t * 7 + k * 2) * (t > wt(16, "experts") - 0.1 ? 1 : 0.25), 3);
  for (const [k, x] of [[0, -1.5], [1, 1.5]] as const) {
    out.places.push(person(cam, { i: 30 + k, o: EXPERT(k), okey: `ex${k}` }, x, 0, -3.2, FRONT, { mode: "stand", expr: "stern", prop: "scroll", headTilt: shake(k), blink: lidAt(t, 30 + k), facing: k ? -1 : 1 }));
    blob(out, x, 0, -3.2, 1.05);
  }
  for (const [k, x, z] of [[0, 0.9, -5.4], [1, -0.8, -6.2]] as const) idle(cam, t, out, 50 + k, EXPERT(k + 2), `ex${k + 2}`, x, 0, z, "stern", { prop: "scroll", headTilt: shake(k + 4) });
};

const sleepC = (cam: CamInfo, t: number, out: Stage) => {
  const ts0 = lineStart(17) + 0.5, n = 90, order = Array.from({ length: n }, (_, i) => i).sort((a, b) => hh(a, 8) - hh(b, 8));
  const rank: number[] = []; order.forEach((id, r) => (rank[id] = r));
  for (let i = 0; i < n; i++) {
    const [x, z] = spot(i, 1.45, 0, 0), ts = ts0 + (rank[i] / n) * 2.0 * (0.4 + 0.6 * (rank[i] / n)) * 1.0, asleep = t > ts, fall = clamp01((t - ts) / 0.35), side = i % 2 ? 1 : -1;
    const tired = 1, slow = 1.1 - 0.4 * smooth((t - lineStart(17)) / 1.5);
    if (asleep) {
      out.places.push(person(cam, { i, o: i === 0 ? TROFFEA_O : DANCE_O(i, true), okey: i === 0 ? "tro" : `r${i % 14}` }, x - side * 0.2, 0.42 * fall, z, FRONT, { mode: "fall", expr: "sleep", blink: 1, tired: 1 }));
      const pl = out.places[out.places.length - 1]; pl.roll = side * 1.5 * fall * (1 - 0.02); pl.x = x - side * 0.45;
      if (t > ts + 0.4 && cam.pos.distanceTo(tmp.set(x, 0, z)) < 26 && i % 3 === 0) { const u = q(((t - ts) * 0.6) % 1, 12); fxp(out, `snore${u}`, 300, 400, (p) => fxSnore(p, u), x, 1.2, z, 0.9, 1.2, { soft: true }); }
      blob(out, x, 0, z, 1, 1, true);
    } else dancer(cam, t, out, i, x, 0, z, i === 0 ? TROFFEA_O : DANCE_O(i, true), i === 0 ? "tro" : `r${i % 14}`, { hz: slow, tired, energy: 0.35, expr: "tired", lite: true });
  }
};

const chapelC = (cam: CamInfo, t: number, out: Stage) => {
  const tg = wt(18, "forgiven") - 0.07, glad = t > tg;
  const k = 0.5 + 0.5 * smooth((t - wt(18, "saint")) / 1.2);
  fxp(out, "statue", 500, 900, fxStatue, STATUE[0], 1.6, STATUE[2], 2.2, 3.96);
  const u = q((t * 0.8) % 1, 20);
  for (const [dx, dy] of [[-1.6, 3.6], [1.7, 3.2], [-0.8, 4.6], [1.0, 4.9]] as const) fxp(out, `sp${u}`, 200, 200, (p) => fxSpark(p, u), STATUE[0] + dx, 1.6 + dy + 0.1 * Math.sin(t * 3 + dx), STATUE[2] + 0.3, 0.45 * k, 0.45 * k);
  let n = 0;
  for (let rw = 0; rw < 5; rw++) for (let c = 0; c < 8; c++) {
    const i = rw * 8 + c, side = c < 4 ? -1 : 1, x = side * (1.5 + (c % 4) * 1.25) + (hh(i) - 0.5) * 0.3, z = 3 - rw * 1.9;
    const o = n++ === 0 ? TROFFEA_O : DANCE_O(i, true);
    dancer(cam, t, out, i, x, 0, z, o, n === 1 ? "tro" : `r${i % 14}`, { mode: "stand", knee: 0.85, headTilt: glad ? -4 : 7, expr: glad ? "relief" : "tired", tired: glad ? 0.3 : 0.9, lite: z < -2 ? false : false });
  }
  out.places.push(person(cam, { i: 31, o: PRIEST_O, okey: "priest" }, 5.2, 0, -4, FRONT, { mode: "stand", expr: "smile_closed", blink: lidAt(t, 31), facing: -1, wave: q(0.5 + 0.5 * Math.sin(t * 2), 10) }));
  blob(out, 5.2, 0, -4);
};

const band = (cam: CamInfo, t: number, out: Stage) => {
  musicians(cam, t, out, 0, 0.45, -3.4, 0, false, -1, 1.8);
  out.places.push(person(cam, { i: 405, o: MUSICIAN(1), okey: "mu1b" }, 3.2, 0.45, -3.4, FRONT, { mode: "dance", phase: q(((t * 1.5) % 1 + 1) % 1, 10), prop: "flute", expr: "grin", energy: 0.4, blink: lidAt(t, 405), facing: -1 }));
  blob(out, 3.2, 0.45, -3.4);
  for (let k = 0; k < 3; k++) {
    const x = (k - 1) * 1.6, z = 1.2;
    dancer(cam, t, out, 60 + k, x, 0, z, COUNCIL_O(k), `co${k}`, { hz: 1.3 + 0.2 * k, energy: 0.7, expr: "dazed", tired: 0.2 });
  }
  const tw = wt(19, "panic");
  if (t > tw - 0.07) for (const [k, dx] of [[0, -1.6], [1, 0], [2, 1.6]] as const) { const u = q(((t - tw) * 1.3 + k * 0.3) % 1, 20); fxp(out, `star${u}`, 200, 200, (p) => fxSpark(p, u), dx, 2.45, 1.3, 0.5, 0.5); }
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light; SUN = cam.sun.clone().normalize();
  switch (s.crowd) {
    case "hook": hook(cam, t, out); break;
    case "step": step(cam, t, out); break;
    case "bench": bench(cam, t, out); break;
    case "morning": morning(cam, t, out); break;
    case "laugh": laugh(cam, t, out); break;
    case "keeps": keeps(cam, t, out); break;
    case "grow": grow(cam, t, out); break;
    case "hall": hall(cam, t, out, 8); break;
    case "frantic": hall(cam, t, out, 9); break;
    case "doctors": doctors(cam, t, out); break;
    case "ban": ban(cam, t, out); break;
    case "freeze": freeze(cam, t, out); break;
    case "famine": famine(cam, t, out); break;
    case "yawn": yawn(cam, t, out); break;
    case "ripple": ripple(cam, t, out); break;
    case "bread": bread(cam, t, out); break;
    case "sleep": sleepC(cam, t, out); break;
    case "chapel": chapelC(cam, t, out); break;
    case "band": band(cam, t, out); break;
  }
  return out;
};
export { FPS, fxBurst, fxCrow, BENCH, T_TRO_STEP };
