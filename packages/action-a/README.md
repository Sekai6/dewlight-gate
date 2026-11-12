# @dewlight/action-a

Layered, procedural skeletal animation for 2D action characters. Authored
clips are blended on three layers (locomotion, combat, reaction) and then
corrected by solvers: planted feet and balance, a weapon hand on rigid arm
bones, body impulses, attention, a hit ragdoll and the get-up after it.

The core has no dependencies and no renderer. `@dewlight/action-a/phaser`
draws it in a Phaser 3 scene (Canvas renderer).

Status: pre-release, extracted from the game Dewlight Gate. The API may change.

## Use

```ts
import { createPhaserActor } from "@dewlight/action-a/phaser";
import type { RigDefinition } from "@dewlight/action-a";

const hero: RigDefinition = {
  kind: "hero",
  bones: [{ name: "root", rest: {} } /* hip, torso, head, arms … */],
  skin: [{ bone: "torso", texture: "tunic", width: 27, height: 31 }],
  slots: { root: "root", hip: "hip", chest: "torso", head: "head" /* … */ },
  actions: { slash: { layer: "combat", latched: true, phases: [0.065, 0.16] } },
  clip: (action) => clips[action],
  // leg, stride, support, doll, motion … see RigDefinition
};

const actor = createPhaserActor(scene, hero, { texture: "hero-atlas" });

// once per simulation tick
actor.draw({
  x,
  y,
  clock,
  facing,
  vx,
  vy,
  grounded,
  action: "slash",
  age: clock - attackStartedAt,
  instance: `attack:${attackStartedAt}`,
});
```

- **Rig** — bones, skin sprites, leg and arm lengths, and `slots` that tell the
  engine which bone is the hip, the chest, the weapon hand and so on. The engine
  never names a bone or an action itself.
- **Actions** — plain strings. `actions[name]` holds the traits the engine
  needs (which layer, whether feet stay planted, whether it fires an impulse).
  `idle`, `walk`, `run`, `rise`, `apex` and `fall` are requested by the
  locomotion layer and should have clips.
- **Input** — everything the game knows this tick (`ActorInput`). Gameplay
  state is read-only to the engine; it never moves the character.
- **Pipeline** — `compose → express → legs → grip | doll → brace → follow →
view → trail`, one file per stage in `src/stages`.

The rig is a biped with two arms. Other body plans are not supported yet.

## Renderers

Implement `ActorView` to draw with something else: create one `RigPart` per
sprite in `state.parts` (draw order), then present them in `submit` and draw
overlays in `render`. `src/phaser/view.ts` is the reference.
