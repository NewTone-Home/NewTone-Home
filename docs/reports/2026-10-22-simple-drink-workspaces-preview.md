# 三店简化员工区视觉候选（4225，未发布）

基线875453da / 4224。按作者本轮简化要求试排，不沿用扩整店或给两茶开员工口的废弃方向。

## 画面具体变化

两茶柜台向顾客侧各移56参考像素，店铺外壳和所有墙门不动。奶茶竖柜左缘213→157，果茶101→157；同为22厚，横回折随之延长56接原侧墙，仍封口。员工区内每店只一张靠墙的中等长工作台，不再显示13件机器。Cafe长柜/横柜/32员工口不动，上方独立短柜只剩轮廓；四张原桌加框，桌椅位置和碰撞不动。

奶茶菜单右墙y168→56，位于横柜上方的入口顾客区域，合法阅读落点(280,56)；果茶左墙y616、公客落点(160,616)不变；Cafe菜单左墙392和黑板252不动。菜单仍替换墙字而不是地面标签。

## 坐标与通路（均局部参考像素）

|店|竖柜实心边界|工作台(左,上,宽,长)|工作台与竖柜净宽|工作台端部留空|
|---|---|---|---|---|
|Cafe|185..207，y72..488；原位|16,144,24,280|145|上端距后墙内缘136，下端距横柜42|
|奶茶|157..179，y101..692|296,196,24,336|117|上端距横柜下缘73，下端距后墙内缘160|
|果茶|157..179，y8..571|16,112,24,336|117|上端距后墙内缘104，下端距横柜101|

两茶顾客侧剩余连续宽度约149参考像素，不需放宽人物碰撞。奶茶员工站位248→216、y392不变；果茶88→112、y252不变。员工权限带宽112→168，与柜台中心同步；后门位置/锁均不变。56是参考像素位移（等于两段28墙节距），不是把家具字距改成28；字16、家具内部16、墙28和当前投影保持。

## 文件 / 函数实际改动

- `shopInteriorTrial.ts:addCounterSurface`：新增显示名称/隐藏字/工作台角色/统一业务入口元数据。三店用同一实体构造工作台，每个实心段仍有真实接触面。
- `trialCafeInterior`：4散设备移除独立实体碰撞，保4旧ID为无碰撞兼容引用；新工作台24×280；四桌focusFrame；短柜hideLabel；菜单黑板不变。
- `buildTakeawayTrial` / `trialTakeawayInteriors`：两茶柜台与区域/服务锚/站位同步；4+5旧设备仅留ID名称引用，无旧坐标/独立碰撞/可见字；新24×336工作台。奶茶菜单搬入口段。
- `mainlineSceneModel.ts`：增加表面显示元数据、单级interactionAliasId。它共享业务，不共享错误的物理接触位置。
- `MainlineCounterSurface.tsx`：去掉原点单/取餐透明小热点；实体任意部位和文字都走本段入口。L主体两组字，短柜无字，工作台一组字。外轮廓仍取真实矩形并集，不填L空心、不跨员工口。
- `mainlineSceneInteractions.ts`：解析既有交互/选项时单级取别名目标；寻路仍针对本段。Cafe各段用原commercial-cafe-counter状态机，不新增订单；已点单继续提示已点。两茶只是现有点单位置查看说明，未虚构完整经营系统。
- `SimpleDrinkWorkspaces.test.tsx`：新增13项，包括1工作台/兼容无碰撞、真实员工16脚印两端/锁后门路径、顾客各段/菜单入口相关行为、两茶闭合/Cafe32口、4桌原尺寸、共享订单去重。

## 已验证

- 四文件37/37定向：SimpleDrinkWorkspaces、cafeAccessFeedback、cafeSeating、commercialCafeBehavior。首次2项浮点严格等值失败是1e-14加法表达式误差，改为10位精度比较，不改几何或通路断言。最终37全过。
- 共享mainlineSceneInteractions另测5项，4过1失败；仍为既有“矿区”期待与“矿区外围老街”实际名称差异（该文件75行），没有改名或删断言。
- tsc --noEmit通过；隔离Vite构建通过，仅已有大chunk提示；diff-check通过。
- Chrome隔离非空测试档，1920×1300三店全图实际生成并查看；菜单正常点读，无pageerror。
- 三店横柜非文字区域实际点击均抵达正确公共侧；Cafe出现原已点咖啡反馈，两茶出现原点单位置说明。
- 1280×800三店正常真前门进出；390×844模拟手机果茶触屏进出。Cafe原椅坐起通过，原送咖啡出现27个不同可见位置后delivered。
- 工作台两端、后门员工路径为真实16脚印模型验证；两茶静态员工未新增制作或经营AI，不称其已在运行制作。

## 可看本地图片 / 固定包

根目录 `E:/小说/NewTone-Workspace/preview-drink-layout-contracts-20261022/`：
- `.tmp/simple-padded-L-counter-browser/cafe-full-room.png`
- `.tmp/simple-padded-L-counter-browser/milk-full-room.png`
- `.tmp/simple-padded-L-counter-browser/fruit-full-room.png`

本轮按要求仅本地保存，未上传Library。浏览器证据另在 `.tmp/simple-padded-L-counter-body-clicks/`、`.tmp/simple-padded-L-pair-counter-front-smoke/`、`.tmp/simple-padded-L-pair-counter-cafe-delivery/`、`.tmp/simple-cafe-seat/`。
测试JSON `.tmp/simple-workspace-tests-final.json`、`.tmp/simple-interaction-regressions.json`。

本地 http://127.0.0.1:4225/ ，HTML HTTP200/2277字节。最终JS `index-D8HR_sR3.js` HTTP200/864953字节，SHA256 `a630ed0431122ee7e2c51723625c50c0b3c3d172380bedd2b6e593c8b5dfefb0`；CSS `index-CGh3wNIs.css` HTTP200/200573字节，SHA256 `2d1e58d828b388fe280461c6df36351b83657fbbe32c14763870d44f77afe039`。

## 限制 / 没做

未跑全量，旧逐件设备/重复柜台标签等契约未在此扩修，不能推断全量只剩历史11。作者视觉尚待验收；实体手机/全座位/全剧情未重测。厨房生产交互未新增。未改其他场景桌子、相机、世界比例、门/剧情、矿区6文件、设备视距分支或真实存档。4224固定产物保留，4173未换；没有push/正式部署/Notion写入。
