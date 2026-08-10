# NewTone Decision Record — 2026-08-09

用途：保存这一轮已经形成长期价值的设计与工程决定，包括真正尝试过、后来取消的方向。

这不是完整试验日志。只有那些**未来很可能被重新提出，而且重新提出会导致重复踩坑**的旧方案，才值得长期记录。

---

# Decision 01 — Landing Interaction

状态：**Locked**

## 原来是什么

Landing 已经有 NewTone 标题、手绘线、入口提示与场景运动，但随着 Reader entry、return、mobile motion 等功能不断加入，不同阶段出现了各自的视觉处理。

结果不是单个元素不好，而是同一套 Landing 语言开始出现多个版本：

- 首次进入一种表现；
- Reader 返回一种表现；
- 中间 transition 又有自己的 NewTone；
- guide 的长度、方向、出现/消失方式不断变化；
- parallax 责任散在不同场景里。

## 为什么必须改

NewTone 的 Landing 很简，元素越少，每一个元素之间的不一致越明显。

问题不是“需要更多设计”，而是需要减少版本，让用户无论第一次进入还是从 Reader 返回，都感受到同一个 Landing，而不是几个互相模仿的 Landing 状态。

## 本轮尝试过的方向

### 更复杂、更弯的 Landing guide

早期 guide 形态更明显、更具造型感。

问题：

- 它会抢 NewTone 标题本身的注意力；
- Landing 本来应该安静，guide 太像独立视觉主角；
- 在不同 viewport / mobile 场景下更容易显得笨重。

结果：**Rejected / simplified**。

最终 guide 收敛为更短、更直、更像手绘动作痕迹的形态。

### 多种 return 专用 guide / morph

曾尝试让 Reader 返回后的 Landing 使用不同尺寸、不同 morph 或专门的 return 引导形式。

问题：

- 会逐渐制造“普通 Landing”和“return Landing”两套视觉系统；
- 后续每修一个 Landing 行为都要同时维护多个状态；
- return 的特殊性被过度强调，反而让真正 Landing 变成转场的一部分。

结果：**Rejected**。

### 让 transition 层承担更多 Landing 表现

曾经让中间 overlay / transition 层展示 NewTone，再把真实 Landing 放在后面接管。

问题：

- 出现多个视觉上相同、逻辑上不同的 NewTone；
- 容易发生双 Logo / 接力感；
- transition 层开始知道太多 Landing 的内部视觉逻辑。

结果：**Removed as primary direction**。

## 最终决定

Landing 自己拥有 Landing 的全部表现。

当前保留：

- NewTone 标题按照当前时序描画 / 擦除；
- 两条签名手绘线属于真正 Landing；
- guide 为短、直、手绘，描画出现、擦除消失；
- guide 与 NewTone 采用反方向 parallax；
- Reader 返回后直接回到 live Landing；
- Landing 自己完成 NewTone redraw、return feedback、feedback fade 和 guide 再出现；
- return Landing 不再发展成另一套 Landing。

## 为什么最终这样定

它把“视觉连续性”从中间转场特效，变成了**同一个页面继续活着**。

这样做比制造更复杂的 transition 更符合 NewTone 当前方向，也减少状态数量、移动端异常和未来维护成本。

## 未来施工规则

除非出现明确 bug 或 Owner 主动重新定义 Landing，否则：

- 不重做箭头；
- 不重新设计 parallax；
- 不添加新的 return 专用 Landing 视觉版本；
- 不把已经移回 Landing 的职责再次搬到 GlobalTransition。

---

# Decision 02 — Reader First Entry

状态：**Stable**

## 原来是什么

Reader 首次进入需要完成语言与阅读模式选择。

最初这段更接近普通网站 setup：用户看到选项，通过 hover 等行为完成选择，然后进入 Reader。

## 出现的问题

### 仅 hover 推进不够主动

用户可能只是把鼠标停在某个选项上，却被系统理解为已经确认。

这会让“选择语言 / 模式”缺乏明确意图。

### Desktop 与 mobile 不能机械复制

Desktop 有 hover / wheel。

Mobile 没有真正 hover，还会有 sticky hover、touch 与 pointer 行为差异，Apple Pencil 也需要合理路径。

如果强行让两端操作完全一致，结果往往不是一致，而是其中一端变得很别扭。

### 普通设置页感过强

如果继续增加 divider、按钮、选择框等传统 UI，Reader 还没开始，用户已经先经历了一页“设置”。

这与 NewTone 希望把进入过程做成连续体验的方向冲突。

## 本轮尝试过的方向

### 持续 hover 自动推进

优点是顺滑、少点击。

问题是意图太弱，鼠标停留本身不应等于确认。

结果：**Rejected as final behavior**。

### Mobile tap 后立即进入下一页

优点是最直接。

问题：

- 与 desktop 的“选中 + 向下继续”语义差太大；
- 容易把触碰目标和真正确认混成一个动作；
- Reader 整体原本存在 swipe / scroll 输入，需要更清楚地区分选择和推进。

结果：**Rejected**。

### 局部 selector 内才允许 armed swipe

早期 mobile armed 后，确认手势更依赖 selector 局部区域。

问题：真实手机操作中用户手指离开选项后自然会从页面其他位置继续 swipe，局部限制不符合实际手势。

结果：**Expanded beyond local selector**。

## 最终决定

Reader entry 不做成传统设置页，而是连续进入过程。

Desktop：

- hover 用于指示当前目标；
- downward wheel 表示明确继续；
- upward wheel 与微小 wheel noise 不触发推进。

Mobile / pen：

- 先选择 / armed；
- 再通过对应 swipe 确认推进；
- Change language 只负责语言展开/改变，不偷偷承担下一步确认；
- 不依赖 sticky hover。

## 为什么最终这样定

不同设备不需要动作完全一样，但需要意图结构一致：

**先明确“我选哪个”，再明确“我继续”。**

这比强制所有设备使用同一种物理动作更重要。

## 未来施工规则

- 修具体 input bug 可以碰；
- 不重新做成 modal/settings page；
- 不恢复 hover-only 自动推进；
- 不因为 mobile 可以 tap 就把 armed / confirm 语义直接删掉；
- 不继续添加纯装饰 divider 或普通表单式 UI。

---

# Decision 03 — Reader Progress

状态：**Locked / Stable**

## 原来是什么

Reader 有阅读进度反馈，但控件式视觉容易让人自然期待它可以 hover、click、drag 或 seek。

## 问题

Reader 的核心任务是阅读。

如果 progress 开始承担更多交互，它会带来两个后果：

1. 视觉上越来越像播放器 / 阅读器工具条；
2. 输入层面增加与 Reader 本身 scroll / wheel / touch 的竞争。

这不是当前 NewTone 需要解决的问题。

## 本轮方向

没有继续把 progress 功能化，而是反过来减少它的 UI 身份。

## 最终决定

- progress 非交互；
- remaining percentage 平滑变化；
- remaining label 位置按阅读反馈重新调整；
- 不提供 hover/click/drag/seek；
- progress 只告诉用户阅读进度，不替代导航。

## 为什么最终这样定

对于 NewTone，目前“少一个控件”比“多一个功能”更符合 Reader 的产品身份。

用户需要的是阅读中的轻反馈，不是控制台。

## 未来施工规则

除非未来 Reader 产品定义明确加入跳转 / seek，否则不要因为 progress 看起来像条形控件就顺手让它可点击。

---

# Decision 04 — Reader Return

状态：**Locked**

这是本轮最需要保存废弃设计历史的决定之一。

## 原来要解决什么

正文读到最后，用户需要回到 Landing。

如果完全没有入口，阅读结束后没有明确出口。

如果直接放一个普通“Back / Return”按钮，又会突然把 Reader 拉回普通网页 UI。

因此问题不是简单的导航问题，而是：

**如何让“结束阅读并离开 Reader”本身成为 Reader 的最后一个动作。**

## 尝试过的方案

### 方案 A：固定按钮

形式：在 Reader 中放一个明确、常规的返回按钮。

为什么当时合理：

- 用户一眼就知道怎么回去；
- 实现简单；
- desktop / mobile 都容易理解。

为什么取消：

- 视觉上太像普通网站控件；
- 会让正文结束突然暴露一个功能性 UI；
- 与 Reader 已经形成的低 UI / 连续阅读语言冲突。

结论：**Rejected**。

### 方案 B：单击 / 单次动作直接返回

形式：返回 cue 出现后，一次 click / swipe / 对应输入就立即导航。

为什么当时合理：

- 操作路径短；
- 减少状态。

为什么取消：

- 太容易误触；
- Reader 最后一个动作没有确认层；
- touch 环境尤其容易把用户自然滚动误当成离开意图；
- cue 刚出现就直接消失，缺少“我已经选择结束”的反馈。

结论：**Rejected**。

### 方案 C：普通确认按钮 / 二段 UI

形式：第一次触发后，再弹一个更明确的确认 UI。

为什么没有保留：

- 虽然解决误触，但重新把 Reader 变成传统确认对话框；
- 比 armed state 更重。

结论：**Rejected**。

### 方案 D：不同输入端完全不同的产品逻辑

形式：desktop 一套逻辑，mobile 为了方便直接做另一套更简单逻辑。

问题：

- 输入动作可以不同，但如果“确认是否离开”的产品语义不同，会产生两个 Reader；
- 后续测试和行为预期更难保持一致。

结论：**Rejected**。

## 最终决定

返回入口只在正文最终节点出现。

行为顺序：

`cue appears`

→ 第一次对应输入

`armed`

→ 第二次对应输入

`confirm`

→ 手绘 cue 反向收回

`retract`

→ 收回完成

`navigate`

→ live Landing 接管。

### Desktop

以 mouse / wheel 为主要输入语义。

### Mobile / pen

以 touch / pen / swipe 为主要输入语义。

两端物理动作可以不同，但产品语义相同：

**第一次告诉系统“我要离开”，第二次确认“现在离开”。**

## 本轮具体修掉的问题

- final node 在 mobile 上不出现 return；
- safe area 导致控件位置异常；
- landscape 情况；
- armed swipe 被 Reader 原有输入逻辑吞掉；
- sticky hover；
- return control 出屏；
- selector 与整屏 swipe 的真实手势范围不合理。

这些问题已经是本轮真实修复历史，未来不要把它们当作从未处理过的开放问题。

## 为什么最终这样定

armed / confirm 是在“普通按钮”和“完全手势黑盒”之间的中间点。

它保留了 Reader 的非传统 UI 感，又给误触增加了一层保护，并且允许 desktop / mobile 用不同输入设备表达同一意图。

## 未来施工规则

除非有真实用户证据证明 armed / confirm 本身造成严重理解障碍，否则：

- 不回到固定按钮；
- 不改成单次输入立即离开；
- 不增加传统确认 modal；
- 不因为 mobile 某个手势 bug 就顺便重做整个 return 产品逻辑。

---

# Decision 05 — Reader → Landing Handoff

状态：**Locked**

## 原来是什么

为了让 Reader 返回 Landing 更有连续感，本轮中间阶段曾把更多视觉责任交给 Global Transition / overlay。

典型链路逐渐接近：

Reader

→ overlay paper

→ overlay NewTone

→ overlay animation

→ 后方 Landing

→ Landing 再继续自己的状态。

## 为什么这个方向一开始合理

Reader 与 Landing 都有 NewTone / 手绘语言。

让一个 global overlay 在中间接力，理论上可以把两个页面“缝”起来，看起来不会像普通网页硬切换。

## 实际出现的问题

### 双 Logo / 接力感

当 overlay 有自己的 NewTone，Landing 又有真正的 NewTone，就必须精确管理谁先出现、谁后消失。

稍有时序问题，就会看到两个 Logo，或明显感觉“一个假 Logo 把动作交给另一个真 Logo”。

### 责任越来越混乱

Reader return 本来只需要结束 Reader。

但重型 transition 方案下：

- Reader 知道 transition；
- transition 知道 Landing 长什么样；
- Landing 又要识别 return state；
- 三者都在参与一段视觉表演。

### Mobile 状态复杂度放大

safe area、横屏、touch、swipe、本身的 Reader input 冲突已经需要处理。

再加一个拥有自己状态机的重 transition，只会增加更多交叉条件。

### Landing 被削弱成“接棒终点”

真正更自然的连续感，其实不是让中间动画模仿 Landing，而是让 Landing 自己尽快成为画面主体。

## 尝试并取消的方向

### Heavy Global Transition

结论：**Removed as final direction**。

### 双 NewTone / 双 Logo handoff

结论：**Rejected**。

### Reader 内继续承担 Landing redraw

结论：**Rejected**。

### 多种 Landing guide morph 作为交接桥梁

结论：**Rejected / simplified**。

## 最终决定

Reader 只负责自己的结束：

- return cue；
- armed；
- confirm；
- cue retract；
- navigate。

然后立刻由真正的 Landing 负责：

- live parallax；
- NewTone redraw；
- return state feedback；
- feedback fade；
- guide 再出现。

核心原则：

**Reader 不模拟 Landing。Landing 不需要等待另一个假 Landing 演完。**

## 为什么最终这样定

这条链更短，责任更清楚，同时视觉上反而更连续。

用户看到的是 Reader 的结束动作，然后就是活着的 Landing，而不是一个专门为了证明“我们正在转场”的动画层。

## 对现有代码的解释

`src/components/GlobalTransitionOverlay.jsx`、对应 CSS 或 transition store 中可能仍然保留历史代码/兼容逻辑。

**文件存在不等于设计仍然有效。**

未来如果有人看到这些文件，不应推断“GlobalTransition 是被暂时忘记使用的正确方案”。

任何清理或重新利用都必须先检查真实引用和当前任务。

## 未来施工规则

- 不重新加入双 Logo handoff；
- 不把 return 做成长时间中间动画；
- 不为了复用旧代码而恢复旧产品方向；
- 如果未来真的需要全局 transition，应作为新的产品决定重新评估，而不是默认沿用历史实现。

---

# Decision 06 — Analytics v2

状态：**Locked / Stable**

## 原来要解决什么

首章开始真实投放后，仅知道 Landing 有多少访问、Reader 有多少进入是不够的。

真正需要回答的是：

- 用户在哪里进入；
- 是否真的开始读；
- 阅读到了什么位置；
- 中间停留多久；
- 是否完成；
- 是否返回；
- 返回后是否继续；
- refresh / hidden / session end 会不会让 dwell 算错。

因此本轮不是为了“多埋点”，而是为了建立可解释的阅读链路。

## 本轮决定增加的能力

事件/能力包括：

- `reader_entry_requested`
- `content_status`
- `page_entered`
- `chapter_entered`
- `beat_dwell`
- `chapter_completed`
- toolbar `language_selected`
- toolbar `mode_selected`
- `browser_back`
- visibility dwell
- `session_end` cumulative dwell

这些事件围绕的是**阶段、位置、完成与时间**，而不是把用户每一次鼠标/滚轮动作都记录下来。

## 遇到的关键问题：refresh 后 dwell 截断

早期逻辑中，refresh 会产生较早的 `session_end` / checkpoint 关系，导致如果直接使用错误的结束点，累计 dwell 可能被早期记录截断。

如果不解决，会出现一种非常危险的情况：事件看起来很多、系统看起来很精确，但核心阅读时长本身是错的。

## 最终决定

Dwell rollup 使用：

**最后一个 cumulative checkpoint + checkpoint 后新增 visible dwell**。

这让 refresh 后仍可从最新累计事实继续，而不是被更早的 session end 截断。

## 真实 staging 验证

一轮 session：

- 88 events；
- sequence 从 1 到 88；
- 无 duplicate sequence。

链路成功覆盖：

Landing

→ Reader request

→ language

→ mode

→ reading started

→ chapter/page/beat

→ dwell

→ 25%

→ 50%

→ Reader return

→ Landing

→ continue

→ 原位置继续。

最终 dwell：

`70.840s`

## 已取消 / 明确不做的方向

### Mousemove 级监控

不做。

理由：信息量大，但对当前核心产品判断价值低，同时增加数据噪声和实现复杂度。

### 普通 hover 级监控

不做。

理由：当前真正要判断的是进入、阅读、位置、时间、完成与返回，不需要把每个 UI 微反应都转成 analytics。

### Wheel 微行为监控

不做。

理由：Reader 本身使用 wheel 作为交互语言，如果把每次 wheel 都埋点，会产生大量输入噪声，不等于用户意图。

### 为了“以后可能有用”无限加事件

不做。

原则：新事件必须先对应一个明确产品问题，并证明现有事件回答不了。

## Migration 决策

当前 staging 已经存在：

- `20260809195527_analytics_observability_v2.sql`
- `20260809200742_analytics_observability_v2_summary_flags.sql`
- `20260809202406_analytics_dwell_checkpoint_rollup.sql`

这些属于当前 Analytics v2 历史事实。

未来不重复创建同语义 migration。

## 为什么当前封板

Analytics 的目标不是无限接近“什么都知道”，而是用尽量少、可解释的事件回答真实产品问题。

本轮端到端链路和 dwell 已经真实验证，因此继续增加微行为事件的边际价值很低。

## 未来重新打开的触发条件

只有出现新的明确问题，例如：

- 现有数据无法区分一个重要的 Reader 流失阶段；
- 新产品功能引入新的关键 funnel；
- 当前 dwell / completion 定义发生结构性变化；
- 真实数据证明某个现有事件含义不可靠。

否则保持当前 Analytics v2，不继续扩张。

---

# 本轮总原则

这六个决定背后有一个共同方向：

**NewTone 当前不是通过增加更多 UI、更多动画层、更多输入监听或更多数据点来变好，而是通过减少职责重叠，让每个系统只承担自己真正需要承担的部分。**

Landing 做 Landing。

Reader 做阅读。

Return 做结束确认。

Landing handoff 不再变成第三个页面。

Analytics 回答问题，而不是记录一切。

如果未来施工与这个方向发生冲突，不代表永远不能改，但需要先明确：产品条件发生了什么变化，为什么旧决定已经不再适用。
