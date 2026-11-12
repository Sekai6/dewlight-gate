import type {
  SkillBlock,
  SkillDefinition,
  SkillInput,
  SkillInstance,
  SkillPose,
  SkillSnapshot,
  SkillStep,
} from "./types.ts";
const EPS = 1e-9;
/** Pure simulation of a set of skills. Resources, collision and damage remain
 *  the game's responsibility. */
export class SkillRuntime<Id extends string = string> {
  active: SkillInstance<Id> | null = null;
  readonly cooldowns: Record<Id, number>;
  readonly skills: Readonly<Record<Id, SkillDefinition>>;
  private ids: Id[];
  private spent = new Set<Id>();
  private serial = 0;
  private queued: { skill: Id; remaining: number } | null = null;
  private targets = new Set<string>();
  /** Seconds a press is remembered while its skill cannot start yet. */
  readonly buffer: number;
  constructor(
    skills: Readonly<Record<Id, SkillDefinition>>,
    options: { buffer?: number } = Object.freeze(Object.create(null)),
  ) {
    this.buffer = options.buffer ?? 0.2;
    this.skills = skills;
    this.ids = Object.keys(skills) as Id[];
    for (const id of this.ids) {
      const d = skills[id];
      if (!(d.duration > 0))
        throw new RangeError(`skill "${id}": duration must be positive`);
      if (d.movement && !(d.movement.end > d.movement.start))
        throw new RangeError(
          `skill "${id}": movement must end after it starts`,
        );
    }
    this.cooldowns = Object.fromEntries(
      this.ids.map((id) => [id, 0]),
    ) as Record<Id, number>;
  }
  /** Why `skill` cannot start now, or null when it can. */
  reason(skill: Id, input: SkillInput): SkillBlock | null {
    const d = this.skills[skill];
    if (input.blocked) return "blocked";
    if (d.airOnly && input.grounded) return "air-only";
    if (this.spent.has(skill)) return "once-per-air";
    if (this.cooldowns[skill] > EPS) return "cooldown";
    if (input.energy + EPS < d.cost) return "energy";
    return null;
  }
  /** Remember a press. It starts as soon as the skill may, within `buffer`
   *  seconds. False when it cannot become available in that time. */
  request(skill: Id, input: SkillInput): boolean {
    const block = this.reason(skill, input);
    if (
      block &&
      !(block === "cooldown" && this.cooldowns[skill] <= this.buffer)
    )
      return false;
    this.queued = { skill, remaining: this.buffer };
    return true;
  }
  /** Report that a hit of the active skill landed, opening its hit-cancel. */
  confirm(instance: number) {
    if (this.active?.id === instance) this.active.confirmed = true;
  }
  private hitCancels(target: string, skill: boolean) {
    const a = this.active!,
      rule = this.skills[a.skill].hitCancel;
    return (
      a.confirmed &&
      !!rule &&
      a.age >= rule.after - EPS &&
      (rule.into.includes(target) || (skill && rule.into.includes("*")))
    );
  }
  /** The skill waiting in the input buffer, if any. */
  get pending(): Id | null {
    return this.queued?.skill ?? null;
  }
  clearBuffer() {
    this.queued = null;
  }
  /** Whether `skill` could start now as far as the active skill is
   *  concerned: nothing is active, it is recovering, or a landed hit lets
   *  `skill` cancel it. Cost and cooldown are `reason`'s business. */
  canStart(skill: Id): boolean {
    return (
      !this.active ||
      this.active.phase === "recovery" ||
      this.hitCancels(skill, true)
    );
  }
  /** Whether another action of the game (by name) may start now. */
  allows(action: string): boolean {
    const a = this.active;
    return (
      !a ||
      (a.phase === "recovery" &&
        !!this.skills[a.skill].cancelInto?.includes(action)) ||
      this.hitCancels(action, false)
    );
  }
  cancel() {
    this.active = null;
    this.queued = null;
    this.targets.clear();
  }
  reset() {
    this.cancel();
    this.spent.clear();
    for (const id of this.ids) this.cooldowns[id] = 0;
  }
  /** True the first time a hit section reaches a target. */
  claim(hit: { instance: number; section: number }, target: string): boolean {
    const key = `${hit.instance}:${hit.section}:${target}`;
    if (this.targets.has(key)) return false;
    this.targets.add(key);
    return true;
  }
  get pose(): SkillPose<Id> | undefined {
    const a = this.active;
    return a
      ? {
          instance: a.id,
          id: a.skill,
          age: a.age,
          phase: a.phase,
          progress: a.age / this.skills[a.skill].duration,
        }
      : undefined;
  }
  snapshot(): SkillSnapshot<Id> {
    return {
      active: this.active ? { ...this.active } : null,
      cooldowns: { ...this.cooldowns },
      spent: [...this.spent],
      queued: this.queued?.skill ?? null,
    };
  }
  tick(dt: number, input: SkillInput): SkillStep<Id> {
    const out: SkillStep<Id> = {
      cost: 0,
      dx: 0,
      launch: null,
      gravity: 1,
      events: [],
      hits: [],
    };
    // dt=0 is also the pause contract. Rendering cannot start or age a cast.
    if (!(dt > 0)) return out;
    let left = Math.min(dt, 10);
    while (left > EPS) {
      const step = Math.min(left, 1 / 120);
      left -= step;
      for (const id of this.ids)
        this.cooldowns[id] = Math.max(0, this.cooldowns[id] - step);
      if (input.grounded)
        for (const id of this.spent)
          if (this.active?.skill !== id) this.spent.delete(id);
      if (input.blocked) {
        this.cancel();
        continue;
      }
      if (this.queued && !input.hold && this.canStart(this.queued.skill)) {
        const id = this.queued.skill,
          d = this.skills[id];
        if (!this.reason(id, { ...input, energy: input.energy - out.cost })) {
          if (this.active)
            out.events.push({
              type: "cancel",
              instance: this.active.id,
              skill: this.active.skill,
              at: this.active.age,
            });
          this.queued = null;
          this.targets.clear();
          this.active = {
            id: ++this.serial,
            skill: id,
            age: 0,
            facing: input.facing < 0 ? -1 : 1,
            phase: "anticipation",
            confirmed: false,
          };
          this.cooldowns[id] = d.cooldown;
          if (d.oncePerAir) this.spent.add(id);
          out.cost += d.cost;
          out.events.push({
            type: "prepare",
            instance: this.active.id,
            skill: id,
            at: 0,
          });
        }
      }
      if (this.queued) {
        this.queued.remaining -= step;
        if (this.queued.remaining < -EPS) this.queued = null;
      }
      const a = this.active;
      if (!a) continue;
      const d = this.skills[a.skill],
        before = a.age;
      a.age = Math.min(d.duration, a.age + step);
      const crossed = (at: number) => before < at - EPS && a.age >= at - EPS;
      for (const [type, at] of [
        ["release", d.release],
        ["recovery", d.recovery],
        ["complete", d.duration],
      ] as const) {
        if (crossed(at))
          out.events.push({ type, instance: a.id, skill: a.skill, at });
      }
      d.hits.forEach((h, section) => {
        if (crossed(h.at) || (h.end > h.at && a.age > h.at && before < h.end)) {
          out.hits.push({
            instance: a.id,
            skill: a.skill,
            section,
            facing: a.facing,
            reach: h.reach,
            height: h.height,
            bothSides: d.bothSides,
          });
          if (crossed(h.at))
            out.events.push({
              type: "hit",
              instance: a.id,
              skill: a.skill,
              at: h.at,
              section,
            });
        }
      });
      if (d.movement) {
        const m = d.movement;
        const portion = Math.max(
          0,
          Math.min(a.age, m.end) - Math.max(before, m.start),
        );
        out.dx += (a.facing * m.distance * portion) / (m.end - m.start);
      }
      if (d.launch && crossed(d.launch.at)) out.launch = d.launch.speed;
      if (d.gravity && before < d.gravity.end) {
        const portion = Math.max(0, Math.min(a.age, d.gravity.end) - before);
        out.gravity -= ((1 - d.gravity.scale) * portion) / Math.min(dt, 10);
      }
      a.phase =
        a.age < d.release - EPS
          ? "anticipation"
          : a.age < d.recovery - EPS
            ? "release"
            : "recovery";
      if (a.age >= d.duration - EPS) this.active = null;
    }
    return out;
  }
}
