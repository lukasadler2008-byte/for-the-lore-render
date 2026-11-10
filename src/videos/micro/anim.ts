// Per-shot prop animation for the Microwave short: pure function of (shot id, time).
import * as THREE from "three";
import { SetBuild } from "./sets";
import { SHOTS, MAG, MAG_S, MAG12, RANGE, KMW, KMW_S, DOOR_Z, stackGrow, pieceRows, beltDist, lineStart, lf, smooth, wt, wtf } from "./story";

export const animate = (S: SetBuild, id: number, t: number) => {
  const s = SHOTS[id - 1];
  const hid = (...o: THREE.Object3D[]) => o.forEach((x) => (x.visible = false));
  hid(S.mag, S.range, S.scene12, S.podium, S.beltCrates, S.kmw, S.rangeK, S.stove);
  S.stacks.forEach((g) => (g.visible = false)); S.pieceRows.forEach((g) => (g.visible = false)); S.pileLayers.forEach((g) => (g.visible = false));
  const pulse = 0.5 + 0.5 * Math.sin(t * 9);
  // the magnetron on the lab bench (running in the story shots 7..11 and 19) or on the showroom table
  if (s.set === "lab" && id >= 7 && id !== 18) {
    S.mag.visible = true; S.mag.position.set(id === 11 ? 2.8 : MAG[0], MAG[1], MAG[2]); S.mag.scale.setScalar(MAG_S);
    const k = id === 19 ? 0.25 : 1;
    S.magRing.scale.setScalar(1 + 0.25 * pulse * k); S.magRing2.scale.setScalar(1 + 0.25 * (1 - pulse) * k); S.magRing.visible = S.magRing2.visible = id !== 19;
  }
  if (id === 12) {
    S.mag.visible = true; S.mag.position.set(MAG12[0], MAG12[1], MAG12[2]); S.mag.scale.setScalar(1.6);
    S.magRing.scale.setScalar(1 + 0.25 * pulse); S.magRing2.scale.setScalar(1 + 0.25 * (1 - pulse)); S.magRing.visible = S.magRing2.visible = true;
    S.scene12.visible = true;
  }
  // factory
  if (id === 4) { const n = pieceRows(t); for (let i = 0; i < 10; i++) S.pieceRows[i].visible = i < n; }
  if (id === 5 || id === 6) {
    S.beltCrates.visible = true;
    S.beltCrates.position.z = (id === 5 ? beltDist(t) : beltDist(lineStart(6)) + 6 * (t - lineStart(6))) % 1.4;
    S.stacks.forEach((g, k) => { const gr = id === 6 ? 1 : stackGrow(k, t); g.visible = gr > 0.01; g.scale.set(1, Math.max(0.05, gr), 1); });
  }
  S.radarScreen.color.setRGB(0.4, 1.4 + 1.0 * (0.5 + 0.5 * Math.sin(t * 3)), 0.8);
  S.dishSpin.rotation.y = 0.5 + t * 0.18;
  // showroom
  if (id === 13) { S.range.visible = true; S.range.position.set(RANGE[0], 0.19, RANGE[2]); S.range.scale.setScalar(1); }
  if (id === 16) {
    S.podium.visible = true; S.stove.visible = true;
    const t0 = wtf(16, "microwaves", 0.3) - 0.3, n = Math.min(S.pileLayers.length, Math.floor(S.pileLayers.length * smooth((t - t0) / 1.5)) + (t > t0 ? 1 : 0));
    S.pileLayers.forEach((g, i) => (g.visible = i < n));
  }
  // kitchen
  if (id === 14) {
    S.rangeK.visible = true; S.rangeK.position.set(-3.5 - 0.03 * Math.abs(Math.sin(t * 5)), 0, DOOR_Z - 0.7); S.rangeK.rotation.set(0, Math.PI / 2, 0.012 * Math.sin(t * 5));
  }
  if (id === 15) { S.kmw.visible = true; S.kmw.scale.setScalar(KMW_S); const g = 0.7 + 0.5 * (0.5 + 0.5 * Math.sin(t * 4)); S.kmwGlow.color.setRGB(3.4 * g, 2.0 * g, 0.5 * g); }
  void lf; void wt; void KMW;
};
