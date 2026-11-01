# ACTION-A 第七轮：发力、接触与注意力

本页记录第七轮的本地实现与验收，保留第六轮 SUPPORT／RECOVERY；两轮成果现随 [v1.3.0](RELEASE-v1.3.0.md) 发布。下文基线、对照页与原始记录属于开发验收资料，可从 Release 对照包取得。

## 运行与审阅

```powershell
cd C:\VSC\github\NEW-project-1
npm ci
npm run dev
```

- 游戏：`http://127.0.0.1:5173/`
- 开发预览：`http://127.0.0.1:5173/?action-a`
- 同步对照：`http://127.0.0.1:5173/artifacts/action-a-round7/review.html`
- 录像、姿势图、原始测量：`artifacts/action-a-round7/`

开发预览可以分别切换 CONTACT、IMPULSE、INTENT；Attention 提供前方目标和绕背回放。曲线依次表示归一化的髋、胸、肩、头和装饰响应。诊断区显示接触阶段、权重、局部锚点、释放原因、注视目标与角度。关闭 CONTACT 关闭附加支撑接触，刚性骨段和握剑约束仍保留。

## 模块与所有权

### CONTACT

`src/action-a/contact/controller.ts` 提供 `ContactRequest`、`ContactState`、`ContactResult`。SUPPORT 保留平台检测、步态与重心目标；武器保留既有曲线和连续肘部方向；RECOVERY 保留可达撑手目标；DOLL-HIT 保留惯性端点。上述路径共用 CONTACT 的长度约束与接触状态。

每帧建立接触所有权，优先级是握柄、承重脚、自由手撑地、惯性端点。刚性长度在所有目标上强制成立。同一肢体的较低优先级请求不能覆盖已经建立的更高优先级结果。撑手只占用非持剑手，灯饰位置跟随最终手腕。装饰跟随只调整装饰旋转，不写入受约束关节的位置。

布娃娃活跃时跳过普通武器求解，普通脚部仅提供端点种子，再由惯性端点完成最终求解，避免重复重写普通站姿。支撑边界沿用 SUPPORT；首版仍只处理现有水平平台，不支持任意地形。

### IMPULSE

`src/action-a/impulse/controller.ts` 提供五个有增益、延迟、刚度、阻尼和幅度上限的通道。攻击、冲刺、敌人扑击、砸地、受伤按稳定实例触发；急停按速度跨阈值触发，落地消费下降速度。实例记录为有界缓存，不随持续游玩增长。

各通道以不大于 1/120 秒的子步推进，动作中断保留偏移和速度。替换旧主控即时加速度偏移。布娃娃期间普通身体响应衰减并让出姿态控制；减少动态关闭新增装饰弹性，保留身体发力。髋胸姿态只作用于可视骨架，不能改变实际位置、攻击判定或控制恢复时间。

### INTENT

`src/action-a/intent/controller.ts` 分为游戏驱动器使用的 `IntentSelector` 与角色使用的 `IntentController`。选择器过滤距离、垂直范围、背向、死亡与关闭门另一侧的目标；预警／攻击优先，普通目标有保持时间与距离切换门槛。

敌人仅在已有战斗阶段接收主控目标；预警与攻击使用已有锁定方向。角度限制分别为主控 18°／6°、苔影 12°／5°、玻璃蛾 20°／8°、守卫 10°／4°。攻击释放段、受伤、布娃娃与撑手期间抑制偏移。该模块不写入 facing、AI、输入、碰撞或伤害。

## 时序与兼容

`ActionActor.draw` 接口保留，新增可选 `intentTarget` 和 `lockedDirection`。游戏驱动器负责提供目标，动画控制器不遍历场景。

动作层采样后应用发力和注意力，再处理恢复及支撑重心，之后完成刚性肢体和握柄约束；刀光与显示对象消费约束后的世界姿态。相同模拟时间重复绘制不会推进动画，重生和传送通过既有 reset 清空状态。存档结构不变。

## 基线与复现

基线为 `artifacts/action-a-round7/baseline/` 的第六轮工作区源码，哈希清单在 `baseline.json`，不是远程 v1.2.0。

```powershell
npx vite artifacts/action-a-round7/baseline --host 127.0.0.1 --port 5181
npm test
npm run test:e2e
npm run format:check
npm run build
node scripts/action-a-round7-compatibility.mjs
node scripts/action-a-round7-geometry.mjs
node scripts/action-a-round7-performance.mjs
```

性能脚本需在未运行测试、录像和其他负载时执行。保存四场景三轮配对的原始样本、P95 中位数、分配估算、纹理与对象计数。几何采样与玩法兼容结果各自保存在 JSON 中；不能以它们替代正常速度和慢放的自然度判断。

最终实测结果见 `artifacts/action-a-round7/acceptance.md` 或 Release 对照包中的 `acceptance.md`。动作自然度可通过正常速度和慢放对照评估。
