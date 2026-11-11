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
const LASZLO: Outfit = { jacket: "#3f7a5a", pants: "#3b4258", boots: "#2a2a30", hat: "hair", hair: "#6a4a30", moustache: "#6a4a30", skin: SKINS[1] };
const JEREMY: Outfit = { jacket: "#e8803a", pants: "#3b5b9a", boots: "#f4f1ea", hat: "cap", cap: "#2f6fd0", skin: SKINS[0] };
const DELIV: Outfit = { jacket: "#d6453b", pants: "#2c2f38", boots: "#1c1c22", hat: "cap", cap: "#d6453b", stripes: "#f4f0e6", skin: SKINS[3] };
const CASHIER: Outfit = { jacket: "#f4f0e6", pants: "#4a4038", boots: "#3a2c22", hat: "cap", cap: "#2f6a4a", apron: "#2f6a4a", skin: SKINS[2], moustache: "#3a2a22", build: "stout" };
const CROWD = (v: number): Outfit => ({ jacket: ["#7a52b8", "#3f86e0", "#e1669d", "#3fa86a", "#f2c230", "#c0392f"][v % 6], pants: ["#3b3f52", "#4a4038", "#2c2f38"][v % 3], boots: "#2a2a30",
  hat: ["hair", "cap", "hair", "tophat", "hair", "cap"][v % 6], hair: ["#3a2a22", "#c9a06a", "#1c130e", "#8a4a2a"][v % 4], cap: ["#f2c230", "#3f6fb5", "#e2453c"][v % 3], skin: SKINS[v % 4], build: v % 4 === 3 ? "stout" : "adult" });
const sv = (out: Stage, r: SR) => out.solids.push(r);
const lip = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOutS = (u: number) => 1 - (1 - clamp01(u)) ** 3;
const arc = (p0: V3, p1: V3, k: number, hgt: number): V3 => [lip(p0[0], p1[0], k), lip(p0[1], p1[1], k) + hgt * 4 * k * (1 - k), lip(p0[2], p1[2], k)];
type Pose = { expr: Expr } & Partial<FrontOpts>;
const ch = (cam: CamInfo, t: number, out: Stage, who: Outfit, key: string, i: number, x: number, y: number, z: number, pose: Pose, sc = 1) => {
  const { expr, ...extra } = pose;
  idle(cam, t, out, i, who, key, x, y, z, expr, extra, sc);
};
const L = (cam: CamInfo, t: number, out: Stage, p: V3, pose: Pose, sc = 1) => ch(cam, t, out, LASZLO, "laszlo", 0, p[0], p[1], p[2], pose, sc);
const J = (cam: CamInfo, t: number, out: Stage, p: V3, pose: Pose, sc = 1) => ch(cam, t, out, JEREMY, "jeremy", 1, p[0], p[1], p[2], pose, sc);
const sitting = (cam: CamInfo, t: number, out: Stage, who: Outfit, key: string, i: number, p: V3, expr: Expr, extra: Partial<FrontOpts> = {}) =>
  out.places.push(person(cam, { i, o: who, okey: key }, p[0], p[1], p[2], FRONT, { mode: "sit", expr, blink: expr === "sleep" ? 0 : lidAt(t, i), ...extra }, {}, 1));
const soft = (out: Stage, rgb: string, a: number, x: number, y: number, z: number, w: number, h = w) => { const qa = q(a, 20); if (qa > 0) fxp(out, `gl${rgb}${qa}`, 256, 256, (p) => fxGlowDisc(p, rgb, qa), x, y, z, w, h, { soft: true }); };
/** a point d metres from (x,z) toward the camera, at height y */
const toward = (cam: CamInfo, x: number, y: number, z: number, d: number): V3 => { const dx = cam.pos.x - x, dz = cam.pos.z - z, l = Math.hypot(dx, dz) || 1; return [x + (dx / l) * d, y, z + (dz / l) * d]; };
const yawTo = (cam: CamInfo, x: number, z: number) => Math.atan2(cam.pos.x - x, cam.pos.z - z);
/** two pizza boxes held in front of a character (hands ~ 1.0 m) */
const heldBoxes = (cam: CamInfo, out: Stage, p: V3, sc = 1, lid = 0, empty = false) => {
  const [x, y, z] = toward(cam, p[0], p[1] + 0.98 * sc, p[2], 0.32 * sc), yaw = yawTo(cam, p[0], p[2]);
  sv(out, { k: "pbox", x, y, z, s: 0.42 * sc, yaw, a: 0, b: 1 });
  sv(out, { k: "pbox", x, y: y + 0.065 * sc, z, s: 0.42 * sc, yaw, a: lid, b: empty ? 1 : 0 });
};
/** coin pile: cone of flat coins (radius r, n coins) with its base at y */
const coinPile = (out: Stage, cx: number, cy: number, cz: number, n: number, r: number, s = 1) => {
  let i = 0;
  for (let layer = 0; i < n; layer++) {
    const rr = Math.max(0.02, r * (1 - layer / 7)), m = Math.max(1, Math.round((rr / (0.11 * s)) ** 2 * 2.6));
    for (let k = 0; k < m && i < n; k++, i++) { const a = k * 2.39996 + layer, d = rr * Math.sqrt((k + 0.5) / m); sv(out, { k: "coin", x: cx + Math.cos(a) * d, y: cy + (0.011 + layer * 0.022) * s, z: cz + Math.sin(a) * d, s, pitch: 0.25 * (hh(i, 3) - 0.5), roll: 0.25 * (hh(i, 4) - 0.5) }); }
  }
};
/** a looping stream of coins flying from p0 to p1 (n in the air) */
const coinStream = (out: Stage, t: number, p0: V3, p1: V3, n: number, rate: number, hgt: number, s = 1, t0 = -99) => {
  for (let i = 0; i < n; i++) {
    const k = ((t * rate + i / n) % 1 + 1) % 1; if (t - t0 < k / rate) continue;
    const [x, y, z] = arc(p0, p1, k, hgt);
    sv(out, { k: "coin", x: x + 0.05 * Math.sin(i * 7), y, z, s, pitch: t * 9 + i, roll: t * 5 + i * 2 });
  }
};
const sparkle = (out: Stage, t: number, n: number, cx: number, cy: number, cz: number, R: number, s = 1.4) => {
  for (let i = 0; i < n; i++) { const a = t * 0.8 + i * 2.39996, r = R * (0.4 + 0.6 * hh(i, 2)); sv(out, { k: "spark", x: cx + Math.cos(a) * r, y: cy + 0.4 * R * Math.sin(t * 2 + i), z: cz + Math.sin(a) * r * 0.6, s: s * (0.6 + 0.4 * Math.sin(t * 5 + i)) }); }
};
const confetti = (out: Stage, t: number, n: number, cx: number, cz: number, spread: number, top: number, rate = 0.3) => {
  for (let i = 0; i < n; i++) {
    const ph = ((t * (rate + 0.2 * hh(i, 1)) + hh(i, 2)) % 1 + 1) % 1;
    sv(out, { k: "conf", x: cx + (hh(i, 3) - 0.5) * spread + 0.3 * Math.sin(t * 3 + i), y: top - ph * top, z: cz + (hh(i, 4) - 0.5) * spread * 0.5, pitch: t * (2 + hh(i, 5) * 3) + i, roll: t * 3 + i * 2, yaw: i, s: 1 + top / 14 });
  }
};
const fxPizzaCloud = (p: Pen) => {
  [[110, 140, 90], [230, 100, 105], [350, 140, 90], [230, 190, 120], [130, 210, 70], [330, 215, 75]].forEach(([x, y, r]) => p.ell(x, y, r, r * 0.8, "#ffffff", 9));
  [[110, 140, 90], [230, 100, 105], [350, 140, 90], [230, 190, 120], [130, 210, 70], [330, 215, 75]].forEach(([x, y, r]) => p.ell(x, y, r * 0.95, r * 0.76, "#ffffff", 0));
  p.poly([[230, 70], [320, 230], [140, 230]], "#ffd75e", 8); p.stroke([[140, 232], [320, 232]], 22, "#e2a24f"); p.stroke([[140, 232], [320, 232]], 8, "#c98a3f");
  for (const [x, y] of [[230, 130], [200, 190], [262, 195]]) p.ell(x, y, 17, 15, "#c8352c", 5);
  p.ell(60, 300, 20, 18, "#ffffff", 7); p.ell(28, 340, 11, 10, "#ffffff", 6);
};
const fxGrowl = (p: Pen, t: number) => {
  for (let k = 0; k < 3; k++) { const pts: [number, number][] = []; for (let j = 0; j <= 16; j++) pts.push([30 + j * 15, 60 + k * 70 + 12 * Math.sin(j * 1.1 + t * 14 + k)]); p.stroke(pts, 16, INKC); p.stroke(pts, 8, k % 2 ? "#ffd23a" : "#ffffff"); }
};
const INKC = "#241726";
const fxEq = (p: Pen) => { for (const y of [70, 130]) { p.poly([[30, y], [220, y], [220, y + 34], [30, y + 34]], "#ffffff", 8); } };
const thought = (out: Stage, cx: number, cy: number, cz: number, s = 1) => fxp(out, "pizzaCloud", 460, 360, fxPizzaCloud, cx, cy, cz, 0.95 * s, 0.75 * s);
const qmark = (out: Stage, t: number, x: number, y: number, z: number, s = 2.4) => sv(out, { k: "qmark", x, y, z, cam: true, s: s * (1 + 0.1 * Math.sin(t * 8)), roll: 0.15 * Math.sin(t * 2.6) });
const bulb = (out: Stage, t: number, x: number, y: number, z: number, s = 0.6) => fxp(out, `bulb${q(t % 1, 8)}`, 300, 300, (p) => fxBulb(p, t % 1), x, y, z, s, s);

// ---- 1 hook ----
const s1 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  if (sub < 2) {
    const tl = sub === 1 ? t - wt(1, "for") : 0;
    L(cam, t, out, ST.DOOR.L, { expr: sub === 0 ? "grin" : "lick", prop: "hold" });
    ch(cam, t, out, DELIV, "deliv", 2, ST.DOOR.D[0], ST.DOOR.D[1], ST.DOOR.D[2], { expr: sub === 0 ? "smile" : "grin" });
    heldBoxes(cam, out, ST.DOOR.L, 1, sub === 1 ? 1.25 * easeOutS(tl / 0.6) : 0);
    if (sub === 0) {
      coinStream(out, t, [ST.DOOR.L[0] + 0.25, 1.2, ST.DOOR.L[2] + 0.35], [ST.DOOR.D[0] - 0.15, 0.4, ST.DOOR.D[2] + 0.25], 14, 1.1, 0.6, 0.9);
      sv(out, { k: "mbag", x: ST.DOOR.D[0] - 0.2, y: 0.16, z: ST.DOOR.D[2] + 0.3, s: 1.5 });
    } else {
      const [bx, by, bz] = toward(cam, ST.DOOR.L[0], 1.2, ST.DOOR.L[2], 0.36);
      soft(out, "255,200,90", 0.7 * easeOutS(tl / 0.6), bx, by + 0.15, bz, 1.0);
      sparkle(out, t, 8, bx, by + 0.2, bz, 0.35, 0.8);
    }
    sv(out, { k: "car", x: ST.CAR[0], y: 0, z: ST.CAR[2], s: 2.4, yaw: 0 });
    return;
  }
  const B = ST.BIG, y = ST.SUMMIT_Y;
  sv(out, { k: "pile", x: B.x, y: 0, z: B.z, s: B.s, yaw: 0.3 });
  soft(out, "255,205,90", 0.85, 0, 105, B.z - 40, 420, 300);
  const sc = 4.5;
  L(cam, t, out, [B.x, y, B.z], { expr: "grin", prop: "hold" }, sc);
  heldBoxes(cam, out, [B.x, y, B.z], sc, 0);
  soft(out, "255,210,110", 0.8, 0, y + 4.6, B.z + 1.5, 6);
  for (let i = 0; i < 16; i++) { const a = t * 0.8 + i * 0.7, r = 7 + 5 * hh(i, 2); sv(out, { k: "spark", x: Math.cos(a) * r, y: y + 3 + 3 * Math.sin(t * 2 + i), z: B.z + Math.sin(a) * r, s: 2.2 }); }
};
// ---- 2 Florida, Laszlo at home, hungry ----
const s2 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  if (sub === 0) { sv(out, { k: "car", x: 14, y: 0, z: 11, s: 2.4, yaw: Math.PI }); ch(cam, t, out, CROWD(4), "n1", 5, 9, 0.03, 4.4, { expr: "smile", mode: "stroll", phase: q((t * 0.9) % 1, 10) }); return; }
  L(cam, t, out, ST.RL, { expr: sub === 1 ? "smile" : "pained" });
  if (sub === 2) {
    const tg = wt(2, "hungry");
    thought(out, ST.RL[0] + 0.42, 1.98, ST.RL[2] + 0.25, 0.9 * easeOutS((t - tg + 0.3) / 0.35));
    fxp(out, `growl${q(t % 1, 12)}`, 300, 260, (p) => fxGrowl(p, t), ST.RL[0] - 0.36, 1.18, ST.RL[2] + 0.35, 0.3, 0.26);
  }
};
// ---- 3 coins out of the computer ----
const s3 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const t0 = lineStart(3), n = Math.round(12 + 70 * smooth((t - t0) / 4.2));
  L(cam, t, out, ST.RL, { expr: "grin" });
  coinPile(out, ST.DESKPILE[0], ST.DESKPILE[1], ST.DESKPILE[2], n, 0.32);
  coinStream(out, t, [ST.CRT[0], ST.CRT[1], ST.CRT[2] + 0.1], [ST.DESKPILE[0], 0.95, ST.DESKPILE[2]], sub === 0 ? 8 : 14, sub === 0 ? 1.2 : 2.0, 0.5);
  soft(out, "120,255,160", 0.35, ST.CRT[0], ST.CRT[1], ST.CRT[2] + 0.12, 0.9);
  if (sub === 1) sparkle(out, t, 10, ST.CRT[0], ST.CRT[1], ST.CRT[2] + 0.3, 0.45, 0.9);
};
// ---- 4 nobody accepts it ----
const s4 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  if (sub === 0) {
    L(cam, t, out, ST.RL, { expr: "curious", prop: "hold" });
    const [x, y, z] = toward(cam, ST.RL[0] + 0.12, 1.12, ST.RL[2], 0.3);
    sv(out, { k: "coin", x, y, z, s: 1.4, pitch: Math.PI / 2 - 0.2, yaw: yawTo(cam, x, z) });
    soft(out, "255,210,90", 0.45, x, y, z + 0.02, 0.35);
    qmark(out, t, ST.RL[0] + 0.55, 2.3, ST.RL[2] + 0.2, 2.2);
    coinPile(out, ST.DESKPILE[0], ST.DESKPILE[1], ST.DESKPILE[2], 80, 0.32);
    return;
  }
  const tr = wt(4, "real"), k = easeOutS((t - tr) / 0.5);
  L(cam, t, out, ST.CUST, { expr: t > tr ? "sad" : "nervous" });
  ch(cam, t, out, CASHIER, "cashier", 3, ST.CASHIER[0], 0, ST.CASHIER[2], { expr: "stern", prop: "stop" });
  sv(out, { k: "coin", x: 0.55, y: 1.135, z: lip(-2.1, -1.75, k), s: 1.4 });
  if (t > tr) qmark(out, t, ST.CASHIER[0] + 0.5, 2.5, ST.CASHIER[2], 2.0);
};
// ---- 5 he posts the offer ----
const s5 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  L(cam, t, out, ST.RL, { expr: sub === 0 ? "idea" : "grin" });
  coinPile(out, ST.DESKPILE[0], ST.DESKPILE[1], ST.DESKPILE[2], 80, 0.32);
  soft(out, "120,255,160", 0.4, ST.CRT[0], ST.CRT[1], ST.CRT[2] + 0.12, 1.0);
  if (sub === 1) {
    const k = easeOutS((t - wt(5, "ten")) / 0.5), y = 1.15 + 0.45 * k, z = -3.75;
    soft(out, "255,255,255", 0.55 * k, -1.8, y, z - 0.05, 1.5, 0.95);
    coinPile(out, -2.15, y - 0.22, z, Math.round(30 * k), 0.16, 0.8);
    fxp(out, "eqSign", 250, 200, fxEq, -1.8, y - 0.05, z + 0.02, 0.14 * k + 0.001, 0.11 * k + 0.001);
    for (let i = 0; i < 2; i++) sv(out, { k: "pbox", x: -1.45, y: y - 0.18 + i * 0.06, z, s: 0.3 * k + 0.001, a: 0, b: 1 });
    if (t > wt(5, "pizzas")) sparkle(out, t, 8, -1.8, y, z + 0.1, 0.5, 0.7);
  }
};
// ---- 6 four days of nothing ----
const s6 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  coinPile(out, ST.DESKPILE[0], ST.DESKPILE[1], ST.DESKPILE[2], 80, 0.32);
  if (sub === 0) { L(cam, t, out, ST.RL, { expr: "tired", headTilt: q(6 * Math.sin(t * 1.4), 4) }); return; }
  sv(out, { k: "pblock", x: -0.5, y: 0, z: -3.35, a: 0.45, b: 0.42, c: 0.45 });
  sitting(cam, t, out, LASZLO, "laszlo", 0, [-0.5, 0.44, -3.25], "sleep", { headTilt: 14 });
  soft(out, "120,255,160", 0.4, ST.CRT[0], ST.CRT[1], ST.CRT[2] + 0.12, 1.0);
};
// ---- 7 Jeremy says yes; the pizzas arrive; he gets the coins ----
const s7 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  if (sub === 2) {
    const k = easeOutS((t - wt(7, "orders")) / 1.3), dp: V3 = [lip(2.6, ST.DOOR.D[0], k), 0.03 + 0.13 * k, lip(4.2, ST.DOOR.D[2], k)];
    ch(cam, t, out, DELIV, "deliv", 2, dp[0], dp[1], dp[2], { expr: "smile", prop: "hold", mode: k < 1 ? "stroll" : "stand", phase: q((t * 1.6) % 1, 10) });
    heldBoxes(cam, out, dp, 1);
    L(cam, t, out, ST.DOOR.L, { expr: k > 0.6 ? "laugh" : "curious" });
    sv(out, { k: "car", x: ST.CAR[0], y: 0, z: ST.CAR[2], s: 2.4, yaw: 0 });
    return;
  }
  const tj = wt(7, "jeremy");
  J(cam, t, out, ST.RJ, { expr: sub === 3 ? "laugh" : sub === 1 ? "laugh" : t > tj ? "idea" : "curious" });
  soft(out, "120,200,255", 0.4, ST.CRTJ[0], ST.CRTJ[1], ST.CRTJ[2] + 0.12, 1.0);
  if (sub === 0 && t > tj) bulb(out, t, ST.RJ[0] + 0.1, 2.45, ST.RJ[2] + 0.1, 0.55 * easeOutS((t - tj) / 0.25));
  if (sub === 1) confetti(out, t, 24, ST.RJ[0], ST.RJ[2] + 0.3, 2.5, 3.0, 0.4);
  if (sub === 3) {
    const pb: V3 = [1.1, 0.0, -2.8];
    sv(out, { k: "pbank", x: pb[0], y: pb[1], z: pb[2], s: 1.5, yaw: -0.6 });
    coinStream(out, t, [ST.CRTJ[0], ST.CRTJ[1], ST.CRTJ[2] + 0.1], [pb[0], 0.85, pb[2]], 14, 1.6, 0.6);
  }
};
// ---- 8 / 9 the balance scale ----
const scaleScene = (cam: CamInfo, t: number, out: Stage, a: number, grow: number, exprL: Expr, exprJ: Expr, near = false) => {
  const S = ST.SCL;
  sv(out, { k: "scale", x: S.x, y: S.y, z: S.z, s: S.s, a });
  const [lx, ly, lz] = panTop(S.x, S.y, S.z, S.s, a, -1), [rx, ry, rz] = panTop(S.x, S.y, S.z, S.s, a, 1);
  coinPile(out, lx, ly, lz, Math.round(60 + 50 * grow), 0.75 + 0.15 * grow, 1.3);
  if (grow > 0) { soft(out, "255,200,80", 0.7 * grow, lx, ly + 0.4, lz + 0.4, 2.6 + 1.5 * grow); sparkle(out, t, 12, lx, ly + 0.4, lz, 1.0 + 0.4 * grow, 1.6); }
  for (let i = 0; i < 2; i++) sv(out, { k: "pbox", x: rx, y: ry + i * 0.12 * S.s * 0.5, z: rz, s: 0.85, yaw: 0.2 + i * 0.3, a: 0, b: 1 });
  L(cam, t, out, near ? [-0.7, 0, 1.2] : [-2.9, 0, 1.0], { expr: exprL });
  J(cam, t, out, near ? [0.7, 0, 1.2] : [2.9, 0, 1.0], { expr: exprJ });
};
const s8 = (cam: CamInfo, t: number, out: Stage, sub: number) => scaleScene(cam, t, out, 0.02 * Math.sin(t * 2.2), 0, sub === 2 ? "grin" : "smile", sub === 2 ? "grin" : "smile", sub === 2);
const s9 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const tt = ST.tScaleTip(), a = 0.42 * smooth((t - tt) / 1.4);
  scaleScene(cam, t, out, a, smooth((t - tt) / 1.8), sub === 1 ? "shock" : "curious", "nervous");
};
// ---- 10 more pizza deals for months ----
const tower = (out: Stage, n: number, x: number, z: number) => { for (let i = 0; i < n; i++) sv(out, { k: "pbox", x: x + 0.04 * Math.sin(i * 2.3), y: i * 0.06, z: z + 0.04 * Math.cos(i * 1.7), s: 0.42, yaw: 0.3 * Math.sin(i * 1.3), a: 0, b: 1 }); };
const s10 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  if (sub === 0) {
    sitting(cam, t, out, LASZLO, "laszlo", 0, ST.SOFA, "lick");
    sv(out, { k: "pbox", x: ST.TABLE[0], y: ST.TABLE[1], z: ST.TABLE[2], s: 0.42, yaw: 0.2, a: 1.9 });
    sv(out, { k: "pslice", x: ST.SOFA[0] - 0.3, y: 1.05, z: ST.SOFA[2] + 0.3, s: 0.16, pitch: 1.2 });
    tower(out, 6, 4.3, 0.6);
    return;
  }
  if (sub === 1) {
    L(cam, t, out, ST.DOOR.L, { expr: "laugh", prop: "hold" });
    ch(cam, t, out, DELIV, "deliv", 2, ST.DOOR.D[0], ST.DOOR.D[1], ST.DOOR.D[2], { expr: "nervous" });
    heldBoxes(cam, out, ST.DOOR.L, 1);
    coinStream(out, t, [ST.DOOR.L[0] + 0.25, 1.2, ST.DOOR.L[2] + 0.35], [ST.DOOR.D[0] - 0.15, 0.4, ST.DOOR.D[2] + 0.25], 14, 1.1, 0.6, 0.9);
    sv(out, { k: "mbag", x: ST.DOOR.D[0] - 0.2, y: 0.16, z: ST.DOOR.D[2] + 0.3, s: 1.5 });
    return;
  }
  const k = smooth((t - wt(10, "kept")) / 1.6);
  tower(out, Math.round(4 + 36 * k), 0.75, -3.75);
  L(cam, t, out, [0.0, 0, -3.0], { expr: "laugh" });
  coinStream(out, t, [ST.CRT[0], ST.CRT[1], ST.CRT[2] + 0.1], [-0.2, 1.6, -2.4], 8, 1.4, 0.4);
};
// ---- 11 Jeremy spends his ----
const s11 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  if (sub === 0) {
    J(cam, t, out, ST.RJ, { expr: "grin" });
    sv(out, { k: "pbank", x: ST.RJ[0] + 0.45, y: 0.76, z: -3.95, s: 1.2, yaw: -0.5 });
    coinPile(out, 1.4, 0.76, -4.1, 40, 0.25);
    return;
  }
  const t0 = wt(11, "spent"), k = smooth((t - t0) / 2.0);
  J(cam, t, out, ST.CUST, { expr: sub === 2 ? "smile_closed" : "laugh", shrug: sub === 2 ? 0.8 : 0 });
  ch(cam, t, out, CASHIER, "cashier", 3, ST.CASHIER[0], 0, ST.CASHIER[2], { expr: "laugh" });
  coinPile(out, 0.6, 1.12, -2.05, Math.round(10 + 70 * k), 0.34, 1.0);
  if (sub === 1) coinStream(out, t, [ST.CUST[0] + 0.2, 1.25, ST.CUST[2] - 0.2], [0.6, 1.3, -2.05], 12, 1.6, 0.5);
};
// ---- 12 arcade tokens ----
const ARC_FOLK: V3[] = [[-1.4, 0, 0.9], [1.5, 0, 0.6], [0.2, 0, 1.9]];
const s12 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  if (sub === 0) {
    L(cam, t, out, [0.3, 0, 0.4], { expr: "grin", prop: "hold" });
    const [x, y, z] = toward(cam, 0.42, 1.15, 0.4, 0.3);
    sv(out, { k: "coin", x, y, z, s: 1.4, pitch: Math.PI / 2 - 0.2, yaw: yawTo(cam, x, z) });
    ch(cam, t, out, CROWD(1), "kid1", 4, -2.6, 0, -5.6, { expr: "laugh" }); ch(cam, t, out, CROWD(4), "kid2", 5, 2.6, 0, -5.6, { expr: "grin" });
    return;
  }
  if (sub === 1 || sub === 3) {
    const t0 = sub === 1 ? wt(12, "arcade") : wt(12, "until"), k = clamp01((t - t0) / 0.9);
    const [x, y, z] = arc([0.55, 1.25, -5.0], [0, 1.12, -6.02], k, 0.25);
    if (k < 1) sv(out, { k: "coin", x, y, z, s: 1.2, pitch: Math.PI / 2, yaw: 0 });
    ch(cam, t, out, sub === 1 ? LASZLO : CROWD(2), sub === 1 ? "laszlo" : "c2", sub === 1 ? 0 : 6, 1.0, 0, -5.1, { expr: k >= 1 ? "laugh" : "curious" });
    if (k >= 1) { soft(out, "255,120,220", 0.7, 0, 1.5, -5.9, 2.0); confetti(out, t, 30, 0, -5.2, 3, 3.2, 0.5); }
    return;
  }
  L(cam, t, out, [0, 0, 0.2], { expr: "nervous", prop: "hold" });
  const [x, y, z] = toward(cam, 0.12, 1.15, 0.2, 0.3);
  sv(out, { k: "coin", x, y, z, s: 1.4, pitch: Math.PI / 2 - 0.2, yaw: yawTo(cam, x, z) });
  ARC_FOLK.forEach((p, i) => ch(cam, t, out, CROWD(i + 2), "c" + i, 6 + i, p[0], p[1], p[2], { expr: i === 1 ? "stern" : "curious" }));
  qmark(out, t, -1.4, 2.5, 0.9, 1.8); qmark(out, t + 0.5, 1.5, 2.5, 0.6, 1.8);
};
// ---- 13 the first real purchase, on a pedestal ----
const s13 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const P = ST.PED;
  sv(out, { k: "pblock", x: P[0], y: 0, z: P[2], a: 1.2, b: 1.1, c: 1.2 });
  const lid = sub === 1 ? 1.4 * easeOutS((t - wt(13, "bitcoin")) / 0.6) : 0;
  sv(out, { k: "pbox", x: P[0], y: 1.13, z: P[2], s: 0.7, yaw: 0.2, a: 0, b: 1 }); sv(out, { k: "pbox", x: P[0], y: 1.13 + 0.1, z: P[2], s: 0.7, yaw: 0.2, a: lid });
  soft(out, "255,230,150", 0.8, P[0], 1.6, P[2] + 0.5, 2.2);
  sparkle(out, t, 10, P[0], 1.6, P[2], 0.8, 1.2);
  [[-2.2, 0, -0.6], [2.2, 0, -0.4], [-1.3, 0, 0.9], [1.4, 0, 1.0]].forEach((p, i) => ch(cam, t, out, i === 0 ? LASZLO : CROWD(i + 1), i === 0 ? "laszlo" : "p" + i, i === 0 ? 0 : 8 + i, p[0], p[1], p[2], { expr: i % 2 ? "shock" : "laugh" }));
  if (sub === 1) confetti(out, t, 40, 0, P[2] + 1, 6, 5, 0.35);
};
// ---- 14 a billion dollars ----
const s14 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const B = ST.BIG, y = ST.SUMMIT_Y;
  sv(out, { k: "pile", x: B.x, y: 0, z: B.z, s: B.s, yaw: 0.3 });
  soft(out, "255,205,90", 0.85, 0, 105, B.z - 40, 420, 300);
  L(cam, t, out, [B.x - 1.5, y, B.z], { expr: sub === 1 ? "shock" : "grin" }, 4.5);
  J(cam, t, out, [B.x + 1.8, y, B.z + 0.5], { expr: sub === 1 ? "shock" : "nervous" }, 4.5);
  coinPile(out, B.x, y, B.z + 2.5, 60, 1.6, 6);
  for (let i = 0; i < 18; i++) { const a = t * 0.8 + i * 0.7, r = 9 + 6 * hh(i, 2); sv(out, { k: "spark", x: Math.cos(a) * r, y: y + 3 + 4 * Math.sin(t * 2 + i), z: B.z + Math.sin(a) * r, s: 2.4 }); }
  if (sub === 1) confetti(out, t, 60, 0, B.z, 30, y + 22, 0.3);
};
// ---- 15 no regrets ----
const s15 = (cam: CamInfo, t: number, out: Stage) => {
  sitting(cam, t, out, LASZLO, "laszlo", 0, ST.SOFA, "smile_closed", { shrug: 0.7 });
  sv(out, { k: "pbox", x: ST.TABLE[0], y: ST.TABLE[1], z: ST.TABLE[2], s: 0.42, yaw: 0.2, a: 1.9 });
  soft(out, "255,190,110", 0.35, ST.SOFA[0], 1.2, ST.SOFA[2] + 0.4, 1.6);
};
// ---- 16 the most expensive pizza, eaten in one evening ----
const s16 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  for (let i = 0; i < 2; i++) sv(out, { k: "pbox", x: ST.TABLE[0] - 0.22 + i * 0.46, y: ST.TABLE[1], z: ST.TABLE[2] + (i ? 0.08 : -0.06), s: 0.42, yaw: 0.2 - i * 0.5, a: 1.9, b: 1 });
  soft(out, "255,200,90", 0.55 + 0.1 * Math.sin(t * 3), ST.TABLE[0], 0.7, ST.TABLE[2] + 0.2, 1.6);
  sparkle(out, t, 8, ST.TABLE[0], 0.75, ST.TABLE[2], 0.5, 0.7);
  sitting(cam, t, out, LASZLO, "laszlo", 0, ST.SOFA, sub === 1 ? "sleep" : "relief", { headTilt: sub === 1 ? 12 : 0 });
  if (sub === 1) tower(out, 8, 4.3, 0.6);
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [], solids: [] };
  const s = SHOTS[id - 1];
  void f;
  LNAME = s.light; SUN = cam.sun.clone().normalize();
  switch (s.line) {
    case 1: s1(cam, t, out, s.sub); break;
    case 2: s2(cam, t, out, s.sub); break;
    case 3: s3(cam, t, out, s.sub); break;
    case 4: s4(cam, t, out, s.sub); break;
    case 5: s5(cam, t, out, s.sub); break;
    case 6: s6(cam, t, out, s.sub); break;
    case 7: s7(cam, t, out, s.sub); break;
    case 8: s8(cam, t, out, s.sub); break;
    case 9: s9(cam, t, out, s.sub); break;
    case 10: s10(cam, t, out, s.sub); break;
    case 11: s11(cam, t, out, s.sub); break;
    case 12: s12(cam, t, out, s.sub); break;
    case 13: s13(cam, t, out, s.sub); break;
    case 14: s14(cam, t, out, s.sub); break;
    case 15: s15(cam, t, out); break;
    case 16: s16(cam, t, out, s.sub); break;
  }
  return out;
};
export { FPS, fxBurst };
void bodySide; void fxPuff; void blob;
