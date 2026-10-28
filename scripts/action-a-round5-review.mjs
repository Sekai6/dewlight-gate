import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
// Identical simulation/input sequence against HEAD baseline and the working tree.
const variant = process.env.ACTION_A_VARIANT || "after";
const url = process.env.PLAY_URL || "http://127.0.0.1:5173";
const root = process.env.ACTION_A_OUTPUT || "artifacts/action-a-round5";
const dir = `${root}/${variant}`;
const fixed = process.env.FIXED_CAPTURE === "1";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ...(fixed
      ? {}
      : { recordVideo: { dir, size: { width: 1280, height: 800 } } }),
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    let seed = 101;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const g = window.dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    s.clock = 0;
    s.effects.reset();
    s.resetAnimations?.();
    s.guideEnabled = false;
    document.querySelector("#ui").style.display = "none";
    const label = document.createElement("div");
    label.id = "capture-label";
    label.style.cssText =
      "position:fixed;left:24px;top:24px;color:#f5edc9;background:#163b3fe0;padding:15px;font:20px system-ui;z-index:100";
    document.body.append(label);
  });
  const scenarios = [
    "主控 · 慢行 / 跑动 / 跳跃 / 挥斩 / 冲刺 / 束缚",
    "苔影 · 巡逻 / 蓄势 / 扑击 / 恢复",
    "玻璃蛾 · 悬浮 / 收翼 / 俯冲",
    "露冠守卫 · 冲锋 / 根浪 / 束缚",
  ];
  for (let scene = 0; scene < 4; scene++) {
    for (const key of ["a", "d", "c", "j", "k", "Shift"])
      await page.keyboard.up(key);
    await page.evaluate(
      ({ scene, label, variant }) => {
        const s = window.dewlight.scene.getScene("journey");
        s.clock = scene * 6;
        s.effects.reset();
        document.getElementById("capture-label").textContent =
          `${variant.toUpperCase()} · ${label}`;
        let x = 130,
          y = 1100;
        if (scene === 1 || scene === 2) {
          const e = s.enemies.find((e) => e.type === (scene === 1 ? 0 : 1));
          x = e.x - 105;
          y = e.floor;
          e.phase = "patrol";
          e.phaseAt = s.clock;
          e.cool = s.clock + 0.6;
          e.hp = 2;
          e.bound = 0;
          e.hurtAt = -999;
          e.dir = -1;
        }
        if (scene === 3) {
          x = 2650;
          y = 1100;
          for (const p of s.layout.prisms.filter((p) => p.room === 0))
            s.activatePrism(p);
          const b = s.guardian;
          b.phase = "stalk";
          b.until = s.clock + 0.5;
          b.phaseAt = s.clock;
          b.x = 2900;
          b.hp = 36;
          b.attacks = 0;
          b.wave = [];
        }
        s.x = x;
        s.y = y;
        s.vx = 0;
        s.vy = 0;
        s.hp = 5;
        s.energy = 100;
        s.onGround = true;
        s.hurtAt = s.clock + 100;
        s.attackAt = -999;
        s.bindAt = -999;
        s.dashAt = -999;
        s.safe = { x, y };
        s.clearInput();
        s.resetAnimations?.();
        const zoom = scene === 3 || scene === 0 ? 1.7 : 2.3;
        const left = scene === 3 ? 2440 : scene === 0 ? 0 : x - 190;
        s.framing.update = () => ({
          zoom,
          x: left,
          y: y - (800 / zoom) * 0.78,
        });
        s.draw();
      },
      { scene, label: scenarios[scene], variant },
    );
    for (let frame = 0; frame < 180; frame++) {
      if (scene === 0) {
        if (frame === 0) {
          await page.keyboard.down("c");
          await page.keyboard.down("d");
        }
        if (frame === 30) await page.keyboard.up("c");
        if (frame === 50) await page.keyboard.press("Space");
        if (frame === 60) await page.keyboard.up("d");
        if ([55, 64, 95, 105].includes(frame)) await page.keyboard.press("j");
        if (frame === 127) await page.keyboard.press("Shift");
        if (frame === 140) await page.keyboard.down("a");
        if (frame === 150) await page.keyboard.up("a");
        if (frame === 154) await page.keyboard.press("k");
      }
      if (scene === 3 && frame === 160) await page.keyboard.press("k");
      await page.evaluate(() => {
        const s = window.dewlight.scene.getScene("journey");
        for (let i = 0; i < 4; i++) {
          s.clock += 1 / 120;
          s.step(1 / 120);
          s.draw();
        }
        const renderer = window.dewlight.renderer;
        renderer.preRender();
        s.sys.render(renderer);
        renderer.postRender();
      });
      if ([27, 48, 62, 77, 106, 131, 160].includes(frame))
        await page.screenshot({ path: `${dir}/scene-${scene}-${frame}.png` });
      if (fixed)
        await page.screenshot({
          path: `${dir}/frame-${String(scene * 180 + frame).padStart(4, "0")}.png`,
        });
      else await page.waitForTimeout(33);
    }
  }
  const video = page.video();
  await context.close();
  if (fixed) {
    const ffmpeg =
      process.env.FFMPEG ||
      execFileSync(
        "python",
        ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
        { encoding: "utf8" },
      ).trim();
    execFileSync(
      ffmpeg,
      [
        "-y",
        "-framerate",
        "30",
        "-i",
        `${dir}/frame-%04d.png`,
        "-c:v",
        "libvpx-vp9",
        "-crf",
        "30",
        "-b:v",
        "0",
        "-pix_fmt",
        "yuv420p",
        `${dir}/actions.webm`,
      ],
      { stdio: "ignore" },
    );
    if (process.env.KEEP_CAPTURE_FRAMES !== "1")
      for (let frame = 0; frame < 720; frame++)
        unlinkSync(`${dir}/frame-${String(frame).padStart(4, "0")}.png`);
  } else await video.saveAs(`${dir}/actions.webm`);
  writeFileSync(
    `${dir}/capture.json`,
    JSON.stringify(
      {
        variant,
        url,
        simulationHz: 120,
        animationHz: 120,
        seed: 101,
        initialClock: 0,
        renderHz: 30,
        fixedCamera: true,
        frameExact: fixed,
        frameImagesRetained: fixed && process.env.KEEP_CAPTURE_FRAMES === "1",
        frames: fixed ? 720 : undefined,
        duration: fixed ? 24 : undefined,
        errors,
      },
      null,
      2,
    ),
  );
  if (errors.length) throw new Error(JSON.stringify(errors));
  console.log(`${variant}: ${dir}/actions.webm`);
} finally {
  await browser.close();
}
