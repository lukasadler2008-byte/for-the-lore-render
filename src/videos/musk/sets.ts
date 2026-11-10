// The eleven sets of "How Elon Musk Became the Richest Person": gold plain with skyline and mesas, 90s start-up office,
// beach, rocket hangar, launch pad, garage, cliff + canyon, studio, night pizzeria street, city plaza with towers and a
// race track. Every interior is closed (floor, four walls, ceiling with lamps); every open set has layered depth
// (painted sky from world.ts, fog, distant silhouettes / mesas / skyline, sun glow) and textured surfaces (wood grain,
// brick, metal panels, concrete, sand, strata). Procedural geometry merged per material (Batch).
import * as THREE from "three";
import { Batch, lam, V, Kit, prop, boxGeo, quad, M4, beamGeo, groundQuad, flatRect } from "./build";
import { ctex, planksHD, stoneHD, brick, grassHD, facadeHD, rng, waterNear } from "./paint";
import { SetId } from "./story";

export type SetBuild = { groups: Record<SetId, THREE.Group> };

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
export const buildSets = (root: THREE.Object3D, kit: Kit): SetBuild => {
  const groups = {} as Record<SetId, THREE.Group>;
  for (const id of ["mountain", "office", "beach", "hangar", "pad", "garage", "cliff", "studio", "pizzeria", "city", "track"] as SetId[]) { groups[id] = new THREE.Group(); groups[id].visible = false; root.add(groups[id]); }
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
  {
    const G = groups.office, X = 8, Z0 = -7, Z1 = 9, H = 6.6;
    const wall = C("offWall", "#ddd6c4"), wain = M.woodLt();
    build(G, (b) => {
      room(b, X, Z0, Z1, H, wall, carpetM(), C("ceilTile", "#e6e3da"), 3);
      for (const [x0, x1, z0, z1] of [[-X, X, Z0, Z0 + 0.1], [-X, -X + 0.1, Z0, Z1], [X - 0.1, X, Z0, Z1]]) bx(b, wain, x0, x1, 0, 1.1, z0, z1);
      bx(b, M.woodDk(), -X, X, 1.1, 1.18, Z0, Z0 + 0.16); bx(b, M.woodDk(), -X, X, 0, 0.18, Z0, Z0 + 0.14);
      for (let i = -3; i <= 3; i++) bx(b, C("offPanel", "#c9c1ab"), i * 2.2 - 0.04, i * 2.2 + 0.04, 1.18, 4.6, Z0, Z0 + 0.04);
      bx(b, C("offBand", "#3f6fb5"), -X, X, 4.6, 4.9, Z0, Z0 + 0.05);
      for (let x = -X; x <= X; x += 2.0) bx(b, C("grid", "#bdb8a8"), x - 0.03, x + 0.03, H - 0.05, H, Z0, Z1);
      for (let z = Z0; z <= Z1; z += 2.0) bx(b, C("grid", "#bdb8a8"), -X, X, H - 0.05, H, z - 0.03, z + 0.03);
      for (const x of [-4.5, 0, 4.5]) for (const z of [-4, 0, 4]) { bx(b, M.steel(), x - 0.9, x + 0.9, H - 0.12, H, z - 0.25, z + 0.25); bx(b, glow([3.6, 3.7, 3.4]), x - 0.82, x + 0.82, H - 0.14, H - 0.1, z - 0.19, z + 0.19); }
      bx(b, M.woodDk(), X - 0.1, X, 1.5, 5.0, -5.4, -1.0);
      b.add(quad(V(X - 0.12, 1.65, -1.15), V(X - 0.12, 1.65, -5.25), V(X - 0.12, 4.85, -5.25), V(X - 0.12, 4.85, -1.15)), glow([1.6, 1.5, 1.3]));
      bx(b, M.woodDk(), X - 0.14, X - 0.08, 1.6, 4.9, -3.25, -3.15);
      bx(b, C("cork", "#b98a54"), -X, -X + 0.08, 1.7, 4.4, -5.8, -2.2);
      const r = rng(5); for (let i = 0; i < 26; i++) bx(b, C("note" + (i % 5), ["#f2e36b", "#e8836a", "#7ec3e8", "#a2d97a", "#f4a8c8"][i % 5]), -X + 0.08, -X + 0.12, 1.9 + r() * 2.2, 2.1 + r() * 2.1, -5.6 + r() * 3.2, -5.2 + r() * 3.2);
      bx(b, M.white(), -X, -X + 0.08, 1.8, 4.2, -1.2, 3.2); bx(b, M.steel(), -X, -X + 0.1, 1.74, 1.8, -1.26, 3.26);
      for (let i = 0; i < 6; i++) b.add(beamGeo(V(-X + 0.12, 3.8 - 0.3 * i + 0.4 * (i % 2), -0.8 + i * 0.6), V(-X + 0.12, 3.4 - 0.3 * i, -0.4 + i * 0.6 + 0.3), 0.04), C("marker" + (i % 3), ["#2a5ac8", "#d6453b", "#2a8f4a"][i % 3]), undefined);
      bx(b, M.white(), -X, -X + 0.08, 1.8, 4.2, 4.0, 8.0);
      for (const [z0, c] of [[4.3, "#e2453c"], [5.6, "#3f86e0"], [6.9, "#f2c230"]] as const) { bx(b, C("poster" + c, c), -X + 0.08, -X + 0.1, 2.2, 3.9, z0, z0 + 1.1); bx(b, M.white(), -X + 0.1, -X + 0.12, 2.5, 3.0, z0 + 0.15, z0 + 0.95); }
      for (const x of [-6.1, -4.8, 4.2, 5.5, 6.8]) { bx(b, C("blueprint", "#2f5fb0"), x, x + 1.0, 2.6, 4.0, Z0 + 0.04, Z0 + 0.07); for (let i = 0; i < 4; i++) bx(b, M.white(), x + 0.1, x + 0.9, 2.8 + i * 0.3, 2.84 + i * 0.3, Z0 + 0.07, Z0 + 0.09); }
      b.add(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 24).rotateX(Math.PI / 2), M.white(), M4(0, 5.3, Z0 + 0.15)); b.add(new THREE.TorusGeometry(0.5, 0.05, 6, 24), M.black(), M4(0, 5.3, Z0 + 0.18));
      b.add(beamGeo(V(0, 5.3, Z0 + 0.2), V(0, 5.65, Z0 + 0.2), 0.04), M.black(), undefined); b.add(beamGeo(V(0, 5.3, Z0 + 0.2), V(0.25, 5.2, Z0 + 0.2), 0.04), M.red(), undefined);
      cylY(b, M.white(), 6.9, 0, Z0 + 0.6, 0.3, 1.0, 10); cylY(b, C("jug", "#8fd0ff"), 6.9, 1.0, Z0 + 0.6, 0.26, 0.7, 12); sphere(b, C("jug", "#8fd0ff"), 6.9, 1.7, Z0 + 0.6, 0.26, 0.7, 12);
      for (const x of [-7.2, 7.2]) { cylY(b, C("pot", "#b5653f"), x, 0, Z0 + 0.7, 0.35, 0.55, 12, 0.28); for (let i = 0; i < 6; i++) sphere(b, C("leafG", "#3f8a4a"), x + Math.sin(i * 2) * 0.35, 0.9 + (i % 3) * 0.35, Z0 + 0.7 + Math.cos(i * 2) * 0.3, 0.3, 1.3, 8); }
      const desk = (x: number, z: number, yaw: number, crtOn = true) => {
        const L = loc(b, x, z, yaw);
        L.box(M.woodLt(), 0, 0.72, 0, 2.0, 0.07, 0.9); for (const [lx, lz] of [[-0.95, 0.38], [0.95, 0.38], [-0.95, -0.38], [0.95, -0.38]]) L.box(M.woodDk(), lx, 0, lz, 0.07, 0.72, 0.07);
        L.box(C("deskPan", "#8a6a46"), 0, 0.15, -0.42, 1.9, 0.57, 0.04);
        L.box(M.beige(), -0.35, 0.79, -0.15, 0.56, 0.44, 0.48); L.box(M.beigeDk(), -0.35, 0.79, -0.4, 0.4, 0.3, 0.32);
        L.box(crtOn ? glow([0.5, 2.4, 1.2]) : C("crtOff", "#2a3d3a"), -0.35, 0.85, 0.095, 0.4, 0.32, 0.05);
        L.box(M.beige(), -0.35, 0.73, 0.1, 0.3, 0.08, 0.3);
        L.box(M.beige(), 0.5, 0.79, -0.1, 0.24, 0.5, 0.42); L.box(M.black(), 0.5, 0.95, 0.12, 0.2, 0.02, 0.03); L.box(glow([0.4, 3, 0.6]), 0.58, 1.12, 0.12, 0.03, 0.03, 0.03);
        L.box(M.beige(), -0.2, 0.79, 0.34, 0.6, 0.04, 0.2); L.box(M.black(), -0.2, 0.83, 0.34, 0.54, 0.015, 0.14); L.box(M.beige(), 0.2, 0.79, 0.38, 0.1, 0.03, 0.14);
        L.cyl(M.red(), 0.8, 0.79, 0.15, 0.06, 0.1, 10); L.box(C("paperS", "#f4f0e6"), 0.75, 0.79, -0.2, 0.3, 0.05, 0.22);
        L.box(C("chair", "#2f3f6f"), 0, 0.45, 0.95, 0.6, 0.08, 0.6); L.box(C("chair", "#2f3f6f"), 0, 0.85, 1.24, 0.6, 0.7, 0.08); L.cyl(M.iron(), 0, 0, 0.95, 0.04, 0.45, 8); L.box(M.iron(), 0, 0, 0.95, 0.6, 0.05, 0.06);
      };
      desk(-5.6, Z0 + 1.3, 0); desk(-3.2, Z0 + 1.3, 0, false); desk(3.4, Z0 + 1.3, 0); desk(5.9, Z0 + 1.3, 0, false);
      desk(-X + 1.2, 3.0, -Math.PI / 2); desk(-X + 1.2, 5.6, -Math.PI / 2, false); desk(X - 1.2, 3.4, Math.PI / 2); desk(X - 1.2, 6.0, Math.PI / 2, false);
      box(b, C("beanbag", "#d6453b"), 5.5, 0, 1.2, 1.3, 0.55, 1.0, 0.4); box(b, C("beanbag", "#3f86e0"), -5.8, 0, 0.2, 1.2, 0.5, 1.0, -0.3);
      for (const [x, z] of [[-6.8, -4.6], [6.8, -3.0]]) cylY(b, C("bin", "#4a5160"), x, 0, z, 0.3, 0.6, 12, 0.34);
    });
  }

  // ======== 3. beach: sand, sea, foam, palms, lounger, umbrella, distant islands ========
  {
    const G = groups.beach;
    build(G, (b) => {
      b.add(flatRect(-160, 160, -14, 70, 0, 6), sandM());
      b.add(flatRect(-900, 900, -900, -14, -0.12, 30), lam("m_sea", () => ({ map: waterNear() })));
      bx(b, C("foam", "#f4f8f8"), -160, 160, -0.08, 0.02, -15.6, -13.2); bx(b, C("wetsand", "#c9a46a"), -160, 160, 0.0, 0.04, -13.2, -10);
      for (let i = 0; i < 5; i++) bx(b, C("foam", "#f4f8f8"), -160, 160, -0.1, -0.02, -20 - i * 6, -19.5 - i * 6);
      for (let i = 0; i < 7; i++) { const r = rng(i + 20); b.add(new THREE.ConeGeometry(18 + r() * 24, 14 + r() * 22, 8), i % 2 ? mesaCool : C("island", "#6a8a9a"), M4(-200 + i * 70 + r() * 30, 0, -260 - r() * 160)); }
      mesaRing(b, mesaCool, 6, 420, 520, 30, 80, 4, Math.PI * 0.9, -Math.PI * 0.45);
      palm(b, -7.5, -2, 7, 0.18); palm(b, 8, -3.5, 8, -0.2); palm(b, -12, -6, 6.5, 0.1); palm(b, 14, 2, 7.5, -0.15); palm(b, -4.5, -8, 6, 0.22);
      const L = loc(b, 0, 0, 0), cloth = surf("loungeCloth", () => stripeTex("lounge", "#f4f0e6", "#e2453c"));
      L.box(M.wood(), -0.42, 0, -0.9, 0.06, 0.4, 0.06); L.box(M.wood(), 0.42, 0, -0.9, 0.06, 0.4, 0.06); L.box(M.wood(), -0.42, 0, 0.9, 0.06, 0.25, 0.06); L.box(M.wood(), 0.42, 0, 0.9, 0.06, 0.25, 0.06);
      L.box(M.wood(), -0.44, 0.38, 0, 0.06, 0.05, 2.0); L.box(M.wood(), 0.44, 0.38, 0, 0.06, 0.05, 2.0);
      b.add(boxGeo(V(-0.42, 0.42, -0.75), V(0.42, 0.5, 0.95), 0.5), cloth);
      const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.95, 0, 0));
      b.add(new THREE.BoxGeometry(0.84, 0.08, 0.9), cloth, new THREE.Matrix4().compose(V(0, 0.82, -1.18), tilt, V(1, 1, 1)));
      b.add(new THREE.BoxGeometry(0.05, 0.9, 0.05), M.wood(), new THREE.Matrix4().compose(V(-0.44, 0.82, -1.18), tilt, V(1, 1, 1))); b.add(new THREE.BoxGeometry(0.05, 0.9, 0.05), M.wood(), new THREE.Matrix4().compose(V(0.44, 0.82, -1.18), tilt, V(1, 1, 1)));
      L.box(C("pillow", "#f2c230"), 0, 0.5, -0.7, 0.6, 0.12, 0.3);
      cylY(b, M.wood(), 0.9, 0, -0.6, 0.04, 3.3, 8);
      b.add(new THREE.ConeGeometry(2.0, 0.7, 16, 1, true).translate(0, 0.35, 0), lam("m_umbC", () => ({ map: stripeTex("umb", "#f4f0e6", "#3f86e0"), side: THREE.DoubleSide })), M4(0.9, 3.15, -0.6));
      sphere(b, M.gold(), 0.9, 3.95, -0.6, 0.07, 1, 8);
      box(b, C("towel", "#3fa8a0"), 1.9, 0.01, 0.6, 1.0, 0.03, 1.8, 0.2); box(b, C("towelS", "#f4f0e6"), 1.9, 0.03, 0.6, 1.0, 0.012, 0.25, 0.2);
      box(b, M.red(), -1.4, 0, 0.5, 0.7, 0.45, 0.45, 0.3); box(b, M.white(), -1.4, 0.45, 0.5, 0.74, 0.1, 0.49, 0.3); cylY(b, C("glassCup", "#ffd36b"), -0.7, 0, 0.9, 0.07, 0.2, 10, 0.09); b.add(beamGeo(V(-0.7, 0.18, 0.9), V(-0.65, 0.4, 0.88), 0.015), M.red(), undefined);
      sphere(b, C("ballW", "#f4f0e6"), 2.9, 0.3, 1.8, 0.3, 1, 14); b.add(new THREE.TorusGeometry(0.3, 0.05, 6, 20), M.red(), M4(2.9, 0.3, 1.8, 0.6)); b.add(new THREE.TorusGeometry(0.3, 0.05, 6, 20), M.blue(), M4(2.9, 0.3, 1.8, 1.9));
      for (let i = 0; i < 3; i++) b.add(new THREE.ConeGeometry(0.4 - i * 0.1, 0.35, 10).translate(0, 0.17, 0), C("castle", "#d9b273"), M4(-2.6, i * 0.3, 1.6));
      box(b, C("flipflop", "#e2453c"), 0.8, 0, 1.6, 0.14, 0.04, 0.34, 0.3); box(b, C("flipflop", "#e2453c"), 1.0, 0, 1.55, 0.14, 0.04, 0.34, 0.5);
      for (let i = 0; i < 16; i++) { const r = rng(i + 90); sphere(b, C("shell", "#f0d9c4"), (r() - 0.5) * 14, 0.04, 1 + r() * 8, 0.1, 0.5, 6); }
      lampPost(b, -16, -4, 3.2);
    });
  }

  // ======== 4. rocket hangar (closed): metal panel walls, trusses, scaffold, pallets, open back door ========
  {
    const G = groups.hangar, X = 20, Z0 = -28, Z1 = 14, H = 17;
    const wall = metalM("hangar", "#aab3bd", "#808995"), floor = concreteM();
    build(G, (b) => {
      room(b, X, Z0, Z1, H, wall, floor, C("hRoof", "#5d6572"), 6);
      for (let x = -X + 5; x < X; x += 5) bx(b, M.iron(), x - 0.3, x + 0.3, 0, H, Z0, Z0 + 0.5);
      for (let z = Z0; z < Z1; z += 7) { bx(b, M.iron(), -X, -X + 0.5, 0, H, z - 0.3, z + 0.3); bx(b, M.iron(), X - 0.5, X, 0, H, z - 0.3, z + 0.3); }
      for (let z = Z0 + 3; z < Z1; z += 7) { bx(b, M.iron(), -X, X, H - 1.2, H, z - 0.3, z + 0.3); for (let x = -X; x < X; x += 5) b.add(beamGeo(V(x, H, z), V(x + 5, H - 1.2, z), 0.16), M.iron(), undefined); }
      for (let x = -X + 2; x < X; x += 6) bx(b, glow([3.4, 3.5, 3.2]), x - 1.4, x + 1.4, H - 1.3, H - 1.2, Z0 + 1, Z1 - 1);
      for (const x of [-12, -4, 4, 12]) for (const z of [-20, -8, 4]) hang(b, x, H - 1.2, H - 4.5, z, "#c9c9d0", 1.2);
      bx(b, M.iron(), -9, 9, 0, 11, Z0 + 0.4, Z0 + 0.7);
      b.add(quad(V(-8.4, 0, Z0 + 0.75), V(8.4, 0, Z0 + 0.75), V(8.4, 10.4, Z0 + 0.75), V(-8.4, 10.4, Z0 + 0.75)), surf("hDoorGlow", skylineGlowTex));
      bx(b, metalM("door", "#c9ced6", "#9aa3ad"), -9, -1.2, 0, 11, Z0 + 0.7, Z0 + 1.1); bx(b, metalM("door", "#c9ced6", "#9aa3ad"), 4.4, 9, 0, 11, Z0 + 0.7, Z0 + 1.1);
      bx(b, M.yellow(), -9, -1.2, 5.0, 5.8, Z0 + 1.1, Z0 + 1.14); bx(b, M.yellow(), 4.4, 9, 5.0, 5.8, Z0 + 1.1, Z0 + 1.14);
      for (const z of [-24, 0]) b.add(flatRect(-X, X, z - 0.2, z + 0.2, 0.02, 1), surf("hazard", hazardTex));
      b.add(flatRect(-6, 12, -16, -4, 0.025, 4), C("padFl", "#8e969f"));
      cylY(b, M.iron(), 3, 0, -10, 2.2, 0.6, 24); cylY(b, M.steel(), 3, 0.6, -10, 1.7, 0.15, 24);
      for (const a of [0.3, 2.4, 4.5]) b.add(beamGeo(V(3 + Math.cos(a) * 1.6, 0.6, -10 + Math.sin(a) * 1.6), V(3 + Math.cos(a) * 2.4, 4, -10 + Math.sin(a) * 2.4), 0.16), M.iron(), undefined);
      for (let i = 0; i < 4; i++) { const x = -9 + (i % 2) * 2.4, z = -18 + Math.floor(i / 2) * 2.4; bx(b, M.yellow(), x, x + 0.25, 0, 11, z, z + 0.25); }
      for (let y = 1.5; y < 11; y += 3) { bx(b, M.yellow(), -9, -6.35, y, y + 0.1, -18, -15.6); b.add(beamGeo(V(-9, y, -18), V(-6.4, y + 3, -18), 0.1), M.yellow(), undefined); }
      bx(b, M.iron(), -9, -6.3, 11, 11.2, -18.1, -15.5);
      cylY(b, M.steel(), -2.0, 0, -6.5, 0.9, 2.6, 16, 0.9); b.add(new THREE.ConeGeometry(0.9, 0.9, 16, 1, true).translate(0, 0.45, 0), C2("hopper", "#9aa3ad"), M4(-2.0, 2.6, -6.5, 0, [1.2, 1, 1.2]));
      for (let i = 0; i < 3; i++) b.add(new THREE.TorusGeometry(2.3 + i * 0.6, 0.12, 6, 20, Math.PI * 0.9).rotateX(Math.PI / 2), C("hose", "#2c2f38"), M4(0.5, 0.15, -9.6, 0.6 + i * 1.3));
      for (let i = 0; i < 10; i++) { const r = rng(i + 3); box(b, i % 3 ? M.woodLt() : M.blue(), -17 + r() * 4, 0, -24 + i * 3.4, 2 + r(), 1.5 + r() * 1.5, 2 + r(), r()); }
      for (let i = 0; i < 6; i++) cylY(b, i % 2 ? M.red() : M.orange(), 14 + (i % 3) * 1.2, 0, -22 + Math.floor(i / 3) * 1.4, 0.55, 1.2, 14);
      for (const [x, z] of [[14, -12], [16.5, -6]]) { cylY(b, M.iron(), x, 0.3, z, 0.9, 2.6, 16, 0.5); cylY(b, M.copper(), x, 0.1, z, 0.55, 0.6, 14); }
      box(b, M.red(), 12, 0, 2, 2.4, 1.5, 1.0); box(b, M.black(), 12, 1.5, 2, 2.5, 0.1, 1.1); box(b, M.steel(), 12.6, 0.6, 2.55, 0.5, 0.1, 0.05);
      for (const [x, c] of [[-12, "#c0392f"], [-4, "#3f6fb5"], [4, "#e0b83a"], [12, "#3fa86a"]] as const) bx(b, C("hban" + c, c), x - 2, x + 2, 11.5, 13.5, Z0 + 0.5, Z0 + 0.55);
      box(b, M.woodLt(), -5.2, 0, -3.8, 2.4, 0.2, 1.6); for (let i = 0; i < 4; i++) box(b, M.woodDk(), -5.2, 0.2, -4.4 + i * 0.4, 2.4, 0.06, 0.12);
      lampPost(b, 17.5, 6, 5);
    });
  }

  // ======== 5. launch pad: slab, gantry, tanks, hangar, bunker, mesas, flood lights ========
  {
    const G = groups.pad, conc = concreteM();
    build(G, (b) => {
      b.add(groundQuad(900, 12, -0.06), surf("sandPad", () => sandTex("sandPad", "#dcc08a", "#c9a46e")));
      b.add(flatRect(-60, 60, -62, 6, 0.0, 6), conc); b.add(flatRect(-60, 60, 5.2, 6, 0.02, 1), surf("hazard", hazardTex)); b.add(flatRect(-60, 60, -62.4, -61.6, 0.02, 1), surf("hazard", hazardTex));
      b.add(flatRect(-40, 40, -40, -20, 0.03, 8), C("padDark", "#6c7079"));
      for (const x of [-26, -13, 0, 13, 26]) { cylY(b, M.iron(), x, 0.02, -30, 3.3, 0.12, 24); cylY(b, C("padRing", "#e8c45a"), x, 0.13, -30, 2.7, 0.03, 24); }
      const gx = -20, gz = -34, gH = 38, GR = C("gantry", "#d6453b");
      for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) bx(b, GR, gx + dx - 0.2, gx + dx + 0.2, 0, gH, gz + dz - 0.2, gz + dz + 0.2);
      for (let y = 0; y < gH; y += 5) { bx(b, GR, gx - 1.7, gx + 1.7, y, y + 0.2, gz + 1.5, gz + 1.7); bx(b, GR, gx - 1.7, gx + 1.7, y, y + 0.2, gz - 1.7, gz - 1.5); bx(b, GR, gx + 1.5, gx + 1.7, y, y + 0.2, gz - 1.7, gz + 1.7); bx(b, GR, gx - 1.7, gx - 1.5, y, y + 0.2, gz - 1.7, gz + 1.7); b.add(beamGeo(V(gx - 1.6, y, gz + 1.6), V(gx + 1.6, y + 5, gz + 1.6), 0.14), GR, undefined); b.add(beamGeo(V(gx + 1.6, y, gz + 1.6), V(gx + 1.6, y + 5, gz - 1.6), 0.14), GR, undefined); }
      bx(b, M.white(), gx + 1.4, gx + 12, 24, 24.5, gz - 0.5, gz + 0.5); bx(b, M.white(), gx + 1.4, gx + 12, 24.5, 26.2, gz - 0.05, gz + 0.05);
      sphere(b, glow([5, 1.2, 0.8]), gx, gH + 0.6, gz, 0.5, 1, 10);
      for (const [x, z, r] of [[34, -50, 6], [46, -46, 5], [24, -56, 4.5]] as const) { sphere(b, C("tank", "#eef0f4"), x, r + 3.2, z, r, 1, 18); for (const a of [0.6, 2.2, 3.8, 5.4]) b.add(beamGeo(V(x + Math.cos(a) * r * 0.7, r * 0.5, z + Math.sin(a) * r * 0.7), V(x + Math.cos(a) * r * 0.9, 0, z + Math.sin(a) * r * 0.9), 0.3), M.steel(), undefined); b.add(new THREE.TorusGeometry(r, 0.12, 6, 30).rotateX(Math.PI / 2), M.red(), M4(x, r + 3.2, z)); }
      bx(b, M.steel(), 10, 40, 0.8, 1.2, -44, -43.2);
      box(b, metalM("padh", "#e3e7ee", "#b9c1cc"), -66, 0, -78, 52, 26, 26); box(b, M.iron(), -66, 0, -64.9, 22, 20, 0.4); box(b, C("padhRoof", "#c5ccd6"), -66, 26, -78, 54, 1.2, 28);
      for (const x of [-80, -52]) b.add(quad(V(x - 5, 5, -64.4), V(x + 5, 5, -64.4), V(x + 5, 21, -64.4), V(x - 5, 21, -64.4)), glow([0.5, 0.6, 0.8]));
      box(b, C("bunker", "#c9c3b4"), 34, 0, -12, 14, 5, 8); bx(b, glow([2.6, 2.8, 3.0]), 28, 40, 2.4, 3.6, -7.95, -7.9); box(b, M.iron(), 34, 5, -12, 15, 0.5, 9);
      for (let i = 0; i < 3; i++) cylY(b, M.steel(), 28 + i * 6, 5.5, -12, 0.12, 6 + i * 2, 6, 0.04);
      for (let i = 0; i < 4; i++) { const fx = -44 + i * 30, fz = -4 + (i % 2) * 20; cylY(b, M.iron(), fx, 0, fz, 0.25, 14, 8, 0.15); bx(b, glow([5, 4.6, 3.6]), fx - 1.2, fx + 1.2, 14.2, 15, fz - 0.3, fz + 0.3); }
      mesaRing(b, mesaM, 14, 400, 560, 40, 110, 31); mesaRing(b, mesaCool, 12, 640, 800, 70, 150, 37);
      skylineRing(b, 300, 380, 14, 20, 70, "#9a86a8", 9, Math.PI * 0.8, Math.PI * 0.6);
      for (let i = 0; i < 30; i++) { const r = rng(i + 140), x = (r() - 0.5) * 300, z = 20 + r() * 120, s = 0.8 + r() * 2; b.add(new THREE.IcosahedronGeometry(s, 0), C("boulderP", "#a8896a"), M4(x, s * 0.35, z, r() * 6, [1.3, 0.7, 1])); }
      for (let i = 0; i < 18; i++) { const r = rng(i + 190); cylY(b, C("shrub", "#7a8a4a"), (r() - 0.5) * 240, 0, 14 + r() * 90, 0.6 + r() * 0.5, 0.7 + r() * 0.6, 7, 0.1); }
      const L = loc(b, 8, 4, 0.0);
      L.box(M.woodLt(), 0, 0.95, 0, 4.2, 0.12, 2.0); for (const [x, z] of [[-1.9, -0.85], [1.9, -0.85], [-1.9, 0.85], [1.9, 0.85]]) L.box(M.woodDk(), x, 0, z, 0.14, 0.95, 0.14); L.box(M.woodDk(), 0, 0.3, 0, 3.8, 0.1, 1.6);
      L.box(M.red(), -1.4, 1.07, -0.6, 0.5, 0.4, 0.35); L.cyl(M.steel(), 1.5, 1.07, -0.5, 0.12, 0.5, 10);
    });
  }

  // ======== 6. garage (closed): brick, pegboard, roll door, workbench, tyres, ceiling beams ========
  {
    const G = groups.garage, X = 6, Z0 = -6, Z1 = 7, H = 4.2;
    build(G, (b) => {
      room(b, X, Z0, Z1, H, brickM(), concreteM(), C("gCeil", "#cfc7b4"), 2.5);
      b.add(flatRect(-3.2, 3.2, -4.5, 3.4, 0.02, 2), C("gMat", "#2f3340"));
      for (let x = -X + 1; x < X; x += 2) bx(b, M.woodDk(), x - 0.12, x + 0.12, H - 0.35, H, Z0, Z1);
      for (const x of [-3, 3]) hang(b, x, H - 0.35, H - 1.7, 0, "#c9b88a", 0.6);
      bx(b, glow([3.4, 3.5, 3.2]), -1.2, 1.2, H - 0.42, H - 0.36, -3.4, -2.8);
      bx(b, M.iron(), -5.3, 0.2, 0, 3.4, Z0, Z0 + 0.12); for (let y = 0.1; y < 3.3; y += 0.3) bx(b, y % 0.6 < 0.3 ? C("slatA", "#aeb6c0") : C("slatB", "#9aa3ad"), -5.2, 0.1, y, y + 0.28, Z0 + 0.12, Z0 + 0.2);
      bx(b, C("peg", "#c9a46a"), 0.5, 5.9, 0.9, 3.6, Z0, Z0 + 0.06);
      const r = rng(8); for (let i = 0; i < 14; i++) { const x0 = 0.8 + r() * 4.7, y0 = 1.1 + r() * 2.3; bx(b, C("tool" + (i % 4), ["#aab2bb", "#d6453b", "#3f86e0", "#2c2f38"][i % 4]), x0, x0 + 0.2, y0, y0 + 0.5 + 0.4 * (i % 2), Z0 + 0.06, Z0 + 0.1); }
      bx(b, M.woodDk(), X - 0.12, X, 1.5, 3.2, -3.6, -1.6); b.add(quad(V(X - 0.14, 1.6, -1.7), V(X - 0.14, 1.6, -3.5), V(X - 0.14, 3.1, -3.5), V(X - 0.14, 3.1, -1.7)), glow([2.2, 2.3, 2.5]));
      for (const y of [1.0, 1.9, 2.8]) bx(b, M.woodDk(), -X, -X + 0.7, y, y + 0.07, -5, 0.5);
      for (let i = 0; i < 14; i++) cylY(b, C("can" + (i % 3), ["#e2453c", "#f2c230", "#3f86e0"][i % 3]), -X + 0.35, 1.07 + (i % 3) * 0.9, -4.6 + Math.floor(i / 3) * 0.95, 0.14, 0.26, 10);
      for (let i = 0; i < 4; i++) b.add(new THREE.TorusGeometry(0.4, 0.17, 8, 18).rotateX(Math.PI / 2), M.black(), M4(-X + 1.4, 0.17 + i * 0.34, 2.8));
      for (let i = 0; i < 3; i++) b.add(new THREE.TorusGeometry(0.4, 0.17, 8, 18).rotateX(Math.PI / 2), M.black(), M4(X - 1.5, 0.17 + i * 0.34, 4.2));
      bx(b, M.woodLt(), -4.8, -1.8, 0.92, 1.0, -5.6, -4.3); for (const [x, z] of [[-4.7, -5.5], [-1.9, -5.5], [-4.7, -4.4], [-1.9, -4.4]]) bx(b, M.woodDk(), x, x + 0.1, 0, 0.92, z, z + 0.1); bx(b, M.woodDk(), -4.8, -1.8, 0.4, 0.46, -5.6, -4.3);
      box(b, M.red(), -4.1, 1.0, -5.0, 0.7, 0.35, 0.45); box(b, M.iron(), -2.7, 1.0, -5.1, 0.3, 0.25, 0.3); box(b, M.steel(), -3.4, 1.0, -4.7, 0.5, 0.06, 0.3);
      bx(b, C("blueprint", "#2f5fb0"), -4.2, -2.0, 2.2, 3.4, Z0 + 0.06, Z0 + 0.1); for (let i = 0; i < 4; i++) bx(b, M.white(), -4.0, -2.2, 2.35 + i * 0.25, 2.38 + i * 0.25, Z0 + 0.1, Z0 + 0.12);
      box(b, M.red(), 4.6, 0, -3.4, 1.2, 1.6, 0.8); for (let i = 0; i < 4; i++) box(b, C("drawer", "#b83a30"), 4.6, 0.2 + i * 0.35, -2.98, 1.1, 0.3, 0.03);
      cylY(b, C("drum", "#3f6fb5"), 5.0, 0, -0.8, 0.45, 1.0, 14); cylY(b, C("drum", "#3f6fb5"), -5.2, 0, 4.6, 0.45, 1.0, 14);
      box(b, C("stool", "#6a4630"), -2.7, 0, -1.5, 0.5, 0.55, 0.5);
    });
  }

  // ======== 7. cliff + canyon: plateau, strata walls, far mesas, wooden gallows, table ========
  {
    const G = groups.cliff;
    build(G, (b) => {
      b.add(flatRect(-60, 60, -6, 60, 0, 6), sandM());
      b.add(boxGeo(V(-60, -90, -6), V(60, 0, 60), 14), mesaM);
      bx(b, C("canyonFloor", "#8a5a46"), -400, 400, -92, -88, -400, 60);
      b.add(flatRect(-400, 400, -300, -20, -88.5, 30), lam("m_rvr", () => ({ map: waterNear() })));
      for (let i = 0; i < 6; i++) { const r = rng(i + 40); mesa(b, i % 2 ? mesaM : mesaCool, -140 + i * 55 + r() * 20, -70 - r() * 40, 20 + r() * 20, -20 + r() * 50); }
      b.add(boxGeo(V(-300, -90, -160), V(300, 70, -130), 16), mesaM); b.add(boxGeo(V(-300, -90, -240), V(300, 120, -200), 16), mesaCool);
      b.add(boxGeo(V(-300, -90, -420), V(300, 180, -380), 16), mesaCool);
      b.add(boxGeo(V(-130, -90, -50), V(-60, 30, 60), 14), mesaM); b.add(boxGeo(V(60, -90, -50), V(130, 24, 60), 14), mesaM);
      for (let i = 0; i < 20; i++) { const r = rng(i + 80); const x = (r() - 0.5) * 100, z = r() * 40, s = 0.6 + r() * 1.6; b.add(new THREE.IcosahedronGeometry(s, 0), C("rockC", "#a8786a"), M4(x, s * 0.3, z, r() * 6, [1.3, 0.7, 1])); }
      for (const x of [-4, 4]) { bx(b, M.woodDk(), x - 0.2, x + 0.2, 0, 6.4, 5.8, 6.2); b.add(beamGeo(V(x, 0.2, 6), V(x * 0.4, 5.4, 6), 0.16), M.wood(), undefined); }
      bx(b, M.wood(), -4.6, 4.6, 6.4, 6.8, 5.7, 6.3);
      for (const x of [-1.8, 1.8]) { b.add(beamGeo(V(x - 0.3, 6.4, 6), V(x - 0.3, 4.4, 6), 0.05), C("rope", "#c9a46a"), undefined); b.add(beamGeo(V(x + 0.3, 6.4, 6), V(x + 0.3, 4.4, 6), 0.05), C("rope", "#c9a46a"), undefined); box(b, M.woodDk(), x, 4.15, 6, 1.1, 0.2, 0.9); }
      box(b, M.woodDk(), 0, 0, 3.0, 1.3, 0.7, 0.9); box(b, M.woodLt(), 0, 0.7, 3.0, 1.5, 0.08, 1.1);
    });
  }

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

  // ======== 9. night pizzeria street: brick shop, glowing window, awning, string lights, neighbours, lamps ========
  {
    const G = groups.pizzeria, nf = (k: string, w: number, h: number, wall: string) => lam("m_pz" + k, () => ({ map: facadeHD("pz" + k, w, h, { wall, shutter: "#3a4a6a", door: true, lit: 0.8 }) }));
    build(G, (b) => {
      b.add(groundQuad(400, 8, -0.06), surf("asphalt", asphaltTex));
      b.add(flatRect(-60, 60, -12, -3.2, 0.12, 2), surf("pavePz", () => stoneHD("slabHD", ["#8a8fa8", "#7c829c", "#9298b0", "#707690"], "#4a4f68")));
      bx(b, C("curb", "#b8bcd0"), -60, 60, 0, 0.14, -3.3, -3.1);
      for (let x = -40; x < 40; x += 6) bx(b, C("lanePz", "#e8e4c8"), x, x + 3, 0.0, 0.03, 6, 6.3);
      const px = 0, pw = 15, ph = 7.2, pz = -12;
      b.add(boxGeo(V(px - pw / 2, 0, pz - 6), V(px + pw / 2, ph, pz), 3), brickM());
      bx(b, C("lip", "#d9d0bc"), px - pw / 2 - 0.3, px + pw / 2 + 0.3, ph, ph + 0.5, pz - 6.3, pz + 0.3);
      bx(b, M.woodDk(), -5.2, -0.4, 1.0, 5.4, pz + 0.01, pz + 0.12); b.add(quad(V(-4.9, 1.2, pz + 0.13), V(-0.7, 1.2, pz + 0.13), V(-0.7, 5.1, pz + 0.13), V(-4.9, 5.1, pz + 0.13)), glow([2.7, 1.9, 0.9]));
      bx(b, M.woodDk(), -2.9, -2.8, 1.2, 5.1, pz + 0.13, pz + 0.16); bx(b, M.woodDk(), -4.9, -0.7, 3.1, 3.18, pz + 0.13, pz + 0.16);
      bx(b, M.woodDk(), 2.2, 4.6, 0, 3.4, pz + 0.01, pz + 0.12); b.add(quad(V(2.4, 0.1, pz + 0.13), V(4.4, 0.1, pz + 0.13), V(4.4, 3.2, pz + 0.13), V(2.4, 3.2, pz + 0.13)), glow([2.2, 1.5, 0.7]));
      bx(b, M.woodDk(), 5.6, 7.1, 1.4, 4.2, pz + 0.01, pz + 0.1); b.add(quad(V(5.7, 1.5, pz + 0.12), V(7.0, 1.5, pz + 0.12), V(7.0, 4.1, pz + 0.12), V(5.7, 4.1, pz + 0.12)), glow([2.3, 1.7, 0.8]));
      const aw = lam("m_awn", () => ({ map: stripeTex("awn", "#f4f0e6", "#d6453b"), side: THREE.DoubleSide }));
      b.add(new THREE.BoxGeometry(14.4, 0.12, 2.6), aw, new THREE.Matrix4().compose(V(0, 4.6, pz + 1.2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.28, 0, 0)), V(1, 1, 1)));
      for (let i = 0; i < 18; i++) sphere(b, glow([4.5, 3.4, 1.2]), -6.8 + i * 0.8, 4.3 - 0.1 * Math.sin(i * 0.7), pz + 2.4, 0.07, 1, 6);
      b.add(new THREE.ConeGeometry(1.2, 2.4, 3, 1, false).rotateZ(Math.PI), glow([3.0, 2.2, 0.8]), M4(0, 6.0, pz + 0.7, 0, [1, 0.8, 0.2]));
      for (const [x, w, h, wall, k] of [[-14, 12, 9, "#6a6fa0", "a"], [-27, 13, 12, "#8a6a8a", "b"], [14, 12, 10, "#5f7a9a", "c"], [27, 13, 8.5, "#9a7a6a", "d"]] as const) {
        b.add(boxGeo(V(x - w / 2, 0, pz - 6), V(x + w / 2, h, pz), 4), C("pzN" + k, wall)); bx(b, C("lip2", "#c8c4d8"), x - w / 2 - 0.2, x + w / 2 + 0.2, h, h + 0.4, pz - 6.2, pz + 0.2);
        b.add(quad(V(x - w / 2, 0, pz + 0.02), V(x + w / 2, 0, pz + 0.02), V(x + w / 2, h, pz + 0.02), V(x - w / 2, h, pz + 0.02)), nf(k, w, h, wall));
      }
      skylineRing(b, 90, 200, 36, 25, 80, "#2e3a7a", 12, Math.PI * 1.4, -Math.PI * 0.7); skylineRing(b, 260, 400, 30, 40, 130, "#252f70", 13, Math.PI * 1.6, -Math.PI * 0.8);
      for (const x of [-9, 9, -22, 22]) lampPost(b, x, -4.2, 5.4, [5, 4, 1.6]);
      for (const x of [-9, 9, -22, 22]) b.add(new THREE.SphereGeometry(2.2, 10, 8).scale(1, 0.1, 1), glow([0.55, 0.42, 0.18]), M4(x, 0.16, -4.0));
      for (const x of [-11, 9.5]) { box(b, C("planter", "#8a5a3c"), x, 0.12, -4.6, 1.8, 0.6, 0.7); for (let i = 0; i < 5; i++) sphere(b, C("leafN", "#2f6a4a"), x - 0.7 + i * 0.35, 1.0, -4.6, 0.3, 1.2, 8); }
      for (const [x, z] of [[-6.5, -5.6], [7.5, -5.4]]) { cylY(b, M.iron(), x, 0.12, z, 0.06, 0.8, 8); cylY(b, M.white(), x, 0.9, z, 0.45, 0.05, 14); for (const dz of [-0.7, 0.7]) box(b, M.red(), x, 0.12, z + dz, 0.4, 0.45, 0.4); }
      box(b, M.red(), 11.5, 0.12, -6.4, 1.8, 0.5, 0.5); box(b, C("trash", "#4a5160"), -12.5, 0.12, -6.0, 0.7, 1.0, 0.7);
    });
  }

  // ======== 10. city plaza: tiled square, tower ring, blue bubble tower, measuring pole ========
  {
    const G = groups.city, t1 = winM("city1", "#48639a", "#ffe29a", 0.4), t2 = winM("city2", "#6c5f8e", "#ffd07a", 0.3), t3 = winM("city3", "#3d5a78", "#fff0b0", 0.45);
    build(G, (b) => {
      b.add(groundQuad(900, 12, -0.06), C("cityGround", "#a09aa8"));
      b.add(flatRect(-70, 70, -60, 40, 0, 4), surf("plazaStone", () => stoneHD("slabHD", ["#d8d0c4", "#cfc6ba", "#e0d8cc", "#c6bdb1"], "#8e867a")));
      const ring: [number, number, number, number, number][] = [[-48, -62, 24, 22, 90], [-24, -80, 20, 20, 125], [30, -78, 26, 22, 108], [58, -58, 22, 22, 80], [-70, -34, 20, 20, 70], [76, -30, 22, 22, 96], [-92, -66, 26, 24, 140], [94, -84, 28, 24, 150],
        [-60, 30, 22, 22, 60], [66, 30, 22, 22, 72], [-126, -20, 28, 26, 110], [128, -10, 28, 28, 120]];
      ring.forEach(([x, z, w, d, h], i) => tower(b, x, z, w, d, h, [t1, t2, t3][i % 3]));
      skylineRing(b, 260, 420, 40, 50, 190, "#8a7ea8", 21); skylineRing(b, 500, 700, 40, 60, 260, "#a496bc", 22);
      const bxp = 16, bzp = -40, bm = C("bubTowerB", "#3fa0f0"), bm2 = C("bubTowerD", "#2f7fd0");
      b.add(new THREE.CylinderGeometry(5.0, 6.2, 36, 22).translate(0, 18, 0), bm, M4(bxp, 0, bzp));
      for (let y = 4; y < 34; y += 4) b.add(new THREE.TorusGeometry(5.6 - (y / 34) * 0.4, 0.2, 6, 30).rotateX(Math.PI / 2), bm2, M4(bxp, y, bzp));
      b.add(new THREE.SphereGeometry(13, 28, 18), bm, M4(bxp, 46, bzp, 0, [1.25, 0.9, 0.8])); b.add(new THREE.SphereGeometry(13.3, 28, 18), C("bubHalo", "#8fd0ff"), M4(bxp, 46, bzp, 0, [1.28, 0.93, 0.5]));
      b.add(new THREE.ConeGeometry(4.5, 9, 4).rotateX(Math.PI).translate(0, -4.5, 0), bm, M4(bxp - 5, 38.5, bzp + 4.5, 0.6));
      for (let i = -1; i <= 1; i++) sphere(b, glow([3.5, 3.6, 3.8]), bxp + i * 5.8, 46, bzp + 10.5, 1.7, 1, 12);
      cylY(b, M.steel(), -9, 0, -12, 0.25, 38, 8); for (let y = 1; y < 38; y++) box(b, y % 5 === 0 ? M.black() : M.steel(), -9, y, -11.75, y % 5 === 0 ? 1.3 : 0.8, 0.12, 0.12);
      box(b, M.iron(), -9, 0, -12, 1.8, 0.4, 1.8);
      for (const [x, z] of [[-30, 6], [30, 6], [-30, -30], [30, -30]]) lampPost(b, x, z, 6, [5, 4, 2]);
      for (const [x, z] of [[-18, 14], [18, 14]]) { box(b, M.woodLt(), x, 0.45, z, 2.4, 0.12, 0.7); box(b, M.woodLt(), x, 0.9, z - 0.3, 2.4, 0.5, 0.1); box(b, M.iron(), x - 1.0, 0, z, 0.1, 0.45, 0.6); box(b, M.iron(), x + 1.0, 0, z, 0.1, 0.45, 0.6); }
      for (const x of [-26, 26]) { cylY(b, C("planterC", "#8a6a5a"), x, 0, -18, 1.4, 1.0, 12); for (let i = 0; i < 6; i++) sphere(b, C("leafC", "#3f8a4a"), x + Math.sin(i * 1.4) * 0.9, 1.4 + (i % 2) * 0.4, -18 + Math.cos(i * 1.4) * 0.9, 0.7, 1.2, 8); }
    });
  }

  // ======== 11. race track: grass field, red track with lane lines, grandstands, finish arch, flags, trees ========
  {
    const G = groups.track;
    build(G, (b) => {
      b.add(groundQuad(900, 12, -0.08), surf("grassHD", grassHD));
      b.add(flatRect(-80, 80, -4.5, 6.5, 0.0, 6), surf("trackRed", trackTex));
      for (const z of [-4.4, -1.8, 0.8, 3.4, 6.4]) b.add(flatRect(-80, 80, z - 0.05, z + 0.05, 0.02, 1), C("laneW", "#f4f0e6"));
      bx(b, C("startL", "#f4f0e6"), -16.1, -15.9, 0.02, 0.03, -4.4, 6.4);
      for (const z of [-5.2, 7.2]) cylY(b, M.steel(), 22, 0, z, 0.18, 6.4, 10);
      b.add(boxGeo(V(21.7, 5.2, -5.4), V(22.3, 6.6, 7.4), 0.7), surf("checker", () => checkerTex("#f4f0e6", "#26222c")));
      bx(b, glow([3.0, 3.0, 3.0]), 22, 22.04, 0.02, 0.05, -4.5, 6.5);
      for (const x of [-12, -2, 8, 18, 28, 38]) for (const z of [-6.0, 8.0]) { cylY(b, M.steel(), x, 0, z, 0.06, 4, 6); b.add(quad(V(x, 3.9, z), V(x + 1.3, 3.5, z), V(x + 1.3, 2.9, z), V(x, 3.3, z)), C2("flagT" + Math.abs((x / 10) | 0) % 3, ["#e2453c", "#3f86e0", "#f2c230"][Math.abs((x / 10) | 0) % 3])); }
      for (const [zz, face] of [[-8, -1], [12, 1]] as const) {
        const stair = surf("crowdM", crowdTex);
        for (let t = 0; t < 8; t++) { const za = zz + face * t * 1.2, zb = zz + face * (t * 1.2 + 1.2); b.add(boxGeo(V(-40, t * 1.0, Math.min(za, zb) - face * 0), V(52, t * 1.0 + 1.0, Math.max(za, zb)), 4), t % 2 ? stair : C("stand", "#8a90a4")); }
      }
      mesaRing(b, mesaCool, 8, 380, 520, 30, 90, 5); skylineRing(b, 150, 260, 30, 25, 90, "#9a8fb4", 6, Math.PI * 1.2, -Math.PI * 0.6); skylineRing(b, 330, 480, 26, 40, 150, "#aea4c4", 7, Math.PI * 1.5, -Math.PI * 0.75);
    });
    const tb = new Batch();
    for (let i = 0; i < 14; i++) { const r = rng(i + 300); prop(tb, kit, i % 2 ? "tree_oak" : "tree_default", -60 + i * 9 + r() * 4, 0, -34 - r() * 20, 6 + r() * 4); }
    tb.build(G, true);
  }
  return { groups };
};
