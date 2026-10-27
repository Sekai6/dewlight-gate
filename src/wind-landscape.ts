import type Phaser from "phaser";
import type { WindZone } from "./wind";

// All deformation uses the simulation clock, including delayed cloth and leaf tips.
export function windSceneryPose(
  clock: number,
  push: number,
  seed: number,
  reduced: boolean,
) {
  const t = reduced ? 0 : clock;
  const direction = push < 0 ? -1 : 1;
  return {
    bend: direction * (13 + Math.sin(t * 1.6 + seed) * 4),
    tip: direction * (7 + Math.sin(t * 2.7 + seed - 0.8) * 5),
    ripple: Math.sin(t * 3.2 + seed),
  };
}

export function drawWindLandscape(
  g: Phaser.GameObjects.Graphics,
  z: WindZone,
  clock: number,
  push: number,
  reduced: boolean,
  grounds: readonly { x: number; y: number; w: number }[] = [],
) {
  const time = reduced ? 0 : clock;
  const region = Math.floor(z.x / 12000);
  const colors = [
    { leaf: 0x8dbda2, light: 0xdce6b4, silk: 0xd1d9a0, glass: 0xb9e9d8 },
    { leaf: 0x83afb2, light: 0xe5dcb9, silk: 0x9acfd2, glass: 0xc6eaf2 },
    { leaf: 0x9daf95, light: 0xf0d9bc, silk: 0xc2b7d5, glass: 0xe2d5e9 },
  ][region];
  const base = 1100;
  const planted = (x: number) =>
    !grounds.length ||
    grounds.some((p) => p.y === base && x >= p.x + 3 && x <= p.x + p.w - 3);
  const stroke = (
    points: number[][],
    width: number,
    color: number,
    alpha: number,
  ) => {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokePath();
  };
  // A small meadow: roots stay planted while successive stem sections lag in the wind.
  for (let reed = 0; reed < 19; reed++) {
    const root = z.x + 12 + (reed * (z.w - 24)) / 19;
    if (!planted(root)) continue;
    const height = 25 + ((reed * 19) % 51);
    const pose = windSceneryPose(clock, push, reed * 0.7, reduced);
    const bend = pose.bend * (height / 65);
    const stem = Array.from({ length: 9 }, (_, k) => {
      const u = k / 8;
      return [
        root + bend * u * u + pose.tip * u * u * u * 0.45,
        base - height * u,
      ];
    });
    stroke(stem, 1.2, colors.leaf, 0.7);
    for (let leaf = 0; leaf < 3; leaf++) {
      const u = 0.35 + leaf * 0.21,
        x = root + bend * u * u,
        y = base - height * u;
      const direction = leaf % 2 ? -1 : 1;
      g.fillStyle(colors.leaf, 0.55);
      g.fillTriangle(
        x,
        y,
        x + direction * 14 + bend * 0.3,
        y - 12,
        x + direction * 5,
        y - 2,
      );
      stroke(
        [
          [x, y],
          [x + direction * 11 + bend * 0.25, y - 10],
        ],
        0.5,
        colors.light,
        0.5,
      );
    }
    if (reed % 3 === 0) {
      const [x, y] = stem[8];
      for (let seed = 0; seed < 5; seed++) {
        const side = seed % 2 ? -1 : 1;
        stroke(
          [
            [x, y + seed * 3],
            [x + side * 5 + pose.tip * 0.15, y + seed * 3 - 5],
          ],
          1,
          colors.light,
          0.7,
        );
      }
    }
  }
  // Ivory poles carry split silk streamers, built as a shaded deforming ribbon mesh.
  const pole = [z.x + 37, z.x + 60, z.x + 90].find(planted) ?? z.x + z.w / 2,
    top = base - 146;
  stroke(
    [
      [pole, base],
      [pole - 3, top - 12],
    ],
    2,
    0x7b9d8d,
    0.9,
  );
  g.fillStyle(0xe7d6a6, 0.95);
  g.fillCircle(pole - 3, top - 12, 3);
  const direction = push < 0 ? -1 : 1;
  for (let tail = 0; tail < 2; tail++) {
    const points = Array.from({ length: 19 }, (_, k) => {
      const u = k / 18;
      const ripple = Math.sin(time * 3.1 - u * 7 + tail * 1.3) * u * 9;
      const rise = z.lift > 1000 ? -u * u * 39 : 0;
      return [
        pole + direction * u * (tail ? 104 : 126),
        top + tail * 10 + u * 17 + ripple + rise,
      ];
    });
    for (let n = 0; n < 18; n++) {
      const [x, y] = points[n],
        [nx, ny] = points[n + 1];
      const w = (tail ? 5 : 10) * (1 - n / 23),
        nw = (tail ? 5 : 10) * (1 - (n + 1) / 23);
      g.fillStyle(tail ? 0xe4d2a1 : colors.silk, 0.48 + (n % 5) * 0.035);
      g.fillTriangle(x, y, nx, ny, x, y + w);
      g.fillTriangle(nx, ny, nx, ny + nw, x, y + w);
    }
    stroke(points, 0.8, 0xf7edcb, 0.8);
  }
  // A living arch holds three suspended, faceted glass bells and tiny hanging ribbons.
  const anchor = z.x + z.w - 44;
  const sway = windSceneryPose(clock, push, 2, reduced);
  stroke(
    Array.from({ length: 17 }, (_, k) => {
      const u = k / 16;
      return [
        anchor - Math.sin((u * Math.PI) / 2) * 42 + sway.bend * u * u * 0.3,
        base - u * 166,
      ];
    }),
    3,
    0x6d958a,
    0.85,
  );
  for (let leaf = 0; leaf < 5; leaf++) {
    const x = anchor - 32 + leaf * 5 + sway.bend * 0.3,
      y = base - 150 + leaf * 11;
    const side = leaf % 2 ? -1 : 1;
    g.fillStyle(colors.leaf, 0.75);
    g.fillTriangle(
      x,
      y,
      x + side * 18 + sway.tip * 0.2,
      y - 12,
      x + side * 13,
      y + 1,
    );
    stroke(
      [
        [x, y],
        [x + side * 15 + sway.tip * 0.2, y - 9],
      ],
      0.6,
      colors.light,
      0.6,
    );
  }
  for (let bell = 0; bell < 3; bell++) {
    const x = anchor - 42 + bell * 17,
      y = base - 164 + bell * 10;
    const length = 25 + bell * 9;
    const angle = direction * 0.18 + Math.sin(time * 2.2 + bell * 0.8) * 0.12;
    const bx = x + Math.sin(angle) * length,
      by = y + Math.cos(angle) * length;
    stroke(
      [
        [x, y],
        [bx, by],
      ],
      0.8,
      0xe8dcae,
      0.75,
    );
    g.fillStyle(0xe7d8ad, 0.8);
    g.fillEllipse(bx, by - 3, 5, 3);
    g.fillStyle(colors.glass, 0.42);
    g.fillTriangle(bx, by - 4, bx - 7, by + 9, bx + 7, by + 9);
    g.fillTriangle(bx - 7, by + 9, bx, by + 17, bx + 7, by + 9);
    stroke(
      [
        [bx, by - 4],
        [bx - 7, by + 9],
        [bx, by + 17],
        [bx + 7, by + 9],
        [bx, by - 4],
      ],
      0.8,
      colors.glass,
      0.9,
    );
    stroke(
      [
        [bx, by],
        [bx, by + 13],
      ],
      0.6,
      0xfff4d2,
      0.8,
    );
    stroke(
      [
        [bx, by + 17],
        [bx + direction * 8 + sway.ripple * 3, by + 35],
      ],
      1,
      colors.silk,
      0.8,
    );
  }
}

export function drawWindRibbons(
  g: Phaser.GameObjects.Graphics,
  z: WindZone,
  time: number,
  push: number,
  reduced: boolean,
) {
  const t = reduced ? 0 : time,
    up = z.lift > 1000,
    direction = push < 0 ? -1 : 1;
  // Long translucent ribbons establish the volume; short bright filaments show direction.
  for (let lane = 0; lane < (reduced ? 3 : 6); lane++) {
    const phase = (lane * 0.173 + t * (up ? 0.13 : 0.1)) % 1;
    const fade = Math.sin(phase * Math.PI);
    const points = Array.from({ length: 33 }, (_, k) => {
      const u = k / 32;
      return up
        ? [
            z.x + z.w / 2 + Math.sin(u * 5 + lane * 1.3 - t) * z.w * 0.34,
            z.y + z.h - u * z.h,
          ]
        : [
            z.x + u * z.w,
            z.y +
              45 +
              lane * 43 +
              Math.sin(u * 8 - t * direction * 1.6 + lane) * 17,
          ];
    });
    for (const [width, alpha] of [
      [18, 0.025],
      [7, 0.055],
      [1, 0.23],
    ]) {
      g.lineStyle(width, 0xd2f0df, alpha * fade);
      g.beginPath();
      points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokePath();
    }
    const particle = up ? phase : direction > 0 ? phase : 1 - phase;
    const [x, y] = points[Math.min(32, Math.floor(particle * 32))];
    g.lineStyle(0.7, 0xf2edd1, fade * 0.65);
    g.lineBetween(x - 3, y + 3, x + 5, y - 3);
    g.lineBetween(x, y, x + 2, y + 5);
  }
  // Airborne dandelion tufts curl through the current, with translucent seed sails.
  for (let seed = 0; seed < (reduced ? 3 : 12); seed++) {
    const phase = (seed * 0.137 + t * (up ? 0.18 : 0.12)) % 1;
    const x = up
      ? z.x + 25 + ((seed * 53) % (z.w - 50)) + Math.sin(t * 1.3 + seed) * 12
      : z.x + (direction > 0 ? phase : 1 - phase) * z.w;
    const y = up
      ? z.y + z.h - phase * z.h
      : z.y + 25 + ((seed * 71) % (z.h - 50)) + Math.sin(t + seed) * 9;
    const alpha = Math.sin(phase * Math.PI) * 0.65;
    g.lineStyle(0.7, 0xf4edcf, alpha);
    g.lineBetween(x, y, x - direction * 5, y + 8);
    for (let spoke = 0; spoke < 5; spoke++) {
      const a = -Math.PI + (spoke * Math.PI) / 4;
      g.lineBetween(x, y, x + Math.cos(a) * 7, y + Math.sin(a) * 5 - 2);
    }
    g.fillStyle(0xe9d29e, alpha);
    g.fillEllipse(x - direction * 5, y + 8, 2, 4);
  }
  if (up)
    for (let ring = 0; ring < (reduced ? 2 : 4); ring++) {
      const phase = (ring * 0.25 + t * 0.16) % 1;
      g.lineStyle(0.8, 0xe3edd0, Math.sin(phase * Math.PI) * 0.2);
      g.strokeEllipse(
        z.x + z.w / 2,
        z.y + z.h - phase * z.h,
        z.w * (0.35 + phase * 0.5),
        10 + phase * 11,
      );
    }
}
