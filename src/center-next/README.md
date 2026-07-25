# Center Next

`center-next` 是真正 V0.1 的 Center 实现。它已经替换旧列表式 Center，但不接管 Landing、Reader 或 App 导航。

## 目录职责

- `domain/`：世界定义、稳定快照、不变量、definition registry 和精确 WorldResolver。
- `content/`：内置世界、Zod schema、ZIP parser、IndexedDB repository 和资产 URL 生命周期。
- `runtime/`：Bridge、Game Host、Phaser Scene、摄像机计算、图层渲染和地标渲染。
- `CenterExperience.tsx`：React 外壳，只处理产品事件、覆盖层 UI 和 V0.0 store/transition 接线。
- `CenterDeveloperTools.tsx`：仅在 `?center-tools=1` 下出现的内容包导入入口。

## 数据方向

```text
progressStore world/view snapshot
        ↓
CenterExperience
        ↓
CenterBridge
        ↓
Phaser runtime

Phaser runtime
        ↓
ready/error、landmark、camera、projection 事件
        ↓
CenterExperience
        ↓
progressStore / transitionStore
```

## 状态边界

会保存：

- 世界进度和 variant
- 解锁与访问地标
- 摄像机位置和缩放
- 表里展开度、活动图层、选中地标

不会保存：

- hover
- 屏幕投影坐标
- pointer / dragging
- tween
- runtime ready

## 运行规则

- ReaderPosition 只使用 V0.0 的 `phaseId / pageId / beatIndex`。
- 世界解锁使用 furthestLocation，当前提示使用 committedLocation。
- runtime 不直接调用 App route，不写 localStorage 或 IndexedDB。
- Center 页面往返必须经过原有 transitionStore。
- 遮罩等待 Phaser ready/error 后才揭开；超时有兜底。
- Center 使用 lazy import，Phaser 不进入 Landing/Reader 初始包。
- 内容资产通过 ContentService 提供，runtime 不感知 ZIP 或 IndexedDB。

## 内容包

内容包由 `manifest.json`、Center definition 和可选资产组成。导入时依次进行 schema 校验、Reader 位置校验和持久化。

没有正式地图素材时，LayerRenderer 使用 definition 中的 fallback palette 生成可工作的双层世界；以后增加正式素材不需要重写 CenterScene。
