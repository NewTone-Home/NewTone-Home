# 2026-10-22 三店旧布局契约收尾（仅测试）

## 交付状态

本次从独立工作树preview-drink-layout-contracts-20261022继续，仅修改7个测试文件与本说明。运行源码保持550f1194a4a09db7829f2617a63c01af89b4be4d，未改4220固定产物/4219/公网、暂停矿区6文件或真实存档；没有push。独立QA已验证550f119的实体围合、Cafe32px唯一出口、桌面/模拟手机交互及实际送咖啡，本轮不再改运行源码。

输入证据：E:/NewTone-Preview/.tmp/qa-full-8cd58f2-20261022/QA-full-result.md、baseline-comparison.json。其最新完整覆盖855项831通过24失败（原11+新增13）并非本轮新结果；本轮没有全量重跑，最终全量交QA对照。

## 原新增13项逐项迁移依据与保留覆盖

1. commercialStreetShellFurniture的Cafe计数：旧43/2体→现39字/3体。550f119为接后墙新增4字上段、缩短主段并上移前折边，总39不变。逐段核字符真实并集、16px连续、坐标唯一与三体任意两体无正面积重叠；菜单/厕所/业务ID保持。
2. 同文件后门接近：旧公众可到奶茶后门是旧通口假设。现实体围合员工区，顾客路径必须null，16px真实员工从实际初始点可达；门仍locked。未改快餐店的后场通路要求。
3. 同文件奶茶字格：按interactionStructureId取齐实际实体字符，包含原服务ID两格，不按旧ID前缀漏字。旧31/8cd的36→550f11944；保两体真实联合、每段16px、无重叠及未改快餐10字柜台。
4. 同文件菜单/点单/取餐：保6个既有ID；奶茶3项可互动，菜单surface=wall，两个业务字符属于真实柜台且字符中心不能站立。入口到每项公共接触点路径可达且目标在柜台左侧，保查看文本和业务点208px纵向分离；不再要求独立地面提示字。快餐3项仍静态非互动、原文本/客户侧/可达/文字净空及分离全保，未将三店授权扩大到快餐。
5. continuousCafeMigration：原order.position已是柜台实字中心，不可作为站立起点。负例明确柜台中心不可站；先从真前门求公共右侧接触点，再到原剧情椅，两个非零路径的每个段均合法。保旧URL/旧档/剧情/座位ID其余用例。
6. fixedInteractionAccess：旧下端通口已被前L封住；改局部(208,88)到(144,88)的真实32px出口。规划/线段两层均顾客禁止、员工允许，另加前折边即使员工也不能直穿。
7. npcFoundation：Cafe43/2→39/3，保唯一commercial-cafe-counter的cafe-order行为、每格无独立假碰撞、实体碰撞只注册一次、公共接触可站可达。名字改成three使断言语义准确。
8. takeawayInteriorTrial：果茶旧worker(168,252)已是顾客侧，改实际(96,252)；奶茶同步真实(240,392)。顾客不可站/员工可站、两业务点与前门可达、员工到锁后门仍测；联合体选取不再漏业务ID。
9. takeawayReviewAdjustment切果打包：旧56px/后横柜→当前同x48工作线，纵向84px；对柜台x120检查真实48px物件宽和约48px净空。文本碰撞坐标四位世界百分比舍入造成实际净空48.00064，测试逐字验证packBody.x=round(room.x+24/19.2,4)，再按明确柜台x120和48px物件宽求精确期望，不放宽核心容差。
10. 同文件奶茶回折：删除的rear-return旧ID/32px/y528改现front-return真实112px宽、原pickup ID在y432、后门仍锁且无多余员工区。拐角无重复字、两体必须接触（不只不能重叠），逐段每一相邻中心均16，替换原仅检查some邻字16的薄弱检查。
11. takeawayWorkerOperationRoutes果茶：该项已在550f119提交正确fixture，本次不重复改文件，但纳入实际复测。五个设备右侧操作、真实员工侧交付点(96,336)，16px动态movement adapter每段执行/到达、锁后门接近及回位；奶茶四设备包含煮料，也实跑，不恢复公众出口。
12. worldNavigation接触切线：旧下方目标改上右出口x176边界外，4个原始请求对应不同y切线，逐路径段合法、拒绝区ID正确，保多接触点而非把一切压到固定点。
13. worldNavigation raw/projection/access：公共空地请求仍原样，柜台内部目标必须投影，员工区顾客拒绝与公共右侧停点、员工能到原目标、普通巡桌员仍拒绝；没有把区域变空气墙。该文件原3项历史失败正文未改。

## 执行结果及准确计数

- 第一轮7文件49项：48通过1失败，无skip/todo；失败是上面第9项新增测试把48px写得比生产四位坐标精度更严格，不是运行回归。原始JSON保留.tmp/contracts-seven-files.json。
- 修改精确舍入期望并补强检查后，受最终修改的4文件37/37通过：shell furniture15、continuous migration10、NPC foundation9、review adjustment3；.tmp/contracts-final-four.json。
- 未再修改的fixedInteractionAccess3、takeawayInteriorTrial7、takeawayWorkerOperationRoutes2使用第一轮已过结果，共12项。
- worldNavigation只选上面2项，2/2通过；该次其余22项由命令行过滤未执行，不能算通过，也不是源文件skip。.tmp/contracts-world-two.json。
- 因此最终定向合并覆盖51个不同用例全通过（37+12+2），不是单次全量51调用或全项目全绿。原新增13的旧完整名称逐个映射到当前通过用例，机器检查13/13；.tmp/contracts-final-51.json含逐项映射、原始报告来源和测试文件SHA256。
- .tmp/contracts-baseline11-proof.json逐项核原11历史失败：未改文件整字节相同；worldNavigation内受同文件修改影响的历史用例正文也完全相同。原11不扩修，不声称已通过。
- 7文件it声明数均与父提交一致，动态参数化数量也未删，没有it.skip/todo或删除场景凑绿；允许更名的8条都有原名到新名对应。git diff --check通过。

## 复验命令

```powershell
# 所有执行均maxWorkers=1/testTimeout=120000；TEMP/TMP设本树.codex-test-tmp。
node node_modules/vitest/vitest.mjs run tests/commercialStreetShellFurniture.test.ts tests/continuousCafeMigration.test.ts tests/fixedInteractionAccess.test.ts tests/npcFoundation.test.ts tests/takeawayInteriorTrial.test.ts tests/takeawayReviewAdjustment.test.ts tests/takeawayWorkerOperationRoutes.test.ts --maxWorkers=1 --testTimeout=120000
node node_modules/vitest/vitest.mjs run tests/worldNavigation.test.ts --maxWorkers=1 --testTimeout=120000 -t 'derives distinct public contacts at the actual upper-right employee opening|keeps a reachable world click raw, projects blocked/access targets once, and honors actor access'
```

第一次原始失败与最终4文件成功均保留，不覆盖证据。若QA选择统一复跑，以上7文件在最终源上将覆盖49项，再加2个导航项；本轮不占用资源重跑无关全套。

## 未测/保持

没有新运行代码、没有新构建/替换固定包、没有重做已有独立浏览器验收或性能对照。等QA一次最终全量比较决定是否仍有新增问题；不预报最终全量只剩11。矿区6文件暂停差异保留，公开预览不变，无push或正式服务操作。
