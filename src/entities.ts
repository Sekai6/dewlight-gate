import Phaser from "phaser";
type G = Phaser.GameObjects.Graphics;

/** Hand drawn silhouettes use the same world coordinates as collision bodies. */
export function drawMonument(
  g: G,
  x: number,
  y: number,
  active: boolean,
  index: number,
  time: number,
  reduced: boolean,
) {
  const ink = active ? 0xf3dda5 : [0x9cc4ad, 0xa4d5e3, 0xc6b5cf][index];
  if (active) {
    for (let n = 0; n < 4; n++) {
      g.fillStyle([0xc8f1cf, 0xc0e1ff, 0xf1cedb][index], 0.018);
      g.fillCircle(x, y - 87, 31 + n * 12);
    }
  }
  g.fillStyle(0x071d28, 0.4);
  g.fillEllipse(x, y + 5, 134, 20);
  g.fillStyle(0x294b52);
  g.fillPoints(
    [
      { x: x - 42, y },
      { x: x - 30, y: y - 13 },
      { x: x + 33, y: y - 13 },
      { x: x + 45, y },
    ],
    true,
  );
  g.fillStyle([0x53776c, 0x699aa8, 0x616b6b][index], index === 1 ? 0.78 : 1);
  g.fillPoints(
    [
      { x: x - 27, y: y - 12 },
      { x: x - 32, y: y - 112 },
      { x: x - 17, y: y - 132 },
      { x: x + 17, y: y - 127 },
      { x: x + 29, y: y - 110 },
      { x: x + 24, y: y - 12 },
    ],
    true,
  );
  g.fillStyle([0x88a88b, 0xc1e3e3, 0x9eaa8b][index], 0.6);
  g.fillTriangle(x - 27, y - 112, x - 17, y - 132, x - 15, y - 17);
  g.fillStyle([0x294f4c, 0x346982, 0x394a4f][index], 0.6);
  g.fillTriangle(x + 17, y - 127, x + 29, y - 110, x + 24, y - 12);
  g.lineStyle(1, 0xb4c9ae, 0.45);
  g.lineBetween(x - 17, y - 124, x - 19, y - 21);
  g.lineBetween(x - 19, y - 21, x + 17, y - 21);
  for (let n = 0; n < 8; n++) {
    const py = y - 35 - n * 8;
    g.lineStyle(0.7, 0xb4c9ae, 0.18);
    g.lineBetween(x + 11, py, x + 19, py - 3);
  }
  g.lineStyle(1, ink, active ? 0.8 : 0.35);
  g.strokeCircle(x, y - 87, 20);
  g.strokeCircle(x, y - 87, 15);
  for (let n = 0; n < 8; n++) {
    const a = (n * Math.PI) / 4;
    g.lineBetween(
      x + Math.cos(a) * 23,
      y - 87 + Math.sin(a) * 23,
      x + Math.cos(a) * 26,
      y - 87 + Math.sin(a) * 26,
    );
  }
  g.fillStyle(ink, active ? 1 : 0.55);
  if (index === 0) {
    g.fillPoints(
      [
        { x, y: y - 103 },
        { x: x - 8, y: y - 88 },
        { x: x - 7, y: y - 80 },
        { x, y: y - 75 },
        { x: x + 7, y: y - 80 },
        { x: x + 8, y: y - 88 },
      ],
      true,
    );
    g.lineStyle(1, 0xf0ecd1, 0.7);
    g.lineBetween(x - 3, y - 90, x - 5, y - 83);
  } else if (index === 1) {
    g.fillTriangle(x, y - 104, x - 9, y - 87, x, y - 72);
    g.fillStyle(active ? 0xffe4bb : 0xc1d4e4, 0.7);
    g.fillTriangle(x, y - 104, x + 9, y - 87, x, y - 72);
    g.lineStyle(0.7, 0xf2e5dd, 0.8);
    g.lineBetween(x - 9, y - 87, x + 9, y - 87);
  } else {
    g.lineStyle(1.8, ink, 0.85);
    g.lineBetween(x, y - 103, x, y - 72);
    for (let n = 0; n < 3; n++) {
      g.fillStyle(ink, 0.7);
      g.fillEllipse(x + (n % 2 ? 4 : -4), y - 97 + n * 8, 9, 4);
    }
  }
  for (let n = 0; n < 3; n++) {
    g.lineStyle(1, ink, active ? 0.75 : 0.2);
    g.lineBetween(x - 6 + n * 6, y - 59, x - 6 + n * 6, y - 43 + n * 3);
  }
  g.lineStyle(2, 0x709b73, 0.8);
  g.beginPath();
  g.moveTo(x - 34, y);
  g.lineTo(x - 27, y - 28);
  g.lineTo(x - 31, y - 49);
  g.strokePath();
  for (let n = 0; n < 5; n++) {
    g.fillStyle(0x8bb68a, 0.8);
    g.fillEllipse(x - 30 + (n % 2 ? 5 : -4), y - 6 - n * 9, 13, 5);
  }
  if (index === 0) {
    for (let n = 0; n < 5; n++) {
      g.fillStyle(n % 2 ? 0x9bbe89 : 0x709c7a, 0.9);
      g.fillEllipse(x - 23 + n * 11, y - 123 - (n % 2) * 4, 17, 7);
    }
    g.fillStyle(0xefe3bd, 0.8);
    g.fillCircle(x - 15, y - 133, 2);
    g.fillCircle(x + 17, y - 130, 1.5);
  } else if (index === 1) {
    for (const side of [-1, 1]) {
      g.lineStyle(0.8, 0xc7e6e5, 0.5);
      g.lineBetween(x + side * 27, y - 103, x + side * 39, y - 130);
      g.fillStyle(0x9bc8db, 0.55);
      g.fillTriangle(
        x + side * 39,
        y - 140,
        x + side * 35,
        y - 127,
        x + side * 43,
        y - 127,
      );
    }
  } else {
    for (const side of [-1, 1]) {
      g.lineStyle(4, 0x6c8967, 0.8);
      g.beginPath();
      g.moveTo(x + side * 30, y - 5);
      g.lineTo(x + side * 17, y - 46);
      g.lineTo(x + side * 29, y - 90);
      g.lineTo(x + side * 14, y - 132);
      g.strokePath();
      for (let n = 0; n < 4; n++) {
        g.fillStyle(n % 2 ? 0xb2be88 : 0x8aa57b, 0.85);
        g.fillEllipse(x + side * (20 + (n % 2) * 8), y - 20 - n * 30, 14, 5);
      }
      g.fillStyle(0xdec0d6, 0.8);
      g.fillEllipse(x + side * 16, y - 134, 8, 10);
      g.fillStyle(0xffe3b5, 0.9);
      g.fillEllipse(x + side * 16, y - 130, 5, 2);
    }
  }
  if (active) {
    g.fillStyle(0xfbe5ac, 0.05);
    g.fillTriangle(x - 18, y - 90, x + 18, y - 90, x + 35, -200);
    g.lineStyle(2, ink, 0.65);
    g.lineBetween(x, y - 90, x + 35, -200);
    const phase = reduced ? 0 : time * 0.4;
    for (let n = 0; n < 12; n++) {
      const a = (n * Math.PI) / 6 + phase,
        r = 36 + Math.sin(n + time) * 2;
      g.fillStyle(ink, 0.65);
      g.fillCircle(x + Math.cos(a) * r, y - 87 + Math.sin(a) * r * 0.45, 1.2);
    }
  }
}
