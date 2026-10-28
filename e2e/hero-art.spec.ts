import { test, expect } from "@playwright/test";

test("ACTION-A atlas parts retain transparent padding without legacy full-frame textures", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).dewlight);
  const clipped = await page.evaluate(() => {
    const failures: number[] = [];
    const textures = (window as any).dewlight.textures;
    const atlas = textures.get("action-a"),
      source = atlas.getSourceImage() as HTMLCanvasElement;
    for (const [index, name] of atlas.getFrameNames().entries()) {
      const f = atlas.get(name),
        w = f.cutWidth,
        h = f.cutHeight;
      const pixels = source
        .getContext("2d")!
        .getImageData(f.cutX, f.cutY, w, h).data;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (
            (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) &&
            pixels[(y * w + x) * 4 + 3]
          )
            failures.push(index);
        }
    }
    if (textures.exists("hero-0")) failures.push(-1);
    return failures;
  });
  expect(clipped).toEqual([]);
});
