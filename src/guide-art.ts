import Phaser from "phaser";
export class GuideArt {
  private ink: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene) {
    this.ink = scene.add.graphics().setDepth(9.5);
    this.label = scene.add
      .text(0, 0, "", {
        fontFamily: "Microsoft YaHei",
        fontSize: "12px",
        color: "#f5e7bc",
        backgroundColor: "#183b3bd9",
        padding: { x: 9, y: 6 },
      })
      .setOrigin(0.5, 1)
      .setDepth(9.6);
  }
  draw(
    clock: number,
    cam: Phaser.Cameras.Scene2D.Camera,
    player: { x: number; y: number },
    point: { x: number; y: number; action: string },
    visible: boolean,
    reduced: boolean,
  ) {
    const g = this.ink;
    g.clear().setVisible(visible);
    this.label.setVisible(visible);
    if (!visible) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2) / cam.zoom,
      view = cam.worldView;
    const x = Phaser.Math.Clamp(
      point.x,
      view.left + 65 * scale,
      view.right - 65 * scale,
    );
    const y = Phaser.Math.Clamp(
      point.y - 42,
      view.top + 250 * scale,
      view.bottom - 95 * scale,
    );
    const pulse = reduced ? 0 : Math.sin(clock * 2.4) * 2 * scale;
    const angle = Math.atan2(point.y - player.y, point.x - player.x);
    g.lineStyle(1 * scale, 0xe5d9ac, 0.5);
    g.strokeCircle(x, y, 15 * scale + pulse);
    g.fillStyle(0x234e49, 0.72);
    g.fillCircle(x, y, 12 * scale);
    const dx = Math.cos(angle),
      dy = Math.sin(angle);
    g.lineStyle(2 * scale, 0xf1e4af, 0.88);
    g.beginPath();
    g.moveTo(
      x - dx * 5 * scale - dy * 5 * scale,
      y - dy * 5 * scale + dx * 5 * scale,
    );
    g.lineTo(x + dx * 5 * scale, y + dy * 5 * scale);
    g.lineTo(
      x - dx * 5 * scale + dy * 5 * scale,
      y - dy * 5 * scale - dx * 5 * scale,
    );
    g.strokePath();
    this.label.setScale(scale).setText(point.action);
    const textMargin = this.label.displayWidth / 2 + 12 * scale;
    this.label.setPosition(
      Phaser.Math.Clamp(x, view.left + textMargin, view.right - textMargin),
      y - 22 * scale,
    );
    if (Math.abs(point.x - x) < 5 && Math.abs(point.y - 42 - y) < 5) {
      g.lineStyle(1 * scale, 0xd8e6be, 0.45);
      g.strokeEllipse(point.x, point.y - 2, 38, 7);
      for (let n = 0; n < 3; n++) {
        g.fillStyle(0xf5e3aa, 0.4 - n * 0.1);
        g.fillCircle(x, y + 22 * scale + n * 5 * scale, 1 * scale);
      }
    }
  }
}
