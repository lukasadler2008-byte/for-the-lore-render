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

// ---- 1 hook ----
const s1 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const zh = -13 - 8.5 * clamp01(t / 3.7);
  horse(out, zh, 0);
  pullers(cam, t, out, zh, 6, 1);
  dust(out, t, -1.3, zh + 1.5, 4); dust(out, t, 1.3, zh + 1.5, 4);
  for (let i = 0; i < 5; i++) { tj(cam, t, out, i + 8, -7.5 - (i % 2) * 1.2, 0, -27 - i * 2.2, i % 2 ? "laugh" : "smile", { wave: 0.5 }); tj(cam, t, out, i + 13, 7.5 + (i % 2) * 1.2, 0, -27 - i * 2.2, i % 2 ? "grin" : "laugh", { wave: 0.5 }); }
  if (sub >= 1) for (let i = 0; i < 4; i++) tj(cam, t, out, i + 20, -6 + i * 4, 0, 4 + (i % 2), "smile", { mode: "stroll", phase: q((t * 0.8 + i * 0.3) % 1, 10) });
  sentries(cam, t, out, "grin");
};
// ---- 2 the long siege ----
const s2 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  if (sub === 0) {
    for (let i = 0; i < 26; i++) { const [x, z] = spot(i, 2.2, 0, 6); gk(cam, t, out, i, x, 0, z - 4, i % 4 === 0 ? "stern" : "tired", { mode: "march", phase: q((t * 0.8 + hz(i)) % 1, 10), tired: 0.5 }, 1); }
    for (let i = 0; i < 6; i++) dust(out, t, -26 + i * 11, 5, 3, 0.4);
    return;
  }
  const tf = t - wt(2, "break");
  for (const x of [-9, 0 + 6.5, 9]) sv(out, { k: "ladder", x, y: 0, z: -19.0, s: 9.8, pitch: -0.2 });
  for (let i = 0; i < 11; i++) { const x = -12 + i * 2.4 + (i % 2), z = -14 + 3 * Math.sin(i * 1.7); const adv = (clamp01(tf / 0.4 + i * 0.08) + 0) ; gk(cam, t, out, i, x, 0, lip(-6, -17.6, Math.min(1, adv)) + 0 * z, i % 3 ? "pained" : "shock", { mode: "march", phase: q((t * 1.4 + i * 0.2) % 1, 10) }); }
  for (let i = 0; i < 3; i++) { const k = ((tf * 0.5 + i / 3) % 1 + 1) % 1; gk(cam, t, out, i + 12, [-9, 6.5, 9][i] + 0.2, 1.4 + k * 7.4 * (1 - k * 0.2), -19.0 - 0.1, "shock", { mode: "stand" }); }
  for (let i = 0; i < 5; i++) { const k = ((tf * 0.8 + i * 0.37) % 1 + 1) % 1; sv(out, { k: "shard", x: -12 + i * 6, y: 11 - 11 * k * k, z: -17 + 2 * Math.sin(i), s: 0.7, pitch: tf * 5 + i, roll: tf * 3 }); }
  sentries(cam, t, out, "laugh"); dust(out, t, -9, -18.3, 5); dust(out, t, 9, -18.3, 5);
};
// ---- 3 empty camp, the giant horse ----
const s3 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  if (sub === 0) {
    for (let i = 0; i < 6; i++) dust(out, t, -26 + i * 11, 5, 3, 0.4);
    soft(out, "255,190,110", 0.5, 0, 6, -10, 60, 20);
    sv(out, { k: "wreck", x: 0, y: 0, z: 6, s: 0 });
    return;
  }
  const k = clamp01((t - wt(3, "giant")) / 1.6);
  horse(out, -6, 0);
  for (let i = 0; i < 5; i++) tj(cam, t, out, i + 3, -3 + i * 1.8, 0, -17.2 + 0.4 * (i % 2), i % 2 ? "shock" : "curious", { mode: "stand" });
  tj(cam, t, out, 9, -2.4, 0, -2.0, "shock", {}); tj(cam, t, out, 10, 2.4, 0, -1.4, "shock", {});
  qmark(out, t, -2.4, 2.9, -2.0, 1.3 * easeOutS(k)); qmark(out, t, 2.4, 2.9, -1.4, 1.3 * easeOutS(k));
  sentries(cam, t, out, "shock");
};
// ---- 4 Sinon: a gift for Athena ----
const s4 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  horse(out, -6, 0);
  ch(cam, t, out, SINON, "sinon", 3, -0.6, 0, -2.4, { expr: sub === 0 ? "smile" : "grin", prop: "point" });
  tj(cam, t, out, 1, 1.0, 0, -1.9, "curious", {}); tj(cam, t, out, 2, 2.4, 0, -1.4, "smile", {}); tj(cam, t, out, 4, -2.2, 0, -1.5, "curious", {});
  if (sub === 1) { const k = easeOutS((t - wt(4, "gift")) / 0.5); soft(out, "255,210,110", 0.7 * k, 0, 4.2, -6.8, 9); for (let i = 0; i < 10; i++) sv(out, { k: "spark", x: Math.cos(t * 0.8 + i) * 3.2, y: 2.2 + 2.6 * hh(i, 2) + 0.4 * Math.sin(t * 2 + i), z: -6 + Math.sin(t * 0.8 + i) * 2.4, s: 2.0 * k }); }
};
// ---- 5 Laocoon warns ----
const s5 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  horse(out, -6, 0);
  ch(cam, t, out, PRIEST, "priest", 4, -0.2, 0, -0.4, { expr: sub === 0 ? "shock" : "stern", prop: "point", wave: 0.6 });
  for (let i = 0; i < 7; i++) tj(cam, t, out, i, -4.5 + i * 1.5, 0, -2.6 - 0.6 * (i % 2), i % 2 ? "laugh" : "grin", { wave: 0.4 });
  const b = clamp01((t - lineStart(5)) / 0.4);
  sv(out, { k: "qmark", x: 0.4, y: 2.8, z: -0.4, cam: true, s: 0, roll: 0 });
  soft(out, "255,80,60", 0.35 * b, -0.2, 1.4, -0.9, 2.6);
};
// ---- 6 nobody listens, they drag it in ----
const s6 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const zh = sub === 0 ? -6 : horseZ6(t);
  horse(out, zh, 0);
  if (sub === 0) {
    crowdLine(cam, t, out, 7, 0, -2.4, 9, "laugh", { wave: 0.5 }); ch(cam, t, out, PRIEST, "priest", 4, -3.6, 0, 0.4, { expr: "sad" });
    soft(out, "255,210,110", 0.4, 0, 3, -6, 12);
    return;
  }
  pullers(cam, t, out, zh, 8, 1);
  dust(out, t, -1.3, zh + 1.5, 5); dust(out, t, 1.3, zh + 1.5, 5);
  for (let i = 0; i < 6; i++) { tj(cam, t, out, i + 8, -4.5 - (i % 2), 0, 4 - i * 4.0, i % 2 ? "laugh" : "grin", { wave: 0.5 }); tj(cam, t, out, i + 14, 4.5 + (i % 2), 0, 4 - i * 4.0, i % 2 ? "grin" : "laugh", { wave: 0.5 }); }
  ch(cam, t, out, PRIEST, "priest", 4, -6.2, 0, 3.0, { expr: "sad" });
  sentries(cam, t, out, "laugh");
};
// ---- 7 the night, the hatch, the gate ----
const s7 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const zh = ST.PLAZA_Z, tH = wt(7, "hidden"), a = 0.85 * smooth((t - tH) / 0.7);
  horse(out, zh, sub >= 1 ? a : 0);
  for (const [x, z] of [[-7, zh + 6], [7, zh + 6], [-8, zh - 5], [8, zh - 5], [0, zh - 12], [-4, zh + 11]]) torch(out, t, x, 0, z);
  if (sub <= 1) for (let i = 0; i < 5; i++) tj(cam, t, out, i + 3, -7 + i * 3.4 + (i % 2), 0.0, zh + 14 + (i % 2), "sleep", { mode: "sit" } as never, 1);
  const hatchY = 1.66 * ST.HORSE_S, hz0 = zh + 1.05 * ST.HORSE_S, rx = 0.25, rz = zh + 2.4;
  if (sub >= 1) {
    sv(out, { k: "rope", x: rx, y: hatchY, z: hz0, a: rx, b: 0.1, c: rz });
    const tc = wt(7, "climb");
    for (let i = 0; i < 6; i++) {
      const t0 = (sub === 1 ? tH + 0.7 : tc) + i * 0.42, k = clamp01((t - t0) / 0.9);
      if (t < t0 - 0.2 && sub === 1) continue;
      const y = i === 0 && sub === 1 ? 0 : lip(hatchY - 0.4, 0, easeOutS(k)), z = lip(hz0, rz, easeOutS(k)), x = lip(rx, -3.4 + i * 1.3, smooth((t - (t0 + 0.9)) / 1.6));
      gk(cam, t, out, i, x, Math.max(0, y), z + 0.35 * smooth((t - t0 - 0.9) / 1.6) * (i % 2 ? 1 : -1) * 3, i % 2 ? "stern" : "grin", {}, 1);
    }
  }
  if (sub === 3) {
    const g = GATE_OPEN(t);
    sv(out, { k: "gate", x: 0, y: 0, z: -22, s: 1, a: g });
    for (let i = 0; i < 5; i++) gk(cam, t, out, i + 6, -4 + i * 2, 0, -27 - (i % 2) * 1.4 + (i > 2 ? 0 : 0), "stern", { mode: "march", phase: q((t * 1.0 + i * 0.2) % 1, 10) });
    for (let i = 0; i < 14; i++) { const x = -8 + (i % 7) * 2.7, z = -6 + Math.floor(i / 7) * 5 + 2 * Math.sin(i); gk(cam, t, out, i + 12, x, 0, z + 14 * smooth((t - wt(7, "open") - 0.8) / 2.2) * -1, "stern", { mode: "march", phase: q((t * 1.2 + i * 0.13) % 1, 10) }); torch(out, t, x + 0.5, 0, z + 14 * smooth((t - wt(7, "open") - 0.8) / 2.2) * -1); }
  } else sv(out, { k: "gate", x: 0, y: 0, z: -22, s: 1, a: 0 });
};
// ---- 8 morning, Troy burns ----
const s8 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  sv(out, { k: "gate", x: 0, y: 0, z: -22, s: 1, a: 1.35 });
  const spots: [number, number, number][] = [[-16, 7, -40], [-30, 7.5, -52], [18, 8, -45], [31, 8, -60], [-18, 7, -66], [20, 8, -78], [-28, 8, -84], [10, 8, -100], [-12, 8, -98], [33, 8, -88]];
  spots.forEach(([x, y, z], i) => { fire(out, t, x, y, z, 5 + hz(i) * 3); fire(out, t, x + 2, y - 1, z + 1.5, 3.4); fire(out, t, x - 2, y - 2, z + 2, 2.6); smokeCol(out, t + i * 0.37, x, y + 1, z, 5, 1.4); soft(out, "255,120,40", 0.5, x, y + 1, z + 3, 9); });
  fire(out, t, -14, 13.5, -22 + 1.6, 2.6); fire(out, t, 14, 13.5, -22 + 1.6, 2.6); smokeCol(out, t, -14, 14, -22, 5, 1.6); smokeCol(out, t, 14, 14, -22, 5, 1.6);
  for (let i = 0; i < 12; i++) gk(cam, t, out, i, -9 + (i % 6) * 3.2, 0, -28 - Math.floor(i / 6) * 3, "grin", { mode: "march", phase: q((t * 1.1 + i * 0.2) % 1, 10), wave: 0.5 });
  if (sub === 1) for (let i = 0; i < 4; i++) tj(cam, t, out, i, -12 + i * 1.8, 0, -44 + (i % 2) * 2, "shock", { mode: "march", phase: q((t * 1.6 + i * 0.3) % 1, 10) });
};
// ---- 9 Homer ----
const s9 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  ch(cam, t, out, HOMER, "homer", 5, 1.8, 0, 4.0, { expr: sub === 0 ? "neutral" : "sad", prop: "scroll", shrug: sub === 1 ? easeOutS((t - wt(9, "never") + 0.1) / 0.4) : 0 });
  if (sub === 1) qmark(out, t, 1.8, 2.9, 4.0, 1.5);
  for (let i = 0; i < 6; i++) { const ph = ((t * 0.3 + i / 6) % 1); sv(out, { k: "spark", x: 1.8 + Math.sin(i * 2.3) * 4, y: 1 + 3 * ph, z: 4 + Math.cos(i * 1.7) * 3, s: 1.0 * (1 - ph) }); }
};
// ---- 10 Virgil, twelve hundred years ----
const s10 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  ch(cam, t, out, VIRGIL, "virgil", 6, -5.6, 0, 16.0, { expr: "smile", prop: "scroll" });
  const k = smooth((t - lineStart(10)) / (lineEnd(10) - lineStart(10)));
  sv(out, { k: "candle", x: -4.4, y: 0, z: 16.6, s: 0.9, a: 1 - 0.85 * k, b: t });
  soft(out, "255,190,90", 0.55, -4.4, 1.0, 16.6, 2.4);
  for (let i = 0; i < 8; i++) { const ph = ((t * 0.25 + i / 8) % 1); sv(out, { k: "spark", x: -5 + Math.sin(i * 2.3 + t) * 1.6, y: 0.8 + 2.2 * ph, z: 16 + Math.cos(i * 1.9) * 1.2, s: 0.9 * (1 - ph) }); }
  void sub;
};
// ---- 11 the dig ----
const s11 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  ch(cam, t, out, DIGGER, "dig", 7, -2.2, -2.0, -9.2, { expr: "smile", prop: "trowel", mode: "stand" } as never);
  ch(cam, t, out, DIGGER, "dig", 8, 2.6, -2.0, -10.6, { expr: sub === 2 ? "shock" : "tired", prop: "trowel" });
  ch(cam, t, out, BOSS, "boss", 9, 0.4, 0, 1.0, { expr: sub === 2 ? "shock" : "smile", prop: "clipboard" });
  ch(cam, t, out, DIGGER, "dig", 11, -9, 0, 6.0, { expr: "smile", prop: "trowel" });
  if (sub === 2) { for (let i = 0; i < 6; i++) { const ph = ((t * 0.5 + i / 6) % 1); sv(out, { k: "dsmoke", x: -3 + i * 1.2, y: -0.9 + ph * 1.2, z: -8.5, s: 0.35 + 0.4 * ph }); } soft(out, "255,120,50", 0.3, 0, -0.9, -8.0, 5); }
};
// ---- 12 nobody found a horse ----
const s12 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  ch(cam, t, out, BOSS, "boss", 9, sub === 0 ? 1.4 : 0.0, 0, sub === 0 ? 0.8 : 1.0, { expr: sub === 0 ? "curious" : "sad", prop: sub === 0 ? "clipboard" : null, shrug: sub === 1 ? 1 : 0 });
  ch(cam, t, out, DIGGER, "dig", 7, -2.2, -2.0, -9.2, { expr: "curious", prop: "trowel" });
  ch(cam, t, out, DIGGER, "dig", 8, 2.6, -2.0, -10.6, { expr: "sad", prop: "trowel" });
  if (sub === 1) qmark(out, t, 0.0, 2.9, 1.0, 1.6);
};
// ---- 13 where did it come from ----
const s13 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  ch(cam, t, out, BOSS, "boss", 9, -1.0, 0, 2.5, { expr: "curious", prop: "point" });
  qmark(out, t, -1.0 - 0.4, 3.0, 2.5, 1.9); qmark(out, t + 0.4, -1.9, 2.4, 2.6, 1.2); qmark(out, t + 0.8, -0.2, 2.5, 2.4, 1.0);
  ch(cam, t, out, DIGGER, "dig", 7, 2.2, 0, 1.6, { expr: "curious", prop: "trowel" });
  void sub;
};
// ---- 14 siege machine, earthquake, Poseidon ----
const s14 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  if (sub === 0) {
    const zT = lip(8, -9, smooth((t - lineStart(14)) / (wt(14, "earthquake") - lineStart(14))));
    sv(out, { k: "stower", x: -6, y: 0, z: zT, s: 1.35, yaw: 0 });
    for (let i = 0; i < 6; i++) gk(cam, t, out, i, -9.5 + i * 1.3 + (i % 2) * 0.4, 0, zT + 3.2 + (i % 3) * 1.4, "pained", { mode: "march", phase: q((t * 1.4 + i * 0.16) % 1, 10), tilt: 0.1 });
    dust(out, t, -7.5, zT + 2.2, 5); sentries(cam, t, out, "shock"); return;
  }
  if (sub === 1) {
    const tq = t - wt(14, "earthquake");
    for (let i = 0; i < 18; i++) { const k = ((tq * 0.9 + i * 0.173) % 1 + 1) % 1; sv(out, { k: "shard", x: -9 + (i % 9) * 2.1, y: 12 - 12 * k * k, z: -20.3 + 0.5 * Math.sin(i), s: 0.8, pitch: tq * 5 + i, roll: tq * 3 + i }); }
    for (let i = 0; i < 10; i++) { const k = ((tq * 0.4 + i / 10) % 1 + 1) % 1; sv(out, { k: "smoke", x: -10 + i * 1.9, y: 0.5 + k * 5, z: -19 + 0.6 * Math.sin(i), s: 0.8 + k * 1.8 }); }
    for (let i = 0; i < 5; i++) tj(cam, t, out, i, 2 + i * 2, 0, 2 + 3 * Math.sin(i), "shock", { mode: "march", phase: q((t * 2.2 + i * 0.2) % 1, 10) });
    sentries(cam, t, out, "shock"); return;
  }
  const tp = wt(14, "poseidon");
  ch(cam, t, out, POSEIDON, "poseidon", 8, 0, 0, -37.5, { expr: sub === 2 ? "stern" : "laugh", prop: "spear", wave: 0.3 }, 3.0);
  soft(out, "120,220,255", 0.35 * clamp01((t - tp) / 0.4), 0, 3, -38.5, 16);
  if (sub === 3) { horse(out, -31, 0, 1.0, 8, 0.6); for (let i = 0; i < 12; i++) { const a = i * 0.9 + t * 1.2; sv(out, { k: "spark", x: Math.cos(a) * 6, y: 0.4 + 0.4 * Math.sin(t * 3 + i), z: -37.5 + Math.sin(a) * 6, s: 1.4 }); } }
};
// ---- 15 the walls fell ----
const s15 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  if (sub === 0) {
    const tq = t - lineStart(15);
    for (let i = 0; i < 24; i++) { const k = ((tq * 0.8 + i * 0.131) % 1 + 1) % 1; sv(out, { k: "shard", x: -10 + (i % 8) * 1.8, y: 11 - 11 * k * k, z: -20.2 + 0.5 * Math.sin(i), s: 1.0, pitch: tq * 4 + i, roll: tq * 3 + i }); }
    for (let i = 0; i < 12; i++) { const k = ((tq * 0.5 + i / 12) % 1 + 1) % 1; sv(out, { k: "dsmoke", x: -10 + i * 1.7, y: 0.5 + k * 7, z: -19 + 0.6 * Math.sin(i), s: 1.0 + k * 2.4 }); }
    for (let i = 0; i < 9; i++) gk(cam, t, out, i, -9 + i * 2.0, 0, -4 - 8 * smooth(tq / 1.5 + 0.1 * i), "stern", { mode: "march", phase: q((t * 1.4 + i * 0.2) % 1, 10) });
    return;
  }
  horse(out, -12, 0);
  ch(cam, t, out, SINON, "sinon", 3, -2.0, 0, -7.0, { expr: "grin", prop: "point" });
  soft(out, "255,210,110", 0.5, 0, 4, -12, 8);
};
// ---- 16 the lesson ----
const s16 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  horse(out, -19, 0);
  sv(out, { k: "gate", x: 0, y: 0, z: -22, s: 1, a: 1.35 });
  for (let i = 0; i < 4; i++) tj(cam, t, out, i, -6 + i * 4, 0, 2 + (i % 2), "smile", { mode: "stand" });
  sentries(cam, t, out, "smile"); soft(out, "255,190,110", 0.5, 0, 6, -24, 22);
  void sub;
};
// ---- 17 enemy inside ----
const s17 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  if (sub === 0) { horse(out, -21, 0); sv(out, { k: "gate", x: 0, y: 0, z: -22, s: 1, a: 1.35 }); for (let i = 0; i < 5; i++) tj(cam, t, out, i, -8 + i * 4, 0, 1 + (i % 2) * 1.5, "smile", {}); sentries(cam, t, out, "smile"); return; }
  const zh = ST.PLAZA_Z, a = 0.85;
  horse(out, zh, a); sv(out, { k: "gate", x: 0, y: 0, z: -22, s: 1, a: 1.35 });
  sv(out, { k: "rope", x: 0.25, y: 1.66 * ST.HORSE_S, z: zh + 1.31, a: 0.25, b: 0.1, c: zh + 2.4 });
  for (const [x, z] of [[-7, zh + 6], [7, zh + 6], [-8, zh - 5], [8, zh - 5]]) torch(out, t, x, 0, z);
  for (let i = 0; i < 6; i++) tj(cam, t, out, i + 3, -8 + i * 3.1, 0, zh + 15 + (i % 2), "sleep", { mode: "sit" } as never);
  for (let i = 0; i < 7; i++) gk(cam, t, out, i, -5 + i * 1.7, 0, zh + 4.5 - ((t - wt(17, "enemy")) * 0.5 + i * 0.3) % 3 * 0.4 + (i % 2) * 2, "stern", { mode: "march", phase: q((t * 1.0 + i * 0.2) % 1, 10) });
};

export const stage = (id: number, t: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [], solids: [] };
  const s = SHOTS[id - 1];
  void f;
  LNAME = s.light; SUN = cam.sun.clone().normalize();
  const fn = [null, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17][s.line];
  if (fn) fn(cam, t, out, s.sub);
  return out;
};
export { FPS, fxBurst };
void bodySide; void fxPuff; void blob; void ST_; void bulb;
