# R1：旧来源变化后的安全重新确认

父候选8cbae5cfdf60b117e3a1866246827c98694f748f保持冻结。本后继只修改saveEpoch常量、saveEntryService、专用测试和此说明，不改入口/手机/游戏规则。

## 原阻断与修复

原链：prepare持久pending -> 旧来源改写 -> commit stale -> resolve superseded -> pending仍活动 -> inspect永久PENDING_OPERATION。

新链：resolve持锁核验ticket/candidate/namespace/退役完整性及当前状态；若source snapshot已变，只有首次create/restart、backup.authorityRaw=null、物理authority及ACK均不存在、guard缺失或本ticket的prepared guard时，才写一份独立持久退役记录。

物理键 newtone-persistence:era-1:retired:<operationId>，schema1，含saveEpoch/ticket、完整pendingRaw、该ticket的prepared guardRaw、backupKey/backupRaw、退役原因和canonical SHA256。hash不是玩家身份签名；用于本地数据完整性核验。

退役记录读回成功才返回 superseded + resumeAllowed=false + UNCOMMITTED_OPERATION_RETIRED。既有controller随后inspect，显示legacy-ready，必须再次点开始新游戏；不会自动prepare下一局。

不删除pending/guard/backup或旧原文。activePendingRaw只把与已验证退役记录精确相等的pending视为非活动；readGuard只忽略精确绑定的prepared原文，永不忽略committed guard；孤儿备份仅在key和raw都精确匹配已验证记录时排除。新prepare可替换活动键，旧原文仍完整留在退役记录和旧备份内。

退役写入是单个setItem；写前失败继续保留原冲突与证据，腾出配额后可重查重试。写后抛错返回unresolved，刷新验证已落盘记录后可重新确认。没有多键删除/清理中断序列。

所有退役记录在inspectInternal中验证hash；commit/resolve在采信其逻辑状态前也先inspect。真实未知/损坏的记录暂停，不成为孤儿豁免。

## 绝不退役的情况

- authority已提交本ticket：恢复其最新快照、余额与新handle，不能重新初始化。
- committed guard但authority缺失：继续保护，不能拿初始pending再发800。
- authority存在其他代际/新局，ACK存在、读取失败、candidate/ticket损坏、备份冲突或guard归属不明：不证明未提交，返回unresolved/blocked。
- 当前代际continue/replace冲突：本次不扩展清理规则，不借初始旧档重开修复清掉新游戏凭据。
- 没有退役记录的真实orphan prepared guard/backup：原保护不变。
- 另一标签持锁：busy；不绕锁、不发新ticket。

hash异步返回后，再精确复核authority/ACK/pending/guard/backup未变化才写退役记录。非合作旧客户端不受Web Lock强制约束的既有边界不变。

## 测试与执行边界

新增 tests/saveEpochRetirement.test.mjs：pending写入、backup写入、prepared guard写入三个位置导致stale；controller重新检查 -> 退役 -> 刷新 -> 返回零随机 -> 二次明确确认 -> 新局 -> 650消费/ACK/刷新；原ticket拒绝重放，全部旧证据留存。

另含退役quota、写后抛错、无变化原ticket恢复、跨标签busy、已提交恢复、committed孤儿、authority写后不确定、读取失败、坏ticket、真实孤儿、坏退役hash及新代际replace负面对照。

本窗口不运行测试/typecheck/build/浏览器。Terra应先执行：

```powershell
node node_modules/vitest/vitest.mjs run tests/saveEpochRetirement.test.mjs tests/saveEntryService.test.mjs tests/historicalDateCompatibility.test.mjs src/services/entryController.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

再做实际浏览器旧标签写入、原生锁、刷新/二次确认及三个阶段故障。8c的原33台账不变，未重跑/未关闭。

## 新增限制

退役记录复制一份失败操作证据，消耗本地配额；不删除证据腾空间。反复发生stale并由玩家明确重试会增加记录，尚无自动清理策略。记录损坏会安全暂停。正常旧槽噪声在已成功新局之后不会创建这些记录。

新规则只解决首次未提交操作的安全退出；当前代际自身的未知/冲突不自动清理。本轮未修改真实分支、服务或发布。

## Terra新增API分类失败

8c实测149过1失败：坏/孤立新PENDING的prepare返回stale，原测试期待blocked。根因是prepare在解析pending之前先用inspect失败得到的null token比较snapshot，先抛SNAPSHOT_STALE。controller对stale只inspect一次，不自动submit；坏pending经getRecovery原本会blocked，未见数据覆盖，但API分类不准确。

R1保留原blocked断言，将pending合法性/活动冲突检查移至token比较之前。新增真实controller重查仍failed、零随机、零创建、无退役记录的用例。合法无pending时的source变化仍stale；合法未提交ticket仍走原恢复或严格退役规则，没有放宽孤儿保护。尚未运行此修补的测试。


独审补充已纳入：坏pending的controller用例明确统计start/recheck的prepare调用=0、commit调用=0、setItem/removeItem写入=0，不仅比较最终raw。坏pending不进入退役函数。

静态检查：三个改动代码文件经TypeScript解析器语法检查无诊断，git diff --check通过；没有执行回归、typecheck、build或浏览器。

回退限制：原8c源码保持不变，但8c不认识R1新增retired物理键，会保护性拒绝该命名空间；保留旧源码不等于承诺对已产生R1存储的无损降级，更不能清理R1证据以强行回退。
