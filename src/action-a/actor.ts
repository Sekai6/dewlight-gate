import Phaser from "phaser";
import { CanvasPart, attachCanvasRig } from "./canvas";
import {
  AnimationLayer,
  PoseBuffer,
  FollowSpring,
  inertialOffset,
  clamp,
  solveIK,
  worldPose,
  type Pose,
  type WorldPose,
} from "./core.ts";
import { createRig, getClip, type Action, type ActorKind } from "./rigs";
import { ensureSkin } from "./skin";
import { combatMask, combatMotion, sampleWeapon } from "./combat-motion";
export interface ActorInput {
  combatPhase?: "anticipation" | "release" | "recovery";
  hitDirection?: number;
  x: number;
  y: number;
  clock: number;
  instance?: string | number;
  support?: { id: string | number; x: number; y: number };
  facing: number;
  action: Action;
  age: number;
  vx: number;
  vy?: number;
  grounded: boolean;
  reduced?: boolean;
  visible?: boolean;
  /** Grounded attacks keep the locomotion lower body. */
  moving?: boolean;
}
export interface Point {
  x: number;
  y: number;
}
interface Contact {
  x: number;
  y: number;
  planted: boolean;
  phase: number;
  cycle: number;
}
const upperMask = new Set([
  "root",
  "torso",
  "head",
  "arm",
  "fore",
  "weapon",
  "armBack",
  "foreBack",
]);
export class ActionActor {
  private weightedMask: Record<
    string,
    number | Partial<Record<import("./core").Channel, number>>
  > = {};
  private gripTarget = { x: 0, y: 0, rotation: 0 };
  private gripVelocity = { x: 0, y: 0, rotation: 0 };
  private gripCorrection = { x: 0, y: 0, rotation: 0 };
  private gripMomentum = { x: 0, y: 0, rotation: 0 };
  private gripAt = -999;
  private gripInstance: string | number | undefined;
  private gripReady = false;
  private gripActive = false;
  private gripAction: Action = "idle";
  private hand = { x: 0, y: 0 };
  private armLengths = { upper: 12, lower: 11 };
  private armError = 0;
  private swordSpeed = 0;
  readonly rig;
  readonly animator;
  readonly layers;
  private readonly composed: PoseBuffer;
  private landAt = -999;
  private landImpact = 0;
  private supportEnabled = true;
  private followEnabled = true;
  readonly container: Phaser.GameObjects.Container;
  readonly debug: Phaser.GameObjects.Graphics;
  private parts = new Map<string, CanvasPart>();
  private trail: Phaser.GameObjects.Graphics;
  private accents: Phaser.GameObjects.Graphics;
  private cape = new FollowSpring();
  private movement = new FollowSpring();
  private ornament = new FollowSpring();
  private last: ActorInput | null = null;
  private gait = 0;
  private contacts: Contact[] = [
    { x: 0, y: 0, planted: false, phase: 1, cycle: -1 },
    { x: 0, y: 0, planted: false, phase: 1, cycle: -1 },
  ];
  private history: { tip: Point; base: Point; time: number }[] = [];
  private trailPool = Array.from({ length: 24 }, () => ({
    tip: { x: 0, y: 0 },
    base: { x: 0, y: 0 },
    time: 0,
  }));
  private trailCursor = 0;
  private motes: { x: number; y: number; time: number; kind: string }[] = [];
  private epoch = 0;
  private world: WorldPose = {};
  private feet: Point[] = [];
  private knees: Point[] = [];
  private hips: Point[] = [];
  private weaponTip: Point = { x: 0, y: 0 };
  private weaponBase: Point = { x: 0, y: 0 };
  private showBones = false;
  private startAt = -999;
  private echoes: {
    container: Phaser.GameObjects.Container;
    images: CanvasPart[];
    born: number;
  }[] = [];
  private echoAt = -999;
  private stopAt = -999;
  private stopFeet: Point[] = [];
  private lastCombat: Action | undefined;
  private combatInstance: string | number | undefined;
  private lastReaction: Action = "hurt";
  private attack: { id: string | number; action: Action } | null = null;
  constructor(
    private scene: Phaser.Scene,
    readonly kind: ActorKind,
    depth = 6,
    echoesEnabled = true,
  ) {
    this.rig = createRig(kind);
    this.layers = {
      locomotion: new AnimationLayer("locomotion", this.rig.bones),
      combat: new AnimationLayer("combat", this.rig.bones),
      reaction: new AnimationLayer("reaction", this.rig.bones),
    };
    this.animator = this.layers.locomotion.animator;
    this.composed = new PoseBuffer(this.rig.bones);
    ensureSkin(scene);
    this.container = scene.add.container(0, 0).setDepth(depth);
    attachCanvasRig(
      this.container,
      () => this.parts.values(),
      kind === "guardian" ? 256 : 128,
    );
    this.trail = scene.add.graphics().setDepth(depth + 0.15);
    this.accents = scene.add.graphics().setDepth(depth - 0.1);
    this.debug = scene.add.graphics().setDepth(depth + 1);
    const add = (
      name: string,
      frame: string,
      w: number,
      h: number,
      originY = 0.5,
    ) => {
      const image = new CanvasPart(scene.textures.getFrame("action-a", frame))
        .setDisplaySize(w, h)
        .setOrigin(0.5, originY);
      this.parts.set(name, image);

      return image;
    };
    // Fixed ordering; no display objects or textures are created while animating.
    for (const s of this.rig.skin.filter((s) => (s.depth ?? 0) < 0))
      add(s.bone, s.texture, s.width, s.height, s.originY);
    for (let i = 0; i < 2; i++) {
      add(`thigh${i}`, "leg", kind === "guardian" ? 15 : 7, this.rig.leg * 1.3);
      add(`shin${i}`, "limb", kind === "guardian" ? 12 : 6, this.rig.leg * 1.3);
      add(
        `knee${i}`,
        "joint",
        kind === "guardian" ? 18 : 8,
        kind === "guardian" ? 18 : 8,
      );
      add(
        `ankle${i}`,
        "joint",
        kind === "guardian" ? 14 : 7,
        kind === "guardian" ? 14 : 7,
      );
      add(
        `foot${i}`,
        "boot",
        kind === "guardian" ? 29 : kind === "hero" ? 14 : 16,
        kind === "guardian" ? 17 : 10,
        0.82,
      );
    }
    for (const s of this.rig.skin
      .filter((s) => (s.depth ?? 0) >= 0)
      .sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0)))
      add(s.bone, s.texture, s.width, s.height, s.originY);
    if (kind === "hero" && echoesEnabled)
      for (let i = 0; i < 2; i++) {
        const container = scene.add
          .container(0, 0)
          .setDepth(depth - 0.2)
          .setVisible(false);
        const images = [...this.parts.values()].map((source) => {
          const image = new CanvasPart(source.frame)
            .setOrigin(source.originX, source.originY)
            .setTint(0xb9e5d4);

          return image;
        });
        attachCanvasRig(container, () => images);
        this.echoes.push({ container, images, born: -999 });
      }
  }
  reset() {
    this.gripReady = false;
    this.gripActive = false;
    this.gripAction = "idle";
    this.hand.x = this.hand.y = 0;
    this.gripCorrection.x =
      this.gripCorrection.y =
      this.gripCorrection.rotation =
        0;
    this.gripMomentum.x = this.gripMomentum.y = this.gripMomentum.rotation = 0;
    this.gripAt = -999;
    this.gripInstance = undefined;
    this.armError = this.swordSpeed = 0;
    Object.values(this.layers).forEach((layer) => layer.reset());
    this.landAt = -999;
    this.landImpact = 0;
    this.attack = null;
    this.lastCombat = undefined;
    this.combatInstance = undefined;
    this.stopFeet = [];
    this.stopAt = -999;
    this.cape.reset();
    this.movement.reset();
    this.ornament.reset();
    this.last = null;
    this.feet = [];
    this.knees = [];
    this.hips = [];
    this.world = {};
    this.weaponTip = { x: 0, y: 0 };
    this.weaponBase = { x: 0, y: 0 };
    this.gait = 0;
    this.history = [];
    this.motes = [];
    this.epoch++;
    this.contacts.forEach((c) => {
      c.planted = false;
      c.phase = 1;
      c.cycle = -1;
    });
    this.startAt = -999;
    this.echoAt = -999;
    this.echoes.forEach((e) => {
      e.born = -999;
      e.container.setVisible(false);
    });
  }
  setLayerEnabled(name: string, enabled: boolean) {
    if (name === "support") this.supportEnabled = enabled;
    else if (name === "follow") this.followEnabled = enabled;
    else if (name in this.layers)
      this.layers[name as keyof typeof this.layers].enabled = enabled;
  }
  setDebug(value: boolean) {
    this.showBones = value;
  }
  setVisible(value: boolean) {
    this.container.setVisible(value);
    this.trail.setVisible(value);
    this.accents.setVisible(value);
    this.debug.setVisible(value && this.showBones);
    if (!value) this.echoes.forEach((e) => e.container.setVisible(false));
  }
  /** Read-only diagnostics for development tooling and geometric acceptance tests. */
  snapshot() {
    return {
      kind: this.kind,
      action: this.last?.action,
      clock: this.last?.clock,
      epoch: this.epoch,
      gait: this.gait,
      blendWeight:
        this.layers.reaction.weight > 0
          ? this.layers.reaction.animator.blendWeight
          : this.layers.combat.weight > 0
            ? this.layers.combat.animator.blendWeight
            : this.animator.blendWeight,
      layers: Object.values(this.layers).map((layer) => ({
        name: layer.name,
        enabled: layer.enabled,
        weight: layer.weight,
        age: layer.age,
        blend: layer.animator.blendWeight,
      })),
      supportEnabled: this.supportEnabled,
      armError: this.armError,
      hand: this.last ? this.toWorld(this.hand) : { ...this.hand },
      armLengths: { ...this.armLengths },
      swordSpeed: this.swordSpeed,
      gripTarget: { ...this.gripTarget },
      boneWeights: { ...this.weightedMask },
      trailSamples: this.history.length,
      followEnabled: this.followEnabled,
      instance: this.last?.instance,
      stage: !this.last
        ? "idle"
        : ["windup", "slam-warn"].includes(this.last.action)
          ? "anticipation"
          : ["strike", "slam", "dash"].includes(this.last.action)
            ? "release"
            : this.last.action === "hurt"
              ? "impact"
              : ["slash", "rising-slash", "air-slash"].includes(
                    this.last.action,
                  )
                ? this.last.age < 0.065
                  ? "anticipation"
                  : this.last.age < 0.16
                    ? "release"
                    : "recovery"
                : this.last.action,
      feet: this.feet.map((p) => this.toWorld(p)),
      contacts: this.contacts.map((c) => ({ ...c })),
      weaponTip: { ...this.weaponTip },
      weaponBase: { ...this.weaponBase },
      bones: structuredClone(this.world),
      parts: this.parts.size,
      hips: this.hips.map((p) => ({ ...p })),
      extent: this.kind === "guardian" ? 256 : 128,
      corners: [...this.parts.values()].flatMap((p) =>
        [0, 1].flatMap((x) =>
          [0, 1].map((y) => {
            const dx = (x - p.originX) * p.displayWidth,
              dy = (y - p.originY) * p.displayHeight;
            return {
              x:
                p.x +
                (p.matrix?.a ?? Math.cos(p.rotation)) * dx +
                (p.matrix?.c ?? -Math.sin(p.rotation)) * dy,
              y:
                p.y +
                (p.matrix?.b ?? Math.sin(p.rotation)) * dx +
                (p.matrix?.d ?? Math.cos(p.rotation)) * dy,
            };
          }),
        ),
      ),
    };
  }
  private toWorld(p: Point): Point {
    const a = this.last!;
    return { x: a.x + p.x * a.facing, y: a.y + p.y };
  }
  draw(input: ActorInput) {
    this.setVisible(input.visible !== false);
    if (input.visible === false) return;
    if (
      this.last &&
      (input.clock < this.last.clock ||
        Math.hypot(input.x - this.last.x, input.y - this.last.y) > 180)
    )
      this.reset();
    if (
      input.instance !== undefined &&
      ["slash", "rising-slash", "air-slash"].includes(input.action)
    ) {
      if (this.attack?.id !== input.instance)
        this.attack = {
          id: input.instance,
          action: input.grounded ? input.action : "air-slash",
        };
      input = { ...input, action: this.attack.action };
    }
    const previous = this.last;
    const dt = previous ? clamp(input.clock - previous.clock, 0, 0.25) : 0;
    const changed = !previous || input.clock !== previous.clock;
    if (changed) {
      const supportDx =
        previous?.support && input.support?.id === previous.support.id
          ? input.support.x - previous.support.x
          : 0;
      const distance =
        previous &&
        previous.grounded &&
        input.grounded &&
        !["dash", "hurt", "defeat"].includes(input.action)
          ? Math.abs(input.x - previous.x - supportDx)
          : 0;
      this.gait += distance / this.rig.stride;
      if (
        previous &&
        input.support &&
        previous.support?.id === input.support.id
      )
        this.contacts.forEach((c) => {
          c.x += supportDx;
          c.y += input.support!.y - previous.support!.y;
        });
      if (this.kind !== "hero" && previous && dt > 0)
        input = { ...input, vx: (input.x - previous.x) / dt };
      this.last = {
        ...input,
        support: input.support ? { ...input.support } : undefined,
      };
      if (Math.abs(input.vx) > 5 && (!previous || Math.abs(previous.vx) <= 5))
        this.startAt = input.clock;
      if (previous && !previous.grounded && input.grounded) {
        this.landAt = input.clock;
        this.landImpact = clamp(Math.abs(previous.vy ?? 250) / 650, 0.2, 1);
        this.motes.push({
          x: input.x,
          y: input.y,
          time: input.clock,
          kind: "land",
        });
      }
      const combatActions: Action[] = [
        "slash",
        "rising-slash",
        "air-slash",
        "bind",
        "dash",
        "windup",
        "strike",
        "recover",
        "slam-warn",
        "slam",
      ];
      const reacting = ["hurt", "defeat", "bound"].includes(input.action);
      const fighting = !reacting && combatActions.includes(input.action);
      const baseAction: Action = [
        "launch",
        "land",
        "turn",
        "brake",
        "start",
      ].includes(input.action)
        ? input.action
        : !input.grounded
          ? (input.vy ?? 0) < -80
            ? "rise"
            : (input.vy ?? 0) > 80
              ? "fall"
              : "apex"
          : Math.abs(input.vx) > 5
            ? Math.abs(input.vx) > 180
              ? "run"
              : "walk"
            : "idle";
      const baseAge = ["walk", "run"].includes(baseAction)
        ? this.gait
        : baseAction === input.action
          ? input.age
          : input.clock;
      const baseResult = this.layers.locomotion.evaluate(
        getClip(this.rig, baseAction),
        baseAge,
        input.clock,
      );
      this.layers.locomotion.weight = 1;
      const pose = this.composed.copy(baseResult.pose);
      if (!this.layers.locomotion.enabled) this.composed.rest();
      const speedTarget = input.grounded
        ? clamp(Math.abs(input.vx) / (this.kind === "guardian" ? 460 : 264))
        : 0;
      if (!previous) this.movement.reset(speedTarget);
      const speedWeight = this.movement.update(speedTarget, dt, 20);
      const moving = input.grounded && Math.abs(input.vx) > 5;
      const cycle = this.gait * Math.PI * 2;
      if (
        this.layers.locomotion.enabled &&
        (baseAction === "walk" || baseAction === "run" || baseAction === "idle")
      ) {
        const amount = speedWeight;
        pose.hip.y -= moving
          ? Math.abs(Math.sin(cycle)) * this.rig.bob
          : Math.sin(input.clock * 2.5) * 0.65;
        pose.hip.x += Math.sin(cycle) * amount * this.rig.sway;
        pose.torso.rotation +=
          amount * this.rig.lean + Math.sin(cycle) * amount * 0.065;
        pose.head.rotation -= amount * 0.12;
        pose.arm.rotation += Math.sin(cycle) * amount * 0.85;
        pose.armBack.rotation -= Math.sin(cycle) * amount * 0.85;
        pose.fore.rotation -= amount * 0.3;
        if (input.clock - this.startAt < 0.16) {
          const push = Math.sin(
            ((input.clock - this.startAt) / 0.16) * Math.PI,
          );
          pose.torso.rotation += push * 0.2;
          pose.hip.y += push * 3;
        }
      }
      const events = [...baseResult.events];
      const combat = this.layers.combat;
      const reaction = this.layers.reaction;
      if (fighting) {
        const result = combat.evaluate(
          getClip(this.rig, input.action),
          input.age,
          input.clock,
          input.instance,
        );
        events.push(...result.events);
        combat.weight = Math.min(
          1,
          combat.weight + (previous ? dt / 0.025 : 1),
        );
      } else if (combat.weight > 0 && !reacting) {
        // The inactive combat player finishes recovery independently of the base gait.
        const action =
          previous && combatActions.includes(previous.action)
            ? previous.action
            : this.lastCombat;
        if (action)
          combat.evaluate(
            getClip(this.rig, action),
            combat.age + dt,
            input.clock,
            this.combatInstance,
          );
        combat.weight = Math.max(0, combat.weight - dt / 0.1);
      }
      if (fighting) {
        this.lastCombat = input.action;
        this.combatInstance = input.instance;
      }
      if (reacting) {
        combat.weight = 0;
        const result = reaction.evaluate(
          getClip(this.rig, input.action),
          input.age,
          input.clock,
          input.instance,
        );
        events.push(...result.events);
        reaction.weight = Math.min(
          1,
          reaction.weight + (previous ? dt / 0.015 : 1),
        );
        this.lastReaction = input.action;
      } else if (reaction.weight > 0) {
        reaction.evaluate(
          getClip(this.rig, this.lastReaction),
          reaction.age + dt,
          input.clock,
        );
        reaction.weight = Math.max(0, reaction.weight - dt / 0.12);
      }
      const maskedCombat =
        this.kind === "hero" &&
        input.grounded &&
        moving &&
        ["slash", "rising-slash", "air-slash", "bind"].includes(
          this.lastCombat ?? "",
        );
      combat.apply(
        pose,
        combat.weight,
        this.kind === "hero" && combatMotion(this.lastCombat ?? "idle")
          ? combatMask(combat.age, maskedCombat, this.weightedMask)
          : maskedCombat
            ? upperMask
            : undefined,
      );
      reaction.apply(
        pose,
        reaction.weight,
        undefined,
        this.lastReaction === "hurt" ? "additive" : "override",
      );
      if (input.action === "hurt" && input.hitDirection !== undefined) {
        pose.torso.rotation *= -Math.sign(
          input.hitDirection * input.facing || -1,
        );
        pose.hip.x *= -Math.sign(input.hitDirection * input.facing || -1);
      }
      const land =
        Math.sin(clamp((input.clock - this.landAt) / 0.22) * Math.PI) *
        this.landImpact;
      if (!reacting && this.layers.locomotion.enabled) {
        pose.hip.y += land * (this.kind === "guardian" ? 8 : 5);
        pose.torso.scaleY *= 1 - land * 0.12;
        pose.torso.scaleX *= 1 + land * 0.08;
      }
      // Body expression stays readable even with decorative motion disabled.
      for (const b of ["hip", "torso", "head"]) {
        pose[b].scaleX = clamp(pose[b].scaleX, 0.85, 1.15);
        pose[b].scaleY = clamp(pose[b].scaleY, 0.85, 1.15);
      }
      this.world = worldPose(this.rig.bones, pose, this.world);
      // The grip follows the affine wrist, while the blade remains rigid.
      const sword = this.world.weapon;
      sword.a = Math.cos(sword.rotation);
      sword.b = Math.sin(sword.rotation);
      sword.c = -sword.b;
      sword.d = sword.a;
      sword.scaleX = sword.scaleY = 1;
      this.solveFeet(input, previous);
      this.solveWeapon(input, dt);
      this.applyFollow(pose, input, dt);
      this.submitPose();
      this.container.setPosition(input.x, input.y).setScale(input.facing, 1);
      if (
        input.action === "dash" &&
        !input.reduced &&
        input.clock - this.echoAt > 0.045 &&
        this.echoes.length
      ) {
        const echo = this.echoes.reduce((a, b) => (a.born < b.born ? a : b));
        echo.born = input.clock;
        this.echoAt = input.clock;
        echo.container.setPosition(input.x, input.y).setScale(input.facing, 1);
        [...this.parts.values()].forEach((source, i) =>
          echo.images[i]
            .setPosition(source.x, source.y)
            .setRotation(source.rotation)
            .setDisplaySize(source.displayWidth, source.displayHeight)
            .setAlpha(source.alpha)
            .setMatrix(
              source.matrix?.a ?? Math.cos(source.rotation),
              source.matrix?.b ?? Math.sin(source.rotation),
              source.matrix?.c ?? -Math.sin(source.rotation),
              source.matrix?.d ?? Math.cos(source.rotation),
            ),
        );
      }
      const w = this.world.weapon;
      // The sword texture's grip sits at .76 of its frame; sample the actual blade axis.
      this.weaponBase = this.toWorld({ x: w.x, y: w.y });
      const blade = this.parts.get("weapon");
      const bladeLength = blade
        ? blade.displayHeight * (blade.originY - 3 / blade.frame.cutHeight)
        : 37;
      this.weaponTip = this.toWorld({
        x: w.x - w.c * bladeLength,
        y: w.y - w.d * bladeLength,
      });
      this.swordSpeed =
        previous && dt > 0
          ? Math.hypot(
              this.weaponTip.x -
                (this.history.at(-1)?.tip.x ?? this.weaponTip.x),
              this.weaponTip.y -
                (this.history.at(-1)?.tip.y ?? this.weaponTip.y),
            ) / dt
          : 0;
      if (
        previous &&
        (previous.instance !== input.instance ||
          previous.action !== input.action ||
          dt > 0.065 ||
          reacting)
      )
        this.history.length = 0;
      const attacking =
        ["slash", "rising-slash", "air-slash"].includes(input.action) &&
        input.age >= 0.06 &&
        input.age < 0.24;
      if (this.kind === "hero" && attacking) {
        const last = this.history.at(-1);
        if (last && dt > 1 / 45 && dt <= 0.065) {
          const angle0 = Math.atan2(
              last.tip.y - last.base.y,
              last.tip.x - last.base.x,
            ),
            angle1 = Math.atan2(
              this.weaponTip.y - this.weaponBase.y,
              this.weaponTip.x - this.weaponBase.x,
            );
          const turn = Math.atan2(
            Math.sin(angle1 - angle0),
            Math.cos(angle1 - angle0),
          );
          const count = Math.min(3, Math.ceil(Math.abs(turn) / 0.3));
          const length = Math.hypot(
            this.weaponTip.x - this.weaponBase.x,
            this.weaponTip.y - this.weaponBase.y,
          );
          for (let i = 1; i < count; i++) {
            const u = i / count,
              p = this.trailPool[this.trailCursor++ % 24];
            p.base.x = last.base.x + (this.weaponBase.x - last.base.x) * u;
            p.base.y = last.base.y + (this.weaponBase.y - last.base.y) * u;
            p.tip.x = p.base.x + Math.cos(angle0 + turn * u) * length;
            p.tip.y = p.base.y + Math.sin(angle0 + turn * u) * length;
            p.time = last.time + (input.clock - last.time) * u;
            this.history.push(p);
          }
        }
        const p = this.trailPool[this.trailCursor++ % 24];
        p.tip.x = this.weaponTip.x;
        p.tip.y = this.weaponTip.y;
        p.base.x = this.weaponBase.x;
        p.base.y = this.weaponBase.y;
        p.time = input.clock;
        this.history.push(p);
        if (this.history.length > 20) this.history.shift();
      }
      while (this.history.length && input.clock - this.history[0].time >= 0.13)
        this.history.shift();
      for (const event of events)
        if (event === "land" || event === "impact")
          this.motes.push({
            x: input.x,
            y: input.y,
            time: input.clock,
            kind: event,
          });
      this.motes = this.motes
        .filter((p) => input.clock - p.time < 0.35)
        .slice(-10);
    }
    this.renderAccents(input);
    this.echoes.forEach((e) =>
      e.container
        .setVisible(
          input.visible !== false &&
            !input.reduced &&
            input.clock - e.born < 0.17,
        )
        .setAlpha(clamp(1 - (input.clock - e.born) / 0.17) * 0.18),
    );
  }
  private submitPose() {
    for (const skin of this.rig.skin) {
      const t = this.world[skin.bone];
      this.parts
        .get(skin.bone)!
        .setPosition(t.x, t.y)
        .setDisplaySize(skin.width, skin.height)
        .setAlpha(t.alpha)
        .setMatrix(t.a, t.b, t.c, t.d);
    }
  }
  private solveWeapon(input: ActorInput, dt: number) {
    if (this.kind !== "hero") return;
    const motion = combatMotion(input.action);
    const shoulder = this.world.arm,
      elbow = this.world.fore,
      wrist = this.world.weapon;
    const oldX = this.gripTarget.x,
      oldY = this.gripTarget.y,
      oldR = this.gripTarget.rotation;
    const active =
      motion && this.layers.combat.enabled && this.layers.combat.weight > 0;
    if (active) {
      sampleWeapon(motion, input.age, this.gripTarget);
      this.gripTarget.x += shoulder.x;
      this.gripTarget.y += shoulder.y;
      if (
        this.gripReady &&
        (this.gripInstance !== input.instance ||
          this.gripAction !== input.action)
      ) {
        this.gripCorrection.x = oldX - this.gripTarget.x;
        this.gripCorrection.y = oldY - this.gripTarget.y;
        this.gripCorrection.rotation = oldR - this.gripTarget.rotation;
        this.gripMomentum.x = this.gripVelocity.x;
        this.gripMomentum.y = this.gripVelocity.y;
        this.gripMomentum.rotation = this.gripVelocity.rotation;
        this.gripAt = input.clock;
      }
      for (const c of ["x", "y", "rotation"] as const)
        this.gripTarget[c] += inertialOffset(
          this.gripCorrection[c],
          this.gripMomentum[c],
          input.clock - this.gripAt,
          0.045,
        );
    } else {
      this.gripTarget.x = wrist.x;
      this.gripTarget.y = wrist.y;
      this.gripTarget.rotation = wrist.rotation;
      if (this.gripActive && this.gripReady) {
        this.gripCorrection.x = oldX - wrist.x;
        this.gripCorrection.y = oldY - wrist.y;
        this.gripCorrection.rotation = oldR - wrist.rotation;
        this.gripMomentum.x = this.gripVelocity.x;
        this.gripMomentum.y = this.gripVelocity.y;
        this.gripMomentum.rotation = this.gripVelocity.rotation;
        this.gripAt = input.clock;
      }
      for (const c of ["x", "y", "rotation"] as const)
        this.gripTarget[c] += inertialOffset(
          this.gripCorrection[c],
          this.gripMomentum[c],
          input.clock - this.gripAt,
          0.045,
        );
    }
    const ik = solveIK(
      shoulder.x,
      shoulder.y,
      this.gripTarget.x,
      this.gripTarget.y,
      12,
      11,
      -1,
    );
    const aim = (
      t: typeof shoulder,
      x: number,
      y: number,
      tx: number,
      ty: number,
    ) => {
      const r = Math.atan2(ty - y, tx - x) - Math.PI / 2;
      t.x = x;
      t.y = y;
      t.rotation = r;
      t.a = Math.cos(r);
      t.b = Math.sin(r);
      t.c = -t.b;
      t.d = t.a;
      t.scaleX = t.scaleY = 1;
    };
    aim(shoulder, shoulder.x, shoulder.y, ik.knee.x, ik.knee.y);
    aim(elbow, ik.knee.x, ik.knee.y, ik.foot.x, ik.foot.y);
    wrist.x = ik.foot.x;
    wrist.y = ik.foot.y;
    wrist.rotation = this.gripTarget.rotation;
    this.hand.x = ik.foot.x;
    this.hand.y = ik.foot.y;
    wrist.a = Math.cos(wrist.rotation);
    wrist.b = Math.sin(wrist.rotation);
    wrist.c = -wrist.b;
    wrist.d = wrist.a;
    for (const [name, parent] of [
      ["shoulderFront", shoulder],
      ["elbowFront", elbow],
    ] as const)
      Object.assign(this.world[name], parent);
    this.armError = Math.hypot(
      wrist.x - (elbow.x + elbow.c * 11),
      wrist.y - (elbow.y + elbow.d * 11),
    );
    if (dt > 0 && this.gripReady) {
      this.gripVelocity.x = (wrist.x - oldX) / dt;
      this.gripVelocity.y = (wrist.y - oldY) / dt;
      this.gripVelocity.rotation = (wrist.rotation - oldR) / dt;
    }
    this.gripTarget.x = wrist.x;
    this.gripTarget.y = wrist.y;
    this.gripInstance = input.instance;
    this.gripAction = input.action;
    this.gripActive = !!active;
    this.gripReady = true;
  }
  private applyFollow(pose: Pose, input: ActorInput, dt: number) {
    const weight = this.followEnabled && !input.reduced ? 1 : 0;
    const target =
      clamp((input.vx * input.facing) / 300, -1.4, 1.4) * 0.8 -
      pose.torso.rotation * 0.85;
    const cape = this.cape.update(
      target,
      dt,
      this.kind === "guardian" ? 8 : 13,
    );
    const crown = this.ornament.update(
      -pose.torso.rotation * 0.9 + Math.sin(input.clock * 3) * 0.05,
      dt,
      this.kind === "guardian" ? 7 : 11,
    );
    const rotate = (bone: string, angle: number) => {
      const t = this.world[bone];
      if (!t) return;
      const c = Math.cos(angle),
        s = Math.sin(angle),
        a = t.a,
        b = t.b,
        x = t.c,
        d = t.d;
      t.a = c * a - s * b;
      t.b = s * a + c * b;
      t.c = c * x - s * d;
      t.d = s * x + c * d;
      t.rotation += angle;
    };
    rotate("cape", cape * weight);
    rotate("crown", crown * weight);
    rotate("lamp", -cape * 0.7 * weight);
    if (this.kind === "moth") {
      const flap = Math.sin(input.clock * 13);
      // Wing folding is authored in combat clips; flap is a separate additive motion.
      for (const [name, sign] of [
        ["wingBack", 1],
        ["wingFront", -1],
      ] as const)
        rotate(name, flap * 0.32 * sign * (input.reduced ? 0.2 : 1));
    }
  }
  private solveFeet(input: ActorInput, previous: ActorInput | null) {
    if (
      previous &&
      Math.abs(previous.vx) > 5 &&
      Math.abs(input.vx) <= 5 &&
      input.grounded
    ) {
      this.stopAt = input.clock;
      this.stopFeet = this.feet.map((p) => ({
        x: previous.x + p.x * previous.facing,
        y: previous.y + p.y,
      }));
    }
    const oldFeet = previous
      ? this.feet.map((p) => ({
          x: previous.x + p.x * previous.facing,
          y: previous.y + p.y,
        }))
      : [];
    this.feet = [];
    this.knees = [];
    this.hips = [];
    const mobile =
      input.grounded &&
      Math.abs(input.vx) > 5 &&
      !["dash", "hurt", "defeat", "bound"].includes(input.action);
    const planted =
      input.grounded &&
      !["dash", "defeat"].includes(input.action) &&
      this.kind !== "moth" &&
      this.supportEnabled;
    const span = (this.rig.stride * this.rig.stance) / 2;
    const targets: { x: number; y: number; stance: boolean }[] = [];
    for (let i = 0; i < 2; i++) {
      const sign = i ? 1 : -1,
        phase = (this.gait + i * 0.5) % 1;
      const cycle = Math.floor(this.gait + i * 0.5);
      const contact = this.contacts[i];
      let localX = sign * this.rig.footSpan,
        localY = 0;
      let stance = !mobile || phase < this.rig.stance;
      const stoppedSwing =
        !mobile &&
        planted &&
        previous?.grounded &&
        !contact.planted &&
        input.clock - this.stopAt < 0.08 + (input.clock - previous.clock);
      // A swing foot settles over 80ms rather than snapping to its neutral target.
      if (stoppedSwing && this.stopFeet[i]) {
        const u = clamp((input.clock - this.stopAt) / 0.08);
        localX = (this.stopFeet[i].x - input.x) * input.facing;
        localY = (this.stopFeet[i].y - input.y) * (1 - u);
        stance = u >= 1;
      }
      if (mobile) {
        if (stance) localX += span * (1 - (2 * phase) / this.rig.stance);
        else {
          const u = (phase - this.rig.stance) / (1 - this.rig.stance);
          localX += -span + 2 * span * (u * u * (3 - 2 * u));
          localY = -Math.sin(u * Math.PI) * (input.action === "walk" ? 6 : 12);
        }
      } else if (!input.grounded || this.kind === "moth") {
        localX = (input.vy ?? 0) < 0 ? sign * 10 : sign * 8;
        const rise = clamp((-(input.vy ?? 0) + 100) / 350);
        localX = sign * (8 + rise * 3);
        localY = -4 - rise * (i ? 3 : 8);
        if (input.action === "air-slash") {
          const tuck = Math.sin(clamp(input.age / 0.38) * Math.PI);
          localX += (i ? -9 : 6) * tuck;
          localY -= (i ? 4 : 9) * tuck;
        }
      }
      if (input.action === "defeat") {
        const r = this.world.root.rotation,
          px = localX,
          py = localY;
        localX = this.world.root.x + Math.cos(r) * px - Math.sin(r) * py;
        localY = this.world.root.y + Math.sin(r) * px + Math.cos(r) * py;
      }
      if (planted && stance) {
        if (
          !contact.planted ||
          cycle !== contact.cycle ||
          phase < contact.phase ||
          (previous &&
            (!input.support || input.support.id !== previous.support?.id) &&
            Math.abs(previous.y - input.y) > 2)
        ) {
          contact.x = input.x + localX * input.facing;
          contact.y = input.y;
          if (mobile)
            this.motes.push({
              x: contact.x,
              y: contact.y,
              time: input.clock,
              kind: "step",
            });
        }
        contact.planted = true;
        localX = (contact.x - input.x) * input.facing;
        localY = contact.y - input.y;
      } else {
        contact.planted = false;
        if (oldFeet[i] && previous) {
          const target = {
            x: input.x + localX * input.facing,
            y: input.y + localY,
          };
          const dx = target.x - oldFeet[i].x,
            dy = target.y - oldFeet[i].y;
          const weight = Math.min(
            1,
            (Math.max(0, input.clock - previous.clock) * 900) /
              Math.max(0.001, Math.hypot(dx, dy)),
          );
          localX = (oldFeet[i].x + dx * weight - input.x) * input.facing;
          localY = oldFeet[i].y + dy * weight - input.y;
        }
      }
      contact.phase = phase;
      contact.cycle = cycle;
      targets.push({ x: localX, y: localY, stance });
    }
    let pelvis = 0;
    for (let i = 0; i < 2; i++) {
      const hx = this.world.hip.x + (i ? 1 : -1) * this.rig.footSpan * 0.6;
      const dx = targets[i].x - hx;
      if (planted)
        pelvis = Math.max(
          pelvis,
          targets[i].y -
            Math.sqrt(Math.max(1, (this.rig.leg * 2 - 0.05) ** 2 - dx * dx)) -
            this.world.hip.y,
        );
    }
    // Translate the complete hip subtree together, never an isolated IK origin.
    for (const [name, t] of Object.entries(this.world))
      if (name !== "root") t.y += pelvis;
    for (let i = 0; i < 2; i++) {
      const { x: localX, y: localY, stance } = targets[i];
      const sign = i ? 1 : -1;
      const hip = this.world.hip;
      const hx = hip.x + sign * this.rig.footSpan * 0.6,
        hy = hip.y;
      const adjustedY = hy;
      const ik = solveIK(
        hx,
        adjustedY,
        localX,
        localY,
        this.rig.leg,
        this.rig.leg,
        this.rig.knees[i],
      );
      this.hips.push({ x: hx, y: adjustedY });
      this.knees.push(ik.knee);
      this.feet.push(ik.foot);
      const segment = (key: string, a: Point, b: Point) =>
        this.parts
          .get(key)!
          .setPosition((a.x + b.x) / 2, (a.y + b.y) / 2)
          .setRotation(Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2)
          .setDisplaySize(
            this.kind === "guardian" ? 15 : 7,
            Math.hypot(b.x - a.x, b.y - a.y) * 1.3,
          )
          .setAlpha(this.world.root.alpha);
      segment(`thigh${i}`, this.hips[i], ik.knee);
      segment(`shin${i}`, ik.knee, ik.foot);
      this.parts
        .get(`knee${i}`)!
        .setPosition(ik.knee.x, ik.knee.y)
        .setAlpha(this.world.root.alpha);
      this.parts
        .get(`ankle${i}`)!
        .setPosition(ik.foot.x, ik.foot.y - 2)
        .setAlpha(this.world.root.alpha);
      this.parts
        .get(`foot${i}`)!
        .setPosition(ik.foot.x, ik.foot.y)
        .setRotation(
          stance
            ? mobile
              ? clamp((this.contacts[i].phase / this.rig.stance - 0.7) / 0.3) *
                0.2
              : 0
            : -0.35,
        )
        .setAlpha(this.world.root.alpha);
    }
  }
  private renderAccents(input: ActorInput) {
    const g = this.trail;
    g.clear();
    if (!input.reduced)
      for (let n = 1; n < this.history.length; n++) {
        const a = this.history[n - 1],
          b = this.history[n];
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
      a.fillEllipse(
        input.x,
        input.y + 2,
        this.kind === "guardian" ? 100 : 32,
        5,
      );
    }
    if (!input.reduced)
      for (const p of this.motes) {
        const age = input.clock - p.time,
          t = age / 0.35,
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
      for (const b of this.rig.bones) {
        const p = this.toWorld(this.world[b.name]);
        if (b.parent) {
          const q = this.toWorld(this.world[b.parent]);
          d.lineBetween(p.x, p.y, q.x, q.y);
        }
        d.strokeCircle(p.x, p.y, 2);
      }
      this.feet.forEach((f, i) => {
        const p = this.toWorld(f),
          k = this.toWorld(this.knees[i]),
          h = this.toWorld(this.hips[i]);
        d.lineBetween(h.x, h.y, k.x, k.y);
        d.lineBetween(k.x, k.y, p.x, p.y);
        d.lineStyle(1, 0x90ffd5, 1);
        d.strokeCircle(p.x, p.y, 3);
      });
      d.lineStyle(1, 0xff9aab, 1);
      d.lineBetween(
        this.weaponBase.x,
        this.weaponBase.y,
        this.weaponTip.x,
        this.weaponTip.y,
      );
    }
  }
}
