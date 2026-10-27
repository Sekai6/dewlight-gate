/** Simulation-clock camera: pausing never advances framing or action breathing. */
export class JourneyCamera {
  x = 0;
  y = 0;
  zoom = 1;
  private clock = -1;
  private playerX = 0;
  private playerY = 0;
  private lead = 0;
  private viewport = "";
  private focus: { x: number; y: number; born: number } | null = null;
  awaken(x: number, y: number, clock: number) {
    this.focus = { x, y, born: clock };
  }
  reset() {
    this.clock = -1;
    this.focus = null;
    this.lead = 0;
  }
  update(
    p: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      clock: number;
      onGround: boolean;
      dashAt: number;
      attackAt: number;
      arena?: { left: number; right: number; floor: number };
    },
    width: number,
    height: number,
    baseZoom: number,
    worldWidth: number,
    floor: number,
    reduced: boolean,
  ) {
    const dt = Math.min(0.05, Math.max(0, p.clock - this.clock));
    const viewport = `${width}/${height}/${baseZoom}`;
    const snap =
      this.viewport !== viewport ||
      this.clock < 0 ||
      p.clock < this.clock ||
      Math.hypot(p.x - this.playerX, p.y - this.playerY) > 550;
    const ease = (rate: number) => 1 - Math.exp(-rate * dt);
    if (
      this.focus &&
      (p.clock < this.focus.born || Math.abs(p.x - this.focus.x) > 320)
    )
      this.focus = null;
    const age = this.focus ? p.clock - this.focus.born : -1;
    const ceremony =
      !reduced && age >= 0 && age < 3
        ? Math.min(1, age / 0.6) * Math.min(1, (3 - age) / 0.8)
        : 0;
    const dash = p.clock - p.dashAt < 0.35;
    const combat = p.clock - p.attackAt < 0.6;
    const targetZoom =
      baseZoom *
      (reduced
        ? 1
        : ceremony > 0
          ? 1 - ceremony * 0.065
          : dash
            ? 0.975
            : combat
              ? 1.018
              : 1);
    this.zoom = snap
      ? targetZoom
      : this.zoom + (targetZoom - this.zoom) * ease(5);
    if (p.arena) {
      const arenaZoom = Math.min(
        baseZoom,
        width / (p.arena.right - p.arena.left + 240),
      );
      this.zoom = snap
        ? arenaZoom
        : this.zoom + (arenaZoom - this.zoom) * ease(5);
    }
    const w = width / this.zoom,
      h = height / this.zoom;
    const desiredLead =
      Math.abs(p.vx) > 30
        ? Math.sign(p.vx) * Math.min(w * 0.13, 130)
        : this.lead;
    this.lead = snap ? 0 : this.lead + (desiredLead - this.lead) * ease(2.8);
    let tx = p.x - w * 0.5 + this.lead;
    // Hold a vertical window around the feet so every small jump does not move the world.
    const feet = p.y - this.y;
    let ty = this.y;
    const upper = h * 0.43,
      lower = h * 0.72;
    if (feet < upper) ty = p.y - upper;
    if (feet > lower) ty = p.y - lower;
    if (p.onGround) ty = p.y - h * 0.66;
    else if (p.vy > 350) ty += Math.min(65, (p.vy - 350) * 0.1);
    if (this.focus && ceremony > 0) {
      tx += (this.focus.x - w * 0.5 - tx) * ceremony * 0.65;
      ty += (this.focus.y - h * 0.72 - ty) * ceremony;
    }
    if (p.arena) {
      tx = (p.arena.left + p.arena.right) / 2 - w / 2;
      ty = p.arena.floor - h * 0.72;
    }
    this.x = snap ? tx : this.x + (tx - this.x) * ease(reduced ? 14 : 7);
    this.y = snap
      ? p.y - h * 0.66
      : this.y + (ty - this.y) * ease(reduced ? 14 : p.vy > 350 ? 9 : 4);
    this.x = Math.max(0, Math.min(Math.max(0, worldWidth - w), this.x));
    this.y = Math.max(-120, Math.min(Math.max(-120, floor + 250 - h), this.y));
    this.clock = p.clock;
    this.viewport = viewport;
    this.playerX = p.x;
    this.playerY = p.y;
    return this;
  }
}
