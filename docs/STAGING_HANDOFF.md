# NewTone Staging 接手包

> 用途：这是当前 `staging` 施工现场的唯一接手文档。它不是更新公告，也不是对外 changelog。任何人、任何新的 AI、任何开发者在继续施工前，都应该先读这份文件，再看 `main...staging` diff。
>
> 规则：只记录当前真实状态、已做决定、验证结果、已知风险和待办。不要把宣传文案写进这里。更新公告应在准备发布时，基于本文件 + Git diff 另行撰写。

最后更新：2026-08-08

## 1. 项目与分支基线

- 仓库：`NewTone-Home/NewTone-Home`
- 正式分支：`main`
- 当前施工分支：`staging`
- 本轮 staging 的 `main` merge base：`8d88d00dcb3b0e01f1bd3f81cd5b36c98177f4af`
- 建立本接手包前的产品代码 HEAD：`5dfef204e6e79aa59446a6f75ffe003f72bb4191`
- 建立本接手包前，`staging` 相对 `main`：ahead 3 / behind 0

注意：接手包自身的创建和后续维护也会产生 docs-only commits，因此上面的 ahead 数量只代表“第一版接手包建立前的快照”，不是永久当前值。任何接手人都必须重新执行 `main...staging` compare，以实时 Git 状态为准。

本轮 staging 不是独立产品，也不是另一套代码。它的定义是：

`当前 main 基线 + 测试环境配置 + 本轮实验改动`

不要把 staging 当作长期分叉。正式上线前应重新比较 `main...staging`，确认 main 没有出现未同步的新变化。

## 2. 当前部署拓扑

### Production

- Git branch：`main`
- Vercel：Production
- Production commit：`8d88d00dcb3b0e01f1bd3f81cd5b36c98177f4af`
- Supabase project：`bxowbscoffhmavrccxnm`
- Supabase name：`NewTone-Home's Project`

### Staging

- Git branch：`staging`
- Vercel：Preview
- 稳定 branch alias：`https://new-tone-git-staging-newtone-homes-projects.vercel.app`
- 当前最近一次包含产品代码变化的 Preview deployment：`dpl_J2D24SxqEkdkASY5GSDNQAJULZpw`
- 对应产品代码 commit：`6ff3031930402383aaaffc773345e9069b787410`
- deployment state：`READY`
- Supabase project：`ksrvlkcpaiowhcvzimkc`
- Supabase name：`NewTone-Staging`

说明：之后仅修改本接手包也可能触发新的 Preview deployment。判断“产品代码版本”时不要只看最新 deployment 时间，应同时看它对应的 Git commit 和 diff。

Staging Preview 使用独立 Supabase，不应把测试 analytics、测试用户、session、reading state 合回 production。

## 3. 本轮 staging 已完成的基础设施

### 3.1 staging 分支工作流

已建立 staging 分支与说明文档：

- `docs/STAGING_ENVIRONMENT.md`
- commit：`7eabc7f1f1cab312738ab7b97e3f0828afcf7675`
- message：`docs: establish staging environment workflow`

### 3.2 Vercel Preview 连接独立 Supabase

已新增：

- `scripts/vercel-build.mjs`
- 修改 `vercel.json`

commit：

- `9ce79052a43a6573f331ed35287fbba1e560a5e1`
- message：`chore: connect staging Preview to isolated Supabase`

当前行为：

- Vercel 构建如果检测到 branch 为 `staging`，使用 NewTone-Staging Supabase。
- 其他 branch 保留原有环境配置。
- 目前 staging Supabase URL 和 publishable key 通过 build script 注入。

注意：publishable key 本身是客户端公开凭据，不是 service role secret，但长期更干净的方案仍然是改为 Vercel branch-scoped Preview environment variables，然后移除 build script 里的硬编码配置。

## 4. 本轮产品实验

### 4.1 Reader 初始化交互：hover + downward scroll

状态：**保留，用户已实际体验并确认可以工作。**

commit：

- `5dfef204e6e79aa59446a6f75ffe003f72bb4191`
- message：`feat: advance Reader setup with hover and scroll`

涉及文件：

- `src/App.jsx`
- `src/interactions/holdProgress.js`
- `src/interactions/ritualWheelAdvance.js`
- `tests/ritualWheelAdvance.test.js`

原行为：

- Reader 首次初始化的语言与阅读模式选项依赖鼠标持续悬停一段时间后自动确认。

当前行为：

- 语言初始化：鼠标停留在主选项上，向下滚动，进入下一阶段。
- “Change language” 仍然负责展开/切换语言，不作为滚轮前进入口。
- 阅读模式初始化：鼠标停留在 immersive 或 standard 对应选项上，向下滚动，选择对应模式并继续。
- 向上滚动不触发。
- `deltaY <= 8` 的微小滚轮噪声不触发。
- 在 `language-active` / `mode-active` 阶段，长时间 hover 不再自动推进。
- Reader 其他位置原有 hold 行为不应受影响。

为什么改：

- 让 Reader 初始化阶段与 Reader 正文的滚轮交互语言保持一致。
- 避免用户仅仅把鼠标停在选项上，就在没有主动确认的情况下被自动带走。

验证状态：

- Vercel Preview build：通过。
- TypeScript typecheck：通过。
- Vite production build：通过。
- 用户人工体验：通过。
- 已新增 Vitest 测试文件，但当前 Vercel build script 不执行 `npm test`，因此**不能声称这组 Vitest 已运行通过**。

后续如果继续改该交互，优先验证：

1. wheel event target 是否始终落在 `[data-selector-option]` 上。
2. trackpad 小幅滚动是否过于敏感或过于迟钝。
3. touch/mobile fallback。目前项目 desktop-first，此实验主要针对鼠标/触控板。

### 4.2 Reader 初始化选项 hover 视觉提示

状态：**已实现并部署到 staging，待用户人工体验确认是否保留当前强度与样式。**

代码 commits：

- `a581569cfd35f1841c1b2bdf7bdfb7e64f66cd82` — `style: add Reader setup hover affordance`
- `6ff3031930402383aaaffc773345e9069b787410` — `style: load Reader setup hover affordance`

涉及文件：

- `src/components/ReadingTransitionHover.css`：新增
- `src/App.jsx`：加载该样式

目标选项：

- 语言阶段主选项“继续读取 / Continue Reading”
- 阅读模式“沉浸叙事 / Immersive”
- 阅读模式“普通阅读 / Standard”

明确排除：

- “更改语言 / Change language” 不显示向下确认提示，因为它不是向下滚轮确认入口。

当前视觉行为：

- 鼠标移入可向下滚动确认的选项后，文字轻微放大至约 `1.08x`。
- 文字下方出现两条细下划线，第二条略短。
- 双线下方出现 `↓` 向下箭头。
- 下划线和箭头以轻微渐显/位移动画进入，移开后恢复。
- 不改变上一项实验的滚轮确认逻辑，不新增点击行为。
- reduced-motion 条件仍由现有 ReadingTransition motion 规则统一压缩动画时长。

验证状态：

- Vercel Preview deployment：`dpl_J2D24SxqEkdkASY5GSDNQAJULZpw`
- deployment：`READY`
- Vercel 构建确认使用 staging Supabase。
- TypeScript typecheck：通过。
- Vite production build：通过，231 modules transformed。
- 仍有既有的 >500 kB chunk warning，无新增 build error。
- **视觉手感尚未由用户人工确认。** 后续如果用户觉得太大、太明显、线太长或箭头位置不合适，优先只微调 `ReadingTransitionHover.css`，不要改 wheel 逻辑。

### 4.3 Landing / Reader Entry 交互与视觉重构

产品提交：`5c83cb7 feat: refine Landing and Reader entry motion`

当前实现：

- Landing 首次未学会入口时，先安静约 1.2 秒，再显示 NewTone 轻微呼吸与指向 N 的手绘弯箭头；若用户提前触发，箭头不会出现；若箭头已出现，则先沿路径收回，再继续原有描线激活动画。
- 默认 Landing 大幅清理非必要 sketch、随机字符与装饰线；显式 `jijia_compound` query 实验仍保留，不进入默认界面。
- Landing 与首次 Start 共用场景级视差输入。NewTone 与两条独立 SVG 手绘线作为同一前景层；辅助文字与方向提示作为较小幅度的反向后景层。
- Reader 返回后的 Landing 继续启用视差；Resume / 回读中过渡明确关闭视差，并移除随机字符噪点，仅保留环境与状态反馈。
- 桌面使用 pointer 位置输出统一的 normalized X/Y；移动端只使用 Device Orientation，不使用触摸位置模拟视差。
- 移动端 baseline 只在当前场景生命周期内存在，不写入 localStorage；进入场景、后台恢复和屏幕方向变化时重建中心；稳定新姿态会缓慢软校准。
- 需要 iOS motion 权限时，只在用户完成 NewTone 入口手势后请求；不支持或拒绝授权时静态退化。
- 桌面 Language / Mode 初始化仍保留“hover 目标 + 向下滚轮确认”，向上滚动和微小噪声不触发；移动端主选项改为 tap 直接确认，“更改语言”仍只展开语言列表。

本地验证：

- `npm test`：22 files，94 tests 全部通过。
- lint：通过。
- typecheck：通过。
- Vite production build：通过，230 modules transformed。
- diff-check：通过。
- 桌面浏览器流程：Landing 引导、激活、反向视差、Language/Mode 下滚确认、首次 Start、Reader 返回、再次进入 Resume 均已走通。
- 移动端 390×844：无横向溢出；Language / Mode tap 直接确认已走通；未使用 touch-parallax。
- reduced-motion：呼吸、引导运动和视差均静态退化。
- 自动无障碍检查：0 violations；1 项 SVG 重叠背景导致的颜色对比 incomplete，需人工判断。

部署与尚待验收：

- GitHub `staging` 的 `c9c58cf` 已由 Vercel 报告 `Deployment has completed` / `success`；稳定 branch alias 启用了 Vercel 登录保护，仍需用户进入测试服完成人工视觉手感验收。
- 真实 iPhone / Android 上的 Device Orientation 权限、横竖屏映射、场景归零与持续稳定姿态软校准必须真机验收；桌面自动化环境不能替代传感器证据。
- 依赖安装仍报告 2 个既有 high severity audit 项，本轮没有擅自执行 audit fix。

### 4.4 真机反馈修正：Landing return / direct input / motion

产品提交：`e396b94 fix: refine Landing return and mobile setup`

本节覆盖 4.3 中与本轮真机反馈冲突的旧描述：

- `introCompleted` 现在只控制第一次是否锁住离开手势。主 Landing 每次进入仍会安排 NewTone 引导箭头；第一次必须完成描线，已学会后可以在描线途中下滚/上滑，先 retract 再离场。
- NewTone 双手绘线只保留在普通主 Landing；First Start、Reader 返回后的 Landing、Global Transition 和 Resume 均不显示双线。
- Reader 返回 Landing 时，遮罩 NewTone 在不透明纸面上先淡出，纸面随后才揭开真实 Landing，避免双 Logo 同时可见；返回 Landing 使用更轻、更小的提示箭头，并继续保留视差。
- Language / Mode 选项不再使用 CSS gradient 假双线，改为两条独立、长度和曲率不同的 SVG 手绘 path。
- 移动端和 Apple Pencil 统一走 Pointer Events：tap / pen 只把可确认选项设为 armed，不立即跳页；第二次向上 swipe 才确认。Change language 只展开语言列表并取消已有 armed 状态。
- 桌面仍保持 hover 目标 + downward wheel；向上 wheel、微小噪声和 Change language 不触发推进。
- 移除视差层上的 CSS transform transition，只保留 rAF 平滑；前景提高到约 X ±14 / Y ±10，反向后景约 X ±6 / Y ±4，Device Orientation 有效范围调整为 12°。
- motion 权限请求每次页面生命周期最多一次；先直接监听已授权事件，只有未收到数据时才在 NewTone 自然 touch/pen 手势后请求。localStorage 只记录用户希望启用 motion，不保存 beta/gamma baseline；测试重置不清该偏好。
- staging `重置测试` 保留既有 `b0ec71b` 实现，没有重复创建。

验证：

- `npm test`：22 files，96 tests 全部通过。
- lint、typecheck、Vite production build：通过，231 modules transformed。
- `git diff --check`：通过；仓库当前没有名为 `diff-check` 的 npm script。
- 浏览器验证：第一次 Landing 下滚锁定、完成后解锁；已学会回访仍显示主引导且可中途 retract；desktop pointer 视差约 13.98px / -9.97px，parallax 层 CSS transition 为 0s。
- 390×844：Language touch 点选后保持原阶段并显示 armed，向上 swipe 后进入 Mode；Mode 使用 pen 点选后保持原阶段，pen 向上 swipe 后推进；Change language 只展开并清除 armed；横向 overflow 为 0。
- First Start、返回 Landing 和 Resume 的双线数量均为 0；返回 Landing 使用 return 小箭头并保留视差；Resume 无位置视差。
- reduced-motion：引导动画为 none；浏览器无 runtime error。
- 自动无障碍检查：1 个既有的 landmark best-practice violation；SVG 叠层颜色对比仍为 incomplete，需要人工判断。

仍需真实设备验收：

- iPhone / iPad Safari 的实际 motion 权限持久行为不能由桌面 Chromium 模拟。
- Device Orientation 横竖屏、坐姿到躺姿软校准、后台恢复需要真机确认。
- Apple Pencil 的物理 swipe 手感、返回遮罩与 Landing 的视觉交接仍需用户在测试服确认。

### 4.5 第二轮测试服反馈：线条、整屏 swipe 与返回视差

产品提交：`efc6e4e fix: polish Landing lines and setup gestures`

- 主 Landing 的两条签名线扩大垂直间距，并重新绘制为曲率、起止点和长度差异更明显的两条 path。
- Language 的 Change language / 当前语言区域 hover 时显示同一套双手绘线，但显式使用 `lines-only` 变体，不显示箭头；鼠标仍在整个语言展开区域内时，切换语言后双线继续保留，完全移开才消失。
- Language 页原本一直存在的水平装饰线已删除；Mode / 阅读体验页已获认可的环境分隔线保留。
- First Start 的方向箭头已删除；Start 只保留 NewTone 与开始读取文字及其前后景视差。
- touch / pen 的 armed swipe 从 selector 局部监听改为 window 范围监听，超过阈值时在 pointermove 立即确认。Language 的 Change language 整个区域明确排除；Mode 可从页面任意合理位置上滑。
- Device Orientation 的稳定判断从“相邻帧变化”改为“相对稳定锚点的姿态窗口”。缓慢倾斜累计超过 0.55° 会被识别为用户输入，不再被逐帧软归零；持续停在新姿态后才开始软校准。

验证：

- `npm test`：22 files，97 tests 全部通过；lint、typecheck、Vite production build 通过，231 modules transformed。
- 浏览器视觉检查：Landing 双线间距已拉开；Language 当前语言 hover 只显示双线无箭头；切换为 English 后双线保持；Language 常驻横线已消失。
- 390×844：touch 点选 Language 后从页面空白区域上滑可进入 Mode；pen 点选 Mode 后从页面空白区域上滑可进入 Start。
- Start 截图与 DOM 均确认无方向箭头、无 NewTone 双线。
- Reader 返回 Landing 后 desktop pointer 实际输出约 front X 13.78px / Y -9.72px，CSS transform 生效；真实 iPad Device Orientation 仍需用户复验。
- 浏览器无 runtime error；本轮浏览器验收产生的单个临时文件 `0` 已核实并删除，未进入 Git。

## 5. Reader 内容镜像状态

最初建立 NewTone-Staging 时只复制了数据库 schema，没有 production Reader 内容，因此 Preview 曾显示“暂无可读页面”。这不是 Reader 代码损坏，而是 staging `reader_publications` 为空。

目前已完成 production → staging Reader 内容镜像。

### Production 当前 published Reader

- slug：`main-reader`
- version：`2`
- status：`published`
- content SHA-256：`8ad2228a8425e5f34b190158a9208821194cbdc4caede7f3367545c7479cbb9a`
- published_at：`2026-08-05T12:54:07.104342+00:00`

### Staging 当前 published Reader

- slug：`main-reader`
- version：`2`
- status：`published`
- content SHA-256：`8ad2228a8425e5f34b190158a9208821194cbdc4caede7f3367545c7479cbb9a`
- published_at：与 production 一致

结论：当前 staging Reader 正文基线与 production published Reader 一致。

### 测试 publisher

Staging 为满足 `reader_publications.published_by -> auth.users.id` 外键，创建了专用测试 publisher：

- email：`staging-reader-seed@newtone.invalid`
- purpose：`staging-reader-content-seed`

它不是 production 用户，不应被同步到 production。

## 6. Reader 内容同步过程中的临时设施

Supabase 中目前存在以下 Edge Functions：

Production：

- `export-reader-publication`

Staging：

- `sync-reader-publication`
- `sync-reader-publication-once`

重要：`sync-reader-publication-once` 是为这次首次镜像搭出的临时入口，不应长期保留为公开触发口。

此外，staging 曾为内容 seed 尝试安装 `http` extension。当前同步已经不依赖数据库内 HTTP 调用，因此上线前应检查该 extension 是否仍有必要。

长期建议：

1. 保留一个明确、受保护、可重复执行的 Reader seed/sync 流程。
2. 删除或禁用一次性同步入口。
3. 同步令牌不要长期硬编码在 Edge Function 源码中，应迁移到 Supabase secrets 后再把同步流程视为正式基础设施。
4. 不要为了同步 Reader 去复制 production Auth、analytics、session 或用户阅读状态。

## 7. 第一版接手包建立前的 `main...staging` 文件差异

GitHub 当时显示以下文件有差异：

- `docs/STAGING_ENVIRONMENT.md`：新增
- `scripts/vercel-build.mjs`：新增
- `src/App.jsx`：修改
- `src/interactions/holdProgress.js`：修改
- `src/interactions/ritualWheelAdvance.js`：新增
- `tests/ritualWheelAdvance.test.js`：新增
- `vercel.json`：修改

接手包建立后/后续产品实验还会额外出现：

- `docs/STAGING_HANDOFF.md`：新增/持续修改
- `src/components/ReadingTransitionHover.css`：新增
- `src/App.jsx`：继续修改，用于加载新的 hover 提示样式

发布前不要只凭这份清单判断，应重新执行一次 `main...staging` compare，以 GitHub 实际 diff 为准。

## 8. 已知问题 / 风险

### 8.1 当前 staging build 不跑测试

`package.json` 有：

- `npm test` → `vitest run`

但当前 Vercel build 只执行：

- typecheck
- vite build

所以新增测试存在，不代表已经在部署流程里执行。

### 8.2 staging build 配置仍有硬编码环境信息

客户端 publishable key 不是秘密，但长期应改为 branch-scoped env vars，避免把环境路由逻辑绑死在代码里。

### 8.3 临时 Supabase 同步入口需要收尾

`sync-reader-publication-once` 不应成为长期公开 API。完成首次镜像后应删除/禁用，或至少改为正式认证机制。

### 8.4 不要把测试数据误当成生产数据

Staging 中 analytics、Auth、session、reader state、reading progress 都是测试环境自己的数据。即使 schema 与 production 相同，也不代表数据应该合并。

## 9. 本轮尚未完成的事项

- [ ] 用户人工确认 4.2 hover 视觉提示的大小、双下划线长度和箭头位置
- [ ] 清理/禁用 `sync-reader-publication-once`
- [ ] 决定 `export-reader-publication` / `sync-reader-publication` 是否保留为长期内容 seed 方案
- [ ] 如果保留长期同步方案，把同步令牌迁移到 secret，不继续硬编码
- [ ] 检查 staging `http` extension 是否需要保留
- [x] 运行 `npm test`，包括 `tests/ritualWheelAdvance.test.js`；当前 97 tests 全部通过
- [ ] 用户人工确认 Landing 引导、双手绘线、前后景视差与首次 Start 的视觉手感
- [ ] 在真实 iPhone / Android 验收 Device Orientation 权限、归零、横竖屏映射与软校准
- [x] GitHub staging `c9c58cf` 对应的 Vercel Preview 已报告部署成功
- [ ] 继续本轮产品实验时，持续更新本文件
- [ ] 发布前重新同步最新 `main` 到 staging，如果 main 已前进
- [ ] 发布前重新比较 `main...staging`
- [ ] 发布前人工走一遍 Landing → language → mode → Reader → return 全流程
- [ ] 发布前确认 staging analytics 正常且 production analytics 未被测试污染

## 10. 接手施工规则

任何继续施工的人或 AI，按以下顺序开始：

1. 阅读本文件。
2. 检查 `main` 与 `staging` 当前 HEAD，不要假设 SHA 仍然没变。
3. 比较 `main...staging`，确认实际差异。
4. 检查 Vercel 最新 staging deployment 是否对应 staging HEAD。
5. 如需测试 Reader，确认 staging `main-reader` 与当前 production published Reader 是否仍为同一版本/hash。
6. 一个相对独立、决定保留的改动，单独 commit。
7. 每个决定保留的重要改动都同步更新本接手包。
8. 被废弃的实验如果有接手价值，应记录“为什么放弃”；纯噪声实验可以通过 revert/清理后不长期保留细节。
9. 不擅自 merge 到 `main`。
10. 不把 staging 数据库数据覆盖到 production。

## 11. 发布时如何使用这份接手包

这份文件不是公告原稿。

准备发布时，应使用三份事实来源：

1. `docs/STAGING_HANDOFF.md`
2. GitHub `main...staging` 实际 diff / commit history
3. 最终人工测试结果

然后另写一份面向用户的更新公告。

更新公告只挑用户真正能感知的变化，不需要写 staging、Supabase、测试 publisher、Vercel build 等内部施工细节。

## 12. 当前产品层事实摘要

本轮已经明确保留的用户可感知变化：

- Reader 首次语言选择和阅读模式选择，从“持续 hover 自动确认”调整为“hover 对应选项 + 向下滚动确认”。

当前 staging 已实现、等待用户人工确认后再决定是否按现状保留的变化：

- “继续读取 / 沉浸叙事 / 普通阅读”在 hover 时增加可操作反馈：文字轻微放大、双下划线、向下箭头，提示用户可以继续向下滚动。
- Landing 首次教学引导、NewTone 双手绘线、Landing / 首次 Start 共用前后景视差，以及稳定无视差的 Resume。
- 移动端 Language / Mode 使用 touch / Apple Pencil 先点选 armed、再向上 swipe 确认；移动端视差只使用 Device Orientation，并采用场景级自动归零与软校准。
- NewTone 双线只属于普通主 Landing；First Start、Reader 返回 Landing 和 Resume 均不显示双线。
- Language 的当前语言区域 hover 只显示持续双手绘线；Start 不显示方向箭头；移动端 armed 后可从页面空白区域上滑确认。

其余已完成工作主要是 staging / Supabase / Vercel 测试基础设施，不应自动视为对外更新公告内容。
