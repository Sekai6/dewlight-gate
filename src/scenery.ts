import Phaser from "phaser";

export function drawAtmosphere(
  g: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  scroll: number,
  region: number,
  time: number,
  reduced: boolean,
) {
  const palettes = [
    [0x102f30, 0x385f50, 0x93ae8b],
    [0x122f39, 0x426e70, 0x9ebfb0],
    [0x1c352e, 0x526e45, 0xb1bd85],
  ];
  const [dark, middle, light] = palettes[region];
  g.fillGradientStyle(dark, middle, light, light, 1);
  g.fillRect(0, 0, width, height);
  // A soft, layered sun, rather than a hard circle or a full-screen bloom.
  const sunX = width * 0.78 - ((scroll * 0.025) % 180),
    sunY = height * 0.22;
  for (let i = 7; i >= 1; i--) {
    g.fillStyle(0xf7ebbc, 0.012 + i * 0.001);
    g.fillCircle(sunX, sunY, 26 + i * 16);
  }
  g.fillStyle(0xf4e8bc, 0.3);
  g.fillCircle(sunX, sunY, 25);
  for (let layer = 0; layer < 3; layer++) {
    const points: Phaser.Types.Math.Vector2Like[] = [];
    const base = height * (0.46 + layer * 0.16),
      parallax = scroll * (0.035 + layer * 0.025);
    for (let x = -40; x < width + 50; x += 30) {
      const world = x + parallax;
      points.push({
        x,
        y:
          base +
          Math.sin(world / 270 + layer) * 55 +
          Math.sin(world / 117 + layer * 3) * 18,
      });
    }
    points.push({ x: width + 50, y: height + 30 }, { x: -40, y: height + 30 });
    g.fillStyle([0x5c806b, 0x365f52, 0x234d43][layer], 0.25 + layer * 0.06);
    g.fillPoints(points, true);
  }
  // Distant tree silhouettes have tapered trunks, branching crowns and leaves.
  for (let i = -1; i < Math.ceil(width / 250) + 2; i++) {
    const x = i * 250 - ((scroll * 0.13) % 250),
      base = height * 0.9,
      lean = Math.sin(i * 4.2) * 55;
    g.fillStyle(region === 1 ? 0x315a59 : 0x2a5545, 0.23);
    g.fillTriangle(x - 12, base, x + 14, base, x + lean, 55);
    for (let j = 0; j < 5; j++) {
      const y = 100 + j * height * 0.105,
        dir = j % 2 ? 1 : -1,
        bx = x + lean * (1 - (y - 55) / (base - 55));
      g.lineStyle(2, 0x335d4d, 0.2);
      g.lineBetween(bx, y, bx + dir * 85, y - 32);
      g.fillStyle(0x71936b, 0.13);
      g.fillEllipse(bx + dir * 70, y - 35, 145, 44);
      g.fillEllipse(bx + dir * 39, y - 50, 100, 40);
    }
  }
  if (region === 1) {
    for (let i = -1; i < 6; i++) {
      const x = i * 340 - ((scroll * 0.18) % 340),
        base = height * 0.84;
      g.fillStyle(0xd5ebdf, 0.1);
      g.fillTriangle(x, base, x + 28, base - 160, x + 70, base);
      g.fillStyle(0xd5ebdf, 0.06);
      g.fillTriangle(x + 28, base - 160, x + 70, base, x + 94, base - 18);
      g.lineStyle(1, 0xe1f4e4, 0.14);
      g.lineBetween(x + 28, base - 160, x + 40, base - 8);
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = (i * width * 0.28 - scroll * 0.07) % (width + 200),
      drift = reduced ? 0 : Math.sin(time * 0.12 + i) * 35;
    g.fillStyle(0xf1efcb, 0.035);
    g.fillEllipse(
      x + drift,
      height * (0.65 + i * 0.045),
      width * 0.85,
      45 + i * 9,
    );
  }
  g.fillStyle(0xf6edc9, 0.05);
  for (let i = 0; i < 5; i++) {
    const x = i * width * 0.28 - ((scroll * 0.04) % (width * 0.28));
    g.fillTriangle(x, -80, x + width * 0.12, height, x + width * 0.19, height);
  }
  // Framing leaves remain in the background, keeping all landing edges clear.
  for (let side = 0; side < 2; side++)
    for (let j = 0; j < 5; j++) {
      const x = side ? width + 5 : -5,
        y = j * 43 - 10,
        dir = side ? -1 : 1;
      g.fillStyle(0x163d33, 0.35);
      g.fillTriangle(
        x,
        y,
        x + dir * (95 - j * 8),
        y + 34,
        x + dir * 24,
        y + 56,
      );
      g.lineStyle(1, 0xa3b889, 0.1);
      g.lineBetween(x, y + 4, x + dir * (85 - j * 8), y + 35);
    }
}

export function drawLandmark(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  region: number,
  variant: number,
  time: number,
  reduced: boolean,
) {
  if (region === 0) {
    // A hanging dew flower and a little pool turn the tutorial into a garden.
    g.lineStyle(5, 0x557e58, 0.65);
    g.beginPath();
    g.moveTo(x - 100, y - 320);
    g.lineTo(x - 55, y - 210);
    g.lineTo(x + 25, y - 180);
    g.lineTo(x + 40, y - 80);
    g.strokePath();
    for (let i = 0; i < 7; i++) {
      const angle = (i * Math.PI * 2) / 7;
      g.fillStyle(i % 2 ? 0xb5c99a : 0xc9d5ad, 0.28);
      g.fillEllipse(
        x + 40 + Math.cos(angle) * 35,
        y - 80 + Math.sin(angle) * 17,
        70,
        26,
      );
    }
    g.fillStyle(0xf4e7b4, 0.35);
    g.fillCircle(x + 40, y - 80, 13);
    g.fillStyle(0xd9efda, 0.25);
    g.fillEllipse(x + 40, y - 25, 8, 15);
    for (let i = 0; i < 5; i++) {
      g.fillStyle(0x8ab79d, 0.035);
      g.fillEllipse(x + 40, y + 45, 180 + i * 40, 16 + i * 5);
    }
    g.lineStyle(1, 0xe4edcb, 0.18);
    g.strokeEllipse(x + 40, y + 45, 180, 20);
  } else if (region === 1) {
    // The broken conservatory: panes, an incomplete dome and split sunlight.
    g.lineStyle(3, 0xd0e5d0, 0.2);
    g.beginPath();
    g.arc(x, y + 60, 170, Math.PI, Math.PI * 2);
    g.strokePath();
    for (let i = -2; i <= 2; i++) {
      const px = x + i * 62;
      g.lineBetween(
        px,
        y - 50 - Math.sqrt(Math.max(0, 170 * 170 - i * 62 * i * 62)) * 0.5,
        px,
        y + 60,
      );
    }
    g.lineBetween(x - 165, y - 10, x + 165, y - 10);
    g.lineBetween(x - 135, y - 75, x + 135, y - 75);
    g.fillStyle(0xc7e9dc, 0.08);
    g.fillTriangle(x - 120, y - 85, x - 60, y - 110, x - 60, y + 50);
    g.fillStyle(0xf0d3ad, 0.05);
    g.fillTriangle(x + 15, y - 100, x + 80, y - 80, x + 130, y + 160);
    g.fillStyle(0xb6dfd0, 0.14);
    g.fillTriangle(x + 50, y + 50, x + 80, y - 5, x + 115, y + 50);
    g.lineStyle(2, 0x77976c, 0.6);
    g.lineBetween(x - 90, y + 65, x - 70, y - 20);
    g.fillStyle(0x9abb87, 0.35);
    g.fillEllipse(x - 66, y - 12, 30, 12);
  } else {
    // Wind bells attached to a living tree, with restrained motion.
    g.lineStyle(12, 0x456746, 0.55);
    g.beginPath();
    g.moveTo(x - 150, y + 130);
    g.lineTo(x - 105, y - 10);
    g.lineTo(x + 80, y - 80);
    g.lineTo(x + 170, y - 160);
    g.strokePath();
    for (let i = 0; i < 5; i++) {
      const px = x - 85 + i * 53,
        py = y - 20 - i * 25,
        sway = reduced ? 0 : Math.sin(time * 0.8 + i + variant) * 5;
      g.lineStyle(1, 0xc2d1a5, 0.45);
      g.lineBetween(px, py, px + sway, py + 80);
      g.fillStyle(0xc4dfba, 0.15);
      g.fillTriangle(
        px + sway,
        py + 65,
        px + sway - 12,
        py + 90,
        px + sway + 12,
        py + 90,
      );
      g.lineStyle(1, 0xe0e7bd, 0.5);
      g.lineBetween(px + sway, py + 70, px + sway, py + 100);
    }
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0x91ad73, 0.22);
      g.fillEllipse(x - 60 + i * 40, y - 62 - i * 18, 85, 25);
    }
  }
}
