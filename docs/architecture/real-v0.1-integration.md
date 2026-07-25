# NewTone 真正的 V0.1：阶段 0–2 基线

## 产品母体

本分支 `integration/real-v0.1` 基于 `local-latest` 创建。

`local-latest` 继续作为 V0.0 产品基线，不在该分支上直接施工。真正的 V0.1 必须由 V0.0 的产品协议自然升级而来，而不是继续旧 V0.1 的重建路线。

## 阶段 0：冻结的产品协议

以下行为在 Center 底层迁移期间不得回归：

1. Landing 首次进入时执行语言与阅读模式仪式。
2. 已完成初始化后再次进入 Reader 时跳过仪式。
3. Reader 恢复到已提交的 phase/page/beat 位置。
4. Reader、Landing、Center 之间的换页继续经过现有转场协议。
5. Center 未解锁时不得通过历史记录或直接状态进入。
6. 浏览器前进/后退不得打断首次入口仪式。
7. reset 清除持久化进度并恢复初始体验。

## 迁移所有权

### 保留 V0.0 产品实现

- `src/App.jsx`
- `src/views/Landing.jsx`
- `src/views/Reader.jsx` 及 Reader 编排链
- `src/transitions/readingEntryController.js`
- `src/stores/transitionStore.js`
- `src/stores/progressStore.js` 的产品语义与迁移入口

### 从旧 V0.1 吸收的技术概念

- React 与 Phaser 的显式 Bridge
- Phaser Game Host 的生命周期边界
- 摄像机纯函数
- Center domain contracts
- 内容端口、存档端口与 schema 校验思想

### 不迁入旧 V0.1 的产品实现

- App 路由和 appStore
- EntryFlow、Landing、Reader、ReadingTransition
- 旧 CenterPage 和 center.css
- EdgeGuides
- 旧 WorldResolver 的模糊 progressRatio 规则
- 硬编码 Center 资产解析

## 阶段 1：增量工程策略

V0.0 保持 JavaScript 可运行；新的 Center 基础设施从 `src/center-next` 开始使用 TypeScript。Vite/Vitest 原生处理 `.ts` 文件，因此本阶段不修改现有运行时和锁文件。

Phaser 依赖在真正迁入 Game Host 的阶段再加入，避免阶段 0–2 引入未使用依赖、破坏 lockfile 或影响现有构建。当前阶段只定义运行时边界，不挂载 Phaser。

## 阶段 2：状态边界

### 持久化产品事实

- onboarding：语言/模式是否确认
- preferences：语言、阅读模式、主题、动态模式
- reader：committedLocation、furthestLocation、started、completed
- center world：进度阶段、图层 variant、解锁/访问地标
- center view：摄像机、展开度、活动图层、选中地标
- currentView

### 模块临时状态

以下状态不得写入产品存档：

- Landing 粒子、唤醒动画、手势锁
- Reader 输入累计、展示转场、焦点测量
- Center hover、投影锚点、pointer、dragging、tween、runtime ready

## Center 接线原则

1. ReaderPosition 沿用 V0.0 的 `{ phaseId, pageId, beatIndex }`。
2. Center 不得直接修改 App route；正式接入时必须调用 V0.0 navigation/transition 协议。
3. Phaser 只接收世界快照与视图快照，只发出业务事件和稳定视图变化。
4. React 不读取 Phaser 每帧内部状态。
5. Center runtime 必须提供 ready/error 握手，转场揭幕前完成恢复。
6. 摄像机属于可恢复的 Center view snapshot；hover、投影和 tween 不属于存档。

## 当前阶段完成定义

- 已建立独立施工分支。
- 已补充产品协议回归测试。
- 已建立混合 JS/TS 配置。
- 已定义 Center domain contracts、运行时端口和基础不变量。
- 未修改 Landing、Reader、Center 或现有 store 的运行行为。
