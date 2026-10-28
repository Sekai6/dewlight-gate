# ACTION-A · 角色动画系统

> 第二轮已在本地继续优化，当前结构、运行方法和验收记录见 [第二轮说明](ACTION-A-ROUND2.md)。本文下方的第一轮性能表保留作为历史记录。

本轮在本地接入主控、苔影、玻璃蛾与露冠守卫。公开试玩仍是此前发布版本，待本地视觉验收后另行更新。

## 运行与预览

```powershell
npm ci
npm run dev
```

- 游戏：`http://127.0.0.1:5173/`
- 动作预览：`http://127.0.0.1:5173/?action-a`
- 预览提供角色、动作、方向、移动速度、放大倍率、正常/半速/四分之一速度、暂停、单步，以及骨骼、接触点和剑轴显示。
- 生产构建会剔除预览模块；生产 URL 即使附带 `?action-a` 也只进入正常游戏。

## 核心与数据流

`src/action-a/` 分为可独立测试的 `core.ts`、骨架与动作数据 `rigs.ts`、共享分层素材 `skin.ts`、Phaser 渲染适配 `actor.ts`、游戏状态适配 `drivers.ts` 和开发预览模块。

1. 游戏物理和战斗逻辑仍负责移动、判定、攻击时点、资源与存档。驱动器读取速度、朝向、落地、受伤及攻击阶段，输出 `ActorInput`。
2. `Animator` 采样 `Clip` 的关键帧 `Track`，产生局部 `Pose`。普通旋转走最短弧；作者指定的 `unwrapped` 轨道保留多圈转向，用于挥剑。新状态从当前已混合姿态继续过渡，默认 85 ms。
3. 地面移动攻击用骨骼遮罩覆盖上身，保持下身步态。步频从实际位移累计，起步加入重心下沉，脚部通过双段 IK 到达世界坐标中的接触点。
4. 披风、灯饰与冠叶使用解析临界阻尼跟随，翅膀叠加独立翼拍和收翼动作。所有变化由模拟时间驱动，零时间增量不会推进姿态或跟随状态。
5. 绑定骨骼的分层 Image 消费世界姿态。18 个自制部件在启动时画入一个高分辨率 Canvas 图集，并按透明边界裁切；不再生成主控 180 张和敌人整套逐帧纹理。敌人实例预分配，冲刺残影使用固定池。
6. 刀光记录实际剑骨骼的剑尖与握持点；脚步、落地和冲击只产生装饰特效。动画事件不会结算伤害。

### 最小接口

```ts
interface ActorInput {
  x: number; y: number; clock: number;
  facing: number; action: Action; age: number;
  vx: number; vy?: number; grounded: boolean;
  moving?: boolean; reduced?: boolean; visible?: boolean;
}
```

`Bone` 定义父子关系与静止姿态；`Clip` 包含时长、循环、轨道与装饰事件；`Animator.update()` 返回姿态与本次跨过的事件。骨架按父节点在前排列，clip 时长必须为正，轨道至少一个按时间递增排列的关键帧。运行时不读取外部动画文件。

### 兼容与生命周期

- 沿用当前攻击持续时间、85 ms 伤害结算点、敌人预警与束缚规则；未修改存档格式或战斗数值。
- 检查点、重开和 Boss 重试重置动画；时间倒退或大幅传送自动重置，避免带入旧脚部锚点和刀光。
- 生命耗尽时在原地播放短暂倒下余像，同时按原规则即时复活。倒下余像无碰撞，不延迟输入。
- 减少动态会压低跟随摆动、关闭刀光拖尾、残影与脚步装饰；肢体动作和攻击预警仍然保留。
- Canvas 和 WebGPU 后处理共享同一套角色画面。

## 本地验收与复现

```powershell
npm test
npm run format:check
npm run build
npm run test:e2e
node scripts/action-a-sheet.mjs
node scripts/action-a-review.mjs
```

测试包含插值与跨角度、打断混合、上身覆盖、暂停与事件去重、IK 长度、阻尼帧率一致性；浏览器检查双向行走/跑动的支撑脚、挥剑方向、全角色姿态有效性、暂停与检查点重置、预览、图集透明边界，以及原有完整通关回归。

### 对比材料

所有录像、截图和报告位于被 Git 忽略的 `artifacts/action-a/`，不打包进入游戏：

- `before/actions.webm`、`after/actions.webm`：改造前后相同输入、固定镜头的四段录像。
- `sheets/hero.png`、`moss.png`、`moth.png`、`guardian.png`：动作关键姿势图。
- `review.html`：本地并排录像，可切换 1×、0.5×、0.25×。
- `performance.json`：同机、相同窗口与画质、关闭录像后的独立帧时间和对象/纹理记录。
- `production.json`：生产版正常游玩及开发入口隔离结果。

原版源码快照保存在 `artifacts/action-a/baseline-source/`，运行 `npx vite artifacts/action-a/baseline-source --port 5175 --host 127.0.0.1` 提供对照服务。主开发服务运行在 5173；两者启动后执行 `node scripts/action-a-performance.mjs`，再执行 `node scripts/action-a-report.mjs` 生成比较页。

对照录像可通过 `ACTION_A_VARIANT=before` 和 `PLAY_URL=http://127.0.0.1:5175` 复现；默认记录当前版本。原有 `animation-sheet.mjs` 和 `creature-sheet.mjs` 已转接新姿势图生成器。

## 当前边界

### 本机验收记录

- 34 项单元测试通过；55 项完整浏览器回归通过，最后资产调整后的 6 项专项再次通过。原生 WebGPU 在本机实际执行通过，未计为跳过。
- TypeScript、生产构建、格式检查和生产入口隔离检查通过。
- 双向行走和跑动的支撑脚位移及锚点误差均通过 3 个世界像素上限检查；反复遍历六个花园不增加纹理和对象池。
- 对比页已验证双视频播放、暂停和四分之一速播放。

| 场景 | 旧版 / ACTION-A P95 帧间隔 | 旧版 / ACTION-A 主线程帧处理 P95 | 旧版 / ACTION-A 纹理数 |
| --- | --- | --- | --- |
| 安全开场 | 33.4 / 33.4 ms | 4.4 / 15.4 ms | 611 / 304 |
| 玻璃蛾附近 | 33.3 / 33.3 ms | 4.5 / 19.1 ms | 614 / 307 |

以上使用同机 Chromium、1440×900、绮梦画质、预热后 360 帧，录像关闭。每次测量前后对象及纹理数相同；完整原始结果保存在本地报告。

ACTION-A 是本作内部可复用的模块，尚无可视化时间轴编辑器。脚部锚点针对现有水平平台，不包含斜坡或可旋转地形。关键姿势图用于检查构形，不代替实际播放；最终动作美感仍需结合本地试玩和录像验收。

本机两处场景的 P95 帧间隔满足“不增加超过 15%”的门槛，纹理和对象池保持稳定；分层 Canvas 绘制的主线程帧处理耗时高于旧版，详见 `performance.json` 的 `cpuP95` 字段。该字段测量 PRE_STEP 到 POST_RENDER 的墙钟时间，包含绘制提交和可能的 GPU 等待，并非操作系统 CPU 使用率。性能记录仅代表本机的指定场景，不能推广到所有显卡或浏览器；没有原生 WebGPU 适配器的环境须明确记录跳过。
