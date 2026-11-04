# 商业街22净深 + 包墙框/六桌/真实卫生间候选

## 先说画面与范围

保留4225已接受的柜台和工作台。柜台视觉框端头现在跨过接墙的一个墙字，延到墙中心外14参考像素；墙字仍可见，实际柜体碰撞/点击区没有跟着伸进墙，也不填L空心。Cafe保原四组桌位/剧情ID，新增中排两组，桌椅实体净缝由6变14，外侧仍能坐起。两个右墙角补绿植，无新浇水玩法。

单人卫生间是真实168×168后方房间，有便器/洗手盆和同世界双向门；原“厕”位置变三字“卫生间”招牌，靠近翻出门。仓库员工后门仍锁，Cafe员工口32不变。

作者后续批准14店统一深度：所有普通店净门面11，内部净深22行，前后墙另算，共24墙锚点/23间隔/644参考像素；Cafe和快餐两模块净门面23仍只加宽不加深。没有按双店宽度生成44深。矿区算法与暂停dirty文件未动。

## 分阶段提交与实际文件

阶段A `61bb50ab65d213b6ae686d936776a2f3635d6dc7` 保留独立4226构建：
- `mainlineSceneModel.ts` / `shopInteriorTrial.ts:addCounterSurface`增加stroke-only outlineBounds；三店接头视觉端x/y=-14，奶茶右侧350/后端714（该数随后按新深度改658）。
- `MainlineCounterSurface.tsx`用outlineBounds只算描边并集；标签和hit rect继续基于真实body。没盖墙字或给墙增加可点柜台热点。
- `trialCafeInterior`原四桌(448,196)/(588,196)/(448,448)/(588,448)不动，新增(448,322)/(588,322)。每椅rest偏移22→30、外侧pulled44→52，字符碰撞仍32×16。12条显式桌椅关系导航线阻止从缝横穿，不变成占位矩形。原因：NPC16宽放不下14缝，但主角实际圆点11宽可容，不能靠扩大角色或家具空气碰撞冒充。
- 绿植(644,84)/(644,644)，两字碰撞32×16；缩深阶段下角移至y588避免落在新前墙上。
- `cafeRestroom.ts:attachCafeRestroom`给Cafe后方局部(476,-168,168,168)加房间，原toilet ID同世界连接，便器(532,-126)、洗手盆最终(608,-70)，没有新scene ID或复杂如厕状态。内部无多人/付费/剧情系统。
- `storefrontRoomConnection.ts`允许母房间不一定是corridor；`mainlineScenes.ts`仅内向嵌套门保留真实approach/门两侧点，避免被外立面固定法线重算到门背后；`useStorefrontPresentation.ts`保持母店门面，子门使用原靠近/停留/恢复动画。原街侧14店分支不变。

本次缩深阶段：
- `mainlineSceneModel.ts`把commercialStreetInteriorVerticalCoordinateCount26→24；所有店通过共同生成器变644深，正门/门面位置不动。快餐旧分隔墙原16..25行收为16..23，末端接新后墙，避免最后一字穿出去；不是布局精修。
- `shopInteriorTrial.ts`奶茶长柜实体y101..692收为101..636，视觉包后墙端714→658；员工区y112..700收为112..644。其余柜台/工作台保持局部坐标，北排后墙整体向街方向移56，Cafe卫生间也跟同一后墙锚移动56。Cafe低角绿植y644→588。
- `commercialDepthMigration.ts`与`playerSave.ts`新增一次性commercialDepthVersion=1，按旧14店房间身份先识别，再保后墙相对局部坐标；只在削除区域夹到42px安全内侧。当前与记忆commercial-street位置都处理，原坐标留commercialDepthBackup，当前版本读档不重复迁移、街道续玩位置不动。旧独立Cafe入口既有映射已按新Cafe bounds生成，明确跳过二次迁移，避免回忆位置重复平移。非本街剧情/手机/备注仍走原清洗/保存流程，不读写真用户浏览器档。

## 实际尺寸与基本安全

已对14房间逐一计算，普通宽336、Cafe/快餐宽672，全部深644；相当于普通净宽11/双净宽23、内部净深22、深度墙锚24。前后墙中心距离而不是把字数误写成间隔。房间摘要 `.tmp/depth22-room-summary.json`：14房间，escaped=[]。旧摘要快餐越界已被修复后的摘要替换。

奶茶员工区已收短，三店工作台不越界，所有有roomId的floor字符位置及其显式碰撞都在相应新房间；墙上的门/招牌不按floor误夹。原员工锁后门与Cafe32口保持。

## 有限验证的真实结果

最终6文件42/42通过：CommercialDepth22、CafeSixRestroom、storefrontRoomConnection、cafeAccessFeedback、cafeSeating、SimpleDrinkWorkspaces。JSON `.tmp/depth22-final-batch.json`。包含14店高度/宽度/正门及锁后门、所有floor文字与body不越界、14个旧房间合法点迁移/备份/幂等/回正门、旧卫生间位置/旧Cafe别名不重复迁、三菜单接近、12座外侧路径、11/16两footprint均不能横穿桌椅缝等。

首次旧4桌/6缝期望按明确新要求改为6桌/14缝，保字符真实碰撞断言；14缝中心对11圆点是物理可容，故不再错误断言它是空气墙，只明确横穿路径被关系线限制。通用连接测试原房间几何中心现是果茶柜体，改用真实可走的内侧落点并断言walkable，不以solid起点测试出店。旧档夹点样本奶茶改用真实公共侧x112，原测试把点造在旧竖柜中心x168，属于无效夹具，未放宽可走断言。

类型检查与Vite构建通过，仅已有大chunk提示；diff-check通过。没有跑全量，也不声称此前所有历史/布局契约已全绿。

隔离Chrome实测：
- 三店菜单可读、横柜非文字部位能到公共侧交互；桌面1280×800三店正门进出、模拟390×844果茶触屏往返通过。
- 卫生间桌面/模拟手机各3次进出，远处phase=baseline、靠近phase=revealed，进入后刷新仍在卫生间，并能返回正确Cafe门前；无pageerror。
- 新增第5桌上席、第6桌下席、原剧情下席实际坐起通过。首次脚本加载读字未结束即点椅超时，补等待后通过，没有加所谓玩家穿缝豁免。其余12席为模型接近验证，不谎报逐席实机操作。
- 原送咖啡在净深22构建出现26个不同可见位置后delivered；不等于重走全部剧情。

## 本地图片/固定入口

专用根 `E:/小说/NewTone-Workspace/preview-drink-layout-contracts-20261022/`：
- `.tmp/depth22-six-simple-padded-L-counter-browser/cafe-full-room.png`
- `.tmp/depth22-six-simple-padded-L-counter-browser/milk-full-room.png`
- `.tmp/depth22-six-simple-padded-L-counter-browser/fruit-full-room.png`
- `.tmp/depth22-cafe-restroom-browser/desktop-room.png`（真实卫生间近图）
- 同目录desktop/mobile far、revealed、inside以及results.json；新座位证据 `.tmp/depth22-new-seats/`。

新图仅本地，未上传Library。当前候选4227，旧4225/4226构建保留；公网4173/矿区/相机未动，没有push/外部部署。

未测：实体手机/Safari、全剧情、全量测试、每一个旧档任意坐标；非法原始位置仍由既有恢复流程处理。作者仍需视觉验收。卫生间仅小房间和查看，不实现复杂如厕业务。其他布局精修与矿区尺寸留后续。
