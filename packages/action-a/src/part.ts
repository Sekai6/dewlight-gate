/** The slice of a texture a part draws; a renderer supplies its own frame type. */
export interface PartFrame {
  cutWidth: number;
  cutHeight: number;
}
/** One sprite of a rig as plain pose data. Solvers write it, a renderer draws it. */
export class RigPart<Frame extends PartFrame = PartFrame> {
  revision = 0;
  matrix: { a: number; b: number; c: number; d: number } | null = null;
  setMatrix(a: number, b: number, c: number, d: number) {
    const m = this.matrix;
    if (!m || m.a !== a || m.b !== b || m.c !== c || m.d !== d) this.revision++;
    if (m) {
      m.a = a;
      m.b = b;
      m.c = c;
      m.d = d;
    } else this.matrix = { a, b, c, d };
    return this;
  }
  x = 0;
  y = 0;
  rotation = 0;
  alpha = 1;
  displayWidth = 1;
  displayHeight = 1;
  originX = 0.5;
  originY = 0.5;
  readonly frame: Frame;
  constructor(frame: Frame) {
    this.frame = frame;
  }
  setPosition(x: number, y: number) {
    if (this.x !== x || this.y !== y) this.revision++;
    this.x = x;
    this.y = y;
    return this;
  }
  setRotation(r: number) {
    if (this.rotation !== r || this.matrix) this.revision++;
    this.matrix = null;
    this.rotation = r;
    return this;
  }
  setDisplaySize(w: number, h: number) {
    if (this.displayWidth !== w || this.displayHeight !== h) this.revision++;
    this.displayWidth = w;
    this.displayHeight = h;
    return this;
  }
  setOrigin(x: number, y: number) {
    if (this.originX !== x || this.originY !== y) this.revision++;
    this.originX = x;
    this.originY = y;
    return this;
  }
  setAlpha(a: number) {
    if (this.alpha !== a) this.revision++;
    this.alpha = a;
    return this;
  }
  // Hurt flashes remain in the existing gameplay effects, not per-part tint copies.
  setTint(_color: number) {
    return this;
  }
}
