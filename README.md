# 晨露之门 · Dewlight Gate

一款温柔奇幻风格的 2D 横版轻动作冒险。提起玻璃灯，从 GATE 出发，穿过晨露、玻璃与藤蔓交织的庭院，唤醒三座石碑。

**[在线试玩](https://sekai6.github.io/dewlight-gate/)** · [Boss 战斗录像](docs/media/boss-duel.webm) · [MIT License](LICENSE)

![晨露庭院与安全开场](docs/media/opening.png)

## v1.4.0 · Action-skill 剑舞连携

在 v1.3.0 基线上加入 Q「折光穿枝」、R「藤芽升锋」、F「露华回旋」，并为守卫增加折冠散晶、根庭绽刺、露冠辉落与普通／挑战难度。安全庭院提供可重复、可跳过的训练光影。

运行 `npm run dev`：游戏 `http://127.0.0.1:5173/`，技能实验室 `http://127.0.0.1:5173/?action-skill`，骨骼预览 `http://127.0.0.1:5173/?action-a`。两个开发入口均从生产构建移除。

[技能架构与参数](docs/ACTION-SKILL.md) · [验收报告](docs/ACTION-SKILL-ACCEPTANCE.md) · [版本说明与对照下载](https://github.com/Sekai6/dewlight-gate/releases/tag/v1.4.0)。对照包解压后打开 review.html，可同步观看正常及四分之一速度录像。

## v1.3.0 / ACTION-A SUPPORT · RECOVERY · CONTACT · IMPULSE · INTENT

[Release notes](docs/RELEASE-v1.3.0.md) · [Round 6 architecture](docs/ACTION-A-ROUND6.md) · [Round 7 architecture and validation](docs/ACTION-A-ROUND7.md)

## v1.2.0 / ACTION-A-DOLL-HIT

第六轮承重与复起及第七轮接触、发力、注意力已随 v1.3.0 发布。以下保留 v1.2.0 的布娃娃系统说明。

本版包含 [ACTION-A 第五轮](docs/ACTION-A-ROUND5.md) 和 [ACTION-A-DOLL-HIT 分级受击 / 布娃娃击飞](docs/ACTION-A-DOLL-HIT.md)。主控受到不同攻击时会失衡、击飞、翻滚并起身；短暂失控后按空格或 Shift 可以受身。保留既有存档格式。详见 [版本说明](docs/RELEASE-v1.2.0.md)。

新版接入自研 ACTION-A 分层骨骼动画，覆盖主控、苔影、玻璃蛾和露冠守卫。重制剑舞发力链、动作衔接与受击反应，保持现有玩法和存档兼容。

运行 `npm run dev` 后访问 `http://127.0.0.1:5173/?action-a` 可进入动作预览。[第四轮剑舞与战斗重制](docs/ACTION-A-ROUND4.md) · [第三轮分层重构与夸张动作](docs/ACTION-A-ROUND3.md) · [系统说明与验收方法](docs/ACTION-A.md)。

## 游戏特色

- 安全开场、短平台练习与第一关小 Boss「露冠守卫」。
- 移动、跳跃、近战、冲刺、藤蔓束缚与场景交互；冲锋和根浪提供动作与地面预警。
- 三个地区、20 枚主线灯环与三座石碑；可选浅溪另有 4 枚灯环。
- 日志、背包、暂停旅程页、自动存档和检查点；失败保留收集进度。
- 自制程序绘图与矢量风格美术，支持减少动态、镜头震动开关和清晰界面。
- 默认 Canvas 渲染；可选 WebGPU 后处理，不支持时自动回退。

![露冠守卫与根浪预警](docs/media/boss.png)

## 操作

请使用桌面浏览器与键盘，推荐窗口至少 1024 像素宽。

| 按键 | 操作 |
| --- | --- |
| A / D 或左右方向键 | 移动 |
| C | 慢行 |
| 空格 | 跳跃 |
| S / ↓ + 空格 | 穿下平台 |
| J | 近战；Boss 战中可按住连击 |
| Shift | 冲刺，短暂受伤保护 |
| K | 藤蔓束缚敌人或固定叶台 |
| Q | 折光穿枝，20 光，3.5 秒冷却，地面或空中 |
| R | 藤芽升锋，25 光，5 秒冷却，每次离地一次 |
| F | 露华回旋，35 光，8 秒冷却，仅空中起手 |
| E | 交互、接通灯环、唤醒石碑 |
| Tab / Esc | 旅程页 / 暂停 |
| H | 显示或收起寻路引导 |
| T | Boss 战中回入口重试 |

Boss 普通命中削 1 点生命，疲惫或束缚时削 2 点。红色箭纹预告冲锋，金色地纹预告可跳过的根浪；K 能打断并创造破绽。第一碑后到发光门按 E 进入下一地区。

## 本地运行

需要 Node.js **22.18 或更新的 22.x 版本**与 npm。

```sh
npm ci
npm run dev
```

打开终端显示的地址。Windows PowerShell 若阻止 npm.ps1，请改用 `npm.cmd`。

```sh
npm run build
npm run preview
```

生产文件位于 `dist/`，可部署到静态网站；资源使用相对路径。正常生产构建不会暴露开发调试入口。

## 开发与验证

技术栈：TypeScript、Vite、Phaser 3、Canvas、HTML/CSS；没有后端、账号系统或外部 API。音效由 Web Audio 合成，在首次用户操作后启用。

```sh
npm test
npm run format:check
npx playwright install chromium
npm run test:e2e
```

Playwright 自动启动开发服务；本地可复用已有服务。CI 检查格式、单元测试、浏览器测试及构建，通过后自动部署 GitHub Pages；PR 只检查。原生 WebGPU 检查按适配器能力跳过，跳过不代表 GPU 验证通过。

`scripts/` 保留专项复现脚本，生成结果写入未提交的 `artifacts/`。完整流程检查使用实时引导与普通控制完成灯环、Boss 和三碑；局部演示脚本可能定位初始场景，不能替代完整通关证据。

## 存档与限制

- 使用当前浏览器的 localStorage 自动存档；清理网站数据会清空进度，没有云同步。存储不可用时仍能游玩。
- 仅支持桌面键盘，暂不支持触屏、手柄、配音或多人游戏。
- 首次加载需下载游戏包；加载后可离线继续当前页面，没有离线安装或离线刷新保证。
- WebGPU 需要 HTTPS 和兼容浏览器/显卡，显示 SDR 画面；不可用时使用 Canvas 画面。
- 未完成的 Boss 战刷新后重新开始；已击败结果永久保留。

## 参与项目

欢迎提交问题与 Pull Request。反馈请附浏览器、窗口尺寸、复现步骤及截图；提交改动前运行上述检查。请勿提交凭据、环境变量文件、依赖、构建产物或测试录像目录。

当前发布素材仅保留两张截图和一段录像。历史说明见 [版本迭代记录](docs/RELEASE-HISTORY.md) 与 [验收记录](AUDIT.md)，其中旧版本数字及本地证据路径不代表当前公开版本。

## 许可

源码与项目自制美术使用 [MIT](LICENSE)。Phaser 等依赖遵循各自的开源许可。
