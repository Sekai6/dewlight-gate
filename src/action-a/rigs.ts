import type { Bone, Clip, Track } from "./core";
import type { SupportProfile } from "./balance";
export type ActorKind = "hero" | "moss" | "moth" | "guardian";
export const ACTIONS = [
  "idle",
  "walk",
  "run",
  "start",
  "brake",
  "turn",
  "launch",
  "rise",
  "apex",
  "fall",
  "land",
  "slash",
  "rising-slash",
  "air-slash",
  "dash",
  "bind",
  "hurt",
  "defeat",
  "windup",
  "strike",
  "recover",
  "bound",
  "slam-warn",
  "slam",
] as const;
export type Action = (typeof ACTIONS)[number];
export interface RigDefinition {
  support: SupportProfile;
  bob: number;
  sway: number;
  lean: number;
  knees: [number, number];
  kind: ActorKind;
  bones: Bone[];
  leg: number;
  footSpan: number;
  stride: number;
  stance: number;
  skin: {
    bone: string;
    texture: string;
    width: number;
    height: number;
    originY?: number;
    depth?: number;
  }[];
}
export type Rig = RigDefinition;
export function createRig(kind: ActorKind): RigDefinition {
  const boss = kind === "guardian",
    hero = kind === "hero",
    moth = kind === "moth";
  const leg = boss ? 33 : hero ? 19 : moth ? 12 : 15;
  const hipY = boss ? -49 : hero ? -30 : moth ? -22 : -21;
  const torsoY = boss ? -15 : hero ? -9 : -8;
  const bones: Bone[] = [
    { name: "root", rest: {} },
    { name: "hip", parent: "root", rest: { y: hipY } },
    { name: "cape", parent: "hip", rest: { x: -5, y: torsoY - 7 } },
    { name: "wingBack", parent: "hip", rest: { x: -7, y: -12 } },
    { name: "torso", parent: "hip", rest: { y: torsoY } },
    { name: "armBack", parent: "torso", rest: { x: -8, y: -7, rotation: 0.2 } },
    {
      name: "foreBack",
      parent: "armBack",
      rest: { y: hero ? 12 : boss ? 23 : 10, rotation: -0.3 },
    },
    {
      name: "head",
      parent: "torso",
      rest: { y: boss ? -28 : hero ? -19 : -12 },
    },
    { name: "crown", parent: "head", rest: { y: boss ? -24 : -8 } },
    { name: "wingFront", parent: "hip", rest: { x: 5, y: -11 } },
    {
      name: "arm",
      parent: "torso",
      rest: { x: hero ? 9 : boss ? 34 : 12, y: -7, rotation: -0.2 },
    },
    {
      name: "fore",
      parent: "arm",
      rest: { y: hero ? 12 : boss ? 23 : 10, rotation: -0.4 },
    },
    {
      name: "weapon",
      parent: "fore",
      rest: { y: hero ? 11 : boss ? 20 : 9, rotation: hero ? 1 : 0 },
    },
    { name: "lamp", parent: "foreBack", rest: { y: 12 } },
  ];
  const skin: Rig["skin"] = [
    {
      bone: "cape",
      texture: "cape",
      width: hero ? 32 : boss ? 60 : 30,
      height: hero ? 42 : boss ? 46 : 25,
      originY: 0,
      depth: -4,
    },
    {
      bone: "torso",
      texture: hero
        ? "tunic"
        : boss
          ? "guardianShell"
          : moth
            ? "shell"
            : "mossShell",
      width: hero ? 27 : boss ? 88 : 38,
      height: hero ? 31 : boss ? 73 : 29,
      originY: 0.35,
    },
    {
      bone: "armBack",
      texture: "limb",
      width: hero ? 8 : boss ? 20 : 8,
      height: hero ? 14 : boss ? 27 : 12,
      originY: 0.1,
      depth: -3,
    },
    {
      bone: "foreBack",
      texture: "glove",
      width: hero ? 8 : boss ? 22 : 9,
      height: hero ? 14 : boss ? 25 : 12,
      originY: 0.1,
      depth: -2,
    },
    {
      bone: "head",
      texture: hero
        ? "hood"
        : moth
          ? "mothHead"
          : boss
            ? "guardianHead"
            : "mask",
      width: hero ? 30 : boss ? 65 : 27,
      height: hero ? 32 : boss ? 45 : 26,
      originY: 0.58,
      depth: 2,
    },
    {
      bone: "arm",
      texture: "limb",
      width: hero ? 9 : boss ? 23 : 9,
      height: hero ? 14 : boss ? 27 : 13,
      originY: 0.1,
      depth: 3,
    },
    {
      bone: "fore",
      texture: "glove",
      width: hero ? 9 : boss ? 26 : 10,
      height: hero ? 14 : boss ? 25 : 13,
      originY: 0.1,
      depth: 4,
    },
  ];
  if (hero)
    skin.push(
      {
        bone: "weapon",
        texture: "sword",
        width: 15,
        height: 51,
        originY: 0.76,
        depth: 5,
      },
      {
        bone: "lamp",
        texture: "lamp",
        width: 15,
        height: 23,
        originY: 0.15,
        depth: 1,
      },
    );
  else
    skin.push({
      bone: "crown",
      texture: boss ? "crown" : "sprout",
      width: boss ? 105 : 30,
      height: boss ? 54 : 23,
      originY: 0.9,
      depth: 3,
    });
  if (moth)
    skin.push(
      {
        bone: "wingBack",
        texture: "wing",
        width: 55,
        height: 48,
        originY: 0.9,
        depth: -5,
      },
      {
        bone: "wingFront",
        texture: "wing",
        width: 49,
        height: 44,
        originY: 0.9,
        depth: 1,
      },
    );
  if (!hero) {
    const shoulder = boss ? 35 : moth ? 9 : 14;
    const upper = boss ? 24 : moth ? 9 : 11;
    const lower = boss ? 21 : moth ? 8 : 10;
    for (const bone of bones) {
      if (bone.name === "armBack") {
        bone.rest.x = -shoulder;
        bone.rest.y = boss ? -15 : -6;
      }
      if (bone.name === "arm") {
        bone.rest.x = shoulder;
        bone.rest.y = boss ? -15 : -6;
      }
      if (bone.name === "fore" || bone.name === "foreBack") bone.rest.y = upper;
      if (bone.name === "weapon") bone.rest.y = lower;
    }
  }
  if (moth) {
    bones.push({
      name: "abdomen",
      parent: "hip",
      rest: { x: -5, y: 7, rotation: -0.15 },
    });
    skin.unshift({
      bone: "abdomen",
      texture: "shell",
      width: 23,
      height: 30,
      originY: 0.2,
      depth: -6,
    });
  }
  for (const [name, parent, depth] of [
    ["shoulderBack", "armBack", -3.1],
    ["elbowBack", "foreBack", -2.1],
    ["shoulderFront", "arm", 2.9],
    ["elbowFront", "fore", 3.9],
  ] as const) {
    bones.push({ name, parent, rest: {} });
    skin.push({
      bone: name,
      texture: "joint",
      width: boss ? 20 : hero ? 8 : 9,
      height: boss ? 20 : hero ? 8 : 9,
      depth,
    });
  }
  return {
    support: {
      enabled: !moth,
      shift: boss ? 6 : hero ? 3.5 : 4,
      response: boss ? 10 : 18,
      counterLean: boss ? 0.009 : 0.016,
      lift: boss ? 10 : hero ? 12 : 8,
    },
    bob: boss ? 3 : hero ? 2.7 : moth ? 1.8 : 2.1,
    sway: boss ? 2.4 : hero ? 1.1 : 2,
    lean: boss ? 0.22 : hero ? 0.19 : moth ? 0.12 : 0.28,
    knees: hero ? [-1, -1] : boss ? [1, -1] : [-1, 1],
    kind,
    bones,
    skin,
    leg,
    footSpan: boss ? 29 : hero ? 7 : 12,
    stride: boss ? 105 : hero ? 74 : 46,
    stance: hero ? 0.6 : 0.66,
  };
}
const track = (
  bone: string,
  channel: Track["channel"],
  duration: number,
  values: number[],
): Track => ({
  bone,
  channel,
  keys: values.map((value, n) => ({
    time: (duration * n) / (values.length - 1),
    value,
    ease: "smooth",
  })),
});
const cache = new Map<string, Clip>();
export function getClip(rig: Rig, action: Action): Clip {
  const key = `${rig.kind}:${action}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const hero = rig.kind === "hero",
    boss = rig.kind === "guardian";
  const durations: Partial<Record<Action, number>> = {
    slash: 0.38,
    "rising-slash": 0.38,
    "air-slash": 0.38,
    dash: 0.19,
    bind: 0.45,
    hurt: hero ? 0.24 : 0.2,
    defeat: 0.65,
    turn: 0.16,
    brake: 0.18,
    start: 0.16,
    launch: 0.16,
    land: 0.22,
    windup: rig.kind === "moth" ? 0.85 : boss ? 0.95 : 0.7,
    strike: boss ? 1.15 : 0.22,
    recover: 0.45,
    "slam-warn": 1.05,
    slam: boss ? 0.22 : 0.35,
  };
  const d = durations[action] ?? 1;
  const clip: Clip = {
    name: key,
    duration: d,
    loop: ["idle", "walk", "run", "rise", "apex", "fall", "bound"].includes(
      action,
    ),
    tracks: [],
    transition:
      action === "hurt"
        ? 0.025
        : action === "defeat"
          ? 0.045
          : ["slash", "rising-slash", "air-slash", "strike", "slam"].includes(
                action,
              )
            ? 0.035
            : action === "dash"
              ? 0.025
              : ["recover", "idle", "walk", "run"].includes(action)
                ? 0.12
                : 0.075,
  };
  const add = (bone: string, channel: Track["channel"], values: number[]) =>
    clip.tracks.push(track(bone, channel, d, values));
  if (["slash", "rising-slash", "air-slash"].includes(action)) {
    // Pose keys at 0 / .06 / .085 (damage) / .16 / .27 / .38 seconds.
    const up = action === "rising-slash";
    const times = [0, 0.06, 0.075, 0.085, 0.16, 0.27, 0.38];
    const arm = up
      ? [-0.2, -1.2, -1.7, -2.1, -2.8, -0.7, -0.2]
      : [-0.2, 1.8, -0.8, -1.9, -2.3, -0.5, -0.2];
    const fore = [-0.4, -1.5, -0.3, 0.2, 0.8, 0.1, -0.4];
    const torso = up
      ? [0, 0.24, 0.12, -0.05, -0.3, -0.1, 0]
      : [0, -0.32, -0.1, 0.2, 0.36, 0.12, 0];
    const airborne = action === "air-slash";
    const roll = airborne
      ? [0, -0.24, -0.08, 0.12, 0.28, 0.05, 0]
      : times.map(() => 0);
    const blade = up
      ? [0.4, 2.7, 1.9, 0.5, -0.8, 0.1, 0.4]
      : [0.4, -1, 0.3, 1.15, 2.6, 1, 0.4];
    const timed = (bone: string, channel: Track["channel"], values: number[]) =>
      clip.tracks.push({
        bone,
        channel,
        unwrapped: true,
        keys: values.map((value, i) => ({
          time: times[i],
          value,
          ease: "smooth",
        })),
      });
    timed("arm", "rotation", arm);
    timed("arm", "x", [9, 7, 9, 12, 13, 10, 9]);
    timed("fore", "rotation", fore);
    timed(
      "weapon",
      "rotation",
      blade.map((a, i) => a - arm[i] - fore[i] - torso[i] - roll[i]),
    );
    timed("root", "rotation", roll);
    timed("torso", "rotation", torso);
    timed("head", "rotation", [0, 0.12, 0.02, -0.1, -0.14, -0.05, 0]);
    timed("hip", "x", up ? [0, -2, 1, 3, 2, 0.5, 0] : [0, -3, 1, 4, 4, 1, 0]);
    timed(
      "hip",
      "y",
      up
        ? [-30, -26, -28, -30, -33, -29, -30]
        : [-30, -28, -29, -30, -29, -29, -30],
    );
    timed("armBack", "rotation", [
      0.2,
      airborne ? -1.1 : up ? -0.6 : 0.9,
      airborne ? -0.8 : 0.5,
      airborne ? -1.25 : -0.8,
      airborne ? -0.95 : -0.5,
      0.1,
      0.2,
    ]);
    timed(
      "foreBack",
      "rotation",
      [-0.3, -0.85, -0.6, -0.25, -0.4, -0.35, -0.3],
    );
    timed("torso", "scaleY", [1, 0.94, 0.98, 1.04, 1.06, 0.98, 1]);
    timed("torso", "scaleX", [1, 1.05, 1.02, 0.97, 0.96, 1.02, 1]);
    clip.events = [{ time: 0.065, name: "swing" }];
  } else if (action === "bind") {
    add("arm", "rotation", [-0.2, 1.1, -1.7, -1.5, -0.2]);
    add("fore", "rotation", [-0.4, -1.2, -0.5, -0.3, -0.4]);
    add("torso", "rotation", [0, -0.12, 0.16, 0.1, 0]);
    clip.events = [{ time: 0.12, name: "cast" }];
  } else if (action === "dash") {
    add("torso", "rotation", [0.15, 0.65, 0.6, 0.2]);
    add("head", "rotation", [-0.15, -0.3, -0.3, 0]);
    add("arm", "rotation", [0.3, 1.2, 1, 0.2]);
    add("fore", "rotation", [-0.3, -0.6, -0.6, -0.4]);
    add("hip", "y", [-27, -22, -23, -28]);
    add("armBack", "rotation", [0.4, 1.45, 1.25, 0.35]);
    add("foreBack", "rotation", [-0.4, -0.9, -0.7, -0.35]);
    add("torso", "scaleY", [0.98, 0.93, 0.96, 1]);
  } else if (action === "hurt") {
    add("torso", "rotation", [0, -0.38, -0.18, 0]);
    add("head", "rotation", [0, -0.2, -0.1, 0]);
    add("hip", "x", [0, -5, -3, 0]);
    add("arm", "rotation", [-0.7, -1.2, -0.7, -0.2]);
    add("hip", "y", [
      rig.bones[1].rest.y! + 4,
      rig.bones[1].rest.y! + 5,
      rig.bones[1].rest.y! + 2,
      rig.bones[1].rest.y!,
    ]);
    add("torso", "scaleY", [0.91, 0.94, 0.98, 1]);
    add("armBack", "rotation", [0.8, 0.5, 0.3, 0.2]);
  } else if (action === "defeat") {
    add("root", "rotation", [0, -0.3, -1.3, -1.45]);
    add("root", "y", [0, -5, -7, -8]);
    add("root", "alpha", [1, 1, 0.8, 0]);
  } else if (action === "windup" || action === "slam-warn") {
    add("torso", "rotation", [0, -0.12, -0.26]);
    add("hip", "y", [
      rig.bones[1].rest.y!,
      rig.bones[1].rest.y! + (action === "slam-warn" ? -15 : 6),
    ]);
    add("arm", "rotation", [0, action === "slam-warn" ? -2.8 : 1.2]);
    add("fore", "rotation", [0, -0.8]);
    add("armBack", "rotation", [0, action === "slam-warn" ? 2.6 : -0.7]);
    add("head", "rotation", [0, 0.13]);
  } else if (action === "strike" || action === "slam") {
    add("torso", "rotation", [action === "slam" ? -0.15 : 0.25, 0.5, 0.2]);
    add("arm", "rotation", [action === "slam" ? -2.8 : -1.5, -0.4, 0.1]);
    add("hip", "y", [
      rig.bones[1].rest.y! - 5,
      rig.bones[1].rest.y! + 9,
      rig.bones[1].rest.y! + 3,
    ]);
    if (action === "slam") clip.events = [{ time: 0.1, name: "impact" }];
  } else if (action === "recover" || action === "land") {
    const y = rig.bones[1].rest.y!;
    add("hip", "y", [y + 5, y + 7, y]);
    add("torso", "rotation", [0.2, 0.12, 0]);
    add("arm", "rotation", [-0.8, -0.4, -0.2]);
    if (action === "land") clip.events = [{ time: 0, name: "land" }];
  } else if (action === "launch") {
    add("hip", "y", [-23, -30, -28]);
    add("arm", "rotation", [0.5, -1.7, -0.6]);
    add("fore", "rotation", [-0.4, -1, -0.5]);
  } else if (action === "rise" || action === "apex" || action === "fall") {
    add("arm", "rotation", action === "fall" ? [-1, -1.1] : [-0.7, -0.8]);
    add("fore", "rotation", [-0.9, -0.8]);
    add("armBack", "rotation", [0.8, 0.7]);
    add("head", "rotation", action === "fall" ? [0.1, 0.12] : [-0.08, -0.05]);
  } else if (action === "bound") {
    add("torso", "rotation", [-0.04, 0.04, -0.04]);
    add("arm", "rotation", [-0.9, -0.82, -0.9]);
    add("fore", "rotation", [-1.1, -1, -1.1]);
    add("head", "rotation", [0.08, -0.05, 0.08]);
  } else if (action === "start") {
    add("torso", "rotation", [0, 0.22, 0.15]);
    add("hip", "y", [
      rig.bones[1].rest.y!,
      rig.bones[1].rest.y! + 3,
      rig.bones[1].rest.y!,
    ]);
  } else if (action === "brake" || action === "turn") {
    add("torso", "rotation", [-0.28, -0.15, 0]);
    add("arm", "rotation", [-0.8, -0.4, -0.2]);
  }
  const replace = (
    bone: string,
    channel: Track["channel"],
    values: number[],
  ) => {
    clip.tracks = clip.tracks.filter(
      (t) => t.bone !== bone || t.channel !== channel,
    );
    add(bone, channel, values);
  };
  const hip = rig.bones[1].rest.y!;
  if (!hero && action === "windup") {
    replace("hip", "y", [hip, hip + (boss ? 7 : 5), hip + (boss ? 10 : 7)]);
    replace("torso", "rotation", [0, -0.22, -0.34]);
    replace("armBack", "rotation", [0.2, 0.8, 1.1]);
    replace("head", "rotation", [0, 0.1, 0.2]);
  }
  if (!hero && action === "strike") {
    replace("torso", "rotation", [0.25, boss ? 0.48 : 0.65, 0.38, 0.18]);
    replace("hip", "y", [hip + 4, hip - (boss ? 2 : 7), hip - 2, hip + 3]);
    replace("armBack", "rotation", [0.9, 1.45, 1.1, 0.2]);
    replace("head", "rotation", [-0.15, -0.24, -0.12, 0]);
  }
  if (boss && action === "strike") {
    // Charge lasts up to 1.15s: keep the driving posture until logic recovers.
    for (const [bone, channel, values] of [
      ["hip", "y", [hip + 4, hip - 3, hip - 2, hip - 3, hip - 2]],
      ["torso", "rotation", [0.25, 0.52, 0.44, 0.47, 0.44]],
      ["arm", "rotation", [-1.5, -0.8, -0.5, -0.55, -0.5]],
      ["armBack", "rotation", [0.9, 1.45, 1.2, 1.3, 1.2]],
      ["head", "rotation", [-0.15, -0.26, -0.2, -0.22, -0.2]],
    ] as [string, Track["channel"], number[]][]) {
      clip.tracks = clip.tracks.filter(
        (t) => t.bone !== bone || t.channel !== channel,
      );
      clip.tracks.push({
        bone,
        channel,
        keys: values.map((value, i) => ({
          time: [0, 0.08, 0.2, 0.95, 1.15][i],
          value,
          ease: "smooth",
        })),
      });
    }
  }
  if (boss && action === "slam-warn") {
    replace("hip", "y", [hip + 5, hip - 10, hip - 19, hip - 20]);
    replace("torso", "rotation", [0.12, -0.16, -0.3, -0.34]);
    replace("fore", "rotation", [-0.4, -0.9, -1.2, -1.1]);
    // Roots spawn at slam age zero. Complete the downstroke at the END of
    // the unchanged 1.05s warning so visual contact and gameplay agree.
    for (const [bone, channel, values] of [
      ["hip", "y", [hip + 5, hip - 10, hip - 20, hip - 20, hip + 15]],
      ["torso", "rotation", [0.12, -0.16, -0.34, -0.34, 0.62]],
      ["arm", "rotation", [0, -2.2, -2.8, -2.8, -0.4]],
      ["armBack", "rotation", [0, 2.1, 2.6, 2.6, -0.4]],
    ] as [string, Track["channel"], number[]][]) {
      clip.tracks = clip.tracks.filter(
        (t) => t.bone !== bone || t.channel !== channel,
      );
      clip.tracks.push({
        bone,
        channel,
        keys: values.map((value, i) => ({
          time: [0, 0.5, 0.82, 0.94, 1.05][i],
          value,
          ease: "smooth",
        })),
      });
    }
  }
  if (boss && action === "slam") {
    clip.transition = 0;
    clip.events = [{ time: 0, name: "impact" }];
    replace("hip", "y", [hip + 15, hip + 12, hip + 9, hip + 5]);
    replace("torso", "rotation", [0.62, 0.53, 0.4, 0.2]);
    replace("arm", "rotation", [-0.4, -0.3, -0.1, 0.1]);
    replace("armBack", "rotation", [-0.4, -0.3, -0.1, 0.2]);
    replace("head", "rotation", [-0.25, -0.2, -0.12, 0]);
    replace("torso", "scaleY", [0.88, 0.91, 0.95, 1]);
  }
  if (rig.kind === "moth") {
    if (action === "windup") replace("torso", "rotation", [0, -0.18, -0.5]);
    if (action === "strike")
      replace("torso", "rotation", [-0.2, 0.55, 0.35, 0.1]);
    if (action === "hurt") replace("root", "rotation", [-0.25, 0.23, -0.08, 0]);
    if (action === "recover")
      replace("torso", "rotation", [0.4, -0.18, 0.08, 0]);
  }
  if (rig.kind === "moss") {
    if (action === "windup") {
      replace("hip", "y", [hip, hip + 4, hip + 8]);
      replace("torso", "scaleY", [1, 0.94, 0.85]);
      replace("torso", "scaleX", [1, 1.05, 1.14]);
      replace("head", "rotation", [0, 0.18, 0.3]);
    }
    if (action === "strike") {
      replace("torso", "rotation", [0.42, 0.83, 0.65, 0.45]);
      replace("torso", "scaleY", [0.9, 1.15, 1.08, 0.95]);
      replace("torso", "scaleX", [1.1, 0.88, 0.94, 1.04]);
      replace("hip", "y", [hip + 6, hip - 9, hip - 3, hip + 4]);
      replace("arm", "rotation", [-1.4, -1.65, -0.6, -0.2]);
    }
    if (action === "recover") {
      replace("hip", "y", [hip + 6, hip + 7, hip + 2, hip]);
      replace("torso", "scaleY", [0.85, 0.9, 1.03, 1]);
      replace("torso", "scaleX", [1.14, 1.08, 0.98, 1]);
    }
  }
  if (rig.kind === "moth") {
    const folded = action === "windup" ? 0.32 : action === "strike" ? 0.24 : 1;
    add("wingBack", "scaleX", [action === "windup" ? 1 : folded, folded]);
    add("wingFront", "scaleX", [action === "windup" ? 1 : folded, folded]);
    add(
      "wingBack",
      "rotation",
      action === "windup"
        ? [-0.45, -0.95]
        : action === "strike"
          ? [-0.95, -0.8]
          : [-0.45, -0.45],
    );
    add(
      "wingFront",
      "rotation",
      action === "windup"
        ? [0.3, 0.85]
        : action === "strike"
          ? [0.85, 0.7]
          : [0.3, 0.3],
    );
    add(
      "abdomen",
      "rotation",
      action === "strike"
        ? [-0.5, 0.3, 0.1]
        : action === "windup"
          ? [-0.15, -0.6]
          : [-0.15, -0.05, -0.15],
    );
    if (action === "windup") replace("torso", "rotation", [0, -0.4, -0.7]);
    if (action === "strike")
      replace("torso", "rotation", [-0.2, 0.75, 0.6, 0.28]);
    if (action === "recover") {
      replace("torso", "rotation", [0.65, -0.35, 0.15, 0]);
      replace("wingFront", "scaleX", [0.24, 1.15, 1]);
      replace("wingBack", "scaleX", [0.24, 1.15, 1]);
    }
  }
  if (boss && action === "recover") {
    replace("hip", "y", [hip + 8, hip + 4, hip - 1, hip]);
    replace("torso", "rotation", [0.45, 0.3, -0.08, 0]);
    replace("torso", "scaleY", [0.89, 0.94, 1.04, 1]);
  }
  if (rig.kind === "moss") {
    if (action === "windup") {
      replace("hip", "x", [0, -3, -6]);
      replace("armBack", "rotation", [0.2, 0.9, 1.4]);
      replace("foreBack", "rotation", [-0.3, -0.9, -1.2]);
    }
    if (action === "strike") {
      replace("hip", "x", [-6, 1, 7, 3]);
      replace("armBack", "rotation", [1.4, 0.6, -1.3, -0.3]);
      replace("fore", "rotation", [-0.8, -0.15, 0.6, -0.2]);
      replace("head", "rotation", [0.2, -0.22, -0.1, 0.05]);
    }
    if (action === "recover") replace("hip", "x", [5, 2, -1, 0]);
  }
  if (rig.kind === "moth") {
    if (action === "windup") {
      replace("abdomen", "rotation", [-0.15, 0.15, 0.5]);
      replace("head", "rotation", [0, 0.18, 0.32]);
      replace("wingBack", "scaleX", [1, 0.7, 0.28]);
      replace("wingFront", "scaleX", [1, 0.95, 0.32]);
    }
    if (action === "strike")
      replace("abdomen", "rotation", [0.5, -0.55, -0.3, 0.05]);
    if (action === "recover")
      replace("abdomen", "rotation", [-0.3, 0.3, -0.15, -0.1]);
    if (action === "hurt") {
      replace("root", "rotation", [-0.2, 0.48, -0.16, 0]);
      replace("wingBack", "rotation", [-0.6, -1.2, -0.3, -0.45]);
      replace("wingFront", "rotation", [0.2, 0.85, 0.05, 0.3]);
    }
  }
  if (boss && action === "windup") {
    replace("hip", "x", [0, -4, -7]);
    replace("head", "rotation", [0, 0.1, 0.24]);
    replace("foreBack", "rotation", [-0.3, -0.6, -1]);
  }
  if (boss && action === "strike") {
    replace("hip", "x", [-5, 3, 5, 4]);
    replace("head", "rotation", [-0.2, -0.3, -0.2, -0.18]);
    replace("fore", "rotation", [-0.7, -0.15, 0.1, 0]);
  }
  if (hero && action === "bind") {
    replace("hip", "x", [0, -3, 2, 4, 0]);
    replace("armBack", "rotation", [0.2, 0.8, 0.9, 0.4, 0.2]);
    replace("head", "rotation", [0, 0.1, -0.12, -0.1, 0]);
  }
  if (hero && action === "dash") replace("hip", "x", [-2, 4, 5, 0]);
  if (hero && (action === "brake" || action === "turn")) {
    replace("hip", "y", [hip, hip + 3, hip + 2, hip]);
    replace("hip", "x", [0, -2, -1, 0]);
    replace("torso", "rotation", [-0.16, -0.12, 0.04, 0]);
    replace("armBack", "rotation", [0.45, 0.7, 0.35, 0.2]);
    replace("head", "rotation", [0.08, 0.04, -0.02, 0]);
  }
  if (hero && action === "launch") {
    replace("hip", "y", [hip + 4, hip - 2, hip]);
    replace("torso", "rotation", [0.12, -0.08, -0.04]);
    replace("armBack", "rotation", [0.6, -0.85, -0.25]);
  }
  if (rig.kind === "moss" && action === "strike") {
    replace("torso", "rotation", [0.32, 0.58, 0.5, 0.32]);
    replace("hip", "y", [hip + 5, hip - 5, hip - 2, hip + 4]);
    replace("torso", "scaleY", [0.93, 1.1, 1.04, 0.96]);
  }
  // Continuous first derivatives through interior poses: momentum no longer
  // stops at every authored key. Contact and gameplay durations remain fixed.
  if (!["idle", "walk", "run", "bound"].includes(action))
    for (const t of clip.tracks) {
      t.interpolation = "hermite";
      for (let i = 0; i < t.keys.length; i++) {
        const k = t.keys[i],
          a = t.keys[Math.max(0, i - 1)],
          b = t.keys[Math.min(t.keys.length - 1, i + 1)];
        const slope =
          i === 0 || i === t.keys.length - 1
            ? 0
            : (b.value - a.value) / Math.max(1e-6, b.time - a.time);
        k.tangentIn = k.tangentOut = slope;
      }
    }
  cache.set(key, clip);
  return clip;
}
