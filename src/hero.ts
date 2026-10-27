import type { HeroPose } from "./art";

// Twelve poses per action. All frames share the same planted-foot origin.
export const HERO_FRAMES = 180;
export const HERO_WIDTH = 432;
export const HERO_HEIGHT = 384;
export const HERO_ORIGIN_Y = 288 / HERO_HEIGHT;
// A planted stance followed by a lifted recovery, shared by both legs.
export function heroFootPose(cycle: number, running: boolean) {
  const p = ((cycle % 1) + 1) % 1;
  const stance = running ? 0.54 : 0.64;
  const span = running ? 18 : 14;
  if (p < stance) return { x: span * (1 - (2 * p) / stance), y: 0 };
  const u = (p - stance) / (1 - stance);
  return {
    x: -span + 2 * span * (u * u * (3 - 2 * u)),
    y: -Math.sin(u * Math.PI) * (running ? 16 : 8),
  };
}
export function heroFrame(p: HeroPose) {
  // Interrupting actions must visually replace a swing that is still recovering.
  if (p.clock - p.hurtAt >= 0 && p.clock - p.hurtAt < 0.24)
    return 84 + Math.min(11, Math.floor(((p.clock - p.hurtAt) / 0.24) * 12));
  if (p.clock - p.dashAt >= 0 && p.clock - p.dashAt < 0.19)
    return 72 + Math.min(11, Math.floor(((p.clock - p.dashAt) / 0.19) * 12));
  const age = p.clock - p.attackAt;
  if (age >= 0 && age < 0.38)
    return (
      (p.onGround && Math.abs(p.vx) > 80
        ? p.attackStyle
          ? 144
          : 132
        : p.attackStyle
          ? 96
          : 48) + Math.min(11, Math.floor((age / 0.38) * 12))
    );
  if (p.clock - p.bindAt < 0.45)
    return 60 + Math.min(11, Math.floor(((p.clock - p.bindAt) / 0.45) * 12));
  const launch = p.clock - (p.launchAt ?? -999);
  if (!p.onGround && launch >= 0 && launch < 0.16)
    return 120 + Math.min(11, Math.floor((launch / 0.16) * 12));
  const landing = p.clock - (p.landAt ?? -999);
  if (p.onGround && Math.abs(p.vx) < 80 && landing >= 0 && landing < 0.22)
    return 108 + Math.min(11, Math.floor((landing / 0.22) * 12));
  if (!p.onGround)
    return 36 + Math.min(11, Math.max(0, Math.floor((p.vy + 540) / 100)));
  const turn = p.clock - (p.turnAt ?? -999),
    brake = p.clock - (p.brakeAt ?? -999);
  if (turn >= 0 && turn < 0.16)
    return 156 + Math.min(11, Math.floor((turn / 0.16) * 12));
  if (brake >= 0 && brake < 0.18)
    return 168 + Math.min(11, Math.floor((brake / 0.18) * 12));
  const speed = Math.abs(p.vx);
  return speed > 180
    ? 24 + (Math.floor((p.stride ?? p.clock * 3.2) * 12) % 12)
    : speed > 5
      ? 12 + (Math.floor((p.stride ?? p.clock * 1.8) * 12) % 12)
      : Math.floor(p.clock * 5) % 12;
}

// Artist-authored wrist keys share the ready pose at both ends, avoiding snaps
// when anticipation becomes a strike or a strike returns to locomotion.
export function heroSwordPose(progress: number, rising: boolean) {
  const keys = rising
    ? [
        [0, 12, -29, 0.45],
        [0.16, 3, -19, 3.7],
        [0.34, 25, -35, 1.2],
        [0.58, 9, -51, -0.25],
        [1, 12, -29, 0.45],
      ]
    : [
        [0, 12, -29, 0.45],
        [0.16, -5, -49, -0.9],
        [0.34, 25, -34, 1.25],
        [0.58, 15, -19, 2.9],
        [1, 12, -29, 0.45],
      ];
  const t = Math.max(0, Math.min(1, progress));
  let k = 1;
  while (k < keys.length - 1 && t > keys[k][0]) k++;
  const from = keys[k - 1],
    to = keys[k];
  const u = (t - from[0]) / (to[0] - from[0]);
  const eased = u * u * (3 - 2 * u);
  return {
    x: from[1] + (to[1] - from[1]) * eased,
    y: from[2] + (to[2] - from[2]) * eased,
    angle: from[3] + (to[3] - from[3]) * eased,
  };
}

export function paintHero(c: CanvasRenderingContext2D, frame: number) {
  c.scale(3, 3);
  c.translate(72, 96);
  const action = Math.floor(frame / 12),
    t = (frame % 12) / 11,
    phase = t * Math.PI * 2;
  const movingAttack = action === 11 || action === 12;
  const turn = action === 13,
    brake = action === 14;
  const moving = action === 1 || action === 2 || movingAttack,
    run = action === 2 || movingAttack,
    air = action === 3,
    land = action === 9,
    launch = action === 10;
  const compression = land
    ? Math.sin((1 - t) * Math.PI * 0.7) * 8
    : launch
      ? -Math.sin(t * Math.PI) * 3
      : 0;
  const risingCut = action === 8 || action === 12;
  const attack = action === 4 || risingCut || action === 11,
    cast = action === 5,
    dash = action === 6,
    hurt = action === 7;
  const swing = moving
    ? Math.sin(phase)
    : turn
      ? Math.sin(t * Math.PI) * 0.6
      : brake
        ? (1 - t) * 0.65
        : 0;
  const strikeWeight = attack ? Math.sin(Math.min(1, t / 0.58) * Math.PI) : 0;
  const lift = moving
    ? Math.abs(Math.cos(phase)) * (run ? 2.8 : 1.1)
    : action === 0
      ? Math.sin(phase) * 0.6
      : -compression;
  const wind = dash
    ? 18
    : turn
      ? -9 * (1 - t)
      : brake
        ? 11 * (1 - t)
        : run
          ? 11
          : moving || air || launch
            ? 6
            : 1;
  const lean = dash
    ? 0.6
    : hurt
      ? -0.25 * Math.sin(t * Math.PI)
      : attack
        ? (risingCut ? -0.16 : 0.3) * strikeWeight
        : turn
          ? -0.24 * Math.sin(t * Math.PI)
          : brake
            ? -0.16 * Math.sin(t * Math.PI)
            : run
              ? 0.2 + Math.sin(phase * 2) * 0.025
              : moving
                ? 0.035 + Math.sin(phase) * 0.025
                : 0;
  const line = (points: number[][], color: string, width: number) => {
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.stroke();
  };
  const oval = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    color: string,
  ) => {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
  };
  const shape = (points: number[][], color: string) => {
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = color;
    c.fill();
  };
  // Two articulated legs, with the rear leg passing behind the tunic.
  for (const side of [-1, 1]) {
    const gait = heroFootPose(t + (side < 0 ? 0.5 : 0), run);
    const step = swing * side * (run ? 12 : 7),
      knee = land
        ? side * (8 + compression * 0.5)
        : launch
          ? side * (9 - t * 5)
          : air
            ? side * (12 - t * 7)
            : turn || brake
              ? side * (7 + (1 - t) * 6)
              : dash
                ? -side * 9
                : step * 0.65;
    const foot = land
      ? side * 7
      : launch
        ? side * (6 + t * 3)
        : air
          ? side * (13 - t * 8) - 4
          : turn || brake
            ? side * 9 + (1 - t) * 5
            : dash
              ? -side * 14
              : attack && !movingAttack
                ? side * (7 + strikeWeight * 6) + strikeWeight * 3
                : moving
                  ? gait.x
                  : step;
    const fy = launch ? -t * 12 : air ? -12 + t * 10 : moving ? gait.y : 0;
    // Bend the knee forwards between hip and ankle; the boot stays flat in stance.
    const hipX = side * 4,
      hipY = -22 - lift;
    const dx = foot - hipX,
      dy = fy - 3 - hipY;
    const length = Math.max(0.01, Math.hypot(dx, dy));
    const bend = Math.sqrt(Math.max(0, 18 * 18 - (length * length) / 4));
    const kneeX = moving ? (hipX + foot) / 2 + (dy / length) * bend : knee;
    const kneeY = moving
      ? (hipY + fy - 3) / 2 - (dx / length) * bend
      : (air ? (side < 0 ? -23 + t * 9 : -15 + t * 3) : -12) - lift;
    line(
      [
        [hipX, hipY],
        [kneeX, kneeY],
        [foot, fy - 3],
      ],
      side < 0 ? "#24474f" : "#41616a",
      4.2,
    );
    line(
      [
        [foot - 2, fy - 2],
        [foot + 4, fy - 2],
      ],
      "#17333f",
      4,
    );
    // Soft leather ankle, ivory toe cap and a planted sole remain legible at game scale.
    shape(
      [
        [foot - 3, fy - 8],
        [foot + 1, fy - 8],
        [foot + 2, fy - 4],
        [foot + 6, fy - 3],
        [foot + 6, fy],
        [foot - 3, fy],
      ],
      side < 0 ? "#28454f" : "#45616a",
    );
    line(
      [
        [foot + 2, fy - 3],
        [foot + 5, fy - 2],
      ],
      "#e3cf9c",
      1.2,
    );
    line(
      [
        [foot - 3, fy],
        [foot + 6, fy],
      ],
      "#17333f",
      1.1,
    );
    line(
      [
        [foot - 2, fy - 4],
        [foot + 1, fy - 4],
      ],
      "#d3bc86",
      0.8,
    );
  }
  c.save();
  c.translate(0, -lift);
  c.rotate(lean);
  // Split silk cloak: anchored shoulders, delayed hem and a bright stitched edge.
  const flutter =
    Math.sin(phase + 0.8) * (moving ? 3 : land || launch ? 4 : 1.2);
  const airHem = air ? Math.sin(t * Math.PI) * 5 - 2 : launch ? -t * 4 : 0;
  const coat = c.createLinearGradient(-20, -45, 14, -13);
  coat.addColorStop(0, "#d4eee0");
  coat.addColorStop(0.35, "#75b7a7");
  coat.addColorStop(1, "#285367");
  c.beginPath();
  c.moveTo(-7, -44);
  c.bezierCurveTo(
    -16,
    -37,
    -16 - wind,
    -22,
    -19 - wind,
    -13 + flutter + airHem,
  );
  c.quadraticCurveTo(-9, -8, 0, -15);
  c.lineTo(13, -11 - flutter + airHem);
  c.quadraticCurveTo(10, -28, 8, -43);
  c.closePath();
  c.fillStyle = coat;
  c.fill();
  // Folded petal lining gives the silhouette a second material and a clear hem.
  shape(
    [
      [-9, -31],
      [-14 - wind, -16 + flutter + airHem],
      [-4, -19],
      [0, -30],
    ],
    "rgba(192,209,179,.48)",
  );
  shape(
    [
      [4, -32],
      [12, -14 - flutter],
      [8, -17],
      [1, -29],
    ],
    "rgba(35,77,88,.5)",
  );
  line(
    [
      [-7, -40],
      [-12 - wind, -18],
      [-19 - wind, -13 + flutter + airHem],
    ],
    "#c6e5c5",
    1,
  );
  line(
    [
      [1, -39],
      [-1, -23],
      [4, -16],
    ],
    "#376b70",
    1,
  );
  // Fine woven veins follow the moving cloak rather than floating over the body.
  for (let vein = 0; vein < 4; vein++) {
    const hemX = -16 - wind + vein * 6;
    line(
      [
        [-5 + vein * 3, -36],
        [hemX + 5, -24],
        [hemX, -16 + flutter + airHem],
      ],
      "rgba(220,241,212,.28)",
      0.5,
    );
  }
  shape(
    [
      [-5, -43],
      [7, -43],
      [8, -24],
      [-6, -24],
    ],
    "#416f72",
  );
  line(
    [
      [-6, -26],
      [8, -26],
    ],
    "#dbbe83",
    2,
  );
  oval(3, -26, 1.6, 1.8, "#fbefbd");
  for (let stitch = 0; stitch < 5; stitch++)
    oval(-5 + stitch * 2.5, -25, 0.35, 0.5, "#f3dfa8");
  shape(
    [
      [1, -36],
      [4, -39],
      [7, -36],
      [4, -32],
    ],
    "#bfe9d9",
  );
  line(
    [
      [4, -38],
      [4, -33],
    ],
    "#fff3c5",
    0.65,
  );
  // Rear arm carries a small belt lantern, leaving only two visible arms.
  const backX = -10 - swing * 3 - strikeWeight * 5,
    backY = -24 + Math.abs(swing) * 2 - strikeWeight * 4;
  line(
    [
      [-6, -39],
      [backX - 2, -32],
      [backX, backY],
    ],
    "#3d6a70",
    4,
  );
  line(
    [
      [backX, backY],
      [backX, backY + 5],
    ],
    "#bca875",
    1,
  );
  shape(
    [
      [backX - 4, backY + 5],
      [backX + 3, backY + 5],
      [backX + 5, backY + 11],
      [backX, backY + 17],
      [backX - 5, backY + 11],
    ],
    "#e5c98c",
  );
  oval(backX, backY + 10, 2, 4, "#fff3bf");
  line(
    [
      [backX - 3, backY + 7],
      [backX, backY + 13],
      [backX + 3, backY + 7],
    ],
    "#fff1c5",
    0.6,
  );
  // A narrow shaded tail lags behind the broad silk ribbon.
  c.beginPath();
  c.moveTo(-5, -43);
  c.bezierCurveTo(
    -18,
    -40,
    -25 - wind,
    -42 - flutter,
    -34 - wind,
    -34 - flutter,
  );
  c.lineTo(-29 - wind, -30 - flutter);
  c.bezierCurveTo(-20, -36, -14, -37, -4, -40);
  c.closePath();
  c.fillStyle = "#b58f66";
  c.fill();
  // Scarf has separate trailing tips, counter-moving against the stride.
  c.beginPath();
  c.moveTo(-3, -45);
  c.bezierCurveTo(
    -16,
    -48,
    -20 - wind,
    -37 + flutter,
    -29 - wind,
    -41 + flutter,
  );
  c.lineTo(-25 - wind, -35 + flutter);
  c.bezierCurveTo(-14, -33, -12, -40, -2, -40);
  c.closePath();
  c.fillStyle = "#e2bc7c";
  c.fill();
  line(
    [
      [-7, -44],
      [-19 - wind, -40],
      [-26 - wind, -40 + flutter],
    ],
    "#fff0b2",
    0.7,
  );
  // Hood, inset porcelain mask, glass brow and tiny botanical ornament.
  const hood = c.createLinearGradient(-15, -67, 13, -39);
  hood.addColorStop(0, "#c9e4ca");
  hood.addColorStop(0.45, "#84b6a6");
  hood.addColorStop(1, "#254f61");
  c.beginPath();
  c.moveTo(-15, -41);
  c.bezierCurveTo(-20, -53, -10, -66, -1, -70);
  c.bezierCurveTo(8, -67, 18, -55, 14, -42);
  c.quadraticCurveTo(0, -37, -15, -41);
  c.fillStyle = hood;
  c.fill();
  // Curved hood seam, leaf clasp and a narrow embroidered collar anchor the design.
  c.beginPath();
  c.moveTo(-10, -45);
  c.bezierCurveTo(-15, -56, -5, -66, 1, -67);
  c.strokeStyle = "rgba(32,69,80,.55)";
  c.lineWidth = 1.4;
  c.stroke();
  for (let stitch = 0; stitch < 6; stitch++)
    oval(-12 + stitch * 1.1, -51 - stitch * 2, 0.35, 0.7, "#e3dfb5");
  shape(
    [
      [-14, -45],
      [-20, -48],
      [-17, -40],
      [-12, -40],
    ],
    "#8ab6a3",
  );
  line(
    [
      [-18, -46],
      [-14, -41],
    ],
    "#e7d49e",
    0.6,
  );
  line(
    [
      [-7, -42],
      [1, -39],
      [10, -42],
    ],
    "#dcc38b",
    1.4,
  );
  oval(1, -39, 1.5, 1.8, "#c2ecda");
  oval(3, -52, 10, 12, "#254857");
  const porcelain = c.createLinearGradient(-4, -62, 12, -43);
  porcelain.addColorStop(0, "#fff9e5");
  porcelain.addColorStop(1, "#d7d3bc");
  c.beginPath();
  c.ellipse(4, -52, 8.3, 10.5, 0, 0, Math.PI * 2);
  c.fillStyle = porcelain;
  c.fill();
  line(
    [
      [-1, -58],
      [0, -61],
      [4, -62],
    ],
    "rgba(255,255,247,.7)",
    0.7,
  );
  line(
    [
      [7, -54],
      [9, -54],
    ],
    "#264a55",
    1.6,
  );
  line(
    [
      [4, -46],
      [7, -46],
    ],
    "#c6b598",
    0.7,
  );
  line(
    [
      [-13, -46],
      [-13, -55],
      [-7, -63],
      [-1, -67],
    ],
    "#e0f4d9",
    0.9,
  );
  shape(
    [
      [-5, -64],
      [-13, -71],
      [-7, -70],
      [-2, -66],
    ],
    "#d5b978",
  );
  // Weapon follows the wrist through anticipation, cutting stroke and recovery.
  let handX = 12 - swing * 4,
    handY = -29 - (moving ? swing * 2 : 0),
    weaponAngle = dash ? -2 : 0.45;
  if (air) {
    handX = 11 + Math.sin(t * Math.PI) * 4;
    handY = -37 + t * 10;
    weaponAngle = -0.25 + t * 0.7;
  }
  if (land) {
    handX += compression * 0.6;
    handY += compression * 0.3;
  }
  if (launch) {
    handX -= Math.sin(t * Math.PI) * 5;
    handY -= t * 9;
    weaponAngle = -0.3;
  }
  if (attack) {
    const wrist = heroSwordPose(t, risingCut);
    handX = wrist.x;
    handY = wrist.y;
    weaponAngle = wrist.angle;
  }

  if (cast) {
    handX = 12 + Math.sin(t * Math.PI) * 13;
    handY = -37 - Math.sin(t * Math.PI) * 5;
  }
  if (dash) {
    handX = -10;
    handY = -31;
  }
  // Two connected arm segments keep the elbow attached during overhead cuts.
  const armX = handX - 7,
    armY = handY + 39;
  const reach = Math.max(0.001, Math.hypot(armX, armY));
  const elbowOffset = Math.sqrt(Math.max(0, 14 * 14 - (reach * reach) / 4));
  const elbowX = (7 + handX) / 2 - (armY / reach) * elbowOffset;
  const elbowY = (-39 + handY) / 2 + (armX / reach) * elbowOffset;
  line(
    [
      [7, -39],
      [elbowX, elbowY],
      [handX, handY],
    ],
    "#87b8aa",
    4,
  );
  line(
    [
      [7, -39],
      [elbowX, elbowY],
    ],
    "#6b9e96",
    5,
  );
  oval(elbowX, elbowY, 2.3, 2.3, "#a5c8af");
  oval(handX, handY, 2.4, 2.4, "#f2e5c6");
  if (!cast) {
    c.save();
    c.translate(handX, handY);
    c.rotate(weaponAngle);
    line(
      [
        [0, 4],
        [0, -5],
      ],
      "#d8b77c",
      2.4,
    );
    line(
      [
        [-4, -3],
        [4, -3],
      ],
      "#f6db9b",
      1.3,
    );
    shape(
      [
        [0, -5],
        [-3, -13],
        [0, -29],
        [4, -12],
      ],
      "rgba(173,233,226,.85)",
    );
    line(
      [
        [0, -27],
        [0, -6],
      ],
      "#f1fff1",
      0.8,
    );
    c.restore();
  } else {
    oval(
      handX,
      handY,
      4 + Math.sin(t * Math.PI) * 3,
      4,
      "rgba(203,244,171,.65)",
    );
    line(
      [
        [handX, handY],
        [handX + 7, handY - 7],
      ],
      "#e7fbd0",
      1,
    );
  }
  c.restore();
}
