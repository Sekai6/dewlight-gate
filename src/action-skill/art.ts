import Phaser from "phaser";
import type { SkillEvent, SkillPose } from "./types";
/** One Graphics object, fixed event ring; never creates per-cast display objects. */
export class SkillArt {
  private g: Phaser.GameObjects.Graphics;
  private cursor = 0;
  private rings = Array.from({ length: 18 }, () => ({
    x: 0,
    y: 0,
    at: -999,
    color: 0,
  }));
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(6.2);
  }
  reset() {
    for (const r of this.rings) r.at = -999;
    this.g.clear();
  }
  event(e: SkillEvent, x: number, y: number, now: number) {
    if (e.type !== "release" && e.type !== "hit") return;
    const r = this.rings[this.cursor++ % this.rings.length];
    r.x = x;
    r.y = y - 25;
    r.at = now;
    r.color =
      e.skill === "rise" ? 0xd5ecb5 : e.skill === "bloom" ? 0xffe7b8 : 0xb2eee0;
  }
  draw(
    now: number,
    hero: { x: number; y: number; facing: number },
    pose: SkillPose | undefined,
    reduced: boolean,
    visible: boolean,
    training = false,
  ) {
    const g = this.g;
    g.clear().setVisible(visible);
    if (!visible) return;
    if (training) {
      g.lineStyle(2, 0xc5f2de, 0.65);
      g.strokeEllipse(650, 1100, 88, 14);
      g.strokeCircle(650, 1061, 18);
      g.lineBetween(650, 1080, 650, 1098);
      g.lineBetween(628, 1085, 672, 1085);
      // Three petals represent the three practice skills.
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
        g.strokeCircle(650 + Math.cos(a) * 35, 1060 + Math.sin(a) * 35, 6);
      }
    }
    for (const r of this.rings) {
      const age = now - r.at;
      if (age < 0 || age > 0.45) continue;
      const t = age / 0.45;
      g.lineStyle(reduced ? 1 : 2, r.color, (1 - t) * 0.6);
      g.strokeEllipse(r.x, r.y, 25 + t * 100, 10 + t * 40);
      if (!reduced)
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const x = r.x + Math.cos(a) * (15 + t * 65),
            y = r.y + Math.sin(a) * (10 + t * 40);
          g.fillStyle(r.color, 1 - t);
          g.fillTriangle(x, y - 4, x + 3, y, x, y + 4);
        }
    }
    if (!pose) return;
    const { x, y } = hero,
      t = pose.progress;
    if (pose.id === "branch") {
      // Refracted ribbons sit behind the actual sword trail from ACTION-A.
      g.lineStyle(2, 0xa8e6d3, 0.55 * Math.sin(t * Math.PI));
      for (let i = 0; i < (reduced ? 1 : 3); i++) {
        const back = x - hero.facing * (18 + i * 15);
        g.lineBetween(
          back,
          y - 25 - i * 6,
          back - hero.facing * 35,
          y - 17 - i * 6,
        );
      }
    } else if (pose.id === "rise") {
      g.lineStyle(2, 0xc5e9b1, Math.sin(t * Math.PI) * 0.7);
      g.beginPath();
      g.moveTo(x - hero.facing * 28, y + 10);
      for (let n = 1; n <= 12; n++) {
        const u = n / 12;
        g.lineTo(
          x + hero.facing * (Math.sin(u * Math.PI) * 30 - 28 + u * 35),
          y + 10 - u * 100 * Math.min(1, t * 4),
        );
      }
      g.strokePath();
    } else {
      const alpha = Math.sin(t * Math.PI);
      for (let i = 0; i < (reduced ? 3 : 6); i++) {
        const a = t * Math.PI * 4 + (i * Math.PI) / 3;
        const px = x + Math.cos(a) * 50,
          py = y - 28 + Math.sin(a) * 34;
        g.lineStyle(1.5, i % 2 ? 0xffe9bc : 0xb7edde, alpha * 0.75);
        g.strokeEllipse(px, py, 20, 11);
      }
    }
  }
}
