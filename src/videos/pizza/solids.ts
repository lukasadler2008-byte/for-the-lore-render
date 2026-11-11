// Real volumetric props of the Musk short. Everything here is thick geometry (boxes / frustums / cylinders / spheres /
// lathes) with the toon two-tone material (build.ts lam), so it gets the ink outline pass. cast.ts asks for a list of
// SolidReq (SR) each frame; Solids.apply() poses a fixed pool of objects per kind. cam:1 kinds take the camera
// quaternion (local +X screen right); the rest are world oriented. a,b,c,d,i are kind specific parameters.
import * as THREE from "three";
import { Batch, lam, V, beamGeo } from "./build";
import { glow } from "./sets";

export type SR = { k: string; x: number; y: number; z: number; s?: number; yaw?: number; roll?: number; pitch?: number; cam?: boolean; a?: number; b?: number; c?: number; d?: number; i?: number; post?: number };

const C = (k: string, c: string) => lam("s_" + k, () => ({ color: c }));
const CT = (k: string, c: string, op: number) => lam("s_" + k, () => ({ color: c, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }));
const C2 = (k: string, c: string) => lam("s_" + k, () => ({ color: c, side: THREE.DoubleSide }));
const mk = (fn: (b: Batch) => void, cast = true) => { const g = new THREE.Group(); const b = new Batch(); fn(b); b.build(g, cast); return g; };
const TR = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: [number, number, number] = [1, 1, 1]) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")), V(...s));
export const box = (b: Batch, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) =>
  b.add(new THREE.BoxGeometry(w, h, d), m, TR(x, y, z, rx, ry, rz));
export const sph = (b: Batch, m: THREE.Material, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, seg = 12) =>
  b.add(new THREE.SphereGeometry(1, seg, Math.max(6, seg - 4)), m, TR(x, y, z, 0, 0, 0, [sx, sy, sz]));
export const cyl = (b: Batch, m: THREE.Material, r: number, h: number, x: number, y: number, z: number, rx = 0, rz = 0, seg = 16, r2?: number) =>
  b.add(new THREE.CylinderGeometry(r2 ?? r, r, h, seg), m, TR(x, y, z, rx, 0, rz));

// ---------------- gold ----------------
const GOLD = () => [C("gold0", "#f2b823"), C("gold1", "#e5a317"), C("gold2", "#ffcf45")];
const GOLDTOP = () => C("goldTop", "#ffe58a");
const GOLDDK = () => C("goldDk", "#b7791a");
const CASH = () => C("cash", "#4fa86a"), CASHB = () => C("cashB", "#efe3b4");
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
/** gold ingot: square frustum (wider at the bottom) + lighter top plate; L x H x W, base at y */
export const ingot = (b: Batch, m: THREE.Material, x: number, y: number, z: number, yaw: number, L: number, H: number, W: number, pitch = 0, roll = 0, glowing = false) => {
  const R = Math.SQRT1_2;
  const body = new THREE.CylinderGeometry(0.7 * R, R, 1, 4, 1, false).rotateY(Math.PI / 4);
  const mat = glowing ? glow([2.8, 2.0, 0.6]) : m;
  b.add(body, mat, TR(x, y + H / 2, z, pitch, yaw, roll, [L, H, W]));
  b.add(new THREE.BoxGeometry(0.62, 0.05, 0.62), glowing ? glow([3.4, 2.8, 1.0]) : GOLDTOP(), TR(x, y + H * 0.99, z, pitch, yaw, roll, [L, H * 0.5, W]));
};
/** unit pile: radius 1, height ~1.05 (cone of bars and cash bundles) */
const pileObj = (seed: number, layers = 20) => mk((b) => {
  const G = GOLD();
  b.add(new THREE.ConeGeometry(0.93, 1.02, 18).translate(0, 0.51, 0), GOLDDK(), TR(0, 0, 0));
  for (let j = 0; j < layers; j++) {
    const k = j / layers, r = Math.max(0.02, (1 - k) ** 0.96), y = 0.05 + k * 0.97, n = Math.max(1, Math.ceil((2 * Math.PI * r) / 0.2));
    for (let i = 0; i < n; i++) {
      const hs = hh(i + j * 91, seed), a = (i / n) * Math.PI * 2 + hh(j, seed + 3) * 6.3, rr = r * (0.96 + 0.1 * hh(i, j + seed));
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr, yaw = -a + Math.PI / 2 + (hs - 0.5) * 0.7 + (hs > 0.5 ? 0 : 0.35), cash = hs > 0.86;
      if (cash) { box(b, CASH(), 0.15, 0.065, 0.09, x, y + 0.03, z, 0.0, yaw, 0.2 * (hs - 0.9)); box(b, CASHB(), 0.045, 0.07, 0.092, x, y + 0.032, z, 0, yaw, 0); }
      else ingot(b, G[(i + j) % 3], x, y, z, yaw, 0.21, 0.075, 0.105, 0.14 * (hh(i, j + 9) - 0.5), 0.25 * (hs - 0.5), hs < 0.04);
    }
  }
  for (let i = 0; i < 4; i++) ingot(b, G[i % 3], 0.05 * Math.cos(i * 1.7), 1.0, 0.05 * Math.sin(i * 1.7), i * 0.9, 0.2, 0.07, 0.1);
  ingot(b, G[0], 0, 1.07, 0, 0.4, 0.07, 0.03, 0.04);
});
/** a vertical column of n ingots (alternating yaw), base at y = 0 */
const colObj = (n: number) => mk((b) => { const G = GOLD(); for (let i = 0; i < n; i++) ingot(b, G[i % 3], 0, i * 0.115, 0, (i % 2) * Math.PI / 2 + 0.03 * (i % 3), 0.5, 0.115, 0.25); });
const barObj = () => mk((b) => ingot(b, GOLD()[0], 0, 0, 0, 0, 0.5, 0.13, 0.25));
const blockObj = () => mk((b) => {
  const G = GOLD();
  box(b, G[0], 1, 0.7, 1, 0, 0.35, 0); box(b, GOLDDK(), 1.04, 0.07, 1.04, 0, 0.035, 0); box(b, GOLDTOP(), 0.9, 0.06, 0.9, 0, 0.72, 0);
  box(b, G[2], 0.06, 0.64, 1.02, 0.5, 0.38, 0); box(b, G[2], 1.02, 0.64, 0.06, 0, 0.38, 0.5); box(b, G[2], 1.02, 0.64, 0.06, 0, 0.38, -0.5); box(b, G[2], 0.06, 0.64, 1.02, -0.5, 0.38, 0);
});

// ---------------- company slice: translucent slab with a rocket / car / planet inside ----------------
const SLICE_COL = ["#ff5b5b", "#4aa8ff", "#7be26b", "#ffcf3f", "#c78bff"];
const rocketGeo = (b: Batch, s = 1, body = "#f4f1ea", nose = "#d6453b") => {
  const W = C("rBody" + body, body), N = C("rNose" + nose, nose), D = C("rDark", "#2c2f38"), S = C("rSteel", "#9aa3ad");
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.075, 0.02), new THREE.Vector2(0.1, 0.1), new THREE.Vector2(0.1, 0.62), new THREE.Vector2(0.001, 0.62)];
  b.add(new THREE.LatheGeometry(pts, 20), W, TR(0, 0.12 * s, 0, 0, 0, 0, [s, s, s]));
  b.add(new THREE.ConeGeometry(0.1, 0.3, 20).translate(0, 0.15, 0), N, TR(0, 0.74 * s, 0, 0, 0, 0, [s, s, s]));
  b.add(new THREE.CylinderGeometry(0.103, 0.103, 0.07, 20), D, TR(0, 0.52 * s, 0, 0, 0, 0, [s, s, s]));
  b.add(new THREE.CylinderGeometry(0.103, 0.103, 0.05, 20), N, TR(0, 0.3 * s, 0, 0, 0, 0, [s, s, s]));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; b.add(new THREE.BoxGeometry(0.035, 0.22, 0.17), N, TR(Math.sin(a) * 0.14 * s, 0.22 * s, Math.cos(a) * 0.14 * s, 0, a, 0, [s, s, s])); }
  b.add(new THREE.ConeGeometry(0.07, 0.1, 14, 1, true).translate(0, -0.05, 0), D, TR(0, 0.13 * s, 0, Math.PI, 0, 0, [s, s, s]));
  b.add(new THREE.SphereGeometry(0.035, 10, 8), C("rWin", "#8fd0ff"), TR(0, 0.42 * s, 0.098 * s, 0, 0, 0, [s, s, 0.5 * s]));
  b.add(new THREE.TorusGeometry(0.037, 0.008, 6, 14), S, TR(0, 0.42 * s, 0.1 * s, 0, 0, 0, [s, s, s]));
};
const rocketObj = () => mk((b) => rocketGeo(b));
const flameObj = () => {
  const g = new THREE.Group();
  const o = new THREE.Mesh(new THREE.ConeGeometry(0.075, 1, 10, 1, true).translate(0, -0.5, 0), glow([3.2, 1.5, 0.35])), n = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.7, 10, 1, true).translate(0, -0.35, 0), glow([4.2, 3.6, 1.6]));
  g.add(o, n); return { g, o, n };
};
const carGeo = (b: Batch, col: string, s = 1) => {
  const B = C("car" + col, col), D = C("carDk", "#23262e"), GL = C("carGl", "#2a3a50"), W = C("carWh", "#1c1c22"), H = C("carHub", "#c9ced6");
  const m = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => TR(x * s, y * s, z * s, 0, 0, 0, [sx * s, sy * s, sz * s]);
  b.add(new THREE.BoxGeometry(1.7, 0.22, 0.78), B, m(0, 0.28, 0));
  b.add(new THREE.BoxGeometry(1.2, 0.14, 0.76), B, m(0.35, 0.43, 0));
  b.add(new THREE.BoxGeometry(0.62, 0.12, 0.74), B, m(-0.58, 0.4, 0));
  b.add(new THREE.SphereGeometry(1, 16, 10), GL, m(0.1, 0.52, 0, 0.5, 0.18, 0.34));
  b.add(new THREE.BoxGeometry(1.74, 0.05, 0.8), D, m(0, 0.17, 0));
  for (const [x, z] of [[0.55, 0.4], [-0.55, 0.4], [0.55, -0.4], [-0.55, -0.4]]) {
    b.add(new THREE.CylinderGeometry(0.19, 0.19, 0.14, 18).rotateX(Math.PI / 2), W, m(x, 0.19, z));
    b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.15, 12).rotateX(Math.PI / 2), H, m(x, 0.19, z * 1.01));
  }
  b.add(new THREE.BoxGeometry(0.05, 0.06, 0.24), glow([4, 3.8, 3.0]), m(-0.86, 0.34, 0.26)); b.add(new THREE.BoxGeometry(0.05, 0.06, 0.24), glow([4, 3.8, 3.0]), m(-0.86, 0.34, -0.26));
  b.add(new THREE.BoxGeometry(0.04, 0.05, 0.22), glow([2.6, 0.3, 0.2]), m(0.86, 0.34, 0.26)); b.add(new THREE.BoxGeometry(0.04, 0.05, 0.22), glow([2.6, 0.3, 0.2]), m(0.86, 0.34, -0.26));
};
const carObj = (col: string) => mk((b) => carGeo(b, col));
const sliceObj = (kind: number, col: string) => mk((b) => {
  const T = CT("slice" + col, col, 0.42), T2 = C("sliceEdge" + col, col);
  box(b, T, 1.5, 2.1, 0.4, 0, 1.05, 0); box(b, T2, 1.56, 0.05, 0.46, 0, 0.025, 0); box(b, T2, 1.56, 0.05, 0.46, 0, 2.12, 0); box(b, T2, 0.05, 2.1, 0.46, -0.77, 1.05, 0); box(b, T2, 0.05, 2.1, 0.46, 0.77, 1.05, 0);
  if (kind === 0) rocketGeo(b, 1.55, "#f4f1ea", "#d6453b"); else if (kind === 1) carGeo(b, "#e24a3f", 0.8);
  else { sph(b, C("planet", "#5aa0e8"), 0, 1.05, 0, 0.5, 0.5, 0.5, 18); b.add(new THREE.TorusGeometry(0.75, 0.04, 6, 30), C("ring", "#ffd23a"), TR(0, 1.05, 0, 1.2, 0, 0.3)); }
}, false);

// ---------------- people-sized things ----------------
const bagObj = () => mk((b) => {
  sph(b, C("bag", "#b9904d"), 0, 0.18, 0, 0.2, 0.2, 0.18, 16); cyl(b, C("bag", "#b9904d"), 0.07, 0.14, 0, 0.38, 0, 0, 0, 12, 0.045);
  b.add(new THREE.TorusGeometry(0.06, 0.016, 6, 12).rotateX(Math.PI / 2), C("bagTie", "#7a4f2a"), TR(0, 0.34, 0));
  cyl(b, C("bagCoin", "#ffd23a"), 0.07, 0.015, 0, 0.18, 0.18, Math.PI / 2, 0, 16);
  sph(b, C("bag", "#b9904d"), -0.06, 0.45, 0, 0.05, 0.03, 0.05, 8); sph(b, C("bag", "#b9904d"), 0.06, 0.45, 0, 0.05, 0.03, 0.05, 8);
});
const briefObj = () => mk((b) => {
  box(b, C("brief", "#5b3a22"), 0.46, 0.3, 0.12, 0, 0.15, 0); box(b, C("briefTr", "#7a5232"), 0.48, 0.03, 0.14, 0, 0.3, 0); box(b, C("briefTr", "#7a5232"), 0.48, 0.03, 0.14, 0, 0.015, 0);
  b.add(new THREE.TorusGeometry(0.07, 0.014, 6, 12, Math.PI), C("steel2", "#aab2bb"), TR(0, 0.31, 0)); box(b, C("steel2", "#aab2bb"), 0.05, 0.05, 0.145, -0.14, 0.24, 0); box(b, C("steel2", "#aab2bb"), 0.05, 0.05, 0.145, 0.14, 0.24, 0);
});
const coinObj = () => mk((b) => { cyl(b, C("coinR", "#d9a21a"), 0.06, 0.022, 0, 0, 0, 0, 0, 24); cyl(b, C("coinI", "#ffd84a"), 0.047, 0.026, 0, 0, 0, 0, 0, 24); box(b, C("coinS", "#ffe58a"), 0.045, 0.03, 0.012, 0, 0, 0); box(b, C("coinS", "#ffe58a"), 0.012, 0.03, 0.045, 0, 0, 0); });
const pbankObj = () => mk((b) => {
  const P = C("pink", "#f19bb8"), P2 = C("pink2", "#e27c9f");
  sph(b, P, 0, 0.3, 0, 0.32, 0.26, 0.24, 18); b.add(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 14).rotateZ(Math.PI / 2), P2, TR(0.34, 0.3, 0)); box(b, C("pinkN", "#7a2e49"), 0.01, 0.03, 0.02, 0.395, 0.31, 0.02); box(b, C("pinkN", "#7a2e49"), 0.01, 0.03, 0.02, 0.395, 0.31, -0.02);
  for (const z of [-0.12, 0.12]) { b.add(new THREE.ConeGeometry(0.06, 0.1, 8), P2, TR(0.2, 0.55, z, 0, 0, z > 0 ? -0.3 : 0.3)); }
  for (const [x, z] of [[0.17, 0.12], [0.17, -0.12], [-0.17, 0.12], [-0.17, -0.12]]) cyl(b, P2, 0.045, 0.14, x, 0.07, z, 0, 0, 10);
  box(b, C("slot", "#3a1a26"), 0.2, 0.02, 0.04, 0, 0.555, 0); sph(b, C("eyeB", "#222"), 0.27, 0.4, 0.14, 0.025, 0.03, 0.02, 8); sph(b, C("eyeB", "#222"), 0.27, 0.4, -0.14, 0.025, 0.03, 0.02, 8);
  b.add(new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI * 1.5), P2, TR(-0.33, 0.32, 0, 0, 0, 0.5));
});
const candleObj = () => {
  const g = new THREE.Group(), wax = new THREE.Group(); g.add(wax);
  wax.add(mk((b) => { cyl(b, C("wax", "#f3ead2"), 0.07, 1, 0, 0.5, 0, 0, 0, 16); cyl(b, C("waxDr", "#e4d6b4"), 0.075, 0.12, 0.02, 0.9, 0, 0, 0, 12); }));
  const top = new THREE.Group(); g.add(top);
  top.add(mk((b) => { box(b, C("wick", "#2a2a2a"), 0.012, 0.06, 0.012, 0, 0.03, 0); }));
  top.add(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 10).translate(0, 0.1, 0), glow([4, 2.2, 0.5])));
  g.add(mk((b) => cyl(b, C("candleBase", "#8a6a3a"), 0.16, 0.04, 0, 0.02, 0, 0, 0, 20)));
  return { g, wax, top };
};
const bubbleObj = () => mk((b) => {
  sph(b, CT("bubbleB", "#9fd8ff", 0.28), 0, 0, 0, 1, 1, 1, 26); sph(b, C("bubHi", "#ffffff"), -0.45, 0.5, 0.55, 0.14, 0.07, 0.04, 8);
  b.add(new THREE.TorusGeometry(0.97, 0.014, 6, 36), C("bubRing", "#ff9ad5"), TR(0, 0, 0, 1.2, 0.3, 0));
}, false);
const gavelObj = () => mk((b) => { box(b, C("gavelH", "#8a5a34"), 0.1, 0.46, 0.1, 0, 0.23, 0); b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.34, 14).rotateZ(Math.PI / 2), C("gavelHd", "#a8744a"), TR(0, 0.5, 0)); cyl(b, C("gavelBd", "#5a3a22"), 0.105, 0.04, 0.17, 0.5, 0, 0, Math.PI / 2, 14); cyl(b, C("gavelBd", "#5a3a22"), 0.105, 0.04, -0.17, 0.5, 0, 0, Math.PI / 2, 14); });
const contractObj = () => mk((b) => {
  box(b, C("paperW", "#f6f1e3"), 1.6, 0.025, 1.1, 0, 0.0125, 0);
  for (let i = 0; i < 7; i++) box(b, C("paperLn", "#8a93a6"), 1.2 - 0.18 * (i % 3), 0.008, 0.045, 0, 0.03, -0.42 + i * 0.1);
  cyl(b, C("seal", "#c8323a"), 0.11, 0.02, 0.55, 0.03, 0.3, 0, 0, 18); b.add(new THREE.TorusGeometry(0.13, 0.02, 6, 20).rotateX(Math.PI / 2), C("sealR", "#e8c45a"), TR(0.55, 0.035, 0.3));
  const pts = [[-0.5, 0.37], [-0.4, 0.28], [-0.3, 0.4], [-0.2, 0.26], [-0.08, 0.38], [0.02, 0.3], [0.14, 0.36]].map(([x, z]) => V(x, 0.033, z));
  b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 6), C("inkB", "#1d2a6a"));
});
const penObj = () => mk((b) => { cyl(b, C("penB", "#1f2430"), 0.018, 0.3, 0, 0.15, 0, 0, 0, 8); cyl(b, C("penG", "#e8c45a"), 0.02, 0.05, 0, 0.1, 0, 0, 0, 8); b.add(new THREE.ConeGeometry(0.018, 0.05, 8), C("penT", "#e8c45a"), TR(0, -0.02, 0, Math.PI)); });
const crownObj = () => mk((b) => {
  const Gd = GOLD();
  b.add(new THREE.CylinderGeometry(0.5, 0.42, 0.28, 20, 1, true), C2("crownB", "#ffcf45"), TR(0, 0.14, 0)); b.add(new THREE.TorusGeometry(0.46, 0.04, 6, 24).rotateX(Math.PI / 2), Gd[0], TR(0, 0.28, 0)); b.add(new THREE.TorusGeometry(0.43, 0.04, 6, 24).rotateX(Math.PI / 2), Gd[1], TR(0, 0.02, 0));
  const jc = ["#e23b4a", "#3f86e0", "#2fb86a", "#e23b4a", "#3f86e0", "#2fb86a", "#e23b4a", "#3f86e0"];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; b.add(new THREE.ConeGeometry(0.1, 0.3, 4), Gd[2], TR(Math.sin(a) * 0.47, 0.42, Math.cos(a) * 0.47, 0, a, 0)); sph(b, C("jew" + i % 3, jc[i]), Math.sin(a) * 0.47, 0.6, Math.cos(a) * 0.47, 0.05, 0.05, 0.05, 8); sph(b, C("jewB" + i % 3, jc[i]), Math.sin(a + 0.4) * 0.49, 0.16, Math.cos(a + 0.4) * 0.49, 0.04, 0.04, 0.04, 8); }
});
const podiumObj = (side: string, top: string) => {
  const g = new THREE.Group(), inner = mk((b) => { box(b, C("pb" + side, side), 1, 1, 1, 0, 0.5, 0); box(b, C("pbT" + top, top), 1.04, 0.06, 1.04, 0, 1.0, 0); box(b, C("pbB", "#ffffff"), 1.02, 0.05, 1.02, 0, 0.03, 0); });
  g.add(inner); return { g, inner };
};
const pizzaObj = (withGap: boolean) => mk((b) => {
  const N = 8, gap = withGap ? 1 : 0, cr = C("crust", "#e2a24f"), ch = C("cheeseP", "#ffd75e"), sa = C("sauce", "#d6452c"), pe = C("pepp", "#b4322c"), gr = C("greenP", "#4f9a3f");
  for (let k = gap; k < N; k++) {
    const t0 = (k / N) * Math.PI * 2, tl = (Math.PI * 2) / N - 0.02;
    b.add(new THREE.CylinderGeometry(1, 1, 0.12, 6, 1, false, t0, tl), ch, TR(0, 0.06, 0));
    b.add(new THREE.CylinderGeometry(1.0, 1.0, 0.16, 6, 1, true, t0, tl), cr, TR(0, 0.08, 0));
    const m = t0 + tl / 2;
    sph(b, pe, Math.sin(m) * 0.55, 0.13, Math.cos(m) * 0.55, 0.14, 0.03, 0.14, 10); sph(b, pe, Math.sin(m + 0.2) * 0.84, 0.13, Math.cos(m + 0.2) * 0.84, 0.1, 0.03, 0.1, 10);
    if (k % 2) sph(b, gr, Math.sin(m - 0.15) * 0.32, 0.135, Math.cos(m - 0.15) * 0.32, 0.06, 0.025, 0.05, 8);
    sph(b, sa, Math.sin(m) * 0.3, 0.125, Math.cos(m) * 0.3, 0.09, 0.012, 0.09, 8);
  }
  cyl(b, C("pizzaBase", "#c98a3f"), 1.0, 0.04, 0, 0.0, 0, 0, 0, 40);
});
const psliceObj = () => mk((b) => {
  const cr = C("crust", "#e2a24f"), ch = C("cheeseP", "#ffd75e"), pe = C("pepp", "#b4322c"), tl = Math.PI / 4 - 0.02;
  b.add(new THREE.CylinderGeometry(1, 1, 0.14, 6, 1, false, 0, tl), glow([2.4, 1.9, 0.7]), TR(0, 0.07, 0)); b.add(new THREE.CylinderGeometry(1, 1, 0.12, 6, 1, false, 0.01, tl - 0.02), ch, TR(0, 0.17, 0));
  b.add(new THREE.CylinderGeometry(1.01, 1.01, 0.18, 6, 1, true, 0, tl), cr, TR(0, 0.09, 0));
  sph(b, pe, Math.sin(0.4) * 0.55, 0.24, Math.cos(0.4) * 0.55, 0.14, 0.03, 0.14, 10); sph(b, pe, Math.sin(0.5) * 0.84, 0.24, Math.cos(0.5) * 0.84, 0.1, 0.03, 0.1, 10);
});
const pieObj = () => {
  const g = new THREE.Group(), wedges: THREE.Group[] = [], ang = [150, 100, 65, 45], cols = ["#ffcf45", "#f2a81f", "#aeb6c6", "#d0d6e2"], mids: number[] = [];
  let a0 = -ang[0] / 2;
  ang.forEach((d, i) => {
    const t0 = (a0 * Math.PI) / 180, tl = (d * Math.PI) / 180 - 0.02, w = mk((b) => { b.add(new THREE.CylinderGeometry(1, 1, 0.3, 24, 1, false, t0, tl), C("pie" + i, cols[i]), TR(0, 0.15, 0)); b.add(new THREE.CylinderGeometry(1.01, 1.01, 0.04, 24, 1, true, t0, tl), C("pieR", "#ffffff"), TR(0, 0.31, 0)); });
    g.add(w); wedges.push(w); mids.push(t0 + tl / 2); a0 += d;
  });
  return { g, wedges, mids };
};
const mtruckObj = () => mk((b) => {
  const R = C("truckR", "#d6453b"), D = C("truckD", "#2c2f38"), Wc = C("truckW", "#1c1c22"), S = C("truckS", "#aab2bb"), Gd = GOLD();
  box(b, R, 1.5, 1.5, 2.0, 0, 1.15, 2.4); box(b, C("truckGl", "#2a3a50"), 1.3, 0.6, 0.05, 0, 1.55, 3.42); box(b, S, 1.4, 0.15, 0.1, 0, 0.55, 3.45); box(b, D, 2.0, 0.3, 5.6, 0, 0.55, 0);
  box(b, C("truckBed", "#7a5a3a"), 2.1, 0.15, 4.4, 0, 0.85, -0.5); for (const x of [-1.05, 1.05]) box(b, C("truckBedS", "#9a7a52"), 0.1, 0.7, 4.4, x, 1.2, -0.5); box(b, C("truckBedS", "#9a7a52"), 2.1, 0.7, 0.1, 0, 1.2, 1.7);
  for (let l = 0; l < 4; l++) for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) ingot(b, Gd[(l + r + c) % 3], -0.5 + c * 1.0, 0.92 + l * 0.2, 1.1 - r * 0.95, (l % 2) * Math.PI / 2, 0.9, 0.2, 0.45);
  for (const z of [2.6, 0.2, -1.8]) for (const x of [-1.05, 1.05]) { b.add(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 18).rotateZ(Math.PI / 2), Wc, TR(x, 0.5, z)); b.add(new THREE.CylinderGeometry(0.25, 0.25, 0.37, 12).rotateZ(Math.PI / 2), S, TR(x * 1.01, 0.5, z)); }
  box(b, glow([4, 3.6, 2.6]), 0.3, 0.2, 0.05, -0.55, 0.85, 3.43); box(b, glow([4, 3.6, 2.6]), 0.3, 0.2, 0.05, 0.55, 0.85, 3.43); cyl(b, S, 0.07, 1.4, 0.8, 2.3, 1.9, 0, 0, 8);
});
const mblockObj = () => mk((b) => { box(b, glow([3.2, 2.8, 1.2]), 3.2, 0.14, 0.6, 0, 0, 0); }, false);
const smokeObj = () => mk((b) => { for (const [x, y, z, r] of [[0, 0, 0, 0.5], [-0.4, -0.2, 0.1, 0.36], [0.45, -0.15, 0.05, 0.4], [0.1, 0.45, 0, 0.32], [-0.1, -0.35, 0.3, 0.3]] as const) sph(b, C("smokeS", "#e3e1e8"), x, y, z, r, r * 0.9, r, 10); }, false);
const darkSmokeObj = () => mk((b) => { for (const [x, y, z, r] of [[0, 0, 0, 0.5], [-0.4, -0.2, 0.1, 0.36], [0.45, -0.15, 0.05, 0.4], [0.1, 0.45, 0, 0.32]] as const) sph(b, C("smokeD", "#4a4852"), x, y, z, r, r * 0.9, r, 10); }, false);
const confObj = (i: number) => mk((b) => box(b, C("conf" + (i % 6), ["#e2453c", "#f2c230", "#3f86e0", "#3fa86a", "#e1669d", "#ffffff"][i % 6]), 0.12, 0.012, 0.07, 0, 0, 0), false);
const shardObj = (i: number) => mk((b) => { b.add(new THREE.TetrahedronGeometry(0.4), C("shard" + (i % 3), ["#d8d8de", "#d6453b", "#3a3d46"][i % 3])); });
const sparkObj = () => mk((b) => { box(b, glow([5, 4, 1.4]), 0.07, 0.07, 0.07, 0, 0, 0); }, false);
const qmarkObj = () => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 14; i++) { const a = Math.PI * (0.95 - 1.5 * i / 14); pts.push(V(0.1 * Math.cos(a), 0.34 + 0.1 * Math.sin(a), 0)); }
  pts.push(V(0.02, 0.18, 0), V(0, 0.1, 0));
  return mk((b) => { b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.032, 8), C("qmark", "#ffd23a")); sph(b, C("qmark", "#ffd23a"), 0, -0.02, 0, 0.042, 0.042, 0.042, 10); });
};
const envObj = () => mk((b) => { box(b, C("env", "#f1ead6"), 0.36, 0.02, 0.24, 0, 0, 0); box(b, C("envF", "#dccfae"), 0.36, 0.006, 0.12, 0, 0.012, -0.06, 0.45, 0, 0); box(b, C("envF", "#dccfae"), 0.36, 0.006, 0.12, 0, 0.012, 0.06, -0.45, 0, 0); box(b, C("sred", "#d6453b"), 0.04, 0.008, 0.04, 0, 0.018, 0); });
const wreckObj = () => mk((b) => {
  const W = C("rBody#f4f1ea", "#f4f1ea"), N = C("rNose#d6453b", "#d6453b"), D = C("rDark", "#2c2f38"), CH = C("charred", "#3a3236");
  b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 14), CH, TR(0, 0.1, 0, 0, 0, 0.1)); b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 14, 1, true), W, TR(0.22, 0.12, 0.03, 0, 0, 1.45));
  b.add(new THREE.ConeGeometry(0.1, 0.3, 14), N, TR(-0.3, 0.07, 0.15, 0, 0.4, -1.4)); b.add(new THREE.BoxGeometry(0.035, 0.2, 0.15), N, TR(0.05, 0.14, -0.15, 0.4, 0, 0.8)); b.add(new THREE.BoxGeometry(0.035, 0.18, 0.15), D, TR(0.4, 0.04, 0.12, 0, 0.5, 1.6));
  b.add(new THREE.SphereGeometry(0.12, 10, 8), CH, TR(0.0, 0.03, -0.1, 0, 0, 0, [1.3, 0.5, 1]));
});


// ---------------- pizza short: pizza box (lid opens with a), balance scale (beam tilt a) ----------------
const pboxObj = () => {
  const g = new THREE.Group(), lid = new THREE.Group();
  const W = C("pboxW", "#f6ecd6"), Rd = C("pboxR", "#d6453b"), K = C("pboxK", "#cdbd97");
  g.add(mk((b) => {
    box(b, W, 1, 0.07, 1, 0, 0.035, 0);
    for (const s of [-1, 1]) { box(b, W, 0.03, 0.14, 1, s * 0.485, 0.07, 0); box(b, W, 1, 0.14, 0.03, 0, 0.07, s * 0.485); box(b, Rd, 1.004, 0.035, 0.035, 0, 0.11, s * 0.49); box(b, Rd, 0.035, 0.035, 1.004, s * 0.49, 0.11, 0); }
    box(b, K, 0.96, 0.01, 0.96, 0, 0.075, 0);
  }));
  const pz = pizzaObj(false); pz.scale.set(0.43, 0.43, 0.43); pz.position.set(0, 0.08, 0); g.add(pz);
  lid.position.set(0, 0.14, -0.5); g.add(lid);
  lid.add(mk((b) => {
    box(b, W, 1, 0.03, 1, 0, 0.015, 0.5);
    cyl(b, Rd, 0.27, 0.012, 0, 0.034, 0.5, 0, 0, 28); cyl(b, W, 0.21, 0.016, 0, 0.036, 0.5, 0, 0, 28);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.4; cyl(b, Rd, 0.05, 0.02, Math.sin(a) * 0.1, 0.038, 0.5 + Math.cos(a) * 0.1, 0, 0, 12); }
    box(b, Rd, 1.004, 0.032, 0.035, 0, 0.016, 0.985);
  }));
  return { o: g, upd: (r: SR) => { lid.rotation.x = -(r.a ?? 0); pz.visible = !(r.b ?? 0); } };
};
export const SCALE = { h: 2.2, L: 1.6, drop: 0.95 };
/** world position of a pan's top (side -1 left / +1 right) for a scale at (x,y,z) with scale s and beam tilt a */
export const panTop = (x: number, y: number, z: number, s: number, a: number, side: -1 | 1): [number, number, number] =>
  [x + side * SCALE.L * Math.cos(a) * s, y + (SCALE.h + side * SCALE.L * Math.sin(a) - SCALE.drop + 0.06) * s, z];
const scaleObj = () => {
  const g = new THREE.Group(), piv = new THREE.Group(), pans: THREE.Group[] = [];
  const B = C("brass", "#d9a63a"), BD = C("brassDk", "#a8762a"), WD = C("scaleWood", "#6a4630");
  g.add(mk((b) => {
    cyl(b, WD, 0.75, 0.22, 0, 0.11, 0, 0, 0, 28); cyl(b, B, 0.55, 0.1, 0, 0.27, 0, 0, 0, 28);
    cyl(b, B, 0.08, SCALE.h - 0.3, 0, 0.3 + (SCALE.h - 0.3) / 2, 0, 0, 0, 14); sph(b, BD, 0, SCALE.h + 0.12, 0, 0.13, 0.13, 0.13, 14);
  }));
  piv.position.y = SCALE.h; g.add(piv);
  piv.add(mk((b) => { box(b, B, SCALE.L * 2 + 0.2, 0.1, 0.12, 0, 0, 0); for (const s2 of [-1, 1]) sph(b, BD, s2 * (SCALE.L + 0.1), 0, 0, 0.09, 0.09, 0.09, 10); }));
  for (const s2 of [-1, 1]) {
    const p = new THREE.Group(); p.position.x = s2 * SCALE.L; piv.add(p); pans.push(p);
    p.add(mk((b) => {
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const dx = Math.sin(a) * 0.45, dz = Math.cos(a) * 0.45; b.add(beamGeo(V(0, 0, 0), V(dx, -SCALE.drop, dz), 0.012), BD, undefined); }
      cyl(b, B, 0.6, 0.06, 0, -SCALE.drop, 0, 0, 0, 32, 0.66);
    }));
  }
  return { o: g, upd: (r: SR) => { const a = r.a ?? 0; piv.rotation.z = a; for (const p of pans) p.rotation.z = -a; } };
};

// ---------------- the pool ----------------
type Slot = { o: THREE.Object3D; used: boolean; upd?: (r: SR) => void };
export class Solids {
  root = new THREE.Group();
  private pools = new Map<string, Slot[]>();
  private q = new THREE.Quaternion(); private e = new THREE.Euler();
  constructor(parent: THREE.Object3D) {
    parent.add(this.root);
    const add = (k: string, n: number, f: (i: number) => THREE.Object3D | { o?: THREE.Object3D; g?: THREE.Object3D; upd: (r: SR) => void }) => {
      const l: Slot[] = [];
      for (let i = 0; i < n; i++) {
        const r = f(i) as { o?: THREE.Object3D; g?: THREE.Object3D; upd?: (r: SR) => void } & THREE.Object3D;
        const isObj = (r as THREE.Object3D).isObject3D;
        const o = isObj ? (r as THREE.Object3D) : (r.o ?? r.g)!;
        const upd = isObj ? undefined : r.upd;
        o.visible = false; this.root.add(o); l.push({ o, used: false, upd });
      }
      this.pools.set(k, l);
    };
    add("pile", 5, (i) => pileObj(i + 1));
    add("gcol", 16, () => { const o = colObj(22); return { o, upd: (r) => { const k = r.s ?? 1; o.scale.set(k, Math.max(0.0001, (r.a ?? 1) * k), k); } }; });
    add("gbar", 40, barObj); add("gblk", 26, blockObj);
    add("slice", 3, (i) => sliceObj(i, SLICE_COL[(i * 2) % 5]));
    add("rocket", 6, rocketObj);
    add("flame", 6, () => { const f = flameObj(); return { o: f.g, upd: (r) => { const L = r.a ?? 1, w = 1 + 0.1 * Math.sin(r.b ?? 0); f.o.scale.set(w, L, w); f.n.scale.set(1, L * 0.9, 1); } }; });
    add("car", 3, (i) => carObj(["#d93a35", "#e9eaf2", "#3f6fb5"][i]));
    add("coin", 120, coinObj); add("mbag", 2, bagObj); add("brief", 1, briefObj); add("pbank", 1, pbankObj);
    add("candle", 1, () => { const c = candleObj(); return { o: c.g, upd: (r) => { const h = Math.max(0.05, r.a ?? 1); c.wax.scale.y = h; c.top.position.y = h; c.top.scale.setScalar(0.9 + 0.2 * Math.sin((r.b ?? 0) * 11)); } }; });
    add("bubble", 3, bubbleObj); add("gavel", 1, gavelObj); add("contract", 1, contractObj); add("pen", 1, penObj); add("crown", 1, crownObj);
    add("pblock", 8, (i) => { const p = podiumObj(["#3f6fb5", "#e8e8f0", "#d6453b", "#f2b823"][i % 4], ["#f2b823", "#ffffff", "#ffd7a0", "#fff3b0"][i % 4]); return { o: p.g, upd: (r) => p.inner.scale.set(r.a ?? 1, r.b ?? 1, r.c ?? 1) }; });
    add("pizza", 2, () => pizzaObj(true)); add("pslice", 2, psliceObj);
    add("pie", 2, () => { const p = pieObj(); return { o: p.g, upd: (r) => { p.wedges.forEach((w, i) => { const pull = i < 2 ? (r.a ?? 0) : 0, m = p.mids[i]; w.position.set(Math.sin(m) * pull, i < 2 ? (r.b ?? 0) * pull : 0, Math.cos(m) * pull); }); } }; });
    add("mtruck", 1, mtruckObj); add("mmark", 3, mblockObj);
    add("smoke", 36, smokeObj); add("dsmoke", 24, darkSmokeObj); add("conf", 70, confObj); add("shard", 30, shardObj); add("spark", 40, sparkObj);
    add("qmark", 4, qmarkObj); add("pbox", 44, pboxObj); add("scale", 1, scaleObj); add("env", 1, envObj); add("wreck", 4, wreckObj);
  }
  private place(o: THREE.Object3D, r: SR, cq: THREE.Quaternion) {
    o.visible = true; o.position.set(r.x, r.y, r.z);
    this.e.set(r.pitch ?? 0, r.yaw ?? 0, r.roll ?? 0, "YXZ");
    if (r.cam) { this.q.copy(cq); if (r.post) this.q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), r.post)); this.q.multiply(new THREE.Quaternion().setFromEuler(this.e)); o.quaternion.copy(this.q); } else o.rotation.copy(this.e);
    o.scale.setScalar(r.s ?? 1);
  }
  apply(reqs: SR[], cam: THREE.Camera) {
    const cq = cam.quaternion;
    for (const l of this.pools.values()) l.forEach((s) => { s.used = false; s.o.visible = false; });
    for (const r of reqs) {
      const l = this.pools.get(r.k), s = l?.find((x) => !x.used);
      if (s) { s.used = true; this.place(s.o, r, cq); s.upd?.(r); }
    }
  }
}
