import { test, expect } from "@playwright/test";

test("all protagonist poses retain transparent padding", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).dewlight);
  const clipped = await page.evaluate(() => {
    const failures: number[] = [];
    for (let frame = 0; frame < 180; frame++) {
      const source = (window as any).dewlight.textures
        .get(`hero-${frame}`)
        .getSourceImage() as HTMLCanvasElement;
      const { width: w, height: h } = source;
      const pixels = source.getContext("2d")!.getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (
            (x < 3 || y < 3 || x >= w - 3 || y >= h - 3) &&
            pixels[(y * w + x) * 4 + 3] > 0
          ) {
            failures.push(frame);
            y = h;
            break;
          }
        }
      }
    }
    return failures;
  });
  expect(clipped).toEqual([]);
});
