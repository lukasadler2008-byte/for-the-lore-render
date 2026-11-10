// Real volumetric props of the Microwave short (rework: nothing important is a flat card any more). Every object here is
// thick geometry built from boxes / cylinders / spheres with the toon two-tone material (build.ts lam) and therefore gets
// the ink outline pass. cast.ts decides what is wanted each frame (SolidReq list); Solids.apply() poses a fixed pool of
// objects per kind. Camera-oriented kinds (cam: 1) take the camera quaternion so that local +X is screen right, +Y screen
// up and +Z toward the lens; the rest are world oriented.
import * as THREE from "three";
import { Batch, lam, M4, V } from "./build";
import { glow } from "./sets";

export type SR = { k: string; x: number; y: number; z: number; s?: number; yaw?: number; roll?: number; pitch?: number; cam?: boolean; a?: number; b?: number; c?: number; d?: number; i?: number; post?: number };

const C = (k: string, c: string) => lam("s_" + k, () => ({ color: c }));
const C2 = (k: string, c: string) => lam("s_" + k, () => ({ color: c, side: THREE.DoubleSide }));
const mk = (fn: (b: Batch) => void, cast = true) => { const g = new THREE.Group(); const b = new Batch(); fn(b); b.build(g, cast); return g; };
const T = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
const TR = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: [number, number, number] = [1, 1, 1]) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(...s));
const box = (b: Batch, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) =>
  b.add(new THREE.BoxGeometry(w, h, d), m, TR(x, y, z, rx, ry, rz));
const sph = (b: Batch, m: THREE.Material, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, seg = 12) =>
  b.add(new THREE.SphereGeometry(1, seg, Math.max(6, seg - 4)), m, TR(x, y, z, 0, 0, 0, [sx, sy, sz]));
const cyl = (b: Batch, m: THREE.Material, r: number, h: number, x: number, y: number, z: number, rx = 0, rz = 0, seg = 16, r2?: number) =>
  b.add(new THREE.CylinderGeometry(r2 ?? r, r, h, seg), m, TR(x, y, z, rx, 0, rz));

const M = {
  choco: () => C("choco", "#6e4126"), chocoLt: () => C("chocoLt", "#8d5a37"), chocoDk: () => C("chocoDk", "#4a2a18"),
  soft: () => C("chocoSoft", "#4a2614"), softHi: () => C("chocoSoftHi", "#6f3e22"),
  foil: () => C("foil", "#cfd3da"), foilDk: () => C("foilDk", "#9da3ad"), coat: () => C("coatB", "#7b5334"),
  skin: () => C("skin", "#f5c9a0"), skinDk: () => C("skinDk", "#e6b184"), cuff: () => C("cuff", "#efe6cf"),
  coinRim: () => C("coinRim", "#b9bcc4"), coinIn: () => C("coinIn", "#dcdee4"), coinStar: () => C("coinStar", "#9a9da6"),
  egg: () => C("egg", "#fbf7ec"), eggSh: () => C2("eggSh", "#f1e6cc"), yolk: () => C("yolk", "#f2b01e"), white: () => C("eggW", "#fdfbf2"),
  kern: () => C("kern", "#e0a21e"), kernLt: () => C("kernLt", "#f4c04a"), pop: () => C("pop", "#fffaf0"), popY: () => C("popY", "#f0c85a"),
  red: () => C("sred", "#d6453b"), steel: () => C("ssteel", "#9aa3ad"), dark: () => C("sdark", "#2c2f38"), env: () => C("env", "#f1ead6"),
  envF: () => C("envF", "#dccfae"), smoke: () => C("smoke", "#dcdce6"), blue: () => C("sblue", "#3f86e0"), orange: () => C("sorange", "#ff8a4a"),
  hwhite: () => C("hwhite", "#ffffff"), hcream: () => C("hcream", "#ffe0b0"), cheese: () => C("cheese", "#f0c24a"), cheeseD: () => C("cheeseD", "#d89f2e"),
  hole: () => C("hole", "#b9822a"), q: () => C("qmark", "#ffd23a"),
};

// ---------------- chocolate bar: a continuous ribbon body bent along a spine (rebuilt per pose), raised tiles, foil end, drips ----------------
const CN = 12, CW = 0.17, CT = 0.06, CL = 0.44, CH = CL / CN, FOILN = 3;
const chocoBar = () => {
  const g = new THREE.Group(), bar = new THREE.Group(), lay = new THREE.Group(); g.add(lay); lay.add(bar);
  const foil = new THREE.Mesh(new THREE.BufferGeometry(), C2("foilD", "#cfd3da")), body = new THREE.Mesh(new THREE.BufferGeometry(), C2("chocoBody", "#4f2d1b"));
  for (const m of [foil, body]) { m.castShadow = true; m.receiveShadow = true; bar.add(m); }
  const tiles: THREE.Group[] = [], ridges: THREE.Group[] = [];
  for (let i = FOILN; i < CN; i++) { const t = mk((b) => { box(b, M.chocoLt(), CW * 0.8, CH * 0.8, CT * 0.5, 0, 0, CT * 0.3); box(b, M.chocoDk(), CW * 0.8, CH * 0.8, CT * 0.2, 0, 0, -CT * 0.5); }); bar.add(t); tiles.push(t); }
  for (let k = 0; k < 3; k++) { const r = mk((b) => box(b, M.foilDk(), CW * 1.16, 0.01, CT * 1.45, 0, 0, 0)); bar.add(r); ridges.push(r); }
  const drips: THREE.Group[] = [];
  for (let k = 0; k < 5; k++) {
    const d = mk((b) => { cyl(b, M.soft(), 0.016, 1, 0, -0.5, 0, 0, 0, 8); sph(b, M.soft(), 0, -1, 0, 0.026, 0.034, 0.026, 8); });
    drips.push(d); g.add(d); d.visible = false;
  }
  const flap = mk((b) => { box(b, M.coat(), CW * 1.7, 0.11, 0.05, 0, 0.0, CT * 0.9); box(b, C("coatD", "#5f3f27"), CW * 1.7, 0.014, 0.056, 0, 0.055, CT * 0.9); });
  g.add(flap);
  return { g, lay, bar, foil, body, tiles, ridges, drips, flap };
};
type Choco = ReturnType<typeof chocoBar>;
/** ribbon between spine rings a..b (inclusive): width / thickness scales ws, ts */
const ribbon = (P: number[][], th: number[], a: number, b: number, ws: number, ts: number, geo: THREE.BufferGeometry, cap: boolean) => {
  const pos: number[] = [];
  const ring = (i: number): number[][] => {
    const c = Math.cos(th[i]), s = Math.sin(th[i]), w = (CW * ws) / 2, z = (CT * ts) / 2;
    const L = [P[i][0] - c * w, P[i][1] - s * w], R = [P[i][0] + c * w, P[i][1] + s * w];
    return [[L[0], L[1], z], [R[0], R[1], z], [R[0], R[1], -z], [L[0], L[1], -z]];
  };
  const quad4 = (p: number[], q: number[], r: number, u: number[]) => { void r; void u; pos.push(...p, ...q); };
  void quad4;
  const push = (A: number[], B: number[], C3: number[], D: number[]) => pos.push(...A, ...B, ...C3, ...A, ...C3, ...D);
  for (let i = a; i < b; i++) {
    const r0 = ring(i), r1 = ring(i + 1);
    for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; push(r0[k], r0[k2], r1[k2], r1[k]); }
  }
  if (cap) { const r = ring(b); push(r[0], r[3], r[2], r[1]); }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals(); geo.computeBoundingSphere();
};
/** a = melt 0..1, b = drip length 0..1, c = pocket flap 0/1, d = droop direction (+1 right, -1 left), yaw, roll = base tilt, pitch>0 lays it on a table, i = bend factor (or table yaw) */
const poseChoco = (o: Choco, r: SR) => {
  const melt = r.a ?? 0, drip = r.b ?? 0, dir = r.d ?? 1, bf = r.pitch ? 1 : (r.i ?? 1);
  o.flap.visible = !!r.c; o.flap.position.y = 0.02;
  if (r.pitch) o.bar.rotation.set(0, 0, 0); else o.bar.rotation.set(0, r.yaw ?? 0.45, r.roll ?? 0);
  o.lay.rotation.set(r.pitch ? -Math.PI / 2 : 0, 0, 0);
  const P: number[][] = [[0, 0]], th: number[] = [0];
  for (let i = 1; i <= CN; i++) {
    const bend = i > FOILN ? -dir * melt * bf * (0.045 + 0.028 * i) : -dir * melt * bf * 0.02 * i;
    th.push(th[i - 1] + bend);
    const mid = th[i - 1] + bend / 2;
    P.push([P[i - 1][0] - Math.sin(mid) * CH, P[i - 1][1] + Math.cos(mid) * CH]);
  }
  ribbon(P, th, 0, FOILN, 1.08, 1.3, o.foil.geometry, false);
  ribbon(P, th, FOILN, CN, 1.0, 0.8 - 0.35 * melt, o.body.geometry, true);
  o.body.material = melt > 0.5 ? M.soft() : C2("chocoBody", "#4f2d1b");
  o.tiles.forEach((t, k) => {
    const i = FOILN + k, mid = (th[i] + th[i + 1]) / 2;
    t.position.set((P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2, 0); t.rotation.set(0, 0, mid);
    t.scale.set(1 + 0.12 * melt, 1, Math.max(0.15, 1 - 0.8 * melt)); t.visible = melt < 0.97;
  });
  o.ridges.forEach((rg, k) => { const i = k + 0.5; const j = Math.floor(i); rg.position.set(P[j][0] * 0.5 + P[j + 1][0] * 0.5, P[j][1] * 0.5 + P[j + 1][1] * 0.5, 0); rg.rotation.set(0, 0, th[j]); rg.position.y += 0.0; });
  const tx = P[CN][0], ty = P[CN][1];
  const ro = o.bar.rotation.z, wx = tx * Math.cos(ro) - ty * Math.sin(ro), wy = tx * Math.sin(ro) + ty * Math.cos(ro);
  o.drips.forEach((d, k) => {
    const L = drip * (0.08 + 0.1 * ((k * 37) % 5) / 5) * (r.pitch ? 0 : 1);
    d.visible = L > 0.01;
    d.position.set(wx + (k - 2) * 0.026, wy - 0.01, 0.02 + 0.01 * (k % 2));
    d.scale.set(1, Math.max(0.01, L), 1);
  });
};

/** flat puddle of melted chocolate on a surface (world oriented): the bench of the last shot */
const puddle = () => mk((b) => {
  sph(b, M.soft(), 0, 0.012, 0, 0.3, 0.02, 0.17, 16); sph(b, M.softHi(), -0.04, 0.03, -0.02, 0.2, 0.014, 0.1, 14);
  sph(b, M.soft(), -0.22, 0.014, 0.1, 0.1, 0.016, 0.07); sph(b, M.soft(), 0.27, 0.014, -0.08, 0.09, 0.016, 0.06); sph(b, M.soft(), 0.08, 0.014, 0.19, 0.08, 0.015, 0.05);
  sph(b, M.chocoLt(), 0.1, 0.04, 0.0, 0.07, 0.025, 0.06); sph(b, M.softHi(), -0.12, 0.034, 0.05, 0.05, 0.02, 0.04);
});

// ---------------- hand (open palm / fist), coat sleeve behind it; palm normal +Y, fingers along +X ----------------
const handObj = (sleeve: string) => {
  const g = new THREE.Group(), fingers: THREE.Group[] = [];
  g.add(mk((b) => { sph(b, M.skin(), 0, 0, 0, 0.075, 0.03, 0.07, 14); }));
  const sl = mk((b) => { cyl(b, C("sl" + sleeve, sleeve), 0.052, 1, -0.5, 0, 0, 0, Math.PI / 2, 14); cyl(b, M.cuff(), 0.058, 0.035, -0.02, 0, 0, 0, Math.PI / 2, 14); });
  sl.position.x = -0.05; g.add(sl);
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Group(); p.position.set(0.06, 0, -0.048 + i * 0.032); g.add(p); fingers.push(p);
    const L = 0.055 + (i === 1 || i === 2 ? 0.012 : 0);
    p.add(mk((b) => { cyl(b, M.skin(), 0.0165, L, L / 2, 0, 0, 0, Math.PI / 2, 8); sph(b, M.skin(), L, 0, 0, 0.0165, 0.0165, 0.0165, 8); }));
  }
  const th = new THREE.Group(); th.position.set(0.02, 0, 0.06); th.rotation.y = -0.7; g.add(th); fingers.push(th);
  th.add(mk((b) => { cyl(b, M.skin(), 0.019, 0.05, 0.025, 0, 0, 0, Math.PI / 2, 8); sph(b, M.skin(), 0.05, 0, 0, 0.019, 0.019, 0.019, 8); }));
  return { g, fingers, sl };
};

// ---------------- small things ----------------
const coinObj = () => mk((b) => { cyl(b, M.coinRim(), 0.052, 0.02, 0, 0, 0, 0, 0, 24); cyl(b, M.coinIn(), 0.04, 0.024, 0, 0, 0, 0, 0, 24); cyl(b, M.coinStar(), 0.015, 0.028, 0, 0, 0, 0, 0, 5); });
const eggObj = () => mk((b) => { b.add(new THREE.SphereGeometry(1, 22, 16), M.egg(), TR(0, 0, 0, 0, 0, 0, [0.85, 1.12, 0.85])); sph(b, C("eggHi", "#ffffff"), -0.3, 0.45, 0.55, 0.16, 0.22, 0.1, 8); });
const kernelObj = () => {
  const g = new THREE.Group();
  const u = mk((b) => { sph(b, M.kern(), 0, 0, 0, 0.55, 0.75, 0.5, 10); sph(b, M.kernLt(), -0.12, 0.2, 0.3, 0.26, 0.34, 0.2, 8); sph(b, M.kern(), 0.2, -0.45, 0.1, 0.2, 0.15, 0.2, 6); });
  const p = mk((b) => {
    for (const [x, y, z, r] of [[0, 0, 0, 0.62], [-0.55, -0.1, 0.1, 0.46], [0.55, -0.05, 0.12, 0.5], [-0.2, 0.5, 0.25, 0.46], [0.3, 0.52, -0.1, 0.42], [0.05, -0.15, 0.52, 0.4], [-0.45, 0.35, -0.3, 0.36]] as const)
      sph(b, M.pop(), x, y, z, r, r * 0.92, r, 9);
    sph(b, M.popY(), 0.12, -0.5, 0.3, 0.24, 0.2, 0.22, 7); sph(b, M.popY(), -0.5, 0.05, 0.5, 0.15, 0.13, 0.15, 6);
  }); p.visible = false;
  g.add(u, p);
  return { g, u, p };
};
const bowlObj = () => mk((b) => {
  b.add(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.red(), TR(0, 0.12, 0, 0, 0, 0, [0.2, 0.12, 0.2]));
  b.add(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), C2("bowlIn", "#c9382f"), TR(0, 0.12, 0, Math.PI, 0, 0, [0.19, 0.115, 0.19]));
  b.add(new THREE.TorusGeometry(0.2, 0.012, 8, 24).rotateX(Math.PI / 2), C("bowlRim", "#f2c230"), T(0, 0.125, 0));
  cyl(b, M.red(), 0.06, 0.03, 0, 0.012, 0);
});
const bulbObj = () => mk((b) => {
  sph(b, glow([3.4, 3.0, 1.2]), 0, 0, 0, 0.14, 0.15, 0.14, 16);
  cyl(b, M.steel(), 0.055, 0.07, 0, -0.18, 0, 0, 0, 12); cyl(b, M.dark(), 0.05, 0.03, 0, -0.235, 0, 0, 0, 12); cyl(b, M.steel(), 0.04, 0.03, 0, -0.265, 0, 0, 0, 12);
  for (let i = 0; i < 9; i++) { const a = -Math.PI + (i + 0.5) * (Math.PI / 9) - Math.PI / 18 * 0, c = Math.cos(a), s = Math.sin(a); box(b, glow([3.2, 2.6, 0.6]), 0.02, 0.09 + 0.02 * (i % 2), 0.025, c * 0.26, s * -0.26 + 0.02, 0, 0, 0, a + Math.PI / 2 + 0); }
});
const qmarkObj = () => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 14; i++) { const a = Math.PI * (0.95 - 1.5 * i / 14 * 1.0); pts.push(V(0.1 * Math.cos(a), 0.34 + 0.1 * Math.sin(a), 0)); }
  pts.push(V(0.02, 0.18, 0), V(0, 0.1, 0));
  return mk((b) => { b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.032, 8), M.q()); sph(b, M.q(), 0, -0.02, 0, 0.042, 0.042, 0.042, 10); });
};
const crossObj = () => mk((b) => { box(b, M.red(), 0.52, 0.1, 0.06, 0, 0, 0, 0, 0, 0.78); box(b, M.red(), 0.52, 0.1, 0.06, 0, 0, 0, 0, 0, -0.78); });
const smokeObj = () => mk((b) => { for (const [x, y, z, r] of [[0, 0, 0, 0.1], [-0.08, -0.04, 0.02, 0.07], [0.09, -0.03, 0.01, 0.075], [0.02, 0.09, 0, 0.06]] as const) sph(b, M.smoke(), x, y, z, r, r * 0.9, r, 10); }, false);
const confObj = (i: number) => mk((b) => box(b, C("conf" + (i % 5), ["#e2453c", "#f2c230", "#3f86e0", "#3fa86a", "#e1669d"][i % 5]), 0.1, 0.012, 0.06, 0, 0, 0), false);
const molObj = (warm: boolean) => mk((b) => {
  const o = warm ? M.orange() : M.blue(), h = warm ? M.hcream() : M.hwhite();
  sph(b, o, 0, 0.03, 0, 0.1, 0.1, 0.1, 12); sph(b, h, -0.12, -0.07, 0.02, 0.058, 0.058, 0.058, 9); sph(b, h, 0.12, -0.07, 0.02, 0.058, 0.058, 0.058, 9);
}, false);
const dropObj = () => mk((b) => { sph(b, glow([0.8, 1.8, 3.2]), 0, 0, 0, 0.035, 0.05, 0.035, 8); }, false);
const envObj = () => mk((b) => {
  box(b, M.env(), 0.36, 0.02, 0.24, 0, 0, 0); box(b, M.envF(), 0.36, 0.006, 0.12, 0, 0.012, -0.06, 0.45, 0, 0); box(b, M.envF(), 0.36, 0.006, 0.12, 0, 0.012, 0.06, -0.45, 0, 0);
  box(b, M.red(), 0.04, 0.008, 0.04, 0, 0.018, 0.0);
});
const wscaleObj = () => mk((b) => {
  box(b, M.steel(), 2.2, 0.16, 1.6, 0, 0.08, 0); box(b, M.dark(), 2.0, 0.03, 1.4, 0, 0.17, 0);
  box(b, M.steel(), 0.2, 1.15, 0.2, 1.4, 0.58, 0.0);
  cyl(b, M.steel(), 0.42, 0.2, 1.4, 1.35, 0.1, Math.PI / 2, 0, 24); cyl(b, M.white(), 0.36, 0.05, 1.4, 1.35, 0.22, Math.PI / 2, 0, 24);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; box(b, M.dark(), 0.025, 0.07, 0.02, 1.4 + 0.3 * Math.sin(a), 1.35 + 0.3 * Math.cos(a), 0.27, 0, 0, -a); }
});
const needleObj = () => mk((b) => { box(b, M.red(), 0.03, 0.3, 0.03, 0, 0.15, 0); sph(b, M.red(), 0, 0, 0, 0.04, 0.04, 0.04, 8); });
const rulerObj = () => {
  const g = new THREE.Group(), ticks: THREE.Object3D[] = [];
  g.add(mk((b) => { box(b, M.steel(), 0.07, 2.9, 0.07, 0, 1.45, 0); box(b, M.dark(), 0.5, 0.06, 0.5, 0, 0.03, 0); }));
  for (let i = 0; i < 6; i++) { const t = mk((b) => { box(b, M.red(), 0.34, 0.05, 0.05, 0.17, 0, 0); sph(b, M.red(), 0.36, 0, 0, 0.05, 0.05, 0.05, 8); }); t.position.y = 0.4 + i * 0.4; g.add(t); ticks.push(t); }
  return { g, ticks };
};
const spatter = () => {
  const g = new THREE.Group(), drips: THREE.Group[] = [];
  g.add(mk((b) => {
    for (const [x, y, r] of [[0, 0, 0.17], [-0.17, 0.06, 0.1], [0.18, 0.05, 0.11], [-0.1, -0.17, 0.1], [0.1, -0.17, 0.11], [0.0, 0.17, 0.09]] as const) sph(b, M.white(), x, y, 0, r, r * 0.88, r * 0.34, 12);
    sph(b, M.yolk(), 0.02, 0, 0.05, 0.085, 0.078, 0.05, 12); sph(b, C("yolkHi", "#ffe27a"), -0.02, 0.025, 0.09, 0.03, 0.02, 0.02, 6);
  }));
  for (const x of [-0.12, 0.04, 0.17]) { const d = mk((b) => { cyl(b, M.white(), 0.022, 1, 0, -0.5, 0, 0, 0, 8); sph(b, M.white(), 0, -1, 0, 0.034, 0.042, 0.034, 8); }); d.position.set(x, -0.2, 0.01); g.add(d); drips.push(d); }
  return { g, drips };
};
const shardObj = () => mk((b) => { b.add(new THREE.TetrahedronGeometry(0.05), M.eggSh()); }, false);
const shellObj = () => mk((b) => { b.add(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.eggSh(), TR(0, 0, 0, 0, 0, 0, [0.09, 0.07, 0.09])); }, false);
const globObj = (c: "w" | "y") => mk((b) => sph(b, c === "w" ? M.white() : M.yolk(), 0, 0, 0, 0.05, 0.05, 0.05, 8), false);

// ---------------- the pool ----------------
type Slot = { o: THREE.Object3D; used: boolean };
export class Solids {
  root = new THREE.Group();
  private pools = new Map<string, Slot[]>();
  private choco: Choco[] = [];
  private hands: ReturnType<typeof handObj>[] = [];
  private kern: ReturnType<typeof kernelObj>[] = [];
  private spat: ReturnType<typeof spatter>[] = [];
  private ruler: ReturnType<typeof rulerObj>;
  private needle: THREE.Object3D;
  private wsc: THREE.Object3D;
  private molW: THREE.Object3D[] = []; private molC: THREE.Object3D[] = [];
  private q = new THREE.Quaternion(); private e = new THREE.Euler();
  constructor(parent: THREE.Object3D) {
    parent.add(this.root);
    const add = (k: string, n: number, f: (i: number) => THREE.Object3D) => { const l: Slot[] = []; for (let i = 0; i < n; i++) { const o = f(i); o.visible = false; this.root.add(o); l.push({ o, used: false }); } this.pools.set(k, l); };
    for (let i = 0; i < 3; i++) { const c = chocoBar(); c.g.visible = false; this.root.add(c.g); this.choco.push(c); }
    for (let i = 0; i < 4; i++) { const h = handObj(i < 2 ? "#7b5334" : "#2b3050"); h.g.visible = false; this.root.add(h.g); this.hands.push(h); }
    for (let i = 0; i < 18; i++) { const k = kernelObj(); k.g.visible = false; this.root.add(k.g); this.kern.push(k); }
    for (let i = 0; i < 2; i++) { const s = spatter(); s.g.visible = false; this.root.add(s.g); this.spat.push(s); }
    add("coin", 48, coinObj); add("egg", 1, eggObj); add("bowl", 2, bowlObj); add("bulb", 1, bulbObj); add("qmark", 1, qmarkObj); add("cross", 2, crossObj);
    add("smoke", 8, smokeObj); add("conf", 36, confObj); add("drop", 8, dropObj); add("env", 1, envObj); add("puddle", 1, puddle);
    add("shard", 10, shardObj); add("shell", 2, shellObj); add("globW", 6, () => globObj("w")); add("globY", 2, () => globObj("y"));
    for (let i = 0; i < 24; i++) { const a = molObj(false), b = molObj(true); a.visible = b.visible = false; this.root.add(a, b); this.molC.push(a); this.molW.push(b); }
    this.ruler = rulerObj(); this.ruler.g.visible = false; this.root.add(this.ruler.g);
    this.wsc = wscaleObj(); this.wsc.visible = false; this.root.add(this.wsc);
    this.needle = needleObj(); this.needle.visible = false; this.root.add(this.needle);
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
    this.choco.forEach((c) => (c.g.visible = false)); this.hands.forEach((h) => (h.g.visible = false)); this.kern.forEach((k) => (k.g.visible = false));
    this.spat.forEach((s) => (s.g.visible = false)); this.ruler.g.visible = false; this.wsc.visible = false; this.needle.visible = false;
    this.molC.forEach((m) => (m.visible = false)); this.molW.forEach((m) => (m.visible = false));
    let ic = 0, ih = 0, ihn = 0, ik = 0, isp = 0;
    for (const r of reqs) {
      switch (r.k) {
        case "choco": { const c = this.choco[ic++]; if (!c) break; poseChoco(c, r); this.place(c.g, { ...r, yaw: 0, roll: 0, pitch: 0 }, cq); if (r.pitch) c.g.rotation.set(0, r.i ?? 0, 0); break; }
        case "hand": { const hl = this.hands.slice(r.d ? 2 : 0, r.d ? 4 : 2); const h = hl[r.d ? ihn++ : ih++]; if (!h) break; h.sl.scale.x = r.b ?? 0.22; h.fingers.forEach((f, i) => { if (i < 4) f.rotation.z = (r.a ?? 0) * 1.35; else f.rotation.z = (r.a ?? 0) * 0.5; });
          this.place(h.g, r, cq); break; }
        case "kernel": { const k = this.kern[ik++]; if (!k) break; k.u.visible = !(r.a && r.a > 0.5); k.p.visible = !!(r.a && r.a > 0.5); this.place(k.g, r, cq); k.g.scale.setScalar(r.s ?? 0.06); break; }
        case "splat": { const s = this.spat[isp++]; if (!s) break; s.drips.forEach((d, i) => { const L = (r.a ?? 0) * (0.1 + 0.07 * i); d.scale.set(1, Math.max(0.01, L), 1); d.visible = L > 0.02; }); this.place(s.g, r, cq); break; }
        case "ruler": { this.ruler.ticks.forEach((t, i) => (t.visible = i < (r.a ?? 6))); this.place(this.ruler.g, r, cq); break; }
        case "wscale": this.place(this.wsc, r, cq); break;
        case "needle": this.place(this.needle, r, cq); break;
        case "mol": { const arr = r.b ? this.molW : this.molC, m = arr[r.i ?? 0]; if (m) this.place(m, r, cq); break; }
        default: { const l = this.pools.get(r.k); const s = l?.find((x) => !x.used); if (s) { s.used = true; this.place(s.o, r, cq); } }
      }
    }
  }
}
