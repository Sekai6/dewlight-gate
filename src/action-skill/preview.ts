import Phaser from "phaser";
import { ActionActor } from "../action-a/actor";
import { guardianAction } from "../action-a/drivers";
import { GuardianArt } from "../boss-art";
import { createGuardian, stepGuardian } from "../boss";
import { SkillRuntime } from "./runtime";
import { SKILLS, SKILL_IDS } from "./config";
import { SkillArt } from "./art";
import { createPresentation, samplePresentation } from "./presentation";
import type { SkillId, Difficulty, SkillEvent } from "./types";
document.body.innerHTML = `<main><header><h1>Action-skill · 剑舞实验室</h1><a href="./">返回游戏</a> · <a href="?action-a">ACTION-A 骨骼预览</a></header><nav>
<label>回放 <select id="scenario"><option value="combo">Q → R → F 连携</option>${SKILL_IDS.map((id) => `<option value="${id}">${SKILLS[id].key} · ${SKILLS[id].name}</option>`).join("")}<option value="charge">Boss 冲锋</option><option value="slam">Boss 根浪</option><option value="crystal">Boss 折冠散晶</option><option value="garden">Boss 根庭绽刺</option><option value="radiance">Boss 露冠辉落</option></select></label>
<label>朝向 <select id="facing"><option value="1">向右</option><option value="-1">向左</option></select></label><label>难度 <select id="difficulty"><option value="normal">普通</option><option value="challenge">挑战</option></select></label>
<label>速度 <select id="rate"><option value="1">正常</option><option value="0.25">¼ 慢放</option></select></label><label><input id="bones" type="checkbox" checked>骨骼与握柄</label><label><input id="ranges" type="checkbox" checked>实际命中范围</label><label><input id="effects" type="checkbox" checked>技能演出</label><label><input id="reduced" type="checkbox">减少动态</label>
<button id="pause">暂停</button><button id="step">步进 1/120 秒</button><button id="phase">到下一阶段</button><button id="reset">重新回放</button></nav><div id="stage"></div><pre id="diagnostics"></pre><p>固定 120 Hz 模拟；范围来自技能定义；角色、约束、剑路和 Boss 危险区复用游戏实现。此页仅开发模式可访问。</p></main>`;
const css = document.createElement("style");
css.textContent = `body{margin:0;background:#152f35;color:#ecedcf;font:14px system-ui}main{max-width:1400px;margin:auto;padding:20px}header{display:flex;align-items:center;gap:14px}h1{font-size:24px;margin-right:auto}a{color:#c5e6ca}nav{display:flex;flex-wrap:wrap;gap:14px;margin:18px 0;align-items:center}button,select{background:#2b4e50;color:#f4e7be;border:1px solid #739d90;border-radius:7px;padding:8px}#stage{height:500px;overflow:hidden;border:1px solid #719489;border-radius:15px}pre{white-space:pre-wrap;line-height:1.6;min-height:150px;color:#c8e3d0}p{color:#9db7ab}`;
document.head.append(css);
const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const value = (id: string) => el<HTMLSelectElement>(id).value;
const checked = (id: string) => el<HTMLInputElement>(id).checked;
let paused = false,
  extra = 0,
  remainder = 0,
  clock = 0,
  x = 350,
  y = 1100,
  vy = 0,
  energy = 100,
  sent = 0;
const runtime = new SkillRuntime();
let boss = createGuardian(),
  events: SkillEvent[] = [];
const path: { x: number; y: number }[] = [];
class Preview extends Phaser.Scene {
  hero!: ActionActor;
  bossArt!: GuardianArt;
  art!: SkillArt;
  g!: Phaser.GameObjects.Graphics;
  presentation = createPresentation();
  create() {
    this.hero = new ActionActor(this, "hero", 5);
    this.bossArt = new GuardianArt(this);
    this.art = new SkillArt(this);
    this.g = this.add.graphics().setDepth(9);
    this.cameras.main.setZoom(2).centerOn(540, 1000);
    reset();
  }
  simulate(dt: number) {
    clock += dt;
    const scenario = value("scenario"),
      facing = Number(value("facing"));
    if (
      ["charge", "slam", "crystal", "garden", "radiance"].includes(scenario)
    ) {
      stepGuardian(boss, clock, dt, { x: 2650, y: 1100 });
      return;
    }
    const input = { energy, grounded: y >= 1100, facing };
    const order: SkillId[] =
      scenario === "combo"
        ? ["branch", "rise", "bloom"]
        : [scenario as SkillId];
    if (
      sent < order.length &&
      (!runtime.active || runtime.active.phase === "recovery")
    ) {
      if (runtime.request(order[sent], input)) sent++;
    }
    const out = runtime.tick(dt, input);
    energy -= out.cost;
    x += out.dx;
    if (out.launch !== null) vy = out.launch;
    vy += 1350 * out.gravity * dt;
    y = Math.min(1100, y + vy * dt);
    if (y >= 1100) vy = 0;
    for (const e of out.events) {
      events.push(e);
      this.art.event(e, x, y, clock, facing);
    }
    if (events.length > 24) events.splice(0, events.length - 24);
    path.push({ x, y });
    if (path.length > 360) path.shift();
  }
  update(_t: number, ms: number) {
    remainder +=
      (paused ? 0 : Math.min(ms / 1000, 0.1) * Number(value("rate"))) + extra;
    extra = 0;
    while (remainder >= 1 / 120 - 1e-9) {
      this.simulate(1 / 120);
      remainder -= 1 / 120;
    }
    const isBoss = !["combo", ...SKILL_IDS].includes(value("scenario"));
    this.g.clear();
    this.g.lineStyle(2, 0x718f75, 0.8);
    this.g.lineBetween(isBoss ? 2380 : 100, 1100, isBoss ? 3160 : 1000, 1100);
    const pose = runtime.pose,
      facing = Number(value("facing")),
      reduced = checked("reduced");
    this.cameras.main
      .centerOn(isBoss ? 2770 : 540, 1000)
      .setZoom(isBoss ? 1.35 : 2);
    this.hero.setDebug(checked("bones"));
    this.hero.draw({
      x,
      y,
      clock,
      facing,
      action: pose ? `skill-${pose.id}` : y < 1100 ? "fall" : "idle",
      age: pose?.age ?? clock,
      instance: pose ? `skill:${pose.instance}` : undefined,
      skillPose: pose,
      vx: 0,
      vy,
      grounded: y >= 1100,
      support: { id: "floor", x: 100, y: 1100, left: 100, right: 1100 },
      reduced,
      visible: !isBoss,
    });
    this.bossArt.actor.setDebug(checked("bones"));
    this.bossArt.draw(boss, clock, isBoss, reduced);
    this.art.draw(
      clock,
      { x, y, facing },
      pose,
      reduced,
      !isBoss && checked("effects"),
    );
    if (checked("ranges") && pose) {
      const d = SKILLS[pose.id];
      for (const h of d.hits) {
        const active =
          Math.abs(pose.age - h.at) < 0.035 ||
          (pose.age >= h.at && pose.age <= h.end);
        this.g.lineStyle(
          active ? 2 : 1,
          active ? 0xffda9b : 0xa6d7ca,
          active ? 0.9 : 0.22,
        );
        this.g.strokeRect(
          x - (pose.id === "bloom" || facing < 0 ? h.reach : 30),
          y - h.height,
          h.reach + (pose.id === "bloom" ? h.reach : 30),
          2 * h.height,
        );
      }
    }
    if (checked("ranges") && path.length > 1) {
      this.g.lineStyle(1, 0xf0d397, 0.5);
      this.g.beginPath();
      this.g.moveTo(path[0].x, path[0].y);
      path.forEach((p) => this.g.lineTo(p.x, p.y));
      this.g.strokePath();
    }
    const snap = this.hero.snapshot();
    if (pose) samplePresentation(pose, this.presentation);
    el("diagnostics").textContent =
      `${isBoss ? `BOSS ${boss.phase} · ${boss.hp}/${boss.maxHp} · hazards=${boss.hazards.length}` : `${pose?.id ?? "idle"} / ${pose?.phase ?? "complete"} / ${(pose?.age ?? 0).toFixed(3)}s`} | 模拟 ${clock.toFixed(3)}s\n光能 ${energy} | ${JSON.stringify(runtime.snapshot().cooldowns)}\n握柄误差 ${snap.armError.toFixed(5)} px · 剑尖速度 ${snap.swordSpeed.toFixed(1)} px/s\n演出蓄势 ${pose ? this.presentation.anticipation.toFixed(2) : "0"} · 释放 ${pose ? this.presentation.release.toFixed(2) : "0"} · 收势 ${pose ? this.presentation.recovery.toFixed(2) : "1"}\n事件 ${events.map((e) => `${e.instance}:${e.type}${e.section === undefined ? "" : `#${e.section}`}@${e.at.toFixed(3)}`).join(" → ")}`;
  }
}
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "stage",
  width: Math.min(1360, innerWidth - 40),
  height: 500,
  backgroundColor: "#24443f",
  scene: Preview,
  antialias: true,
});
function reset() {
  runtime.reset();
  clock = remainder = 0;
  sent = 0;
  energy = 100;
  x = Number(value("facing")) > 0 ? 350 : 730;
  y = value("scenario") === "bloom" ? 970 : 1100;
  vy = 0;
  events = [];
  path.length = 0;
  boss = createGuardian(false, value("difficulty") as Difficulty);
  boss.phase = "stalk";
  boss.until = 0.01;
  boss.attacks =
    (
      { charge: 0, slam: 1, crystal: 2, garden: 3, radiance: 3 } as Record<
        string,
        number
      >
    )[value("scenario")] ?? 0;
  if (value("scenario") === "radiance") boss.hp = boss.maxHp / 2;
  const scene = game.scene.getScenes(true)[0] as Preview;
  scene?.hero?.reset();
  scene?.bossArt?.actor.reset();
  scene?.art?.reset();
}
el("pause").onclick = () => {
  paused = !paused;
  el("pause").textContent = paused ? "播放" : "暂停";
};
el("step").onclick = () => {
  paused = true;
  extra = 1 / 120;
  el("pause").textContent = "播放";
};
el("phase").onclick = () => {
  paused = true;
  el("pause").textContent = "播放";
  const scene = game.scene.getScenes(true)[0] as Preview;
  const isBoss = !["combo", ...SKILL_IDS].includes(value("scenario"));
  if (!isBoss && !runtime.active) scene.simulate(1 / 120);
  const phase = isBoss ? boss.phase : runtime.active?.phase;
  if (!phase) return;
  for (let i = 0; i < 240; i++) {
    scene.simulate(1 / 120);
    if ((isBoss ? boss.phase : runtime.active?.phase) !== phase) break;
  }
};
el("reset").onclick = reset;
for (const id of ["scenario", "facing", "difficulty"]) el(id).onchange = reset;
