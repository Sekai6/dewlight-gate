import Phaser from "phaser";
import type { Enemy } from "./creature";

type C = CanvasRenderingContext2D;
const STATES = [
  "patrol",
  "windup",
  "strike",
  "recover",
  "hurt",
  "bound",
  "defeat",
  "idle",
] as const;
type Pose = (typeof STATES)[number];

function paint(c: C, type: number, pose: Pose, f: number) {
  c.scale(3, 3);
  c.translate(64, 80);
  const t = f / 7,
    wave = Math.sin(t * Math.PI * 2),
    windup = pose === "windup",
    strike = pose === "strike";
  const bound = pose === "bound",
    dead = pose === "defeat",
    hurt = pose === "hurt";
  const movement =
    pose === "patrol" ? wave : strike ? Math.sin(t * Math.PI * 3) : 0;
  const recover = pose === "recover";
  const leap = strike ? Math.sin(t * Math.PI) : 0;
  const breath = pose === "idle" || bound ? Math.sin(t * Math.PI * 2) * 0.6 : 0;
  const line = (p: number[][], color: string, width = 1) => {
    c.beginPath();
    p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.stroke();
  };
  const ellipse = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    color: string | CanvasGradient,
    rotation = 0,
  ) => {
    c.beginPath();
    c.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
  };
  const poly = (p: number[][], color: string | CanvasGradient) => {
    c.beginPath();
    p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = color;
    c.fill();
  };
  const gradient = (
    x: number,
    y: number,
    x2: number,
    y2: number,
    colors: string[],
  ) => {
    const g = c.createLinearGradient(x, y, x2, y2);
    colors.forEach((color, i) =>
      g.addColorStop(i / (colors.length - 1), color),
    );
    return g;
  };
  c.save();
  c.translate(0, breath);
  if (windup) {
    // A gathered silhouette releases into a longer lunge, keeping feet as the origin.
    c.scale(1 - t * (type ? 0.035 : 0.08), 1 + t * (type ? 0.025 : 0.04));
    c.rotate(type ? -t * 0.09 : -t * 0.025);
  }
  if (dead) {
    c.translate(0, t * 7);
    c.rotate(t * (type ? 0.75 : -0.22));
    c.globalAlpha = 1 - t * 0.6;
  }
  if (hurt) {
    c.translate(-Math.sin(t * Math.PI) * 4, 0);
    c.rotate(-Math.sin(t * Math.PI) * 0.13);
  }
  if (strike) {
    c.scale(1 + leap * (type ? 0.1 : 0.13), 1 - leap * (type ? 0.07 : 0.08));
    c.translate(0, -leap * (type ? 2 : 5));
    c.rotate((type ? 0.2 : 0.13) * leap);
  }
  if (recover) c.scale(1 + (1 - t) * 0.08, 1 - (1 - t) * 0.09);
  if (!type) {
    // Six segmented limbs alternate planted and lifted feet; the abdomen stays low.
    for (const rear of [true, false]) {
      for (let n = 0; n < 3; n++) {
        const root = -14 + n * 13,
          side = rear ? -1 : 1;
        const step = movement * (n % 2 ? 1 : -1) * 5,
          crouch = windup ? t * 5 : strike ? -2 - leap * 3 : 0;
        line(
          [
            [root, -16 + crouch],
            [root + side * 7 + step, -9 + crouch],
            [root + side * 10 + step, -Math.max(0, step) * 0.5],
          ],
          rear ? "#29434b" : "#607c70",
          3,
        );
        line(
          [
            [root + side * 7 + step, -9 + crouch],
            [root + side * 10 + step, -Math.max(0, step) * 0.5],
          ],
          "#bbbd8b",
          0.7,
        );
      }
    }
    c.translate(
      strike ? 4 + leap * 3 : windup ? -t * 5 : 0,
      windup ? t * 5 : Math.abs(movement) * -0.8,
    );
    // Abdominal shell, scalloped moss mantle and polished glass seams.
    ellipse(-4, -23, 27, 19, "#102b38", -0.08);
    ellipse(
      -5,
      -25,
      25,
      17,
      gradient(-27, -43, 15, -12, ["#c7d9a3", "#6f9b80", "#254958"]),
      -0.08,
    );
    ellipse(-12, -32, 16, 8, "rgba(205,232,173,.25)", -0.22);
    // Overlapping shell plates catch light independently of the moss mantle.
    for (let plate = 0; plate < 4; plate++) {
      const x = -23 + plate * 10;
      c.beginPath();
      c.moveTo(x, -36);
      c.quadraticCurveTo(x + 12, -30, x + 6, -17);
      c.strokeStyle = "rgba(225,235,180,.45)";
      c.lineWidth = 0.8;
      c.stroke();
      for (let speck = 0; speck < 3; speck++)
        ellipse(x + speck * 2, -30 + speck * 3, 0.7, 1, "rgba(38,83,83,.65)");
    }
    for (let bud = 0; bud < 3; bud++) {
      const x = -23 + bud * 12;
      line(
        [
          [x, -39],
          [x - 2, -46],
          [x + 1, -50],
        ],
        "#8da983",
        0.7,
      );
      ellipse(x + 1, -50, 2.2, 1.6, "#d7c6cf", -0.5);
      ellipse(x + 1, -50, 0.6, 0.6, "#f4e4aa");
    }
    line(
      [
        [-23, -20],
        [-12, -13],
        [4, -14],
        [15, -22],
      ],
      "#b4c99a",
      1,
    );
    line(
      [
        [-18, -35],
        [-8, -32],
        [2, -24],
        [4, -14],
      ],
      "#355d61",
      1.1,
    );
    for (let n = 0; n < 5; n++) {
      const x = -26 + n * 9;
      ellipse(
        x,
        -37 - Math.sin(n) * 2,
        7,
        3.6,
        n % 2 ? "#97b780" : "#617f67",
        -0.45 + n * 0.15,
      );
      line(
        [
          [x - 4, -37],
          [x + 3, -40],
        ],
        "#c6d6a0",
        0.55,
      );
    }
    for (let n = 0; n < 3; n++) {
      const x = -19 + n * 10;
      poly(
        [
          [x, -37],
          [x + 1, -48 - (n % 2) * 5],
          [x + 7, -38],
        ],
        gradient(x, -48, x + 7, -35, ["#def1cf", "rgba(98,181,172,.55)"]),
      );
      line(
        [
          [x + 1, -47],
          [x + 4, -38],
        ],
        "rgba(241,255,220,.8)",
        0.7,
      );
    }
    // Porcelain seed mask protrudes toward the locked attack direction.
    ellipse(17, -24, 12, 13, "#203e47", -0.12);
    ellipse(
      20,
      -25,
      9,
      10,
      gradient(14, -34, 28, -16, ["#f0e3bd", "#a6b991"]),
      -0.12,
    );
    line(
      [
        [22, -28],
        [26, -29],
      ],
      windup || strike ? "#ae6047" : "#2b4d52",
      1.8,
    );
    line(
      [
        [23, -20],
        [27, -23],
      ],
      "#526f69",
      0.7,
    );
    line(
      [
        [24, -18],
        [32, -12],
        [35, -16],
      ],
      "#d3c496",
      2,
    );
    line(
      [
        [12, -35],
        [11, -45],
        [18, -51],
      ],
      "#a4b284",
      1.2,
    );
    ellipse(18, -52, 5, 2.4, windup ? "#ffd697" : "#e3dfb6", -0.35);
    if (windup || strike) {
      line(
        [
          [-10, -33],
          [0, -26],
          [2, -17],
        ],
        "#f5c18a",
        1.6,
      );
      ellipse(24, -28, 1.2, 1.2, "#fff0bc");
    }
  } else {
    // The glass moth has four distinct leaf-shaped wings, dark outlines and veins.
    const flap = bound
      ? 0.15
      : strike
        ? -0.7 + leap * 0.45
        : windup
          ? 0.8 - t * 0.25
          : 0.35 + wave * 0.45;
    for (const side of [-1, 1]) {
      c.save();
      c.translate(side * 3, -27);
      c.scale(side, 1);
      c.rotate((side < 0 ? -0.1 : 0.1) + (strike ? -0.18 : 0));
      const tipY = -22 - flap * 24,
        tipX = 45 + flap * 7;
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(11, -23, 28, -33, tipX, tipY);
      c.bezierCurveTo(49, -11, 37, 6, 5, 8);
      c.closePath();
      c.fillStyle = gradient(0, -40, 42, 7, [
        "rgba(225,243,206,.9)",
        "rgba(99,176,174,.7)",
        "rgba(50,95,116,.6)",
      ]);
      c.fill();
      c.strokeStyle = "#b7d8bb";
      c.lineWidth = 0.9;
      c.stroke();
      c.save();
      c.clip();
      for (let facet = 0; facet < 5; facet++) {
        const x = 8 + facet * 8;
        poly(
          [
            [x, -4],
            [x + 7, -28],
            [x + 16, -12],
          ],
          facet % 2 ? "rgba(223,178,219,.14)" : "rgba(204,227,249,.2)",
        );
      }
      c.restore();
      line(
        [
          [2, 1],
          [23, -10],
          [tipX, tipY],
        ],
        "rgba(232,249,205,.8)",
        0.9,
      );
      for (let n = 0; n < 4; n++)
        line(
          [
            [9 + n * 6, -3 - n * 3],
            [17 + n * 7, -19 - n * 2],
          ],
          "rgba(192,228,200,.48)",
          0.65,
        );
      poly(
        [
          [9, -4],
          [24, -23],
          [35, -15],
          [25, -5],
        ],
        "rgba(241,231,174,.18)",
      );
      ellipse(31, -15, 5, 6, "rgba(30,73,86,.45)");
      ellipse(31, -15, 2.7, 3.5, "#e6dbac");
      ellipse(31, -15, 1.2, 2, "#55978e");
      for (let bead = 0; bead < 5; bead++)
        ellipse(12 + bead * 6, -21 - bead * 2, 1, 1, "rgba(243,239,192,.72)");
      c.beginPath();
      c.moveTo(0, 6);
      c.quadraticCurveTo(27, 4, 32, 25 + flap * 4);
      c.quadraticCurveTo(15, 30, -2, 13);
      c.fillStyle = gradient(0, 4, 30, 28, ["#7eae9c", "rgba(147,200,181,.3)"]);
      c.fill();
      line(
        [
          [2, 9],
          [24, 22 + flap * 4],
        ],
        "#bad7ae",
        0.7,
      );
      line(
        [
          [5, 15],
          [11, 35],
          [8, 44 + wave * 3],
        ],
        "#78ac9e",
        1,
      );
      ellipse(8, 44 + wave * 3, 2, 4, "#d6dbab", 0.3);
      c.restore();
    }
    ellipse(
      0,
      -24,
      8,
      20,
      gradient(-7, -44, 7, -5, ["#d5dcb1", "#719d8e", "#264d5c"]),
    );
    for (let n = 0; n < 4; n++)
      line(
        [
          [-5, -23 + n * 5],
          [4, -23 + n * 5],
        ],
        "#c3c897",
        0.75,
      );
    ellipse(1, -37, 9, 9, "#243f4e");
    ellipse(3, -38, 6.8, 7, "#ece5c7");
    line(
      [
        [5, -40],
        [8, -40],
      ],
      windup || strike ? "#b97656" : "#3e6462",
      1.6,
    );
    for (const side of [-1, 1]) {
      line(
        [
          [side * 3, -44],
          [side * 9, -52],
          [side * 17, -54 + wave * 2],
        ],
        "#bccb9d",
        1,
      );
      ellipse(
        side * 17,
        -54 + wave * 2,
        2.2,
        2.2,
        windup ? "#ffcf91" : "#ecdfb4",
      );
    }
    // A faceted seed lantern replaces the old featureless oval body.
    poly(
      [
        [-5, -28],
        [5, -28],
        [8, -18],
        [0, -9],
        [-8, -18],
      ],
      gradient(-7, -28, 6, -9, [
        "#ede8b8",
        windup ? "#eeb17d" : "#9bd0b5",
        "#4b8988",
      ]),
    );
    line(
      [
        [0, -27],
        [0, -10],
      ],
      "#f3f0c9",
      0.7,
    );
    if (windup || strike) ellipse(0, -19, 3, 4, "#ffe5b1");
  }
  if (bound) {
    for (let n = 0; n < 3; n++) {
      c.beginPath();
      c.ellipse(0, -10 - n * 11, type ? 17 : 31, 4, -0.15, 0, Math.PI * 2);
      c.strokeStyle = "#b6d994";
      c.lineWidth = 1.7;
      c.stroke();
      ellipse(-15 + n * 6, -10 - n * 11, 5, 2, "#d3e4a6", -0.5);
    }
  }
  if (dead)
    for (let n = 0; n < 9; n++) {
      const a = n * 2.4,
        r = 8 + t * 33;
      poly(
        [
          [Math.cos(a) * r, -22 + Math.sin(a) * r],
          [Math.cos(a) * r + 2, -26 + Math.sin(a) * r],
          [Math.cos(a) * r + 4, -21 + Math.sin(a) * r],
        ],
        "rgba(219,235,177,.65)",
      );
    }
  c.restore();
}

export class CreatureDirector {
  private images: Phaser.GameObjects.Image[] = [];
  private ink: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {
    for (let type = 0; type < 2; type++)
      for (const pose of STATES)
        for (let f = 0; f < 8; f++) {
          const key = `creature-${type}-${pose}-${f}`;
          const texture = scene.textures.createCanvas(key, 384, 300)!;
          paint(texture.context, type, pose, f);
          texture.refresh();
        }
    this.ink = scene.add.graphics().setDepth(4.2);
  }
  draw(
    enemies: Enemy[],
    time: number,
    cam: Phaser.Cameras.Scene2D.Camera,
    reduced: boolean,
    visible: boolean,
    playerX: number,
  ) {
    this.ink.clear();
    this.images.forEach((i) => i.setVisible(false));
    if (!visible) return;
    const g = this.ink;
    enemies.forEach((e, index) => {
      if (
        e.x < cam.scrollX - 140 ||
        e.x > cam.scrollX + cam.width / cam.zoom + 140 ||
        e.y < cam.scrollY - 150 ||
        e.y > cam.scrollY + cam.height / cam.zoom + 160
      )
        return;
      const dead = e.hp <= 0,
        age = time - e.diedAt;
      if (dead && age > 0.65) return;
      const bound = e.bound > time,
        hurt = time - e.hurtAt < 0.2;
      const state: Pose = dead
        ? "defeat"
        : bound
          ? "bound"
          : hurt
            ? "hurt"
            : e.phase;
      const progress =
        state === "patrol"
          ? (e.type ? time * 2 : e.gait) % 1
          : state === "bound"
            ? (time * 0.65 + index * 0.13) % 1
            : state === "defeat"
              ? age / 0.65
              : state === "hurt"
                ? (time - e.hurtAt) / 0.2
                : (time - e.phaseAt) /
                  (state === "windup"
                    ? e.type
                      ? 0.85
                      : 0.7
                    : state === "strike"
                      ? 0.22
                      : 0.45);
      const frame = Math.max(
        0,
        Math.min(
          7,
          Math.floor((reduced && state === "patrol" ? 0 : progress) * 8),
        ),
      );
      let image = this.images[index];
      if (!image)
        image = this.images[index] = this.scene.add
          .image(0, 0, "creature-0-patrol-0")
          .setOrigin(0.5, 0.8)
          .setScale(1 / 3)
          .setDepth(4);
      image
        .setTexture(`creature-${e.type}-${state}-${frame}`)
        .setPosition(e.x, e.y)
        .setFlipX(e.dir < 0)
        .setAlpha(dead ? Math.max(0, 1 - age / 0.65) : 1)
        .setVisible(true);
      const settle =
        state === "recover"
          ? Math.sin(Math.min(1, progress) * Math.PI) * 0.035
          : 0;
      image.setScale((1 + settle) / 3, (1 - settle) / 3);
      image.setTint(hurt ? 0xffeac3 : 0xffffff);
      if (hurt && !dead) {
        const flash = Math.max(0, 1 - (time - e.hurtAt) / 0.2);
        g.lineStyle(1.4, 0xf7efd0, flash * 0.65);
        for (let n = 0; n < 4; n++) {
          const a = (n * Math.PI) / 2 + 0.3,
            r = 25 + (1 - flash) * 18;
          g.lineBetween(
            e.x + Math.cos(a) * r,
            e.y - 25 + Math.sin(a) * r,
            e.x + Math.cos(a) * (r + 7),
            e.y - 25 + Math.sin(a) * (r + 7),
          );
        }
      }
      if (dead) return;
      g.fillStyle(0x0d2932, e.type ? 0.12 : 0.25);
      g.fillEllipse(e.x, e.floor + 2, e.type ? 34 : 58, e.type ? 5 : 8);
      if (e.phase === "windup" && !bound) {
        const p = 1 - e.warn / (e.type ? 0.85 : 0.7),
          dir = e.attackDir;
        g.fillStyle(0xf4b780, 0.06 + p * 0.09);
        g.fillTriangle(
          e.x,
          e.y - 14,
          e.x + dir * 100,
          e.y - 28,
          e.x + dir * 100,
          e.y + 1,
        );
        g.lineStyle(2, 0xf2c08b, 0.8);
        g.beginPath();
        g.arc(
          e.x,
          e.y - 25,
          43 - p * 10,
          -Math.PI / 2,
          -Math.PI / 2 + p * Math.PI * 2,
        );
        g.strokePath();
        g.fillStyle(0xffe2aa);
        g.fillTriangle(e.x, e.y - 74, e.x - 4, e.y - 66, e.x + 4, e.y - 66);
      }
      if (e.phase === "strike" && !bound) {
        g.lineStyle(2, 0xf7d5a0, 0.6);
        for (let n = 0; n < 3; n++)
          g.lineBetween(
            e.x - e.attackDir * (24 + n * 7),
            e.y - 14 - n * 8,
            e.x - e.attackDir * (50 + n * 9),
            e.y - 14 - n * 8,
          );
      }
      if (bound) {
        const remaining = Math.max(0, e.bound - time);
        g.lineStyle(1, 0xc4e9aa, 0.45);
        g.beginPath();
        g.arc(
          e.x,
          e.y - 25,
          39,
          -Math.PI / 2,
          -Math.PI / 2 + Math.min(1, remaining / 3) * Math.PI * 2,
        );
        g.strokePath();
      }
      if (e.phase === "recover" && !bound && !hurt) {
        // Falling seed flecks make the vulnerable recovery readable in every tier.
        const progress = Math.min(1, (time - e.phaseAt) / 0.45);
        for (let n = 0; n < 3; n++) {
          const x = e.x - 18 + n * 16,
            y = e.y - 45 + progress * 18 + n * 3;
          g.fillStyle(0xe3d3a2, (1 - progress) * 0.55);
          g.fillEllipse(x, y, 3, 1.5);
        }
      }
      if (
        Math.abs(e.x - playerX) < 240 &&
        (e.hp < 2 || e.phase !== "patrol" || bound)
      ) {
        for (let n = 0; n < 2; n++) {
          g.fillStyle(n < e.hp ? 0xddd7a5 : 0x36585a, 0.9);
          g.fillRoundedRect(e.x - 9 + n * 10, e.y - 61, 7, 3, 1);
        }
      }
    });
  }
}
