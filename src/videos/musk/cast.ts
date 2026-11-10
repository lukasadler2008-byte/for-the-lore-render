// The Pisa cast as lit flat sprites in the 3D world (same machinery as the bridge short): every character asks for a
// drawing (key + draw call) each frame; the pool keeps one canvas per distinct drawing. Characters are yaw-only
// billboards shaded by cardShade(); standing ones get a contact blob (+ a sun-direction tail by day). Effects are
// unlit cards. Cards, effects and blobs live on the NOINK layer so the world ink never outlines their quads.
// Roles: Beppe the mason (coif, leather apron) and his grandson (same face, red cap), masons, Pisan soldiers (red,
// white cross) vs Lucca (white over red), the 1990 official, engineers (hard hats, hi-vis), tourists, a bus commuter.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, SKINS, fxBurst, fxShadow, fxContact, fxPuff, Outfit, Expr, FrontOpts, SideOpts, Prop, frontGeom } from "./toon";
import { fxGlowDisc } from "./fxd";
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
const { wt, wtf, lf, lineStart, lineEnd } = ST;
const MUSK: Outfit = { jacket: "#16171c", pants: "#23262f", boots: "#101216", hat: "hair", hair: "#1c130e", skin: SKINS[0] };
const BEZOS: Outfit = { jacket: "#3f7a9a", pants: "#3a3f52", boots: "#1c1c22", hat: null, skin: SKINS[2] };
const PAGE: Outfit = { jacket: "#c9573b", pants: "#3b4258", boots: "#2a2a30", hat: "hair", hair: "#5a3a26", skin: SKINS[0] };
const OFFICIAL: Outfit = { jacket: "#2b3050", pants: "#2b3050", boots: "#16151b", hat: "hair", hair: "#cfcfd6", tie: "#2f6fd0", shirt: "#f4f0e6", build: "stout", skin: SKINS[2] };
const BUYER: Outfit = { jacket: "#4a4a58", pants: "#4a4a58", boots: "#16151b", hat: "hair", hair: "#3a2a22", tie: "#b8322f", shirt: "#f4f0e6", skin: SKINS[0] };
const GIANT: Outfit = { jacket: "#7a52b8", pants: "#3a2f66", boots: "#16151b", hat: "tophat", tie: "#f2c230", shirt: "#f4f0e6", build: "stout", skin: SKINS[0], moustache: "#3a2a22" };
const ENG = (v: number): Outfit => ({ jacket: ["#f2a23a", "#f4f0e6", "#5d7a8a", "#e8c45a"][v % 4], pants: "#3b3f52", boots: "#3a2c22", hat: "hardhat", cap: ["#f2c230", "#f4f0e6", "#e2453c", "#3f86e0"][v % 4], skin: SKINS[(v + 1) % 4], stripes: v % 2 ? "#f4f0e6" : undefined });
const SELLER: Outfit = { jacket: "#f4f0e6", pants: "#4a4038", boots: "#3a2c22", hat: "cap", cap: "#d6453b", apron: "#d6453b", skin: SKINS[3] };
const GS = () => frontGeom(seedOf(0));
const headY = (sc: number) => (975 - GS().hc) * SU * sc;
const sv = (out: Stage, r: SR) => out.solids.push(r);
const lip = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOutS = (u: number) => 1 - (1 - clamp01(u)) ** 3;
const arc = (p0: V3, p1: V3, k: number, hgt: number): V3 => [lip(p0[0], p1[0], k), lip(p0[1], p1[1], k) + hgt * 4 * k * (1 - k), lip(p0[2], p1[2], k)];
const MK = (cam: CamInfo, t: number, out: Stage, x: number, y: number, z: number, expr: Expr, extra: Partial<FrontOpts> = {}, sc = 1, who: Outfit = MUSK, key = "musk", i = 0) =>
  idle(cam, t, out, i, who, key, x, y, z, expr, extra, sc);
const soft = (out: Stage, rgb: string, a: number, x: number, y: number, z: number, w: number, h = w) => { const qa = q(a, 20); if (qa > 0) fxp(out, `gl${rgb}${qa}`, 256, 256, (p) => fxGlowDisc(p, rgb, qa), x, y, z, w, h, { soft: true }); };
const fxStreak = (p: Pen, v: number) => { for (let i = 0; i < 12; i++) { const y = 20 + ((i * 53 + v * 17) % 260), x0 = 20 + ((i * 97) % 120), x1 = x0 + 160 + ((i * 41) % 130); p.stroke([[x0, y], [x1, y]], 2 + (i % 3), "rgba(255,255,255,0.55)"); } };
const fxStar = (p: Pen, col: string) => { const c = 64, pts: [number, number][] = []; for (let k = 0; k < 8; k++) { const r = k % 2 ? 12 : 60, a = (k * Math.PI) / 4; pts.push([c + r * Math.cos(a), c + r * Math.sin(a)]); } p.poly(pts, col, 0); };
const shotU = (id: number, f: number) => { const s = SHOTS[id - 1]; return clamp01((f - s.a) / Math.max(1, s.b - s.a)); };
const confetti = (out: Stage, t: number, n: number, cx: number, cz: number, spread: number, top: number, rate = 0.3) => {
  for (let i = 0; i < n; i++) {
    const ph = ((t * (rate + 0.2 * hh(i, 1)) + hh(i, 2)) % 1 + 1) % 1;
    sv(out, { k: "conf", x: cx + (hh(i, 3) - 0.5) * spread + 0.3 * Math.sin(t * 3 + i), y: top - ph * top, z: cz + (hh(i, 4) - 0.5) * spread * 0.5, pitch: t * (2 + hh(i, 5) * 3) + i, roll: t * 3 + i * 2, yaw: i, s: 1 + top / 14 });
  }
};
const sparks = (out: Stage, t: number, n: number, cx: number, cy: number, cz: number, R: number, t0: number, life = 1.0) => {
  const dt = t - t0; if (dt < 0 || dt > life) return;
  for (let i = 0; i < n; i++) { const a = hh(i, 6) * 6.28, e = hh(i, 7) * 1.4 - 0.2, v = R * (0.5 + hh(i, 8)); sv(out, { k: "spark", x: cx + Math.cos(a) * Math.cos(e) * v * dt, y: cy + Math.sin(e) * v * dt - 2.2 * dt * dt * R * 0.3, z: cz + Math.sin(a) * Math.cos(e) * v * dt, s: (1 - dt / life) * R * 0.5 + 0.2 }); }
};
const pat = (t: number, k: number) => ((t * 0.9 + k * 0.37) % 1 + 1) % 1;

// ---- 1 hook: gold mountain with tiny Musk, then company slices ----
const s1 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const tD = wtf(1, "none", 0.7), tP = tD + 0.55, k = smooth((t - tD) / 0.9), B = ST.BIG, sc = B.s * (1 - 0.985 * k);
  if (k < 0.995) {
    sv(out, { k: "pile", x: B.x, y: 0, z: B.z, s: sc, yaw: 0.3 });
    soft(out, "255,205,90", 0.85 * (1 - k), 0, 105 * (1 - 0.6 * k), B.z - 40, 420, 300);
    soft(out, "255,230,150", 0.7 * (1 - k), 0, 70, B.z + 60, 300, 140);
  }
  const mz = lip(B.z, -80, k), my = Math.max(2.1 * 16 + 0.5 * k, 1.1 * sc);
  if (t > tP + 0.5 && k >= 1) { /* on slice */ }
  MK(cam, t, out, B.x, my * (k < 1 ? 1 : 1), mz, sub === 0 ? "grin" : k > 0.5 ? "grin" : "smile_closed", {}, sub <= 2 ? 7.5 : 7.5 - 5.3 * k);
  for (let i = 0; i < 14; i++) { const a = t * 0.8 + i * 0.7, r = 18 + 8 * hh(i, 2); sv(out, { k: "spark", x: Math.cos(a) * r, y: 150 * (1 - 0.6 * k) + 6 * Math.sin(t * 2 + i), z: B.z + Math.sin(a) * r, s: 2.2 }); }
  if (t > tP - 0.1) {
    const g = easeOutS((t - tP + 0.1) / 0.9), SX = [-26, 0, 26];
    SX.forEach((x, i) => sv(out, { k: "slice", x, y: 0, z: i === 1 ? -80 : -70, s: 16 * g, yaw: (i - 1) * -0.25 + 0.05 * Math.sin(t * 2 + i) }));
    sparks(out, t, 26, 0, 30, -80, 36, tP + 0.1, 1.4);
  }
  void sub;
};
// ---- 2 1999 office: briefcase, 307 bars -> 22 ----
const NCOL = 14, KEEP = 7;
const s2 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const O = ST.OFF, tG0 = wtf(2, "three", 0.5) - 0.2, tS = wtf(2, "share", 0.78), tb0 = wtf(2, "sold", 0.4);
  const mx = sub === 0 ? -3.2 : O.musk[0], mz = sub === 0 ? -3.6 : O.musk[2];
  MK(cam, t, out, mx, 0, mz, sub === 2 ? "grin" : "smile");
  [[-5.4, "w0"], [3.4, "w1"], [5.9, "w2"]].forEach(([x, k], i) => MK(cam, t, out, x as number, 0, -4.7, i % 2 ? "neutral" : "smile", { facing: i % 2 ? -1 : 1 }, 1, ENG(i + 1), k as string, 10 + i));
  if (sub >= 1) {
    MK(cam, t, out, O.buyer[0], 0, O.buyer[2], sub === 1 ? "smile_closed" : "grin", { facing: -1 }, 1, BUYER, "buyer", 3);
    const h = easeOutS((t - tb0) / 0.9), bp = arc([O.buyer[0] - 0.4, 1.0, O.buyer[2] + 0.25], [O.musk[0] + 0.5, 1.0, O.musk[2] + 0.25], h, 0.15);
    sv(out, { k: "brief", x: bp[0], y: bp[1] - 0.15, z: bp[2], s: 1.5, yaw: 0.15, roll: 0.1 * (1 - h) });
  }
  const keepX = lip(-3.25 + 0.5 * KEEP, 0.45, smooth((t - tS - 0.7) / 0.9)), keepZ = lip(O.wallZ, O.musk[2] + 0.05, smooth((t - tS - 0.7) / 0.9));
  for (let i = 0; i < NCOL; i++) {
    const ap = easeOutS((t - tG0 - i * 0.04) / 0.5), sh = i === KEEP ? 0 : smooth((t - tS - Math.abs(i - KEEP) * 0.05) / 0.45);
    const a = ap * (1 - sh), x = i === KEEP ? keepX : -3.25 + 0.5 * i, z = i === KEEP ? keepZ : O.wallZ;
    if (a > 0.01) sv(out, { k: "gcol", x, y: 0, z, a, s: i === KEEP ? 1 + 0.2 * smooth((t - tS - 0.7) / 0.9) : 1, yaw: 0.1 * Math.sin(i) });
  }
  sparks(out, t, 16, 0, 1.5, O.wallZ, 2.2, tS, 0.9);
  if (sub === 2) confetti(out, t, 14, 0, -1.5, 3, 4.5, 0.4);
};
// ---- 3 payments bubble, the auction giant gobbles it, the money bag ----
const s3 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const O = ST.OFF, tInto = wtf(3, "into", 0.6), tBought = wtf(3, "bought", 0.5), tMusk = wtf(3, "musk", 0.8);
  const gz = -5.0, gh = headY(2.5);
  const bs = 0.25 + 0.7 * smooth((t - lineStart(3)) / Math.max(1, wtf(3, "and", 0.5) - lineStart(3)));
  let bx = 1.1, by = 1.6, bz = -2.4, bsc = bs;
  const gob = smooth((t - tBought + 0.5) / 0.9);
  if (t > tBought - 0.5) { bx = lip(1.1, 3.0, gob); by = lip(1.6, gh - 0.1, gob); bz = lip(-2.4, gz + 0.35, gob); bsc = bs * (1 - 0.9 * smooth((gob - 0.7) / 0.3)); }
  MK(cam, t, out, -0.4, 0, -2.6, t > tMusk ? "grin" : (sub === 1 ? "shock" : "smile"));
  if (sub >= 1) {
    const chomp = t > tBought && t < tBought + 0.9 && Math.floor(t * 8) % 2 === 0;
    MK(cam, t, out, 3.1, 0, gz, chomp ? "laugh" : "grin", { facing: -1 }, 2.5, GIANT, "giant", 4);
    const sw = t > tBought - 0.6 ? 0.5 * Math.abs(Math.sin(t * 7)) : 0.1;
    sv(out, { k: "gavel", x: 1.2, y: gh * 0.32, z: gz + 0.9, s: 2.6, roll: -0.5 - sw, yaw: 0.3 });
  }
  if (bsc > 0.02) {
    sv(out, { k: "bubble", x: bx, y: by, z: bz, s: bsc });
    for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; sv(out, { k: "coin", x: bx + Math.cos(a) * 0.35 * bsc, y: by + Math.sin(a * 1.3) * 0.3 * bsc, z: bz + Math.sin(a) * 0.3 * bsc, s: 1.6 * bsc, pitch: t * 3 + i, yaw: a }); }
    sv(out, { k: "env", x: bx, y: by - 0.1 * bsc, z: bz + 0.05, s: 1.8 * bsc, pitch: 0.6, yaw: t * 1.5 });
  }
  if (sub === 0 && t > tInto - 0.2 && t < tInto + 0.6) { const h = (t - tInto + 0.2) / 0.8, p = arc([-0.1, 1.3, -2.4], [1.1, 1.6, -2.4], clamp01(h), 0.5); sv(out, { k: "coin", x: p[0], y: p[1], z: p[2], s: 1.8, pitch: t * 12 }); }
  if (sub >= 2 || t > tMusk) {
    const fall = clamp01((t - tMusk) / 0.55), y = lip(6.0, 0.95, easeOutS(fall) * 0.4 + 0.6 * fall * fall);
    sv(out, { k: "mbag", x: 0.55, y, z: -2.0, s: 1.25, roll: 0.15 * (1 - fall) });
    sparks(out, t, 22, 0.55, 1.0, -2.0, 1.4, tMusk + 0.5, 0.9);
    for (let i = 0; i < 8; i++) { const dt = t - tMusk - 0.5; if (dt > 0 && dt < 1.0) { const a = i * 0.8; sv(out, { k: "coin", x: -0.15 + Math.cos(a) * 1.1 * dt, y: 1.2 + 1.6 * dt - 4.6 * dt * dt, z: -2.3 + Math.sin(a) * 0.5 * dt, s: 1.5, pitch: dt * 9 + i }); } }
  }
};
// ---- 4 beach / yank / hangar with 100 bars ----
const s4 = (cam: CamInfo, t: number, out: Stage, sub: number, u: number) => {
  if (sub === 0) {
    MK(cam, t, out, 0, 0.42, -0.5, "smile_closed", { mode: "sit" }, 1);
    soft(out, "255,200,120", 0.7, 0, 3, -20, 60, 30);
  } else if (sub === 1) {
    const k = ST.glide(u), x = 12 * k * k, y = 0.4 * (1 - smooth(k * 4)) + 0.15 * Math.sin(k * 20);
    out.places.push(person(cam, { i: 0, o: MUSK, okey: "musk" }, x, y + 0.2, -0.3, FRONT, { mode: "stand", expr: "shock", blink: 0 }, {}, 1));
    out.places[out.places.length - 1].roll = -0.35 * smooth(k * 3);
    for (let i = 0; i < 3; i++) fxp(out, `str${i}`, 400, 300, (p) => fxStreak(p, i), x - 2.6 - i * 0.8, 1.0 + 0.4 * i, -0.2, 5, 3.4, { soft: false });
  } else {
    const H = ST.HOPPER, P = ST.PALLET, t0 = lineStart(4) + (wtf(4, "spent", 0.5) - lineStart(4)) + 0.2, per = 0.17;
    MK(cam, t, out, -3.7, 0, -2.6, "grin", {}, 1);
    [[8, -4, 0], [9.5, -8, 1]].forEach(([x, z, v]) => MK(cam, t, out, x, 0, z, "smile", { facing: -1 }, 1, ENG(v + 2), "e" + v, 20 + v));
    sv(out, { k: "rocket", x: ST.HANGAR_ROCKET[0], y: ST.HANGAR_ROCKET[1], z: ST.HANGAR_ROCKET[2], s: 9 });
    const total = Math.max(0, Math.floor((t - t0) / per));
    for (let j = 0; j < 5; j++) { const a = clamp01(1 - Math.max(0, total - j * 4) / 4); sv(out, { k: "gcol", x: P[0] - 0.9 + j * 0.45, y: 0.26, z: P[2], a: 0.2 + 0.8 * a, s: 1, yaw: j * 0.1 }); }
    for (let n = Math.max(0, total - 6); n <= total; n++) {
      const ts = t0 + n * per, k = (t - ts) / 0.7;
      if (k >= 0 && k <= 1) { const p = arc([P[0], 2.4, P[2]], [H[0], H[1] + 0.2, H[2]], k, 2.0); sv(out, { k: "gbar", x: p[0], y: p[1], z: p[2], s: 2.2, yaw: k * 5 + n, pitch: k * 3 }); }
    }
    if (total > 0) soft(out, "255,200,80", 0.55 + 0.25 * Math.sin(t * 12), H[0], H[1] + 0.6, H[2] + 0.3, 3.2);
    sparks(out, t, 10, H[0], H[1], H[2], 1.6, t0 + total * per - 0.5, 0.45);
  }
};
// ---- 5 three rockets fail ----
const trail = (out: Stage, k: number, t: number, x: number, z: number, dark = false) => {
  for (let i = 0; i < 9; i++) { const tp = t - i * 0.13, st = ST.rocketState(k, tp); if (st.phase === "idle" || tp < ST.rocketIgn(k)) continue; const age = i * 0.13; sv(out, { k: dark ? "dsmoke" : "smoke", x: x + 2.2 * hh(i + 3, k) - 1.1, y: Math.max(0.5, st.y - 1.5), z: z + 1.3 * (hh(i, k + 2) - 0.5), s: (2.2 + age * 7) * 0.9 }); }
};
const s5 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const S = ST.SLOT, mx = [-11.5, 2.4, 11.5][sub], mz = [-13, -14, -12][sub];
  for (let k = 0; k < 3; k++) {
    const st = ST.rocketState(k, t), [x, , z] = S[k], tn = st.tilt;
    if (st.vis) {
      sv(out, { k: "rocket", x, y: st.y, z, s: ST.ROCK_S, roll: tn });
      if (st.flame > 0.05) { sv(out, { k: "flame", x, y: st.y + 0.3, z, s: 4, a: st.flame, b: t * 40 + k, roll: tn }); soft(out, "255,150,50", 0.8, x, st.y + 0.5, z + 1.5, 16 + 5 * st.flame); }
      trail(out, k, t, x, z, k === 2);
    }
    const tig = ST.rocketIgn(k);
    if (t > tig - 0.3 && t < tig + 2.4) for (let i = 0; i < 6; i++) { const dt = t - tig + 0.3, a = i * 1.05; sv(out, { k: "smoke", x: x + Math.cos(a) * (2 + 5 * dt), y: 0.9 + 0.4 * dt, z: z + Math.sin(a) * (1.5 + 3 * dt), s: 1.4 + 2.6 * Math.min(1, dt) }); }
  }
  // 1: explosion into confetti-smoke
  const T0 = ST.rocketBoom(), dt0 = t - T0, [ex, , ez] = S[0];
  if (dt0 >= 0) {
    const bx0 = ex + 5 * Math.sin(0.95 * 0.6), by0 = 9 * (T0 - ST.rocketIgn(0)) ** 2 + 5;
    if (dt0 < 0.35) fxp(out, `bst${q(dt0, 20)}`, 500, 500, (p) => fxBurst(p, clamp01(dt0 / 0.35), "#ffd24a", 12, 60, 240), bx0, by0, ez + 2, 26, 26);
    soft(out, "255,150,40", 1 - smooth(dt0 / 1.2), bx0, by0, ez + 1.5, 30);
    for (let i = 0; i < 14; i++) { const a = hh(i, 1) * 6.28, v = 6 + 8 * hh(i, 2); sv(out, { k: i % 2 ? "dsmoke" : "smoke", x: bx0 + Math.cos(a) * v * dt0 * 0.7, y: by0 + (hh(i, 3) - 0.3) * v * dt0 * 0.6 + 1.2 * dt0, z: ez + Math.sin(a) * v * dt0 * 0.4, s: (2.4 + 2.5 * hh(i, 4)) * Math.min(1, 0.4 + dt0 * 2) }); }
    for (let i = 0; i < 46; i++) { const a = hh(i, 5) * 6.28, v = 5 + 12 * hh(i, 6), g = 5 * dt0 * dt0, py = by0 + Math.sin(hh(i, 7) * 3) * v * dt0 - g * 3; sv(out, { k: "conf", x: bx0 + Math.cos(a) * v * dt0, y: Math.max(0.1, py), z: ez + Math.sin(a) * v * dt0 * 0.5, pitch: t * 6 + i, roll: t * 5 + i, s: 3.2 }); }
    for (let i = 0; i < 10; i++) { const a = hh(i, 8) * 6.28, v = 4 + 9 * hh(i, 9); sv(out, { k: "shard", x: bx0 + Math.cos(a) * v * dt0, y: Math.max(0.2, by0 + 6 * hh(i, 2) * dt0 - 9 * dt0 * dt0), z: ez + Math.sin(a) * v * dt0 * 0.5, s: 2.2, pitch: t * 4 + i, roll: t * 3 }); }
    sparks(out, t, 30, bx0, by0, ez, 14, T0, 1.2);
    if (dt0 > 0.9) sv(out, { k: "wreck", x: ex + 3, y: 0, z: ez + 3, s: 6, yaw: 0.6 });
    for (let i = 0; i < 6; i++) { const age = ((t * 0.35 + i / 6) % 1); if (dt0 > 0.9) sv(out, { k: "dsmoke", x: ex + 3 + hh(i, 1) * 1.4, y: 1.5 + age * 9, z: ez + 3, s: 1.4 + age * 3 }); }
  }
  // 2: fizzle leaves a leaning rocket with a smoke curl; 3: stall leaves a crash with smoke
  [1, 2].forEach((k) => { const tau = t - ST.rocketIgn(k); if (tau > 2.0) for (let i = 0; i < 4; i++) { const age = ((t * 0.4 + i / 4) % 1); sv(out, { k: "smoke", x: S[k][0] + (k === 2 ? -4 : 0) + hh(i, k) * 1.2, y: (k === 2 ? 2 : 6) + age * 7, z: S[k][2] + 1, s: 1.2 + age * 2.6 }); } });
  const t2 = ST.rocketIgn(2) + 2.3; if (t > t2 && t < t2 + 1.2) sparks(out, t, 12, S[2][0] - 5, 1, S[2][2], 6, t2, 1.0);
  const fail = t > ST.rocketBoom() + 0.2 ? "sad" : "nervous";
  MK(cam, t, out, mx, 0, mz, fail === "sad" && sub === 0 ? "shock" : sub === 0 ? "nervous" : "sad", {}, 1);
  [[-4, -16], [6, -17]].forEach(([x, z], i) => MK(cam, t, out, x, 0, z, "shock", {}, 1, ENG(i), "e" + i, 30 + i));
};
// ---- 6 garage: piggy bank coins, little electric car ----
const s6 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const B = ST.BANK, C0 = ST.GARAGE_CAR, tp = wtf(6, "put", 0.3), ti = wtf(6, "into", 0.2);
  MK(cam, t, out, -5.0, 0, -3.2, sub === 1 ? "grin" : "smile", {}, 1);
  sv(out, { k: "pbank", x: B[0], y: B[1], z: B[2], s: 1.3, yaw: -0.35 });
  sv(out, { k: "car", x: C0[0], y: 0, z: C0[2], s: 1.5, yaw: 2.0 });
  for (let i = 0; i < 7; i++) {
    const ts = tp + i * Math.max(0.1, (ti - tp) / 7), k = (t - ts) / 0.5;
    if (k >= 0 && k <= 1) { const p = arc([-4.3, 1.7, -3.4], [B[0] + 0.1, B[1] + 0.72, B[2]], k, 0.4); sv(out, { k: "coin", x: p[0], y: p[1], z: p[2], s: i === 6 ? 1.1 : 2.0, pitch: k * 8, roll: k * 5 }); }
  }
  if (sub === 1) { soft(out, "255,244,210", 0.25, C0[0] - 1.8, 0.7, C0[2] + 1.8, 1.6); }
};
// ---- 7 two almost empty stacks, candle, both companies on the cliff edge ----
const s7 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const burn = 1 - 0.88 * smooth((t - lineStart(7)) / Math.max(1, lineEnd(7) - lineStart(7)));
  sv(out, { k: "candle", x: 0, y: 0.78, z: 3.0, s: 1.1, a: burn, b: t });
  soft(out, "255,170,60", 0.8, 0, 0.78 + 1.1 * burn + 0.2, 3.1, 1.6);
  for (const x of [-1.8, 1.8]) { sv(out, { k: "gcol", x, y: 4.35, z: 6, a: 0.13, s: 1 }); sv(out, { k: "gbar", x: x + 0.3, y: 4.35, z: 6.3, s: 1, yaw: 0.8 }); }
  const wob = 0.08 * Math.sin(t * 5), wob2 = 0.1 * Math.sin(t * 4.2 + 1);
  if (sub === 1) {
    sv(out, { k: "rocket", x: -3.2, y: 0, z: -4.4, s: 3.3, roll: 0.22 + wob, pitch: 0.1 });
    sv(out, { k: "car", x: 3.2, y: 0, z: -4.7, s: 2.3, yaw: -Math.PI / 2, pitch: 0.12 + wob2 });
    for (let i = 0; i < 4; i++) { const ph = (t * 0.9 + i * 0.27) % 1; sv(out, { k: "shard", x: -1 + i * 1.4, y: -ph * 12, z: -6.5, s: 0.3, pitch: t * 4 }); }
  }
  MK(cam, t, out, sub === 0 ? -3.0 : 3.5, 0, sub === 0 ? 2.5 : 4.5, "nervous", {}, 1);
};
// ---- 8 the fourth rocket (POV) and the contract ----
const s8 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const y = ST.r4Alt(t), x = ST.SLOT[1][0], z = ST.SLOT[1][2], ign = ST.r4Ign();
  if (sub === 0) {
    sv(out, { k: "rocket", x, y, z, s: ST.ROCK_S });
    sv(out, { k: "flame", x, y: y + 0.3, z, s: 4, a: t > ign ? 3.2 : 0, b: t * 40 });
    soft(out, "255,170,60", t > ign ? 0.85 : 0, x, y + 0.5, z + 1, 24);
    for (let i = 0; i < 18; i++) { const tp = t - i * 0.09; if (tp < ign) continue; const yy = ST.r4Alt(tp), age = i * 0.09; sv(out, { k: "smoke", x: x + hh(i, 1) * 2 - 1, y: Math.max(0.6, yy - 2), z: z + hh(i, 2) * 2 - 1, s: 2.4 + age * 8 }); }
    for (let i = 0; i < 6; i++) { const a = i * 1.05, dt = t - ign + 0.3; if (dt > 0 && dt < 3) sv(out, { k: "smoke", x: x + Math.cos(a) * (3 + 7 * dt), y: 1 + 0.8 * dt, z: z + Math.sin(a) * (2 + 4 * dt), s: 3 + 3 * dt }); }
    MK(cam, t, out, 1, 0, -14, "laugh", {}, 1.2);
    [[-8, -17], [8, -15]].forEach(([px, pz], i) => MK(cam, t, out, px, 0, pz, "laugh", {}, 1.2, ENG(i + 1), "e" + i, 30 + i));
  } else {
    const D = ST.DESK, tg = wtf(8, "signed", 0.3), tb = wtf(8, "billion", 0.6);
    MK(cam, t, out, D[0], 0, D[2] - 1.5, "smile_closed", {}, 1, OFFICIAL, "off", 5);
    MK(cam, t, out, 5.0, 0, 2.7, "grin", {}, 1);
    sv(out, { k: "contract", x: D[0], y: D[1] + 0.07, z: D[2] + 0.2, s: 1.2, yaw: 0.0 });
    const sg = clamp01((t - tg + 0.3) / 1.0), px = D[0] - 0.55 + 1.1 * sg, pz = D[2] + 0.35 + 0.08 * Math.sin(t * 22);
    sv(out, { k: "pen", x: px, y: D[1] + 0.12, z: pz, s: 1.4, pitch: -0.8, roll: 0.2 });
    for (let i = 0; i < 6; i++) { const a = clamp01((t - tb - i * 0.1) / 0.5); if (a > 0) sv(out, { k: "gcol", x: 10.9 + i * 1.1, y: 0, z: 2.4, a: a * (0.78 + 0.2 * hh(i, 2)), s: 2.6, yaw: i }); }
    sparks(out, t, 20, 13.5, 6, 1.2, 4, tb + 0.8, 0.9);
    if (t > tg + 0.8) confetti(out, t, 30, 8.5, 3, 9, 6, 0.45);
  }
};
// ---- 9 puzzled with question marks ----
const s9 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const tw = wt(9, "how");
  MK(cam, t, out, 0, 0, 0, "nervous", { headTilt: q(7 * Math.sin(t * 1.3) + 4, 4) }, 1);
  const pulse = 1 + 0.14 * Math.sin(t * 9);
  if (sub === 0) sv(out, { k: "qmark", x: 0.62, y: 2.35, z: 0.2, cam: true, s: 2.6 * easeOutS((t - tw + 0.6) / 0.25 + 0.6) * pulse, roll: 0.15 * Math.sin(t * 2.6) });
  else for (let i = 0; i < 3; i++) { const a = t * 0.9 + i * 2.1; sv(out, { k: "qmark", x: Math.cos(a) * 1.5, y: 2.5 + 0.35 * Math.sin(t * 2 + i) + 0.2 * i, z: 0.2 + Math.sin(a) * 0.9, cam: true, s: (2.4 - 0.4 * i) * pulse, roll: 0.2 * Math.sin(t * 2 + i) }); }
};
// ---- 10 the pizza place ----
const pizzaS = (t: number) => ST.PIZZA.s0 + 1.1 * smooth((t - wt(10, "grows", 0)) / 0.6) + 1.0 * smooth((t - wt(10, "grows", 1)) / 0.6);
const s10 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const P = ST.PIZZA, ps = pizzaS(t), cy = ps + 0.35, sx = P.x + 0.6 * ps * 0.38, sy = cy - 0.6 * ps * 0.92;
  sv(out, { k: "pizza", x: P.x, y: cy, z: P.z, s: ps, pitch: Math.PI / 2 });
  sv(out, { k: "pslice", x: P.x, y: cy, z: P.z, s: ps, pitch: Math.PI / 2 });
  for (const sx2 of [-1, 1]) sv(out, { k: "pblock", x: P.x + sx2 * (0.55 * ps), y: 0, z: P.z - 0.25, a: 0.18, b: cy - 0.2, c: 0.2, yaw: 0, roll: -sx2 * 0.12 });
  soft(out, "255,190,80", 0.55 + 0.2 * Math.sin(t * 4), sx, sy, P.z + 0.5, 1.7 * ps);
  MK(cam, t, out, Math.max(2.1, sx + 1.5), 0, P.z + 0.7, sub === 0 ? "smile_closed" : "grin", {}, 1);
  if (sub === 0) sv(out, { k: "mbag", x: -1.8, y: 0, z: -1.4, s: 2.6, roll: 0.1 });
  if (sub >= 1) {
    sv(out, { k: "pblock", x: -2.9, y: 0, z: -1.0, a: 1.0, b: 0.85, c: 0.8, yaw: 0.2 });
    sv(out, { k: "pizza", x: -2.9, y: 0.88, z: -1.0, s: 0.42, yaw: 0.4 });
    sv(out, { k: "pslice", x: -2.9, y: 0.88, z: -1.0, s: 0.42, yaw: 0.4 });
    MK(cam, t, out, -2.9, 0, -2.0, "smile", {}, 1, SELLER, "seller", 6);
  }
  for (let i = 0; i < 10; i++) { const a = t * 0.3 + i * 0.63; sv(out, { k: "spark", x: sx + Math.cos(a) * (0.6 * ps), y: sy + Math.sin(a * 1.3) * 0.5 * ps, z: P.z + 0.7, s: 1.6 }); }
};
// ---- 11 pie charts: Tesla car and rocket, big wedges pulled out ----
const s11 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const g = sub === 0 ? 0 : smooth((t - wt(11, "so", 0)) / 0.8) + 0.9 * smooth((t - wt(11, "so", 1)) / 0.8) * 0, pull = easeOutS((t - lineStart(11) - 0.25) / 0.7);
  const ps = 2.0 + 0.9 * g, z = -1.8 - 0.4 * g;
  sv(out, { k: "pie", x: -3.1 - 0.4 * g, y: 0, z, s: ps, a: 0.45 * pull, b: 0.6, yaw: 0.2 });
  sv(out, { k: "pie", x: 3.1 + 0.4 * g, y: 0, z, s: ps, a: 0.45 * pull, b: 0.6, yaw: -0.2 });
  sv(out, { k: "car", x: -3.1 - 0.4 * g, y: 0.3 * ps, z, s: 1.6 + 0.9 * g, yaw: 2.2 });
  sv(out, { k: "rocket", x: 3.1 + 0.4 * g, y: 0.3 * ps, z, s: 3.0 + 1.6 * g });
  MK(cam, t, out, 0, 0, -0.5, sub === 0 ? "grin" : "laugh", {}, 1);
  if (sub === 1) for (let i = 0; i < 16; i++) { const t0 = wt(11, "so", 0) + 0.3 + i * 0.09, dt = t - t0; if (dt > 0 && dt < 1.2) sv(out, { k: "gbar", x: (hh(i, 1) - 0.5) * 3.2, y: Math.max(0.1, 4 - 9 * dt * dt), z: -0.3 + hh(i, 2), s: 1.4, yaw: i, pitch: dt * 6 }); else if (dt >= 1.2) sv(out, { k: "gbar", x: (hh(i, 1) - 0.5) * 3.2, y: 0.07, z: -0.3 + hh(i, 2), s: 1.4, yaw: i }); }
  sparks(out, t, 20, 0, 2.2, -1.2, 5, lineStart(11) + 0.4, 1.0);
  if (sub === 1) confetti(out, t, 20, 0, -1, 7, 6, 0.5);
};
// ---- 12 rising gold tower with notches ----
const s12 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const T = ST.TOWER, H = ST.towerH(t), bh = T.blk, n = Math.floor(H / bh), fr = H / bh - n, hit = ST.hitTimes12();
  for (let i = 0; i < Math.min(n, 24); i++) sv(out, { k: "gblk", x: T.x, y: i * bh, z: T.z, s: 2.4, yaw: i * 0.05 });
  if (n < 24 && fr > 0.02) sv(out, { k: "gblk", x: T.x, y: n * bh, z: T.z, s: 2.4 * fr, yaw: n * 0.05 });
  [[T.h206, hit.t206], [T.h1000, hit.t1000]].forEach(([h, th], i) => { if (t > th) { const g = easeOutS((t - th) / 0.3); sv(out, { k: "mmark", x: -7.3, y: h, z: -11.2, s: 1 + 0.2 * g, a: 1 }); sparks(out, t, 18, -7.3, h, -11, 5, th, 0.9); void i; } });
  soft(out, "255,210,100", 0.45, T.x, H + 2, T.z + 2, 8 + 0.2 * H);
  MK(cam, t, out, -2.6, 0, -8.0, sub === 0 ? "grin" : "laugh", {}, 1.4);
  if (sub === 1) { confetti(out, t, 26, -4, -10, 9, Math.max(8, H), 0.6); fxp(out, "sp12", 400, 300, (p) => fxStreak(p, 3), -1, H, -9, 7, 5); }
};
// ---- 13 race ----
const runner = (cam: CamInfo, t: number, out: Stage, who: "musk" | "bezos", z: number, i: number, expr: Expr) => {
  const x = ST.runX(who, t), ph = q(((t * 2.4 + (who === "musk" ? 0.3 : 0)) % 1 + 1) % 1, 60), o = who === "musk" ? MUSK : BEZOS;
  const view = viewOf(cam, x, z, 1, 0), key = who;
  out.places.push(person(cam, { i, o, okey: key }, x, 0, z, view, { mode: "march", phase: ph, expr, blink: 0, energy: 1 }, { mode: "march", phase: ph, expr, stride: 1.5 * view.fs, stomp: 0.7 }, 1));
  blob(out, x, 0, z);
};
const s13 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const P = ST.TRACK.podium;
  if (sub < 2) {
    runner(cam, t, out, "bezos", 1.0, 1, "grin"); runner(cam, t, out, "musk", 2.8, 0, "laugh");
    const tp = wtf(13, "passed", 0.35);
    if (t > tp) sparks(out, t, 14, ST.runX("musk", t), 1.5, 2.8, 4, tp, 0.8);
    confetti(out, t, 20, ST.runX("musk", t) + 4, 2, 14, 7, 0.4);
    if (sub === 0) for (let i = 0; i < 2; i++) fxp(out, `dst${i}`, 300, 300, (p) => fxPuff(p, 0.35 + 0.2 * i), ST.runX("bezos", t) - 1 - i * 1.2, 0.5, 1.2, 1.6, 1.6, { soft: true });
  } else {
    const tf = wtf(13, "become", 0.5) + 0.3, k = smooth((t - tf) / 0.7), hop = Math.sin(Math.PI * clamp01((t - tf) / 0.7)) * 1.6;
    const hts = [2.2, 1.6, 1.1], xs = [P, P - 2.6, P + 2.6];
    xs.forEach((x, i) => sv(out, { k: "pblock", x, y: 0, z: 1, a: 2.3, b: hts[i], c: 2.1 }));
    const bx = lip(P, P - 2.6, k), mx = lip(P - 2.6, P, k), by = lip(hts[0], hts[1], k) + hop, my = lip(hts[1], hts[0], k) + hop;
    MK(cam, t, out, bx, by, 1, k > 0.5 ? "sad" : "grin", {}, 1, BEZOS, "bezos", 1);
    MK(cam, t, out, mx, my, 1, "laugh", {}, 1, MUSK, "musk", 0);
    MK(cam, t, out, P + 2.6, hts[2], 1, "smile", {}, 1, ENG(2), "e2", 7);
    confetti(out, t, 60, P, 1, 12, 9, 0.5); sparks(out, t, 20, P, 4, 1, 5, tf, 1.0);
    soft(out, "255,230,150", 0.4 * k, P, 3.5, 0.2, 7);
  }
};
// ---- 14 the blue bubble tower and a truck of gold ----
const s14 = (cam: CamInfo, t: number, out: Stage, sub: number, u: number) => {
  const BT = ST.BTOWER;
  if (sub === 0) MK(cam, t, out, 8.5, 0, -12, "grin", {}, 1.3);
  if (sub === 1) {
    const k = ST.glide(u), z = lip(6, -24, k);
    sv(out, { k: "mtruck", x: -1, y: 0, z, s: 1.0, yaw: Math.PI });
    for (let i = 0; i < 5; i++) sv(out, { k: "smoke", x: -1 + hh(i, 1) - 0.5, y: 0.5, z: z + 3 + i * 1.3, s: 0.9 + 0.2 * i });
    MK(cam, t, out, 4.2, 0, -10, "laugh", {}, 1.2);
  }
  if (sub === 2) {
    const tp = lineStart(14);
    void tp;
    sv(out, { k: "mtruck", x: -1, y: 0, z: -24, s: 1.0, yaw: Math.PI });
    const t0 = wtf(14, "which", 0.5), per = 0.14;
    for (let n = 0; n < 40; n++) { const ts = t0 + n * per, k = (t - ts) / 0.9; if (k >= 0 && k <= 1) { const p = arc([-1, 2.4, -25], [BT[0] - 3, 0.4, -33], k, 5); sv(out, { k: "gbar", x: p[0], y: p[1], z: p[2], s: 1.6, yaw: k * 5, pitch: k * 4 }); } }
    const pg = clamp01((t - t0) / 3.0); if (pg > 0.02) sv(out, { k: "pile", x: BT[0] - 3, y: 0, z: -33, s: 0.5 + 5 * pg, yaw: 0.2 });
    MK(cam, t, out, 3.2, 0, -26, "laugh", {}, 1.2);
    confetti(out, t, 24, BT[0] - 3, -33, 12, 10, 0.5);
  }
  soft(out, "190,230,255", 0.3, BT[0], 46, BT[2] + 10, 36);
};
// ---- 15-17 gold hill, podium, crown, Page, stacked piles, envelope ----
const hillScene = (cam: CamInfo, t: number, out: Stage, withMusk: boolean) => {
  const H = ST.HILL, s = ST.HILL_S;
  sv(out, { k: "pile", x: H[0], y: 0, z: H[2], s, yaw: 0.8 });
  sv(out, { k: "pblock", x: H[0], y: 13.0, z: H[2], a: 4.4, b: 3.2, c: 3.6 });
  if (withMusk) {
    MK(cam, t, out, H[0], 16.2, H[2] + 0.2, "grin", {}, 1.5);
    sv(out, { k: "crown", x: H[0], y: 16.2 + 3.7 + 0.25 * Math.sin(t * 2.5), z: H[2] + 0.2, s: 2.2, yaw: t * 1.4 });
    soft(out, "255,220,110", 0.7 + 0.2 * Math.sin(t * 5), H[0], 20.0, H[2] - 0.5, 9);
    for (let i = 0; i < 12; i++) { const a = t * 1.1 + i * 0.52; sv(out, { k: "spark", x: H[0] + Math.cos(a) * 2.2, y: 20 + Math.sin(a * 2) * 1.1, z: H[2] + 0.2 + Math.sin(a) * 1.4, s: 1.3 }); }
  }
  soft(out, "255,205,90", 0.5, H[0], 9, H[2] - 6, 42, 26);
};
const s15 = (cam: CamInfo, t: number, out: Stage) => { hillScene(cam, t, out, true); confetti(out, t, 30, 0, -9, 14, 18, 0.35); };
const s16 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  hillScene(cam, t, out, true);
  const PX = ST.PAGE_X, S = ST.SMALL_S;
  sv(out, { k: "pile", x: PX, y: 0, z: -8, s: S, yaw: 0.3 });
  sv(out, { k: "pblock", x: PX, y: 4.3, z: -8, a: 2.2, b: 1.3, c: 2.2 });
  MK(cam, t, out, PX, 5.6, -7.9, "smile_closed", {}, 1, PAGE, "page", 2);
  if (sub === 1) { const t0 = wtf(16, "that's", 0.6); for (let k = 0; k < 3; k++) { const g = easeOutS((t - t0 - 0.18 * k) / 0.35); if (g > 0.01) sv(out, { k: "pile", x: -6 + 6 * k, y: 0, z: 15, s: 2.8 * g, yaw: 0.5 * k }); } }
};
const s17 = (cam: CamInfo, t: number, out: Stage, sub: number) => {
  const H = ST.HILL, s = ST.HILL_S, tw = wtf(17, "salary", 0.5);
  sv(out, { k: "pile", x: H[0], y: 0, z: H[2], s, yaw: 0.8 });
  sv(out, { k: "pblock", x: H[0], y: 13.0, z: H[2], a: 4.4, b: 3.2, c: 3.6 });
  sv(out, { k: "crown", x: H[0], y: 20.2, z: H[2], s: 2.2, yaw: t * 1.4 });
  const k = smooth((t - tw + 0.25) / 0.5);
  MK(cam, t, out, 1.0, 0, 9.5, "smile_closed", { shrug: q(k, 20), headTilt: q(5 * k, 4) }, 1);
  if (sub === 1 || t > tw - 0.4) { sv(out, { k: "env", x: -0.5, y: 0.04, z: 11.2, s: 3.0, yaw: 0.3 }); sv(out, { k: "coin", x: 0.05, y: 0.05, z: 11.55, s: 3.0, pitch: Math.PI / 2 }); }
  soft(out, "255,205,90", 0.5, H[0], 9, H[2] - 6, 42, 26);
};
// ---- 18 finale: Musk on top of the rocket, three wrecks smoking ----
const s18 = (cam: CamInfo, t: number, out: Stage) => {
  const RZ = -34;
  sv(out, { k: "rocket", x: 0, y: 0, z: RZ, s: 14 });
  sv(out, { k: "pblock", x: 0, y: 14.2, z: RZ, a: 2.2, b: 0.3, c: 2.2 });
  MK(cam, t, out, 0, 14.5, RZ + 0.2, "laugh", {}, 1.7);
  [[-6, -14, 5, 0.4], [5.5, -12, 5, -0.7], [-0.8, -8.5, 4.5, 1.9]].forEach(([x, z, s, yaw], k) => {
    sv(out, { k: "wreck", x, y: 0, z, s, yaw });
    soft(out, "255,140,40", 0.55 + 0.2 * Math.sin(t * 9 + k), x, 1.0, z + 0.5, 4.2);
    for (let i = 0; i < 6; i++) { const age = ((t * 0.3 + i / 6 + k * 0.17) % 1); sv(out, { k: "dsmoke", x: x + hh(i, k) * 1.6 - 0.8 + 1.4 * age, y: 1.2 + age * 8, z: z + 0.2, s: 0.5 + age * 1.9 }); }
  });
  confetti(out, t, 70, 0, -14, 22, 20, 0.4);
  [[-12, -22], [11, -24]].forEach(([x, z], i) => MK(cam, t, out, x, 0, z, "laugh", {}, 1.4, ENG(i + 2), "e" + i, 40 + i));
  soft(out, "255,200,120", 0.5, 0, 16, RZ - 3, 14);
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [], solids: [] };
  const s = SHOTS[id - 1], u = shotU(id, f);
  LNAME = s.light; SUN = cam.sun.clone().normalize();
  switch (s.line) {
    case 1: s1(cam, t, out, s.sub); break;
    case 2: s2(cam, t, out, s.sub); break;
    case 3: s3(cam, t, out, s.sub); break;
    case 4: s4(cam, t, out, s.sub, u); break;
    case 5: s5(cam, t, out, s.sub); break;
    case 6: s6(cam, t, out, s.sub); break;
    case 7: s7(cam, t, out, s.sub); break;
    case 8: s8(cam, t, out, s.sub); break;
    case 9: s9(cam, t, out, s.sub); break;
    case 10: s10(cam, t, out, s.sub); break;
    case 11: s11(cam, t, out, s.sub); break;
    case 12: s12(cam, t, out, s.sub); break;
    case 13: s13(cam, t, out, s.sub); break;
    case 14: s14(cam, t, out, s.sub, u); break;
    case 15: s15(cam, t, out); break;
    case 16: s16(cam, t, out, s.sub); break;
    case 17: s17(cam, t, out, s.sub); break;
    case 18: s18(cam, t, out); break;
  }
  return out;
};
export { FPS, fxBurst };
void lineStart; void lineEnd; void lf; void fxPuff; void bodySide;
