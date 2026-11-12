import type { DollHitProfile, HitContext } from "@dewlight/action-a";

export type HitKind = "ground" | "flying" | "charge" | "wave" | "defeat";
export type Hit = HitContext<HitKind>;
/** How hard each kind of hit throws a body. */
export const HIT_PROFILES: Record<HitKind, DollHitProfile> = {
  ground: {
    horizontal: 180,
    upward: 120,
    lock: 0.18,
    bounces: 0,
    spin: 1.5,
    restitution: [0.32, 0.18],
    lie: false,
  },
  flying: {
    horizontal: 320,
    upward: 240,
    lock: 0.3,
    bounces: 1,
    spin: 6,
    restitution: [0.34, 0.18],
    lie: true,
  },
  charge: {
    horizontal: 620,
    upward: 400,
    lock: 0.3,
    bounces: 2,
    spin: 13,
    restitution: [0.36, 0.2],
    lie: true,
  },
  wave: {
    horizontal: 280,
    upward: 590,
    lock: 0.3,
    bounces: 2,
    spin: 11,
    restitution: [0.32, 0.18],
    lie: true,
  },
  /** A creature knocked out of the fight. */
  defeat: {
    horizontal: 250,
    upward: 300,
    lock: 0.3,
    bounces: 1,
    spin: 8,
    restitution: [0.3, 0.15],
    lie: true,
  },
};
