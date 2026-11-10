// The six sets of the Dancing Plague short (half-timbered 1518 Strasbourg): street, cathedral square, guild hall,
// famine street (night), cosy room, mountain chapel. Procedural geometry + painted textures, merged per material.
// Interiors do not cast shadows (they are lit like a stage); every set is one group toggled per shot by world.ts.
import * as THREE from "three";
import { Batch, lam, V, Kit, prop, house, setHouseLit, boxGeo, quad, tri, M4, beamGeo, groundQuad, flatRect, cyl, roofMat, leafMat, barkMat, lobeGeo, trunkGeo } from "./build";
import { ctex, rng, rep, cobbleHD, planksHD, stoneHD, beamHD } from "./paint";
import { NOINK } from "./ink";
import { SetId, STAGE_Z, STAGE_Y, BENCH } from "./story";

export type SetBuild = { groups: Record<SetId, THREE.Group>; statueGlow: THREE.Mesh; gothic: THREE.Texture; bread: THREE.Group };

// ---------------- materials ----------------
const C = (key: string, color: string) => lam("d_" + key, () => ({ color }));
const M = {
  wood: () => C("wood", "#9a6a44"), woodDk: () => C("woodDk", "#5e402a"), woodLt: () => C("woodLt", "#c4935e"), iron: () => C("iron", "#4d5260"),
  cloth: () => C("cloth", "#c8a878"), plaster: () => C("plaster", "#e4d2ae"), plasterDk: () => C("plasterDk", "#cdb88f"), sack: () => C("sack", "#d9c49a"),
  red: () => C("red", "#b8392f"), blue: () => C("blue", "#3f6fb5"), green: () => C("green", "#4f8a4a"), gold: () => C("gold", "#d9b04a"),
  bread: () => C("bread", "#c98a3e"), black: () => C("black", "#26222c"), stone: () => C("stone", "#bdb2a0"), stoneDk: () => C("stoneDk", "#8f8576"),
};
const gl = new Map<string, THREE.MeshBasicMaterial>();
/** self-lit (bloom above 1): warm window / candle / lamp glass */
export const glow = (col: [number, number, number] = [3.2, 2.2, 1.0]) => {
  const k = col.join("_");
  let m = gl.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), toneMapped: true }); gl.set(k, m); }
  return m;
};
const cobbleM = () => lam("d_cobble", () => ({ map: cobbleHD() }));
const plankM = () => lam("d_planks", () => ({ map: planksHD() }));
const catStone = () => lam("d_catStone", () => ({ map: stoneHD("catStone", ["#dba88a", "#cf9a7c", "#e3b79a", "#c98f72"], "#98705c") }));
const slabM = () => lam("d_slabs", () => ({ map: stoneHD("slabHD", ["#cbbfa8", "#bfb299", "#d3c8b2", "#b5a98f"], "#7f7463") }));
const timberM = () => lam("d_timberTex", () => ({ map: beamHD() }));

/** gothic arched window painted on 256 x 512: bright glass with tracery, used on the cathedral and in the chapel */
export const gothicTex = (key: string, glass: [string, string]) => ctex("gothic" + key, 256, 512, (g) => {
  const grd = g.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, glass[0]); grd.addColorStop(1, glass[1]);
  g.clearRect(0, 0, 256, 512);
  const arch = () => { g.beginPath(); g.moveTo(24, 512); g.lineTo(24, 170); g.quadraticCurveTo(24, 40, 128, 12); g.quadraticCurveTo(232, 40, 232, 170); g.lineTo(232, 512); g.closePath(); };
  arch(); g.fillStyle = "#5c4a3e"; g.fill();
  g.save(); g.translate(128, 262); g.scale(0.86, 0.95); g.translate(-128, -262); arch(); g.fillStyle = grd; g.fill(); g.restore();
  g.strokeStyle = "#5c4a3e"; g.lineWidth = 9; g.beginPath(); g.moveTo(128, 60); g.lineTo(128, 512); g.moveTo(40, 250); g.lineTo(216, 250); g.stroke();
  g.beginPath(); g.arc(128, 150, 38, 0, Math.PI * 2); g.stroke();
});

const at = (x: number, y: number, z: number, yaw = 0, s: [number, number, number] = [1, 1, 1]) => M4(x, y, z, yaw, s);
const box = (b: Batch, m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0) =>
  b.add(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), m, at(x, y, z, yaw));
const bx = (b: Batch, m: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  b.add(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m, at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));

// ---------------- props ----------------
const barrel = (b: Batch, x: number, z: number, s0 = 1, y = 0) => {
  const s = s0 * 1.2, pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(0.3 + 0.07 * Math.sin(Math.PI * t), t * 0.9)); }
  const m = at(x, y, z, 0, [s, s, s]);
  b.add(new THREE.LatheGeometry(pts, 14), M.wood(), m);
  b.add(new THREE.CircleGeometry(0.3, 14).rotateX(-Math.PI / 2).translate(0, 0.9, 0), M.woodLt(), m);
  for (const yy of [0.15, 0.75]) b.add(new THREE.TorusGeometry(0.34, 0.016, 5, 18).rotateX(Math.PI / 2).translate(0, yy, 0), M.iron(), m);
};
const crate = (b: Batch, x: number, z: number, s = 0.8, yaw = 0, y = 0) => {
  box(b, M.woodLt(), x, y, z, s, s, s, yaw);
  const m = at(x, y, z, yaw);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(new THREE.BoxGeometry(0.07, s + 0.01, 0.07).translate(sx * s / 2, s / 2, sz * s / 2), M.woodDk(), m);
};
const sack = (b: Batch, x: number, z: number, s = 1.2, yaw = 0, y = 0) =>
  b.add(new THREE.SphereGeometry(0.3, 12, 9), M.sack(), at(x, y + 0.2 * s, z, yaw, [0.85 * s, 0.75 * s, 0.65 * s]));
const lantern = (b: Batch, x: number, y: number, z: number, col: [number, number, number] = [3.4, 2.1, 0.8]) => {
  b.add(new THREE.BoxGeometry(0.26, 0.36, 0.26).translate(0, -0.18, 0), glow(col), at(x, y, z));
  b.add(new THREE.ConeGeometry(0.24, 0.16, 4).rotateY(Math.PI / 4).translate(0, 0.08, 0), M.iron(), at(x, y, z));
  b.add(new THREE.BoxGeometry(0.3, 0.05, 0.3).translate(0, -0.38, 0), M.iron(), at(x, y, z));
};
/** iron wall bracket + hanging lantern, bracket pointing along +x (before yaw) */
const wallLantern = (b: Batch, x: number, y: number, z: number, yaw: number, col?: [number, number, number]) => {
  b.add(beamGeo(V(0, 0, 0), V(0.7, 0.05, 0), 0.05), M.iron(), at(x, y, z, yaw));
  b.add(beamGeo(V(0.7, 0.05, 0), V(0.7, -0.35, 0), 0.02), M.iron(), at(x, y, z, yaw));
  b.add(new THREE.BoxGeometry(0.26, 0.36, 0.26).translate(0.7, -0.55, 0), glow(col ?? [3.4, 2.1, 0.8]), at(x, y, z, yaw));
  b.add(new THREE.ConeGeometry(0.24, 0.16, 4).rotateY(Math.PI / 4).translate(0.7, -0.29, 0), M.iron(), at(x, y, z, yaw));
};
const bench = (b: Batch, x: number, z: number, yaw: number, len = 1.9) => {
  const m = at(x, 0, z, yaw);
  b.add(new THREE.BoxGeometry(len, 0.07, 0.42).translate(0, 0.46, 0), M.woodLt(), m);
  for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.09, 0.46, 0.38).translate(s * (len / 2 - 0.15), 0.23, 0), M.woodDk(), m);
};
const table = (b: Batch, x: number, z: number, yaw: number, w = 1.8, d = 0.9, h = 0.9, y = 0) => {
  const m = at(x, y, z, yaw);
  b.add(new THREE.BoxGeometry(w, 0.08, d).translate(0, h, 0), M.woodLt(), m);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(new THREE.BoxGeometry(0.09, h, 0.09).translate(sx * (w / 2 - 0.1), h / 2, sz * (d / 2 - 0.1)), M.woodDk(), m);
};
/** hanging trade sign: bracket + board + a simple shape (no text) */
const tradeSign = (b: Batch, x: number, y: number, z: number, yaw: number, kind: "shoe" | "pretzel" | "bread" | "bottle") => {
  const m = at(x, y, z, yaw);
  b.add(beamGeo(V(0, 0, 0), V(1.1, 0, 0), 0.06), M.iron(), m);
  b.add(beamGeo(V(0.9, 0, 0), V(0.9, -0.3, 0), 0.025), M.iron(), m);
  b.add(new THREE.BoxGeometry(0.7, 0.7, 0.07).translate(0.9, -0.7, 0), C("signBd", "#e9d7a8"), m);
  if (kind === "shoe") { b.add(new THREE.BoxGeometry(0.46, 0.14, 0.1).translate(0.9, -0.88, 0), M.red(), m); b.add(new THREE.BoxGeometry(0.16, 0.3, 0.1).translate(1.06, -0.66, 0), M.red(), m); }
  else if (kind === "pretzel") b.add(new THREE.TorusGeometry(0.2, 0.05, 6, 14), M.bread(), m.clone().multiply(new THREE.Matrix4().makeTranslation(0.9, -0.7, 0.06)));
  else if (kind === "bread") b.add(new THREE.SphereGeometry(0.22, 10, 8), M.bread(), m.clone().multiply(new THREE.Matrix4().compose(V(0.9, -0.72, 0.06), new THREE.Quaternion(), V(1.4, 0.8, 0.5))));
  else b.add(new THREE.CylinderGeometry(0.12, 0.16, 0.45, 8), C("botG", "#3f8f6a"), m.clone().multiply(new THREE.Matrix4().makeTranslation(0.9, -0.7, 0.06)));
};
/** string of pennants between (x0,y0,z0) and (x1,y1,z1) */
const bunting = (b: Batch, p0: [number, number, number], p1: [number, number, number], n = 9, sag = 0.8) => {
  const cols = ["#c8323a", "#f2c230", "#3f6fb5", "#f4f0e6", "#3f8f5a"];
  let prev = V(...p0);
  for (let i = 1; i <= n * 2; i++) {
    const t = i / (n * 2), pt = V(p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t - sag * 4 * t * (1 - t), p0[2] + (p1[2] - p0[2]) * t);
    b.add(beamGeo(prev, pt, 0.025), M.cloth(), undefined);
    if (i % 2 === 0) {
      const a = prev.clone(), c = pt.clone(), d = pt.clone().add(prev).multiplyScalar(0.5).add(V(0, -0.55, 0));
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute([a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z, d.x, d.y, d.z, c.x, c.y, c.z, a.x, a.y, a.z], 3));
      g.computeVertexNormals();
      b.add(g, lam("d_pen" + (i / 2) % 5, () => ({ color: cols[(i / 2) % 5], side: THREE.DoubleSide })), undefined);
    }
    prev = pt;
  }
};
const flowerBox = (b: Batch, x: number, y: number, z: number, yaw: number, w = 1.2) => {
  const m = at(x, y, z, yaw);
  b.add(new THREE.BoxGeometry(w, 0.22, 0.3).translate(0, 0, 0), M.woodDk(), m);
  const cols = ["#e2453c", "#f2c230", "#e1669d", "#f4f0e6"];
  for (let i = 0; i < 7; i++) {
    b.add(new THREE.SphereGeometry(0.1, 8, 6), C("fl" + (i % 4), cols[i % 4]), m.clone().multiply(new THREE.Matrix4().makeTranslation(-w / 2 + 0.1 + (i * (w - 0.2)) / 6, 0.2 + (i % 2) * 0.04, 0.02)));
    b.add(new THREE.SphereGeometry(0.1, 8, 6), C("flg", "#4f8a3a"), m.clone().multiply(new THREE.Matrix4().makeTranslation(-w / 2 + 0.16 + (i * (w - 0.2)) / 6, 0.1, 0.06)));
  }
};
const well = (b: Batch, x: number, z: number) => {
  b.add(new THREE.CylinderGeometry(0.9, 1.0, 0.9, 16, 1, true).translate(0, 0.45, 0), lam("d_wellS", () => ({ color: "#bdb2a0", side: THREE.DoubleSide })), at(x, 0, z));
  b.add(new THREE.TorusGeometry(0.95, 0.12, 6, 18).rotateX(Math.PI / 2).translate(0, 0.9, 0), M.stone(), at(x, 0, z));
  b.add(new THREE.CircleGeometry(0.88, 14).rotateX(-Math.PI / 2).translate(0, 0.55, 0), C("wellW", "#3f6aa0"), at(x, 0, z));
  for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.12, 2.3, 0.12).translate(s * 0.95, 1.15, 0), M.woodDk(), at(x, 0, z));
  b.add(new THREE.BoxGeometry(2.3, 0.1, 0.12).translate(0, 2.3, 0), M.woodDk(), at(x, 0, z));
  b.add(roofGable(2.5, 1.9, 0.7), roofMat("#c0634a"), at(x, 2.35, z));
};
const roofGable = (w: number, d: number, h: number) => {
  const a = quad(V(-w / 2, 0, d / 2), V(w / 2, 0, d / 2), V(w / 2, h, 0), V(-w / 2, h, 0), 1, 1), c = quad(V(w / 2, 0, -d / 2), V(-w / 2, 0, -d / 2), V(-w / 2, h, 0), V(w / 2, h, 0), 1, 1);
  return mergeTwo(a, c);
};
const mergeTwo = (a: THREE.BufferGeometry, c: THREE.BufferGeometry) => {
  const g = new THREE.BufferGeometry(), pa = a.attributes.position.array, pc = c.attributes.position.array;
  const pos = new Float32Array(pa.length + pc.length); pos.set(pa as Float32Array); pos.set(pc as Float32Array, pa.length);
  const nn = new Float32Array(pos.length); nn.set(a.attributes.normal.array as Float32Array); nn.set(c.attributes.normal.array as Float32Array, pa.length);
  const uv = new Float32Array(pos.length / 3 * 2); uv.set(a.attributes.uv.array as Float32Array); uv.set(c.attributes.uv.array as Float32Array, pa.length / 3 * 2);
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nn, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
};
/** empty market stall (famine): bare table, four poles, torn awning */
const stall = (b: Batch, x: number, z: number, yaw: number, awn: string) => {
  const m = at(x, 0, z, yaw);
  b.add(new THREE.BoxGeometry(2.4, 0.08, 1.0).translate(0, 0.95, 0), M.woodLt(), m);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(new THREE.BoxGeometry(0.1, 2.6, 0.1).translate(sx * 1.15, 1.3, sz * 0.5), M.woodDk(), m);
  for (let i = 0; i < 6; i++) b.add(new THREE.BoxGeometry(0.4, 0.04, 1.35).translate(-1.0 + i * 0.4, 2.62, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(0.16)), i % 2 ? C("aw" + awn, awn) : C("awc", "#cdbf9d"), m);
  b.add(new THREE.BoxGeometry(2.3, 0.4, 0.04).translate(0, 0.35, 0.45), M.woodDk(), m);
};
const torch = (b: Batch, x: number, z: number) => {
  b.add(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6).translate(0, 1.1, 0), M.woodDk(), at(x, 0, z));
  b.add(new THREE.SphereGeometry(0.16, 8, 6).scale(1, 1.5, 1).translate(0, 2.35, 0), glow([5, 2.6, 0.8]), at(x, 0, z));
};
const spire = (b: Batch, x: number, z: number, baseW: number, baseH: number, spireH: number) => {
  const st = catStone();
  b.add(boxGeo(V(x - baseW / 2, 0, z - baseW / 2), V(x + baseW / 2, baseH, z + baseW / 2), 5), st);
  b.add(cyl(baseW * 0.36, baseH * 0.35, 8), st, at(x, baseH, z));
  const h2 = baseH * 1.35;
  b.add(new THREE.ConeGeometry(baseW * 0.4, spireH, 8).translate(0, spireH / 2, 0), st, at(x, h2, z));
  b.add(new THREE.SphereGeometry(0.9, 8, 6), M.gold(), at(x, h2 + spireH + 0.4, z));
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) b.add(new THREE.ConeGeometry(baseW * 0.09, baseH * 0.28, 6).translate(0, baseH * 0.14, 0), st, at(x + dx * baseW * 0.46, baseH, z + dz * baseW * 0.46));
};

// ---------------- town building blocks ----------------
type RowOpts = { x: number; z0: number; z1: number; yaw: number; h?: number[]; step?: number; w?: number; skip?: (z: number) => boolean; seed?: number };
const houseRow = (b: Batch, o: RowOpts) => {
  const r = rng(o.seed ?? 7);
  const hs = o.h ?? [9, 10.5, 11.5, 9.8];
  let i = 0;
  for (let z = o.z0; z <= o.z1; z += o.step ?? 9.6, i++) {
    if (o.skip?.(z)) continue;
    house(b, o.x, z, o.yaw, o.w ?? 9, 8, hs[Math.floor(r() * hs.length)], Math.floor(r() * 8));
  }
};

export const buildSets = (root: THREE.Object3D, kit: Kit): SetBuild => {
  const groups = {} as Record<SetId, THREE.Group>;
  for (const id of ["street", "square", "hall", "famine", "room", "chapel"] as SetId[]) { groups[id] = new THREE.Group(); groups[id].visible = false; root.add(groups[id]); }
  const r = rng(41);
  const gothic = gothicTex("cat", ["#7aa3d8", "#4a6aa6"]);
  const winM = lam("d_gothicM", () => ({ map: gothic, alphaTest: 0.5, side: THREE.DoubleSide }));

  // ======== 1. street (day / golden) ========
  {
    const b = new Batch(), G = groups.street;
    b.add(groundQuad(320, 4), cobbleM());
    setHouseLit(0.45);
    houseRow(b, { x: -9.8, z0: -80, z1: 130, yaw: Math.PI / 2, seed: 3, skip: (z) => Math.abs(z - 8) < 3 });
    house(b, -9.8, 8, Math.PI / 2, 9, 8, 10.5, 3);
    houseRow(b, { x: 9.8, z0: -80, z1: 130, yaw: -Math.PI / 2, seed: 5 });
    setHouseLit(0.2);
    houseRow(b, { x: -22, z0: -100, z1: 120, yaw: Math.PI / 2, h: [13, 15, 17], step: 11, w: 10, seed: 9 });
    houseRow(b, { x: 22, z0: -100, z1: 120, yaw: -Math.PI / 2, h: [13, 15, 17], step: 11, w: 10, seed: 11 });
    setHouseLit(0.15);
    for (const dx of [38, 56, 76, 98]) for (const sgn of [-1, 1]) houseRow(b, { x: sgn * dx, z0: -110, z1: 150, yaw: -sgn * Math.PI / 2, h: [11, 13, 15, 12], step: 12, w: 10, seed: 31 + dx + sgn });
    // cathedral closing the street
    const cz = -125;
    b.add(boxGeo(V(-18, 0, cz - 16), V(18, 34, cz + 14), 6), catStone());
    spire(b, 8, cz + 4, 12, 50, 62);
    b.add(new THREE.ConeGeometry(4.6, 22, 8).translate(0, 11, 0), catStone(), at(-12, 34, cz + 2));
    b.add(quad(V(-14, 3, cz + 14.1), V(-8, 3, cz + 14.1), V(-8, 20, cz + 14.1), V(-14, 20, cz + 14.1)), winM);
    b.add(quad(V(0, 3, cz + 14.1), V(6, 3, cz + 14.1), V(6, 20, cz + 14.1), V(0, 20, cz + 14.1)), winM);
    b.add(quad(V(5, 20, cz + 10.1), V(11, 20, cz + 10.1), V(11, 40, cz + 10.1), V(5, 40, cz + 10.1)), winM);
    // dressing along the kerbs
    for (const [x, z, s] of [[-4.6, 20, 1], [-4.8, 21.2, 0.9], [4.7, 2, 1], [4.9, 3.2, 0.8], [4.6, 26, 1], [-4.7, -6, 1]] as const) barrel(b, x, z, s);
    for (const [x, z, s, y] of [[-4.9, 14, 0.8, 0], [-4.9, 14, 0.7, 0.8], [4.8, 16, 0.9, 0], [-4.7, -2, 0.9, 0], [4.8, -8, 0.8, 0]] as const) crate(b, x, z, s, 0.3, y);
    for (const [x, z] of [[4.7, 12], [-4.6, 30], [4.8, 36]] as const) sack(b, x, z, 1.3, x * 3);
    well(b, -2.6, -14);
    bench(b, BENCH[0], BENCH[2], 0.15);
    // music stand: pole + slanted empty board (shot 3: nobody plays)
    b.add(new THREE.CylinderGeometry(0.025, 0.03, 1.3, 6).translate(0, 0.65, 0), M.iron(), at(BENCH[0] + 0.8, 0, BENCH[2] - 0.5));
    b.add(new THREE.BoxGeometry(0.5, 0.36, 0.03).translate(0, 1.45, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(-0.4)), M.woodLt(), at(BENCH[0] + 0.8, 0, BENCH[2] - 0.5, 0.2));
    prop(b, kit, "cart", 4.2, 0, -12, 1.8, 2.4);
    prop(b, kit, "stall-red", 4.6, 0, 38, 2.8, -1.4);
    prop(b, kit, "stall-green", -4.8, 0, 46, 2.8, 1.5);
    // hanging signs and lanterns on the house fronts (shoe, pretzel, bread, bottle)
    tradeSign(b, -5.78, 4.2, -2, 0, "shoe");
    tradeSign(b, 5.78, 4.4, 16, Math.PI, "pretzel");
    tradeSign(b, -5.78, 4.3, -14, 0, "bread");
    tradeSign(b, 5.78, 4.2, -6, Math.PI, "bottle");
    tradeSign(b, 5.78, 4.3, -22, Math.PI, "shoe");
    for (const z of [2, 12, 22, -10, -22]) { wallLantern(b, -5.78, 3.2, z, 0); wallLantern(b, 5.78, 3.2, z + 5, Math.PI); }
    // bunting across the street, laundry, banners
    for (const z of [20, 0, -12, -26]) bunting(b, [-5.7, 7.6, z], [5.7, 7.2, z + 1], 10, 1.1);
    for (const [z, y] of [[-4, 6.3], [-18, 6.0]] as const) {
      b.add(beamGeo(V(-5.7, y, z), V(5.7, y + 0.2, z), 0.02), M.cloth(), undefined);
      for (let i = 0; i < 5; i++) { const x = -4.4 + i * 2.2, cl = ["#f4f0e6", "#c8323a", "#3f6fb5", "#f2c230", "#e9d7a8"][i]; b.add(quad(V(x, y - 0.6, z), V(x + 0.55, y - 0.6, z), V(x + 0.55, y, z), V(x, y, z)), lam("d_cl" + cl, () => ({ color: cl, side: THREE.DoubleSide }))); }
    }
    prop(b, kit, "banner-red", -5.2, 0, -16, 3.2, 0); prop(b, kit, "banner-green", 5.2, 0, -22, 3.2, Math.PI);
    prop(b, kit, "banner-red", 5.2, 0, 24, 3.2, Math.PI);
    for (const [x, z] of [[-5.3, 10], [5.3, 6], [-5.3, 38], [5.3, 22]] as const) { b.add(new THREE.CylinderGeometry(0.22, 0.18, 0.4, 10).translate(0, 0.2, 0), C("pot", "#b8684a"), at(x, 0, z)); b.add(new THREE.SphereGeometry(0.26, 8, 6), C("flg", "#4f8a3a"), at(x, 0.55, z)); b.add(new THREE.SphereGeometry(0.1, 8, 6), C("fl0", "#e2453c"), at(x + 0.1, 0.72, z)); }
    for (const [x, y, z, yaw] of [[-5.82, 3.1, 14, Math.PI / 2], [5.82, 3.1, 9, -Math.PI / 2], [-5.82, 5.9, 26, Math.PI / 2], [5.82, 5.9, 20, -Math.PI / 2]] as const) flowerBox(b, x - Math.sign(x) * 0.12 * 0, y, z, yaw);
    b.build(G, true);
  }

  // ======== 2. cathedral square ========
  {
    const b = new Batch(), G = groups.square;
    b.add(groundQuad(320, 4), cobbleM());
    // cathedral on the -z side
    const cz = -50;
    b.add(boxGeo(V(-24, 0, cz - 24), V(24, 40, cz), 6), catStone());
    spire(b, 14, cz - 6, 14, 58, 72);
    b.add(new THREE.ConeGeometry(5.2, 24, 8).translate(0, 12, 0), catStone(), at(-14, 40, cz - 8));
    for (const x of [-18, -8, 2, 12, 20]) b.add(quad(V(x - 2.2, 4, cz + 0.1), V(x + 2.2, 4, cz + 0.1), V(x + 2.2, 24, cz + 0.1), V(x - 2.2, 24, cz + 0.1)), winM);
    b.add(quad(V(-3, 0, cz + 0.12), V(3, 0, cz + 0.12), V(3, 12, cz + 0.12), V(-3, 12, cz + 0.12)), lam("d_portal", () => ({ map: ctex("portal", 128, 256, (g) => { g.fillStyle = "#2c2030"; g.beginPath(); g.moveTo(8, 256); g.lineTo(8, 100); g.quadraticCurveTo(8, 12, 64, 6); g.quadraticCurveTo(120, 12, 120, 100); g.lineTo(120, 256); g.fill(); }), alphaTest: 0.5 })));
    // ring of half-timbered houses around the other sides
    setHouseLit(0.35);
    for (let i = 0; i < 46; i++) {
      const a = -0.55 + (i / 46) * (Math.PI * 2 - 1.1) + Math.PI / 2 * 0, d = 44 + (i % 2) * 14, x = Math.sin(a + Math.PI * 0.0) * d, z = Math.cos(a) * d;
      if (z < -28 && Math.abs(x) < 36) continue;
      house(b, x, z, Math.atan2(-x, -z), 9, 8, [9, 11, 12.5, 10][i % 4], i % 8);
    }
    for (const [n, d] of [[34, 74], [42, 92], [50, 112]] as const) for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + d, x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (z < -28 && Math.abs(x) < 40) continue;
      house(b, x, z, Math.atan2(-x, -z), 10, 8, 12 + (i % 4) * 2, (i + d) % 8);
    }
    well(b, -22, -8);
    prop(b, kit, "stall-red", 24, 0, 12, 2.8, -1.6); prop(b, kit, "stall-green", -26, 0, 20, 2.8, 1.5); prop(b, kit, "cart", 20, 0, -12, 1.8, 1);
    for (const [x, z] of [[-30, -24], [30, -24], [-33, 6], [33, 6]] as const) prop(b, kit, "banner-red", x, 0, z, 3.6, x > 0 ? Math.PI : 0);
    for (const [x, z] of [[-20, 24], [20, 24], [-16, -22], [17, -24]] as const) { b.add(new THREE.CylinderGeometry(0.08, 0.1, 5, 6).translate(0, 2.5, 0), M.woodDk(), at(x, 0, z)); }
    bunting(b, [-20, 5, 24], [20, 5, 24], 14, 1.6); bunting(b, [-16, 5, -22], [17, 5, -24], 12, 1.4);
    for (const [x, z, s] of [[-14, -16, 1], [15, -18, 1], [-24, 14, 1], [26, 6, 1], [-12, 20, 0.9]] as const) barrel(b, x, z, s);
    // low tiered fountain
    b.add(cyl(2.4, 0.5, 20), M.stone(), at(-14, 0, -14)); b.add(cyl(1.0, 1.3, 12), M.stone(), at(-14, 0.5, -14)); b.add(cyl(1.5, 0.2, 14), M.stone(), at(-14, 1.7, -14));
    b.add(new THREE.CircleGeometry(2.2, 18).rotateX(-Math.PI / 2).translate(-14, 0.46, -14), C("fountW", "#5b94c8"));
    b.build(G, true);
  }

  // ======== 3. guild hall interior ========
  {
    const b = new Batch(), G = groups.hall, X = 13, Z0 = -18, Z1 = 18, H = 9;
    b.add(flatRect(-X, X, Z0, Z1, 0, 2), plankM());
    const wall = M.plaster(), tb = M.woodDk();
    bx(b, wall, -X - 0.4, -X, 0, H, Z0, Z1); bx(b, wall, X, X + 0.4, 0, H, Z0, Z1); bx(b, wall, -X, X, 0, H, Z0 - 0.4, Z0);
    for (const s of [-1, 1]) {
      for (let z = Z0 + 1.5; z < Z1; z += 3.6) bx(b, tb, s * X - 0.18 + (s > 0 ? 0 : 0.36), s * X + 0.18 - (s > 0 ? 0 : 0.36), 0, H, z - 0.14, z + 0.14);
      bx(b, tb, s * X - 0.2, s * X + 0.2, 4.6, 4.9, Z0, Z1); bx(b, tb, s * X - 0.2, s * X + 0.2, H - 0.3, H, Z0, Z1);
      // tall arched windows glowing gold
      for (let z = Z0 + 3.3; z < Z1 - 1; z += 7.2) {
        b.add(quad(V(s * (X - 0.05), 1.8, z + 1.2 * s), V(s * (X - 0.05), 1.8, z - 1.2 * s), V(s * (X - 0.05), 6.8, z - 1.2 * s), V(s * (X - 0.05), 6.8, z + 1.2 * s)), glow([3.0, 2.1, 1.0]));
        b.add(new THREE.BoxGeometry(0.14, 5.2, 0.12).translate(s * (X - 0.08), 4.3, z), tb);
        b.add(new THREE.BoxGeometry(0.14, 0.12, 2.5).translate(s * (X - 0.08), 4.4, z), tb);
      }
    }
    for (let x = -X + 1.5; x < X; x += 3.6) bx(b, tb, x - 0.14, x + 0.14, 0, H, Z0, Z0 + 0.3);
    bx(b, tb, -X, X, 4.6, 4.9, Z0, Z0 + 0.3);
    // ceiling beams + rafters
    for (let z = Z0 + 1; z < Z1; z += 3) bx(b, tb, -X, X, H - 0.7, H - 0.2, z - 0.2, z + 0.2);
    for (let x = -X + 2; x < X; x += 4) bx(b, tb, x - 0.15, x + 0.15, H - 1.2, H - 0.7, Z0, Z1);
    // stage
    bx(b, lam("d_stageW", () => ({ color: "#6e4a30" })), -9, 9, 0, STAGE_Y - 0.06, Z0, -9); bx(b, plankM(), -9, 9, STAGE_Y - 0.06, STAGE_Y, Z0, -9); bx(b, M.red(), -9.15, 9.15, STAGE_Y - 0.5, STAGE_Y - 0.1, -9.2, -8.9); bx(b, M.gold(), -9.2, 9.2, STAGE_Y - 0.12, STAGE_Y + 0.02, -9.25, -8.85);
    b.add(flatRect(-2.6, 2.6, -17, -9.2, STAGE_Y + 0.01, 3), lam("d_carpet", () => ({ color: "#a8322f" })));
    for (const x of [-1.5, 1.5]) bx(b, M.woodLt(), x - 0.9, x + 0.9, 0, 0.45, -8.4, -9);
    // back wall decoration: shields and long banners
    for (const x of [-4.2, 4.2]) { b.add(cyl(0.8, 0.08, 14), M.blue(), at(x, 4.6, Z0 + 0.45).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))); b.add(cyl(0.5, 0.1, 14), M.gold(), at(x, 4.6, Z0 + 0.5).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))); }
    const tap = lam("d_tapestry", () => ({ map: ctex("tapestry", 256, 512, (g) => {
      g.fillStyle = "#9a2f36"; g.fillRect(0, 0, 256, 512); g.strokeStyle = "#e0b955"; g.lineWidth = 14; g.strokeRect(14, 14, 228, 484);
      for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? "#e0b955" : "#f1e6c8"; g.beginPath(); g.moveTo(128, 60 + k * 110); g.lineTo(190, 110 + k * 110); g.lineTo(128, 160 + k * 110); g.lineTo(66, 110 + k * 110); g.fill(); }
    }), side: THREE.DoubleSide }));
    for (const x of [-7.5, 0, 7.5]) b.add(quad(V(x - 1.5, 2.4, Z0 + 0.5), V(x + 1.5, 2.4, Z0 + 0.5), V(x + 1.5, 8.2, Z0 + 0.5), V(x - 1.5, 8.2, Z0 + 0.5)), tap);
    for (const x of [-3.6, 3.6]) prop(b, kit, "banner-green", x, 3.0, Z0 + 0.6, 3.8, 0);
    for (const s of [-1, 1]) prop(b, kit, "banner-red", s * (X - 1.2), 2.6, -4, 3.4, s > 0 ? Math.PI / 2 : -Math.PI / 2);
    // long tables + benches along the walls, barrels, jugs
    for (const s of [-1, 1]) { table(b, s * 10.4, 4, Math.PI / 2, 8, 1.1); bench(b, s * 11.7, 4, Math.PI / 2, 8); bench(b, s * 9.1, 4, Math.PI / 2, 8); table(b, s * 10.4, 13, Math.PI / 2, 5, 1.1); }
    for (const [x, z, s] of [[-11.5, -16, 1], [-10.2, -16.6, 0.9], [11.4, -16, 1], [10.1, -16.5, 0.9], [-12, -10, 1], [12, -10, 1]] as const) barrel(b, x, z, s);
    for (let i = 0; i < 6; i++) b.add(new THREE.CylinderGeometry(0.07, 0.06, 0.2, 8).translate(0, 1.04, 0), C("jug", "#b86a48"), at(-10.4 + (i % 3) * 0.2, 0, 1.4 + i * 1.2 + (i % 2) * 0.1));
    // chandelier wheels with candles
    for (const z of [8, -2]) {
      b.add(new THREE.TorusGeometry(1.4, 0.07, 6, 20).rotateX(Math.PI / 2), M.iron(), at(0, 6.4, z));
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6).translate(Math.cos(a) * 1.4, 0.17, Math.sin(a) * 1.4), M.cloth(), at(0, 6.4, z)); b.add(new THREE.SphereGeometry(0.09, 6, 5).scale(1, 1.6, 1).translate(Math.cos(a) * 1.4, 0.42, Math.sin(a) * 1.4), glow([5, 3, 1]), at(0, 6.4, z)); }
      b.add(beamGeo(V(0, 6.4, z), V(0, H, z), 0.04), M.iron(), undefined);
    }
    b.build(G, false);
  }

  // ======== 4. famine street (night) ========
  {
    const b = new Batch(), G = groups.famine;
    b.add(groundQuad(320, 4), cobbleM());
    setHouseLit(0.3);
    houseRow(b, { x: -11.4, z0: -70, z1: 100, yaw: Math.PI / 2, seed: 13 });
    houseRow(b, { x: 11.4, z0: -70, z1: 100, yaw: -Math.PI / 2, seed: 17 });
    setHouseLit(0.1);
    houseRow(b, { x: -24, z0: -80, z1: 90, yaw: Math.PI / 2, h: [13, 15], step: 11, w: 10, seed: 19 });
    houseRow(b, { x: 24, z0: -80, z1: 90, yaw: -Math.PI / 2, h: [13, 15], step: 11, w: 10, seed: 23 });
    spire(b, 6, -110, 12, 46, 58);
    b.add(boxGeo(V(-16, 0, -128), V(16, 30, -104), 6), catStone());
    for (const z of [18, 8, -2, -12, -22]) { stall(b, -6.2, z, Math.PI / 2, "#7a4a4a"); stall(b, 6.2, z + 3, -Math.PI / 2, "#6a5a3a"); }
    for (const [x, z] of [[-5.2, 12], [5.3, 0], [-5, -8], [5, 16]] as const) { b.add(new THREE.CylinderGeometry(0.28, 0.2, 0.24, 10, 1, true).translate(0, 0.12, 0), lam("d_basket", () => ({ color: "#a47a48", side: THREE.DoubleSide })), at(x, 0, z)); }
    for (const [x, z, s] of [[-4.4, 22, 1], [4.6, -14, 1], [-4.6, -18, 0.9]] as const) crate(b, x, z, s * 0.8, 0.4);
    barrel(b, 4.7, 8, 1); barrel(b, -4.7, -4, 1);
    for (const z of [18, 4, -10, -24]) { wallLantern(b, -9.4, 3.0, z, 0, [1.6, 0.9, 0.35]); wallLantern(b, 9.4, 3.0, z + 6, Math.PI, [1.6, 0.9, 0.35]); }
    // a tattered bunting, long since sad
    bunting(b, [-9.4, 7, 6], [9.4, 6.4, 7], 8, 1.6);
    b.build(G, true);
  }

  // ======== 5. cosy room (night) ========
  {
    const b = new Batch(), G = groups.room, X = 7, Zb = -3.4, Zf = 14;
    b.add(flatRect(-X, X, Zb, Zf, 0, 2), plankM());
    const wall = lam("d_roomWall", () => ({ color: "#d79a78" })), wain = lam("d_wain", () => ({ color: "#7a5a46" }));
    bx(b, wall, -X, X, 0, 4.4, Zb - 0.3, Zb); bx(b, wall, -X - 0.3, -X, 0, 4.4, Zb, Zf); bx(b, wall, X, X + 0.3, 0, 4.4, Zb, Zf);
    bx(b, wain, -X, X, 0, 1.2, Zb, Zb + 0.12); bx(b, wain, -X + 0.0, -X + 0.12, 0, 1.2, Zb, Zf); bx(b, wain, X - 0.12, X, 0, 1.2, Zb, Zf);
    bx(b, M.woodDk(), -X, X, 4.2, 4.5, Zb, Zb + 0.3);
    // window with night sky and curtains
    bx(b, M.woodDk(), -1.9, 1.9, 1.6, 4.0, Zb + 0.0, Zb + 0.12);
    b.add(quad(V(-1.7, 1.8, Zb + 0.14), V(1.7, 1.8, Zb + 0.14), V(1.7, 3.8, Zb + 0.14), V(-1.7, 3.8, Zb + 0.14)), glow([0.5, 0.6, 1.5]));
    bx(b, M.woodDk(), -0.06, 0.06, 1.8, 3.8, Zb + 0.15, Zb + 0.2); bx(b, M.woodDk(), -1.7, 1.7, 2.75, 2.85, Zb + 0.15, Zb + 0.2);
    for (const s of [-1, 1]) b.add(quad(V(s * 2.4, 1.2, Zb + 0.3), V(s * 1.4, 1.2, Zb + 0.3), V(s * 1.4, 4.1, Zb + 0.3), V(s * 2.4, 4.1, Zb + 0.3)), lam("d_curt", () => ({ color: "#a8423f", side: THREE.DoubleSide })));
    // sofa (seat top 0.42) for five
    const sofa = lam("d_sofa", () => ({ color: "#4f6aa8" }));
    bx(b, sofa, -3.0, 3.0, 0, 0.42, -0.5, 0.8); bx(b, sofa, -3.0, 3.0, 0.42, 1.5, -0.7, -0.4); bx(b, sofa, -3.2, -2.8, 0, 1.0, -0.6, 0.9); bx(b, sofa, 2.8, 3.2, 0, 1.0, -0.6, 0.9);
    for (let i = 0; i < 5; i++) b.add(new THREE.SphereGeometry(0.28, 8, 6).scale(1.2, 0.5, 0.9), lam("d_cush" + i % 3, () => ({ color: ["#e2b04a", "#c8553a", "#e9d7a8"][i % 3] })), at(-2.2 + i * 1.1, 0.5, 0.2));
    // rug, shelves with colourful books, pictures, lamps, fireplace, plant
    b.add(new THREE.CircleGeometry(3.2, 28).rotateX(-Math.PI / 2).translate(0, 0.015, 3.8), lam("d_rug", () => ({ color: "#b8493f" })));
    b.add(new THREE.RingGeometry(2.2, 2.5, 28).rotateX(-Math.PI / 2).translate(0, 0.02, 3.8), C("rugR", "#e2b04a"));
    for (const s of [-1, 1]) {
      bx(b, M.woodDk(), s * 5.4 - 1.0, s * 5.4 + 1.0, 0.0, 3.6, Zb + 0.1, Zb + 0.8);
      for (let sh = 0; sh < 4; sh++) for (let k = 0; k < 9; k++) b.add(new THREE.BoxGeometry(0.16, 0.5, 0.5).translate(s * 5.4 - 0.85 + k * 0.21, 0.35 + sh * 0.9, Zb + 0.45), C("bk" + ((k + sh) % 6), ["#c8323a", "#3f6fb5", "#f2c230", "#3f8f5a", "#8c5aa8", "#e9d7a8"][(k + sh) % 6]));
    }
    for (const [x, y, c] of [[-3.2, 2.9, "#e2b04a"], [3.3, 3.0, "#5aa0c8"], [-3.4, 2.1, "#c8553a"]] as const) { bx(b, M.woodDk(), x - 0.42, x + 0.42, y - 0.05, y + 0.65, Zb + 0.1, Zb + 0.16); bx(b, C("pic" + c, c), x - 0.34, x + 0.34, y + 0.03, y + 0.57, Zb + 0.16, Zb + 0.2); }
    for (const s of [-1, 1]) { b.add(cyl(0.05, 1.9, 6), M.woodDk(), at(s * 6.2, 0, 1.6)); b.add(new THREE.ConeGeometry(0.4, 0.5, 10, 1, true).translate(0, 2.1, 0), lam("d_shade", () => ({ color: "#f2d9a0", side: THREE.DoubleSide })), at(s * 6.2, 0, 1.6)); b.add(new THREE.SphereGeometry(0.17, 8, 6).translate(0, 2.0, 0), glow([5, 3.4, 1.4]), at(s * 6.2, 0, 1.6)); }
    b.add(new THREE.CylinderGeometry(0.34, 0.26, 0.5, 10).translate(0, 0.25, 0), C("pot", "#b8684a"), at(-6.2, 0, 4.4)); b.add(new THREE.SphereGeometry(0.6, 10, 8), C("flg", "#4f8a3a"), at(-6.2, 1.0, 4.4));
    table(b, 3.6, 3.8, 0.3, 1.2, 0.8, 0.55); b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 6).translate(0, 0.65, 0), M.cloth(), at(3.6, 0, 3.8)); b.add(new THREE.SphereGeometry(0.06, 6, 5).scale(1, 1.6, 1).translate(0, 0.82, 0), glow([6, 3.6, 1.2]), at(3.6, 0, 3.8));
    b.build(G, false);
  }

  // ======== 6. mountain chapel ========
  let statueGlow: THREE.Mesh;
  {
    const b = new Batch(), G = groups.chapel, X = 9, Z0 = -16, Z1 = 14, H = 14;
    b.add(flatRect(-X, X, Z0, Z1, 0, 3), slabM());
    const st = lam("d_chapStone", () => ({ map: stoneHD("chapHD", ["#cfc3ae", "#c2b59f", "#d6cbb7", "#b8ab94"], "#8a7e6c") }));
    bx(b, st, -X - 0.8, -X, 0, H, Z0, Z1); bx(b, st, X, X + 0.8, 0, H, Z0, Z1); bx(b, st, -X, X, 0, H, Z0 - 0.8, Z0);
    const glass = gothicTex("chap", ["#ffd98a", "#f09a4c"]);
    const gm = new THREE.MeshBasicMaterial({ map: glass, alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(1.9, 1.6, 1.2) });
    const wins = new THREE.Group();
    for (const x of [-5.4, 0, 5.4]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 7.6), gm); m.position.set(x, 8.2, Z0 + 0.06); wins.add(m); }
    for (const s of [-1, 1]) for (const z of [-8, -1, 6]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 6.2), gm); m.rotation.y = -s * Math.PI / 2; m.position.set(s * (X - 0.06), 7.6, z); wins.add(m); }
    G.add(wins);
    for (const s of [-1, 1]) for (const z of [-12, -4.5, 3, 10]) { b.add(cyl(0.7, H - 0.8, 10), st, at(s * 6.4, 0, z)); b.add(boxGeo(V(s * 6.4 - 0.9, 0, z - 0.9), V(s * 6.4 + 0.9, 0.5, z + 0.9), 2), st); }
    for (let z = Z0 + 1; z < Z1; z += 5) bx(b, M.woodDk(), -X, X, H - 0.7, H - 0.2, z - 0.25, z + 0.25);
    // altar + statue pedestal, candles, pews, banners, rope bell
    bx(b, st, -3.5, 3.5, 0, 0.6, -12.5, -6.5); bx(b, st, -1.6, 1.6, 0.6, 1.6, -10.5, -7.8);
    bx(b, lam("d_altarCl", () => ({ color: "#e9dcc0" })), -3.2, 3.2, 0.6, 0.72, -12.2, -6.8);
    for (const x of [-3, -2, 2, 3]) { b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8).translate(0, 0.3, 0), M.cloth(), at(x, 0.72, -7.3)); b.add(new THREE.SphereGeometry(0.1, 6, 5).scale(1, 1.6, 1).translate(0, 0.72, 0), glow([6, 3.8, 1.2]), at(x, 0.72, -7.3)); }
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) bx(b, M.woodLt(), s * 4.2 - 1.8, s * 4.2 + 1.8, 0, 0.45, 8 - i * 1.7 - 0.2, 8 - i * 1.7 + 0.2);
    prop(b, kit, "banner-red", -7.8, 2.2, -13, 4.4, Math.PI / 2); prop(b, kit, "banner-red", 7.8, 2.2, -13, 4.4, -Math.PI / 2);
    b.build(G, false);
    statueGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: ctex("glowDisc2", 256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }),
      color: new THREE.Color(2.4, 1.7, 0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    statueGlow.position.set(0, 3.3, -10.3); statueGlow.layers.set(NOINK); G.add(statueGlow);
  }

  // the bread stall of shot 16 at the origin (only visible in that shot)
  const bread = new THREE.Group(); bread.visible = false; root.add(bread);
  {
    const b = new Batch(), cl = lam("d_tcloth", () => ({ color: "#9a8268" }));
    b.add(new THREE.BoxGeometry(2.3, 0.05, 1.1).translate(0, 0.93, 0), cl, at(0, 0, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(new THREE.BoxGeometry(0.1, 0.92, 0.1).translate(sx * 1.05, 0.46, sz * 0.48), M.woodDk(), at(0, 0, 0));
    b.add(new THREE.BoxGeometry(2.3, 0.5, 0.04).translate(0, 0.66, 0.52), cl, at(0, 0, 0));
    for (const [x, z] of [[-1.6, -1.5], [1.4, -1.8]] as const) { b.add(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6).translate(0, 1.2, 0), M.woodDk(), at(x, 0, z)); b.add(new THREE.BoxGeometry(0.4, 0.4, 0.02).translate(0, 2.1, 0), glow([1.6, 1.0, 0.4]), at(x, 0, z)); }
    b.build(bread, true);
  }
  return { groups, statueGlow: statueGlow!, gothic, bread };
};
