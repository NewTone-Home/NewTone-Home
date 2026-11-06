# 一次性旧测试档新局：隔离实施交接

基线：5f114a46fc65872a8b69336d1c52ef0cfe7603a9，原目录 newtone-historical-date-fix-20261104 保留。新独立本地克隆 newtone-save-epoch-20261105，branch fix/save-epoch-reset-20261105。不宣称已上线。

## 固定身份与状态

- 固定 SAVE_EPOCH=persistent-era-1。公开展示版本、PlayerSave schema2、authority protocol2、每局 generation UUID 和此政策代际彼此独立。普通更新不得变更 SAVE_EPOCH 或物理命名空间。
- 新物理前缀 newtone-persistence:era-1:，键 authority / pending / acknowledged / guard / backup:<operationId>。与旧 cutover 的固定旧键及布局前缀无交集。save-session JOURNAL 与服务引用同一常量。
- 值内 saveEpoch、origin（service-epoch-1 或 retired-test-data）和 new-exempt placement 都严格校验；新物理槽里缺字段/坏JSON/未知代际不能降级为旧档。
- guard 有 prepared/committed 阶段。备份完成、最后旧来源复核后写 prepared guard，再复核旧来源，写 authority；authority 读回成功后写 committed witness，读回成功才发 handle。有 committed guard 而无 authority 一律保护，不能从最初 pending 恢复初始800。
- 已知旧键的原始 localStorage 字符串作为 sources 和 backup.sourceRaw 保留，不转换旧进度，不解析旧 pending 来继续其操作。包含旧官网 PlayerSave、Reader/混合、独立手机/位置、原型 journal、旧协议2 authority/pending/ACK/backup。坏旧JSON同样只归档。无关键不读不写；未知游戏命名空间返回安全状态。
- 本地字符串 JSON 归档后可精确还原 UTF-16 内容；不把字符串归档说成访问了浏览器底层磁盘文件。

## 服务与入口接口

inspectSave(): empty -> [create]；legacy-reset-required -> [restart,back]；generation-current -> [continue,request-replace]；未知/损坏/冲突 -> [back,reinspect]。inspect 纯只读、零随机、零创建。

prepareEntry({intent:create|restart|continue|replace,snapshotToken,overwriteConfirmed?}) 生成并持久化唯一 ticket（operationId/requestHash/baseSnapshotHash）与完整候选。restart 只允许已知旧数据且无新authority；continue 只允许新代际；replace 只允许合法新代际且明确确认。

commitEntry({ticket}) 先备份并读回核验，再复核并写新 authority；返回 committed 包含 snapshot / receipt / sessionHandle / ticket。写后不确定返回 outcome-uncertain，保留持久证据并释放写入资格。

getRecoveryState() 只查看新代际 pending，不重放旧候选 pending。resolveOperation({ticket}) 核验原 ticket；真实其他标签持锁仍 busy。仅证明未提交且原 snapshot 未变时 resumeAllowed=true；已提交恢复同一 authority 的最新值、generation 与余额，服务签发新 handle。

acknowledgeEntry({ticket,sessionHandle}) 在首场景 ready 时调用。ACK 失败/不确定先撤销旧 handle、释放锁/轮询，再返回恢复状态；不回滚真实已提交数据。正常ACK刷新回继续/新档选择；未ACK中断恢复同一操作。

旧档入口显示“此前测试进度本次不沿用，将从新游戏开始。旧原始数据保留。”，按钮“开始新游戏／返回”。仅返回/取消不写数据。主动替换当前新代际仍需确认，取消不改状态。

## 新局与保留边界

新局复用真实 createInitialPlayerSave：2025-04-12 10:00、gameTimeMs=36000000、800、商业街、inner手机、空订单/收据/工资/交付/手持/游戏进度；保留作者的初始便签而非旧玩家便签。老周开场 pending，明确初始未触发。

此次不走历史四地点搬迁、旧剧情/探索/时间/余额/手机/老周证据导入。已确认普通商业街 surface->inner 兼容实现未改。新代际正常继续/回表世界不再做一次性重开；当前代际仍保留未完成对白段首恢复的既有运行规则。

语言/主题/动效/必要初始化偏好仅取已验证白名单；独立Landing引导合法值保留。旧authority/journal内已保存的同类合法值也可提取；不导入旧Reader地址、完成状态、事件、布局、游戏内提示。未找到独立音量契约，不承诺音量迁移。

## 并发与失败

沿用 newtone-save-entry-writer-v2 的原生 Web Lock，防止合作的新标签互写，保留真实 request 完成释放屏障。旧客户端不受新锁强制约束。

提交前对已观察到的旧来源变化返回 stale；旧源快照保留在 pending/备份。非合作旧代码在最终读与写之间的任意并发不可能由 localStorage 多键事务完全锁住，不能宣称跨旧客户端原子性。

成功后旧槽退役，不再监控旧来源；后续改写/删除旧槽不覆盖新authority、不无限增长归档、不误停当前游戏。新authority和guard变化仍撤销handle，正常运行提交继续受唯一写入和事务发布保护。

配额/存储/锁失败停止，不删除原文腾空间。首次大档归档与候选/备份有复制成本，配额不足可能无法进入，不能宣称保证成功。人工新档备份继续保留，未实现自动清理策略。

guard/ACK/备份残留而主档缺失按恢复规则保护；全部新代际凭据被外部清除后，本地无法辨认此前存在过新档。localStorage.clear、浏览器清理、设备损坏无远程恢复保证。

范围仅同浏览器同网站来源；没有云同步/跨设备/永久防丢承诺。所有源码、服务、真实用户存储及正式main/staging的发布权限仍独立，本次未推送/部署/公告。

## 测试政策变化与未执行项

tests/saveEntryService.test.mjs 改为实际新政策服务回归；原完整5f测试以.txt存于本目录供审计，test-policy-changes.json列原用例名称。没有skip/todo。旧档保留游戏进度的服务期望被明确用户新政策替代；原生锁释放/ACK/写失败/运行时cleanup/撤销facade等测试仍在活动套件中。

tests/historicalDateCompatibility.test.mjs 保留旧转换器严格性单元测试；仅把服务层旧档继续改为明确restart，原文、ACK、刷新和未来余额保护仍验证。转换器存在不表示入口仍调用它。

五份真实历史writer合成内存原文（147/2b/024/822/6dc）来自既有Terra证据，SHA逐份静态核对，作为原样fixture；本轮未运行历史writer。其余家族输入是明确标注的合成结构代表，不冒充真实writer导出。

原33失败 original-33.json 原字节保留；failure-policy-ledger.json逐项写新政策影响，全部not-rerun-not-closed。没有更改这些失败的产品/断言来批量变绿。

本窗口只完成代码/测试编写、语法解析与静态审查。回归、typecheck、build、浏览器及独立审查均待执行，不记PASS。最终固定commit/tree和文件hash另见快照证据。
