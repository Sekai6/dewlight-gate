import Phaser from "phaser";

type C = CanvasRenderingContext2D;
function ellipse(
  c: C,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  angle = 0,
) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
}
function line(c: C, points: number[][], color: string, width = 1) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "round";
  c.stroke();
}
function arch(c: C, x: number, y: number, w: number, h: number) {
  c.beginPath();
  c.moveTo(x - w / 2, y);
  c.lineTo(x - w / 2, y - h * 0.65);
  c.bezierCurveTo(x - w / 2, y - h * 0.88, x - w * 0.16, y - h, x, y - h);
  c.bezierCurveTo(
    x + w * 0.16,
    y - h,
    x + w / 2,
    y - h * 0.88,
    x + w / 2,
    y - h * 0.65,
  );
  c.lineTo(x + w / 2, y);
}
function petal(
  c: C,
  x: number,
  y: number,
  size: number,
  angle: number,
  color: string,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(
    -size * 0.35,
    -size * 0.45,
    -size * 0.25,
    -size * 0.85,
    0,
    -size,
  );
  c.bezierCurveTo(size * 0.25, -size * 0.85, size * 0.35, -size * 0.45, 0, 0);
  c.fillStyle = color;
  c.fill();
  c.strokeStyle = "rgba(237,235,188,.4)";
  c.lineWidth = 0.8;
  c.stroke();
  line(
    c,
    [
      [0, 0],
      [0, -size * 0.85],
    ],
    "rgba(233,234,192,.3)",
  );
  c.restore();
}
function paint(c: C, region: number) {
  c.translate(450, 585);
  // Reflecting basin and its hand-carved stone lip.
  for (let step = 2; step >= 0; step--) {
    ellipse(
      c,
      0,
      step * 9,
      285 + step * 17,
      29 + step * 3,
      step === 0 ? "rgba(106,153,149,.3)" : "rgba(29,68,73,.4)",
    );
    c.beginPath();
    c.ellipse(
      0,
      step * 9,
      285 + step * 17,
      29 + step * 3,
      0,
      Math.PI,
      Math.PI * 2,
    );
    c.strokeStyle = "rgba(213,216,173,.32)";
    c.lineWidth = 1;
    c.stroke();
  }
  if (region === 1) {
    // A glazed arcade, with separate leadwork and translucent stained panels.
    for (let bay = -1; bay <= 1; bay++) {
      const x = bay * 180,
        h = bay === 0 ? 440 : 355;
      arch(c, x, -35, 153, h);
      c.lineTo(x - 76, -35);
      c.closePath();
      const glass = c.createLinearGradient(x - 70, -h, x + 70, 0);
      glass.addColorStop(0, "rgba(135,169,214,.14)");
      glass.addColorStop(0.45, "rgba(196,169,211,.1)");
      glass.addColorStop(0.75, "rgba(159,217,210,.13)");
      glass.addColorStop(1, "rgba(203,204,170,.03)");
      c.fillStyle = glass;
      c.fill();
      arch(c, x, -35, 153, h);
      c.strokeStyle = "rgba(44,77,92,.65)";
      c.lineWidth = 13;
      c.stroke();
      arch(c, x, -35, 153, h);
      c.strokeStyle = "rgba(198,223,213,.55)";
      c.lineWidth = 1.6;
      c.stroke();
      line(
        c,
        [
          [x, -35],
          [x, -h + 15],
        ],
        "rgba(213,220,202,.32)",
      );
      for (let pane = 0; pane < 4; pane++) {
        const y = -95 - pane * 64;
        line(
          c,
          [
            [x - 70, y],
            [x, y - 25],
            [x + 70, y],
          ],
          "rgba(199,213,210,.25)",
        );
        c.beginPath();
        c.moveTo(x, y - 52);
        c.lineTo(x + 23, y - 22);
        c.lineTo(x, y + 9);
        c.lineTo(x - 23, y - 22);
        c.closePath();
        c.fillStyle =
          pane % 2 ? "rgba(204,167,217,.14)" : "rgba(170,225,219,.17)";
        c.fill();
        c.strokeStyle = "rgba(223,221,191,.3)";
        c.stroke();
      }
      ellipse(c, x, -h + 70, 17, 17, "rgba(240,219,163,.2)");
    }
    for (const side of [-1, 1]) {
      line(
        c,
        [
          [side * 300, -25],
          [side * 315, -230],
          [side * 280, -280],
        ],
        "rgba(65,107,112,.65)",
        4,
      );
      for (let n = 0; n < 5; n++)
        petal(
          c,
          side * (290 + n * 4),
          -80 - n * 35,
          45,
          side * 0.9,
          "rgba(137,185,179,.25)",
        );
    }
  } else if (region === 0) {
    // Curved lotus stalks, veined cupped leaves, and a suspended seed fountain.
    for (let n = 0; n < 5; n++) {
      const x = (n - 2) * 112,
        h = 245 + Math.cos(n * 1.7) * 75;
      c.beginPath();
      c.moveTo(x * 0.5, -10);
      c.bezierCurveTo(x * 0.4, -90, x + 45, -h * 0.8, x, -h);
      c.strokeStyle = "rgba(52,112,103,.65)";
      c.lineWidth = 5;
      c.stroke();
      c.strokeStyle = "rgba(190,214,163,.4)";
      c.lineWidth = 1;
      c.stroke();
      c.save();
      c.translate(x, -h);
      c.rotate((n - 2) * 0.12);
      ellipse(c, 0, 0, 85, 19, "rgba(104,165,139,.38)");
      for (let vein = 0; vein < 9; vein++) {
        const a = (vein * Math.PI) / 4.5;
        line(
          c,
          [
            [0, 3],
            [Math.cos(a) * 80, Math.sin(a) * 16],
          ],
          "rgba(213,229,180,.3)",
          0.7,
        );
      }
      c.beginPath();
      c.ellipse(0, 0, 85, 19, 0, 0, Math.PI);
      c.strokeStyle = "rgba(228,226,178,.42)";
      c.lineWidth = 1.2;
      c.stroke();
      c.restore();
    }
    for (let n = -3; n <= 3; n++)
      petal(c, 0, -335, 85 - Math.abs(n) * 9, n * 0.29, "rgba(214,196,213,.3)");
    ellipse(c, 0, -350, 18, 9, "rgba(246,224,167,.65)");
    for (let n = -2; n <= 2; n++) {
      const g = c.createLinearGradient(0, -340, 0, -30);
      g.addColorStop(0, "rgba(211,238,214,.28)");
      g.addColorStop(1, "rgba(211,238,214,0)");
      c.beginPath();
      c.moveTo(n * 7, -340);
      c.bezierCurveTo(n * 18, -240, n * 14, -120, n * 32, -30);
      c.strokeStyle = g;
      c.lineWidth = 1.2;
      c.stroke();
    }
  } else {
    // A woven root pergola shelters seed cradles and veined translucent leaves.
    for (const side of [-1, 1]) {
      for (let root = 0; root < 3; root++) {
        c.beginPath();
        c.moveTo(side * (220 + root * 19), 0);
        c.bezierCurveTo(
          side * (330 - root * 20),
          -190,
          side * 150,
          -390,
          side * 20,
          -440,
        );
        c.strokeStyle = root % 2 ? "rgba(68,90,73,.65)" : "rgba(59,86,78,.6)";
        c.lineWidth = 15 - root * 3;
        c.stroke();
        c.strokeStyle = "rgba(210,193,141,.3)";
        c.lineWidth = 1;
        c.stroke();
      }
      for (let n = 0; n < 5; n++)
        petal(
          c,
          side * (100 + n * 27),
          -330 + n * 54,
          100 - n * 7,
          side * 1.15,
          "rgba(127,163,133,.26)",
        );
    }
    for (let n = -1; n <= 1; n++) {
      const x = n * 125,
        y = -200 - Math.abs(n) * 70;
      line(
        c,
        [
          [x, -400 + Math.abs(n) * 30],
          [x, y - 48],
        ],
        "rgba(199,199,155,.5)",
      );
      for (let side = -1; side <= 1; side += 2)
        petal(c, x, y + 25, 78, side * 0.35, "rgba(193,167,197,.35)");
      ellipse(c, x, y - 12, 8, 15, "rgba(249,218,163,.55)");
      for (let rib = 0; rib < 3; rib++) {
        c.beginPath();
        c.ellipse(x, y - 12, 13 + rib * 7, 28 + rib * 4, 0, 0, Math.PI * 2);
        c.strokeStyle = "rgba(218,216,168,.25)";
        c.lineWidth = 0.8;
        c.stroke();
      }
    }
  }
  for (let n = 0; n < 13; n++) {
    const x = -255 + n * 42,
      y = -4 + Math.sin(n * 2) * 8;
    ellipse(c, x, y, 2.6, 1.1, "rgba(237,232,187,.35)");
  }
}
export class GardenArchitecture {
  private images: Phaser.GameObjects.Image[] = [];
  constructor(scene: Phaser.Scene) {
    for (let region = 0; region < 3; region++) {
      const key = `garden-arcade-${region}`,
        t = scene.textures.createCanvas(key, 900, 650)!;
      paint(t.context, region);
      t.refresh();
      for (let room = region * 2; room < region * 2 + 2; room++)
        for (let n = 0; n < 2; n++)
          this.images.push(
            scene.add
              .image(room * 6000 + 1250 + n * 2800, 890, key)
              .setOrigin(0.5, 585 / 650)
              .setDepth(-8)
              .setScale(n ? 0.85 : 1),
          );
    }
  }
  draw(cam: Phaser.Cameras.Scene2D.Camera, title: boolean) {
    const w = cam.width / cam.zoom,
      h = cam.height / cam.zoom;
    this.images.forEach((image) =>
      image.setVisible(
        !title &&
          image.x + 500 > cam.scrollX &&
          image.x - 500 < cam.scrollX + w &&
          image.y > cam.scrollY &&
          image.y - 650 < cam.scrollY + h,
      ),
    );
  }
}
