# NewTone Current Rules

最后更新：2026-08-09

用途：这份文件只回答一件事：**如果现在继续施工，必须遵守哪些当前有效规则。**

它不是历史记录，也不是未来规划。历史原因请看阶段记录和决策记录。

---

## 1. Git 分支边界

当前正式分支：`main`

当前施工/测试分支：`staging`

当前 main 基线：

`8d88d00dcb3b0e01f1bd3f81cd5b36c98177f4af`

2026-08-09 本轮记录建立前的 staging HEAD：

`528601fe29de264153331be28e30d1a49c98486c`

建立 internal records 本身会继续产生 docs-only commit，因此不要把上面的 staging SHA 当作永久当前 HEAD。任何新施工开始前，都应重新读取真实分支状态。

### 绝对规则

- 不直接修改 `main`。
- 不擅自 merge 到 `main`。
- 不 push 到 `main`。
- 所有施工、实验、修复默认先在 `staging`。
- 不因为 staging 比 main ahead 很多就重新从所有 commit 开始做无目的考古；只有在具体问题需要时才回看相关 diff/commit。
- 正式发布之前必须重新比较最新 `main...staging`，不能假设 main 永远停在当前基线。

---

## 2. 环境边界

NewTone 当前明确区分 staging 与 production。

### Staging

- Git：`staging`
- Vercel：staging Preview / branch alias
- Supabase：独立 staging project

### Production

- Git：`main`
- Vercel：Production
- Supabase：独立 production project

### 当前权限规则

- 默认只允许操作 staging Supabase。
- 除非 Owner 明确要求，否则不修改 production Supabase。
- 不把 staging analytics、Auth、session、reading progress 或测试数据覆盖/同步成 production 数据。
- migration 先以 staging 为施工与验证环境。
- 不为了测试方便临时让 staging 指向 production。
- 不在 internal records 中保存 service role secret、密码、私钥或其他真正的敏感凭据。

环境细节优先参考：

- `docs/STAGING_ENVIRONMENT.md`
- `docs/STAGING_HANDOFF.md`
- `docs/OWNER_ADMIN_AND_ANALYTICS.md`

---

## 3. Landing 当前边界

状态：**Locked**

Landing 本轮的大方向已经确认，不再进入“看到哪里还能优化就顺手优化”的模式。

当前保留的核心行为包括：

- NewTone 标题自己的描画 / 擦除时序；
- 当前手绘引导箭头语言；
- 箭头保持短、直、手绘感，描画出现、擦除消失；
- guide 与 NewTone 使用反方向 parallax；
- Reader 返回后由真正的 live Landing 接管；
- 返回 Landing 后仍保持 live parallax；
- 两条签名手绘线按当前确认过的时机出现；
- Landing 自己负责返回后的 redraw / feedback / guide，而不是由 Reader 伪装一个 Landing。

### 不允许的无理由改动

- 不重做 Landing 箭头。
- 不重新设计 Landing parallax。
- 不为了“更漂亮”替换当前 NewTone / guide 的视觉语言。
- 不重新引入已经取消的复杂 Landing guide morph 体系。
- 不把 Reader return 的过渡职责重新塞回 Landing 外部的重型中间层。

### 可以重新打开的情况

只有以下情况之一发生时才重新打开：

1. 用户报告可稳定复现的具体 bug；
2. 某设备/浏览器出现明确兼容性问题；
3. Owner 明确要求重新讨论产品方向；
4. Landing 整体产品职责发生结构性变化，而不是局部“想优化”。

---

## 4. Reader 首次进入当前边界

状态：**Stable**

Reader setup / entry 已经从普通设置页式流程，整理成连续进入 Reader 的交互过程。

当前原则：

- language / reading mode 是进入 Reader 的连续步骤，不应该重新做成传统 modal/settings page；
- desktop 与 mobile 可以使用不同输入方式，但语义必须一致：用户需要明确选择/确认，而不是被无意 hover 带走；
- hover、wheel、scroll、touch、pen 等反馈只服务于选择确认，不为了“有互动感”无限叠加输入技巧；
- mobile 不应出现 sticky hover；
- 不恢复已经删掉的多余 divider / 普通设置页式 UI；
- Change language 的职责与“确认当前主选项”的职责保持分离。

如果继续调整，优先修具体输入 bug，不重新设计整个进入流程。

---

## 5. Reader 阅读体验当前边界

状态：**Locked / Stable**

Reader 本体当前重点是阅读，而不是把阅读界面继续产品化成工具面板。

当前约束：

- progress 是非交互反馈；
- progress 不承担点击、拖动、hover 控件职责；
- remaining percentage 平滑变化；
- remaining label 只承担阅读进度反馈；
- 不因为“进度条看起来可以交互”就增加 seek / click / hover；
- 不增加与阅读无直接关系的装饰型工具控件。

除非出现明确阅读体验问题，否则不要继续改 Reader UI。

---

## 6. Reader Return 当前边界

状态：**Locked**

这是本轮明确封板的核心交互之一。

当前行为合同：

1. 正文结束后出现返回 cue。
2. 第一次对应输入只进入 `armed`，不立即导航。
3. 第二次对应确认输入才完成 return。
4. 导航前，两条手绘 cue 先反向收回。
5. 收回完成后才真正离开 Reader。
6. 进入 Landing 后，由 live Landing 自己接管后续表现。

桌面主要输入语义：mouse / wheel。

移动主要输入语义：touch / pen / swipe。

### 已解决并不应随意重做的问题

- mobile final node 出现返回入口；
- safe area；
- 横屏；
- armed swipe 与 Reader 原输入冲突；
- sticky hover；
- 返回控件出屏。

### 禁止无理由复活的方向

- 固定常驻返回按钮；
- 单击 / 单次输入立即返回；
- 重型 global transition；
- 双 Logo 接力；
- Reader 内部伪造 Landing 的 redraw；
- 为了动画复杂度重新延长 return 链路。

如果用户没有报告明确 bug，不再调整 mobile return。

---

## 7. Reader → Landing Handoff 当前边界

状态：**Locked**

最终方向是轻 handoff，而不是一个独立“转场产品”。

当前责任划分：

**Reader 负责：**

- return cue；
- armed / confirm；
- cue retract；
- 完成导航触发。

**Landing 负责：**

- live Landing 本体；
- NewTone redraw；
- 返回状态反馈；
- 状态淡出；
- Landing guide 再出现；
- Landing 自己的 parallax。

不要重新引入“双 Logo 接力”、长时间 paper overlay、重型 GlobalTransition 作为默认方案。

`GlobalTransitionOverlay` 相关代码即使仍存在，也不能仅因为文件存在就推断“应该重新使用”。是否保留/清理代码要以当前实际引用和未来具体任务为准。

---

## 8. Analytics v2 当前边界

状态：**Locked / Stable**

Analytics 当前阶段已经完成端到端验证，可以视为封板。

当前已覆盖的关键事件/能力包括：

- `reader_entry_requested`
- `content_status`
- `page_entered`
- `chapter_entered`
- `beat_dwell`
- `chapter_completed`
- Reader toolbar `language_selected`
- Reader toolbar `mode_selected`
- `browser_back`
- visibility dwell
- `session_end` cumulative dwell

本轮真实 staging 测试已验证：

- 一轮 session 产生 88 events；
- sequence 1 → 88；
- 没有 duplicate sequence；
- Landing → Reader → language → mode → reading → chapter/page/beat → 25% → 50% → return → Landing → continue → 原位置继续的链路可成立；
- refresh 后 dwell 不再被早期 `session_end` 截断；
- cumulative dwell 使用最后 checkpoint 加 checkpoint 后新增 visible dwell；
- 本轮实测最终 dwell 为 70.840 秒。

### 当前禁止继续扩张的方向

- 不为了“数据越多越好”继续无限加埋点；
- 不记录 mousemove；
- 不记录普通 hover 微行为；
- 不记录每个 wheel 微行为；
- 不把 analytics 变成重度行为录像系统；
- 不重复创建与当前 migration 同语义的新 migration。

只有出现新的明确产品问题，并且现有事件无法回答时，才重新讨论增加埋点。

---

## 9. 已存在的 Analytics migrations

Staging 当前已经有：

- `20260809195527_analytics_observability_v2.sql`
- `20260809200742_analytics_observability_v2_summary_flags.sql`
- `20260809202406_analytics_dwell_checkpoint_rollup.sql`

规则：

- 不重复创建同语义 migration；
- 新 migration 必须解决新的 schema/logic 变化；
- 不通过新 migration 掩盖自己没有先检查现有 migration 的事实。

---

## 10. 记录系统当前规则

当前 internal records 暂时放在：

`docs/internal/`

原因：目前记录数量少，不需要为了形式提前建立独立 private repository。

当前目录虽然叫 `internal`，但它依然处于现有 GitHub repository 中，因此：

- 这里保存“项目内部施工知识”，不等于“访问权限私密”；
- 不写秘密和真正敏感信息；
- 记录数量明显增多、需要独立权限或需要与 public repo 生命周期分离时，再迁移到 private repo。

当前结构保持简单：

- 当前规则；
- 阶段记录；
- 决策记录。

不要在没有实际需求时继续增加 architecture / research / experiments / graveyard / retrospective 等多层目录。
