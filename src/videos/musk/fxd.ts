// Text-free effect cards for the Dancing Plague short (drawn with toon.ts's Pen): crows, the fear cloud, veins, a demon
// cloud, the doubt X, snore bubbles, the Saint Vitus statue, red shoes, laugh marks, sweat, rings.
import { Pen, INK } from "./toon";

type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;

/** crow in flight / perched on a 300 x 300 canvas, facing right; wing 0 (down) .. 1 (up) */
export const fxCrow = (p: Pen, wing: number, perched = false) => {
  const body: P2[] = [[70, 190], [120, 150], [200, 150], [250, 170], [230, 200], [170, 215], [100, 215]];
  const wy = perched ? 0.15 : wing;
  p.poly([[110, 175], [150, 170], [210, 175], [180 - 20 * wy, 175 - 50 - 90 * wy], [120 - 20 * wy, 170 - 30 - 70 * wy]], "#2b2733", 7);
  p.poly(body, "#2b2733", 7);
  p.poly([[70, 190], [20, 215], [60, 220], [100, 215]], "#2b2733", 6);
  p.ell(235, 150, 28, 26, "#2b2733", 7);
  p.poly([[255, 145], [292, 158], [255, 168]], "#d9a441", 5);
  p.dot(244, 144, 5, "#ffffff"); p.dot(246, 145, 2.4, INK);
  p.stroke([[150, 215], [150, 245]], 5, "#d9a441"); p.stroke([[185, 215], [185, 245]], 5, "#d9a441");
};

/** the cloud of fear, 700 x 480: bruised purple, two slanted eyes and a zigzag mouth */
export const fxFear = (p: Pen, t: number) => {
  const wob = (i: number) => 6 * Math.sin(t * 6.28 + i * 1.7);
  const lobes: [number, number, number][] = [[130, 280, 100], [250, 200, 130], [390, 190, 140], [520, 250, 115], [330, 320, 130], [470, 340, 90], [200, 340, 80]];
  lobes.forEach(([x, y, r], i) => p.ell(x, y + wob(i), r, r * 0.82, i % 2 ? "#4a3a78" : "#55437f", 12));
  lobes.forEach(([x, y, r], i) => p.ell(x, y + wob(i), r * 0.97, r * 0.8, i % 2 ? "#4a3a78" : "#55437f", 0));
  p.ell(300, 220, 120, 70, "#6a5498", 0);
  for (const s of [-1, 1]) { const x = 330 + s * 80;
    p.poly([[x - 40, 190 - s * 14], [x + 40, 190 + s * 14], [x + 38, 232 + s * 12], [x - 38, 232 - s * 12]], "#f4f0e6", 8);
    p.dot(x + 4 * s, 218, 13); }
  p.line([[240, 300], [275, 330], [310, 296], [345, 332], [380, 296], [415, 330]], INK, 10, false);
};

/** red cartoon blood vessels branching from a heart-ish blob, 600 x 600 */
export const fxVeins = (p: Pen) => {
  const red = "#d12b3a";
  p.ell(300, 330, 150, 130, "#ffd6d6", 9);
  const br = (x: number, y: number, a: number, len: number, w: number, d: number) => {
    if (d === 0 || len < 24) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    p.stroke([[x, y], [(x + x2) / 2 + Math.sin(a) * 12, (y + y2) / 2 - Math.cos(a) * 12], [x2, y2]], w, INK);
    p.stroke([[x, y], [(x + x2) / 2 + Math.sin(a) * 12, (y + y2) / 2 - Math.cos(a) * 12], [x2, y2]], w * 0.62, red);
    br(x2, y2, a - 0.55, len * 0.72, w * 0.72, d - 1); br(x2, y2, a + 0.5, len * 0.7, w * 0.72, d - 1);
  };
  br(300, 330, rad(-90), 120, 28, 4); br(300, 330, rad(-140), 90, 22, 3); br(300, 330, rad(-40), 90, 22, 3); br(300, 330, rad(160), 70, 18, 3); br(300, 330, rad(20), 70, 18, 3);
  p.ell(300, 330, 52, 46, red, 8);
  p.ell(285, 316, 14, 8, "#ff9aa4", 0);
  p.poly([[510, 120], [540, 190], [480, 190]], red, 7); p.ell(510, 195, 30, 28, red, 7);
};

/** demon cloud: horned dark-violet smoke with burning eyes, 600 x 600 */
export const fxDemon = (p: Pen, t: number) => {
  const w = (i: number) => 7 * Math.sin(t * 6.28 + i * 2.1);
  const lobes: [number, number, number][] = [[170, 400, 100], [300, 330, 140], [430, 410, 105], [300, 470, 120], [220, 280, 95], [390, 270, 95]];
  lobes.forEach(([x, y, r], i) => p.ell(x, y + w(i), r, r * 0.85, "#3c2a5c", 11));
  lobes.forEach(([x, y, r], i) => p.ell(x, y + w(i), r * 0.97, r * 0.83, i % 2 ? "#3c2a5c" : "#4a3470", 0));
  for (const s of [-1, 1]) p.poly([[300 + s * 60, 230], [300 + s * 150, 80 + 8 * s], [300 + s * 100, 270]], "#e8dcc0", 9);
  for (const s of [-1, 1]) { const x = 300 + s * 62;
    p.poly([[x - 36, 316 - s * 16], [x + 36, 316 + s * 16], [x + 30, 352 + s * 10], [x - 30, 352 - s * 10]], "#ffd23a", 7); p.dot(x, 338, 10); }
  p.poly([[225, 420], [255, 400], [285, 430], [315, 400], [345, 430], [375, 400]], "#f4f0e6", 7);
  p.line([[225, 420], [255, 460], [300, 444], [345, 460], [375, 420]], INK, 9, false);
};

/** doubt X: bold red X on a pale disc, 400 x 400 */
export const fxX = (p: Pen) => {
  p.ell(200, 200, 170, 170, "#f6ecd2", 12);
  for (const [a, b] of [[[100, 100], [300, 300]], [[300, 100], [100, 300]]] as [P2, P2][]) { p.stroke([a, b], 64, INK); p.stroke([a, b], 46, "#d42f2f"); }
};
/** bare red X for crossing something out, 400 x 400 */
export const fxCross = (p: Pen) => {
  for (const [a, b] of [[[40, 40], [360, 360]], [[360, 40], [40, 360]]] as [P2, P2][]) { p.stroke([a, b], 70, INK); p.stroke([a, b], 50, "#d42f2f"); }
};

/** sleep bubbles drifting up (no letters), 300 x 400; t 0..1 */
export const fxSnore = (p: Pen, t: number) => {
  for (let i = 0; i < 3; i++) { const u = (t + i / 3) % 1, r = 18 + 38 * u; p.ell(110 + 60 * Math.sin(u * 5 + i) + 40 * u, 360 - u * 330, r, r, "rgba(255,255,255,0.85)", 7); }
};

/** laugh marks: short jagged ticks, 300 x 200 */
export const fxLaugh = (p: Pen, t: number) => {
  const k = 1 + 0.18 * Math.sin(t * 6.28 * 2);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const a = rad(-70 + i * 40) , x0 = 150 + s * 60, y0 = 120;
    p.stroke([[x0 + s * Math.sin(a) * 20 * k, y0 + Math.cos(a) * -20 * k], [x0 + s * Math.sin(a) * 70 * k, y0 + Math.cos(a) * -70 * k]], 12);
  }
};

/** blank speech bubble with three wavy lines (no letters), 400 x 300 */
export const fxBubble = (p: Pen) => {
  p.poly([[60, 40], [340, 40], [370, 70], [370, 190], [340, 220], [190, 220], [140, 280], [150, 220], [60, 220], [30, 190], [30, 70]], "#ffffff", 10);
  for (let k = 0; k < 3; k++) { const y = 82 + k * 40, pts: P2[] = []; for (let i = 0; i <= 16; i++) pts.push([80 + i * (k === 2 ? 11 : 16), y + 8 * Math.sin(i * 1.2 + k)]); p.stroke(pts, 8); }
};

/** sweat drops flying off, 300 x 300 */
export const fxSweat = (p: Pen, t: number) => {
  for (let i = 0; i < 4; i++) { const u = (t + i / 4) % 1, x = 60 + i * 55 + 30 * u * (i % 2 ? 1 : -1), y = 80 + 190 * u * u; p.ell(x, y, 11, 17, "#bfe8ff", 6); }
};

/** red dance shoes (a pair) with sparkle, 500 x 300 */
export const fxShoes = (p: Pen) => {
  for (const [x, y, s] of [[130, 160, 1], [330, 190, -1]] as const) {
    const sx = (v: number) => x + s * v;
    p.poly([[sx(0), y - 60], [sx(50), y - 60], [sx(55), y], [sx(130), y + 20], [sx(150), y + 55], [sx(0), y + 55]], "#d42f2f", 9);
    p.poly([[sx(0), y + 42], [sx(150), y + 42], [sx(150), y + 62], [sx(0), y + 62]], "#7a1620", 6);
    p.stroke([[sx(4), y - 30], [sx(48), y - 30]], 8, "#ffd0d0");
    p.ell(sx(35), y - 12, 22, 8, "#f2c230", 4);
  }
};

/** fear ring seen from above (flat on the ground), 600 x 600; t 0..1 */
export const fxFearRing = (p: Pen, t: number) => {
  const g = p.g;
  for (let k = 0; k < 2; k++) { const u = t - k * 0.12; if (u <= 0 || u >= 1) continue;
    g.beginPath(); g.arc(300, 300, 40 + 250 * u, 0, Math.PI * 2); g.strokeStyle = k ? "rgba(150,110,220,0.8)" : "rgba(230,200,255,0.95)"; g.lineWidth = 16 * (1 - u) + 4; g.stroke(); }
};

/** Saint Vitus: stone saint in a robe with raised hands and a halo ring, 500 x 900 (feet at y 880) */
export const fxStatue = (p: Pen) => {
  const stone = "#d8d0c0", shade = "#b9b0a0";
  p.ell(250, 130, 120, 120, null, 12);
  p.poly([[170, 880], [330, 880], [350, 520], [330, 330], [250, 290], [170, 330], [150, 520]], stone, 11);
  p.poly([[250, 300], [330, 340], [350, 520], [320, 880], [250, 880]], shade, 0);
  p.stroke([[250, 380], [235, 520], [250, 880]], 6, shade);
  p.ell(250, 210, 62, 70, stone, 11);
  p.stroke([[170, 360], [100, 250], [110, 180]], 28, INK); p.stroke([[170, 360], [100, 250], [110, 180]], 14, stone);
  p.stroke([[330, 360], [400, 250], [390, 180]], 28, INK); p.stroke([[330, 360], [400, 250], [390, 180]], 14, stone);
  p.ell(222, 200, 7, 9, INK, 0); p.ell(278, 200, 7, 9, INK, 0);
  p.arc(250, 228, 18, 10, 20, 160, 6);
  p.poly([[330, 300], [420, 330], [420, 400], [330, 380]], "#9a8a6a", 8); // book/palm leaf
  p.ell(250, 120, 135, 135, null, 14);
};

/** wide gold halo behind the statue is a mesh; this is the smaller sparkle star, 200 x 200 */
export const fxSpark = (p: Pen, t: number) => {
  const r0 = 24 + 16 * Math.sin(t * 6.28), pts: P2[] = [];
  for (let i = 0; i < 8; i++) { const a = rad(i * 45 - 90), r = i % 2 ? 22 : r0 + 50; pts.push([100 + r * Math.cos(a), 100 + r * Math.sin(a)]); }
  p.poly(pts, "#fff3b0", 6);
};

/** wavy stink lines for the mouldy loaf, 200 x 300 */
export const fxStink = (p: Pen, t: number) => {
  for (let k = 0; k < 3; k++) { const pts: P2[] = []; for (let i = 0; i <= 16; i++) pts.push([40 + k * 60 + 18 * Math.sin(i * 0.9 + t * 6.28 + k), 280 - i * 15]); p.stroke(pts, 10, "#5a9a3a"); }
};

// ================= The Microwave Accident: effect cards (no letters or digits anywhere) =================
const SKINC = "#f5c9a0";
/** chocolate bar poking out of a pocket, 240 x 320; melt 0 = stiff bar, 1 = limp ruined bar with drips. Pocket edge at (120, 250) */
export const fxChoco = (p: Pen, melt: number, held = false) => {
  const seg = 6, len = 190 / seg, ang0 = held ? 0 : -0.15, bend = 0.12 + 0.55 * melt;
  let x = 120, y = held ? 40 : 250, a = held ? Math.PI / 2 : -Math.PI / 2 + ang0;
  const dir = held ? 1 : 1;
  const pts: [number, number, number][] = [];
  for (let i = 0; i < seg; i++) { pts.push([x, y, a]); a += dir * bend * (held ? 0.6 + i * 0.15 : 0.7 + i * 0.25); x += Math.cos(a) * len; y += Math.sin(a) * len; }
  pts.push([x, y, a]);
  const wd = 66 - 10 * melt;
  const col = melt > 0.5 ? "#5a3320" : "#6b3f26", lite = "#8a5634";
  for (let i = 0; i < seg; i++) {
    const [x0, y0, a0] = pts[i], [x1, y1] = pts[i + 1], nx = -Math.sin(a0) * wd / 2, ny = Math.cos(a0) * wd / 2;
    const k = 1 - 0.18 * melt * (i / seg);
    p.poly([[x0 + nx, y0 + ny], [x1 + nx * k, y1 + ny * k], [x1 - nx * k, y1 - ny * k], [x0 - nx, y0 - ny]], i % 2 ? col : lite, 6);
  }
  const [lx, ly] = pts[seg];
  if (melt > 0.25) {
    for (const [dx, k] of [[-14, 1], [6, 0.7], [20, 0.45]] as const) {
      const L = 20 + 60 * melt * k;
      p.stroke([[lx + dx, ly], [lx + dx, ly + L]], 14, INK); p.stroke([[lx + dx, ly], [lx + dx, ly + L]], 9, col);
      p.ell(lx + dx, ly + L, 9, 11, col, 4);
    }
  }
  if (!held) { p.poly([[78, 232], [162, 232], [158, 262], [82, 262]], "#c9ccd2", 5); }
};
/** hand with two fingers up (V), 240 x 300 */
export const fxHandV = (p: Pen) => {
  p.poly([[70, 300], [170, 300], [176, 200], [60, 200]], "#7b5334", 8);
  p.ell(120, 190, 62, 56, SKINC, 8);
  p.stroke([[100, 160], [78, 40]], 36, INK); p.stroke([[100, 160], [78, 40]], 24, SKINC);
  p.stroke([[142, 160], [168, 44]], 36, INK); p.stroke([[142, 160], [168, 44]], 24, SKINC);
  p.ell(78, 40, 17, 17, SKINC, 0); p.ell(168, 44, 17, 17, SKINC, 0);
  p.ell(84, 214, 22, 20, SKINC, 7, 0, 360, -30);
  p.stroke([[110, 180], [130, 205]], 5); p.stroke([[100, 215], [122, 232]], 5);
};
/** a sad little flat coin, 200 x 200: plain rim, ridged edge, star (no digits) */
export const fxCoin = (p: Pen) => {
  p.ell(100, 100, 88, 88, "#b9bcc4", 9);
  p.ell(100, 100, 68, 68, "#d6d8de", 5);
  for (let i = 0; i < 24; i++) { const a = rad(i * 15); p.stroke([[100 + 78 * Math.cos(a), 100 + 78 * Math.sin(a)], [100 + 86 * Math.cos(a), 100 + 86 * Math.sin(a)]], 4); }
  const pts: P2[] = [];
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 14 : 36, a = rad(i * 36 - 90); pts.push([100 + r * Math.cos(a), 100 + r * Math.sin(a)]); }
  p.poly(pts, "#9a9da6", 4);
};
/** lightbulb with rays, 300 x 300; t 0..1 pulse */
export const fxBulb = (p: Pen, t: number) => {
  const k = 1 + 0.1 * Math.sin(t * 6.28);
  for (let i = 0; i < 9; i++) { const a = rad(-180 + i * 22.5), r0 = 112, r1 = (150 + (i % 2) * 8) * k; p.stroke([[150 + r0 * Math.cos(a), 140 + r0 * Math.sin(a)], [150 + r1 * Math.cos(a), 140 + r1 * Math.sin(a)]], 12, INK); p.stroke([[150 + r0 * Math.cos(a), 140 + r0 * Math.sin(a)], [150 + r1 * Math.cos(a), 140 + r1 * Math.sin(a)]], 6, "#ffe066"); }
  p.ell(150, 130, 70, 74, "#fff3a0", 9);
  p.ell(128, 108, 18, 24, "#ffffff", 0, 0, 360, 20);
  p.poly([[122, 192], [178, 192], [172, 232], [128, 232]], "#9aa1a8", 7);
  p.stroke([[126, 210], [174, 210]], 5);
  p.stroke([[132, 232], [168, 232]], 12, INK);
};
/** egg white and yolk splat, 400 x 400 */
export const fxEggSplat = (p: Pen) => {
  const lobes: [number, number, number][] = [[200, 190, 120], [110, 150, 70], [290, 140, 76], [130, 270, 66], [270, 270, 74], [200, 100, 60]];
  lobes.forEach(([x, y, r]) => p.ell(x, y, r, r * 0.85, "#fdfbf2", 9));
  lobes.forEach(([x, y, r]) => p.ell(x, y, r * 0.95, r * 0.8, "#fdfbf2", 0));
  for (const [x, l] of [[130, 120], [220, 160], [290, 80]] as const) { p.stroke([[x, 290], [x, 290 + l]], 30, INK); p.stroke([[x, 290], [x, 290 + l]], 20, "#fdfbf2"); p.ell(x, 290 + l, 14, 16, "#fdfbf2", 5); }
  p.ell(205, 190, 52, 46, "#f2b01e", 8); p.ell(190, 176, 14, 10, "#ffe27a", 0);
};
/** flying yolk blob, 160 x 160 */
export const fxYolk = (p: Pen) => { p.ell(80, 80, 52, 46, "#fdfbf2", 8); p.ell(84, 84, 26, 24, "#f2b01e", 6); };
/** eggshell shard, 120 x 120 */
export const fxShard = (p: Pen) => { p.poly([[14, 100], [48, 14], [70, 54], [100, 20], [110, 100]], "#f4ead2", 7); };
/** unpopped kernel, 120 x 120 */
export const fxKernel = (p: Pen) => { p.ell(60, 60, 28, 38, "#e0a21e", 7); p.ell(52, 48, 8, 12, "#ffd86a", 0); };
/** popped popcorn, 160 x 160 */
export const fxPopped = (p: Pen, v: number) => {
  const bl: [number, number, number][] = [[80, 84, 38], [46, 94, 28], [114, 90, 30], [66, 52, 28], [100, 54, 26]];
  bl.forEach(([x, y, r], i) => p.ell(x + (v % 3) * 2 * (i % 2), y, r, r * 0.9, "#fffaf0", 7));
  p.ell(82, 128, 14, 16, "#e8b43a", 4);
};
/** water molecule, 160 x 160: big blue oxygen, two white hydrogens */
export const fxMolecule = (p: Pen, warm: number) => {
  const o = warm > 0.5 ? "#ff8a4a" : "#3f86e0", h = warm > 0.5 ? "#ffe0b0" : "#ffffff";
  p.ell(46, 100, 24, 24, h, 6); p.ell(116, 100, 24, 24, h, 6); p.ell(80, 70, 40, 40, o, 7);
  p.ell(68, 56, 10, 8, "rgba(255,255,255,0.7)", 0);
};
/** microwave arcs radiating to the right, 500 x 300; t 0..1 */
export const fxWaves = (p: Pen, t: number) => {
  const g = p.g;
  for (let k = 0; k < 4; k++) {
    const u = (t + k / 4) % 1, r = 30 + 400 * u;
    g.beginPath(); g.arc(20, 150, r, rad(-26), rad(26)); g.lineCap = "round";
    g.strokeStyle = INK; g.lineWidth = 20 * (1 - 0.5 * u) + 4; g.stroke();
    g.strokeStyle = u < 0.7 ? "#bfe8ff" : "#7fb6ff"; g.lineWidth = 12 * (1 - 0.5 * u) + 1; g.stroke();
  }
};
/** two mitten hands pressed palm to palm, rubbing (k -1..1 offset), heat lines; 520 x 320 */
export const fxHands = (p: Pen, k: number, heat: number) => {
  const off = 26 * k;
  p.poly([[40, 260], [40, 190], [60, 70 + off], [140, 60 + off], [236, 120 + off], [236, 230]], SKINC, 8);
  p.poly([[480, 260], [480, 190], [460, 70 - off], [380, 60 - off], [284, 120 - off], [284, 230]], "#efbf92", 8);
  for (let i = 0; i < 3; i++) { p.stroke([[100 + i * 30, 90 + off + i * 6], [110 + i * 30, 150 + off]], 5); p.stroke([[420 - i * 30, 90 - off + i * 6], [410 - i * 30, 150 - off]], 5); }
  for (let i = 0; i < 4; i++) { const x = 190 + i * 45, pts: P2[] = []; for (let j = 0; j <= 10; j++) pts.push([x + 10 * Math.sin(j * 1.2 + i + k * 4), 70 - j * 7 * heat]); p.stroke(pts, 9, i % 2 ? "#ff9a3a" : "#ff5a3a"); }
};
/** soft round glow (additive-ish, use soft), 256 x 256 */
export const fxGlowDisc = (p: Pen, rgb: string, a = 1) => {
  const g = p.g, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, `rgba(${rgb},${0.95 * a})`); gr.addColorStop(0.45, `rgba(${rgb},${0.4 * a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
};
/** cartoon grey smoke puff, 300 x 300; t 0..1 */
export const fxSmoke = (p: Pen, t: number) => {
  const a = Math.max(0, 1 - t * 0.8), r = 40 + 50 * t;
  const bl: [number, number, number][] = [[150, 190 - 90 * t, r], [105, 210 - 70 * t, r * 0.7], [195, 205 - 70 * t, r * 0.75], [150, 150 - 110 * t, r * 0.6]];
  bl.forEach(([x, y, rr]) => p.ell(x, y, rr, rr * 0.85, `rgba(214,214,222,${a.toFixed(2)})`, 7 * a));
  bl.forEach(([x, y, rr]) => p.ell(x, y, rr * 0.95, rr * 0.8, `rgba(232,232,238,${a.toFixed(2)})`, 0));
};
/** thought cloud with three food icons (chocolate, egg, kernel), 460 x 360 */
export const fxThought = (p: Pen) => {
  [[110, 140, 90], [230, 100, 105], [350, 140, 90], [230, 190, 120], [130, 210, 70], [330, 215, 75]].forEach(([x, y, r]) => p.ell(x, y, r, r * 0.8, "#ffffff", 9));
  [[110, 140, 90], [230, 100, 105], [350, 140, 90], [230, 190, 120], [130, 210, 70], [330, 215, 75]].forEach(([x, y, r]) => p.ell(x, y, r * 0.95, r * 0.76, "#ffffff", 0));
  p.poly([[96, 130], [150, 130], [150, 200], [96, 200]], "#6b3f26", 6); p.stroke([[123, 130], [123, 200]], 4); p.stroke([[96, 165], [150, 165]], 4);
  p.ell(230, 168, 32, 42, "#fdfbf2", 6);
  p.ell(318, 170, 22, 30, "#e0a21e", 6);
  p.ell(60, 300, 20, 18, "#ffffff", 7); p.ell(28, 340, 11, 10, "#ffffff", 6);
};
/** tiny star burst pat, 200 x 200 */
export const fxPat = (p: Pen, t: number) => {
  for (let i = 0; i < 6; i++) { const a = rad(i * 60 + 10), r0 = 30 + 20 * t, r1 = 70 + 30 * t; p.stroke([[100 + r0 * Math.cos(a), 100 + r0 * Math.sin(a)], [100 + r1 * Math.cos(a), 100 + r1 * Math.sin(a)]], 9); }
};
/** confetti ribbon pieces, 300 x 300 */
export const fxConfetti = (p: Pen, v: number) => {
  const cols = ["#e2453c", "#f2c230", "#3f86e0", "#3fa86a", "#e1669d"];
  for (let i = 0; i < 14; i++) { const x = (i * 83 + v * 37) % 280 + 10, y = (i * 61 + v * 53) % 270 + 10; p.poly([[x, y], [x + 18, y + 6], [x + 10, y + 22], [x - 8, y + 14]], cols[i % 5], 3); }
};
