# 旧永和存档兼容性与原临时预览发布

发布应用版本：`cea7f141efb8b3756f09788c125ab2231d56f74a`，与父线程独立QA通过的组合构建一致。本次应用diff为空，未改任何src、存档迁移、出口、手机逻辑或布局；没有push，也没有操作main、staging或Vercel。

## 隔离旧存档检查

只使用新建的临时Chrome context，测试地址4174。模拟已使用8d独立 `yonghe-eatery` 的v1存档：保留原cutover标记center-v1，写入旧场景位置、已探索柜台/灶台标记、yonghe故事时钟、inner手机、另一场景点香时间。另用4个context核对咖啡馆故事完成字段的保存保留。未读取或写入真实用户浏览器存档。

旧图依据：8d `mainlineSceneModel.ts/yongheEateryBlueprint`，walkBounds=(8,26,88,60)，初始(20,56)，独立房间与左侧出门。新图同一scene ID指向连续矿区世界；因此旧百分比坐标不能直接当作新永和房间的位置。

| 旧坐标 | 用例 | 新图安全恢复 |
| --- | --- | --- |
| (20,56) | 旧入口 | (44.3749,124.667)，新街道入口 |
| (50,56) | 旧中央通道 | 同上 |
| (50,76) | 旧南部通道 | 同上 |
| (90,76) | 旧东侧通道 | 同上 |
| (60,32) | 旧北侧通道 | 同上 |
| (14,56) | 旧门阈值 | 同上 |
| (45,56) | 与新街道偶然重合 | 原位置保留，可走 |

真实代码规则：`MainlineScenePage.initialPositionForEntry` 读取resumePosition；随后 `resolveMainlineSafeSpawnPosition` 检查可走性与通向初始位置的路径，不合格就回退新场景初始入口。没有新增专门的旧永和语义坐标映射。

结果：

- 隔离模型检查8/8通过（7位置+证据输出）；7种位置均有合法安全恢复点及通向原街道出口的可达路径。
- 1280×800、390×844各7种旧位置，共14个浏览器context，全部按上表恢复，14/14进度字段保留、0 pageerror、0脚本异常。
- 桌面7组可实际移动，移动后刷新恢复新位置。例如旧(20,56)→入口(44.3749,124.667)→移动(45.0027,124.005)→刷新仍该新位置。
- 手机对安全回退和原地保留两类额外重测：入口→(45.0072,118.591)、保留点→(45.6284,49.9573)，正常移动，刷新保持；真实咖啡馆完成字段与yonghe时钟保留。
- 桌面两类实际点击街道出口，主角y126.010/126.074越过阈值，随后手机打开；点击命中stage，非手机把手。
- 手机能移动且可正常打开手机操作界面。底部出口点击会命中已有world-phone__handle，未实际越线；**不能将这条记作手机自动踩线退出通过**。与旧坐标无关，未据此扩改手机/出口。通向出口的导航可达性已由隔离模型验证。

限制：安全恢复属于“旧位置无效时回街道入口”，不是在新永和房间中保持原室内相对位置；旧家具/探索标记数据保留，不代表空壳世界恢复了已移除的家具内容。刚加载的安全校正在运行时生效；移动前原保存坐标仍可能保留，下一次加载再次做安全校正，移动后按现有机制保存新位置。没有声称迁移完所有旧存档变体或验证真实触屏。

证据均保留untracked：`.tmp/old-yonghe-compat.test.ts`、`.tmp/old-yonghe-compat-cases.json`、`.tmp/old-yonghe-compat-browser/results.json`、`.tmp/old-yonghe-compat-exit/results.json`、`.tmp/old-yonghe-compat-mobile-clear/results.json`及相邻截图。已查看代表性桌面/手机截图。

追加合法剧情值补测：1280×800及390×844各1个context，保存 `commercialCafeStoryStatus=complete`、`commercialCafeCoffeeStatus=delivered`、`commercialCafeNarrativePhase=complete`、`commercialCafeLaoZhouDeparture=departed`、`commercialCafeCompletedAt=1000`，移动/刷新后逐字段不变，yonghe时钟及旧永和探索标记保留。证据 `.tmp/old-yonghe-compat-valid-progress/results.json`。这是加载矿区后对字段保留的验证，未额外打开咖啡馆重演剧情。

## 授权与发布操作

此前发布因缺明确授权被拒，未执行。父线程随后转达用户明确“可以”，授权兼容检查后更新原测试预览。此次在这个范围内执行，未更换正式服务或新建隧道。

发布前确认HEAD仍cea7f14、`git diff cea7f14 -- src`为空，candidate JS/CSS与独立QA指纹一致。复制已验静态构建至新的版本目录：

`E:\NewTone-Preview\published-builds\cea7f141efb8b3756f09788c125ab2231d56f74a`

仅停止经PID/命令行核实的原4173 Vite进程，沿用同一vite.preview.config.js、host、port，并通过outDir指向上述目录。QuickTunnel仍为原PID15248，连接原4173。旧 `E:\NewTone-Preview\dist`、rollback目录、公共checkout的8d HEAD及真实存档均未改动；原dist直接作为回滚构建保留。

公开链接：[原QuickTunnel临时预览](https://charts-lips-explaining-survivors.trycloudflare.com/)。

## 发布后下载核验

从本地4173及原公开外链分别实际下载HTML、JS、CSS，三项均HTTP200，字节数与SHA256逐项完全一致，并与已验candidate匹配：

| 文件 | 字节 | SHA256 |
| --- | ---: | --- |
| index.html | 2277 | cc61b1eed557c9b373e828952782bbbdf85d1b23531668c1e1e14265542b4ae7 |
| index-CP1zSUw1.js | 824927 | 85dec0e6ca5f28d22f6c6b6252ef21ca23929847252155edacab0d57c84bb38e |
| index-Br7LuK_y.css | 199938 | 13fdaf36486462a7e2366357489f70052ff8a8c49ce5b5517723b27c7dc3894e |

8d回滚JS `dist/assets/index-CuUPkzmo.js`仍为SHA256 `d44b2ed890cb62c21d1b9459cd7682771afad0640c442a71b071c660d7d8cc58`。下载原件与核验JSON位于 `.tmp/published-cea-verification/`。

应用版本未变化；本报告为发布证据，不把HTTP核验冒充新一轮全游戏浏览器QA。祖宅/商业街/矿区组合独立QA通过情况由父线程确认。
