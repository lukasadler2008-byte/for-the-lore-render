// Static scenery: merged batches (one mesh per material), box-section strands rebuilt along a path every frame
// (chains, rails), and the town on both banks: gabled houses with painted facades, church, mill + chimneys, quay,
// hills and CC0 Kenney props (trees, lanterns, stalls, hedges).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { D0, H0, HG, HB, TowerState, SetId, GATE, PIT_R, BARRIER_R } from "./story";
import { NOINK } from "./ink";
import { brick, rng, ctex, rep, facadeHD, roofHD, stoneHD, arcadeTex, coreTex, blindTex, marbleTex, facadeDuomo, mudTex, strataTex, cushionTex, barrierTex, busWindowTex, busFloorTex, seatTex, grassHD } from "./paint";
import { twoTone } from "./shade";

export type Kit = Record<string, THREE.Object3D>;
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- materials (shared, cached) ----------------
const mats = new Map<string, THREE.Material>();
/** materials whose Strands are built as real interlocking chain links (MAT pass) instead of a textured box tube */
const CHAIN_MATS = new WeakSet<THREE.Material>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    if (key === "chainHD") {
      // MAT pass: the chain material (world.ts) becomes slate blue-grey iron with a soft painted-metal highlight;
      // its Strands switch to link geometry, so links read in close-ups (bank f1780, overhead f1650)
      const c = twoTone(new THREE.MeshPhongMaterial({ color: "#7a8490", specular: "#6c727b", shininess: 30 }));
      CHAIN_MATS.add(c);
      m = c as unknown as THREE.MeshLambertMaterial;
    } else m = twoTone(new THREE.MeshLambertMaterial(make()));
    mats.set(key, m);
  }
  return m;
};
const lamOf = new Map<string, THREE.MeshLambertMaterial>();
// the nature kit ships a teal palette; our valley wants storybook greens and browns
const GREENS = ["#62ae4c", "#56a447", "#72b853"];
const RECOLOR: Record<string, string> = { grass: "#6aab4f", leafsDark: "#4a9142", woodBark: "#8a5a3c", woodInner: "#e8cfa4", wood: "#a8724a",
  woodDark: "#7a4f33", dirt: "#8a6a4a", stone: "#b7b4ad" };
/** Kenney GLB materials -> Lambert, so the whole world shares one lighting model */
const toLambert = (m: THREE.Material) => {
  let l = lamOf.get(m.uuid);
  if (!l) {
    const s = m as THREE.MeshStandardMaterial;
    const col = m.name === "leafsGreen" ? GREENS[lamOf.size % 3] : RECOLOR[m.name];
    l = twoTone(new THREE.MeshLambertMaterial({ color: col ? new THREE.Color(col) : s.color?.clone() ?? new THREE.Color("#ffffff"), map: s.map ?? null, side: s.side, alphaTest: s.alphaTest }));
    lamOf.set(m.uuid, l);
  }
  return l;
};

// ---------------- geometry pieces ----------------
const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};
/** quad a,b,c,d counter-clockwise seen from its front; uv (u0,v0) at a, (u1,v1) at c */
export const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u1 = 1, v1 = 1, u0 = 0, v0 = 0) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  return g;
};
export const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  return g;
};
/** axis box from min to max, texture tiled every `tile` metres (0 = one image per face) */
export const boxGeo = (min: THREE.Vector3, max: THREE.Vector3, tile = 0, bottom = false) => {
  const [x0, y0, z0] = [min.x, min.y, min.z], [x1, y1, z1] = [max.x, max.y, max.z];
  const t = (a: number) => (tile ? a / tile : 1);
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const faces = [
    quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), t(w), t(h)),
    quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), t(w), t(h)),
    quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), t(d), t(h)),
    quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), t(d), t(h)),
    quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), t(w), t(d)),
  ];
  if (bottom) faces.push(quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), t(w), t(d)));
  return mergeGeometries(faces, false);
};

/** collects pieces by material and merges them into one static mesh per material */
export class Batch {
  private g = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const x = new THREE.BufferGeometry();
    x.setAttribute("position", f32(src.attributes.position));
    if (src.attributes.normal) x.setAttribute("normal", f32(src.attributes.normal)); else x.computeVertexNormals();
    x.setAttribute("uv", src.attributes.uv ? f32(src.attributes.uv) : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    if (m) x.applyMatrix4(m);
    const l = this.g.get(mat);
    if (l) l.push(x); else this.g.set(mat, [x]);
  }
  addObject(o: THREE.Object3D, m: THREE.Matrix4) {
    o.updateMatrixWorld(true);
    o.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      this.add(mesh.geometry, toLambert(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material), new THREE.Matrix4().multiplyMatrices(m, mesh.matrixWorld));
    });
  }
  build(parent: THREE.Object3D, cast = true) {
    for (const [mat, list] of this.g) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.g.clear();
  }
}

// ---------------- strands: box-section tube along a path, rebuilt in place ----------------
// chain-link template (MAT pass): a stadium-shaped ring tube in link space (x along the chain, y in the ring plane,
// z across), NS centre-line samples x NR tube sides, smooth normals (clean ink silhouettes, no facet creases)
const LNS = 16, LNR = 6;
type LinkT = { p: Float32Array; n: Float32Array; idx: number[]; pitch: number };
const linkTemplate = (h: number): LinkT => {
  const ow = h * 0.85, rb = ow * 0.14, ol = ow * 1.62, rc = ow / 2 - rb, hl = ol / 2 - rb - rc;
  const p = new Float32Array(LNS * LNR * 3), n = new Float32Array(LNS * LNR * 3), idx: number[] = [];
  for (let j = 0; j < LNS; j++) {
    const th = (2 * Math.PI * (j + 0.5)) / LNS, nx = Math.cos(th), ny = Math.sin(th);
    const cx = rc * nx + Math.sign(nx) * hl, cy = rc * ny;
    for (let k = 0; k < LNR; k++) {
      const ph = (2 * Math.PI * k) / LNR, cp = Math.cos(ph), sp = Math.sin(ph), o = (j * LNR + k) * 3;
      p[o] = cx + rb * cp * nx; p[o + 1] = cy + rb * cp * ny; p[o + 2] = rb * sp;
      n[o] = cp * nx; n[o + 1] = cp * ny; n[o + 2] = sp;
      const a = j * LNR + k, b = j * LNR + ((k + 1) % LNR), c = ((j + 1) % LNS) * LNR + ((k + 1) % LNR), d = ((j + 1) % LNS) * LNR + k;
      idx.push(a, d, c, a, c, b); // outward winding
    }
  }
  return { p, n, idx, pitch: ol - 4 * rb };
};

export class Strand {
  mesh: THREE.Mesh;
  private pos: Float32Array; private nor: Float32Array; private uv: Float32Array;
  private lt: LinkT | null = null; private maxLinks = 0;
  constructor(public n: number, public w: number, public h: number, mat: THREE.Material, public tile = 1, cast = true) {
    const g = new THREE.BufferGeometry();
    if (CHAIN_MATS.has(mat)) {
      // link mode: up to maxLinks interlocking links laid along the path every frame (draw range = links used)
      const lt = (this.lt = linkTemplate(h)), nv = LNS * LNR;
      this.maxLinks = 440;
      this.pos = new Float32Array(this.maxLinks * nv * 3); this.nor = new Float32Array(this.maxLinks * nv * 3); this.uv = new Float32Array(this.maxLinks * nv * 2);
      const idx = new Uint32Array(this.maxLinks * lt.idx.length);
      for (let l = 0; l < this.maxLinks; l++) for (let i = 0; i < lt.idx.length; i++) idx[l * lt.idx.length + i] = lt.idx[i] + l * nv;
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(this.nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(this.uv, 2));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.setDrawRange(0, 0);
    } else {
      this.pos = new Float32Array(n * 12); this.nor = new Float32Array(n * 12); this.uv = new Float32Array(n * 8);
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(this.nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(this.uv, 2));
      const idx: number[] = [];
      for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) {
        const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = (i + 1) * 4 + ((k + 1) % 4), d = (i + 1) * 4 + k;
        idx.push(a, b, c, a, c, d);
      }
      g.setIndex(idx);
    }
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.castShadow = cast; this.mesh.receiveShadow = true;
  }
  private T = new THREE.Vector3(); private S = new THREE.Vector3(); private N = new THREE.Vector3();
  /** link mode: links every `pitch` along the polyline, centred, alternating ring plane (vertical / horizontal) */
  private setLinks(pts: THREE.Vector3[], lt: LinkT) {
    const { T, S, N } = this, nv = LNS * LNR;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = cum[cum.length - 1], count = Math.max(0, Math.min(this.maxLinks, Math.floor(total / lt.pitch)));
    const s0 = (total - (count - 1) * lt.pitch) / 2;
    let seg = 1;
    for (let l = 0; l < count; l++) {
      const s = s0 + l * lt.pitch;
      while (seg < pts.length - 1 && cum[seg] < s) seg++;
      const a = pts[seg - 1], b = pts[seg], u = (s - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
      const px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u, pz = a.z + (b.z - a.z) * u;
      T.subVectors(b, a).normalize();
      S.set(-T.z, 0, T.x); // T x up
      if (S.lengthSq() < 1e-6) S.set(1, 0, 0);
      S.normalize(); N.crossVectors(S, T).normalize();
      const odd = l % 2 === 1;
      // ring plane: (T, N) for even links, (T, S) for odd links; z (thickness) across it
      const yx = odd ? S.x : N.x, yy = odd ? S.y : N.y, yz = odd ? S.z : N.z;
      const zx = odd ? -N.x : S.x, zy = odd ? -N.y : S.y, zz = odd ? -N.z : S.z;
      const base = l * nv * 3;
      for (let v = 0; v < nv * 3; v += 3) {
        const x = lt.p[v], y = lt.p[v + 1], z = lt.p[v + 2], o = base + v;
        this.pos[o] = px + T.x * x + yx * y + zx * z;
        this.pos[o + 1] = py + T.y * x + yy * y + zy * z;
        this.pos[o + 2] = pz + T.z * x + yz * y + zz * z;
        const nx = lt.n[v], ny = lt.n[v + 1], nz = lt.n[v + 2];
        this.nor[o] = T.x * nx + yx * ny + zx * nz;
        this.nor[o + 1] = T.y * nx + yy * ny + zy * nz;
        this.nor[o + 2] = T.z * nx + yz * ny + zz * nz;
      }
    }
    const g = this.mesh.geometry;
    g.setDrawRange(0, count * lt.idx.length);
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  }
  set(pts: THREE.Vector3[]) {
    if (this.lt) { this.setLinks(pts, this.lt); return; }
    const { T, S, N } = this;
    let len = 0;
    for (let i = 0; i < this.n; i++) {
      const p = pts[Math.min(i, pts.length - 1)];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      T.subVectors(b, a).normalize();
      S.crossVectors(T, V(0, 1, 0));
      if (S.lengthSq() < 1e-6) S.set(1, 0, 0);
      S.normalize(); N.crossVectors(S, T).normalize();
      if (i) len += p.distanceTo(pts[Math.min(i - 1, pts.length - 1)]);
      for (let k = 0; k < 4; k++) {
        const sx = k === 0 || k === 3 ? -1 : 1, sy = k < 2 ? -1 : 1, j = (i * 4 + k) * 3;
        this.pos[j] = p.x + S.x * sx * this.w / 2 + N.x * sy * this.h / 2;
        this.pos[j + 1] = p.y + S.y * sx * this.w / 2 + N.y * sy * this.h / 2;
        this.pos[j + 2] = p.z + S.z * sx * this.w / 2 + N.z * sy * this.h / 2;
        const nx = S.x * sx + N.x * sy, ny = S.y * sx + N.y * sy, nz = S.z * sx + N.z * sy, nl = Math.hypot(nx, ny, nz);
        this.nor[j] = nx / nl; this.nor[j + 1] = ny / nl; this.nor[j + 2] = nz / nl;
        this.uv[(i * 4 + k) * 2] = k / 4; this.uv[(i * 4 + k) * 2 + 1] = len / this.tile;
      }
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.uv.needsUpdate = true;
  }
}

// ---------------- set dressing around the lens ----------------
/** a sight line of the film: from the lens toward the shot's subject, `len` along d (d has unit forward component) */
export type Ray = { o: THREE.Vector3; d: THREE.Vector3; len: number; core: boolean };
let sight: Ray[] = [];
/** does any sight line pass through this box? (centre lines only for small props, so they can still frame a shot) */
const inTheWay = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, coreOnly = false) => {
  for (const { o, d, len, core } of sight) {
    if (coreOnly && !core) continue;
    let t0 = 0, t1 = len;
    for (const [oo, dd, a, b] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < a || oo > b) t0 = Infinity; continue; }
      const ta = (a - oo) / dd, tb = (b - oo) / dd;
      t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
    }
    if (t0 <= t1) return true;
  }
  return false;
};

// ---------------- cartoon vegetation (MAT pass) ----------------
// Kenney's faceted low-poly trees and box hedges -> rounded storybook shapes: clustered smooth spheres for canopies
// (the two-tone sun term gives each lobe a lit cap and a cool belly), tapered trunks, rounded-box hedges. Smooth
// normals mean the world ink draws clean silhouettes and lobe-to-lobe folds instead of a crease on every facet.
type VegKind = "round" | "fat" | "tall" | "cone" | "bush" | "hedge";
const VEG: Record<string, VegKind> = {
  tree_oak: "round", tree_default: "round", tree_detailed: "round", tree_fat: "fat", "tree-high-round": "tall", tree: "tall",
  tree_cone: "cone", plant_bushLarge: "bush", plant_bushDetailed: "bush", plant_bush: "bush", hedge: "hedge",
};
const LEAF = ["#5aa83c", "#4c9a37", "#69b545", "#55a243", "#3f8f3c"];
/** canopy paint (equal px per metre on a unit sphere: 256 around x 128 pole to pole): light crown, darker belly,
 *  soft leaf-clump dabs (kept low contrast: the two-tone sun term does the main modelling) */
const leafTex = (i: number) => ctex("leafHD" + i, 256, 128, (g, r) => {
  const base = new THREE.Color(LEAF[i]), top = base.clone().offsetHSL(0.012, 0.03, 0.08), bot = base.clone().offsetHSL(-0.015, 0.0, -0.08);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, "#" + top.getHexString()); gr.addColorStop(0.42, "#" + base.getHexString()); gr.addColorStop(1, "#" + bot.getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  for (let k = 0; k < 46; k++) {
    const x = r() * 256, y = 10 + r() * 108, rad = 5 + r() * 9, light = y < 64 ? r() < 0.7 : r() < 0.25;
    for (const ox of [-256, 0, 256]) {
      g.strokeStyle = light ? "rgba(225,255,170,0.22)" : "rgba(20,70,30,0.2)"; g.lineWidth = 2.5; g.lineCap = "round";
      g.beginPath(); g.arc(x + ox, y + rad * 0.6, rad, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
  }
});
export const leafMat = (i: number) => lam("leafHD" + i, () => ({ map: leafTex(i) }));
export const barkMat = () => lam("barkHD", () => ({ color: "#8f5d3b" }));
const vegGeo = new Map<string, THREE.BufferGeometry>();
export const lobeGeo = (q: number) => {
  const k = "lobe" + q;
  let g = vegGeo.get(k);
  if (!g) { g = new THREE.SphereGeometry(1, [20, 14, 10][q], [14, 10, 7][q]); vegGeo.set(k, g); }
  return g;
};
export const trunkGeo = () => {
  let g = vegGeo.get("trunk");
  if (!g) { g = new THREE.CylinderGeometry(0.6, 1, 1, 10, 1, true).translate(0, 0.5, 0); vegGeo.set("trunk", g); }
  return g;
};
/** rounded box (exact: inner box + radius), unit size along x, smooth normals; used for hedges */
const hedgeGeo = () => {
  let g = vegGeo.get("hedge");
  if (!g) {
    g = new THREE.BoxGeometry(1, 1, 1, 18, 10, 10);
    const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute;
    // per-axis rounding radii in unit space (~0.35 m at the ends, ~0.45 m on top / sides at 3.3 x 1.56 x 1.17 m);
    // flat bottom (it sits on the lawn)
    const R = [0.106, 0.29, 0.385], v = new THREE.Vector3(), e = new THREE.Vector3(), q = [0, 0, 0];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      for (let a = 0; a < 3; a++) {
        const c = v.getComponent(a), lim = a === 1 && c < 0 ? 0.5 : 0.5 - R[a];
        q[a] = THREE.MathUtils.clamp(c, -lim, lim); e.setComponent(a, (c - q[a]) / R[a]);
      }
      const L = e.length();
      if (L < 1e-6) continue;
      e.divideScalar(L);
      p.setXYZ(i, q[0] + e.x * R[0], q[1] + e.y * R[1], q[2] + e.z * R[2]);
      const nn = new THREE.Vector3(e.x / R[0], e.y / R[1], e.z / R[2]).normalize();
      n.setXYZ(i, nn.x, nn.y, nn.z);
    }
    g.translate(0, 0.5, 0);
    vegGeo.set("hedge", g);
  }
  return g;
};
const yawQ = (a: number) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a);
/** half-width of a cartoon plant of kind k and height h (for the sight-line test) */
const vegRad = (k: VegKind, h: number) => (k === "hedge" ? 1.7 : k === "bush" ? 0.85 * h : k === "tall" ? 0.2 * h : k === "cone" ? 0.27 * h : k === "fat" ? 0.44 * h : 0.39 * h);
/** add one cartoon plant to a batch: base at (x, y, z), height h, q = lobe detail (0 near .. 2 far) */
const addVeg = (b: Batch, k: VegKind, x: number, y: number, z: number, h: number, seed: number, q = 0) => {
  const r = rng(Math.abs(Math.floor(seed)) % 200000 + 7), U = (a: number, c: number) => a + (c - a) * r();
  const leaf = leafMat(k === "cone" ? 4 : k === "hedge" ? 1 : Math.floor(r() * 4)), lobe = lobeGeo(q), yaw = r() * 6.28;
  const put = (px: number, py: number, pz: number, rad: number, sy = 0.9) =>
    b.add(lobe, leaf, new THREE.Matrix4().compose(V(x + px, y + py, z + pz), yawQ(r() * 6.28), V(rad, rad * sy, rad)));
  const trunk = (th: number, tr: number) =>
    b.add(trunkGeo(), barkMat(), new THREE.Matrix4().compose(V(x, y - 0.15, z), yawQ(yaw), V(tr, th + 0.15, tr)));
  const ring = (n: number, dist: number, r0: number, r1: number, cy: number, dy: number) => {
    const a0 = r() * 6.28;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * 6.28) / n + U(-0.35, 0.35), dd = dist * U(0.85, 1.12);
      put(Math.cos(a) * dd, cy + U(-dy, dy), Math.sin(a) * dd, U(r0, r1));
    }
  };
  if (k === "round" || k === "fat") {
    const f = k === "fat";
    trunk((f ? 0.4 : 0.48) * h, 0.055 * h);
    const cy = (f ? 0.58 : 0.64) * h;
    put(0, cy, 0, (f ? 0.29 : 0.26) * h);
    ring(f ? 5 : 4, (f ? 0.22 : 0.18) * h, (f ? 0.19 : 0.17) * h, (f ? 0.23 : 0.21) * h, cy - 0.05 * h, 0.04 * h);
    put(U(-0.05, 0.05) * h, cy + (f ? 0.15 : 0.17) * h, U(-0.05, 0.05) * h, (f ? 0.19 : 0.17) * h);
  } else if (k === "tall") {
    trunk(0.34 * h, 0.045 * h);
    put(0, 0.47 * h, 0, 0.17 * h, 1.3);
    put(U(-0.03, 0.03) * h, 0.65 * h, U(-0.03, 0.03) * h, 0.15 * h, 1.3);
    put(0, 0.82 * h, 0, 0.11 * h, 1.25);
    ring(3, 0.1 * h, 0.1 * h, 0.12 * h, 0.55 * h, 0.06 * h);
  } else if (k === "cone") {
    trunk(0.2 * h, 0.05 * h);
    put(0, 0.3 * h, 0, 0.26 * h, 0.62);
    put(0, 0.5 * h, 0, 0.2 * h, 0.66);
    put(0, 0.68 * h, 0, 0.14 * h, 0.75);
    put(0, 0.84 * h, 0, 0.08 * h, 1.0);
  } else if (k === "bush") {
    put(0, 0.46 * h, 0, 0.5 * h);
    ring(3, 0.42 * h, 0.32 * h, 0.38 * h, 0.32 * h, 0.04 * h);
  } else { // hedge segment, 3.3 m along local x
    b.add(hedgeGeo(), leaf, new THREE.Matrix4().compose(V(x, y - 0.06, z), new THREE.Quaternion(), V(3.3, h + 0.06, Math.max(0.9, h * 0.78))));
  }
};

// ---------------- painted cloth banner (MAT round 3) ----------------
// The Kenney banner is one flat face of the saturated colour atlas: in golden light it kept a uniform, hot red and
// read as pasted on. Ours is a hanging cloth with real folds (smooth normals, so the two-tone light rolls across
// them), a swallow-tail hem, a muted crimson (sat ~-25 %) with an ochre border and a diamond like the tower flags.
const BANNER_COL: Record<string, string> = { "banner-red": "#b8553a", "banner-green": "#4f8a5a" }; // warm red: no purple in shade
const FOLD = 0.27, CLOTH_W = 1.1, CLOTH_H = 2.6; // fold period across the cloth, cloth size (m)
const bannerTex = (col: string) => ctex("bannerHD" + col, 256, 700, (g) => {
  const W = 256, H = 700, base = new THREE.Color(col);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#" + base.clone().offsetHSL(0, 0, 0.04).getHexString()); gr.addColorStop(1, "#" + base.clone().offsetHSL(0, 0, -0.06).getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x++) { // painted fold shading, in phase with the geometry folds
    const s = Math.sin((x / W) * (CLOTH_W / FOLD) * Math.PI * 2);
    g.fillStyle = s > 0 ? `rgba(255,235,215,${0.1 * s})` : `rgba(60,15,15,${-0.12 * s})`; g.fillRect(x, 0, 1, H);
  }
  g.fillStyle = "#" + base.clone().offsetHSL(0, -0.05, -0.12).getHexString(); g.fillRect(0, 0, W, 54); // top hem
  g.strokeStyle = "#d1aa5c"; g.lineWidth = 9; g.strokeRect(20, 66, W - 40, H - 86);                 // ochre border
  g.strokeStyle = "rgba(60,30,20,0.45)"; g.lineWidth = 2; g.strokeRect(14, 60, W - 28, H - 74); g.strokeRect(26, 72, W - 52, H - 98);
  g.fillStyle = "#d1aa5c"; g.fillRect(0, 46, W, 8);
  const cx = W / 2, cy = 250; // emblem: diamond (the tower flags' motif) on a light disc
  g.fillStyle = "#efe2c2"; g.beginPath(); g.arc(cx, cy, 62, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(60,30,20,0.55)"; g.lineWidth = 3; g.stroke();
  g.fillStyle = "#d1aa5c"; g.beginPath(); g.moveTo(cx, cy - 46); g.lineTo(cx + 34, cy); g.lineTo(cx, cy + 46); g.lineTo(cx - 34, cy); g.closePath(); g.fill();
  g.strokeStyle = "rgba(60,30,20,0.6)"; g.lineWidth = 2.5; g.stroke();
});
const bannerGeo = () => {
  let geo = vegGeo.get("banner");
  if (!geo) {
    const w = CLOTH_W, hh = CLOTH_H, notch = 0.42;
    geo = new THREE.PlaneGeometry(w, hh, 16, 20).translate(0, -hh / 2, 0); // top edge at y = 0
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), t = -y / hh; // 0 top .. 1 bottom
      p.setY(i, y + notch * (1 - Math.abs(x) / (w / 2)) * t * t);                              // swallow-tail hem
      p.setZ(i, (0.025 + 0.055 * t) * Math.sin((x / FOLD) * Math.PI * 2 + 0.6) + 0.04 * t * t); // folds deepen downwards
    }
    geo.computeVertexNormals();
    vegGeo.set("banner", geo);
  }
  return geo;
};
/** gonfalon on a pole where the Kenney banner plate stood: its plate hung 0.4 x scale beside the placement point,
 *  facing local +-x, so the pole goes there (same framing) and the cloth faces that way */
const bannerProp = (b: Batch, name: string, x0: number, y: number, z0: number, h: number, yaw0: number) => {
  const off = 0.4 * (h / 0.84), x = x0 + Math.cos(yaw0) * off, z = z0 - Math.sin(yaw0) * off, yaw = yaw0 + Math.PI / 2;
  if (inTheWay(x - 0.7, x + 0.7, y, y + h, z - 0.7, z + 0.7, true)) return;
  const col = BANNER_COL[name] ?? "#b4524b";
  const M = (px: number, py: number, pz: number) => new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z).multiply(new THREE.Matrix4().makeTranslation(px, py, pz));
  const pole = lam("bannerPole", () => ({ color: "#6e4b33" })), gold = lam("bannerGold", () => ({ color: "#c9a24e" }));
  b.add(new THREE.CylinderGeometry(0.045, 0.06, h, 10).translate(0, h / 2, 0), pole, M(0, 0, 0));
  b.add(new THREE.SphereGeometry(0.1, 14, 10), gold, M(0, h + 0.06, 0));
  b.add(new THREE.CylinderGeometry(0.03, 0.03, CLOTH_W + 0.2, 8).rotateZ(Math.PI / 2), pole, M(0, h - 0.18, 0.06));
  for (const s of [-1, 1]) b.add(new THREE.SphereGeometry(0.045, 10, 8), gold, M(s * (CLOTH_W / 2 + 0.12), h - 0.18, 0.06));
  b.add(bannerGeo(), lam("bannerHD" + col, () => ({ map: bannerTex(col), side: THREE.DoubleSide })), M(0, h - 0.2, 0.1));
};

// ---------------- Kenney props ----------------
const boxes = new Map<THREE.Object3D, THREE.Box3>();
/** place a Kenney model with its base on y, scaled to height h (left out when it would stand in front of the lens).
 *  Trees, bushes and hedges are drawn as cartoon vegetation, banners as painted cloth instead (MAT pass). */
export const prop = (b: Batch, kit: Kit, name: string, x: number, y: number, z: number, h: number, yaw = 0) => {
  if (name.startsWith("banner")) { bannerProp(b, name, x, y, z, h, yaw); return; }
  const vk = VEG[name];
  if (vk) {
    const rad = vegRad(vk, h);
    if (inTheWay(x - rad, x + rad, y, y + h, z - rad, z + rad, true)) return;
    const d = Math.hypot(x, z);
    addVeg(b, vk, x, y, z, h, x * 92.7 + z * 31.3 + yaw * 1000, d > 200 ? 2 : Math.abs(z) > 45 && d > 60 ? 1 : 0);
    return;
  }
  const o = kit[name];
  if (!o) return;
  let box = boxes.get(o);
  if (!box) { box = new THREE.Box3().setFromObject(o); boxes.set(o, box); }
  const s = h / Math.max(0.01, box.max.y - box.min.y), r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * s * 0.5;
  if (inTheWay(x - r, x + r, y, y + h, z - r, z + r, true)) return;
  b.addObject(o, new THREE.Matrix4().compose(V(x, y - box.min.y * s, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(s, s, s)));
};

/** a Kenney model as its own object (two-tone materials), base at y = 0, scaled to height h (no sight-line test:
 *  used for the CAM agent's FOREGROUND framing objects, which are meant to stand in front of the lens) */
export const kitClone = (kit: Kit, name: string, h: number): THREE.Object3D | null => {
  const vk = VEG[name];
  if (vk) { // cartoon plant as its own object (MAT pass), base at y = 0
    const vb = new Batch(), grp = new THREE.Group();
    addVeg(vb, vk, 0, 0, 0, h, name.length * 977 + h * 131, 0);
    vb.build(grp, false);
    grp.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = true; } });
    return grp;
  }
  const o = kit[name];
  if (!o) return null;
  let box = boxes.get(o);
  if (!box) { box = new THREE.Box3().setFromObject(o); boxes.set(o, box); }
  const c = o.clone(true), s = h / Math.max(0.01, box.max.y - box.min.y);
  c.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.isMesh) { m.material = toLambert(Array.isArray(m.material) ? m.material[0] : m.material); m.castShadow = false; m.receiveShadow = true; }
  });
  const g = new THREE.Group();
  c.position.y = -box.min.y * s; c.scale.setScalar(s);
  g.add(c);
  return g;
};

// ---------------- houses ----------------
type Style = { wall: string; shutter: string; roof: string; timber?: boolean; brick?: boolean };
// MAT pass: warm ochre / cream / sandstone / salmon walls + one blue-grey (the old pinks, whites and grey-blues read
// lavender: the two-tone shade multiplies by a blue-violet, so a near-neutral albedo turns lilac on every shaded face)
// round 3: saturation -35 % on every wall (neutral warm grey / beige; the salmon became a warm greige)
// round 4: the pale greiges still read lavender-grey in shade -> a muted brick / cream / ochre / terracotta spread
const STYLES: Style[] = [
  { wall: "#ecdab2", shutter: "#3f6fb5", roof: "#d27a62" },              // cream
  { wall: "#d8a95f", shutter: "#2f6a43", roof: "#b8644f" },              // ochre
  { wall: "#c47a5c", shutter: "#2f5f6a", roof: "#8f97a8" },              // muted brick-red plaster
  { wall: "#efdcb8", shutter: "#2f5f6a", roof: "#c9775a", timber: true }, // cream timber frame
  { wall: "#ddbd78", shutter: "#5a3b2a", roof: "#d27a62" },              // straw ochre
  { wall: "#cc9a6c", shutter: "#3f6fb5", roof: "#8e7aa0" },              // terracotta sand
  { wall: "#e2c49a", shutter: "#8c3b4a", roof: "#c9775a" },              // warm sandstone
  { wall: "#e3d2b8", shutter: "#2f6a43", roof: "#8f97a8", brick: true },
];
const roofMat = (col: string) => lam("roof" + col, () => ({ map: roofHD(col, col === "#8f97a8"), side: THREE.DoubleSide }));

/** gabled house: front facade (local +z) at width w, depth d, wall height h, ridge along local x (left out if it blocks a shot) */
export const house = (b: Batch, x: number, z: number, yaw: number, w: number, d: number, h: number, si: number, y = D0) => {
  const across = Math.abs(Math.sin(yaw)) > 0.5, hx = (across ? d : w) / 2 + 0.6, hz = (across ? w : d) / 2 + 0.6;
  if (inTheWay(x - hx, x + hx, y, y + h + d * 0.42 + 1.2, z - hz, z + hz)) return;
  const st = STYLES[si % STYLES.length];
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  const front = lam(`hf${si}_${w}_${h}`, () => ({ map: facadeHD(`hf${si}_${w}_${h}`, w, h, { ...st, door: true }) }));
  const side = lam(`hs${si}_${h}`, () => ({ map: facadeHD(`hs${si}_${h}`, 8, h, st) }));
  const wall = lam("wall" + st.wall, () => ({ color: st.brick ? "#c8643f" : st.wall }));
  const hw = w / 2, hd = d / 2, rh = d * 0.42, o = 0.35;
  b.add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), front, m);
  b.add(quad(V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)), side, m);
  b.add(quad(V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, hd), V(-hw, h, -hd)), side, m);
  b.add(quad(V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, -hd), V(hw, h, hd)), side, m);
  b.add(tri(V(-hw, h, -hd), V(-hw, h, hd), V(-hw, h + rh, 0)), wall, m);
  b.add(tri(V(hw, h, hd), V(hw, h, -hd), V(hw, h + rh, 0)), wall, m);
  const ru = (w + 2 * o) / 4, rv = Math.hypot(hd + o, rh) / 4, rm = roofMat(st.roof);
  b.add(quad(V(-hw - o, h - 0.25, hd + o), V(hw + o, h - 0.25, hd + o), V(hw + o, h + rh, 0), V(-hw - o, h + rh, 0), ru, rv), rm, m);
  b.add(quad(V(hw + o, h - 0.25, -hd - o), V(-hw - o, h - 0.25, -hd - o), V(-hw - o, h + rh, 0), V(hw + o, h + rh, 0), ru, rv), rm, m);
  const cx = hw * 0.45 * (si % 2 ? 1 : -1);
  b.add(boxGeo(V(cx - 0.4, h + rh * 0.3, -hd * 0.35 - 0.4), V(cx + 0.4, h + rh + 1.1, -hd * 0.35 + 0.4), 2), lam("chim", () => ({ map: rep(brick(), 1, 1) })), m);
  houseDetail(b, m, w, d, h, rh, cx);
};

// round 4: real 3D relief on every house (was a flat window-textured box): stone plinth, cornice under the eaves,
// window sills + lintel hoods matching facadeHD's window layout, front door step + door hood, chimney cap and pot
const UB = new THREE.BoxGeometry(1, 1, 1);
const trimM = () => lam("trimStone", () => ({ color: "#efe3c8" }));
const capM = () => lam("chimCap", () => ({ color: "#9a8778" }));
const plinthM = () => lam("plinthHD", () => ({ map: stoneHD("copeHD") }));
const ub = (b: Batch, mat: THREE.Material, m: THREE.Matrix4, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  b.add(UB, mat, m.clone().multiply(new THREE.Matrix4().compose(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), new THREE.Quaternion(), V(x1 - x0, y1 - y0, z1 - z0))));
const houseDetail = (b: Batch, m: THREE.Matrix4, w: number, d: number, h: number, rh: number, chx: number) => {
  const hw = w / 2, hd = d / 2, tm = trimM(), floors = Math.max(1, Math.floor(h / 2.8));
  b.add(boxGeo(V(-hw - 0.07, -0.05, -hd - 0.07), V(hw + 0.07, 0.45, hd + 0.07), 2), plinthM(), m);          // plinth
  ub(b, tm, m, -hw - 0.12, hw + 0.12, h - 0.52, h - 0.25, hd, hd + 0.17);                                   // cornice front
  ub(b, tm, m, -hw - 0.12, hw + 0.12, h - 0.52, h - 0.25, -hd - 0.17, -hd);                                 // cornice back
  for (const s of [-1, 1]) ub(b, tm, m, s < 0 ? -hw - 0.17 : hw, s < 0 ? -hw : hw + 0.17, h - 0.52, h - 0.25, -hd - 0.12, hd + 0.12);
  // windows: facadeHD puts nWin = floor(width / 2.2) per floor at (i + 0.5) / nWin, sill line fl * 2.8 + 0.9 m
  const wins = (len: number, door: boolean, at: (u: number) => [number, number], out: [number, number]) => {
    const n = Math.max(1, Math.floor(len / 2.2));
    for (let fl = 0; fl < floors; fl++) for (let i = 0; i < n; i++) {
      const [px, pz] = at((i + 0.5) / n), yb = fl * 2.8 + 0.9;
      if (door && fl === 0 && i === Math.floor(n / 2)) {
        const along = (k: number) => [px + out[1] * k, pz - out[0] * k] as const; // along the wall (perpendicular to out)
        const [ax, az] = along(-0.82), [bx, bz] = along(0.82), [cx2, cz2] = along(-0.78), [dx2, dz2] = along(0.78);
        ub(b, plinthM(), m, Math.min(ax, bx, ax + out[0] * 0.5), Math.max(ax, bx, ax + out[0] * 0.5), 0, 0.2, Math.min(az, bz, az + out[1] * 0.5), Math.max(az, bz, az + out[1] * 0.5)); // step
        ub(b, tm, m, Math.min(cx2, dx2, cx2 + out[0] * 0.34), Math.max(cx2, dx2, cx2 + out[0] * 0.34), 2.3, 2.44, Math.min(cz2, dz2, cz2 + out[1] * 0.34), Math.max(cz2, dz2, cz2 + out[1] * 0.34)); // hood
        continue;
      }
      for (const [y0, y1, dep, half] of [[yb - 0.2, yb - 0.08, 0.14, 0.6], [yb + 1.33, yb + 1.43, 0.08, 0.55]] as const) {
        const ax = px - out[1] * half, az = pz + out[0] * half, bx = px + out[1] * half, bz = pz - out[0] * half;
        ub(b, tm, m, Math.min(ax, bx, ax + out[0] * dep), Math.max(ax, bx, ax + out[0] * dep), y0, y1, Math.min(az, bz, az + out[1] * dep), Math.max(az, bz, az + out[1] * dep));
      }
    }
  };
  wins(w, true, (u) => [-hw + u * w, hd], [0, 1]);            // front (+z), u from -x to +x
  wins(8, false, (u) => [hw - u * w, -hd], [0, -1]);          // back: side texture (8 m layout) stretched over w
  wins(8, false, (u) => [-hw, -hd + u * d], [-1, 0]);         // left side (-x): side texture is always the 8 m layout
  wins(8, false, (u) => [hw, hd - u * d], [1, 0]);            // right side (+x)
  // chimney cap + pot
  const cz = -hd * 0.35, top = h + rh + 1.1;
  ub(b, capM(), m, chx - 0.52, chx + 0.52, top, top + 0.16, cz - 0.52, cz + 0.52);
  b.add(new THREE.CylinderGeometry(0.13, 0.16, 0.42, 10).translate(0, 0.21, 0), lam("chimPot", () => ({ color: "#b8684a" })), m.clone().multiply(new THREE.Matrix4().makeTranslation(chx, top + 0.16, cz)));
};


// ======================= Pisa: the tower =======================
// 8 levels stacked as nested groups (ground floor, 6 open galleries, bell chamber). Each level's body can rise
// (build fraction) and each level from 3 up is tilted back by `curve` (the floors built taller on the low side, so
// the tower bends like a banana). Lean tips the whole stack about the base centre, top toward -x.
const cyl = (r: number, h: number, seg: number, open = false) => new THREE.CylinderGeometry(r, r, h, seg, 1, open).translate(0, h / 2, 0);
const tileMat = (key: string, tex: () => THREE.Texture, n: number, cut = false) =>
  lam(key, () => ({ map: rep(tex(), n, 1), ...(cut ? { alphaTest: 0.5, side: THREE.DoubleSide } : {}) }));
export class Tower {
  root = new THREE.Group();
  private lv: { g: THREE.Group; body: THREE.Group; h: number; child?: THREE.Group }[] = [];
  constructor() {
    const marble = lam("marbleT", () => ({ map: rep(marbleTex(), 6, 0.25) }));
    const lead = lam("leadT", () => ({ color: "#8f97a8" }));
    let parent: THREE.Object3D = this.root;
    for (let k = 0; k < 8; k++) {
      const g = new THREE.Group(), body = new THREE.Group(), h = k === 0 ? H0 : k === 7 ? HB : HG;
      const add = (geo: THREE.BufferGeometry, m: THREE.Material, y = 0) => { const me = new THREE.Mesh(geo, m); me.position.y = y; me.castShadow = true; me.receiveShadow = true; body.add(me); };
      if (k === 0) {
        add(cyl(8.6, 1.0, 64), marble, -1.2);
        add(cyl(8.35, 0.4, 64), marble, -0.2);
        add(cyl(7.95, H0, 64, true), lam("blindT", () => ({ map: rep(blindTex(), 19, 1), side: THREE.DoubleSide })));
        add(new THREE.CircleGeometry(7.9, 48).rotateX(-Math.PI / 2).translate(0, 0.3, 0), lam("towerFloor", () => ({ color: "#8a7a68" })));
        add(cyl(8.3, 0.6, 64), marble, H0 - 0.6);
      } else if (k < 7) {
        add(cyl(8.1, 0.45, 64), marble);
        add(cyl(6.0, HG, 40), tileMat("coreT", () => coreTex("gal", HG), 12));
        add(cyl(7.55, HG - 0.45, 64, true), tileMat("arcT", () => arcadeTex("gal", HG - 0.45), 24, true), 0.45);
      } else {
        add(cyl(8.1, 0.5, 64), marble);
        add(cyl(7.9, 1.0, 64, true), lam("parapetT", () => ({ map: rep(marbleTex(), 6, 0.1), side: THREE.DoubleSide })), 0.5);
        add(cyl(4.3, HB - 1, 32), tileMat("bellCoreT", () => coreTex("bell", HB - 1, true), 6), 0.5);
        add(cyl(4.9, HB - 1.5, 48, true), tileMat("bellArcT", () => arcadeTex("bell", HB - 1.5, 0.2, 0.3), 12, true), 0.5);
        add(cyl(5.3, 0.55, 48), marble, HB - 1.0);
        add(new THREE.ConeGeometry(5.0, 1.3, 32).translate(0, 0.65, 0), lead, HB - 0.45);
      }
      g.add(body); parent.add(g);
      this.lv.push({ g, body, h });
      parent = g;
    }
  }
  /** pose for a story state; groundY = top of the ground the tower stands on in this set */
  pose(s: TowerState, groundY: number) {
    const r = THREE.MathUtils.degToRad;
    this.root.position.set(s.shake, groundY - s.sink, 0);
    this.root.rotation.set(0, 0, r(s.lean + s.sway));
    for (let k = 0; k < 8; k++) {
      const L = this.lv[k], f = Math.max(0, Math.min(1, s.build - k));
      L.g.visible = f > 0.001;
      L.body.scale.y = Math.max(0.001, f);
      if (k > 0) {
        const prev = this.lv[k - 1];
        L.g.position.y = prev.h * Math.max(0.001, Math.min(1, s.build - (k - 1)));
        L.g.rotation.z = -r(k >= 3 ? s.curve + (k === 7 ? s.bell : 0) : 0);
      }
    }
  }
}

// ======================= Pisa: sets =======================
export type FlagSpot = { pos: [number, number, number]; kind: "pisa" | "lucca"; set: SetId; w: number; yaw: number };
export type SetBuild = { groups: Record<SetId, THREE.Group>; scaffoldLo: THREE.Group; scaffoldHi: THREE.Group; barrier: THREE.Group; drills: THREE.Group;
  cushion: THREE.Mesh; busWindows: THREE.Texture; flags: FlagSpot[] };
const groundQuad = (half: number, tile: number, y = 0) => {
  const g = new THREE.PlaneGeometry(2 * half, 2 * half).rotateX(-Math.PI / 2).translate(0, y, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (2 * half) / tile, uv.getY(i) * (2 * half) / tile);
  return g;
};
const ringGround = (r0: number, r1: number, tile: number, y = 0) => {
  const g = new THREE.RingGeometry(r0, r1, 64, 4).rotateX(-Math.PI / 2).translate(0, y, 0);
  const p = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / tile, p.getZ(i) / tile);
  return g;
};
export const M4 = (x: number, y: number, z: number, yaw = 0, s: [number, number, number] = [1, 1, 1]) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(...s));
/** crenellated wall run from (x0, z0) to (x1, z1), height h, thickness 2.4 m */
const wallRun = (b: Batch, m: THREE.Material, x0: number, z0: number, x1: number, z1: number, h: number) => {
  const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(-(z1 - z0), x1 - x0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  b.add(new THREE.BoxGeometry(len, h, 2.4).translate(0, h / 2, 0), m, M4(cx, 0, cz, yaw));
  for (let s = -len / 2 + 1; s < len / 2 - 0.5; s += 2.4) b.add(new THREE.BoxGeometry(1.2, 1.1, 2.4).translate(s, h + 0.55, 0), m, M4(cx, 0, cz, yaw));
};

export const buildSets = (root: THREE.Object3D, kit: Kit, raysOf: (s: SetId) => Ray[]): SetBuild => {
  const groups = {} as Record<SetId, THREE.Group>;
  for (const id of ["piazza", "site", "field", "cutaway", "bus"] as SetId[]) { groups[id] = new THREE.Group(); groups[id].visible = false; root.add(groups[id]); }
  const r = rng(29);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length) % a.length];
  const grass = lam("grassHD", () => ({ map: grassHD(), color: "#9aae86" })); // warmer, less lime than the raw paint
  const marble = lam("marbleS", () => ({ map: rep(marbleTex(), 1, 1) }));
  const lead = roofMat("#8f97a8");
  const wallStone = lam("cityWall", () => ({ map: stoneHD("cityWallHD", ["#d8c3a0", "#cfb894", "#e0ccaa", "#c6ae88"], "#a8916c") }));
  const wood = lam("woodS", () => ({ color: "#9a6a44" }));
  const trees = ["tree_oak", "tree_default", "tree_detailed", "tree_fat"];
  const flags: FlagSpot[] = [];

  // ---------------- piazza (present day / 1990 / 2001) ----------------
  {
    sight = raysOf("piazza");
    const b = new Batch(), G = groups.piazza;
    b.add(groundQuad(700, 4), grass);
    const pav = lam("pavHD", () => ({ map: stoneHD("pavHD", ["#ebe4d4", "#e2dac8", "#f0eadc", "#d9d0bd"], "#b9ad98") }));
    b.add(ringGround(8.3, 11.5, 4, 0.012), pav);
    b.add(new THREE.PlaneGeometry(4.5, 150).rotateX(-Math.PI / 2).translate(0, 0.012, 85), pav);
    b.add(new THREE.PlaneGeometry(160, 4.5).rotateX(-Math.PI / 2).translate(20, 0.012, 34), pav);
    // cathedral (facade hint to the right-back): aisles + nave + gable + dome
    const fx0 = 31, fx1 = 65, fz = -18, duo = facadeDuomo();
    const fac = lam("duomoF", () => ({ map: duo }));
    b.add(boxGeo(V(fx0, 0, -110), V(fx1, 20, fz), 0), lam("duomoSide", () => ({ map: rep(marbleTex(), 8, 2) })));
    b.add(boxGeo(V(39, 20, -110), V(57, 32, fz), 0), lam("duomoSide", () => ({ map: rep(marbleTex(), 8, 2) })));
    b.add(quad(V(fx0, 0, fz + 0.05), V(fx1, 0, fz + 0.05), V(fx1, 20, fz + 0.05), V(fx0, 20, fz + 0.05), 1, 0.6, 0, 0), fac);
    b.add(quad(V(39, 20, fz + 0.05), V(57, 20, fz + 0.05), V(57, 32, fz + 0.05), V(39, 32, fz + 0.05), 0.765, 0.96, 0.235, 0.6), fac);
    b.add(tri(V(39, 32, fz + 0.05), V(57, 32, fz + 0.05), V(48, 37, fz + 0.05)), marble);
    b.add(quad(V(fx0, 20, fz), V(39, 20, fz), V(39, 24, -110 + 0.1), V(fx0, 20, -110 + 0.1)), lead);
    b.add(quad(V(57, 20, fz), V(fx1, 20, fz), V(fx1, 20, -110), V(57, 24, -110)), lead);
    b.add(quad(V(39, 32, fz), V(57, 32, fz), V(57, 32, -110), V(39, 32, -110)), lead);
    b.add(cyl(9, 5, 40), lam("duomoDrum", () => ({ map: rep(marbleTex(), 6, 0.5) })), M4(48, 32, -62));
    b.add(new THREE.SphereGeometry(9, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), lead, M4(48, 37, -62));
    for (const x of [fx0 + 0.5, fx1 - 0.5, 39.5, 56.5]) b.add(new THREE.ConeGeometry(0.7, 2.2, 8).translate(0, 1.1, 0), marble, M4(x, x < 38 || x > 58 ? 20 : 32, fz + 0.4));
    // baptistery-ish round building far left-back
    b.add(cyl(16, 18, 48), lam("baptT", () => ({ map: rep(blindTex(), 26, 1.6) })), M4(-70, 0, -70));
    b.add(new THREE.ConeGeometry(17, 14, 40).translate(0, 7, 0), roofMat("#c9775a"), M4(-70, 18, -70));
    // city wall behind, cypresses, umbrella pines, a row of houses on the left
    wallRun(b, wallStone, -260, -175, 260, -175, 11);
    wallRun(b, wallStone, -150, -175, -150, 60, 11);
    for (let z = -150; z < 50; z += 11) house(b, -168, z, Math.PI / 2, 9, 8, pick([8.4, 9.8, 11.2]), Math.floor(r() * 8));
    for (let x = -120; x < 200; x += 10) house(b, x, 140, Math.PI, 9, 8, pick([8.4, 9.8]), Math.floor(r() * 8));
    for (let i = 0; i < 30; i++) { const x = -130 + r() * 300, z = -168 + r() * 8; prop(b, kit, "tree-high-round", x, 0, z, 10 + r() * 4, r()); }
    for (const [x, z] of [[-34, 22], [-42, 34], [26, 30], [36, 40], [-28, -30], [24, -38], [-60, 10], [70, 20], [-20, 70], [30, 80]] as const)
      prop(b, kit, pick(trees), x, 0, z, 8 + r() * 3, r() * 6);
    b.build(G);
  }
  // barrier ring (1990-2001): red/white crowd fences on posts
  const barrier = new THREE.Group();
  {
    const b = new Batch(), bm = lam("barrierM", () => ({ map: rep(barrierTex(), 3, 1) })), post = lam("postM", () => ({ color: "#d9dde0" }));
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 0.82) / n) * Math.PI * 2, R = BARRIER_R;
      const p0 = V(Math.cos(a0) * R, 0, Math.sin(a0) * R), p1 = V(Math.cos(a1) * R, 0, Math.sin(a1) * R);
      const mid = p0.clone().add(p1).multiplyScalar(0.5), len = p0.distanceTo(p1), yaw = Math.atan2(-(p1.z - p0.z), p1.x - p0.x);
      b.add(new THREE.BoxGeometry(len, 0.32, 0.05).translate(0, 0.86, 0), bm, M4(mid.x, 0, mid.z, yaw));
      b.add(new THREE.BoxGeometry(len, 0.06, 0.05).translate(0, 0.3, 0), post, M4(mid.x, 0, mid.z, yaw));
      for (const p of [p0, p1]) b.add(new THREE.BoxGeometry(0.07, 1.05, 0.07).translate(0, 0.52, 0), post, M4(p.x, 0, p.z));
    }
    b.build(barrier); barrier.visible = false; groups.piazza.add(barrier);
  }
  // 2001 works: soil drills on the raised (+x) side, spoil heaps, extracted augers; lead counterweights on the low side
  const drills = new THREE.Group();
  {
    const b = new Batch(), yellow = lam("rigY", () => ({ color: "#f2c230" })), steel = lam("rigS", () => ({ color: "#8d949c" }));
    const soil = lam("spoil", () => ({ map: rep(mudTex(), 0.4, 0.4) })), leadM = lam("leadW", () => ({ color: "#6f7480" }));
    for (const [x, z, yaw] of [[11.5, 5.5, -0.35], [10.5, -2.5, 0.25], [12.8, 1.4, 0]] as const) {
      const m = M4(x, 0, z, yaw);
      b.add(boxGeo(V(-0.9, 0, -0.6), V(0.9, 1.2, 0.6), 0, true), yellow, m);
      b.add(boxGeo(V(-1.0, 0, -0.7), V(1.0, 0.25, 0.7), 0, true), steel, m);
      // auger angled down under the raised side of the tower (toward -x), motor head on the rig
      const mast = new THREE.CylinderGeometry(0.11, 0.11, 4.2, 10).translate(0, 2.1, 0).rotateZ(2.05).translate(-0.85, 0.85, 0);
      b.add(mast, steel, m);
      b.add(boxGeo(V(-1.15, 0.55, -0.3), V(-0.55, 1.15, 0.3), 0, true), lam("rigMotor", () => ({ color: "#e2453c" })), m);
    }
    for (const [x, z, s] of [[15.5, 3, 1.5], [14.8, -1, 1.1], [16.2, 6.5, 0.9]] as const)
      b.add(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), soil, M4(x, 0, z, 0, [s * 1.3, s * 0.6, s]));
    for (let i = 0; i < 4; i++) b.add(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 10).rotateZ(Math.PI / 2), steel, M4(15.6 + i * 0.3, 0.1, -4.5 + i * 0.3, 0.9));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) b.add(boxGeo(V(-0.9, 0, -0.45), V(0.9, 0.38, 0.45)), leadM, M4(-9.6, i * 0.4, -1.4 + j * 0.95, 0));
    b.build(drills); drills.visible = false; groups.piazza.add(drills);
  }

  // ---------------- 1173 building site ----------------
  {
    sight = raysOf("site");
    const b = new Batch(), G = groups.site, PY = -0.6;
    const mud = lam("mudM", () => ({ map: mudTex() })), wet = lam("mudWet", () => ({ map: mudTex(true) }));
    b.add(ringGround(PIT_R, 700, 8), mud);
    b.add(new THREE.CircleGeometry(PIT_R, 64).rotateX(-Math.PI / 2).translate(0, PY, 0), wet);
    const pw = new THREE.CylinderGeometry(PIT_R, PIT_R, -PY, 64, 1, true).translate(0, PY / 2, 0);
    b.add(pw, lam("pitWall", () => ({ map: rep(mudTex(true), 8, 0.1), side: THREE.DoubleSide })));
    // marble block piles and timber stacks
    const blk = lam("blockM", () => ({ map: rep(marbleTex(), 0.25, 0.25) }));
    for (const [x, z] of [[8.5, 15.5], [-9.5, 14], [13, 7], [-13, 4]] as const)
      for (let i = 0; i < 5; i++) b.add(boxGeo(V(-0.6, 0, -0.35), V(0.6, 0.6, 0.35)), blk, M4(x + (i % 3) * 1.25 - 1.2, Math.floor(i / 3) * 0.6, z, 0.2));
    for (let i = 0; i < 6; i++) b.add(new THREE.BoxGeometry(0.22, 0.22, 4.5), wood, M4(-6 + (i % 3) * 0.25, 0.11 + Math.floor(i / 3) * 0.22, 17, 1.2));
    // treadwheel crane
    const cm = M4(-12.5, 0, 9, 0.5);
    for (const s of [-1, 1]) { b.add(beamGeo(V(-1.6, 0, s * 1.2), V(0, 7, s * 0.3), 0.22), wood, cm); b.add(beamGeo(V(1.6, 0, s * 1.2), V(0, 7, s * 0.3), 0.22), wood, cm); }
    b.add(beamGeo(V(0, 7, 0), V(6, 9.5, 0), 0.25), wood, cm);
    b.add(new THREE.TorusGeometry(1.6, 0.12, 8, 24), wood, cm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 1.8, 1.0)));
    b.add(beamGeo(V(6, 9.5, 0), V(6, 3.5, 0), 0.04), lam("rope", () => ({ color: "#c9a46a" })), cm);
    // town wall with the west gate (soldiers march out of it in shot 4) and medieval houses
    wallRun(b, wallStone, GATE[0], -120, GATE[0], GATE[2] - 5, 9);
    wallRun(b, wallStone, GATE[0], GATE[2] + 5, GATE[0], 140, 9);
    b.add(boxGeo(V(GATE[0] - 3, 0, GATE[2] - 6), V(GATE[0] + 3, 15, GATE[2] + 6), 2), wallStone);
    for (let s = -5; s <= 5; s += 2.5) b.add(boxGeo(V(GATE[0] - 3, 15, GATE[2] + s - 0.6), V(GATE[0] + 3, 16.2, GATE[2] + s + 0.6)), wallStone);
    const arch = ctex("gateArch", 128, 256, (g) => { g.fillStyle = "#3a2c30"; g.beginPath(); g.moveTo(10, 256); g.lineTo(10, 64); g.arc(64, 64, 54, Math.PI, 0); g.lineTo(118, 256); g.closePath(); g.fill(); });
    b.add(quad(V(GATE[0] + 3.02, 0, GATE[2] + 2.4), V(GATE[0] + 3.02, 0, GATE[2] - 2.4), V(GATE[0] + 3.02, 7.5, GATE[2] - 2.4), V(GATE[0] + 3.02, 7.5, GATE[2] + 2.4)), lam("gateArchM", () => ({ map: arch, alphaTest: 0.5 })));
    flags.push({ pos: [GATE[0], 16.2, GATE[2]], kind: "pisa", set: "site", w: 2.6, yaw: Math.PI / 2 });
    for (let i = 0; i < 22; i++) {
      const a = -1.1 + (i / 22) * 3.6, d = 48 + r() * 18, x = Math.cos(a) * d, z = -Math.sin(a) * d;
      if (x < GATE[0] + 8) continue;
      house(b, x, z, Math.atan2(-x, -z) + Math.PI, pick([7, 9]), 8, pick([7, 8.4, 9.8]), Math.floor(r() * 8));
    }
    for (let i = 0; i < 26; i++) { const x = GATE[0] - 15 - r() * 120, z = -120 + r() * 260; prop(b, kit, pick(trees), x, 0, z, 8 + r() * 4, r() * 6); }
    for (let i = 0; i < 10; i++) { const a = r() * 6.28, d = 24 + r() * 16; prop(b, kit, pick(trees), Math.cos(a) * d, 0, Math.sin(a) * d - 10, 7 + r() * 3, r() * 6); }
    prop(b, kit, "cart", 9.5, 0, 19, 1.6, 0.8);
    prop(b, kit, "cart", -16, 0, 16, 1.6, 2.2);
    prop(b, kit, "stall-red", -22, 0, 20, 3.0, 0.6);
    b.build(G);
  }
  // scaffolding around the stump: poles in two rings, ledgers, two plank decks, a ladder (low = 2 floors, high = 4)
  const scaffold = (top: number) => {
    const grp = new THREE.Group(), b = new Batch(), hi = top > 20, n = hi ? 12 : 18, RINGS = hi ? [10.6] : [9.4, 10.6];
    // the arc facing the lenses (all site cameras look from +z, ~70-75 deg) is thinned so the stump reads through it:
    // outer ring only, every other pole, ledgers only under the plank decks
    const front = (a: number) => Math.abs(((a - 1.27 + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) < 0.85;
    for (const R of RINGS) for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (front(a) && (R !== RINGS[RINGS.length - 1] || i % 2)) continue;
      b.add(new THREE.BoxGeometry(0.16, top + 0.6, 0.16).translate(0, (top + 0.6) / 2 - 0.6, 0), wood, M4(Math.cos(a) * R, 0, Math.sin(a) * R));
    }
    for (let y = 3; y < top; y += hi ? 6 : 3) for (const R of RINGS) for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      if (front((a0 + a1) / 2) && (y % 6 !== 0 || R !== RINGS[RINGS.length - 1])) continue;
      b.add(beamGeo(V(Math.cos(a0) * R, y, Math.sin(a0) * R), V(Math.cos(a1) * R, y, Math.sin(a1) * R), 0.12), wood);
    }
    const plank = lam("plankS", () => ({ color: "#c08a55" }));
    for (let y = 6; y < top; y += 6) for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI * 2, len = 2 * 10 * Math.sin(Math.PI / n);
      b.add(new THREE.BoxGeometry(len, 0.1, 1.3).translate(0, y + 0.06, 0), plank, M4(Math.cos(a) * 10, 0, Math.sin(a) * 10, -a + Math.PI / 2));
    }
    for (const s of [-0.3, 0.3]) b.add(beamGeo(V(11.2 + s * 0.1, -0.6, 2 + s), V(10.7 + s * 0.1, 6.2, 2 + s), 0.08), wood);
    for (let y = 0; y < 6; y += 0.45) b.add(beamGeo(V(11.2 - (y + 0.6) * 0.07, y, 1.7), V(11.2 - (y + 0.6) * 0.07, y, 2.3), 0.05), wood);
    b.build(grp); grp.visible = false; groups.site.add(grp);
    return grp;
  };
  const scaffoldLo = scaffold(18.5), scaffoldHi = scaffold(30.5);

  // ---------------- battlefield (Pisa vs Lucca) ----------------
  {
    sight = raysOf("field");
    const b = new Batch(), G = groups.field;
    b.add(groundQuad(700, 4), grass);
    const hill = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const hm = [lam("hillA", () => ({ color: "#78b257" })), lam("hillB", () => ({ color: "#6aa24e" })), lam("hillC", () => ({ color: "#8bbf63" }))];
    ([[-160, -260, 150, 46, 110], [120, -300, 190, 60, 120], [300, -150, 140, 40, 120], [-330, -60, 160, 40, 130]] as const).forEach(([x, z, sx, sy, sz], i) =>
      b.add(hill, hm[i % 3], M4(x, -2, z, 0, [sx, sy, sz])));
    // Lucca on the horizon: wall + towers
    wallRun(b, wallStone, -60, -150, 80, -150, 9);
    for (const [x, h] of [[-40, 26], [-10, 34], [20, 22], [55, 30]] as const) { b.add(boxGeo(V(x - 3, 0, -158), V(x + 3, h, -152), 2), wallStone); b.add(new THREE.ConeGeometry(4.6, 5, 4).rotateY(Math.PI / 4).translate(0, 2.5, 0), roofMat("#c9775a"), M4(x, h, -155)); }
    for (let i = 0; i < 40; i++) { const x = -120 + r() * 240, z = -30 - r() * 110; if (Math.abs(x) < 10 && z > -45) continue; prop(b, kit, pick([...trees, "tree_cone"]), x, 0, z, 7 + r() * 4, r() * 6); }
    // war tents (striped cones) on both sides
    const tentP = lam("tentP", () => ({ map: ctex("tentPisa", 256, 64, (g) => { for (let x = 0; x < 256; x += 32) { g.fillStyle = (x / 32) % 2 ? "#f4f0e6" : "#c8323a"; g.fillRect(x, 0, 32, 64); } }) }));
    const tentL = lam("tentL", () => ({ map: ctex("tentLucca", 256, 64, (g) => { g.fillStyle = "#f4f0e6"; g.fillRect(0, 0, 256, 32); g.fillStyle = "#c8323a"; g.fillRect(0, 32, 256, 32); }) }));
    for (const [x, z, m] of [[-11, -9, tentP], [-17, -16, tentP], [12, -10, tentL], [19, -18, tentL]] as const) b.add(new THREE.ConeGeometry(2.6, 3.6, 16).translate(0, 1.8, 0), m, M4(x, 0, z));
    flags.push({ pos: [-6.5, 4.2, -4], kind: "pisa", set: "field", w: 1.8, yaw: 0 }, { pos: [6.5, 4.2, -4], kind: "lucca", set: "field", w: 1.8, yaw: Math.PI });
    for (const x of [-6.5, 6.5]) b.add(new THREE.CylinderGeometry(0.06, 0.07, 4.4, 8).translate(0, 2.2, 0), wood, M4(x, 0, -4));
    b.build(G);
  }

  // ---------------- cutaway (soil slice under the tower) ----------------
  let cushion: THREE.Mesh;
  {
    sight = [];
    const b = new Batch(), G = groups.cutaway, D = 70;
    const face = lam("strataM", () => ({ map: strataTex() }));
    const soilSide = lam("soilSide", () => ({ color: "#5b4636" }));
    // the face is the slice x -40..40, y -28..0 (painted); below it the deep soil continues in a plain colour
    b.add(quad(V(-40, -28, 0), V(40, -28, 0), V(40, 0, 0), V(-40, 0, 0), 1, 1, 0, 0), face);
    b.add(quad(V(-90, -D, 0), V(90, -D, 0), V(90, -28, 0), V(-90, -28, 0)), lam("deepSoil", () => ({ color: "#4e443c" })));
    b.add(quad(V(-90, -28, 0), V(-40, -28, 0), V(-40, 0, 0), V(-90, 0, 0), 0.6, 1, 0, 0), face);
    b.add(quad(V(40, -28, 0), V(90, -28, 0), V(90, 0, 0), V(40, 0, 0), 1, 1, 0.4, 0), face);
    b.add(boxGeo(V(-90, -D, -400), V(90, -0.02, -0.06)), soilSide); // set back from the painted face (no z-fight)
    const gq = new THREE.PlaneGeometry(1400, 1100).rotateX(-Math.PI / 2).translate(0, 0.01, -550); // only behind the slice (z < 0)
    const guv = gq.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 350, guv.getY(i) * 275);
    b.add(gq, grass);
    for (let i = 0; i < 18; i++) { const x = -80 + r() * 160, z = -20 - r() * 120; if (Math.abs(x) < 14 && z > -30) continue; prop(b, kit, pick(trees), x, 0, z, 8 + r() * 3, r() * 6); }
    b.build(G);
    cushion = new THREE.Mesh(new THREE.PlaneGeometry(34, 11), new THREE.MeshBasicMaterial({ map: cushionTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, color: new THREE.Color(1.4, 1.5, 2.2) }));
    cushion.position.set(0, -8.5, 0.06); cushion.layers.set(NOINK); G.add(cushion);
  }

  // ---------------- night bus interior ----------------
  let busWindows: THREE.Texture;
  {
    sight = [];
    const b = new Batch(), G = groups.bus, X = 1.25, Z = 7, H = 2.3;
    const panel = lam("busPanel", () => ({ color: "#d8c9a8" })), dark = lam("busDark", () => ({ color: "#3d4150" }));
    const pole = lam("busPole", () => ({ color: "#f2c230" })), seat = lam("busSeat", () => ({ map: seatTex() }));
    b.add(new THREE.PlaneGeometry(2 * X, 2 * Z).rotateX(-Math.PI / 2), lam("busFloor", () => ({ map: rep(busFloorTex(), 1, 6) })));
    b.add(new THREE.PlaneGeometry(2 * X, 2 * Z).rotateX(Math.PI / 2).translate(0, H, 0), panel);
    for (const s of [-1, 1]) {
      b.add(new THREE.PlaneGeometry(2 * Z, 0.95).rotateY(-s * Math.PI / 2).translate(s * X, 0.475, 0), panel);
      b.add(new THREE.PlaneGeometry(2 * Z, 0.4).rotateY(-s * Math.PI / 2).translate(s * X, 2.1, 0), panel);
      for (let z = -Z; z <= Z; z += 1.6) b.add(boxGeo(V(s * X - 0.06, 0.9, z - 0.07), V(s * X + 0.06, 1.95, z + 0.07)), dark);
      for (let z = -Z + 0.8; z < Z; z += 1.6) if (s < 0 ? Math.abs(z) > 1.0 : z < -2) { // right side kept clear in front of the commuter
        const sx = s * (X - 0.45);
        b.add(boxGeo(V(sx - 0.35, 0.42, z - 0.32), V(sx + 0.35, 0.55, z + 0.32)), seat);
        b.add(boxGeo(V(sx - 0.35, 0.55, z - 0.42), V(sx + 0.35, 1.2, z - 0.3)), seat);
        b.add(boxGeo(V(sx - 0.25, 0, z - 0.2), V(sx + 0.25, 0.42, z + 0.2)), dark);
      }
      b.add(new THREE.CylinderGeometry(0.025, 0.025, 2 * Z, 8).rotateX(Math.PI / 2), pole, M4(s * 0.5, 2.02, 0));
      for (let z = -Z + 0.5; z < Z; z += 0.7) { b.add(new THREE.BoxGeometry(0.03, 0.22, 0.03).translate(0, -0.11, 0), dark, M4(s * 0.5, 2.02, z)); b.add(new THREE.TorusGeometry(0.06, 0.012, 6, 12), dark, M4(s * 0.5, 1.74, z, Math.PI / 2)); }
      for (const z of [-4.8, -1.6, 1.6, 4.8]) b.add(new THREE.CylinderGeometry(0.025, 0.025, H, 8).translate(0, H / 2, 0), pole, M4(s * 0.75, 0, z));
    }
    b.add(new THREE.PlaneGeometry(2 * X, H).translate(0, H / 2, -Z), panel);
    b.add(new THREE.PlaneGeometry(2 * X, H).rotateY(Math.PI).translate(0, H / 2, Z), panel);
    b.build(G, false);
    busWindows = rep(busWindowTex(), 1, 1);
    const winM = new THREE.MeshBasicMaterial({ map: busWindows, color: new THREE.Color(0.9, 0.9, 0.95) });
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(2 * Z, 0.95), winM); w.rotation.y = -s * Math.PI / 2; w.position.set(s * (X - 0.005), 1.425, 0); G.add(w); }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), winM); back.position.set(0, 1.4, -Z + 0.01); G.add(back);
    const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 3.0, 1.7) });
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 2 * Z - 1), lampM); l.position.set(s * 0.82, H - 0.03, 0); G.add(l); }
  }
  sight = [];
  return { groups, scaffoldLo, scaffoldHi, barrier, drills, cushion, busWindows, flags };
};
export const beamGeo = (a: THREE.Vector3, c: THREE.Vector3, th: number) => {
  const g = new THREE.BoxGeometry(th, a.distanceTo(c), th);
  return g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize()), V(1, 1, 1)));
};
