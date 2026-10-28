import Phaser from "phaser";
import {
  paintGlassSky,
  paintGlassForest,
  paintCanopySky,
  paintCanopyForest,
  GardenVistas,
  paintLedgeDetails,
} from "./biomes";
import {
  Dreamscape,
  paintDreamSky,
  paintDreamForest,
  paintDreamSprouts,
} from "./dreamscape";
import { ActionActor } from "./action-a/actor";
import { heroAction } from "./action-a/drivers";
import type { Platform } from "./level";
import { stones } from "./level";
import { sanctuaryTexture } from "./sanctuary";
import { LightFalls } from "./light-falls";
import { GardenArchitecture } from "./garden-architecture";
import { ActionLight } from "./action-light";

type C = CanvasRenderingContext2D;
function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function path(c: C, points: number[][], fill: string) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
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
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), angle, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
}
function glow(c: C, x: number, y: number, r: number, color: string) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(0.25, color.replace(/,[\d.]+\)$/, ",0.14)"));
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}
function stroke(c: C, points: number[][], color: string, width: number) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.stroke();
}
function fern(
  c: C,
  x: number,
  y: number,
  h: number,
  dir: number,
  color: string,
) {
  c.save();
  c.translate(x, y);
  c.rotate(dir * 0.3);
  c.strokeStyle = color;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(dir * h * 0.12, -h * 0.6, dir * h * 0.3, -h);
  c.stroke();
  for (let j = 1; j < 10; j++) {
    const t = j / 10,
      px = dir * h * 0.3 * t * t,
      py = -h * t,
      w = h * 0.27 * Math.sin(t * Math.PI);
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(px, py);
      c.quadraticCurveTo(
        px + side * w * 0.7,
        py - h * 0.12,
        px + side * w,
        py - h * 0.13,
      );
      c.quadraticCurveTo(
        px + side * w * 0.6,
        py + h * 0.015,
        px,
        py + h * 0.04,
      );
      c.fillStyle = color;
      c.fill();
    }
  }
  c.restore();
}
function texture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  paint: (c: C) => void,
) {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w);
  canvas.height = Math.ceil(h);
  paint(canvas.getContext("2d")!);
  scene.textures.addCanvas(key, canvas);
}

function paintSky(c: C, region: number) {
  [paintDreamSky, paintGlassSky, paintCanopySky][region](c);
}
function paintForest(c: C, region: number) {
  [paintDreamForest, paintGlassForest, paintCanopyForest][region](c);
}

function paintPlatform(
  c: C,
  w: number,
  seed: number,
  glass: boolean,
  region: number,
) {
  const r = random(seed),
    top = 100,
    h = 260;
  if (glass) {
    const glassG = c.createLinearGradient(0, top, 0, top + 55);
    glassG.addColorStop(0, "rgba(188,246,242,.45)");
    glassG.addColorStop(0.08, "rgba(133,231,225,.18)");
    glassG.addColorStop(1, "rgba(36,101,140,.06)");
    c.beginPath();
    c.moveTo(4, top);
    c.lineTo(w - 4, top);
    c.lineTo(w - 20, top + 29);
    c.lineTo(w * 0.75, top + 42);
    c.lineTo(10, top + 28);
    c.closePath();
    c.fillStyle = glassG;
    c.fill();
    c.save();
    c.clip();
    // Fine inclusions and beveled spectral seams give the glass a material scale.
    for (let inclusion = 0; inclusion < Math.ceil(w / 24); inclusion++) {
      const x = 12 + r() * (w - 24),
        y = top + 6 + r() * 24;
      ellipse(c, x, y, 1 + r() * 2, 0.7 + r(), "rgba(229,249,246,.26)");
      if (inclusion % 3 === 0)
        stroke(
          c,
          [
            [x - 4, y + 4],
            [x + 15, y - 3],
            [x + 37, y + 5],
          ],
          inclusion % 2 ? "rgba(227,185,240,.22)" : "rgba(182,227,255,.26)",
          0.7,
        );
    }
    const sheen = c.createLinearGradient(0, top, w, top + 30);
    sheen.addColorStop(0, "rgba(142,200,239,0)");
    sheen.addColorStop(0.38, "rgba(217,188,239,.16)");
    sheen.addColorStop(0.49, "rgba(255,239,196,.24)");
    sheen.addColorStop(0.58, "rgba(177,236,219,.08)");
    sheen.addColorStop(1, "rgba(177,236,219,0)");
    c.fillStyle = sheen;
    c.fillRect(0, top, w, 44);
    c.restore();
    stroke(
      c,
      [
        [5, top + 0.5],
        [w - 5, top + 0.5],
      ],
      "#c4fff0",
      1.5,
    );
    stroke(
      c,
      [
        [10, top + 2],
        [w - 25, top + 25],
      ],
      "rgba(220,253,250,.4)",
      1,
    );
    for (let j = 0; j < 6; j++) {
      const x = r() * w;
      path(
        c,
        [
          [x, top + 2],
          [x + 30 + r() * 40, top + 28],
          [x + 100, top + 4],
        ],
        j % 2 ? "rgba(254,192,183,.11)" : "rgba(179,207,255,.14)",
      );
    }
    glow(c, w * 0.5, top + 8, Math.min(w * 0.5, 160), "rgba(102,238,226,.14)");
    paintLedgeDetails(c, w, top, 1, seed);
    return;
  }
  const depth = 65 + r() * 55,
    rock = c.createLinearGradient(0, top, 0, top + depth);
  rock.addColorStop(
    0,
    region === 2 ? "#35413e" : region === 0 ? "#426b61" : "#263f44",
  );
  rock.addColorStop(0.22, "#1c303a");
  rock.addColorStop(1, "#0c1c29");
  // Eroded shelves have rounded strata and hanging roots rather than repeated teeth.
  c.beginPath();
  c.moveTo(0, top);
  c.lineTo(w, top);
  c.quadraticCurveTo(w - 3, top + 20, w - 18, top + 36);
  let previousX = w - 18,
    previousY = top + 36;
  for (let x = w - 45; x > 10; x -= 30 + r() * 22) {
    const y = top + depth * (0.68 + r() * 0.3);
    c.quadraticCurveTo(
      previousX,
      previousY,
      (previousX + x) / 2,
      (previousY + y) / 2,
    );
    previousX = x;
    previousY = y;
  }
  c.quadraticCurveTo(previousX, previousY, 9, top + 34);
  c.quadraticCurveTo(1, top + 23, 0, top);
  c.closePath();
  c.fillStyle = rock;
  c.fill();
  c.save();
  c.clip();
  // Broad reflected light gives the shelf volume before the small surface marks.
  const bounce = c.createLinearGradient(0, top, w, top + depth);
  bounce.addColorStop(
    0,
    region === 2 ? "rgba(205,159,112,.18)" : "rgba(179,223,191,.2)",
  );
  bounce.addColorStop(0.45, "rgba(106,158,145,.02)");
  bounce.addColorStop(1, "rgba(122,175,200,.12)");
  c.fillStyle = bounce;
  c.fillRect(0, top, w, depth + 20);
  for (let layer = 0; layer < 4; layer++) {
    c.beginPath();
    const y = top + 14 + layer * 19;
    c.moveTo(-10, y);
    c.bezierCurveTo(w * 0.25, y - 12, w * 0.67, y + 18, w + 10, y - 5);
    c.strokeStyle =
      region === 2 ? "rgba(193,159,115,.15)" : "rgba(168,207,180,.13)";
    c.lineWidth = layer === 0 ? 3 : 1.2;
    c.stroke();
  }
  if (region === 2) {
    // Older canopy shelves expose sweeping woody roots inside the stone.
    for (let root = 0; root < Math.ceil(w / 160); root++) {
      const x = root * 160 + r() * 45;
      c.beginPath();
      c.moveTo(x - 35, top - 4);
      c.bezierCurveTo(x + 10, top + 45, x + 60, top + 20, x + 120, top + depth);
      c.strokeStyle = "rgba(123,113,76,.4)";
      c.lineWidth = 9;
      c.stroke();
      c.strokeStyle = "rgba(214,190,126,.22)";
      c.lineWidth = 1.5;
      c.stroke();
    }
  }
  for (let j = 0; j < w / 25; j++) {
    const x = r() * w,
      y = top + 13 + r() * depth;
    ellipse(
      c,
      x,
      y,
      12 + r() * 35,
      4 + r() * 10,
      j % 2 ? "rgba(149,176,150,.07)" : "rgba(0,6,17,.16)",
      -0.2,
    );
  }
  for (let j = 0; j < w / 85; j++) {
    const x = 15 + r() * (w - 30),
      y = top + 10 + r() * 25;
    stroke(
      c,
      [
        [x, y],
        [x - 8, y + 17],
        [x - 3, y + 30],
        [x - 12, y + 43],
      ],
      "rgba(7,24,33,.5)",
      1.2,
    );
    stroke(
      c,
      [
        [x + 1, y],
        [x - 7, y + 17],
        [x - 2, y + 30],
      ],
      "rgba(173,199,159,.14)",
      0.6,
    );
  }
  for (let y = top + 15; y < top + depth; y += 15) {
    c.beginPath();
    c.moveTo(0, y);
    for (let x = 0; x <= w; x += 16)
      c.lineTo(x, y + Math.sin(x / 45 + seed + y) * 4 + r() * 3);
    c.strokeStyle = "rgba(131,170,156,.08)";
    c.lineWidth = 1;
    c.stroke();
  }
  for (let j = 0; j < w * 2; j++) {
    c.fillStyle = r() > 0.5 ? "rgba(184,208,172,.06)" : "rgba(0,7,16,.15)";
    c.fillRect(r() * w, top + r() * depth, 1 + r() * 4, 1 + r() * 2);
  }
  c.restore();
  for (let j = 0; j < Math.floor(w / 180); j++) {
    const x = 25 + r() * (w - 50),
      length = 35 + r() * 70;
    c.beginPath();
    c.moveTo(x, top + 13);
    c.bezierCurveTo(
      x - 17,
      top + 35,
      x + 10,
      top + length - 10,
      x - 17,
      top + length,
    );
    c.strokeStyle = "rgba(36,65,55,.8)";
    c.lineWidth = 5;
    c.stroke();
    c.strokeStyle = "rgba(133,155,109,.35)";
    c.lineWidth = 0.8;
    c.stroke();
    c.beginPath();
    c.moveTo(x - 5, top + length * 0.5);
    c.quadraticCurveTo(x + 15, top + length * 0.8, x + 19, top + length * 0.87);
    c.strokeStyle = "rgba(75,100,75,.6)";
    c.lineWidth = 1;
    c.stroke();
  }
  if (region === 0) paintDreamSprouts(c, w, top, seed);
  else paintLedgeDetails(c, w, top, region, seed);
  // Moss has a sharp lit edge and a soft, irregular underside.
  for (let x = 0; x < w; x += 4) {
    const h = 1 + r() * 4;
    ellipse(c, x, top + 2, 5 + r() * 5, h, r() > 0.65 ? "#5d8a6e" : "#365f54");
  }
  stroke(
    c,
    [
      [4, top],
      [w - 4, top],
    ],
    "rgba(181,219,150,.62)",
    1,
  );
  for (let x = 12; x < w - 8; x += 6 + r() * 11) {
    const h = 3 + r() * 12;
    stroke(
      c,
      [
        [x, top - 1],
        [x + (r() - 0.5) * 5, top - h],
      ],
      r() > 0.8 ? "#9cbd83" : "#57856b",
      0.5 + r() * 0.6,
    );
  }
  // Uneven clusters of ferns, tiny flowering stems and luminous mushrooms.
  for (let j = 0; j < Math.max(1, w / 320); j++) {
    const x = 25 + r() * (w - 50),
      height = 20 + r() * 28;
    fern(
      c,
      x,
      top,
      height,
      r() > 0.5 ? 1 : -1,
      region === 2 ? "#798d69" : "#5d987e",
    );
    if (r() > 0.45) {
      for (let m = 0; m < 2 + r() * 3; m++) {
        const mx = x + 12 + m * 7,
          my = top - 4 - r() * 5;
        stroke(
          c,
          [
            [mx, top],
            [mx - 2, my - 10],
          ],
          "#8fb7a2",
          1,
        );
        ellipse(c, mx - 2, my - 11, 5 + r() * 4, 2.5, "#c5d9bd");
        ellipse(c, mx - 2, my - 9, 5, 1, "rgba(102,219,192,.4)");
      }
    }
    if (r() > 0.5) {
      stroke(
        c,
        [
          [x + 20, top],
          [x + 23, top - height * 0.7],
        ],
        "#6b9a7e",
        1,
      );
      for (let a = 0; a < 5; a++) {
        const angle = a * Math.PI * 0.4;
        ellipse(
          c,
          x + 23 + Math.cos(angle) * 3,
          top - height * 0.7 + Math.sin(angle) * 3,
          2,
          3,
          "#e5d7b3",
          angle,
        );
      }
      glow(c, x + 23, top - height * 0.7, 10, "rgba(246,212,134,.18)");
    }
  }
  for (let j = 0; j < w / 170; j++) {
    const x = 20 + r() * (w - 40),
      len = 30 + r() * 95;
    c.beginPath();
    c.moveTo(x, top + 8);
    c.bezierCurveTo(
      x - 12,
      top + len * 0.3,
      x + 17,
      top + len * 0.7,
      x - 8,
      top + len,
    );
    c.strokeStyle = "#345b4b";
    c.lineWidth = 1.2;
    c.stroke();
    for (let k = 1; k < 5; k++) {
      const py = top + (len * k) / 5,
        px = x + Math.sin(k) * 7;
      ellipse(
        c,
        px + (k % 2 ? 4 : -4),
        py,
        5,
        2,
        "#52816a",
        k % 2 ? -0.5 : 0.5,
      );
    }
  }
}

function paintGate(c: C) {
  const r = random(99);
  c.translate(280, 410);
  // A moss-grown cave mouth, sculpted as a natural silhouette with no square backdrop.
  const stone = c.createLinearGradient(-180, -360, 170, 30);
  stone.addColorStop(0, "#648472");
  stone.addColorStop(0.35, "#355c56");
  stone.addColorStop(1, "#17343e");
  c.beginPath();
  c.moveTo(-235, 30);
  c.bezierCurveTo(-259, -80, -228, -220, -157, -299);
  c.bezierCurveTo(-135, -358, -69, -385, -17, -365);
  c.bezierCurveTo(53, -390, 126, -341, 151, -294);
  c.bezierCurveTo(226, -239, 232, -70, 214, 30);
  c.quadraticCurveTo(100, 43, 0, 28);
  c.quadraticCurveTo(-120, 47, -235, 30);
  c.fillStyle = stone;
  c.fill();
  c.save();
  c.clip();
  for (let n = 0; n < 14; n++) {
    const x = -210 + r() * 420,
      y = -350 + r() * 380;
    ellipse(
      c,
      x,
      y,
      30 + r() * 60,
      6 + r() * 16,
      n % 2 ? "rgba(175,201,149,.06)" : "rgba(3,23,32,.15)",
      -0.3,
    );
    stroke(
      c,
      [
        [x, y],
        [x - 14, y + 27],
        [x - 8, y + 53],
      ],
      "rgba(9,33,39,.35)",
      1.2,
    );
  }
  for (let n = 0; n < 500; n++) {
    c.fillStyle = r() > 0.5 ? "rgba(206,216,166,.06)" : "rgba(3,22,29,.14)";
    c.fillRect(-240 + r() * 480, -380 + r() * 420, 1 + r() * 4, 1);
  }
  c.restore();
  const inside = c.createRadialGradient(-20, -115, 10, 0, -120, 220);
  inside.addColorStop(0, "#203944");
  inside.addColorStop(0.55, "#102a36");
  inside.addColorStop(1, "#061d28");
  c.beginPath();
  c.moveTo(-125, 15);
  c.lineTo(-125, -155);
  c.arc(0, -155, 125, Math.PI, Math.PI * 2);
  c.lineTo(125, 15);
  c.closePath();
  c.fillStyle = inside;
  c.fill();
  for (const radius of [135, 143, 157]) {
    c.beginPath();
    c.moveTo(-radius, 18);
    c.lineTo(-radius, -155);
    c.arc(0, -155, radius, Math.PI, Math.PI * 2);
    c.lineTo(radius, 18);
    c.strokeStyle =
      radius === 143 ? "rgba(207,213,156,.42)" : "rgba(119,166,148,.55)";
    c.lineWidth = radius === 135 ? 5 : radius === 157 ? 3 : 1;
    c.stroke();
  }
  for (let n = 0; n < 13; n++) {
    const angle = Math.PI + (n * Math.PI) / 12,
      x = Math.cos(angle) * 163,
      y = -155 + Math.sin(angle) * 163;
    stroke(
      c,
      [
        [x, y],
        [Math.cos(angle) * 174, -155 + Math.sin(angle) * 174],
      ],
      "rgba(222,222,165,.46)",
      1.1,
    );
    if (n % 3 === 0) {
      glow(c, x, y, 12, "rgba(207,232,174,.16)");
      ellipse(c, x, y, 1.5, 1.5, "#dae3af");
    }
  }
  // Roots and flowering vines wrap around the arch rather than across its opening.
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(side * 197, 30);
    c.bezierCurveTo(side * 162, -90, side * 230, -204, side * 94, -329);
    c.strokeStyle = "#476c55";
    c.lineWidth = 7;
    c.stroke();
    c.strokeStyle = "rgba(180,200,132,.45)";
    c.lineWidth = 1;
    c.stroke();
    for (let n = 0; n < 8; n++) {
      const x = side * (179 - Math.sin(n * 0.4) * 60),
        y = -35 - n * 38;
      ellipse(
        c,
        x + side * 7,
        y,
        15,
        5,
        n % 2 ? "#6e9976" : "#8bab7c",
        side * 0.7,
      );
      stroke(
        c,
        [
          [x - side * 6, y + 2],
          [x + side * 16, y - 2],
        ],
        "rgba(217,227,172,.3)",
        0.6,
      );
      if (n % 2 === 0) {
        ellipse(c, x - side * 8, y - 7, 5, 7, "#c7afce", -0.25);
        glow(c, x - side * 8, y - 2, 15, "rgba(221,190,238,.2)");
        ellipse(c, x - side * 8, y - 2, 2, 1.5, "#f2e4b0");
      }
    }
    fern(c, side * 170, 15, 78, -side, "#72a183");
    fern(c, side * 204, 25, 53, side, "#385f52");
  }
  for (let n = 0; n < 18; n++) {
    const x = -105 + r() * 210,
      y = -250 + r() * 230;
    glow(c, x, y, 7, "rgba(167,219,216,.13)");
    ellipse(c, x, y, 1, 1, "rgba(220,239,211,.45)");
  }
  const pool = c.createRadialGradient(0, 20, 0, 0, 20, 145);
  pool.addColorStop(0, "rgba(159,233,209,.28)");
  pool.addColorStop(1, "rgba(159,233,209,0)");
  ellipse(c, 0, 20, 145, 16, pool);
  stroke(
    c,
    [
      [-118, 17],
      [112, 17],
    ],
    "rgba(206,232,189,.4)",
    1,
  );
  for (let n = 0; n < 3; n++) {
    c.beginPath();
    c.ellipse(0, 23 + n * 3, 70 + n * 20, 3 + n * 1.5, 0, 0, Math.PI * 2);
    c.strokeStyle = "rgba(201,237,213,.13)";
    c.lineWidth = 0.7;
    c.stroke();
  }
  c.font = "14px Georgia";
  c.letterSpacing = "8px";
  c.fillStyle = "#e8e1b3";
  c.fillText("GATE", -33, -334);
}

export interface HeroPose {
  support?: { id: string | number; x: number; y: number };
  groundIndex?: number;
  turnAt?: number;
  brakeAt?: number;
  launchAt?: number;
  landAt?: number;
  attackStyle?: number;
  stride?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  onGround: boolean;
  clock: number;
  dashAt: number;
  attackAt: number;
  bindAt: number;
  hurtAt: number;
  hitDirection?: number;
}
export class ArtDirector {
  private dream: Dreamscape;
  private falls: LightFalls;
  private architecture: GardenArchitecture;
  private actionLight: ActionLight;
  private vistas: GardenVistas;
  private backgrounds: Phaser.GameObjects.Image[] = [];
  private forest: Phaser.GameObjects.TileSprite[] = [];
  private ledges: Phaser.GameObjects.Image[] = [];
  private sanctuaries: Phaser.GameObjects.Image[] = [];
  readonly actor: ActionActor;
  private fallen: ActionActor;
  private fallPose: {
    x: number;
    y: number;
    clock: number;
    facing: number;
  } | null = null;
  private contact: Phaser.GameObjects.Graphics;
  private wasGrounded = true;
  private landedAt = -999;
  private lantern: Phaser.GameObjects.Image;
  private gate: Phaser.GameObjects.Image;
  private vignette: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private air: Phaser.GameObjects.Graphics;
  constructor(
    private scene: Phaser.Scene,
    private platforms: Platform[],
  ) {
    this.dream = new Dreamscape(scene);
    this.falls = new LightFalls(scene, platforms);
    this.architecture = new GardenArchitecture(scene);
    this.actionLight = new ActionLight(scene);
    this.vistas = new GardenVistas(scene);
    stones.forEach((stone, region) =>
      this.sanctuaries.push(
        scene.add
          .image(stone.x, stone.y, sanctuaryTexture(scene, region))
          .setOrigin(0.5, 590 / 650)
          .setDepth(-3),
      ),
    );
    this.contact = scene.add.graphics().setDepth(5);
    this.air = scene.add
      .graphics()
      .setDepth(-4)
      .setBlendMode(Phaser.BlendModes.ADD);
    for (let region = 0; region < 3; region++) {
      texture(scene, `sky-${region}`, 1600, 1000, (c) => paintSky(c, region));
      texture(scene, `forest-${region}`, 1800, 1000, (c) =>
        paintForest(c, region),
      );
      this.backgrounds.push(
        scene.add.image(0, 0, `sky-${region}`).setOrigin(0).setDepth(-30),
      );
      this.forest.push(
        scene.add
          .tileSprite(0, 0, 1600, 1000, `forest-${region}`)
          .setOrigin(0)
          .setDepth(-20)
          .setAlpha(0.7),
      );
    }
    texture(scene, "soft-light", 256, 256, (c) =>
      glow(c, 128, 128, 127, "rgba(255,221,151,.6)"),
    );
    texture(scene, "vignette", 1000, 800, (c) => {
      const v = c.createRadialGradient(500, 380, 180, 500, 380, 630);
      v.addColorStop(0, "rgba(0,6,18,0)");
      v.addColorStop(0.65, "rgba(0,6,18,.05)");
      v.addColorStop(1, "rgba(0,6,18,.72)");
      c.fillStyle = v;
      c.fillRect(0, 0, 1000, 800);
    });
    this.vignette = scene.add.image(0, 0, "vignette").setOrigin(0).setDepth(20);
    platforms.forEach((p, i) => {
      const region = Math.floor((p.room ?? 0) / 2),
        glass = !!p.moving || (region === 1 && p.y < 1000),
        key = `ledge-${region}-${p.w}-${glass}-${i % 19}`;
      texture(scene, key, p.w + 4, 260, (c) =>
        paintPlatform(c, p.w, (i % 19) * 137 + region, glass, region),
      );
      this.ledges.push(
        scene.add
          .image(p.x, p.y - 100, key)
          .setOrigin(0)
          .setDepth(-2),
      );
    });
    this.actor = new ActionActor(scene, "hero", 6);
    this.fallen = new ActionActor(scene, "hero", 5.9, false);
    this.fallen.setVisible(false);
    this.lantern = scene.add
      .image(0, 0, "soft-light")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.65)
      .setDepth(7);
    this.halo = scene.add
      .image(0, 0, "soft-light")
      .setTint(0x6aeed3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.18)
      .setDepth(-1);
    texture(scene, "gate", 560, 480, paintGate);
    this.gate = scene.add
      .image(100, 1100, "gate")
      .setOrigin(0.5, 410 / 480)
      .setDepth(-1);
  }
  defeat(x: number, y: number, clock: number, facing: number) {
    this.fallen.reset();
    this.fallPose = { x, y, clock, facing };
  }
  reset() {
    this.actor.reset();
    this.fallen.reset();
    this.fallen.setVisible(false);
    this.fallPose = null;
  }
  draw(
    pose: HeroPose,
    cam: Phaser.Cameras.Scene2D.Camera,
    region: number,
    width: number,
    height: number,
    reduced: boolean,
    title: boolean,
    rich = true,
  ) {
    this.dream.draw(cam, pose.clock, region, reduced, rich);
    this.falls.draw(cam, pose.clock, region, reduced, title);
    this.architecture.draw(cam, title);
    this.actionLight.draw(pose, title, reduced);
    this.vistas.draw(cam, !title, region, rich, pose);
    this.sanctuaries.forEach((image) =>
      image.setVisible(
        !title && Math.abs(image.x - pose.x) < cam.width / cam.zoom + 500,
      ),
    );
    const worldW = width / cam.zoom,
      worldH = height / cam.zoom;
    for (let i = 0; i < 3; i++) {
      this.backgrounds[i]
        .setVisible(i === region)
        .setPosition(cam.scrollX, cam.scrollY)
        .setDisplaySize(worldW, worldH);
      this.forest[i]
        .setVisible(i === region)
        .setPosition(cam.scrollX, cam.scrollY - worldH * 0.06)
        .setSize(worldW * 1.2, worldH * 1.15)
        .setScale(1)
        .setTileScale(worldH / 1000)
        .setTilePosition(cam.scrollX * 0.19, cam.scrollY * 0.05);
    }
    this.ledges.forEach((image, i) => {
      const p = this.platforms[i],
        visible =
          p.x + p.w > cam.scrollX - 100 &&
          p.x < cam.scrollX + worldW + 100 &&
          p.y > cam.scrollY - 200 &&
          p.y < cam.scrollY + worldH + 260;
      image.setVisible(visible && !title);
      image.setX(p.x);
      if (visible) image.setY(p.y - 100);
    });
    if (pose.onGround && !this.wasGrounded) this.landedAt = pose.clock;
    this.wasGrounded = pose.onGround;
    const landing = reduced
      ? 0
      : Math.max(0, 1 - (pose.clock - this.landedAt) / 0.16);
    this.contact.clear();
    if (pose.onGround && !title) {
      this.contact.fillStyle(0x102e36, 0.28);
      this.contact.fillEllipse(pose.x, pose.y + 1, 29 + landing * 10, 5);
      this.contact.lineStyle(1, 0xd3ecc7, 0.2 * landing);
      this.contact.strokeEllipse(pose.x, pose.y, 44 + (1 - landing) * 26, 6);
    }
    if (this.fallPose && pose.clock - this.fallPose.clock < 0.65 && !title) {
      this.fallen.draw({
        ...this.fallPose,
        clock: pose.clock,
        age: pose.clock - this.fallPose.clock,
        action: "defeat",
        vx: 0,
        grounded: false,
        reduced,
      });
    } else this.fallen.setVisible(false);
    const platform =
      pose.onGround && pose.groundIndex !== undefined && pose.groundIndex >= 0
        ? this.platforms[pose.groundIndex]
        : undefined;
    this.actor.draw(
      heroAction(
        {
          ...pose,
          landAt: this.landedAt,
          support: platform
            ? { id: pose.groundIndex!, x: platform.x, y: platform.y }
            : undefined,
        },
        reduced,
      ),
    );
    this.lantern
      .setPosition(pose.x - pose.facing * 10, pose.y - 14)
      .setScale(0.5 + (reduced ? 0 : Math.sin(pose.clock * 3) * 0.025));
    this.halo.setPosition(pose.x, pose.y - 35).setScale(0.9);
    this.gate.setVisible(title || cam.scrollX < 500).setPosition(100, 1100);
    if (title) {
      const x = cam.scrollX + worldW * 0.76,
        y = cam.scrollY + worldH * 0.84;
      this.gate.setPosition(x - 65, y).setScale(1.35);
      this.actor.draw({
        ...heroAction(pose, reduced),
        x: x + 95,
        y,
        action: "idle",
        age: pose.clock,
        vx: 0,
        grounded: true,
      });
      this.actor.container.setPosition(x + 95, y).setScale(1.44);
      this.lantern.setPosition(x + 80, y - 22).setScale(0.75);
      this.halo.setPosition(x + 95, y - 35).setScale(1.4);
      const ledge = this.ledges[0];
      ledge.setVisible(true).setPosition(x - 370, y - 100);
    } else {
      this.gate.setScale(1);
    }

    const air = this.air;
    air.clear();
    if (!reduced) {
      const t = pose.clock;
      if (region === 1) {
        for (let n = 0; n < 7; n++) {
          const x =
            cam.scrollX +
            (((n * worldW) / 6 - cam.scrollX * 0.08 + worldW * 2) %
              (worldW + 180)) -
            90;
          const y = cam.scrollY + worldH * 0.78 + Math.sin(t * 0.24 + n) * 38;
          air.lineStyle(1, 0xa6f6ee, 0.08);
          air.beginPath();
          for (let j = 0; j <= 24; j++) {
            const px = x + j * 12,
              py = y + Math.sin(j * 0.2 + t * 0.35 + n) * 19;
            if (j === 0) air.moveTo(px, py);
            else air.lineTo(px, py);
          }
          air.strokePath();
          air.lineStyle(1, 0xe7b9f2, 0.045);
          air.lineBetween(x, y + 4, x + 220, y + 25);
        }
      }
      for (let n = 0; n < (region === 2 ? 16 : 10); n++) {
        const x =
          cam.scrollX +
          ((n * 137 +
            t * (region === 2 ? 10 : 3) +
            Math.sin(t * 0.3 + n) * 22) %
            (worldW + 70)) -
          35;
        const y =
          cam.scrollY +
          ((n * 83 + t * (region === 2 ? 17 : -5) + worldH * 10) %
            (worldH + 60)) -
          30;
        if (region === 2) {
          air.fillStyle(0xe6d2a2, 0.22);
          air.fillEllipse(x, y, 5 + Math.sin(t + n) * 2, 2);
        } else {
          air.fillStyle(0xd0f5df, 0.18);
          air.fillCircle(x, y, 1);
          air.lineStyle(0.5, 0xc9f4e5, 0.12);
          air.strokeCircle(x, y, 3);
        }
      }
    }
    this.vignette
      .setPosition(cam.scrollX, cam.scrollY)
      .setDisplaySize(worldW, worldH)
      .setAlpha(title ? 0.7 : 1);
  }
}
