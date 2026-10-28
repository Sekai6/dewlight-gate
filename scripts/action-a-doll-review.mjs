import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, copyFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
const root = "artifacts/action-a-doll-hit";
const ffmpeg = execFileSync(
  "python",
  ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
  { encoding: "utf8" },
).trim();
for (const variant of ["before", "after"]) {
  const dir = `${root}/${variant}`;
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.addInitScript(() => {
      let seed = 101;
      Math.random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${variant === "before" ? 5179 : 5173}`);
    await page.locator('[data-action="new"]').click();
    await page.evaluate(() => {
      const g = window.dewlight,
        s = g.scene.getScene("journey");
      g.loop.sleep();
      s.clock = 20;
      s.effects.reset();
      s.resetAnimations();
      s.framing.update = () => ({ zoom: 1.7, x: 150, y: 680 });
      document.querySelector("#ui").style.display = "none";
      const label = document.createElement("div");
      label.id = "label";
      label.style.cssText =
        "position:fixed;top:20px;left:20px;padding:12px;color:white;background:#163b3f;font:20px system-ui";
      document.body.append(label);
    });
    const samples = [];
    for (let frame = 0; frame < 720; frame++) {
      samples.push(
        await page.evaluate(
          ({ frame, variant }) => {
            const g = window.dewlight,
              s = g.scene.getScene("journey"),
              kind = ["ground", "flying", "charge", "wave"][
                Math.floor(frame / 180)
              ];
            const local = frame % 180;
            if (local === 0 || local === 90) {
              s.resetAnimations();
              s.clearInput();
              s.x = 400;
              s.y = 1100;
              s.vx = 0;
              s.vy = 0;
              s.hp = 5;
              s.hurtAt = -999;
              s.dashAt = -999;
              s.onGround = true;
              s.groundIndex = 0;
              s.draw();
              s.damage(false, 1, {
                kind,
                sourceX: 350,
                sourceY: 1100,
                direction: 1,
                instance: `capture:${frame}`,
              });
            }
            if (local === 98) s.pendingKeys.add("SPACE");
            document.getElementById("label").textContent =
              `${variant} · ${kind} · ${local < 90 ? "automatic landing" : "Space recovery"} · 120 Hz / 30 fps`;
            for (let i = 0; i < 4; i++) {
              s.clock += 1 / 120;
              s.step(1 / 120);
              s.draw();
            }
            g.renderer.preRender();
            s.sys.render(g.renderer);
            g.renderer.postRender();
            return {
              x: s.x,
              y: s.y,
              phase: s.doll?.state.phase ?? "legacy",
              age: s.doll?.state.age ?? 0,
            };
          },
          { frame, variant },
        ),
      );
      const path = `${dir}/frame-${String(frame).padStart(4, "0")}.png`;
      await page.screenshot({ path });
      if ([8, 18, 35, 65].includes(frame % 180))
        copyFileSync(path, `${dir}/pose-${frame}.png`);
    }
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
    for (let frame = 0; frame < 720; frame++)
      unlinkSync(`${dir}/frame-${String(frame).padStart(4, "0")}.png`);
    writeFileSync(
      `${dir}/capture.json`,
      JSON.stringify(
        {
          variant,
          simulationHz: 120,
          animationHz: 120,
          renderHz: 30,
          frames: 720,
          errors,
          samples,
        },
        null,
        2,
      ),
    );
    if (errors.length) throw Error(errors.join("\n"));
  } finally {
    await browser.close();
  }
}
writeFileSync(
  `${root}/review.html`,
  `<!doctype html><meta charset="utf-8"><title>ACTION-A-DOLL-HIT 对照</title><style>body{background:#153a40;color:#eee;font:18px system-ui;padding:24px}section{display:flex;gap:12px}video{width:49%}button{padding:12px;margin:10px}</style><h1>ACTION-A-DOLL-HIT</h1><p>左：第五轮基线；右：布娃娃受击。每段 6 秒：自动起身，然后空格受身。依次轻击、飞扑、冲锋、根浪。</p><button onclick="play(1)">同步正常播放</button><button onclick="play(.25)">同步四分之一速度</button><button onclick="document.querySelectorAll('video').forEach(v=>v.pause())">暂停</button><section><video src="before/actions.webm" controls></video><video src="after/actions.webm" controls></video></section><p>固定镜头，120 Hz 模拟和动作更新，30 fps 编码。审美效果仍需人工确认。</p><script>function play(rate){document.querySelectorAll('video').forEach(v=>{v.currentTime=0;v.playbackRate=rate;v.play()})}</script>`,
);
