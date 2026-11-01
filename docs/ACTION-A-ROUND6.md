# ACTION-A 第六轮：承重与复起

Release: [v1.3.0](RELEASE-v1.3.0.md). The local-only status below describes the original round 6 acceptance snapshot.
本轮为 v1.2.0 之后的本地开发版本，未提交、未推送、未更新在线试玩。基线为 Git 标签 v1.2.0；完整快照及文件哈希保存在 `artifacts/action-a-round6/baseline.json`。

## 本地运行

```powershell
npm ci
npm run dev
```

- 游戏：<http://127.0.0.1:5173/>
- 动作预览：<http://127.0.0.1:5173/?action-a>
- 本机对照：<http://127.0.0.1:5173/artifacts/action-a-round6/review.html>

预览保留角色、动作、朝向、速度、慢放、暂停及步进控制。`support` 和 `RECOVERY` 可分别关闭。`Moving platform combat` 演示平台局部接触；`Edge recovery` 配合受击下拉框检查边缘恢复。诊断显示锚点、权重、脚部阶段、恢复路径、剩余时间和非持剑手目标。

## SUPPORT：支撑与身体平衡

`src/action-a/support/controller.ts` 提供独立的 `SupportController`、`SupportInput`、`SupportState`、`SupportOutput` 和 `SupportSurface`。它接管原 `ActionActor.solveFeet` 中的接触管理、急停落脚、反向支撑保留、脚部目标及身体平衡目标。角色类消费输出，统一应用胸部反向倾斜与骨盆偏移，随后求解双腿。

每只脚保留平台标识、局部锚点、世界锚点、承重权重和四阶段状态（load、stance、toe-off、swing）。同一平台移动时由局部坐标重新计算锚点；平台切换、越界、不可达和腾空释放接触。没有边界的旧调用保留原有明确落脚行为。

主控、苔影和守卫使用原比例下的不同抬脚、重心幅度和响应配置。玻璃蛾绕过地面支撑。敌人步态消费实际位置变化；主控落地吸收新增读取碰撞前下降速度，避免零落地速度丢失冲击信息。所有变化都是视觉姿态，不写入碰撞体或实际位移。

## RECOVERY：从失控到可控

`src/action-a/recovery/controller.ts` 提供 `RecoveryController`、`RecoveryInput`、`RecoveryState` 和 `RecoveryOutput`。它观察 DOLL-HIT 的阶段、实例和剩余时间，输出收拢、下蹲、起身及接触意图，不拥有控制锁，也不调用伤害逻辑。

- 空中恢复使用收拢与放松；轻击滑退；其他地面恢复使用下蹲承重，在可达且有平台边界时尝试非持剑手撑地。
- 关节长度和握柄始终由 IK 保持，撑手带动灯饰；手部目标无效或不可达时保留无手支撑恢复。
- 恢复进度跟随原 DOLL-HIT 实例，空地变化不会重新创建攻击或受击实例。
- 原控制恢复后最多保留 0.12 秒视觉淡出；攻击、冲刺、束缚、起跳或新的受击立即获得原有控制权。
- 布娃娃退出时转交有效脚部锚点，清除旧刀光与布娃娃端点惯性。死亡、传送和重开统一重置。

游戏仍以 120 Hz 推进模拟时钟。新控制器使用游戏时钟；可见帧之间按最多 1/120 秒子步补算支撑与恢复状态，支撑位置与相位使用两次输入间的插值。重复时间输入不推进姿态；超过 0.25 秒的支撑输入空档重新建立锚点。录像每个 120 Hz 模拟步显式求值完整姿态。离屏角色不会额外模拟一套动画物理世界。暂停、失焦及既有命中停顿不推进模拟时钟。

## 验证与复现

```powershell
npm test
npm run test:e2e
npm run format:check
npm run build
# 独立终端运行基线，保持当前开发服务在 5173
npx vite artifacts/action-a-round6/baseline --host 127.0.0.1 --port 5180
node scripts/action-a-round6-compatibility.mjs
# 性能测试期间不要同时运行录像或其他浏览器测试
node scripts/action-a-round6-performance.mjs
$env:ACTION_A_VARIANT='before'
$env:PLAY_URL='http://127.0.0.1:5180'
node scripts/action-a-round6-review.mjs
$env:ACTION_A_VARIANT='after'
$env:PLAY_URL='http://127.0.0.1:5173'
node scripts/action-a-round6-review.mjs
```

`compatibility.json` 对照两版本在 10/20/60 fps、左右朝向、四种伤害和三种受身输入下的根部轨迹、生命、光能、冷却、弹跳、阶段及恢复控制模拟步。性能报告保存四场景三轮配对的逐帧原始记录，分配量为堆采样估计。

对照录像固定镜头、120 Hz 模拟与动作求值、30 fps 编码。主控移动、主控击飞恢复、苔影与守卫各占 6 秒，关键姿势图分别保存。素材和基线为本机验收文件，不随源码默认发布。

最终自动化、几何、玩法兼容与性能结果见 `artifacts/action-a-round6/acceptance.json`。视觉自然度单独交由正常速度及四分之一速度对照确认。

本轮新增 5 项核心测试，当前共 61 项单元测试；完整浏览器套件 72 项通过、无跳过，包括本机原生 WebGPU。最终边界插值修正后复跑模块测试及几何、兼容采样。4,200 帧几何采样覆盖左右朝向、四种伤害与 10/20/60/120 fps：画布越界 0，握柄误差 0，已锁定脚部漂移 0，持剑臂相对长度误差约 `1.1e-15`。这些数值对应脚踝与握柄约束点，不替代脚掌纹理接触和关节遮盖的人工检查。

72 组 v1.2.0 对照的根部轨迹误差为 0，控制恢复模拟步差为 0，生命、光能、冷却、阶段及弹跳记录无差异。攻击判定与敌人预警由既有完整战斗回归覆盖。

最终三轮配对 P95 中位数如下（同一本机，无头 Chromium，绮梦画质）：

| 场景 | v1.2.0 主线程 | 第六轮主线程 | 变化 |
| --- | --- | --- | --- |
| 普通移动 | 5.2 ms | 5.1 ms | −1.9% |
| 移动平台战斗 | 5.2 ms | 5.2 ms | 0% |
| 连续击飞恢复 | 5.3 ms | 5.3 ms | 0% |
| 守卫战 | 6.2 ms | 6.3 ms | +1.6% |

四场景帧间隔 P95 均为 33.4 → 33.4 ms，满足预算；纹理、显示对象及姿态缓冲数量稳定。堆采样仍可见临时输入和 IK 结果分配，本轮没有宣称零分配。平台战斗使用固定平台运动与动作输入，守卫场景运行实际游戏战斗模拟。

## 限制

首版针对现有水平平台；没有斜坡、攀爬或任意多刚体互撞。恢复撑手是有约束的视觉接触，不提供额外支撑碰撞或位移。当前保持 `ActionActor.draw` 接口，新控制器以子步推进状态，完整姿态求值和渲染提交仍按可见帧执行。低帧率下使用采样输入插值，不能重建未传入的瞬时地形接触信息。
