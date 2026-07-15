# NewTone-V0.1 工作日志（4）完整接手版  
## B 方向入口体系 / 全局转场配置化 / ReadingEntry 重构 / 刷新与 History 修复 / B 阶段功能封口

生成时间戳：2026-07-11 16:52:52 PDT（America/Vancouver 本地时间）  
项目：NewTone-V0.1  
文档定位：替代此前《工作日志_NewTone_v0.1（4）》及其追加稿，作为后续唯一接手文档  
当前阶段：B 阶段功能封口，准备进入整体视觉设计与视觉资产阶段  
本轮主要涉及：`Landing.jsx / Landing.css / Reader.jsx / Reader.css / Center.jsx / Center.css / App.jsx / progressStore.js / transitionDefinitions.js / transitionStore.js / transitionUtils.js / readerReadyGate.js / readingEntryController.js / GlobalTransitionOverlay.jsx / GlobalTransitionOverlay.css / PageShell.jsx / PageShell.css / ReadingTransition.jsx / ReadingTransition.css / LanguageInit.jsx / copy.js`

---

## 1. 上次日志总结

### 1.1 项目在进入本轮前的基础状态

在本轮开始前，A 方向“首次语言初始化层”已经完成第一版闭环。

当时已经成立的核心语义包括：

- 首次进入 Reader 前，需要经过 ReadingTransition 与 LanguageInit；
- 是否进入 LanguageInit 由 `hasInitializedLanguage` 判断；
- 已完成初始化的用户再次进入时，不重复选择语言；
- 当前语言不出现在候选阵列中；
- 切换语言只交换当前语言与被点击 slot，不重排全部候选；
- 桌面端以 hover 展开语言候选，touch 端才使用 tap toggle；
- hover 只能发亮或展开，click / tap 才能真正切换语言；
- 点击 NewTone 只负责唤醒标题、提示和反馈，不直接进入 Reader；
- 真正进入 Reader 的动作仍是向下滚动或对应触摸手势。

阅读恢复语义已经固定：

```text
lastScrollY > lastReadPhase > maxReadPhase
```

其中：

- `lastScrollY`：真实滚动位置，继续阅读时优先恢复；
- `lastReadPhase`：粗粒度 fallback；
- `maxReadPhase`：历史最高解锁阶段，只表示进度，不是书签。

### 1.2 B 方向的形成

B 方向后来被拆成：

#### B1：Reader 内首次中枢入口

用户读到 M4 后：

```text
completeM4()
→ centerUnlocked = true
→ Reader 中出现 Center 入口
```

它负责“第一次发现中枢”。

#### B2：Landing 上的中枢回访入口

用户已经解锁 Center 后，返回 Landing：

```text
向上滚动 → Center
向下滚动 → Reader
```

它负责“系统记得中枢已经被打开，因此允许再次进入”。

### 1.3 B2 的最终入口语义

Landing 没有被改造成普通导航菜单，而是形成上下空间关系。

未解锁：

```text
NewTone
↓
向下滚动 · 开始读取 / 继续读取
```

已解锁：

```text
向上滚动 · 进入中枢
↑
NewTone
↓
向下滚动 · 继续读取
```

最终规则：

- 向上：进入 Center；
- 向下：进入 Reader；
- NewTone：中间互动锚点；
- 点击 NewTone：不直接跳转；
- NewTone 解锁后由冷灰蓝切换为克制暖琥珀 / 暗金灰；
- 不使用常驻“进入中枢”普通小字按钮；
- 不把 Landing 变成 Reader / Center 并列菜单页。

### 1.4 B2 视觉试错与止损

曾尝试：

- 烟丝；
- 余烬；
- 热点；
- 流光；
- 扫描线；
- 双影；
- 中枢环；
- 粒子；
- glitch；
- 发热字标。

最终确认：在没有正式 SVG、mask 和路径资产的情况下，这些效果容易变成 CSS 装饰堆叠，既抢占提示空间，也无法真正沿字标笔画生长。

因此第一版只保留：

- NewTone 暖色解锁态；
- 很轻的 glow；
- 上下方向提示。

烟、火、流光等不是永久禁止，但必须等待正式视觉资产阶段再评估。

### 1.5 Global Transition 第一版

B2 完成后发现 Landing、Reader、Center 之间存在大量硬切，因此建立普通页面转场系统。

普通路径包括：

- Landing → Center
- Reader → Center
- Reader → Landing
- Center → Landing
- Center → Reader
- `fade-cover` fallback

公共调度：

```text
idle
→ leaving
→ covered
→ entering
→ idle
```

核心原则：

**统一调度，不统一视觉。**

普通路径可以共用：

- `transitionTo(targetView, options)`
- `transitionStore`
- covered 阶段切换真实 view
- 重复触发保护
- GlobalTransitionOverlay
- PageShell

但每条路径拥有自己的：

- preset；
- timing；
- leaving / entering keyframe；
- label；
- 路径语义。

### 1.6 上一份日志中已经暴露但尚未解决的问题

此前已经明确：

- Landing → Reader 仍是独立流程；
- LanguageInit、Reader ready、最短展示时间和淡出仍耦合；
- Landing 到 LanguageInit 存在硬切；
- LanguageInit 完成后衔接偏硬；
- Reader 正文出现偏快；
- 刷新和浏览器历史仍可能与 UI 状态错位；
- B1 的入口虽存在，但最终位置和首次发现提示尚未设计。

上一份日志因此把 Landing → Reader、刷新、History 和入口最终视觉留给下一轮。


### 1.7 上一轮普通转场的具体视觉基线

上一轮不是只建立了抽象 preset，而是已经完成五条路径的具体视觉验收。后续如果视觉表现突然变化，应优先与以下基线对照。

| 路径 | 语义 | leaving | coveredHold | entering | 页面离场特征 |
|---|---|---:|---:|---:|---|
| Landing → Center | 从入口进入中枢 | 300ms | 450ms | 420ms | 轻微缩小、变暗 |
| Reader → Center | 当前文章被重收起并纳入中枢 | 420ms | 400ms | 400ms | opacity `1→0.62`，scale `1→0.94` |
| Reader → Landing | 轻收起并退出阅读层 | 380ms | 340ms | 400ms | opacity `1→0.72`，scale `1→0.96` |
| Center → Landing | 离开系统核心，返回入口 | 280ms | 450ms | 460ms | 轻微 opacity 离场，不做明显 scale |
| Center → Reader | 回到原阅读现场 | 260ms | 380ms | 420ms | 轻微 opacity 离场 |

其中：

- Reader → Center 的 Overlay cover 为 280ms；
- Reader → Landing 的 Overlay cover 为 240ms；
- 两条 Reader 路径的 Overlay 都比 PageShell leaving 提前 140ms 盖满；
- 这是已验收体感的一部分，不应被误判为 timing bug；
- Reader 顶部和底部入口调用相同，但因视口内容密度不同，体感仍需分别验收。


---

## 2. 本次完成

### 2.1 普通页面转场配置集中化

此前同一条路径的配置散落在：

- `transitionStore.js`
- `GlobalTransitionOverlay.jsx`
- `GlobalTransitionOverlay.css`
- `PageShell.jsx`
- `PageShell.css`

一条路径的 timing、label、overlay 时长和页面动画需要跨多个文件查找。

本轮新建：

```text
src/transitions/transitionDefinitions.js
```

作为唯一配置源，集中定义：

- `surface-to-core`
- `reader-to-core`
- `reader-to-surface`
- `core-to-surface`
- `core-to-reader`
- `fade-cover`

每条路径包含：

- `targetView`
- `label`
- `timings.leaving`
- `timings.overlayCover`
- `timings.coveredHold`
- `timings.entering`
- `scene`

新的调用关系：

```text
transitionDefinitions.js
        ↓
transitionStore.js
        ↓
GlobalTransitionOverlay.jsx / PageShell.jsx
        ↓
CSS variables
```

`transitionStore.js` 不再维护独立 timing map。

GlobalTransitionOverlay 不再维护独立 preset Set 和 label map。

PageShell 与 Overlay 通过 CSS variables 使用同一个定义来源。

### 2.2 保留并显式记录 Reader 路径的时间差

确认以下差异属于现有效果的一部分，而不是 bug：

```text
reader-to-core
Page leaving：420ms
Overlay cover：280ms
```

```text
reader-to-surface
Page leaving：380ms
Overlay cover：240ms
```

Overlay 会比页面离场提前 140ms 完全覆盖。

以前差异隐藏在 CSS 中，现在正式写进 `transitionDefinitions.js` 的 `overlayCover`。

因此以后不会再误以为 Store 和 CSS“无故不一致”。

### 2.3 普通页面 timer 清理

普通转场现在拥有统一 timer registry：

- 所有 timeout ID 被保存；
- 新转场开始前清理旧 timer；
- `reset()` 清理 timer 并恢复 idle；
- timer 回调继续保留 phase guard；
- 非 idle 阶段继续禁止重复触发。

普通页面转场已完成：

- build；
- lint；
- 五条路径视觉回归；
- 快速重复触发检查；
- phase 回到 idle；
- fallback 保留；
- 路径隔离验证。

该部分正式封口。

### 2.4 Landing → Reader 独立控制器

Landing → Reader 没有强行并入普通 `transitionTo()`。

本轮新建：

```text
src/transitions/readingEntryController.js
```

并以 `useReadingEntry` 替换 App 中多个松散 boolean。

当前专用 phase：

```text
idle
landing-leaving
landing-empty-hold
language-active
language-leaving
reader-preparing
transition-leaving
idle
```

职责如下：

- `landing-leaving`：Landing 自己离场；
- `landing-empty-hold`：首次初始化空场；
- `language-active`：LanguageInit 可交互；
- `language-leaving`：LanguageInit 独立离场，按钮禁用；
- `reader-preparing`：Reader 挂载并恢复位置；
- `transition-leaving`：ReadingTransition 淡出，Reader 显现。

### 2.5 修复首次初始化被 Reader ready 提前截断

本轮出现并修复了第一个真正意义上的程序状态 bug。

错误表现：

- reset 后首次进入；
- “文本层已接入：当前语言”刚开始播放；
- 用户没有点击继续；
- 页面自动进入 Reader；
- 返回 Landing 后再次进入，LanguageInit 又重复出现。

根因：

`start()` 在判断 `hasInitializedLanguage` 前先执行：

```text
startReading()
或
continueReading()
```

导致：

```text
phase = language-active
currentView = reader
```

Reader 在 LanguageInit 背后提前挂载，并触发 ready。

旧 ready 流程随后启动 minimum duration 和离场，强行截断 LanguageInit。

修正后的首次流程：

```text
Landing
→ landing-leaving
→ landing-empty-hold
→ language-active
→ 用户主动点击继续
→ language-leaving
→ setInitializedLanguage()
→ currentView = reader
→ reader-preparing
→ Reader ready
→ transition-leaving
→ Reader
```

Reader 在以下阶段不允许挂载：

```text
landing-leaving
landing-empty-hold
language-active
language-leaving
```

`handleReaderReady()` 只允许在：

```text
phase === reader-preparing
```

时推进。

同时保留 call guard，避免 Strict Mode、重复 effect 或迟到回调再次触发。

### 2.6 LanguageInit 独立离场

点击“继续读取”后不再立即改变条件并瞬间卸载 LanguageInit。

当前流程：

```text
language-active
→ 点击继续
→ 禁止重复操作
→ language-leaving
→ opacity 淡出
→ pointer-events: none
→ button disabled
→ 离场完成
→ setInitializedLanguage()
→ reader-preparing
```

保持不变：

- 标题 scramble；
- 语言候选；
- hover；
- touch；
- slot 交换；
- 当前语言不出现在候选中；
- click / tap 才切换语言。

### 2.7 Landing → Reader 节奏调整

普通页面转场大多约 1060–1220ms。

此前 ReadingTransition 只有：

```text
MIN_READER_MS = 650ms
fade = 240ms
```

且没有 Landing 离场，因此体感偏快。

本轮调整为：

#### 首次用户

```text
Landing 较慢熄灭
→ 空场
→ LanguageInit 环境先出现
→ 标题延迟
→ 用户确认语言
→ “开始读取”完整站稳
→ ReadingTransition 平滑淡出
→ Reader
```

#### 已初始化用户

```text
Landing 较短离场
→ “回读中”站稳
→ Reader 恢复位置
→ 平滑淡出
→ Reader
```

首次与后续回读不再使用完全相同节奏。

“文本层已接入：当前语言”不再在 LanguageInit 挂载时立即抢出，而是：

```text
Landing fully gone
→ empty hold
→ LanguageInit environment mounted
→ title reveal delay
→ title scramble
```

当前仪式感已通过用户确认。

### 2.8 Center 内部切换

Center 内部：

- home → records
- home → perspectives
- home → fragments
- 内容页 → home

不接入全局转场。

当前使用局部轻量淡入：

```text
centerMode 变化
→ 内容区重新挂载
→ 250ms 左右 fade-in
```

导航栏保持稳定。

返回文案从错误的“返回 Landing”语义修正为“返回首页 / 返回主页”。

Center 内部切换已经通过验收，不再继续调整。

### 2.9 M4 中枢入口基础显影

M4 到达后：

```text
completeM4()
→ centerUnlocked = true
→ Reader 中 Center 入口挂载
```

当前只提供轻量 reveal 占位，避免入口突然出现。

功能上已成立：

- Reader 中存在入口；
- Landing 回访入口出现；
- 刷新持久化；
- reset 清空。

但尚未决定：

- 入口最终停在哪里；
- 是正文流元素还是系统层元素；
- 首次如何提示；
- 是否只提示当前视口中的入口；
- 顶部与底部入口是否都保留。

这些转入视觉阶段。

### 2.10 刷新恢复当前稳定页面

此前任何页面刷新都会回 Landing。

根因：

- `currentView` 没有持久化；
- App 初始化 history 写死 Landing。

当前改为：

- 持久化稳定 `currentView`；
- 只允许 `landing / reader / center`；
- 非法值回 Landing；
- 保存为 Center 但未解锁时回 Landing；
- 不持久化 transition phase；
- 初始化 history 使用恢复后的真实页面；
- Reader 刷新时继续恢复阅读位置。

当前行为：

```text
Landing 刷新 → Landing
Reader 刷新 → Reader + 恢复位置
Center 刷新 → Center
未解锁的异常 Center 状态 → Landing
```

### 2.11 LanguageInit 阶段侧键保护

旧 popstate 流程会：

```text
cancel active reading entry
→ 根据旧 history state 切 view
```

因此在 LanguageInit 中按侧键，可能直接跳进旧 Reader，并重新触发首次初始化异常。

当前策略：

在以下阶段禁用浏览器后退：

```text
landing-empty-hold
language-active
language-leaving
```

锁定期间：

- 不 cancel；
- 不 setViewFromHistory；
- 不 reset 全局转场；
- 不挂载 Reader；
- 不改变 `hasInitializedLanguage`；
- 恢复 history 指针；
- 使用一次性 ref 防止 popstate 循环。

完成初始化后，浏览器返回 / 前进恢复正常。

### 2.12 B 阶段功能封口

B 阶段当前完成的是：

- 中枢可解锁；
- Reader 中有功能入口；
- Landing 中有回访入口；
- Center 可进入、返回；
- 路径转场成立；
- 状态可持久化；
- 刷新不丢页面；
- History 不绕过首次初始化；
- reset 可清空状态。

B 阶段不再负责：

- Reader 中入口最终位置；
- 入口首次发现提示；
- Reader 内容版式；
- Center 最终视觉；
- 视觉资产。

这些进入下一阶段。


### 2.13 本轮验收与构建状态

本轮不是只完成代码修改，也经过多轮用户侧回归。

已确认通过：

- 五条普通页面转场视觉回归；
- 普通路径配置隔离；
- 快速重复触发保护；
- phase 最终回到 idle；
- `fade-cover` fallback 保留；
- reset 后首次 LanguageInit；
- LanguageInit 不会自动跳 Reader；
- LanguageInit 独立离场；
- 已初始化用户直接进入“回读中”；
- Reader ready 快速与较慢两种情况；
- Landing / Reader / Center 刷新保持当前稳定页面；
- Reader 刷新恢复阅读位置；
- LanguageInit 阶段侧键阻挡；
- 完成初始化后浏览器前进 / 后退恢复；
- Center 内部 home / records / perspectives / fragments 切换；
- M4 解锁、持久化与 reset 清空。

最近施工回报：

```text
npm run build：通过
npm run lint：0 errors
1 个既有 warning 位于 progressStore.js
```

注意：

- 以上验收主要为桌面端；
- 移动端尚未完成集中回归；
- “通过”只代表当前代码基线，未来若改动 App、History、Reader mount 或 transition phase，必须重新做组合验收。


---

## 3. 本轮发现的问题

### 3.1 共用代码不是问题，配置散落才是问题

不需要每条路径复制完整状态机。

真正危险的是同一路径的定义散落在 Store、JSX 和 CSS。

最佳结构：

```text
公共引擎
+ 单一路径配置
+ 特殊流程独立 controller
```

### 3.2 组件拆开不代表流程拆开

Landing、LanguageInit、ReadingTransition、Reader 虽然是不同组件，但只要：

- view 切换；
- phase；
- timer；
- callback；
- mount 条件；

仍互相越权，流程就仍然耦合。

以后判断“是否独立”必须看状态职责，而不是文件数量。

### 3.3 Reader ready 是高风险异步入口

Reader 可以从：

- Landing；
- Center；
- history；
- refresh；

进入。

ready 必须拥有：

- phase guard；
- call guard；
- cancel 后失效；
- timer cleanup；
- 正确挂载条件。

### 3.4 History 是正式导航入口

浏览器前进 / 后退不是附属功能。

它会改变：

- history 指针；
- currentView；
- active transition；
- Reader 挂载；
- 首次初始化状态。

以后任何新页面流都必须同时验收按钮导航和 history 导航。

### 3.5 首次启动与后续回读需要不同节奏

首次初始化承担“系统建立”的仪式。

后续回读承担“重新接入”的效率。

两者如果共用完全相同的时长，必然一边仓促、一边拖沓。

### 3.6 功能入口出现不等于用户发现入口

B1 功能完成，但视觉发现机制尚未完成。

入口位置、显影和提示必须依赖 Reader 正式视觉骨架，不能在空白布局中提前钉死。

### 3.7 旧日志中的部分“已通过”结论后来被新 bug 推翻

旧日志曾认为刷新、返回和首次初始化已经基本稳定。

本轮实际发现：

- refresh 总回 Landing；
- LanguageInit 侧键可以跳 Reader；
- Reader ready 可以提前截断初始化。

因此后续日志必须明确：

**验收结论只在当时范围内有效；新路径和新重构出现后，需要重新做组合回归。**


### 3.8 本轮错误的完整演化链

为了防止后续只记住最终修复、忘记错误如何形成，本轮关键错误链如下。

#### 错误一：`fade-cover` 合法但不渲染

旧 preset map 中存在：

```js
'fade-cover': null
```

解析逻辑使用 falsy 判断，把合法 preset 当成不存在。

解决方式：

- 不再用 value truthiness 判断合法性；
- 后续进一步改为由 `transitionDefinitions.js` 本身推导合法路径。

#### 错误二：Overlay 只是“黑一下”

旧页面本体没有参与 leaving / entering，Overlay 只遮住硬切。

解决方式：

- 引入 PageShell；
- 页面离场与 Overlay 遮盖分工；
- covered 阶段才切换 view；
- 不再把路径差异理解为仅换背景色。

#### 错误三：首次初始化被 Reader ready 截断

`start()` 先切 Reader view，再判断是否需要 LanguageInit，导致 Reader 在背后提前挂载。

解决方式：

- 首次用户先停在 LanguageInit；
- 语言确认完成后才切 Reader view；
- Reader mount 条件按 phase 收紧；
- ready 增加 phase guard 与 call guard。

#### 错误四：刷新总回 Landing

`currentView` 没有持久化，App 初始化 history 又写死 Landing。

解决方式：

- 只持久化稳定 currentView；
- 初始化 history 使用恢复后的真实页面；
- 非法 Center 状态回退 Landing；
- Reader 刷新继续恢复位置。

#### 错误五：LanguageInit 中侧键跳入旧 Reader

popstate 先 cancel reading entry，再服从旧 history state。

解决方式：

- 在初始化锁定阶段先拦截 history；
- 不 cancel、不切 view、不挂载 Reader；
- 恢复 history 指针；
- 用一次性 ref 防止 popstate 循环。

这些错误共同说明：

**不能只验证单个组件或单条 happy path，必须验证 phase、view、mount、callback、timer、持久化和 history 的组合。**


---

## 4. 偏差原因

### 4.1 把独立性理解成复制代码

一度考虑每条路径拥有完整独立逻辑。

这会造成复制粘贴地狱。

最终改为：

```text
80% 公共能力
20% 路径配置
特殊流程单独 controller
```

### 4.2 一度过度冻结 Landing → Reader

因为它复杂，早期倾向于先不碰。

但它恰恰是剩余耦合最重的路径。

正确方式不是排除，而是独立重构。

### 4.3 状态顺序检查不完整

重构时只看 phase，没有同时检查：

- currentView 是否已切；
- Reader 是否已经挂载；
- ready 是否可能触发；
- timer 从何时开始。

因此出现“language-active 但 Reader 已在背后挂载”的真实 bug。

### 4.4 History 规则过度统一

“popstate 永不早期 return”在普通状态有助于同步 UI，但在首次初始化中会绕过流程。

History 必须按状态分为：

- 正常导航；
- 可取消；
- 必须阻挡。

### 4.5 在没有 Reader 视觉骨架时提前讨论入口位置

入口位置属于视觉布局决策。

在 Reader 内容区块未设计前继续讨论，会把功能阶段拖进视觉泥潭。

### 4.6 旧禁区没有区分永久规则与阶段性冻结

旧日志中的部分禁区是长期产品原则，部分只是“当前阶段别动”。

如果全部原样继承，会出现过时约束。

本版开始明确分为：

- 永久禁区；
- 当前阶段禁区；
- 已被新方案替代的旧禁区。

---

## 5. 修正方向

### 5.1 保持三层架构

#### 公共能力层

- timer registry；
- cleanup；
- call guard；
- reduced motion；
- CSS variables；
- phase helper。

#### 普通页面转场层

- `transitionDefinitions.js`
- `transitionStore.js`
- GlobalTransitionOverlay
- PageShell

#### 特殊流程层

- `readingEntryController.js`
- LanguageInit
- Reader ready
- History 特殊保护

### 5.2 新流程先画时序

任何跨页面流程先写：

```text
触发
→ phase
→ currentView
→ mount
→ callback
→ timer
→ cancel
→ stable state
```

没有时序，不直接施工。

### 5.3 所有异步回调双重保护

至少需要：

- 正确 phase；
- 一次性 guard；
- cancel 后失效；
- unmount cleanup。

### 5.4 只持久化稳定业务状态

持久化：

- currentView；
- 阅读进度；
- centerUnlocked；
- language；
- hasInitializedLanguage。

不持久化：

- leaving；
- entering；
- reader-preparing；
- language-leaving；
- timer；
- 临时 UI。

### 5.5 组合验收取代单路径验收

以后不仅测单条路径，还要测组合：

```text
reset
→ 首次初始化
→ 返回
→ 刷新
→ 前进
→ 再进入
```

以及：

```text
Reader
→ Center
→ refresh
→ back
→ Landing
→ resume
```

### 5.6 视觉设计先于入口最终显影

接下来先建立：

- Reader 版心；
- 章节结构；
- 系统层；
- 文本层；
- 世界层；
- Center 空间；
- 视觉资产。

再决定中枢入口最终形态。

---

## 6. 新增禁区

本节同时继承旧日志中仍有效的规则，并明确哪些规则已经被更新。

### 6.1 永久继承禁区

#### 阅读恢复

不要恢复旧 Reader preview 滑入方案。

不要重新引入：

```text
inertPreview
previewPhase
previewScrollY
onPreviewReady
```

不要重新创建旧用途的 `AppTransition.css`。

不要把 `maxReadPhase` 当继续阅读书签。

不要改变：

```text
lastScrollY > lastReadPhase > maxReadPhase
```

#### NewTone 与 Landing

不要让点击 NewTone 直接进入 Reader。

不要让点击 NewTone 直接进入 Center。

不要恢复 NewTone 下方常驻普通“进入中枢”文字按钮。

不要把 Landing 改成 Reader / Center 并列菜单页。

不要让中枢未解锁时出现上行入口。

不要让新增上行入口破坏向下继续读取。

不要把暖色解锁态做成高亮金色、火焰字或游戏奖励状态。

#### LanguageInit

不要把语言选择做成 dropdown、settings panel、白底菜单、radio、checkbox 或国旗列表。

不要恢复七语言环形星图作为当前方案。

不要让当前语言出现在候选阵列中。

不要每次通过 `ALL_LANGS.filter(...)` 重新生成候选并导致全体重排。

语言切换必须只交换旧当前语言与被点击 slot。

不要让 hover 直接切换语言。

桌面端不要以 click toggle 作为主要展开方式。

touch 端才使用 tap toggle。

不要让桌面展开层无法通过外部点击关闭。

不要把“继续读取”和“是否变更”做成两套按钮视觉系统。

不要让按钮入场同时叠加弹跳、scale、translate、opacity 和 scramble。

#### 普通页面转场

不要废弃 `transitionTo(targetView, options)`。

不要破坏：

```text
idle → leaving → covered → entering → idle
```

不要移除非 idle 重复触发保护。

不要在 leaving 阶段提前切换真实 view。

不要让 GlobalTransitionOverlay 明显透底。

不要把路径 label 直接压在真实页面上。

不要重新把所有路径合并为同一视觉 preset。

不要只改 overlay 色值就宣称路径语义变化。

不要删除 `fade-cover` fallback。

不要删除 `transitionDefinitions.js` 的唯一配置源职责。

不要把 timing、label、scene 再次分散到 Store、JSX 和 CSS。

#### Landing → Reader

不要把 Landing → Reader 强行并入普通 `transitionTo()`。

不要恢复多个松散 boolean 控制整条流程。

不要在判断首次初始化前切换 Reader view。

不要在以下阶段挂载 Reader：

```text
landing-leaving
landing-empty-hold
language-active
language-leaving
```

不要让 Reader ready 在 `reader-preparing` 之外推进。

不要让 ready 只有 call guard 而没有 phase guard。

不要让 LanguageInit 点击继续后瞬间被条件渲染替换。

不要把首次初始化与后续回读使用完全相同的节奏。

#### History 与刷新

不要在初始化 history 时写死 Landing。

不要持久化临时 transition phase。

不要在 LanguageInit 锁定阶段先 cancel 再处理 popstate。

不要让侧键绕过首次初始化进入旧 Reader。

不要只保持 UI 不变却让 history 指针偷偷错位。

不要通过无限 pushState 阻挡后退。

#### 视觉试错

不要恢复：

- `.landing-title-smoke`
- `.landing-smoke-wisp`
- smoke keyframes
- 火苗
- 浓烟
- 粒子喷射
- 持续 glitch
- 流光尾巴
- 过重 ember hotspot

除非未来已有正式 SVG / mask / 动画路径，并完成移动端降级设计。

不要在一个视觉问题连续两轮失败后继续猜参数。

必须检查真实 JSX、CSS、DOM、class、state、z-index 和 timing。

### 6.2 当前阶段禁区

以下不是永久禁止，而是视觉设计完成前不要做：

- 不决定 Reader 中枢入口最终位置；
- 不做入口最终首次发现提示；
- 不制作 NewTone 高级动态字标；
- 不重做 Center 内容架构；
- 不进入 C 正式内容填充；
- 不为未确定版式制作大量视觉资产；
- 不因为入口暂时不明显而增加全屏教程或弹窗。

### 6.3 已被新方案替代的旧禁区

以下旧规则不再原样使用，改为更准确的新规则：

#### 旧规则：不要动 `hasInitializedLanguage`

该规则曾用于冻结 A 第一版，现已过时。

新规则：

```text
不要改变 hasInitializedLanguage 的业务语义；
允许为修复流程时序而调整其写入时机。
```

当前正确写入时机：

```text
LanguageInit 离场完成后
→ setInitializedLanguage()
→ reader-preparing
```

#### 旧规则：不要动 LanguageInit 主流程

该规则曾用于避免全局转场施工误伤 A。

现已更新为：

```text
LanguageInit 的语言交互语义保持不变；
允许独立增加 entering / leaving / history lock 等流程状态。
```

#### 旧规则：不要让语言选择完成后自动进入 Reader

该措辞容易歧义。

正确规则是：

```text
用户未主动点击“继续读取”前，不得进入 Reader；
用户主动确认后，可以由流程自动完成离场、准备和进入 Reader。
```

#### 旧规则：Landing → Reader 待单独收口

该事项已完成，不再属于待办。

新规则：

```text
Landing → Reader 已封口，除阻断级 bug 外不再重构。
```

#### 旧规则：刷新、返回已基本无阻断问题

该结论已被本轮 bug 推翻并重新验证。

新结论：

```text
刷新恢复 currentView 已修复；
LanguageInit history lock 已修复；
后续仍必须做组合回归，不可只依赖旧验收。
```

---

## 7. 待决事项

### 7.1 Reader 正式视觉骨架

需要确定：

- 正文版心；
- 内容宽度；
- 字号与行距；
- 章节分段；
- M1–M4 层级；
- 长文滚动节奏；
- 系统提示与正文关系；
- 桌面 / 移动端布局。

### 7.2 中枢入口最终设计

待 Reader 骨架完成后决定：

- 入口位于章节末尾、边缘还是系统层；
- 是否跟随正文流；
- 是否固定；
- 首次解锁如何引导；
- 是否需要一次性提示；
- 顶部与底部入口是否同时保留；
- 移动端如何适配。

### 7.3 Landing / Reader / Center 统一视觉语言

需要建立：

- 色彩体系；
- 字体体系；
- 网格；
- 间距；
- 线条；
- 框体；
- 信号元素；
- 动效节奏；
- 状态色；
- 世界观视觉语法。

### 7.4 视觉资产清单

可能包括：

- NewTone 正式 SVG 字标；
- Reader 章节标记；
- Center 中枢图形；
- records / perspectives / fragments 符号；
- 背景纹理；
- mask；
- 路径动画资源；
- 章节分隔资产。

### 7.5 移动端集中验收

需要检查：

- Landing 上下触摸手势；
- 浏览器回弹；
- 系统侧滑返回；
- LanguageInit touch；
- safe area；
- Reader 恢复位置；
- Center 点击区域；
- 动画性能；
- reduced motion；
- 横竖屏。

### 7.6 Center 正式信息架构

当前内部切换正常，但以下尚未定型：

- records 职责；
- perspectives 职责；
- fragments 职责；
- Center 是目录、系统中枢、世界层，还是组合体。

### 7.7 未使用工具清理

检查：

- `readerReadyGate.js`
- `createCallGuard()`
- `prefersReducedMotion()`

原则：

- 实际需要则接入；
- 不需要则删除；
- 不保留“可能以后有用”的空抽象。

### 7.8 C 方向正式内容骨架

视觉容器成立后再进入：

- 正文主线；
- records；
- perspectives；
- fragments；
- 第一版真实内容比例。

---

## 8. 当前状态

### A：首次语言初始化

状态：第一版功能和视觉衔接完成。

已成立：

- reset 后首次进入 LanguageInit；
- 不会被 Reader ready 提前截断；
- 用户必须主动点击继续；
- LanguageInit 独立离场；
- 语言切换、hover、touch、slot 交换正常；
- 完成后不重复出现；
- 首次 Landing 熄灭、空场、环境启动、标题延迟已调整；
- LanguageInit 阶段侧键受保护；
- `hasInitializedLanguage` 语义正常。

### B1：Reader 中枢首次入口

状态：功能完成，最终视觉未定。

已成立：

- M4 解锁；
- `centerUnlocked = true`；
- Reader 中有入口；
- 入口有基础 reveal；
- 刷新持久化；
- reset 清空。

未完成：

- 最终位置；
- 首次发现提示；
- 正式视觉资产。

### B2：Landing 回访入口

状态：功能与第一版交互完成。

已成立：

- 未解锁：向下 Reader；
- 已解锁：向上 Center、向下 Reader；
- NewTone 暖色解锁态；
- 点击 NewTone 不跳转；
- 刷新保持；
- reset 清空。

### 普通页面转场

状态：配置化、视觉回归和路径隔离完成。

已成立：

- 唯一配置源；
- 公共 phase engine；
- timer cleanup；
- CSS variables；
- 五条路径验收；
- fallback 保留。

### Landing → Reader

状态：专用流程重构和核心验收完成。

已成立：

- 独立 controller；
- Landing leaving；
- 首次 empty hold；
- LanguageInit 独立阶段；
- Reader preparing；
- ready phase guard；
- minimum duration；
- transition fade；
- 首次与回读节奏分离；
- cancel / cleanup。

### 刷新与 History

状态：核心问题修复。

已成立：

- 刷新保留稳定页面；
- Reader 刷新恢复阅读位置；
- Center 刷新保持 Center；
- 非法 Center 状态回 Landing；
- LanguageInit history lock；
- 完成初始化后前进 / 后退正常；
- 不再由侧键绕过初始化。

### Center 内部

状态：通过。

已成立：

- home / records / perspectives / fragments 切换；
- 内容淡入；
- 返回文案修正。

### B 阶段结论

```text
B 阶段功能封口
```

后续只在发现阻断级 bug 时回开。

---


### 文档使用规则

本文件中的信息按以下优先级理解：

1. “当前状态”代表当前代码基线；
2. “永久继承禁区”代表后续默认不得违反的产品或架构原则；
3. “当前阶段禁区”只在视觉骨架完成前生效；
4. “已被新方案替代的旧禁区”仅用于解释历史，不得继续作为施工指令；
5. 若未来代码与本日志冲突，必须先检查代码和复现结果，再更新日志，不能让旧日志覆盖新事实。


## 9. 下一步规划

### 第一步：冻结当前功能版本

保存当前代码与日志。

冻结：

- A 初始化；
- B1 / B2；
- 普通转场；
- Landing → Reader；
- refresh；
- history；
- Center 内部；
- M4 解锁。

### 第二步：定义整体视觉方向

明确：

- 沉浸式阅读器的核心气质；
- 手绘感与系统感的比例；
- Landing / Reader / Center 的关系；
- 安静区域与显影区域；
- 色彩、字体、线条和留白；
- 动效语法。

### 第三步：Reader 视觉骨架

优先建立：

- 阅读版心；
- 章节容器；
- 段落层级；
- M1–M4 结构；
- 系统提示区；
- 导航区；
- 响应式基础。

### 第四步：Center 视觉骨架

明确 Center 的空间定位，再设计：

- home；
- records；
- perspectives；
- fragments；
- 返回与层级关系。

### 第五步：视觉资产清单与制作顺序

区分：

#### CSS 可完成

- 色彩；
- 线条；
- 框体；
- 淡入；
- 轻量 hover；
- 布局；
- 章节节奏。

#### 需要正式资产

- 字标；
- mask；
- 路径动画；
- 中枢图形；
- 图标；
- 背景纹理。

### 第六步：回到 B1 入口最终设计

Reader 骨架成立后，再决定：

- 入口位置；
- 首次显影；
- 引导文案；
- 是否只播放一次；
- 顶部 / 底部保留策略；
- 移动端形态。

### 第七步：移动端视觉与交互验收

完成核心视觉后集中测试：

- touch；
- safe area；
- 阅读宽度；
- 字号；
- 返回手势；
- 动画性能；
- Center 导航；
- LanguageInit。

### 第八步：进入 C 正式内容骨架

最终顺序：

```text
B 功能封口
→ 视觉总方向
→ Reader 骨架
→ Center 骨架
→ 视觉资产
→ B1 入口最终设计
→ 移动端验收
→ C 正式内容
```

---

# NewTone Reader 阶段 0–9 连续重构完成日志

- 日期：2026-07-14（America/Vancouver）
- 项目版本：NewTone V0.1
- 验收状态：阶段 0–9 全部通过
- 稳定基线：`5e51a4d`
- 对应 Git commits：`4ee36dd`、`a45f479`、`ca72029`、`9fd0d6d`、`7b8e90c`、`b503a1d`、`34d7619`、`bd8b7e6`、`90ded4a`、`5e51a4d`

## 1. 上次日志总结

上一稳定版本仍使用长页 Reader、`lastScrollY`、phase observer、sentinel 与滚动进度。M4 恢复曾可能因 sentinel 相交而误解锁，短页 `phase → page → beat` 模型尚未接管正式入口。

## 2. 本次操作

- 建立本地 Git 唯一基线与 Vitest 闸门；未配置 remote、未推送。
- 新增 M1–M4 短页内容模型、稳定位置索引、v1→v2 迁移与持久化。
- 新增 ReaderStage、统一 wheel/touch/keyboard/click 输入、转场提交、场景/进度/教程状态。
- 用 v2 已提交位置接管首次进入、继续阅读、刷新、history 与 Center/Landing 往返。
- 新增显式最终 forward exit 完成动作，并将完成与进入 Center 分离。
- 删除旧长页 Reader、observer、sentinel、旧 ReaderProgress、滚动恢复、B3/phase tag CSS、占位长页数据和无调用 helper。
- 补齐 reduced-motion、ARIA、focus-visible、44px 点击区、timer/listener/rAF 清理。

## 3. 本次完成

- Reader 正式模型为 `phase → page → beat`，前后导航、跨 page 与跨 phase 均稳定。
- 动画只在完成后提交持久化位置；刷新只恢复已提交位置。
- v1 未开始、M2、M4 未完成与已解锁四类迁移保持正确且幂等。
- 到达 M4、最终页或最终 beat 均不解锁；只有明确点击“完成阅读”才永久解锁 Center。
- 完成后仍停留 Reader，可继续前后阅读，并通过独立“进入中枢”入口离开。
- Landing 开始/继续只依据 v2 状态；浏览器 history 只管理顶层 view。
- production preview、桌面、390×844、短视口、横屏、键盘全程、连续刷新与 Center 往返均通过。
- 最终自动检查：10 个测试文件、58 项测试通过；lint 0 warning；build 与 `git diff --check` 通过；浏览器控制台 0 error/0 warning。

## 4. 本轮发现的问题

旧 Reader 的 sentinel 把恢复或布局相交误当作真实完成；修复阶段进一步发现，完成资格不能只依赖 observer，也不能用 M4 或最远位置推导。后续迁移证明，显示位置、已提交位置、最远位置、正式完成与永久解锁必须保持独立。

## 5. 偏差原因

- 旧架构把文档滚动、阶段识别、恢复、完成与解锁耦合在同一长页生命周期。
- sentinel 相交只表示几何关系，无法证明 ready 后的真实用户完成意图。
- `lastScrollY` 是像素证据，不是稳定内容位置，连续刷新与布局变化会放大漂移风险。

## 6. 修正方向

- 内容顺序只由稳定索引定义，不从 DOM 或 CSS 推导。
- 永久状态只在稳定转场完成后提交；临时展示与输入队列留在 Reader 本地。
- 恢复必须依次完成位置解析、首屏测量、焦点定位，再发出 ready。
- 完成必须由最终 beat 的显式 forward exit 触发，并使用幂等 store action。

## 7. 新增效率禁区

1. 禁止用 observer、sentinel、滚动百分比或 `maxReadPhase` 推导 Reader 完成。
2. 禁止在动画开始时提前提交下一位置。
3. 禁止让 beat/page/phase 导航写入浏览器 history。
4. 禁止为迁移伪造精确 page/beat 或自动回滚运行时错误写入。
5. 禁止在新恢复链未完成全场景回归前删除旧恢复职责。

## 8. 待解决事项

- 当前内容仍为短页结构示例，正式小说内容接入需保持现有 ID、顺序和迁移契约。
- in-app browser 不提供原生触摸事件注入；touch 手势由纯输入测试覆盖，390×844 现场覆盖布局、点击区和完整可操作性，后续真机发布前仍建议补一次物理设备手势复核。

## 9. 当前状态与下一步规划

### 9.1 当前状态

Reader 阶段 0–9 已完成并形成稳定本地基线。正式运行链中不存在旧长页 observer、sentinel 或 scroll progress。工作区未配置 remote，未推送 GitHub。

### 9.2 下一步规划

下一步应单独规划正式内容接入与真机发布验收。开始前先冻结当前位置 ID 与 v2 迁移契约；不得重新引入长页恢复、隐式完成或基于 M4 的自动解锁。
