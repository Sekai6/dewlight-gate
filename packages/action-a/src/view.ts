import type { WeaponGrip } from "./stages/grip.ts";
import type { ActorInput } from "./stages/state.ts";
import type { WeaponTrail } from "./stages/trail.ts";

/** The output side of an actor. A view creates the parts in `state.parts`
 *  once, in draw order, and presents them after every solve. */
export interface ActorView {
  showBones: boolean;
  reset(): void;
  setVisible(value: boolean): void;
  /** The pose is solved: place the sprites and the actor in the scene. */
  submit(input: ActorInput): void;
  /** Redraw overlays: weapon trail, shadow, dust, debug skeleton. */
  render(input: ActorInput, trail: WeaponTrail, grip: WeaponGrip): void;
}
