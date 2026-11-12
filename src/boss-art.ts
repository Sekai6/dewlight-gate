import type { PhaserActor as ActionActor } from "@dewlight/action-a/phaser";
import { createActor } from "./content/actors.ts";
import { guardianAction } from "./action-drivers";
import Phaser from "phaser";
import type { DewGuardian } from "./boss";
import { GUARDIAN } from "./boss";
import { projectileAngle, warningProgress } from "./boss";

export class GuardianArt {
  readonly actor: ActionActor;
  private g: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private hit: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene) {
    this.actor = createActor(scene, "guardian", 5.6);
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
  draw(
    b: DewGuardian,
    time: number,
    visible: boolean,
    reduced: boolean,
    target?: import("@dewlight/action-a").IntentTarget,
  ) {
    const g = this.g;
    g.clear();
    this.title.setVisible(visible);
    this.hit.setVisible(visible && time < b.hurtUntil);
    this.actor.draw(guardianAction(b, time, reduced, visible, target));
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
    for (const h of b.hazards) {
      const waiting = time < h.at;
      const progress = warningProgress(time, b.phaseAt, h.at);
      const alpha = waiting
        ? 0.35 +
          0.35 *
            Math.min(1, (time - b.phaseAt) / Math.max(0.1, h.at - b.phaseAt))
        : 0.9;
      if (h.kind === "crystal") {
        if (waiting) {
          g.lineStyle(1.5, 0xefbf8e, alpha);
          g.lineBetween(h.x, h.y, h.x + h.vx * 1.8, h.y + h.vy * 1.8);
          g.strokeCircle(h.x + h.vx * 0.25, h.y + h.vy * 0.25, h.radius);
        } else {
          const angle = projectileAngle(h.vx, h.vy);
          const dx = Math.cos(angle),
            dy = Math.sin(angle);
          g.lineStyle(3, 0x85b8b6, 0.25);
          g.lineBetween(h.x - dx * 38, h.y - dy * 38, h.x, h.y);
          g.fillStyle(0xa9d8d1, 0.82);
          g.fillTriangle(
            h.x - dx * 17 - dy * 9,
            h.y - dy * 17 + dx * 9,
            h.x + dx * 19,
            h.y + dy * 19,
            h.x - dx * 17 + dy * 9,
            h.y - dy * 17 - dx * 9,
          );
          g.lineStyle(1.5, 0xffdb9e, 0.95);
          g.lineBetween(
            h.x - dx * 10,
            h.y - dy * 10,
            h.x + dx * 19,
            h.y + dy * 19,
          );
        }
      } else {
        const height = h.kind === "radiance" ? 380 : 90;
        g.fillStyle(waiting ? 0xeab980 : 0x91d4bb, waiting ? 0.12 : 0.35);
        g.fillRect(h.x - h.radius, h.y - height, h.radius * 2, height);
        g.lineStyle(2, 0xffd99f, alpha);
        g.strokeRect(h.x - h.radius, h.y - height, h.radius * 2, height);
        g.strokeEllipse(h.x, h.y - 3, h.radius * 2, 13);
        if (waiting) {
          g.lineStyle(3, 0xffe2ad, 0.8);
          g.lineBetween(
            h.x - h.radius,
            h.y - 3,
            h.x - h.radius + h.radius * 2 * progress,
            h.y - 3,
          );
          if (h.kind === "garden") {
            g.lineStyle(2, 0xb7d7a0, 0.7);
            g.lineBetween(h.x, h.y - 5, h.x, h.y - 12 - progress * 20);
            g.lineBetween(h.x, h.y - 12, h.x - 9, h.y - 20 - progress * 10);
            g.lineBetween(h.x, h.y - 17, h.x + 9, h.y - 25 - progress * 10);
          } else {
            g.lineStyle(1, 0xffe7b4, 0.5 + progress * 0.3);
            g.strokeEllipse(
              h.x,
              h.y - height + 22,
              h.radius * 2 * (1 - progress * 0.65),
              14,
            );
          }
          g.lineBetween(h.x - 9, h.y - 35, h.x, h.y - 20);
          g.lineBetween(h.x + 9, h.y - 35, h.x, h.y - 20);
        } else if (h.kind === "garden") {
          for (let n = -1; n <= 1; n++)
            g.fillTriangle(
              h.x + n * 18 - 9,
              h.y,
              h.x + n * 18,
              h.y - 85 + Math.abs(n) * 20,
              h.x + n * 18 + 9,
              h.y,
            );
        } else {
          g.fillStyle(0xffe3a0, 0.12);
          g.fillRect(
            h.x - h.radius * 0.7,
            h.y - height,
            h.radius * 1.4,
            height,
          );
          g.lineStyle(8, 0xffedbc, reduced ? 0.5 : 0.8);
          g.lineBetween(h.x, h.y - height, h.x, h.y);
        }
      }
    }
    if (b.phase === "bound") {
      g.lineStyle(3, 0xc5e7ab, 0.9);
      for (let n = 0; n < 3; n++) g.strokeEllipse(x, y - 60 + n * 15, 105, 22);
    }
    if (time < b.hurtUntil) {
      g.lineStyle(2, 0xffefc2, 0.7);
      g.strokeEllipse(x, y - 65, 100, 100);
    }
    const active = !dead && b.phase !== "sleep";
    this.title
      .setPosition((GUARDIAN.left + GUARDIAN.right) / 2, y - 235)
      .setText(
        dead
          ? "露冠守卫 · 已苏醒"
          : active
            ? `露冠守卫 · ${b.difficulty === "challenge" ? "挑战" : "普通"} · ${b.hp}/${b.maxHp}\n${warning ? "→ 冲锋将至 · 跳起或 Shift 穿过" : b.phase === "slam-warn" ? "↑ 根浪将至 · 空格跳过，右键可打断" : b.phase === "crystal-warn" ? "◇ 折冠散晶 · 穿过晶刃间隙" : b.phase === "garden-warn" ? "♧ 根庭绽刺 · 离开藤芽标记" : b.phase === "radiance-warn" ? "↓ 露冠辉落 · 离开竖直光柱" : b.phase === "recover" ? "✧ 疲惫破绽 · 左键双倍伤害" : b.phase === "bound" ? "✧ 藤蔓破绽 · 左键双倍伤害" : "Q / E / R 剑舞 · 右键打断 · T 重试"}`
            : "沉睡的露冠守卫",
      );
    if (active) {
      g.fillStyle(0x183b40, 0.9);
      const center = (GUARDIAN.left + GUARDIAN.right) / 2;
      g.fillRoundedRect(center - 150, y - 190, 300, 10, 5);
      g.fillStyle(warning ? 0xf3bd91 : 0xc3deb0, 1);
      g.fillRoundedRect(center - 148, y - 188, (296 * b.hp) / b.maxHp, 6, 3);
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
