import type { Clip, Track } from "./core";
/** Authored force chains. Weapon targets are separately constrained by CONTACT. */
export function skillClip(action: string, kind: string): Clip | undefined {
  const durations: Record<string, number> = {
    "skill-branch": 0.38,
    "skill-rise": 0.5,
    "skill-bloom": 0.76,
    "crystal-warn": 1,
    crystal: 2.2,
    "garden-warn": 1.1,
    garden: 0.65,
    "radiance-warn": 1.25,
    radiance: 0.4,
  };
  const duration = durations[action];
  if (!duration) return;
  const tracks: Track[] = [];
  const add = (
    bone: string,
    channel: Track["channel"],
    values: number[],
    times?: number[],
  ) => {
    const ts =
      times ?? values.map((_, i) => (i / (values.length - 1)) * duration);
    tracks.push({
      bone,
      channel,
      interpolation: "hermite",
      unwrapped: channel === "rotation",
      keys: values.map((value, i) => {
        const tangent =
          i === 0 || i === values.length - 1
            ? 0
            : (values[i + 1] - values[i - 1]) / (ts[i + 1] - ts[i - 1]);
        return { time: ts[i], value, tangentIn: tangent, tangentOut: tangent };
      }),
    });
  };
  if (action === "skill-branch") {
    const t = [0, 0.07, 0.1, 0.17, 0.26, 0.38];
    add("hip", "y", [-30, -26, -28, -33, -29, -30], t);
    add("hip", "rotation", [0, -0.2, 0.1, 0.3, 0.1, 0], t);
    add("torso", "rotation", [0, -0.4, -0.1, 0.45, 0.2, 0], t);
    add("armBack", "rotation", [0, 0.6, 1.2, 1.8, 0.7, 0], t);
    add("foreBack", "rotation", [0, -0.8, -1.2, -0.7, -0.3, 0], t);
    add("head", "rotation", [0, 0.1, -0.12, -0.25, -0.1, 0], t);
    add("torso", "scaleX", [1, 0.95, 1.02, 1.08, 1.02, 1], t);
    add("hip", "x", [0, -3, 1, 5, 2, 0], t);
    add("torso", "y", [-9, -7, -10, -11, -9, -9], t);
  } else if (action === "skill-rise") {
    const t = [0, 0.09, 0.14, 0.23, 0.34, 0.5];
    add("hip", "y", [-30, -24, -29, -34, -32, -30], t);
    add("hip", "rotation", [0, 0.18, -0.15, -0.3, -0.15, 0], t);
    add("torso", "rotation", [0, 0.34, -0.15, -0.5, -0.2, 0], t);
    add("armBack", "rotation", [0, 0.7, 1.8, 2.3, 1, 0], t);
    add("foreBack", "rotation", [-0.3, -1, -1.5, -0.6, -0.3, 0], t);
    add("head", "rotation", [0, -0.15, 0.1, 0.2, 0.1, 0], t);
    add("torso", "scaleY", [1, 0.88, 1.04, 1.12, 1.04, 1], t);
    add("hip", "x", [0, -2, 2, 3, 1, 0], t);
    add("torso", "y", [-9, -6, -10, -12, -10, -9], t);
    add("torso", "scaleX", [1, 1.08, 0.98, 0.94, 0.98, 1], t);
  } else if (action === "skill-bloom") {
    const t = [0, 0.08, 0.14, 0.22, 0.3, 0.38, 0.46, 0.57, 0.76];
    add("hip", "rotation", [0, -0.3, 0.25, -0.2, 0.3, -0.2, 0.25, 0.1, 0], t);
    add(
      "torso",
      "rotation",
      [0, -0.45, 0.4, -0.35, 0.45, -0.35, 0.4, 0.15, 0],
      t,
    );
    add(
      "head",
      "rotation",
      [0, 0.15, -0.18, 0.15, -0.18, 0.15, -0.18, -0.05, 0],
      t,
    );
    add("armBack", "rotation", [0, 0.7, 1.9, 1.2, 2.2, 1.2, 2.2, 0.9, 0], t);
    add(
      "foreBack",
      "rotation",
      [-0.3, -1.7, -0.4, -1.1, -0.4, -1.1, -0.4, -0.7, -0.3],
      t,
    );
    add("torso", "scaleY", [1, 0.88, 1.06, 0.96, 1.06, 0.96, 1.06, 1.02, 1], t);
    add("hip", "y", [-30, -26, -32, -29, -33, -29, -32, -31, -30], t);
    add("hip", "x", [0, -2, 3, -2, 3, -2, 3, 1, 0], t);
    add("torso", "scaleX", [1, 1.09, 0.96, 1.03, 0.96, 1.03, 0.96, 1, 1], t);
  } else {
    const warning = action.endsWith("-warn");
    const crystal = action.startsWith("crystal"),
      garden = action.startsWith("garden");
    const hip = kind === "guardian" ? -49 : -30;
    add(
      "hip",
      "y",
      warning
        ? [hip, hip + 3, hip + 6, hip + 5]
        : [hip + 5, hip - 4, hip + 2, hip],
    );
    add(
      "torso",
      "rotation",
      warning
        ? [
            0,
            crystal ? -0.2 : garden ? 0.25 : -0.25,
            crystal ? -0.3 : garden ? 0.4 : -0.35,
            crystal ? -0.3 : garden ? 0.4 : -0.35,
          ]
        : [garden ? 0.4 : -0.3, garden ? -0.2 : 0.3, 0.12, 0],
    );
    add(
      "arm",
      "rotation",
      warning
        ? [
            0,
            -0.6,
            crystal ? -1.9 : garden ? 0.8 : -2.6,
            crystal ? -1.9 : garden ? 0.8 : -2.6,
          ]
        : [
            crystal ? -1.9 : garden ? 0.8 : -2.6,
            crystal ? -1.2 : garden ? -0.7 : -0.4,
            -0.5,
            0,
          ],
    );
    add(
      "armBack",
      "rotation",
      warning
        ? [
            0,
            0.5,
            crystal ? 1.8 : garden ? -0.6 : 2.5,
            crystal ? 1.8 : garden ? -0.6 : 2.5,
          ]
        : [
            crystal ? 1.8 : garden ? -0.6 : 2.5,
            crystal ? 1.1 : garden ? 0.6 : 0.5,
            0.3,
            0,
          ],
    );
    add(
      "crown",
      "rotation",
      warning ? [0, -0.08, -0.2, -0.25] : [-0.25, 0.22, -0.08, 0],
    );
    add(
      "torso",
      "scaleY",
      warning
        ? [1, 0.98, garden ? 0.9 : 1.1, garden ? 0.9 : 1.1]
        : [1.08, 0.92, 1.03, 1],
    );
    add(
      "head",
      "rotation",
      warning ? [0, 0.06, 0.12, 0.1] : [0.1, -0.12, 0.05, 0],
    );
    add("hip", "x", warning ? [0, -2, -4, -4] : [-4, 5, 2, 0]);
    add(
      "fore",
      "rotation",
      warning ? [0, 0.25, 0.65, 0.7] : [0.7, -0.3, 0.15, 0],
    );
    add(
      "foreBack",
      "rotation",
      warning ? [0, -0.25, -0.6, -0.7] : [-0.7, 0.3, -0.15, 0],
    );
  }
  return {
    name: `${kind}:${action}`,
    duration,
    loop: false,
    transition: 0.035,
    tracks,
  };
}
