// The Pisa cast as lit flat sprites in the 3D world (same machinery as the bridge short): every character asks for a
// drawing (key + draw call) each frame; the pool keeps one canvas per distinct drawing. Characters are yaw-only
// billboards shaded by cardShade(); standing ones get a contact blob (+ a sun-direction tail by day). Effects are
// unlit cards. Cards, effects and blobs live on the NOINK layer so the world ink never outlines their quads.
// Roles: Beppe the mason (coif, leather apron) and his grandson (same face, red cap), masons, Pisan soldiers (red,
// white cross) vs Lucca (white over red), the 1990 official, engineers (hard hats, hi-vis), tourists, a bus commuter.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, SKINS, fxBurst, fxShadow, fxContact, fxPuff, Outfit, Expr, FrontOpts, SideOpts, Prop, frontGeom } from "./toon";
import { fxSweat, fxWaves, fxGlowDisc } from "./fxd";
import { FPS, SHOTS, V3, clamp01, smooth, wt, lineStart, lineEnd, yardX, YARD_Z, SP2, SP7, SP9, SP11, CW_BENCH, HAND_X, SP_CHEER, BOSS_CHEER, MAG, MAG12, CHUNK, HANDS12, KMW, EGG, BOWL, MELT19, RANGE, DOOR_Z, tEggStart, tEggSwell, tEggBurst, Light } from "./story";
import { NOINK } from "./ink";
import { SR } from "./solids";
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
export type Stage = { places: Place[]; fx: FxPlace[]; solids: SR[] };

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


// ---------------- the Microwave cast ----------------
const seedP = (i: number) => seedOf(i);
const gq = (v: number) => Math.round(v * 10) / 10;
const SPENCER = (goo = 0): Outfit => ({ jacket: "#7b5334", dress: "#7b5334", coat: true, pocket: true, goo, pants: "#3a3f55", boots: "#2a1f18", hat: "hair", hair: "#b9bbc6", skin: SKINS[1] });
const SP = (goo = 0): Who => ({ i: 0, o: SPENCER(gq(goo)), okey: `sp${Math.round(gq(goo) * 10)}` });
const COWORKER: Outfit = { jacket: "#c9873a", pants: "#3b3f52", boots: "#3a2c22", hat: "cap", cap: "#2f63c8", skin: SKINS[0] };
const BOSS: Outfit = { jacket: "#2b3050", pants: "#2b3050", boots: "#16151b", hat: "hair", hair: "#2a201a", tie: "#b8322f", shirt: "#f4f0e6", build: "stout", skin: SKINS[2], moustache: "#2a201a" };
const WJ = ["#5d7a8a", "#8a8a7a", "#6a8a5a", "#a07a5a", "#4f6a8a", "#7a6a8a"];
const WORKER = (v: number): Outfit => ({ jacket: WJ[v % 6], pants: ["#3b3f52", "#4a4038", "#2f4a5a"][v % 3], boots: "#3a2c22",
  hat: (["cap", "hair", "cap", "hair", "none", "cap"] as const)[v % 6] === "none" ? null : (["cap", "hair", "cap", "hair", "none", "cap"] as const)[v % 6],
  cap: ["#e9dcc0", "#3f6fb5", "#c0392f", "#5a8a5a"][v % 4], hair: ["#5a3b2a", "#2a201a", "#8a5a34", "#b9bbc6"][v % 4], skin: SKINS[(v + 1) % 4], apron: v % 2 ? undefined : "#a07a50" });
const MOM: Outfit = { jacket: "#d9803a", dress: "#d9803a", apron: "#f4f0e6", pants: "#4a4038", boots: "#4a3426", hat: "hair", hair: "#6a4a2a", skin: SKINS[0] };
const DAD: Outfit = { jacket: "#4f7a9a", pants: "#4a4038", boots: "#4a3426", hat: "hair", hair: "#3a2a22", skin: SKINS[0], moustache: "#3a2a22" };
const KIDA: Outfit = { jacket: "#e2453c", pants: "#3b5b9a", boots: "#f4f1ea", hat: "hair", hair: "#8a5a34", build: "kid", skin: SKINS[0] };
const KIDB: Outfit = { jacket: "#f2c230", dress: "#f2c230", pants: "#3b5b9a", boots: "#f4f1ea", hat: "hair", hair: "#3a2a22", build: "kid", skin: SKINS[1] };
const MOVER = (v: number): Outfit => ({ jacket: v ? "#3f6fb5" : "#c0392f", pants: "#3b3f52", boots: "#3a2c22", hat: "cap", cap: v ? "#e9dcc0" : "#2a2a30", skin: SKINS[v + 1], moustache: v ? undefined : "#3a2a22" });

/** world point of a design-space point (dx, dy) of a front card placed at (x, y, z) with scale sc; lift = metres toward the camera */
const dpos = (cam: CamInfo, x: number, y: number, z: number, dx: number, dy: number, sc = 1, lift = 0.06): [number, number, number] => {
  const rl = Math.hypot(cam.right.x, cam.right.z) || 1, rx = cam.right.x / rl, rz = cam.right.z / rl;
  const wx = (dx - 300) * SU * sc, wy = (975 - dy) * SU * sc;
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  return [x + rx * wx + (tx / tl) * lift, y + wy, z + rz * wx + (tz / tl) * lift];
};
const toward = (cam: CamInfo, p: V3, d: number): V3 => {
  const tx = cam.pos.x - p[0], tz = cam.pos.z - p[2], tl = Math.hypot(tx, tz) || 1;
  return [p[0] + (tx / tl) * d, p[1], p[2] + (tz / tl) * d];
};
const strike = (t: number, period: number, off = 0) => { const ph = (((t / period + off) % 1) + 1) % 1; return q(ph < 0.15 ? smooth(ph / 0.15) : 1 - smooth((ph - 0.15) / 0.85), 20); };
const bg = (cam: CamInfo, t: number, out: Stage, i: number, o: Outfit, okey: string, x: number, z: number, expr: Expr, extra: Partial<FrontOpts> = {}, y = 0, sc = 1) => {
  idle(cam, t, out, i, o, okey, x, y, z, expr, extra, sc);
};
const easeOutS = (u: number) => 1 - (1 - clamp01(u)) ** 3;
const GS = () => frontGeom(seedP(0));
/** Spencer's coat pocket (front view, stand pose) in the world */
const pocketP = (cam: CamInfo, x: number, z: number, lift = 0.12) => { const g = GS(); return dpos(cam, x, 0, z, 300 - 50 * g.u, g.chin + 1.0 * g.HH - 3 * g.u, 1, lift); };
/** end of Spencer's raised right arm in the shrug pose (screen right) */
const shrugHandP = (cam: CamInfo, x: number, z: number, k: number, lift = 0.1) => {
  const g = GS(), S1 = g.chin + 0.12 * g.HH;
  return dpos(cam, x, 0, z, 300 + 1.45 * g.Ta + 34 * g.u * k, S1 + (0.34 - 0.46 * k) * g.HH, 1, lift);
};
const sv = (out: Stage, r: SR) => out.solids.push(r);
const lip = (a: number, b: number, k: number) => a + (b - a) * k;

const walkS = (cam: CamInfo, t: number, out: Stage) => {
  const x = yardX(t), z = YARD_Z, ph = q(((t * 0.75) % 1 + 1) % 1, 60);
  out.places.push(person(cam, SP(0), x, 0, z, FRONT, { mode: "stroll", phase: ph, expr: "smile_closed", blink: lidAt(t, 0), look: 1 }));
  blob(out, x, 0, z);
  // the bar sticks out of the pocket, stiff at first, sags from "pocket" and drips on "melted"
  const tm = wt(1, "melted"), melt = smooth((t - wt(1, "pocket") + 0.2) / Math.max(1, tm + 0.7 - wt(1, "pocket"))), drip = smooth((t - tm + 0.1) / 0.9);
  const p = pocketP(cam, x, z, 0.14), g = GS();
  sv(out, { k: "choco", x: p[0], y: p[1] + 0.03, z: p[2], cam: true, a: 0.04 + 0.96 * melt, b: drip, c: 1, d: 1, yaw: 0.5, roll: 0.12, s: 1.35 });
  void g;
};
const coinS = (cam: CamInfo, t: number, out: Stage) => {
  const t2 = wt(2, "two"), k = smooth((t - t2 + 0.3) / 0.5), tilt = q(6 * k, 4);
  out.places.push(person(cam, SP(0), SP2[0], 0, SP2[2], FRONT, { mode: "stand", expr: "smile", blink: lidAt(t, 0), shrug: q(k, 20), headTilt: tilt }));
  blob(out, SP2[0], 0, SP2[2]);
  if (k > 0.02) {
    const hp = shrugHandP(cam, SP2[0], SP2[2], k, 0.12), pitch = 0.6, hs = 1.9;
    sv(out, { k: "hand", x: hp[0] + 0.17, y: hp[1] + 0.03, z: hp[2], pitch, a: 0.05, b: 0.1, s: hs });
    const n: V3 = [0, Math.cos(pitch), Math.sin(pitch)], tz: V3 = [0, -Math.sin(pitch), Math.cos(pitch)];
    [0, 1].forEach((i) => {
      const fall = clamp01((t - t2 - i * 0.2) / 0.22), bounce = fall >= 1 ? 0.03 * Math.exp(-(t - t2 - i * 0.2 - 0.22) * 7) * Math.abs(Math.sin((t - t2 - i * 0.2 - 0.22) * 18)) : 0.5 * (1 - fall) ** 2;
      if (t < t2 - 0.02 + i * 0.2) return;
      const off = (i ? 0.062 : -0.062) * hs;
      sv(out, { k: "coin", x: hp[0] + 0.17 + tz[0] * off + n[0] * (0.06 + bounce), y: hp[1] + 0.03 + tz[1] * off + n[1] * (0.06 + bounce), z: hp[2] + tz[2] * off + n[2] * (0.06 + bounce), pitch, s: 1.25 });
    });
  }
};
const gateS = (cam: CamInfo, t: number, out: Stage) => {
  const a = lineStart(3), b = lineEnd(3), u = clamp01((t - a + 0.2) / (b - a - 0.1)), uA = clamp01(u / 0.62), uB = clamp01((u - 0.62) / 0.38);
  const x = -5.4 + 4.9 * uA + 0.6 * smooth(uB), z = -6.6 - 6.2 * smooth(uB);
  const dx = uB > 0 ? 0.6 : 1, dz = uB > 0 ? -6.2 : 0, view = viewOf(cam, x, z, dx, dz), ph = q(((t * 0.9) % 1 + 1) % 1, 60);
  if (z > -12.75) {
    out.places.push(person(cam, SP(0), x, 0, z, view, { mode: "stroll", phase: ph, expr: "smile_closed", blink: lidAt(t, 0), look: 1 }, { mode: "march", phase: ph, expr: "smile_closed", stride: 0.9 * view.fs, stomp: 0.5 }));
    blob(out, x, 0, z);
  }
  bg(cam, t, out, 1, WORKER(1), "w1", 4.4, -7.6, "smile", { facing: -1 });
};
const handS = (cam: CamInfo, t: number, out: Stage) => {
  HAND_X.forEach((x, i) => {
    out.places.push(person(cam, { i: 10 + i, o: WORKER(i), okey: `w${i % 6}` }, x, 0, -3.1, FRONT, { mode: "stand", expr: i % 2 ? "neutral" : "tired", prop: ["hammer", strike(t, 2.2, i * 0.31)], blink: lidAt(t, 10 + i), facing: 0, tired: 0.2 }));
    blob(out, x, 0, -3.1);
  });
};
const lineS = (cam: CamInfo, t: number, out: Stage) => {
  let i = 0;
  for (const x of [12.45, 15.55]) for (const z of [2, -1, -4, -7, -10, -13]) {
    i++;
    out.places.push(person(cam, { i: 20 + i, o: WORKER(i), okey: `w${i % 6}` }, x, 0, z, FRONT, { mode: "stand", expr: i % 2 ? "grin" : "smile_closed", prop: ["hammer", strike(t, 0.55, i * 0.13)], blink: lidAt(t, 20 + i), facing: (x < 14 ? 1 : -1) as -1 | 1 }));
    blob(out, x, 0, z, 1, 1, cam.pos.distanceTo(tmp.set(x, 0, z)) > 14);
  }
};
const cheerS = (cam: CamInfo, t: number, out: Stage) => {
  out.places.push(person(cam, SP(0), SP_CHEER[0], 0, SP_CHEER[2], FRONT, { mode: "stand", expr: "smile_closed", blink: lidAt(t, 0), facing: -1 })); blob(out, SP_CHEER[0], 0, SP_CHEER[2]);
  out.places.push(person(cam, { i: 7, o: BOSS, okey: "boss" }, BOSS_CHEER[0], 0, BOSS_CHEER[2], FRONT, { mode: "stand", expr: "grin", facing: 1, blink: lidAt(t, 7) })); blob(out, BOSS_CHEER[0], 0, BOSS_CHEER[2]);
  // the boss's hand pats Spencer's shoulder
  const g = GS(), pat = Math.abs(Math.sin(t * 7.5)), sp = dpos(cam, SP_CHEER[0], 0, SP_CHEER[2], 300 - 1.0 * g.Ta, g.chin + 0.08 * g.HH, 1, 0.12);
  sv(out, { k: "hand", x: sp[0] - 0.05, y: sp[1] + 0.14 - 0.06 * pat, z: sp[2], cam: true, pitch: -Math.PI / 2, post: -0.85, a: 0.2, b: 0.34, d: 1, s: 1.7 });
  const cheerers: [number, number][] = [[7.2, -0.6], [8.5, -2.2], [11.9, -0.9], [12.8, -2.3], [10.3, -3.3], [6.4, 0.6]];
  cheerers.forEach(([x, z], i) => dancer(cam, t, out, 30 + i, x, 0, z, WORKER(i + 2), `w${(i + 2) % 6}`, { hz: 2.2, expr: i % 2 ? "laugh" : "grin", energy: 1, lite: false }));
  for (let i = 0; i < 30; i++) {
    const ph = ((t * (0.5 + 0.25 * hh(i, 1)) + hh(i, 2)) % 1 + 1) % 1;
    sv(out, { k: "conf", x: 9.9 + (hh(i, 3) - 0.5) * 3.6 + 0.2 * Math.sin(t * 3 + i), y: 3.6 - ph * 3.6, z: 1.0 + (hh(i, 4) - 0.5) * 2.4, pitch: t * (2 + hh(i, 5) * 3) + i, roll: t * 3 + i * 2, yaw: i, s: 1 });
  }
};
const gooS = (cam: CamInfo, t: number, out: Stage) => {
  const tc = wt(7, "chocolate"), tg = wt(7, "goo"), melt = smooth((t - tc) / Math.max(0.8, tg - tc + 0.5)), drip = smooth((t - wt(7, "turns") + 0.1) / Math.max(0.6, tg - wt(7, "turns") + 0.5));
  const goo = 0.9 * smooth((t - wt(7, "turns")) / Math.max(0.8, tg - wt(7, "turns") + 0.8));
  const expr: Expr = t > tg ? "pained" : "smile";
  out.places.push(person(cam, SP(goo), SP7[0], 0, SP7[2], FRONT, { mode: "stand", expr, blink: lidAt(t, 0), facing: -1 })); blob(out, SP7[0], 0, SP7[2]);
  const p = pocketP(cam, SP7[0], SP7[2], 0.14);
  sv(out, { k: "choco", x: p[0], y: p[1] + 0.03, z: p[2], cam: true, a: 0.04 + 0.96 * melt, b: drip, c: 1, d: -1, yaw: 0.5, roll: -0.12, s: 1.3 });
  const u = q((t * 0.9) % 1, 20);
  fxp(out, `wv${u}`, 500, 300, (pn) => fxWaves(pn, u), MAG[0] + 0.62, MAG[1] + 0.45, MAG[2] + 0.3, 1.1, 0.66, { soft: false });
};
const sadS = (cam: CamInfo, t: number, out: Stage) => {
  const tr = wt(8, "ruined"), tc = wt(8, "curious") - 0.25;
  const expr: Expr = t > tc ? "relief_open" : "sad";
  const g = GS(), hx = 300 + 0.5 * g.Ta, hy = g.chin + 0.12 * g.HH + 0.4 * g.HH;
  out.places.push(person(cam, SP(0.6), SP2[0], 0, SP2[2], FRONT, { mode: "stand", expr, blink: lidAt(t, 0), prop: "hold", headTilt: t > tc ? q(5, 4) : 0 })); blob(out, SP2[0], 0, SP2[2]);
  const p = dpos(cam, SP2[0], 0, SP2[2], hx, hy, 1, 0.1), sw = 0.05 * Math.sin(t * 2.2);
  sv(out, { k: "choco", x: p[0], y: p[1] + 0.02, z: p[2], cam: true, a: 1, b: 0.8 + 0.2 * Math.sin(t * 2), c: 0, d: 1, yaw: 0.3, roll: Math.PI + sw, i: 0.34, s: 1 });
  if (t > tc) {
    const k = easeOutS((t - tc) / 0.25), u = 1 + 0.06 * Math.sin(t * 9), hp = dpos(cam, SP2[0], 0, SP2[2], 300, g.hc - 0.2 * g.HH, 1, 0.1);
    sv(out, { k: "bulb", x: hp[0], y: hp[1] + 0.78, z: hp[2], cam: true, s: 1.5 * k * u });
  }
};
const popS = (cam: CamInfo, t: number, out: Stage) => {
  const tp = wt(9, "popped") - 0.04, tk = wt(9, "kernels");
  out.places.push(person(cam, SP(0), SP9[0], 0, SP9[2], FRONT, { mode: "stand", expr: t > tp + 0.2 ? "grin" : "smile", blink: lidAt(t, 0), facing: -1 })); blob(out, SP9[0], 0, SP9[2]);
  sv(out, { k: "bowl", x: BOWL[0] - 0.15, y: BOWL[1], z: BOWL[2] + 0.1, s: 1.15 });
  for (let i = 0; i < 14; i++) {
    const rx = 2.45 + (hh(i, 1) * 0.55), rz = -2.75 + hh(i, 2) * 0.55, tpi = tp + i * 0.05, dt = t - tpi;
    const shake = t > tk - 0.1 && dt < 0 ? 0.012 * Math.sin(t * 70 + i) : 0, rest = BOWL[1] + 0.03;
    if (dt < 0) sv(out, { k: "kernel", x: rx + shake, y: rest, z: rz, s: 0.065, a: 0, yaw: i, pitch: 0.3 });
    else {
      const u = clamp01(dt / 0.75), hgt = 0.55 * Math.sin(Math.PI * Math.min(1, u)) * (0.7 + 0.5 * hh(i, 3)), sc = 0.065 + 0.055 * easeOutS(dt / 0.12);
      sv(out, { k: "kernel", x: rx + (hh(i, 4) - 0.5) * 0.5 * u, y: rest + hgt + (u >= 1 ? 0.01 : 0), z: rz + (hh(i, 5) - 0.5) * 0.2 * u, s: sc, a: 1, yaw: i + dt * 4, pitch: dt * 6 * (u < 1 ? 1 : 0) });
    }
  }
};
const eggS = (cam: CamInfo, t: number, out: Stage) => {
  const tb = tEggBurst(), post = t > tb, tl = tb + 0.72;
  out.places.push(person(cam, SP(0), 3.8, 0, -2.2, FRONT, { mode: "stand", expr: post ? "pained" : "smile", blink: lidAt(t, 0), facing: -1 })); blob(out, 3.8, 0, -2.2);
  const hop = post ? 0.04 * Math.exp(-(t - tb) * 4) * Math.abs(Math.sin((t - tb) * 12)) : 0;
  const hit = t > tl;
  out.places.push(person(cam, { i: 2, o: COWORKER, okey: "cw" }, CW_BENCH[0], hop, CW_BENCH[2], FRONT, { mode: "stand", expr: hit ? "dazed" : "nervous", blink: lidAt(t, 2), facing: 1, headTilt: hit ? q(-6, 4) : 0 }));
  blob(out, CW_BENCH[0], 0, CW_BENCH[2]);
  const g = GS(), fy = (975 - frontGeom(seedP(2)).hc) * SU, face = toward(cam, [CW_BENCH[0], fy, CW_BENCH[2]], 0.2);
  if (t > tEggStart() && !post) {
    const k = smooth((t - tEggSwell()) / Math.max(0.3, tb - tEggSwell())), sh = k * 0.012 * Math.sin(t * 70), s = 0.13 * (1 + 0.55 * k);
    sv(out, { k: "egg", x: EGG[0] + sh, y: 0.97 + 0.146 * (s / 0.13), z: EGG[2], s, roll: 0.1 * k * Math.sin(t * 50) });
  }
  if (post) {
    const dt = t - tb;
    if (dt < 1.4) {
      for (let i = 0; i < 2; i++) sv(out, { k: "shell", x: EGG[0] + (i ? 0.5 : -0.4) * dt, y: 1.1 + 1.6 * dt - 4.6 * dt * dt + 0.1, z: EGG[2] + 0.3 * dt, s: 1.6, pitch: dt * 6 + i * 3, roll: dt * 5 });
      for (let i = 0; i < 8; i++) { const a = i * 0.8 + 0.3; sv(out, { k: "shard", x: EGG[0] + Math.cos(a) * 1.3 * dt, y: 1.15 + (1.5 + 0.7 * Math.sin(a * 2)) * dt - 4.6 * dt * dt, z: EGG[2] + Math.sin(a) * 0.5 * dt + 0.2, pitch: dt * 8 + i, roll: dt * 7, s: 1.2 }); }
    }
    const fl = clamp01(dt / 0.72);
    if (fl < 1) {
      const ex = lip(EGG[0], face[0], fl), ez = lip(EGG[2], face[2], fl), ey = lip(1.1, face[1], fl) + 0.35 * Math.sin(Math.PI * fl);
      sv(out, { k: "globY", x: ex, y: ey, z: ez, s: 1.5 });
      for (let i = 0; i < 4; i++) { const f2 = clamp01((dt - 0.03 * i) / 0.72); sv(out, { k: "globW", x: lip(EGG[0], face[0] + 0.08 * (i - 1.5), f2), y: lip(1.1, face[1] + 0.06 * (i % 2), f2) + 0.28 * Math.sin(Math.PI * f2) + 0.04 * i, z: lip(EGG[2], face[2], f2), s: 1.2 }); }
    }
  }
  if (hit) {
    const k = easeOutS((t - tl) / 0.15);
    sv(out, { k: "splat", x: face[0], y: face[1] - 0.1 - 0.015 * Math.sin((t - tl) * 3), z: face[2], cam: true, s: 1.25 * k, a: smooth((t - tl) / 1.5) });
  }
  void g;
};
const ponderS = (cam: CamInfo, t: number, out: Stage) => {
  const tw = wt(11, "what");
  out.places.push(person(cam, SP(0), SP11[0], 0, SP11[2], FRONT, { mode: "stand", expr: t > tw - 0.25 ? "nervous" : "neutral", blink: lidAt(t, 0), headTilt: q(7 * Math.sin(t * 1.3) + (t > tw ? 4 : 0), 4), facing: 1 })); blob(out, SP11[0], 0, SP11[2]);
  const k = easeOutS((t - tw + 0.12) / 0.22), g = GS(), hp = dpos(cam, SP11[0], 0, SP11[2], 300, g.hc - 0.4 * g.HH, 1, 0.1);
  if (k > 0) sv(out, { k: "qmark", x: hp[0] + 0.45, y: hp[1] + 0.15 + 0.03 * Math.sin(t * 3), z: hp[2], cam: true, s: 2.3 * k, roll: 0.15 * Math.sin(t * 2.6) });
};
const molecS = (cam: CamInfo, t: number, out: Stage) => {
  const tw = wt(12, "wiggles"), th = wt(12, "heat"), tr = wt(12, "rubbing");
  const A = 0.006 + 0.05 * smooth((t - tw) / 0.9) * (1 + 0.5 * smooth((t - th) / 2));
  const warm = t > th, ga = q(0.9 * smooth((t - th) / 1.6), 8);
  const tmol = wt(12, "water") - 0.3;
  for (let i = 0; i < 24; i++) {
    if (t < tmol) break;
    const col = i % 6, row = Math.floor(i / 6), bx0 = CHUNK[0] + (col - 2.5) * 0.265 + (hh(i, 1) - 0.5) * 0.1, by0 = CHUNK[1] + (row - 1.5) * 0.28 + (hh(i, 2) - 0.5) * 0.1;
    const pop = easeOutS((t - tmol - i * 0.02) / 0.3);
    const dx = A * Math.sin(t * (17 + 5 * hh(i, 4)) + i), dy = A * Math.cos(t * (19 + 4 * hh(i, 5)) + i * 2);
    sv(out, { k: "mol", i, b: warm ? 1 : 0, x: bx0 + dx, y: by0 + dy, z: CHUNK[2] + 0.56, cam: true, s: 0.62 * pop, roll: 0.5 * (A / 0.06) * Math.sin(t * 15 + i) + hh(i, 6) * 6 });
  }
  if (t > wt(12, "blasts") - 0.1) {
    const u = q((t * 0.9) % 1, 20);
    fxp(out, `wv${u}`, 500, 300, (p) => fxWaves(p, u), MAG12[0] + 0.55, MAG12[1] + 0.5, MAG12[2] + 0.4, 1.1, 0.66, { rot: 0.62 });
  }
  if (ga > 0) fxp(out, `glow${ga}`, 256, 256, (p) => fxGlowDisc(p, "255,150,60", ga), CHUNK[0], CHUNK[1], CHUNK[2] - 0.45, 3.6, 3.2, { soft: true });
  if (t > tr - 0.4) {
    const k = clamp01((t - tr + 0.4) / 0.35), off = 0.1 * Math.sin(t * 13) * smooth((t - tr) / 0.3), sc = 1.9 * easeOutS(k);
    sv(out, { k: "hand", x: HANDS12[0] + 0.05 * sc, y: HANDS12[1] + off, z: HANDS12[2], cam: true, roll: Math.PI / 2, a: 0.05, b: 0.5, s: sc });
    sv(out, { k: "hand", x: HANDS12[0] - 0.05 * sc, y: HANDS12[1] - off, z: HANDS12[2], cam: true, roll: Math.PI / 2, yaw: Math.PI, a: 0.05, b: 0.5, s: sc });
    const ha = q(0.8 * smooth((t - tr) / 1.2), 8);
    if (ha > 0) fxp(out, `glow${ha}`, 256, 256, (p) => fxGlowDisc(p, "255,150,60", ha), HANDS12[0], HANDS12[1] + 0.2, HANDS12[2] - 0.4, 2.8, 2.6, { soft: true });
  }
};
const radarS = (cam: CamInfo, t: number, out: Stage) => {
  bg(cam, t, out, 40, WORKER(2), "w2", 1.75, -0.4, "smile", { facing: -1 }, 0, 0.5);
  bg(cam, t, out, 41, WORKER(5), "w5", -1.55, 0.0, "neutral", { facing: 1, prop: "clipboard" }, 0, 0.5);
  // six feet: a measuring pole beside the cabinet, ticks pop on one by one
  const t6 = wt(13, "six");
  if (t > t6 - 0.2) sv(out, { k: "ruler", x: -2.45, y: 0, z: -1.2, a: Math.min(6, Math.floor((t - t6) / 0.13) + 1), s: 1 });
  // 750 pounds: the cabinet stands on a platform scale whose needle swings all the way round
  const ts = wt(13, "seven", 0), tp = wt(13, "pounds");
  sv(out, { k: "wscale", x: RANGE[0], y: 0, z: RANGE[2] });
  const ang = -(smooth((t - ts) / Math.max(0.5, tp - ts + 0.1)) * 5.0) + 0.05 * Math.sin(t * 25) * smooth((t - tp) / 0.2);
  sv(out, { k: "needle", x: RANGE[0] + 1.4, y: 1.35, z: RANGE[2] + 0.32, roll: ang, s: 1 });
  // water cooling: blue drops run up the copper pipes
  const tw = wt(13, "water") - 0.1;
  if (t > tw) for (let i = 0; i < 7; i++) { const ph = (((t - tw) * 0.5 + i / 7) % 1 + 1) % 1; sv(out, { k: "drop", x: RANGE[0] + 0.72, y: 0.4 + ph * 3.6, z: RANGE[2] - 0.5, s: 1.6 }); }
  // five thousand dollars: a tower of coins grows
  const t5 = wt(13, "five"), n = Math.floor(40 * smooth((t - t5) / (wt(13, "dollars") - t5 + 0.1)));
  for (let i = 0; i < n; i++) sv(out, { k: "coin", x: 2.2 + 0.01 * Math.sin(i * 2), y: 0.04 + i * 0.045, z: -0.8, s: 1.8, yaw: i });
};
const stuckS = (cam: CamInfo, t: number, out: Stage) => {
  const pose = (k: number) => q(0.5 + 0.5 * Math.sin(t * 5 + k), 10);
  [[-3.0, -1.2, 0], [-2.55, -1.95, 1]].forEach(([x, z, k]) => {
    out.places.push(person(cam, { i: 50 + k, o: MOVER(k), okey: `mv${k}` }, x, 0, z, { side: true, mirror: true }, {}, { mode: "push", pose: pose(k), expr: "pained", blink: lidAt(t, 50 + k) }));
    blob(out, x, 0, z);
    const u = q((t * 1.6 + k * 0.4) % 1, 20);
    fxp(out, `sw${u}`, 300, 300, (p) => fxSweat(p, u), x + 0.1, 1.75, z + 0.1, 1.0, 1.0);
  });
  if (t > wt(14, "fit") - 0.3) { const k = easeOutS((t - wt(14, "fit") + 0.3) / 0.25); sv(out, { k: "cross", x: -2.7, y: 2.4, z: DOOR_Z - 0.2, cam: true, s: 1.7 * k }); }
};
const familyS = (cam: CamInfo, t: number, out: Stage) => {
  const b = (k: number) => 0.03 * Math.abs(Math.sin(t * 5 + k));
  const cast: [number, Outfit, string, number, Expr, number][] = [[60, MOM, "mom", -0.95, "grin", 1], [61, DAD, "dad", 1.4, "laugh", -1], [62, KIDA, "kidA", -0.45, "laugh", 1], [63, KIDB, "kidB", 0.95, "grin", -1]];
  cast.forEach(([i, o, key, x, ex, fc]) => { idle(cam, t, out, i, o, key, x, b(i), -1.0, ex, { facing: fc as -1 | 1 }); });
  fxp(out, "kglow", 256, 256, (p) => fxGlowDisc(p, "255,170,70", 0.9), KMW[0], KMW[1] + 0.3, KMW[2] - 0.2, 2.4, 2.0, { soft: true });
  // popcorn pops out of the microwave top
  for (let i = 0; i < 5; i++) {
    const per = 1.2, ph = ((t + i * 0.37) % per) / per, x = KMW[0] + (hh(i, 1) - 0.5) * 0.4 + (ph - 0.5) * 0.4 * (i % 2 ? 1 : -1), y = KMW[1] + 0.6 + 0.8 * Math.sin(Math.PI * ph);
    sv(out, { k: "kernel", x, y, z: KMW[2] + 0.05, s: 0.07, a: 1, yaw: t * 3 + i, pitch: t * 4 + i });
  }
};
const podiumS = (cam: CamInfo, t: number, out: Stage) => {
  if (t > lineEnd(16) - 1.6) for (let i = 0; i < 20; i++) { const ph = ((t * (0.5 + 0.2 * hh(i, 1)) + hh(i, 2)) % 1 + 1) % 1; sv(out, { k: "conf", x: -1.3 + (hh(i, 3) - 0.5) * 4.5, y: 4.4 - ph * 4.0, z: -1.2 + (hh(i, 4) - 0.5) * 2, pitch: t * 3 + i, roll: t * 2 + i * 2, s: 1.4 }); }
  void cam; void out;
};
const deskS = (cam: CamInfo, t: number, out: Stage) => {
  const SPX = -0.55, BX = 1.25, Z = -2.0, tg = wt(18, "got"), t2 = wt(18, "two"), tb = wt(18, "bonus");
  const k = smooth((t - tb - 0.15) / 0.5);
  out.places.push(person(cam, SP(0), SPX, 0, Z, FRONT, { mode: "stand", expr: "smile", blink: lidAt(t, 0), shrug: q(k, 20), headTilt: q(5 * k, 4), facing: 1 })); blob(out, SPX, 0, Z);
  out.places.push(person(cam, { i: 7, o: BOSS, okey: "boss" }, BX, 0, Z, FRONT, { mode: "stand", expr: "smile_closed", facing: -1, blink: lidAt(t, 7) })); blob(out, BX, 0, Z);
  const hp = shrugHandP(cam, SPX, Z, Math.max(k, 0.0001), 0.12), hs = 1.5;
  // boss's hand holds the envelope out; after "bonus" it rests in Spencer's raised palm
  const give = smooth((t - tb - 0.5) / 0.5), bossX = 0.42, bossY = 1.0;
  if (t > tg - 0.2 && give < 1) sv(out, { k: "hand", x: bossX + 0.0, y: bossY - 0.02, z: Z + 0.5, pitch: 0.4, yaw: Math.PI, a: 0.1, b: 0.7, d: 1, s: hs });
  if (k > 0.02) sv(out, { k: "hand", x: hp[0] + 0.14, y: hp[1] + 0.03, z: hp[2], pitch: 0.6, a: 0.05, b: 0.12, s: hs });
  const ex = lip(bossX - 0.1, hp[0] + 0.14, give), ey = lip(bossY + 0.03, hp[1] + 0.07, give), ez = lip(Z + 0.5, hp[2], give);
  if (t > tg - 0.2) sv(out, { k: "env", x: ex, y: ey, z: ez, pitch: 0.4 * (1 - give) + 0.6 * give, yaw: 0.3 * (1 - give), s: 1.1 });
  if (t > t2 - 0.05) {
    const fall = clamp01((t - t2) / 0.25);
    sv(out, { k: "coin", x: ex, y: ey + 0.04 + 0.4 * (1 - fall) ** 2 + 0.02, z: ez, pitch: 0.4 * (1 - give) + 0.6 * give, yaw: 0, s: 1.1 });
  }
};
const meltS = (cam: CamInfo, t: number, out: Stage) => {
  sv(out, { k: "puddle", x: MELT19[0] - 0.12, y: MELT19[1], z: MELT19[2], s: 1.25, yaw: 0.3 });
  sv(out, { k: "choco", x: MELT19[0] + 0.2, y: MELT19[1] + 0.035, z: MELT19[2] + 0.02, pitch: 1, i: Math.PI / 2, a: 1, b: 0, d: 1, s: 1 });
  for (const [dx, dy, dz, sc, off] of [[-0.25, 0.25, 0.0, 0.8, 0], [0.02, 0.15, 0.1, 0.55, 0.5]] as const) {
    const u = ((t * 0.5 + off) % 1 + 1) % 1;
    sv(out, { k: "smoke", x: MELT19[0] + dx + 0.04 * Math.sin(t * 2 + off * 6), y: MELT19[1] + dy + u * 0.4, z: MELT19[2] + dz + 0.1, s: sc * (0.6 + 0.8 * u) * (1 - 0.4 * u * u) });
  }
  void cam;
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [], solids: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light; SUN = cam.sun.clone().normalize();
  void f;
  switch (s.crowd) {
    case "walk": walkS(cam, t, out); break;
    case "coin": coinS(cam, t, out); break;
    case "gate": gateS(cam, t, out); break;
    case "hand": handS(cam, t, out); break;
    case "line": lineS(cam, t, out); break;
    case "cheer": cheerS(cam, t, out); break;
    case "goo": gooS(cam, t, out); break;
    case "sad": sadS(cam, t, out); break;
    case "pop": popS(cam, t, out); break;
    case "egg": eggS(cam, t, out); break;
    case "ponder": ponderS(cam, t, out); break;
    case "molec": molecS(cam, t, out); break;
    case "radar": radarS(cam, t, out); break;
    case "stuck": stuckS(cam, t, out); break;
    case "family": familyS(cam, t, out); break;
    case "podium": podiumS(cam, t, out); break;
    case "dusk": break;
    case "desk": deskS(cam, t, out); break;
    case "melt": meltS(cam, t, out); break;
  }
  return out;
};
export { FPS, fxBurst };
void lineStart; void fxPuff; void toward; void KMW; void MAG12; void CHUNK;
