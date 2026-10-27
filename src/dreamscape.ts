import Phaser from "phaser";
import { paintHangingCharm } from "./biomes";
type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function oval(
  c: C,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string | CanvasGradient,
  angle = 0,
) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, angle, 0, TAU);
  c.fillStyle = color;
  c.fill();
}
function halo(c: C, x: number, y: number, r: number, color: string) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(160,220,220,0)");
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}
function flower(c: C, x: number, y: number, size: number, seed: number) {
  const r = rng(seed);
  c.save();
  c.translate(x, y);
  halo(c, 0, 0, size * 2, "rgba(209,187,255,.13)");
  for (let n = 0; n < 7; n++) {
    const a = (n * TAU) / 7 - 0.2;
    const g = c.createLinearGradient(
      0,
      0,
      Math.cos(a) * size,
      Math.sin(a) * size,
    );
    g.addColorStop(0, "rgba(255,239,195,.34)");
    g.addColorStop(0.35, "rgba(222,194,231,.2)");
    g.addColorStop(1, "rgba(176,225,218,.06)");
    c.beginPath();
    c.ellipse(
      Math.cos(a) * size * 0.43,
      Math.sin(a) * size * 0.43,
      size * 0.62,
      size * 0.17,
      a,
      0,
      TAU,
    );
    c.fillStyle = g;
    c.fill();
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(
      Math.cos(a + 0.1) * size * 0.6,
      Math.sin(a + 0.1) * size * 0.6,
      Math.cos(a) * size,
      Math.sin(a) * size,
    );
    c.strokeStyle = "rgba(249,229,222,.28)";
    c.lineWidth = 0.8;
    c.stroke();
    const px = Math.cos(a) * size * 0.7,
      py = Math.sin(a) * size * 0.7;
    oval(c, px, py, 1.3, 1.3, "rgba(255,237,197,.8)");
  }
  halo(c, 0, 0, size * 0.3, "rgba(255,232,177,.5)");
  oval(c, 0, 0, size * 0.055, size * 0.055, "#fff2c9");
  for (let n = 0; n < 5; n++) {
    const px = (r() - 0.5) * size * 0.9,
      len = size * (1 + r() * 0.9);
    c.beginPath();
    c.moveTo(px, 5);
    c.bezierCurveTo(px - 20, len * 0.4, px + 20, len * 0.7, px - 5, len);
    c.strokeStyle = "rgba(205,222,202,.22)";
    c.lineWidth = 0.8;
    c.stroke();
    oval(c, px - 5, len, 2.5, 4.5, "rgba(241,226,190,.55)");
  }
  c.restore();
}

/** A painted, luminous horizon; silhouettes remain softer than playable ledges. */
export function paintDreamSky(c: C) {
  const r = rng(701),
    w = 1600,
    h = 1000;
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#25374d");
  sky.addColorStop(0.33, "#608a91");
  sky.addColorStop(0.65, "#89b1a9");
  sky.addColorStop(1, "#adbfac");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  halo(c, 1110, 240, 540, "rgba(255,222,179,.48)");
  halo(c, 400, 500, 520, "rgba(176,180,237,.24)");
  // Quiet aurora silk behind the moon, with warm and violet edges.
  c.save();
  c.globalCompositeOperation = "screen";
  for (let n = 0; n < 7; n++) {
    c.beginPath();
    c.moveTo(-100, 180 + n * 15);
    c.bezierCurveTo(470, 410 + n * 12, 650, -60 + n * 20, 1700, 230 + n * 12);
    c.strokeStyle = n % 2 ? "rgba(239,190,223,.035)" : "rgba(169,236,218,.04)";
    c.lineWidth = 19;
    c.stroke();
  }
  c.restore();
  halo(c, 1120, 240, 180, "rgba(255,236,194,.33)");
  const moon = c.createRadialGradient(1100, 214, 1, 1120, 240, 64);
  moon.addColorStop(0, "#fff3d5");
  moon.addColorStop(0.9, "#eadab6");
  moon.addColorStop(1, "rgba(239,225,190,0)");
  oval(c, 1120, 240, 64, 64, moon);
  c.strokeStyle = "rgba(255,235,203,.24)";
  c.lineWidth = 1;
  c.beginPath();
  c.ellipse(1120, 240, 135, 38, -0.22, 0, TAU);
  c.stroke();
  // A sunken sanctuary, islands and waterfalls build a horizon beyond the trees.
  for (let layer = 0; layer < 3; layer++) {
    c.beginPath();
    c.moveTo(-20, h);
    c.lineTo(-20, 650 + layer * 90);
    for (let x = -20; x <= 1640; x += 20)
      c.lineTo(
        x,
        650 +
          layer * 90 +
          Math.sin(x / 170 + layer * 2) * 48 +
          Math.cos(x / 95) * 13,
      );
    c.lineTo(1640, 1040);
    c.closePath();
    c.fillStyle = [
      "rgba(91,149,151,.3)",
      "rgba(69,126,139,.4)",
      "rgba(40,88,109,.5)",
    ][layer];
    c.fill();
  }
  for (let n = 0; n < 6; n++) {
    const x = 120 + n * 280,
      y = 470 + Math.sin(n * 2) * 100,
      size = 70 + r() * 60;
    c.beginPath();
    c.moveTo(x - size, y);
    c.bezierCurveTo(x - size * 0.7, y + 20, x - size * 0.2, y + 65, x, y + 80);
    c.bezierCurveTo(
      x + size * 0.4,
      y + 42,
      x + size * 0.8,
      y + 28,
      x + size,
      y,
    );
    c.closePath();
    c.fillStyle = "rgba(67,116,125,.29)";
    c.fill();
    oval(c, x, y, size, 10, "rgba(181,204,177,.3)");
    const waterfall = c.createLinearGradient(x, y, x, y + 310);
    waterfall.addColorStop(0, "rgba(207,231,218,.24)");
    waterfall.addColorStop(1, "rgba(207,231,218,0)");
    c.fillStyle = waterfall;
    c.fillRect(x - 5, y + 8, 6, 310);
    c.fillRect(x + 15, y + 5, 2, 240);
    if (n % 2 === 0) {
      c.strokeStyle = "rgba(220,224,192,.22)";
      c.lineWidth = 9;
      c.beginPath();
      c.moveTo(x - 31, y);
      c.lineTo(x - 31, y - 66);
      c.arc(x, y - 66, 31, Math.PI, TAU);
      c.lineTo(x + 31, y);
      c.stroke();
      flower(c, x, y - 93, 27, 30 + n);
    }
  }
  for (let n = 0; n < 5; n++)
    flower(
      c,
      150 + n * 350,
      260 + Math.sin(n * 2) * 80,
      35 + r() * 28,
      170 + n,
    );
  // Distant dew constellations create detail without suggesting collision surfaces.
  for (let n = 0; n < 170; n++) {
    const x = r() * w,
      y = 70 + r() * 700;
    oval(c, x, y, r() * 0.9 + 0.4, r() * 0.9 + 0.4, "rgba(247,238,202,.38)");
  }
}

export function paintDreamForest(c: C) {
  const r = rng(1206);
  for (let n = 0; n < 7; n++) {
    const x = -80 + n * 295,
      lean = (r() - 0.5) * 180;
    const bark = c.createLinearGradient(x - 40, 0, x + 50, 0);
    bark.addColorStop(0, "rgba(27,71,87,.65)");
    bark.addColorStop(0.65, "rgba(44,94,103,.5)");
    bark.addColorStop(1, "rgba(162,193,160,.35)");
    c.beginPath();
    c.moveTo(x - 38, 1060);
    c.bezierCurveTo(x + 35, 690, x - 20, 360, x + lean, -100);
    c.lineTo(x + lean + 25, -100);
    c.bezierCurveTo(x + 14, 350, x + 78, 720, x + 30, 1060);
    c.closePath();
    c.fillStyle = bark;
    c.fill();
    for (let j = 0; j < 5; j++) {
      const y = 200 + j * 155,
        side = j % 2 ? -1 : 1,
        tipX = x + side * (125 + r() * 80),
        tipY = y - 70;
      c.beginPath();
      c.moveTo(x + 12, y + 25);
      c.quadraticCurveTo(x + side * 90, y - 5, tipX, tipY);
      c.strokeStyle = "rgba(49,101,107,.52)";
      c.lineWidth = 6 - j * 0.6;
      c.stroke();
      for (let k = 0; k < 6; k++) {
        const px = tipX - side * k * 19,
          py = tipY + k * 5;
        oval(
          c,
          px,
          py,
          24,
          7,
          k % 2 ? "rgba(168,198,162,.28)" : "rgba(113,176,165,.25)",
          side * 0.55,
        );
        c.beginPath();
        c.moveTo(px - side * 18, py);
        c.lineTo(px + side * 18, py);
        c.strokeStyle = "rgba(205,221,174,.13)";
        c.lineWidth = 0.6;
        c.stroke();
      }
      if (j % 2 === 0) flower(c, tipX, tipY + 12, 19 + r() * 15, n * 12 + j);
    }
    c.beginPath();
    c.moveTo(x + 25, 1000);
    c.bezierCurveTo(x - 30, 700, x + 65, 400, x + lean + 12, 0);
    c.strokeStyle = "rgba(192,219,175,.18)";
    c.lineWidth = 1;
    c.stroke();
  }
}

export function paintDreamSprouts(c: C, w: number, top: number, seed: number) {
  const r = rng(seed + 405);
  // Moss cushions, tiny dew cups and pale roots break up the repeated platform lip.
  for (let n = 0; n < Math.ceil(w / 55); n++) {
    const x = 12 + r() * (w - 24);
    oval(c, x, top - 1, 5 + r() * 8, 2 + r() * 2, "rgba(158,187,127,.38)");
    if (n % 3 === 0) {
      for (let petal = 0; petal < 5; petal++) {
        const a = (petal * Math.PI * 2) / 5;
        oval(
          c,
          x + Math.cos(a) * 3,
          top - 7 + Math.sin(a) * 2,
          2.2,
          1.4,
          "#d9e4c3",
          a,
        );
      }
      oval(c, x, top - 7, 1.3, 1.3, "#efce8e");
    }
    if (n % 2 === 0) oval(c, x + 4, top - 4, 1.1, 1.8, "rgba(231,255,236,.75)");
  }
  for (let n = 0; n < Math.ceil(w / 160); n++) {
    const x = 22 + r() * (w - 44),
      height = 18 + r() * 18;
    c.beginPath();
    c.moveTo(x, top);
    c.quadraticCurveTo(x - 9, top - height * 0.5, x - 3, top - height);
    c.strokeStyle = "#83b6a1";
    c.lineWidth = 1;
    c.stroke();
    for (let k = 0; k < 3; k++) {
      const py = top - height + k * 5,
        px = x - 3 + k * 2;
      oval(c, px + 3, py, 5, 3, k % 2 ? "#c3b8d5" : "#e6c9d1", -0.5);
      oval(c, px + 4, py + 1, 1.5, 1.5, "#fff0bd");
      halo(c, px + 3, py, 12, "rgba(223,185,237,.12)");
    }
    oval(c, x + 8, top - 4, 8, 3, "#70a78d", -0.5);
    oval(c, x + 10, top - 8, 1.5, 2.5, "rgba(225,247,222,.85)");
  }
}

export class Dreamscape {
  private mist: Phaser.GameObjects.Image[] = [];
  private motes: Phaser.GameObjects.Image[] = [];
  private petals: Phaser.GameObjects.Image[] = [];
  private dew: Phaser.GameObjects.Image[] = [];
  private silk: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    const texture = (
      key: string,
      w: number,
      h: number,
      draw: (c: C) => void,
    ) => {
      const t = scene.textures.createCanvas(key, w, h)!;
      draw(t.context);
      t.refresh();
    };
    texture("dream-mote", 48, 48, (c) => {
      halo(c, 24, 24, 23, "rgba(239,224,167,.7)");
      oval(c, 24, 24, 1.8, 1.8, "#fff4d1");
    });
    texture("dream-mist", 256, 96, (c) => {
      c.save();
      c.translate(128, 48);
      c.scale(1, 0.375);
      halo(c, 0, 0, 127, "rgba(191,220,205,.4)");
      c.restore();
    });
    texture("dream-petal", 64, 32, (c) => {
      const g = c.createLinearGradient(10, 4, 52, 28);
      g.addColorStop(0, "#f3dbdf");
      g.addColorStop(0.6, "#d7b9d1");
      g.addColorStop(1, "rgba(189,225,206,.2)");
      c.beginPath();
      c.moveTo(8, 16);
      c.bezierCurveTo(24, -4, 49, 1, 57, 12);
      c.quadraticCurveTo(34, 33, 8, 16);
      c.fillStyle = g;
      c.fill();
      c.beginPath();
      c.moveTo(10, 16);
      c.quadraticCurveTo(34, 8, 53, 12);
      c.strokeStyle = "rgba(255,243,220,.7)";
      c.lineWidth = 1;
      c.stroke();
    });
    texture("dream-dew", 96, 144, (c) => {
      halo(c, 48, 77, 43, "rgba(171,225,220,.12)");
      c.beginPath();
      c.moveTo(48, 13);
      c.bezierCurveTo(42, 39, 20, 57, 22, 82);
      c.bezierCurveTo(24, 119, 76, 119, 75, 82);
      c.bezierCurveTo(74, 55, 54, 35, 48, 13);
      const g = c.createLinearGradient(22, 40, 75, 110);
      g.addColorStop(0, "rgba(238,252,218,.2)");
      g.addColorStop(0.5, "rgba(151,215,216,.06)");
      g.addColorStop(0.8, "rgba(221,178,224,.2)");
      g.addColorStop(1, "rgba(249,231,181,.32)");
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = "rgba(232,253,224,.48)";
      c.lineWidth = 1;
      c.stroke();
      c.beginPath();
      c.moveTo(38, 52);
      c.quadraticCurveTo(25, 76, 32, 89);
      c.strokeStyle = "rgba(250,255,233,.85)";
      c.lineWidth = 2;
      c.stroke();
      oval(c, 58, 98, 7, 2, "rgba(255,215,186,.7)", -0.5);
    });
    texture("glass-charm", 96, 144, (c) => paintHangingCharm(c, 1));
    texture("canopy-charm", 96, 144, (c) => paintHangingCharm(c, 2));
    texture("dream-mote-cyan", 48, 48, (c) => {
      halo(c, 24, 24, 23, "rgba(173,218,246,.6)");
      oval(c, 24, 24, 1.8, 1.8, "#edfbff");
    });
    texture("dream-mote-pink", 48, 48, (c) => {
      halo(c, 24, 24, 23, "rgba(242,186,209,.55)");
      oval(c, 24, 24, 1.8, 1.8, "#fff0d5");
    });
    texture("dream-shard", 64, 32, (c) => {
      c.beginPath();
      c.moveTo(3, 18);
      c.lineTo(35, 5);
      c.lineTo(60, 13);
      c.lineTo(24, 27);
      c.closePath();
      const g = c.createLinearGradient(3, 5, 60, 27);
      g.addColorStop(0, "rgba(223,238,247,.7)");
      g.addColorStop(0.5, "rgba(166,191,238,.25)");
      g.addColorStop(1, "rgba(235,190,232,.5)");
      c.fillStyle = g;
      c.fill();
      c.beginPath();
      c.moveTo(3, 18);
      c.lineTo(34, 15);
      c.lineTo(60, 13);
      c.strokeStyle = "rgba(233,255,244,.6)";
      c.lineWidth = 0.7;
      c.stroke();
    });
    this.silk = scene.add.graphics().setDepth(-5);
    for (let n = 0; n < 7; n++)
      this.mist.push(
        scene.add
          .image(0, 0, "dream-mist")
          .setDepth(-8 + n * 0.1)
          .setAlpha(0.2),
      );
    for (let n = 0; n < 72; n++)
      this.motes.push(
        scene.add
          .image(0, 0, "dream-mote")
          .setDepth(n % 3 === 0 ? 7 : -5)
          .setBlendMode(Phaser.BlendModes.ADD),
      );
    for (let n = 0; n < 30; n++)
      this.petals.push(
        scene.add.image(0, 0, "dream-petal").setDepth(n % 5 === 0 ? 11 : -5),
      );
    for (let n = 0; n < 7; n++)
      this.dew.push(
        scene.add.image(0, 0, "dream-dew").setDepth(n % 3 === 0 ? 10 : -5),
      );
  }
  draw(
    cam: Phaser.Cameras.Scene2D.Camera,
    time: number,
    region: number,
    reduced: boolean,
    rich: boolean,
  ) {
    const w = cam.width / cam.zoom,
      h = cam.height / cam.zoom,
      visible = true;
    this.silk.clear();
    const t = reduced ? 0 : time;
    this.mist.forEach((image, n) => {
      image.setVisible(visible && (rich || n < 3));
      image.setTint([0xe2e9ca, 0xb9d6f0, 0xddbbdb][region]);
      image.setPosition(
        cam.scrollX + w * (0.15 + n * 0.17) + Math.sin(t * 0.05 + n) * 40,
        cam.scrollY + h * (0.47 + n * 0.07),
      );
      image
        .setDisplaySize(w * 0.9, h * (0.09 + n * 0.015))
        .setAlpha(0.035 + n * 0.004);
    });
    this.motes.forEach((image, n) => {
      image.setVisible(visible && (!reduced || n < 8) && (rich || n < 22));
      const x =
        ((((n * 173 -
          cam.scrollX * 0.22 +
          t * (n % 2 ? 4 : -3) +
          Math.sin(t * 0.4 + n) * 12) %
          (w + 100)) +
          (w + 100)) %
          (w + 100)) -
        50;
      const y =
        ((((n * 97 - cam.scrollY * 0.18 + t * ((n % 3) - 1) * 2) % (h + 60)) +
          (h + 60)) %
          (h + 60)) -
        30;
      image.setTexture(
        ["dream-mote", "dream-mote-cyan", "dream-mote-pink"][region],
      );
      const size =
        (n % 9 === 0 ? 26 : 8 + (n % 5) * 2) *
        (reduced ? 1 : 0.8 + Math.sin(t * 1.1 + n) * 0.2);
      image
        .setPosition(cam.scrollX + x, cam.scrollY + y)
        .setDisplaySize(size, size)
        .setAlpha(n % 9 === 0 ? 0.26 : 0.42);
    });
    this.petals.forEach((image, n) => {
      image.setVisible(visible && !reduced && (rich || n < 7));
      image.setTexture(region === 1 ? "dream-shard" : "dream-petal");
      image.setTint([0xffffff, 0xa5e4f3, 0xffd2ae][region]);
      const x =
        ((((n * 137 + t * 13 - cam.scrollX * 0.33) % (w + 160)) + (w + 160)) %
          (w + 160)) -
        80;
      const y =
        ((((n * 83 + t * 8 - cam.scrollY * 0.13) % (h + 100)) + (h + 100)) %
          (h + 100)) -
        50;
      image
        .setPosition(
          cam.scrollX + x + Math.sin(t * 0.5 + n) * 25,
          cam.scrollY + y,
        )
        .setRotation(Math.sin(t * 0.4 + n) * 0.6 + n);
      image
        .setScale(
          0.09 + (n % 4) * 0.035,
          Math.max(0.025, Math.abs(Math.sin(t * 0.7 + n)) * 0.14),
        )
        .setAlpha(n % 5 === 0 ? 0.45 : 0.26);
    });
    this.dew.forEach((image, n) => {
      image.setVisible(visible && (rich || n < 2));
      image.setTexture(["dream-dew", "glass-charm", "canopy-charm"][region]);
      const x =
        ((((n * 227 - cam.scrollX * 0.13) % (w + 200)) + (w + 200)) %
          (w + 200)) -
        100;
      const y = h * (0.16 + (n % 3) * 0.14) + Math.sin(t * 0.25 + n) * 5;
      const scale = 0.2 + (n % 3) * 0.1;
      image
        .setPosition(cam.scrollX + x, cam.scrollY + y)
        .setScale(scale)
        .setAlpha(n % 3 === 0 ? 0.28 : 0.43);
      if (visible) {
        this.silk.lineStyle(0.6, 0xe7edcf, 0.12);
        this.silk.beginPath();
        this.silk.moveTo(cam.scrollX + x - 7, cam.scrollY - 20);
        this.silk.lineTo(cam.scrollX + x, cam.scrollY + y - 55 * scale);
        this.silk.strokePath();
      }
    });
  }
}
