import type Phaser from "phaser";
import { createPhaserActor } from "@dewlight/action-a/phaser";
import type { RigDefinition } from "@dewlight/action-a";
import { ACTION_TRAITS, type SkillPose } from "./actions.ts";
import { swordBody, walkerBody, wingBody } from "./body-motion.ts";
import { combatMask, combatMotion } from "./combat-motion.ts";
import { createRig, getClip, type ActorKind } from "./rigs.ts";
import { skillFootOffset } from "./skill-body.ts";
import { ensureSkin } from "./skin.ts";

const definitions = new Map<ActorKind, RigDefinition>();

/** The game's four characters as animation-engine definitions. */
export function actorDefinition(kind: ActorKind): RigDefinition {
  let definition = definitions.get(kind);
  if (!definition) {
    const rig = createRig(kind);
    definition = {
      ...rig,
      actions: ACTION_TRAITS,
      clip: (action) => getClip(rig, action),
      combat: rig.armed
        ? { motion: combatMotion, mask: combatMask }
        : undefined,
      bodyMotion: rig.armed ? swordBody : rig.flying ? wingBody : walkerBody,
      footOffset: rig.armed
        ? (move, side, weight, out) =>
            skillFootOffset(move as SkillPose, side, weight, out)
        : undefined,
    };
    definitions.set(kind, definition);
  }
  return definition;
}

export function createActor(
  scene: Phaser.Scene,
  kind: ActorKind,
  depth = 6,
  echoes = true,
) {
  ensureSkin(scene);
  const definition = actorDefinition(kind);
  return createPhaserActor(scene, definition, {
    texture: "action-a",
    depth,
    echoes: echoes && definition.armed,
  });
}
