# NewTone First World v0.1 工作日志

生成时间戳：2026-07-06 00:03:57 PDT
系统日期：2026-07-06
建议保存位置：D:\NewTone-Logs\NewTone_v0.1_Prototype_Log.md
项目位置：NewTone-V0.1
当前性质：Vite + React 前端交互原型
当前状态：功能闭环已跑通，但 0.1 内容与产品气质尚未完成

---

## 0. 项目总目标

本轮不是继续 patch 旧静态项目，而是新建一个干净、稳定、可长期迭代的 NewTone First World v0.1 / v2 原型。

旧项目只作为视觉、文案、交互参考，不直接复用旧 CSS、旧 JS、旧废案、旧组件。

本阶段目标不是最终视觉，也不是完整产品，而是建立一个可持续迭代的前端交互地基。

核心闭环：

Landing 初始入口  
→ 开始阅读  
→ Reader 阅读 M1-M4  
→ 滚到 M4 末尾触发 completeM4  
→ 解锁中枢  
→ 进入中枢  
→ 中枢 home  
→ 记录 / 视角 / 碎片  
→ 返回中枢  
→ 继续阅读  
→ 返回入口  
→ Landing unlocked  
→ 重置回初始

---

## 1. 技术选择

### 技术栈

使用：

- Vite
- React
- Zustand
- Plain CSS

暂不使用：

- 后端
- 数据库
- React Router
- Tailwind
- CSS Modules
- 复杂动画系统
- 复杂美术资产

### 状态管理选择

选择 Zustand。

原因：

Zustand 足够轻量，适合当前这种前端原型，但又能清楚管理：

- currentView
- currentReadingPhase
- maxReadPhase
- centerUnlocked
- centerMode
- resumeRequested
- localStorage persist

相比 React Context + useReducer，Zustand 更少 boilerplate，也更适合防止多个组件私自管理状态。

### 样式方案选择

选择 Plain CSS。

原因：

当前阶段更需要结构清楚，而不是复杂样式工程。Plain CSS 配合：

- tokens.css
- Landing.css
- Reader.css
- Center.css
- CenterNav.css

已经足够。

禁止用 Tailwind，避免页面滑向 SaaS / dashboard / onboarding / 卡片墙风格。

### 正文数据来源

选择本地 JS 数据文件。

当前使用：

`src/data/novel.js`

格式为结构化数据，不是 Markdown，不是全文字符串解析。

原因：

Reader 不应该解析正文里的标记，而应该直接读取结构化字段。

---

## 2. 最终项目结构

当前项目结构大致为：

```text
NewTone-V0.1/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── styles/
│   │   └── tokens.css
│   ├── stores/
│   │   └── progressStore.js
│   ├── constants/
│   │   └── phases.js
│   ├── views/
│   │   ├── Landing.jsx
│   │   ├── Landing.css
│   │   ├── Reader.jsx
│   │   ├── Reader.css
│   │   ├── Center.jsx
│   │   └── Center.css
│   ├── components/
│   │   ├── CenterNav.jsx
│   │   └── CenterNav.css
│   └── data/
│       ├── novel.js
│       ├── records.js
│       ├── perspectives.js
│       └── fragments.js
```

注意：

以后压缩给审查时，不要带：

- node_modules
- dist

只需要传源码、package.json、package-lock.json、vite.config.js、index.html。

之前多次因为 Windows 打包来的 node_modules 产生 vite permission denied 问题。

---

## 3. 核心状态模型

### persisted state

以下字段持久化到 localStorage：

- maxReadPhase
- centerUnlocked
- centerMode

localStorage key：

`newtone-progress-v1`

持久化结构带 `_version`。

### session state

以下字段不持久化：

- currentView
- currentReadingPhase
- resumeRequested

刷新页面后 currentView 应回到 landing，而不是直接恢复 reader 或 center。

### currentView

取值：

- landing
- reader
- center

含义：

当前全局视图。

### currentReadingPhase

取值：

- null
- M1
- M2
- M3
- M4

含义：

当前视口阅读阶段。

可以随着滚动前进和回退。

不代表历史最高进度。

不持久化。

### maxReadPhase

取值：

- null
- M1
- M2
- M3
- M4

含义：

历史最高阅读进度。

只能前进，不能因为回滚降低。

持久化。

### centerUnlocked

取值：

- false
- true

含义：

中枢是否解锁。

只有 completeM4 后变 true。

一旦 true，不因为回滚 false。

持久化。

### centerMode

取值：

- home
- records
- perspectives
- fragments

含义：

中枢内部模式。

持久化，但刷新后仍从 Landing 进入。

进入中枢时默认回 home。

### resumeRequested

取值：

- false
- true

含义：

是否由「继续阅读」触发 Reader 自动滚动。

`startReading()` 不触发自动滚动。

`continueReading()` 设置为 true。

Reader mount 后读取这个 intent，自己 scrollIntoView 到 maxReadPhase 对应 block，然后 clearResumeRequest。

不持久化。

---

## 4. progressStore 当前职责

文件：

`src/stores/progressStore.js`

职责：

- 作为唯一业务状态源
- 管理 currentView
- 管理 currentReadingPhase
- 管理 maxReadPhase
- 管理 centerUnlocked
- 管理 centerMode
- 管理 resumeRequested
- 管理 localStorage persist
- 管理 reset
- 管理合法性校验 / sanitize

不负责：

- 渲染 UI
- 操作 DOM
- scrollIntoView
- 监听滚动
- 写 CSS class
- 解析正文

### 当前 action

应包含：

- startReading()
- continueReading()
- clearResumeRequest()
- setPhase(phase)
- completeM4()
- enterCenter()
- goLanding()
- setCenterMode(mode)
- reset()

### startReading()

行为：

- currentView = 'reader'
- currentReadingPhase = null
- resumeRequested = false
- 不清空 maxReadPhase
- 不操作 DOM
- 不滚动

说明：

只用于无进度时开始阅读。

若已有进度，Landing 不显示「开始阅读」，显示「继续阅读」。

### continueReading()

行为：

- currentView = 'reader'
- resumeRequested = true
- 不操作 DOM
- 不滚动

说明：

store 只表达继续阅读意图。

Reader 负责实际 scrollIntoView。

### clearResumeRequest()

行为：

- resumeRequested = false

### setPhase(phase)

行为：

- 非法 phase 忽略
- 与 currentReadingPhase 相同则忽略
- 更新 currentReadingPhase
- 如果 phase 高于 maxReadPhase，则推进 maxReadPhase
- currentReadingPhase 可前进可回退
- maxReadPhase 只能前进

### completeM4()

当前修正后行为：

- setPhase('M4')
- currentReadingPhase = 'M4'
- maxReadPhase = 'M4'
- centerUnlocked = true

说明：

之前 completeM4 依赖 currentReadingPhase === M4，导致 M4 sentinel 到了但 phase 仍停在 M3 时无法解锁。

后来改为 end sentinel 进入视口时无条件：

- setPhase('M4')
- completeM4()

这样更稳定。

### enterCenter()

行为：

- 如果 centerUnlocked !== true，return
- 如果 centerUnlocked === true：
  - currentView = 'center'
  - centerMode = 'home'

说明：

组件不能直接 set currentView。

进入中枢必须通过 enterCenter。

### goLanding()

行为：

- currentView = 'landing'

### setCenterMode(mode)

行为：

只接受：

- home
- records
- perspectives
- fragments

非法值回退 home。

### reset()

行为：

- 恢复 initialState
- 清 localStorage

---

## 5. phase 工具

文件：

`src/constants/phases.js`

当前方向：

```js
export const PHASES = ['M1', 'M2', 'M3', 'M4'];

export const getPhaseRank = (phase) =>
  PHASES.includes(phase) ? PHASES.indexOf(phase) : -1;

export const isValidPhase = (phase) =>
  getPhaseRank(phase) !== -1;

export const isAfter = (a, b) =>
  getPhaseRank(a) > getPhaseRank(b);
```

说明：

所有 phase 合法性和比较逻辑应集中在 phases.js。

不要在多个文件里手写 M1-M4 比较。

---

## 6. App 分发原则

文件：

`src/App.jsx`

职责：

只根据 currentView 三选一渲染：

- Landing
- Reader
- Center

不负责：

- localStorage
- phase 判断
- 解锁判断
- DOM 操作
- 滚动检测
- 中枢内部 mode 判断

---

## 7. Landing 当前状态

文件：

- `src/views/Landing.jsx`
- `src/views/Landing.css`

当前行为：

### 无进度时

如果 `maxReadPhase === null`：

只显示：

- 开始阅读

点击调用：

- startReading()

### 有进度时

如果 `maxReadPhase !== null`：

显示：

- 继续阅读

点击调用：

- continueReading()

### 中枢解锁后

如果 `centerUnlocked === true`：

额外显示：

- 进入中枢

点击调用：

- enterCenter()

### reset

右下角显示低调但可见的：

- 重置

点击调用：

- reset()

最初 reset 是一个极小的 `—`，用户实际找不到。

后来改成「重置」，字号、颜色、padding、hover 都提升了一点。

### 当前视觉

- 暗色背景
- 冷蓝灰文字
- 居中 NewTone 标题
- 文字按钮
- reset 右下角

### 已发现并修复的问题

问题：

Landing 曾经同时显示「开始阅读」和「继续阅读」，语义混乱。

修正：

- 无进度只显示「开始阅读」
- 有进度显示「继续阅读」
- centerUnlocked 后额外显示「进入中枢」

---

## 8. Reader 当前状态

文件：

- `src/views/Reader.jsx`
- `src/views/Reader.css`

职责：

- 渲染 readingBlocks
- 渲染段落文本
- 检测当前视口主导 phase
- 调用 setPhase
- 监听 end sentinel
- 触发 completeM4
- 显示返回入口
- 显示进入中枢
- 处理 continueReading 的 scrollIntoView

不负责：

- 直接改 currentView
- 直接写 localStorage
- 自己维护 maxReadPhase
- 自己维护 centerUnlocked
- 渲染 Center

### Reader phase 检测

当前策略：

- 每个 block 挂 sentinel / ref
- IntersectionObserver 维护 visibleBlocks Set
- 只从当前可见 blocks 中选择最接近视口垂直中心线的 block
- 选中 block 后调用 setPhase(block.phase)
- observer 回调中使用 useProgressStore.getState()，避免 stale closure
- 不在 render 遍历时 setPhase
- paragraphs[] 只用于文本渲染，不参与状态推进

### M4 complete

当前策略：

最后一个 block 后有 end sentinel。

当 end sentinel 进入视口时：

- 调用 setPhase('M4')
- 调用 completeM4()

不再依赖：

`currentReadingPhase === 'M4'`

原因：

实测中页面滚到底时 currentReadingPhase 可能仍停在 M3，导致无法解锁。

### Reader 导航

Reader 顶部 / 底部有：

- 返回入口
- 进入中枢（centerUnlocked 后显示）

按钮 action 通过 selector 获取：

- goLanding
- enterCenter

observer 回调仍可用 getState。

### 当前视觉

- 暗色背景
- 冷蓝灰正文
- 文献/阅读式宽度
- 顶部和底部 action 区有 subtle border
- 右上角显示当前 phase tag
- phase tag 低调显示

### 已发现并修复的问题

问题 1：

占位正文太短，无法形成真实滚动，phase 和 M4 sentinel 无法稳定触发。

修正：

`src/data/novel.js` 每 block 从 3 段扩展到 10 段，总计 40 段。

问题 2：

currentReadingPhase 停在 M3，end sentinel 因判断 currentReadingPhase === M4 而不触发 completeM4。

修正：

end sentinel 进入视口时无条件 setPhase('M4') 再 completeM4。

问题 3：

按钮里曾经用 useProgressStore.getState().goLanding()。

修正：

普通按钮 action 用 selector。

observer 回调保留 getState。

---

## 9. Center 当前状态

文件：

- `src/views/Center.jsx`
- `src/views/Center.css`
- `src/components/CenterNav.jsx`
- `src/components/CenterNav.css`

当前命名：

统一使用「中枢」，不再使用「中心」。

已修正：

- 「进入中心」→「进入中枢」
- h1「中心」→「中枢」
- 「欢迎来到中心」→「欢迎来到中枢」

### Center 结构

Center 支持：

- home
- records
- perspectives
- fragments

### Center home

显示：

- 中枢标题
- CenterNav
- 欢迎来到中枢

顶部 action：

- 继续阅读
- 返回入口

### CenterNav

职责：

- 显示「记录 / 视角 / 碎片」三个文字入口
- 点击后调用 setCenterMode(mode)

不负责：

- 渲染子页面
- 读取数据
- 进入 Reader
- 返回 Landing
- 写 localStorage
- 判断 currentView

最初 CenterNav 使用 span onClick。

后来修正为 button，提高语义和可访问性。

视觉上仍是低调文字入口，不是 tab bar。

### 子页面

records / perspectives / fragments 都由 Center.jsx 根据 centerMode 统一渲染。

数据通过 MODE_DATA 映射。

三类数据使用同一套 schema：

```js
{
  id: string,
  label: string,
  title: string,
  text: string
}
```

不再出现 records 用 content、perspectives 用 description、fragments 用 text 的混乱结构。

### 当前视觉

- 暗色
- 冷蓝灰
- 文字入口
- 文献式列表
- border-bottom 分割
- 无卡片墙
- 无 dashboard
- 无游戏菜单

---

## 10. 数据文件当前状态

### novel.js

当前仍是 placeholder 内容。

结构：

```js
export const readingBlocks = [
  {
    id: 'm1',
    phase: 'M1',
    paragraphs: [...]
  },
  ...
]
```

当前每个 block 有约 10 段测试文字。

目的：

- 撑开页面高度
- 测试滚动
- 测试 IntersectionObserver
- 测试 M1-M4
- 测试 M4 complete

不是正式小说正文。

### records.js

使用统一 schema：

```js
{
  id,
  label,
  title,
  text
}
```

当前是 placeholder。

### perspectives.js

使用统一 schema：

```js
{
  id,
  label,
  title,
  text
}
```

当前是 placeholder。

### fragments.js

使用统一 schema：

```js
{
  id,
  label,
  title,
  text
}
```

当前是 placeholder。

---

## 11. CSS 当前状态

新增：

`src/styles/tokens.css`

并在：

`src/main.jsx`

中 import：

```js
import './styles/tokens.css'
```

tokens.css 中包含：

- --bg-*
- --text-*
- --accent-*
- --font-*
- --space-*
- --border-subtle
- --opacity-dim

当前 CSS 文件：

- Landing.css
- Reader.css
- Center.css
- CenterNav.css

### CSS 原则

允许：

- 暗色
- 冷蓝灰
- typographic/editorial
- 基础间距
- 低调文字按钮
- subtle border
- 文献式列表

禁止：

- dashboard
- tab bar
- 卡片墙
- 游戏菜单
- 大背景图
- 手机 App onboarding
- SaaS landing page
- 霓虹赛博朋克
- 大量发光按钮
- 大量圆角卡片
- CSS 承担业务状态
- body class 作为业务状态来源

### index.html

曾在 index.html 增加少量 style 用于 body 背景、字体、抗锯齿。

当前可暂时接受。

后续建议：

不要继续往 index.html 塞样式。

如果需要，可收回到 tokens.css 或新增 base.css。

---

## 12. 已完成轮次日志

### 初始方向确认

决定：

不 patch 旧静态项目。

新建 NewTone First World v0.1 / v2。

旧项目只作为参考。

目标是建立长期可迭代地基。

### 技术选择轮

问题：

状态管理用什么？

选择：

Zustand。

原因：

轻量、状态集中、支持 persist/subscribe，中长期比 Context + useReducer 更合适。

问题：

样式方案？

选择：

Plain CSS。

原因：

简单直接，适合小项目，避免 Tailwind 带来 SaaS/dashboard 风格。

问题：

Reader 正文数据从哪里来？

选择：

本地 JS 数据文件。

原因：

Reader 需要结构化 phase 数据，不适合用全文字符串或 Markdown 解析。

### 架构规划轮

明确：

- currentView
- currentReadingPhase
- maxReadPhase
- centerUnlocked
- centerMode
- resumeRequested

明确：

- persisted state 与 session state 分离
- store 不操作 DOM
- Reader 负责 scrollIntoView
- CSS 不承担业务状态
- CenterNav 不渲染子页面

### v0.1 第一版代码审查

发现问题：

1. Reader 直接 set currentView = center，绕过 store action
2. completeM4 只设置 maxReadPhase 和 centerUnlocked，不够完整
3. loadPersisted 没有 sanitize
4. continueReading 和 startReading 的滚动行为混在一起

建议修复：

- 加 enterCenter()
- completeM4 补 currentReadingPhase = M4
- loadPersisted sanitize
- 加 resumeRequested / clearResumeRequest

### v0.1 第二版代码审查

修复内容：

- Reader 调 enterCenter
- completeM4 补完整
- localStorage 只持久化 persisted keys
- start / continue 分离
- CenterNav 职责合格

仍建议：

- Reader phase 只从 visibleBlocks 里判断
- persist 只在 persisted keys 变化时保存
- Center 数据 schema 统一
- 不压缩 node_modules / dist

### 功能闭环施工轮

新增：

- goLanding()
- Landing unlocked 进入中枢
- Reader 返回入口
- Center 继续阅读 / 返回入口
- Center 子页面返回 home
- Center 数据统一渲染
- records / perspectives / fragments schema 统一

审查结论：

代码闭环基本可用，但仍存在小体验问题：

- Landing 同时显示开始/继续，语义乱
- Reader 普通按钮用 getState，不够标准
- CenterNav span onClick 语义问题

### 原型收口轮

修改：

- 新增 tokens.css
- main.jsx 引入 tokens.css
- Landing 按钮逻辑重写
- Reader action 改 selector
- CenterNav span 改 button
- Landing / Reader / Center / CenterNav CSS 改用 token
- Center 改为文献式列表
- Reset 仍太隐形

审查结论：

视觉基调初步成立。

但本地实测发现功能没有真正跑通：

- reset 看不到
- Reader 内容太短
- 无法稳定滚动
- M4 没触发
- 没出现进入中枢

### 功能验收修复轮

修改 5 个文件：

`src/data/novel.js`

- 每 block 从 3 段扩展到 10 段
- 总计 40 段
- 使用 placeholder 工厂
- 确保页面高度可触发滚动检测

`src/views/Reader.jsx`

- sentinel 回调改为无条件 setPhase('M4') 再 completeM4()
- 不再依赖 currentReadingPhase === 'M4'
- 「进入中心」改为「进入中枢」

`src/views/Landing.jsx`

- reset 按钮文案从 `—` 改为「重置」
- 「进入中心」改为「进入中枢」

`src/views/Landing.css`

- reset 字号从 xs 提升到 sm
- 颜色从 text-dim 改为 text-muted
- 去掉 opacity: 0.4
- 增加 padding 和 letter-spacing
- hover 变明亮

`src/views/Center.jsx`

- h1「中心」改为「中枢」
- 「欢迎来到中心」改为「欢迎来到中枢」

本地截图验收结果：

- Landing 显示继续阅读 / 进入中枢 / 重置
- Reader 可滚动
- 右上角 phase 到 M4
- Reader 底部出现进入中枢
- 点击进入中枢成功
- Center home 正常
- records / perspectives / fragments 可进入
- 子页面可返回
- 闭环成立

结论：

功能闭环已跑通。

---

## 13. 当前实际状态

当前不是最终 0.1。

当前是：

NewTone First World v0.1  
Prototype Loop Complete  
最小阅读-解锁-中枢闭环完成

已完成：

- Vite + React 项目壳
- Zustand store
- Plain CSS
- tokens.css
- Landing
- Reader
- Center
- CenterNav
- localStorage progress
- reset
- start/continue 分离
- Reader phase 检测
- M4 complete
- 中枢解锁
- Center records / perspectives / fragments
- 基础暗色冷蓝灰视觉
- 文献式列表

未完成：

- 正式 0.1 文本
- 真正的旧雨 / 第一世界阅读内容
- 真实 records
- 真实 perspectives
- 真实 fragments
- Landing 产品语义
- Reader 阅读节奏
- 中枢空间感
- 中枢显影感
- 更精细 typographic 视觉
- 交互细节
- 动效
- 移动端适配
- build/deploy 验证
- 正式发布结构

---

## 14. 当前本地验收流程

如果之后新窗口或新施工方要继续，先按这个验收：

1. 启动项目

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:5173/
```

不要直接双击 index.html。

Vite + React 项目必须通过 dev server 运行。

2. 清空状态

点 Landing 右下角「重置」。

或者清 localStorage：

`newtone-progress-v1`

3. 初始 Landing

应只显示：

- NewTone
- 开始阅读
- 重置

不应显示：

- 继续阅读
- 进入中枢

4. 点击开始阅读

进入 Reader。

5. Reader 滚动

页面应可上下滚动。

右上角 phase 应从：

M1 → M2 → M3 → M4

6. 滚到底部

应出现：

- 返回入口
- 进入中枢

7. 点击进入中枢

进入 Center home。

8. Center home

应显示：

- 继续阅读
- 返回入口
- 中枢
- 记录
- 视角
- 碎片
- 欢迎来到中枢

9. 子页面

点击：

- 记录
- 视角
- 碎片

都应进入对应列表。

子页面应有：

- ← 返回

返回 center home。

10. 回 Landing

返回入口后 Landing 应显示：

- 继续阅读
- 进入中枢
- 重置

11. 刷新

刷新页面后应回 Landing，但保留：

- 继续阅读
- 进入中枢

12. 重置

点击重置后回初始状态。

---

## 15. 当前已知注意事项

### 不要再重构地基

当前功能闭环已经跑通。

下一步不要继续重构 store / Reader / Center 结构。

后续应该在此基础上替换内容和打磨气质。

### 不要再往 index.html 塞样式

index.html 只保留必要基础。

后续通用样式应放：

- tokens.css
- base.css（如果需要）

### 不要压缩 node_modules / dist

以后给审查时只传源码。

不要带：

- node_modules
- dist

否则跨系统可能出现 vite permission denied。

### 直接打开 HTML 是错的

Vite 项目不能双击 index.html。

必须：

```bash
npm run dev
```

或：

```bash
npm run build
npm run preview
```

### 现在的内容是 placeholder

当前 novel / records / perspectives / fragments 都不是正式内容。

现在页面空，不代表产品方向错。

只是 0.1 正式内容还没有放入。

---

## 16. 下一阶段规划

当前 0.1 还没构筑完。

下一阶段应分成几层，不要混着做。

---

### Phase A：0.1 内容替换

目标：

把测试占位数据换成真正 NewTone First World 0.1 内容。

优先文件：

- `src/data/novel.js`
- `src/data/records.js`
- `src/data/perspectives.js`
- `src/data/fragments.js`

#### novel.js

要替换为真实阅读文本。

保留结构：

```js
export const readingBlocks = [
  {
    id: 'm1',
    phase: 'M1',
    paragraphs: [...]
  },
  ...
]
```

M1-M4 不一定是“乐章”这个文案，后续可以根据产品语义重命名，但 phase 字段暂时保持 M1-M4。

建议：

- 每个 block 仍保持足够段落，确保滚动检测正常
- 不要让 M4 太短，否则解锁节奏会怪
- 正式内容不要塞在 JSX 里
- 不要让 Reader 硬编码正文

#### records.js

替换成真实「记录」。

语义方向：

- 事件
- 档案
- 账本
- 痕迹
- 可以是世界观中的可归档材料

保持 schema：

```js
{
  id,
  label,
  title,
  text
}
```

#### perspectives.js

替换成真实「视角」。

语义方向：

- 人物视角
- 旁观者视角
- 叙述立场
- 对同一事件的不同理解

保持 schema：

```js
{
  id,
  label,
  title,
  text
}
```

#### fragments.js

替换成真实「碎片」。

语义方向：

- 残页
- 异文
- 断裂文本
- 不完整解释
- 后续世界观线索

保持 schema：

```js
{
  id,
  label,
  title,
  text
}
```

---

### Phase B：产品语义统一

当前部分文案已经改为「中枢」。

下一步需要统一全部产品语义。

建议统一：

- Center → 中枢
- records → 记录
- perspectives → 视角
- fragments → 碎片
- Landing → 入口
- Reader → 阅读层 / 正文层

需要检查：

- 所有页面文案
- CSS class 可以暂时保持英文，不影响
- 数据标题
- 按钮文案

特别注意：

「中枢」比「中心」更适合 NewTone。

不要再用「中心」。

---

### Phase C：Reader 阅读体验打磨

目标：

让 Reader 从“能读”变成“有作品感”。

不改架构，只改内容呈现和节奏。

可做：

- 段落间距调整
- 正文宽度调整
- 行高调整
- 字号微调
- phase tag 更像章节/乐章提示
- 顶部/底部 action 更低调
- M4 complete 后中枢入口显影更自然
- 阅读区域留白优化

禁止：

- 大动画
- 背景图
- 游戏式 UI
- 卡片化正文
- Reader 直接操作 Center 状态

---

### Phase D：Landing 入口气质打磨

当前 Landing 很空。

后续目标：

让 Landing 成为 NewTone First World 的入口，而不是普通标题页。

可做：

- 增加一行极短副标题
- 增加世界观式入口文案
- 标题字距 / 字重微调
- 按钮呈现更像“入口文字”，不是普通按钮
- reset 继续低调但可见

避免：

- SaaS hero page
- 大标题 marketing 文案
- onboarding 风格
- 卡片按钮
- 大量解释

---

### Phase E：中枢空间感打磨

当前中枢是干净文字区，但空间感还弱。

目标：

中枢应像：

- 阅读后的归档空间
- 文本后室
- 世界观入口层
- 档案层
- 不是 dashboard
- 不是游戏菜单
- 不是后台管理

可做：

- home 文案增强
- 记录 / 视角 / 碎片的入口语义增强
- 文献式条目排版
- 子页面标题层级
- 页面留白
- subtle line
- 进入中枢后的空间落差

避免：

- 卡片墙
- tab bar
- dashboard nav
- RPG 菜单框
- 霓虹按钮
- 图标堆叠

---

### Phase F：中枢显影 / 解锁反馈

当前 M4 complete 后直接出现「进入中枢」。

后续可以加轻量显影，但不是现在必须。

可做：

- 进入中枢按钮从 dim 到 normal
- 底部出现一句短文案
- 极轻 opacity transition
- 不超过 200-400ms

禁止：

- 复杂动画系统
- 粒子
- 大面积发光
- 过度游戏化

---

### Phase G：部署准备

等内容和视觉基本稳定后，再做：

- npm run build
- npm run preview
- 检查生产路径
- 检查 localStorage
- 检查移动端
- 检查刷新行为
- 检查 Vercel / Netlify / Cloudflare Pages 部署

当前还不急。

---

## 17. 下一窗口接手提示

如果把这份日志丢给下一个 ChatGPT / OpenCode / Codex，接手重点如下：

当前 NewTone-V0.1 已完成最小功能闭环。

不要重构地基。

不要重新设计状态层。

不要再改 Zustand / persist / Reader phase detection，除非有实际 bug。

下一步优先做：

1. 替换正式 0.1 内容
2. 统一文案语义
3. 打磨 Reader 阅读节奏
4. 打磨 Landing 入口气质
5. 打磨中枢空间感

当前真正缺的不是架构，而是：

- 内容
- 作品感
- 空间感
- 视觉精修

---

## 18. 当前版本一句话总结

NewTone-V0.1 当前已经完成：

“Landing → Reader → M1-M4 → M4 complete → 进入中枢 → 记录/视角/碎片 → 返回/继续阅读 → 持久化进度 → 重置”

的最小功能闭环。

但它仍然是 placeholder 原型。

0.1 还没有完成构筑。

下一步应在这个闭环上填入真正内容与气质，而不是继续重写底层。
