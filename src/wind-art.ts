import Phaser from "phaser";
import { drawWindLandscape, drawWindRibbons } from "./wind-landscape";
import { platforms } from "./level";
import { sampleWind, windZones } from "./wind";

export class WindArt {
  private ink: Phaser.GameObjects.Graphics;
  private signs: Phaser.GameObjects.Text[];
  private hint: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene) {
    this.ink = scene.add.graphics().setDepth(5.7);
    this.signs = windZones.map((z) =>
      scene.add
        .text(
          z.x + z.w / 2 + (z.push ? 110 : 0),
          z.y + z.h - 18,
          `${z.lift > 1000 ? "↑" : z.push > 0 ? "→" : "←"} ${z.name}`,
          {
            fontFamily: "Microsoft YaHei",
            fontSize: "12px",
            color: "#e2edc5",
            backgroundColor: "#254c4a",
            padding: { x: 8, y: 5 },
          },
        )
        .setOrigin(0.5, 1)
        .setDepth(5.8),
    );
    this.hint = scene.add
      .text(0, 0, "", {
        fontFamily: "Microsoft YaHei",
        fontSize: "12px",
        color: "#f8edc3",
        backgroundColor: "#254c4a",
        padding: { x: 9, y: 6 },
      })
      .setOrigin(0.5, 1)
      .setDepth(10);
  }
  draw(
    clock: number,
    camera: Phaser.Cameras.Scene2D.Camera,
    player: { x: number; y: number },
    reduced: boolean,
    visible: boolean,
    turned: Record<string, number> = {},
  ) {
    const g = this.ink;
    g.clear().setVisible(visible);
    const time = reduced ? 0 : clock;
    windZones.forEach((z, index) => {
      const show =
        visible &&
        z.x < camera.worldView.right + 100 &&
        z.x + z.w > camera.worldView.left - 100;
      this.signs[index].setVisible(show);
      if (!show) return;
      const base = z.y + z.h;
      const reversed = clock < (turned[z.id] ?? -1);
      const push = z.push * (reversed ? -1 : 1);
      this.signs[index].setText(
        z.lift > 1000
          ? "↑ 蒲苇上升风"
          : `${push > 0 ? "→" : "←"} 花信风 · E 转向${reversed ? " · " + Math.ceil(turned[z.id] - clock) + "秒" : ""}`,
      );
      drawWindRibbons(g, z, clock, push, reduced);
      drawWindLandscape(g, z, clock, push, reduced, platforms);
      const cx = z.x + z.w / 2,
        cy = base - 60;
      g.lineStyle(2, 0x7fa99b, 0.65);
      g.lineBetween(cx, 1100, cx, cy);
      g.lineStyle(1, 0xe4d7a3, 0.7);
      g.strokeCircle(cx, cy, 17);
      for (let petal = 0; petal < 4; petal++) {
        const a = (petal * Math.PI) / 2 + time * (push < 0 ? -1 : 1);
        g.fillStyle(0xc5ebde, 0.65);
        g.fillTriangle(
          cx,
          cy,
          cx + Math.cos(a) * 19,
          cy + Math.sin(a) * 19,
          cx + Math.cos(a + 0.65) * 12,
          cy + Math.sin(a + 0.65) * 12,
        );
      }
      // Deterministic streamlines pause with the world; no wall-clock particles.
      for (let n = 0; n < (reduced ? 8 : 24); n++) {
        const phase = (n * 0.618 + time * (z.lift > 1000 ? 0.28 : 0.16)) % 1;
        const x =
          z.lift > 1000
            ? z.x + 25 + ((n * 47) % (z.w - 50))
            : z.x + (push > 0 ? phase : 1 - phase) * z.w;
        const y =
          z.lift > 1000
            ? base - phase * z.h
            : z.y + 30 + ((n * 61) % (z.h - 60));
        const alpha = Math.sin(phase * Math.PI) * 0.32;
        g.lineStyle(1, 0xd5f1da, alpha);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 1; k <= 7; k++)
          g.lineTo(
            x +
              (z.lift > 1000
                ? Math.sin(k * 0.5 + n) * 4
                : k * (push > 0 ? 6 : -6)),
            y + (z.lift > 1000 ? k * 6 : Math.sin(k * 0.5 + n) * 4),
          );
        g.strokePath();
        if (n % 3 === 0) {
          g.fillStyle(n % 2 ? 0xd9d69b : 0x9fceb0, alpha + 0.16);
          g.fillEllipse(x, y, 6, 2.5);
        }
      }
    });
    const wind = sampleWind(player.x, player.y, clock, turned);
    this.hint.setVisible(visible && !!wind.zone);
    if (wind.zone)
      this.hint
        .setPosition(player.x, player.y - 95)
        .setText(
          wind.lift > 1000
            ? "↑ 跳起乘风 · 按住 S / ↓ 收身下降"
            : "顺风延长跳跃 · 按住 S / ↓ 抵住气流",
        );
  }
}
