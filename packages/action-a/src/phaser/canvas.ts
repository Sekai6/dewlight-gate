import Phaser from "phaser";

import type { RigPart } from "../part.ts";

export type PhaserPart = RigPart<Phaser.Textures.Frame>;

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
  parts: () => Iterable<PhaserPart>,
  extent = 128,
) {
  let surface: HTMLCanvasElement | undefined;
  let paint: CanvasRenderingContext2D | undefined;
  let revision = -1;
  let ordered: PhaserPart[] | undefined;
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
  parts: readonly PhaserPart[],
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
