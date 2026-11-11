import type Phaser from "phaser";
import { ATTACKS, GAIT_FROZEN, actionStage, type Action } from "./actions.ts";
import { rigidify } from "./affine.ts";
import { approach } from "./balance.ts";
import { clamp, worldPose } from "./core.ts";
import { createRig, type ActorKind } from "./rigs";
import { braceHand } from "./stages/brace.ts";
import { PoseComposer } from "./stages/compose.ts";
import { DollStage } from "./stages/doll.ts";
import { BodyExpression } from "./stages/express.ts";
import { FollowStage } from "./stages/follow.ts";
import { WeaponGrip } from "./stages/grip.ts";
import { solveLegs } from "./stages/legs.ts";
import { ActorState, type ActorInput } from "./stages/state.ts";
import { WeaponTrail } from "./stages/trail.ts";
import { ActorView } from "./stages/view.ts";

export type { ActorInput, Point } from "./stages/state.ts";

/** One animated character. `draw` runs the pipeline once per simulation tick:
 *
 *    compose → express → skeleton → legs → grip | doll → brace → follow
 *     → view → trail
 *
 *  Each stage lives in ./stages and reads/writes the shared ActorState. */
export class ActionActor {
  readonly rig;
  readonly layers;
  readonly animator;
  readonly container: Phaser.GameObjects.Container;
  readonly debug: Phaser.GameObjects.Graphics;
  private state: ActorState;
  private composer: PoseComposer;
  private expression: BodyExpression;
  private grip: WeaponGrip;
  private doll: DollStage;
  private follow: FollowStage;
  private blade: WeaponTrail;
  private view: ActorView;
  private epoch = 0;
  /** A combo keeps the swing it started with until its instance changes. */
  private attack: { id: string | number; action: Action } | null = null;
  constructor(
    scene: Phaser.Scene,
    readonly kind: ActorKind,
    depth = 6,
    echoesEnabled = true,
  ) {
    this.rig = createRig(kind);
    const state = (this.state = new ActorState(this.rig));
    this.layers = state.layers;
    this.animator = state.layers.locomotion.animator;
    this.composer = new PoseComposer(state);
    this.expression = new BodyExpression(state);
    this.grip = new WeaponGrip(state);
    this.doll = new DollStage(state, this.grip);
    this.follow = new FollowStage(state);
    this.blade = new WeaponTrail(state);
    this.view = new ActorView(
      scene,
      state,
      depth,
      this.rig.armed && echoesEnabled,
    );
    this.container = this.view.container;
    this.debug = this.view.debug;
  }
  setModuleEnabled(name: "contact" | "impulse" | "intent", enabled: boolean) {
    if (name === "contact") this.state.contactEnabled = enabled;
    if (name === "impulse") {
      this.expression.impulseEnabled = enabled;
      if (!enabled) this.expression.impulse.reset();
    }
    if (name === "intent") {
      this.expression.intentEnabled = enabled;
      if (!enabled) this.expression.intent.reset();
    }
  }
  setRecoveryEnabled(enabled: boolean) {
    this.state.recoveryEnabled = enabled;
    if (!enabled) this.state.recovery.reset();
  }
  setLayerEnabled(name: string, enabled: boolean) {
    if (name === "support") this.state.supportEnabled = enabled;
    else if (name === "follow") this.state.followEnabled = enabled;
    else if (name in this.layers)
      this.layers[name as keyof typeof this.layers].enabled = enabled;
  }
  setDebug(value: boolean) {
    this.view.showBones = value;
  }
  setVisible(value: boolean) {
    this.view.setVisible(value);
  }
  reset() {
    this.state.reset();
    this.composer.reset();
    this.expression.reset();
    this.grip.reset();
    this.doll.reset();
    this.follow.reset();
    this.blade.reset();
    this.view.reset();
    this.attack = null;
    this.epoch++;
    for (const c of this.state.contacts) {
      c.planted = false;
      c.phase = 1;
      c.cycle = -1;
      c.weight = 0;
      c.stage = "swing";
    }
  }
  draw(input: ActorInput) {
    const state = this.state,
      rig = this.rig;
    this.setVisible(input.visible !== false);
    if (input.visible === false) return;
    if (
      state.last &&
      (input.clock < state.last.clock ||
        Math.hypot(input.x - state.last.x, input.y - state.last.y) > 180)
    )
      this.reset();
    if (input.instance !== undefined && ATTACKS.has(input.action)) {
      if (this.attack?.id !== input.instance)
        this.attack = {
          id: input.instance,
          action:
            input.attackSegment === 2 || input.action === "rising-slash"
              ? "rising-slash"
              : "slash",
        };
      input = { ...input, action: this.attack.action };
    }
    const previous = state.last;
    const dt = previous ? clamp(input.clock - previous.clock, 0, 0.25) : 0;
    // Redrawing the same tick only refreshes the overlays.
    if (!previous || input.clock !== previous.clock) {
      if (this.doll.transition(input, previous)) this.blade.clear();
      input = this.advance(input, previous, dt);
      const pose = this.composer.compose(input, previous, dt);
      this.expression.apply(pose, input, this.composer.reacting);
      state.world = worldPose(rig.bones, pose, state.world);
      // The grip follows the affine wrist, while the blade remains rigid.
      rigidify(state.world.weapon);
      state.contact.beginFrame();
      solveLegs(state, input, previous);
      if (rig.armed) {
        if (!input.doll?.active) this.grip.solve(input, dt);
        else {
          this.doll.apply(input, dt);
          this.blade.clear();
        }
      }
      braceHand(state, input);
      state.contact.endFrame(dt);
      this.follow.apply(pose, input, dt);
      this.view.submit(input);
      this.blade.update(input, previous, dt, this.composer.reacting);
      for (const event of this.composer.events)
        if (
          (event === "land" && input.clock - state.landAt > 0.05) ||
          event === "impact"
        )
          state.motes.push({
            x: input.x,
            y: input.y,
            time: input.clock,
            kind: event,
          });
      state.motes = state.motes
        .filter((p) => input.clock - p.time < 0.35)
        .slice(-10);
    }
    this.view.render(input, this.blade, this.grip);
  }
  /** Frame bookkeeping before any pose work: air blend, stride distance,
   *  turn/start/landing timestamps. Returns the input the stages should see. */
  private advance(input: ActorInput, previous: ActorInput | null, dt: number) {
    const state = this.state,
      rig = this.rig;
    if (rig.flying) input = { ...input, grounded: false };
    if (!previous) state.airWeight = input.grounded ? 0 : 1;
    else
      state.airWeight = approach(
        state.airWeight,
        input.grounded ? 0 : 1,
        dt,
        22,
      );
    if (previous && previous.facing !== input.facing)
      state.turnAt = input.clock;
    // Riding a moving platform is not walking.
    const supportDx =
      previous?.support && input.support?.id === previous.support.id
        ? input.support.x - previous.support.x
        : 0;
    const distance =
      previous &&
      previous.grounded &&
      input.grounded &&
      !GAIT_FROZEN.has(input.action)
        ? Math.abs(input.x - previous.x - supportDx)
        : 0;
    state.gait += distance / rig.stride;
    if (!rig.motion.trustVelocity && previous && dt > 0)
      input = { ...input, vx: (input.x - previous.x) / dt };
    state.last = {
      ...input,
      doll: input.doll ? { ...input.doll } : undefined,
      support: input.support ? { ...input.support } : undefined,
    };
    if (Math.abs(input.vx) > 5 && (!previous || Math.abs(previous.vx) <= 5))
      state.startAt = input.clock;
    if (previous && !previous.grounded && input.grounded) {
      state.landAt = input.clock;
      state.landImpact = clamp(
        Math.abs(input.landingSpeed ?? previous.vy ?? 250) / 650,
        0.2,
        1,
      );
      state.motes.push({
        x: input.x,
        y: input.y,
        time: input.clock,
        kind: "land",
      });
    }
    return input;
  }
  /** Read-only diagnostics for the preview tool. */
  snapshot() {
    const state = this.state,
      { layers, last } = state;
    return {
      kind: this.kind,
      action: last?.action,
      clock: last?.clock,
      epoch: this.epoch,
      gait: state.gait,
      blendWeight:
        layers.reaction.weight > 0
          ? layers.reaction.animator.blendWeight
          : layers.combat.weight > 0
            ? layers.combat.animator.blendWeight
            : this.animator.blendWeight,
      layers: Object.values(layers).map((layer) => ({
        name: layer.name,
        enabled: layer.enabled,
        weight: layer.weight,
        age: layer.age,
        blend: layer.animator.blendWeight,
      })),
      impulse: {
        ...this.expression.impulse.output,
        events: this.expression.impulse.events,
      },
      intent: { ...this.expression.intent.state },
      constraints: state.contact.snapshot(),
      supportEnabled: state.supportEnabled,
      recovery: structuredClone(state.recovery.output),
      doll: last?.doll
        ? { ...last.doll, constraintError: this.doll.solver.output.error }
        : null,
      pelvisOffset: { ...state.pelvisOffset },
      airWeight: state.airWeight,
      elbowDirection: this.grip.arm.direction,
      combatRecovery: {
        action: state.lastCombat,
        age: layers.combat.age,
        weight: layers.combat.weight,
      },
      armError: state.armError,
      hand: last ? state.toWorld(state.hand) : { ...state.hand },
      armLengths: { ...this.rig.arms.front },
      swordSpeed: this.blade.speed,
      gripTarget: { ...this.grip.target },
      boneWeights: { ...this.composer.weightedMask },
      trailSamples: this.blade.history.length,
      followEnabled: state.followEnabled,
      instance: last?.instance,
      stage: last ? actionStage(last.action, last.age) : "idle",
      feet: state.feet.map((p) => state.toWorld(p)),
      contacts: state.contacts.map((c) => ({ ...c })),
      weaponTip: { ...this.blade.tip },
      weaponBase: { ...this.blade.base },
      bones: structuredClone(state.world),
      parts: state.parts.size,
      hips: state.hips.map((p) => ({ ...p })),
      extent: this.rig.extent,
      corners: [...state.parts.values()].flatMap((p) =>
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
}
