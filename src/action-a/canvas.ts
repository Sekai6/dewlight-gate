import Phaser from "phaser";

/** Lightweight pose data: parts never enter the Phaser display list. */
export class CanvasPart {
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
  constructor(readonly frame: Phaser.Textures.Frame) {}
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

/** One render-list object, one camera transform, ordered draws of cached parts. */
export function attachCanvasRig(
  container: Phaser.GameObjects.Container,
  parts: () => Iterable<CanvasPart>,
  extent = 128,
) {
  const surface = document.createElement("canvas");
  surface.width = surface.height = extent * 4;
  const paint = surface.getContext("2d", { willReadFrequently: true })!;
  let revision = -1;
  let ordered: CanvasPart[] | undefined;
  container.setBlendMode(Phaser.BlendModes.NORMAL);
  Object.assign(container, {
    renderCanvas(
      renderer: Phaser.Renderer.Canvas.CanvasRenderer,
      src: Phaser.GameObjects.Container,
      camera: Phaser.Cameras.Scene2D.Camera,
    ) {
      if (src.alpha <= 0) return;
      camera.addToRenderList(src);
      const ctx = renderer.currentContext;
      const matrix = Phaser.GameObjects.GetCalcMatrix(src, camera).calc;
      ctx.save();
      matrix.setToContext(ctx);
      ctx.globalCompositeOperation = "source-over";
      ctx.imageSmoothingEnabled = true;
      // Rig construction finishes before first render; its part order is fixed.
      ordered ??= Array.from(parts());
      let current = 0;
      for (const p of ordered) current += p.revision;
      if (current !== revision) {
        revision = current;
        paint.setTransform(1, 0, 0, 1, 0, 0);
        paint.clearRect(0, 0, surface.width, surface.height);
        for (const p of ordered) {
          if (p.alpha <= 0) continue;
          const f = p.frame;
          const a = p.matrix?.a ?? Math.cos(p.rotation),
            b = p.matrix?.b ?? Math.sin(p.rotation),
            c = p.matrix?.c ?? -b,
            d = p.matrix?.d ?? a;
          // Absolute transforms avoid a Canvas save/translate/rotate/restore
          // stack for every limb while retaining exactly the same affine pose.
          paint.setTransform(
            a * 2,
            b * 2,
            c * 2,
            d * 2,
            (extent + p.x) * 2,
            (extent + p.y) * 2,
          );
          paint.globalAlpha = p.alpha;
          paint.drawImage(
            f.source.image as CanvasImageSource,
            f.cutX,
            f.cutY,
            f.cutWidth,
            f.cutHeight,
            -p.originX * p.displayWidth,
            -p.originY * p.displayHeight,
            p.displayWidth,
            p.displayHeight,
          );
        }
      }
      ctx.globalAlpha = camera.alpha * src.alpha;
      ctx.drawImage(surface, -extent, -extent, extent * 2, extent * 2);
      ctx.restore();
    },
  });
}
