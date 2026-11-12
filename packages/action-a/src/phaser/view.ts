import Phaser from "phaser";
import { RigPart } from "../part.ts";
import { attachCanvasRig } from "./canvas.ts";
import type { WeaponGrip } from "../stages/grip.ts";
import type { ActorInput, ActorState } from "../stages/state.ts";
import type { WeaponTrail } from "../stages/trail.ts";
import type { ActorView } from "../view.ts";
import { clamp } from "../core.ts";
import { traitsOf } from "../definition.ts";

interface Echo {
  container: Phaser.GameObjects.Container;
  images: RigPart[];
  born: number;
}

/** Stage 8 and the output side: owns every display object. Sprites are created
 *  once in a fixed order; nothing is allocated while animating. */
export class PhaserActorView implements ActorView {
  readonly container: Phaser.GameObjects.Container;
  readonly debug: Phaser.GameObjects.Graphics;
  readonly trail: Phaser.GameObjects.Graphics;
  readonly accents: Phaser.GameObjects.Graphics;
  /** Dash afterimages. */
  readonly echoes: Echo[] = [];
  showBones = false;
  private echoAt = -999;
  private state: ActorState;
  /** `texture` is the atlas key whose frames the rig skin names. */
  constructor(
    scene: Phaser.Scene,
    state: ActorState,
    texture: string,
    depth: number,
    echoes: boolean,
  ) {
    this.state = state;
    const { rig, parts } = state;

    this.container = scene.add.container(0, 0).setDepth(depth);
    attachCanvasRig(this.container, () => parts.values(), rig.extent);
    this.trail = scene.add.graphics().setDepth(depth + 0.15);
    this.accents = scene.add.graphics().setDepth(depth - 0.1);
    this.debug = scene.add.graphics().setDepth(depth + 1);
    const add = (
      name: string,
      frame: string,
      w: number,
      h: number,
      originY = 0.5,
    ) =>
      parts.set(
        name,
        new RigPart(scene.textures.getFrame(texture, frame))
          .setDisplaySize(w, h)
          .setOrigin(0.5, originY),
      );
    // Draw order: skin behind the legs, the legs, then the rest by depth.
    for (const s of rig.skin.filter((s) => (s.depth ?? 0) < 0))
      add(s.bone, s.texture, s.width, s.height, s.originY);
    const leg = rig.legSkin;
    for (let i = 0; i < 2; i++) {
      add(`thigh${i}`, "leg", leg.width, rig.leg * 1.3);
      add(`shin${i}`, "limb", leg.shin, rig.leg * 1.3);
      add(`knee${i}`, "joint", leg.knee, leg.knee);
      add(`ankle${i}`, "joint", leg.ankle, leg.ankle);
      add(`foot${i}`, "boot", leg.footWidth, leg.footHeight, 0.82);
    }
    for (const s of rig.skin
      .filter((s) => (s.depth ?? 0) >= 0)
      .sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0)))
      add(s.bone, s.texture, s.width, s.height, s.originY);
    if (echoes)
      for (let i = 0; i < 2; i++) {
        const container = scene.add
          .container(0, 0)
          .setDepth(depth - 0.2)
          .setVisible(false);
        const images = [...parts.values()].map((source) =>
          new RigPart(source.frame)
            .setOrigin(source.originX, source.originY)
            .setTint(0xb9e5d4),
        );
        attachCanvasRig(container, () => images);
        this.echoes.push({ container, images, born: -999 });
      }
  }
  reset() {
    this.echoAt = -999;
    for (const e of this.echoes) {
      e.born = -999;
      e.container.setVisible(false);
    }
  }
  setVisible(value: boolean) {
    this.container.setVisible(value);
    this.trail.setVisible(value);
    this.accents.setVisible(value);
    this.debug.setVisible(value && this.showBones);
    if (!value) this.echoes.forEach((e) => e.container.setVisible(false));
  }
  /** Write the solved skeleton to its sprites and place the actor in the scene. */
  submit(input: ActorInput) {
    const { rig, world, parts } = this.state;
    for (const skin of rig.skin) {
      const t = world[skin.bone];
      parts
        .get(skin.bone)!
        .setPosition(t.x, t.y)
        .setDisplaySize(skin.width, skin.height)
        .setAlpha(t.alpha)
        .setMatrix(t.a, t.b, t.c, t.d);
    }
    this.container.setPosition(input.x, input.y).setScale(input.facing, 1);
    if (
      traitsOf(rig, input.action).echo &&
      !input.reduced &&
      input.clock - this.echoAt > 0.045 &&
      this.echoes.length
    ) {
      const echo = this.echoes.reduce((a, b) => (a.born < b.born ? a : b));
      echo.born = input.clock;
      this.echoAt = input.clock;
      echo.container.setPosition(input.x, input.y).setScale(input.facing, 1);
      let i = 0;
      for (const source of parts.values())
        echo.images[i++]
          .setPosition(source.x, source.y)
          .setRotation(source.rotation)
          .setDisplaySize(source.displayWidth, source.displayHeight)
          .setAlpha(source.alpha)
          .setMatrix(
            source.matrix?.a ?? Math.cos(source.rotation),
            source.matrix?.b ?? Math.sin(source.rotation),
            source.matrix?.c ?? -Math.sin(source.rotation),
            source.matrix?.d ?? Math.cos(source.rotation),
          );
    }
  }
  /** Redraw the frame's vector overlays: sword ribbon, ground shadow, dust
   *  motes, the optional skeleton, and the fading dash echoes. */
  render(input: ActorInput, trail: WeaponTrail, grip: WeaponGrip) {
    const state = this.state,
      { rig, world } = state;
    const g = this.trail;
    g.clear();
    if (!input.reduced)
      for (let n = 1; n < trail.history.length; n++) {
        const a = trail.history[n - 1],
          b = trail.history[n];
        const speed =
          Math.hypot(b.tip.x - a.tip.x, b.tip.y - a.tip.y) /
          Math.max(0.001, b.time - a.time);
        const force = clamp(speed / 900, 0.15, 1);
        const alpha = clamp(1 - (input.clock - b.time) / 0.13) * 0.34 * force;
        g.fillStyle(0xc9eee0, alpha);
        g.fillTriangle(a.tip.x, a.tip.y, b.tip.x, b.tip.y, b.base.x, b.base.y);
        g.fillTriangle(
          a.tip.x,
          a.tip.y,
          b.base.x,
          b.base.y,
          a.base.x,
          a.base.y,
        );
        g.lineStyle(0.7 + force * 1.5, 0xfff4ce, alpha * 2);
        g.lineBetween(a.tip.x, a.tip.y, b.tip.x, b.tip.y);
      }
    const a = this.accents;
    a.clear();
    if (input.grounded) {
      a.fillStyle(0x102d32, 0.22);
      a.fillEllipse(input.x, input.y + 2, rig.motion.shadowWidth, 5);
    }
    if (!input.reduced)
      for (const p of state.motes) {
        const t = (input.clock - p.time) / 0.35,
          scale = p.kind === "step" ? 1 : 2;
        a.lineStyle(1, 0xd6edc6, (1 - t) * 0.4);
        a.strokeEllipse(p.x, p.y, 8 + t * 24 * scale, 3 + t * 3);
        for (let i = 0; i < 3; i++) {
          a.fillStyle(0xe8edc4, (1 - t) * 0.55);
          a.fillCircle(
            p.x + (i - 1) * t * 12 * scale,
            p.y - Math.sin(t * Math.PI) * 8 * scale,
            1.2,
          );
        }
      }
    const d = this.debug;
    d.clear();
    if (this.showBones) {
      d.lineStyle(1, 0xffd988, 0.9);
      for (const b of rig.bones) {
        const p = state.toWorld(world[b.name]);
        if (b.parent) {
          const q = state.toWorld(world[b.parent]);
          d.lineBetween(p.x, p.y, q.x, q.y);
        }
        d.strokeCircle(p.x, p.y, 2);
      }
      state.feet.forEach((f, i) => {
        const p = state.toWorld(f),
          k = state.toWorld(state.knees[i]),
          h = state.toWorld(state.hips[i]);
        d.lineBetween(h.x, h.y, k.x, k.y);
        d.lineBetween(k.x, k.y, p.x, p.y);
        d.lineStyle(1, 0x90ffd5, 1);
        d.strokeCircle(p.x, p.y, 3);
        const c = state.contacts[i];
        if (c.planted) {
          d.fillStyle(0x90ffd5, 0.25 + c.weight * 0.6);
          d.fillCircle(c.x, c.y, 2 + c.weight * 3);
        }
      });
      if (rig.armed) {
        const target = state.toWorld(grip.target);
        d.lineStyle(1, 0xf9c1ff, 1);
        d.strokeCircle(target.x, target.y, 3);
      }
      d.lineStyle(1, 0xff9aab, 1);
      d.lineBetween(trail.base.x, trail.base.y, trail.tip.x, trail.tip.y);
    }
    for (const e of this.echoes)
      e.container
        .setVisible(
          input.visible !== false &&
            !input.reduced &&
            input.clock - e.born < 0.17,
        )
        .setAlpha(clamp(1 - (input.clock - e.born) / 0.17) * 0.18);
  }
}
