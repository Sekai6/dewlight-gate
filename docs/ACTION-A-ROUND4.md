# ACTION-A 第四轮：剑舞发力链与全角色战斗重制

> v1.1.0: ACTION-A round 4 is included in the open-source release and GitHub Pages deployment. The local-only statements below describe the original development acceptance stage. Baseline captures, comparison videos and raw reports remain local ignored artifacts; they are not included in a fresh clone.


本轮仅更新本地工作区，未提交、推送或更新在线试玩。保留第三轮为基线，玩法判定、攻击间隔、85 ms 命中、输入缓冲、敌人预警、伤害和存档结构保持兼容。

## 运行与查看

```powershell
cd C:\VSC\github\NEW-project-1
npm.cmd ci
npm.cmd run dev
```

- 游戏：<http://127.0.0.1:5173/>
- 动作预览：<http://127.0.0.1:5173/?action-a>
- 四场景同步对照：<http://127.0.0.1:5173/artifacts/action-a-round4/review.html>
- 关键姿势：`artifacts/action-a-round4/sheets/{hero,moss,moth,guardian}.png`

预览提供五层开关、权重诊断、手臂误差、握柄目标、剑尖速度和骨骼/支撑链显示；Replay 可选择站立连斩、移动连斩、空地衔接、受伤打断和敌人阶段。左右基线使用同输入、同模拟时间。基线快照是忽略提交的本地材料，缺少时对照不可用。生产构建移除整个预览入口。

## 核心与约束

### 曲线和混合

- `Track.interpolation = "hermite"` 支持三次 Hermite 曲线，`Key.tangentIn/tangentOut` 单位为通道值/秒；旧轨道的 linear/smooth/hold 行为兼容。内部姿势用共享切线连接，端点归零，避免每个关键帧都停住。
- `BoneMask` 按骨骼或具体通道设置权重，`AnimationLayer.apply` 支持 `override` 和相对参考姿态的 `additive`。参考未提供时使用骨骼静止姿态。
- 移动攻击保留基础步态，髋部只接受部分位置转移，胸肩、双手使用不同权重；受击叠加在当前基础动作上，取消战斗权重，恢复时继续使用叠加淡出。
- 连斩仍使用稳定攻击实例。武器约束保存上一输出和速度，在新实例上用 45 ms 惯性修正衔接；在原 85 ms 命中点之前修正已结束。空地切换不重启实例。

### 武器与手臂

新增 `CombatMotionDefinition`，为横斩、上挑和空中斩提供握柄位置、剑身角度与固定接触时间。配置在角色局部空间采样，跟随肩部移动。先完成身体、骨盆和脚部约束，再用双段 IK 求持剑臂，最后设置刚性剑身和装饰跟随。

- 主控上臂 12、前臂 11 世界像素，IK 对不可达目标做距离约束，肢体不通过拉伸追赶目标。
- 手腕与剑柄共享最终位置；剑身矩阵正交且单位缩放，不继承躯干的非等比伸缩。
- `ActionActor.draw` 接口保留；局部绘制提交拆为 `submitPose`，手臂/武器约束拆为 `solveWeapon`，支撑保持 `solveFeet`。
- `ActorInput` 可带 `combatPhase` 和 `hitDirection`。玩家和敌人受伤方向来自原有伤害来源，守卫阶段获得稳定实例标识；这些字段只服务动画，不写存档、不决定伤害。
- 所有状态使用模拟时钟，暂停或命中停顿不推进；统一 reset 清除攻击身份、惯性、IK 诊断和轨迹。

### 角色与表现

| 角色 | 本轮动作重点 |
| --- | --- |
| 主控 | 横斩与上挑采用不同握柄轨道；肩胯扭转、伸展和收势顺滑连接，空中保留团身与反向平衡；冲刺增加髋部推进，束缚加入后手平衡，受伤按来源方向偏转 |
| 苔影 | 髋部后移蓄势、后手压缩、扑击时前送伸展、头部稳定和前手承接；恢复逐步回中 |
| 玻璃蛾 | 双翼先后收拢，胸腹反向，俯冲时腹部滞后，恢复展翼制动；受伤采用不对称翼姿与侧翻 |
| 守卫 | 后移蓄势、髋部持续推进、头部反向稳定、根足支撑；原举身砸地、接触压缩和冠叶回弹沿用并以连续曲线连接 |

身体最终局部缩放继续限制为 85%–115%。所有角色身份、配色及场景素材保留。减少动态关闭额外残影、粒子和弹性，完整肢体动作和预警保留。

### 刀光与缓存

- 实际剑尖与握柄决定刀光；20 fps 附近按相邻剑轴角度补入最多两个弧线样本，剑长保持一致。单步超过 65 ms、动作/实例变化或受伤时断开历史，避免跨无关姿态补面。
- 轨迹样本使用固定 24 项池，最多显示 20 项；按模拟时间原位移除过期项，不再逐帧分配整个轨迹数组。
- 姿态缓冲、预编译轨道索引、固定部件顺序、Atlas 和固定局部 Canvas 继续复用。其余 IK、脚部和装饰中仍有少量临时对象，不能宣称模块零分配。

## 验证与验收方法

- 单元测试覆盖 Hermite 端点/切线、按通道遮罩、叠加参考、武器接触时间与不同剑路，保留此前惯性、连续中断、旋转、事件、暂停重置和 IK 测试。
- 新浏览器测试在 10/20/60 fps、左右朝向、连续连斩、受伤与空地交叉中检查臂长误差 ≤1%、手与剑柄误差 ≤1 像素、剑长误差 ≤1%，85 ms 时剑尖进入前方区域。
- 保留原支撑脚 ≤3 像素、移动平台、四类角色全部动作边界、暂停/重置、存档、完整通关与 Boss 战测试。最终检查完整浏览器套件、单元测试、格式、TypeScript、构建和生产入口隔离。
- 原生 WebGPU 必须实际执行提交与绘制，能力不足明确记录跳过，不把回退测试充当原生验证。

定稿检查：47 项单元测试、65 项浏览器测试通过，0 失败、0 跳过；格式、TypeScript 和生产构建通过。原生 WebGPU 的实际提交、跨地区、缩放与设备丢失回退通过。生产检查确认预览和调试入口不存在，实际移动、跳跃、攻击、暂停与保存通过，无页面错误或资源 404。

### 性能

`scripts/action-a-round4-performance.mjs` 在同机 1440×900、dream 画质、无录像负载下，执行三轮基线/当前配对。每场景预热 2 秒，采集 360 个 rAF，报告三轮 P95 的中位数，要求主线程 ≤+10%、帧间隔 ≤+5%。

四场景分别驱动主控、苔影、玻璃蛾和守卫的固定动作循环，同时保留完整游戏模拟和渲染。主线程测量 prestep 到 postrender，动作测量 `ActionActor.draw`，绘制测量 prerender 到 postrender；不能用平均帧率替代。另行采集两秒 CDP 分配估算及精确 PoseBuffer 新增数，纹理/显示对象比较前后数量。原始每轮数据和最终比较均保留在 `performance.json`。

### 最终性能结果

| 场景 | 主线程 P95 中位数：第三轮 → 第四轮 | 变化 | 帧间隔 P95 中位数 |
| --- | --- | --- | --- |
| 主控 | 5.1 → 5.1 ms | 约 0% | 33.4 → 33.4 ms |
| 苔影 | 5.1 → 5.2 ms | +2.0% | 33.4 → 33.4 ms |
| 玻璃蛾 | 4.7 → 4.7 ms | 约 0% | 33.3 → 33.3 ms |
| 守卫 | 6.1 → 5.9 ms | −3.3% | 33.4 → 33.4 ms |

四场景均满足主线程 ≤+10%、帧间隔 ≤+5%。每次当前测量姿态缓冲数为 437，测量期间新增为 0；纹理和显示对象数量稳定。动作、求值、约束、绘制的各轮 P95 及分配估算保留在原始 JSON；这些分项 P95 不应直接相加。求值项包含动画状态、采样、混合、装饰和绘制数据提交，约束项单独计时脚部及持剑臂。

该无头浏览器 rAF 约 30 Hz，不能据此推断实际桌面上限。部分场景分配估算略增，未宣称整体分配下降或零分配；主控增加的约束与轨迹仍在总帧预算内。

## 复现

先启动当前开发服，再另开终端：

```powershell
npx.cmd vite artifacts/action-a-round4/baseline --host 127.0.0.1 --port 5178
```

```powershell
node scripts/action-a-round4-performance.mjs
$env:ACTION_A_OUTPUT='artifacts/action-a-round4'
$env:FIXED_CAPTURE='1'
$env:ACTION_A_VARIANT='before'
$env:PLAY_URL='http://127.0.0.1:5178'
node scripts/action-a-review.mjs
$env:ACTION_A_VARIANT='after'
$env:PLAY_URL='http://127.0.0.1:5173'
node scripts/action-a-review.mjs
node scripts/action-a-sheet.mjs
node scripts/action-a-report.mjs
node scripts/action-a-verify-review.mjs
```

录像固定 120 Hz 模拟、30 fps 编码，四场景各 6 秒，共 720 帧/24 秒，可同步正常播放及四分之一慢放。编码需要 `FFMPEG` 或 Python `imageio_ffmpeg`。录像用于动作对照，不用于性能计时；关键姿势图按轮廓适配取景，录像保持固定镜头。

```powershell
npm.cmd test
npm.cmd run test:e2e
npm.cmd run format:check
npm.cmd run build
npm.cmd run preview
# 另一个终端
$env:ACTION_A_OUTPUT='artifacts/action-a-round4'
node scripts/action-a-production.mjs
```

最终自动化检查与性能结论记录在本轮 `acceptance.json`。视觉风格与剑舞表现由用户观看正常速度及慢放后统一确认，确认后另行发布。
