// The eleven sets of "How Elon Musk Became the Richest Person": gold plain with skyline and mesas, 90s start-up office,
// beach, rocket hangar, launch pad, garage, cliff + canyon, studio, night pizzeria street, city plaza with towers and a
// race track. Every interior is closed (floor, four walls, ceiling with lamps); every open set has layered depth
// (painted sky from world.ts, fog, distant silhouettes / mesas / skyline, sun glow) and textured surfaces (wood grain,
// brick, metal panels, concrete, sand, strata). Procedural geometry merged per material (Batch).
import * as THREE from "three";
import { Batch, lam, V, Kit, prop, boxGeo, quad, M4, beamGeo, groundQuad, flatRect } from "./build";
import { ctex, planksHD, stoneHD, brick, grassHD, facadeHD, rng, waterNear } from "./paint";
import { SetId } from "./story";

export type SetBuild = { groups: Record<SetId, THREE.Group>; dayOnly: THREE.Group[]; nightOnly: THREE.Group[] };

// ---------------- materials / helpers ----------------
const C = (key: string, color: string) => lam("m_" + key, () => ({ color }));
const C2 = (key: string, color: string) => lam("m_" + key, () => ({ color, side: THREE.DoubleSide }));
const gl = new Map<string, THREE.MeshBasicMaterial>();
export const glow = (col: [number, number, number] = [3.2, 2.2, 1.0]) => {
  const k = col.join("_");
  let m = gl.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), toneMapped: true }); gl.set(k, m); }
  return m;
};
const bx = (b: Batch, m: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  b.add(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m, M4((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
/** box centred on x,z with its base at y */
const box = (b: Batch, m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0) =>
  b.add(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), m, M4(x, y, z, yaw));
const cylY = (b: Batch, m: THREE.Material, x: number, y: number, z: number, r: number, h: number, seg = 16, rTop?: number, yaw = 0) =>
  b.add(new THREE.CylinderGeometry(rTop ?? r, r, h, seg).translate(0, h / 2, 0), m, M4(x, y, z, yaw));
const sphere = (b: Batch, m: THREE.Material, x: number, y: number, z: number, r: number, sy = 1, seg = 14) =>
  b.add(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), m, M4(x, y, z, 0, [1, sy, 1]));
const build = (parent: THREE.Object3D, fn: (b: Batch) => void, cast = true) => { const b = new Batch(); fn(b); b.build(parent, cast); };
/** local frame (ox, oz, yaw): boxes placed in the frame of a rotated piece of furniture */
const loc = (b: Batch, ox: number, oz: number, yaw: number) => {
  const c = Math.cos(yaw), s = Math.sin(yaw), w = (lx: number, lz: number): [number, number] => [ox + lx * c + lz * s, oz - lx * s + lz * c];
  return {
    box: (m: THREE.Material, lx: number, y: number, lz: number, W: number, H: number, D: number) => { const [x, z] = w(lx, lz); box(b, m, x, y, z, W, H, D, yaw); },
    cyl: (m: THREE.Material, lx: number, y: number, lz: number, r: number, h: number, seg = 12, rt?: number) => { const [x, z] = w(lx, lz); cylY(b, m, x, y, z, r, h, seg, rt, yaw); },
  };
};

// ---------------- painted textures ----------------
const windowsTex = (key: string, glass: string, lit: string, litP: number) => ctex("win_" + key, 256, 256, (g, r) => {
  g.fillStyle = glass; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) {
    const on = r() < litP;
    g.fillStyle = on ? lit : "rgba(20,28,50,0.55)"; g.fillRect(x * 42 + 6, y * 32 + 6, 30, 22);
    g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(x * 42 + 6, y * 32 + 6, 30, 4);
  }
  g.fillStyle = "rgba(10,14,30,0.5)"; for (let y = 0; y <= 8; y++) g.fillRect(0, y * 32 - 1, 256, 3);
});
const carpetTex = () => ctex("carpet", 256, 256, (g, r) => {
  g.fillStyle = "#4a5f86"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) { g.fillStyle = r() > 0.5 ? "rgba(100,125,170,0.35)" : "rgba(30,40,70,0.3)"; g.fillRect(r() * 256, r() * 256, 3, 2); }
  g.strokeStyle = "rgba(190,210,240,0.22)"; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
});
const metalTex = (key: string, base: string, rib: string) => ctex("metal_" + key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = rib; g.fillRect(x, 0, 5, 512); g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(x + 5, 0, 3, 512); g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(x + 8, 0, 6, 512); }
  for (let y = 0; y < 512; y += 128) { g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(0, y, 512, 4); for (let x = 12; x < 512; x += 64) { g.fillStyle = "rgba(40,40,50,0.7)"; g.beginPath(); g.arc(x, y + 14, 3, 0, 6.3); g.fill(); } }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,50,40,${0.04 + r() * 0.06})`; g.fillRect(r() * 512, r() * 512, 20 + r() * 80, 10 + r() * 40); }
});
const concreteTex = () => ctex("concrete", 512, 512, (g, r) => {
  g.fillStyle = "#b9b6ae"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "60,55,50"},${0.04 + r() * 0.07})`; g.fillRect(r() * 512, r() * 512, 30 + r() * 120, 20 + r() * 80); }
  g.strokeStyle = "rgba(60,55,50,0.5)"; g.lineWidth = 3; g.strokeRect(0, 0, 512, 512); g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke();
});
const sandTex = (key = "sand", a = "#e8c98a", b2 = "#d9b273") => ctex(key, 512, 512, (g, r) => {
  g.fillStyle = a; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) { g.strokeStyle = r() > 0.5 ? b2 : "rgba(255,240,200,0.5)"; g.lineWidth = 2 + r() * 4; g.beginPath(); const y = r() * 512, x = r() * 512; g.moveTo(x, y); g.bezierCurveTo(x + 60, y - 10, x + 120, y + 14, x + 200, y); g.stroke(); }
  for (let i = 0; i < 700; i++) { g.fillStyle = "rgba(120,90,50,0.18)"; g.fillRect(r() * 512, r() * 512, 2, 2); }
});
const strataTex2 = (cols: string[]) => ctex("strata2_" + cols[0], 256, 512, (g, r) => {
  let y = 0; while (y < 512) { const h = 14 + r() * 40; g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(0, y, 256, h); g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(0, y + h - 3, 256, 3); y += h; }
  for (let i = 0; i < 60; i++) { g.fillStyle = "rgba(60,30,20,0.12)"; g.fillRect(r() * 256, r() * 512, 3 + r() * 6, 20 + r() * 60); }
});
const asphaltTex = () => ctex("asphalt", 512, 512, (g, r) => {
  g.fillStyle = "#44464f"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1600; i++) { g.fillStyle = r() > 0.5 ? "rgba(120,124,140,0.28)" : "rgba(10,10,20,0.3)"; g.fillRect(r() * 512, r() * 512, 3, 3); }
});
const sunburst = (key: string, c1: string, c2: string) => ctex("sun_" + key, 1024, 1024, (g) => {
  const n = 22; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? c1 : c2; g.beginPath(); g.moveTo(512, 1024); g.arc(512, 1024, 1500, -Math.PI * (i / n), -Math.PI * ((i + 1) / n), true); g.closePath(); g.fill(); }
  const gr = g.createRadialGradient(512, 1024, 0, 512, 1024, 900); gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
});
const checkerTex = (a: string, b2: string) => ctex("chk_" + a + b2, 256, 256, (g) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? a : b2; g.fillRect(x * 64, y * 64, 64, 64); } g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(0, 0, 256, 8); });
const stripeTex = (key: string, a: string, b2: string) => ctex("stripe_" + key, 256, 256, (g) => { for (let x = 0; x < 8; x++) { g.fillStyle = x % 2 ? a : b2; g.fillRect(x * 32, 0, 32, 256); } });
const trackTex = () => ctex("trackRed", 512, 512, (g, r) => { g.fillStyle = "#c4553a"; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 1500; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,190,150,0.25)" : "rgba(90,20,10,0.25)"; g.fillRect(r() * 512, r() * 512, 3, 3); } });
const crowdTex = () => ctex("crowd", 512, 256, (g, r) => {
  g.fillStyle = "#6c7384"; g.fillRect(0, 0, 512, 256);
  const cols = ["#e2453c", "#f2c230", "#3f86e0", "#3fa86a", "#e1669d", "#f4f0e6", "#8a5ac9"];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 32; x++) { g.fillStyle = cols[Math.floor(r() * 7)]; g.beginPath(); g.arc(x * 16 + 8 + (y % 2) * 4, y * 32 + 22, 8, 0, 6.3); g.fill(); g.fillStyle = "#f5c9a0"; g.beginPath(); g.arc(x * 16 + 8 + (y % 2) * 4, y * 32 + 8, 5, 0, 6.3); g.fill(); }
});
const hazardTex = () => ctex("hazard", 256, 64, (g) => { g.fillStyle = "#f2c230"; g.fillRect(0, 0, 256, 64); g.fillStyle = "#26222c"; for (let x = -64; x < 256; x += 64) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 32, 64); g.lineTo(x + 64, 0); g.lineTo(x + 32, 0); g.closePath(); g.fill(); } });
const skylineGlowTex = () => ctex("winSky", 256, 512, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#5a7fd0"); gr.addColorStop(0.6, "#ffb877"); gr.addColorStop(1, "#ffd9a0"); g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  g.fillStyle = "#6a5a86"; for (let i = 0; i < 12; i++) { const h = 60 + r() * 150, x = i * 22; g.fillRect(x, 512 - h, 20, h); }
  g.fillStyle = "#3a3060"; for (let i = 0; i < 8; i++) { const h = 40 + r() * 100, x = i * 33 + 6; g.fillRect(x, 512 - h, 26, h); }
});
const surf = (key: string, tx: () => THREE.Texture) => lam("m_" + key, () => ({ map: tx() }));
const plankM = () => lam("m_planks", () => ({ map: planksHD() }));
const brickM = () => lam("m_brick", () => ({ map: brick() }));
const metalM = (key = "m1", base = "#8f98a3", rib = "#6b737e") => surf("metal_" + key, () => metalTex(key, base, rib));
const concreteM = () => surf("concrete", concreteTex);
const sandM = () => surf("sand", () => sandTex());
const carpetM = () => surf("carpet", carpetTex);
const winM = (key: string, glass = "#3d4f7a", lit = "#ffd36b", p = 0.35) => surf("win_" + key, () => windowsTex(key, glass, lit, p));

const M = {
  wood: () => C("wood", "#a8744a"), woodDk: () => C("woodDk", "#6a4630"), woodLt: () => C("woodLt", "#c9985f"), iron: () => C("iron", "#4d5260"),
  steel: () => C("steel", "#9aa3ad"), beige: () => C("beige", "#d9cfae"), beigeDk: () => C("beigeDk", "#b9ae8a"), black: () => C("black", "#26222c"),
  white: () => C("white", "#e9edf2"), red: () => C("red", "#c0392f"), blue: () => C("blue", "#3f6fb5"), yellow: () => C("yellow", "#f2c230"),
  gold: () => C("gold", "#f2b823"), orange: () => C("orange", "#e8803a"), teal: () => C("teal", "#2f8f94"), copper: () => C("copper", "#cf7b3a"),
  pink: () => C("pinkW", "#e27c9f"), purple: () => C("purple", "#7a52b8"),
};

// ---------------- reusable scenery ----------------
/** skyscraper with a window texture, base at y 0 */
const tower = (b: Batch, x: number, z: number, w: number, d: number, h: number, mat: THREE.Material) => {
  b.add(boxGeo(V(x - w / 2, 0, z - d / 2), V(x + w / 2, h, z + d / 2), 9), mat);
  bx(b, M.iron(), x - w / 2 - 0.4, x + w / 2 + 0.4, h, h + 1.2, z - d / 2 - 0.4, z + d / 2 + 0.4); if (h > 40) cylY(b, M.steel(), x, h + 1.2, z, 0.3, h * 0.12, 6, 0.08);
};
/** distant skyline ring: silhouettes in flat colour (fog does the rest) */
const skylineRing = (b: Batch, r0: number, r1: number, n: number, hMin: number, hMax: number, col: string, seed: number, arc = Math.PI * 2, a0 = 0) => {
  const r = rng(seed), m = C("sky" + col + seed, col);
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * arc + r() * 0.05, d = r0 + (r1 - r0) * r(), w = 14 + r() * 26, h = hMin + (hMax - hMin) * r() * r(); box(b, m, Math.sin(a) * d, 0, -Math.cos(a) * d, w, h, w * (0.7 + r() * 0.6), a); }
};
const mesa = (b: Batch, m: THREE.Material, x: number, z: number, r: number, h: number) => {
  cylY(b, m, x, -2, z, r, h + 2, 12, r * 0.72); cylY(b, m, x, h - 2, z, r * 0.74, 7, 12, r * 0.6);
};
const mesaRing = (b: Batch, m: THREE.Material, n: number, r0: number, r1: number, hMin: number, hMax: number, seed: number, arc = Math.PI * 2, a0 = 0) => {
  const r = rng(seed); for (let i = 0; i < n; i++) { const a = a0 + (i / n) * arc + r() * 0.2, d = r0 + (r1 - r0) * r(); mesa(b, m, Math.sin(a) * d, -Math.cos(a) * d, 26 + r() * 50, hMin + (hMax - hMin) * r()); }
};
const palm = (b: Batch, x: number, z: number, h: number, lean: number) => {
  const trunk = C("palmT", "#8a6a44"), leaf = C2("palmL", "#4fa05a"), leaf2 = C2("palmL2", "#3f8a4a");
  for (let i = 0; i < 7; i++) { const t = i / 7, k = h / 7; cylY(b, trunk, x + lean * t * t * h, t * h, z, 0.22 - 0.07 * t, k * 1.05, 8, 0.2 - 0.07 * (t + 0.14)); }
  const tx = x + lean * h, ty = h;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, L = h * 0.5; b.add(new THREE.ConeGeometry(0.5, L, 4, 1, true).translate(0, L / 2, 0), i % 2 ? leaf : leaf2, new THREE.Matrix4().compose(V(tx, ty, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.cos(a) * 1.15, 0, Math.sin(a) * -1.15)), V(1, 1, 1))); }
  sphere(b, C("coco", "#5a3a22"), tx + 0.2, ty - 0.1, z + 0.1, 0.22, 1, 8); sphere(b, C("coco", "#5a3a22"), tx - 0.2, ty - 0.15, z, 0.2, 1, 8);
};
const lampPost = (b: Batch, x: number, z: number, h = 4.6, col: [number, number, number] = [5, 3.8, 1.8]) => {
  cylY(b, M.iron(), x, 0, z, 0.1, h, 8, 0.07); cylY(b, M.iron(), x, 0, z, 0.2, 0.3, 8, 0.13); b.add(beamGeo(V(x, h, z), V(x + 0.6, h + 0.2, z), 0.07), M.iron(), undefined);
  sphere(b, glow(col), x + 0.7, h + 0.1, z, 0.22, 0.8, 10);
};
const hang = (b: Batch, x: number, y0: number, y1: number, z: number, shadeCol: string, rr = 0.5) => {
  b.add(beamGeo(V(x, y0, z), V(x, y1 + 0.3, z), 0.03), M.iron(), undefined);
  b.add(new THREE.ConeGeometry(rr, 0.35, 14, 1, true).translate(0, 0.17, 0), lam("m_shade" + shadeCol, () => ({ color: shadeCol, side: THREE.DoubleSide })), M4(x, y1, z));
  sphere(b, glow([5, 4.2, 2.8]), x, y1 + 0.08, z, 0.13, 1, 10);
};
const room = (b: Batch, X: number, Z0: number, Z1: number, H: number, wall: THREE.Material, floor: THREE.Material, ceil: THREE.Material, tileF = 2) => {
  b.add(flatRect(-X, X, Z0, Z1, 0, tileF), floor);
  bx(b, wall, -X, X, 0, H, Z0 - 0.4, Z0); bx(b, wall, -X - 0.4, -X, 0, H, Z0, Z1); bx(b, wall, X, X + 0.4, 0, H, Z0, Z1); bx(b, wall, -X, X, 0, H, Z1, Z1 + 0.4);
  bx(b, ceil, -X - 0.4, X + 0.4, H, H + 0.4, Z0 - 0.4, Z1 + 0.4);
};

// ---------------- the world ----------------

// ---------------- pizza short: painted textures ----------------
const viewTex = (night: boolean) => ctex("view" + (night ? "N" : "D"), 512, 384, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 384);
  if (night) { gr.addColorStop(0, "#1c2458"); gr.addColorStop(1, "#4a3f86"); } else { gr.addColorStop(0, "#5fa8f0"); gr.addColorStop(1, "#cfe8ff"); }
  g.fillStyle = gr; g.fillRect(0, 0, 512, 384);
  if (night) { g.fillStyle = "#fff6c8"; g.beginPath(); g.arc(400, 80, 34, 0, 6.3); g.fill(); g.fillStyle = "#1c2458"; g.beginPath(); g.arc(386, 70, 30, 0, 6.3); g.fill(); for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(255,255,230,0.8)"; g.fillRect(r() * 512, r() * 200, 2, 2); } }
  else { g.fillStyle = "#fff8d8"; g.beginPath(); g.arc(410, 80, 34, 0, 6.3); g.fill(); for (const [x, y, s] of [[90, 70, 1], [260, 50, 0.8]]) { g.fillStyle = "#ffffff"; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * 26 * s, y + (k % 2) * 6, 22 * s, 0, 6.3); g.fill(); } } }
  // roofs across the street
  const roofs = night ? "#2a2550" : "#c97a5a", walls = night ? "#3a3468" : "#f2d6b0";
  for (let i = 0; i < 4; i++) { const x = i * 140 - 20; g.fillStyle = walls; g.fillRect(x, 280, 120, 104); g.fillStyle = roofs; g.beginPath(); g.moveTo(x - 10, 284); g.lineTo(x + 60, 236); g.lineTo(x + 130, 284); g.fill();
    g.fillStyle = night ? "#ffd36b" : "#6a8fc0"; g.fillRect(x + 20, 310, 26, 22); g.fillRect(x + 74, 310, 26, 22); }
  // palms
  const pc = night ? "#1a1838" : "#2f7a4a", tc = night ? "#1a1838" : "#8a6a44";
  for (const [x, h, l] of [[70, 230, 20], [330, 260, -16], [470, 200, 12]]) {
    g.strokeStyle = tc; g.lineWidth = 9; g.beginPath(); g.moveTo(x, 384); g.quadraticCurveTo(x + l, 384 - h / 2, x + l * 1.5, 384 - h); g.stroke();
    g.fillStyle = pc; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; g.beginPath(); g.ellipse(x + l * 1.5 + Math.cos(a) * 34, 384 - h + Math.sin(a) * 14 + 6, 40, 9, a, 0, 6.3); g.fill(); }
  }
  g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 3; g.strokeRect(0, 0, 512, 384);
});
const wallpaperTex = (key: string, a: string, b2: string, dot: string) => ctex("wp_" + key, 512, 512, (g, r) => {
  g.fillStyle = a; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = b2; g.fillRect(x, 0, 30, 512); g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(x + 30, 0, 3, 512); }
  g.fillStyle = dot; for (let y = 20; y < 512; y += 48) for (let x = 47; x < 512; x += 64) { g.beginPath(); g.arc(x, y + ((x / 64) % 2) * 24, 4, 0, 6.3); g.fill(); }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(60,40,30,${0.02 + r() * 0.04})`; g.fillRect(r() * 512, r() * 512, 2 + r() * 6, 2 + r() * 10); }
});
const posterTex = (seed: number) => ctex("poster" + seed, 256, 360, (g, r) => {
  const pal = [["#2c3e7a", "#f2c230", "#e2453c"], ["#e8743a", "#2c2a5a", "#f4f0e6"], ["#3fa86a", "#f4f0e6", "#2c3e7a"], ["#7a52b8", "#ffd23a", "#3f86e0"], ["#1f2a44", "#e1669d", "#7fd8f0"]][seed % 5];
  g.fillStyle = pal[0]; g.fillRect(0, 0, 256, 360);
  g.fillStyle = pal[1];
  if (seed % 3 === 0) { g.beginPath(); g.arc(128, 150, 70, 0, 6.3); g.fill(); g.strokeStyle = pal[2]; g.lineWidth = 10; g.beginPath(); g.ellipse(128, 150, 115, 28, -0.3, 0, 6.3); g.stroke(); }
  else if (seed % 3 === 1) { g.beginPath(); g.moveTo(128, 50); g.lineTo(175, 220); g.lineTo(81, 220); g.fill(); g.fillStyle = pal[2]; g.fillRect(100, 220, 56, 40); g.beginPath(); g.arc(128, 140, 18, 0, 6.3); g.fill(); }
  else { for (let k = 0; k < 5; k++) { g.fillStyle = k % 2 ? pal[1] : pal[2]; g.fillRect(40 + k * 36, 260 - (40 + r() * 140), 26, 40 + r() * 140); } }
  g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(0, 300, 256, 60);
  g.strokeStyle = "#1a1418"; g.lineWidth = 6; g.strokeRect(3, 3, 250, 354);
});
const crtTex = (key: string, bg: string, fg: string) => ctex("crt_" + key, 256, 200, (g, r) => {
  g.fillStyle = bg; g.fillRect(0, 0, 256, 200);
  for (let y = 18; y < 190; y += 14) { let x = 14; while (x < 230) { const w = 8 + r() * 40; if (r() > 0.15) { g.fillStyle = r() > 0.8 ? "#ffd23a" : fg; g.fillRect(x, y, w, 6); } x += w + 8; if (r() > 0.85) break; } }
  const gr = g.createRadialGradient(128, 100, 20, 128, 100, 160); gr.addColorStop(0, "rgba(255,255,255,0.12)"); gr.addColorStop(1, "rgba(0,0,0,0.35)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 200);
});
const menuTex = () => ctex("menuBoard", 512, 256, (g, r) => {
  g.fillStyle = "#24382c"; g.fillRect(0, 0, 512, 256);
  for (let k = 0; k < 3; k++) { const cx = 90 + k * 165, cy = 110;
    g.fillStyle = "#e2a24f"; g.beginPath(); g.arc(cx, cy, 52, 0, 6.3); g.fill(); g.fillStyle = "#ffd75e"; g.beginPath(); g.arc(cx, cy, 43, 0, 6.3); g.fill();
    g.fillStyle = "#c8352c"; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(cx + Math.cos(i * 1.1 + k) * 24, cy + Math.sin(i * 1.1 + k) * 24, 8, 0, 6.3); g.fill(); }
    g.fillStyle = "#f4f0e6"; g.beginPath(); g.arc(cx - 20, cy + 82, 9, 0, 6.3); g.fill(); g.beginPath(); g.arc(cx + 20, cy + 82, 9, 0, 6.3); g.fill(); g.beginPath(); g.arc(cx, cy + 82, 9, 0, 6.3); g.fill(); }
  for (let i = 0; i < 200; i++) { g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(r() * 512, r() * 256, 4 + r() * 20, 2); }
  g.strokeStyle = "#8a5a34"; g.lineWidth = 14; g.strokeRect(0, 0, 512, 256);
});
const neonCarpetTex = () => ctex("neonCarpet", 512, 512, (g, r) => {
  g.fillStyle = "#1c1838"; g.fillRect(0, 0, 512, 512);
  const cols = ["#ff4fa8", "#3fe0f0", "#ffd23a", "#7a6af0", "#5fe08a"];
  for (let i = 0; i < 60; i++) { g.strokeStyle = cols[Math.floor(r() * 5)]; g.lineWidth = 5; const x = r() * 512, y = r() * 512, k = Math.floor(r() * 3);
    g.beginPath(); if (k === 0) g.arc(x, y, 10 + r() * 14, 0, 6.3); else if (k === 1) { g.moveTo(x, y); g.lineTo(x + 24, y + 4); g.lineTo(x + 8, y + 26); g.closePath(); } else { g.moveTo(x, y); for (let j = 1; j < 5; j++) g.lineTo(x + j * 10, y + (j % 2 ? 10 : 0)); } g.stroke(); }
});
const arcadeScreenTex = (seed: number) => ctex("arcScr" + seed, 128, 160, (g, r) => {
  g.fillStyle = ["#0c1030", "#100828", "#04201c"][seed % 3]; g.fillRect(0, 0, 128, 160);
  const cols = ["#ff4fa8", "#3fe0f0", "#ffd23a", "#5fe08a", "#ff7a3a"];
  for (let i = 0; i < 14; i++) { g.fillStyle = cols[Math.floor(r() * 5)]; const s = 6 + Math.floor(r() * 3) * 4; g.fillRect(Math.floor(r() * 110), Math.floor(r() * 140), s, s); }
  g.fillStyle = "#ffd23a"; g.beginPath(); g.moveTo(64, 120); g.arc(64, 120, 14, 0.5, 5.8); g.closePath(); g.fill();
  for (let y = 0; y < 160; y += 4) { g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, y, 128, 1); }
});
const stuccoTex = (key: string, col: string) => ctex("stucco_" + key, 512, 512, (g, r) => {
  g.fillStyle = col; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2500; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.10)" : "rgba(90,60,40,0.08)"; g.fillRect(r() * 512, r() * 512, 2 + r() * 3, 2 + r() * 3); }
  for (let i = 0; i < 20; i++) { g.fillStyle = "rgba(120,80,50,0.05)"; g.fillRect(r() * 512, r() * 512, 40 + r() * 120, 20 + r() * 60); }
});
const glassTex = () => ctex("glassDay", 128, 128, (g) => {
  const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, "#9fd0f5"); gr.addColorStop(0.5, "#4f7fb8"); gr.addColorStop(1, "#7fb2e0"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.moveTo(10, 118); g.lineTo(60, 10); g.lineTo(80, 10); g.lineTo(30, 118); g.fill();
});
const shingleTex = (key: string, col: string) => ctex("shingle_" + key, 512, 512, (g, r) => {
  g.fillStyle = col; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 32) { g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(0, y + 28, 512, 4); for (let x = (y / 32) % 2 ? 24 : 0; x < 512; x += 48) { g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(x, y, 3, 30); g.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.08})`; g.fillRect(x + 3, y, 44, 6); } }
});

// ---------------- pizza short: reusable scenery ----------------
/** Florida ranch house: stucco walls, low hip roof, windows with shutters, door with a porch roof, garage door.
 *  Local frame: front wall faces +z at z = d/2, origin at the house centre. Glass goes to the day/night layers. */
const ranch = (b: Batch, bDay: Batch, bNight: Batch, x: number, z: number, yaw: number, w: number, d: number, h: number, wall: string, roofC: string, door: string, shut: string, si: number) => {
  const T = (lx: number, ly: number, lz: number, sx = 1, sy = 1, sz = 1, ry = 0) => M4(x, 0, z, yaw).multiply(M4(lx, ly, lz, ry, [sx, sy, sz]));
  const ub = (bb: Batch, m: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => bb.add(UNIT, m, T((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0));
  const st = surf("stucco" + si, () => stuccoTex("s" + si, wall)), trim = C("trimW", "#f7f3ea"), sh = C("shut" + shut, shut), dr = C("door" + door, door);
  b.add(boxGeo(V(-w / 2, 0, -d / 2), V(w / 2, h, d / 2), 4), st, M4(x, 0, z, yaw));
  ub(b, C("plinthR", "#cdbfa8"), -w / 2 - 0.05, w / 2 + 0.05, 0, 0.3, -d / 2 - 0.05, d / 2 + 0.05);
  ub(b, trim, -w / 2 - 0.15, w / 2 + 0.15, h - 0.25, h, -d / 2 - 0.15, d / 2 + 0.15);
  // hip roof
  const rm = lam("m_shg" + roofC, () => ({ map: shingleTex(roofC, roofC) }));
  b.add(new THREE.ConeGeometry(Math.SQRT1_2 * 2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0), rm, T(0, h - 0.02, 0, (w + 1.4) / 2, 1.9, (d + 1.4) / 2));
  ub(b, C("fascia", "#e9e2d2"), -w / 2 - 0.7, w / 2 + 0.7, h - 0.12, h + 0.02, d / 2 + 0.55, d / 2 + 0.72);
  // windows (glass on the day / night layer), frames, sills, shutters
  const win = (cx: number, ww: number, wh: number, y0: number) => {
    const zf = d / 2 + 0.01;
    bDay.add(quad(V(-ww / 2, 0, 0), V(ww / 2, 0, 0), V(ww / 2, wh, 0), V(-ww / 2, wh, 0)), lam("m_glassD", () => ({ map: glassTex() })), T(cx, y0, zf));
    bNight.add(quad(V(-ww / 2, 0, 0), V(ww / 2, 0, 0), V(ww / 2, wh, 0), V(-ww / 2, wh, 0)), glow([2.6, 1.8, 0.8]), T(cx, y0, zf));
    for (const s of [-1, 1]) ub(b, trim, cx + s * ww / 2 - 0.07, cx + s * ww / 2 + 0.07, y0 - 0.05, y0 + wh + 0.05, zf - 0.02, zf + 0.08);
    ub(b, trim, cx - ww / 2 - 0.1, cx + ww / 2 + 0.1, y0 + wh - 0.03, y0 + wh + 0.1, zf - 0.02, zf + 0.08);
    ub(b, trim, cx - ww / 2 - 0.15, cx + ww / 2 + 0.15, y0 - 0.12, y0, zf - 0.02, zf + 0.18);
    ub(b, trim, cx - 0.03, cx + 0.03, y0, y0 + wh, zf, zf + 0.05); ub(b, trim, cx - ww / 2, cx + ww / 2, y0 + wh / 2 - 0.03, y0 + wh / 2 + 0.03, zf, zf + 0.05);
    for (const s of [-1, 1]) { ub(b, sh, cx + s * (ww / 2 + 0.12) - 0.25, cx + s * (ww / 2 + 0.12) + 0.25, y0 - 0.05, y0 + wh + 0.05, zf, zf + 0.06); for (let k = 0; k < 6; k++) ub(b, sh, cx + s * (ww / 2 + 0.12) - 0.2, cx + s * (ww / 2 + 0.12) + 0.2, y0 + 0.1 + k * (wh / 6), y0 + 0.13 + k * (wh / 6), zf + 0.06, zf + 0.08); }
  };
  const dx = -w * 0.12;
  win(-w * 0.36, 1.5, 1.3, 0.95); win(w * 0.12, 2.2, 1.3, 0.95);
  // door + porch
  const zf = d / 2;
  ub(b, dr, dx - 0.5, dx + 0.5, 0.05, 2.15, zf - 0.02, zf + 0.06);
  for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) ub(b, C("doorP" + door, door), dx - 0.38 + j * 0.42, dx - 0.04 + j * 0.42, 0.25 + k * 0.95, 1.05 + k * 0.95, zf + 0.06, zf + 0.09);
  b.add(new THREE.SphereGeometry(0.05, 8, 6), C("knob", "#e8c45a"), T(dx + 0.38, 1.05, zf + 0.12));
  for (const s of [-1, 1]) ub(b, trim, dx + s * 0.55 - 0.07, dx + s * 0.55 + 0.07, 0.05, 2.25, zf - 0.02, zf + 0.1);
  ub(b, C("porch", "#d8cdb6"), dx - 1.3, dx + 1.3, 0, 0.16, zf, zf + 1.6);
  ub(b, trim, dx - 1.35, dx + 1.35, 2.55, 2.68, zf, zf + 1.65);
  for (const s of [-1, 1]) ub(b, trim, dx + s * 1.15 - 0.08, dx + s * 1.15 + 0.08, 0.16, 2.55, zf + 1.42, zf + 1.58);
  bNight.add(new THREE.SphereGeometry(0.11, 10, 8), glow([5, 3.8, 1.6]), T(dx + 0.85, 2.15, zf + 0.12));
  bDay.add(new THREE.SphereGeometry(0.11, 10, 8), C("bulbOff", "#f4ead2"), T(dx + 0.85, 2.15, zf + 0.12));
  // garage door
  const gx = w * 0.36, gw = Math.min(3.0, w * 0.26);
  ub(b, C("garage", "#f2efe6"), gx - gw / 2, gx + gw / 2, 0.02, 2.35, zf - 0.02, zf + 0.05);
  for (let k = 1; k < 4; k++) ub(b, C("garageL", "#d9d4c6"), gx - gw / 2, gx + gw / 2, 0.02 + k * 0.58, 0.06 + k * 0.58, zf + 0.05, zf + 0.07);
  ub(b, trim, gx - gw / 2 - 0.1, gx + gw / 2 + 0.1, 2.35, 2.47, zf - 0.02, zf + 0.1);
  // shrubs along the front
  const lf = C("shrub", "#3f8a4a"), lf2 = C("shrub2", "#4fa05a");
  for (let i = 0; i < 9; i++) { const lx = -w / 2 + 0.4 + i * (w * 0.6 / 8); if (Math.abs(lx - dx) < 1.5) continue; b.add(new THREE.SphereGeometry(0.45, 10, 8), i % 2 ? lf : lf2, T(lx, 0.32, zf + 0.5, 1.1, 0.75, 0.9)); }
};
const UNIT = new THREE.BoxGeometry(1, 1, 1);
/** interior: wallpaper above wainscot, baseboards, ceiling, back-wall window with curtains (view on day / night layer) */
type RoomOpt = { key: string; wpA: string; wpB: string; dot: string; wain: string; floor: THREE.Material; ceil: string; curtain: string };
const homeRoom = (b: Batch, bDay: Batch, bNight: Batch, X: number, Z0: number, Z1: number, H: number, o: RoomOpt, winX: number) => {
  const wp = surf("wp" + o.key, () => wallpaperTex(o.key, o.wpA, o.wpB, o.dot));
  room(b, X, Z0, Z1, H, wp, o.floor, C("ceil" + o.key, o.ceil), 2);
  const wn = C("wain" + o.key, o.wain), cap = C("wainCap", "#f4ecd8"), bb = C("base" + o.key, "#5a3a26");
  bx(b, wn, -X, X, 0, 1.0, Z0, Z0 + 0.06); bx(b, wn, -X, -X + 0.06, 0, 1.0, Z0, Z1); bx(b, wn, X - 0.06, X, 0, 1.0, Z0, Z1);
  bx(b, cap, -X, X, 1.0, 1.06, Z0, Z0 + 0.09); bx(b, cap, -X, -X + 0.09, 1.0, 1.06, Z0, Z1); bx(b, cap, X - 0.09, X, 1.0, 1.06, Z0, Z1);
  bx(b, bb, -X, X, 0, 0.12, Z0, Z0 + 0.08); bx(b, bb, -X, -X + 0.08, 0, 0.12, Z0, Z1); bx(b, bb, X - 0.08, X, 0, 0.12, Z0, Z1);
  bx(b, C("crown", "#f4ecd8"), -X, X, H - 0.12, H, Z0, Z0 + 0.1);
  // window on the back wall
  const ww = 2.0, wh = 1.5, y0 = 1.15, zf = Z0 + 0.07;
  bDay.add(quad(V(winX - ww / 2, y0, zf), V(winX + ww / 2, y0, zf), V(winX + ww / 2, y0 + wh, zf), V(winX - ww / 2, y0 + wh, zf)), lam("m_viewD", () => ({ map: viewTex(false) })));
  bNight.add(quad(V(winX - ww / 2, y0, zf), V(winX + ww / 2, y0, zf), V(winX + ww / 2, y0 + wh, zf), V(winX - ww / 2, y0 + wh, zf)), lam("m_viewN", () => ({ map: viewTex(true) })));
  const fr = C("winFrame", "#f7f3ea");
  bx(b, fr, winX - ww / 2 - 0.1, winX + ww / 2 + 0.1, y0 - 0.12, y0, zf, zf + 0.22); bx(b, fr, winX - ww / 2 - 0.1, winX + ww / 2 + 0.1, y0 + wh, y0 + wh + 0.1, zf, zf + 0.1);
  for (const s of [-1, 0, 1]) bx(b, fr, winX + s * ww / 2 - 0.05, winX + s * ww / 2 + 0.05, y0, y0 + wh, zf, zf + 0.08);
  bx(b, fr, winX - ww / 2, winX + ww / 2, y0 + wh / 2 - 0.03, y0 + wh / 2 + 0.03, zf, zf + 0.06);
  const cu = C2("curtain" + o.key, o.curtain);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) cylY(b, cu, winX + s * (ww / 2 + 0.25) + (k - 1.5) * 0.12 * s, 0.9, zf + 0.25, 0.09, wh + 0.75, 8);
  cylY(b, C("rod", "#8a5a34"), winX - ww / 2 - 0.7, y0 + wh + 0.35, zf + 0.25, 0.03, 0.02, 6);
  b.add(new THREE.CylinderGeometry(0.03, 0.03, ww + 1.6, 8).rotateZ(Math.PI / 2), C("rod", "#8a5a34"), M4(winX, y0 + wh + 0.4, zf + 0.25));
  hang(b, 0, H, H - 0.7, 0.5, "#f4ecd8", 0.45);
};
const desk = (b: Batch, x: number, z: number, crtKey: string, scr: [string, string]) => {
  const wd = M.woodDk(), wl = M.wood();
  box(b, wl, x, 0.72, z, 2.2, 0.07, 0.9); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(b, wd, x + sx * 1.0, 0, z + sz * 0.35, 0.08, 0.72, 0.08);
  box(b, wd, x + 0.7, 0.3, z, 0.7, 0.42, 0.85);
  for (let k = 0; k < 2; k++) { box(b, C("drawer", "#8a5a3c"), x + 0.7, 0.36 + k * 0.2, z + 0.43, 0.6, 0.16, 0.02); box(b, C("knobD", "#e8c45a"), x + 0.7, 0.42 + k * 0.2, z + 0.45, 0.1, 0.03, 0.03); }
  const beige = C("beigePC", "#e2dcc6"), beigeD = C("beigePCd", "#c9c1a6");
  box(b, beige, x - 0.25, 0.79, z - 0.05, 0.62, 0.52, 0.5); box(b, beigeD, x - 0.25, 0.79, z - 0.38, 0.45, 0.42, 0.3);
  box(b, beigeD, x - 0.25, 0.79, z + 0.1, 0.34, 0.04, 0.3);
  b.add(quad(V(x - 0.5, 0.86, z + 0.205), V(x, 0.86, z + 0.205), V(x, 1.25, z + 0.205), V(x - 0.5, 1.25, z + 0.205)), lam("m_crt" + crtKey, () => ({ map: crtTex(crtKey, scr[0], scr[1]), emissive: new THREE.Color("#ffffff"), emissiveMap: crtTex(crtKey, scr[0], scr[1]), emissiveIntensity: 0.9 })));
  box(b, beigeD, x - 0.2, 0.79, z + 0.33, 0.62, 0.035, 0.2); for (let i = 0; i < 4; i++) box(b, C("keys", "#f4f0e6"), x - 0.2, 0.825, z + 0.27 + i * 0.04, 0.56, 0.012, 0.025);
  box(b, beige, x + 0.25, 0.79, z + 0.33, 0.07, 0.03, 0.11);
  box(b, beige, x + 1.35, 0, z - 0.05, 0.26, 0.62, 0.55); b.add(new THREE.SphereGeometry(0.025, 8, 6), glow([0.5, 4, 0.8]), M4(x + 1.35, 0.5, z + 0.23));
  for (let i = 0; i < 4; i++) box(b, C("disk" + (i % 2), i % 2 ? "#3f6fb5" : "#2c2a3a"), x + 0.32 + i * 0.03, 0.79, z - 0.2, 0.02, 0.12, 0.12);
  cylY(b, C("mug", "#e2453c"), x + 0.65, 0.79, z + 0.2, 0.05, 0.12, 12); box(b, C("paper", "#f6f1e3"), x + 0.85, 0.79, z - 0.05, 0.3, 0.06, 0.4);
  cylY(b, M.iron(), x + 0.95, 0.79, z - 0.3, 0.08, 0.04, 10); b.add(beamGeo(V(x + 0.95, 0.83, z - 0.3), V(x + 0.85, 1.25, z - 0.2), 0.025), M.iron(), undefined);
  b.add(new THREE.ConeGeometry(0.13, 0.18, 12, 1, true), C2("lampSh", "#3f8a6a"), M4(x + 0.78, 1.22, z - 0.1, 0, [1, 1, 1]));
  sphere(b, glow([4.5, 3.6, 2.0]), x + 0.78, 1.16, z - 0.1, 0.05, 1, 8);
  // chair
  const ch = C("chairB", "#2c3e7a");
  cylY(b, M.iron(), x - 0.2, 0, z + 0.85, 0.3, 0.05, 5); cylY(b, M.iron(), x - 0.2, 0.05, z + 0.85, 0.04, 0.4, 8);
  box(b, ch, x - 0.2, 0.45, z + 0.85, 0.55, 0.1, 0.5); box(b, ch, x - 0.2, 0.55, z + 1.12, 0.5, 0.6, 0.08);
};
const shelfUnit = (b: Batch, x: number, z: number, yaw: number, w: number, h: number, seed: number) => {
  const L = loc(b, x, z, yaw), wd = M.woodDk(), r = rng(seed);
  L.box(wd, -w / 2, 0, 0, 0.06, h, 0.35); L.box(wd, w / 2, 0, 0, 0.06, h, 0.35); L.box(wd, 0, 0, -0.15, w, h, 0.04);
  const cols = ["#c0392f", "#3f6fb5", "#f2c230", "#3fa86a", "#e8803a", "#7a52b8", "#f4f0e6", "#2c3e7a"];
  for (let k = 0; k < 4; k++) { const y = 0.1 + k * (h / 4); L.box(wd, 0, y, 0, w, 0.04, 0.35);
    let bx0 = -w / 2 + 0.06; while (bx0 < w / 2 - 0.12) { const bw = 0.05 + r() * 0.06, bh = 0.22 + r() * 0.16; if (r() > 0.12) L.box(C("book" + Math.floor(r() * 8), cols[Math.floor(r() * 8)]), bx0 + bw / 2, y + 0.04, 0.02, bw, bh, 0.24); bx0 += bw + 0.005; } }
};
const frame = (b: Batch, x: number, y: number, z: number, yaw: number, w: number, h: number, seed: number) => {
  const L = loc(b, x, z, yaw);
  L.box(M.woodDk(), 0, y - 0.05, 0, w + 0.1, h + 0.1, 0.05);
  const c = Math.cos(yaw), s = Math.sin(yaw), fx = x + s * 0.03, fz = z + c * 0.03;
  b.add(new THREE.PlaneGeometry(w, h), lam("m_poster" + seed, () => ({ map: posterTex(seed) })), M4(fx, y + h / 2 - 0.05, fz, yaw));
};
const plant = (b: Batch, x: number, z: number, s = 1) => {
  cylY(b, C("pot", "#c76b4a"), x, 0, z, 0.2 * s, 0.35 * s, 12, 0.24 * s);
  for (let i = 0; i < 6; i++) { const a = i * 1.05; b.add(new THREE.SphereGeometry(0.16 * s, 8, 6), i % 2 ? C("leafP", "#3f8a4a") : C("leafP2", "#5fb06a"), M4(x + Math.cos(a) * 0.14 * s, 0.5 * s + (i % 3) * 0.12 * s, z + Math.sin(a) * 0.14 * s, 0, [0.8, 1.4, 0.8])); }
};

// ---------------- the world ----------------
export const buildSets = (root: THREE.Object3D, kit: Kit): SetBuild => {
  void kit;
  const groups = {} as Record<SetId, THREE.Group>, dayOnly: THREE.Group[] = [], nightOnly: THREE.Group[] = [];
  for (const id of ["mountain", "studio", "street", "room", "jroom", "shop", "arcade"] as SetId[]) { groups[id] = new THREE.Group(); groups[id].visible = false; root.add(groups[id]); }
  const layered = (G: THREE.Group, fn: (b: Batch, bd: Batch, bn: Batch) => void) => {
    const gd = new THREE.Group(), gn = new THREE.Group(); G.add(gd, gn); dayOnly.push(gd); nightOnly.push(gn);
    const b = new Batch(), bd = new Batch(), bn = new Batch(); fn(b, bd, bn); b.build(G, true); bd.build(gd, false); bn.build(gn, false);
  };
  const mesaM = surf("mesaStrata", () => strataTex2(["#c9774a", "#d98d5a", "#b5603c", "#e2a06a", "#9c5236"]));
  const mesaCool = surf("mesaCool", () => strataTex2(["#8a7f9c", "#9a8fae", "#7b7090", "#a89db8"]));
  // ======== 1. gold plain: sand, mesas, skyline, boulders, foreground towers (hook, podium, envelope) ========
  {
    const G = groups.mountain, twin = winM("gold", "#47608f", "#ffe08a", 0.4), twin2 = winM("gold2", "#6a5a8e", "#ffcf7a", 0.28);
    build(G, (b) => {
      b.add(groundQuad(900, 12, -0.05), surf("sandGold", () => sandTex("sandGold", "#e6bd7a", "#cf9d5e")));
      const fg: [number, number, number, number, number][] = [[-62, 80, 26, 24, 105], [-30, 66, 20, 20, 78], [-108, 58, 30, 26, 118], [58, 78, 28, 24, 112], [26, 60, 18, 18, 66], [102, 62, 28, 28, 98], [-46, 18, 22, 20, 70], [48, 4, 24, 22, 84],
        [-150, 10, 30, 30, 100], [140, -8, 30, 30, 120], [-92, -60, 26, 26, 92], [96, -66, 28, 26, 104]];
      fg.forEach(([x, z, w, d, h], i) => tower(b, x, z, w, d, h, i % 2 ? twin : twin2));
      skylineRing(b, 330, 460, 36, 40, 150, "#8e7aa6", 3); skylineRing(b, 520, 660, 40, 50, 210, "#a48fb0", 5);
      mesaRing(b, mesaM, 14, 560, 760, 40, 120, 11, Math.PI * 2, 0.2);
      mesaRing(b, mesaCool, 10, 820, 880, 70, 160, 17);
      for (let i = 0; i < 28; i++) { const r = rng(i + 70); const x = (r() - 0.5) * 260, z = 30 + r() * 120, s = 0.8 + r() * 2.2; b.add(new THREE.IcosahedronGeometry(s, 0), C("boulder", "#a8896a"), M4(x, s * 0.35, z, r() * 6, [1.3, 0.7, 1])); }
      bx(b, M.iron(), -4, 4, 0.0, 0.06, 20, 300); for (let z = 20; z < 280; z += 12) bx(b, C("lane", "#f4f0e6"), -0.15, 0.15, 0.06, 0.07, z, z + 5);
    });
  }

  // ======== 2. 90s start-up office (closed): carpet, wainscot, desks with CRTs, windows, ceiling tiles ========

  // ======== 8. studio (closed): sunburst walls, glossy tile floor, ring lights, neon columns ========
  {
    const G = groups.studio, X = 9, Z0 = -9, Z1 = 12, H = 8.5;
    build(G, (b) => {
      room(b, X, Z0, Z1, H, surf("sunA", () => sunburst("a", "#5b3fb5", "#7a52d6")), surf("tiles", () => checkerTex("#f4f0e6", "#6aa8e8")), C("sCeil", "#2c2a5a"), 3);
      bx(b, surf("sunB", () => sunburst("b", "#e04a8a", "#ff6aa8")), -X + 0.5, X - 0.5, 0.4, 7.8, Z0 + 0.05, Z0 + 0.1);
      for (const s of [-1, 1]) for (let z = Z0 + 1.5; z < Z1; z += 4.2) { cylY(b, M.white(), s * (X - 0.6), 0, z, 0.3, H, 12); cylY(b, glow([1.0, 3.2, 3.6]), s * (X - 1.0), 0.4, z, 0.1, H - 0.8, 8); }
      for (let i = 0; i < 3; i++) b.add(new THREE.TorusGeometry(2.6 + i * 1.6, 0.14, 8, 40).rotateX(Math.PI / 2), glow([3.2 - i * 0.6, 1.4 + i * 0.8, 3.4]), M4(0, H - 0.5, -1));
      for (const [x, z] of [[-5, -5], [5, -5], [-6, 4], [6, 4]]) { cylY(b, M.iron(), x, 0, z, 0.1, H - 0.6, 6); for (let i = 0; i < 3; i++) { b.add(new THREE.ConeGeometry(0.45, 0.6, 12, 1, true), C2("spot", "#2c2f38"), M4(x, H - 1.2 - i * 0.7, z)); sphere(b, glow([5, 4.5, 3.4]), x, H - 1.5 - i * 0.7, z, 0.18, 1, 8); } }
      for (let i = 0; i < 7; i++) { const r = rng(i + 2); box(b, i % 2 ? M.teal() : M.pink(), -7.5 + i * 2.5, 0, Z0 + 1.0, 1.4 + r(), 0.8 + r() * 1.6, 1.0); sphere(b, i % 2 ? M.orange() : M.purple(), -7.5 + i * 2.5, 2.6 + r(), Z0 + 1.0, 0.5, 1, 12); }
      bx(b, glow([2.4, 1.4, 3.0]), -X + 0.4, X - 0.4, 0.5, 0.6, Z0 + 0.1, Z0 + 0.15);
    });
  }


  // ======== Florida street: Laszlo's ranch house, neighbours, lawns, palms, sidewalk, road, houses across ========
  {
    const G = groups.street;
    layered(G, (b, bd, bn) => {
      b.add(groundQuad(500, 10, -0.05), lam("m_grassS", () => ({ map: grassHD() })));
      b.add(flatRect(-80, 80, 5.6, 13.6, 0.0, 3), surf("asphalt", asphaltTex));
      for (let x = -78; x < 78; x += 5) bx(b, C("laneY", "#f2c230"), x, x + 2.6, 0.005, 0.02, 9.5, 9.7);
      b.add(flatRect(-80, 80, 3.4, 5.6, 0.03, 1), concreteM()); bx(b, C("curbS", "#c8c4b8"), -80, 80, 0, 0.12, 5.5, 5.7);
      b.add(flatRect(-80, 80, 13.6, 15.8, 0.03, 1), concreteM()); bx(b, C("curbS", "#c8c4b8"), -80, 80, 0, 0.12, 13.5, 13.7);
      b.add(flatRect(2.6, 6.2, -6.5, 3.4, 0.02, 1), concreteM());
      b.add(flatRect(-2.4, -0.9, -4.3, 3.4, 0.025, 1), surf("pavers", () => stoneHD("paverHD", ["#d8c8a8", "#cdbb98", "#e2d4b6", "#c4b190"], "#9a8a70")));
      ranch(b, bd, bn, 0, -10, 0, 13, 9, 3.1, "#f3d2a6", "#b8604a", "#2f7f86", "#3f78a8", 1);
      ranch(b, bd, bn, -17, -11, 0, 12, 9, 3.0, "#cfe3d6", "#8a6a5a", "#c8504a", "#f4f0e6", 2);
      ranch(b, bd, bn, 17, -10.5, 0, 12.5, 9, 3.0, "#f6e7b8", "#6a7a9a", "#3f6fb5", "#3f8a6a", 3);
      ranch(b, bd, bn, -9, 26, Math.PI, 12, 9, 3.0, "#e9c8d8", "#8a5a6a", "#7a52b8", "#f4f0e6", 4);
      ranch(b, bd, bn, 8, 26.5, Math.PI, 13, 9, 3.1, "#d6e6f2", "#c76b4a", "#e8803a", "#2f7f86", 5);
      ranch(b, bd, bn, 25, 26, Math.PI, 12, 9, 3.0, "#f2dcb0", "#7a6a8a", "#3f8a6a", "#c8504a", 6);
      palm(b, -6.8, -3.6, 7.5, 0.16); palm(b, 8.2, -4.5, 8.5, -0.14); palm(b, -12, 2.2, 7, 0.1); palm(b, 11.5, 2.4, 8, -0.2); palm(b, -24, -3, 7.5, 0.12); palm(b, 24, -2, 8, -0.1);
      palm(b, -3, 18, 7, 0.15); palm(b, 16, 18.5, 8, -0.12); palm(b, -20, 19, 7.5, 0.1);
      // mailbox, hedge line, fence
      cylY(b, M.woodDk(), -3.6, 0, 3.0, 0.05, 1.0, 8); box(b, C("mailbox", "#3f6fb5"), -3.6, 1.0, 3.0, 0.24, 0.26, 0.48); box(b, M.red(), -3.45, 1.12, 3.15, 0.02, 0.2, 0.05);
      for (const s of [-1, 1]) for (let i = 0; i < 18; i++) { const z = -14 + i * 0.95; b.add(new THREE.SphereGeometry(0.42, 10, 8), C("hedge", "#3a7f44"), M4(s * 8.6, 0.38, z, 0, [1, 0.9, 1])); }
      for (const x of [-30, -10, 12, 32]) lampPost(b, x, 4.6, 5.0, [5, 4, 1.6]);
      // distant tree line / roofs
      const r = rng(41); for (let i = 0; i < 40; i++) { const a = -Math.PI * 0.5 + (i / 40) * Math.PI, d = 70 + r() * 40; palm(b, Math.sin(a) * d, -Math.cos(a) * d * 0.6 - 10, 8 + r() * 5, (r() - 0.5) * 0.4); }
      skylineRing(b, 160, 260, 30, 6, 18, "#a8b8d8", 44, Math.PI * 1.2, -Math.PI * 0.6);
    });
  }
  // ======== rooms: Laszlo's (mint + wood, desk with the beige PC) and Jeremy's (blue, bed, TV + console) ========
  {
    const G = groups.room, X = 5, Z0 = -5, Z1 = 6, H = 3.2;
    layered(G, (b, bd, bn) => {
      homeRoom(b, bd, bn, X, Z0, Z1, H, { key: "L", wpA: "#cfe3c8", wpB: "#bcd6b4", dot: "#e8f2df", wain: "#7a5a3c", floor: plankM(), ceil: "#f4ecd8", curtain: "#e8803a" }, 1.9);
      desk(b, -1.6, -4.4, "L", ["#0e2a1e", "#5fe08a"]);
      shelfUnit(b, -4.75, 0.2, Math.PI / 2, 2.2, 2.2, 7); shelfUnit(b, -4.75, 2.8, Math.PI / 2, 1.4, 1.8, 8);
      frame(b, 4.93, 1.6, -1.8, -Math.PI / 2, 0.9, 1.25, 1); frame(b, 4.93, 1.7, 0.2, -Math.PI / 2, 0.8, 1.1, 2); frame(b, -0.2, 1.75, -4.92, 0, 0.6, 0.85, 3);
      // sofa + coffee table + rug + lamp + plant
      const sf = C("sofa", "#c0503a"), sfD = C("sofaD", "#a8402e");
      box(b, sfD, 3.6, 0, 2.6, 1.0, 0.45, 2.4); box(b, sf, 3.85, 0.45, 2.6, 0.45, 0.65, 2.4); for (const s of [-1, 1]) box(b, sf, 3.6, 0.45, 2.6 + s * 1.12, 1.0, 0.3, 0.2);
      for (let k = 0; k < 2; k++) box(b, C("cush", "#e8a23a"), 3.45, 0.45, 2.0 + k * 1.2, 0.7, 0.14, 1.05);
      box(b, M.woodLt(), 2.0, 0.4, 2.6, 1.0, 0.06, 0.6); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(b, M.woodDk(), 2.0 + sx * 0.42, 0, 2.6 + sz * 0.24, 0.05, 0.4, 0.05);
      b.add(flatRect(0.6, 4.4, 1.0, 4.2, 0.012, 1), surf("rugL", () => checkerTex("#e8c45a", "#d6853a")));
      plant(b, 4.3, -4.3, 1.2); plant(b, -4.3, 4.8, 1.0);
      cylY(b, M.iron(), 4.4, 0, 4.6, 0.03, 1.6, 6); b.add(new THREE.ConeGeometry(0.28, 0.35, 14, 1, true), C2("flShade", "#f4ecd8"), M4(4.4, 1.7, 4.6)); sphere(b, glow([4.5, 3.6, 2.0]), 4.4, 1.62, 4.6, 0.08, 1, 8);
      box(b, M.woodDk(), 2.4, 0, -4.6, 1.2, 0.8, 0.5); cylY(b, C("vase", "#3f6fb5"), 2.1, 0.8, -4.6, 0.1, 0.3, 10); box(b, C("radio", "#8a5a34"), 2.65, 0.8, -4.6, 0.45, 0.28, 0.25);
    });
  }
  {
    const G = groups.jroom, X = 5, Z0 = -5, Z1 = 6, H = 3.2;
    layered(G, (b, bd, bn) => {
      homeRoom(b, bd, bn, X, Z0, Z1, H, { key: "J", wpA: "#a9c4ea", wpB: "#98b6e2", dot: "#d6e4f8", wain: "#f4f0e6", floor: surf("carpetJ", carpetTex), ceil: "#eef2f8", curtain: "#f2c230" }, -1.8);
      desk(b, 2.0, -4.4, "J", ["#101838", "#7fd8f0"]);
      // bed
      box(b, M.woodDk(), -3.4, 0, 1.6, 2.0, 0.45, 2.6); box(b, C("sheet", "#f4f0e6"), -3.4, 0.45, 1.75, 1.9, 0.18, 2.3); box(b, C("duvet", "#e2453c"), -3.4, 0.6, 2.2, 1.95, 0.14, 1.5);
      box(b, C("pillow", "#ffffff"), -3.4, 0.62, 0.75, 1.2, 0.18, 0.5); box(b, M.woodDk(), -3.4, 0, 0.25, 2.0, 1.2, 0.1);
      frame(b, -4.93, 1.8, 1.8, Math.PI / 2, 1.1, 0.8, 4); frame(b, -4.93, 1.7, 3.6, Math.PI / 2, 0.7, 1.0, 5); frame(b, 4.93, 1.6, 0.5, -Math.PI / 2, 1.0, 1.4, 6); frame(b, 4.93, 1.7, 2.4, -Math.PI / 2, 0.7, 1.0, 7);
      // TV + console on a dresser
      box(b, M.woodLt(), 3.9, 0, 3.4, 0.9, 0.75, 1.6); box(b, C("tv", "#2c2a3a"), 3.85, 0.75, 3.4, 0.55, 0.55, 0.75);
      b.add(new THREE.PlaneGeometry(0.62, 0.42), lam("m_tvScr", () => ({ map: arcadeScreenTex(5), emissive: new THREE.Color("#ffffff"), emissiveMap: arcadeScreenTex(5), emissiveIntensity: 0.8 })), M4(3.57, 1.03, 3.4, -Math.PI / 2));
      box(b, C("console", "#8a8f9c"), 3.85, 0.75, 2.75, 0.35, 0.08, 0.28);
      b.add(flatRect(-2.0, 1.6, 2.0, 4.6, 0.012, 1), surf("rugJ", () => checkerTex("#3f86e0", "#2c5aa8")));
      cylY(b, C("ball", "#e8803a"), 0.8, 0, 4.4, 0.14, 0.28, 14); plant(b, -4.3, -4.3, 1.0);
      box(b, M.woodLt(), -1.0, 0, -4.6, 1.0, 1.1, 0.5); for (let k = 0; k < 3; k++) box(b, C("drawJ", "#e8dcc0"), -1.0, 0.1 + k * 0.33, -4.34, 0.85, 0.28, 0.02);
    });
  }
  // ======== pizza shop: striped wallpaper, checker floor, counter + register, oven, menu boards, pendant lamps ========
  {
    const G = groups.shop, X = 7, Z0 = -6, Z1 = 7, H = 3.8;
    layered(G, (b) => {
      room(b, X, Z0, Z1, H, surf("wpShop", () => wallpaperTex("shop", "#f4e2c0", "#e9cfa2", "#d6453b")), surf("chkShop", () => checkerTex("#f4f0e6", "#c0392f")), C("ceilShop", "#6a3a2a"), 3);
      bx(b, C("wainShop", "#2f6a4a"), -X, X, 0, 1.1, Z0, Z0 + 0.06); bx(b, C("wainShop", "#2f6a4a"), -X, -X + 0.06, 0, 1.1, Z0, Z1); bx(b, C("wainShop", "#2f6a4a"), X - 0.06, X, 0, 1.1, Z0, Z1);
      bx(b, C("capShop", "#e8c45a"), -X, X, 1.1, 1.16, Z0, Z0 + 0.09);
      for (let x = -X; x < X; x += 1.5) bx(b, C("beamShop", "#4a2a1e"), x, x + 0.2, H - 0.3, H, Z0, Z1);
      // counter
      b.add(boxGeo(V(-4.5, 0, -2.5), V(3.5, 1.05, -1.7), 2), plankM()); bx(b, C("ctrTop", "#efe3c8"), -4.6, 3.6, 1.05, 1.12, -2.6, -1.6);
      bx(b, C("ctrBand", "#c0392f"), -4.5, 3.5, 0.85, 0.95, -1.69, -1.66);
      box(b, M.iron(), 2.2, 1.12, -2.1, 0.55, 0.25, 0.45); box(b, C("regTop", "#5a6070"), 2.2, 1.37, -2.2, 0.4, 0.28, 0.06); b.add(new THREE.PlaneGeometry(0.34, 0.2), glow([0.6, 2.4, 1.2]), M4(2.2, 1.52, -2.16));
      for (let i = 0; i < 4; i++) box(b, C("pboxSt", "#f6ecd6"), -3.6, 1.12 + i * 0.09, -2.1, 0.5, 0.08, 0.5);
      for (let i = 0; i < 3; i++) box(b, C("pboxSt", "#f6ecd6"), -3.0, 1.12 + i * 0.09, -2.2, 0.5, 0.08, 0.5);
      // oven (brick dome mouth) on the back wall
      b.add(boxGeo(V(-4.6, 0, Z0), V(-1.4, 2.4, Z0 + 1.2), 2), brickM());
      b.add(new THREE.CircleGeometry(0.75, 24, 0, Math.PI), C("ovenMouth", "#1a0e0a"), M4(-3.0, 0.95, Z0 + 1.21));
      b.add(new THREE.CircleGeometry(0.55, 24, 0, Math.PI), glow([5, 2.4, 0.6]), M4(-3.0, 0.95, Z0 + 1.22));
      bx(b, C("ovenLip", "#d9d0bc"), -3.9, -2.1, 0.85, 0.95, Z0 + 1.2, Z0 + 1.5);
      cylY(b, C("flue", "#8a8f9c"), -3.0, 2.4, Z0 + 0.6, 0.25, H - 2.4, 12);
      // menu boards
      for (let k = 0; k < 2; k++) b.add(new THREE.PlaneGeometry(2.0, 1.0), lam("m_menu", () => ({ map: menuTex() })), M4(0.0 + k * 2.3, 2.75, Z0 + 0.08));
      // shelves with jars / cans on the back wall right
      for (let k = 0; k < 3; k++) { bx(b, M.woodDk(), 4.4, 6.6, 1.3 + k * 0.6, 1.35 + k * 0.6, Z0, Z0 + 0.35); for (let i = 0; i < 6; i++) cylY(b, C("jar" + ((i + k) % 3), ["#c0392f", "#f2c230", "#3fa86a"][(i + k) % 3]), 4.6 + i * 0.35, 1.35 + k * 0.6, Z0 + 0.18, 0.1, 0.24, 10); }
      // neon pizza slice outline
      const nP = glow([5, 1.4, 2.6]), A = V(4.6, 3.0, Z0 + 0.1), Bv = V(6.4, 3.0, Z0 + 0.1), Cv = V(5.5, 1.75, Z0 + 0.1);
      b.add(beamGeo(A, Bv, 0.06), nP, undefined); b.add(beamGeo(Bv, Cv, 0.06), nP, undefined); b.add(beamGeo(Cv, A, 0.06), nP, undefined);
      for (const [x, y] of [[5.3, 2.75], [5.75, 2.65], [5.5, 2.35]]) sphere(b, glow([5, 1.2, 0.8]), x, y, Z0 + 0.12, 0.09, 1, 8);
      for (const x of [-3, 0, 3]) hang(b, x, H, 2.6, -2.1, "#2f6a4a", 0.42);
      // tables in front
      for (const [x, z] of [[-4.5, 3.2], [3.5, 3.6]]) { cylY(b, M.iron(), x, 0, z, 0.06, 0.75, 8); cylY(b, C("tabT", "#efe3c8"), x, 0.75, z, 0.55, 0.05, 18); for (const s of [-1, 1]) { box(b, M.red(), x + s * 0.8, 0, z, 0.4, 0.45, 0.4); box(b, M.red(), x + s * 0.98, 0.45, z, 0.06, 0.5, 0.4); } }
      plant(b, 6.3, 5.8, 1.3); plant(b, -6.3, 5.8, 1.3);
    });
  }
  // ======== arcade: neon carpet, cabinet rows, ceiling neon, token machine ========
  {
    const G = groups.arcade, X = 7, Z0 = -7, Z1 = 7, H = 3.8;
    layered(G, (b) => {
      room(b, X, Z0, Z1, H, surf("arcWall", () => wallpaperTex("arc", "#2a2350", "#241e46", "#ff4fa8")), surf("neonCarpet", neonCarpetTex), C("arcCeil", "#15122a"), 3);
      const neon = [glow([5, 1.2, 3.0]), glow([0.8, 4.2, 5]), glow([5, 4, 0.8])];
      for (let k = 0; k < 3; k++) b.add(beamGeo(V(-X + 0.3, H - 0.25, -5 + k * 5), V(X - 0.3, H - 0.25, -5 + k * 5), 0.07), neon[k], undefined);
      bx(b, neon[0], -X, X, 1.6, 1.66, Z0 + 0.06, Z0 + 0.1); bx(b, neon[1], -X + 0.06, -X + 0.1, 1.6, 1.66, Z0, Z1); bx(b, neon[1], X - 0.1, X - 0.06, 1.6, 1.66, Z0, Z1);
      const cabCols = ["#c0392f", "#3f6fb5", "#f2c230", "#7a52b8", "#3fa86a", "#e8803a"];
      const cab = (x: number, z: number, yaw: number, i: number) => {
        const L = loc(b, x, z, yaw), col = C("cab" + (i % 6), cabCols[i % 6]);
        L.box(col, 0, 0, 0, 0.9, 1.95, 0.75); L.box(M.black(), 0, 0.95, 0.3, 0.92, 0.3, 0.2);
        L.box(col, 0, 1.85, 0.08, 0.92, 0.35, 0.6);
        const c = Math.cos(yaw), s = Math.sin(yaw), w = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
        const [mx, mz] = w(0, 0.39); b.add(new THREE.PlaneGeometry(0.8, 0.26), neon[i % 3], M4(mx, 2.02, mz, yaw));
        const [sx2, sz2] = w(0, 0.3); b.add(new THREE.PlaneGeometry(0.66, 0.58), lam("m_arcScr" + (i % 3), () => ({ map: arcadeScreenTex(i % 3), emissive: new THREE.Color("#ffffff"), emissiveMap: arcadeScreenTex(i % 3), emissiveIntensity: 1.0 })), new THREE.Matrix4().compose(V(sx2, 1.5, sz2), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, yaw, 0, "YXZ")), V(1, 1, 1)));
        const [px2, pz2] = w(0, 0.48); b.add(new THREE.BoxGeometry(0.88, 0.08, 0.32), M.black(), new THREE.Matrix4().compose(V(px2, 1.08, pz2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, yaw, 0, "YXZ")), V(1, 1, 1)));
        for (let k = 0; k < 3; k++) { const [bx2, bz2] = w(-0.15 + k * 0.15, 0.5); sphere(b, glow(k === 0 ? [5, 1, 1] : k === 1 ? [1, 3, 5] : [5, 4, 0.6]), bx2, 1.14, bz2, 0.035, 0.6, 8); }
      };
      let i = 0;
      for (let x = -5.2; x <= 5.3; x += 1.3) cab(x, Z0 + 0.5, 0, i++);
      for (let z = -4.6; z <= 4.0; z += 1.3) { cab(-X + 0.5, z, Math.PI / 2, i++); cab(X - 0.5, z, -Math.PI / 2, i++); }
      // token machine
      box(b, C("tokM", "#e8c45a"), 2.2, 0, 5.8, 0.8, 1.6, 0.6); b.add(new THREE.PlaneGeometry(0.4, 0.3), glow([5, 4, 0.8]), M4(2.2, 1.25, 5.49, Math.PI)); cylY(b, M.iron(), 2.2, 0.55, 5.48, 0.12, 0.05, 12);
    });
  }
  return { groups, dayOnly, nightOnly };
};
