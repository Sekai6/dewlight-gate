# @dewlight/action-skill

Frame-rate independent simulation of character skills: three phases
(anticipation, release, recovery), hit windows, forced movement, launches,
gravity scaling, cooldowns, a one-slot input buffer and per-target hit
de-duplication. Pure TypeScript, no dependencies, no renderer.

The runtime decides _when_ things happen. Resources, collision and damage stay
in your game: it tells you what a step costs, how far to move and which hit
bands are open, and you apply them.

Status: pre-release, extracted from the game Dewlight Gate. The API may change.

## Use

```ts
import { SkillRuntime, skillContains } from "@dewlight/action-skill";

const skills = new SkillRuntime({
  thrust: {
    id: "thrust",
    cost: 20,
    cooldown: 3.5,
    duration: 0.38,
    release: 0.1,
    recovery: 0.26,
    cancelInto: ["dash"],
    hits: [{ at: 0.1, end: 0.24, reach: 112, height: 85 }],
    movement: { start: 0.1, end: 0.26, distance: 160 },
  },
});

// on key press
if (!skills.request("thrust", { energy, grounded, facing }))
  show(skills.reason("thrust", { energy, grounded, facing })); // "cooldown", "energy" …

// every simulation step
const step = skills.tick(dt, { energy, grounded, facing, blocked: stunned });
energy -= step.cost;
x += step.dx;
if (step.launch !== null) vy = step.launch;
gravityScale = step.gravity;
for (const hit of step.hits)
  for (const enemy of enemies)
    if (skillContains(hit, { x, y }, enemy) && skills.claim(hit, enemy.id))
      damage(enemy);
```

## Buffering and cancels

- A press is remembered for `buffer` seconds (0.2 by default) and starts as soon
  as it may: when the active skill reaches recovery, or when `hold` (a dash, say)
  ends. `blocked` (a stun) drops both the active skill and the buffered press.
- `cancelInto` lists the other actions of your game that may interrupt a
  skill's recovery; ask with `skills.allows("dash")`.
- `hitCancel: { after, into }` opens only after you report a landed hit with
  `skills.confirm(hit.instance)`: the listed actions and skills may then
  interrupt from `after` seconds on. A miss opens nothing.

`tick` advances in 1/120 s substeps, so results are the same at 10 or 120 frames
per second. `tick(0)` changes nothing, which makes pausing trivial.
