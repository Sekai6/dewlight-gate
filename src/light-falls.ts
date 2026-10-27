import Phaser from "phaser";
import type { Platform } from "./level";

/** Painted rivulets, anchored to shelves behind gameplay silhouettes. */
export class LightFalls {
  private falls: {
    image: Phaser.GameObjects.Image;
    platform: Platform;
    height: number;
    phase: number;
  }[] = [];
  private beads: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, platforms: Platform[]) {
    this.beads = scene.add.graphics().setDepth(-5);
    for (let region = 0; region < 3; region++) {
      const texture = scene.textures.createCanvas(
        `light-fall-${region}`,
        160,
        640,
      )!;
      const c = texture.context,
        color = ["174,232,208", "177,202,245", "234,194,219"][region];
      for (let strand = 0; strand < 9; strand++) {
        const x = 45 + strand * 8,
          g = c.createLinearGradient(0, 0, 0, 640);
        g.addColorStop(0, `rgba(${color},0)`);
        g.addColorStop(0.12, `rgba(${color},${strand % 3 === 0 ? 0.3 : 0.09})`);
        g.addColorStop(0.65, `rgba(${color},.08)`);
        g.addColorStop(1, `rgba(${color},0)`);
        c.beginPath();
        c.moveTo(x, 0);
        c.bezierCurveTo(x - 12, 180, x + 22, 390, x - 8, 640);
        c.strokeStyle = g;
        c.lineWidth = strand % 3 === 0 ? 2 : 7;
        c.stroke();
      }
      for (let n = 0; n < 32; n++) {
        c.beginPath();
        c.ellipse(
          80 + Math.sin(n * 3.7) * 32,
          n * 18 + 25,
          1 + (n % 3) * 0.4,
          2.5,
          0,
          0,
          Math.PI * 2,
        );
        c.fillStyle = `rgba(${color},${0.12 + (n % 4) * 0.07})`;
        c.fill();
      }
      texture.refresh();
      for (let room = region * 2; room < region * 2 + 2; room++) {
        const choices = platforms.filter(
          (p) => p.room === room && !p.moving && p.y > 200 && p.y < 750,
        );
        for (let n = 0; n < Math.min(4, choices.length); n++) {
          const p = choices[Math.floor((n * choices.length) / 4)],
            height = 230 + (n % 3) * 90;
          this.falls.push({
            image: scene.add
              .image(p.x + p.w - 35, p.y + 12, `light-fall-${region}`)
              .setOrigin(0.5, 0)
              .setDepth(-6),
            platform: p,
            height,
            phase: room * 7 + n,
          });
        }
      }
    }
  }
  draw(
    cam: Phaser.Cameras.Scene2D.Camera,
    time: number,
    region: number,
    reduced: boolean,
    title: boolean,
  ) {
    this.beads.clear();
    const t = reduced ? 0 : time,
      w = cam.width / cam.zoom,
      h = cam.height / cam.zoom;
    for (const fall of this.falls) {
      const p = fall.platform,
        x = p.x + p.w - 35,
        y = p.y + 12;
      const visible =
        !title &&
        x > cam.scrollX - 90 &&
        x < cam.scrollX + w + 90 &&
        y + fall.height > cam.scrollY &&
        y < cam.scrollY + h;
      fall.image.setVisible(visible).setPosition(x, y);
      if (!visible) continue;
      fall.image
        .setAlpha(0.65 + Math.sin(t * 0.6 + fall.phase) * 0.12)
        .setDisplaySize(90 + Math.sin(t * 0.35 + fall.phase) * 5, fall.height);
      for (let n = 0; n < 4; n++) {
        const progress = (t * 0.12 + n * 0.25 + fall.phase * 0.13) % 1;
        this.beads.fillStyle(
          [0xc5e9d4, 0xc9e0ff, 0xf1ccdf][region],
          Math.sin(progress * Math.PI) * 0.4,
        );
        this.beads.fillEllipse(
          x + Math.sin(progress * 6 + fall.phase) * 9,
          y + progress * fall.height,
          2,
          5,
        );
      }
    }
  }
}
