// A short horizontal reach makes walking feel generous without collecting through floors.
export function attractPickup(
  bead: { x: number; y: number },
  player: { x: number; y: number },
  dt: number,
) {
  const dx = player.x - bead.x,
    dy = player.y - 28 - bead.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= 88 || Math.abs(dy) > 52) return false;
  const factor = 1 - Math.exp(-10 * Math.min(dt, 1 / 30));
  bead.x += dx * factor;
  bead.y += dy * factor;
  return Math.hypot(player.x - bead.x, player.y - 28 - bead.y) < 36;
}
