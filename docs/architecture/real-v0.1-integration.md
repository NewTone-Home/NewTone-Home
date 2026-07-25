# NewTone 真正的 V0.1：0.0 产品母体 + 新 Center 底层

## 产品母体

本分支 `integration/real-v0.1` 基于 `local-latest` 创建。

`local-latest` 是 V0.0 产品基线。真正的 V0.1 继续使用它已经成立的 Landing、Reader、入口仪式和页面转场，不采用旧 V0.1 从零重建产品页面的路线。

## 不得回归的产品协议

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
- 页面切换的 preset 和产品语义

### 从旧 V0.1 吸收并重写的技术能力

- React 与 Phaser 的显式 Bridge
- Phaser Game Host 生命周期
- 摄像机纯函数、拖动、缩放和恢复
- Center domain contracts
- 世界进度解析思想
- ZIP 内容包、Zod 校验和 IndexedDB 资产存储

### 没有迁入的旧 V0.1 产品实现

- App 路由和 appStore
- EntryFlow、Landing、Reader、ReadingTransition
- 旧 CenterPage、EdgeGuides 和 center.css
- 模糊的 progressRatio 世界解析
- 硬编码单张地图的资产入口

## 当前架构

```text
V0.0 App / Landing / Reader
            │
            ├── progressStore V3
            │   ├── Reader 稳定位置
            │   ├── Center 世界快照
            │   └── Center 镜头与视图快照
            │
            ├── transitionStore
            │   └── 等待 Center runtime ready 后揭开遮罩
            │
            └── CenterExperience
                ├── CenterContentService
                ├── WorldResolver
                ├── CenterBridge
                ├── CenterGameHost
                └── CenterScene
                    ├── LayerRenderer
                    └── LandmarkRenderer
```

## Progress V3

持久化的产品事实：

- onboarding：语言和模式是否确认
- preferences：语言、阅读模式、主题和动态模式
- reader：committedLocation、furthestLocation、started、completed
- center world：进度阶段、表里世界 variant、解锁/访问地标
- center view：摄像机、展开度、活动图层、选中地标
- currentView

不会持久化：

- Landing 粒子、唤醒动画和手势锁
- Reader 输入累计、展示转场和焦点测量
- Center hover、屏幕投影、pointer、dragging、tween 和 runtime ready

V1 和 V2 存档由统一 migration 入口升级到 V3；V1 原始存档仍保留，迁移时同时留下 V2 兼容快照。

## 世界解析

世界事实使用 `furthestLocation`，因此用户回看旧段落不会重新锁住已经解锁的世界。

当前语境使用 `committedLocation`，因此 Center 可以提示用户正在回看的相关地标。

所有边界都使用 V0.0 的 `{ phaseId, pageId, beatIndex }` 和 Reader linear index，不使用百分比猜测。

## Center runtime

- 表世界和里世界是独立图层容器。
- 图层 variant 会实际替换渲染内容，而不只是写进状态。
- 地标根据阅读进度解锁，并支持 hover、点击、访问记录和返回对应 Reader 位置。
- 摄像机拖动、缩放及最终位置会保存。
- Phaser 只接收稳定快照，只发出明确业务事件。
- Center 通过 lazy import 加载，Phaser 不进入 Landing/Reader 的首屏包。
- 转场遮罩等待 runtime ready/error；超时后自动解除，避免永久黑屏。

## 内容包

Center 内容包包含：

- `manifest.json`
- Center 世界定义
- 可选地图及其他二进制资产

导入流程：

```text
ZIP
→ Zod 校验
→ Reader 位置合法性校验
→ IndexedDB
→ Object URL
→ Phaser texture
```

内置世界没有正式地图素材时使用结构化 fallback renderer，不依赖旧 V0.1 的硬编码图片。

开发验收入口可在 URL 后加入：

```text
?center-tools=1
```

它只显示内容包导入工具，不改变普通用户界面。

## 已删除的废弃代码

- 旧 `CenterNav`
- 旧 Center CSS
- 旧 Center 列表页面
- 无实际内容价值的 records / perspectives / fragments 占位数据

## 验证

CI 使用锁定依赖执行：

```text
npm ci
npm test
npm run build
```

测试覆盖：

- V0.0 产品协议
- V1 / V2 → V3 存档迁移
- WorldResolver 精确边界
- Bridge 生命周期
- 摄像机计算
- 内容包解析
- Center ready 握手

GitHub Pages 预览工作流从 `integration/real-v0.1` 构建，并使用仓库子路径作为 Vite base。
