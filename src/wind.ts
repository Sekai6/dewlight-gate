export interface WindZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  push: number;
  lift: number;
  name: string;
}

// Optional shortcuts sit above broad safe ground; the original route is intact.
export const windZones: WindZone[] = Array.from({ length: 6 }, (_, room) => [
  {
    id: `wind-rise-${room}`,
    x: room * 6000 + 1640,
    y: 710,
    w: 230,
    h: 390,
    push: 0,
    lift: 1850,
    name: "蒲苇上升风",
  },
  {
    id: `wind-glide-${room}`,
    x: room * 6000 + 3500,
    y: 720,
    w: 650,
    h: 350,
    push: room % 2 ? -95 : 95,
    lift: 400,
    name: room % 2 ? "西行花信风" : "东行花信风",
  },
]).flat();

export function sampleWind(
  x: number,
  feetY: number,
  clock: number,
  turned: Record<string, number> = {},
) {
  const zone = windZones.find(
    (z) => x >= z.x && x <= z.x + z.w && feetY > z.y && feetY <= z.y + z.h + 4,
  );
  if (!zone) return { x: 0, lift: 0, zone: undefined };
  const edge = Math.min(1, (x - zone.x) / 35, (zone.x + zone.w - x) / 35);
  const gust = 0.94 + Math.sin(clock * 1.6) * 0.06;
  return {
    x: zone.push * (clock < (turned[zone.id] ?? -1) ? -1 : 1) * edge * gust,
    lift: zone.lift * edge * gust,
    zone,
  };
}
