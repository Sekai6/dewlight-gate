import type { WorldTransform } from "./core.ts";

/** Reset the basis to a pure rotation: no inherited scale or shear. */
export function rigidify(t: WorldTransform) {
  t.a = Math.cos(t.rotation);
  t.b = Math.sin(t.rotation);
  t.c = -t.b;
  t.d = t.a;
  t.scaleX = t.scaleY = 1;
}
/** Place a rigid bone at (x, y) with its +Y axis pointing at (tx, ty). */
export function aimBone(
  t: WorldTransform,
  x: number,
  y: number,
  tx: number,
  ty: number,
) {
  t.x = x;
  t.y = y;
  t.rotation = Math.atan2(ty - y, tx - x) - Math.PI / 2;
  rigidify(t);
}
/** Rotate only the basis; the bone origin stays put. */
export function rotateBasis(t: WorldTransform, angle: number) {
  const cos = Math.cos(angle),
    sin = Math.sin(angle),
    a = t.a,
    b = t.b,
    c = t.c,
    d = t.d;
  t.a = cos * a - sin * b;
  t.b = sin * a + cos * b;
  t.c = cos * c - sin * d;
  t.d = sin * c + cos * d;
  t.rotation += angle;
}
/** Rotate a set of bones as one rigid group about a pivot. */
export function rotateAbout(
  bones: Iterable<WorldTransform | undefined>,
  px: number,
  py: number,
  angle: number,
) {
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  for (const t of bones) {
    if (!t) continue;
    const x = t.x - px,
      y = t.y - py,
      a = t.a,
      b = t.b,
      c = t.c,
      d = t.d;
    t.x = px + cos * x - sin * y;
    t.y = py + sin * x + cos * y;
    t.a = cos * a - sin * b;
    t.b = sin * a + cos * b;
    t.c = cos * c - sin * d;
    t.d = sin * c + cos * d;
    t.rotation += angle;
  }
}
