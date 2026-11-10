// The six sets of The Microwave Accident: radar lab / workshop, factory floor (hand benches + conveyor + crate piles),
// factory exterior, 1960s kitchen (with a doorway and a suburban glimpse), suburban street at dusk, and a plain showroom
// stage (Radarange, the molecule cut-away, the winners' podium). Procedural geometry merged per material (Batch), a few
// animated props kept as their own objects (magnetron, egg, envelope, belt crates, piles). Interiors have no ceiling.
import * as THREE from "three";
import { Batch, lam, V, Kit, prop, boxGeo, quad, tri, M4, beamGeo, groundQuad, flatRect } from "./build";
import { ctex, planksHD, stoneHD, brick } from "./paint";
import { SetId, MPILE, SPILE, SHELF, BELT_X, HAND_X, RADAR_CAB, DOOR_Z, KMW, MAG12, CHUNK, RANGE } from "./story";

export type SetBuild = {
  groups: Record<SetId, THREE.Group>;
  mag: THREE.Group; magRing: THREE.Mesh; magRing2: THREE.Mesh; radarScreen: THREE.MeshBasicMaterial;
  range: THREE.Group; rangeK: THREE.Group; scene12: THREE.Group; podium: THREE.Group; pileLayers: THREE.Group[]; stove: THREE.Group;
  beltCrates: THREE.Group; stacks: THREE.Group[]; pieceRows: THREE.Group[];
  kmw: THREE.Group; kmwGlow: THREE.MeshBasicMaterial; dishSpin: THREE.Group;
};

// ---------------- materials / helpers ----------------
const C = (key: string, color: string) => lam("m_" + key, () => ({ color }));
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
const disc = (b: Batch, m: THREE.Material, x: number, y: number, z: number, r: number, thick = 0.02, seg = 20) =>
  b.add(new THREE.CylinderGeometry(r, r, thick, seg).rotateX(Math.PI / 2), m, M4(x, y, z));
const T0 = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
const build = (parent: THREE.Object3D, fn: (b: Batch) => void, cast = true) => { const b = new Batch(); fn(b); b.build(parent, cast); };
const grp = (parent: THREE.Object3D | null, fn: (b: Batch) => void, cast = true) => { const g = new THREE.Group(); build(g, fn, cast); if (parent) parent.add(g); return g; };

const M = {
  wood: () => C("wood", "#a8744a"), woodDk: () => C("woodDk", "#6a4630"), woodLt: () => C("woodLt", "#c9985f"), iron: () => C("iron", "#4d5260"),
  steel: () => C("steel", "#9aa3ad"), cream: () => C("cream", "#efe6cf"), wallL: () => C("wallL", "#e9dcc0"), copper: () => C("copper", "#cf7b3a"),
  copperDk: () => C("copperDk", "#a35c28"), brass: () => C("brass", "#dcb54e"), black: () => C("black", "#26222c"), white: () => C("white", "#e9edf2"),
  red: () => C("red", "#c0392f"), blue: () => C("blue", "#3f6fb5"), green: () => C("green", "#4f8a4a"), glassD: () => C("glassD", "#1f3040"),
  brown: () => C("brown", "#5a3320"), cheese: () => C("cheese", "#f0c24a"), cheeseD: () => C("cheeseD", "#d89f2e"),
};
const plankM = () => lam("m_planks", () => ({ map: planksHD() }));
const slabM = () => lam("m_slabs", () => ({ map: stoneHD("slabHD", ["#c9c3b4", "#bdb7a8", "#d1cbbd", "#b3ad9e"], "#7c766a") }));
const brickM = () => lam("m_brick", () => ({ map: brick() }));

const pegTex = () => ctex("pegboard", 512, 512, (g) => {
  g.fillStyle = "#c9a46a"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "rgba(70,45,25,0.55)";
  for (let y = 12; y < 512; y += 24) for (let x = 12; x < 512; x += 24) { g.beginPath(); g.arc(x, y, 3, 0, 6.3); g.fill(); }
  const outl = (draw: () => void, col: string) => { g.fillStyle = "rgba(240,225,190,0.9)"; draw(); g.fill(); g.strokeStyle = col; g.lineWidth = 5; draw(); g.stroke(); };
  outl(() => { g.beginPath(); g.rect(60, 70, 14, 110); g.rect(36, 52, 62, 24); }, "#3a2a22");
  outl(() => { g.beginPath(); g.moveTo(150, 60); g.lineTo(190, 150); g.lineTo(168, 160); g.lineTo(140, 90); g.closePath(); g.moveTo(200, 60); g.lineTo(160, 150); g.lineTo(182, 160); g.lineTo(212, 90); g.closePath(); }, "#3a2a22");
  outl(() => { g.beginPath(); g.rect(270, 50, 16, 140); g.arc(278, 50, 28, 0, 6.3); }, "#3a2a22");
  outl(() => { g.beginPath(); g.moveTo(350, 60); g.lineTo(470, 90); g.lineTo(470, 120); g.lineTo(350, 100); g.closePath(); }, "#3a2a22");
  outl(() => { g.beginPath(); g.rect(60, 250, 14, 110); g.rect(64, 360, 6, 40); }, "#3a2a22");
  outl(() => { g.beginPath(); g.rect(160, 240, 120, 80); }, "#3a2a22");
  outl(() => { g.beginPath(); g.arc(380, 300, 50, 0, 6.3); }, "#3a2a22");
  for (let i = 0; i < 4; i++) outl(() => { g.beginPath(); g.rect(60 + i * 110, 430, 80, 50); }, "#3a2a22");
});
const emblemTex = () => ctex("emblem", 256, 256, (g) => {
  g.fillStyle = "#1f3a6a"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#f2d27a"; g.lineWidth = 10; g.strokeRect(10, 10, 236, 236);
  g.fillStyle = "#f2d27a"; g.beginPath(); g.ellipse(110, 140, 62, 70, -0.5, 0, 6.3); g.fill();
  g.fillStyle = "#1f3a6a"; g.beginPath(); g.ellipse(124, 126, 52, 60, -0.5, 0, 6.3); g.fill();
  g.strokeStyle = "#f2d27a"; g.lineWidth = 10; g.beginPath(); g.moveTo(90, 150); g.lineTo(60, 215); g.stroke();
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(150, 100, 40 + i * 24, -1.1, -0.1); g.stroke(); }
});
const kfloorTex = () => ctex("kfloor", 256, 256, (g) => {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? "#f3ecd8" : "#5fb3a6"; g.fillRect(x * 64, y * 64, 64, 64); }
});
const stripeTex = () => ctex("wallStripe", 256, 256, (g) => {
  g.fillStyle = "#f0e3ac"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#e3d089"; for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 24, 256);
});

// ---------------- small objects ----------------
const crate = (b: Batch, m: THREE.Material, x: number, y: number, z: number, s = 0.6, yaw = 0) => box(b, m, x, y, z, s, s, s, yaw);

/** copper magnetron with cooling fins, side magnets and a glowing blue-white pulse ring; base at y = 0, ~0.42 m tall */
const magnetron = () => {
  const g = new THREE.Group();
  build(g, (b) => {
    cylY(b, M.copper(), 0, 0.02, 0, 0.13, 0.3, 18);
    for (let i = 0; i < 9; i++) cylY(b, M.copperDk(), 0, 0.05 + i * 0.026, 0, 0.2, 0.014, 20);
    cylY(b, M.copper(), 0, 0.32, 0, 0.07, 0.07, 14);
    cylY(b, M.brass(), 0, 0.39, 0, 0.022, 0.1, 8);
    bx(b, M.iron(), 0.19, 0.34, 0.1, 0.28, -0.1, 0.1); bx(b, M.iron(), -0.34, -0.19, 0.1, 0.28, -0.1, 0.1);
    cylY(b, M.steel(), 0, 0, 0, 0.17, 0.03, 18);
  });
  const mk = (r: number, tube: number, col: [number, number, number], y: number) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), toneMapped: true }));
    m.position.y = y; g.add(m); return m;
  };
  const ring = mk(0.26, 0.022, [2.2, 3.0, 4.4], 0.22), ring2 = mk(0.33, 0.014, [1.4, 2.2, 3.6], 0.22);
  return { g, ring, ring2 };
};

/** the 1947 Radarange: tall white metal cabinet with a porthole door, dials, vents and water pipes; front faces +z */
const radarange = (H = 2.6) => {
  const g = new THREE.Group(), k = H / 2.6;
  build(g, (b) => {
    bx(b, M.iron(), -0.8 * k, 0.8 * k, 0, 0.22 * k, -0.55 * k, 0.55 * k);
    bx(b, M.white(), -0.75 * k, 0.75 * k, 0.22 * k, H, -0.5 * k, 0.5 * k);
    bx(b, M.steel(), -0.79 * k, 0.79 * k, H, H + 0.06 * k, -0.54 * k, 0.54 * k);
    bx(b, M.glassD(), -0.45 * k, 0.45 * k, 1.1 * k, 1.85 * k, 0.5 * k, 0.52 * k);
    bx(b, M.steel(), -0.52 * k, 0.52 * k, 1.04 * k, 1.1 * k, 0.5 * k, 0.54 * k); bx(b, M.steel(), -0.52 * k, 0.52 * k, 1.85 * k, 1.91 * k, 0.5 * k, 0.54 * k);
    bx(b, M.steel(), -0.52 * k, -0.45 * k, 1.04 * k, 1.91 * k, 0.5 * k, 0.54 * k); bx(b, M.steel(), 0.45 * k, 0.52 * k, 1.04 * k, 1.91 * k, 0.5 * k, 0.54 * k);
    bx(b, M.steel(), 0.58 * k, 0.64 * k, 1.2 * k, 1.8 * k, 0.5 * k, 0.6 * k);
    for (let i = 0; i < 6; i++) bx(b, M.iron(), -0.5 * k, 0.5 * k, (2.1 + i * 0.07) * k, (2.14 + i * 0.07) * k, 0.5 * k, 0.53 * k);
    for (const x of [-0.4, 0.4]) b.add(new THREE.CylinderGeometry(0.13 * k, 0.13 * k, 0.1 * k, 16).rotateX(Math.PI / 2), M.red(), M4(x * k, 0.64 * k, 0.55 * k));
    bx(b, M.black(), -0.2 * k, 0.2 * k, 0.55 * k, 0.75 * k, 0.5 * k, 0.53 * k);
    cylY(b, M.copper(), 0.62 * k, 0.1 * k, -0.4 * k, 0.05 * k, H * 1.5, 10);
    cylY(b, M.copper(), 0.45 * k, 0.1 * k, -0.45 * k, 0.05 * k, H * 1.5, 10);
    b.add(beamGeo(V(0.45 * k, H * 0.9, -0.45 * k), V(0.45 * k, H * 0.9, -0.1 * k), 0.07 * k), M.copper(), undefined);
    b.add(beamGeo(V(0.62 * k, H * 0.6, -0.4 * k), V(0.62 * k, H * 0.6, -0.05 * k), 0.07 * k), M.copper(), undefined);
    bx(b, M.blue(), 0.58 * k, 0.66 * k, H * 0.55, H * 0.55 + 0.06, -0.1 * k, 0.4 * k); bx(b, M.red(), 0.4 * k, 0.48 * k, H * 0.85, H * 0.85 + 0.06, -0.15 * k, 0.35 * k);
  });
  return g;
};

export const addMicrowave = (b: Batch, win: THREE.Material, x: number, y: number, z: number, s = 1, yaw = 0) => {
  const m = M4(x, y, z, yaw, [s, s, s]);
  const B = (w: number, h: number, d: number, px: number, py: number, pz: number, mat: THREE.Material) =>
    b.add(new THREE.BoxGeometry(w, h, d), mat, m.clone().multiply(new THREE.Matrix4().makeTranslation(px, py, pz)));
  const Cy = (r: number, h: number, px: number, py: number, pz: number, mat: THREE.Material, rx = Math.PI / 2) =>
    b.add(new THREE.CylinderGeometry(r, r, h, 12).rotateX(rx), mat, m.clone().multiply(new THREE.Matrix4().makeTranslation(px, py, pz)));
  B(0.56, 0.34, 0.4, 0, 0.2, 0, M.cream());                       // body
  B(0.56, 0.02, 0.4, 0, 0.375, 0, M.steel());                     // lid
  for (const sx of [-0.23, 0.23]) for (const sz of [-0.15, 0.15]) Cy(0.025, 0.04, sx, 0.02, sz, M.black(), 0);
  B(0.4, 0.29, 0.035, -0.065, 0.2, 0.2, M.steel());               // door frame (proud of the body)
  B(0.32, 0.21, 0.02, -0.065, 0.2, 0.222, win);                   // window glass
  B(0.02, 0.2, 0.03, 0.12, 0.2, 0.245, M.steel()); B(0.03, 0.025, 0.03, 0.12, 0.3, 0.232, M.steel()); B(0.03, 0.025, 0.03, 0.12, 0.1, 0.232, M.steel()); // handle
  B(0.12, 0.3, 0.014, 0.215, 0.2, 0.205, M.brown());               // control panel
  Cy(0.026, 0.03, 0.215, 0.285, 0.225, M.cream()); Cy(0.026, 0.03, 0.215, 0.2, 0.225, M.cream());
  for (let i = 0; i < 3; i++) B(0.07, 0.022, 0.016, 0.215, 0.13 - i * 0.03, 0.215, M.steel());
  for (let i = 0; i < 5; i++) B(0.3, 0.006, 0.012, 0, 0.386, -0.05 + i * 0.03, M.black());
};
const gasStove = () => grp(null, (b) => {
  bx(b, M.white(), -0.4, 0.4, 0, 0.9, -0.32, 0.32);
  bx(b, M.steel(), -0.42, 0.42, 0.9, 0.94, -0.34, 0.34);
  bx(b, M.glassD(), -0.3, 0.3, 0.2, 0.62, 0.32, 0.335);
  bx(b, M.steel(), -0.32, 0.32, 0.66, 0.7, 0.32, 0.36);
  for (const [x, z] of [[-0.2, -0.1], [0.2, -0.1], [-0.2, 0.15], [0.2, 0.15]]) { cylY(b, M.black(), x, 0.94, z, 0.1, 0.03, 14); cylY(b, M.steel(), x, 0.97, z, 0.045, 0.02, 10); }
  for (let i = 0; i < 4; i++) b.add(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8).rotateX(Math.PI / 2), M.black(), M4(-0.24 + i * 0.16, 0.8, 0.34));
});

/** 1960s ranch house: body, low gable roof, picture window (warm glow when lit), door, garage; front faces the street */
function suburbHouse(b: Batch, x: number, z: number, yaw: number, lit: boolean, idx: number, sc = 1) {
  const walls = ["#e8d9b0", "#cfe0c8", "#e9c9b8", "#d6d9e6", "#ecdf9a", "#f0e6d4"], roofs = ["#7a5a4a", "#5a6a78", "#8a4a3a"];
  const wc = walls[idx % walls.length], rc = roofs[idx % roofs.length];
  const m = M4(x, 0, z, yaw, [sc, sc, sc]), W = 9, D = 6.5, h = 3.0, rh = 1.5;
  b.add(new THREE.BoxGeometry(W, h, D).translate(0, h / 2, 0), C("sw" + wc, wc), m);
  const rm = lam("m_rf" + rc, () => ({ color: rc, side: THREE.DoubleSide }));
  b.add(tri(V(-W / 2 - 0.4, h, D / 2 + 0.5), V(-W / 2 - 0.4, h, -D / 2 - 0.5), V(-W / 2 - 0.4, h + rh, 0)), rm, m);
  b.add(tri(V(W / 2 + 0.4, h, -D / 2 - 0.5), V(W / 2 + 0.4, h, D / 2 + 0.5), V(W / 2 + 0.4, h + rh, 0)), rm, m);
  b.add(quad(V(-W / 2 - 0.4, h - 0.1, D / 2 + 0.5), V(W / 2 + 0.4, h - 0.1, D / 2 + 0.5), V(W / 2 + 0.4, h + rh, 0), V(-W / 2 - 0.4, h + rh, 0)), rm, m);
  b.add(quad(V(W / 2 + 0.4, h - 0.1, -D / 2 - 0.5), V(-W / 2 - 0.4, h - 0.1, -D / 2 - 0.5), V(-W / 2 - 0.4, h + rh, 0), V(W / 2 + 0.4, h + rh, 0)), rm, m);
  const win = lit ? glow([3.4, 2.3, 1.0]) : C("swd", "#2a3248");
  b.add(new THREE.BoxGeometry(2.6, 1.3, 0.1).translate(-2.3, 1.7, D / 2 + 0.02), C("swf", "#f4f0e6"), m);
  b.add(new THREE.BoxGeometry(2.4, 1.1, 0.08).translate(-2.3, 1.7, D / 2 + 0.08), win, m);
  b.add(new THREE.BoxGeometry(0.06, 1.1, 0.06).translate(-2.3, 1.7, D / 2 + 0.12), C("swf", "#f4f0e6"), m);
  b.add(new THREE.BoxGeometry(1.0, 2.1, 0.1).translate(0.4, 1.05, D / 2 + 0.03), C("sdoor" + (idx % 3), ["#b8453a", "#3f6fb5", "#3f8a5a"][idx % 3]), m);
  b.add(new THREE.BoxGeometry(2.6, 2.2, 0.1).translate(2.9, 1.1, D / 2 + 0.03), C("sgar", "#e9e4d8"), m);
  for (let k = 1; k < 4; k++) b.add(new THREE.BoxGeometry(2.6, 0.04, 0.04).translate(2.9, k * 0.55, D / 2 + 0.09), C("swf", "#f4f0e6"), m);
  b.add(new THREE.BoxGeometry(3.4, 0.02, 4.0).translate(2.9, 0.04, D / 2 + 2.2), C("drive", "#9a9588"), m);
  b.add(new THREE.BoxGeometry(1.4, 0.02, 3.0).translate(0.4, 0.05, D / 2 + 1.6), C("drive", "#9a9588"), m);
  b.add(new THREE.BoxGeometry(0.7, 1.6, 0.7).translate(-3, h + 1.2, -1), C("schim", "#a0583f"), m);
  // second lit window (kitchen), shutters, shrubs and a porch lamp so the facade reads as a home
  b.add(new THREE.BoxGeometry(0.9, 0.9, 0.08).translate(-4.15, 1.8, D / 2 + 0.07), win, m);
  b.add(new THREE.BoxGeometry(1.0, 0.1, 0.12).translate(-4.15, 1.25, D / 2 + 0.08), C("swf", "#f4f0e6"), m);
  for (const sx of [-3.7, -0.9]) b.add(new THREE.BoxGeometry(0.25, 1.3, 0.06).translate(sx, 1.7, D / 2 + 0.07), C("shut" + (idx % 2), idx % 2 ? "#3f6a4a" : "#5a6a9a"), m);
  for (const sx of [-3.2, -1.5, 1.35]) b.add(new THREE.SphereGeometry(0.55, 10, 8).scale(1.2, 0.8, 1), C("shrub", "#3f7a3f"), m.clone().multiply(new THREE.Matrix4().makeTranslation(sx, 0.4, D / 2 + 0.7)));
  b.add(new THREE.SphereGeometry(0.14, 8, 6).translate(1.15, 2.2, D / 2 + 0.2), glow([5, 3.8, 1.8]), m);
  b.add(new THREE.PlaneGeometry(4.2, 1.8).rotateX(-Math.PI / 2).translate(-2.3, 0.07, D / 2 + 1.4), lit ? glow([1.15, 0.78, 0.32]) : C("swd", "#3a4a38"), m);
}

// ---------------- the world ----------------
export const buildSets = (root: THREE.Object3D, kit: Kit): SetBuild => {
  const groups = {} as Record<SetId, THREE.Group>;
  for (const id of ["lab", "factory", "plant", "kitchen", "suburb", "showroom", "yard"] as SetId[]) { groups[id] = new THREE.Group(); groups[id].visible = false; root.add(groups[id]); }
  const sunWin = glow([2.6, 2.7, 3.0]);

  const mg = magnetron(); root.add(mg.g); mg.g.visible = false;

  // ======== 1. radar lab / workshop ========
  let radarScreen: THREE.MeshBasicMaterial;
  const dishSpin = new THREE.Group();
  {
    const G = groups.lab, X = 9, Z0 = -6, Z1 = 10, H = 4.6;
    const wall = M.wallL(), peg = lam("m_peg", () => ({ map: pegTex() }));
    build(G, (b) => {
      b.add(flatRect(-X, X, Z0, Z1, 0, 2), plankM());
      b.add(groundQuad(300, 8, -0.06), C("grass", "#7ba85d"));
      bx(b, wall, -X, 3.6, 0, H, Z0 - 0.3, Z0); bx(b, wall, 7.8, X, 0, H, Z0 - 0.3, Z0); bx(b, wall, 3.6, 7.8, 0, 1.3, Z0 - 0.3, Z0); bx(b, wall, 3.6, 7.8, 3.7, H, Z0 - 0.3, Z0);
      bx(b, wall, -X - 0.3, -X, 0, H, Z0, Z1); bx(b, wall, X, X + 0.3, 0, H, Z0, Z1);
      bx(b, M.woodDk(), 3.5, 7.9, 1.2, 1.3, Z0 - 0.1, Z0 + 0.15); bx(b, M.woodDk(), 3.5, 3.6, 1.3, 3.7, Z0 - 0.1, Z0 + 0.1); bx(b, M.woodDk(), 7.8, 7.9, 1.3, 3.7, Z0 - 0.1, Z0 + 0.1);
      bx(b, M.woodDk(), 3.5, 7.9, 3.7, 3.8, Z0 - 0.1, Z0 + 0.1); bx(b, M.woodDk(), 5.65, 5.75, 1.3, 3.7, Z0 - 0.05, Z0 + 0.05); bx(b, M.woodDk(), 3.6, 7.8, 2.5, 2.58, Z0 - 0.05, Z0 + 0.05);
      b.add(quad(V(-8.6, 0.9, Z0 + 0.02), V(3.2, 0.9, Z0 + 0.02), V(3.2, 3.5, Z0 + 0.02), V(-8.6, 3.5, Z0 + 0.02), 4.5, 1), peg);
      cylY(b, M.steel(), 5.7, 0, -15, 0.35, 8.2, 8, 0.2);
      for (let i = 0; i < 6; i++) b.add(beamGeo(V(5.7 - 0.4, i * 1.4, -15), V(5.7 + 0.4, i * 1.4 + 1.4, -15), 0.07), M.steel(), undefined);
      bx(b, M.iron(), 5.2, 6.2, 8.1, 8.4, -15.5, -14.5);
      for (const y of [1.2, 2.0, 2.8]) bx(b, M.woodDk(), -X, -X + 0.6, y, y + 0.06, -4, 6);
      for (let i = 0; i < 14; i++) box(b, [C("bxA", "#b5653f"), C("bxB", "#d9b04a"), C("bxC", "#5a7a9a")][i % 3], -X + 0.32, 1.26 + (i % 3) * 0.8, -3.6 + (i % 5) * 1.9 + Math.floor(i / 5) * 0.2, 0.4, 0.4, 0.5);
      bx(b, M.woodLt(), -8.4, 3.2, 0.9, 0.97, -5.9, -4.6);
      for (const x of [-8.3, -4.5, -0.5, 3.1]) bx(b, M.woodDk(), x, x + 0.15, 0, 0.9, -5.85, -4.65);
      for (const x of [-7.2, -2.6]) { box(b, M.iron(), x, 0.97, -5.3, 0.7, 0.45, 0.5); disc(b, glow([0.5, 2.4, 0.9]), x, 1.2, -5.04, 0.16, 0.02); }
      for (let i = 0; i < 5; i++) b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 10).translate(0, 0.09, 0), C("glassT", "#cfe4ee"), M4(-5.6 + i * 0.16, 0.97, -5.2));
      box(b, M.red(), -4.2, 0.97, -5.1, 0.5, 0.2, 0.25); box(b, M.green(), -1.4, 0.97, -5.2, 0.4, 0.3, 0.3);
      b.add(new THREE.TorusGeometry(0.18, 0.04, 6, 14).rotateX(Math.PI / 2).translate(0, 0.04, 0), M.copper(), M4(-3.2, 0.97, -5.2));
      bx(b, M.woodLt(), -0.2, 3.6, 0.9, 0.97, -3.1, -2.0);
      for (const [x, z] of [[-0.1, -3.0], [3.45, -3.0], [-0.1, -2.1], [3.45, -2.1]]) bx(b, M.woodDk(), x, x + 0.15, 0, 0.9, z - 0.05, z + 0.05);
      bx(b, M.woodDk(), -0.1, 3.5, 0.3, 0.34, -3.0, -2.1);
      box(b, M.steel(), 0.3, 0.97, -2.5, 0.4, 0.14, 0.3); box(b, M.iron(), 3.0, 0.97, -2.7, 0.3, 0.2, 0.25);
      b.add(beamGeo(V(2.6, 4.6, -2.5), V(2.6, 2.7, -2.5), 0.03), M.iron(), undefined);
      b.add(new THREE.ConeGeometry(0.4, 0.3, 14, 1, true).translate(0, 0.15, 0), lam("m_shade", () => ({ color: "#3f6a4a", side: THREE.DoubleSide })), M4(2.6, 2.45, -2.5));
      b.add(new THREE.SphereGeometry(0.1, 10, 8).translate(2.6, 2.5, -2.5), glow([5, 3.6, 1.6]));
      box(b, C("radarC", "#7d8a82"), RADAR_CAB[0], 0, RADAR_CAB[2], 1.0, 1.95, 0.75);
      bx(b, M.iron(), RADAR_CAB[0] - 0.55, RADAR_CAB[0] + 0.55, 1.95, 2.0, RADAR_CAB[2] - 0.4, RADAR_CAB[2] + 0.4);
      for (let i = 0; i < 5; i++) bx(b, M.iron(), RADAR_CAB[0] - 0.35, RADAR_CAB[0] + 0.35, 0.2 + i * 0.07, 0.24 + i * 0.07, RADAR_CAB[2] + 0.375, RADAR_CAB[2] + 0.4);
      for (const dx of [-0.3, 0, 0.3]) b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10).rotateX(Math.PI / 2), M.brass(), M4(RADAR_CAB[0] + dx, 0.85, RADAR_CAB[2] + 0.4));
      cylY(b, M.steel(), -6.6, 0, -3.0, 0.05, 1.2, 8);
      for (const a of [0, 2.1, 4.2]) b.add(beamGeo(V(-6.6, 1.0, -3.0), V(-6.6 + Math.cos(a) * 0.5, 0, -3.0 + Math.sin(a) * 0.5), 0.04), M.steel(), undefined);
      bx(b, M.woodLt(), 4.8, 6.8, 0.74, 0.8, -2.2, -1.1);
      bx(b, M.woodDk(), 4.8, 6.8, 0.0, 0.74, -1.14, -1.1); bx(b, M.woodDk(), 4.8, 4.86, 0.0, 0.74, -2.2, -1.1); bx(b, M.woodDk(), 6.74, 6.8, 0.0, 0.74, -2.2, -1.1);
      box(b, C("paper", "#f4f0e6"), 5.3, 0.8, -1.7, 0.3, 0.07, 0.22); box(b, M.green(), 6.4, 0.8, -1.6, 0.25, 0.1, 0.2);
      cylY(b, M.iron(), 6.3, 0.8, -1.95, 0.06, 0.04, 10); b.add(beamGeo(V(6.3, 0.84, -1.95), V(6.1, 1.25, -1.9), 0.025), M.iron(), undefined);
      b.add(new THREE.SphereGeometry(0.07, 10, 8).translate(6.05, 1.25, -1.88), glow([5, 3.8, 1.8]));
      crate(b, M.woodLt(), -8.3, 0, 4.0, 0.8); crate(b, M.woodLt(), -8.3, 0, 4.9, 0.8, 0.2); crate(b, M.woodLt(), -8.3, 0.8, 4.4, 0.7, 0.3);
    });
    radarScreen = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.4, 0.8) });
    build(G, (b) => { b.add(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20).rotateX(Math.PI / 2), radarScreen, M4(RADAR_CAB[0], 1.45, RADAR_CAB[2] + 0.385)); });
    // ceiling: plaster deck, wooden beams, hanging lamps (no open sky indoors); the window on the right shows daylight through glass
    build(G, (b) => {
      bx(b, C("ceilL", "#d6c9ad"), -X - 0.3, X + 0.3, H, H + 0.4, Z0 - 0.3, Z1);
      for (let z = -4.8; z < Z1; z += 2.6) bx(b, M.woodDk(), -X, X, H - 0.32, H, z - 0.16, z + 0.16);
      bx(b, M.woodDk(), -X, X, H - 0.32, H, Z0, Z0 + 0.25);
      for (const lx of [-3.2, 6.0]) {
        b.add(beamGeo(V(lx, H, -2.5), V(lx, H - 1.9, -2.5), 0.03), M.iron(), undefined);
        b.add(new THREE.ConeGeometry(0.4, 0.3, 14, 1, true).translate(0, 0.15, 0), lam("m_shade", () => ({ color: "#3f6a4a", side: THREE.DoubleSide })), M4(lx, H - 2.15, -2.5));
        b.add(new THREE.SphereGeometry(0.1, 10, 8).translate(lx, H - 2.1, -2.5), glow([5, 3.6, 1.6]));
      }
      b.add(quad(V(3.62, 1.32, Z0 + 0.05), V(7.78, 1.32, Z0 + 0.05), V(7.78, 3.68, Z0 + 0.05), V(3.62, 3.68, Z0 + 0.05)), glow([2.2, 2.3, 2.5]));
    }, false);
  }

  // ======== 2. factory floor (closed roof: dark deck, trusses, hanging lamps; clerestory windows show daylight) ========
  const beltCrates = new THREE.Group(), stacks: THREE.Group[] = [], pieceRows: THREE.Group[] = [];
  {
    const G = groups.factory, X = 30, Z0 = -42, Z1 = 16, H = 5.8;
    const wood = () => C("crateL", "#c9985f"), woodB = () => C("crateD", "#a67a45");
    const magUnit = (b: Batch, x: number, y: number, z: number, k = 1) => {
      cylY(b, M.copper(), x, y, z, 0.1 * k, 0.2 * k, 14); for (let i = 0; i < 5; i++) cylY(b, M.copperDk(), x, y + (0.03 + i * 0.034) * k, z, 0.15 * k, 0.014 * k, 16);
      cylY(b, M.brass(), x, y + 0.2 * k, z, 0.03 * k, 0.07 * k, 8); box(b, M.iron(), x + 0.14 * k, y + 0.04 * k, z, 0.06 * k, 0.1 * k, 0.12 * k); box(b, M.iron(), x - 0.2 * k, y + 0.04 * k, z, 0.06 * k, 0.1 * k, 0.12 * k);
    };
    build(G, (b) => {
      b.add(flatRect(-X, X, Z0, Z1, 0, 4), slabM());
      const wall = C("fwall", "#cfd3c9");
      bx(b, wall, -X - 0.4, -X, 0, H, Z0, Z1); bx(b, wall, X, X + 0.4, 0, H, Z0, Z1); bx(b, wall, -X, X, 0, H, Z0 - 0.4, Z0);
      bx(b, C("fbase", "#6f7f6a"), -X, X, 0, 1.2, Z0, Z0 + 0.1);
      for (let x = -X + 4; x < X; x += 8) for (const z of [-34, -18, -2, 12]) bx(b, M.iron(), x - 0.2, x + 0.2, 0, H, z - 0.2, z + 0.2);
      // clerestory windows (daylight through glass) and sills
      for (let x = -X + 2; x < X; x += 5) bx(b, sunWin, x, x + 3, 3.3, 5.0, Z0 + 0.1, Z0 + 0.15);
      for (const s2 of [-1, 1]) for (let z = -38; z < 14; z += 6) bx(b, sunWin, s2 * (X - 0.05) - 0.025, s2 * (X - 0.05) + 0.025, 3.3, 5.0, z, z + 3);
      for (const z of [-2.4, -13.4]) {
        bx(b, M.woodLt(), -23.5, -9.0, 0.88, 0.95, z - 0.45, z + 0.45);
        for (let x = -23.3; x < -9; x += 3.6) bx(b, M.woodDk(), x, x + 0.12, 0, 0.88, z - 0.4, z + 0.4);
        bx(b, M.woodDk(), -23.5, -9.0, 0.3, 0.34, z - 0.4, z + 0.4);
      }
      for (const x of HAND_X) magUnit(b, x + 0.12, 0.95, -2.45, 1.5);
      for (let i = 0; i < 6; i++) magUnit(b, -22.5 + i * 2.2, 0.95, -13.4, 1.0);
      for (const dx of [-2.2, 2.2]) bx(b, M.iron(), SHELF[0] + dx - 0.05, SHELF[0] + dx + 0.05, 0, 2.7, SHELF[2] - 0.25, SHELF[2] + 0.25);
      for (let l = 0; l < 5; l++) bx(b, M.woodLt(), SHELF[0] - 2.25, SHELF[0] + 2.25, 0.4 + l * 0.5, 0.45 + l * 0.5, SHELF[2] - 0.3, SHELF[2] + 0.3);
      bx(b, M.woodDk(), SHELF[0] - 2.2, SHELF[0] + 2.2, 0.4, 2.7, SHELF[2] - 0.3, SHELF[2] - 0.27);
      bx(b, C("belt", "#2f3036"), BELT_X - 0.55, BELT_X + 0.55, 0.78, 0.84, -30, 13);
      bx(b, M.steel(), BELT_X - 0.62, BELT_X - 0.55, 0.7, 0.98, -30, 13); bx(b, M.steel(), BELT_X + 0.55, BELT_X + 0.62, 0.7, 0.98, -30, 13);
      for (let z = 12; z > -30; z -= 4) { bx(b, M.iron(), BELT_X - 0.6, BELT_X - 0.5, 0, 0.78, z, z + 0.15); bx(b, M.iron(), BELT_X + 0.5, BELT_X + 0.6, 0, 0.78, z, z + 0.15); }
      bx(b, C("beltbox", "#d9b04a"), BELT_X - 3.0, BELT_X - 1.8, 0, 1.4, -31, -28);
      for (const [x, z] of [[-4, 8], [4, 10], [18, 9], [-3, -22]] as const) b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 12).translate(0, 0.45, 0), C("drum", "#3f6fb5"), M4(x, 0, z));
    });
    // roof: dark deck, steel trusses with diagonal bracing, ducts, hanging lamps with shades (does not cast: the sun still reaches the floor)
    build(G, (b) => {
      const deck = C("roofDeck", "#363944"), girder = C("girder", "#4a5062");
      bx(b, deck, -X - 0.4, X + 0.4, H, H + 0.4, Z0 - 0.4, Z1 + 0.3);
      for (let x = -X + 2; x < X; x += 4) bx(b, girder, x - 0.09, x + 0.09, H - 0.45, H, Z0, Z1);
      for (const z of [-38, -26, -14, -2, 10]) {
        bx(b, girder, -X, X, H - 0.9, H - 0.7, z - 0.18, z + 0.18); bx(b, girder, -X, X, H - 0.2, H, z - 0.18, z + 0.18);
        for (let x = -X; x < X; x += 3) { b.add(beamGeo(V(x, H - 0.8, z), V(x + 1.5, H - 0.1, z), 0.09), girder, undefined); b.add(beamGeo(V(x + 1.5, H - 0.1, z), V(x + 3, H - 0.8, z), 0.09), girder, undefined); }
      }
      bx(b, C("duct", "#7d8794"), -X, X, H - 1.5, H - 1.1, -8.4, -7.8); bx(b, C("duct", "#7d8794"), -X, X, H - 1.5, H - 1.1, -30.4, -29.8);
      for (let x = -24; x <= 24; x += 8) for (const z of [-30, -12, 4]) {
        b.add(beamGeo(V(x, H - 0.2, z), V(x, H - 1.45, z), 0.03), M.iron(), undefined);
        b.add(new THREE.ConeGeometry(0.62, 0.4, 14, 1, true).translate(0, 0.2, 0), lam("m_fshade", () => ({ color: "#2f6a4a", side: THREE.DoubleSide })), M4(x, H - 1.85, z));
        b.add(new THREE.SphereGeometry(0.16, 10, 8).translate(x, H - 1.78, z), glow([5, 4.4, 3.2]));
      }
    }, false);
    build(beltCrates, (b) => { for (let i = 0; i < 30; i++) magUnit(b, BELT_X, 0.84, 12.4 - i * 1.4, 1.2); });
    G.add(beltCrates);
    for (let k = 0; k < 12; k++) {
      const g = new THREE.Group(), x = 18.6 + (k % 3) * 1.6, z = -0.5 - Math.floor(k / 3) * 1.7, n = 4 + (k % 3);
      build(g, (b) => { for (let i = 0; i < n; i++) { crate(b, i % 2 ? woodB() : wood(), x, i * 0.62, z, 0.62, 0.12 * ((k + i) % 3)); if (i < 2) crate(b, i % 2 ? wood() : woodB(), x + 0.66, i * 0.62, z, 0.62); } });
      g.visible = false; G.add(g); stacks.push(g);
    }
    for (let r = 0; r < 10; r++) {
      const g = new THREE.Group(), lvl = Math.floor(r / 2), half = r % 2;
      build(g, (b) => { for (let i = 0; i < 3; i++) magUnit(b, SHELF[0] - 1.8 + half * 2.2 + i * 0.62, 0.45 + lvl * 0.5, SHELF[2] + 0.05, 0.9); }, false);
      g.visible = false; G.add(g); pieceRows.push(g);
    }
  }

  // ======== 3. factory exterior ========
  {
    const G = groups.plant, bz = -14;
    build(G, (b) => {
      b.add(groundQuad(300, 6), C("asph", "#6d6d74"));
      bx(b, C("walk", "#c8c2b4"), -60, 60, 0.02, 0.18, -8, -4);
      bx(b, C("lawn", "#6fa352"), -60, 60, 0.0, 0.1, -12, -8);
      bx(b, C("lawn", "#6fa352"), -60, 60, 0.0, 0.1, -60, -12);
      b.add(boxGeo(V(-24, 0, bz - 12), V(24, 15, bz), 3), brickM());
      bx(b, C("cornice", "#d9d0bc"), -24.3, 24.3, 15, 15.7, bz - 12, bz + 0.3);
      bx(b, C("cornice", "#d9d0bc"), -24.3, 24.3, 5.1, 5.35, bz - 12, bz + 0.2); bx(b, C("cornice", "#d9d0bc"), -24.3, 24.3, 10.2, 10.45, bz - 12, bz + 0.2);
      for (let f = 0; f < 3; f++) for (let i = 0; i < 12; i++) {
        const x = -21.5 + i * 3.9; if (Math.abs(x) < 3.5 && f === 0) continue;
        const lit = (i * 7 + f * 3) % 5 === 0;
        bx(b, M.white(), x - 1.0, x + 1.0, 1.4 + f * 5.1 - 0.15, 1.4 + f * 5.1 + 3.2, bz + 0.02, bz + 0.1);
        bx(b, lit ? glow([2.6, 2.1, 1.1]) : C("glass", "#8fb6d8"), x - 0.85, x + 0.85, 1.4 + f * 5.1, 1.4 + f * 5.1 + 3.0, bz + 0.1, bz + 0.13);
        bx(b, M.white(), x - 0.05, x + 0.05, 1.4 + f * 5.1, 1.4 + f * 5.1 + 3.0, bz + 0.13, bz + 0.16); bx(b, M.white(), x - 0.85, x + 0.85, 1.4 + f * 5.1 + 1.45, 1.4 + f * 5.1 + 1.55, bz + 0.13, bz + 0.16);
      }
      bx(b, C("steps", "#cfc8b8"), -5, 5, 0, 0.3, bz, bz + 3.0); bx(b, C("steps", "#cfc8b8"), -4.5, 4.5, 0.3, 0.6, bz, bz + 2.2);
      for (const x of [-4, -1.9, 1.9, 4]) b.add(new THREE.CylinderGeometry(0.4, 0.45, 5.4, 14).translate(x, 3.3, bz + 1.9), C("col", "#e8e1d0"));
      bx(b, C("col", "#e8e1d0"), -4.8, 4.8, 6.0, 6.8, bz + 0.2, bz + 2.4);
      b.add(tri(V(-4.8, 6.8, bz + 2.4), V(4.8, 6.8, bz + 2.4), V(0, 8.6, bz + 2.4)), C("col", "#e8e1d0"));
      b.add(quad(V(-1.6, 7.0, bz + 2.42), V(1.6, 7.0, bz + 2.42), V(1.6, 9.4, bz + 2.42), V(-1.6, 9.4, bz + 2.42)), lam("m_emblem", () => ({ map: emblemTex() })));
      bx(b, C("doorD", "#2c2a30"), -2.2, 2.2, 0.6, 4.6, bz + 0.05, bz + 0.2);
      bx(b, C("glass", "#8fb6d8"), -2.0, -0.1, 0.8, 4.4, bz + 0.2, bz + 0.25); bx(b, C("glass", "#8fb6d8"), 0.1, 2.0, 0.8, 4.4, bz + 0.2, bz + 0.25);
      b.add(boxGeo(V(24, 0, bz - 10), V(48, 8, bz - 1), 3), brickM());
      for (let i = 0; i < 4; i++) { const x0 = 24 + i * 6; b.add(tri(V(x0, 8, bz - 1), V(x0 + 6, 8, bz - 1), V(x0 + 6, 12, bz - 1)), C("roofS", "#8a5a4a")); b.add(quad(V(x0, 8, bz - 10), V(x0 + 6, 12, bz - 10), V(x0 + 6, 12, bz - 1), V(x0, 8, bz - 1)), lam("m_roofS2", () => ({ color: "#8a5a4a", side: THREE.DoubleSide }))); }
      for (let i = 0; i < 6; i++) bx(b, sunWin, 25 + i * 3.8, 27 + i * 3.8, 2.2, 5.4, bz + 0.02, bz + 0.06);
      cylY(b, brickM(), -34, 0, bz - 6, 1.4, 30, 14, 1.0);
      for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) b.add(beamGeo(V(34 + dx, 0, bz - 16 + dz), V(34 + dx * 0.8, 9, bz - 16 + dz * 0.8), 0.15), M.iron(), undefined);
      cylY(b, C("tank", "#9aa7b3"), 34, 9, bz - 16, 2.6, 4, 16); b.add(new THREE.ConeGeometry(2.8, 1.4, 16).translate(34, 13.7, bz - 16), C("tank", "#9aa7b3"));
      cylY(b, M.steel(), 9, 0, -6, 0.08, 9, 8);
      for (let i = 0; i < 5; i++) bx(b, i % 2 ? M.white() : M.red(), 9.1, 11.6, 8.8 - i * 0.28, 8.8 - i * 0.28 + 0.28, -6.02, -5.98);
      bx(b, M.blue(), 9.1, 10.3, 7.96, 8.8, -6.04, -5.96);
      for (let x = -40; x <= 40; x += 2) { if (Math.abs(x) < 6) continue; bx(b, M.iron(), x - 0.04, x + 0.04, 0, 1.4, -8.4, -8.3); }
      bx(b, M.iron(), -40, -6, 1.2, 1.26, -8.4, -8.3); bx(b, M.iron(), 6, 40, 1.2, 1.26, -8.4, -8.3);
      for (const x of [-12, 12, -26, 26]) { cylY(b, M.iron(), x, 0, -5, 0.07, 4.5, 8); b.add(new THREE.SphereGeometry(0.22, 10, 8).translate(x, 4.6, -5), glow([4, 3.6, 2.6])); }
      for (const [x, c] of [[-14, "#c0392f"], [16, "#3f6fb5"], [-30, "#e0b83a"]] as const) {
        box(b, C("car" + c, c), x, 0.25, 4, 3.8, 0.7, 1.6); box(b, C("car" + c, c), x - 0.2, 0.9, 4, 2.0, 0.6, 1.4);
        for (const dx of [-1.2, 1.2]) for (const dz of [-0.8, 0.8]) b.add(new THREE.CylinderGeometry(0.33, 0.33, 0.2, 12).rotateX(Math.PI / 2), M.black(), M4(x + dx, 0.33, 4 + dz));
      }
    });
    const tb = new Batch();
    for (const [x, z, h] of [[-8.6, -10, 5], [8.6, -10, 5.5], [-19, -10, 4.6], [19, -10, 5], [-36, -10, 5], [30, -10, 5]] as const) prop(tb, kit, "tree_oak", x, 0, z, h);
    tb.build(G, true);
  }

  // ======== 4. 1960s kitchen (+ corridor outside the door) ========
  const rangeK = radarange(2.6);
  let kmwGlow: THREE.MeshBasicMaterial; const kmw = new THREE.Group();
  {
    const G = groups.kitchen, X = 3.6, Z0 = -3, Z1 = 5, H = 2.9, XL = -9;
    const wall = lam("m_kwall", () => ({ map: stripeTex() })), floor = lam("m_kfloor", () => ({ map: kfloorTex() }));
    const turq = C("turq", "#6fc1b4"), formica = C("formica", "#f1e8d2");
    build(G, (b) => {
      b.add(flatRect(XL, X, Z0, Z1, 0, 1.6), floor);
      b.add(groundQuad(300, 8, -0.06), C("grass", "#7ba85d"));
      bx(b, wall, XL, -2.4, 0, H, Z0 - 0.3, Z0); bx(b, wall, -0.7, X, 0, H, Z0 - 0.3, Z0); bx(b, wall, -2.4, -0.7, 0, 1.35, Z0 - 0.3, Z0); bx(b, wall, -2.4, -0.7, 2.45, H, Z0 - 0.3, Z0);
      bx(b, M.white(), -2.5, -0.6, 1.3, 1.35, Z0 - 0.1, Z0 + 0.12); bx(b, M.white(), -2.5, -0.6, 2.45, 2.5, Z0 - 0.1, Z0 + 0.12); bx(b, M.white(), -2.5, -2.4, 1.35, 2.45, Z0 - 0.1, Z0 + 0.12); bx(b, M.white(), -0.7, -0.6, 1.35, 2.45, Z0 - 0.1, Z0 + 0.12); bx(b, M.white(), -1.58, -1.52, 1.35, 2.45, Z0 - 0.05, Z0 + 0.1);
      for (const s of [-1, 1]) b.add(quad(V(-1.55 + s * 1.3, 1.2, Z0 + 0.16), V(-1.55 + s * 0.75, 1.2, Z0 + 0.16), V(-1.55 + s * 0.75, 2.6, Z0 + 0.16), V(-1.55 + s * 1.3, 2.6, Z0 + 0.16)), lam("m_curt", () => ({ color: "#e0584a", side: THREE.DoubleSide })));
      bx(b, wall, X, X + 0.3, 0, H, Z0, Z1);
      const d0 = DOOR_Z - 0.45, d1 = DOOR_Z + 0.45;
      bx(b, wall, -X - 0.3, -X, 0, H, Z0, d0); bx(b, wall, -X - 0.3, -X, 0, H, d1, Z1); bx(b, wall, -X - 0.3, -X, 2.1, H, d0, d1);
      bx(b, M.white(), -X - 0.34, -X + 0.06, 0, 2.14, d0 - 0.08, d0); bx(b, M.white(), -X - 0.34, -X + 0.06, 0, 2.14, d1, d1 + 0.08); bx(b, M.white(), -X - 0.34, -X + 0.06, 2.1, 2.2, d0 - 0.08, d1 + 0.08);
      bx(b, C("corr", "#cfe0d6"), XL - 0.3, XL, 0, H, Z0, Z1); bx(b, C("corr", "#cfe0d6"), XL, -X - 0.3, 0, H, Z0 - 0.3, Z0);
      bx(b, turq, -X, 2.35, 0.1, 0.9, Z0, Z0 + 0.65); bx(b, formica, -X, 2.35, 0.9, 0.95, Z0, Z0 + 0.7); bx(b, M.steel(), -X, 2.35, 0.95, 0.97, Z0 + 0.68, Z0 + 0.72);
      for (let x = -3.3; x < 2.3; x += 0.7) { bx(b, C("tdoor", "#5aa89c"), x, x + 0.64, 0.14, 0.86, Z0 + 0.65, Z0 + 0.69); b.add(new THREE.BoxGeometry(0.1, 0.03, 0.03), M.steel(), M4(x + 0.32, 0.7, Z0 + 0.72)); }
      bx(b, M.steel(), -2.2, -0.9, 0.95, 1.0, Z0 + 0.08, Z0 + 0.55);
      cylY(b, M.steel(), -1.55, 0.97, Z0 + 0.12, 0.025, 0.3, 8);
      for (const [x0, x1] of [[0.6, 1.5], [1.55, 2.35]]) { bx(b, turq, x0, x1, 1.5, 2.4, Z0, Z0 + 0.35); b.add(new THREE.BoxGeometry(0.03, 0.2, 0.03), M.steel(), M4((x0 + x1) / 2, 1.7, Z0 + 0.37)); }
      bx(b, C("fridge", "#e4efe6"), 2.4, 3.5, 0, 1.95, Z0 + 0.02, Z0 + 0.82); bx(b, M.steel(), 2.45, 2.5, 1.0, 1.7, Z0 + 0.82, Z0 + 0.88); bx(b, M.steel(), 2.45, 2.5, 0.25, 0.9, Z0 + 0.82, Z0 + 0.88); bx(b, M.iron(), 2.4, 3.5, 0.97, 1.0, Z0 + 0.8, Z0 + 0.83);
      cylY(b, M.red(), 2.6, 0, 1.6, 0.4, 0.75, 14); cylY(b, M.red(), 2.6, 0.75, 1.6, 0.5, 0.05, 18);
      b.add(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 18).rotateX(Math.PI / 2), M.white(), M4(0.2, 2.35, Z0 + 0.02));
      b.add(new THREE.TorusGeometry(0.2, 0.025, 6, 18), M.red(), M4(0.2, 2.35, Z0 + 0.03));
      suburbHouse(b, 0, -24, 0, true, 5);
      b.add(groundQuad(40, 6, -0.04), C("lawn", "#6fa352"));
    });
    kmwGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.8) });
    build(kmw, (b) => { addMicrowave(b, kmwGlow, 0, 0, 0, 1.1, 0); });
    kmw.position.set(KMW[0], KMW[1], KMW[2]); G.add(kmw);
    build(G, (b) => {
      // left wall (the doorway wall): wall cabinets, clock, a chair and a small table so it reads as an ordinary kitchen
      for (const [z0, z1] of [[-2.9, -1.6], [-1.5, -0.4]] as const) { bx(b, turq, -X, -X + 0.38, 1.55, 2.45, z0, z1); b.add(new THREE.BoxGeometry(0.03, 0.2, 0.03), M.steel(), M4(-X + 0.4, 2.0, (z0 + z1) / 2)); }
      b.add(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 20).rotateZ(Math.PI / 2), M.white(), M4(-X + 0.03, 2.45, 2.1));
      b.add(new THREE.TorusGeometry(0.24, 0.03, 8, 20).rotateY(Math.PI / 2), M.red(), M4(-X + 0.05, 2.45, 2.1));
      bx(b, M.black(), -X + 0.05, -X + 0.09, 2.45, 2.7, 2.08, 2.12); bx(b, M.black(), -X + 0.05, -X + 0.09, 2.43, 2.47, 2.1, 2.3);
      for (const [x, z] of [[-2.4, 2.35], [-1.3, 2.35]] as const) { bx(b, M.woodLt(), x - 0.25, x + 0.25, 0.42, 0.46, z - 0.25, z + 0.25); for (const [dx, dz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) bx(b, M.woodDk(), x + dx - 0.02, x + dx + 0.02, 0, 0.42, z + dz - 0.02, z + dz + 0.02); bx(b, M.woodLt(), x - 0.25, x + 0.25, 0.44, 0.95, z + 0.2, z + 0.25); }
      bx(b, formica, -2.7, -1.0, 0.7, 0.76, 2.0, 2.7);
    });
    build(G, (b) => {
      bx(b, C("kceil", "#f1ead6"), XL - 0.3, X + 0.3, H, H + 0.4, Z0 - 0.3, Z1);
      bx(b, M.woodDk(), -X, X, H - 0.2, H, Z0, Z0 + 0.2);
      b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 20).translate(0, -0.06, 0), glow([3.2, 2.9, 2.2]), M4(0.2, H, 0.5));
      b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 20).translate(0, -0.06, 0), glow([3.2, 2.9, 2.2]), M4(-6.2, H, 0.85));
    }, false);
    rangeK.rotation.y = Math.PI / 2; rangeK.position.set(-4.35, 0, DOOR_Z); G.add(rangeK);
    const tb = new Batch(); prop(tb, kit, "tree_oak", 5, 0, -22, 6); prop(tb, kit, "tree_oak", -12, 0, -20, 5.5); tb.build(G, true);
  }

  // ======== 5. suburb at dusk: big ranch houses close to the road, lit picture windows ========
  {
    const G = groups.suburb;
    build(G, (b) => {
      b.add(groundQuad(300, 8, -0.04), C("lawn2", "#5f8f4a"));
      bx(b, C("asph2", "#55565e"), -4.2, 4.2, 0, 0.04, -160, 40);
      bx(b, C("walk", "#b9b3a6"), -5.4, -4.2, 0, 0.1, -160, 40); bx(b, C("walk", "#b9b3a6"), 4.2, 5.4, 0, 0.1, -160, 40);
      for (let z = 38; z > -160; z -= 6) bx(b, C("dash", "#e8d36a"), -0.08, 0.08, 0.045, 0.05, z, z + 2.6);
      const sc = 1.0;
      for (let i = 0; i < 18; i++) for (const side of [-1, 1]) {
        const z = 24 - i * 10 + (side > 0 ? 2 : 0);
        const lit = !((side < 0 && i === 7) || (side > 0 && i === 11));
        suburbHouse(b, side * (6.6 + 3.25 * sc), z, side < 0 ? Math.PI / 2 : -Math.PI / 2, lit, i + (side > 0 ? 3 : 0), sc);
      }
      for (let i = 0; i < 14; i++) for (const side of [-1, 1]) {
        const z = 8 - i * 13.5;
        cylY(b, M.iron(), side * 4.9, 0, z, 0.06, 4.4, 8);
        b.add(new THREE.SphereGeometry(0.22, 10, 8).translate(side * 4.9, 4.55, z), glow([4, 3.2, 1.8]));
      }
    });
    const tb = new Batch();
    for (let i = 0; i < 14; i++) for (const side of [-1, 1]) if ((i + (side > 0 ? 1 : 0)) % 2 === 0) prop(tb, kit, "tree_oak", side * 6.3, 0, 8 - i * 13.5 - 3.5, 4.2 + (i % 3) * 0.6);
    tb.build(G, true);
  }

  // ======== 6. showroom stage (closed room: side walls, ceiling with lamps) ========
  const range = radarange(3.0), scene12 = new THREE.Group(), podium = new THREE.Group(), pileLayers: THREE.Group[] = [];
  let stove: THREE.Group;
  {
    const G = groups.showroom;
    build(G, (b) => {
      b.add(flatRect(-20, 20, -9, 14, 0, 2.4), plankM());
      bx(b, C("swall", "#e9e1cf"), -20, 20, 0, 6.5, -9.4, -9);
      bx(b, C("swall", "#e9e1cf"), -9.4, -9, 0, 6.5, -9.4, 14); bx(b, C("swall", "#e9e1cf"), 9, 9.4, 0, 6.5, -9.4, 14);
      bx(b, C("sband", "#6b9ab0"), -9, 9, 1.0, 1.5, -9, -8.95); bx(b, C("sband", "#6b9ab0"), -9, 9, 5.0, 5.2, -9, -8.95);
      bx(b, C("sbase", "#8a6a4a"), -9, 9, 0, 0.3, -9, -8.8); bx(b, C("sbase", "#8a6a4a"), -9, -8.8, 0, 0.3, -9, 14); bx(b, C("sbase", "#8a6a4a"), 8.8, 9, 0, 0.3, -9, 14);
      for (let x = -8; x <= 8; x += 2) bx(b, C("spanel", "#d9cfb8"), x - 0.02, x + 0.02, 1.5, 5.0, -9, -8.97);
      // warehouse shelving with boxes + colour banners (no lettering) so the back wall is never empty
      for (let l = 0; l < 4; l++) bx(b, M.woodDk(), -8.6, 8.6, 0.5 + l * 1.15, 0.58 + l * 1.15, -8.95, -8.35);
      for (let i = 0; i < 26; i++) { const l = Math.floor(i / 7), x = -8 + (i % 7) * 2.3 + (l % 2) * 0.6; box(b, [C("sbA", "#b5653f"), C("sbB", "#d9b04a"), C("sbC", "#5a7a9a"), C("sbD", "#7a9a6a")][(i * 3 + l) % 4], x, 0.58 + l * 1.15, -8.65, 1.5 + 0.3 * (i % 3), 0.7 + 0.25 * (i % 2), 0.55); }
      for (const [x0, c] of [[-6, "#c0392f"], [-1.5, "#3f6fb5"], [3, "#e0b83a"]] as const) bx(b, C("ban" + c, c), x0, x0 + 3, 5.1, 6.1, -8.99, -8.95);
    });
    build(G, (b) => {
      bx(b, C("sceil", "#e3dccb"), -9.6, 9.6, 6.5, 6.9, -9.6, 14);
      for (let z = -8; z < 14; z += 3) bx(b, C("sbeam", "#8a6a4a"), -9, 9, 6.15, 6.5, z - 0.14, z + 0.14);
      for (const x of [-4.5, 0, 4.5]) for (const z of [-5, 0, 5]) { b.add(beamGeo(V(x, 6.15, z), V(x, 5.1, z), 0.03), M.iron(), undefined); b.add(new THREE.ConeGeometry(0.5, 0.35, 14, 1, true).translate(0, 0.17, 0), lam("m_sshade", () => ({ color: "#c9b88a", side: THREE.DoubleSide })), M4(x, 4.78, z)); b.add(new THREE.SphereGeometry(0.12, 10, 8).translate(x, 4.85, z), glow([5, 4.4, 3.2])); }
    }, false);
    range.position.set(RANGE[0], 0.19, RANGE[2]); G.add(range);
    scene12.visible = false; G.add(scene12);
    build(scene12, (b) => {
      const [cx, cy, cz] = CHUNK, w = 1.7, h = 1.3, d = 0.9;
      bx(b, M.cheese(), cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2, cz - d / 2, cz + d / 2);
      bx(b, M.cheeseD(), cx - w / 2 - 0.02, cx + w / 2 + 0.02, cy - h / 2 - 0.02, cy - h / 2 + 0.07, cz - d / 2 - 0.02, cz + d / 2 + 0.02);
      bx(b, M.cheeseD(), cx - w / 2 - 0.02, cx - w / 2 + 0.07, cy - h / 2, cy + h / 2, cz - d / 2 - 0.02, cz + d / 2 + 0.02);
      bx(b, M.cheeseD(), cx + w / 2 - 0.07, cx + w / 2 + 0.02, cy - h / 2, cy + h / 2, cz - d / 2 - 0.02, cz + d / 2 + 0.02);
      for (const [hx, hy, hr] of [[-0.55, 0.38, 0.09], [0.6, -0.35, 0.11], [0.15, 0.5, 0.07], [-0.2, -0.5, 0.08]] as const) b.add(new THREE.CylinderGeometry(hr, hr, 0.05, 12).rotateX(Math.PI / 2), C("cheeseH", "#b9822a"), M4(cx + hx, cy + hy, cz + d / 2 + 0.005));
      bx(b, M.woodDk(), MAG12[0] - 0.55, MAG12[0] + 0.55, MAG12[1] - 0.08, MAG12[1], -0.8, 0.0);
      for (const [x, z] of [[-0.48, -0.75], [0.48, -0.75], [-0.48, -0.05], [0.48, -0.05]]) bx(b, M.woodDk(), MAG12[0] + x - 0.04, MAG12[0] + x + 0.04, 0, MAG12[1] - 0.08, z - 0.04, z + 0.04);
      bx(b, M.woodDk(), CHUNK[0] - 0.9, CHUNK[0] + 0.9, 0.3, CHUNK[1] - 0.65, CHUNK[2] - 0.35, CHUNK[2] + 0.35);
    });
    podium.visible = false; G.add(podium);
    const layers: [number, number][] = [[3, 4], [3, 3], [3, 3], [2, 3], [2, 2], [2, 2], [1, 2]];
    layers.forEach(([nx, nz], l) => {
      const g = new THREE.Group(); g.visible = false; podium.add(g); pileLayers.push(g);
      build(g, (b) => {
        const win = M.glassD();
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) addMicrowave(b, win, MPILE[0] + (i - (nx - 1) / 2) * 0.62, 0.0 + l * 0.395, MPILE[2] + (j - (nz - 1) / 2) * 0.46, 1.0, ((i + j + l) % 3 - 1) * 0.1);
      });
    });
    stove = new THREE.Group(); stove.position.set(SPILE[0], 0, SPILE[2]); podium.add(stove);
    for (let k = 0; k < 3; k++) { const g = gasStove(); g.position.set((k - 1) * 0.95, 0, (k % 2) * 0.1); g.rotation.y = -0.15 + 0.15 * k; g.scale.setScalar(0.85); stove.add(g); }
  }

  // ======== 7. radar yard: big dish on a stand, lab building, fence ========
  {
    const G = groups.yard;
    build(G, (b) => {
      b.add(groundQuad(300, 8, -0.06), C("yardGrass", "#79a85a"));
      bx(b, C("pad", "#bdb7a9"), -9, 9, 0, 0.12, -16, 9);
      bx(b, C("pathY", "#cdbf9c"), -1.8, 1.8, 0.0, 0.1, 9, 30);
      b.add(boxGeo(V(5.5, 0, -17), V(23, 5.4, -11), 3), brickM());
      bx(b, C("cornice", "#d9d0bc"), 5.3, 23.2, 5.4, 5.7, -17.2, -10.8);
      for (let i = 0; i < 5; i++) { const x = 7.2 + i * 3.3; bx(b, M.white(), x - 0.9, x + 0.9, 1.4, 4.1, -11.02, -10.9); bx(b, glow([2.6, 2.1, 1.1]), x - 0.78, x + 0.78, 1.52, 3.98, -10.9, -10.86); bx(b, M.white(), x - 0.04, x + 0.04, 1.52, 3.98, -10.86, -10.82); }
      bx(b, C("doorD", "#2c2a30"), 20.6, 22.2, 0, 2.6, -11.05, -10.8);
      for (let x = -14; x <= 14; x += 2) bx(b, M.iron(), x - 0.04, x + 0.04, 0, 1.3, 7.4, 7.5);
      bx(b, M.iron(), -14, 14, 0.5, 0.56, 7.4, 7.5); bx(b, M.iron(), -14, 14, 1.2, 1.26, 7.4, 7.5);
      box(b, M.woodLt(), 3.4, 0, -6.5, 1.8, 0.6, 1.0); box(b, M.green(), 4.1, 0.6, -6.5, 0.5, 0.5, 0.5);
    });
    const R = 3.1, F = 1.2, yy = (r: number) => (r * r) / (4 * F);
    const prof: THREE.Vector2[] = [new THREE.Vector2(0.001, -0.2)];
    for (let i = 1; i <= 16; i++) { const r = (R * i) / 16; prof.push(new THREE.Vector2(r + 0.05 * (i / 16), yy(r) - 0.2)); }
    prof.push(new THREE.Vector2(R + 0.07, yy(R) + 0.03));
    for (let i = 16; i >= 0; i--) { const r = (R * i) / 16; prof.push(new THREE.Vector2(Math.max(0.001, r), yy(r))); }
    const dishM = lam("m_dishW", () => ({ color: "#ece9e1", side: THREE.DoubleSide }));
    const dish = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), dishM); dish.castShadow = true;
    const dg = new THREE.Group(); dg.add(dish);
    build(dg, (b) => {
      b.add(new THREE.TorusGeometry(R + 0.06, 0.08, 8, 40).rotateX(Math.PI / 2), M.steel(), T0(0, yy(R) + 0.02, 0));
      for (const a of [0.4, 2.0, 3.6, 5.2]) b.add(beamGeo(V(Math.cos(a) * R, yy(R), Math.sin(a) * R), V(0, F + 0.35, 0), 0.07), M.steel(), undefined);
      cylY(b, M.black(), 0, F + 0.1, 0, 0.14, 0.55, 12); cylY(b, M.red(), 0, F + 0.62, 0, 0.2, 0.08, 12);
      for (const a of [0, 1.57, 3.14, 4.71]) b.add(beamGeo(V(Math.cos(a) * 0.12, -0.15, Math.sin(a) * 0.12), V(Math.cos(a) * R * 0.8, yy(R * 0.8) - 0.35, Math.sin(a) * R * 0.8), 0.1), M.iron(), undefined);
      cylY(b, M.iron(), 0, -0.55, 0, 0.35, 0.4, 12);
    });
    const tilt = new THREE.Group(); tilt.add(dg); tilt.rotation.set(1.05, 0, -0.18); tilt.position.set(0, 4.6, 0);
    dishSpin.add(tilt);
    build(dishSpin, (b) => {
      cylY(b, M.steel(), 0, 0.2, 0, 0.85, 2.6, 16, 0.5); box(b, C("padS", "#8a8f99"), 0, 0, 0, 3.6, 0.25, 3.6);
      bx(b, M.iron(), -1.0, -0.8, 2.6, 4.6, -0.3, 0.3); bx(b, M.iron(), 0.8, 1.0, 2.6, 4.6, -0.3, 0.3); bx(b, M.iron(), -1.0, 1.0, 2.5, 2.8, -0.45, 0.45);
      for (let i = 0; i < 5; i++) b.add(beamGeo(V(-0.45, 0.35 + i * 0.5, 0), V(0.45, 0.85 + i * 0.5, 0), 0.05), M.black(), undefined);
    });
    dishSpin.position.set(-3.6, 0, -8.2); G.add(dishSpin);
    const tb = new Batch();
    for (const [x, z, h] of [[-12, -12, 6], [-17, -4, 5.4], [14, -6, 6], [26, -4, 5.6], [-7, -18, 6.4]] as const) prop(tb, kit, "tree_oak", x, 0, z, h);
    tb.build(G, true);
  }
  return { groups, mag: mg.g, magRing: mg.ring, magRing2: mg.ring2, radarScreen: radarScreen!, range, rangeK, scene12, podium,
    pileLayers, stove, beltCrates, stacks, pieceRows, kmw, kmwGlow: kmwGlow!, dishSpin };
};
