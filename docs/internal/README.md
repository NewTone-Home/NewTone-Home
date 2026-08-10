# NewTone Internal Records

> 这是一套面向 NewTone 后续施工、维护与设计追溯的内部记录。
>
> 当前它暂时存放在 `NewTone-Home/NewTone-Home` 的 `staging` 分支中，因为记录数量仍少，还没有必要单独建立 private repository。
>
> **重要：当前仓库/分支并不因为目录名叫 internal 就自动变成私密空间。不要在这里写入任何 secret、service role key、密码、私人身份信息或只允许 Owner 知道的敏感材料。** 如果未来记录中开始出现真正需要访问控制的内容，再迁移到独立 private repository。

最后建立：2026-08-09

---

## 这套记录只分三块

### 1. 当前规则

文件：[`CURRENT_RULES.md`](./CURRENT_RULES.md)

负责回答：**现在继续施工时，什么可以做，什么不能做。**

这里保存的是当前仍然有效的边界，例如：

- `main` / `staging` 的施工规则；
- staging / production 环境边界；
- 当前已经 Locked / Stable 的区域；
- Analytics 当前阶段是否允许继续扩张；
- 哪些改动只有在出现明确 bug 或 Owner 明确要求时才能重新打开。

这部分只描述“现在有效的规则”。如果规则以后改变，应直接更新为新的当前状态，并在对应阶段/决策记录里留下变化原因。

---

### 2. 阶段记录

当前文件：[`STAGE_2026-08-09.md`](./STAGE_2026-08-09.md)

负责回答：**这一大轮到底做了什么。**

阶段记录不是 commit 流水账。几十个 commit 应该被收拢为几个真正有意义的产品/工程主题。

它的用途是让新的开发者或 Agent 不需要重新把整轮 commit history 从头考古，就能快速知道：

- 这一轮从哪里开始；
- 主要完成了哪些区域；
- 哪些结果已经封板；
- 哪些测试已经真实跑通；
- 哪些 migration 已经存在；
- 下一阶段是什么。

---

### 3. 决策记录

当前文件：[`DECISIONS_2026-08-09.md`](./DECISIONS_2026-08-09.md)

负责回答：**为什么最终要这样做。**

这是内部记录里最重要的一块。

它不仅记录最终方案，也记录已经认真尝试、随后取消或删除的方案，以及取消原因。目的不是保存所有试验噪声，而是避免未来施工者看到当前实现后，重新提出一个已经失败过的旧方案，再把同一个坑踩一遍。

当前决策记录重点覆盖：

- Landing interaction；
- Reader entry；
- Reader progress；
- Reader return；
- Reader → Landing handoff；
- Analytics v2。

---

## 与现有文档的关系

这套 internal records **不替代**以下现有施工文档：

- `docs/STAGING_ENVIRONMENT.md`
- `docs/STAGING_HANDOFF.md`
- `docs/OWNER_ADMIN_AND_ANALYTICS.md`

区别是：

- 现有 handoff 更接近施工现场的持续接手材料；
- internal stage record 负责把一个阶段压缩成长期可读的历史；
- internal decision record 负责保存设计/工程为什么这样定案；
- current rules 负责给未来施工提供最短的当前边界。

以后即使 `STAGING_HANDOFF.md` 继续变化，这里的历史决策也不应该被改写成“仿佛从来没有走过旧方案”。

---

## 记录原则

1. 不按 commit 数量写记录，按真正的主题写。
2. 不要求每天记录。一个主题阶段性 Stable / Locked 后再整理。
3. 不为了显得完整而记录所有微小试验。
4. 真正影响未来判断的废弃方案必须留下原因。
5. 旧历史不要因为新方案出现而被悄悄洗掉。
6. 如果未来某个 Locked 决策被重新打开，应在新的阶段记录中写清触发原因。
7. GitHub 里的代码是真实实现；internal records 记录的是边界、阶段和决定，不复制大段源码制造第二份代码真相源。
