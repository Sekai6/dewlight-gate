import Phaser from "phaser";
import { createRig } from "./rigs";
type C = CanvasRenderingContext2D;
const S = 3,
  W = 128,
  H = 128;
function shape(c: C, points: number[][], fill: string, stroke = "#345955") {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = stroke;
  c.lineWidth = 1;
  c.stroke();
}
function oval(
  c: C,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string | CanvasGradient,
) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}
export const PARTS = [
  "cape",
  "tunic",
  "shell",
  "mossShell",
  "guardianShell",
  "limb",
  "glove",
  "hood",
  "mask",
  "mothHead",
  "guardianHead",
  "crown",
  "sprout",
  "wing",
  "sword",
  "lamp",
  "leg",
  "boot",
  "joint",
];
/** One cached, high resolution Canvas atlas shared by every ACTION-A actor. */
export function ensureSkin(scene: Phaser.Scene) {
  if (scene.textures.exists("action-a")) return;
  // Phaser createCanvas requests willReadFrequently:true, which is appropriate
  // for pixel editing but expensive for our immutable, rotated render atlas.
  const surface = document.createElement("canvas");
  surface.width = W * S * 4;
  surface.height = H * S * 5;
  surface.getContext("2d", { willReadFrequently: false });
  const atlas = scene.textures.addCanvas("action-a", surface)!;
  // Readback is restricted to a small scratch surface. Reading the final atlas
  // repeatedly can force Chromium to use a CPU-backed render source.
  const scratch = document.createElement("canvas");
  scratch.width = W * S;
  scratch.height = H * S;
  const c = scratch.getContext("2d", { willReadFrequently: true })!;
  const sizes: Record<string, { width: number; height: number }> = {
    leg: { width: 15, height: 42 },
    limb: { width: 23, height: 42 },
    boot: { width: 29, height: 17 },
    joint: { width: 24, height: 24 },
  };
  for (const kind of ["hero", "moss", "moth", "guardian"] as const)
    for (const skin of createRig(kind).skin) {
      const previous = sizes[skin.texture] ?? { width: 0, height: 0 };
      sizes[skin.texture] = {
        width: Math.max(previous.width, skin.width),
        height: Math.max(previous.height, skin.height),
      };
    }
  PARTS.forEach((part, index) => {
    const col = index % 4,
      row = Math.floor(index / 4);
    c.clearRect(0, 0, scratch.width, scratch.height);
    c.save();
    c.scale(S, S);
    c.translate(64, 64);
    const teal = c.createLinearGradient(-30, -40, 30, 40);
    teal.addColorStop(0, "#a6cbb4");
    teal.addColorStop(0.45, "#568f85");
    teal.addColorStop(1, "#294f55");
    if (part === "joint") {
      // An overlapping cloth fold, not a metal ball joint. Most of the patch
      // sits behind the adjacent limb; only the turning seam remains visible.
      shape(
        c,
        [
          [-20, -12],
          [-8, -23],
          [13, -20],
          [23, -5],
          [18, 15],
          [2, 23],
          [-17, 16],
        ],
        "#94b5a0",
        "#658d7c",
      );
      shape(
        c,
        [
          [-16, -10],
          [-7, -19],
          [8, -17],
          [12, 5],
          [-2, 16],
          [-15, 10],
        ],
        "#c1cdb0",
        "#c1cdb0",
      );
    } else if (part === "cape") {
      shape(
        c,
        [
          [-18, -50],
          [15, -48],
          [25, 29],
          [13, 47],
          [-4, 39],
          [-27, 48],
          [-23, 4],
        ],
        "#387e77",
      );
      c.strokeStyle = "#c3dbb1";
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-14, -43);
      c.bezierCurveTo(-12, -3, -20, 25, -22, 40);
      c.stroke();
      shape(
        c,
        [
          [0, -43],
          [10, -38],
          [14, 36],
          [1, 31],
        ],
        "#72ad98",
        "#72ad98",
      );
      for (let i = 0; i < 5; i++)
        oval(c, -13 + i * 7, 28 + (i % 2) * 4, 1, 1, "#d8e4ba");
    } else if (part === "tunic") {
      shape(
        c,
        [
          [-21, -43],
          [17, -43],
          [25, -15],
          [21, 15],
          [31, 40],
          [5, 49],
          [-28, 39],
          [-20, 5],
        ],
        "#e1e1bd",
      );
      shape(
        c,
        [
          [-21, -40],
          [-5, -33],
          [-3, 27],
          [-23, 37],
          [-18, 0],
        ],
        "#629d8b",
      );
      shape(
        c,
        [
          [7, -36],
          [18, -41],
          [23, -13],
          [15, 0],
          [14, 38],
          [5, 42],
        ],
        "#b8cba7",
      );
      c.strokeStyle = "#b09b62";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-22, 12);
      c.lineTo(21, 8);
      c.stroke();
      oval(c, 2, 10, 5, 6, "#edd49a");
      oval(c, 2, 10, 2, 3, "#5b8f83");
      c.strokeStyle = "#f6f0d1";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-2, -30);
      c.lineTo(-1, 4);
      c.stroke();
    } else if (part === "limb" || part === "leg" || part === "glove") {
      shape(
        c,
        [
          [-15, -49],
          [13, -49],
          [18, -23],
          [12, 45],
          [-10, 48],
          [-18, -14],
        ],
        part === "glove" ? "#d4d4af" : part === "leg" ? "#3c635f" : "#80a997",
      );
      shape(
        c,
        [
          [-12, -41],
          [-4, -43],
          [-1, 35],
          [-9, 40],
        ],
        "#b6c8aa",
        "#b6c8aa",
      );
      c.strokeStyle = "#e2d6a6";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-13, 24);
      c.lineTo(13, 22);
      c.stroke();
    } else if (part === "boot") {
      shape(
        c,
        [
          [-25, -37],
          [12, -40],
          [15, -6],
          [41, 13],
          [43, 33],
          [-33, 36],
          [-37, 18],
        ],
        "#3d6261",
      );
      shape(
        c,
        [
          [-24, -29],
          [-4, -30],
          [0, 4],
          [22, 15],
          [-25, 17],
        ],
        "#8ba897",
      );
      c.strokeStyle = "#e6d7a7";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-32, 27);
      c.lineTo(35, 27);
      c.stroke();
    } else if (part === "hood") {
      shape(
        c,
        [
          [-39, 12],
          [-37, -20],
          [-22, -43],
          [0, -52],
          [23, -40],
          [38, -18],
          [35, 27],
          [18, 39],
          [-10, 38],
          [-32, 29],
        ],
        "#dfe3bf",
      );
      oval(c, 5, -2, 24, 32, "#304f55");
      oval(c, 9, -4, 18, 25, "#e8e9cf");
      shape(
        c,
        [
          [-35, 0],
          [-26, -26],
          [-9, -42],
          [-15, 14],
          [-25, 29],
        ],
        "#91b7a1",
        "#91b7a1",
      );
      c.strokeStyle = "#f8edc9";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(4, -1, 25, 34, 0, -1.8, 1.6);
      c.stroke();
      oval(c, 16, -5, 2.3, 2.4, "#24484c");
      c.strokeStyle = "#b5ac84";
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(10, 10);
      c.quadraticCurveTo(14, 13, 18, 10);
      c.stroke();
      shape(
        c,
        [
          [-33, 27],
          [-6, 23],
          [24, 30],
          [12, 44],
          [-16, 41],
        ],
        "#b7cba6",
      );
      oval(c, -17, 28, 4, 4, "#eed597");
    } else if (
      part.endsWith("Shell") ||
      part === "shell" ||
      part === "guardianHead" ||
      part === "mask" ||
      part === "mothHead"
    ) {
      oval(
        c,
        0,
        0,
        part === "shell" || part.endsWith("Shell") ? 48 : 43,
        part === "shell" || part.endsWith("Shell") ? 43 : 39,
        teal,
      );
      if (part === "shell" || part.endsWith("Shell")) {
        for (let i = 0; i < 7; i++) {
          const a = (i * Math.PI) / 3.5;
          shape(
            c,
            [
              [Math.cos(a) * 29, Math.sin(a) * 25],
              [Math.cos(a) * 45, Math.sin(a) * 38],
              [Math.cos(a + 0.7) * 37, Math.sin(a + 0.7) * 30],
            ],
            i % 2 ? "#82ae99" : "#4c847e",
          );
        }
        c.strokeStyle = "#c6d3a6";
        c.lineWidth = 1.1;
        c.beginPath();
        c.ellipse(-3, -3, 32, 31, -0.2, 0, Math.PI * 2);
        c.stroke();
      } else {
        shape(
          c,
          [
            [0, -37],
            [32, -16],
            [22, 25],
            [0, 37],
            [-22, 25],
            [-32, -16],
          ],
          part === "mothHead" ? "#dcd5b5" : "#c1d7b6",
        );
        oval(c, -13, -3, 4, 6, "#395953");
        oval(c, 13, -3, 4, 6, "#395953");
        oval(c, -12, -5, 1.5, 2, "#fff2b9");
        oval(c, 14, -5, 1.5, 2, "#fff2b9");
        shape(
          c,
          [
            [0, -28],
            [-5, -14],
            [5, -14],
          ],
          "#e9e2b6",
        );
        c.strokeStyle = "#84a591";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(-17, 15);
        c.quadraticCurveTo(0, 26, 17, 15);
        c.stroke();
      }
      if (part === "guardianShell") {
        c.strokeStyle = "#dce5bc";
        c.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.moveTo(-29 + i * 13, 27);
          c.lineTo(-25 + i * 12, 10);
          c.lineTo(-31 + i * 12, -5);
          c.stroke();
        }
        shape(
          c,
          [
            [0, -24],
            [-12, -4],
            [0, 14],
            [12, -4],
          ],
          "#cceddb",
          "#f6ecc5",
        );
        shape(
          c,
          [
            [0, -17],
            [-5, -4],
            [0, 7],
            [5, -4],
          ],
          "#f5efba",
          "#f5efba",
        );
        for (const side of [-1, 1]) {
          oval(c, side * 34, -14, 10, 7, "#c1d1a4");
          oval(c, side * 38, 15, 7, 4, "#98b593");
        }
        c.strokeStyle = "#2c5956";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-17, -35);
        c.lineTo(-10, -21);
        c.lineTo(-14, -10);
        c.moveTo(22, 15);
        c.lineTo(13, 23);
        c.lineTo(17, 36);
        c.stroke();
      } else if (part === "mossShell") {
        for (let i = 0; i < 11; i++) {
          const a = Math.PI + (i * Math.PI) / 10,
            x = Math.cos(a) * 39,
            y = Math.sin(a) * 35;
          c.save();
          c.translate(x, y);
          c.rotate(a + Math.PI / 2);
          shape(
            c,
            [
              [-9, 3],
              [0, -18],
              [9, 3],
            ],
            i % 2 ? "#88ac81" : "#b3c89a",
            "#648f78",
          );
          c.restore();
        }
        c.strokeStyle = "#cbd8b0";
        c.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          c.beginPath();
          c.moveTo(-24 + i * 15, 5);
          c.quadraticCurveTo(-31 + i * 16, 20, -22 + i * 14, 33);
          c.stroke();
        }
        for (let i = 0; i < 7; i++)
          oval(c, -28 + i * 9, -9 + (i % 2) * 9, 1.4, 2.2, "#e4e7bb");
      }
    } else if (part === "wing") {
      shape(
        c,
        [
          [0, 43],
          [-46, 5],
          [-45, -38],
          [-28, -52],
          [8, -31],
          [39, -43],
          [49, -20],
          [35, 10],
        ],
        "#c5dacc",
        "#799e9a",
      );
      c.globalAlpha = 0.65;
      shape(
        c,
        [
          [0, 35],
          [-35, -29],
          [-25, -38],
          [2, -10],
          [31, -32],
          [32, -4],
        ],
        "#85b8b0",
      );
      c.globalAlpha = 1;
      c.strokeStyle = "#edf0cd";
      c.lineWidth = 1.5;
      for (const x of [-30, -10, 15, 32]) {
        c.beginPath();
        c.moveTo(0, 38);
        c.quadraticCurveTo(x * 0.3, -4, x, -27);
        c.stroke();
      }
      oval(c, -24, -17, 6, 10, "#f1e3b5");
      oval(c, 23, -11, 5, 8, "#e6dcb1");
    } else if (part === "sprout" || part === "crown") {
      c.strokeStyle = "#4f7360";
      c.lineWidth = part === "crown" ? 5 : 3;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(side * 10, 42);
        c.lineTo(side * 31, -10);
        c.lineTo(side * 24, -40);
        c.moveTo(side * 29, 0);
        c.lineTo(side * 47, -22);
        c.stroke();
        for (let j = 0; j < 3; j++) {
          c.save();
          c.translate(side * (24 + j * 8), -24 + j * 14);
          c.rotate(side * 0.5);
          oval(c, 0, 0, 11, 5, "#c4d6a0");
          c.restore();
        }
        shape(
          c,
          [
            [side * 24, -46],
            [side * 24 - 5, -31],
            [side * 24 + 5, -31],
          ],
          "#dfedc7",
        );
      }
    } else if (part === "sword") {
      shape(
        c,
        [
          [0, -56],
          [-9, -29],
          [-5, 14],
          [0, 24],
          [7, 14],
          [9, -29],
        ],
        "#b8e7dc",
        "#e0f5df",
      );
      shape(
        c,
        [
          [0, -51],
          [0, 20],
          [5, 10],
          [5, -28],
        ],
        "#f1f6d8",
        "#f1f6d8",
      );
      shape(
        c,
        [
          [-23, 24],
          [-16, 18],
          [0, 24],
          [17, 18],
          [24, 24],
          [5, 30],
          [-5, 30],
        ],
        "#d7c68c",
      );
      shape(
        c,
        [
          [-4, 30],
          [5, 30],
          [5, 48],
          [-4, 48],
        ],
        "#426e68",
      );
      oval(c, 0, 51, 6, 5, "#d8cea1");
    } else if (part === "lamp") {
      c.strokeStyle = "#d0c18b";
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(0, -29, 12, 17, 0, 0, Math.PI * 2);
      c.stroke();
      shape(
        c,
        [
          [-20, -12],
          [20, -12],
          [24, 27],
          [0, 46],
          [-23, 27],
        ],
        "#8ab9a1",
        "#e7dfb5",
      );
      const light = c.createRadialGradient(0, 12, 1, 0, 12, 27);
      light.addColorStop(0, "#fff9c9");
      light.addColorStop(0.4, "#e5f5be");
      light.addColorStop(1, "#85bba3");
      oval(c, 0, 14, 16, 22, light);
      c.strokeStyle = "#e4e2b6";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, -10);
      c.lineTo(0, 39);
      c.stroke();
    }
    c.restore();
    const pixels = c.getImageData(0, 0, W * S, H * S).data;
    let minX = W * S,
      minY = H * S,
      maxX = 0,
      maxY = 0;
    for (let y = 0; y < H * S; y++)
      for (let x = 0; x < W * S; x++)
        if (pixels[(y * W * S + x) * 4 + 3]) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
    const pad = 3;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(W * S - 1, maxX + pad);
    maxY = Math.min(H * S - 1, maxY + pad);
    // Cache near the maximum displayed size (3x), rather than downsampling a
    // 300px painting to a 7px limb on every rotated Canvas draw.
    const size = sizes[part];
    const width = Math.ceil(size.width * S),
      height = Math.ceil(size.height * S);
    atlas.context.drawImage(
      scratch,
      minX,
      minY,
      maxX - minX + 1,
      maxY - minY + 1,
      col * W * S + 3,
      row * H * S + 3,
      width,
      height,
    );
    atlas.add(part, 0, col * W * S, row * H * S, width + 6, height + 6);
  });
  atlas.refresh();
}
