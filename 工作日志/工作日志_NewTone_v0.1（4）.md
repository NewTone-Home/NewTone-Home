# NewTone-V0.1 工作日志 （4）：B 方向入口显影 / Landing 回访入口 / Global Transition 收口复盘

生成时间戳：2026-07-10 01:00:41 PDT（America/Vancouver 本地时间）  
修订时间戳：2026-07-10 01:18:00 PDT（America/Vancouver 本地时间）  
项目：NewTone-V0.1  
阶段：B 方向 · 中枢入口显影 / Landing 回访入口 / 全局页面转场  
本轮性质：产品路径规划 + 入口语义重构 + 视觉方案试错 + 全局转场搭建 + 路径级纠偏 + 第一版封口  
本轮主要检查对象：`Landing.jsx / Landing.css / Reader.jsx / Center.jsx / App.jsx / transitionStore.js / GlobalTransitionOverlay.jsx / GlobalTransitionOverlay.css / PageShell.jsx / PageShell.css`

---

## 1. 上次总结

上一轮已经完成 A 方向“首次语言初始化层”的第一版闭环，并完成桌面端收口验收。Landing → Reader 不再走旧 Reader preview 滑入方案，而是统一由 `ReadingTransition overlay` 接管；首次进入时由 `hasInitializedLanguage` 判断是否进入 LanguageInit，已经完成语言初始化的用户则跳过首次确认，继续走原有阅读过渡路径。

继续阅读语义已经固定：`lastScrollY` 是实际滚动位置，优先恢复；`lastReadPhase` 只作为粗粒度 fallback；`maxReadPhase` 只代表历史最高解锁阶段，不能作为书签。恢复优先级继续保持：

`lastScrollY > lastReadPhase > maxReadPhase`

Landing 的 NewTone 也已经确认是第一互动锚点。点击、hover 或触碰 NewTone 只负责唤醒标题、提示和反馈，不直接进入 Reader。真正进入 Reader 的动作仍是向下滚动 / 对应触摸手势。

A 收口验收已经确认：

- 首次进入时会先经过 ReadingTransition 与语言初始化，而不是直接进入正文；
- 语言变更的 hover / touch、外部关闭、旧语言淡出、新语言淡入和位置交换逻辑已经成立；
- 已初始化用户不会重复进入 LanguageInit；
- 继续阅读仍按既定恢复优先级工作；
- 刷新、重复进入、浏览器返回 / 侧键返回没有再出现阻断级黑屏或无 view 状态；
- 移动端尚未完成集中验收，但不再阻塞 A 的桌面端第一版封口。

上一轮同时已经明确：A 方向完成后，不再继续无目的打磨首次语言初始化层。B 方向“中枢入口显影”成为下一主线，C 方向“正式 0.1 内容骨架”继续暂缓。

本轮开始时，B 方向还没有正式拆成 B1 / B2。B1“Reader 内首次中枢显影入口”和 B2“Landing 解锁后回访入口”，是本轮在检查现有中枢入口和回访路径后，为了区分“第一次发现中枢”和“解锁后的再次进入”而形成的新划分。

---

## 2. 本次完成

本轮实际完成了两条连续但性质不同的主线：

第一条是 B 方向中的 Landing 回访入口收口，也就是用户已经在 Reader 读到 M4、解锁中枢之后，回到 Landing 时应如何重新进入 Center。

第二条是在 B2 完成后暴露出的全局页面切换问题，也就是 Landing、Reader、Center 之间大量硬切，因此进一步建立了 Global Transition 第一版。

这两条主线必须分开理解：

B2 解决的是“入口语义”。

Global Transition 解决的是“页面之间怎么切换”。

它们前后相连，但不是同一个功能。

### 2.1 重新划分 B1 与 B2

本轮首先明确：B 方向不能只笼统叫“中枢入口”。

它至少分为两种不同入口：

**B1：Reader 内首次中枢显影入口。**

用户在 Reader 读到 M4 后，第一次发现并解锁中枢。这个入口承担的是“第一次看见那扇门”的职责。它依赖阅读阶段和 `completeM4()`，并通过 `centerUnlocked: true` 将中枢解锁状态持久化。

**B2：Landing 上的中枢回访入口。**

用户已经解锁过中枢，再回到 Landing 后，需要有一种不会破坏 Landing 构图的方式重新进入 Center。它承担的是“系统记得你已经打开过那扇门，因此允许快速回访”的职责。

本轮没有重做 B1 的主体。B1 已经存在并可用。本轮主要完成的是 B2。

### 2.2 废弃 Landing 上的普通“进入中枢”文字入口

原实现是在 NewTone 下方固定显示一个很小的“进入中枢”按钮：

- `centerUnlocked === true` 时渲染；
- 位置在“向下滚动继续读取”下方约 `4.5rem`；
- 点击后直接进入 Center。

这个实现功能上可用，但语义和视觉都不对。

主要问题有三个：

第一，它太像普通网页的 secondary link。  
NewTone 下方多出一行“进入中枢”，容易让 Landing 变成一个普通导航页，而不是一个有空间方向和世界状态的入口场。

第二，它打断了 Landing 原本的第一互动语法。  
Landing 原本围绕 NewTone 和“向下滚动继续读取”形成单一入口。多出一个独立小字按钮后，页面像临时补了一条功能链接。

第三，它没有表达“中枢解锁之后，Landing 本身发生了变化”。  
用户虽然看见了一个新按钮，但感知不到自己读到 M4 后系统状态被改写。它只是多了一个功能，不像世界留下了痕迹。

因此，本轮废弃了“NewTone 下方常驻进入中枢文字按钮”的方向。

### 2.3 确立 Landing 的上下双向入口语义

经过方案讨论，最终确定：中枢解锁后的 Landing 不应变成按钮菜单，而应变成一个上下分层的双向入口。

未解锁中枢时：

- 中央仍是 NewTone；
- 下方保留“向下滚动 · 开始读取”或“向下滚动 · 继续读取”；
- 不显示任何中枢提示；
- 向下滚动进入 Reader。

已解锁中枢后：

- NewTone 上方显示“向上滚动 · 进入中枢”；
- NewTone 下方显示“向下滚动 · 继续读取”；
- 向上滚动进入 Center；
- 向下滚动进入 Reader；
- NewTone 本身仍只负责原有唤醒反馈，不直接跳转。

最终语义为：

**向上：进入中枢。**  
**向下：继续读取。**  
**NewTone：位于两层空间之间的中间锚点。**

这个方案比普通文字按钮更稳定，因为它延续了 Landing 已经存在的滚动交互语言，并让 Center 与 Reader 变成上下两个空间方向，而不是两个并列菜单选项。

### 2.4 完成 Landing 真实代码盘点

在施工前，本轮要求 OpenCode 先输出真实代码，而不是继续凭视觉描述猜。

确认结果如下：

“向下滚动继续读取”渲染在 `Landing.jsx` 的 `.landing-prompt-slot` 中，文案依据是否存在阅读进度，从：

- `copy[language].landingPromptInitial`
- `copy[language].landingPromptResume`

二者中选择。

原“进入中枢”按钮由：

```jsx
{centerUnlocked && (
  <button className="landing-center-entry" onClick={enterCenter}>
    {copy[language].enterCenter}
  </button>
)}
```

控制。

两者都位于 `.landing-main` 内，并使用绝对定位。

Landing 原有滚动逻辑集中在一个 `useEffect` 内：

- `wheel` 仅检测 `e.deltaY > 8`；
- touch 通过起点与移动距离判断向下进入；
- `triggeredRef.current` 防止一次输入重复触发；
- 原逻辑只会进入 Reader，没有上行分支；
- 原逻辑也没有根据 `centerUnlocked` 做双向判断。

中枢解锁状态只有一个：

```js
centerUnlocked: false
```

它由 `completeM4()` 设置为 `true`，并持久化。当前没有额外的 `hasEnteredCenter`、`showCenterEntry` 或短时回访状态。

NewTone 原 class 只有：

- `.landing-title`
- `.landing-title--activated`

没有中枢解锁态 class。

这次代码盘点明确了最小改动范围：

- Landing 的 wheel/touch 输入分流；
- 上下提示的渲染与位置；
- NewTone 增加解锁态 class；
- 原普通“进入中枢”按钮删除或退出主方案；
- `centerUnlocked` 语义保持不变；
- 不重构 progressStore。

### 2.5 完成 B2 的滚动方向逻辑

施工时特别修正了一个潜在错误方向：

不能在 `centerUnlocked === true` 后直接屏蔽滚动进入 Reader。

如果简单写成“解锁后 onWheel return”，Landing 会变成半瘫状态，向下继续读取路径被破坏。

正确逻辑必须是双向分流：

- `deltaY > threshold`：继续进入 Reader；
- `deltaY < -threshold`：进入 Center；
- 未解锁中枢时，上行输入不应进入 Center；
- transition 已触发后通过 lock 防止重复调用；
- touch 端需要保持与桌面端一致的方向语义。

B2 的核心不是“解锁后关闭原入口”，而是“解锁后在原入口基础上增加另一条方向”。

### 2.6 完成 NewTone 解锁态的视觉试验与止损

双向入口结构确定后，本轮继续讨论 NewTone 在中枢解锁后应发生什么变化。

最初判断是：仅多一行上行提示仍偏文案层变化，NewTone 字标本身也应留下中枢已解锁的状态痕迹。

期间先后讨论和尝试了：

- 字标整体变亮；
- 中枢脉络 / 扫描线；
- 后方中枢环或坐标层；
- 轻微双影；
- 余烬印记态；
- 轻微发热；
- 烟丝上浮；
- 类似被加热后微微发亮、冒烟的效果；
- 局部热点；
- 流光或内部脉络。

其中“余烬 / 轻烟”方向一度被认为与 NewTone 的世界感较契合，因为它不像通用科幻 UI，而更像字标被中枢触碰后仍有余温。

但实际落地后暴露出明显问题：

第一，烟雾很容易变成额外装饰层。  
即使没有做粒子，它仍会抢占 NewTone 上方空间，和上行提示发生视觉竞争。

第二，手写字标没有专用 SVG 路径或正式美术资产时，烟丝、热点、流光很难真正沿笔画生长。最终容易像 CSS 伪元素堆在字周围，而不是字本身发生变化。

第三，余烬和烟一旦稍重，就会从“有温度”滑向“着火 Logo”；稍轻又几乎没有可见效果，进入反复调参数但价值很低的状态。

第四，B2 的目标是完成回访入口语义，不是进入字标动画资产制作阶段。继续在烟、火、尾迹和流光上消耗时间，会把第一版拖进美术泥潭。

因此，本轮最终明确止损：

- 删除 `.landing-title-smoke`；
- 删除 `.landing-smoke-wisp`；
- 删除 smoke keyframes；
- 删除过重的 ember hotspot；
- 不保留火苗、浓烟、粒子喷射、持续 glitch；
- 不继续做流光、尾巴和额外几何印记；
- 只保留 NewTone 解锁后的颜色变化和轻微 glow。

最终又在冷色与暖色之间做了选择。

一度建议继续使用更亮、更清晰的冷蓝灰，但用户最终明确要求直接改为暖色调。

于是 B2 第一版最终确定：

- 未解锁：NewTone 保持原来的冷灰蓝；
- 已解锁：NewTone 切换为克制的暖琥珀 / 暗金灰；
- hover / activated 时轻微增强；
- 不出现大面积金色；
- 不做火焰文字；
- 不做循环特效；
- 上下提示承担主要状态变化；
- 颜色变化承担“系统已经被中枢触碰过”的辅助确认。

最终结论是：

**B2 Landing 回访入口 = 上下双向提示 + NewTone 暖色解锁态。**

### 2.7 B2 第一版完成封口

B2 当前已成立的状态规则如下：

未解锁中枢：

- Landing 保持原单向入口；
- 不显示“向上滚动 · 进入中枢”；
- NewTone 保持冷灰蓝；
- 向下滚动进入 Reader。

已解锁中枢：

- NewTone 上方显示“向上滚动 · 进入中枢”；
- NewTone 下方显示“向下滚动 · 继续读取”；
- NewTone 进入暖色解锁态；
- 向上滚动进入 Center；
- 向下滚动进入 Reader；
- 从 Center 或 Reader 返回 Landing 后，只要 `centerUnlocked === true`，双向入口持续存在；
- reset 后状态恢复到未解锁。

NewTone 点击与 hover：

- 继续只触发原有唤醒反馈；
- 不直接进入 Reader；
- 不直接进入 Center。

至此，B2 第一版完成。

---

### 2.8 在 B2 完成后发现全局页面硬切问题

B2 完成后，用户进一步指出：

Landing 到其它页面、Reader 到其它页面、Center 返回其它页面，整体仍然大量使用硬切。即使入口本身已经成立，页面切换仍像瞬间替换 DOM，没有一个正常、顺滑且可复用的过渡场景。

因此，本轮从 B2 进入新的施工段：

**Global Transition Layer。**

这一步的目标不是替换 `ReadingTransition`，而是先处理普通页面之间的切换：

- Landing → Center
- Reader → Center
- Reader → Landing
- Center → Landing
- Center → Reader

Landing → Reader 暂时保持独立，因为它包含：

- `ReadingTransition`
- `LanguageInit`
- Reader ready
- 最小时长
- 首次初始化 gate
- 阅读恢复

不能和普通页面切换混为一谈。

### 2.9 建立统一转场调度基础

全局转场第一版先建立了统一调度层：

- `transitionTo(targetView, options)`
- Zustand `transitionStore`
- preset timing
- `idle → leaving → covered → entering → idle`
- 非 idle 阶段防重复触发
- covered 阶段切换 `currentView`
- 全局 overlay
- route payload 支持

这一层的价值是：

页面切换不再由每个按钮直接 `setCurrentView()`，而是先进入 leaving，遮罩覆盖后切 view，再进入 entering。

统一的是调度顺序，不是视觉。

### 2.10 修复 GlobalTransitionOverlay 不渲染问题

早期 GlobalTransitionOverlay 一度完全没有可见效果。

检查后发现，preset map 中存在类似：

```js
'fade-cover': null
```

而解析逻辑使用了 falsy 判断。结果 `fade-cover` 虽然是合法 preset，却因为对应值为 `null` 被当成不存在，overlay 不渲染或直接返回。

最终改为使用合法 preset Set：

```js
const TRANSITION_PRESETS = new Set([
  'fade-cover',
  'surface-to-core',
  'reader-to-core',
  'core-to-surface',
  'core-to-reader',
  'reader-to-surface',
])
```

然后通过：

```js
TRANSITION_PRESETS.has(preset)
```

判断合法性。

这个问题说明：视觉层“完全没效果”不一定是 CSS 参数太弱，也可能是组件根本没有渲染。之后遇到类似情况，应先确认 DOM 和 class 是否实际存在，再调视觉。

### 2.11 第一版 overlay 只解决了“黑一下”，没有解决转场

Overlay 成功渲染后，第一版主要是深色背景淡入，再淡出。

这一版虽然掩盖了直接硬切，但用户感知仍然是：

“黑一下，然后换页面。”

不同 preset 之间只存在很小的背景透明度、光晕和时间差：

- 背景 alpha 差值只有约 0.02 到 0.06；
- 光晕透明度很低；
- 时长差通常只有几十毫秒；
- 页面本体完全不参与动画。

因此，`fade-cover / surface-to-core / core-to-surface` 在肉眼上几乎等价。

这一阶段的重要诊断是：

**overlay 换皮不等于路径转场。**

仅靠黑幕透明度、底色和微弱径向光，不足以表达“进入中枢”“回到入口”“回到阅读”等不同方向。

### 2.12 引入 PageShell，让页面本体参与 leaving / entering

为了解决 overlay 只有遮羞布、页面本体没有运动的问题，本轮引入 `PageShell`。

App 的 view 渲染从直接条件渲染改为统一包裹：

```jsx
<PageShell>
  {showReader && <Reader ... />}
  {showLanding && <Landing ... />}
  {showCenter && <Center ... />}
</PageShell>
```

PageShell 读取：

- transition phase
- transition preset

并注入类似：

- `phase-leaving`
- `phase-covered`
- `phase-entering`
- `preset-reader-to-core`

等 class。

这样每个路径不只让 overlay 变化，旧页面和新页面本身也能拥有 opacity / scale 动画。

### 2.13 PageShell 初期仍然没有明显体感

PageShell 加入后，前几轮调整仍然多次出现“代码变了，但肉眼几乎没有变化”。

主要原因包括：

第一，scale 幅度过小。  
例如 `1 → 0.985`、`1 → 0.975` 在深色页面和几百毫秒内很难明确感知。

第二，opacity 变化太轻。  
例如 `1 → 0.86`，在 overlay 同时盖上时几乎被完全吞掉。

第三，overlay z-index 较高且覆盖太快。  
页面本体刚开始收缩，黑幕已经迅速盖住，用户看不到 PageShell 动画。

第四，covered 和 entering 的 reset 不够清晰。  
新 view 在 covered 阶段已经挂载，但 PageShell 的状态与遮罩衔接没有完全形成稳定的“旧页退场 → 全遮盖 → 新页入场”。

第五，多层 timing 虽然表面同步，但视觉峰值没有对齐。  
Store 的 leaving 时长、PageShell keyframe、Overlay keyframe 即便数字一致，也不代表关键视觉节点一定一致。

### 2.14 出现遮罩透底、抢跑和文案叠页问题

为了增强路径语义，overlay 后续加入了更明确的中枢光晕和标签，例如：

- 进入中枢中
- 返回入口中
- 回到阅读中

但这又暴露出新的问题：

- 背景不够不透明时，真实页面会透出；
- 新 view 在遮罩完全成立前已经可见；
- 过渡标签像直接压在真实页面上；
- leaving 还没完成，covered 或 entering 已经抢跑；
- 有时像先出现新页面，再补一层黑幕；
- 有时像黑幕淡去时直接硬切到新页面。

这些问题说明 Global Transition 不能只是一个半透明 overlay。它需要成为真正的独立过渡场景。

最终处理方向是：

- 背景改为不透底的深色，例如接近 `rgb(3, 7, 10)`；
- label 只存在于独立过渡场景；
- covered 阶段必须确保真实页面不可被看到；
- 新 view 的切换只能发生在完全覆盖之后；
- entering 时再逐步释放新页面；
- GlobalTransitionScene 是基础设施，不承担所有路径的主要方向感。

### 2.15 放弃“所有路径共用一种视觉”的目标

本轮一度规划了 V1 到 V5：

- V1：基础遮罩；
- V2：增强 preset 差异；
- V3：PageShell；
- V4：路径方向语义；
- V5：未来把 ReadingTransition 统一进 `transitionTo()`。

但在实际多轮调试后，最终确认：

**统一调度可行，统一视觉不可行。**

Landing、Reader、Center 三个界面的构图、内容密度和用户心理语义都不同。

例如：

- Landing → Center 更像从入口进入中枢；
- Reader → Center 更像当前文章被收起并纳入系统；
- Reader → Landing 更像退出阅读层、书页轻合；
- Center → Reader 更像回到刚才的阅读现场；
- Center → Landing 更像离开系统核心，回到入口。

如果所有路径都用一套“scale + fade + dark overlay”，最终只会得到同一种黑幕切换。

因此最终架构变为：

**统一调度，路径独立表现。**

保留：

- `transitionTo`
- transitionStore phase
- covered 切 view
- 重复触发保护
- GlobalTransitionScene
- PageShell

拆分：

- 每个路径独立 preset
- 每个 preset 独立 timing
- 每个 preset 独立 leaving / entering keyframe
- 每个路径独立 label
- 每个路径独立验收

### 2.16 完成五条 Global Transition 路径

当前走 `transitionTo()` 的路径为：

#### Landing → Center

调用：

```js
transitionTo('center', { preset: 'surface-to-core' })
```

语义：从入口进入中枢。

最终第一版结果：

- 页面轻微缩小与变暗；
- GlobalTransitionScene 显示“进入中枢中”；
- 遮罩完全覆盖后切换到 Center；
- 当前用户侧验收通过。

当前 timing：

- leaving：300ms
- coveredHold：450ms
- entering：420ms

#### Reader → Center

顶部与底部入口都调用：

```js
transitionTo('center', { preset: 'reader-to-core' })
```

语义：文章被收起，进入中枢。

这条路径最终成为最明显的“重收起”效果。

PageShell leaving 最终增强为：

- opacity：`1 → 0.62`
- scale：`1 → 0.94`
- duration：420ms
- transform-origin：center center

对应 timing：

- leaving：420ms
- coveredHold：400ms
- entering：400ms

这条路径之所以比其它路径更重，是因为用户正处在具体文章内容里，进入 Center 应当像把当前阅读层收纳起来，而不是普通淡出。

顶部和底部入口最初在体感上有差异。代码检查确认，两处调用完全相同，差异主要来自当前滚动位置与页面内容密度。增强 PageShell 的收起幅度后，顶部与底部都获得了可见的折叠 / 后退感，最终用户确认通过。

#### Reader → Landing

顶部与底部入口都调用：

```js
transitionTo('landing', { preset: 'reader-to-surface' })
```

语义：退出阅读层，返回入口。

最初该路径只有普通 fade，因此用户明确指出没有 Reader → Center 那种文章收起感。

后续单独为 `reader-to-surface` 加入较轻的收起：

- opacity：`1 → 0.72`
- scale：`1 → 0.96`
- duration：380ms
- transform-origin：center center

对应 timing：

- leaving：380ms
- coveredHold：340ms
- entering：400ms

这条路径刻意弱于 Reader → Center。

Reader → Center 是“重收起，纳入中枢”；  
Reader → Landing 是“轻收起，退出阅读”。

最终顶部与底部入口均确认通过。

#### Center → Landing

调用：

```js
transitionTo('landing', { preset: 'core-to-surface' })
```

语义：离开中枢，返回入口。

当前采用轻微 opacity 离场，不做明显 scale：

- opacity：`1 → 0.88`
- duration：280ms

对应 timing：

- leaving：280ms
- coveredHold：450ms
- entering：460ms

这条路径不需要文章式折叠，因为 Center 本身不是具体阅读页。当前用户侧验收通过。

#### Center → Reader

调用：

```js
transitionTo('reader', {
  preset: 'core-to-reader',
  payload: { mode: 'continue' },
})
```

语义：从中枢回到阅读现场。

当前采用轻微 opacity 离场：

- opacity：`1 → 0.88`
- duration：260ms

对应 timing：

- leaving：260ms
- coveredHold：380ms
- entering：420ms

GlobalTransitionScene 显示“回到阅读中”。

这条路径不走 LanguageInit，也不走 Landing → Reader 的 ReadingTransition。它是已在系统内部的普通返回路径。当前用户侧验收通过。

### 2.17 明确 Landing → Reader 保持独立

Landing → Reader 当前仍然走：

```text
Landing scroll / touch
→ App.handleEnter
→ setReadingTransitioning(true)
→ ReadingTransition
→ 首次用户可能进入 LanguageInit
→ Reader 提前挂载并等待 ready
→ 满足最小时长
→ ReadingTransition 淡出
→ Reader 显示
```

它不使用：

- `transitionTo`
- GlobalTransitionScene
- PageShell preset

原因不是它不重要，而是它比普通页面切换复杂得多，内部包含初始化、异步 ready、语言确认和阅读恢复。

V5 曾设想未来增加 `reading-init` preset，把它统一进 `transitionTo()`。但本轮最终明确：

**当前不做。**

否则容易破坏：

- `hasInitializedLanguage`
- LanguageInit
- `lastScrollY`
- Reader ready
- 首次与老用户的分支
- 最小时长
- 阅读恢复

Landing → Reader 应单独收口，而不是为了形式统一强行接进 Global Transition。

### 2.18 完成全局转场第一版封口记录

本轮最终形成的路径表如下：

| 路径 | 调度入口 | 场景层 | 页面动画 | 当前状态 |
|---|---|---|---|---|
| Landing → Reader | ReadingTransition 独立流程 | ReadingTransition 自有场景 | 不经过 PageShell | 待单独收口 |
| Landing → Center | transitionTo | GlobalTransitionScene | surface-to-core | 已通过 |
| Reader → Center | transitionTo | GlobalTransitionScene | reader-to-core | 已通过 |
| Reader → Landing | transitionTo | GlobalTransitionScene | reader-to-surface | 已通过 |
| Center → Landing | transitionTo | GlobalTransitionScene | core-to-surface | 已通过 |
| Center → Reader | transitionTo | GlobalTransitionScene | core-to-reader | 已通过 |

全局基础设施当前进入冻结：

- `transitionTo(targetView, options)`
- transitionStore phase 状态机
- 非 idle 防重复触发
- covered 阶段切 view
- GlobalTransitionScene 不透底背景
- label 映射
- PageShell 基础结构
- 每条路径独立 preset

`fade-cover` 当前没有主动路径使用，但继续保留为 fallback，不删除。

---

## 3. 本轮发现的问题

本轮的问题不是单一 bug，而是两类问题连续叠加：

一类是 B2 入口语义与视觉表达问题。

另一类是全局转场中“统一基础设施”和“路径视觉”被混为一谈的问题。

### 3.1 B2 入口功能成立，但形式仍像普通网页导航

最初的“进入中枢”小字确实能完成跳转，但它没有形成 NewTone 自己的交互语言。它只是把 Center 当成另一个页面链接。

真正缺失的不是按钮样式，而是入口空间关系。

只有改成“上行进入中枢、下行继续读取”后，Landing 才从一页菜单变成上下两层世界的交界面。

### 3.2 视觉试验过早超过 B2 第一版目标

NewTone 解锁态在没有正式 SVG 字标动画资产的情况下，连续探索烟、余烬、热点、扫描、流光，消耗明显高于功能价值。

这些方案并非概念错误，但不适合当前阶段。

B2 第一版真正需要的是：

- 用户能感知已经解锁；
- 用户知道怎么回访；
- 不破坏 Landing 极简；
- 不影响原 Reader 入口。

双向提示 + 暖色变化已经满足目标。继续做烟雾属于提前进入美术资产阶段。

### 3.3 Global Transition 最初只解决遮盖，没有解决动作

第一版 overlay 让页面不再裸切，但它只是把硬切藏在黑幕下面。

如果页面本体不参与，所谓“进入中枢”和“返回入口”都只是同一块暗幕。

因此真正的转场必须至少包含：

- 旧页面如何离场；
- 遮罩何时完全覆盖；
- 真实 view 何时切换；
- 新页面如何进入。

### 3.4 preset 参数存在，但差异小到不可感知

早期不同 preset 的底色、透明度、光晕和时长虽然数值不同，但差异不足以形成用户感知。

这说明：

**代码不同不代表体验不同。**

如果 alpha 只差 0.02、scale 只缩 0.015、时长只差 40ms，用户看到的仍是同一种转场。

### 3.5 timing 数字同步不代表视觉时序正确

Store、Overlay、PageShell 的 duration 即使完全匹配，也可能因为：

- easing 不同；
- opacity 峰值不同；
- overlay 覆盖速度过快；
- 新页面挂载时机不同；
- keyframe from 状态不同；

导致视觉抢跑或透底。

所以以后不能只看 timing matrix 的“✓”，还要看真正的视觉节点是否对齐。

### 3.6 透明 overlay 无法承担独立过渡场景

只要 overlay 还明显透底，label 就可能像贴在真实页面上，而不是属于过渡层。

最终不透底背景不是审美偏好，而是保证状态隔离的必要条件。

### 3.7 同一路径在不同滚动位置仍会产生不同体感

Reader 顶部与底部入口调用相同，但页面内容密度、留白、固定元素和当前视口不同，scale/opacity 的感知会不同。

因此代码相同只能证明逻辑一致，不能替代真实视觉验收。

### 3.8 Landing → Reader 仍存在另一套硬切问题

全局转场完成后，最明显的剩余问题转移到 Landing → Reader：

- Landing 触发后进入 ReadingTransition 的首段仍偏硬；
- 首次 LanguageInit 完成后的状态衔接偏硬；
- “继续读取 / 开始读取”到正文出现太急；
- ReadingTransition 结束时新页面显现速度过快；
- 可能存在瞬间白屏或突然切入；
- LanguageInit 内部不同界面状态之间也有硬切。

这些问题不能再由 Global Transition 兜底，因为它们发生在 ReadingTransition 内部。

---

## 4. 偏差原因

### 4.1 把“入口显影”误扩展成“字标视觉资产制作”

B2 的主问题是回访入口语义，但中途一度把注意力集中到 NewTone 是否冒烟、是否发热、烟怎么飘、节点怎么亮。

这使施工从产品交互滑向尚未准备好的动态 Logo 制作。

正确判断应该是：

第一版先用结构和颜色完成状态表达。只有未来有正式 SVG、mask、路径动画或专门美术资源时，再重新讨论余烬、烟和流光。

### 4.2 把“统一转场”误解为“统一动画”

用户要的是大部分场景不再硬切，这确实需要统一基础设施。

但统一基础设施不等于每个路径使用同一视觉。

本轮前期把这两件事绑在一起，导致反复尝试让一个 overlay 同时表示：

- 进入中枢；
- 返回入口；
- 回到阅读；
- 退出阅读。

结果每个方向都不够明确。

### 4.3 过度依赖参数微调，太晚检查真实结构

和 A 方向类似，本轮多次出现连续调整 opacity、scale、duration 后用户仍然看不到变化。

这个时候真正该查的是：

- 组件有没有渲染；
- class 有没有挂上；
- preset 有没有解析成功；
- z-index 顺序；
- currentView 在哪个 phase 切换；
- PageShell 是否包住了真正的页面；
- overlay 是否过早遮盖 PageShell。

`fade-cover` 的 falsy bug 就是典型例子。继续调 CSS 永远解决不了组件未渲染。

### 4.4 同时改太多层，导致无法判断哪一层有效

当 transitionStore timing、PageShell keyframe、overlay background、label、coveredHold、entering opacity 一起变化时，即使体验变好，也难以知道是哪个改动生效；体验没变时，也无法定位哪个层失效。

后续应严格按层验收：

1. 调度是否正确；
2. overlay 是否完全覆盖；
3. view 是否在 covered 切换；
4. leaving 是否可见；
5. entering 是否自然；
6. 路径语义是否成立。

### 4.5 过早考虑 V5 长期统一

把 Landing → Reader 纳入 `transitionTo()` 从架构上看很整齐，但当前会把最复杂的一条入口链路重新打开。

本轮后期及时冻结了这个方向。当前项目更需要稳定，而不是 API 形式上的完全统一。

---

## 5. 修正方向

### 5.1 第一版先完成语义，不提前制作资产

当结构已经清楚表达状态时，不要继续用特效证明状态存在。

B2 当前通过：

- 上下方向；
- 提示文案；
- NewTone 暖色；

已经完成解锁表达。后续不再主动添加烟、火、流光或额外图形。

### 5.2 保留统一调度，视觉按路径独立设计

以后新增路径时，先回答四个问题：

1. 起点页面是什么？
2. 终点页面是什么？
3. 旧页面应该怎样离场？
4. 新页面应该怎样出现？

然后再决定 preset，而不是先从现有 preset 中随便挑一个。

### 5.3 连续两轮无可见变化时，立即停止调参数

必须检查真实代码：

- JSX 渲染条件；
- className；
- Zustand state；
- preset 解析；
- DOM 层级；
- z-index；
- keyframe；
- timing；
- view 切换点。

不要继续用“再亮一点、再慢一点、再缩一点”推进。

### 5.4 每次只收一条路径

本轮后半段的正确节奏是：

- 先修 Reader → Center；
- 用户确认顶部和底部都成立；
- 再修 Reader → Landing；
- 其它路径不动。

以后继续保持这个方式。不要在一次指令里同时大改五条路径。

### 5.5 页面离场与遮罩必须分工

PageShell 负责用户能看到的页面退场或入场。

GlobalTransitionScene 负责：

- 完全遮盖；
- phase 隔离；
- 路径 label；
- 给 view 切换提供安全区。

不要让 GlobalTransitionScene 同时承担所有空间方向，也不要让 PageShell 单独承担遮盖职责。

### 5.6 Landing → Reader 单独盘点

下一轮进入 ReadingTransition 前，必须先输出完整真实状态链，包括：

- Landing 触发；
- `App.handleEnter`；
- `readingTransitioning`；
- `transitionIntent`；
- Reader 挂载条件；
- `onReaderReady`；
- LanguageInit；
- 内部 phase；
- timer；
- minimum duration；
- fade out；
- unmount；
- Reader 可见时机。

没有这张状态图，不直接动代码。

---

## 6. 继承禁区与本轮新增禁区

上一轮已经写入的项目级长期禁区继续全部生效。本轮不能因为工作重点从 A 转向 B 与 Global Transition，就把旧禁区删除或替换。以下先完整继承上一轮禁区，再追加本轮新产生的禁区。

### 6.1 上一轮继续生效的项目级禁区

不要恢复旧 Reader preview 滑入方案。

不要重新引入 `inertPreview / previewPhase / previewScrollY / onPreviewReady`。

不要重新创建旧用途的 `AppTransition.css`。

不要把 `maxReadPhase` 当继续阅读书签。

不要改变 `lastScrollY > lastReadPhase > maxReadPhase` 的恢复优先级。

不要让点击 NewTone 直接进入 Reader。

不要让语言选择完成后自动进入 Reader。

不要把语言选择做成 dropdown、settings panel、白底菜单、radio、checkbox 或国旗列表。

不要恢复 7 语言环形星图作为当前第一版方案。环形星图不是永久禁止，但当前版本不要做。

不要把语言候选列表每次用 `ALL_LANGS.filter(l !== language)` 重新生成并导致全体重排。语言切换必须只交换旧当前语言和被点击 slot。

不要让当前语言出现在候选语言阵列中。

不要让 hover 直接切换语言。hover 只能发亮或展开，click/tap 才能切换。

不要把桌面 click toggle 当成主要展开逻辑。桌面端以 hover 展开；touch 端才用 tap toggle。

不要让展开层在桌面端无法通过外部点击关闭。

不要让按钮默认态使用两套视觉系统。`继续读取` 与 `是否变更` 默认态必须同框、同色、同尺寸。

不要让按钮 hover 态使用两套系统。两个按钮都走幕布式 hover；一个换字，一个不换字。

不要在按钮入场时同时叠加外层弹入、scale 抖动、translate 抖动、opacity 抖动、文字 scramble。第一版使用“空框淡入 → 文字 scramble”。

不要在一个视觉问题连续两轮失败后继续猜。必须要求输出真实 JSX / CSS / 状态代码再判断。

不要为了“看起来酷”新增故障抖动。任何新增特效必须先确认不会破坏状态顺序和可操作性。

### 6.2 本轮新增禁区

#### B2 / Landing

不要恢复 NewTone 下方常驻的普通“进入中枢”文字按钮。

不要把 Landing 改成 Reader / Center 的并列菜单页。

不要让中枢未解锁时出现上行入口。

不要让向上进入 Center 的新逻辑破坏向下继续读取。

不要让点击 NewTone 直接进入 Center。

不要恢复 `.landing-title-smoke`、`.landing-smoke-wisp` 或 smoke keyframes。

不要恢复火苗、浓烟、粒子喷射、持续 glitch、流光尾巴和过重 ember hotspot。

不要把暖色解锁态做成高亮金色 Logo、火焰字或游戏奖励状态。

不要改变 `centerUnlocked` 由 `completeM4()` 设置的核心语义。

不要为了 B2 重构 Landing / Reader / Center 的整体状态机。

#### Global Transition

不要废弃 `transitionTo(targetView, options)` 已成立的 API。

不要破坏 transitionStore 的：

`idle → leaving → covered → entering → idle`

状态顺序。

不要移除 `phase !== 'idle'` 的重复触发保护。

不要在 leaving 阶段提前切换真实 view。

不要让 GlobalTransitionScene 使用明显透底的背景。

不要把路径 label 直接压在真实页面上。

不要重新把所有路径合并为同一个视觉 preset。

不要只改 overlay 色值，就宣称路径语义已经改变。

不要让 PageShell timing 与 transitionStore timing 无故失配。

不要在一次施工里同时重写所有路径。

不要因为 `fade-cover` 当前没有主动调用就删除 fallback。

不要把 Landing → Reader 强行并入当前 Global Transition。

不要动 `hasInitializedLanguage`。

不要动 LanguageInit 主流程。

不要改变 Reader 恢复优先级。

不要恢复旧 Reader preview。

不要为了形式统一重新创建旧用途的 `AppTransition.css`。


---

## 7. 待决事项

### 7.1 Landing → Reader 内部阶段顺滑化

这是下一轮最明确的施工项。

当前需要确认和处理：

- Landing 触发后，ReadingTransition 首屏是否直接硬切；
- 首次用户与老用户是否走不同 phase；
- LanguageInit 完成后如何回到 ReadingTransition；
- “开始读取”与“继续读取”是否共用结束逻辑；
- Reader ready 何时到达；
- 最小时长由谁控制；
- ReadingTransition 何时开始淡出；
- Reader 何时真正可见；
- overlay unmount 是否早于正文稳定；
- 白屏来自背景、opacity、display 还是 currentView；
- LanguageInit 各内部状态是否需要最小 crossfade。

### 7.2 移动端集中验收

当前 A、B2 和 Global Transition 主要完成桌面端验收。

移动端仍需后续集中检查：

- Landing 上下手势映射；
- 浏览器回弹；
- wheel 与 touch 方向一致性；
- 一次手势是否重复触发；
- LanguageInit tap 展开与外部关闭；
- PageShell scale 对 fixed 元素的影响；
- 低性能设备动画；
- safe area；
- Center / Reader 返回入口。

当前暂不作为下一步第一优先级。

### 7.3 B1 是否需要单独补验收

B1 当前“Reader 读到 M4 → 解锁中枢 → 首次进入 Center”已经存在，但本轮主要处理的是 B2。

后续需要决定是否补一个很短的 B1 验收记录，包括：

- M4 入口出现时机；
- 首次进入 Center；
- `centerUnlocked` 持久化；
- 返回后 B2 出现；
- reset 后清空。

### 7.4 C 方向正式 0.1 内容骨架

尚未进入实施。

仍需确定：

- 正文主线职责；
- records 职责；
- perspectives 职责；
- fragments 职责；
- 它们在 Reader 与 Center 中如何出现；
- Center 是目录、世界中枢还是叙事层；
- 第一版最小占位和真实内容比例。

### 7.5 Center 正式信息架构

当前 Center 已经可进入、可返回，也接入全局转场，但其长期内容层级仍未定型。

本轮不等于 Center 内容完成。

### 7.6 NewTone 字标高级动效

烟、余烬和流光不是永久禁止，而是当前第一版禁用。

未来只有在以下条件成立时再评估：

- 有正式 SVG 或 mask；
- 有明确动画路径；
- 不与上下提示竞争；
- 能在移动端降级；
- 动效服务世界状态，不只是装饰；
- 不影响 Landing 极简。

### 7.7 ReadingTransition 是否长期并入 transitionTo

长期保留评估，但当前不做。

只有当 ReadingTransition 内部状态稳定、首次与老用户分支清晰、Reader ready 契约固定后，才有资格讨论统一。

---

## 8. 当前状态

### A 方向

首次语言初始化层第一版已完成。

桌面端已通过视觉验收。

当前保留：

- `hasInitializedLanguage`
- ReadingTransition overlay
- LanguageInit
- 当前语言确认
- “继续读取 / 是否变更”
- 2+3 语言阵列
- 只交换当前语言与被点击语言
- `lastScrollY > lastReadPhase > maxReadPhase`

移动端暂缓集中验收。

### B1

Reader 内 M4 中枢解锁与首次入口已经存在并可用。

本轮未重做其主体。

### B2

Landing 回访入口第一版已完成并封口。

最终形态：

- 未解锁：单向向下进入 Reader；
- 已解锁：上行 Center、下行 Reader；
- NewTone 保持中间互动锚点；
- NewTone 解锁后变为克制暖色；
- 不使用烟、火、流光或复杂动态资产。

### Global Transition

第一版已完成并封口。

统一基础设施成立：

- `transitionTo`
- transitionStore
- phase 状态机
- covered 切 view
- duplicate trigger guard
- GlobalTransitionScene
- PageShell
- route preset

用户侧已确认路径：

- Landing → Center：OK
- Reader → Center：OK
- Reader → Landing：OK
- Center → Landing：OK
- Center → Reader：OK

Landing → Reader 仍为独立 ReadingTransition。

### C 方向

尚未正式开始实施。

### 构建状态

最近一次记录：

```text
vite build
✓ built in ~100ms
0 errors

CSS: 16.19 kB
JS: 219.66 kB
```

```text
oxlint
0 errors
1 warning
```

warning 位于 `progressStore.js`，属于既有 warning，本轮未新增。

---

## 9. 下一步规划

下一轮不要继续调整 B2，也不要继续调整已通过的五条 Global Transition 路径。

正确顺序如下：

### 第一步：冻结当前转场基线

先保留当前：

- 所有 preset；
- timing；
- PageShell keyframe；
- GlobalTransitionScene；
- label；
- 路径调用点。

除阻断级 bug 外，不再继续“顺手优化”。

### 第二步：盘点 Landing → Reader 完整状态链

要求 OpenCode 不改代码，先输出：

- `Landing.jsx` 触发点；
- `App.handleEnter`；
- `readingTransitioning`；
- `transitionIntent`；
- `showReader / showLanding` 条件；
- `ReadingTransition.jsx` phase；
- `LanguageInit` 条件；
- `onReaderReady`；
- minimum duration；
- fade out；
- completion callback；
- 组件 unmount；
- 相关 CSS。

然后画出首次用户与老用户两条真实时序。

### 第三步：优先修最明显硬切

优先处理：

**“开始读取 / 继续读取”触发后，到 Reader 正文出现之间的硬切。**

这一处是当前用户最直接能感知的问题。

只修这一个衔接，不同时重写 LanguageInit。

### 第四步：处理 LanguageInit 完成后的衔接

确认语言后，不应突然切回另一层或直接出现正文。

需要建立最小且明确的：

- 当前语言确认完成；
- LanguageInit 离场；
- ReadingTransition 接管；
- Reader ready；
- 正文显现；

顺序。

### 第五步：桌面端完整验收

至少验收：

- 首次进入；
- 老用户继续读取；
- 语言变更后进入；
- 从 Landing 继续阅读；
- 刷新；
- 返回；
- 快速重复操作；
- Reader 尚未 ready；
- Reader 已 ready 但 minimum duration 未满足。

### 第六步：决定移动端验收或进入 C

Landing → Reader 收口后，再根据项目节奏选择：

- 先做 A + B + 转场的移动端集中验收；
- 或进入 C 方向正式 0.1 内容骨架。

推荐仍然是先补一次移动端核心路径验收，再开 C，避免结构继续扩大后才发现触摸入口存在基础问题。

最终推荐主线：

**ReadingTransition 真实状态盘点 → 开始读取到正文硬切修正 → LanguageInit 衔接修正 → 桌面验收 → 移动端核心路径验收 → C 方向内容骨架。**

---

## 10. 本轮总结

本轮不是只完成了一个“中枢入口”，而是完成了从入口语义到页面导航基础设施的一整段收口。

B2 最终把 Landing 从普通页面导航改成了上下两层空间的交界面：

- 上行进入中枢；
- 下行继续读取；
- NewTone 作为中间锚点；
- 暖色代表系统状态已经改变。

随后建立的 Global Transition 又解决了 Landing、Reader、Center 之间大量裸切的问题。

本轮最重要的架构结论是：

**统一调度，不统一视觉。**

`transitionTo / transitionStore / GlobalTransitionScene / PageShell` 组成公共骨架；每条路径根据自己的语义拥有独立 preset 和离场方式。

本轮最重要的产品结论是：

**第一版的状态表达应优先依靠结构和清晰反馈，不要过早依赖动态美术资产。**

本轮最重要的纠错经验是：

**连续两轮没有可见变化，就停止猜参数，查看真实代码、渲染条件、DOM 层级和状态时序。**

当前 B2 与 Global Transition 均已封口。下一步真正需要处理的，不再是全局页面转场，而是一直独立存在的 Landing → Reader 内部阶段硬切。
