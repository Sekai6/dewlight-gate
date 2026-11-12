import Phaser from "phaser";
import type { SkillEvent } from "@dewlight/action-skill";
import { SKILLS, type SkillId, type SkillPose } from "./content/skills.ts";
import { createPresentation, samplePresentation } from "./skill-presentation";
/** One Graphics object with fixed pools of release rings and impact marks;
 *  nothing is created per cast. */
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
    skill: "branch" as SkillId,
  }));
  /** Sparks where a blade actually met something. */
  private marks = Array.from({ length: 12 }, () => ({
    x: 0,
    y: 0,
    at: -999,
    facing: 1,
    power: 0,
    angle: 0,
  }));
  private markCursor = 0;
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(6.2);
  }
  reset() {
    for (const r of this.rings) r.at = -999;
    for (const m of this.marks) m.at = -999;
    this.g.clear();
  }
  /** A blade connected at (x, y). `power` 0..1 scales the mark. */
  impact(x: number, y: number, now: number, facing: number, power: number) {
    const m = this.marks[this.markCursor++ % this.marks.length];
    m.x = x;
    m.y = y;
    m.at = now;
    m.facing = facing;
    m.power = power;
    // Alternate the cut direction so consecutive hits read apart.
    m.angle =
      (this.markCursor % 2 ? -0.55 : 0.4) + (this.markCursor % 3) * 0.12;
  }
  event(e: SkillEvent<SkillId>, x: number, y: number, now: number, facing = 1) {
    if (e.type !== "release") return;
    const r = this.rings[this.cursor++ % this.rings.length];
    r.x = x;
    r.y = y - 25;
    r.at = now;
    r.facing = facing;
    r.skill = e.skill;
    r.seed = e.instance * 0.71 + (e.section ?? 0) * 1.13;
    r.color = SKILLS[e.skill].color;
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
      const radius = SKILLS[r.skill].ring;
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
    for (const m of this.marks) {
      const age = now - m.at;
      if (age < 0 || age > 0.22) continue;
      const t = age / 0.22,
        fade = (1 - t) ** 2;
      const reach = (22 + m.power * 30) * (0.55 + 0.45 * t);
      const cx = Math.cos(m.angle) * m.facing,
        cy = Math.sin(m.angle);
      // The cut itself: a bright core inside a softer, wider stroke.
      g.lineStyle(5 + m.power * 5, 0xb9efe0, fade * 0.3);
      g.lineBetween(
        m.x - cx * reach,
        m.y - cy * reach,
        m.x + cx * reach,
        m.y + cy * reach,
      );
      g.lineStyle(1.5 + m.power * 1.5, 0xfffbe6, fade);
      g.lineBetween(
        m.x - cx * reach,
        m.y - cy * reach,
        m.x + cx * reach,
        m.y + cy * reach,
      );
      if (reduced) continue;
      g.lineStyle(1.5, 0xfff1c4, fade * 0.6);
      g.strokeCircle(m.x, m.y, 6 + t * (18 + m.power * 26));
      for (let i = 0; i < 5; i++) {
        const a = m.angle + (i - 2) * 0.42,
          near = 10 + t * (26 + m.power * 34),
          far = near + 9 * (1 - t);
        g.lineStyle(1, 0xfff6d8, fade * 0.8);
        g.lineBetween(
          m.x + Math.cos(a) * near * m.facing,
          m.y + Math.sin(a) * near,
          m.x + Math.cos(a) * far * m.facing,
          m.y + Math.sin(a) * far,
        );
      }
    }
    if (!pose) return;
    const skill = SKILLS[pose.id];
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
    if (state.anticipation > 0.01 && !reduced) {
      // Light gathers toward the blade before the release.
      g.lineStyle(1, skill.color, state.anticipation * 0.55);
      for (let index = 0; index < 6; index++) {
        const angle = index * 1.05 + pose.instance,
          far = 26 + (1 - state.anticipation) * 44,
          near = far * 0.55;
        g.lineBetween(
          x + Math.cos(angle) * far,
          y - 27 + Math.sin(angle) * far * 0.6,
          x + Math.cos(angle) * near,
          y - 27 + Math.sin(angle) * near * 0.6,
        );
      }
    }
    if (state.impact > 0.01) {
      // Each hit moment pulses outward from the caster.
      const pulse = 22 + (1 - state.impact) * skill.radius;
      g.lineStyle(2, skill.color, state.impact * 0.7);
      g.strokeEllipse(x, y - 27, pulse * 2, pulse * 1.1);
      g.fillStyle(0xfffbe6, state.impact * 0.12);
      g.fillEllipse(x, y - 27, pulse * 1.5, pulse * 0.8);
    }
    if (!reduced && state.recovery > 0 && state.recovery < 1)
      // The light lets go: motes drift up as the stance settles.
      for (let index = 0; index < 6; index++) {
        const drift = state.recovery,
          px = x + Math.sin(index * 2.4 + pose.instance) * (14 + drift * 22),
          py = y - 16 - index * 5 - drift * 26;
        g.fillStyle(skill.color, (1 - drift) * 0.7);
        g.fillCircle(px, py, 1.6 * (1 - drift * 0.5));
      }
    const cy = y - 28;
    if (pose.id === "branch") {
      // A lance of refracted light: a tapered wake behind the thrust, a bright
      // tip ahead of it, and shards of the prism shed along the way.
      const length = 40 + state.release * 115;
      g.fillStyle(0x9de6d6, alpha * 0.16);
      g.beginPath();
      g.moveTo(x + facing * 34, cy);
      g.lineTo(x - facing * length, cy - 15);
      g.lineTo(x - facing * length * 0.78, cy);
      g.lineTo(x - facing * length, cy + 15);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xfffbe6, alpha * 0.55);
      g.fillTriangle(
        x + facing * 56,
        cy,
        x + facing * 18,
        cy - 6,
        x + facing * 18,
        cy + 6,
      );
      for (let strand = 0; strand < (reduced ? 1 : 3); strand++) {
        g.lineStyle(
          strand === 0 ? 2.5 : 1,
          strand === 0 ? 0xf5efcb : 0x9de6d6,
          alpha * (0.6 - strand * 0.12),
        );
        g.beginPath();
        for (let index = 0; index <= 18; index++) {
          const u = index / 18;
          const px = x + facing * (16 - u * length);
          const py =
            cy +
            Math.sin(u * Math.PI + strand * 0.8) * (8 + strand * 5) +
            u * u * 14;
          if (index === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
      if (!reduced)
        for (let index = 0; index < 6; index++) {
          const px = x - facing * (24 + index * 22 + ((pose.age * 90) % 22));
          const py = cy + Math.sin(index * 1.9 + pose.age * 14) * 17;
          g.fillStyle(index % 2 ? 0xfff1c4 : 0xb2eee0, alpha * 0.75);
          g.fillTriangle(px, py - 5, px + 3, py, px, py + 5);
          g.fillTriangle(px, py - 5, px - 3, py, px, py + 5);
        }
    } else if (pose.id === "rise") {
      // A crescent of new growth sweeps up in front; vines climb behind it and
      // leaves are carried upward from a burst at the feet.
      const growth = Math.min(1, Math.max(0, (pose.age - 0.08) / 0.16));
      const from = -0.7,
        span = 2.5 * growth;
      g.fillStyle(0xd5ecb5, alpha * 0.22);
      g.beginPath();
      for (let index = 0; index <= 14; index++) {
        const a = from + (index / 14) * span;
        const px = x + facing * Math.cos(a) * 66,
          py = cy - Math.sin(a) * 66;
        if (index === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      for (let index = 14; index >= 0; index--) {
        const u = index / 14,
          a = from + u * span,
          r = 66 - Math.sin(u * Math.PI) * 22;
        g.lineTo(x + facing * Math.cos(a) * r, cy - Math.sin(a) * r);
      }
      g.closePath();
      g.fillPath();
      g.lineStyle(2, 0xfbf6d2, alpha * 0.8);
      g.beginPath();
      for (let index = 0; index <= 14; index++) {
        const a = from + (index / 14) * span;
        const px = x + facing * Math.cos(a) * 66,
          py = cy - Math.sin(a) * 66;
        if (index === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
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
        }
        g.strokePath();
      }
      if (!reduced)
        for (let index = 0; index < 6; index++) {
          const climb = (pose.age * 170 + index * 21) % 120;
          const px = x + facing * Math.sin(index * 2.1 + pose.age * 9) * 30,
            py = y - 6 - climb;
          g.fillStyle(0xc6e8b1, alpha * 0.7 * (1 - climb / 120));
          g.fillTriangle(
            px,
            py,
            px + facing * 11,
            py - 6,
            px + facing * 8,
            py + 3,
          );
        }
    } else {
      // A flower of dew opens around the body: a soft core, filled petals
      // turning with the blade, and a ring of droplets turning against it.
      const reach = 22 + state.radius;
      g.fillStyle(0xffe7b8, alpha * 0.12);
      g.fillEllipse(x, cy, state.radius * 2.3, state.radius * 1.5);
      for (let petal = 0; petal < (reduced ? 3 : 6); petal++) {
        const angle = (petal * Math.PI) / 3 + state.turn * facing;
        g.fillStyle(
          petal % 2 ? 0xffe9bc : 0xb7edde,
          alpha * (reduced ? 0.16 : 0.24),
        );
        g.fillTriangle(
          x + Math.cos(angle) * reach,
          cy + Math.sin(angle) * reach * 0.65,
          x + Math.cos(angle - 0.42) * 16,
          cy + Math.sin(angle - 0.42) * 16 * 0.65,
          x + Math.cos(angle + 0.42) * 16,
          cy + Math.sin(angle + 0.42) * 16 * 0.65,
        );
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
          const py = cy + Math.sin(theta) * radius * 0.65;
          if (index === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
      if (!reduced)
        for (let index = 0; index < 8; index++) {
          const a = (index * Math.PI) / 4 - state.turn * facing * 0.5,
            r = state.radius + 32;
          g.fillStyle(0xfffbe6, alpha * 0.85);
          g.fillCircle(x + Math.cos(a) * r, cy + Math.sin(a) * r * 0.65, 2);
        }
    }
  }
}
