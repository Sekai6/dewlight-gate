import { SKILLS, SKILL_IDS } from "./config.ts";
import type {
  SkillId,
  SkillInput,
  SkillInstance,
  SkillPose,
  SkillSnapshot,
  SkillStep,
} from "./types";
const EPS = 1e-9;
/** Pure simulation. Resources, collision and damage remain game responsibilities. */
export class SkillRuntime {
  active: SkillInstance | null = null;
  readonly cooldowns: Record<SkillId, number> = {
    branch: 0,
    rise: 0,
    bloom: 0,
  };
  riseUsed = false;
  private serial = 0;
  private queued: { skill: SkillId; remaining: number } | null = null;
  private targets = new Set<string>();
  reason(skill: SkillId, input: SkillInput): string {
    const d = SKILLS[skill];
    if (input.blocked) return "失衡中";
    if (d.airOnly && input.grounded) return "仅空中";
    if (skill === "rise" && this.riseUsed) return "落地后恢复";
    if (this.cooldowns[skill] > EPS)
      return `${this.cooldowns[skill].toFixed(1)}s`;
    if (input.energy + EPS < d.cost) return "光能不足";
    return "";
  }
  request(skill: SkillId, input: SkillInput): boolean {
    if (this.reason(skill, input)) return false;
    this.queued = { skill, remaining: 0.14 };
    return true;
  }
  clearBuffer() {
    this.queued = null;
  }
  /** Legacy actions use the same release/recovery arbitration. */
  allows(action: "attack" | "bind" | "dash"): boolean {
    return (
      !this.active ||
      (this.active.phase === "recovery" &&
        (action === "dash" ||
          (action === "attack" && this.active.skill === "bloom")))
    );
  }
  cancel() {
    this.active = null;
    this.queued = null;
    this.targets.clear();
  }
  reset() {
    this.cancel();
    this.riseUsed = false;
    for (const id of SKILL_IDS) this.cooldowns[id] = 0;
  }
  claim(hit: { instance: number; section: number }, target: string): boolean {
    const key = `${hit.instance}:${hit.section}:${target}`;
    if (this.targets.has(key)) return false;
    this.targets.add(key);
    return true;
  }
  get pose(): SkillPose | undefined {
    const a = this.active;
    return a
      ? {
          instance: a.id,
          id: a.skill,
          age: a.age,
          phase: a.phase,
          progress: a.age / SKILLS[a.skill].duration,
        }
      : undefined;
  }
  snapshot(): SkillSnapshot {
    return {
      active: this.active ? { ...this.active } : null,
      cooldowns: { ...this.cooldowns },
      riseUsed: this.riseUsed,
      queued: this.queued?.skill ?? null,
    };
  }
  tick(dt: number, input: SkillInput): SkillStep {
    const out: SkillStep = {
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
      for (const id of SKILL_IDS)
        this.cooldowns[id] = Math.max(0, this.cooldowns[id] - step);
      if (input.grounded && !(this.active?.skill === "rise"))
        this.riseUsed = false;
      if (input.blocked) {
        this.cancel();
        continue;
      }
      if (this.queued && (!this.active || this.active.phase === "recovery")) {
        const id = this.queued.skill;
        if (!this.reason(id, { ...input, energy: input.energy - out.cost })) {
          this.targets.clear();
          this.active = {
            id: ++this.serial,
            skill: id,
            age: 0,
            facing: input.facing < 0 ? -1 : 1,
            phase: "anticipation",
          };
          this.cooldowns[id] = SKILLS[id].cooldown;
          if (id === "rise") this.riseUsed = true;
          out.cost += SKILLS[id].cost;
          out.events.push({
            type: "prepare",
            instance: this.active.id,
            skill: id,
            at: 0,
          });
        }
        this.queued = null;
      }
      if (this.queued) {
        this.queued.remaining -= step;
        if (this.queued.remaining < -EPS) this.queued = null;
      }
      const a = this.active;
      if (!a) continue;
      const d = SKILLS[a.skill],
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
