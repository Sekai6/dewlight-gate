import Phaser from "phaser";
import type { SkillEvent } from "@dewlight/action-skill";
import type { SkillId, SkillPose } from "./content/skills.ts";
import { createPresentation, samplePresentation } from "./skill-presentation";
/** One Graphics object, fixed event ring; never creates per-cast display objects. */
export class SkillArt {
  private g: Phaser.GameObjects.Graphics;
  private cursor = 0;
  private presentation = createPresentation();
  private rings = Array.from({ length: 18 }, () => ({
    x: 0,
    y: 0,
    at: -999,
    color: 0,
    facing: 1,
    seed: 0,
    skill: "branch" as SkillEvent["skill"],
  }));
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(6.2);
  }
  reset() {
    for (const r of this.rings) r.at = -999;
    this.g.clear();
  }
  event(e: SkillEvent, x: number, y: number, now: number, facing = 1) {
    if (e.type !== "release" && e.type !== "hit") return;
    const r = this.rings[this.cursor++ % this.rings.length];
    r.x = x;
    r.y = y - 25;
    r.at = now;
    r.facing = facing;
    r.skill = e.skill;
    r.seed = e.instance * 0.71 + (e.section ?? 0) * 1.13;
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
      const fade = (1 - t) ** 2;
      const radius = r.skill === "bloom" ? 42 : r.skill === "rise" ? 34 : 48;
      g.lineStyle(reduced ? 1 : 1.5, r.color, fade * 0.42);
      g.strokeEllipse(r.x, r.y, 18 + t * radius, 6 + t * radius * 0.28);
      if (!reduced)
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + r.seed;
          const travel = 1 - (1 - t) ** 2;
          const spread = r.skill === "branch" ? 20 : 34;
          const x =
            r.x +
            Math.cos(a) * (10 + travel * spread) +
            (r.skill === "branch" ? r.facing * travel * 50 : 0);
          const y =
            r.y + Math.sin(a) * (8 + travel * 34) - travel * 18 + t * t * 32;
          g.lineStyle(1, r.color, fade * 0.65);
          g.lineBetween(x - Math.cos(a) * 7, y - Math.sin(a) * 7, x, y);
          g.fillStyle(r.color, fade * 0.9);
          g.fillTriangle(x, y - 3, x + 2.5, y, x, y + 4);
        }
    }
    if (!pose) return;
    const { x, y } = hero,
      facing = hero.facing;
    const state = samplePresentation(pose, this.presentation);
    const alpha = state.release * (1 - state.recovery);
    if (state.anticipation > 0.01) {
      const radius = 10 + (1 - state.anticipation) * 18;
      g.lineStyle(1.5, 0xe9efcf, state.anticipation * 0.65);
      g.strokeEllipse(x, y - 27, radius * 2, radius);
      if (!reduced)
        for (let index = 0; index < 4; index++) {
          const angle = index * Math.PI * 0.5 + pose.age * 6;
          g.fillStyle(0xd8edba, state.anticipation * 0.8);
          g.fillCircle(
            x + Math.cos(angle) * radius,
            y - 27 + Math.sin(angle) * radius * 0.5,
            1.8,
          );
        }
    }
    if (pose.id === "branch") {
      for (let strand = 0; strand < (reduced ? 1 : 3); strand++) {
        g.lineStyle(
          strand === 0 ? 2.5 : 1,
          strand === 0 ? 0xf5efcb : 0x9de6d6,
          alpha * (0.6 - strand * 0.12),
        );
        g.beginPath();
        for (let index = 0; index <= 18; index++) {
          const u = index / 18;
          const px = x + facing * (16 - u * 115);
          const py =
            y -
            28 +
            Math.sin(u * Math.PI + strand * 0.8) * (8 + strand * 5) +
            u * u * 14;
          if (index === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
      if (!reduced) {
        g.lineStyle(1, 0xb2eee0, alpha * 0.45);
        for (let index = 0; index < 4; index++) {
          const px = x - facing * (18 + index * 24);
          const py = y - 28 + Math.sin(index + pose.age * 10) * 12;
          g.strokeTriangle(px, py - 7, px + facing * 12, py, px, py + 7);
        }
      }
    } else if (pose.id === "rise") {
      const growth = Math.min(1, Math.max(0, (pose.age - 0.08) / 0.16));
      for (let strand = 0; strand < (reduced ? 1 : 2); strand++) {
        g.lineStyle(
          strand ? 1 : 2.5,
          strand ? 0xf5e5b1 : 0xb9e1a6,
          alpha * 0.7,
        );
        g.beginPath();
        for (let index = 0; index <= 22; index++) {
          const u = (index / 22) * growth;
          const px =
            x +
            facing *
              (Math.sin(u * Math.PI * 1.6 + strand * 0.8) * 26 - 14 + u * 25);
          const py = y + 14 - u * 106;
          if (index === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
          if (!reduced && index % 6 === 0) {
            g.fillStyle(0xc6e8b1, alpha * 0.55);
            g.fillTriangle(
              px,
              py,
              px + facing * 12,
              py - 7,
              px + facing * 9,
              py + 3,
            );
          }
        }
        g.strokePath();
      }
    } else {
      for (let petal = 0; petal < (reduced ? 3 : 6); petal++) {
        const angle = (petal * Math.PI) / 3 + state.turn * facing;
        g.lineStyle(
          petal % 2 ? 1 : 2,
          petal % 2 ? 0xffe9bc : 0xb7edde,
          alpha * (reduced ? 0.4 : 0.6),
        );
        g.beginPath();
        for (let index = 0; index <= 16; index++) {
          const u = index / 16;
          const theta = angle + (u - 0.5) * 1.15;
          const radius = 18 + Math.sin(u * Math.PI) * state.radius;
          const px = x + Math.cos(theta) * radius;
          const py = y - 28 + Math.sin(theta) * radius * 0.65;
          if (index === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
    }
  }
}
