import Phaser from "phaser";
import type { HeroPose } from "./art";

/** Shared painted illumination: all tiers retain action timing and ground bounce. */
export class ActionLight {
  private ground: Phaser.GameObjects.Image;
  private pulse: Phaser.GameObjects.Image;
  constructor(scene: Phaser.Scene) {
    for (const [key, color] of [
      ["action-warm", "255,217,147"],
      ["action-vine", "181,234,167"],
    ]) {
      const t = scene.textures.createCanvas(key, 256, 256)!;
      const c = t.context,
        g = c.createRadialGradient(128, 128, 0, 128, 128, 126);
      g.addColorStop(0, `rgba(${color},.65)`);
      g.addColorStop(0.23, `rgba(${color},.22)`);
      g.addColorStop(1, `rgba(${color},0)`);
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 256);
      t.refresh();
    }
    this.ground = scene.add
      .image(0, 0, "action-warm")
      .setDepth(5.1)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.pulse = scene.add
      .image(0, 0, "action-warm")
      .setDepth(5.3)
      .setBlendMode(Phaser.BlendModes.ADD);
  }
  draw(p: HeroPose, title: boolean, reduced: boolean) {
    const attackAge = p.clock - p.attackAt,
      castAge = p.clock - p.bindAt;
    const attack =
      attackAge >= 0.07 && attackAge < 0.32
        ? Math.sin(((attackAge - 0.07) / 0.25) * Math.PI)
        : 0;
    const cast =
      castAge >= 0 && castAge < 0.45 ? Math.sin((castAge / 0.45) * Math.PI) : 0;
    this.ground
      .setVisible(!title && p.onGround)
      .setPosition(p.x - p.facing * 8, p.y + 1)
      .setDisplaySize(115 + attack * 50, 20 + attack * 6)
      .setAlpha(0.26 + attack * 0.12);
    this.pulse
      .setVisible(!title && !reduced && (attack > 0 || cast > 0))
      .setTexture(cast > attack ? "action-vine" : "action-warm")
      .setPosition(p.x + p.facing * (cast > attack ? 24 : 40), p.y - 32)
      .setDisplaySize(90 + attack * 35, 76)
      .setAlpha(Math.max(attack, cast) * 0.25);
  }
}
