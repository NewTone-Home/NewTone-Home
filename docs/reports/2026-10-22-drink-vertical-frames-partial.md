# 2026-10-22 三店竖排设备／同侧菜单／连续柜台框——部分视觉候选

## 不是完整新柜台签收版

独立4221，仅先交不依赖接头例外的部分。旧4220/4219与公网不覆盖、无push/main/staging/Vercel、矿区6文件差异保持暂停。本次柜台原有字数、端头字对和位置尚未修，不能把本包称为作者全部新需求完成。

作者要求墙28、家具16、完整柜台字对、接墙点对齐墙字格并无覆盖。当前几何有余数：奶茶前折边y112、后墙y700，16连续字中心排到688，最后至墙中心仅12；Cafe竖柜x176处于墙横格168/196之间，前折边y496在墙纵格476/504之间。直接改字符顺序或平移一个字不能同时满足完整字对、固定16与墙格位置。最小建议是只在接头的末一／两整对做局部收口，每对内部仍16、不挪墙门、不丢字，实际间隙必须小于主角11px且不叠字；该柜台间距例外尚未获答复，未实施，未擅自把先前墙尾例外扩大到柜台。已发选择请求；另一个选择是保持每邻字16但重选整柜摆位，会有较大位置变化，不能暗改。

## 已实施的独立部分

- 13件器械文字本身竖排，不是仅物件纵向排；渲染16×(字数×16)，声明碰撞和实际文字碰撞同样窄长。每件器械有原有互动闭合框，仍是查看说明，没有新烹饪／生产系统。
- 全部柜台字符可互动且由原碰撞实体的连续段共用一个框；Cafe3段、两茶各2段，不每字新框。原commercial-cafe-counter仍唯一cafe-order行为；其他柜台提供简单既有查看语义，原服务ID保留，没有重复订单／新剧情。
- 菜单、黑板移到员工柜台侧墙：Cafe与果茶left、奶茶right，仍由真实墙owner的feature替换对应墙字符，墙碰撞保持闭合。公共阅读锚点分别局部x208／160／176，站在柜台外阅读，不开放员工权限。
- 三店柜台及壳坐标没动，两茶实体围合、Cafe唯一32px员工口仍原550f119。设备换成竖字后字符实际占位变化是本次明确要求，桌椅位置及16内部距不变。

## 文件与函数实际改动

src/center/runtime/mainlineSceneModel.ts仅新增可选textLayout和focusFrameGroup。未声明的其它场景行为不变。

sceneLayout.ts的mainlineEntityUsesVerticalText／mainlineEntityTextFootprint：识别作者指定的vertical，字符宽16／长按16字距，垂直lineHeight1；未用facing强行假装旋转桌椅，未动普通字号或设备缩放。

MainlineSceneRenderer.tsx：将vertical写入实际label的writingMode／textOrientation，帧分组读focusFrameGroup。objectFrameOwners每场景建一次Map，连续段只由首个字符挂一份框，其余字符提供同组测量目标，避免重复SVG和逐字大堆框；原服务按钮仍各自派发原ID。

shopInteriorTrial.ts：counterRun／buildTakeawayTrial让全部柜字符可查看并按真实body归组；设备显式vertical＋interactive focusFrame且声明碰撞随文字转向；embedCustomerWallText可提供合法publicX而非把人送进员工侧墙前。新增publicSide将顾客接触侧／权限边界与菜单墙方向分开，避免菜单换墙后误把点单或员工权限反向。

## 测试与浏览器证据

- tests/drinkShopPresentation.test.ts新7项，加既有drinkCounterClosure/cafeSeating/commercialCafeBehavior共29/29通过。.tmp/vertical-frames-targeted.json。
- 根据父QA最新858项845过13失败（旧11＋新增2），迁移storefrontInteractions中从公共入口到已围合果茶员工后门的旧起点：公众拒绝，实际16px员工初始位置可到后门，仍保locked及门权限命令。mainlineVisualFootprint将2柜体→实际3柜体，保世界碰撞联合／公共订单接触。两文件21/21通过。.tmp/two-remaining-contracts.json。未重跑旧版全量，不能宣称新包全量只剩11。
- tsc --noEmit、隔离Vite build、diff-check通过，只有既有大chunk提示。
- Chrome1920×1300隔离非空档，三店同侧墙菜单正常点击并从合法公共锚点读出，无pageerror。真实截图等待4200ms后再拍，已查看效果；设备框闭合、竖字无遮挡。柜台端头与完整字对未修，L相邻两段框在转角处边缘相近／重合仍须新接头方案一起视觉复验，未说所有新视觉已验收。
- Cafe实际点击椅子坐下／地面起身通过；coffee-ready剧情夹具真实NPC25个不同可见位置送到剧情桌，状态delivered，无pageerror。不是重走完整剧情。
- 证据.tmp/vertical-frames-stable/{cafe,milk,fruit}-full-room.png与results.json；.tmp/vertical-counter-cafe-seat-browser/results.json；.tmp/vertical-counter-cafe-delivery/results.json。实体手机／Safari／新性能对照／完整故事本轮未测。

## 固定部分候选

http://127.0.0.1:4221/。JS index-BS1zYkGX.js860387字节，SHA2563271bdd73dbb94fd96828537a29b1602e90d3698d53f431f38ca2dbc98203a9f。CSS index-CGh3wNIs.css200573字节，SHA2562d1e58d828b388fe280461c6df36351b83657fbbe32c14763870d44f77afe039。

Library实际上传成功：Cafe libfile_6ad3f68afc188191964853394981eb81；奶茶libfile_cf1025ac3e048191825f02e03849dbea；果茶libfile_9cb0bc503a5c81918a15e4d7150174fb。图片为桌面真实Chrome渲染，非布局示意图。Windows本机无os.setxattr，未声称Library扩展属性已写入。

## Notion补记准确回执

作者最新明确批准向Codex留言板3fcb138d1e1181e5ad6bff119e01cfd0追加非公开施工／测试说明，已先fetch格式查重（没有6cb2c5d）。此次权限审核通过，但insert_content在连接器解析旧正文时返回400 validation_error／INVALID_ARGUMENT：Missing closing </code> tag，共7处。不是权限拒绝；本次未写入，不重试、不修改旧正文、不改写其它页。待父处理板格式或指定可追加方式，不能用评论冒充正文。

原准备追加内容包括4219→4220／550f119运行／6cb2c5d仅测试51定向、QA限定范围／全量待核及本次新增要求待实施；失败没有被记作成功。准确Notion回执和本次待定接头方案交父处理。
