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

/**
 * One render-list object drawing ordered rig parts.
 *
 * Opaque rigs draw straight onto the game canvas: source-over is associative,
 * so the result matches compositing through an intermediate surface without
 * the per-frame clear, repaint and scaled blit. Only a translucent group needs
 * the surface, so overlapping parts fade as one silhouette.
 */
export function attachCanvasRig(
  container: Phaser.GameObjects.Container,
  parts: () => Iterable<CanvasPart>,
  extent = 128,
) {
  let surface: HTMLCanvasElement | undefined;
  let paint: CanvasRenderingContext2D | undefined;
  let revision = -1;
  let ordered: CanvasPart[] | undefined;
  container.setBlendMode(Phaser.BlendModes.NORMAL);
  Object.assign(container, {
    renderCanvas(
      renderer: Phaser.Renderer.Canvas.CanvasRenderer,
      src: Phaser.GameObjects.Container,
      camera: Phaser.Cameras.Scene2D.Camera,
    ) {
      const alpha = camera.alpha * src.alpha;
      if (alpha <= 0) return;
      camera.addToRenderList(src);
      const ctx = renderer.currentContext;
      const m = Phaser.GameObjects.GetCalcMatrix(src, camera).calc;
      // Rig construction finishes before first render; its part order is fixed.
      ordered ??= Array.from(parts());
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.imageSmoothingEnabled = true;
      if (alpha >= 0.999) {
        drawParts(ctx, ordered, m.a, m.b, m.c, m.d, m.tx, m.ty, 1);
        ctx.restore();
        return;
      }
      if (!surface) {
        surface = document.createElement("canvas");
        surface.width = surface.height = extent * 4;
        paint = surface.getContext("2d")!;
      }
      let current = 0;
      for (const p of ordered) current += p.revision;
      if (current !== revision) {
        revision = current;
        paint!.setTransform(1, 0, 0, 1, 0, 0);
        paint!.clearRect(0, 0, surface.width, surface.height);
        drawParts(paint!, ordered, 2, 0, 0, 2, extent * 2, extent * 2, 1);
      }
      m.setToContext(ctx);
      ctx.globalAlpha = alpha;
      ctx.drawImage(surface, -extent, -extent, extent * 2, extent * 2);
      ctx.restore();
    },
  });
}

/** Draw every part under the affine (a b c d e f) with absolute transforms. */
function drawParts(
  ctx: CanvasRenderingContext2D,
  parts: readonly CanvasPart[],
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  alpha: number,
) {
  for (const p of parts) {
    if (p.alpha <= 0) continue;
    const frame = p.frame;
    const pa = p.matrix?.a ?? Math.cos(p.rotation),
      pb = p.matrix?.b ?? Math.sin(p.rotation),
      pc = p.matrix?.c ?? -pb,
      pd = p.matrix?.d ?? pa;
    ctx.setTransform(
      a * pa + c * pb,
      b * pa + d * pb,
      a * pc + c * pd,
      b * pc + d * pd,
      a * p.x + c * p.y + e,
      b * p.x + d * p.y + f,
    );
    ctx.globalAlpha = p.alpha * alpha;
    ctx.drawImage(
      frame.source.image as CanvasImageSource,
      frame.cutX,
      frame.cutY,
      frame.cutWidth,
      frame.cutHeight,
      -p.originX * p.displayWidth,
      -p.originY * p.displayHeight,
      p.displayWidth,
      p.displayHeight,
    );
  }
}
