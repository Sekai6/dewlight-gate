import type Phaser from "phaser";
import { ActionActor } from "../actor.ts";
import type { RigDefinition } from "../definition.ts";
import { PhaserActorView } from "./view.ts";

export { PhaserActorView } from "./view.ts";
export type PhaserActor = ActionActor<PhaserActorView>;
export interface PhaserActorOptions {
  /** Texture atlas key holding the frames named by the rig skin. */
  texture: string;
  depth?: number;
  /** Afterimage copies for actions with the `echo` trait. */
  echoes?: boolean;
}
/** An actor drawn by a Phaser 3 scene using the Canvas renderer. */
export function createPhaserActor(
  scene: Phaser.Scene,
  definition: RigDefinition,
  options: PhaserActorOptions,
): PhaserActor {
  const { texture, depth = 6, echoes = false } = options;
  return new ActionActor(
    definition,
    (state) => new PhaserActorView(scene, state, texture, depth, echoes),
  );
}
