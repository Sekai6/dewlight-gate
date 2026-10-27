import Phaser from "phaser";
import type { DewGuardian } from "./boss";
import { GUARDIAN } from "./boss";

export class GuardianArt {
  private g: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private hit: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(5.6);
    this.title = scene.add
      .text(0, 0, "", {
        fontFamily: "Microsoft YaHei",
        fontSize: "15px",
        color: "#fff0cb",
        backgroundColor: "#183c3ed9",
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.hit = scene.add
      .text(0, 0, "", {
        fontFamily: "Microsoft YaHei",
        fontSize: "22px",
        fontStyle: "bold",
        color: "#ffedb0",
        stroke: "#24443e",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(11);
  }
  draw(b: DewGuardian, time: number, visible: boolean, reduced: boolean) {
    const g = this.g;
    g.clear();
    this.title.setVisible(visible);
    this.hit.setVisible(visible && time < b.hurtUntil);
    if (!visible) return;
    const dead = b.phase === "defeated",
      warning = b.phase === "warn";
    const pulse = reduced ? 0 : Math.sin(time * 3);
    const age = time - b.phaseAt;
    const windup = b.phase === "warn" ? Math.min(1, age / 0.95) : 0;
    const slamWind = b.phase === "slam-warn" ? Math.min(1, age / 1.05) : 0;
    const x = b.x,
      y = b.y;
    this.hit
      .setPosition(
        x + b.facing * 22,
        y - 155 - (0.25 - (b.hurtUntil - time)) * 65,
      )
      .setText(b.lastDamage === 2 ? "✧ 2" : "1");
    g.fillStyle(0x0e3037, 0.35);
    g.fillEllipse(x, y + 2, 108, 16);
    if (warning) {
      g.fillStyle(0xef9a72, 0.2);
      const end = b.chargeEnd;
      g.fillRect(Math.min(x, end) - 40, y - 10, Math.abs(end - x) + 80, 10);
      g.lineStyle(2, 0xffc19a, 0.85);
      g.lineBetween(x, y - 8, end, y - 8);
      for (let n = 1; n < 5; n++) {
        const tx = x + ((end - x) * n) / 5;
        g.lineBetween(tx - b.facing * 9, y - 20, tx, y - 13);
        g.lineBetween(tx, y - 13, tx - b.facing * 9, y - 6);
      }
    }
    if (b.phase === "slam-warn") {
      g.lineStyle(3, 0xffdda3, 0.4 + slamWind * 0.5);
      g.strokeEllipse(x, y, 120 + slamWind * 100, 15);
      for (const dir of [-1, 1]) {
        g.lineStyle(2, 0xf3d8a3, 0.7);
        g.lineBetween(x + dir * 65, y - 5, x + dir * 260, y - 5);
      }
    }
    for (const wave of b.wave) {
      g.lineStyle(8, 0xa6dcbb, 0.18);
      g.strokeEllipse(wave.x, y - 12, 34, 32);
      g.lineStyle(2, 0xffe9b9, 0.9);
      g.strokeEllipse(wave.x, y - 12, 26, 26);
      g.fillStyle(0xb4dcad, 0.85);
      g.fillTriangle(wave.x - 13, y, wave.x, y - 30, wave.x + 13, y);
    }
    g.save();
    g.translateCanvas(x, y);
    g.scaleCanvas(1.2, 1.2);
    const lean = reduced
      ? 0
      : b.phase === "charge"
        ? b.facing * 0.14
        : b.phase === "warn"
          ? -b.facing * windup * 0.12
          : b.phase === "recover"
            ? b.facing * 0.08
            : 0;
    g.rotateCanvas(lean);
    g.translateCanvas(-x, -y);
    // Four roots support a broad glazed-stone torso beneath a living crown.
    for (const side of [-1, 1]) {
      g.lineStyle(10, 0x355951, 1);
      const stride =
        b.phase === "charge" && !reduced ? Math.sin(age * 25) * side * 10 : 0;
      g.lineBetween(x + side * 20, y - 32, x + side * 38 + stride, y - 8);
      g.lineStyle(5, 0xa1bba0, 1);
      g.lineBetween(x + side * 38, y - 8, x + side * 50, y - 3);
    }
    const bodyY =
      y -
      (dead ? 31 : 54) +
      (b.phase === "charge"
        ? 7
        : b.phase === "recover"
          ? 9
          : windup * 8 - slamWind * 19 + pulse * 1.1);
    if (!reduced && b.phase === "charge") {
      g.lineStyle(3, 0xb5ead7, 0.3);
      for (let n = 0; n < 3; n++)
        g.lineBetween(
          x - b.facing * 65,
          bodyY - 20 + n * 15,
          x - b.facing * (95 + n * 18),
          bodyY - 20 + n * 15,
        );
    }
    g.fillStyle(dead ? 0x648e79 : 0x315f62, 1);
    g.fillRoundedRect(x - 42, bodyY - 31, 84, 67, 20);
    g.fillStyle(0x9abda5, 0.85);
    g.fillEllipse(x - 10, bodyY - 17, 58, 32);
    // Overlapping stone facets and dew crystals give the guardian a different material
    // from the small moss creatures, without importing raster art.
    for (let n = 0; n < 6; n++) {
      const a = (n * Math.PI) / 3;
      const fx = x + Math.cos(a) * 30,
        fy = bodyY + Math.sin(a) * 22;
      g.fillStyle(n % 2 ? 0x6c9e96 : 0x497e7a, 0.65);
      g.fillTriangle(fx, fy, fx - 12, fy + 12, fx + 13, fy + 9);
      g.lineStyle(1, 0xc0d8bd, 0.55);
      g.lineBetween(fx - 9, fy + 9, fx, fy);
    }
    for (const side of [-1, 1]) {
      const sx = x + side * 41;
      const armLift = slamWind * 25;
      g.lineStyle(7, 0x48766a, 1);
      g.lineBetween(
        sx,
        bodyY - 10,
        sx + side * (16 + slamWind * 5),
        bodyY + 15 - armLift,
      );
      g.fillStyle(0x7aa68b, 1);
      g.fillEllipse(sx + side * 16, bodyY + 18 - armLift, 17, 22);
      g.fillStyle(0x4e8077, 1);
      g.fillEllipse(sx, bodyY + 4, 20, 35);
      g.fillStyle(0xa0c4a5, 0.9);
      g.fillEllipse(sx - side * 2, bodyY - 9, 16, 12);
      g.fillStyle(warning ? 0xffbd96 : 0xb9e6df, 0.9);
      g.fillTriangle(sx, bodyY - 18, sx - 7, bodyY - 5, sx + 7, bodyY - 5);
    }
    g.lineStyle(2, 0xd7dfb1, 0.8);
    g.strokeEllipse(x, bodyY, 64, 54);
    g.fillStyle(warning ? 0xffb08b : 0xc4ece0, 1);
    g.fillTriangle(x, bodyY - 21, x - 13, bodyY + 2, x + 13, bodyY + 2);
    g.fillStyle(0xf9edc4, 1);
    g.fillCircle(x - 15, bodyY - 4, 3);
    g.fillCircle(x + 15, bodyY - 4, 3);
    if (!dead) {
      g.lineStyle(5, 0x314e48, 1);
      for (const side of [-1, 1]) {
        g.lineBetween(x + side * 30, bodyY - 24, x + side * 47, bodyY - 60);
        g.lineBetween(x + side * 47, bodyY - 60, x + side * 31, bodyY - 80);
        g.lineBetween(x + side * 43, bodyY - 51, x + side * 62, bodyY - 62);
        g.fillStyle(warning ? 0xffc39c : 0xd0dfb0, 1);
        g.fillEllipse(x + side * 42, bodyY - 67, 18, 8);
        g.fillTriangle(
          x + side * 30,
          bodyY - 73,
          x + side * 28 - 5,
          bodyY - 92,
          x + side * 28 + 5,
          bodyY - 92,
        );
      }
      g.lineStyle(2, 0x82b19a, 0.9);
      g.lineBetween(x - 29, bodyY + 18, x + 23, bodyY - 25);
      g.lineBetween(x - 26, bodyY - 20, x + 28, bodyY + 20);
    }
    if (!dead) {
      g.lineStyle(2, 0xd5d7ac, 0.85);
      g.lineBetween(x - 25, bodyY - 23, x, bodyY - 37);
      g.lineBetween(x, bodyY - 37, x + 25, bodyY - 23);
      g.fillStyle(b.phase === "recover" ? 0xffe5a5 : 0x8eb8a3, 1);
      g.fillTriangle(x, bodyY - 29, x - 8, bodyY - 17, x + 8, bodyY - 17);
      for (let n = 0; n < 5; n++) {
        const sx = x - 25 + n * 12;
        g.lineStyle(1, 0xb4d4bf, 0.6);
        g.lineBetween(sx, bodyY + 19, sx + 4, bodyY + 29);
      }
    }
    if (b.phase === "bound") {
      g.lineStyle(3, 0xc5e7ab, 0.9);
      for (let n = 0; n < 3; n++)
        g.strokeEllipse(x, bodyY - 15 + n * 15, 105, 22);
    }
    if (time < b.hurtUntil) {
      g.lineStyle(3, 0xffefc2, 0.8);
      g.strokeEllipse(x, bodyY, 97, 80);
    }
    g.restore();
    const active = !dead && b.phase !== "sleep";
    this.title
      .setPosition((GUARDIAN.left + GUARDIAN.right) / 2, y - 235)
      .setText(
        dead
          ? "露冠守卫 · 已苏醒"
          : active
            ? `露冠守卫 · ${b.hp}/${GUARDIAN.hp}\n${warning ? "→ 冲锋将至 · 跳起或 Shift 穿过" : b.phase === "slam-warn" ? "↑ 根浪将至 · 空格跳过，K 可打断" : b.phase === "recover" ? "✧ 疲惫破绽 · J 双倍伤害" : b.phase === "bound" ? "✧ 藤蔓破绽 · J 双倍伤害" : "按住 J 连击 · K 打断 · R 重试"}`
            : "沉睡的露冠守卫",
      );
    if (active) {
      g.fillStyle(0x183b40, 0.9);
      const center = (GUARDIAN.left + GUARDIAN.right) / 2;
      g.fillRoundedRect(center - 150, y - 190, 300, 10, 5);
      g.fillStyle(warning ? 0xf3bd91 : 0xc3deb0, 1);
      g.fillRoundedRect(
        center - 148,
        y - 188,
        (296 * b.hp) / GUARDIAN.hp,
        6,
        3,
      );
      const ready = time >= b.bindReadyAt;
      g.lineStyle(2, ready ? 0xc5edb7 : 0x6c8c82, 0.85);
      g.strokeCircle(x, y - 110, 9);
      if (!ready) {
        g.lineStyle(2, 0xf1d5a4, 1);
        g.beginPath();
        g.arc(
          x,
          y - 110,
          9,
          -Math.PI / 2,
          -Math.PI / 2 +
            Math.PI * 2 * Math.max(0, 1 - (b.bindReadyAt - time) / 5.5),
        );
        g.strokePath();
      }
    }
    // The exit stays in sight, replacing the old return traversal.
    g.lineStyle(5, 0x6eaa94, 0.9);
    g.strokeRoundedRect(3520, 960, 110, 140, 48);
    g.lineStyle(1, 0xf1dfad, 0.85);
    g.strokeRoundedRect(3530, 970, 90, 130, 40);
    g.fillStyle(0xc8f3d9, dead ? 0.15 : 0.035);
    g.fillRoundedRect(3530, 970, 90, 130, 40);
    if (!dead) {
      g.lineStyle(5, 0x3d6658, 1);
      for (let n = 0; n < 5; n++) {
        const ty = 1045 - n * 18;
        g.lineBetween(3200, ty + 25, 3235, ty);
        g.lineBetween(3235, ty, 3210, ty - 17);
        g.lineStyle(2, 0xb3bb8e, 0.8);
        g.lineBetween(3218, ty + 10, 3210, ty - 3);
        g.lineStyle(5, 0x3d6658, 1);
      }
    }
  }
}
