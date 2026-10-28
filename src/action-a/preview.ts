import Phaser from "phaser";
import { ActionActor } from "./actor";
import { ACTIONS, type Action, type ActorKind } from "./rigs";
import { getClip } from "./rigs";
document.body.innerHTML = `<main id="studio"><header><strong>ACTION-A · 动作预览</strong><a href="/">返回游戏</a></header><nav>
<label>角色 <select id="actor"><option value="hero">灯剑旅者</option><option value="moss">苔影</option><option value="moth">玻璃蛾</option><option value="guardian">露冠守卫</option></select></label>
<label>动作 <select id="action">${ACTIONS.map((a) => `<option>${a}</option>`).join("")}</select></label>
<label>朝向 <select id="facing"><option value="1">向右</option><option value="-1">向左</option></select></label>
<label>移动速度 <input id="speed" type="range" min="0" max="300" value="160"><output id="speed-value">160</output></label>
<label>播放速度 <select id="rate"><option value="1">1×</option><option value="0.5">0.5×</option><option value="0.25">0.25×</option></select></label>
<label>放大 <select id="zoom"><option value="1">1×</option><option value="2" selected>2×</option><option value="3">3×</option></select></label>
<button id="pause">暂停</button><button id="step">步进 1/60 秒</button><button id="reset">重置</button>
<label><input id="bones" type="checkbox" checked>骨骼 / 接触点 / 武器轴</label><label><input id="reduced" type="checkbox">减少动态</label></nav>
<div id="stage"></div><pre id="diagnostics"></pre><p>支撑期脚部锁定世界坐标；走出画面时重置。此页仅开发模式提供，预览动作不产生伤害。</p></main>`;
const css = document.createElement("style");
css.textContent = `*{box-sizing:border-box}body{margin:0;background:#142f34;color:#e3e6ca;font:15px system-ui}#studio{max-width:1400px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;font-size:23px}a{color:#b8e5d5}nav{display:flex;flex-wrap:wrap;gap:16px;margin:24px 0;align-items:center}label{display:flex;gap:7px;align-items:center}button,select{color:#e8edcf;background:#2b5153;border:1px solid #7eac9c;border-radius:7px;padding:8px}#stage{height:480px;width:100%;overflow:hidden;border:1px solid #709b91;border-radius:14px}pre{font-size:13px;white-space:pre-wrap;min-height:80px}p{color:#a2bcb0}`;
document.head.append(css);
const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
// The snapshot is local review material; failure leaves the standalone preview usable.
let BaselineActor: typeof ActionActor | undefined;
try {
  const url = "/artifacts/action-a-round4/baseline/src/action-a/actor.ts";
  if ((await fetch(url, { method: "HEAD" })).ok) {
    BaselineActor = (await import(/* @vite-ignore */ url)).ActionActor;
  }
} catch {
  /* Baseline artifacts are intentionally not published. */
}
const controls = document.createElement("div");
controls.style.cssText =
  "display:flex;flex-wrap:wrap;gap:18px;margin-bottom:14px";
controls.innerHTML =
  ["locomotion", "combat", "reaction", "support", "follow"]
    .map(
      (name) =>
        `<label><input type="checkbox" id="layer-${name}" checked>${name}</label>`,
    )
    .join("") +
  `<label><input id="moving-attack" type="checkbox">&#31227;&#21160;&#25915;&#20987;</label><label><input id="compare" type="checkbox" ${BaselineActor ? "" : "disabled"}>&#31532;&#22235;&#36718;&#22522;&#32447;&#23545;&#29031;</label>`;
controls.innerHTML += `<label>Replay <select id="replay"><option value="off">Manual</option><option value="combo">Standing combo</option><option value="moving">Moving combo</option><option value="air">Air / land combo</option><option value="hurt">Hit interrupt</option><option value="enemy">Enemy stages</option></select></label>`;
document.querySelector("#stage")!.before(controls);
let clock = 0,
  age = 0,
  paused = false,
  step = 0,
  x = 500;
class Studio extends Phaser.Scene {
  actors!: Record<ActorKind, ActionActor>;
  baseline?: Record<ActorKind, ActionActor>;
  create() {
    this.actors = Object.fromEntries(
      (["hero", "moss", "moth", "guardian"] as ActorKind[]).map((k) => [
        k,
        new ActionActor(this, k),
      ]),
    ) as Record<ActorKind, ActionActor>;
    if (BaselineActor)
      this.baseline = Object.fromEntries(
        (["hero", "moss", "moth", "guardian"] as ActorKind[]).map((k) => [
          k,
          new BaselineActor!(this, k),
        ]),
      ) as Record<ActorKind, ActionActor>;
    const grid = this.add.graphics().setDepth(-1);
    grid.lineStyle(1, 0x50776c, 0.3);
    for (let x = 0; x < 1400; x += 40) grid.lineBetween(x, 0, x, 480);
    for (let y = 0; y < 480; y += 40) grid.lineBetween(0, y, 1400, y);
    grid.lineStyle(2, 0xb6c7a4, 0.6);
    grid.lineBetween(0, 360, 1400, 360);
  }
  update(_time: number, delta: number) {
    const dt =
      step ||
      (!paused
        ? (Math.min(delta, 50) / 1000) *
          Number(el<HTMLSelectElement>("rate").value)
        : 0);
    step = 0;
    const kind = el<HTMLSelectElement>("actor").value as ActorKind,
      selected = el<HTMLSelectElement>("action").value as Action;
    let action = selected;
    const actor = this.actors[kind];
    const dir = Number(el<HTMLSelectElement>("facing").value);
    const speed = Number(el<HTMLInputElement>("speed").value);
    el("speed-value").textContent = String(speed);
    let moving =
      ["walk", "run", "start"].includes(action) ||
      el<HTMLInputElement>("moving-attack").checked;
    clock += dt;
    age += dt;
    let replayInstance: string | undefined;
    let replayAge = age;
    const replay = el<HTMLSelectElement>("replay").value;
    if (replay !== "off") {
      const cycle = age % 2.4;
      const n = Math.floor(cycle / 0.4);
      action =
        replay === "enemy"
          ? (
              [
                "walk",
                "windup",
                "strike",
                "recover",
                "hurt",
                "bound",
              ] as Action[]
            )[n]
          : replay === "hurt" && n === 1
            ? "hurt"
            : n % 2
              ? "rising-slash"
              : "slash";
      replayAge = cycle % 0.4;
      replayInstance = `replay:${Math.floor(age / 0.4)}`;
      moving = replay === "moving";
      if (replay === "enemy") {
        const phases: Action[] =
          kind === "guardian"
            ? [
                "walk",
                "windup",
                "strike",
                "recover",
                "slam-warn",
                "slam",
                "hurt",
              ]
            : ["walk", "windup", "strike", "recover", "hurt", "bound"];
        const lengths = phases.map((a) =>
          a === "walk"
            ? 0.6
            : a === "bound"
              ? 0.6
              : getClip(actor.rig, a).duration,
        );
        const duration = lengths.reduce((a, b) => a + b, 0);
        let t = age % duration,
          index = 0;
        while (index < lengths.length - 1 && t >= lengths[index]) {
          t -= lengths[index];
          index++;
        }
        action = phases[index];
        replayAge = t;
        replayInstance = `enemy:${Math.floor(age / duration)}:${index}`;
        moving = action === "walk" || action === "strike";
      }
    }
    if (moving) x += dir * speed * dt;
    if (x < 100 || x > this.scale.width - 100) {
      x = this.scale.width / 2;
      actor.reset();
      this.baseline?.[kind].reset();
    }
    Object.entries(this.actors).forEach(([k, a]) => a.setVisible(k === kind));
    const zoom = Number(el<HTMLSelectElement>("zoom").value);
    this.cameras.main.setZoom(zoom).centerOn(x, 360 - 100 / zoom);
    const clip = getClip(actor.rig, action);
    if (replay === "off" && !clip.loop && age > clip.duration + 0.6) {
      age = 0;
      actor.reset();
      this.baseline?.[kind].reset();
    }
    actor.setDebug(el<HTMLInputElement>("bones").checked);
    for (const name of [
      "locomotion",
      "combat",
      "reaction",
      "support",
      "follow",
    ] as const)
      actor.setLayerEnabled(
        name,
        el<HTMLInputElement>(`layer-${name}`).checked,
      );
    const input = {
      x,
      y: kind === "moth" ? 300 : 360,
      clock,
      facing: dir,
      action,
      age: replayAge,
      instance: replayInstance,
      hitDirection: -dir,
      vx: moving ? dir * speed : 0,
      vy: action === "rise" ? -180 : action === "fall" ? 180 : 0,
      grounded:
        !(replay === "air" && age % 2.4 < 0.8) &&
        !["launch", "rise", "apex", "fall", "air-slash"].includes(action),
      reduced: el<HTMLInputElement>("reduced").checked,
    };
    const compare = el<HTMLInputElement>("compare").checked;
    const separation = kind === "guardian" ? 115 : 65;
    actor.draw({ ...input, x: x + (compare ? separation : 0) });
    if (this.baseline) {
      Object.entries(this.baseline).forEach(([k, a]) =>
        a.setVisible(compare && k === kind),
      );
      if (compare) {
        const old = this.baseline[kind];
        old.setDebug(el<HTMLInputElement>("bones").checked);
        old.draw({ ...input, x: x - separation });
      }
    }
    const s = actor.snapshot();
    el("diagnostics").textContent =
      (compare
        ? "左：第三轮改造前 / 右：当前 ACTION-A（同输入、同模拟时间）\n"
        : "") +
      s.layers
        .map(
          (l) =>
            `${l.name}: ${l.enabled ? "ON" : "OFF"} weight=${l.weight.toFixed(2)} age=${l.age.toFixed(3)} blend=${l.blend.toFixed(2)}`,
        )
        .join(" | ") +
      "\n" +
      `gripError=${s.armError.toFixed(4)} | swordSpeed=${s.swordSpeed.toFixed(1)} | boneWeights=${JSON.stringify(s.boneWeights)}\n` +
      `stage=${s.stage} | blend=${s.blendWeight.toFixed(3)} | support=${s.contacts.map((c) => (c.planted ? "LOCK" : "SWING")).join(" / ")}\n` +
      `${kind} / ${action} · 模拟时间 ${clock.toFixed(3)} s · 动作 ${age.toFixed(3)} s\n脚部 ${s.feet.map((p) => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join(" / ")} · 部件 ${s.parts}\n剑尖 (${s.weaponTip.x.toFixed(2)}, ${s.weaponTip.y.toFixed(2)}) · ${paused ? "已暂停" : "播放中"}`;
  }
}
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "stage",
  backgroundColor: "#203e42",
  width: Math.min(1348, innerWidth - 48),
  height: 480,
  scene: Studio,
  antialias: true,
});
el("pause").onclick = () => {
  paused = !paused;
  el("pause").textContent = paused ? "播放" : "暂停";
};
el("step").onclick = () => {
  paused = true;
  el("pause").textContent = "播放";
  step = 1 / 60;
};
const reset = () => {
  age = 0;
  x = game.scale.width / 2;
  const s = game.scene.getScenes(true)[0] as Studio;
  s?.actors && Object.values(s.actors).forEach((a) => a.reset());
  s?.baseline && Object.values(s.baseline).forEach((a) => a.reset());
};
for (const id of ["actor", "action", "facing", "replay"])
  el(id).onchange = reset;
el("reset").onclick = reset;
window.addEventListener("resize", () =>
  game.scale.resize(Math.min(1348, innerWidth - 48), 480),
);
