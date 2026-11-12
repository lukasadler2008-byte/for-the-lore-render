// The Pisa cast as lit flat sprites in the 3D world (same machinery as the bridge short): every character asks for a
// drawing (key + draw call) each frame; the pool keeps one canvas per distinct drawing. Characters are yaw-only
// billboards shaded by cardShade(); standing ones get a contact blob (+ a sun-direction tail by day). Effects are
// unlit cards. Cards, effects and blobs live on the NOINK layer so the world ink never outlines their quads.
// Roles: Beppe the mason (coif, leather apron) and his grandson (same face, red cap), masons, Pisan soldiers (red,
// white cross) vs Lucca (white over red), the 1990 official, engineers (hard hats, hi-vis), tourists, a bus commuter.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, SKINS, fxBurst, fxShadow, fxContact, fxPuff, Outfit, Expr, FrontOpts, SideOpts, Prop, frontGeom } from "./toon";
import { fxGlowDisc, fxBulb } from "./fxd";
import { panTop } from "./solids";
import * as ST from "./story";
import { FPS, SHOTS, V3, clamp01, smooth, Light } from "./story";
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

// =====================================================================================================================
// The Musk cast and the 18 scenes (one function per voice line; `sub` is the sub-shot index inside the line)
// =====================================================================================================================
// The pizza cast and the 16 scenes (one function per voice line; `sub` is the sub-shot index inside the line)
// =====================================================================================================================
const { wt, lineStart } = ST;
const sv = (out: Stage, r: SR) => out.solids.push(r);
const lip = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOutS = (u: number) => 1 - (1 - clamp01(u)) ** 3;
type Pose = { expr: Expr } & Partial<FrontOpts>;
const ch = (cam: CamInfo, t: number, out: Stage, who: Outfit, key: string, i: number, x: number, y: number, z: number, pose: Pose, sc = 1) => {
  const { expr, ...extra } = pose;
  idle(cam, t, out, i, who, key, x, y, z, expr, extra, sc);
};
const soft = (out: Stage, rgb: string, a: number, x: number, y: number, z: number, w: number, h = w) => { const qa = q(a, 20); if (qa > 0) fxp(out, `gl${rgb}${qa}`, 256, 256, (p) => fxGlowDisc(p, rgb, qa), x, y, z, w, h, { soft: true }); };
const qmark = (out: Stage, t: number, x: number, y: number, z: number, s = 2.4) => sv(out, { k: "qmark", x, y, z, cam: true, s: s * (1 + 0.1 * Math.sin(t * 8)), roll: 0.15 * Math.sin(t * 2.6) });
const bulb = 0;

// ---------------- troy cast ----------------
const { lineEnd } = ST;
const GREEK: Outfit = { jacket: "#b8382f", pants: "#7a5a3a", boots: "#4a3a2a", hat: "kettle", skin: SKINS[1], sword: true };
const TROJ = (v: number): Outfit => ({ jacket: ["#3f6fb5", "#e8e0c8", "#7a52b8", "#3f86e0", "#d9a63a"][v % 5], pants: ["#5a4a3a", "#4a4038", "#6a5a44"][v % 3], boots: "#3a2c22",
  hat: ["hair", "cap", "hair", "hair"][v % 4], hair: ["#3a2a22", "#1c130e", "#8a4a2a", "#6a4a30"][v % 4], cap: "#3f6fb5", skin: SKINS[v % 4], build: v % 5 === 3 ? "stout" : "adult" });
const PRIEST: Outfit = { jacket: "#f4f0e6", pants: "#d9d0b8", boots: "#8a6a44", hat: "coif", cap: "#7a52b8", skin: SKINS[2], moustache: "#8a8a8a", build: "stout" };
const SINON: Outfit = { jacket: "#4a8a5a", pants: "#6a4a30", boots: "#3a2c22", hat: "hair", hair: "#3a2a22", moustache: "#3a2a22", skin: SKINS[1] };
const HOMER: Outfit = { jacket: "#e8e0c8", pants: "#c9b88a", boots: "#6a4a30", hat: "hair", hair: "#e8e4dc", moustache: "#e8e4dc", skin: SKINS[0] };
const VIRGIL: Outfit = { jacket: "#efe6d2", pants: "#8a5aa8", boots: "#5a3a22", hat: "hair", hair: "#3a2a22", moustache: "#3a2a22", skin: SKINS[1], sash: "#7a3a8a" };
const POSEIDON: Outfit = { jacket: "#2f8fb0", pants: "#1f6a8a", boots: "#cfeaf0", hat: "hair", hair: "#cfeaf0", moustache: "#cfeaf0", skin: SKINS[0], build: "stout" };
const DIGGER: Outfit = { jacket: "#c9a46a", pants: "#6a5a44", boots: "#3a2c22", hat: "hardhat", cap: "#f2c230", skin: SKINS[2] };
const BOSS: Outfit = { jacket: "#3f8a6a", pants: "#4a4038", boots: "#3a2c22", hat: "hardhat", cap: "#e8e8f0", skin: SKINS[0], moustache: "#6a4a30" };
const gk = (cam: CamInfo, t: number, out: Stage, i: number, x: number, y: number, z: number, expr: Expr, extra: Partial<FrontOpts> = {}, sc = 1) => ch(cam, t, out, GREEK, "greek", 10 + i, x, y, z, { expr, shield: ["#b8382f", "#e8c45a", "cross"], ...extra }, sc);
const tj = (cam: CamInfo, t: number, out: Stage, i: number, x: number, y: number, z: number, expr: Expr, extra: Partial<FrontOpts> = {}, sc = 1) => ch(cam, t, out, TROJ(i), "troj" + (i % 5), 30 + i, x, y, z, { expr, ...extra }, sc);
const ST_ = ST;
const hz = (n: number) => hh(n, 7);
const horse = (out: Stage, z: number, a = 0, s = ST.HORSE_S, x = 0, yaw = 0) => sv(out, { k: "horse", x, y: 0, z, s, yaw, a });
const dust = (out: Stage, t: number, x: number, z: number, n = 4, sp = 1) => { for (let i = 0; i < n; i++) { const ph = ((t * 0.7 * sp + i / n) % 1 + 1) % 1; sv(out, { k: "smoke", x: x + (i - n / 2) * 0.5 + 0.4 * Math.sin(t * 2 + i), y: 0.25 + ph * 1.2, z, s: 0.25 + ph * 0.5 }); } };
const fire = (out: Stage, t: number, x: number, y: number, z: number, L = 2) => { sv(out, { k: "fire", x, y, z, s: 1, a: L, b: t * 7 + x }); };
const smokeCol = (out: Stage, t: number, x: number, y0: number, z: number, n = 6, s0 = 1.2) => { for (let i = 0; i < n; i++) { const ph = ((t * 0.18 + i / n) % 1 + 1) % 1; sv(out, { k: "dsmoke", x: x + 4 * ph * Math.sin(1.7 + x), y: y0 + ph * 26, z, s: s0 * (0.8 + ph * 2.6) }); } };
const torch = (out: Stage, t: number, x: number, y: number, z: number, hold = true) => { sv(out, { k: "torch", x, y, z, s: 1, b: t + x }); soft(out, "255,150,60", 0.5, x, y + 1.0, z, 2.4); void hold; };
const crowdLine = (cam: CamInfo, t: number, out: Stage, n: number, cx: number, cz: number, w: number, expr: Expr, extra: Partial<FrontOpts> = {}, sc = 1) => { for (let i = 0; i < n; i++) { const x = cx + (i / Math.max(1, n - 1) - 0.5) * w, z = cz + 1.0 * Math.sin(i * 2.3); tj(cam, t, out, i, x, 0, z, i % 3 === 1 ? "laugh" : expr, { wave: 0, ...extra }, sc); } };
const horseZ6 = (t: number) => { const t0 = wt(6, "drag"), t1 = lineEnd(6) + 0.3; return -6 - 20 * smooth((t - t0) / (t1 - t0)); };
const GATE_OPEN = (t: number) => 1.35 * smooth((t - wt(7, "open")) / 1.4);
const ropes = (out: Stage, zh: number, pz: number, n = 4) => { for (let i = 0; i < n; i++) { const sx = (i - (n - 1) / 2); sv(out, { k: "rope", x: sx * 0.35, y: 0.55, z: zh - 2.2, a: sx * 1.0, b: 1.1, c: pz - (i % 2) * 1.3 }); } };
const pullers = (cam: CamInfo, t: number, out: Stage, zh: number, n = 6, strain = 1) => {
  const pz = zh - 2.2 - 3.4;
  for (let i = 0; i < n; i++) { const sx = (i - (n - 1) / 2) * 1.1, z = pz - (i % 2) * 1.3; tj(cam, t, out, i + 1, sx, 0, z, strain ? "pained" : "grin", { mode: "march", phase: q((t * 0.9 + i * 0.17) % 1, 10), tilt: 0.12 * strain }); }
  ropes(out, zh, pz, Math.min(n, 5));
};
const sentries = (cam: CamInfo, t: number, out: Stage, expr: Expr = "curious") => { for (const x of [-9, -5, 5, 9]) tj(cam, t, out, Math.abs(x) + 2, x, 9.5, -22.2, expr, {}, 1); };

// ---------------- Pompeii cast ----------------
const ROMAN = (v: number): Outfit => ({ jacket: ["#efe6d2", "#c9a46a", "#b8382f", "#e8e0c8", "#7a52b8", "#4a8a5a"][v % 6], pants: ["#d9d0b8", "#8a6a44", "#6a4a30"][v % 3], boots: "#6a4a30",
  hat: "hair", hair: ["#3a2a22", "#1c130e", "#8a4a2a", "#6a4a30"][v % 4], skin: SKINS[v % 4], build: v % 5 === 3 ? "stout" : "adult", sash: v % 2 ? "#8a2a2a" : undefined });
const rm = (cam: CamInfo, t: number, out: Stage, i: number, x: number, y: number, z: number, expr: Expr, extra: Partial<FrontOpts> = {}, sc = 1) => ch(cam, t, out, ROMAN(i), "rom" + (i % 6), 40 + i, x, y, z, { expr, ...extra }, sc);
const CRATER: V3 = [0, 210, -420];
const SLOPE = Math.hypot(231, 210);
const pathAt = (d: number) => (d <= SLOPE ? { y: 210 - (d * 210) / SLOPE, z: -386 + (d * 231) / SLOPE, slope: true } : { y: 0, z: -155 + (d - SLOPE), slope: false });
const waveD = (t: number) => Math.max(0, 74 * (t - wt(8, "wave")));
const strollZ = (z0: number, dir: number, t: number) => ((((z0 + dir * 0.9 * t + 30) % 60) + 60) % 60) - 30;
const walker = (cam: CamInfo, t: number, out: Stage, i: number, x: number, z0: number, dir: number, expr: Expr, extra: Partial<FrontOpts> = {}) =>
  rm(cam, t, out, i, x, 0, strollZ(z0, dir, t), expr, { mode: "stroll", phase: q((t * 0.8 + i * 0.3) % 1, 10), ...extra });
const market = (cam: CamInfo, t: number, out: Stage, n = 9) => { for (let i = 0; i < n; i++) walker(cam, t, out, i, (i % 2 ? 2.6 : -2.6) + Math.sin(i * 2.3) * 1.2, -26 + i * 6.3, i % 3 ? 1 : -1, i % 3 === 1 ? "laugh" : "smile"); };
const wisp = (out: Stage, t: number, n = 6, big = 1) => { for (let i = 0; i < n; i++) { const ph = (((t * 0.05 + i / n) % 1) + 1) % 1; sv(out, { k: "smoke", x: 2 * Math.sin(i * 2.1 + t * 0.3), y: 216 + ph * 90, z: -420 + Math.cos(i * 1.7) * 3, s: (7 + ph * 20) * big }); } };
const plume = (out: Stage, t: number, tb: number) => {
  const k = clamp01((t - tb) / 7), H = 210 + 520 * easeOutS(k);
  if (t < tb) return;
  for (let i = 0; i < 16; i++) { const u = i / 15, y = 218 + u * (H - 218); sv(out, { k: "ash", x: Math.sin(i * 1.9 + t * 0.25) * (8 + u * 40), y, z: -420 + Math.cos(i * 2.3 + t * 0.2) * (8 + u * 25), s: 36 + u * 40 + 5 * Math.sin(t * 0.8 + i), yaw: i + t * 0.1 }); }
  if (k > 0.5) for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; sv(out, { k: "ash", x: Math.cos(a) * 110 * k, y: H - 15 + 10 * Math.sin(i), z: -420 + Math.sin(a) * 70, s: 70, yaw: a }); }
  for (let i = 0; i < 8; i++) { const ph = (((t * 0.5 + i / 8) % 1) + 1) % 1; sv(out, { k: "ashO", x: Math.sin(i * 2.7) * 28, y: 215 + ph * 160 * Math.max(0.2, k), z: -420 + Math.cos(i * 1.3) * 18, s: 20 * (1 - ph * 0.5) + 8 }); }
  soft(out, "255,130,50", 0.9 * Math.min(1, k * 3), 0, 240, -410, 240);
};
const lavaStreaks = (out: Stage, t: number, tb: number) => {
  const k = clamp01((t - tb) / 3);
  for (let i = 0; i < 10; i++) { const d = 25 + (i % 5) * 55, rr = 34 + (d * 231) / SLOPE, x = (hh(i, 2) - 0.5) * 100, zz = Math.sqrt(Math.max(1, rr * rr - x * x)), phi = Math.atan2(x, zz);
    sv(out, { k: "lava", x, y: 210 - ((rr - 34) * 210) / 231 + 1.2, z: -420 + zz + 1.0, yaw: phi, pitch: 0.738, a: (50 + 40 * hh(i, 4)) * k, b: 5 + 4 * hh(i, 5) }); }
};
const wave = (out: Stage, t: number) => {
  const dF = waveD(t); if (dF <= 0) return;
  for (let i = 0; i < 28; i++) {
    const row = i % 7, back = Math.floor(i / 7) * 24 + hh(i, 2) * 8, d = dF - back; if (d < 0) continue;
    const p = pathAt(d), s = 14 + 8 * hh(i, 3) + back * 0.12, x = (row - 3) * 11 + hh(i, 1) * 4, nz = p.slope ? 0.65 : 0, ny = p.slope ? 0.76 : 1;
    sv(out, { k: i % 3 === 0 ? "ashO" : "ash", x, y: Math.max(s * 0.4, p.y + s * 0.5 * ny), z: p.z + s * 0.5 * nz, s, yaw: i });
  }
  for (let i = 0; i < 8; i++) { const d = dF - hh(i, 6) * 6; if (d < 0) continue; const p = pathAt(d); sv(out, { k: "ashO", x: (i - 3.5) * 11, y: Math.max(4, p.y + 4), z: p.z + 2, s: 10 + 3 * hh(i, 7), yaw: i }); }
  const p0 = pathAt(dF); soft(out, "255,120,40", 0.8, 0, Math.max(6, p0.y + 6), p0.z + 6, 120);
};
const rain = (cam: CamInfo, t: number, out: Stage, kind: string, n: number, size: number, speed: number, spread = 9) => {
  for (let i = 0; i < n; i++) { const fy = (((hh(i, 3) * 12 - t * speed) % 12) + 12) % 12; sv(out, { k: kind, x: cam.pos.x + (hh(i, 1) - 0.5) * spread * 2, y: cam.pos.y - 3 + fy, z: cam.pos.z + (hh(i, 2) - 0.5) * spread * 2 - 6, s: size * (0.6 + hh(i, 5) * 0.8), pitch: t * 3 + i, roll: t * 2 + i * 1.3, yaw: i }); }
};
const lamps = (out: Stage, t: number) => { for (const x of [-5.2, 5.2]) for (const z of [10, -12, -34]) soft(out, "255,170,70", 0.45, x, 2.9, z, 3.2 + 0.2 * Math.sin(t * 9 + z)); };
const TB = () => wt(4, "exploded");
const dig = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const wk: [number, number, number][] = [[-4.5, -2.0, -11.2], [-1.6, -2.0, -9.6], [1.6, -2.0, -11.3], [4.6, -2.0, -9.8]];
  wk.forEach(([x, y, z], i) => ch(cam, t, out, DIGGER, "dig", 7 + i, x, y, z + 0.2 * Math.sin(t * 5 + i), { expr: sub === 3 ? "shock" : i % 2 ? "tired" : "smile", prop: "trowel", wave: 0.3 }));
  for (let i = 0; i < 5; i++) { const ph = ((t * 0.9 + i * 0.21) % 1); sv(out, { k: "spark", x: wk[i % 4][0] + 0.4, y: -0.6 + 1.2 * ph, z: wk[i % 4][2] + 0.5, s: 0.5 * (1 - ph) }); }
  ch(cam, t, out, BOSS, "boss", 9, 0.4, 0, 1.0, { expr: "smile", prop: "clipboard" });
  for (let i = 0; i < 4; i++) ch(cam, t, out, DIGGER, "dig", 20 + i, -9 + i * 5.5, 0, 6.5 + (i % 2) * 2, { expr: "smile", prop: "trowel", mode: "stroll", phase: q((t * 0.7 + i * 0.25) % 1, 10) } as never);
};

// ---- 1 hook ----
const s1 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  wisp(out, t); market(cam, t, out, sub ? 5 : 10);
  if (sub === 1) rm(cam, t, out, 0, 0, 0, 0, "grin", { shrug: 1 });
};
// ---- 2 the 62 AD earthquake ----
const s2 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  wisp(out, t);
  const n = sub ? 14 : 8;
  for (let i = 0; i < n; i++) { const x = sub ? (i % 2 ? 2 : -2) * (0.5 + hh(i, 1)) : -2.5 + i * 0.9, z = sub ? 24 - i * 6 : 8 - i * 1.7; rm(cam, t, out, i, x, 0, z, i % 2 ? "shock" : "nervous", { tilt: 0.22 * Math.sin(t * 13 + i * 1.7), headTilt: 0.2 * Math.sin(t * 11 + i) }); }
  for (let i = 0; i < 16; i++) { const ph = (((t * 0.9 + hh(i, 1)) % 1) + 1) % 1; sv(out, { k: "pum", x: (i % 2 ? 6 : -6) + (hh(i, 2) - 0.5) * 2, y: 6 - ph * 6, z: 18 - i * 5, s: 0.3 + 0.2 * hh(i, 3), pitch: t * 4 + i, roll: t * 3 }); }
  for (let i = 0; i < 12; i++) { const ph = (((t * 0.6 + i / 12) % 1) + 1) % 1; sv(out, { k: "dsmoke", x: (i % 2 ? 6.5 : -6.5), y: 0.5 + ph * 4, z: 24 - i * 5.5, s: 1.2 + ph * 2.4 }); }
};
// ---- 3 nobody knew why ----
const s3 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  wisp(out, t, 6);
  const P: [number, number, number][] = sub ? [[-1.3, 0, 1], [1.0, 0, -1.2]] : [[-0.6, 0, 0], [0.9, 0, -0.7], [-1.9, 0, -1.3]];
  P.forEach(([x, y, z], i) => { rm(cam, t, out, i + 2, x, y, z, i % 2 ? "dazed" : "curious", { shrug: 0.6 }); qmark(out, t + i, x, 2.5, z, 1.4); });
};
// ---- 4 79 AD: the blast ----
const s4 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  if (sub === 0) { wisp(out, t, 7, 1.2); return; }
  plume(out, t, TB()); lavaStreaks(out, t, TB());
  const k = clamp01((t - TB()) / 0.6); for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.283, r = k * (30 + 60 * hh(i, 2)); sv(out, { k: "ashO", x: Math.cos(a) * r, y: 200 + (hh(i, 3) * 90 + 40) * k, z: -380 + Math.sin(a) * r * 0.6, s: 7 * (1 - k * 0.6) + 2 }); }
};
// ---- shared volcano state ----
const roof = (out: Stage, t: number, tb: number) => { const k = clamp01((t - tb) / 6); if (k <= 0) return; for (let i = 0; i < 14; i++) sv(out, { k: "ash", x: (hh(i, 1) - 0.5) * 200, y: 125 + hh(i, 4) * 35, z: -90 + (hh(i, 2) - 0.5) * 190, s: 75 * k, yaw: i + t * 0.05 }); };
const embers = (out: Stage, t: number) => { for (let i = 0; i < 14; i++) { const ph = (((t * 0.5 + hh(i, 1)) % 1) + 1) % 1; sv(out, { k: "ashO", x: (hh(i, 2) - 0.5) * 90, y: 215 + ph * 100, z: -380 + (hh(i, 3) - 0.5) * 120, s: 1.5 + 2 * (1 - ph) }); } };
const night = (out: Stage, t: number) => { plume(out, t, TB() - 5); lavaStreaks(out, t, TB() - 10); roof(out, t, TB() - 20); lamps(out, t); embers(out, t); wave(out, t); };
const runnersAhead = (cam: CamInfo, t: number, out: Stage) => { const dt = t - wt(8, "rushed"); for (let i = 0; i < 4; i++) { const z = -36 - i * 4 + 5.5 * dt, zf = pathAt(waveD(t)).z; if (zf > z - 3) continue; rm(cam, t, out, i + 1, (i % 2 ? 1.6 : -1.8), 0, z, "shock", { mode: "march", phase: q((t * 1.6 + i * 0.2) % 1, 10), tilt: 0.16 }); } };
// ---- 5 the column of ash ----
const s5 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  plume(out, t, TB()); lavaStreaks(out, t, TB());
  if (sub === 0) { rm(cam, t, out, 1, 0, 0, 0, "shock", { shrug: 0.3 }); rm(cam, t, out, 2, -2.2, 0, -3, "shock", {}); rm(cam, t, out, 3, 2.4, 0, -4.5, "nervous", {}); }
  if (sub === 2) { roof(out, t, wt(5, "miles") - 1); rain(cam, t, out, "flake", 50, 0.1, 3, 8); }
};
// ---- 6 pumice rain ----
const s6 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  plume(out, t, TB()); lavaStreaks(out, t, TB()); roof(out, t, wt(5, "miles") - 1);
  rain(cam, t, out, "pum", 30, 0.28, 9, 8); rain(cam, t, out, "flake", 40, 0.12, 3, 9);
  if (sub <= 1) { const dt = t - lineStart(6); for (let i = 0; i < 8; i++) rm(cam, t, out, i + 1, -1.2 + (i % 3) * 1.4, 0, -2 + i * 1.3 + 4.8 * dt, i % 2 ? "shock" : "nervous", { mode: "march", phase: q((t * 1.5 + i * 0.17) % 1, 10), tilt: 0.14 }); }
  else { const dt = t - wt(6, "others"); for (let i = 0; i < 6; i++) { const p = clamp01(dt / (0.9 + 0.22 * i)); if (p >= 1) continue; rm(cam, t, out, i + 3, lip(-1.0 + i * 0.5, 5.6, smooth(p)), 0, lip(-1.5 + (i % 3) * 0.8, -6.2, smooth(p)), "shock", { mode: "march", phase: q((t * 1.5 + i * 0.17) % 1, 10), tilt: 0.14 }); } }
};
// ---- 7 the deadly mistake ----
const s7 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  plume(out, t, TB()); roof(out, t, wt(5, "miles") - 1); rain(cam, t, out, "pum", 26, 0.25, 9, 6); rain(cam, t, out, "flake", 50, 0.1, 3, 7);
  soft(out, "255,120,50", 0.35, 6.0, 1.4, -6, 3);
  if (sub === 1) { const k = clamp01((t - wt(7, "mistake")) / 1.4); for (let i = 0; i < 22; i++) { const f = i / 22; sv(out, { k: "pum", x: 7 + (hh(i, 1) - 0.5) * 5, y: 5.5 + 0.9 * f * k + 0.2 * hh(i, 2), z: -6 + (hh(i, 3) - 0.5) * 5, s: 0.35 + 0.25 * hh(i, 4), pitch: i, roll: i * 2 }); } }
};
// ---- 8 midnight: the wave ----
const s8 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  night(out, t);
  if (sub === 2) { rm(cam, t, out, 1, 0, 0, 0, "shock", { shrug: 0.4, headTilt: 0.1 * Math.sin(t * 9) }); soft(out, "255,120,40", 0.55, 0, 1.6, -1, 5); }
  if (sub === 3) { for (let i = 0; i < 4; i++) fire(out, t, -3.8 + 0.0 * i, 0.5, -33.8 + i * 0.5, 0.35 + 0.12 * Math.sin(t * 8 + i) + 0.3 * clamp01((t - wt(8, "hotter")) / 1.2)); soft(out, "255,150,40", 0.8, -3.9, 1.0, -33, 4.5); for (let i = 0; i < 5; i++) sv(out, { k: "loaf", x: -3.88, y: 0.54, z: -33.7 + i * 0.4, s: 1.3, yaw: i * 0.8 }); }
  if (sub >= 4) runnersAhead(cam, t, out);
};
// ---- 9 it killed everyone ----
const s9 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  night(out, t);
  if (sub === 0) { runnersAhead(cam, t, out); return; }
  for (let i = 0; i < 14; i++) sv(out, { k: "ash", x: (i % 2 ? 1 : -1) * (13 + 4 * hh(i, 1)), y: 7 + hh(i, 2) * 8 + Math.sin(t * 0.7 + i), z: 30 - i * 5.5, s: 5 + 3 * hh(i, 3), yaw: i + t * 0.1 });
  rain(cam, t, out, "flake", 60, 0.1, 1.2, 8);
};
// ---- 10 buried in ash ----
const s10 = (cam: CamInfo, t: number, out: Stage, sub: number) => { void sub; wisp(out, t, 4, 0.8); rain(cam, t, out, "flake", 20, 0.08, 0.8, 12); };
// ---- 11 forgotten ----
const s11 = (cam: CamInfo, t: number, out: Stage, sub: number) => { void sub; wisp(out, t, 4, 0.8); };
// ---- 12 diggers find it ----
const s12 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  if (sub === 0) { dig(cam, t, out, 0); return; }
  for (let i = 0; i < 5; i++) ch(cam, t, out, DIGGER, "dig", 30 + i, (i % 2 ? 2.8 : -2.8), 0, 8 - i * 9, { expr: "smile", prop: "trowel", wave: 0.3 });
  ch(cam, t, out, BOSS, "boss", 9, 1.2, 0, -4, { expr: "grin", prop: "clipboard" });
};
// ---- 13 bread in the ovens, graffiti on the walls ----
const s13 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  void cam; void t;
  if (sub === 0) for (let i = 0; i < 5; i++) sv(out, { k: "loaf", x: -3.9, y: 0.54, z: -33.7 + i * 0.4, s: 1.3, yaw: i * 0.8 });
};
// ---- 14 the molds ----
const s14 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  void cam; void t; void sub;
  const M: [number, number, number, number][] = [[0, 0, -0.4, 0.3], [-3.2, 0, -2.4, 2.2], [2.8, 0, -3.6, 4.0], [-2.0, 0, 2.0, 1.0], [3.0, 0, 1.2, 3.2], [0.4, 0, -6.2, 5.0]];
  M.forEach(([x, y, z, yaw]) => sv(out, { k: "mold", x, y, z, yaw, s: 1.15 }));
};
// ---- 15 today ----
const s15 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  wisp(out, t, 6, 1.0);
  if (sub === 0) { for (let i = 0; i < 4; i++) walker(cam, t, out, i, (i % 2 ? 2 : -2), -10 + i * 9, 1, "smile"); return; }
  for (let i = 0; i < 44; i++) { const row = Math.floor(i / 4), x = ((i % 4) - 1.5) * 2.2 + Math.sin(i) * 0.5; walker(cam, t, out, i, x, -40 + row * 5.4, i % 2 ? 1 : -1, i % 3 === 0 ? "laugh" : "smile"); }
};
// ---- 16 the lesson ----
const s16 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  wisp(out, t, 8, 1.4);
  rm(cam, t, out, 4, 0, 0, 0, sub ? "stern" : "nervous", {});
  void fire;
};

export const stage = (id: number, t: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [], solids: [] };
  const s = SHOTS[id - 1];
  void f;
  LNAME = s.light; SUN = cam.sun.clone().normalize();
  const fn = [null, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16][s.line];
  if (fn) fn(cam, t, out, s.sub);
  return out;
};
export { FPS, fxBurst };
void bodySide; void fxPuff; void blob; void ST_; void bulb;
