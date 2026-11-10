// Set dressing per shot (look pass "dressing"): story-specific props, readable diegetic signs, foreground framing
// props and overhanging boughs, plus the practical light pools (lanterns, floodlights, bus lights) per shot.
// Every group here belongs to one set and is shown only in the shots listed with it (world.ts toggles them), so each
// shot can be dressed like a film set without cluttering the other camera angles of the same place.
import * as THREE from "three";
import { Batch, lam, V, Kit, kitClone, M4, beamGeo, leafMat, barkMat, lobeGeo, trunkGeo } from "./build";
import { ctex, rng, rep, mudTex } from "./paint";
import { SetId, V3, RW } from "./story";

export type ShotDress = { shots: number[]; group: THREE.Group; f1?: number };
type Mat = THREE.Material;

// ---------------- materials ----------------
const C = (key: string, color: string) => lam("dr_" + key, () => ({ color }));
const M = {
  wood: () => C("wood", "#9a6a44"), woodDk: () => C("woodDk", "#6e4a30"), woodLt: () => C("woodLt", "#c4935e"),
  iron: () => C("iron", "#5d6270"), rope: () => C("rope", "#cfa96c"), stone: () => C("stone", "#cbbfa8"), stoneDk: () => C("stoneDk", "#a99d88"),
  sack: () => C("sack", "#d9c49a"), mortar: () => C("mortar", "#d8d2c4"), red: () => C("red", "#c8323a"), white: () => C("white", "#f1ece0"),
  orange: () => C("orange", "#f07a2a"), yellow: () => C("yellow", "#f2c230"), green: () => C("green", "#3f6e4a"), pole: () => C("pole", "#2f3a3a"),
  pigeon: () => C("pigeon", "#8f95a8"), pigeonDk: () => C("pigeonDk", "#5f6478"), beak: () => C("beak", "#e0a050"), hay: () => C("hay", "#e1bb5c"),
  blue: () => C("blue", "#3f6fb5"), cream: () => C("cream", "#efe2c2"), steel: () => C("steel", "#9aa1aa"), dirt: () => lam("dr_dirt", () => ({ map: rep(mudTex(), 0.25, 0.25) })),
};
/** self-lit glass / bulb (bloom above 1.0): lit = night practical, otherwise a pale unlit glass */
const glow = (on: boolean, col: [number, number, number] = [3.2, 2.2, 1.0]) => {
  const k = "glow" + on + col.join("_");
  let m = glows.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: on ? new THREE.Color(...col) : new THREE.Color(0.95, 0.93, 0.85), toneMapped: true }); glows.set(k, m); }
  return m;
};
const glows = new Map<string, THREE.MeshBasicMaterial>();

// ---------------- signs: painted boards, partly self-lit so a side sun never greys them out ----------------
type SignStyle = { bg: string; fg: string; border?: string; font?: string; sub?: string };
const signMat = (key: string, lines: string[], w: number, h: number, st: SignStyle) => {
  const pxW = 1024, pxH = Math.round((1024 * h) / w);
  const tex = ctex("sign_" + key, pxW, pxH, (g) => {
    g.fillStyle = st.bg; g.fillRect(0, 0, pxW, pxH);
    const b = Math.round(pxH * 0.07);
    g.strokeStyle = st.border ?? st.fg; g.lineWidth = b * 0.55; g.strokeRect(b, b, pxW - 2 * b, pxH - 2 * b);
    g.fillStyle = st.fg; g.textAlign = "center"; g.textBaseline = "middle";
    const n = lines.length, lh = (pxH - 4 * b) / n;
    lines.forEach((t, i) => {
      let fs = Math.min(lh * (i === 0 ? 0.78 : 0.6), 400);
      g.font = `${st.font ?? "bold"} ${fs}px "DejaVu Serif", Georgia, serif`;
      while (g.measureText(t).width > pxW - 5 * b && fs > 10) { fs *= 0.92; g.font = `${st.font ?? "bold"} ${fs}px "DejaVu Serif", Georgia, serif`; }
      g.fillText(t, pxW / 2, 2 * b + lh * (i + 0.5));
    });
  });
  tex.anisotropy = 8;
  const k = "dr_signM_" + key;
  return lam(k, () => ({ map: tex, emissiveMap: tex, emissive: new THREE.Color(0.42, 0.42, 0.42) }));
};
/** board on one or two posts; face toward +z rotated by yaw; y0 = board bottom */
const sign = (b: Batch, key: string, lines: string[], x: number, z: number, yaw: number, w: number, h: number, y0: number, st: SignStyle, posts = 2, ground = 0) => {
  const m = M4(x, ground, z, yaw), mat = signMat(key, lines, w, h, st);
  b.add(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.08).translate(0, y0 + h / 2, -0.05), M.woodDk(), m);
  const face = new THREE.PlaneGeometry(w, h).translate(0, y0 + h / 2, 0.0);
  b.add(face, mat, m);
  if (posts === 2) for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.12, y0 + h, 0.12).translate(s * (w / 2 - 0.12), (y0 + h) / 2, -0.12), M.woodDk(), m);
  else if (posts === 1) b.add(new THREE.BoxGeometry(0.13, y0 + h * 0.6, 0.13).translate(0, (y0 + h * 0.6) / 2, -0.13), M.woodDk(), m);
};

// ---------------- prop primitives ----------------
const at = (x: number, y: number, z: number, yaw = 0, s: [number, number, number] = [1, 1, 1]) => M4(x, y, z, yaw, s);
const R3 = (ax: number, ay: number, az: number) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(ax, ay, az, "YXZ"));
const box = (b: Batch, m: Mat, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0) =>
  b.add(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), m, at(x, y, z, yaw));
const PS = 1.4; // cartoon hero scale for hand props (reference props read big in frame)
const bucket = (b: Batch, x: number, y: number, z: number, s0 = 1) => {
  const s = s0 * PS, m = at(x, y, z, 0, [s, s, s]);
  b.add(new THREE.CylinderGeometry(0.2, 0.16, 0.36, 14, 1, true).translate(0, 0.18, 0), lam("dr_bucketIn", () => ({ color: "#8a5a34", side: THREE.DoubleSide })), m);
  b.add(new THREE.CircleGeometry(0.16, 14).rotateX(-Math.PI / 2).translate(0, 0.08, 0), C("bucketFill", "#7d6a52"), m);
  for (const yy of [0.06, 0.29]) b.add(new THREE.TorusGeometry(0.17 + yy * 0.1, 0.012, 5, 18).rotateX(Math.PI / 2).translate(0, yy, 0), M.iron(), m);
  b.add(new THREE.TorusGeometry(0.2, 0.01, 4, 16, Math.PI).translate(0, 0.36, 0), M.iron(), m);
};
const coil = (b: Batch, x: number, y: number, z: number, s0 = 1) => {
  const s = s0 * PS;
  for (let i = 0; i < 4; i++) b.add(new THREE.TorusGeometry(0.32 - i * 0.025, 0.045, 6, 20).rotateX(Math.PI / 2), M.rope(), at(x, y + (0.045 + i * 0.075) * s, z, 0, [s, s, s]));
};
const barrel = (b: Batch, x: number, y: number, z: number, s0 = 1) => {
  const s = s0 * 1.2;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(0.3 + 0.06 * Math.sin(Math.PI * t), t * 0.9)); }
  const m = at(x, y, z, 0, [s, s, s]);
  b.add(new THREE.LatheGeometry(pts, 16), M.wood(), m);
  b.add(new THREE.CircleGeometry(0.3, 16).rotateX(-Math.PI / 2).translate(0, 0.9, 0), M.woodLt(), m);
  for (const yy of [0.15, 0.75]) b.add(new THREE.TorusGeometry(0.335, 0.015, 5, 20).rotateX(Math.PI / 2).translate(0, yy, 0), M.iron(), m);
};
const crate = (b: Batch, x: number, y: number, z: number, s = 0.8, yaw = 0) => {
  box(b, M.woodLt(), x, y, z, s, s, s, yaw);
  const m = at(x, y, z, yaw);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(new THREE.BoxGeometry(0.07, s + 0.01, 0.07).translate(sx * s / 2, s / 2, sz * s / 2), M.woodDk(), m);
  b.add(new THREE.BoxGeometry(s * 1.2, 0.07, 0.03).rotateZ(Math.atan2(s, s)).translate(0, s / 2, s / 2 + 0.02), M.woodDk(), m);
};
const sack = (b: Batch, x: number, y: number, z: number, s0 = 1, yaw = 0, s = s0 * PS) =>
  b.add(new THREE.SphereGeometry(0.3, 14, 10), M.sack(), at(x, y + 0.2 * s, z, yaw, [0.85 * s, 0.7 * s, 0.6 * s]));
const stones = (b: Batch, r: () => number, x: number, y: number, z: number, n = 6, s = 1) => {
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = r() * 0.7 * s, k = (0.18 + r() * 0.2) * s;
    b.add(new THREE.DodecahedronGeometry(1, 0), i % 2 ? M.stone() : M.stoneDk(), at(x + Math.cos(a) * d, y + k * 0.5, z + Math.sin(a) * d, r() * 6, [k * 1.3, k * 0.8, k]));
  }
};
const blocks = (b: Batch, x: number, y: number, z: number, yaw: number) => {
  const mm = C("blockSq", "#ece4d2");
  for (let i = 0; i < 5; i++) box(b, mm, x + ((i % 3) - 1) * 0.62 * Math.cos(yaw), y + Math.floor(i / 3) * 0.4, z - ((i % 3) - 1) * 0.62 * Math.sin(yaw), 0.58, 0.4, 0.42, yaw);
};
/** long tool: shaft from (x,y,z) leaning with angle tilt toward yaw; head = shovel | pick | rake */
const tool = (b: Batch, kind: "shovel" | "pick" | "rake", x: number, y: number, z: number, yaw: number, tilt: number) => {
  const L = 1.25, rot = R3(0, yaw, tilt), base = new THREE.Matrix4().makeTranslation(x, y, z).multiply(rot);
  b.add(new THREE.CylinderGeometry(0.022, 0.026, L, 7).translate(0, L / 2 + 0.25, 0), M.woodLt(), base);
  if (kind === "shovel") b.add(new THREE.BoxGeometry(0.24, 0.3, 0.03).translate(0, 0.14, 0), M.steel(), base);
  else if (kind === "pick") b.add(new THREE.CylinderGeometry(0.03, 0.005, 0.6, 6).rotateZ(Math.PI / 2).translate(0, L + 0.22, 0), M.iron(), base);
  else b.add(new THREE.BoxGeometry(0.42, 0.05, 0.05).translate(0, L + 0.25, 0), M.iron(), base);
};
const toolsOnGround = (b: Batch, x: number, y: number, z: number, yaw: number) => {
  tool(b, "shovel", x, y + 0.05, z, yaw, Math.PI / 2 - 0.05);
  tool(b, "pick", x + 0.3, y + 0.05, z - 0.4, yaw + 0.5, Math.PI / 2 - 0.05);
  tool(b, "rake", x - 0.4, y + 0.05, z + 0.2, yaw - 0.4, Math.PI / 2 - 0.05);
};
const wheelbarrow = (b: Batch, x: number, y: number, z: number, yaw: number, load: Mat | null) => {
  const m = at(x, y, z, yaw, [1.3, 1.3, 1.3]);
  b.add(new THREE.BoxGeometry(0.75, 0.32, 0.6).translate(0.05, 0.55, 0), M.wood(), m);
  if (load) b.add(new THREE.SphereGeometry(0.33, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.05, 0.55, 0.85).translate(0.05, 0.7, 0), load, m);
  b.add(new THREE.TorusGeometry(0.2, 0.05, 6, 14), M.woodDk(), m.clone().multiply(new THREE.Matrix4().makeTranslation(0.55, 0.2, 0)));
  for (const s of [-1, 1]) {
    b.add(beamGeo(V(0.55, 0.22, s * 0.05), V(-0.9, 0.62, s * 0.27), 0.05), M.woodDk(), m);
    b.add(beamGeo(V(-0.25, 0.4, s * 0.25), V(-0.3, 0.0, s * 0.25), 0.05), M.woodDk(), m);
  }
};
const tub = (b: Batch, x: number, y: number, z: number) => {
  const k: [number, number, number] = [1.3, 1.3, 1.3];
  b.add(new THREE.CylinderGeometry(0.55, 0.48, 0.32, 18).translate(0, 0.16, 0), M.wood(), at(x, y, z, 0, k));
  b.add(new THREE.CircleGeometry(0.5, 18).rotateX(-Math.PI / 2).translate(0, 0.3, 0), M.mortar(), at(x, y, z, 0, k));
  b.add(new THREE.TorusGeometry(0.53, 0.02, 4, 20).rotateX(Math.PI / 2).translate(0, 0.25, 0), M.iron(), at(x, y, z, 0, k));
  b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5).rotateZ(0.7).translate(0.2, 0.55, 0), M.woodLt(), at(x, y, z, 0, k)); // mixing paddle
};
const sawhorse = (b: Batch, x: number, y: number, z: number, yaw: number) => {
  const m = at(x, y, z, yaw);
  b.add(new THREE.BoxGeometry(1.6, 0.1, 0.12).translate(0, 0.8, 0), M.woodLt(), m);
  for (const sx of [-0.65, 0.65]) for (const sz of [-1, 1]) b.add(beamGeo(V(sx, 0.8, 0), V(sx * 1.1, 0, sz * 0.32), 0.06), M.wood(), m);
  b.add(new THREE.BoxGeometry(2.2, 0.05, 0.3).translate(0.2, 0.88, 0), M.woodLt(), m); // plank on it
};
const pigeon = (b: Batch, x: number, y: number, z: number, yaw: number, peck: number) => {
  const m = at(x, y, z, yaw);
  b.add(new THREE.SphereGeometry(1, 12, 9), M.pigeon(), m.clone().multiply(new THREE.Matrix4().compose(V(0, 0.13, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(peck * 0.4, 0, 0)), V(0.1, 0.09, 0.16))));
  b.add(new THREE.SphereGeometry(0.055, 10, 8), M.pigeonDk(), m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.23 - peck * 0.12, 0.13 + peck * 0.04)));
  b.add(new THREE.ConeGeometry(0.014, 0.05, 5).rotateX(Math.PI / 2).translate(0, 0.225 - peck * 0.12, 0.19 + peck * 0.04), M.beak(), m);
  b.add(new THREE.BoxGeometry(0.09, 0.02, 0.12).translate(0, 0.14, -0.17), M.pigeonDk(), m);
  for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 4).translate(s * 0.03, 0.03, 0), M.beak(), m);
};
const flock = (b: Batch, r: () => number, x: number, z: number, n: number, spread = 1.4, y = 0) => {
  for (let i = 0; i < n; i++) pigeon(b, x + (r() - 0.5) * 2 * spread, y, z + (r() - 0.5) * 2 * spread, r() * 6.28, r() < 0.4 ? 1 : 0);
};
/** modern lamp post: dark green pole, lantern head; lit = glowing at night */
const lampPost = (b: Batch, x: number, z: number, lit: boolean, h = 3.8, y = 0) => {
  b.add(new THREE.CylinderGeometry(0.07, 0.11, h, 10).translate(0, h / 2, 0), M.green(), at(x, y, z));
  b.add(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 10).translate(0, 0.06, 0), M.green(), at(x, y, z));
  b.add(new THREE.CylinderGeometry(0.17, 0.12, 0.42, 6).translate(0, h + 0.21, 0), glow(lit), at(x, y, z));
  b.add(new THREE.ConeGeometry(0.26, 0.24, 6).translate(0, h + 0.54, 0), M.green(), at(x, y, z));
};
/** medieval hanging lantern on a bracket */
const lantern = (b: Batch, x: number, y: number, z: number, lit: boolean) => {
  b.add(new THREE.BoxGeometry(0.22, 0.3, 0.22).translate(0, -0.15, 0), glow(lit, [3.4, 2.1, 0.8]), at(x, y, z));
  b.add(new THREE.ConeGeometry(0.2, 0.14, 4).rotateY(Math.PI / 4).translate(0, 0.06, 0), M.iron(), at(x, y, z));
  b.add(new THREE.BoxGeometry(0.26, 0.04, 0.26).translate(0, -0.32, 0), M.iron(), at(x, y, z));
};
const cone = (b: Batch, x: number, z: number, y = 0) => {
  b.add(new THREE.ConeGeometry(0.17, 0.62, 12).translate(0, 0.33, 0), M.orange(), at(x, y, z));
  b.add(new THREE.CylinderGeometry(0.105, 0.125, 0.1, 12).translate(0, 0.36, 0), M.white(), at(x, y, z));
  b.add(new THREE.BoxGeometry(0.42, 0.04, 0.42).translate(0, 0.02, 0), M.orange(), at(x, y, z));
};
const bench = (b: Batch, x: number, z: number, yaw: number) => {
  const m = at(x, 0, z, yaw);
  for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(1.8, 0.05, 0.13).translate(0, 0.45, -0.18 + i * 0.16), M.woodLt(), m);
  for (let i = 0; i < 2; i++) b.add(new THREE.BoxGeometry(1.8, 0.12, 0.04).translate(0, 0.66 + i * 0.17, -0.3), M.woodLt(), m);
  for (const s of [-0.75, 0.75]) { b.add(new THREE.BoxGeometry(0.06, 0.45, 0.45).translate(s, 0.225, -0.03), M.pole(), m); b.add(new THREE.BoxGeometry(0.06, 0.5, 0.05).translate(s, 0.7, -0.31), M.pole(), m); }
};
const bin = (b: Batch, x: number, z: number) => {
  b.add(new THREE.CylinderGeometry(0.26, 0.24, 0.85, 12, 1, true).translate(0, 0.43, 0), lam("dr_binM", () => ({ color: "#2f5a46", side: THREE.DoubleSide })), at(x, 0, z));
  b.add(new THREE.TorusGeometry(0.26, 0.03, 5, 16).rotateX(Math.PI / 2).translate(0, 0.86, 0), M.pole(), at(x, 0, z));
};
/** parasol (market umbrella) */
const parasol = (b: Batch, x: number, z: number, cA: Mat, cB: Mat, h = 2.4, rr = 1.4) => {
  b.add(new THREE.CylinderGeometry(0.03, 0.03, h, 6).translate(0, h / 2, 0), M.pole(), at(x, 0, z));
  for (let i = 0; i < 8; i++) {
    const g = new THREE.ConeGeometry(rr, 0.5, 8, 1, true, (i * Math.PI) / 4, Math.PI / 4).translate(0, h + 0.1, 0);
    b.add(g, i % 2 ? cA : cB, at(x, 0, z));
  }
};
/** souvenir / gelato stall: counter, striped awning, sign board on top */
const stall = (b: Batch, x: number, z: number, yaw: number, key: string, text: string, awA: Mat, signSt: SignStyle, goods: "towers" | "gelato") => {
  const m = at(x, 0, z, yaw);
  b.add(new THREE.BoxGeometry(2.4, 1.0, 0.9).translate(0, 0.5, 0), M.cream(), m);
  b.add(new THREE.BoxGeometry(2.5, 0.06, 1.0).translate(0, 1.03, 0), M.woodLt(), m);
  for (const s of [-1.15, 1.15]) b.add(new THREE.BoxGeometry(0.07, 2.4, 0.07).translate(s, 1.2, -0.38), M.woodDk(), m);
  for (let i = 0; i < 6; i++) b.add(new THREE.BoxGeometry(0.42, 0.05, 1.3).translate(-1.05 + i * 0.42, 2.38, 0.25).applyMatrix4(new THREE.Matrix4().makeRotationX(0.22)), i % 2 ? awA : M.white(), m);
  const sm = signMat(key, [text], 2.0, 0.5, signSt);
  b.add(new THREE.BoxGeometry(2.1, 0.58, 0.06).translate(0, 2.95, -0.36), M.woodDk(), m);
  b.add(new THREE.PlaneGeometry(2.0, 0.5).translate(0, 2.95, -0.32), sm, m);
  if (goods === "towers") for (let i = 0; i < 7; i++) {
    const t = new THREE.CylinderGeometry(0.05, 0.06, 0.32, 8).translate(0, 0.16, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(0.12));
    b.add(t, M.white(), m.clone().multiply(new THREE.Matrix4().makeTranslation(-0.9 + i * 0.3, 1.06, 0.15 + (i % 2) * 0.15)));
  } else for (let i = 0; i < 6; i++) b.add(new THREE.SphereGeometry(0.11, 10, 8), [C("gelA", "#f4a7c0"), C("gelB", "#f7e2a0"), C("gelC", "#a8dcb4")][i % 3], m.clone().multiply(new THREE.Matrix4().makeTranslation(-0.75 + i * 0.3, 1.1, 0.2)));
};
/** an overhanging bough entering the top of frame: trunk at (tx, tz) off frame, bough curving to the tip */
const bough = (b: Batch, tx: number, tz: number, tip: V3, rad = 1.2, seed = 3) => {
  const r = rng(seed), y0 = tip[1] - 1.5;
  b.add(trunkGeo(), barkMat(), at(tx, -0.1, tz, 0, [0.35, y0 + 1.2, 0.35]));
  const a = V(tx, y0 + 1, tz), c = V(...tip);
  const mid = a.clone().lerp(c, 0.5).add(V(0, 0.9, 0));
  const pts = new THREE.QuadraticBezierCurve3(a, mid, c).getPoints(8);
  for (let i = 0; i < pts.length - 1; i++) b.add(beamGeo(pts[i], pts[i + 1], 0.22 - i * 0.018), barkMat(), undefined);
  for (let i = 3; i < pts.length; i++) for (let k = 0; k < 3; k++) {
    const p = pts[i], s = rad * (0.55 + 0.5 * r()) * (0.6 + 0.4 * (i / pts.length));
    b.add(lobeGeo(0), leafMat(Math.floor(r() * 4)), at(p.x + (r() - 0.5) * 1.6, p.y + (r() - 0.3) * 0.7, p.z + (r() - 0.5) * 1.6, r() * 6, [s, s * 0.8, s]));
  }
};
const flagPole = (b: Batch, x: number, z: number, h: number, mat: Mat, y = 0) => {
  b.add(new THREE.CylinderGeometry(0.035, 0.045, h, 8).translate(0, h / 2, 0), M.woodDk(), at(x, y, z));
  const g = new THREE.PlaneGeometry(1.1, 0.7, 8, 1).translate(0.55, h - 0.4, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.08 * Math.sin(p.getX(i) * 5));
  g.computeVertexNormals();
  b.add(g, mat, at(x, y, z, 0.4));
};
const flagMat = (key: string, draw: (g: CanvasRenderingContext2D) => void) => lam("dr_flag" + key, () => ({ map: ctex("drflag" + key, 256, 160, draw), side: THREE.DoubleSide }));
const pisaFlag = () => flagMat("pisa", (g) => { g.fillStyle = "#c8323a"; g.fillRect(0, 0, 256, 160); g.fillStyle = "#f4f0e6"; g.fillRect(112, 18, 32, 124); g.fillRect(70, 62, 116, 32); });
const italyFlag = () => flagMat("italy", (g) => { for (const [i, c] of ["#2f8a4a", "#f4f0e6", "#c8323a"].entries()) { g.fillStyle = c; g.fillRect(i * 86, 0, 86, 160); } });
const hut = (b: Batch, x: number, z: number, yaw: number, key: string, text: string) => {
  const m = at(x, 0, z, yaw);
  b.add(new THREE.BoxGeometry(3.6, 2.5, 2.3).translate(0, 1.35, 0), C("hutW", "#e8e2d2"), m);
  b.add(new THREE.BoxGeometry(3.8, 0.12, 2.5).translate(0, 2.66, 0), C("hutR", "#6f7a88"), m);
  b.add(new THREE.BoxGeometry(3.7, 0.2, 2.4).translate(0, 0.1, 0), M.pole(), m);
  b.add(new THREE.BoxGeometry(0.85, 1.9, 0.04).translate(-1.0, 1.15, 1.16), C("hutD", "#3f6fb5"), m);
  b.add(new THREE.BoxGeometry(1.1, 0.7, 0.04).translate(0.8, 1.7, 1.16), glow(false), m);
  const sm = signMat(key, [text], 1.6, 0.4, { bg: "#f2c230", fg: "#1d1d24" });
  b.add(new THREE.PlaneGeometry(1.6, 0.4).translate(0.8, 0.95, 1.17), sm, m);
};
/** floodlight on a tripod, head aimed by yaw / pitch (glows when lit) */
const floodlight = (b: Batch, x: number, z: number, yaw: number, lit: boolean, h = 3.2) => {
  const m = at(x, 0, z, yaw);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; b.add(beamGeo(V(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6), V(0, h, 0), 0.05), M.pole(), m); }
  b.add(new THREE.BoxGeometry(0.7, 0.5, 0.25).translate(0, h + 0.2, 0), M.pole(), m);
  b.add(new THREE.PlaneGeometry(0.6, 0.4).translate(0, h + 0.2, 0.13), glow(lit, [4, 3.2, 2]), m);
};

// ---------------- light pools per shot (world coordinates; world.ts moves them into view space) ----------------
export type Pool = { p: V3; c: [number, number, number]; r: number };
const WARM: [number, number, number] = [1.5, 0.9, 0.38];
export const poolsAt = (id: number, t: number): Pool[] => {
  if (id >= 16 && id <= 18) {
    // bus: ceiling lamps + street lamps sweeping past both windows (bus driving forward = lights run toward +z)
    const out: Pool[] = [
      { p: [0.8, 2.1, 0.4], c: [0.55, 0.4, 0.2], r: 2.6 }, { p: [-0.8, 2.1, -2.6], c: [0.55, 0.4, 0.2], r: 2.6 }, { p: [0.8, 2.1, -4.6], c: [0.5, 0.36, 0.18], r: 2.4 },
    ];
    for (const [k, side] of [[0, 1], [0.5, -1], [0.27, 1]] as const) {
      const u = ((t * 0.55 + k) % 1 + 1) % 1;
      out.push({ p: [side * 1.9, 1.75, -8 + 16 * u], c: [1.7, 0.95, 0.42], r: 3.0 });
    }
    return out;
  }
  if (id === 14 || id === 15 || id === 19) return [
    { p: [-7, 1.5, 11], c: [2.3, 1.35, 0.55], r: 15 }, { p: [7, 1.5, 11], c: [2.3, 1.35, 0.55], r: 15 },
    { p: [-24, 4.4, 0.5], c: [2.4, 1.4, 0.55], r: 10 }, { p: [24, 4.4, 0.5], c: [2.4, 1.4, 0.55], r: 10 },
  ];
  if (id >= 10 && id <= 13) return [{ p: [-9.2, 2.4, 18.5], c: [0.6, 0.38, 0.18], r: 5 }]; // the site hut's window lamp at sunset
  return [];
};

// ---------------- the dressing ----------------
export const buildDress = (kit: Kit, groups: Record<SetId, THREE.Group>): ShotDress[] => {
  const out: ShotDress[] = [];
  const r = rng(77);
  const make = (set: SetId, shots: number[], fill: (b: Batch) => void, f1?: number) => {
    const b = new Batch(), g = new THREE.Group();
    fill(b); b.build(g);
    g.visible = false; groups[set].add(g); out.push({ shots, group: g, f1 });
  };
  const kitAt = (set: SetId, shots: number[], name: string, x: number, y: number, z: number, h: number, yaw = 0) => {
    const o = kitClone(kit, name, h);
    if (!o) return;
    o.position.set(x, y, z); o.rotation.y = yaw; o.visible = false; groups[set].add(o); out.push({ shots, group: o as THREE.Group });
  };
  const PY = -0.6, gy = (x: number, z: number) => (Math.hypot(x, z) < 11 ? PY : 0);

  // ===== 1173 building site: the whole yard (shots 2, 3, 4a, 7, 8) =====
  make("site", [2, 3, 4, 7, 8], (b) => {
    // inside the pit, in front of the first ring, framed for the crane-down (2b) and Beppe's level (3)
    wheelbarrow(b, 2.0, gy(2.0, 12.2), 12.2, 2.0, M.dirt()); tub(b, 4.6, gy(4.6, 11.2), 11.2); blocks(b, 0.4, gy(0.4, 10.6), 10.6, 0.15);
    bucket(b, 3.4, gy(3.4, 13.4), 13.4); bucket(b, 5.7, gy(5.7, 12.6), 12.6, 0.9); stones(b, r, -4.6, PY, 9.9, 7, 1.3); tub(b, -5.6, gy(-5.6, 9.0), 9.0);
    toolsOnGround(b, 7.4, gy(7.4, 9.8), 9.8, 0.4); coil(b, -2.4, gy(-2.4, 10.4), 10.4);
    // the yard between the pit and the lenses
    blocks(b, 1.8, 0, 15.0, 0.4); barrel(b, 6.3, 0, 15.1); barrel(b, 7.0, 0, 14.3, 0.9); stones(b, r, 6.6, 0, 16.3, 6, 1.2);
    crate(b, -6.8, 0, 13.4, 1.0, 0.3); crate(b, -7.5, 0.0, 12.4, 0.8, 0.1); sack(b, -5.9, 0, 12.9); sack(b, -6.3, 0, 12.2, 0.9, 1);
    sawhorse(b, 11.6, 0, 15.6, 1.1); stones(b, r, 12.6, 0, 9.5, 8, 1.4); tub(b, -9.8, 0, 11.2); barrel(b, 10.2, 0, 12.6);
    for (const [x, z, k] of [[7.6, 13.6, 0], [-4.2, 13.2, 1]] as const) tool(b, k ? "pick" : "shovel", x, 0, z, 0.3 + k, 0.32);
    // Pisan banners on poles at the pit edge, the commission board facing the lenses
    flagPole(b, 13.4, 5.5, 6.5, pisaFlag()); flagPole(b, -11.6, 6.5, 6.5, pisaFlag());
    sign(b, "campanile", ["CAMPANILE", "MCLXXIII"], 9.6, 14.6, 0.35, 1.9, 1.05, 0.75, { bg: "#efe2c2", fg: "#7a2a22", border: "#7a2a22" });
    // rope and a hanging bucket from the crane jib
    b.add(beamGeo(V(-9.2, 9.3, 12.2), V(-9.2, 3.2, 12.2), 0.035), M.rope(), undefined);
    bucket(b, -9.2, 2.6, 12.2, 1.0);
  });
  // foreground framing at the lens
  make("site", [2], (b) => { stones(b, r, 6.8, 0, 16.4, 7, 1.3); bucket(b, 4.4, 0, 17.4, 1.0); });
  make("site", [3], (b) => { bucket(b, 6.7, 0, 18.4); tool(b, "shovel", 3.0, 0, 16.6, 2.6, 0.25); });
  make("site", [8], (b) => { bucket(b, 2.4, 0, 12.2); tool(b, "shovel", 1.3, 0, 12.8, 0.4, 0.22); coil(b, 3.4, 0, 12.6); });
  // town gate (shot 4 whip): road dressing, market, barrels, lanterns
  make("site", [4], (b) => {
    const G0 = -62, GZ = 8;
    b.add(new THREE.PlaneGeometry(40, 6).rotateX(-Math.PI / 2).translate(G0 + 22, 0.015, GZ), M.dirt());
    for (let i = 0; i < 3; i++) barrel(b, G0 + 4.2, 0, GZ - 4.5 + i * 0.7);
    crate(b, G0 + 4.6, 0, GZ + 4.0, 0.8, 0.4); crate(b, G0 + 4.4, 0.8, GZ + 4.1, 0.6, 0.1); sack(b, G0 + 5.4, 0, GZ + 4.6);
    for (const s of [-1, 1]) lantern(b, G0 + 3.3, 6.4, GZ + s * 3.3, false);
    for (const s of [-1, 1]) flagPole(b, G0 + 3.6, GZ + s * 7.5, 7, pisaFlag());
    stones(b, r, -40, 0, 13.5, 6, 1.3); coil(b, -42, 0, 12.4);
    sign(b, "pisagate", ["PISA"], G0 + 3.12, GZ, Math.PI / 2, 2.6, 0.8, 8.2, { bg: "#c8323a", fg: "#f4f0e6", border: "#f4f0e6" }, 0);
  });
  kitAt("site", [4], "stall-green", -48, 0, 14.5, 3.0, -1.0);
  kitAt("site", [4], "cart", -45, 0, 3.5, 1.7, 0.6);

  // ===== 1272: the scaffold climb (shot 7) and grandson's yard =====
  make("site", [7], (b) => {
    coil(b, 6.2, 0, 22.0); barrel(b, 4.2, 0, 21.0); crate(b, 12.5, 0, 22.5, 0.9, 0.5);
    // a marble block hoisted on the crane rope past the new, taller floors
    b.add(beamGeo(V(-6.5, 60, 10.5), V(-6.5, 17.2, 10.5), 0.05), M.rope(), undefined);
    for (const s of [-1, 1]) b.add(beamGeo(V(-6.5, 17.2, 10.5), V(-6.5 + s * 0.55, 16.3, 10.5), 0.04), M.rope(), undefined);
    box(b, C("blockSq", "#ece4d2"), -6.5, 15.5, 10.5, 1.4, 0.8, 0.9, 0.2);
  });

  // ===== battlefield (shot 5): signpost between the armies, stakes, dropped gear =====
  make("field", [5], (b) => {
    sign(b, "pisaarrow", ["← PISA"], -0.75, -3.6, 0.15, 1.3, 0.42, 1.55, { bg: "#c8323a", fg: "#f4f0e6", border: "#f4f0e6" }, 0);
    sign(b, "luccaarrow", ["LUCCA →"], 0.75, -3.62, -0.15, 1.3, 0.42, 1.05, { bg: "#f4f0e6", fg: "#c8323a", border: "#c8323a" }, 0);
    b.add(new THREE.CylinderGeometry(0.07, 0.08, 2.3, 8).translate(0, 1.15, 0), M.woodDk(), at(0, 0, -3.75));
    for (let i = 0; i < 14; i++) { const x = -13 + i * 2; if (Math.abs(x) < 2) continue; b.add(new THREE.ConeGeometry(0.1, 1.5, 6).translate(0, 0.75, 0).applyMatrix4(R3(0.25 * Math.sign(x), 0, 0.18 * Math.sign(x))), M.woodLt(), at(x, 0, -8.5)); }
    // drum + dropped helmet + broken spear in the foreground
    b.add(new THREE.CylinderGeometry(0.32, 0.32, 0.45, 16).translate(0, 0.225, 0), M.red(), at(-2.3, 0, 4.2));
    b.add(new THREE.CylinderGeometry(0.33, 0.33, 0.04, 16).translate(0, 0.45, 0), M.cream(), at(-2.3, 0, 4.2));
    b.add(new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1), M.steel(), at(1.9, 0, 4.6));
    b.add(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 14), M.steel(), at(1.9, 0.01, 4.6));
    tool(b, "rake", 2.6, 0.03, 3.4, 1.2, Math.PI / 2 - 0.03);
    for (const [x, z] of [[-5, -6], [5.5, -6.5], [-9, -12], [10, -11]] as const) { b.add(new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.2, 1), M.hay(), at(x, 0, z)); }
    barrel(b, -4.2, 0, -2.0); crate(b, 4.4, 0, -2.4, 0.7, 0.3);
  });

  // ===== cutaway (night shots 14, 15, 19): floodlights and lamp posts on the lawn behind the slice =====
  make("cutaway", [14, 15, 19], (b) => {
    for (const s of [-1, 1]) { lampPost(b, s * 24, -2.2, true, 4.2); floodlight(b, s * 13, -3, s * -0.4 + Math.PI, true, 1.6); }
    for (const s of [-1, 1]) bench(b, s * 19, -3.2, 0);
  });
  make("cutaway", [6], (b) => { for (const s of [-1, 1]) { b.add(new THREE.ConeGeometry(0.9, 2.2, 8).translate(0, 1.1, 0), M.hay(), at(s * 20, 0, -4)); } });

  // ===== piazza, present day: hook (1) and the bent banana (9) =====
  const souvenir: SignStyle = { bg: "#2f5f9a", fg: "#f6efe0", border: "#f2c230" };
  const gelatoSt: SignStyle = { bg: "#f7e7c4", fg: "#c8323a", border: "#c8323a" };
  make("piazza", [1, 9, 21], (b) => {
    stall(b, 8.2, 47, -0.5, "souv", "SOUVENIRS", M.blue(), souvenir, "towers");
    stall(b, -8.4, 42, 0.45, "gelato", "GELATO", M.red(), gelatoSt, "gelato");
    parasol(b, -10.8, 45.5, M.red(), M.white());
    for (const z of [30, 42, 54, 66]) { lampPost(b, 3.3, z, false); lampPost(b, -3.3, z + 6, false); }
    bench(b, 5.2, 37, -Math.PI / 2 + 0.05); bench(b, -5.3, 52, Math.PI / 2); bin(b, 4.6, 40.2); bin(b, -4.7, 49);
    sign(b, "torre", ["TORRE DI PISA", "1173"], 5.6, 32.5, -0.25, 1.6, 0.8, 0.6, { bg: "#f6efe0", fg: "#2b3550", border: "#2b3550" });
    flock(b, r, 1.0, 44, 6, 1.3); flock(b, r, -1.5, 49.5, 5, 1.1); flock(b, r, 0.8, 52.5, 4, 0.9);
  });
  // hook framing: a pigeon flock and a bench at the lens, the lawn not left bare
  make("piazza", [1], (b) => {
    flock(b, r, 3.2, 53.4, 5, 0.8); bench(b, 7.2, 54, -Math.PI / 2 + 0.2); bin(b, 6.8, 51.6);
  });
  // final piazza: bough at the top of frame, pigeons at the tourist's feet, tour-guide flag, a souvenir stall in view
  make("piazza", [21], (b) => {
    flock(b, r, 1.6, 56.6, 5, 0.7); flock(b, r, -3.2, 50.5, 4, 0.9);
    stall(b, -7.6, 49.5, 0.7, "souv2", "SOUVENIRS", M.blue(), souvenir, "towers");
    flagPole(b, -3.9, 44.5, 3.0, italyFlag());
    parasol(b, 6.4, 50.5, M.yellow(), M.white());
  });

  // ===== piazza, 1990 closure and the quakes (10-13): CLOSED signs on the fence, cones, site hut, floodlights =====
  make("piazza", [10, 11, 12, 13, 20], (b) => {
    for (const a of [60, 78, 96, 114, 132]) {
      const rad = (a * Math.PI) / 180, x = Math.cos(rad) * 13.06, z = Math.sin(rad) * 13.06;
      sign(b, "closed", ["CLOSED", "CHIUSO"], x, z, Math.atan2(x, z), 0.9, 0.55, 0.32, { bg: "#d23b3b", fg: "#ffffff", border: "#ffffff" }, -1);
    }
    for (const [x, z] of [[-6.5, 15.8], [-5.2, 16.9], [3.9, 14.6], [5.9, 15.4], [8.6, 13.6], [-9.6, 12.6]] as const) cone(b, x, z);
    sign(b, "chiusoA", ["CHIUSO"], 2.75, 15.6, 0.27, 0.75, 0.45, 0.25, { bg: "#f6efe0", fg: "#c8323a", border: "#c8323a" });
    hut(b, -9.6, 17.4, 0.5, "cantiere", "CANTIERE");
    floodlight(b, 7.6, 15.6, -2.6, false); floodlight(b, -11.8, 7.6, 2.0, false);
    stones(b, r, 9.6, 0, 18.6, 3, 0.6); crate(b, -7.4, 0, 19.6, 0.8, 0.4); barrel(b, -6.6, 0, 20.5, 0.9);
    flagPole(b, -12.6, 15.5, 5.5, italyFlag());
  });
  // 2001: steel stay cables from the tower to an A-frame, drill-crew cones, spoil wheelbarrow
  make("piazza", [21], (b) => { // behind the foreman's close-up: the crew's kit
    crate(b, 10.3, 0, 10.6, 1.0, 0.5); crate(b, 10.4, 1.0, 10.5, 0.8, 0.2); barrel(b, 9.0, 0, 11.9); cone(b, 11.4, 9.4); cone(b, 8.4, 12.9);
    b.add(new THREE.PlaneGeometry(9, 16).rotateX(-Math.PI / 2).translate(13.5, 0.014, 3), M.dirt());
  }, RW(21, "because"));
  make("piazza", [20], (b) => {
    b.add(new THREE.PlaneGeometry(9, 16).rotateX(-Math.PI / 2).translate(13.5, 0.014, 3), M.dirt());
    for (let i = 0; i < 4; i++) b.add(new THREE.BoxGeometry(2.6, 0.06, 0.3).translate(0, 0.03, 0), M.woodLt(), at(16.5, 0, 5.6 + i * 0.36, 0.3));
    for (const s of [-1, 1]) b.add(beamGeo(V(4.5, 19, s * 3.5), V(30, 7.5, s * 9), 0.06), M.iron(), undefined);
    for (const s of [-1, 1]) { b.add(beamGeo(V(29, 0, s * 11.5), V(30.5, 8, s * 9), 0.3), M.steel(), undefined); b.add(beamGeo(V(32, 0, s * 7), V(30.5, 8, s * 9), 0.3), M.steel(), undefined); }
    wheelbarrow(b, 15.8, 0, 9.4, 2.6, M.dirt()); cone(b, 18.4, 7.2); cone(b, 17.6, -3.5); cone(b, 13.6, 11.2);
    sign(b, "lavori", ["LAVORI IN CORSO", "WORKS 2001"], 22.6, 18.8, 0.85, 1.8, 0.9, 0.5, { bg: "#f2c230", fg: "#1d1d24", border: "#1d1d24" });
    crate(b, 24.6, 0, 16.6, 1.0, 0.4); crate(b, 24.4, 1.0, 16.7, 0.8, 0.7); barrel(b, 25.8, 0, 18.0); cone(b, 21.2, 21.6); cone(b, 19.6, 19.8);
    box(b, M.yellow(), 27.5, 0, 12.5, 1.6, 1.1, 1.0, 0.5); // generator
    for (let i = 0; i < 3; i++) box(b, C("leadW", "#6f7480"), 23.2, i * 0.32, 13.2, 1.4, 0.3, 0.7, 0.5); // lead ingots
  });

  // ===== night bus (16-18): bags, newspaper, ad panels, route display =====
  make("bus", [16, 17, 18], (b) => {
    const ads: [string, string[], SignStyle][] = [
      ["ad1", ["GELATO", "PIAZZA DEI MIRACOLI"], { bg: "#f7e7c4", fg: "#c8323a" }],
      ["ad2", ["VISIT PISA"], { bg: "#2f5f9a", fg: "#f6efe0", border: "#f2c230" }],
      ["ad3", ["PIZZA", "OPEN LATE"], { bg: "#3f6e4a", fg: "#f6efe0" }],
    ];
    ads.forEach(([k, lines, st], i) => { for (const s of [-1, 1]) {
      const z = -5 + i * 3.4 + (s > 0 ? 1.6 : 0), m = signMat(k, lines, 1.3, 0.34, st);
      b.add(new THREE.PlaneGeometry(1.3, 0.34).rotateY(-s * Math.PI / 2).translate(s * 1.235, 2.1, z), m);
    } });
    const disp = signMat("route", ["3  STAZIONE"], 1.4, 0.26, { bg: "#141418", fg: "#ffa63a", border: "#141418", font: "bold" });
    b.add(new THREE.BoxGeometry(1.5, 0.34, 0.1).translate(0, 2.0, -6.92), M.pole());
    b.add(new THREE.PlaneGeometry(1.4, 0.26).translate(0, 2.0, -6.86), disp);
    // bags and a newspaper on the floor, yellow edge strips, a stop button on a pole
    box(b, C("bagA", "#8c3b4a"), -0.72, 0, -1.6, 0.45, 0.32, 0.2, 0.3); box(b, C("bagB", "#d9a441"), 0.95, 0, -3.9, 0.36, 0.42, 0.22, -0.2);
    b.add(new THREE.PlaneGeometry(0.42, 0.3).rotateX(-Math.PI / 2).rotateY(0.5).translate(-0.25, 0.006, 1.4), C("paper", "#efeadf"));
    for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.08, 0.01, 14).translate(s * 0.62, 0.005, 0), M.yellow());
    for (const z of [-1.6, 1.6]) b.add(new THREE.BoxGeometry(0.07, 0.1, 0.07).translate(0.75, 1.35, z), M.red());
  });
  return out;
};
