export interface Platform {
  x: number;
  y: number;
  w: number;
  moving?: boolean;
  phase?: number;
  frozen?: number;
  baseY?: number;
  prevY?: number;
  motionTime?: number;
  room?: number;
  branch?: boolean;
  receiver?: string;
  amplitude?: number;
}
export interface Prism {
  id: string;
  x: number;
  y: number;
  room: number;
  order: number;
  mechanic: "touch" | "reflect" | "hold" | "guard";
  direction: number;
  name: string;
}
export interface RouteGoal {
  x: number;
  y: number;
  kind: "land" | "drop" | "lens" | "stone";
  room: number;
  id?: string;
}
export const GROUND_Y = 1100;
export const ROOM_WIDTH = 6000;
export const ROOMS_PER_REGION = 2;
export const roomNames = [
  "露水门廊",
  "蕨叶与浅溪 · 可选",
  "碎镜长桥",
  "停驻的温室",
  "风铃树冠",
  "彼此生长的花庭",
];
export const WORLD_WIDTH = ROOM_WIDTH * roomNames.length;
export const rooms = roomNames.map((name, i) => ({
  name,
  x: i * ROOM_WIDTH,
  gate: (i + 1) * ROOM_WIDTH - 40,
  region: Math.floor(i / ROOMS_PER_REGION),
}));
export const platforms: Platform[] = [];
export const prisms: Prism[] = [];
export const routeGoals: RouteGoal[] = [];
export const enemySpawns: {
  x: number;
  y: number;
  type: number;
  guard?: string;
}[] = [];
// Six authored profiles give each garden its own silhouette and light ritual.
// Lane offsets remain broad, one-way landings rather than precision jumps.
const profiles = [
  {
    top: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    middle: [0, 0, -25, -40, -25, 0, 0, 0, 0, 0, 0, 0],
    lower: [0, 0, 0, 20, 35, 20, 0, 0, 0, 0, 0, 0],
    mechanics: ["touch", "touch", "touch", "touch"],
  },
  {
    top: [0, -20, -35, -20, 0, 20, 0, -20, -35, -20, 0],
    middle: [0, 20, 35, 20, 0, -25, -40, -25, 0, 0, 0, 0],
    lower: [0, -25, -40, -25, 0, 25, 40, 25, 0, -20, 0, 0],
    mechanics: ["touch", "reflect", "touch", "touch"],
  },
  {
    top: [0, 0, -30, -50, -30, 0, 30, 50, 30, 0, 0],
    middle: [0, -30, -50, -30, 0, 20, 40, 20, 0, -20, 0, 0],
    lower: [0, 25, 50, 25, 0, -25, -50, -25, 0, 0, 0, 0],
    mechanics: ["reflect", "touch", "reflect", "touch"],
  },
  {
    top: [0, 25, 45, 25, 0, -25, -45, -25, 0, 0, 0],
    middle: [0, -20, -40, -20, 0, 20, 40, 20, 0, 0, 0, 0],
    lower: [0, -30, -50, -30, 0, 20, 40, 20, 0, -20, 0, 0],
    mechanics: ["reflect", "touch", "hold", "touch"],
  },
  {
    top: [0, -25, -50, -25, 0, 25, 50, 25, 0, -25, 0],
    middle: [0, 25, 50, 25, 0, -25, -50, -25, 0, 25, 0, 0],
    lower: [0, 0, -25, -50, -25, 0, 25, 50, 25, 0, 0, 0],
    mechanics: ["guard", "touch", "hold", "touch"],
  },
  {
    top: [0, -30, -55, -30, 0, 30, 55, 30, 0, -30, 0],
    middle: [0, 30, 55, 30, 0, -30, -55, -30, 0, 30, 0, 0],
    lower: [0, -25, -50, -25, 0, 25, 50, 25, 0, -25, 0, 0],
    mechanics: ["reflect", "hold", "guard", "touch"],
  },
] as const;

rooms.forEach((room, i) => {
  const x = room.x,
    profile = profiles[i];
  const add = (
    offset: number,
    y: number,
    w: number,
    extra: Partial<Platform> = {},
  ) => {
    const p: Platform = { x: x + offset, y, w, room: i, ...extra };
    platforms.push(p);
    return p;
  };
  const goal = (
    offset: number,
    y: number,
    kind: RouteGoal["kind"] = "land",
    id?: string,
  ) => routeGoals.push({ x: x + offset, y, kind, room: i, id });
  if (i === 0) {
    // A single eastbound introductory route, with an uncluttered arena at its end.
    add(0, GROUND_Y, ROOM_WIDTH);
    add(400, 1020, 460);
    add(900, 940, 460);
    add(1400, 1020, 460);
    const stops = [
      [620, 1020],
      [1120, 940],
      [1620, 1020],
      [2140, 1100],
    ];
    stops.forEach(([px, py], order) => {
      prisms.push({
        id: `lens-0-${order}`,
        x: px,
        y: py,
        room: 0,
        order,
        mechanic: "touch",
        direction: 1,
        name: ["门廊微光", "蕨叶露珠", "溪畔回声", "守卫的灯种"][order],
      });
      goal(px, py, "lens", `lens-0-${order}`);
    });
    goal(2500, 1100);
    goal(3320, 1100, "stone");
    goal(3580, 1100);
    return;
  }
  if (i < 2) add(0, GROUND_Y, ROOM_WIDTH);
  else
    for (const [a, b] of [
      [0, 1580],
      [1680, 3420],
      [3520, 4720],
      [4820, 6000],
    ])
      add(a, GROUND_Y, b - a);

  // Broad landings form alternating clearings and stepping stones.
  // Centers stay aligned with the authored route; gaps remain forgiving.
  const spans = [
    [460, 380, 440, 350, 470, 400, 360, 450, 380, 460, 420, 420],
    [360, 460, 390, 450, 340, 470, 420, 360, 460, 390, 420, 420],
    [440, 350, 460, 390, 470, 340, 440, 400, 360, 460, 420, 420],
    [380, 450, 350, 470, 400, 360, 460, 390, 450, 360, 420, 420],
    [460, 340, 440, 390, 460, 350, 470, 370, 440, 400, 420, 420],
    [350, 470, 380, 440, 360, 460, 390, 450, 340, 470, 420, 420],
  ][i];
  const landing = (
    offset: number,
    y: number,
    j: number,
    extra: Partial<Platform> = {},
  ) => {
    const width =
      offset === 400 && j === 0 && y < 1000 ? 540 : spans[j % spans.length];
    return add(offset + (420 - width) / 2, y, width, extra);
  };
  // Eastbound climb: successive 80px rises introduce jumping before hazards.
  for (let j = 0; j < 11; j++) {
    const py = GROUND_Y - Math.min(10, j + 1) * 80,
      px = 400 + j * 460;
    if (j === 10) add(px, py, 600);
    else landing(px, py, j);
    goal(px + 210, py);
  }
  const nodePositions = [
    { x: 5400, y: 300 },
    { x: 440, y: 300 },
    { x: 5400, y: 650 },
    { x: 440, y: 900 },
  ];
  for (let order = 0; order < 4; order++) {
    const p = nodePositions[order],
      mechanic = profile.mechanics[order];
    prisms.push({
      id: `lens-${i}-${order}`,
      x: x + p.x,
      y: p.y,
      room: i,
      order,
      mechanic,
      direction: ((i + order) % 3) + 1,
      name: ["晨光金镜", "回声青镜", "露水棱镜", "根脉灯座"][order],
    });
  }
  goal(5400, 300, "lens", `lens-${i}-0`);
  // Westbound upper canopy, with authored dips and floating glass in later areas.
  for (let j = 0; j < 10; j++)
    landing(400 + j * 460, 300 + profile.top[j] * 1.5, j, {
      moving: i >= 2 && j === 5,
      amplitude: 12,
    });
  for (let j = 9; j >= 0; j--) goal(610 + j * 460, 300 + profile.top[j] * 1.5);
  goal(440, 300, "lens", `lens-${i}-1`);

  // The left opening leads into the middle stream, never a blind lethal fall.
  for (let j = 0; j < 12; j++) {
    const receiver =
      profile.mechanics[2] === "hold" && j === 11 ? `lens-${i}-2` : undefined;
    landing(100 + j * 460, 650 + profile.middle[j] * 1.5, j === 11 ? 10 : j, {
      moving: !!receiver,
      receiver,
      amplitude: 12,
    });
  }
  // A hold receiver at the second node uses its own marked upper landing.
  if (profile.mechanics[1] === "hold") {
    const p = platforms.find(
      (p) =>
        p.room === i && p.x <= x + 440 && p.x + p.w >= x + 440 && p.y === 300,
    )!;
    p.moving = true;
    p.receiver = `lens-${i}-1`;
    p.amplitude = 10;
  }
  goal(250, 650, "drop");
  for (let j = 0; j < 12; j++)
    goal(310 + j * 460, 650 + profile.middle[j] * 1.5);
  goal(5400, 650, "lens", `lens-${i}-2`);
  // The eastern opening returns through roots beneath the glass galleries.
  for (let j = 0; j < 12; j++)
    landing(400 + j * 460, 900 + profile.lower[j] * 1.5, j, {
      branch: i === 1 && j === 6,
    });
  goal(5760, 900, "drop");
  for (let j = 11; j >= 0; j--)
    goal(610 + j * 460, 900 + profile.lower[j] * 1.5);
  goal(440, 900, "lens", `lens-${i}-3`);
  goal(250, GROUND_Y, "drop");
  if (i >= 2)
    for (const offset of [1450, 1900, 3350, 3800, 4650, 5100])
      goal(offset, GROUND_Y);
  if (i % ROOMS_PER_REGION === ROOMS_PER_REGION - 1)
    goal(ROOM_WIDTH - 180, GROUND_Y, "stone");
  goal(ROOM_WIDTH - 15, GROUND_Y);

  // Branches hold extra beads and scenery, not mandatory combat rewards.
  for (const [px, py] of [
    [1700, 780],
    [3200, 520],
    [4400, 790],
  ]) {
    if (
      !platforms.some(
        (p) =>
          p.room === i &&
          Math.abs(p.x - (x + px)) < 180 &&
          Math.abs(p.y - py) < 60,
      )
    )
      add(px, py, 170, { branch: true });
  }
  if (i >= 2) {
    for (const offset of [1200, 2700, 4300])
      enemySpawns.push({ x: x + offset, y: GROUND_Y, type: 0 });
    for (const order of [0, 2]) {
      const prism = prisms.find((p) => p.room === i && p.order === order)!;
      const support = platforms.find(
        (p) =>
          prism.x + 80 >= p.x &&
          prism.x + 80 <= p.x + p.w &&
          Math.abs(prism.y - p.y) < 1,
      );
      if (support)
        enemySpawns.push({
          x: prism.x + 80,
          y: prism.y,
          type: i >= 4 ? 1 : 0,
          guard: prism.mechanic === "guard" ? prism.id : undefined,
        });
    }
  }
});
// Remove duplicate top landings where the ascent meets the canopy.
for (let i = platforms.length - 1; i >= 0; i--)
  if (
    platforms.findIndex(
      (p) =>
        p.x === platforms[i].x &&
        p.y === platforms[i].y &&
        p.w === platforms[i].w,
    ) < i
  )
    platforms.splice(i, 1);
platforms.sort((a, b) => a.x - b.x || a.y - b.y);
// The old first garden had 46 sorted platforms. Keep later collection IDs stable
// when replacing it with four landings, so old saves cannot collect the same bead twice.
export function beadId(p: Platform, index: number, bead: number) {
  const identity =
    p.room === 0 ? (p.y === GROUND_Y ? 0 : `intro-${index}`) : index + 42;
  return `bead-${identity}-${bead}`;
}
export const stones = [1, 2, 3].map((i) => ({
  x: i === 1 ? 3320 : ROOM_WIDTH * ROOMS_PER_REGION * i - 180,
  y: GROUND_Y,
}));
export const memories = [
  {
    x: 240,
    y: GROUND_Y,
    text: "A / D 移动，空格跳跃，E 接住微光。沿右侧三个矮台前进，门廊里没有敌人，也没有深坑。",
  },
  ...rooms.map((r, i) => ({
    x: r.x + 150,
    y: GROUND_Y,
    text: [
      "沿溪向前，四点微光会唤醒露冠守卫。它曾守护晨露碑，如今被困在荆棘梦中。用 J 敲碎荆壳，Shift 避开冲锋，K 能让它短暂停下。",
      "浅溪让光有了方向。带刻痕的镜面可用 E 旋转；让明亮指针与浅金刻痕重合，灯环就会亮起。",
      "玻璃阶地出现了苔影。J 挥击，Shift 冲刺，K 束缚。暖红色圆环是攻击预警，光能会自动恢复。",
      "温室的露水镜需要安静的落脚处。站在它旁边，按 K 固定带叶片的玻璃平台，再按 E 引光。",
      "风铃里住着飞行的影子。守卫灯环可以在影子被 K 束缚时接通；也可以用 J 将它送回苔藓里。",
      "最后一座花庭记得你学过的每件事：转动镜面、固定叶台、让守卫安静下来。每次成功的引光都会保存。",
    ][i],
  })),
  ...prisms.map((p) => ({
    x: p.x + (p.order % 2 ? -120 : 120),
    y: p.y,
    text: `${roomNames[p.room]} · ${p.name}：${["露珠会把清晨完整地交给愿意停下来的人。", "破碎的玻璃，也能为远方留下一个方向。", "藤蔓向彼此伸展，孤独的高处也就有了归途。"][Math.floor(p.room / 2)]}`,
  })),
];
