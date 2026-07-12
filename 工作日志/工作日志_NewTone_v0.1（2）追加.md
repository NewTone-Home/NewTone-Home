# NewTone-V0.1 工作日志追加 （2）：Interaction Cleanup / Language Init Design

生成时间戳：2026-07-06
项目：NewTone-V0.1  
追加性质：基于上一阶段《Interaction Pass》的补充 checkpoint  
阶段范围：旧转场残留清理、Landing 交互反馈补强、首次语言初始化层设计方向  
当前状态：已完成代码层小收口；语言初始化层仍处于设计阶段，尚未施工

---

## 1. 上一阶段日志摘要

上一阶段《NewTone First World v0.1 工作日志：Interaction Pass》的核心结论是：

NewTone-V0.1 已从「最小阅读-解锁-中枢闭环」推进到「Landing / Reader 交互层初步成立」。

上一阶段已确认成立的核心能力包括：

- Landing 不再是普通按钮式入口，而是以 `NewTone` 作为第一互动锚点。
- 用户 hover / click / touch `NewTone` 后，标题被激活，prompt 通过 ScrambleText 显影。
- 用户通过向下滚动 / 移动端上滑进入 Reader。
- Landing → Reader 不再使用 Reader 实时滑入预览方案，而是改为 `ReadingTransition overlay`。
- `ReadingTransition overlay` 用于遮住 Reader mount 与滚动恢复过程，避免用户看到 Reader 顶部闪现。
- Reader 继续阅读优先恢复真实滚动位置 `lastScrollY`。
- `lastReadPhase` 被拆分出来，只作为粗粒度 fallback。
- `maxReadPhase` 只作为历史最高解锁进度，不再作为继续阅读书签。
- Reader 中已加入 `ReaderProgress` 当前阅读进度线。
- 原生浏览器 scrollbar 已隐藏。
- browser history bridge 已建立，浏览器后退 / 前进 / 鼠标侧键不再导致黑屏。
- 最小 i18n 系统已建立：`copy.zh.*` / `copy.en.*`、`language`、`setLanguage`、`toggleLanguage`。
- Landing 右上角已有最小语言切换入口。
- 但「第一次进入时的语言初始化层」尚未实现，只被列为后续方向。

上一阶段的接手禁区包括：

- 不要重构 Zustand store。
- 不要重写 Reader phase detection。
- 不要恢复 Reader preview 滑入方案。
- 不要把 `maxReadPhase` 再拿来当继续阅读位置。
- `continueReading` 应优先恢复 `lastScrollY`。
- `lastReadPhase` 是 fallback，不是精确书签。
- `maxReadPhase` 是解锁进度，不是书签。
- Landing → Reader 当前使用 `ReadingTransition overlay` 方案。

---

## 2. 本轮完成内容

### 2.1 清理旧转场残留

本轮完成了旧 Reader preview / 旧页面转场方案的残留清理。

删除文件：

- `src/AppTransition.css`

删除原因：

- `.view-transition`
- `.view-transition--fading`

上述旧 class 已无组件引用，属于旧转场死代码。

修改文件：

- `src/App.jsx`
- `src/views/Reader.jsx`

具体清理内容：

- 移除了 `App.jsx` 中对 `AppTransition.css` 的 import。
- 从 `Reader.jsx` 函数入参中移除旧 preview props：
  - `inertPreview`
  - `previewPhase`
  - `previewScrollY`
  - `onPreviewReady`
- 删除旧 preview 滚动恢复 `useEffect`。
- 删除与 `inertPreview` 相关的守卫逻辑。
- 清理相关依赖数组。
- 将 `ReaderProgress` 从 `{!inertPreview && <ReaderProgress />}` 改为 `<ReaderProgress />`。
- 顺手清理未使用的 `deferScroll` 函数。

验证结果：

- 搜索 `inertPreview / previewPhase / previewScrollY / onPreviewReady`：无结果。
- 搜索 `AppTransition.css / view-transition`：无结果。
- `ReadingTransition / onReaderReady` 仍存在。
- build 通过。
- lint 无 errors，仅剩一个 pre-existing warning：
  - `progressStore.js` 中 `...(persisted || {})` 的 fallback warning。

本轮清理后，Landing → Reader 已明确只保留 `ReadingTransition overlay` 方案，不再保留 Reader preview 滑入路径。

---

### 2.2 Landing NewTone 激活反馈微调

本轮继续微调了 Landing 的 NewTone 激活反馈。

修改文件：

- `src/views/Landing.css`
- `src/views/Landing.jsx`

已完成的视觉调整包括：

- 激活态颜色从较亮的 `#d2e2ec` 压回更克制的 `var(--text-primary)`，后续微调为 `#bac8cf`。
- 降低 NewTone 激活后的 glow 呼吸强度，避免像普通发光 logo。
- 降低 prompt pulse 强度，使提示显影后不再强烈闪烁。
- 降低信号粒子透明度与字号，使其更像背景读取噪声。
- 信号粒子数量从 14 减至 12。
- 水平散布从 140 收窄至 120。
- 粒子下落距离与持续时间调整为更克制的读取感。

随后补充了 NewTone hover 尺寸反馈：

- `landing-title` 新增 `transform-origin: center center`。
- transition 追加 `transform 0.3s ease`。
- 新增 `.landing-title:hover`：
  - 保留 `translate(-50%, -50%)`
  - 叠加 `scale(1.035)`

当前行为：

- 初始状态：`transform: translate(-50%, -50%)`，无缩放。
- hover：`translate(-50%, -50%) scale(1.035)`。
- 鼠标离开：0.3s 回到原尺寸。
- activated 状态下 glow / 呼吸继续，不被 hover scale 打断。
- hover + activated 可叠加：放大与呼吸同时存在。
- prompt / signal 位置未改。
- scroll 进入 Reader 逻辑未改。

本轮判断：

Landing 当前已基本完成第一互动训练点：

- 触碰 NewTone：唤醒、放大、发光、提示显影。
- 真正进入 Reader：仍通过向下滚动 / 移动端上滑。
- NewTone 点击不进入 Reader，以保留「滚动进入读取」的核心交互语法。

---

## 3. 当前状态

截至本追加日志，NewTone-V0.1 当前状态如下：

- Landing / Reader / Center 基础闭环仍成立。
- Landing → Reader 当前仍使用 `ReadingTransition overlay`。
- Reader preview 滑入方案已从代码层清理。
- Reader 继续阅读仍优先恢复 `lastScrollY`。
- `lastReadPhase` 仅作为 fallback。
- `maxReadPhase` 仅作为解锁进度，不作为继续阅读书签。
- Reader phase detection 未重写。
- Zustand store 未重构。
- history bridge 未改动。
- ReaderProgress 保留。
- 原生 scrollbar 隐藏逻辑保留。
- Landing 当前已完成：
  - NewTone 固定锚点
  - hover / click / touch 激活
  - ScrambleText prompt 显影
  - hover scale 反馈
  - 激活后 glow / 呼吸
  - 向下滚动进入 Reader
- Landing 当前不建议继续打磨，除非进入正式视觉资产阶段。
- 当前未实现：
  - 首次语言初始化层
  - 中枢入口显影
  - 正式 0.1 正文内容骨架
  - 真实 records / perspectives / fragments
  - 移动端最终交互适配
  - 中枢空间感打磨

---

## 4. 下一步待办以及接手提示

### 4.1 下一步优先事项

下一步建议优先处理：

1. 首次语言初始化层设计与第一版实现。
2. 中枢入口显影方案设计。
3. 正式 0.1 内容骨架。

当前建议优先做第 1 项，即「首次语言初始化层」。

原因：

- 它属于进入 Reader 前的基础读取条件。
- 它接在已有 `ReadingTransition overlay` 之后，风险低于中枢入口显影。
- 它能补全上一阶段日志中提到但尚未实现的「第一次进入时的语言初始化层」。
- 它不会直接牵动 M4 解锁、中枢入口、Center 结构。

---

### 4.2 首次语言初始化层设计方向

当前讨论后的设计方向如下：

第一次从 Landing 进入 Reader 时，不应直接弹出普通语言选择页，也不应直接自动进入 Reader。

推荐流程：

1. 用户在 Landing 向下滚动 / 移动端上滑。
2. 进入 `ReadingTransition overlay`。
3. overlay 进入「文本层接入」状态。
4. 系统根据浏览器语言识别默认读取语言。
5. 显示当前接入语言，例如：
   - 中文：`文本层已接入：中文`
   - 英文：`text layer linked: English`
6. 同时显示两个动作：
   - `继续读取`
   - `是否变更`
7. 用户点击 `继续读取` 后，进入 Reader。
8. 用户 hover / touch `是否变更` 后，语言星图层显现。
9. 用户 click / tap 某个语言后，才切换语言。
10. 切换后仍需点击 `继续读取`，不自动进入 Reader。

核心原则：

- 无交互界面可以自动过渡。
- 一旦给出可操作界面，就必须等待用户确认。
- 不要让系统在用户未确认时自动替用户进入 Reader。
- 语言选择不是普通设置项，而是「读取通道」。
- 首次语言初始化层不是 Landing 功能，也不是 Reader 功能，应属于 `ReadingTransition overlay` 内部阶段。

---

### 4.3 语言星图设计方向

当前倾向使用「语言星图 / language orbit」而不是普通列表或 dropdown。

视觉结构：

- 当前语言在中心。
- 其他语言围绕当前语言分布。
- 当前语言亮度最高，有轻微 glow。
- 其他语言低透明，带轻微上下漂浮。
- 不使用国旗。
- 不使用 radio / checkbox / dropdown。
- 不使用白底菜单。
- 不使用普通设置面板。
- 不做绕圈旋转，避免用户点不到。
- 语言位置使用固定槽位，不随机。

示意：

```text
        日本語

English    中文    한국어

     Français   Español
```

短期内语言数量预计不会超过 8 个，因此星图方案可行。

推荐语言名使用原生写法：

- 中文
- English
- 日本語
- 한국어
- Français
- Español
- Bahasa Indonesia

交互规则：

- hover `是否变更`：该文字轻微放大，并唤醒语言星图。
- 鼠标进入语言星图 hover zone：语言星图保持显示。
- 鼠标离开 hover zone：语言星图淡出。
- hover 某个语言：仅高亮 / 轻微放大，不切换。
- click / tap 某个语言：切换语言。
- 切换语言时，未来可做「中心语言与目标语言交换位置」的位移动画。
- 选完语言后不自动进入 Reader，仍需点 `继续读取`。

第一版建议只做：

- hover zone
- 语言星图淡入淡出
- 当前语言中心定位
- 外圈语言固定槽位
- 外圈语言轻微漂浮
- click / tap 切换语言
- `继续读取` 确认进入 Reader

第一版暂不建议做：

- 复杂 scramble reveal
- 复杂中心交换动画
- 多语言滚动面板
- 搜索语言
- 绕圈旋转
- 选完语言后自动进入 Reader

---

### 4.4 状态与数据建议

建议新增一个 persisted 标记：

- `hasInitializedLanguage`

原因：

当前 `language` 默认是 `zh`，仅凭 `language` 无法判断用户是否主动完成过语言初始化。

推荐语义：

- `language`：当前读取语言。
- `hasInitializedLanguage`：是否完成过首次语言初始化。
- reset 应清掉 `hasInitializedLanguage`，使 NewTone-V0.1 回到首次进入状态。

浏览器语言识别建议：

- 首次进入时读取 `navigator.language` / `navigator.languages`。
- 匹配当前支持语言。
- 匹配不到时 fallback 到 `zh` 或后续指定默认语言。
- 当前语言初始化层只显示当前接入语言，不一次性铺满所有语言。
- 用户主动触发 `是否变更` 后，再显示语言星图。

---

### 4.5 接手禁区

后续施工时不要做以下事情：

- 不要恢复 Reader preview 滑入方案。
- 不要重新引入 `inertPreview / previewPhase / previewScrollY / onPreviewReady`。
- 不要重新创建 `AppTransition.css` 作为旧转场用途。
- 不要重构 Zustand store。
- 不要重写 Reader phase detection。
- 不要把 `maxReadPhase` 当书签。
- 不要改变 `lastScrollY > lastReadPhase > maxReadPhase` 的恢复优先级。
- 不要让语言选择完成后自动进入 Reader。
- 不要把语言选择做成普通 dropdown / settings panel。
- 不要让 hover 直接切换语言。
- 不要让 hover 直接进入 Reader。
- 不要让点击 NewTone 直接进入 Reader。
- 不要继续无目的打磨 Landing。
- 不要在语言初始化第一版中一次性加入过重动画。

---

## 本追加日志核心结论

本轮完成的是 NewTone-V0.1 的一次小型收口：

- 清理了旧 Reader preview / 旧转场残留。
- 稳住了 Landing → Reader 的 `ReadingTransition overlay` 方案。
- 补强了 Landing NewTone 的 hover 尺寸反馈。
- 明确了首次语言初始化层的设计方向。

下一步最应该做的是：

先实现一个低复杂度的首次语言初始化层第一版，验证「文本层接入 → 继续读取 / 是否变更 → 语言星图 → 选择语言 → 继续读取 → Reader」这条链路是否成立。
