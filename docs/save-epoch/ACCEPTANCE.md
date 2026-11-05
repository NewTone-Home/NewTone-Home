# Terra 同源验收命令（尚未执行）

在 newtone-save-epoch-20261105 工作目录执行。node_modules junction 指向原5f候选已存在依赖；未安装/改依赖。请先核验固定commit/tree/manifest及原候选clean身份，再执行。

```powershell
node node_modules/vitest/vitest.mjs run tests/saveEntryService.test.mjs tests/historicalDateCompatibility.test.mjs src/services/entryController.test.mjs src/services/entryPresentation.test.mjs src/services/entryWarnings.test.mjs src/services/entryAckLifecycle.test.mjs src/services/runtimeEntryLifecycle.test.mjs src/services/runtimeEntryIdentity.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
node node_modules/vitest/vitest.mjs run
```

保留原 Vite/tsconfig 参数，不加skip/globals/放宽timeout去迎合结果。全项目结果与 original-33.json 逐项对照，新增失败单列，不把旧失败自动关闭。

浏览器只启动隔离自有端口/离线资源，不动4173/旧公网/正式站，不读取真实玩家档。

1. 无档：开始前无写入/随机；点击后10:00、2025-04-12、800、inner手机、老周提示，首场景ready后ACK。
2. 五份历史writer原文、旧混合/Reader/独立槽、旧坏JSON、旧authority/pending/ACK/journal：显示重开说明和开始新游戏/返回；返回不写。开始不继承旧业务事实；每个旧字符串及备份逐字比对。
3. 新代际刷新：继续/新档；取消零变化，确认替换单槽且留备份；回表世界、消费到650、后续更新继续保持generation/余额/业务事实，不再搬迁/重开。
4. 每阶段注入写前失败和写后抛错：pending/backup/prepared guard/authority/committed witness/ACK。刷新按原ticket核验恢复；从不重复初始化/发800，不发布未持久化成功。
5. 发布handle后即使尚未ACK，删新authority也必须保护，不能从初始pending恢复800。缺guard、坏新档、坏pending/ACK、凭据孤儿、未知代际或命名空间均不提供自动新局。
6. 同标签重复点击、双标签锁交接、原生release回调延迟、其他标签持锁busy。撤销handle/定时器/卸载回调不能再写。
7. 提交前旧源变化停写；备份失败、配额满不删旧raw。提交后模拟旧cutover删除旧键、旧页面改旧player/Reader/旧authority，不冻新游戏、不增长无用旧历史；新authority/guard真实冲突仍恢复提示。
8. 偏好/独立Landing引导在选择前及新局后正确消费，坏偏好不假称保留；旧布局、Reader、手机内容/交易不导入。
9. 字符动效、焦点、手机触摸/键盘双击、开始与返回按钮、覆盖确认取消、StrictMode恢复面板保持可用。

公告草稿只审阅，不发布；跨设备不做。只要关键用例/新失败未过，不宣称可发布。
