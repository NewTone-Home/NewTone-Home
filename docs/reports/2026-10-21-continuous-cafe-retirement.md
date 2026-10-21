# B：移除独立 Cafe，接回连续街道（隔离候选，待独立 QA）

## 做了什么

旧网址 `scene=commercial-cafe` 现在进入商业街现有 Cafe 室内，并改写为连续街道 URL。旧房间不再构建第二份墙、曲窗、柜台、桌椅。兼容字典的旧 ID 只返回同一个 street 对象，且不参与枚举，不是第二个实体。

保留旧剧情命名空间、对白 ID、咖啡状态、联系人/手机笔记/背包和剧情时钟。旧独立房间坐标按旧有效范围 8..88 / 7..93 的相对位置映射到现 Cafe 室内，内缩一格；刷新不会再次映射。普通街道/其他场景续玩保位。旧后门 ID 查询指向现有合法后门，不另造门。

## 实际文件 / 函数变化

- `mainlineSceneModel.ts`：删除旧 Cafe 构造和 blueprint；街道编译后调用 `bindContinuousCafe`。`mainlineScenes.ts`：旧 scene/route/slice 查询兼容同一实体；新增 `legacyCafeEntryPosition` / `resolveLegacyCafeEntryPosition`。
- 新 `continuousCafe.ts`：绑定现有 Cafe 前桌/两椅、柜台到原剧情 ID；恢复老周、咖啡店员、跑堂的行为与室内 owner。现有三组桌和柜台位置保留，不是新四桌内装。
- `playerSave.ts/sanitizePlayerSave`：迁移旧 scene 和位置，保留原故事数据；缺时钟的旧档仍按旧 Cafe 阶段恢复。
- `CenterExperience.jsx`：旧 URL canonical 化；合并读取 street 与旧 Cafe 剧情数据；进入实际 Cafe 房间时沿用原剧情时钟/手机笔记节点。
- `MainlineScenePage.tsx`：剧情仅在 Cafe 室内恢复，原剧情键仍写旧 namespace；离开真正 Cafe 前门才完成原离店节点，其他店门不会完成它。
- `MainlineSceneRenderer.tsx`：有 roomId 的 Cafe NPC 按本店 room 显示，街道行人未隐藏。
- `commercialCafeStory.ts` / `commercialCafeBehavior.ts`：从 scene-ID 判断改为实际连续 Cafe 能力判断，跑堂只找 Cafe 本店桌，不把其他店桌纳入。
- `mainlineNavigation.ts`：角色不能进入的语义区域加入该角色路线建图输入，给图提供绕行顶点；碰撞本体、门、运动权限检查不改。缓存签名仍含精确障碍输入。

## 查到并修正的问题

1. 初次绑定加桌椅连线导致剧情椅子不可达；撤回这批新增连线，保留原连续布局碰撞。后续桌椅窄缝/文字碰撞规则属于 C，不在 B 假装完成。
2. 员工区已拒绝公众进入，但建图没有该禁入区的绕行顶点，候选路线穿过员工区后被合法性检查否决。补角色专属建图输入后，老周实际离店 walking-out→departed；逐段合法性断言通过，店员可进而公众不可进。
3. 曾怀疑 28 门宽与两字 NPC 足迹冲突；宽度对照仍失败，推翻单因假设。最终禁入区绕行输入修复后，真实足迹路径可达，未改门洞或缩碰撞。

## 实测 / 证据

- 定向迁移/剧情/店员行为/入口/时钟测试：`.tmp/cafe-retirement-ready-tests.json`。
- 加 worldNavigation 组：67 项中 61 通过，6 失败；新迁移与角色绕行测试全部通过。遗留失败包括已记录街东边界、旧独立柜台/门域断言，不能称全绿。
- 修改绕行前全量：718/784，66 失败；相对 A 的 17 基线，16 保留、50 新失败。大部分断言依赖已批准删除的旧独立实体/坐标，但仍需逐项迁移和复核。绕行与时钟修正后的完整组另在跑，未提前宣称通过。
- `.tmp/cafe-retire-flow-final/results.json`：旧 URL→连续 Cafe；真实柜台确认点咖啡→preparing→ready；点击剧情椅坐下→原老周对白，无 pageerror。
- `.tmp/cafe-retire-save-browser/results.json`：3 组隔离旧位置、2 桌面+1 手机尺寸；位置和联系人/剧情保存，刷新保持，正常真门点击退出至街道；无真实用户存档读写。
- `.tmp/cafe-lao-browser-fixed/results.json`：隔离旧 walking-out 进度恢复后真实 departed。
- typecheck + isolated Vite build 通过，保留已有 >500kB chunk 提示。未测实体手机/Safari、完整全对白逐句点完、全部旧存档任意坐标组合。旧档测试夹具必须带已有 release-cutover 标记，否则会进入既有发布切换清档逻辑，不能误报兼容结果。

## A 发布权限阻塞（未绕过）

已通过独立 QA 的 A 应用为 `860d070e05ade6c6bd08f7bad2d39d6c1b6aa9d7`。提权命令准备复制到 E:\NewTone-Preview\published-builds\860d070...、停止 4173 PID 32892 再启动同隧道服务。自动审核在 CreateProcess 前拒绝；明确未执行，目录未产生、PID 与公网仍服务 bae6afb。理由：外部可见替换带来服务中断/回滚风险，委托授权未被视为该具体修正构建的直接用户授权。没有重试或替代路径，需直接用户明确许可该构建替换现有临时预览。

## 范围

B 未发布、未 push；4173/隧道未改。矿区尺寸/颜色、四店新内装、手机新倍率均未混入。独立 QA 和旧测试契约迁移尚待收口，不冒称整体签收。
## 冻结候选补充

- 应用 SHA `cbf170072d8bb05420ffc60d5070aef1358ba57e`，隔离 `http://127.0.0.1:4200/`，PID 12108。
- JS `index-CZIFlAET.js` 837522 bytes，SHA256 `87193f02fe25faa19ca3463cd7243752d1158a7d8e73a2f2f52c10c4055dccde`。
- CSS `index-BsDrr4lS.css` 200381 bytes，SHA256 `67dbb36fb235e8f7493fda38992e06ed6f9b88cfb724e7b928fefe6c4aa5664e`。
- 最新定向（含时钟）46/46；最新全量（权限绕行与时钟修正后）725/785，60 失败，详见 `.tmp/cafe-retirement-nav-all-tests.json`。不得把旧实体断言直接全部标为无效，需要逐项迁移与复核后再收口。独立 QA 待进行，不能发布。
- Notion 原板子页已正文追加实际 diff、函数原因、测试与 A 发布拒绝，并回读确认 SHA、资源哈希和 CreateProcess 拒绝记录可见： https://app.notion.com/p/400b138d1e11816da99bc4b4d90f873d 。
## 独立QA后两项真实问题修复（4200未换包）

父QA指出此前实际离店说法不成立：Renderer始终传配置座位，visualPosition无条件椅中心，运行位置变化被遮盖。已收回旧结论。

- `mainlineSeating/mainlineNpcVisualSeatId`：初始/当前坐席行为才返回视觉seat锚；移动或不同duty（含等待/阻塞）使用真实运行位置。Renderer接此函数。原座位占用释放、门预约和剧情权限未改。
- `mainlineScenes/compileMainlineFrameUnits`：此前Cafe只有门及左右一格物理base，其余可见窗墙为visualOnly。B员工区绕行暴露这段误判可走的窗墙带。本次仅Cafe补全现有canonical字符格的常驻物理base，门/旧flank IDs及passage collision范围不变；额外窗墙格不挂passageId、不会随开门变可穿。不是加虚构房体或放宽窗墙。
- `continuousCafeRenderedDeparture.test.tsx` 实际Renderer HTML回归：两个不同离座运行点必须渲染两个位置，不只是辅助函数测试；坐席行为仍绘在椅中心。`continuousCafeActualDeparture` 验窗墙采样开/关门均不可占、远窗侧到真门路线逐段在室内。
- 5条存档契约只更新已退役scene规范化期待，保进度/手机及旧cleanup不回写检查，未删除测试。家具/人数/旧独立几何契约留待最终布局批次，不为凑绿批删。

真实浏览器 `.tmp/cafe-visible-window-browser/results.json`：相同QA窗侧存档点向外街道点击，异常窗墙带采样0，最终(147.903,42.8025)；离店记录52个不同老周DOM可见位置，经门中心x122.833、y31.886→34.968后门生命周期结束再departed，非原椅静止消失。两组无pageerror。

一度用普通findMainlinePath的null误判两字NPC过28门必阻塞；已撤回该判断和改“人”提案。原门生命周期专用过门流程在获准/开门后用既有transit zone，本次未改，真实可见过门已采到。保留老周文本/角色/原足迹，不偷偷缩碰撞或扩窗墙。

7文件定向40/40、typecheck和Vite build通过；未重跑完整剧情和全量套件，不能把原60失败按算术直接宣称剩55已测。实体手机/Safari未测，独立QA待复验。
候选4203使用 `index-dOp1fzrV.js` 837728 bytes，SHA256 47aaceb1d2e95228b76dc6aea32ce8964c2365a7871e60d93261376ade59167b；CSS仍index-BsDrr4lS.css200381。清理未用import后重建与4203字节哈希一致。矿区独立4202未混入；A发布继续停止，公网不变。
