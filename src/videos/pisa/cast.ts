// The Pisa cast as lit flat sprites in the 3D world (same machinery as the bridge short): every character asks for a
// drawing (key + draw call) each frame; the pool keeps one canvas per distinct drawing. Characters are yaw-only
// billboards shaded by cardShade(); standing ones get a contact blob (+ a sun-direction tail by day). Effects are
// unlit cards. Cards, effects and blobs live on the NOINK layer so the world ink never outlines their quads.
// Roles: Beppe the mason (coif, leather apron) and his grandson (same face, red cap), masons, Pisan soldiers (red,
// white cross) vs Lucca (white over red), the 1990 official, engineers (hard hats, hi-vis), tourists, a bus commuter.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, SKINS, fxBurst, fxStars, fxCreak, fxPuff, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, Prop } from "./toon";
import {
  FPS, SHOTS, V3, clamp01, smooth, wt, RW, Q1, Q12, BUMP17, BUMP18, BEPPE, GATE, GRANDSON, OFFICIAL, ENGINEER, COMMUTER, FOREMAN, TOURIST_END,
  BARRIER_R, Light,
} from "./story";
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
export type Place = { key: string; draw: (p: Pen) => void; x: number; y: number; z: number; scale?: number; mirror?: boolean; yaw?: number; roll?: number; size?: [number, number, number] };
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
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- outfits ----------------
const BEPPE_O: Outfit = { jacket: "#c9873a", pants: "#5a4a3c", boots: "#5a3b2a", hat: "coif", cap: "#efe3c8", apron: "#7a4f33", skin: SKINS[1], moustache: "#4a3020" };
const GRANDSON_O: Outfit = { jacket: "#3f8f5a", pants: "#5a4a3c", boots: "#5a3b2a", hat: "cap", cap: "#c0353a", apron: "#7a4f33", skin: SKINS[1] };
const MASON = (v: number): Outfit => ({ jacket: ["#8c3b4a", "#5d7a3a", "#2f5f6a", "#b5653f"][v % 4], pants: "#4a4038", boots: "#5a3b2a", hat: "coif",
  cap: ["#e9dcc0", "#d6b46a", "#c9b79a"][v % 3], skin: SKINS[(v + 2) % 4], apron: v % 2 ? "#7a4f33" : undefined });
const PISAN = (v: number): Outfit => ({ jacket: "#c8323a", cross: "#f4f0e6", pants: "#4a4038", boots: "#3a2c22", hat: "kettle", skin: SKINS[v % 4], moustache: v % 3 === 1 ? "#4a3426" : undefined });
const LUCCA = (v: number): Outfit => ({ jacket: "#f4f0e6", lower: "#c8323a", pants: "#4a4038", boots: "#3a2c22", hat: "kettle", skin: SKINS[(v + 1) % 4], moustache: v % 3 === 2 ? "#2a201a" : undefined });
const ENGINEER_O = (v = 0): Outfit => ({ jacket: "#f08a2c", stripes: "#f4f0e6", pants: "#3b4a6a", boots: "#4a3426", hat: "hardhat", cap: v % 2 ? "#f4f0e6" : "#f2c230", skin: SKINS[v % 4], moustache: v === 0 ? "#3a2a22" : undefined });
const OFFICIAL_O: Outfit = { jacket: "#2f3a5a", pants: "#2f3a5a", boots: "#1d1b22", hat: "hair", hair: "#3a2a22", buttons: "#e8c45a", moustache: "#3a2a22", build: "stout", skin: SKINS[2] };
const TOURIST = (v: number): Outfit => ({ jacket: ["#e1669d", "#446391", "#f2c230", "#5ab0c8", "#8971be", "#e2453c"][v % 6], pants: ["#3b4a6a", "#e9dcc0", "#3b3f52"][v % 3],
  boots: "#f4f1ea", hat: v % 3 === 0 ? "cap" : "hair", cap: ["#2f5f9a", "#e2453c", "#3f8f5a"][v % 3], hair: ["#5a3b2a", "#2a201a", "#d9a441", "#8a5a34"][v % 4], skin: SKINS[v % 4],
  build: v % 7 === 3 ? "kid" : undefined });
const COMMUTER_O: Outfit = { jacket: "#446391", pants: "#3b3f52", boots: "#2a2a33", hat: "hair", hair: "#5a3b2a", skin: SKINS[0], belt: null };

// ---------------- crowds ----------------
const tourists = (cam: CamInfo, t: number, out: Stage, id: number) => {
  const shockT = id === 1 ? Q1[0] : -1;
  const spots: [number, number][] = [[-6, 30], [-2.5, 26], [3.5, 28], [7, 33], [-9, 40], [1, 38], [10, 42], [-4, 46], [5.5, 48], [-12, 24], [12, 26], [-1, 21]];
  spots.forEach(([x, z], i) => {
    const o = TOURIST(i), kid = o.build === "kid";
    const scared = shockT > 0 && t > shockT - 0.07 && t < shockT + 1.2;
    const expr: Expr = scared ? (i % 2 ? "shock" : "nervous") : (["smile", "grin", "smile_closed", "laugh"] as Expr[])[i % 4];
    const fo: FrontOpts = { mode: "stand", expr, blink: lidAt(t, i + 30), wave: i % 4 === 1 && !scared ? q(Math.sin(t * 5 + i), 20) : undefined, prop: i % 5 === 2 ? "palm" : i % 4 === 3 && !scared ? "camera" : null, facing: (i % 3) - 1 as -1 | 0 | 1 };
    out.places.push(person(cam, { i: i + 30, o, okey: `t${i}` }, x, 0, z, FRONT, fo, {}, kid ? 0.72 : 1));
    blob(out, x, 0, z, kid ? 0.72 : 1);
  });
};

const masons = (cam: CamInfo, t: number, out: Stage) => {
  const PY = -0.6;
  const spots: [number, number, Prop, Expr][] = [[-3, 8.6, "block", "stern"], [4.4, 8.2, "trowel", "neutral"], [-6.6, 6.2, "trowel", "smile"], [7.2, 5.2, "block", "stern"]];
  spots.forEach(([x, z, prop, expr], i) => {
    out.places.push(person(cam, { i: i + 10, o: MASON(i), okey: `m${i}` }, x, PY, z, FRONT, { mode: "stand", expr, prop, blink: lidAt(t, i + 10), facing: x < 0 ? 1 : -1 }));
    blob(out, x, PY, z);
  });
  // Beppe lays the first ring
  out.places.push(person(cam, { i: 1, o: BEPPE_O, okey: "beppe" }, 1.2, PY, 9.4, FRONT, { mode: "stand", expr: "smile_closed", prop: "trowel", blink: lidAt(t, 1) }));
  blob(out, 1.2, PY, 9.4);
  // a boot sinking into the soggy ground right by the lens
  const sink = 0.05 + 0.22 * smooth((t - wt(2, "soggy")) / 0.7);
  out.places.push(person(cam, { i: 14, o: MASON(5), okey: "m5" }, 4.6, -sink, 16.6, FRONT, { mode: "stand", expr: sink > 0.15 ? "nervous" : "neutral", prop: "block", blink: lidAt(t, 14), facing: -1 }));
};

const beppeLevel = (cam: CamInfo, t: number, out: Stage, lean: number) => {
  const shocked = t > wt(3, "sinking") - 0.07;
  out.places.push(person(cam, { i: 1, o: BEPPE_O, okey: "beppe" }, BEPPE[0], 0, BEPPE[2], FRONT,
    { mode: "stand", expr: shocked ? "shock" : "neutral", prop: ["level", q(Math.min(1, lean / 3), 20)], blink: shocked ? 0 : lidAt(t, 1), facing: -1 }));
  blob(out, BEPPE[0], 0, BEPPE[2]);
  for (const [i, x, y, z] of [[11, -3.4, 6.06, 9.35], [12, 4.2, 12.06, 9.0]] as const) {
    out.places.push(person(cam, { i, o: MASON(i), okey: `m${i}` }, x, y, z, FRONT, { mode: "stand", expr: shocked ? "shock" : "stern", prop: "trowel", blink: lidAt(t, i) }));
    blob(out, x, y, z);
  }
  if (shocked && t < wt(3, "sinking") + 1.6) groan(t, out, [[-7.5, 1.4, 6.5], [-8.2, 4.5, 4.5]]);
};
const groan = (t: number, out: Stage, pts: V3[], size = 1.6) => pts.forEach(([x, y, z], i) => {
  const u = q((t * 1.3 + i * 0.37) % 1, 30);
  out.fx.push({ key: `creak${u}`, cw: 300, ch: 300, draw: (p) => fxCreak(p, u), x, y, z, w: size, h: size, rot: i * 0.6 - 0.6 });
});

const march = (cam: CamInfo, t: number, out: Stage) => {
  const tc = wt(4, "but") + 9 / FPS - 2 / FPS;
  if (t < tc) { // Beppe looks at the tilted stump and scratches his head
    out.places.push(person(cam, { i: 1, o: BEPPE_O, okey: "beppe" }, BEPPE[0], 0, BEPPE[2], FRONT, { mode: "stand", expr: "nervous", prop: "trowel", blink: lidAt(t, 1), look: -1, facing: -1 }));
    blob(out, BEPPE[0], 0, BEPPE[2]);
    return;
  }
  // the column marches out of the west gate toward +x; Beppe (coif, apron) has joined the front row with a spear
  const front = GATE[0] + 4 + 1.5 * (t - tc + 1.2), ph = ((t * 1.0) % 1 + 1) % 1;
  for (let i = 0; i < 18; i++) {
    const row = Math.floor(i / 3), file = i % 3, x = front - row * 1.45 + (hh(i) - 0.5) * 0.1, z = GATE[2] - 1.5 + file * 1.5;
    if (x < GATE[0] + 2) continue;
    const beppe = i === 2;
    const who: Who = beppe ? { i: 1, o: BEPPE_O, okey: "beppe" } : { i: i + 40, o: PISAN(i), okey: `p${i % 4}` };
    const view = viewOf(cam, x, z, 1, 0);
    const fo: FrontOpts = { mode: "march", phase: q(ph, 60), expr: beppe ? "grin" : i % 4 === 1 ? "grin" : "stern", prop: "spear", blink: lidAt(t, i + 40), lift: 50 };
    const so: SideOpts = { mode: "march", phase: q(ph, 60), expr: beppe ? "grin" : "stern", stride: view.fs, stomp: 1 };
    out.places.push(person(cam, who, x, 0, z, view, fo, so));
    blob(out, x, 0, z);
  }
};

const battle = (cam: CamInfo, t: number, out: Stage) => {
  const bonk = (x: number) => Math.max(0, Math.sin(2 * Math.PI * (t / 0.9) + x)) ** 3;
  for (let i = 0; i < 8; i++) {
    const pisa = i < 4, k = i % 4, row = k < 2 ? 0 : 1, sx = pisa ? -1 : 1;
    const x = sx * (0.75 + (k % 2) * 1.25 + row * 0.5), z = -row * 1.7 + (hh(i) - 0.5) * 0.2;
    const b = row === 0 ? bonk(k * 0.7) : 0;
    const o = pisa ? PISAN(k) : LUCCA(k);
    const late = t > wt(5, "hundred") - 0.07;
    const expr: Expr = row === 0 ? (b > 0.6 ? "pained" : late ? "dazed" : "stern") : (late ? "nervous" : "grin");
    const fo: FrontOpts = { mode: "stand", expr, prop: "spear", shield: pisa ? ["#c8323a", "#f4f0e6", "cross"] : ["#f4f0e6", "#c8323a", "half"], facing: 1,
      tilt: q(10 * b, 10), blink: lidAt(t, i + 60) };
    out.places.push({ ...person(cam, { i: i + 60, o, okey: pisa ? `p${k}` : `l${k}` }, x - sx * 0.15 * b, 0, z, FRONT, fo), mirror: !pisa });
    blob(out, x, 0, z);
  }
  // dust and stars where the front shields meet
  for (const [k, z] of [[0, 0], [0.7, 0.05]] as const) {
    const ph = ((t / 0.9 + k / (2 * Math.PI)) % 1 + 1) % 1, u = q(ph, 30);
    if (ph < 0.6) out.fx.push({ key: `puff${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u / 0.6), x: 0, y: 1.0 + k * 0.3, z: z + 0.2, w: 1.4, h: 1.4, soft: true });
  }
  if (t > wt(5, "hundred") - 0.07) { const u = q((t * 0.9) % 1, 30); out.fx.push({ key: `stars${u}`, cw: 420, ch: 210, draw: (p) => fxStars(p, u), x: 0.75, y: 2.2, z: 0.05, w: 0.8, h: 0.4 }); }
};

const grandson = (cam: CamInfo, t: number, out: Stage, id: number) => {
  const fixed = id === 8 && t > wt(8, "fixed") - 0.07;
  const expr: Expr = id === 7 ? "stern" : fixed ? "grin" : "smile_closed";
  const prop: Prop = id === 7 ? "block" : fixed ? null : "trowel";
  out.places.push(person(cam, { i: 1, o: GRANDSON_O, okey: "grandson" }, GRANDSON[0], 0, GRANDSON[2], FRONT, { mode: "stand", expr, prop, blink: lidAt(t, 2), facing: id === 8 ? 0 : -1,
    headTilt: fixed ? -4 : 0, wave: id === 8 && !fixed ? q(Math.sin(t * 14), 10) : undefined }));
  blob(out, GRANDSON[0], 0, GRANDSON[2]);
  if (id === 8 && !fixed) { const u = q((t * 2.4) % 1, 30); out.fx.push({ key: `puff${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u), x: GRANDSON[0] + 0.3, y: 1.3, z: GRANDSON[2] + 0.1, w: 0.6, h: 0.6, soft: true }); }
  if (id === 7) for (const [i, x, y, z] of [[21, -5.6, 0, 12.6], [23, 6.8, 0, 13.6]] as const) {
    out.places.push(person(cam, { i, o: MASON(i), okey: `m${i}` }, x, y, z, FRONT, { mode: "stand", expr: "neutral", prop: i === 23 ? "block" : "trowel", blink: lidAt(t, i) }));
    blob(out, x, y, z);
  }
};

const closing = (cam: CamInfo, t: number, out: Stage) => {
  out.places.push(person(cam, { i: 90, o: OFFICIAL_O, okey: "official" }, OFFICIAL[0], 0, OFFICIAL[2], FRONT, { mode: "stand", expr: "stern", prop: "stop", blink: lidAt(t, 90), facing: 1 }));
  blob(out, OFFICIAL[0], 0, OFFICIAL[2], 1.1);
  for (let i = 0; i < 7; i++) {
    const x = -6 + i * 2.1 + hh(i) * 0.8, z = BARRIER_R + 3 + (t - 30.4) * 0.9 + hh(i, 2) * 4, ph = q(((t * 0.7 + hh(i, 3)) % 1), 60);
    const view = viewOf(cam, x, z, 0, 1);
    out.places.push(person(cam, { i: i + 30, o: TOURIST(i), okey: `t${i}` }, x, 0, z, view, { mode: "stroll", phase: ph, expr: i % 2 ? "pained" : "nervous", blink: lidAt(t, i + 30), look: -1 },
      { mode: "march", phase: ph, expr: "nervous", stride: 0.7 * view.fs, stomp: 0.55 }, TOURIST(i).build === "kid" ? 0.72 : 1));
    blob(out, x, 0, z);
  }
  engineer(cam, t, out, 10);
};
const engineer = (cam: CamInfo, t: number, out: Stage, id: number) => {
  let expr: Expr = "neutral", prop: Prop = "clipboard";
  if (id === 11) expr = t > wt(11, "finish") - 0.07 ? "nervous" : "stern";
  if (id === 12) expr = "shock";
  if (id === 13) { prop = "clipboardUp"; expr = t > wt(13, "standing") - 0.07 ? "shock" : t > wt(13, "how") - 0.07 ? "nervous" : "neutral"; }
  out.places.push(person(cam, { i: 80, o: ENGINEER_O(0), okey: "eng0" }, ENGINEER[0], 0, ENGINEER[2], FRONT, { mode: "stand", expr, prop, blink: id === 13 && expr === "shock" ? (t > wt(13, "standing") + 0.25 && t < wt(13, "standing") + 0.38 ? 1 : 0) : lidAt(t, 80), facing: 1, look: id === 13 ? -1 : 0 }));
  blob(out, ENGINEER[0], 0, ENGINEER[2]);
};
const quakeCrowd = (cam: CamInfo, t: number, out: Stage) => {
  for (const [i, x, z] of [[80, -3.2, 19.0], [81, 2.5, 17.5], [82, 6.5, 15.5]] as const) {
    const jump = Q12.some((h) => t > h - 0.07 && t < h + 0.25) ? 0.12 : 0;
    out.places.push(person(cam, { i, o: ENGINEER_O(i - 80), okey: `eng${i - 80}` }, x, jump, z, FRONT, { mode: "stand", expr: "shock", prop: i === 80 ? "clipboard" : null, blink: 0 }));
    blob(out, x, 0, z, 1, jump ? 0.6 : 1);
  }
  for (const h of Q12) if (t >= h - 0.07 && t < h + 0.6) {
    const u = q((t - h + 0.07) / 0.67, 30);
    for (const [x, z] of [[-8.5, 3], [6, 6.5], [-2, 8.4]] as const) out.fx.push({ key: `puff${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u), x, y: 1.2, z, w: 5, h: 5, soft: true });
  }
};

const bus = (cam: CamInfo, t: number, out: Stage, id: number) => {
  let knee = 0, dy = 0, expr: Expr = "neutral";
  if (id === 17) {
    const u = t - (BUMP17 - 0.07);
    dy = u > 0 && u < 0.45 ? 0.22 * Math.sin((Math.PI * u) / 0.45) : 0;
    expr = u > 0 ? (u < 0.6 ? "shock" : "pained") : "stern";
  } else if (id === 18) {
    knee = 0.85 * smooth((t - wt(18, "bend") + 0.07) / 0.35);
    const u = t - (BUMP18 - 0.07);
    dy = u > 0 && u < 0.6 ? -0.03 * Math.sin((Math.PI * u) / 0.6) : 0;
    expr = knee > 0.4 ? (u > 0 ? "grin" : "relief") : "nervous";
  }
  out.places.push(person(cam, { i: 70, o: COMMUTER_O, okey: "commuter" }, COMMUTER[0], dy, COMMUTER[2], FRONT, { mode: "stand", expr, prop: "strap", knee: q(knee, 20), blink: id === 17 && expr === "shock" ? 0 : lidAt(t, 70), facing: -1 }));
  blob(out, COMMUTER[0], 0, COMMUTER[2], 1, dy > 0.05 ? 0.5 : 1);
  if (id === 17 && t > BUMP17 - 0.07) {
    const u = q(((t - BUMP17) * 1.1) % 1, 30);
    out.fx.push({ key: `stars${u}`, cw: 420, ch: 210, draw: (p) => fxStars(p, u), x: COMMUTER[0], y: 2.05 + dy, z: COMMUTER[2] + 0.05, w: 0.7, h: 0.35 });
    if (t < BUMP17 + 0.5) groan(t, out, [[COMMUTER[0] - 0.32, 1.25 + dy, 0.05], [COMMUTER[0] + 0.32, 1.0 + dy, 0.05]], 0.35);
  }
  // a dozing passenger on the left bench, another one standing further up the aisle, one more seated at the back
  out.places.push(person(cam, { i: 71, o: TOURIST(4), okey: "pass" }, -0.8, 0.2, -2.4, FRONT, { mode: "sit", expr: "neutral", blink: 1 }));
  out.places.push(person(cam, { i: 72, o: TOURIST(2), okey: "pass2" }, -0.35, 0, -4.4, FRONT, { mode: "stand", expr: "neutral", prop: "strap", blink: lidAt(t, 72), facing: 1, knee: id === 17 && t > BUMP17 ? 0.2 : 0 }));
  out.places.push(person(cam, { i: 73, o: TOURIST(5), okey: "pass3" }, 0.8, 0.2, -6.1, FRONT, { mode: "sit", expr: "smile_closed", blink: lidAt(t, 73) }));
};

const drill = (cam: CamInfo, t: number, out: Stage, id: number, f: number) => {
  const stop = id === 21 && t > wt(21, "stop") - 0.07;
  for (const [i, x, z] of [[85, 10.2, 7.2], [86, 9.4, -0.6], [87, 11.4, 3.4]] as const) {
    const vib = !stop ? q(0.015 * Math.sin(t * 40 + i), 200) : 0;
    out.places.push(person(cam, { i, o: ENGINEER_O(i - 84), okey: `eng${i - 84}` }, x, vib, z, FRONT, { mode: "stand", expr: stop ? "smile" : "grin", prop: "drill", blink: lidAt(t, i), facing: -1 }));
    blob(out, x, 0, z);
  }
  out.places.push(person(cam, { i: 88, o: ENGINEER_O(0), okey: "eng0" }, FOREMAN[0], 0, FOREMAN[2], FRONT,
    { mode: "stand", expr: stop ? "stern" : "smile", prop: stop ? "stop" : "clipboard", blink: lidAt(t, 88), facing: -1 }));
  blob(out, FOREMAN[0], 0, FOREMAN[2]);
  if (id === 20) {
    const u = q((t * 1.7) % 1, 30);
    for (const [x, z] of [[15.2, 3], [14.6, -0.8]] as const) out.fx.push({ key: `puff${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u), x, y: 0.9, z, w: 1.8, h: 1.8, soft: true });
  }
};
const finale = (cam: CamInfo, t: number, out: Stage) => {
  // the classic photo: a tourist "holds up" the leaning side with one palm, friends around
  out.places.push(person(cam, { i: 50, o: TOURIST(1), okey: "t1" }, TOURIST_END[0], 0, TOURIST_END[2], FRONT, { mode: "stand", expr: "grin", prop: "palm", blink: lidAt(t, 50), facing: 1 }));
  blob(out, TOURIST_END[0], 0, TOURIST_END[2]);
  for (const [i, x, z] of [[51, 3.4, 46], [52, -6.5, 41], [53, 6.5, 38], [54, -3, 34]] as const) {
    out.places.push(person(cam, { i, o: TOURIST(i), okey: `t${i}` }, x, 0, z, FRONT, { mode: "stand", expr: i % 2 ? "laugh" : "smile", prop: i === 51 ? "camera" : i === 53 ? "palm" : null, blink: lidAt(t, i), facing: i === 51 ? -1 : 0 }));
    blob(out, x, 0, z);
  }
  // more visitors: photographers lined up at the classic spot, a tour guide by her flag
  for (const [i, x, z, pr] of [[55, 2.6, 51.5, "camera"], [56, -2.2, 47.5, "camera"], [57, 4.8, 43, "palm"], [58, -4.4, 44.6, null], [59, 7.2, 50, "camera"]] as const) {
    out.places.push(person(cam, { i, o: TOURIST(i), okey: `t${i}` }, x, 0, z, FRONT, { mode: "stand", expr: i % 3 ? "grin" : "smile_closed", prop: pr, blink: lidAt(t, i), facing: x > 0 ? -1 : 1 }));
    blob(out, x, 0, z);
  }
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light; SUN = cam.sun.clone().normalize();
  switch (s.crowd) {
    case "tourists": tourists(cam, t, out, id); break;
    case "masons": masons(cam, t, out); break;
    case "beppe": { const k = smooth((t - wt(3, "sinking") + 0.07) / 1.1); beppeLevel(cam, t, out, 0.4 + 3.6 * k); break; }
    case "march": march(cam, t, out); break;
    case "battle": battle(cam, t, out); break;
    case "grandson": grandson(cam, t, out, id); break;
    case "closing": closing(cam, t, out); break;
    case "engineer": engineer(cam, t, out, id); break;
    case "quake": quakeCrowd(cam, t, out); break;
    case "bus": bus(cam, t, out, id); break;
    case "drill": drill(cam, t, out, id, f); break;
    case "final": if (f < RW(21, "because")) drill(cam, t, out, id, f); else finale(cam, t, out); break;
    default: break;
  }
  return out;
};
export { FPS, fxBurst };
