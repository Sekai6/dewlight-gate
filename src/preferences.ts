export interface Preferences {
  muted: boolean;
  volume: number;
  reduced: boolean;
  guide: boolean;
  shake: boolean;
  contrast: boolean;
}
export const defaultPreferences = (): Preferences => ({
  muted: false,
  volume: 0.35,
  reduced: false,
  guide: true,
  shake: true,
  contrast: false,
});
export function parsePreferences(raw: string | null): Preferences {
  const defaults = defaultPreferences();
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return defaults;
    for (const key of [
      "muted",
      "reduced",
      "guide",
      "shake",
      "contrast",
    ] as const)
      if (typeof value[key] === "boolean") defaults[key] = value[key];
    if (typeof value.volume === "number" && Number.isFinite(value.volume))
      defaults.volume = Math.max(0, Math.min(1, value.volume));
    return defaults;
  } catch {
    return defaults;
  }
}
