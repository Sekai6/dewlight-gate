/** ACTION-A: deterministic, renderer independent 2D animation primitives. */
export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
}
export interface Bone {
  name: string;
  parent?: string;
  rest: Partial<Transform>;
}
export interface Key {
  tangentIn?: number;
  tangentOut?: number;
  time: number;
  value: number;
  ease?: "linear" | "smooth" | "hold";
}
export type Channel = keyof Transform;
export interface Track {
  interpolation?: "hermite";
  /** Authored multi-turn paths, such as a sword windup. */
  unwrapped?: boolean;
  bone: string;
  channel: Channel;
  keys: Key[];
}
export interface Clip {
  name: string;
  duration: number;
  loop?: boolean;
  tracks: Track[];
  transition?: number;
  events?: { time: number; name: string }[];
}
export type Pose = Record<string, Transform>;
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
export const angleDelta = (a: number, b: number) =>
  Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const identity = (): Transform => ({
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  alpha: 1,
});
export function restPose(bones: Bone[]): Pose {
  return Object.fromEntries(
    bones.map((b) => [b.name, { ...identity(), ...b.rest }]),
  );
}
export function sampleTrack(track: Track, time: number): number {
  const keys = track.keys;
  if (!keys.length) throw new Error("ACTION-A track requires a key");
  if (time <= keys[0].time) return keys[0].value;
  for (let n = 1; n < keys.length; n++) {
    const b = keys[n],
      a = keys[n - 1];
    if (time > b.time) continue;
    const u =
      a.ease === "hold" ? 0 : (time - a.time) / Math.max(1e-8, b.time - a.time);
    const t = a.ease === "smooth" ? smooth(u) : u;
    if (track.interpolation === "hermite") {
      const span = b.time - a.time;
      const delta =
        track.channel === "rotation" && !track.unwrapped
          ? angleDelta(a.value, b.value)
          : b.value - a.value;
      const end = a.value + delta;
      const m0 = (a.tangentOut ?? delta / span) * span;
      const m1 = (b.tangentIn ?? delta / span) * span;
      return (
        (2 * u * u * u - 3 * u * u + 1) * a.value +
        (u * u * u - 2 * u * u + u) * m0 +
        (-2 * u * u * u + 3 * u * u) * end +
        (u * u * u - u * u) * m1
      );
    }
    return (
      a.value +
      (track.channel === "rotation" && !track.unwrapped
        ? angleDelta(a.value, b.value)
        : b.value - a.value) *
        t
    );
  }
  return keys[keys.length - 1].value;
}
export const CHANNELS: Channel[] = [
  "x",
  "y",
  "rotation",
  "scaleX",
  "scaleY",
  "alpha",
];
export interface TransitionProfile {
  translation: number;
  rotation: number;
  scale: number;
  alpha: number;
}
export const transitionProfile = (duration: number): TransitionProfile => ({
  translation: duration,
  rotation: duration,
  scale: duration,
  alpha: duration,
});
/** Fixed-shape storage. Counted explicitly so benchmarks can distinguish allocations from heap noise. */
export class PoseBuffer {
  static allocations = 0;
  readonly pose: Pose;
  readonly bones: Bone[];
  constructor(bones: Bone[]) {
    this.bones = bones;
    this.pose = restPose(bones);
    PoseBuffer.allocations++;
  }
  copy(source: Pose) {
    for (const b of this.bones)
      for (const c of CHANNELS) this.pose[b.name][c] = source[b.name][c];
    return this.pose;
  }
  rest() {
    for (const b of this.bones) {
      const t = this.pose[b.name];
      t.x = b.rest.x ?? 0;
      t.y = b.rest.y ?? 0;
      t.rotation = b.rest.rotation ?? 0;
      t.scaleX = b.rest.scaleX ?? 1;
      t.scaleY = b.rest.scaleY ?? 1;
      t.alpha = b.rest.alpha ?? 1;
    }
    return this.pose;
  }
}
export class CompiledClip {
  readonly tracks: { target: string; channel: Channel; track: Track }[];
  readonly unwrapped: ReadonlySet<string>;
  readonly bones: Bone[];
  readonly clip: Clip;
  constructor(bones: Bone[], clip: Clip) {
    this.bones = bones;
    this.clip = clip;
    const names = new Set(bones.map((b) => b.name));
    this.tracks = clip.tracks
      .filter((t) => names.has(t.bone))
      .map((track) => ({ target: track.bone, channel: track.channel, track }));
    this.unwrapped = new Set(
      this.tracks
        .filter((t) => t.channel === "rotation" && t.track.unwrapped)
        .map((t) => t.target),
    );
  }
  sample(age: number, buffer: PoseBuffer) {
    const pose = buffer.rest();
    const time = this.clip.loop
      ? ((age % this.clip.duration) + this.clip.duration) % this.clip.duration
      : clamp(age, 0, this.clip.duration);
    for (const t of this.tracks)
      pose[t.target][t.channel] = sampleTrack(t.track, time);
    return pose;
  }
}
export function sampleClip(bones: Bone[], clip: Clip, age: number): Pose {
  return new CompiledClip(bones, clip).sample(age, new PoseBuffer(bones));
}
/** Finite-support inertial correction: position AND velocity match at t=0 and vanish at t=T. */
export function inertialOffset(
  position: number,
  velocity: number,
  age: number,
  duration: number,
) {
  if (duration <= 0 || age >= duration) return 0;
  const t = clamp(age / duration),
    tail = (1 - t) ** 3;
  return (
    tail *
    ((1 + 3 * t + 6 * t * t) * position + (t + 3 * t * t) * velocity * duration)
  );
}
export function blendPose(
  from: Pose,
  to: Pose,
  weight: number,
  mask?: ReadonlySet<string>,
): Pose {
  const result: Pose = {};
  const t = clamp(weight);
  for (const name of Object.keys(from)) {
    const a = from[name],
      b = to[name] ?? a;
    result[name] = { ...a };
    if (mask && !mask.has(name)) continue;
    for (const c of Object.keys(a) as Channel[]) {
      result[name][c] =
        a[c] + (c === "rotation" ? angleDelta(a[c], b[c]) : b[c] - a[c]) * t;
    }
  }
  return result;
}
export interface WorldTransform extends Transform {
  a: number;
  b: number;
  c: number;
  d: number;
}
export type WorldPose = Record<string, WorldTransform>;
export function worldPose(
  bones: Bone[],
  local: Pose,
  output: WorldPose = {},
): WorldPose {
  for (const bone of bones) {
    const t = local[bone.name],
      p = bone.parent ? output[bone.parent] : undefined;
    if (!t) throw new Error(`Missing bone ${bone.name}`);
    const cosine = Math.cos(t.rotation),
      sine = Math.sin(t.rotation);
    const la = cosine * t.scaleX,
      lb = sine * t.scaleX,
      lc = -sine * t.scaleY,
      ld = cosine * t.scaleY;
    const w =
      output[bone.name] ??
      (output[bone.name] = { ...identity(), a: 1, b: 0, c: 0, d: 1 });
    w.x = p ? p.x + p.a * t.x + p.c * t.y : t.x;
    w.y = p ? p.y + p.b * t.x + p.d * t.y : t.y;
    w.a = p ? p.a * la + p.c * lb : la;
    w.b = p ? p.b * la + p.d * lb : lb;
    w.c = p ? p.a * lc + p.c * ld : lc;
    w.d = p ? p.b * lc + p.d * ld : ld;
    w.rotation = (p?.rotation ?? 0) + t.rotation;
    w.scaleX = Math.hypot(w.a, w.b);
    w.scaleY = Math.hypot(w.c, w.d);
    w.alpha = (p?.alpha ?? 1) * t.alpha;
  }
  return output;
}
/** Two segment IK; clamps unreachable targets, with a stable bend direction. */
export function solveIK(
  x: number,
  y: number,
  tx: number,
  ty: number,
  upper: number,
  lower: number,
  bend = 1,
) {
  const dx = tx - x,
    dy = ty - y;
  const distance = clamp(
    Math.hypot(dx, dy),
    Math.abs(upper - lower) + 1e-5,
    upper + lower - 1e-5,
  );
  const angle = Math.atan2(dy, dx);
  const offset = Math.acos(
    clamp(
      (upper * upper + distance * distance - lower * lower) /
        (2 * upper * distance),
      -1,
      1,
    ),
  );
  const a = angle + offset * bend;
  return {
    knee: { x: x + Math.cos(a) * upper, y: y + Math.sin(a) * upper },
    foot: {
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
    },
  };
}
/** Analytic critically damped spring, stable under varying render frame rates. */
export class FollowSpring {
  value = 0;
  velocity = 0;
  reset(value = 0) {
    this.value = value;
    this.velocity = 0;
  }
  update(target: number, dt: number, frequency = 15) {
    if (dt <= 0) return this.value;
    const d = this.value - target,
      c = this.velocity + frequency * d,
      e = Math.exp(-frequency * dt);
    this.value = target + (d + c * dt) * e;
    this.velocity = (this.velocity - frequency * c * dt) * e;
    return this.value;
  }
}
export class Animator {
  readonly output: PoseBuffer;
  private readonly target: PoseBuffer;
  private readonly ahead: PoseBuffer;
  private readonly offsets: PoseBuffer;
  private readonly momentum: PoseBuffer;
  private readonly velocity: PoseBuffer;
  readonly bones: Bone[];
  pose: Pose;
  private cache = new Map<Clip, CompiledClip>();
  private clip: Clip | null = null;
  private instance: string | number | undefined;
  private cursor = -1e-8;
  private lastClock = -Infinity;
  private changedAt = 0;
  private transition: number;
  private activeProfile: TransitionProfile;
  blendWeight = 1;
  readonly events: string[] = [];
  constructor(bones: Bone[], transition = 0.085) {
    this.bones = bones;
    this.transition = transition;
    this.activeProfile = transitionProfile(transition);
    this.output = new PoseBuffer(bones);
    this.target = new PoseBuffer(bones);
    this.ahead = new PoseBuffer(bones);
    this.offsets = new PoseBuffer(bones);
    this.momentum = new PoseBuffer(bones);
    this.velocity = new PoseBuffer(bones);
    this.pose = this.output.pose;
    this.reset();
  }
  reset() {
    this.output.rest();
    this.clip = null;
    this.instance = undefined;
    this.cursor = -1e-8;
    this.lastClock = -Infinity;
    this.blendWeight = 1;
    this.events.length = 0;
    for (const b of this.bones)
      for (const c of CHANNELS) {
        this.velocity.pose[b.name][c] = 0;
        this.offsets.pose[b.name][c] = 0;
        this.momentum.pose[b.name][c] = 0;
      }
  }
  update(
    clip: Clip,
    age: number,
    clock: number,
    decorate?: (pose: Pose) => void,
    instance?: string | number,
    profile?: TransitionProfile,
  ): { pose: Pose; events: string[] } {
    this.events.length = 0;
    if (clock === this.lastClock)
      return { pose: this.pose, events: this.events };
    let compiled = this.cache.get(clip);
    if (!compiled) {
      compiled = new CompiledClip(this.bones, clip);
      this.cache.set(clip, compiled);
    }
    const next = compiled.sample(age, this.target);
    const switched =
      !this.clip ||
      instance !== this.instance ||
      (instance === undefined && this.clip.name !== clip.name) ||
      age < this.cursor;
    if (switched) {
      const future = compiled.sample(age + 1 / 1000, this.ahead);
      this.activeProfile =
        profile ?? transitionProfile(clip.transition ?? this.transition);
      for (const b of this.bones)
        for (const c of CHANNELS) {
          const ordinaryAngle =
            c === "rotation" && !compiled.unwrapped.has(b.name);
          this.offsets.pose[b.name][c] = ordinaryAngle
            ? angleDelta(next[b.name][c], this.pose[b.name][c])
            : this.pose[b.name][c] - next[b.name][c];
          const targetVelocity =
            (ordinaryAngle
              ? angleDelta(next[b.name][c], future[b.name][c])
              : future[b.name][c] - next[b.name][c]) * 1000;
          this.momentum.pose[b.name][c] =
            this.velocity.pose[b.name][c] - targetVelocity;
        }
      this.changedAt = clock;
      this.cursor = age <= 0.04 ? -1e-8 : age - 1e-8;
    }
    decorate?.(next);
    const first = clip.loop
      ? Math.floor(Math.max(0, this.cursor) / clip.duration)
      : 0;
    const last = clip.loop ? Math.floor(age / clip.duration) : 0;
    for (let loop = first; loop <= Math.min(last, first + 8); loop++)
      for (const e of clip.events ?? []) {
        const at = loop * clip.duration + e.time;
        if (at > this.cursor && at <= age) this.events.push(e.name);
      }
    const elapsed = Math.max(0, clock - this.changedAt),
      dt = clock - this.lastClock;
    const duration = Math.max(...Object.values(this.activeProfile));
    this.blendWeight =
      !this.clip || duration <= 0 ? 1 : smooth(elapsed / duration);
    for (const b of this.bones)
      for (const c of CHANNELS) {
        const t =
          c === "rotation"
            ? this.activeProfile.rotation
            : c === "x" || c === "y"
              ? this.activeProfile.translation
              : c === "alpha"
                ? this.activeProfile.alpha
                : this.activeProfile.scale;
        let value =
          next[b.name][c] +
          (!this.clip
            ? 0
            : inertialOffset(
                this.offsets.pose[b.name][c],
                this.momentum.pose[b.name][c],
                elapsed,
                t,
              ));
        if (this.clip && t > 0 && elapsed === 0) value = this.pose[b.name][c];
        else if (c === "rotation" && !compiled.unwrapped.has(b.name))
          value =
            this.pose[b.name][c] + angleDelta(this.pose[b.name][c], value);
        if (c === "alpha") value = clamp(value);
        if (c === "scaleX" || c === "scaleY") value = clamp(value, 0.1, 2);
        const old = this.pose[b.name][c];
        this.velocity.pose[b.name][c] =
          dt > 0 && Number.isFinite(dt)
            ? (c === "rotation" && !compiled.unwrapped.has(b.name)
                ? angleDelta(old, value)
                : value - old) / dt
            : 0;
        this.pose[b.name][c] = value;
      }
    this.clip = clip;
    this.instance = instance;
    this.cursor = age;
    this.lastClock = clock;
    return { pose: this.pose, events: this.events };
  }
}

export type BoneMask = Readonly<
  Record<string, number | Partial<Record<Channel, number>>>
>;
export type BlendMode = "override" | "additive";
export class AnimationLayer {
  readonly animator: Animator;
  enabled = true;
  weight = 0;
  age = 0;
  readonly name: string;
  readonly mask?: ReadonlySet<string>;
  constructor(name: string, bones: Bone[], mask?: ReadonlySet<string>) {
    this.name = name;
    this.mask = mask;
    this.animator = new Animator(bones);
  }
  reset() {
    this.animator.reset();
    this.weight = 0;
    this.age = 0;
  }
  evaluate(clip: Clip, age: number, clock: number, instance?: string | number) {
    this.age = age;
    return this.animator.update(clip, age, clock, undefined, instance);
  }
  apply(
    target: Pose,
    weight = this.weight,
    mask: ReadonlySet<string> | BoneMask | undefined = this.mask,
    mode: BlendMode = "override",
    reference?: Pose,
  ) {
    if (!this.enabled || weight <= 0) return;
    for (const b of this.animator.bones) {
      if (mask instanceof Set && !mask.has(b.name)) continue;
      for (const c of CHANNELS) {
        const entry =
          mask && !(mask instanceof Set) ? (mask as BoneMask)[b.name] : 1;
        const w =
          clamp(weight) *
          (typeof entry === "number" ? entry : (entry?.[c] ?? 0));
        const a = target[b.name][c],
          v = this.animator.pose[b.name][c];
        // Authored winding is already resolved in the layer's inertial player.
        const rest =
          reference?.[b.name][c] ??
          b.rest[c] ??
          (c === "scaleX" || c === "scaleY" || c === "alpha" ? 1 : 0);
        target[b.name][c] =
          mode === "additive" ? a + (v - rest) * w : a + (v - a) * w;
      }
    }
  }
}
