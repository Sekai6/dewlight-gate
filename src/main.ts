import Phaser from "phaser";
import "./style.css";
import { WebGPUCompositor } from "./webgpu";
import { ArtDirector } from "./art";
import { JourneyCamera } from "./camera";
import { WindArt } from "./wind-art";
import { sampleWind, windZones } from "./wind";
import { guideLanding, type GuideObjective } from "./navigation";
import { recordWindTrial } from "./trials";
import { GuideArt } from "./guide-art";
import { parsePreferences } from "./preferences";
import { attractPickup } from "./pickups";
import { GuardianArt } from "./boss-art";
import {
  createGuardian,
  stepGuardian,
  hitGuardian,
  bindGuardian,
  GUARDIAN,
} from "./boss";
import { Effects } from "./effects";
import { drawMonument } from "./entities";
import { CreatureDirector } from "./creature-art";
import { hurtCreature, stepCreature, type Enemy } from "./creature";
import {
  platforms,
  beadId,
  stones,
  prisms,
  rooms,
  memories,
  enemySpawns,
  WORLD_WIDTH,
  ROOM_WIDTH,
  ROOMS_PER_REGION,
  GROUND_Y,
  routeGoals,
  type Prism,
  type Platform,
} from "./level";
import {
  fresh,
  parseSave,
  collect,
  KEY,
  names,
  stories,
  formatTime,
  type Save,
} from "./state";

let save: Save = fresh(),
  stored: Save | null = null,
  storageOK = true;
try {
  stored = parseSave(localStorage.getItem(KEY));
} catch {
  storageOK = false;
}
let preferences = parsePreferences(null);
try {
  preferences = parsePreferences(
    localStorage.getItem("dewlight.preferences.v1"),
  );
} catch {
  /* Optional. */
}
function storePreferences() {
  preferences = {
    muted,
    volume,
    reduced,
    guide: scene?.guideEnabled ?? preferences.guide,
    shake: preferences.shake,
    contrast: preferences.contrast,
  };
  try {
    localStorage.setItem(
      "dewlight.preferences.v1",
      JSON.stringify(preferences),
    );
  } catch {
    /* Optional. */
  }
}
let mode: "title" | "play" | "pause" | "end" = "title",
  tab = "旅程",
  muted = preferences.muted,
  reduced = preferences.reduced,
  volume = preferences.volume;
type Quality = "soft" | "dream" | "webgpu";
let quality: Quality = "dream",
  graphicsBusy = false;
try {
  const savedQuality = localStorage.getItem("dewlight.graphics.v1");
  if (savedQuality === "soft" || savedQuality === "webgpu")
    quality = savedQuality;
} catch {
  /* The journey also works without settings storage. */
}
let compositor: WebGPUCompositor | undefined;
async function applyGraphics(requested: Quality) {
  if (graphicsBusy || !compositor) return;
  graphicsBusy = true;
  render();
  if (requested === "webgpu") {
    const ready = await compositor.enable();
    quality = ready ? "webgpu" : "dream";
    if (!ready)
      toast(
        "无法启用 WebGPU，已切换到绮梦画质。请使用支持 WebGPU 的浏览器及 localhost / HTTPS 地址。",
      );
  } else {
    compositor.disable();
    quality = requested;
  }
  try {
    localStorage.setItem("dewlight.graphics.v1", quality);
  } catch {
    /* Optional preference. */
  }
  graphicsBusy = false;
  render();
}
let scene: Journey;
let audio: AudioContext | undefined;
let toastUntil = 0,
  toastText = "";
let uiClock = 0;
const ui = document.querySelector<HTMLDivElement>("#ui")!;
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);
function gateOpen(room: number) {
  if (room === 0) return save.stones.includes(0);
  return (
    prisms
      .filter((p) => p.room === room)
      .every((p) => save.lenses.includes(p.id)) &&
    (room % ROOMS_PER_REGION !== ROOMS_PER_REGION - 1 ||
      save.stones.includes(Math.floor(room / ROOMS_PER_REGION)))
  );
}
function mapIllustration(index: number) {
  const region = Math.floor(index / 2);
  const motif =
    region === 0
      ? `<path d="M24 54Q40 27 30 8M30 27Q15 30 10 19M31 22Q46 20 53 6" fill="none" stroke="#83a68d" stroke-width="3"/><ellipse cx="19" cy="18" rx="14" ry="5" fill="#698f7f"/><ellipse cx="46" cy="8" rx="17" ry="6" fill="#8aaa8c"/><path d="M77 53V25Q93 1 109 25V53M83 52V28Q93 12 103 28V52" fill="none" stroke="#bfd0a4"/>`
      : region === 1
        ? `<path d="M22 54L33 7L48 31L41 54ZM64 54L74 22L89 3L99 54Z" fill="#7eb4ba" fill-opacity=".25" stroke="#acd3d0"/><path d="M33 7L34 54M74 22L86 54L89 3M18 34H52M63 37H102" fill="none" stroke="#d5e4d0" stroke-opacity=".5"/>`
        : `<path d="M16 58Q61 20 39 3M31 34Q63 39 100 6" fill="none" stroke="#7d9a78" stroke-width="5"/><path d="M55 30V48M77 20V43M96 10V32" fill="none" stroke="#d4d6ac"/><path d="M50 48L55 40L60 48ZM72 43L77 35L82 43ZM91 32L96 24L101 32Z" fill="#d4d6ac" fill-opacity=".5"/><ellipse cx="35" cy="16" rx="13" ry="5" fill="#8ba585" transform="rotate(-35 35 16)"/>`;
  return `<svg class="map-art" viewBox="0 0 130 65" aria-hidden="true"><path d="M2 55L16 48L42 52L60 46L86 51L113 45L128 53L115 63L72 58L31 64Z" fill="#789c87" fill-opacity=".16"/>${motif}<path d="M4 56Q65 49 126 54" fill="none" stroke="#b3c9a4" stroke-opacity=".5"/><circle cx="116" cy="9" r="3" fill="#e2d6a4"/></svg>`;
}
function journeyMap() {
  const current = Math.min(
    rooms.length - 1,
    Math.floor((scene?.x ?? 0) / ROOM_WIDTH),
  );
  return (
    '<div class="journey-map" aria-label="六座花园路线">' +
    rooms
      .map(
        (r, i) =>
          '<div class="map-node ' +
          (i === current ? "current " : "") +
          (gateOpen(i) ? "visited" : "") +
          '"><span>' +
          mapIllustration(i) +
          "</span><small>" +
          r.name +
          "</small><em>" +
          prisms
            .filter((p) => p.room === i)
            .map((p) => (save.lenses.includes(p.id) ? "●" : "○"))
            .join(" ") +
          "</em></div>",
      )
      .join("") +
    "</div>"
  );
}

function persist() {
  if (scene?.started) save.position = { ...scene.safe };
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    stored = structuredClone(save);
  } catch {
    storageOK = false;
  }
}
function sound(freq = 520) {
  if (muted || volume <= 0) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      freq * 1.45,
      audio.currentTime + 0.2,
    );
    g.gain.setValueAtTime(volume * 0.12, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.45);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.45);
  } catch {
    /* Audio is optional. */
  }
}
function toast(t: string) {
  toastText = t;
  toastUntil = performance.now() + 4000;
  render();
}
function pause() {
  if (mode === "play") {
    mode = "pause";
    scene.clearInput();
    tab = "旅程";
    persist();
    render();
  }
}
function resume() {
  if (document.hidden || !scene.started) return;
  if (mode === "end") scene.effects.reset();
  mode = "play";
  scene.clearInput();
  render();
}
function start(load: boolean) {
  save = load && stored ? structuredClone(stored) : fresh();
  mode = "play";
  scene.resetWorld();
  sound();
  persist();
  render();
}
const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function trialCard() {
  const room = Math.min(
    rooms.length - 1,
    Math.floor((scene?.x ?? 0) / ROOM_WIDTH),
  );
  return `<section class="trial-card"><div><small>可选 · 风之邀约</small><strong>${rooms[room].name}</strong></div><p>${save.trials.includes(`rise-${room}`) ? "✧" : "◇"} 借上升风登高一段　${save.trials.includes(`turn-${room}`) ? "✧" : "◇"} E 转动玻璃风花</p><small>${save.trials.includes(`seal-${room}`) ? "已获得风语玻璃签" : "完成两项，留下本庭的风语玻璃签。没有时限，可随时回来。"}</small></section>`;
}
function render() {
  const count = save.stones.length,
    hp = scene?.hp ?? 5,
    energy = scene?.energy ?? 100;
  let panel = "";
  if (mode === "title")
    panel = `<div class="eyebrow">A SMALL ADVENTURE · 01</div><h1>晨露之门</h1><p>在世界醒来之前，借一束光出发。<br>穿过玻璃与藤蔓交织的庭院，唤醒三座沉默的石碑。</p><div class="actions"><button class="btn primary" data-action="new">开启旅程 →</button>${stored ? '<button class="btn" data-action="continue">继续旅程</button>' : ""}<button class="btn" data-action="help">操作说明</button></div>${stored ? `<p class="continue-summary">继续位置：${rooms[Math.max(0, Math.min(5, Math.floor((stored.position?.x ?? (stored.checkpoint ? stones[stored.checkpoint - 1].x : 130)) / ROOM_WIDTH)))].name} · ${stored.lenses.length}/24 灯环 · ${formatTime(stored.elapsed)}</p>` : ""}<p class="smallwarn">请使用电脑键盘游玩，推荐窗口宽度 1024 像素以上。</p>`;
  if (mode === "pause") {
    const content =
      tab === "旅程"
        ? `<div class="current-quest"><small>当前目标</small><h3>${escapeHtml(scene.guideObjective.title)}</h3><p>${escapeHtml(scene.guideObjective.detail)} · ${escapeHtml(scene.nextGuideStep.action)}</p><small>光箭头指向下一处落脚点；H 可显示或收起。机关提示靠近时会补充具体按键。</small></div>${journeyMap()}${trialCard()}<p>第一关沿溪向右，帮助露冠守卫苏醒后开启晨光之门；蕨叶浅溪为可选探索。后续花园沿四盏灯环探索高处、溪流与根脉。金色刻痕表示正确折光方向；叶片灯环需要 K 固定平台；守卫灯环需要先束缚或击败守卫。</p><div class="cards">${names.map((n, i) => `<div class="card"><div class="eyebrow">0${i + 1} / ${save.stones.includes(i) ? "AWAKENED" : "WAITING"}</div><h3>${n}</h3><p>${["晨露庭院 · 露冠守卫", "玻璃阶地 · 让光停留", "藤冠高台 · 向彼此生长"][i]}</p><strong>${save.stones.includes(i) ? "✧ 已唤醒" : "◇ 尚在沉睡"}</strong></div>`).join("")}</div><p>旅程时间 ${formatTime(save.elapsed)} · 已唤醒 ${count}/3 座石碑</p>`
        : tab === "日志"
          ? `<ul class="logs">${save.logs.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
          : tab === "背包"
            ? `<div class="cards"><div class="card"><strong>◈ ${save.beads.length} 玻璃珠</strong><p>清晨留下的碎光。收集成果会一直保留。</p></div><div class="card"><strong>✧ ${save.trials.filter((t) => t.startsWith("seal-")).length} / 6 风语玻璃签</strong><p>完成每座花园的乘风与转向邀约，收集不重复的纪念签。</p></div>${save.stones.map((i) => `<div class="card"><strong>${names[i]}印记</strong><p>${stories[i]}</p></div>`).join("")}</div>`
            : `<p>A / D 或 ← / →：移动（按住 C 慢行）　　空格：跳跃　　S / ↓ + 空格：穿下平台<br>风场：跳起借上升风登高，顺风延长跳跃；按住 S / ↓ 抵风下降；靠近玻璃风花按 E 反转横风 8 秒<br>J：攻击（连续按下交替挥斩）　　Shift：冲刺（冷却 1.1 秒）<br>K：藤蔓束缚（25 光能）　　E：交互<br>Tab：旅程页　　Esc：暂停 / 返回　　H：显示 / 收起引导</p><p>藤蔓可束缚前方敌人 3 秒，或固定标有叶片的移动平台 5 秒。靠近目标后使用。光能会自动恢复；坠落返回安全地面，倒下返回石碑，不丢失玻璃珠。已唤醒石碑可 E 休憩恢复；暂停页可回到检查点，刷新后继续最近的安全落脚处。苔甲与璃翅会先锁定方向、亮起暖金色预警，再扑向前方；可以冲刺穿过或用藤蔓打断。</p>`;
    panel = `<div class="eyebrow">TAKE A BREATH</div><h2>暂停 · 旅程手记</h2><div class="tabs">${["旅程", "日志", "背包", "操作"].map((t) => `<button class="btn ${tab === t ? "active" : ""}" data-tab="${t}">${t}</button>`).join("")}</div><div class="page-content">${content}</div><div class="actions"><button class="btn primary" data-action="${scene.started ? "resume" : "title"}">${scene.started ? "继续探索 →" : "返回标题"}</button>${scene.started ? '<button class="btn" data-action="checkpoint" title="保留所有收集和任务进度">回到检查点</button>' : ""}<button class="btn" data-action="restart">重新开始</button><button class="btn" data-action="title">回到标题</button></div>`;
  }
  if (mode === "end")
    panel = `<div class="eyebrow">THE MORNING REMEMBERS</div><h1>清晨，为你醒来</h1><p>三束光在空中相遇。露珠滑落，藤蔓舒展，沉默的庭院终于重新呼吸。<br>谢谢你，替这个世界带回温柔。</p><div class="cards"><div class="card"><strong>3 / 3</strong><p>石碑已全部唤醒</p></div><div class="card"><strong>${save.beads.length} / ${scene.totalBeads}</strong><p>收集的玻璃珠（含敌人掉落）</p></div><div class="card"><strong>${formatTime(save.elapsed)}</strong><p>与你一起走过的时间</p></div></div><div class="actions"><button class="btn primary" data-action="resume">继续漫步 →</button><button class="btn" data-action="restart">再走一次</button></div>`;
  const dashReady = scene ? Math.min(1, (scene.clock - scene.dashAt) / 1.1) : 1;
  const guide = scene?.guideObjective;
  const guidance =
    guide &&
    scene.started &&
    mode === "play" &&
    scene.guideEnabled &&
    count < 3 &&
    !scene.arena
      ? `<aside class="quest-banner ${scene.clock - scene.guideChangedAt < 6 ? "unfurled" : "settled"}" aria-label="当前旅程目标"><div class="quest-wings" aria-hidden="true"><svg viewBox="0 0 300 36"><g fill="none" stroke="#dcd7ae" stroke-width=".8" opacity=".7"><path d="M20 26Q82 33 136 17M280 26Q218 33 164 17M40 27Q44 13 59 20Q49 29 40 27M70 26Q76 10 88 17Q82 27 70 26M101 22Q109 8 119 14Q114 22 101 22M260 27Q256 13 241 20Q251 29 260 27M230 26Q224 10 212 17Q218 27 230 26M199 22Q191 8 181 14Q186 22 199 22"/></g><path d="M150 4L159 16L150 29L141 16Z" fill="#bfe6d52e" stroke="#e8dfb6" stroke-width=".9"/><path d="M150 4V29M141 16H159" stroke="#d1ead4" stroke-width=".6" opacity=".7"/><circle cx="130" cy="19" r="1.5" fill="#ded9ab"/><circle cx="170" cy="19" r="1.5" fill="#ded9ab"/></svg></div><small>循光而行 · ${rooms[guide.room].name}</small><strong>${escapeHtml(guide.title)}</strong><div class="quest-detail">${escapeHtml(guide.detail)}</div><div class="quest-pips" aria-label="本庭灯环进度">${[0, 1, 2, 3].map((i) => `<i class="${save.lenses.includes(`lens-${guide.room}-${i}`) ? "lit" : ""}"></i>`).join("")}<span>Tab 查看邀约 · H 收起</span></div></aside>`
      : "";
  const markup = `${guidance}<header class="topbar"><div class="brand">晨露之门<small>DEWLIGHT / GATE</small></div><div class="hud"><span class="hearts" aria-label="生命 ${hp} / 5">${Array.from({ length: 5 }, (_, i) => `<svg class="heart ${i < hp ? "full" : "empty"}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C8 17 2 13 2 7.5C2 2 9 1 12 6C15 1 22 2 22 7.5C22 13 16 17 12 21Z"/></svg>`).join("")}</span><span>光能 <strong>${Math.floor(energy)}</strong><span class="energy"><i style="width:${energy}%"></i></span></span><span>◈ <strong>${save.beads.length.toString().padStart(2, "0")}</strong></span><span>石碑 <strong>${count}/3</strong></span><button class="iconbtn" data-action="pause" aria-label="暂停旅程">Ⅱ</button></div></header><div class="location"><span>THE DEWBOUND JOURNEY</span><b>${["晨露庭院", "玻璃阶地", "藤冠高台"][scene?.region ?? 0]}</b><p>${count === 3 ? "晨光已经归来，继续寻找遗漏的微光。" : `${rooms[Math.min(rooms.length - 1, Math.floor((scene?.x ?? 0) / ROOM_WIDTH))].name} · ${scene?.lensObjective ?? "寻找高处的棱镜"}`}</p></div><footer class="bottom"><div class="keys"><span><kbd>A D</kbd>移动 / C 慢行</span><span><kbd>SPACE</kbd>跳跃 / S+空格 下落</span><span><kbd>J</kbd>攻击</span><span><kbd class="dash-key" style="--ready:${dashReady * 100}%" title="${dashReady >= 1 ? "冲刺已就绪" : "冲刺恢复中"}">SHIFT</kbd>冲刺</span><span><kbd>K</kbd>束缚</span><span><kbd>E</kbd>交互</span><span><kbd>TAB</kbd>旅程</span><span><kbd>H</kbd>引导</span></div><div class="chapter">✧　让微小的光，带你向前</div></footer>${scene?.started && mode === "play" && (hp <= 2 || energy < 25) ? `<div class="resource-status" role="status">${hp <= 2 ? "生命偏低 · 石碑可休憩，Tab 可回检查点" : "光能恢复中 · 束缚需要 25 光能"}</div>` : ""}${scene?.started && mode === "play" && scene.clock - scene.pickupAt < 1.2 ? `<div class="pickup-note" aria-label="收集反馈">✧ +${scene.pickupCount} 玻璃珠</div>` : ""}${performance.now() < toastUntil ? `<div class="toast" role="status">${escapeHtml(toastText)}</div>` : ""}${panel ? `<div class="overlay"><section class="panel">${panel}<div class="settings"><label><input id="mute" type="checkbox" ${muted ? "checked" : ""}>静音</label><label>音量 <input id="volume" type="range" min="0" max="1" step=".05" value="${volume}"></label><label><input id="motion" type="checkbox" ${reduced ? "checked" : ""}>减少动态效果</label><label><input id="guidance" type="checkbox" ${scene?.guideEnabled ? "checked" : ""}>寻路引导</label><label><input id="shake" type="checkbox" ${preferences.shake ? "checked" : ""}>镜头震动</label><label><input id="contrast" type="checkbox" ${preferences.contrast ? "checked" : ""}>清晰界面</label><label>画质 <select id="quality" aria-label="画质" ${graphicsBusy ? "disabled" : ""}><option value="soft" ${quality === "soft" ? "selected" : ""}>轻盈 · 兼容</option><option value="dream" ${quality === "dream" ? "selected" : ""}>绮梦 · 推荐</option><option value="webgpu" ${quality === "webgpu" ? "selected" : ""}>绮梦 · WebGPU</option></select></label><small class="graphics-status" role="status">${graphicsBusy ? "正在准备 WebGPU 光影…" : quality === "webgpu" ? "WebGPU 光影已启用 · 多重光晕与细微折射" : quality === "soft" ? "减少飘花、悬露与雾层，保留场景完整美术" : "完整花园层次与光效 · WebGPU 档需浏览器支持"}</small></div>${storageOK ? "" : '<div class="notice">浏览器无法保存进度，本次旅程仍可正常游玩。</div>'}</section></div>` : ""}`;
  ui.dataset.mode = mode;
  ui.dataset.motion = reduced ? "reduced" : "full";
  ui.dataset.contrast = preferences.contrast ? "high" : "normal";
  if (
    mode === "play" &&
    ui.querySelector(".topbar") &&
    !ui.querySelector(".overlay")
  ) {
    // Keep the focused pause button alive while updating resource counters.
    const template = document.createElement("template");
    template.innerHTML = markup;
    const next = template.content;
    const currentSpans = ui.querySelectorAll(".hud > span");
    next.querySelectorAll(".hud > span").forEach((span, i) => {
      if (currentSpans[i]?.innerHTML !== span.innerHTML)
        currentSpans[i].innerHTML = span.innerHTML;
    });
    for (const selector of [
      ".location",
      ".toast",
      ".quest-banner",
      ".pickup-note",
      ".resource-status",
    ]) {
      const old = ui.querySelector(selector),
        replacement = next.querySelector(selector);
      if (old && replacement) {
        if (
          old.innerHTML !== replacement.innerHTML ||
          old.className !== replacement.className
        )
          old.replaceWith(replacement);
      } else if (old) old.remove();
      else if (replacement) ui.append(replacement);
    }
  } else ui.innerHTML = markup;
}
ui.addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-action],[data-tab]",
  );
  if (!el) return;
  sound(380);
  if (el.dataset.tab) {
    tab = el.dataset.tab;
    render();
    return;
  }
  switch (el.dataset.action) {
    case "new":
      if (!stored || confirm("开启新旅程会覆盖已有进度，确定吗？"))
        start(false);
      break;
    case "continue":
      start(true);
      break;
    case "resume":
      resume();
      break;
    case "checkpoint":
      scene.returnToCheckpoint();
      resume();
      break;
    case "pause":
      pause();
      break;
    case "help":
      mode = "pause";
      tab = "操作";
      render();
      break;
    case "restart":
      if (confirm("重新开始并清空旅程进度？")) start(false);
      break;
    case "title":
      if (scene.started) persist();
      scene.clearInput();
      scene.effects.reset();
      scene.label.setVisible(false);
      mode = "title";
      render();
      break;
  }
});
ui.addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.id === "mute") muted = t.checked;
  if (t.id === "volume") volume = Number(t.value);
  if (t.id === "motion") reduced = t.checked;
  if (t.id === "shake") preferences.shake = t.checked;
  if (t.id === "contrast") {
    preferences.contrast = t.checked;
    ui.dataset.contrast = t.checked ? "high" : "normal";
  }
  if (t.id === "guidance") scene.guideEnabled = t.checked;
  storePreferences();
});
ui.addEventListener("change", (e) => {
  const target = e.target as HTMLSelectElement;
  if (target.id === "quality") void applyGraphics(target.value as Quality);
});
document.addEventListener("keydown", (e) => {
  if (["Tab", "Escape"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === "KeyR" && mode === "play" && scene.arena)
    scene.retryGuardian();
  if (e.code === "KeyH" && mode === "play") {
    scene.guideEnabled = !scene.guideEnabled;
    storePreferences();
    render();
  }
  if (e.code === "Tab" || e.code === "Escape") {
    if (mode === "play") pause();
    else if (mode === "pause" && scene.started) resume();
    else if (mode === "pause") {
      scene.clearInput();
      scene.effects.reset();
      scene.label.setVisible(false);
      mode = "title";
      render();
    }
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("blur", pause);
window.addEventListener("beforeunload", () => {
  if (scene?.started) persist();
});

class Journey extends Phaser.Scene {
  framing = new JourneyCamera();
  art!: ArtDirector;
  creatures!: CreatureDirector;
  hitPause = 0;
  attackStyle = 0;
  stride = 0;
  turnAt = -999;
  brakeAt = -999;
  previousMove = 0;
  launchAt = -999;
  pendingKeys = new Set<string>();
  endingAt = 0;
  effects!: Effects;
  windArt!: WindArt;
  guideArt!: GuideArt;
  guideEnabled = preferences.guide;
  pickupCount = 0;
  pickupAt = -999;
  private pickupSoundAt = -999;
  private dashInputAt = -999;
  private collectedStamp = -1;
  private collectedIds = new Set<string>();
  guideChangedAt = 0;
  private guideKey = "";
  private windRide: { id: string; y: number } | null = null;
  private guideCacheAt = -999;
  private guideGround = -2;
  private guidePoint = { x: 610, y: 1020, action: "空格 · 跃上枝台" };
  windTurns: Record<string, number> = {};
  g!: Phaser.GameObjects.Graphics;
  bg!: Phaser.GameObjects.Graphics;
  label!: Phaser.GameObjects.Text;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  x = 130;
  y = GROUND_Y;
  vx = 0;
  vy = 0;
  facing = 1;
  hp = 5;
  energy = 100;
  region = 0;
  started = false;
  clock = 0;
  lastGround = 0;
  jumpAt = -999;
  dropUntil = -999;
  dropIndex = -1;
  dashAt = -999;
  attackAt = -999;
  private attackResolved = true;
  private attackInputAt = -999;
  bindAt = -999;
  bindTarget = { x: 0, y: 0 };
  hurtAt = -999;
  hitDirection = 0;
  safe = { x: 130, y: GROUND_Y };
  onGround = false;
  groundIndex = -1;
  enemies: Enemy[] = [];
  beads: { x: number; y: number; id: string }[] = [];
  totalBeads = 0;
  saveClock = 0;
  regionSeen = new Set<number>();
  accumulator = 0;
  constructor() {
    super("journey");
  }
  guardian = createGuardian();
  get arena() {
    return this.x > 2200 &&
      this.x < 3300 &&
      !["sleep", "defeated"].includes(this.guardian.phase)
      ? { left: GUARDIAN.left, right: GUARDIAN.right, floor: 1100 }
      : undefined;
  }
  guardianArt!: GuardianArt;
  resetAnimations() {
    this.art?.reset();
    this.creatures?.actors.forEach((actor) => actor.reset());
    this.guardianArt?.actor.reset();
  }
  retryGuardian() {
    if (!this.arena) return;
    this.guardian = createGuardian();
    this.x = 2310;
    this.y = 1100;
    this.hp = 5;
    this.energy = 100;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.groundIndex = -1;
    this.safe = { x: this.x, y: this.y };
    this.hurtAt = this.clock;
    this.attackAt = -999;
    this.dashAt = -999;
    this.bindAt = -999;
    this.hitPause = 0;
    this.clearInput();
    this.effects.reset();
    this.resetAnimations();
    this.framing.reset();
    persist();
    toast("已回到空地入口。四点微光保留，准备好后向前再战。");
  }
  get collected() {
    if (this.collectedStamp !== save.beads.length) {
      this.collectedIds = new Set(save.beads);
      this.collectedStamp = save.beads.length;
    }
    return this.collectedIds;
  }
  recordTrial(room: number, step: "rise" | "turn") {
    const before = save.trials.length;
    if (recordWindTrial(save.trials, room, step)) {
      const entry = `风之邀约 · ${rooms[room].name}：已学会乘风与转向，获得一枚风语玻璃签。`;
      save.logs.push(entry);
      this.effects.burst(this.x, this.y - 35, this.clock, "collect", reduced);
      toast(entry);
      sound(920);
    }
    if (before !== save.trials.length) persist();
  }
  get guideObjective(): GuideObjective {
    const room = Math.min(rooms.length - 1, Math.floor(this.x / ROOM_WIDTH));
    const next = prisms.find(
      (p) => p.room === room && !save.lenses.includes(p.id),
    );
    if (next)
      return {
        id: next.id,
        x: next.x,
        y: next.y,
        room,
        order: next.order,
        title: `点亮${next.name}`,
        detail: this.prismHint(next),
      };
    if (room === 0 && !save.stones.includes(0))
      return {
        id: this.guardian.hp > 0 ? "guardian" : "stone-0",
        x: this.guardian.hp > 0 ? this.guardian.x - 65 : stones[0].x,
        y: 1100,
        room: 0,
        order: 4,
        title:
          this.guardian.hp > 0
            ? this.arena
              ? "露冠守卫 · 对决"
              : "唤醒露冠守卫"
            : "唤醒晨露碑",
        detail:
          this.guardian.hp > 0
            ? "按住 J 连击 · 红纹躲冲锋，金纹跳根浪 · K 打断 · R 重试"
            : "E · 守卫已经让开道路",
      };
    if (room === 0 && save.stones.includes(0))
      return {
        id: "first-exit",
        x: 3580,
        y: 1100,
        room: 0,
        order: 5,
        title: "第一关完成 · 前往玻璃阶地",
        detail: "E · 穿过晨光之门",
      };
    const stone = Math.floor(room / 2);
    if (room % 2 === 1 && !save.stones.includes(stone))
      return {
        id: `stone-${stone}`,
        x: stones[stone].x,
        y: stones[stone].y,
        room,
        order: 4,
        title: `唤醒${names[stone]}`,
        detail: "E · 唤醒石碑，留下检查点",
      };
    return {
      id: `gate-${room}`,
      x: Math.min(WORLD_WIDTH - 50, rooms[room].gate + 110),
      y: 1100,
      room,
      order: 4,
      title: save.stones.length === 3 ? "清晨已醒，自由漫步" : "前往下一座花园",
      detail: "沿地面向右，穿过光门",
    };
  }
  get nextGuideStep() {
    const objective = this.guideObjective;
    if (objective.id !== this.guideKey) {
      this.guideKey = objective.id;
      this.guideChangedAt = this.clock;
      this.guideCacheAt = -999;
    }
    if (
      this.guideCacheAt === -999 ||
      (this.onGround &&
        (this.groundIndex !== this.guideGround ||
          this.clock - this.guideCacheAt > 0.35)) ||
      this.clock < this.guideCacheAt
    ) {
      this.guidePoint = guideLanding(this, objective, platforms);
      this.guideCacheAt = this.clock;
      this.guideGround = this.groundIndex;
    }
    if (
      !this.onGround &&
      this.guidePoint.y > this.y + 45 &&
      sampleWind(this.x, this.y, this.clock, this.windTurns).lift > 1000
    )
      return { ...this.guidePoint, action: "S / ↓ · 收身离开上升风" };
    return this.guidePoint;
  }
  get lensObjective() {
    const r = Math.min(rooms.length - 1, Math.floor(this.x / ROOM_WIDTH));
    if (r === 0) return this.guideObjective.title;
    const next = prisms.find(
      (p) => p.room === r && !save.lenses.includes(p.id),
    );
    if (next)
      return (
        [
          "向右登高 · 金镜",
          "高处向左 · 青镜",
          "中层向右 · 露水镜",
          "根脉向左 · 灯座",
        ][next.order] +
        " " +
        (next.order + 1) +
        "/4"
      );
    return r % ROOMS_PER_REGION === ROOMS_PER_REGION - 1 &&
      !save.stones.includes(Math.floor(r / ROOMS_PER_REGION))
      ? "落回地面，唤醒本区石碑"
      : "光门已开，沿地面向右";
  }
  get layout() {
    return {
      platforms: platforms.map((p) => ({ ...p })),
      stones: stones.map((p) => ({ ...p })),
      prisms: prisms.map((p) => ({ ...p })),
      rooms: rooms.map((p) => ({ ...p })),
      lenses: [...save.lenses],
      routeGoals: routeGoals.map((g) => ({ ...g })),
      angles: { ...save.angles },
      elapsed: save.elapsed,
    };
  }
  prismHint(p: Prism) {
    if (save.lenses.includes(p.id)) return "✧ 光路已接通";
    if (p.mechanic === "reflect")
      return `E · 旋转镜面 ${["↑", "→", "↓", "←"][save.angles[p.id] ?? 0]} 对齐 ${["↑", "→", "↓", "←"][p.direction]}`;
    if (p.mechanic === "hold") {
      if (
        platforms.some(
          (v) => v.receiver === p.id && (v.frozen ?? 0) > this.clock,
        )
      )
        return "E · 叶台已固定，按下引光";
      return this.energy < 25
        ? "等待光能恢复至 25，再 K 固定叶台"
        : "K · 固定叶台，再 E 引光";
    }
    if (p.mechanic === "guard") {
      if (
        !this.enemies.some(
          (e) => e.guard === p.id && e.hp > 0 && e.bound <= this.clock,
        )
      )
        return "E · 守卫已安静，按下引光";
      return this.energy < 25
        ? "等待光能恢复，或 J 击退守卫"
        : "K · 束缚守卫，再 E 引光";
    }
    return `E · 点亮${p.name}`;
  }
  activatePrism(p: Prism) {
    if (save.lenses.includes(p.id)) {
      toast("这盏灯环已经记住了光的方向。");
      return;
    }
    if (p.order > 0 && !save.lenses.includes(`lens-${p.room}-${p.order - 1}`)) {
      toast("光尚未抵达这里。请先点亮上一盏灯环，Tab 可查看路线。");
      return;
    }
    if (
      p.mechanic === "hold" &&
      !platforms.some(
        (v) => v.receiver === p.id && (v.frozen ?? 0) > this.clock,
      )
    ) {
      toast("露水镜需要安静的落脚处：先 K 固定脚下的叶片平台，再按 E。");
      return;
    }
    if (
      p.mechanic === "guard" &&
      this.enemies.some(
        (e) => e.guard === p.id && e.hp > 0 && e.bound <= this.clock,
      )
    ) {
      toast("守卫还在扰动光线。先用 K 束缚它，或用 J 轻轻击退。");
      return;
    }
    if (p.mechanic === "reflect") {
      save.angles[p.id] = ((save.angles[p.id] ?? 0) + 1) % 4;
      sound(430);
      persist();
      if (save.angles[p.id] !== p.direction) {
        toast("镜面转过一格。让明亮指针与金色刻痕重合。");
        return;
      }
    }
    save.lenses.push(p.id);
    this.effects.burst(p.x, p.y - 67, this.clock, "collect", reduced);
    sound(620 + p.order * 100);
    const entry = `${rooms[p.room].name} · ${p.name}已点亮。`;
    if (!save.logs.includes(entry)) save.logs.push(entry);
    toast(
      p.room === 0
        ? [
            "第一点微光亮起。沿前方矮台继续，不必返回门廊。",
            "露珠落在溪畔。顺着右侧的光继续前进。",
            "守卫的灯种就在右方，接住它会唤醒守卫。",
            "四点微光唤醒了露冠守卫。向右进入空地，J 攻击、Shift 躲避、K 束缚。",
          ][p.order]
        : p.order === 3
          ? "四盏灯环已相连。落回地面，沿右方继续旅程。"
          : [
              "光沿树冠向左延伸。",
              "光落入中层溪流，带你向右。",
              "沿东侧开口落下，再循根脉向左。",
            ][p.order],
    );
    persist();
  }
  create() {
    scene = this;
    this.bg = this.add.graphics();
    this.g = this.add.graphics();
    this.label = this.add
      .text(0, 0, "", {
        fontFamily: "Microsoft YaHei",
        fontSize: "13px",
        color: "#eff0cd",
        backgroundColor: "#1a4139",
        padding: { x: 12, y: 8 },
      })
      .setResolution(pixelRatio())
      .setDepth(5);
    this.keys = this.input.keyboard!.addKeys(
      "A,D,LEFT,RIGHT,S,DOWN,SPACE,J,K,E,SHIFT,C",
    ) as typeof this.keys;
    this.input.keyboard!.on("keydown", (event: KeyboardEvent) => {
      if (event.repeat || mode !== "play") return;
      const aliases: Record<string, string> = {
        Space: "SPACE",
        ShiftLeft: "SHIFT",
        ShiftRight: "SHIFT",
        ArrowLeft: "LEFT",
        ArrowRight: "RIGHT",
        ArrowDown: "DOWN",
      };
      const key = aliases[event.code] ?? event.code.replace(/^Key/, "");
      if (this.keys[key]) this.pendingKeys.add(key);
    });
    this.cameras.main.setBounds(0, -120, WORLD_WIDTH, GROUND_Y + 450);
    this.cameras.main.setOrigin(0, 0);
    this.art = new ArtDirector(this, platforms);
    this.creatures = new CreatureDirector(this);
    this.effects = new Effects(this);
    this.guardianArt = new GuardianArt(this);
    this.windArt = new WindArt(this);
    this.guideArt = new GuideArt(this);
    compositor = new WebGPUCompositor(this.game.canvas, () => {
      quality = "dream";
      try {
        localStorage.setItem("dewlight.graphics.v1", quality);
      } catch {
        /* Optional. */
      }
      toast("WebGPU 已中断，已恢复绮梦兼容画质，旅程进度不受影响。");
      render();
    });
    this.game.events.on("postrender", () => {
      if (!compositor?.enabled) return;
      const cam = this.cameras.main;
      const threat = this.enemies
        .filter(
          (e) =>
            e.hp > 0 &&
            Math.abs(e.x - this.x) < 550 &&
            Math.abs(e.y - this.y) < 250 &&
            e.bound <= this.clock &&
            (e.phase === "windup" || this.clock - e.hurtAt < 0.2),
        )
        .sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x))[0];
      compositor?.draw({
        enemyX: threat
          ? ((threat.x - cam.scrollX) * cam.zoom) / this.scale.width
          : -10,
        enemyY: threat
          ? ((threat.y - 25 - cam.scrollY) * cam.zoom) / this.scale.height
          : -10,
        enemySignal: threat
          ? this.clock - threat.hurtAt < 0.2
            ? -(1 - (this.clock - threat.hurtAt) / 0.2)
            : 1 - threat.warn / (threat.type ? 0.85 : 0.7)
          : 0,
        facing: this.facing,
        bindX:
          ((this.bindTarget.x - cam.scrollX) * cam.zoom) / this.scale.width,
        bindY:
          ((this.bindTarget.y - cam.scrollY) * cam.zoom) / this.scale.height,
        bind: Math.min(1, Math.max(0, (this.clock - this.bindAt) / 0.65)),
        viewX: cam.scrollX,
        viewY: cam.scrollY,
        viewWidth: this.scale.width / cam.zoom,
        viewHeight: this.scale.height / cam.zoom,
        time: this.clock,
        region: this.region,
        reduced,
        playerX: ((this.x - cam.scrollX) * cam.zoom) / this.scale.width,
        playerY: ((this.y - 30 - cam.scrollY) * cam.zoom) / this.scale.height,
        attack: Math.min(1, Math.max(0, (this.clock - this.attackAt) / 0.3)),
        dash: Math.max(0, 1 - (this.clock - this.dashAt) / 0.2),
      });
    });
    this.resetWorld();
    this.started = false;
    if (quality === "webgpu") void applyGraphics("webgpu");
    render();
  }
  clearInput() {
    this.pendingKeys.clear();
    // A suspended render loop can retain DOM events across both menu toggles.
    // Reset the manager queue as well as key state so old actions cannot replay.
    const manager = this.input.keyboard?.manager;
    if (manager)
      (manager as unknown as { queue: KeyboardEvent[] }).queue.length = 0;
    this.input.keyboard?.resetKeys();
    this.jumpAt = -999;
    this.attackInputAt = -999;
    this.dashInputAt = -999;
    this.dropUntil = -999;
    this.dropIndex = -1;
    this.accumulator = 0;
  }
  resetWorld() {
    this.guardian = createGuardian(
      save.beads.includes("boss-dew-crown") || save.stones.includes(0),
    );
    this.collectedStamp = -1;
    this.pickupAt = -999;
    this.pickupCount = 0;
    this.pickupSoundAt = -999;
    this.windTurns = {};
    this.guideKey = "";
    this.windRide = null;
    this.guideCacheAt = -999;
    this.framing.reset();
    this.effects?.reset();
    this.resetAnimations();
    this.regionSeen.clear();
    this.lastGround = -999;
    this.saveClock = 0;
    this.label?.setVisible(false);
    this.started = true;
    this.clock = 0;
    this.launchAt = -999;
    this.hitPause = 0;
    this.attackStyle = 0;
    this.stride = 0;
    this.turnAt = -999;
    this.brakeAt = -999;
    this.previousMove = 0;
    this.attackResolved = true;
    this.attackInputAt = -999;
    this.hp = 5;
    this.energy = 100;
    this.vx = 0;
    this.vy = 0;
    this.hurtAt = -999;
    this.attackAt = -999;
    this.dashAt = -999;
    this.bindAt = -999;
    this.jumpAt = -999;
    this.groundIndex = -1;
    this.onGround = false;
    const cp = save.checkpoint
      ? stones[save.checkpoint - 1]
      : { x: 130, y: GROUND_Y };
    const position = save.position;
    const safePosition =
      position &&
      platforms.some(
        (p) =>
          !p.moving &&
          Math.abs((p.baseY ?? p.y) - position.y) < 1 &&
          position.x > p.x + 15 &&
          position.x < p.x + p.w - 15,
      )
        ? position
        : null;
    this.x = safePosition?.x ?? cp.x - (save.checkpoint ? 65 : 0);
    this.y = safePosition?.y ?? cp.y;
    this.safe = { x: this.x, y: this.y };
    this.region = Math.min(
      2,
      Math.floor(this.x / (ROOM_WIDTH * ROOMS_PER_REGION)),
    );
    platforms.forEach((p, i) => {
      p.baseY ??= p.y;
      p.y = p.baseY;
      p.phase = i;
      p.frozen = 0;
      p.motionTime = 0;
    });
    this.enemies = enemySpawns.map((e, i) => {
      const support = platforms.find(
        (p) => e.x >= p.x && e.x <= p.x + p.w && Math.abs(p.y - e.y) < 1,
      );
      return {
        ...e,
        home: e.x,
        floor: e.y,
        hp: 2,
        dir: 1,
        bound: 0,
        warn: 0,
        cool: 0,
        id: `enemy-${i}`,
        phase: "patrol" as const,
        phaseAt: 0,
        hurtAt: -999,
        diedAt: -999,
        attackDir: 1,
        attackHit: false,
        gait: 0,
        minX: Math.max(e.x - 90, (support?.x ?? e.x - 120) + 28),
        maxX: Math.min(
          e.x + 90,
          (support ? support.x + support.w : e.x + 120) - 28,
        ),
      };
    });
    this.beads = [];
    platforms.forEach((p, i) => {
      for (let j = 0; j < (p.w > 300 ? 4 : 2); j++)
        this.beads.push({
          x: p.x + 45 + j * 65,
          y: p.y - 55,
          id: beadId(p, i, j),
        });
    });
    this.totalBeads = new Set([
      ...save.beads,
      ...this.beads.map((b) => b.id),
      ...this.enemies.map((e) => e.id),
      "boss-dew-crown",
    ]).size;
    this.clearInput();
  }
  down(k: string) {
    return this.keys[k].isDown;
  }
  pressed(k: string) {
    const queued = this.pendingKeys.delete(k);
    const direct = Phaser.Input.Keyboard.JustDown(this.keys[k]);
    return queued || direct;
  }
  update(_t: number, delta: number) {
    if (mode === "play") {
      const frameTime = Math.min(delta, 250) / 1000;
      const held = Math.min(frameTime, this.hitPause);
      this.hitPause -= held;
      const elapsed = frameTime - held;
      this.accumulator += elapsed;
      save.elapsed += elapsed * 1000;
      this.saveClock += elapsed;
      while (
        this.accumulator >= 1 / 120 &&
        mode === "play" &&
        this.hitPause <= 0
      ) {
        this.clock += 1 / 120;
        this.step(1 / 120);
        this.accumulator -= 1 / 120;
      }
      if (this.saveClock > 3) {
        persist();
        this.saveClock = 0;
      }
    }
    this.draw();
    uiClock += delta;
    if (uiClock > 150) {
      uiClock = 0;
      if (mode === "play") render();
    }
  }
  step(dt: number) {
    const now = this.clock;
    const previousX = this.x;
    platforms.forEach((p) => {
      p.prevY = p.y;
      if (p.moving && now > (p.frozen ?? 0)) {
        p.motionTime = (p.motionTime ?? 0) + dt;
        p.y =
          p.baseY! +
          (Math.sin(p.motionTime * 0.8 + p.phase!) - Math.sin(p.phase!)) *
            (p.amplitude ?? 20);
      }
    });
    if (this.onGround && this.groundIndex >= 0) {
      const p = platforms[this.groundIndex];
      this.y += p.y - (p.prevY ?? p.y);
    }
    if (this.pressed("SPACE")) {
      if (
        (this.down("S") || this.down("DOWN")) &&
        this.onGround &&
        this.y < GROUND_Y - 10
      ) {
        this.dropIndex = this.groundIndex;
        this.dropUntil = now + 0.25;
        this.onGround = false;
        this.groundIndex = -1;
        this.vy = 80;
        this.y += 5;
        this.lastGround = -999;
        this.jumpAt = -999;
      } else this.jumpAt = now;
    }
    const move =
      Number(this.down("D") || this.down("RIGHT")) -
      Number(this.down("A") || this.down("LEFT"));
    if (this.onGround && now - this.dashAt > 0.3) {
      if (
        move &&
        move !== this.facing &&
        Math.abs(this.vx) > 70 &&
        now - this.attackAt > 0.23
      )
        this.turnAt = now;
      if (!move && this.previousMove && Math.abs(this.vx) > 100)
        this.brakeAt = now;
    }
    this.previousMove = move;
    if (move && now - this.attackAt > 0.23) this.facing = move;
    if (this.pressed("SHIFT")) this.dashInputAt = now;
    if (now - this.dashInputAt < 0.12 && now - this.dashAt > 1.1) {
      this.dashInputAt = -999;
      this.dashAt = now;
      this.effects.burst(this.x, this.y - 25, now, "dash", reduced);
      sound(240);
    }
    const dash = now - this.dashAt < 0.19;
    const wind = sampleWind(this.x, this.y, now, this.windTurns);
    if (wind.zone?.lift && wind.zone.lift > 1000) {
      if (this.windRide?.id !== wind.zone.id)
        this.windRide = { id: wind.zone.id, y: this.y };
      this.windRide.y = Math.max(this.windRide.y, this.y);
      if (this.windRide.y - this.y >= 160)
        this.recordTrial(Math.floor(this.x / ROOM_WIDTH), "rise");
    } else this.windRide = null;
    const resistingWind = this.down("S") || this.down("DOWN");
    const windDrift = !this.onGround && !resistingWind ? wind.x : 0;
    const targetSpeed = move * (this.down("C") ? 115 : 255) + windDrift;
    if (wind.zone) {
      const entry =
        "风的手记：跳起借蒲苇上升风登高；花信风延长顺风跳跃。按住 S / ↓ 收身下降；Tab 查看可选的风之邀约。";
      if (!save.logs.includes(entry)) {
        save.logs.push(entry);
        toast(entry);
        persist();
      }
    }
    this.vx = dash
      ? this.facing * 760
      : this.vx +
        Phaser.Math.Clamp(targetSpeed - this.vx, -3200 * dt, 3200 * dt);
    if (
      now - this.jumpAt < 0.14 &&
      (this.onGround || now - this.lastGround < 0.12)
    ) {
      this.effects.burst(this.x, this.y, now, "jump", reduced);
      this.launchAt = now;
      this.vy = -540;
      this.onGround = false;
      this.lastGround = -999;
      this.jumpAt = -999;
      sound(400);
    }
    if (this.pressed("J") || (this.arena && this.down("J")))
      this.attackInputAt = now;
    if (now - this.attackInputAt < 0.14 && now - this.attackAt > 0.38) {
      this.attackInputAt = -999;
      this.attackStyle = now - this.attackAt < 0.85 ? 1 - this.attackStyle : 0;
      this.attackAt = now;
      this.attackResolved = false;
      sound(180);
    }
    if (!this.attackResolved && now - this.attackAt >= 0.085) {
      this.attackResolved = true;
      const boss = this.guardian;
      if (
        Math.abs(this.x - boss.x) < 132 &&
        Math.abs(this.y - boss.y) < 105 &&
        (boss.x - this.x) * this.facing > -45 &&
        hitGuardian(boss, now)
      ) {
        this.effects.burst(
          boss.x,
          boss.y - 45,
          now,
          "hit",
          reduced,
          this.facing,
        );
        this.hitPause = reduced ? 0 : boss.lastDamage === 2 ? 0.06 : 0.025;
        sound(boss.lastDamage === 2 ? 260 : 180);
        this.energy = Math.min(100, this.energy + 5);
        if (boss.hp === 0) {
          collect(save, "boss-dew-crown");
          save.logs.push(
            "露冠守卫：荆壳碎裂，守卫认出了你的灯。它俯下身，将晨露碑后的道路交还给你。",
          );
          this.hp = 5;
          this.energy = 100;
          this.effects.burst(boss.x, boss.y - 40, now, "awaken", reduced);
          toast(
            "荆壳散去，露冠守卫向你低下冠冕。生命与光能已恢复，去唤醒晨露碑吧。",
          );
          persist();
        }
      }
      this.enemies.forEach((e) => {
        if (
          e.hp > 0 &&
          Math.abs(e.x - this.x) < 102 &&
          Math.abs(e.y - this.y) < 85 &&
          (e.x - this.x) * this.facing > -15
        ) {
          hurtCreature(e, now, this.facing);
          if (!reduced) {
            this.hitPause = 0.045;
            if (preferences.shake) this.cameras.main.shake(65, 0.0015);
          }
          this.effects.burst(e.x, e.y - 20, now, "hit", reduced, this.facing);
          sound(115);
          if (e.hp <= 0) {
            this.effects.burst(e.x, e.y - 20, now, "defeat", reduced);
            collect(save, e.id);
            sound(800);
            persist();
          }
        }
      });
    }
    if (this.pressed("K") && now - this.bindAt > 0.45) {
      const boss = this.guardian;
      if (
        this.energy >= 25 &&
        Math.abs(boss.x - this.x) < 330 &&
        Math.abs(boss.y - this.y) < 160 &&
        (boss.x - this.x) * this.facing >= -25 &&
        bindGuardian(boss, now)
      ) {
        this.energy -= 25;
        this.bindAt = now;
        this.bindTarget = { x: boss.x, y: boss.y - 45 };
        this.effects.burst(boss.x, boss.y - 45, now, "bind", reduced);
        toast("藤蔓打开破绽 · 2.1 秒，攻击造成双倍伤害！");
      } else {
        const targets = [
          ...this.enemies
            .filter((e) => e.hp > 0)
            .map((e) => ({
              x: e.x,
              y: e.y,
              enemy: e,
              platform: undefined as Platform | undefined,
            })),
          ...platforms
            .filter((p) => p.moving)
            .map((p) => ({
              x: Phaser.Math.Clamp(this.x, p.x, p.x + p.w),
              y: p.y,
              enemy: undefined as Enemy | undefined,
              platform: p,
            })),
        ]
          .filter(
            (t) =>
              Math.abs(t.x - this.x) < 330 &&
              Math.abs(t.y - this.y) < 200 &&
              (t.x - this.x) * this.facing >= -25,
          )
          .sort(
            (a, b) =>
              Math.hypot(a.x - this.x, a.y - this.y) -
              Math.hypot(b.x - this.x, b.y - this.y),
          );
        if (this.energy >= 25 && targets[0]) {
          this.energy -= 25;
          this.bindAt = now;
          const t = targets[0];
          this.bindTarget = { x: t.x, y: t.y - 15 };
          this.effects.burst(t.x, t.y - 15, now, "bind", reduced);
          if (t.enemy) t.enemy.bound = now + 3;
          if (t.platform) t.platform.frozen = now + 5;
          sound(620);
          toast(
            t.enemy ? "藤蔓轻轻缠住了影子 · 3 秒" : "藤蔓托住了玻璃平台 · 5 秒",
          );
        } else
          toast(
            this.energy < 25
              ? "光能正在恢复，请稍等片刻。"
              : this.arena && now < boss.bindReadyAt
                ? `守卫正在挣脱藤蔓，${Math.ceil(boss.bindReadyAt - now)} 秒后可再次束缚。`
                : "靠近前方的敌人或叶片平台，再施放藤蔓。",
          );
      }
    }
    if (now - this.bindAt > 1.4)
      this.energy = Math.min(100, this.energy + dt * 13);
    const oldY = this.y;
    this.x = Phaser.Math.Clamp(this.x + this.vx * dt, 35, WORLD_WIDTH - 40);
    for (const room of rooms) {
      if (
        !gateOpen(rooms.indexOf(room)) &&
        this.x > room.gate - 15 &&
        this.x < room.gate + 80 &&
        this.vx > 0
      )
        this.x = room.gate - 15;
    }
    this.vy += (dash ? 160 : 1350) * dt;
    if (wind.lift > 0 && !dash && !this.onGround && !resistingWind) {
      // Preserve a fresh jump's upward momentum; wind only adds lift below its cruising speed.
      this.vy -= Math.min(wind.lift * dt, Math.max(0, this.vy + 310));
    }
    this.y += this.vy * dt;
    this.onGround = false;
    this.groundIndex = -1;
    if (this.vy >= 0) {
      let landing = -1;
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (i === this.dropIndex && now < this.dropUntil) continue;
        if (
          this.x + 13 > p.x &&
          this.x - 13 < p.x + p.w &&
          oldY <= Math.max(p.y, p.prevY ?? p.y) + 9 &&
          this.y >= p.y
        ) {
          if (landing < 0 || p.y < platforms[landing].y) landing = i;
        }
      }
      if (landing >= 0) {
        const p = platforms[landing];
        if (this.vy > 180)
          this.effects.burst(this.x, p.y, now, "land", reduced);
        this.y = p.y;
        this.vy = 0;
        this.onGround = true;
        this.groundIndex = landing;
        this.lastGround = now;
        if (!p.moving && this.x > p.x + 20 && this.x < p.x + p.w - 20)
          this.safe = { x: this.x, y: this.y };
      }
    }
    if (this.y > GROUND_Y + 280) this.damage(true);
    if (this.x < 6000) {
      const ready = prisms
        .filter((p) => p.room === 0)
        .every((p) => save.lenses.includes(p.id));
      if (ready) {
        const prior = this.guardian.phase;
        const result = stepGuardian(this.guardian, now, dt, this);
        if (prior !== this.guardian.phase) {
          if (this.guardian.phase === "warn") sound(240);
          if (this.guardian.phase === "slam-warn") sound(380);
          if (this.guardian.phase === "slam") {
            this.effects.burst(this.guardian.x, 1100, now, "land", reduced);
            if (!reduced && preferences.shake)
              this.cameras.main.shake(90, 0.0015);
          }
          if (this.guardian.phase === "recover")
            this.effects.burst(this.guardian.x, 1045, now, "collect", reduced);
        }
        if (result.started) {
          this.safe = { x: 2260, y: 1100 };
          this.hp = 5;
          this.energy = 100;
          const story =
            "露冠守卫：荆棘困住了古老守卫的梦。读懂冠冕的红光，避开冲锋，在它疲惫时击碎荆壳。藤蔓能打开短暂破绽，但守卫会暂时抵抗再次束缚。";
          if (!save.logs.includes(story)) save.logs.push(story);
          persist();
          toast(
            "露冠守卫醒来了。J 连击 · 红色箭纹躲冲锋 · 金色地纹跳根浪 · K 打断并打开破绽",
          );
        }
        if (result.damage) this.damage(false, this.x - this.guardian.x);
      }
      if (this.guardian.hp > 0 && this.x > GUARDIAN.right) {
        this.x = GUARDIAN.right;
        this.vx = Math.min(0, this.vx);
      }
    }
    if (this.onGround && !dash)
      this.stride +=
        Math.abs(this.x - previousX) / (Math.abs(this.vx) > 180 ? 78 : 58);
    this.enemies.forEach((e) => {
      if (Math.abs(e.x - this.x) > 1300) {
        e.phase = "patrol";
        e.warn = 0;
        e.cool = Math.max(e.cool, now + 0.3);
        return;
      }
      const before = e.phase;
      if (stepCreature(e, now, dt, this)) this.damage(false, this.x - e.x);
      if (e.phase === "windup" && before !== "windup")
        sound(e.type ? 330 : 210);
    });

    this.beads.forEach((b) => {
      if (Math.abs(this.x - b.x) > 100) return;
      if (!this.collected.has(b.id) && attractPickup(b, this, dt)) {
        collect(save, b.id);
        this.effects.burst(b.x, b.y, now, "collect", reduced);
        this.pickupCount = now - this.pickupAt < 1.2 ? this.pickupCount + 1 : 1;
        this.pickupAt = now;
        if (now - this.pickupSoundAt > 0.12) {
          sound(760 + Math.min(8, this.pickupCount) * 35);
          this.pickupSoundAt = now;
        }
      }
    });
    const prism = prisms.find(
      (p) => Math.abs(this.x - p.x) < 70 && Math.abs(this.y - p.y) < 65,
    );
    const interact = stones.findIndex(
      (s) => Math.abs(this.x - s.x) < 85 && Math.abs(this.y - s.y) < 90,
    );
    const memory = memories.find(
      (m) => Math.abs(this.x - m.x) < 90 && Math.abs(this.y - m.y) < 85,
    );
    this.label.setVisible(interact >= 0 || !!memory || !!prism);
    if (interact >= 0) {
      const s = stones[interact];
      this.label
        .setPosition(s.x - 70, s.y - 165)
        .setText(
          save.stones.includes(interact)
            ? `E · 在${names[interact]}休憩`
            : `E · 唤醒${names[interact]}`,
        );
    } else if (prism) {
      this.label
        .setPosition(
          prism.x - 80,
          prism.y -
            (this.enemies.some(
              (e) =>
                e.hp > 0 &&
                Math.abs(e.x - prism.x) < 200 &&
                Math.abs(e.floor - prism.y) < 70,
            )
              ? 165
              : 110),
        )
        .setText(this.prismHint(prism));
    } else if (memory)
      this.label
        .setPosition(memory.x - 60, memory.y - 100)
        .setText("E · 读取微光记忆");
    if (save.stones.includes(0) && this.x > 3480 && this.x < 3720) {
      this.label
        .setVisible(true)
        .setPosition(3450, 920)
        .setText("E · 第一关完成，前往玻璃阶地");
    }
    if (
      save.stones.includes(0) &&
      Math.abs(this.x - 12080) < 85 &&
      Math.abs(this.y - 1100) < 60
    ) {
      this.label
        .setVisible(true)
        .setPosition(12000, 970)
        .setText("E · 回访晨露庭院（可选探索）");
    }
    if (this.pressed("E")) {
      if (
        save.stones.includes(0) &&
        Math.abs(this.x - 12080) < 85 &&
        Math.abs(this.y - 1100) < 60
      ) {
        this.x = 3760;
        this.y = 1100;
        this.vx = 0;
        this.vy = 0;
        this.safe = { x: this.x, y: this.y };
        this.framing.reset();
        persist();
        toast("回到晨露庭院。向右可以探索可选浅溪，返回晨光之门可继续主线。");
        return;
      }
      if (this.x > 3480 && this.x < 3720 && save.stones.includes(0)) {
        this.x = 12080;
        this.y = 1100;
        this.vx = 0;
        this.vy = 0;
        this.safe = { x: this.x, y: this.y };
        this.framing.reset();
        persist();
        toast("第一关完成。穿过守卫打开的晨光之门，玻璃阶地就在前方。");
        return;
      }
      const vane = windZones.find(
        (z) =>
          z.push !== 0 &&
          Math.abs(this.x - z.x - z.w / 2) < 85 &&
          Math.abs(this.y - z.y - z.h) < 110,
      );
      if (vane && interact < 0 && !prism && !memory) {
        this.windTurns[vane.id] =
          now < (this.windTurns[vane.id] ?? -1) ? -1 : now + 8;
        this.effects.burst(
          vane.x + vane.w / 2,
          vane.y + vane.h - 60,
          now,
          "collect",
          reduced,
        );
        toast("玻璃风花转向了：花信风反向 8 秒，再次交互可提前复原。");
        sound(540);
        this.recordTrial(Math.floor(this.x / ROOM_WIDTH), "turn");
      } else if (interact >= 0) {
        if (interact === 0 && this.guardian.hp > 0) {
          toast("晨露碑仍被荆壳封住。先帮助露冠守卫醒来。");
          return;
        }
        if (!save.stones.includes(interact)) {
          save.stones.push(interact);
          this.framing.awaken(stones[interact].x, stones[interact].y, now);
          this.effects.burst(
            stones[interact].x,
            stones[interact].y - 87,
            now,
            "awaken",
            reduced,
          );
          save.checkpoint = interact + 1;
          save.logs.push(`${names[interact]}：${stories[interact]}`);
          this.hp = 5;
          this.energy = 100;
          sound(730);
          persist();
          toast(stories[interact]);
          if (save.stones.length === 3) {
            this.endingAt = performance.now();
            mode = "end";
            persist();
            render();
          }
        } else {
          this.hp = 5;
          this.energy = 100;
          save.checkpoint = interact + 1;
          this.safe = { x: this.x, y: this.y };
          this.hurtAt = now;
          this.effects.burst(this.x, this.y - 32, now, "collect", reduced);
          persist();
          sound(660);
          toast(
            `${names[interact]}的微光让你恢复了生命与光能。${stories[interact]}`,
          );
        }
      } else if (prism) {
        this.activatePrism(prism);
      } else if (memory) {
        if (!save.logs.includes(memory.text)) save.logs.push(memory.text);
        toast(memory.text);
        persist();
      }
    }
    const region = Math.min(
      2,
      Math.floor(this.x / (ROOM_WIDTH * ROOMS_PER_REGION)),
    );
    if (region !== this.region) {
      this.region = region;
      if (!this.regionSeen.has(region)) {
        this.regionSeen.add(region);
        const t =
          region === 1
            ? "玻璃阶地：J 攻击，Shift 冲刺；留意敌人的金红色预警。"
            : "藤冠高台：用 K 束缚影子，也能固定带叶片的平台。";
        if (!save.logs.includes(t)) save.logs.push(t);
        toast(t);
      }
    }
  }
  returnToCheckpoint() {
    const cp = save.checkpoint
      ? stones[save.checkpoint - 1]
      : { x: 130, y: GROUND_Y };
    this.x = cp.x - (save.checkpoint ? 65 : 0);
    this.y = cp.y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.groundIndex = -1;
    this.safe = { x: this.x, y: this.y };
    this.hp = 5;
    this.energy = 100;
    this.hurtAt = this.clock;
    this.attackAt = -999;
    this.bindAt = -999;
    this.dashAt = -999;
    this.pickupAt = -999;
    this.windRide = null;
    this.guideCacheAt = -999;
    this.clearInput();
    this.effects.reset();
    this.resetAnimations();
    this.framing.reset();
    persist();
    toast("已回到检查点并恢复生命与光能。收集、灯环与邀约进度全部保留。");
  }
  damage(fall: boolean, direction = 0) {
    if (
      !fall &&
      (this.clock - this.hurtAt < 1.5 || this.clock - this.dashAt < 0.22)
    )
      return;
    this.hp--;
    this.hitDirection = direction;
    this.hurtAt = this.clock;
    this.effects.burst(this.x, this.y - 30, this.clock, "hurt", reduced);
    sound(120);
    if (!reduced && preferences.shake) this.cameras.main.shake(100, 0.003);
    if (this.hp <= 0) {
      this.art.defeat(this.x, this.y, this.clock, this.facing);
      this.art.actor.reset();
      const retryGuardian =
        !save.stones.includes(0) &&
        this.x < 6000 &&
        prisms
          .filter((p) => p.room === 0)
          .every((p) => save.lenses.includes(p.id));
      const cp = save.checkpoint
        ? stones[save.checkpoint - 1]
        : { x: retryGuardian ? 2260 : 130, y: GROUND_Y };
      if (retryGuardian)
        this.guardian = createGuardian(save.beads.includes("boss-dew-crown"));
      this.x = cp.x - (save.checkpoint ? 65 : 0);
      this.y = cp.y;
      this.hp = 5;
      this.energy = 100;
      this.safe = { x: this.x, y: this.y };
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.groundIndex = -1;
      toast("石碑留住了你的微光。玻璃珠与旅程进度已保留。");
    } else if (fall) {
      this.x = this.safe.x;
      this.y = this.safe.y;
      this.onGround = false;
      this.groundIndex = -1;
      toast("晨风把你送回了安全的落脚处。");
    } else {
      this.x -= this.facing * 28;
      this.vy = -190;
    }
    this.vy = fall ? 0 : this.vy;
    this.lastGround = -999;
    persist();
  }
  draw() {
    const cam = this.cameras.main;
    const vw = this.scale.width,
      vh = this.scale.height;
    const effectTime =
      mode === "end" && !reduced
        ? this.clock + Math.min(2.2, (performance.now() - this.endingAt) / 1000)
        : this.clock;
    const frame = this.framing.update(
      mode === "end"
        ? {
            x: this.x,
            y: this.y,
            vx: 0,
            vy: 0,
            onGround: this.onGround,
            clock: effectTime,
            dashAt: this.dashAt,
            attackAt: this.attackAt,
          }
        : this,
      vw,
      vh,
      pixelRatio() * Math.max(0.65, Math.min(1.35, vh / pixelRatio() / 740)),
      WORLD_WIDTH,
      GROUND_Y,
      reduced,
    );
    cam.setZoom(frame.zoom);
    cam.scrollX = frame.x;
    cam.scrollY = frame.y;
    const viewW = vw / cam.zoom;
    const bg = this.bg;
    bg.setPosition(cam.scrollX, cam.scrollY).setScale(1 / cam.zoom);
    bg.clear();
    this.art.draw(
      this,
      cam,
      this.region,
      vw,
      vh,
      reduced,
      mode === "title" || !this.started,
      quality !== "soft",
    );
    this.effects.draw(effectTime, this, reduced);
    this.guardianArt.draw(
      this.guardian,
      this.clock,
      this.started && mode !== "title" && this.x < 6000,
      reduced,
    );
    this.guideArt.draw(
      this.clock,
      cam,
      this,
      this.nextGuideStep,
      this.started &&
        mode !== "title" &&
        this.guideEnabled &&
        (this.guideObjective.id !== "guardian" ||
          this.guardian.phase === "sleep") &&
        save.stones.length < 3 &&
        !(
          this.label.visible &&
          Math.hypot(
            this.x - this.guideObjective.x,
            this.y - this.guideObjective.y,
          ) < 120
        ),
      reduced,
    );
    this.windArt.draw(
      this.clock,
      cam,
      this,
      reduced,
      this.started && mode !== "title",
      this.windTurns,
    );
    this.creatures.draw(
      this.enemies,
      this.clock,
      cam,
      reduced,
      this.started && mode !== "title",
      this.x,
    );
    const g = this.g;
    g.setVisible(this.started && mode !== "title");
    if (!this.started || mode === "title") {
      this.texts.forEach((t) => t.setVisible(false));
      return;
    }
    this.texts.forEach((t) => t.setVisible(true));
    g.clear();
    if (save.stones.length === 3) {
      g.lineStyle(3, 0xf9e8ac, 0.55);
      for (let i = 0; i < stones.length - 1; i++)
        g.lineBetween(
          stones[i].x,
          stones[i].y - 75,
          stones[i + 1].x,
          stones[i + 1].y - 75,
        );
      g.fillStyle(0xf5e6ab, 0.045);
      g.fillRect(stones[0].x, GROUND_Y - 130, stones[2].x - stones[0].x, 110);
    }
    for (const room of rooms) {
      if (room.x + ROOM_WIDTH < cam.scrollX || room.x > cam.scrollX + viewW)
        continue;
      this.worldText(room.name, room.x + 85, GROUND_Y - 80, 16, 0xdde3b6);
      const i = rooms.indexOf(room),
        open = gateOpen(i);
      const gx = room.gate;
      // A tall living arch marks the transition; a glass curtain is the collider.
      g.lineStyle(9, 0x3e6850, 0.85);
      g.beginPath();
      g.moveTo(gx - 22, GROUND_Y);
      g.lineTo(gx - 22, 170);
      g.lineTo(gx + 5, 125);
      g.lineTo(gx + 32, 170);
      g.lineTo(gx + 32, GROUND_Y);
      g.strokePath();
      g.lineStyle(1, 0xd3dfb0, 0.6);
      g.lineBetween(gx - 17, 170, gx - 17, GROUND_Y);
      for (let j = 0; j < 10; j++) {
        g.fillStyle(0x95b37e, 0.8);
        g.fillEllipse(gx + (j % 2 ? 35 : -25), 190 + j * 48, 25, 10);
      }
      if (!open) {
        g.fillStyle(0xc9ead5, 0.16);
        g.fillRect(gx - 14, 175, 38, GROUND_Y - 175);
        g.lineStyle(1, 0xe3ebbf, 0.65);
        g.lineBetween(gx + 5, 180, gx + 5, GROUND_Y);
        g.fillStyle(0xf4dca1, 0.9);
        g.fillCircle(gx + 5, 450, 5);
      } else {
        g.fillStyle(0xf4dfa7, 0.08);
        g.fillEllipse(gx, 450, 60, 470);
      }
    }
    for (const prism of prisms) {
      if (prism.x < cam.scrollX - 200 || prism.x > cam.scrollX + viewW + 200)
        continue;
      const active = save.lenses.includes(prism.id),
        ready =
          prism.order === 0 ||
          save.lenses.includes(`lens-${prism.room}-${prism.order - 1}`);
      const px = prism.x,
        py = prism.y;
      g.fillStyle(0x456d5c, 0.9);
      g.fillRoundedRect(px - 12, py - 45, 24, 45, 4);
      g.fillStyle(prism.order === 0 ? 0xf2d69b : 0xb6e5cf, ready ? 0.17 : 0.06);
      g.fillCircle(px, py - 67, 34);
      g.lineStyle(2, prism.order === 0 ? 0xf2d69b : 0xb6e5cf, ready ? 1 : 0.35);
      g.strokeCircle(px, py - 67, 18);
      g.fillStyle(prism.order === 0 ? 0xf5dfa7 : 0xc8eedc, active ? 0.9 : 0.3);
      g.fillTriangle(px, py - 83, px - 11, py - 59, px + 11, py - 59);
      this.worldText(`${prism.order + 1}`, px - 4, py - 120, 12, 0xe0deac);
      if (prism.mechanic === "reflect") {
        const pointer =
            ((save.angles[prism.id] ?? 0) * Math.PI) / 2 - Math.PI / 2,
          target = (prism.direction * Math.PI) / 2 - Math.PI / 2;
        g.lineStyle(2, 0xf1d793, 0.8);
        g.lineBetween(
          px + Math.cos(target) * 22,
          py - 67 + Math.sin(target) * 22,
          px + Math.cos(target) * 28,
          py - 67 + Math.sin(target) * 28,
        );
        g.lineStyle(2, 0xeef8da, 0.9);
        g.lineBetween(
          px,
          py - 67,
          px + Math.cos(pointer) * 14,
          py - 67 + Math.sin(pointer) * 14,
        );
      } else if (prism.mechanic === "hold") {
        g.fillStyle(0xaad39b, 0.9);
        g.fillEllipse(px + 26, py - 68, 9, 15);
      } else if (prism.mechanic === "guard") {
        g.lineStyle(1, 0xecc699, 0.9);
        g.strokeCircle(px + 26, py - 68, 6);
      }
      if (active && prism.order < 3) {
        const other = prisms.find(
          (p) => p.room === prism.room && p.order === prism.order + 1,
        )!;
        g.lineStyle(2, 0xf0dda1, 0.45);
        g.lineBetween(px, py - 67, other.x, other.y - 67);
        g.fillStyle(0xf1e3aa, 0.04);
        g.fillTriangle(
          px,
          py - 73,
          other.x,
          other.y - 73,
          other.x,
          other.y - 50,
        );
      }
      if (active && prism.order === 3) {
        g.lineStyle(1, 0xcce9c5, 0.4);
        g.lineBetween(px, py - 67, rooms[prism.room].gate, 160);
      }
    }
    memories.forEach((m) => {
      g.fillStyle(0xdedaa0, 0.7);
      g.fillTriangle(m.x, m.y - 60, m.x - 7, m.y - 48, m.x + 7, m.y - 48);
      g.lineStyle(1, 0xe2e9bb, 0.3);
      g.strokeCircle(m.x, m.y - 52, 15);
    });
    stones.forEach((s, i) => {
      const active = save.stones.includes(i);
      drawMonument(g, s.x, s.y, active, i, this.clock, reduced);
      this.worldText(`0${i + 1}`, s.x - 9, s.y - 121, 12, 0xd6d9af);
    });
    this.beads.forEach((b) => {
      if (b.x < cam.scrollX - 50 || b.x > cam.scrollX + viewW + 50) return;
      if (this.collected.has(b.id)) return;
      const bob = reduced ? 0 : Math.sin(this.clock * 2 + b.x) * 4;
      const by = b.y + bob;
      g.fillStyle(0xc8f3e3, 0.035);
      g.fillCircle(b.x, by, 9);
      g.lineStyle(0.7, 0xd2f6ed, 0.65);
      g.beginPath();
      g.arc(b.x, by, 4.5, -0.8, 3.5);
      g.strokePath();
      g.fillStyle(0xb1e6df, 0.35);
      g.fillCircle(b.x, by, 3.5);
      g.fillStyle(0xfff8d7, 0.9);
      g.fillCircle(b.x - 1, by - 1.8, 1.2);
      if (!reduced && Math.sin(this.clock * 1.7 + b.x * 0.03) > 0.96) {
        g.lineStyle(0.7, 0xe7f7db, 0.7);
        g.lineBetween(b.x - 6, by, b.x + 6, by);
        g.lineBetween(b.x, by - 6, b.x, by + 6);
      }
    });
    if (!reduced) {
      g.fillStyle(0xf5edb4, 0.5);
      for (let i = 0; i < 65; i++) {
        const px =
            cam.scrollX -
            100 +
            ((i * 97 + Math.sin(this.clock * 0.25 + i) * 30) % (viewW + 200)),
          py = 100 + ((i * 79) % 580) + Math.sin(this.clock * 0.5 + i) * 13;
        g.fillCircle(px, py, i % 3 === 0 ? 2 : 1);
      }
    }
  }
  // Text is rendered through a tiny cached pool, so scene redraws do not allocate objects.
  texts = new Map<string, Phaser.GameObjects.Text>();
  worldText(text: string, x: number, y: number, size: number, color: number) {
    const key = `${text}-${x}-${y}`;
    if (!this.texts.has(key))
      this.texts.set(
        key,
        this.add
          .text(x, y, text, {
            fontFamily: "Georgia",
            fontSize: `${size}px`,
            color: `#${color.toString(16).padStart(6, "0")}`,
            letterSpacing: 3,
          })
          .setResolution(pixelRatio())
          .setDepth(2),
      );
  }
}
export const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "game",
  backgroundColor: "#163c37",
  antialias: true,
  fps: { smoothStep: false },
  scale: {
    mode: Phaser.Scale.NONE,
    width: window.innerWidth * pixelRatio(),
    height: window.innerHeight * pixelRatio(),
    zoom: 1 / pixelRatio(),
  },
  scene: Journey,
  input: { keyboard: true },
  render: { pixelArt: false },
});
window.addEventListener("resize", () => {
  game.scale.setZoom(1 / pixelRatio());
  game.scale.resize(
    window.innerWidth * pixelRatio(),
    window.innerHeight * pixelRatio(),
  );
});

if (import.meta.env.DEV || import.meta.env.MODE === "verification")
  Object.defineProperty(window, "dewlight", {
    value: game,
    configurable: true,
  });
