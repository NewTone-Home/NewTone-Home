# Center Next

`center-next` 是真正 V0.1 的新 Center 基础设施区。

当前阶段只包含 domain contracts、运行时端口和可测试的不变量；尚未挂载 Phaser，也没有替换 `src/views/Center.jsx`。

## 目录职责

- `domain/`：世界定义、持久化快照和数据不变量。
- `runtime/`：React 与未来 Phaser runtime 的框架边界。
- 后续 `assets/`：内容包资产到 Phaser 可用 URL/texture 的适配。
- 后续 `state/`：Center world/view slice 与 V0.0 progress migration 的接线。
- 后续 `tests/`：runtime lifecycle、camera、projection 和 ready handshake 测试。

## 禁止事项

- 不直接调用 App route 或 `setView`。
- 不复制旧 V0.1 的 CenterPage、EdgeGuides 或 center.css。
- 不在 runtime 内写 localStorage/IndexedDB。
- 不用模糊 progressRatio 解析世界状态。
- 不持久化 hover、projection、pointer、dragging 或 tween。
- 不改变 V0.0 Landing/Reader 的产品行为。

## 正式接入前置条件

1. progressStore 升级为包含 Center world/view snapshot 的版本化存档。
2. WorldResolver 基于 V0.0 reader linear index 完成。
3. Phaser host 支持 runtime ready/error 握手。
4. camera commit 能写入 Center view snapshot。
5. 通过隐藏开发入口验收后，才替换正式 Center。
