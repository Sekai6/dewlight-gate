export interface Save {
  version: 2;
  checkpoint: number;
  beads: string[];
  stones: number[];
  logs: string[];
  elapsed: number;
  lenses: string[];
  angles: Record<string, number>;
  trials: string[];
  position: { x: number; y: number } | null;
}
export const fresh = (): Save => ({
  version: 2,
  checkpoint: 0,
  beads: [],
  stones: [],
  logs: ["你穿过 GATE，来到晨露尚未散去的庭院。"],
  elapsed: 0,
  lenses: [],
  angles: {},
  trials: [],
  position: null,
});
export const KEY = "dewlight.save.v2";
export function parseSave(raw: string | null): Save | null {
  try {
    const s = JSON.parse(raw || "null");
    if (
      !s ||
      s.version !== 2 ||
      !Number.isInteger(s.checkpoint) ||
      s.checkpoint < 0 ||
      s.checkpoint > 3 ||
      !Array.isArray(s.beads) ||
      !s.beads.every((x: unknown) => typeof x === "string") ||
      !Array.isArray(s.stones) ||
      !s.stones.every(
        (x: unknown) => Number.isInteger(x) && Number(x) >= 0 && Number(x) < 3,
      ) ||
      !Array.isArray(s.logs) ||
      (s.trials !== undefined &&
        (!Array.isArray(s.trials) ||
          !s.trials.every(
            (x: unknown) =>
              typeof x === "string" && /^(rise|turn|seal)-[0-5]$/.test(x),
          ))) ||
      (s.lenses !== undefined &&
        (!Array.isArray(s.lenses) ||
          !s.lenses.every(
            (x: unknown) =>
              typeof x === "string" && /^lens-[0-5]-[0-3]$/.test(x),
          ))) ||
      !s.logs.every((x: unknown) => typeof x === "string") ||
      !Number.isFinite(s.elapsed) ||
      s.elapsed < 0
    )
      return null;
    return {
      ...s,
      stones: [...new Set<number>(s.stones)],
      beads: [...new Set<string>(s.beads)],
      lenses: [...new Set<string>(s.lenses ?? [])],
      trials: [...new Set<string>(s.trials ?? [])],
      position:
        s.position &&
        typeof s.position === "object" &&
        Number.isFinite(s.position.x) &&
        Number.isFinite(s.position.y)
          ? { x: s.position.x, y: s.position.y }
          : null,
      angles:
        s.angles && typeof s.angles === "object" && !Array.isArray(s.angles)
          ? Object.fromEntries(
              Object.entries(s.angles).filter(
                ([key, value]) =>
                  /^lens-[0-5]-[0-3]$/.test(key) &&
                  Number.isInteger(value) &&
                  Number(value) >= 0 &&
                  Number(value) < 4,
              ),
            )
          : {},
    };
  } catch {
    return null;
  }
}
export function collect(s: Save, id: string): boolean {
  if (s.beads.includes(id)) return false;
  s.beads.push(id);
  return true;
}
export const names = ["晨露碑", "折光碑", "蔓生碑"];
export const stories = [
  "愿你记得，微小的露珠也能托住整个清晨。",
  "光会在破碎的地方转弯，而旅程仍会继续。",
  "生长并不总要向上，也可以是朝彼此伸出枝条。",
];
export const formatTime = (ms: number) =>
  `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0")}:${Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, "0")}`;
