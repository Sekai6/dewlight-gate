import Phaser from "phaser";
type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
function gradient(
  c: C,
  x: number,
  y: number,
  x2: number,
  y2: number,
  colors: string[],
) {
  const g = c.createLinearGradient(x, y, x2, y2);
  colors.forEach((color, i) => g.addColorStop(i / (colors.length - 1), color));
  return g;
}
function ellipse(
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
  g.addColorStop(1, "rgba(170,190,220,0)");
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}
function crystal(c: C, x: number, y: number, w: number, h: number, alpha = 1) {
  c.save();
  c.globalAlpha *= alpha;
  c.beginPath();
  c.moveTo(x, y - h);
  c.lineTo(x + w * 0.55, y - h * 0.38);
  c.lineTo(x + w * 0.35, y);
  c.lineTo(x - w * 0.4, y);
  c.lineTo(x - w * 0.5, y - h * 0.45);
  c.closePath();
  c.fillStyle = "rgba(25,49,76,.45)";
  c.fill();
  c.fillStyle = gradient(c, x - w * 0.5, y - h, x + w * 0.5, y, [
    "rgba(220,236,249,.6)",
    "rgba(118,171,202,.2)",
    "rgba(207,161,212,.22)",
  ]);
  c.fill();
  c.strokeStyle = "rgba(206,240,235,.5)";
  c.lineWidth = 1;
  c.stroke();
  c.beginPath();
  c.moveTo(x, y - h);
  c.lineTo(x + w * 0.08, y - h * 0.35);
  c.lineTo(x - w * 0.4, y);
  c.strokeStyle = "rgba(229,224,247,.48)";
  c.stroke();
  c.beginPath();
  c.moveTo(x - w * 0.5, y - h * 0.45);
  c.lineTo(x + w * 0.08, y - h * 0.35);
  c.lineTo(x + w * 0.55, y - h * 0.38);
  c.strokeStyle = "rgba(245,239,218,.3)";
  c.stroke();
}
function ring(c: C, x: number, y: number, r: number, alpha = 0.5) {
  c.save();
  c.strokeStyle = `rgba(223,219,195,${alpha})`;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.stroke();
  c.lineWidth = 0.7;
  c.beginPath();
  c.arc(x, y, r + 11, 0, TAU);
  c.stroke();
  for (let n = 0; n < 32; n++) {
    const a = (n * TAU) / 32;
    c.beginPath();
    c.moveTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4));
    c.lineTo(
      x + Math.cos(a) * (r + (n % 4 ? 8 : 19)),
      y + Math.sin(a) * (r + (n % 4 ? 8 : 19)),
    );
    c.stroke();
  }
  c.restore();
}
function leaf(
  c: C,
  x: number,
  y: number,
  length: number,
  width: number,
  angle: number,
  color: string,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(length * 0.2, -width, length * 0.7, -width * 0.8, length, 0);
  c.bezierCurveTo(length * 0.65, width * 0.7, length * 0.15, width * 0.6, 0, 0);
  c.fillStyle = color;
  c.fill();
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(length * 0.5, -width * 0.08, length, 0);
  c.strokeStyle = "rgba(213,218,172,.28)";
  c.lineWidth = 0.7;
  c.stroke();
  for (let n = 1; n < 5; n++) {
    c.beginPath();
    c.moveTo((length * n) / 6, 0);
    c.lineTo((length * (n + 0.8)) / 6, -width * 0.45);
    c.strokeStyle = "rgba(202,216,177,.12)";
    c.stroke();
  }
  c.restore();
}
function bell(c: C, x: number, y: number, size: number, pink = false) {
  halo(
    c,
    x,
    y + size * 0.4,
    size * 1.8,
    pink ? "rgba(229,169,211,.15)" : "rgba(251,215,153,.15)",
  );
  c.beginPath();
  c.moveTo(x - size * 0.15, y - size * 0.6);
  c.bezierCurveTo(
    x - size * 0.65,
    y - size * 0.5,
    x - size * 0.4,
    y + size * 0.6,
    x - size * 0.65,
    y + size * 0.7,
  );
  c.quadraticCurveTo(x, y + size, x + size * 0.65, y + size * 0.7);
  c.bezierCurveTo(
    x + size * 0.4,
    y + size * 0.5,
    x + size * 0.6,
    y - size * 0.5,
    x + size * 0.15,
    y - size * 0.6,
  );
  c.closePath();
  c.fillStyle = gradient(
    c,
    x - size * 0.6,
    y - size * 0.6,
    x + size * 0.4,
    y + size,
    [
      pink ? "rgba(220,187,225,.6)" : "rgba(201,222,181,.5)",
      "rgba(251,218,177,.12)",
      "rgba(255,221,162,.6)",
    ],
  );
  c.fill();
  c.strokeStyle = "rgba(240,226,187,.4)";
  c.lineWidth = 0.7;
  c.stroke();
  ellipse(
    c,
    x,
    y + size * 0.64,
    size * 0.42,
    size * 0.11,
    "rgba(255,231,166,.7)",
  );
  c.beginPath();
  c.moveTo(x, y + size * 0.6);
  c.lineTo(x, y + size * 1.12);
  c.strokeStyle = "#d6c79d";
  c.lineWidth = 0.8;
  c.stroke();
  ellipse(c, x, y + size * 1.15, 1.8, 3, "#f4dfae");
}
function blossom(c: C, x: number, y: number, size: number) {
  halo(c, x, y, size * 1.9, "rgba(231,177,218,.18)");
  for (let n = 0; n < 9; n++) {
    const a = (n * TAU) / 9;
    ellipse(
      c,
      x + Math.cos(a) * size * 0.36,
      y + Math.sin(a) * size * 0.36,
      size * 0.62,
      size * 0.16,
      gradient(c, x, y, x + Math.cos(a) * size, y + Math.sin(a) * size, [
        "rgba(255,225,181,.32)",
        "rgba(226,178,213,.25)",
        "rgba(204,208,204,.02)",
      ]),
      a,
    );
  }
  ellipse(c, x, y, size * 0.07, size * 0.07, "#ffe6b2");
}

export function paintGlassSky(c: C) {
  c.fillStyle = gradient(c, 0, 0, 0, 1000, [
    "#192440",
    "#546a97",
    "#91b9c2",
    "#7b9eac",
  ]);
  c.fillRect(0, 0, 1600, 1000);
  halo(c, 1050, 290, 470, "rgba(170,199,247,.23)");
  halo(c, 500, 560, 470, "rgba(227,171,220,.13)");
  // A stained-glass eclipse and its reflection anchor the entire biome.
  ring(c, 1120, 230, 102, 0.35);
  ring(c, 1120, 230, 76, 0.2);
  for (let n = 0; n < 12; n++) {
    const a = (n * TAU) / 12;
    ellipse(
      c,
      1120 + Math.cos(a) * 47,
      230 + Math.sin(a) * 47,
      35,
      10,
      n % 2 ? "rgba(221,200,234,.12)" : "rgba(173,232,235,.17)",
      a,
    );
  }
  crystal(c, 1120, 285, 77, 140, 0.8);
  halo(c, 1120, 230, 72, "rgba(213,247,237,.2)");
  for (let layer = 0; layer < 3; layer++) {
    for (let n = 0; n < 15; n++) {
      const x = n * 135 + (layer % 2) * 50,
        y = 900 - layer * 80;
      crystal(
        c,
        x,
        y,
        60 + layer * 12,
        140 + Math.sin(n * 3 + layer) * 90 + layer * 60,
        0.15 + layer * 0.05,
      );
    }
  }
  // Suspended colonnades: bright silhouettes inside deep blue haze.
  for (let n = 0; n < 5; n++) {
    const x = 110 + n * 350,
      y = 550 + Math.sin(n * 2) * 90;
    ellipse(c, x, y, 110, 8, "rgba(174,218,218,.17)");
    for (let k = -2; k <= 2; k++) {
      crystal(c, x + k * 32, y, 22, 70 + (2 - Math.abs(k)) * 30, 0.3);
      c.strokeStyle = "rgba(197,218,231,.2)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + k * 32, y + 10);
      c.lineTo(x + k * 30, y + 140);
      c.stroke();
    }
    const fall = gradient(c, x, y, x, y + 300, [
      "rgba(185,223,238,.2)",
      "rgba(185,223,238,0)",
    ]);
    c.fillStyle = fall;
    c.fillRect(x - 5, y + 10, 10, 300);
  }
  for (let n = 0; n < 12; n++) {
    c.beginPath();
    c.moveTo(-30, 180 + n * 45);
    c.bezierCurveTo(400, 270 + n * 34, 950, -20 + n * 67, 1650, 160 + n * 50);
    c.strokeStyle = n % 2 ? "rgba(247,191,221,.06)" : "rgba(186,224,247,.08)";
    c.lineWidth = 0.7;
    c.stroke();
  }
}
export function paintGlassForest(c: C) {
  for (let n = 0; n < 9; n++) {
    const x = -50 + n * 235,
      y = 1040;
    crystal(c, x, y, 100, 850 + Math.sin(n * 2) * 180, 0.8);
    crystal(c, x - 42, y, 39, 220 + Math.cos(n) * 120, 0.65);
    crystal(c, x + 47, y, 45, 330 + Math.sin(n) * 90, 0.6);
    c.strokeStyle = "rgba(157,198,204,.26)";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(x, 1050);
    c.bezierCurveTo(x + 70, 700, x - 50, 310, x + 180, -80);
    c.stroke();
    for (let k = 0; k < 4; k++) {
      const y = 180 + k * 180,
        px = x + Math.sin(k + n) * 55;
      c.strokeStyle = "rgba(219,216,215,.25)";
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(px, y - 45);
      c.lineTo(px, y);
      c.stroke();
      bell(c, px, y, 12 + k * 2, k % 2 === 0);
    }
  }
}
export function paintCanopySky(c: C) {
  c.fillStyle = gradient(c, 0, 0, 0, 1000, [
    "#24243f",
    "#725e83",
    "#a6a5a2",
    "#839f9a",
  ]);
  c.fillRect(0, 0, 1600, 1000);
  halo(c, 1100, 260, 500, "rgba(255,212,170,.3)");
  halo(c, 350, 500, 420, "rgba(189,156,222,.2)");
  // A luminous ancient tree and rings of floating seed islands.
  c.save();
  c.translate(1100, 990);
  for (let side of [-1, 1]) {
    c.beginPath();
    c.moveTo(side * 65, 70);
    c.bezierCurveTo(side * 10, -220, side * 120, -500, side * 10, -730);
    c.strokeStyle = "rgba(77,91,100,.34)";
    c.lineWidth = 62;
    c.stroke();
    for (let n = 0; n < 6; n++) {
      const y = -220 - n * 85;
      c.beginPath();
      c.moveTo(side * 20, y);
      c.bezierCurveTo(
        side * 130,
        y - 70,
        side * 230,
        y + 40,
        side * (300 - n * 20),
        y - 120,
      );
      c.strokeStyle = "rgba(107,128,125,.3)";
      c.lineWidth = 13 - n;
      c.stroke();
      leaf(
        c,
        side * (245 - n * 19),
        y - 74,
        side * 125,
        22,
        side * 0.3,
        "rgba(174,188,155,.21)",
      );
    }
  }
  blossom(c, 0, -730, 120);
  ring(c, 0, -730, 145, 0.15);
  c.restore();
  for (let n = 0; n < 10; n++) {
    const x = 90 + n * 170,
      y = 610 + Math.sin(n * 2) * 180;
    ellipse(c, x, y, 50, 6, "rgba(145,174,151,.2)");
    c.beginPath();
    c.moveTo(x - 35, y);
    c.quadraticCurveTo(x - 12, y + 65, x + 25, y + 20);
    c.strokeStyle = "rgba(93,122,114,.24)";
    c.lineWidth = 12;
    c.stroke();
    blossom(c, x, y - 20, 22 + (n % 3) * 10);
    bell(c, x + 15, y + 30, 10, n % 2 === 0);
  }
  for (let layer = 0; layer < 3; layer++) {
    c.beginPath();
    c.moveTo(0, 1050);
    for (let x = 0; x <= 1620; x += 30)
      c.lineTo(x, 790 + layer * 70 + Math.sin(x / 190 + layer) * 70);
    c.lineTo(1620, 1050);
    c.closePath();
    c.fillStyle = [
      "rgba(113,151,145,.18)",
      "rgba(72,115,121,.3)",
      "rgba(40,78,98,.35)",
    ][layer];
    c.fill();
  }
}
export function paintCanopyForest(c: C) {
  for (let n = 0; n < 7; n++) {
    const x = -70 + n * 310;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(x + side * 13, 1100);
      c.bezierCurveTo(
        x + side * 130,
        790,
        x - side * 70,
        430,
        x + side * 80,
        -100,
      );
      c.strokeStyle = side < 0 ? "rgba(36,65,77,.62)" : "rgba(54,90,90,.57)";
      c.lineWidth = 22;
      c.stroke();
      c.strokeStyle = "rgba(192,196,150,.27)";
      c.lineWidth = 1.4;
      c.stroke();
    }
    for (let k = 0; k < 7; k++) {
      const y = 60 + k * 145,
        side = k % 2 ? -1 : 1,
        px = x + Math.sin(k * 2) * 40;
      leaf(
        c,
        px,
        y,
        side * (80 + (k % 3) * 30),
        15 + (k % 2) * 8,
        side * 0.6,
        "rgba(114,160,132,.34)",
      );
      c.beginPath();
      c.moveTo(px, y);
      c.bezierCurveTo(
        px + side * 60,
        y - 50,
        px + side * 110,
        y + 40,
        px + side * 80,
        y + 80,
      );
      c.strokeStyle = "rgba(143,167,132,.4)";
      c.lineWidth = 1.1;
      c.stroke();
      if (k % 2 === 0) bell(c, px + side * 80, y + 80, 15, k % 4 === 0);
    }
  }
}

function paintVista(c: C, room: number) {
  c.translate(500, 820);
  const region = Math.floor(room / 2),
    second = room % 2 === 1;
  if (region === 0) {
    // The dew altar and the sleeping lily bridge are unique to the two gardens.
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(side * 220, 60);
      c.bezierCurveTo(
        side * 30,
        -180,
        side * (second ? 320 : 80),
        -330,
        side * 90,
        -500,
      );
      c.strokeStyle = "rgba(70,124,116,.5)";
      c.lineWidth = 23;
      c.stroke();
      c.strokeStyle = "rgba(180,215,171,.4)";
      c.lineWidth = 1.4;
      c.stroke();
      for (let n = 0; n < 5; n++)
        leaf(
          c,
          side * (60 + n * 24),
          -130 - n * 68,
          side * 130,
          24,
          -side * 0.4,
          "rgba(141,184,150,.27)",
        );
    }
    if (second) {
      c.beginPath();
      c.arc(0, -250, 220, Math.PI, TAU);
      c.strokeStyle = "rgba(168,204,177,.45)";
      c.lineWidth = 12;
      c.stroke();
      for (let n = 0; n < 7; n++) {
        const a = Math.PI + (n * Math.PI) / 6;
        bell(c, Math.cos(a) * 220, -250 + Math.sin(a) * 220, 16, n % 2 === 0);
      }
      blossom(c, 0, -275, 100);
    } else {
      for (let n = 0; n < 7; n++)
        leaf(
          c,
          -40 + n * 12,
          -340,
          220,
          38,
          -Math.PI * 0.95 + n * 0.15,
          "rgba(176,215,185,.28)",
        );
      blossom(c, 0, -450, 135);
      const fall = gradient(c, 0, -430, 0, 0, [
        "rgba(211,238,215,.25)",
        "rgba(184,230,225,.09)",
        "rgba(184,230,225,0)",
      ]);
      c.fillStyle = fall;
      c.fillRect(-12, -430, 24, 430);
      for (let n = 0; n < 5; n++)
        ellipse(
          c,
          0,
          -20 + n * 7,
          90 + n * 32,
          10 + n * 3,
          "rgba(188,225,201,.08)",
        );
    }
  } else if (region === 1) {
    c.translate(0, -80);
    ring(c, 0, -380, second ? 160 : 210, 0.4);
    if (!second) {
      for (let n = 0; n < 16; n++) {
        const a = (n * TAU) / 16;
        crystal(c, Math.cos(a) * 140, -380 + Math.sin(a) * 140, 22, 60, 0.5);
      }
      crystal(c, 0, -270, 100, 230, 0.75);
      for (let side of [-1, 1]) {
        crystal(c, side * 230, 20, 80, 420, 0.5);
        c.beginPath();
        c.moveTo(side * 230, -390);
        c.quadraticCurveTo(side * 110, -670, 0, -600);
        c.strokeStyle = "rgba(208,229,230,.38)";
        c.lineWidth = 5;
        c.stroke();
      }
    } else {
      for (let n = 0; n < 7; n++) {
        const x = (n - 3) * 75,
          y = -560 + Math.abs(n - 3) * 35;
        c.beginPath();
        c.moveTo(x, -700);
        c.lineTo(x, y - 40);
        c.strokeStyle = "rgba(210,233,227,.4)";
        c.lineWidth = 0.8;
        c.stroke();
        bell(c, x, y, 35, n % 2 === 0);
        crystal(c, x, y + 170, 30, 100, 0.45);
      }
      ellipse(c, 0, -300, 270, 34, "rgba(179,223,222,.09)");
    }
    for (let n = 0; n < 6; n++)
      crystal(c, -200 + n * 80, 70, 50, 130 + (n % 3) * 50, 0.3);
  } else {
    for (let side of [-1, 1]) {
      c.beginPath();
      c.moveTo(side * 220, 40);
      c.bezierCurveTo(-side * 150, -200, side * 300, -490, side * 40, -710);
      c.strokeStyle = "rgba(62,102,95,.6)";
      c.lineWidth = 35;
      c.stroke();
      c.strokeStyle = "rgba(198,193,138,.4)";
      c.lineWidth = 1.5;
      c.stroke();
      for (let n = 0; n < 6; n++)
        leaf(
          c,
          side * (70 + Math.sin(n) * 70),
          -80 - n * 95,
          side * 150,
          30,
          side * 0.5,
          "rgba(137,170,132,.29)",
        );
    }
    if (second) {
      blossom(c, 0, -490, 180);
      for (let n = 0; n < 8; n++) {
        const a = (n * TAU) / 8;
        bell(c, Math.cos(a) * 160, -370 + Math.sin(a) * 100, 22, n % 2 === 0);
      }
    } else {
      ring(c, 0, -420, 145, 0.25);
      bell(c, 0, -420, 80, true);
      for (let n = 0; n < 5; n++)
        blossom(c, (n - 2) * 75, -170 + Math.sin(n) * 40, 40);
    }
  }
}

export class GardenVistas {
  private images: Phaser.GameObjects.Image[] = [];
  private frames: Phaser.GameObjects.Image[] = [];
  constructor(scene: Phaser.Scene) {
    for (let region = 0; region < 3; region++) {
      const key = `near-garden-${region}`,
        t = scene.textures.createCanvas(key, 1000, 700)!;
      paintForeground(t.context, region);
      t.refresh();
      this.frames.push(scene.add.image(0, 0, key).setOrigin(0).setDepth(13));
    }
    for (let room = 0; room < 6; room++) {
      const key = `garden-vista-${room}`,
        t = scene.textures.createCanvas(key, 1000, 900)!;
      paintVista(t.context, room);
      t.refresh();
      for (let n = 0; n < 2; n++)
        this.images.push(
          scene.add
            .image(room * 6000 + 1600 + n * 2800, 1050, key)
            .setOrigin(0.5, 1)
            .setScale(n ? 0.82 : 1.05)
            .setAlpha(n ? 0.64 : 0.82)
            .setDepth(-11),
        );
    }
  }
  draw(
    cam: Phaser.Cameras.Scene2D.Camera,
    visible: boolean,
    region: number,
    rich: boolean,
    focus?: { x: number; y: number },
  ) {
    const w = cam.width / cam.zoom,
      h = cam.height / cam.zoom;
    for (const image of this.images)
      image.setVisible(
        visible &&
          image.x + 600 > cam.scrollX &&
          image.x - 600 < cam.scrollX + w &&
          image.y > cam.scrollY &&
          image.y - 1000 < cam.scrollY + h,
      );
    this.frames.forEach((image, n) => {
      const px = focus ? (focus.x - cam.scrollX) / w : 0.5;
      const py = focus ? (focus.y - cam.scrollY) / h : 0.5;
      // Let the foreground frame the shot, then recede when the player reaches its corners.
      const nearCorner = py > 0.7 && (px < 0.23 || px > 0.77);
      image
        .setVisible(n === region)
        .setAlpha(nearCorner ? 0.3 : rich ? 0.85 : 0.65)
        .setPosition(cam.scrollX, cam.scrollY)
        .setDisplaySize(w, h);
    });
  }
}

function paintForeground(c: C, region: number) {
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side < 0 ? 0 : 1000, 700);
    c.scale(side < 0 ? 1 : -1, 1);
    if (region === 1) {
      crystal(c, 12, 50, 100, 230, 0.6);
      crystal(c, 70, 50, 70, 125, 0.5);
      for (let n = 0; n < 3; n++) {
        const x = 20 + n * 20,
          y = -110 - n * 70;
        c.beginPath();
        c.moveTo(-10, y - 25);
        c.lineTo(x, y);
        c.strokeStyle = "rgba(137,179,191,.3)";
        c.lineWidth = 0.8;
        c.stroke();
        bell(c, x, y, 9, true);
      }
    } else {
      c.beginPath();
      c.moveTo(-30, 35);
      c.bezierCurveTo(20, -70, 45, -180, 110, -227);
      c.strokeStyle = "#204745";
      c.lineWidth = 5;
      c.stroke();
      c.strokeStyle = "rgba(168,195,145,.5)";
      c.lineWidth = 0.8;
      c.stroke();
      for (let n = 0; n < 7; n++) {
        const x = 10 + n * 11,
          y = -20 - n * 28,
          length = 55 + n * 3;
        leaf(
          c,
          x,
          y,
          length,
          12,
          -0.5,
          region === 0 ? "rgba(47,99,86,.76)" : "rgba(58,95,82,.8)",
        );
        leaf(c, x, y + 8, -length * 0.7, 10, 0.4, "rgba(30,72,69,.8)");
        ellipse(c, x + length * 0.7, y - 15, 1.6, 2.6, "rgba(211,239,201,.7)");
      }
      if (region === 2) {
        bell(c, 85, -170, 19, true);
        leaf(c, 30, -30, 110, 25, -0.3, "rgba(79,111,90,.8)");
      }
    }
    c.restore();
  }
  for (let n = 0; n < 5; n++) {
    const x = 640 + n * 80;
    c.beginPath();
    c.moveTo(x, -10);
    c.quadraticCurveTo(x - 60, 15, x - 100, 35);
    c.strokeStyle = "rgba(35,67,70,.5)";
    c.lineWidth = 2;
    c.stroke();
    leaf(c, x - 55, 16, 60, 12, -0.1, "rgba(46,89,79,.45)");
  }
}

export function paintLedgeDetails(
  c: C,
  w: number,
  top: number,
  region: number,
  seed: number,
) {
  const random = (n: number) => Math.abs(Math.sin(seed * 12.3 + n * 78.2)) % 1;
  if (region === 1) {
    for (let n = 0; n < Math.ceil(w / 180); n++) {
      const x = 22 + random(n) * (w - 44);
      crystal(c, x, top, 12, 17 + random(n + 5) * 15, 0.65);
      c.beginPath();
      c.moveTo(x + 14, top + 19);
      c.lineTo(x + 14, top + 52);
      c.strokeStyle = "rgba(182,225,231,.35)";
      c.lineWidth = 0.7;
      c.stroke();
      crystal(c, x + 14, top + 64, 5, 12, 0.7);
    }
  } else if (region === 2) {
    for (let n = 0; n < Math.ceil(w / 170); n++) {
      const x = 22 + random(n) * (w - 44);
      c.beginPath();
      c.moveTo(x, top);
      c.quadraticCurveTo(x + 7, top - 18, x - 2, top - 26);
      c.strokeStyle = "#8dba8c";
      c.lineWidth = 1;
      c.stroke();
      bell(c, x - 2, top - 29, 7, true);
      leaf(c, x, top - 5, 15, 3, -0.6, "#90b58b");
    }
    c.beginPath();
    c.moveTo(5, top + 12);
    for (let x = 5; x < w; x += 15)
      c.lineTo(x, top + 15 + Math.sin(x / 48 + seed) * 6);
    c.strokeStyle = "rgba(142,156,104,.45)";
    c.lineWidth = 4;
    c.stroke();
    c.strokeStyle = "rgba(225,208,146,.25)";
    c.lineWidth = 0.7;
    c.stroke();
  }
}

export function paintHangingCharm(c: C, region: number) {
  c.translate(48, 72);
  if (region === 1) {
    crystal(c, 0, 40, 47, 104, 0.8);
    halo(c, 0, -5, 40, "rgba(186,227,242,.14)");
  } else bell(c, 0, -12, 32, true);
}
