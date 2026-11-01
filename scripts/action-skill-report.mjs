import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const root = "artifacts/action-skill";
const before = JSON.parse(readFileSync(`${root}/before/capture.json`, "utf8"));
const after = JSON.parse(readFileSync(`${root}/after/capture.json`, "utf8"));
const performance = JSON.parse(
  readFileSync(`${root}/performance.json`, "utf8"),
);
const options = after.records
  .map((r, i) => `<option value="${i}">${r.title}</option>`)
  .join("");
const rows = performance.comparison
  .map(
    (c) =>
      `<tr><td>${c.scenario}</td><td>${c.cpuBefore.toFixed(2)} → ${c.cpuAfter.toFixed(2)} ms</td><td>${c.frameBefore.toFixed(2)} → ${c.frameAfter.toFixed(2)} ms</td><td>${c.withinCpuBudget && c.withinFrameBudget ? "通过" : "未达标"}</td><td>${c.stableObjects && c.stableTextures ? "稳定" : "增长"}</td></tr>`,
  )
  .join("");
writeFileSync(
  `${root}/review.html`,
  `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><title>Action-skill · 同步对照</title><style>body{background:#132e34;color:#e8edce;font:16px system-ui;padding:24px;margin:auto;max-width:1600px}h1{font-size:27px}a{color:#c1e6d4}button,select{padding:10px;border:1px solid #91b49c;border-radius:7px;background:#2c5150;color:#f2edce;margin:5px}section{display:grid;grid-template-columns:1fr 1fr;gap:18px}video{width:100%;background:#0b2429;border-radius:12px}table{border-collapse:collapse;width:100%;margin:18px 0}td,th{text-align:left;padding:12px;border-bottom:1px solid #789e8444}input{width:min(700px,70vw)}small{color:#abcbb5}#time{margin:10px} @media(max-width:900px){section{grid-template-columns:1fr}}</style><h1>Action-skill · v1.3.0 / 本地新版同步对照</h1><p>相同输入、固定镜头、120 Hz 模拟及动作采样、30 fps 编码。旧版没有 Q/R/F 和三种守卫新招：对应画面保留旧版的真实行为。演示定位场景、保护生命；不作为正常通关证据。</p><nav><select id="scene">${options}</select><select id="rate"><option value="1">正常速度</option><option value="0.25">¼ 慢放</option></select><button id="play">同步播放</button><button id="pause">暂停</button><button id="reset">从头播放</button></nav><section><article><h2>v1.3.0 基线</h2><video id="before" preload="metadata" muted playsinline></video></article><article><h2>Action-skill 本地版本</h2><video id="after" preload="metadata" muted playsinline></video></article></section><div id="time"></div><input id="seek" type="range" min="0" max="1000" value="0"><p><a href="poses.html">关键姿势图与全部场景</a> · <a href="performance.json">性能原始结果</a> · <a href="baseline.json">基线 SHA256</a> · <a href="../../docs/ACTION-SKILL.md">架构说明</a></p><h2>三轮配对 P95 中位数</h2><table><tr><th>场景</th><th>主线程</th><th>帧间隔</th><th>预算</th><th>纹理／对象</th></tr>${rows}</table><small>性能在独立顺序运行中采集，不与录像或测试同时运行。动画几何与审美分别验收；自然度仍待用户确认。</small><script>const data=${JSON.stringify(after.records.map((a, i) => ({ after: `after/${a.filename}`, before: `before/${before.records[i].filename}`, duration: a.seconds })))};const a=document.querySelector('#after'),b=document.querySelector('#before'),seek=document.querySelector('#seek');function set(){const r=data[document.querySelector('#scene').value];a.pause();b.pause();a.src=r.after;b.src=r.before;a.playbackRate=b.playbackRate=+document.querySelector('#rate').value;seek.value=0;}document.querySelector('#scene').onchange=set;document.querySelector('#rate').onchange=()=>a.playbackRate=b.playbackRate=+document.querySelector('#rate').value;document.querySelector('#play').onclick=()=>Promise.all([a.play(),b.play()]);document.querySelector('#pause').onclick=()=>{a.pause();b.pause()};document.querySelector('#reset').onclick=()=>{a.currentTime=b.currentTime=0;Promise.all([a.play(),b.play()])};seek.oninput=()=>{a.pause();b.pause();a.currentTime=b.currentTime=(+seek.value/1000)*data[document.querySelector('#scene').value].duration};a.ontimeupdate=()=>{if(Math.abs(a.currentTime-b.currentTime)>.05)b.currentTime=a.currentTime;seek.value=1000*a.currentTime/data[document.querySelector('#scene').value].duration;document.querySelector('#time').textContent=a.currentTime.toFixed(3)+' s'};a.onended=()=>b.pause();set();</script></html>`,
);
const images = after.records.flatMap((r, i) =>
  [9, 14, 27, 40].map((frame) => ({
    src: `after/${i}-${r.id}-${frame}.png`,
    caption: `${r.title} · ${(frame / 30).toFixed(2)}s`,
  })),
);
writeFileSync(
  `${root}/poses.html`,
  `<!doctype html><meta charset="UTF-8"><title>Action-skill 关键姿势</title><style>body{background:#142f34;color:#e5e9c8;font:16px system-ui;margin:24px}h1{font-size:24px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}img{width:100%;border-radius:8px}figure{margin:0}figcaption{padding:7px;font-size:13px}</style><h1>Action-skill · 蓄势／发力／命中／恢复</h1><p>四角色、主控三技、守卫五招及双难度；图片来自逐帧录制的游戏画面。</p><main>${images.map((i) => `<figure><img src="${i.src}"><figcaption>${i.caption}</figcaption></figure>`).join("")}</main>`,
);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  await page.goto(`http://127.0.0.1:5173/${root}/poses.html`);
  await page.waitForFunction(() =>
    [...document.images].every((i) => i.complete),
  );
  await page.screenshot({ path: `${root}/poses.png`, fullPage: true });
  await page.goto("http://127.0.0.1:5173/?action-skill");
  await page.locator("#pause").click();
  await page.locator("#phase").click();
  await page.screenshot({ path: `${root}/preview.png` });
} finally {
  await browser.close();
}
console.log(`${root}/review.html`);
