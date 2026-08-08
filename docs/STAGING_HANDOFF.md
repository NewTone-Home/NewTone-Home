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
- 第一版接手包建立时，最近一次包含产品代码变化的 Preview deployment：`dpl_2GtfTvQ4SP6HsUYskjMZ3Tcifkve`
- 对应产品代码 commit：`5dfef204e6e79aa59446a6f75ffe003f72bb4191`
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

接手包建立后，还会额外出现：

- `docs/STAGING_HANDOFF.md`：新增/持续修改

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

- [ ] 清理/禁用 `sync-reader-publication-once`
- [ ] 决定 `export-reader-publication` / `sync-reader-publication` 是否保留为长期内容 seed 方案
- [ ] 如果保留长期同步方案，把同步令牌迁移到 secret，不继续硬编码
- [ ] 检查 staging `http` extension 是否需要保留
- [ ] 运行 `npm test`，确认 `tests/ritualWheelAdvance.test.js`
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

截至本文件建立时，本轮用户可感知的产品变化只有一项已经明确决定保留：

- Reader 首次语言选择和阅读模式选择，从“持续 hover 自动确认”调整为“hover 对应选项 + 向下滚动确认”。

其余已完成工作主要是 staging / Supabase / Vercel 测试基础设施，不应自动视为对外更新公告内容。
