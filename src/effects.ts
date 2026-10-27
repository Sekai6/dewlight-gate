import Phaser from "phaser";
import { HERO_ORIGIN_Y, heroSwordPose } from "./hero";
import { createEffectArt } from "./effect-art";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  size: number;
  color: number;
  gravity: number;
  kind: "spark" | "leaf" | "dust";
  variant: number;
  spin: number;
}
interface Ring {
  kind: string;
  direction: number;
  x: number;
  y: number;
  born: number;
  life: number;
  radius: number;
  color: number;
}
interface Trail {
  frame: number;
  x: number;
  y: number;
  born: number;
  facing: number;
}
export class Effects {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private trails: Trail[] = [];
  private glow: Phaser.GameObjects.Graphics;
  private ink: Phaser.GameObjects.Graphics;
  private ghosts: Phaser.GameObjects.Image[] = [];
  private flecks: Phaser.GameObjects.Image[] = [];
  private column: Phaser.GameObjects.Image;
  private dashVeil: Phaser.GameObjects.Image;
  private vineSeal: Phaser.GameObjects.Image;
  private ceremony = { x: 0, y: 0, born: -999 };
  private lastTime = 0;
  private lastTrail = -1;
  private lastStep = 0;
  private stepX = 0;
  constructor(scene: Phaser.Scene) {
    createEffectArt(scene);
    this.vineSeal = scene.add
      .image(0, 0, "vfx-vine-seal")
      .setDepth(7)
      .setVisible(false);
    this.column = scene.add
      .image(0, 0, "vfx-column")
      .setOrigin(0.5, 1)
      .setDepth(8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.dashVeil = scene.add
      .image(0, 0, "vfx-dash")
      .setOrigin(0.8, 0.5)
      .setDepth(5.8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    for (let n = 0; n < 150; n++)
      this.flecks.push(
        scene.add.image(0, 0, "vfx-glint").setDepth(9.2).setVisible(false),
      );
    this.glow = scene.add
      .graphics()
      .setDepth(9)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.ink = scene.add.graphics().setDepth(8);
    for (let n = 0; n < 12; n++)
      this.ghosts.push(
        scene.add
          .image(0, 0, "hero-72")
          .setOrigin(0.5, HERO_ORIGIN_Y)
          .setScale(1 / 3)
          .setTint(0x8fe7d8)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(5.5)
          .setVisible(false),
      );
  }
  reset() {
    this.vineSeal.setVisible(false);
    this.column.setVisible(false);
    this.dashVeil.setVisible(false);
    this.flecks.forEach((i) => i.setVisible(false));
    this.ceremony.born = -999;
    this.ghosts.forEach((image) => image.setVisible(false));
    this.particles = [];
    this.rings = [];
    this.trails = [];
    this.lastTime = 0;
    this.lastTrail = -1;
  }
  burst(
    x: number,
    y: number,
    time: number,
    kind:
      | "jump"
      | "land"
      | "hit"
      | "collect"
      | "bind"
      | "awaken"
      | "hurt"
      | "dash"
      | "defeat",
    reduced: boolean,
    direction = 0,
  ) {
    if (kind === "awaken") this.ceremony = { x, y, born: time };
    const palette = {
      jump: 0xa6e7d5,
      land: 0x91c4a8,
      hit: 0xffd59c,
      collect: 0xd2fff0,
      bind: 0xb8e99e,
      awaken: 0xffdf9b,
      hurt: 0xffb394,
      dash: 0xb7f9f0,
      defeat: 0xc4dba4,
    };
    const count = reduced
      ? 3
      : kind === "awaken"
        ? 54
        : kind === "hit"
          ? 24
          : kind === "bind"
            ? 26
            : kind === "collect"
              ? 9
              : 14;
    const speed =
      kind === "awaken"
        ? 180
        : kind === "hit"
          ? 150
          : kind === "collect"
            ? 40
            : 65;
    for (let i = 0; i < count; i++) {
      const a =
          kind === "hit" && direction !== 0
            ? (direction < 0 ? Math.PI : 0) + (Math.random() - 0.5) * 1.9
            : Math.random() * Math.PI * 2,
        v = (0.3 + Math.random() * 0.7) * speed;
      this.particles.push({
        variant: i % 3,
        spin: (Math.random() - 0.5) * (kind === "hit" ? 10 : 4),
        x,
        y,
        vx: Math.cos(a) * v + (kind === "hit" ? direction * 90 : 0),
        vy:
          kind === "land" || kind === "jump"
            ? -Math.abs(Math.sin(a) * v) - 12
            : Math.sin(a) * v - (kind === "awaken" ? 70 : 15),
        born: time,
        life:
          kind === "awaken"
            ? 1.6 + Math.random() * 1.4
            : 0.35 + Math.random() * 0.55,
        size:
          kind === "awaken"
            ? 0.7 + Math.random() * 1.5
            : 0.6 + Math.random() * 2,
        color: palette[kind],
        gravity: kind === "land" ? 40 : kind === "awaken" ? -15 : 40,
        kind:
          kind === "bind" || kind === "defeat"
            ? "leaf"
            : kind === "land"
              ? "dust"
              : "spark",
      });
    }
    if (["awaken", "hit", "bind", "collect", "land"].includes(kind))
      this.rings.push({
        kind,
        direction,
        x,
        y,
        born: time,
        life: kind === "awaken" ? 2.2 : 0.55,
        radius:
          kind === "awaken"
            ? 440
            : kind === "bind"
              ? 90
              : kind === "hit"
                ? 65
                : 35,
        color: palette[kind],
      });
    if (this.particles.length > 500)
      this.particles.splice(0, this.particles.length - 500);
  }
  draw(
    time: number,
    player: {
      x: number;
      y: number;
      facing: number;
      dashAt: number;
      attackAt: number;
      attackStyle?: number;
      region?: number;
      bindAt: number;
      bindTarget: { x: number; y: number };
      onGround: boolean;
      vx: number;
    },
    reduced: boolean,
  ) {
    const dt = Math.max(0, Math.min(0.05, time - this.lastTime));
    this.lastTime = time;
    const travelled = Math.abs(player.x - this.stepX);
    if (travelled > 300 || time < this.lastStep) this.lastStep = time;
    if (
      !reduced &&
      player.onGround &&
      Math.abs(player.vx) > 40 &&
      travelled > 22 &&
      time - this.lastStep > 0.13 &&
      !(time - player.dashAt < 0.2)
    ) {
      this.lastStep = time;
      this.stepX = player.x;
      for (let n = 0; n < 3; n++)
        this.particles.push({
          x: player.x - player.facing * 7,
          y: player.y - 2,
          vx: -player.vx * 0.12 + (Math.random() - 0.5) * 20,
          vy: -15 - Math.random() * 22,
          born: time,
          life: 0.35 + n * 0.07,
          size: 0.65 + n * 0.15,
          color: player.region === 1 ? 0xc1e5ff : 0xc7e5ab,
          gravity: 55,
          kind: player.region === 1 ? "spark" : "leaf",
          variant: n,
          spin: n - 1,
        });
    }
    if (!player.onGround || Math.abs(player.vx) < 40 || travelled > 300)
      this.stepX = player.x;
    const g = this.glow,
      i = this.ink;
    g.clear();
    i.clear();
    this.flecks.forEach((image) => image.setVisible(false));
    const ceremony = (time - this.ceremony.born) / 2.2;
    this.column.setVisible(!reduced && ceremony >= 0 && ceremony < 1);
    if (ceremony >= 0 && ceremony < 1)
      this.column
        .setPosition(this.ceremony.x, this.ceremony.y + 70)
        .setDisplaySize(105 + ceremony * 55, 360 + ceremony * 360)
        .setAlpha(Math.sin(ceremony * Math.PI) * 0.7);
    const dashing = time - player.dashAt < 0.2;
    this.dashVeil
      .setVisible(dashing && !reduced)
      .setPosition(player.x, player.y - 30)
      .setFlipX(player.facing < 0)
      .setDisplaySize(170, 60)
      .setAlpha(0.65);
    if (
      !reduced &&
      time - player.dashAt < 0.2 &&
      time - this.lastTrail > 0.022
    ) {
      this.trails.push({
        x: player.x,
        y: player.y,
        born: time,
        facing: player.facing,
        frame:
          72 +
          Math.min(
            11,
            Math.max(0, Math.floor(((time - player.dashAt) / 0.19) * 12)),
          ),
      });
      this.lastTrail = time;
    }
    this.trails = this.trails.filter((t) => time - t.born < 0.32);
    this.ghosts.forEach((image, n) => {
      const trail = this.trails[n];
      image.setVisible(!!trail && !reduced);
      if (trail)
        image
          .setTexture(`hero-${trail.frame}`)
          .setPosition(trail.x, trail.y)
          .setFlipX(trail.facing < 0)
          .setRotation(trail.facing * 0.13)
          .setAlpha((1 - (time - trail.born) / 0.32) * 0.25);
    });
    this.particles = this.particles.filter((p) => time - p.born < p.life);
    for (const [index, p] of this.particles.entries()) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      const a = Math.sin(Math.min(1, (time - p.born) / p.life) * Math.PI);
      if (
        index < this.flecks.length &&
        p.kind !== "dust" &&
        (!reduced || index < 8)
      ) {
        const key =
          p.kind === "leaf"
            ? "vfx-leaf"
            : p.variant === 0
              ? "vfx-glint"
              : p.variant === 1
                ? "vfx-shard"
                : "vfx-dew";
        this.flecks[index]
          .setVisible(true)
          .setTexture(key)
          .setPosition(p.x, p.y)
          .setRotation(p.spin * (time - p.born))
          .setAlpha(a * 0.72)
          .setDisplaySize(
            p.size * (p.kind === "leaf" ? 10 : 12),
            p.size * (p.kind === "leaf" ? 5 : 12),
          )
          .setBlendMode(
            p.kind === "leaf" || p.variant === 1
              ? Phaser.BlendModes.NORMAL
              : Phaser.BlendModes.ADD,
          );
      }
      if (p.kind === "leaf") {
        i.fillStyle(p.color, a * 0.8);
        i.fillEllipse(p.x, p.y, p.size * 4, p.size * 1.5);
      } else {
        g.fillStyle(p.color, a * 0.035);
        g.fillCircle(p.x, p.y, p.size * 3.5);
        g.fillStyle(p.color, a * 0.9);
        g.fillCircle(p.x, p.y, p.size);
        if (p.kind === "spark") {
          g.lineStyle(0.6, p.color, a * 0.6);
          g.lineBetween(p.x, p.y, p.x - p.vx * 0.025, p.y - p.vy * 0.025);
        }
      }
    }
    this.rings = this.rings.filter((r) => time - r.born < r.life);
    for (const r of this.rings) {
      const t = (time - r.born) / r.life,
        e = 1 - Math.pow(1 - t, 3);
      g.lineStyle(Math.max(0.5, 2 * (1 - t)), r.color, (1 - t) * 0.7);
      if (r.kind === "land") g.strokeEllipse(r.x, r.y, r.radius * e * 2, 8 * e);
      else if (r.kind === "hit") {
        // A brief faceted contact flash, followed by glass slivers opening outwards.
        // Keep it local to the hit so the silhouette and enemy warning stay readable.
        const contact = Math.max(0, 1 - t * 5);
        if (!reduced && contact > 0) {
          const size = 8 + (1 - contact) * 14;
          g.fillStyle(0xfff6d8, contact * 0.8);
          g.fillTriangle(
            r.x - size,
            r.y,
            r.x,
            r.y - size * 1.3,
            r.x + size,
            r.y,
          );
          g.fillTriangle(
            r.x - size,
            r.y,
            r.x,
            r.y + size * 1.3,
            r.x + size,
            r.y,
          );
        }
        if (!reduced)
          for (let shard = 0; shard < 4; shard++) {
            const a = (shard * Math.PI) / 2 + 0.4 + t * 0.5;
            const distance = 8 + e * 37;
            const sx = r.x + Math.cos(a) * distance;
            const sy = r.y + Math.sin(a) * distance;
            const length = 7 * (1 - t);
            g.fillStyle(shard % 2 ? 0xbdece6 : 0xf5dda5, (1 - t) * 0.65);
            g.fillTriangle(
              sx,
              sy - length,
              sx - length * 0.35,
              sy + length,
              sx + length * 0.35,
              sy + length * 0.5,
            );
          }
        // Short directional impact needles separate contact from the wider swing ribbon.
        for (let n = 0; n < 7; n++) {
          const angle = (n - 3) * 0.28 + (r.direction < 0 ? Math.PI : 0);
          const inner = 8 + e * 25,
            outer = inner + (1 - t) * 27;
          g.lineStyle(
            n === 3 ? 2 : 1,
            n % 2 ? 0xc5f5e6 : 0xffefbd,
            (1 - t) * (1 - t) * 0.9,
          );
          g.lineBetween(
            r.x + Math.cos(angle) * inner,
            r.y + Math.sin(angle) * inner,
            r.x + Math.cos(angle) * outer,
            r.y + Math.sin(angle) * outer,
          );
        }
      } else g.strokeCircle(r.x, r.y, r.radius * e);
      if (r.radius > 200 && !reduced) {
        const rise = Math.sin(t * Math.PI),
          reach = 70 + 100 * e;
        for (let n = 0; n < 6; n++) {
          const angle = (n * Math.PI) / 3 + t * 0.4,
            x = r.x + Math.cos(angle) * reach,
            y = r.y + Math.sin(angle) * reach * 0.45 - t * 100;
          g.lineStyle(1, r.color, rise * 0.6);
          g.strokeTriangle(x, y - 10, x - 5, y + 3, x + 5, y + 3);
          g.lineStyle(0.6, r.color, rise * 0.2);
          g.lineBetween(x, y + 6, x, y + 32);
        }
        g.fillStyle(r.color, rise * 0.035);
        g.fillTriangle(r.x - 18, r.y + 70, r.x + 18, r.y + 70, r.x, r.y - 370);

        g.lineStyle(10, r.color, (1 - t) * 0.05);
        g.strokeCircle(r.x, r.y, r.radius * e);
      }
    }
    const bind = (time - player.bindAt) / 0.55;
    this.vineSeal.setVisible(!reduced && bind >= 0.15 && bind < 1.7);
    if (bind >= 0.15 && bind < 1.7)
      this.vineSeal
        .setPosition(player.bindTarget.x, player.bindTarget.y)
        .setScale(0.35 + Math.min(1, bind) * 0.35)
        .setRotation(bind * 0.18)
        .setAlpha(
          Math.min(1, (bind - 0.15) * 6) *
            Math.max(0, 1 - (bind - 0.5) / 1.2) *
            0.8,
        );
    if (bind >= 0 && bind < 1) {
      const reach = Math.min(1, bind * 4),
        sx = player.x,
        sy = player.y - 30,
        tx = sx + (player.bindTarget.x - sx) * reach,
        ty = sy + (player.bindTarget.y - sy) * reach;
      for (let strand = 0; strand < 3; strand++) {
        i.lineStyle(strand === 0 ? 2 : 1, 0xb9e4ad, (1 - bind) * 0.9);
        i.beginPath();
        for (let n = 0; n <= 32; n++) {
          const t = n / 32,
            x = sx + (tx - sx) * t,
            y =
              sy +
              (ty - sy) * t +
              Math.sin(t * Math.PI * 4 + strand * 2 + bind * 9) *
                13 *
                Math.sin(t * Math.PI);
          if (n === 0) i.moveTo(x, y);
          else i.lineTo(x, y);
          if (n % 6 === 0) {
            i.fillStyle(0xc5edab, (1 - bind) * 0.7);
            i.fillEllipse(x, y, 10, 4);
          }
        }
        i.strokePath();
      }
    }
    const attack = (time - player.attackAt - 0.08) / 0.22;
    if (attack >= 0 && attack < 1) {
      const dir = player.facing;
      const progress = (time - player.attackAt) / 0.38;
      const bladeAngle = (p: number) => {
        const wrist = heroSwordPose(p, !!player.attackStyle);
        return Math.atan2(
          wrist.y - Math.cos(wrist.angle) * 29 + 30,
          dir * (wrist.x + Math.sin(wrist.angle) * 29),
        );
      };
      const start = bladeAngle(Math.max(0.16, progress - 0.15));
      const head = bladeAngle(Math.min(0.58, progress));
      const sweep = Math.atan2(Math.sin(head - start), Math.cos(head - start));
      const end = start + sweep;
      const x = player.x,
        y = player.y - 30;
      if (!reduced) {
        const energy = Math.sin(attack * Math.PI),
          tint = [0xc8f3d6, 0xc5d9ff, 0xf6ccdc][player.region ?? 0];
        for (let n = 0; n < 18; n++) {
          const a0 = start + ((end - start) * n) / 18,
            a1 = start + ((end - start) * (n + 1)) / 18;
          const outer = 68 + Math.sin((n / 18) * Math.PI) * 5,
            inner = 47 + (n / 18) * 9;
          g.fillStyle(
            n % 4 === 0 ? 0xffe4b8 : tint,
            energy * 0.13 * (0.3 + n / 18),
          );
          g.fillTriangle(
            x + Math.cos(a0) * inner,
            y + Math.sin(a0) * inner,
            x + Math.cos(a0) * outer,
            y + Math.sin(a0) * outer,
            x + Math.cos(a1) * outer,
            y + Math.sin(a1) * outer,
          );
          g.fillTriangle(
            x + Math.cos(a0) * inner,
            y + Math.sin(a0) * inner,
            x + Math.cos(a1) * outer,
            y + Math.sin(a1) * outer,
            x + Math.cos(a1) * inner,
            y + Math.sin(a1) * inner,
          );
        }
        const tipX = x + Math.cos(end) * 64,
          tipY = y + Math.sin(end) * 64;
        g.lineStyle(1, 0xfff5d5, energy * 0.8);
        g.lineBetween(tipX - 6, tipY, tipX + 6, tipY);
        g.lineBetween(tipX, tipY - 8, tipX, tipY + 8);
      }
      for (let layer = 0; layer < 4; layer++) {
        g.lineStyle(
          [18, 8, 3, 1][layer],
          layer < 2 ? 0x8eecde : 0xfff1c7,
          [0.055, 0.17, 0.7, 0.95][layer] * Math.sin(attack * Math.PI),
        );
        g.beginPath();
        g.arc(x, y, 54 + layer * 3, start, end, sweep < 0);
        g.strokePath();
      }
      for (let n = 0; n < 5; n++) {
        const a = start + ((end - start) * n) / 5;
        g.lineStyle(1, 0xf9edbd, (1 - attack) * 0.6);
        g.lineBetween(
          x + Math.cos(a) * 70,
          y + Math.sin(a) * 70,
          x + Math.cos(a) * 84,
          y + Math.sin(a) * 84,
        );
      }
    }
  }
}
