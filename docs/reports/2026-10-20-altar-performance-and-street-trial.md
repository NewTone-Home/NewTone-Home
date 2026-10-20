# 祖宅呼吸测量修复与商业街镜头试作（候选，未发布）

基线：`8d4023945013fe093e85252e89b29ac47f3070c0`。公共4173保持基线；本轮只在4174验收。没有修改地图尺寸、1920基准、28/16格距、家具布局、导航、剧情或真实存档。

## 1. 祖宅：供桌固定；真实点香才亮；不因呼吸重测文字

原因已用同设备干预对照验证。旧 `mainlineEntityUsesBreathing` 将供桌及未点香香炉都列为呼吸对象；`hasAltarBreathing` 只检查场景是否含供桌/香炉，故未点香也启动RAF。时钟写到带 `data-focus-visual-group` 的文字节点，`SceneFocusFrames` 的style MutationObserver因此每帧重测各组及其所有邻居。它不是持续存档或布局计算导致的停顿。

实际关键diff（完整差异见本轮分项提交）：

```diff
- || isIncense || isOfferingTable
+ || isIncense && incenseLit
- const hasAltarBreathing = scene.objects.some(entity => isAltarEntity(scene, entity.id))
+ const hasAltarBreathing = incenseLit && scene.objects.some(entity => entity.visualProfile === 'incense')
- <SceneCharacters ref={labelRef} data-focus-visual-group={focusGroup} ... />
+ <span className="scene-mainline-object__grid-content" ref={paintRef}>
+   <SceneCharacters data-focus-visual-group={focusGroup} ... />
+ </span>
```

`MainlineSceneRenderer.tsx`：供桌退出呼吸资格、共享RAF注册；香炉仅fresh/half燃烧状态注册。RAF只写外层画色容器，字体/真实文字节点仍保留style/class/content监听。

`scene.css`：删除供桌呼吸及互动时强制高亮的覆盖规则；供桌固定normal颜色/opacity1；未点香香炉normal颜色/opacity.5（不依赖explored/tutorial/hover）；真实点香后opacity1，外层颜色及opacity .86–.98呼吸。保留原十分钟生命周期。

`SceneFocusFrames.tsx`：普通测量请求合并到一帧；仍监听文字子树内容/style/class、文字与局部host大小、局部host位置样式、字体加载和stage resize；显式以worldScale作为投影变化依赖。相机整体平移和画色容器的亮度写入不通知字形测量。保留门牌动画端点两帧稳定性及generation取消机制。

真实动作已有实现：`resolveMainlineSceneEchoChoice` 仅成功的“重新点香”写 `incenseLitAt=now`；普通查看无stateChange；Page从存档时间计算剩余时长，进场不重启。此次没有新增或伪造动作/存档字段。

### 同设备性能前后

Chrome155.0.8059.85，1280×800、DSF1，headless隔离context；同路径、相同1800ms稳定等待后采4秒，未点香和恢复已点香各3次。修改前后脚本完全相同：`.tmp/profile-altar-current.mjs`；原始数据 `.tmp/altar-perf-before/results.json` / `.tmp/altar-perf-after/results.json`（保留untracked）。时间是浏览器rAF/CDP采样，不是工具响应时间。

| 状态 | FPS前（3次） | FPS后（3次） | ScriptDuration前→后（每4秒） | bounds读取前→后 |
| --- | --- | --- | --- | --- |
| 未点香 | 30.1 /31.6 /29.5 | 100.0 /99.8 /99.8 | 3.909–3.922s → .012–.014s | 178560–190464 →0 |
| 已点香 | 27.6 /29.9 /32.5 | 100.0 /100.1 /99.8 | 3.907–3.917s → .026–.027s | 166656–194928 →0 |

未点香时呼吸写入600–640→0；已点香仍保留香炉400–401次画色写入，但不再触发bounds读取。修改后6次祖宅采样均0长任务，rAF p95约10.1ms；前有50–74ms长任务。大院/办公室前后均约100FPS。前后全部采样Storage.setItem写入0、LayoutCount0。Range.getClientRects计数器本次没覆盖实际使用的Range方法，不能将其0计数解释为没有字符测量；结论依据实际Element bounds读取和CDP脚本时间。

这证明本设备空闲场景停顿修复，不能推定所有设备、进场瞬间、行走或其他剧情状态都已验收。

首轮回归：Renderer/SceneFocusFrames/endpoint scheduler/visual bounds/incense state/interaction visual state 6文件28/28通过。typecheck及隔离Vite构建通过（既有大chunk提示）。真实点香/读档、修改文字尺寸后的画框及手机截图验证结果待追加。

补充：`49c8c47` 使外层object和画色wrapper真实transform/font/class变化也会通知测量；只剔除 `--scene-breathing-progress` 这一属性，未一刀切忽略外层所有样式。补丁后完整候选再次用完全相同脚本采8组：未点香3次99.91–99.96FPS、Script .0103–.0111秒；已点香3次99.98–100.05FPS、Script .0492–.0551秒；6次均0 bounds读取、0长任务、p95 10.1ms。读取额外样式过滤增加少量脚本开销，但不再进入昂贵的整组测量。数据 `.tmp/altar-perf-final/results.json`，JS `index-lVz4Rtd1.js`。

真实浏览器1280×800及390×844均验证：普通点击/查看后 `.5` 且无 `incenseLitAt`；完成原有阅读和“重新点香”操作后opacity1、paint opacity随周期变化；四供桌前/查看/点香后/刷新均固定normal颜色、opacity1、无时钟写入；reload保留同一个incenseLitAt。临时将文字font-size改为28px，桌面框40.10×24.10→59.55×35.10 CSS px，手机39.68×23.68→59.34×34.68，截图确认实际文字被闭合框包住。只在隔离DOM改字用于回归，没有写布局。数据与截图 `.tmp/altar-state-qa/`；尚未覆盖所有字体下载失败/替换或真实设备GPU条件。

## 2. 商业街分屏镜头（试作，待独立QA）

提交 `5f15f5d`，新增 `commercialStreetCamera.ts` / `.test.ts`，接入 `useMainlineCamera.ts`。只有commercial-street室外街道使用分屏；店内通过已有室内owner识别退出该策略，其他场景不使用。

改前：人物一越过画面中央35%–65%区域，镜头就跟随。改后：同一屏内镜头目标固定；人物走到画面左/右10%边缘区域，才对准相邻一屏。常规平移75%视野、重叠25%；末端短余量并入最后一屏，最大80%视野，避免多出几乎重复的一屏。沿用140ms指数趋近缓动。判断基于目标屏，避免平移过程中立即倒退。初始化/viewport改变选离人物最近的屏，不更改人物坐标、路径、速度或输入方式。

```ts
while (last - centers.at(-1)! > span * .8 + .00001)
  centers.push(centers.at(-1)! + span * .75)
if (last - centers.at(-1)! > .00001) centers.push(last)
while (page < centers.length - 1 && x > centers[page]! + span * .4 + .00001) page++
while (page > 0 && x < centers[page]! - span * .4 - .00001) page--
```

两端直接使用8d已验 `mainlineCameraOffset` 的边界，不改地图/缩放/碰撞。5个camera测试覆盖1280×800、1920×1080、390×844端点、往返单调性、同屏不动、切屏后不反跳、恢复位置选屏、店内及其他场景绕过。

1280×800真实点击行走：actor世界x=34→162.607→8.3065，y50；camera x约-1.00489→-69.9084→-1.00481。果茶入口近点(22.1767,39.875)，进店(22.2082,27.4074)镜头y7.5879，出店回(22.2082,39.4074)镜头y趋近0，截图核对本店家具和门框。记录 `.tmp/street-paged-qa/1280.json`。最初键盘脚本未移动，已废弃，不用作验收。手机反复西行曾触发原有x12离场阈值并打开手机，造成后续点击被挡；不是已证明的相机故障，也不修改出口/手机逻辑规避。正在用停在离场阈值前的正常点击重跑；未完成部分不算通过。独立QA仍待执行。

## 3. 门牌翻动范围减半（待独立QA）

提交 `8d6391e`，`mainlineScenes.ts/isMainlineStorefrontPresentationInRange`：保留原approach中心和原来的radius分支，仅最终视觉半径乘.5。`nearRadius`原字段仍10，碰撞、interaction radius6、门洞、可点击范围、presentation handoff并行动画均未改。

```diff
- const radius = departureRadius !== undefined && alongInward < 0 ? departureRadius : authoredRadius
+ const previousRadius = departureRadius !== undefined && alongInward < 0 ? departureRadius : authoredRadius
+ const radius = previousRadius * (scene.id === 'commercial-street' ? .5 : 1)
```

全部14店测试原中心内4.9有效、5.1无效；街道中线y50不触发。咖啡馆旧特殊departure helper只查 `glass`，真实立面数据是 `window`，当前返回undefined并回退普通10半径；本轮维持这项已有行为，实际半径也减为5。另用受控glass夹具证明若该分支有效，同样减半。没有擅自启用另一个咖啡馆阈值。Presentation30项通过，保留门框/并行动画原断言。

## 4. 矿区共享接口独立提交

提交 **`4fb0d1d3862f919dbb3f3a877b18c005cc0c458b`** 可供矿区cherry-pick，只有5个共享代码/测试文件。只读查看矿区 `miningStreetShell.ts`，确认8店均以 `mining-street-public-lane` corridor通过routeThrough门连接实际shop room。

新增 `storefrontRoomConnection` 从storefront.portalId找到同世界routeThrough passage，再取from corridor和to room；无场景名、无room-id后缀依赖。`activeStorefrontPresentationOwner` 只在其公共走廊触发；`activeStorefrontInteriorOwner` 在实际店内bounds保持该店owner，深入房间也不收回门框。`mainlineNavigation/targetIsInsideStorefrontFrame` 与入口意图使用同一房间关系，沿街点击保持普通行走；legacy跨场景门保留旧策略。

```diff
- if (scene.id !== 'commercial-street') return null
- passage.fromRoomId === 'commercial-street-public-lane'
+ const connection = storefrontRoomConnection(scene, storefront)
+ connection && pointInStorefrontRoom(position, connection.interiorRoom)
```

删除旧“永和门不许characterSwitch”的断言（它与新矿区连续店铺授权相反）；新增非commercial场景+任意room名称夹具，覆盖14店深入owner、普通街道点击、门洞进出、legacy不虚构室内。38项定向测试/typecheck通过；未写矿区worktree、未改矿区地图/相机/范围；真实矿区4175集成及独立QA由矿区线程完成，不能用此夹具冒充实际8店验证。

## 合并回归与已知限制

11文件84/84通过（renderer、focus、endpoint、visual bounds、incense、interaction、camera、viewport、presentation、visibility、room connections）。扩大导航/家具4文件72项中71通过，1项原有导航测试失败：要求x170/180/190位于商业街可走范围，但8d固定世界右界约162.9134；单独 `git archive 8d40239` 导出的原始src/tests同一用例复现相同失败。未改该测试，也未把它算通过。原始归档留 `.tmp/8d-regression-check/`，不提交。

typecheck及隔离Vite构建通过，只有既有500KB chunk提示。公共4173保持8d，未改真实存档、未部署Vercel，尚待独立QA确认后再决定发布。场景墙字vw/clamp比例问题另外只读审计，不混入上述提交，也没有修改UI文字。

### 手机点击重跑与当前交接状态

390×844已完成正常点击往返及果茶进出：世界x34→161.816→17.9618，y50；镜头x10.5445→-100.952→30.0388。西行停在原有x12离场阈值之前，避免用例主动离场触发手机。近门(22.1605,39.5735)已翻；室内(22.2082,27.4074)镜头y7.58763；出店(22.2082,38.1165)镜头y趋近0。本次真实截图已查看：门框闭合、家具进店可见、街路人保留。记录 `.tmp/street-paged-qa/390.json`。手机触屏手势及跨所有14店动画的独立验收仍待QA，不能将desktop mouse模拟等同真触控。

当前4174维持 `8d6391e` 运行代码（含祖宅、框监听补充、镜头、范围四项提交），因为已检测到独立QA香炉脚本正在读取它，避免中途换版本。HTTP首页/JS/CSS均200：JS `index-lVz4Rtd1.js` 827129bytes，CSS `index-Br7LuK_y.css` 199938bytes。公共4173只读核对首页200且仍 `index-CuUPkzmo.js`。

共享接口提交4fb0d1d的构建已单独完成，尚未替换4174：`.tmp/altar-street-shared-final-dist`，JS `index-BgVc83y2.js` 827028bytes，SHA256 `d50b58e528fdde04f9183b45d8ebc7e5a7d299a551330c0285ea4d327eed651e`；CSS `index-Br7LuK_y.css` 199938bytes，SHA256 `13fdaf36486462a7e2366357489f70052ff8a8c49ce5b5517723b27c7dc3894e`。候选切换需与QA交接，不把旧资源当新commit实测证据。

本轮Notion正文报告： https://app.notion.com/p/3ffb138d1e11817dbda0d112d9788285 。已创建在原Codex板下，通过fetch回读确认实际diff、4fb提交SHA与性能数据；未使用评论冒充正文。Git提交本轮均在preview分支，未push、未发布公共4173；待独立QA后按父线程交接处理。

## 5. 已验祖宅/商业街与矿区组合候选

父线程独立QA已确认原4174 lVz候选：供桌固定、真实重新点香、性能约29→100FPS、桌面/手机分页返程端点和读档、果茶/文创进出、翻牌范围减半通过；隔离浏览器关闭后授权合入矿区并切换。此结论属于原祖宅/商业街候选，不提前当作组合版全部通过。

已先核对依赖：矿区742694c直接基于8d；c4e6817、79d4d91依次只增加测试/脚本/报告；其末尾081500f是共享4fb的等价cherry-pick（5文件差异完全一致）。因此只依次cherry-pick下列三个提交，没有重复共享改动，无冲突，也没有写矿区worktree。

- `742694c6c3d4218ba304b4455b1cf961276a9ba3` → `f7236ee`：矿区应用。
- `c4e6817` → `303b6c5`：矿区测试、隔离脚本和报告。
- `79d4d919a7fa8beb94907fb022eb9b888a8f81f1` → `516f9b16ee5476f8738a1ad4c72785aba43df5dd`：八店门洞记录补全。

相对ce8145c组合前HEAD，合入7文件408增/213删。应用只有 `mainlineSceneModel.ts` 与新增 `miningStreetShell.ts`；其他是测试/报告/脚本。实际关键diff：

```diff
+ import { createMiningStreetShellBlueprint } from './miningStreetShell'
- const yongheMiningPerimeterBlueprint = { /* 独立旧街道数据 */ }
- const yongheEateryBlueprint = { /* 独立永和室内与家具数据 */ }
+ const yongheMiningPerimeterBlueprint = createMiningStreetShellBlueprint()
+ const yongheEateryBlueprint = createMiningStreetShellBlueprint('yonghe-eatery')
```

矿区原作者构造方法保持不变：店名N字，立面宽N+3个格间距，深度2倍宽，`widthCells=N+3`、`depthCells=widthCells*2`。8店与走廊处于同一scene，正门routeThrough连接corridor→room；旧永和URL显示同一完整世界；后门锁，房间为空壳。删除旧独立小馆家具/文本属于此次矿区空壳应用原提交范围，未新画布局、未改变商业街/咖啡馆/奶茶店家具。矿区保持原普通跟随相机，不采用商业街分屏；商业街范围减半仍只在commercial-street生效。

组合检查：原12文件92/92通过，typecheck与隔离Vite构建通过。随后增加实际矿区8店在两种scene URL深入房间时owner正确、街道owner释放的回归（不再只依赖改名夹具），12文件93/93通过。未把旧8d导航越界用例的失败删掉或改成通过。全局视觉审计四类残留只读，没有追加修复。

### 当前可供独立QA的准确资源

4174已经切换，运行代码提交 **`516f9b16ee5476f8738a1ad4c72785aba43df5dd`**；后续本次提交只增加测试与报告，不改bundle内容。

- 地址 `http://127.0.0.1:4174`；首页2277bytes、JS/CSS均HTTP200。
- JS `index-CP1zSUw1.js`，824927bytes，SHA256 `85dec0e6ca5f28d22f6c6b6252ef21ca23929847252155edacab0d57c84bb38e`。
- CSS `index-Br7LuK_y.css`，199938bytes，SHA256 `13fdaf36486462a7e2366357489f70052ff8a8c49ce5b5517723b27c7dc3894e`。
- outDir `.tmp/combined-mining-altar-street-dist`；服务仅替换经核对的4174 Vite进程。
- 公共4173只读核对200，仍 `index-CuUPkzmo.js`，未发布/替换，真实存档与8d回滚保留。未push、未调用Vercel或改main/staging。

矿区随附deep脚本原先依赖仅DEV模式提供的data-runtime-x，直接跑production preview会等待超时；截图实际已入店，不能因此判产品失败。只在untracked副本中将采样改读actor真实inline left/top，在4174重跑；不修改产品或打开开发模式。组合版深入门框与实际门洞独立QA仍待父线程验收。

该副本在组合版production preview完成：桌面深入(22.4324,31.3196)、手机深入(22.4857,31.265)，等待4.5秒后本店招牌phase均revealed、门框visible；刷新恢复同一深入坐标，再正常点击正门出店至桌面x40.815、手机x41.1065，scene仍yonghe-mining-perimeter。已查看两张真实截图，门框完整且本店仍是门；此项仅实测永和深处，不冒充八店逐一浏览器重测。原始记录及截图 `.tmp/combined-mining-qa/deep-browser.json`、`deep-1280.png`、`deep-390.png`，脚本 `.tmp/combined-mining-deep-built.mjs`。八店两URL owner数据回归已在上述93项中覆盖。
