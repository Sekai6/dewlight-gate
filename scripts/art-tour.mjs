import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
const dir = "artifacts/art-tour";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chromium" });
const names = [
  "露水门廊",
  "蕨叶与浅溪",
  "碎镜长桥",
  "停驻的温室",
  "风铃树冠",
  "彼此生长的花庭",
];
const report = {
  positionedVisualReview: true,
  routeEvidence: false,
  errors: [],
  captures: [],
};
try {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    recordVideo: { dir, size: { width: 1600, height: 1000 } },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto("http://127.0.0.1:5173");
  await page.screenshot({ path: `${dir}/title.png` });
  await page.getByRole("button", { name: "开启旅程" }).click();
  for (const quality of ["soft", "dream", "webgpu"]) {
    await page.keyboard.press("Tab");
    await page.getByLabel("画质", { exact: true }).selectOption(quality);
    await page.waitForFunction(
      () => !document.querySelector("#quality")?.disabled,
    );
    const selected = await page
      .getByLabel("画质", { exact: true })
      .inputValue();
    if (selected !== quality)
      throw new Error(`Requested ${quality}, got ${selected}`);
    await page.getByRole("button", { name: "继续探索" }).click();
    for (let room = 0; room < 6; room++) {
      const position = await page.evaluate((room) => {
        const s = window.dewlight.scene.getScene("journey");
        const candidates = s.layout.platforms.filter(
          (p) => p.room === room && !p.moving && p.y > 420 && p.y < 720,
        );
        candidates.sort(
          (a, b) =>
            Math.abs(a.x + 80 - room * 6000 - 1500) -
            Math.abs(b.x + 80 - room * 6000 - 1500),
        );
        const p = candidates[0];
        s.x = p.x + 80;
        s.y = p.y;
        s.vx = 0;
        s.vy = 0;
        s.onGround = false;
        s.groundIndex = -1;
        return { x: s.x, y: s.y };
      }, room);
      await page.waitForTimeout(220);
      await page.screenshot({ path: `${dir}/${quality}-room-${room + 1}.png` });
      report.captures.push({
        quality,
        room: room + 1,
        name: names[room],
        ...position,
      });
      await page.waitForTimeout(600);
    }
  }
  const video = page.video();
  await context.close();
  renameSync(await video.path(), `${dir}/six-gardens.webm`);
  writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));
  writeFileSync(
    `${dir}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>晨露之门 · 六花园美术巡览</title><style>*{box-sizing:border-box}body{margin:0;background:#102b34;color:#e8e8d0;font:16px/1.8 Georgia,"Microsoft YaHei",serif}main{max-width:1440px;padding:45px 25px;margin:auto}h1{font-weight:400;font-size:40px}p{color:#b7ccc2}header{display:flex;justify-content:space-between;align-items:center;gap:20px}select{padding:10px;background:#285044;color:#eee6ce;border:1px solid #718f7c;border-radius:8px}section{margin:45px 0}img,video{display:block;width:100%;border-radius:12px;border:1px solid #506d69}small{color:#b1c7bc}nav a{color:#dfd7b0;margin-right:25px}h2{font-weight:400}video{max-height:650px;background:#061c28}</style><main><small>DEWLIGHT / ART DIRECTION</small><header><h1>六座花园，一段晨光</h1><label>对比画质 <select id="mode"><option value="soft">轻盈 · Canvas</option><option value="dream">绮梦 · Canvas</option><option value="webgpu">绮梦 · WebGPU</option></select></label></header><p>悬露与浮岛、晶庭与折光、巨藤与花灯。以下为游戏内定位截图，展示六段花园的新美术；不是整段通关证据。WebGPU 图片来自真实图形设备的四通道光影合成。</p><nav>${names.map((name, i) => `<a href="#room-${i + 1}">0${i + 1} ${name}</a>`).join("")}</nav>${names.map((name, i) => `<section id="room-${i + 1}"><h2>0${i + 1} / ${name}</h2><img class="scene" data-room="${i + 1}" src="dream-room-${i + 1}.png" alt="${name}实机画面" loading="lazy"></section>`).join("")}<section><h2>动态巡览</h2><video src="six-gardens.webm" controls preload="metadata"></video></section><p>WebGPU 为可选增强层；不支持时保留完整绮梦美术，并自动回到兼容画质。最终游戏请从开发或静态服务器运行。</p></main><script>document.querySelector('#mode').addEventListener('change',e=>document.querySelectorAll('.scene').forEach(img=>img.src=e.target.value+'-room-'+img.dataset.room+'.png'));</script></html>`,
  );
} finally {
  await browser.close();
}
if (report.errors.length) throw new Error(report.errors.join("\n"));
