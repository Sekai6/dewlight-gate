import { ActionActor } from "./action-a/actor";
import { creatureAction } from "./action-a/drivers";
import Phaser from "phaser";
import { enemySpawns } from "./level";
import type { Enemy } from "./creature";

export class CreatureDirector {
  readonly actors: ActionActor[] = [];
  private ink: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {
    enemySpawns.forEach((e) => {
      const a = new ActionActor(scene, e.type ? "moth" : "moss", 4);
      a.setVisible(false);
      this.actors.push(a);
    });
    this.ink = scene.add.graphics().setDepth(4.2);
  }
  draw(
    enemies: Enemy[],
    time: number,
    cam: Phaser.Cameras.Scene2D.Camera,
    reduced: boolean,
    visible: boolean,
    playerX: number,
  ) {
    this.ink.clear();
    this.actors.forEach((i) => i.setVisible(false));
    if (!visible) return;
    const g = this.ink;
    enemies.forEach((e, index) => {
      if (
        e.x < cam.scrollX - 140 ||
        e.x > cam.scrollX + cam.width / cam.zoom + 140 ||
        e.y < cam.scrollY - 150 ||
        e.y > cam.scrollY + cam.height / cam.zoom + 160
      )
        return;
      const dead = e.hp <= 0,
        age = time - e.diedAt;
      if (dead && age > 0.65) return;
      const bound = e.bound > time,
        hurt = time - e.hurtAt < 0.2;
      let actor = this.actors[index];
      if (!actor)
        actor = this.actors[index] = new ActionActor(
          this.scene,
          e.type ? "moth" : "moss",
          4,
        );
      actor.draw(creatureAction(e, time, reduced));
      if (hurt && !dead) {
        const flash = Math.max(0, 1 - (time - e.hurtAt) / 0.2);
        g.lineStyle(1.4, 0xf7efd0, flash * 0.65);
        for (let n = 0; n < 4; n++) {
          const a = (n * Math.PI) / 2 + 0.3,
            r = 25 + (1 - flash) * 18;
          g.lineBetween(
            e.x + Math.cos(a) * r,
            e.y - 25 + Math.sin(a) * r,
            e.x + Math.cos(a) * (r + 7),
            e.y - 25 + Math.sin(a) * (r + 7),
          );
        }
      }
      if (dead) return;
      g.fillStyle(0x0d2932, e.type ? 0.12 : 0.25);
      g.fillEllipse(e.x, e.floor + 2, e.type ? 34 : 58, e.type ? 5 : 8);
      if (e.phase === "windup" && !bound) {
        const p = 1 - e.warn / (e.type ? 0.85 : 0.7),
          dir = e.attackDir;
        g.fillStyle(0xf4b780, 0.06 + p * 0.09);
        g.fillTriangle(
          e.x,
          e.y - 14,
          e.x + dir * 100,
          e.y - 28,
          e.x + dir * 100,
          e.y + 1,
        );
        g.lineStyle(2, 0xf2c08b, 0.8);
        g.beginPath();
        g.arc(
          e.x,
          e.y - 25,
          43 - p * 10,
          -Math.PI / 2,
          -Math.PI / 2 + p * Math.PI * 2,
        );
        g.strokePath();
        g.fillStyle(0xffe2aa);
        g.fillTriangle(e.x, e.y - 74, e.x - 4, e.y - 66, e.x + 4, e.y - 66);
      }
      if (e.phase === "strike" && !bound) {
        g.lineStyle(2, 0xf7d5a0, 0.6);
        for (let n = 0; n < 3; n++)
          g.lineBetween(
            e.x - e.attackDir * (24 + n * 7),
            e.y - 14 - n * 8,
            e.x - e.attackDir * (50 + n * 9),
            e.y - 14 - n * 8,
          );
      }
      if (bound) {
        const remaining = Math.max(0, e.bound - time);
        g.lineStyle(1, 0xc4e9aa, 0.45);
        g.beginPath();
        g.arc(
          e.x,
          e.y - 25,
          39,
          -Math.PI / 2,
          -Math.PI / 2 + Math.min(1, remaining / 3) * Math.PI * 2,
        );
        g.strokePath();
      }
      if (e.phase === "recover" && !bound && !hurt) {
        // Falling seed flecks make the vulnerable recovery readable in every tier.
        const progress = Math.min(1, (time - e.phaseAt) / 0.45);
        for (let n = 0; n < 3; n++) {
          const x = e.x - 18 + n * 16,
            y = e.y - 45 + progress * 18 + n * 3;
          g.fillStyle(0xe3d3a2, (1 - progress) * 0.55);
          g.fillEllipse(x, y, 3, 1.5);
        }
      }
      if (
        Math.abs(e.x - playerX) < 240 &&
        (e.hp < 2 || e.phase !== "patrol" || bound)
      ) {
        for (let n = 0; n < 2; n++) {
          g.fillStyle(n < e.hp ? 0xddd7a5 : 0x36585a, 0.9);
          g.fillRoundedRect(e.x - 9 + n * 10, e.y - 61, 7, 3, 1);
        }
      }
    });
  }
}
