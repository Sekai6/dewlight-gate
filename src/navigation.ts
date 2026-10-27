export interface GuidePlatform {
  x: number;
  y: number;
  w: number;
  baseY?: number;
  room?: number;
}
export interface GuideObjective {
  id: string;
  x: number;
  y: number;
  title: string;
  detail: string;
  order: number;
  room: number;
}

// A small platform graph makes guidance follow reachable landings rather than point
// straight through the ceiling. Falling through a one-way floor is an explicit move.
export function guideLanding(
  player: { x: number; y: number; groundIndex: number },
  target: GuideObjective,
  platforms: GuidePlatform[],
) {
  const nodes = platforms
    .map((p, index) => ({ ...p, y: p.baseY ?? p.y, index }))
    .filter((p) => p.room === target.room);
  if (!nodes.length) return { x: target.x, y: target.y, action: target.detail };
  const distanceTo = (p: GuidePlatform, x: number, y: number) =>
    Math.max(p.x - x, 0, x - p.x - p.w) * 1.4 +
    Math.abs((p.baseY ?? p.y) - y) * 2;
  const source = nodes.findIndex((p) => p.index === player.groundIndex);
  const start =
    source >= 0
      ? source
      : nodes.reduce(
          (best, p, i) =>
            distanceTo(p, player.x, player.y) <
            distanceTo(nodes[best], player.x, player.y)
              ? i
              : best,
          0,
        );
  const end = nodes.reduce(
    (best, p, i) =>
      distanceTo(p, target.x, target.y) <
      distanceTo(nodes[best], target.x, target.y)
        ? i
        : best,
    0,
  );
  const costs = nodes.map(() => Infinity),
    previous = nodes.map(() => -1),
    visited = new Set<number>();
  costs[start] = 0;
  for (let step = 0; step < nodes.length; step++) {
    let a = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!visited.has(i) && (a < 0 || costs[i] < costs[a])) a = i;
    if (a < 0 || !Number.isFinite(costs[a]) || a === end) break;
    visited.add(a);
    const from = nodes[a];
    for (let b = 0; b < nodes.length; b++) {
      if (b === a) continue;
      const to = nodes[b],
        rise = from.y - to.y;
      const gap = Math.max(to.x - from.x - from.w, from.x - to.x - to.w, 0);
      if (rise > 100 || gap > (rise > 80 ? 100 : 155)) continue;
      const cost =
        costs[a] +
        Math.abs(to.x + to.w / 2 - (from.x + from.w / 2)) * 0.2 +
        Math.abs(rise) +
        60;
      if (cost < costs[b]) {
        costs[b] = cost;
        previous[b] = a;
      }
    }
  }
  let next = end;
  while (previous[next] >= 0 && previous[next] !== start) next = previous[next];
  if (start === end)
    return {
      x: target.x,
      y: target.y,
      action:
        Math.abs(player.x - target.x) < 85 ? target.detail : "沿平台靠近微光",
    };
  if (previous[next] < 0)
    return { x: target.x, y: target.y, action: "寻找相邻的落脚平台" };
  const p = nodes[next],
    from = nodes[start];
  let x = Math.max(p.x + 30, Math.min(p.x + p.w - 30, player.x));
  const dy = p.y - from.y;
  if (Math.abs(dy) < 12) {
    x =
      p.x + p.w / 2 > from.x + from.w / 2
        ? Math.min(p.x + p.w - 30, Math.max(p.x + 30, from.x + from.w + 20))
        : Math.max(p.x + 30, Math.min(p.x + p.w - 30, from.x - 20));
  }
  const takeoffDistance =
    x > player.x ? from.x + from.w - player.x : player.x - from.x;
  return {
    x,
    y: p.y,
    action:
      Math.abs(player.x - x) > 140 && takeoffDistance > 85
        ? "沿平台前行，靠近光箭头"
        : dy > 12 && player.x >= p.x + 15 && player.x <= p.x + p.w - 15
          ? "S + 空格 · 穿下平台"
          : dy < -30
            ? "空格 · 跃上枝台"
            : "空格 · 越过平台间隙",
  };
}
