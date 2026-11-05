# 2026-10-22 三店柜台端点收口候选

## 状态与边界

运行提交：550f1194a4a09db7829f2617a63c01af89b4be4d，独立分支 preview/drink-layout-contracts-20261022，基于8cd58f2。候选 http://127.0.0.1:4220/，未发布。旧4219与公共4173保持不变；无push、main/staging/Vercel或真实存档操作。原工作树6个暂停矿区文件保持原样。

父线程最新指令优先柜台，暂停旧13项测试契约收尾。因此7个已开始迁移的测试文件仍留在本隔离树，未纳入550f119；补丁保存在.tmp/paused-13-contract-reconciliation.patch。不得据本轮45项通过宣称原855项全绿。QA之前的831通过/24失败（原11+新增13）仍是最近完整批次，之后未重跑全量。

## 画面改前与改后

- 奶茶：长柜台x208从y112..560延至y112..688，共37字，前折边7字不动，总44字。短边接右墙，长边接后墙，取消从顾客区绕入的员工缺口。右工作线设备、初始员工、后门x280与锁权限不动。
- 果茶：长柜台x128由y112..560延至y16..560，共35字，加前折边7字共42字。短边接左墙，长边接后墙。旧order/pickup业务ID随新增前置字调整数组索引，实际位置仍为y432/y336；员工与设备、后门x56锁权限不动。
- Cafe：前折边y560移到y496，向上64基准像素（四个家具字距，约2.29墙格），左墙端不平移。保留x176主柜y112..496的25字，另补4字上段y16..64接后墙，留下y72..104的32像素唯一员工出口。主角11、员工16均有真实字符足迹；出口有足够余量。总字数仍39，由3个真实字符联合体构成，全部柜台以16像素内部间距排列。员工区高度随前折边560→496；只保留同一个有限权限区。
- 三店菜单、设备、桌椅、普通字号16、墙距28、整体缩放、壳尺寸、厕所和剧情不改。封口全由可见柜台字符构成，未加透明空气墙。

## 实际文件和函数

运行时仅src/center/runtime/shopInteriorTrial.ts：trialCafeInterior增加独立上段柜台、缩短主段并上移前折边，调整员工权限区；trialTakeawayInteriors延长两茶长段并保留果茶业务ID的实际接触位置。共享构造buildTakeawayTrial/counterRun仍以实际字中心的16像素并集建立碰撞，不放大物理体。

提交还包含tests/drinkCounterClosure.test.ts新3项、tests/drinkShopLayoutCorrection.test.ts更新数量/前折边/实际联合体数，以及tests/takeawayWorkerOperationRoutes.test.ts当前操作侧与全部煮料设备路径。其余旧契约部分更新未完成、未提交。

## 关键实际diff

```ts
// Cafe before:29 long glyphs112..560;10 front glyphs at560.
counterRun('cafe-trial-counter-long', Array.from({ length:25 }, (_,i)=>[176,112+i*16]),14)
counterRun('cafe-trial-counter-upper', Array.from({ length:4 }, (_,i)=>[176,16+i*16]))
counterRun('cafe-trial-counter-front', Array.from({ length:10 }, (_,i)=>[160-i*16,496]))
// Milk long:29→37, same start112; Fruit long:29→35,start112→16.
// Fruit original world service positions retained:order index20→26,pickup14→20.
```

## 真实验证

- 6个定向文件45/45通过，单worker、120秒case timeout；.tmp/counter-enclosure-final.json。包含新3项真实墙端接合、角色段穿越、唯一32px出口；两茶员工设备操作侧的真实movement adapter抵达、锁后门接近及返回；Cafe坐席和行为协调器、客户拒绝提示和墙内菜单。
- tsc --noEmit通过；隔离Vite build通过，只有既有大chunk提示；git diff --check通过。
- Chrome真实浏览器桌面1280×800：三店正常点击真门进入/返回；模拟390×844手机：果茶真实触屏真门进入/返回，四组无pageerror。证据.tmp/counter-front-smoke/results.json。不是实体手机。
- 桌面1920×1300三店全图及菜单正常点击，三组无pageerror，.tmp/counter-closure-browser/。已实际看三张全图，柜台端点接墙、Cafe独立出口可见。
- Cafe正常点击椅子坐下、点击地面起身，.tmp/counter-cafe-seat-browser/results.json。
- Cafe隔离剧情档设为coffee ready/coffee-delivery，页面运行实际店员送达：25个不同可见坐标，状态ready→delivered，无pageerror。跨柜台x176前后采样世界y=-22.5387，对应出口局部约95.78px（72..104内）。.tmp/counter-cafe-delivery/results.json。此项验证已备好后送餐，没有伪称新走一遍全剧情/点单制作。
- 初次沙箱Chrome访问4220被ERR_NETWORK_ACCESS_DENIED阻断，按正常权限审核获准读取本机；曾因服务未持续导致connection refused，随后独立服务成功运行，不涉及绕过权限拒绝。依赖junction尝试OS拒绝，后使用隔离依赖副本，不共享Vite缓存。

## 亮暗只诊断，没有改样式

MainlineSceneRenderer.objectVisibility对visualVisibility static给is-static；objectClass只对interactive不为false的对象赋交互视觉状态。scene.css：is-static opacity .34；normal-unexplored .9；explored .82并使用interaction-explored色。因此同一柜台原业务ID字比无业务普通字亮，不是碰撞或设备能否制作的证据。

实际浏览器computedStyle：普通柜台cafe-trial-counter-long-0、milk-tea-trial-long-counter-0、fruit-tea-trial-long-counter-0均.34/rgb(215,194,154)；未看服务字及设备.9/rgb(173,150,108)；已看commercial-cafe-counter为.82且explored色。各店完整对象表在*-shades.json；本轮不统一亮度，不改菜单位置。

## 深22→26的历史只读证据

fc34e68967bc20408219a075696e8a3ee1415c2a标题Expand commercial street interior shell geometry。实际diff把verticalCoordinateCount22→26、纵深21→25间隔，并改左右facadeCellCount+2、扩walkBounds和对应airwalls、去掉隔墙junction省字及延长divider。提交没有正文说明为何必须纵深加4中心，不能编成仅补角或来自净宽×2。当前固定26确非动态净门面×2；本轮不改壳/矿区尺寸。

## 固定资源与图片

JS index-BIiguHLb.js，859049字节，SHA256 7ef9b3e16bade81d75ce0558fcc7f3a4efb15e1aae4839cb6e303183dee56aff。
CSS index-CGh3wNIs.css，200573字节，SHA256 2d1e58d828b388fe280461c6df36351b83657fbbe32c14763870d44f77afe039。

Library：Cafe libfile_121bbd37ed4c8191a9ab4fafe9946361；奶茶libfile_782eb30c6bdc819198e6fefb4e65a5c5；果茶libfile_5467f08ba8d88191abfa0eecabf76090。原图路径.tmp/counter-closure-browser/{cafe,milk,fruit}-full-room.png。Library返回创建成功；Windows本地无os.setxattr接口，未声称写入扩展属性成功。

## 未测与待交接

等待独立QA/作者视觉复验；未跑全量/全部8席重测/实体手机/Safari/新性能对照。旧11历史失败不修。7文件旧契约收尾留工作树，矿区6文件暂停。未发布公网，未push。下一阶段先按新柜台要求继续这13项契约证明，不能恢复旧“两茶可绕入”的错误要求。
