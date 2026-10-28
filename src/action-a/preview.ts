import Phaser from "phaser";
import { ActionActor } from "./actor";
import { ACTIONS, type Action, type ActorKind } from "./rigs";
import { getClip } from "./rigs";
import { DollHitController, type HitKind } from "./doll-hit/state";
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
css.textContent = `*{box-sizing:border-box}body{margin:0;background:#142f34;color:#e3e6ca;font:15px system-ui}#studio{max-width:1400px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;font-size:23px}a{color:#b8e5d5}nav{display:flex;flex-wrap:wrap;gap:16px;margin:24px 0;align-items:center}label{display:flex;gap:7px;align-items:center}button,select{color:#e8edcf;background:#2b5153;border:1px solid #7eac9c;border-radius:7px;padding:8px}#stage{height:480px;width:100%;overflow:hidden;border:1px solid #709b91;border-radius:14px}pre{font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere;min-height:80px}p{color:#a2bcb0}`;
document.head.append(css);
const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
// The snapshot is local review material; failure leaves the standalone preview usable.
let BaselineActor: typeof ActionActor | undefined;
try {
  const url = "/artifacts/action-a-doll-hit/baseline/src/action-a/actor.ts";
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
  `<label><input id="moving-attack" type="checkbox">&#31227;&#21160;&#25915;&#20987;</label><label><input id="compare" type="checkbox" ${BaselineActor ? "" : "disabled"}>Round 5 baseline</label>`;
controls.innerHTML += `<label>Replay <select id="replay"><option value="off">Manual</option><option value="combo">Standing combo</option><option value="moving">Moving combo</option><option value="air">Air / land combo</option><option value="hurt">Hit interrupt</option><option value="enemy">Enemy stages</option><option value="locomotion">Start / stop / turn</option></select></label>`;
document.querySelector("#stage")!.before(controls);
controls.insertAdjacentHTML(
  "beforeend",
  `<label>受击 <select id="doll-kind"><option value="off">关闭</option><option value="ground">轻击</option><option value="flying">飞行扑击</option><option value="charge">冲锋击飞</option><option value="wave">根浪掀飞</option></select></label><label><input id="doll-air" type="checkbox">空中起始</label><label><input id="doll-auto" type="checkbox">自动演示受身</label><button id="doll-recover">受身（空格 / Shift）</button>`,
);
const doll = new DollHitController();
let dollY = 360,
  dollVx = 0,
  dollVy = 0,
  dollTime = 0,
  dollRemainder = 0,
  dollSerial = 0;
el("doll-recover").onclick = () => doll.requestRecovery();
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
    e.preventDefault();
    if (!e.repeat) doll.requestRecovery();
  }
});
let clock = 0,
  age = 0,
  paused = false,
  step = 0,
  x = 500;
class Studio extends Phaser.Scene {
  actors!: Record<ActorKind, ActionActor>;
  baseline?: Record<ActorKind, ActionActor>;
  rootTrace!: Phaser.GameObjects.Graphics;
  tracePoints = new Float64Array(720);
  traceCount = 0;
  traceInstance = "";
  create() {
    this.rootTrace = this.add.graphics().setDepth(20);
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
    let dir = Number(el<HTMLSelectElement>("facing").value);
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
    if (replay === "locomotion") {
      const n = Math.floor((age % 2.4) / 0.4);
      moving = n === 0 || n === 1 || n === 3 || n === 4;
      if (n >= 3) dir *= -1;
      action = moving ? "run" : "brake";
      replayAge = age % 0.4;
    }
    if (["combo", "moving", "air"].includes(replay) && replayAge >= 0.38)
      action = "idle";
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
      y:
        kind === "moth"
          ? 300
          : replay === "air" && age % 2.4 < 0.66
            ? 360 - Math.sin(((age % 2.4) / 0.66) * Math.PI) * 45
            : 360,
      clock,
      facing: dir,
      action,
      age: replayAge,
      instance: replayInstance,
      hitDirection: -dir,
      vx: moving ? dir * speed : 0,
      vy: action === "rise" ? -180 : action === "fall" ? 180 : 0,
      grounded:
        kind !== "moth" &&
        !(replay === "air" && age % 2.4 < 0.66) &&
        !["launch", "rise", "apex", "fall", "air-slash"].includes(action),
      reduced: el<HTMLInputElement>("reduced").checked,
    };
    const dollKind = el<HTMLSelectElement>("doll-kind").value;
    const dollPreview = kind === "hero" && dollKind !== "off";
    if (dollPreview) {
      if (!doll.state.instance || dollTime > 3) {
        doll.reset();
        actor.reset();
        dollTime = 0;
        dollRemainder = 0;
        dollY = el<HTMLInputElement>("doll-air").checked ? 260 : 360;
        x = game.scale.width / 2;
        doll.start({
          kind: dollKind as HitKind,
          sourceX: x - dir * 50,
          sourceY: 360,
          direction: dir,
          instance: `preview:${++dollSerial}`,
        });
        dollVx = dir * doll.profile.horizontal;
        dollVy = -doll.profile.upward;
      }
      dollRemainder += dt;
      while (dollRemainder >= 1 / 120) {
        dollRemainder -= 1 / 120;
        dollTime += 1 / 120;
        if (
          el<HTMLInputElement>("doll-auto").checked &&
          dollTime >= 0.25 &&
          dollTime < 0.26
        )
          doll.requestRecovery();
        doll.tick(1 / 120, dollY >= 360);
        dollVx = doll.drag(dollVx, 1 / 120, dollY >= 360);
        dollVy += 1350 / 120;
        x += dollVx / 120;
        dollY += dollVy / 120;
        if (dollY >= 360 && dollVy >= 0) {
          dollY = 360;
          dollVy = doll.land(dollVy);
        }
      }
      Object.assign(input, {
        x,
        y: dollY,
        clock,
        action: doll.state.active ? "hurt" : "idle",
        age: dollTime,
        vx: dollVx,
        vy: dollVy,
        grounded: dollY >= 360,
        doll: doll.state.active ? doll.state : null,
        dollFloor: 360 - dollY,
      });
      this.cameras.main.centerOn(x, 260);
    }
    this.rootTrace.clear();
    if (dollPreview) {
      if (this.traceInstance !== doll.state.instance) {
        this.traceInstance = doll.state.instance;
        this.traceCount = 0;
      }
      if (dt > 0 && this.traceCount < 360) {
        this.tracePoints[this.traceCount * 2] = x;
        this.tracePoints[this.traceCount * 2 + 1] = dollY;
        this.traceCount++;
      }
      this.rootTrace.lineStyle(1, 0xe7d68f, 0.6);
      for (let i = 1; i < this.traceCount; i++)
        this.rootTrace.lineBetween(
          this.tracePoints[(i - 1) * 2],
          this.tracePoints[(i - 1) * 2 + 1],
          this.tracePoints[i * 2],
          this.tracePoints[i * 2 + 1],
        );
      this.rootTrace.lineStyle(2, 0xb1efdc, 0.9);
      this.rootTrace.strokeCircle(x, dollY, 3);
    }
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
      (dollPreview
        ? `DOLL-HIT ${doll.state.phase} | age=${dollTime.toFixed(3)} | velocity=${dollVx.toFixed(1)},${dollVy.toFixed(1)} | recovery=${doll.state.recoverReady} | bounces=${doll.state.bounces} | constraint=${s.doll?.constraintError ?? 0}\n`
        : "") +
      (compare
        ? "左：第五轮基线 / 右：ACTION-A-DOLL-HIT（同输入、同模拟时间）\n"
        : "") +
      s.layers
        .map(
          (l) =>
            `${l.name}: ${l.enabled ? "ON" : "OFF"} weight=${l.weight.toFixed(2)} age=${l.age.toFixed(3)} blend=${l.blend.toFixed(2)}`,
        )
        .join(" | ") +
      "\n" +
      `pelvis=${JSON.stringify(s.pelvisOffset)} | elbow=${s.elbowDirection.toFixed(3)} | recovery=${JSON.stringify(s.combatRecovery)} | load=${s.contacts.map((c) => c.weight.toFixed(2) + ":" + c.stage).join(" / ")}\n` +
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
  doll.reset();
  dollTime = 0;
  dollRemainder = 0;
  age = 0;
  x = game.scale.width / 2;
  const s = game.scene.getScenes(true)[0] as Studio;
  s?.actors && Object.values(s.actors).forEach((a) => a.reset());
  s?.baseline && Object.values(s.baseline).forEach((a) => a.reset());
};
for (const id of [
  "actor",
  "action",
  "facing",
  "replay",
  "doll-kind",
  "doll-air",
  "doll-auto",
])
  el(id).onchange = reset;
el("reset").onclick = reset;
window.addEventListener("resize", () =>
  game.scale.resize(Math.min(1348, innerWidth - 48), 480),
);
