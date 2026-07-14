# NewTone First World v0.1 （2）工作日志：Interaction Pass

生成时间戳：2026-07-06  
项目：NewTone-V0.1  
阶段性质：Landing / Reader 交互层打磨  
基线来源：上一阶段已完成「最小阅读-解锁-中枢闭环」

---

## 0. 本阶段结论

本阶段可以收口。

NewTone-V0.1 已经从「最小功能闭环跑通」推进到「Landing / Reader 交互层初步成立」。

当前确认状态：

- build 通过
- Landing 入口不再是普通按钮式页面
- NewTone 标题具备触发显影逻辑
- 向下滚动进入 Reader
- Reader 恢复真实阅读位置
- 读取过渡层解决了 Reader 顶部闪现问题
- 原生滚动条已隐藏
- Reader 当前进度线已加入
- 浏览器后退 / 鼠标侧键黑屏问题已修复
- maxReadPhase / lastReadPhase / lastScrollY 已拆分

---

## 1. 本阶段总目标

本阶段不是重构底层，也不是填正式内容。

目标是打磨 NewTone-V0.1 的入口与阅读体验，让它从普通网页入口变成更接近 NewTone 气质的互动文本空间。

核心方向：

- Landing 保持极简
- NewTone 本身成为可触碰的入口母体
- 提示文字不是常驻按钮，而是被触碰后显影
- Reader 进入过程不暴露错误位置
- 阅读位置恢复精确到真实滚动位置
- 浏览器原生 UI 尽量降低存在感
- 保留后续扩展中枢、语言初始化层、互动文字系统的空间

---

## 2. 新增与修改文件总览

### 新增文件

- `src/i18n/copy.js`
- `src/components/ScrambleText.jsx`
- `src/components/ReadingTransition.jsx`
- `src/components/ReadingTransition.css`
- `src/components/ReaderProgress.jsx`
- `src/components/ReaderProgress.css`

### 主要修改文件

- `src/App.jsx`
- `src/stores/progressStore.js`
- `src/styles/tokens.css`
- `src/views/Landing.jsx`
- `src/views/Landing.css`
- `src/views/Reader.jsx`
- `src/views/Reader.css`
- `src/views/Center.jsx`
- `src/components/CenterNav.jsx`
- `src/i18n/copy.js`
- `index.html`

---

## 3. i18n 最小语言系统

新增：

`src/i18n/copy.js`

当前建立了 `copy.zh.*` 和 `copy.en.*` 文案表。

覆盖范围包括：

- Landing prompt
- 继续读取
- 进入中枢
- 重置
- 返回入口
- 中枢
- 记录
- 视角
- 碎片
- ReadingTransition 状态文案

`progressStore.js` 新增：

- `language`
- `setLanguage(lang)`
- `toggleLanguage()`

规则：

- 只接受 `zh` / `en`
- 默认 `zh`
- 非法 language 在 sanitize 时回退 `zh`
- language 加入 persisted keys

Landing 右上角保留语言切换入口：

- 中文模式显示 `EN`
- 英文模式显示 `中`

注意：

当前语言切换是最小可用机制，不是完整国际化系统。

后续可继续扩展到正式内容数据、Reader 正文、多语言内容包。

---

## 4. Landing 入口交互

### 4.1 从按钮式入口改为滚动进入

Landing 不再使用普通「开始阅读」按钮。

当前逻辑：

- 无进度时：向下滚动触发 `startReading()`
- 有进度时：向下滚动触发 `continueReading()`

触发方式：

- desktop：`wheel`，`e.deltaY > 8`
- mobile/touch：`touchstart` 记录起点，`touchmove` 上滑超过 20px 触发
- 使用 triggered lock 防止重复触发
- 不监听按任意键

### 4.2 NewTone 作为第一互动训练点

Landing 初始状态主视觉只保留：

`NewTone`

提示文字不常驻显示。

用户 hover / click / touch NewTone 后：

- NewTone 被激活
- 标题发亮
- 少量读取字符噪声出现
- prompt 通过 ScrambleText 从乱码显影
- 显影完成后 prompt 开始轻微 pulse

当前 prompt：

中文：

- 无进度：`向下滚动，开始读取`
- 有进度：`向下滚动，继续读取`

英文：

- 无进度：`scroll to enter`
- 有进度：`scroll to resume`

重要原则：

- 直接滚动仍然可以进入 Reader
- 不强制用户先触发 NewTone
- NewTone 触发只是软新手引导，不是门槛

### 4.3 ScrambleText

新增：

`src/components/ScrambleText.jsx`

功能：

- 接收 `text / active / duration / onRevealed`
- active 后使用字符集 `░▒/\-_01`
- 从左到右逐步解码为目标文案
- 完成后调用 `onRevealed`
- 完成后直接显示最终文本

用途：

- 用于 Landing prompt 显影
- 形成「触碰 NewTone → 读取提示」的第一层互动反馈

---

## 5. Landing 视觉定位修正

此前 NewTone 在 prompt 出现时会上移。

原因判断：

- NewTone 和 prompt 处于同一个居中内容组
- prompt 出现改变组高度
- 浏览器重新居中整个组，导致标题上移

最终修法：

`Landing.css` 中：

- `.landing-main` 改为 `position: relative; width: 100%; height: 100vh`
- `.landing-title` 使用绝对定位固定锚点
- `.title-signal` 绝对定位在 title 下方
- `.landing-prompt-slot` 绝对定位在 title 下方
- `.landing-center-entry` 绝对定位在 prompt 下方
- 语言按钮 / reset 保持 fixed

核心结果：

- NewTone 不再因为 prompt / signal 出现而跳动
- NewTone 成为固定锚点
- 其他东西只是从它下方显影

---

## 6. NewTone 发光与读取噪声

本阶段尝试过：

- title activated 后静态变色
- glow 横线
- title scale breathing
- signal-breathe 横线

最终判断：

- 横线突兀，删除
- 标题不应缩放呼吸
- 呼吸应作用在光上，而不是文字本体
- 字体位置必须完全固定

当前保留方向：

- NewTone 激活后变亮
- 使用 text-shadow / drop-shadow 形成光感
- 少量字符噪声从标题下方下落
- prompt 延迟显影
- prompt 显影后轻微 pulse

注意：

当前发光效果仍可继续精修，但结构逻辑已经成立。

---

## 7. ReadingTransition 读取过渡层

### 7.1 放弃 Reader 实时滑入预览

曾尝试实现：

- Landing 向上滑出
- Reader 从下方滑入
- inertPreview 预先定位到 lastScrollY

问题：

Reader 是可滚动长内容，并且 continueReading 需要恢复任意 `lastScrollY`。

由于预览依赖 window scroll，容易出现：

- Reader 顶部先闪一下
- 再跳到真实阅读位置

判断：

这种方案不适合当前 Reader 结构。

### 7.2 改为读取过渡层

新增：

- `src/components/ReadingTransition.jsx`
- `src/components/ReadingTransition.css`

新逻辑：

用户从 Landing 向下滚动后：

1. App 显示 ReadingTransition overlay
2. 同时调用 `startReading()` 或 `continueReading()`
3. Reader 在 overlay 背后 mount
4. Reader 完成位置恢复后调用 `onReaderReady`
5. overlay 至少显示 650ms
6. overlay fade out 240ms
7. 用户直接看到正确位置的 Reader

视觉方向：

- fixed 全屏 overlay
- background 使用 Reader / root 暗色背景
- 极淡字符噪声
- 短读取脉冲线
- 小号、低透明状态文字
- 不使用 spinner
- 不使用大字 loading
- 不使用百分比进度

文案：

中文：

- start：`开始读取`
- continue：`回读中`

英文：

- start：`begin reading`
- continue：`resuming`

当前结果：

- 解决了 Reader 顶部闪现问题
- 进入 Reader 时不会暴露错误位置
- 转场更像 NewTone 的「读取动作」而不是普通页面滑动

---

## 8. Reader 当前进度线与隐藏原生滚动条

### 8.1 隐藏原生 scrollbar

`index.html` 中加入全局隐藏：

- `scrollbar-width: none`
- `-ms-overflow-style: none`
- `::-webkit-scrollbar { display: none; }`

目标：

- 保留滚动能力
- 隐藏浏览器原生滚动条
- 避免右侧滚动条突然出现破坏 NewTone 气质

### 8.2 ReaderProgress

新增：

- `src/components/ReaderProgress.jsx`
- `src/components/ReaderProgress.css`

功能：

- 监听 window scroll
- 使用 requestAnimationFrame 节流
- 计算当前页面滚动进度：
  `scrollTop / (scrollHeight - clientHeight)`
- clamp 到 0–1
- 右侧显示一条极细当前阅读进度线

视觉：

- fixed right
- 高度约 30vh
- 1–2px 宽
- track 极淡
- fill 略亮
- 不显示百分比
- 不可拖动
- 不像传统 scrollbar

规则：

- 只在真实 Reader 显示
- `inertPreview` 时不显示，避免转场闪烁

---

## 9. history bridge：修复浏览器后退 / 鼠标侧键黑屏

### 9.1 问题

在 Reader 中按浏览器后退或鼠标侧键后退会黑屏。

原因：

- SPA 内部 currentView 与 browser history 不同步

### 9.2 修复

`progressStore.js` 新增：

- `setViewFromHistory(view)`

规则：

- 只接受 `landing / reader / center`
- 非法 view 回 landing
- center 未解锁时回 landing
- reader 恢复时设置 `resumeRequested: true`
- 不触发 `startReading / continueReading / completeM4` 等副作用

`App.jsx` 建立 history bridge：

- mount 时初始化 `replaceState({ newtoneView: 'landing' })`
- 监听 `popstate`
- popstate 调用 `setViewFromHistory`
- currentView 变化时 pushState
- 避免重复 push
- 使用 ref 防止 history 循环

当前结果：

- 浏览器后退 / 前进不再黑屏
- 鼠标侧键返回可用
- 未解锁 center 不会通过 history 强行进入

---

## 10. 阅读进度语义拆分

此前 `maxReadPhase` 同时承担：

- 历史最高阅读进度
- 继续阅读恢复位置

这导致：

读到 M4 后，即使用户回到 M2，再继续阅读也会跳回 M4。

本阶段拆分为：

### 10.1 maxReadPhase

含义：

- 历史最高解锁进度
- 只能前进
- 用于中枢解锁与权限判断

### 10.2 lastReadPhase

含义：

- 最后阅读 phase
- 可前进可回退
- 用于粗粒度 fallback

新增 persisted state：

- `lastReadPhase`

`setPhase(phase)`：

- 更新 `currentReadingPhase`
- 更新 `lastReadPhase`
- 如果 phase 高于 maxReadPhase，则推进 maxReadPhase

`completeM4()`：

- 确保 `maxReadPhase = M4`
- 确保 `lastReadPhase = M4`
- 解锁 center

---

## 11. 精确书签：lastScrollY

### 11.1 问题

`lastReadPhase` 只能定位到 M1 / M2 / M3 / M4 block 开头，不能恢复到用户实际看到的段落位置。

### 11.2 新增 lastScrollY

`progressStore.js` 新增：

- `lastScrollY: 0`
- `setLastScrollY(y)`

规则：

- persisted
- 只接受有限 number
- 小于 0 回退 0
- 差值小于 2px 时跳过，避免频繁写入

### 11.3 Reader 中记录真实位置

`Reader.jsx`：

- 非 inertPreview 时监听 window scroll
- 使用 requestAnimationFrame 节流
- currentView 不是 reader 时不记录
- 页面不可滚动时不记录
- restoringRef 为 true 时不记录
- unmount 前保存一次当前 scrollY，但有保护，避免被 Landing 的 0 覆盖

### 11.4 恢复优先级

真实 resume：

1. `lastScrollY > 0` → `scrollToY(lastScrollY)`
2. `lastReadPhase` → `scrollToPhase(lastReadPhase)`
3. `maxReadPhase` → `scrollToPhase(maxReadPhase)`
4. 否则不滚动

恢复使用：

- 双 rAF 等布局稳定
- `scrollToY` clamp 到最大可滚动高度
- 恢复期间暂停记录，防止中间 scroll 事件污染 lastScrollY

当前结果：

- 继续阅读可以回到真实滚动位置
- 不再只回到 phase 开头

---

## 12. 当前功能闭环状态

当前确认可用：

- Landing 初始极简入口
- NewTone hover / click / touch 触发提示显影
- ScrambleText 乱码解码
- 向下滚动进入 Reader
- ReadingTransition 盖住 Reader 恢复过程
- Reader 恢复到 lastScrollY 真实位置
- ReaderProgress 当前进度线
- 原生滚动条隐藏
- M1–M4 phase 检测
- M4 complete 解锁中枢
- Landing / Reader / Center 基础闭环仍成立
- 中英文 UI 文案切换
- 浏览器后退 / 前进 / 鼠标侧键不黑屏
- reset 仍可用

---

## 13. 当前遗留与后续建议

### 13.1 可以以后清理

- `AppTransition.css` 现在基本是旧转场残留，可删除或合并
- `Reader` 中 `inertPreview / previewPhase / previewScrollY / onPreviewReady` 是旧预览转场遗留逻辑，目前不再用于 Landing → Reader 视觉转场，可后续清理
- `ReadingTransition` 中 noise 随 render 随机生成，若视觉抖动明显，可用 `useMemo` 固定一次

### 13.2 还没做

- 正式 0.1 正文内容
- 真实 records / perspectives / fragments
- 中枢入口的显影逻辑
- 第一次进入时的语言初始化层
- 移动端最终交互适配
- 中枢空间感打磨
- Reader 正文节奏精修
- Landing 视觉继续精修
- 总进度条 / 世界进度条
- 正式部署验证

### 13.3 下一步建议

下一阶段不要再大改底层。

优先方向：

1. 清理旧转场残留代码
2. 继续打磨 Landing 的 NewTone 光感和交互语法
3. 设计中枢入口如何从 NewTone / 阅读完成状态中显影
4. 开始建立 0.1 内容骨架
5. 再考虑第一次语言初始化层

---

## 14. 对下一个窗口 / 施工方的接手提示

当前 NewTone-V0.1 的重要前提：

- 不要重构 Zustand store
- 不要重写 Reader phase detection
- 不要恢复 Reader preview 滑入方案
- 不要把 maxReadPhase 再拿来当继续阅读位置
- continueReading 应优先恢复 lastScrollY
- lastReadPhase 是 fallback，不是精确书签
- maxReadPhase 是解锁进度，不是书签
- Landing → Reader 当前使用 ReadingTransition overlay 方案
- 原生 scrollbar 已隐藏，ReaderProgress 负责当前进度感知

本阶段核心成果一句话：

NewTone-V0.1 已完成 Landing / Reader 交互层初步打磨：入口显影、读取过渡、精确阅读恢复、进度线与浏览器 history 基础支持均已成立。

---

## 15. 打包注意事项

以后传代码审查时，不建议带：

- `node_modules`
- `dist`

原因：

跨系统解压后，`node_modules` 可能导致 Vite / rolldown native binding 问题。

建议只打包：

- `src/`
- `index.html`
- `package.json`
- `package-lock.json`
- `vite.config.js`
- 其他必要配置文件

如果只能整文件夹 zip，也可以，但审查方最好重新删除 `node_modules` 并重新 `npm install`。
