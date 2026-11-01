import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
const root = "artifacts/action-a-round7";
const read = (name) => JSON.parse(readFileSync(`${root}/${name}.json`, "utf8"));
const performance = read("performance"),
  geometry = read("geometry"),
  compatibility = read("compatibility"),
  combat = read("combat-compatibility");
const names = ["hero", "moth", "moss", "guardian"];
const labels = [
  "主控：移动与连斩",
  "玻璃蛾：蓄势与俯冲",
  "苔影：扑击与承接",
  "守卫：冲锋与砸地",
];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 840 },
    deviceScaleFactor: 1,
  });
  mkdirSync(`${root}/sheets`, { recursive: true });
  for (let i = 0; i < 4; i++) {
    await page.setContent(
      `<meta charset="utf-8"><style>body{margin:20px;background:#15383c;color:#e3e8c9;font:18px system-ui}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}img{width:100%}h2{font-size:18px}p{margin:8px}</style><h1>${labels[i]} · 同输入关键姿势</h1>${["before", "after"].map((variant) => `<h2>${variant === "before" ? "第六轮工作区基线" : "第七轮"}</h2><div class="grid">${[27, 62, 106, 160].map((frame) => `<section><img src="http://127.0.0.1:5173/${root}/${variant}/scene-${i}-${frame}.png"><p>${(frame / 30).toFixed(2)} s</p></section>`).join("")}</div>`).join("")}`,
    );
    await page.locator("img").evaluateAll(async (imgs) => {
      await Promise.all(imgs.map((img) => img.decode()));
    });
    await page.screenshot({
      path: `${root}/sheets/${names[i]}.png`,
      fullPage: true,
    });
  }
} finally {
  await browser.close();
}
const rows = performance.comparison
  .map(
    (c) =>
      `| ${c.scenario} | ${c.cpuBefore.toFixed(2)} → ${c.cpuAfter.toFixed(2)} | ${((c.cpuP95Ratio - 1) * 100).toFixed(1)}% | ${c.frameBefore.toFixed(2)} → ${c.frameAfter.toFixed(2)} | ${c.withinCpuBudget && c.withinFrameBudget && c.stableObjects && c.stableTextures ? "通过" : "未通过"} |`,
  )
  .join("\n");
const report = `# ACTION-A 第七轮本地验收

## 自动化

- 65 项单元测试、74 项浏览器测试通过；TypeScript、格式检查、生产构建通过。
- 原生 WebGPU 测试实际执行，包含提交、缩放、跨区域与设备丢失回退；不是适配器缺失跳过。
- 第六轮工作区基线保存在 baseline/，SHA-256 清单见 baseline.json；没有用远程标签代替。
- ${compatibility.cases} 组受击／受身比对：根部误差 ${compatibility.rootError} px，恢复时点差 ${compatibility.timingErrorTicks} 个 120 Hz 步，资源／阶段差异 ${compatibility.resourcePhaseDifferences.length}。
- 连斩、苔影、玻璃蛾与守卫各 720 步：根部、血量、资源、伤害、冷却、预警／阶段差异 ${combat.differences}。
- ${geometry.samples} 个几何采样：脚底漂移 ${geometry.footDrift} px，握柄误差 ${geometry.grip} px，臂长相对误差 ${geometry.relativeArmLengthError}，裁切 ${geometry.clip}。

## 性能

同机 Chromium、1440×900、dream 画质、预热后四场景三轮配对，取各轮 P95 中位数。原始处理、约束、绘制、帧间隔和分配采样见 performance.json。

| 场景 | 主线程 P95 / ms | 增幅 | 帧间隔 P95 / ms | 预算与对象稳定性 |
|---|---:|---:|---:|---|
${rows}

堆分配是采样估算，不能解释为精确分配总量。显示对象和纹理计数也不能替代无限时长的内存证明。

## 视觉交付

review.html 提供第六轮与第七轮同输入、固定镜头录像：120 Hz 模拟与动作采样、30 fps 编码，共四场景 24 秒。支持正常和四分之一速度同步观看。关键姿势图见 sheets/。

自动化结果不替代动作自然度判断；请重点审阅连斩发力、绕背回正、扑击承接与守卫重量感。审美效果待用户确认。

本轮没有提交、推送或发布。
`;
writeFileSync(`${root}/acceptance.md`, report);
writeFileSync(
  `${root}/review.html`,
  `<!doctype html><meta charset="utf-8"><title>ACTION-A 第七轮对照</title><style>body{margin:32px;background:#15383c;color:#e3e8c9;font:16px system-ui}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}video,img{width:100%}button,select{padding:10px;background:#315854;color:#eef0d5;border:1px solid #8eb7a2}a{color:#bee3cf}pre{white-space:pre-wrap}</style><h1>ACTION-A 第七轮 · 发力、接触与注意力</h1><p>第六轮工作区基线对照。固定输入、固定镜头、120 Hz 模拟与动作采样、30 fps 编码。</p><button id="play">同步播放 / 暂停</button> <button id="reset">回到开头</button> <select id="rate"><option value="1">正常速度</option><option value=".25">四分之一速度</option></select> <select id="chapter">${labels.map((label, i) => `<option value="${i * 6}">${label}</option>`).join("")}</select><div class="pair"><section><h2>第六轮工作区</h2><video id="before" src="before/actions.webm" controls muted></video></section><section><h2>第七轮</h2><video id="after" src="after/actions.webm" controls muted></video></section></div><p>${names.map((name) => `<a href="sheets/${name}.png">${name} 关键姿势</a>`).join(" · ")} · <a href="acceptance.md">完整验收报告</a></p><pre>${JSON.stringify(performance.comparison, null, 2)}</pre><script>const videos=[document.querySelector('#before'),document.querySelector('#after')];document.querySelector('#play').onclick=()=>{const paused=videos[0].paused;videos[1].currentTime=videos[0].currentTime;videos.forEach(v=>paused?v.play():v.pause());};document.querySelector('#reset').onclick=()=>videos.forEach(v=>v.currentTime=0);document.querySelector('#rate').onchange=e=>videos.forEach(v=>v.playbackRate=Number(e.target.value));document.querySelector('#chapter').onchange=e=>videos.forEach(v=>{v.pause();v.currentTime=Number(e.target.value);});</script>`,
);
console.log(`${root}/review.html`);
