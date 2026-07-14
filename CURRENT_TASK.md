# CURRENT_TASK — Reader 中段刷新阶段标签纯视觉闪烁调查接手包

> 项目目录：`E:\小说\NewTone-V0.1`  
> 更新时间：2026-07-13（America/Vancouver）  
> 用途：供下一个 Codex 窗口直接接手；本文件是当前任务唯一入口。  
> 当前状态：功能修复冻结，等待用户授权下一轮“纯视觉闪烁”调查。

## 1. 接手边界

下一个窗口先完整读取本文件，再按需读取最小源码。不要把这里列出的调查方向自动视为施工授权。

当前禁止：

- 不继续修改 phase、observer、sentinel、transition 或恢复逻辑。
- 不调整现有 B3 CSS。
- 不写正式日志。
- 不提交 commit。
- 不进入阶段 C 或 D。

用户下一条明确指令优先于本文件中的旧状态和建议。

## 2. 当前已确认状态

### B1 / B2

现场视觉验收通过，保持生效：

- `src/views/Reader.css`：`.reader { font-family: var(--font-body); }`
- `src/views/Reader.css`：`.reader-paragraph { margin: 0 0 var(--space-md); }`
- 两项修改前后相同视口 `scrollHeight` 均为 `3415px`，差值均为 `0px`。
- 正文、连续滚动、桌面端、手机端和导航交互未发现回归。

### B3

B3 CSS 已存在，但现场验收暂停；必须原样保留，不回退、不继续调整：

- `.reader-block::before`
- `.reader-block[data-phase="M1"]::before`
- `.reader-block[data-phase="M2"]::before`
- `.reader-block[data-phase="M3"]::before`
- `.reader-block[data-phase="M4"]::before`

它实现低对比、双层轻微错位的铅笔分段痕迹，并保留 M1–M4 原有宽度差异。

### 已验收的连续刷新 lastScrollY 修复

`src/views/Reader.jsx` 中以下修复必须保留：

- Reader ready 前禁止滚动持久化。
- scroll event 入口和 scroll rAF 回调双重门控。
- `scrollFrameRef` cleanup。
- 恢复 rAF 的集中记录、取消和 `cancelled` 检查。
- StrictMode 下通过 `restorePlanRef` 保存初始恢复计划快照。
- cleanup 仅在 ready、非恢复期且页面可滚动时保存最终位置。

该修复已经现场验收通过。此前有效实测包括：

```text
M4 中段连续刷新：2301 → 2301 → 2301
phase：每次 null → M4
```

## 3. 已整体回退的失败尝试

“observer / sentinel 状态抖动修复”现场验收不通过，已经整体回退，仅保留上面的 lastScrollY 修复。

已回退内容：

- `updateCurrentPhase()` 抽取。
- ready 后主动 phase 判定。
- phase observer 恢复期门控及配套 timeout 变化。
- sentinel 恢复期门控。
- sentinel 已完成状态检查。
- `finishRestore()` 后追加的主动 phase rAF。
- 恢复 effect 对 `updateCurrentPhase` 的依赖。

当前 phase observer 与 sentinel 已恢复原逻辑：

```text
phase observer threshold: [0, 0.25, 0.5, 0.75, 1]
sentinel threshold: 0
```

不要重新加入上述门控，除非用户重新授权并出现新的直接证据。

## 4. 当前未解决现象

刷新 Reader 时，右上角 `.reader-phase-tag` 会发生可见闪烁，规律是：

- Reader 顶部刷新稳定。
- Reader 底部刷新稳定。
- 只有页面中间位置刷新时复现明显闪烁。
- 当前阅读位置恢复正确。

完整运行时采样已经推翻“错误 M4 状态抖动”的旧归因。

三组有效样本中的 phase 序列：

```text
顶部：null → M1
M2 中段：null → M2
底部：null → M4
```

中段样本没有出现 M4，也没有 phase 来回切换。中段 sentinel 始终不相交。

浏览器状态：

```text
history.scrollRestoration = "auto"
```

但有效样本中没有发生浏览器原生抢先恢复：

- 初始空 DOM 高度约 `1308px`。
- Reader DOM 稳定后高度为 `3415px`。
- 高度稳定前 `scrollY` 保持 `0`。
- 中段第一次改变 `scrollY` 的调用者是 React 的 `scrollToY(lastScrollY)`。
- 顶部 `lastScrollY=0` 时走现有 phase fallback / `scrollIntoView(M1)`。

因此当前证据指向纯视觉绘制或合成问题，而不是 phase 功能状态抖动。

## 5. 下一轮建议调查方向

只有用户明确批准后才开始。优先做只读或临时运行时观察，先不要施工：

1. `.reader-phase-tag` 从不存在到首次出现时，浏览器是否产生一帧闪白或重绘。
2. fixed 元素首次进入合成层时是否闪烁。
3. 字体是否在首帧发生 fallback → 正式字体切换。
4. `PageShell` 或父级的 `opacity`、`transform`、`filter` 是否触发合成层重建。
5. 标签首次挂载是否正好遇到页面滚动恢复，产生视觉拖影。
6. 开发模式是否复现，而 production build 是否不复现。

建议采样内容：

- phase tag 首次创建时间、DOM 节点身份和文字变化。
- 每帧 computed `opacity`、`transform`、`filter`、`font-family`、`animation-name`、`transition-property`。
- `document.fonts.status`、`document.fonts.ready` 时间。
- 页面第一次滚动、Reader ready、标签首次挂载三者的先后关系。
- dev 与 production 相同视口、相同位置的对照结果。

不要通过隐藏 ready 前标签直接掩盖现象，除非调查证明这就是最小且正确的视觉方案。

## 6. 当前技术状态

- `npm.cmd run lint`：通过；仅有既存 warning：`src/stores/progressStore.js:105`。
- `npm.cmd run build`：通过；52 modules transformed。
- 开发服务：`http://127.0.0.1:5174/`，HTTP 200。
- 当前应用内浏览器 URL 带有已结束验证参数：

```text
http://127.0.0.1:5174/?__refreshVerify=done&count=4&expectedY=954
```

该参数只是已移除临时探针留下的 URL，不对应任何现存源码逻辑。下一个窗口如需运行检查，应使用干净地址：

```text
http://127.0.0.1:5174/
```

- 所有临时运行时埋点、验证探针、采集器和临时数据均已删除。
- 当前没有正式日志更新，也没有 commit。

## 7. 最小读取顺序

1. `CURRENT_TASK.md`
2. `src/views/Reader.jsx`
3. `src/views/Reader.css` 中 `.reader-phase-tag`、B1/B2 和 B3 selector
4. `src/components/PageShell.jsx`
5. `src/components/PageShell.css` 中 `opacity`、`transform`、animation 规则
6. `src/styles/tokens.css` 中字体 token
7. `src/main.jsx` 中 StrictMode 包装

除非新证据需要，不要通读 store、transition 或历史日志。

## 8. 接手口令

```text
先读 CURRENT_TASK.md，再核对最小源码。
当前 lastScrollY 连续刷新修复已验收并必须保留；observer/sentinel 状态抖动修复已整体回退。
B1/B2 生效，B3 CSS 原样保留且验收暂停。
中段刷新 phase 实际只发生 null → 正确阶段，没有错误 M4；下一轮仅在用户明确授权后调查纯视觉闪烁。
不写正式日志，不提交 commit，不进入阶段 C/D。
```
