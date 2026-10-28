import { readFileSync, writeFileSync } from "node:fs";
const root = process.env.ACTION_A_OUTPUT || "artifacts/action-a";
const report = JSON.parse(readFileSync(`${root}/performance.json`, "utf8"));
const exact = JSON.parse(
  readFileSync(`${root}/after/capture.json`, "utf8"),
).frameExact;
const captureNote = exact
  ? "120 Hz 模拟、固定镜头、相同输入。两段均逐帧采集并编码为 720 帧 / 30 fps / 24 秒，可同步比较。场景依次为主控、苔影、玻璃蛾、露冠守卫。"
  : "相同模拟输入与固定镜头。旧式实时录像可能存在采集时间差，请分别拖动进度对齐场景标题。";
writeFileSync(
  `${root}/review.html`,
  `<!doctype html><meta charset="utf-8"><title>ACTION-A · 本地验收</title>
<style>body{margin:32px;background:#15383c;color:#e3e8c9;font:16px system-ui}h1{font-size:28px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}video,img{width:100%;border:1px solid #789e8d;border-radius:10px}button,select{padding:10px;background:#315854;color:#eef0d5;border:1px solid #8eb7a2;border-radius:6px}a{color:#bee3cf}pre{white-space:pre-wrap}section{margin-top:28px}</style>
<h1>ACTION-A · 动作改造前后对比</h1><p>${captureNote}</p>
<button id="play">同时播放 / 暂停</button> <button id="reset">回到开头</button> <label>播放速度 <select id="rate"><option value="1">正常 1×</option><option value="0.5">慢放 0.5×</option><option value="0.25">慢放 0.25×</option></select></label>
<div class="pair"><section><h2>改造前</h2><video id="before" src="before/actions.webm" controls muted playsinline></video></section><section><h2>ACTION-A</h2><video id="after" src="after/actions.webm" controls muted playsinline></video></section></div>
<p><label>同步跳转场景 <select id="chapter"><option value="0">主控 · 跑跳与战斗</option><option value="6">苔影 · 蓄势与扑击</option><option value="12">玻璃蛾 · 收翼与俯冲</option><option value="18">露冠守卫 · 冲锋与砸地</option></select></label></p>
<section><h2>关键姿势图</h2><p>${["hero", "moss", "moth", "guardian"].map((k) => `<a href="sheets/${k}.png">${k}</a>`).join(" · ")}</p></section>
<section><h2>性能与资源记录</h2><pre>${JSON.stringify(report.comparison ?? report, null, 2).replaceAll("<", "&lt;")}</pre><a href="performance.json">performance.json</a></section>
<script>const videos=[document.querySelector('#before'),document.querySelector('#after')];document.querySelector('#play').onclick=()=>{const paused=videos[0].paused;videos.forEach(v=>paused?v.play():v.pause());};document.querySelector('#reset').onclick=()=>videos.forEach(v=>v.currentTime=0);document.querySelector('#rate').onchange=e=>videos.forEach(v=>v.playbackRate=Number(e.target.value));document.querySelector('#chapter').onchange=e=>videos.forEach(v=>{v.pause();v.currentTime=Number(e.target.value);});</script>`,
);
console.log(`${root}/review.html`);
