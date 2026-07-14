# NewTone Reader 第一阶段静态视觉施工计划

> 文档性质：施工前计划，不是施工授权  
> 计划对象：Reader 页面静态视觉骨架、基础交互与用户现场浏览器验收  
> 当前阶段：方案输出，等待用户与 ChatGPT 审核

## 1. 阶段目标

在不修改 Reader 功能逻辑、滚动容器、Reader ready、恢复逻辑、M1-M4 推进与 Center 解锁的前提下，完成 Reader 第一阶段静态视觉骨架，使整个 Reader 页面进入统一的手稿纸面视觉体系，并允许用户在电脑前直接进行实时视觉与交互验收。

本阶段边界：

- 以静态视觉为主。
- 可包含必要的基础 hover、focus、显隐与轻量反馈。
- 不做最终 Center 入口设计。
- 不做全局转场重构。
- 不做滚动系统重构。
- 不修改正文 `line-height`、`font-size` 或 M1-M4 内容顺序。
- 不自动进入下一阶段。
- 主观视觉与交互手感以用户现场确认为准；Codex 技术自检不能代替用户验收。

## 2. 源码核对结果与当前真实状态

### 2.1 Reader DOM 与功能链

当前 `src/views/Reader.jsx` 的结构顺序为：

1. `.reader-page` 页面外层。
2. `.reader` 600px 正文版心。
3. `.reader-top-actions`，包含返回 Landing，以及 `centerUnlocked` 后出现的 Center 入口。
4. `ReaderProgress`。
5. `currentReadingPhase` 存在时显示 `.reader-phase-tag`。
6. `readingBlocks.map(...)` 生成四个 `.reader-block`，保留 `ref`、`data-phase` 与 M1-M4 顺序。
7. `.reader-sentinel`，由 `sentinelRef` 观察。
8. `.reader-bottom-actions`，条件与顶部入口一致。

功能链已确认：

- 页面使用 `window` / `document` 滚动，没有 Reader 内部滚动容器。
- Reader 监听 `window.scroll`，把 `window.scrollY` 写入 `lastScrollY`。
- `IntersectionObserver` 根据可见 `.reader-block` 更新当前阶段。
- sentinel 进入视口时调用 `setPhase('M4')` 与 `completeM4()`，解锁 Center。
-恢复顺序为：优先 `lastScrollY`，否则 `lastReadPhase ?? maxReadPhase`，最后通知 Reader ready。
- 顶部与底部按钮继续调用既有 `transitionTo(...)`；计划不改变函数、条件或 preset。

### 2.2 页面级背景与 `.reader` 职责

请求文档与当前源码存在差异，必须以运行时核验后再施工：

- 请求文档描述：只有 600px `.reader` 为纸色，两侧露出旧深色 body。
- 当前源码实际为：`.reader-page` 已设置 `width: 100%`、`min-height: 100vh` 与纸张背景；`.reader` 已是 `max-width: 600px`、居中且 `background: transparent`。
- 当前代码层面已经表达“页面外壳负责纸张，600px 只负责版心”。因此阶段 A 不得盲目重复实现。
- 仓库未发现 `html`、`body`、`#root` 的全局背景/边距规则；真实页面是否仍露黑，需要在指定运行地址与当前构建中验证。
- `PageShell` 在部分转场中使用缩放和透明度，缩放期间可能暴露外层背景；不得据此直接修改 `PageShell`，应先区分“Reader 稳态背景问题”和“转场期间外层背景暴露”。
- `GlobalTransitionOverlay` 使用深色全屏遮罩，这是既有转场职责，不属于 Reader 静态背景。

### 2.3 视觉基础层依赖

- `src/styles/visualTokens.css` 定义纸张、墨色、琥珀色、描边和动画 Token，并提供 `.paper-surface`。
- `src/styles/sketchPrimitives.css` 定义线、箭头、圈线、glow、pulse、draw 与 reduced-motion 降级。
- 当前两份基础 CSS 由 `Landing.jsx` 静态导入，Reader 自身没有直接导入，但 Reader.css 已使用其中的变量。
- 这是一项需要记录的间接依赖。本轮优先不改基础层；若真实构建证明 Reader 独立加载时 Token 不可靠，必须先向用户申请批准，再决定是否在 `Reader.jsx` 增加纯视觉 CSS 导入。

### 2.4 ReaderProgress 与 phase tag

- `ReaderProgress.jsx` 监听 `window.scroll`，使用 `document.documentElement.scrollHeight`、`window.innerHeight` 和 `window.scrollY` 计算进度。
- `ReaderProgress` 当前为固定在右侧的垂直轨道，JSX 与计算逻辑不在本阶段修改范围。
- `.reader-phase-tag` 当前固定在右上角，显示 `currentReadingPhase`。
- 两者均可能在窄屏发生视觉接近或遮挡，阶段 D 只通过 CSS 检查与调整，不改变 DOM 或阶段计算。

### 2.5 安全修改范围

优先安全范围：

- `src/views/Reader.css`：页面外壳、版心、正文视觉、导航视觉、phase tag 和响应式样式。
- `src/components/ReaderProgress.css`：进度轨道的静态视觉、响应式位置与 reduced-motion。
- `src/views/Reader.jsx`：仅当 CSS 无法解决且用户明确批准时，增加最外层视觉 wrapper 或直接导入既有视觉 CSS；不得改任何功能节点、ref、observer、sentinel、按钮函数与条件。

## 3. 阶段 0：运行环境与源码基线核对

阶段 0 只核对实际运行环境，不修改代码、不生成截图、不进入阶段 A。

执行内容：

1. 确认并报告实际运行目录。
2. 确认并报告启动命令。
3. 确认并报告用户实际访问 URL。
4. 确认运行版本与当前源码是否一致，包括是否指向旧目录、旧构建或缓存版本。
5. 启动项目，由用户在现场浏览器中查看 Reader 稳态是否露黑。
6. 由用户现场执行 Reader→Landing、Reader→Center、Center→Reader，检查转场是否露底。
7. 检查是否存在浏览器缓存、Vite 旧服务、旧 build 或错误 URL。
8. 如存在 Git 仓库，记录当前 commit；当前目录现场检查未识别为 Git 仓库，因此不得伪造 commit 信息。

阶段 0 报告只包含：

- 实际运行目录。
- 启动命令。
- 访问 URL。
- 运行版本与源码是否一致。
- Reader 稳态是否露黑。
- 转场是否露底。
- 是否存在缓存或旧构建。

报告后立即停止，等待用户现场确认。阶段 0 不需要截图，也不得自动开始阶段 A。

## 4. 分阶段施工步骤

阶段 A-E 每次完成代码修改与技术检查后，都必须启动项目、报告访问 URL，并停下来等待用户在现场浏览器中直接查看和操作。只有用户明确说“通过”，才允许结束当前阶段并考虑下一阶段。

### 阶段 A：Reader 页面级纸张外壳

#### 目标

- 整个 Reader 稳态视口与完整文档高度呈现暖米白纸张背景。
- 600px `.reader` 只作为正文版心，不再承担页面底色。
- 两侧不露出旧深色背景。
- 不创建内部滚动容器。
- 不影响 Center、PageShell、GlobalTransitionOverlay。

#### 预计修改文件

- 首选：`src/views/Reader.css`。
- 条件项：`src/views/Reader.jsx`，仅在需要最小外层视觉 wrapper 或直接视觉 CSS 导入时修改，并需用户批准具体改法。
- 可能为零源码改动：若当前实现运行时已经满足目标，只记录验证结果。

#### 施工顺序

1. 完成运行时基线核验，确认问题发生在稳态、转场还是旧构建/错误 URL。
2. 若稳态确有背景问题，只调整 `.reader-page` / `.reader` 的视觉职责和必要尺寸约束。
3. 不设置 `height: 100vh` 与 `overflow`，保持 document scroll。
4. 不修改 `body`、`#root`、`PageShell`；若必须修改，立即停止并申请扩大范围。
5. 执行 build、lint、console 检查，启动项目并等待用户现场浏览器验收。

#### 用户现场浏览器验收

1. 在桌面端浏览器打开 Reader 顶部，并切换一个手机模拟视口复核。
2. 确认纸张横向铺满、600px 只表现为排版宽度、两侧无深色条。
3. 滚动到中段和底部，确认纸张覆盖完整文档高度。
4. 返回 Landing、再进入 Reader，确认稳态一致。
5. Center 已解锁时执行 Center→Reader，确认背景与恢复位置正常。

#### 验收条件与停止点

- 用户明确确认背景、版心与比例。
- document scroll、Reader ready、恢复位置和 Center 解锁行为不变。
- 代码修改、build、lint、console 检查与页面启动均已完成。
- 用户完成现场视觉与交互验收，并明确说“通过”。
- 若用户不通过，停留在 A；不得进入 B。
- 若需要改 `PageShell`、全局 body 或转场文件，停止并报告，不先改。

### 阶段 B：正文静态视觉

#### 目标

- 正文字色、层级、段落节奏进入统一纸面语言。
- 正文保持安静、清晰、适合长时间阅读。
- 手绘元素只用于轻微分隔与系统痕迹，不把正文变成手写体。
- 不使用卡片、面板或大幅装饰。

#### 预计修改文件

- `src/views/Reader.css`。
- 默认不修改 `Reader.jsx` 与 `src/data/novel.js`。

#### 硬性约束

- 不改 `.reader-paragraph` 的 `line-height: 2`。
- 不改 `.reader-paragraph` 的 `font-size: var(--font-size-base)`。
- 不改 `.reader` 的 `max-width: 600px`；如确有风险，先报告并获批。
- 不增加显著改变 `scrollHeight` 的大型装饰或额外内容。
- 不改变 `.reader-block` 的 DOM、顺序、ref 或 `data-phase`。

#### 用户现场浏览器验收

1. 从顶部连续滚动到 M2/M3，再到 M4。
2. 检查字色、阅读密度、留白、段落节奏和分段痕迹。
3. 对比桌面端与手机模拟视口。
4. 确认视觉不呈现普通博客、电子书、卡片墙、后台面板、儿童手账或便签墙风格。

#### 验收条件与停止点

- 用户完成并确认顶部、中段、底部的阅读体验。
- `scrollHeight` 变化若超出纯 CSS 细微波动，必须解释原因并重新验证恢复与阶段识别。
- build、lint、console 检查完成，页面已启动。
- 用户完成现场视觉与交互验收，并明确说“通过”。
- 用户明确说“通过”后才进入 C；否则停留在 B。

### 阶段 C：顶部/底部导航静态视觉与基础交互

#### 目标

- 返回 Landing 与进入 Center 的入口呈现纸面文字入口语言。
- 保留顶部和底部两组入口、原 DOM、函数、条件与转场 preset。
- 可加入基础 hover、focus-visible、按下反馈和条件显现。
- 动画不改变布局，不造成跳位。

#### 预计修改文件

- `src/views/Reader.css`。
- 默认不修改 `src/views/Reader.jsx`。

#### 用户现场浏览器验收

1. Center 未解锁：顶部与底部只显示返回入口。
2. Center 已解锁：顶部与底部都显示 Center 入口。
3. 分别检查鼠标 hover、键盘 Tab/focus-visible、鼠标点击与键盘激活。
4. 观察 hover、focus、显现和点击时是否发生布局跳位。
5. 验证顶部和底部返回 Landing；验证进入 Center 及 Center→Reader。
6. 在 reduced motion 下确认显现不依赖动画且入口仍可辨识。

#### 验收条件与停止点

- 所有入口保持可见条件与路由行为不变。
- 用户完成并确认文字入口的视觉与手感。
- build、lint、console 检查完成，页面已启动。
- 用户完成现场视觉与交互验收，并明确说“通过”。
- 任一路径、焦点或布局跳位不通过时停留在 C。
- 用户明确说“通过”后才进入 D。

### 阶段 D：ReaderProgress 与 phase tag

#### 目标

- 将进度轨道与阶段标签调整为手稿刻度 / 纸边标记风格。
- 保留 fixed 定位性质与现有 JSX。
- 不修改进度计算、阶段逻辑或 DOM。
- 轻量动画不得改变布局。

#### 预计修改文件

- `src/components/ReaderProgress.css`。
- `src/views/Reader.css`（仅 `.reader-phase-tag` 及相关响应式样式）。
- 不修改 `src/components/ReaderProgress.jsx`。

#### 用户现场浏览器验收

1. 从 M1 连续滚动至 M4，观察进度填充是否连续且阶段标签正确变化。
2. 检查桌面端与手机模拟视口下的右侧位置。
3. 检查进度条与 phase tag 是否互相重叠、遮挡正文或超出 safe area。
4. 检查快速滚动、到顶、到底、refresh 恢复和 History 返回后的进度显示。
5. 在 reduced motion 下确认没有依赖过渡才能理解的状态。

#### 验收条件与停止点

- M1-M4 标签、进度和实际滚动位置一致。
- fixed 元素不遮挡正文、导航或移动端点击区域。
- build、lint、console 检查完成，页面已启动。
- 用户完成现场视觉与交互验收，并明确说“通过”。
- 用户明确说“通过”后才进入 E；否则停留在 D。

### 阶段 E：桌面、手机与交互回归

#### 目标

只做完整回归与现场验收报告，不自动扩大视觉设计。

#### 预计修改文件

- 默认不修改源码。
- 仅允许一次针对客观问题的修复，且只能修改该问题所属的已批准文件。
- 主观问题不自动反复调整，等待用户明确意见。

#### 回归项目

- 视口：桌面端与手机模拟视口。
- 位置：Reader 顶部、中段、底部。
- 阶段：M1、M2/M3、M4。
- 状态：Center 未解锁、Center 已解锁。
- 布局：横向溢出、safe area、正文宽度、fixed 遮挡。
- 交互：hover、focus、点击、滚动、返回路径。
- 状态恢复：refresh、History 前进后退、Center→Reader。
- 辅助偏好：reduced motion。

#### 验收条件与停止点

- 代码修改完成（本阶段默认无源码修改）。
- build、lint、console 与指定回归项目完成。
- 页面已启动。
- 用户完成现场视觉与交互验收。
- 用户明确说“通过”。
- 现场验收报告完成。
- 阶段 E 完成后立即停止，等待用户决定是否冻结；不得自动开始新阶段。

## 5. 允许修改的文件（按阶段）

| 阶段 | 默认允许文件 | 条件与限制 |
|---|---|---|
| A | `src/views/Reader.css` | 仅页面纸张外壳与版心职责；当前运行已符合时允许零改动 |
| A（条件） | `src/views/Reader.jsx` | 仅最外层视觉 wrapper 或直接视觉 CSS 导入；需用户批准，不触碰功能节点 |
| B | `src/views/Reader.css` | 不改正文字号、行高、max-width、DOM 高度结构 |
| C | `src/views/Reader.css` | 保留按钮 DOM、函数、条件与 preset |
| D | `src/components/ReaderProgress.css`、`src/views/Reader.css` | 只改外观与响应式位置，不改 JSX/计算 |
| E | 默认无 | 仅可修复一次明确客观问题，并限于已批准文件 |

任何未在表中列出的文件都视为“需要用户批准”，施工前不得擅自修改。

## 6. 禁止修改的文件与内容

禁止修改：

- `src/App.jsx`
- `src/stores/progressStore.js`
- `src/stores/transitionStore.js`
- `src/transitions/readingEntryController.js`
- `src/transitions/readerReadyGate.js`
- `src/transitions/transitionDefinitions.js`
- `src/transitions/transitionUtils.js`
- `src/components/PageShell.jsx`
- `src/components/PageShell.css`
- `src/components/GlobalTransitionOverlay.jsx`
- `src/components/GlobalTransitionOverlay.css`
- `src/components/ReadingTransition.jsx`
- `src/components/ReadingTransition.css`
- `src/views/Landing.jsx`
- `src/views/Landing.css`
- `src/views/Center.jsx`
- `src/views/Center.css`
- `src/data/novel.js`

禁止改变：

- document 滚动容器。
- 正文 `line-height` 与 `font-size`。
- M1-M4 DOM 顺序。
- reader-block ref、`data-phase`、observer。
- sentinel 与 M4 解锁逻辑。
- Reader ready 三分支。
- `lastScrollY > lastReadPhase > maxReadPhase` 的恢复优先关系。
- 顶部/底部入口的函数、条件和数量。
- ReaderProgress 计算与 JSX。

## 7. 静态视觉目标

- 整个 Reader 页面呈暖米白纸张，不是深色页面中的白色长面板。
- 600px 正文版心安静、清晰、可长时间阅读。
- 不呈现普通博客或通用电子书模板感。
- 不依赖大幅插画或重美术资产。
- 主要使用 CSS、现有视觉 Token 与少量既有 SVG primitive。
- 不做卡片墙、档案后台、SaaS 面板、儿童手账、胶带墙或便签墙。
- 手绘只承担引导、分隔、标记与系统痕迹。
- 阅读体验优先于装饰密度。

## 8. 实时验收流程

### 8.1 三层验收

1. **Codex 技术自检**：build、lint、console、overflow、背景铺满、fixed 遮挡、document scroll、Reader ready、scroll restore、M1-M4、M4 解锁、Reader/Landing/Center 路径、refresh、History。
2. **用户现场视觉验收**：页面比例、纸张、版心、留白、字色、导航、进度、阶段标记、旧主题残留，以及是否出现记录风、后台风或卡片风。
3. **用户现场交互验收**：hover、focus、点击、跳位、动画节奏、fixed 遮挡、滚动、路径、Center 解锁前后、reduced motion。

### 8.2 现场操作顺序

1. 用户确认实际运行 URL 与当前构建。
2. Codex 报告当前阶段改动与技术自检结果。
3. 启动项目，保持页面可访问，等待用户直接查看和操作。
4. 用户现场检查页面比例、背景与版心、正文阅读效果。
5. 用户滚动检查顶部、M2/M3 中段与 M4 底部，确认 M1-M4 推进与 Center 解锁。
6. 用户操作 hover、Tab focus、点击反馈、滚动、Reader/Landing/Center 往返、refresh 和 History。
7. 用户分别使用桌面端和手机模拟视口检查布局、溢出、safe area、fixed 遮挡与点击区域。
8. 用户开启 reduced motion，再检查关键显现、反馈与导航。
9. 用户明确给出“通过 / 有小问题 / 不通过”。未明确说“通过”时，不写正式日志、不提交稳定 commit、不进入下一阶段。

### 8.3 可选截图

截图不是阶段验收或停止条件，不规定尺寸、数量或文件名。只在以下情况生成：

- 用户主动要求。
- 需要记录具体视觉 bug。
- 需要提交给 ChatGPT 远程复核。
- 需要保留正式阶段日志证据。

无上述需要时，所有视觉和交互判断均由用户在现场浏览器中直接完成。

## 9. 每阶段技术检查、启动与停止报告

### 技术检查顺序

1. `npm.cmd run lint`
2. `npm.cmd run build`
3. 本地页面 console 检查
4. 启动项目并报告实际访问 URL
5. 用户使用桌面端和手机模拟视口进行真实操作

若构建或浏览器环境与用户实际运行环境不一致，先对齐实际 URL、文件副本和缓存状态，不用猜测继续改 CSS。

### 每阶段统一停止条件

必须同时满足：

- 代码修改完成。
- build、lint、console 检查完成。
- 页面已启动。
- 用户完成现场视觉验收。
- 用户完成现场交互验收。
- 用户明确说“通过”。

用户未明确说“通过”时，停留在当前阶段：不写正式日志、不提交稳定 commit、不更新完成状态、不进入下一阶段。

### 阶段停止报告必须包含

1. 阶段目标是否完成。
2. 实际修改文件。
3. 是否越界。
4. 技术自检结果。
5. 用户现场视觉验收结果。
6. 用户现场交互验收结果。
7. 项目是否已启动及访问 URL。
8. 已知问题。
9. 未完成内容。
10. 用户是否已明确说“通过”。
11. 等待用户是否批准冻结阶段。

## 10. 日志与 Git 时机

- 计划阶段不写正式日志。
- 施工中不写正式日志。
- 用户未明确验收通过，不写正式日志、不更新完成状态。
- 失败或实验版本不进入正式阶段日志。
- 施工前仅记录可用的当前 commit；若目录不是 Git 仓库，明确记录“无可用 commit”，不初始化仓库。
- 施工中不创建正式稳定 commit，不合并未验收版本。
- 用户明确说“通过”后，才允许创建正式阶段 commit。
- commit 后更新 `CURRENT_STATE.md`；当前仓库没有该文件，如届时仍不存在，必须先请用户确认是创建还是使用其他状态文件。
- 状态确认后再按 `AI工程阶段日志格式.md` 写正式日志。
- 然后才允许生成下一阶段任务；不得自动开工。

## 11. 自动修正权限

每阶段最多：

- 一次施工。
- 一次自动技术自检。
- 一次客观问题修复。

允许自动修复的客观问题：

- 编译错误。
- console 报错。
- 横向溢出。
- 元素遮挡。
- 背景未铺满。
- 指定状态缺失。
- 明确要求未实现。

不得自动反复修改的主观问题：

- 不够高级或不够好看。
- 氛围、手绘感、冲击力不足。
- 留白或字体感觉不对。
- hover 手感或动画节奏不舒服。

主观问题由用户指出具体感受后，再形成单一变量修正方案。

## 12. 风险清单与控制措施

| 风险 | 触发方式 | 控制措施 |
|---|---|---|
| `scrollHeight` 改变 | 大型装饰、额外 wrapper 边距、字体/行高变化 | 不改字号行高，不加大型流内装饰；每阶段对比顶部/中段/底部与恢复位置 |
| `lastScrollY` 恢复偏移 | 文档高度或块位置显著变化 | 保持 DOM 和内容不变；refresh、Landing→Reader、Center→Reader 分别验证 |
| fixed 元素遮挡 | ReaderProgress、phase tag 在窄屏接近正文或导航 | 用户在桌面端与手机模拟视口逐一检查，CSS 调整只改变视觉位置 |
| `PageShell` 露底 | 转场缩放暴露外层背景 | 区分稳态与转场问题；不在 Reader 阶段修改 PageShell，发现即停报 |
| `GlobalTransitionOverlay` 误判 | 深色全屏遮罩被误认为 Reader 背景回归 | 用户现场分别观察 idle、leaving、covered、entering；不改 overlay |
| 移动端横向溢出 | fixed 位置、宽度、装饰超出视口 | 在手机模拟视口检查 scrollWidth、safe area、点击区与固定元素 |
| body 背景/默认边距 | 仓库缺少明确 `body/#root` 全局规则 | 先运行验证；若需全局修改，停止并申请范围批准 |
| Reader wrapper 重复 | 误以为外壳不存在而再加一层 | 当前已有 `.reader-page`；优先零结构改动，新增 wrapper 必须证明必要性 |
| Center 背景隔离 | 为修 Reader 全局设纸色，污染 Center | 不改全局 body、PageShell 或 Center；只在 Reader 自身范围处理 |
| Token 间接导入 | Reader 依赖 Landing 导入视觉 CSS | 记录依赖；只有真实构建出现问题才申请直接导入，不改 Token 定义 |
| M1-M4 识别变化 | 改 block 尺寸、DOM 或 observer | 不改 DOM/ref/observer；每阶段滚动验证 M1-M4 |
| M4 解锁回归 | sentinel 位移、遮挡或删除 | sentinel 完全不改；验证解锁前后入口和 Center 路径 |

## 13. 推荐施工顺序总表

| 顺序 | 阶段 | 主要目标 | 预计修改文件 | 用户明确说“通过”后动作 |
|---:|---|---|---|---|
| 0 | 基线 | 对齐实际 URL、构建与当前源码，确认描述差异 | 无 | 用户另行批准后才进入 A |
| 1 | A | 页面级纸张外壳与 600px 版心职责 | `Reader.css`；条件性 `Reader.jsx` | 明确通过后才进入 B |
| 2 | B | 正文静态视觉与阅读节奏 | `Reader.css` | 明确通过后才进入 C |
| 3 | C | 顶部/底部导航视觉与基础交互 | `Reader.css` | 明确通过后才进入 D |
| 4 | D | ReaderProgress 与 phase tag | `ReaderProgress.css`、`Reader.css` | 明确通过后才进入 E |
| 5 | E | 桌面、手机与交互回归、现场验收报告 | 默认无 | 用户明确通过后停止，等待冻结决定 |

任何阶段未通过，都停留在当前阶段；发现范围外修改需求、源码与运行不一致、同一方案失败两次、或可能破坏稳定功能时，立即停止并报告。

## 14. 临时阶段状态（未冻结、非正式日志）

更新时间：2026-07-12（America/Vancouver）

- 阶段 0：用户已完成现场确认。
- 运行环境：当前开发服务器与 `E:\小说\NewTone-V0.1` 实时源码一致。
- Reader 稳态：页面级纸张外壳正确，正文版心与页面背景职责符合阶段 A 目标。
- 阶段 A：按零源码改动通过；没有为制造改动而修改 `Reader.css` 或 `Reader.jsx`。
- 实际源码修改：`src/views/Reader.css` 已完成 B1 字体所有权声明与 B2 段落 margin 规范化。
- 后续全局转场阶段问题：转场缩放时，页面边缘会暴露深色外层背景。
- 当前处理边界：不修改 `PageShell`、`GlobalTransitionOverlay`、`body` 或 Reader；该问题留待后续单独的全局转场阶段处理。
- 正式日志：未写入。
- 稳定 commit：未创建。
- 阶段 B：B1/B2 已通过技术闸门、回归归因核验与用户验收；允许另行进入 B3，B3 本轮未执行。
- 合理恢复路径基线：Reader 位于 M4 底部并使用底部入口时，Center→Reader 返回 `M4 / lastScrollY 2695 / window.scrollY 2695`；Landing→Reader 返回 `M4 / lastScrollY 2467 / window.scrollY 2467`，仍处于原 M4 阅读区段。
- 自动化验收注意：自动化点击屏外顶部入口会先滚动页面并改写阅读进度，不应用于验证底部阅读位置恢复。

当前 B1/B2 已正式结束验收；未写正式日志、未创建稳定 commit、未执行 B3。后续只在独立授权下进入 B3。
