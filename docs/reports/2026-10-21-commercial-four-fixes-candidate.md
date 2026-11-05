# 商业街四项修复：重复后门、新档、固定文字与寻路卡顿

日期：2026-10-21。当前候选应用 SHA：0b82a2a5217721c6ff8559057503245c7df63130。

## 当前交付状态

- 候选：http://127.0.0.1:4174/，已固定为本轮组合构建。未推送、未更新公共4173、未调用Vercel，main/staging未动。
- 公共4173继续保留cea7f141efb8b3756f09788c125ab2231d56f74a；真实存档未读写，所有浏览器案例均使用一次性context及合成存档。
- 本轮施工基线是报告提交eb59f0b；应用代码与已公开cea7f14相同。
- 独立QA仍须验收本候选；本文不把作者施工自测当作独立验收。
- 已知未全达标：旧等分墙框不是严格28；最终性能仍有约100ms长任务；矿区既有后门flank和旧测试矛盾未扩修。

## 分项提交

1. 8a16b9bcaac9fb6ef8ec5c164e3d358c9b8092c3：从数据源移除商业街重复后门开孔。
2. a7d4929b2fb7a02438b5416a90ba4cf06fe19e84：新档/无效状态默认商业街与里世界手机成对初始化。
3. 094e2eba1be8d68a4dba7b648e83a67935c13af5：复用精确几何网格、实时验证动态占用、加速障碍相交查询。
4. 0b82a2a5217721c6ff8559057503245c7df63130：固定14字体、28墙格、16家具字格和世界单位画框。

这些提交只在本地preview/commercial-street-restore-20261019；当前没有远端可访问的新commit diff链接，不能把未push的GitHub链接冒充可读交付。全文末尾保存真实运行时代码diff；测试代码可在以上提交中逐项查看。

## 1. 额外后门缺口：改前、改后、为什么

改前：同一后门同时在shell.openings与portal.wallOpenings声明。编译去重使用精确浮点相等，两套近似坐标未合并，11店生成额外开孔。后门还带两侧flank，门的导航/点击体积可覆盖普通墙。实际缺口后方点地面会匹配canonical rear-door并弹“后门尚未开放”，并不是一个可见第二按钮才触发的问题。

改后：mainlineSceneModel.ts的商业街shell不再额外声明opening；保留portal唯一门数据，doorFlankCount设0。错误位置直接生成普通墙单元，阻挡、显示和导航共同使用它，没有隐藏门、禁用门或过滤提示。14个合法后门仍是locked且没有跨场景目标，14个正门仍open、routeThrough。

回归：commercialStreetRearWallIntegrity.test.ts逐店检查14合法后门只剩1门格、左右墙不带passage/entity语义、11原缺口为普通阻挡墙、墙后目标ordinary、门后目标locked passage；3原本正常店N2/N3/S2作为对照。四文件63/63通过。

浏览器：Chrome1280×800一次性存档逐店点击11原缺口，11/11不再出现后门提示；14合法后门中心点击14/14仍提示未开放。13/14右侧墙样本实际点击通过；奶茶S5右侧测试起点被现有家具/墙占用，加载后移出该点导致目标在视口外，这个具体浏览器样本不算通过，模型同坐标ordinary断言通过。未据此移动家具或假造实测。

证据：.tmp/qa-four-fixes/rear-click-results.json、rear-legal-door-followup.json和各店second-door.png。初轮北侧合法门点实际命中scene-door__surface，脚本原只接受stage，因而标为未测；follow-up已接受并记录真实门字点击，14项均通过。

范围限制：矿区yonghe-back-door仍flank1，上下墙目标选门是父版本既有行为，未在本轮商业街修复中扩大修改。

## 2. 新档与手机：改前、改后、为什么

改前：默认出生Cafe与默认surface手机各自初始化，可能在里世界出生却拿表世界手机。改后：mainlineInitialState.ts集中定义commercial-street与inner；mainlineScenes.ts的respawn使用同一默认；playerSave.ts的createInitialPlayerSave和无效核心恢复使用这一对。

有效旧档仍保留scene、position、phoneDevice，无论inner还是surface都不因本次更新被换机或重置。已知场景、有效手机、合法坐标才算有效核心；无效核心回商业街/inner，清除当前街道位置槽以使用街道初始点，但保留剧情进度和其他场景位置。旧版有明确大院位置及surface手机的存档仍恢复大院；只有无法辨认当前位置的旧surface状态才使用新默认。显式?scene=测试入口仍是显式诊断入口，不当作普通新游戏。

hasResumablePlayerSave额外区分“新默认inner”和“确实存过inner”，避免首次访问因为默认手机改变而跳过Landing。现有测试重置控件调用clearPlayerSave后会按同一新默认进入；未对真实存档调用清档。

回归：mainlineInitialState及playerSave两文件18/18，覆盖无档、坏JSON、无效scene/phone/坐标、有效Cafe旧档两种手机、明确大院legacy及不可用storage。实际根URL无档从Landing“进入世界”后，场景commercial-street，主角(34,50)；损坏档也恢复(34,50)，inner且保留Cafe完成进度。实际phone DOM补测见initial-state-browser.json。

## 3. 字体、格距、框：改前、改后、为什么

改前：世界墙字仍有vw clamp；普通物件用cqw/vmin fallback；逐字招牌又按container size缩字；矮横屏generic fixture规则11会盖过部分世界字。老槐树另有1.12文字放大。缩放本身统一，但文字再局部响应，造成字与格距比例变化。

改后：sceneBoundaryGrid.ts定义普通世界字号14；sceneLayout.mainlineEntityFontSizePx固定返回14，storefrontContactGeometry使用同一基准。scene.css中主线墙、门、店招、NPC及普通物件用固定值，主线世界作用域覆盖旧fixture11；家具普通多字标签用14+tracking2，中心距16且text footprint配套。已有分字柜台仍用reference16坐标，墙格reference28不改布局。删除槐树单独1.12文字放大；碰撞树环、墙、门位与1920参考坐标未重排。特殊问号保留38和既有呼吸；world外对话/菜单UI的响应式规则不动。

框：SceneFocusFrames先把墨迹及邻居的viewport rect除以真实parent/world scale，再用局部单位算外扩及SVG geometry。sceneVisualBounds中的gap2+inset1合计外扩3；描边1同属世界单位，随同一world scale缩放。mainlineCameraVisualOutset也改为同一世界单位，保留此前边缘防裁切逻辑。pathLength=1、闭合Z路径和完整画出/收回动画保留，没有加non-scaling-stroke，也没有结束态补线。

实际测量：Chrome155.0.8059.85与Edge155.0.4283.62；1920×1080、1280×800、390×844、844×390，DSF1。各窗口world scale约1、0.7407407、0.7814815、0.3611111；所有采到的普通墙/物件/NPC computed font均14px。实测墙字中心距除scale后X/Y约27.97–28.02（DOM取整误差量级）；分字柜台相邻中心距除scale后约16.0000，两个浏览器一致。数据为真实getBoundingClientRect中心距离，非只读常量。窗口大小仍改变整幅世界投影，不再单独改变世界字基础字号。

画框：1280×800与390×844真实点击进入果茶，再点击街道返回；门框稳定闭合，返回阶段dashoffset从约0.1→0.43→0.82→1，约第1秒collapsed且持续隐藏，截图未见持续框残线。永久合法后门框在hover离开后仍可保持visible，这是passage策略，不能冒称它收回了。

重要旧墙例外：all-scene-wall-pitches.json遍历所有主线canonical cells。大院/内堂仍是旧框等分坐标，X27.86–27.88、Y27.65；旧独立Cafe约X27.92–27.94，Y28.14–28.16，个别跨特征间隔35.72；窄道X28.19–28.20；办公室多个框X27.97–28.17、Y27.90–28.35。商业街/矿区约27.99–28.01；跨门/特征会出现56双格，不当作单格28。上述旧框不随viewport单独改变，但不是严格28。把旧框每段改成严格28会移动端点、门及特征关系，属于需要明确处理的迁移范围；本轮依照“不顺手重排剧情布局”保留并报告。不能宣称全场景所有格距已经严格28。

## 4. Cafe点击冻结：证据与最小修法

独立QA在publiccea、正常走Cafe深处后记录：近街2959ms长任务/2951ms帧停，远街2450ms，门1256ms；另有AmbientNpcMotion→useNpcMovement→findMainlinePath的1209ms任务。CPU链是classify→canActorReachPassageApproach→findMainlinePath→visibility graph→segmentCrossesInterior，不是保存或画框。证据在E:/NewTone-Preview/.tmp/qa-cafe-path-perf-cea7f14。

本机复现：Chrome155.0.8059.85、1280×800、DSF1，同一合成存档起点(140.234,-24.01)，点击目标(122.831,38)，命中真实stage，三次fresh context。这里是隔离存档恢复到深处后点地，不声称本机每次都从门外走到深处。初次误点phonehandle的无效profile明确弃用，不作为性能证据。

代码原因：有navigationRuntime时findMainlinePath原本禁止复用mesh，每次把live NPC障碍混入重新构图；每张图又对静态可见节点两两连接，对每个候选扫描全部障碍，并在最内层分配axis数组。

mainlineNavigation改法：按精确bounds、所有实际物理障碍、barriers、footprint/inset JSON输入做scene WeakMap内8项LRU，不靠snapshot身份/actor名字/坐标四舍五入猜等价。主角和NPC共享同样几何；静态路径每条边仍交给当前canTravel验证，有动态挡路才使用含当前动态障碍的完整网格找绕路。门、座位、障碍、布局、尺寸、屏障改变会改变输入；动态位置每次重查，缓存不会放行穿人或穿墙。

scenePathfinding改法：为本mesh的不可变障碍数组建立保守AABB树。只跳过线段包围盒之外的障碍；候选仍走相同open-interior slab规则。slab改为标量，不在节点pair内分配axis数组。无障碍删除、NPC暂停、瞬移或碰撞放宽。

A/B（首个点击长任务，三次）：
- 修改前，带CPU采样：1907 /1914 /1884ms；最长rAF间隔1900.3/1910.4/1880.3ms。
- 修改后单独导航候选，带CPU采样：73/68/72ms；本观察窗最长rAF110–120ms（包含后续任务）。
- 修改前，无CPU采样：1844/1841/1836ms；最长rAF1840.3/1840.3/1830.3ms。
- 修改后单独导航候选，无CPU采样：66/68/67ms；最长rAF110/110.1/100ms。
- 最终14字组合候选，独占轻量三次：66/69/68ms；最长rAF100.1/110.1/110ms，rAF p95约10.1/10.1/10.2ms。三次均正常到街道约(122.791,38)。首个长任务中位1841→68ms，约下降96.3%。

剩余：最终候选移动后约1.8秒仍有94–107ms长任务，不能宣称没有长任务或全部性能验收通过。带采样/无采样分列，不用工具响应时间当FPS；最终另一次与截图并跑的样本因负载不独占，只保留原始数据，不作主要对照。

测试：navigationQueryReuse用原始slab作为独立oracle覆盖180条确定种子线段与切边/水平/竖直情况；缓存复用覆盖主角/NPC、移动blocker、恢复、footprint与关门输入失效。navigationBarrier、singleDynamicObstacleDetour、npcMovement及dynamicMovementRegression配套执行。较大worldNavigation组有两个矿区意图旧断言失败，已用git archive隔离a7d4929原始代码复跑，两个失败完全相同；已知超出商业街162.9边界却要求190可达的旧lane用例另行排除。未改这些测试来伪装本轮通过。

## 构建与资源指纹

13文件140项定向回归通过，包含rear integrity、startup/save、typography、renderer、focus-frame/endpoint、visual bounds、viewport、shell/retail/storefront/presentation。最终补充导航回归结果见后续附录。TypeScript无错误；Vite构建成功，只有既有>500kB chunk提示。git diff --check清理末尾空行后通过。

- 4174应用构建目录：.tmp/four-fixes-candidate-dist；服务PID43868。
- JS index-CXaqEsxg.js，826259 bytes，SHA256 BDCBD60500B4EDC8CF3466004F74DB6D753FB8D5647F6ECA15301CF81D6A3900。
- CSS index-DqwytlUi.css，200263 bytes，SHA256 8037B3161155B4BD755F467A08FC895B2A38EBAA6A21E30C7F8CC89513EB913A。
- 后续报告/空行整理不改变应用语义；4174仍提供上述已测资源。公共4173未替换。

## 原始证据与未测项

- .tmp/qa-four-fixes/typography-results.json、Chrome/Edge四尺寸截图。
- rear-click-results.json、rear-legal-door-followup.json、11店second-door截图。
- initial-state-browser.json、fresh/invalid截图。
- frame-results.json、front-frame-results.json及drawing/stable/retracting/returned截图。
- all-scene-wall-pitches.json：8场景真实模型格距，非所有场景浏览器路径验收。
- .tmp/cafe-deep-before-valid：带CPU采样的有效基线；.tmp/cafe-deep-after-nav：导航优化带CPU样本。
- .tmp/cafe-deep-before-light、cafe-deep-after-light、cafe-deep-final-light-alone：主轻量对照。
- 没有本轮全剧情走通、所有旧场景视觉/路径全测、Safari或实体手机性能数据；390×844为桌面浏览器viewport模拟，不冒称真机。
- 真实用户坏档未读取；无法宣称用户现有有效Cafe+surface档会自动改机。有效旧档按授权保持；需要作者明确选择恢复方式时另行处理。
- 14字体规则落地；旧拟合墙格严格28迁移、剩余长任务与独立QA结论尚待后续决定，不先发布。

## 实际运行时代码diff（本轮基线eb59f0b至当前候选）

```diff
diff --git a/src/center/runtime/SceneFocusFrames.tsx b/src/center/runtime/SceneFocusFrames.tsx
index 1bde65c..175fa36 100644
--- a/src/center/runtime/SceneFocusFrames.tsx
+++ b/src/center/runtime/SceneFocusFrames.tsx
@@ -2,7 +2,7 @@

 import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type TransitionEvent as ReactTransitionEvent } from 'react'
 import { sceneFrameDefaultMotionMs, sceneFrameMotionMsForRect } from './sceneMotion'
-import { measureSceneCharacterRects, measureSceneCharacters, sceneElementVisualScale, sceneFrameBoundsInLocalSpace, sceneFocusVisualGapPx, sceneFocusStrokeInsetPx } from './sceneVisualBounds'
+import { measureSceneCharacterRects, measureSceneCharacters, sceneElementVisualScale, sceneVisualRectInLocalSpace, sceneFrameBoundsInLocalSpace, sceneFocusVisualGapPx, sceneFocusStrokeInsetPx } from './sceneVisualBounds'
 import { beginFrameAppearance, beginFrameRetraction, completeFrameTransition, frameShouldCollapse, frameVisualPhase, preserveFrameRetractCorner, resumeFrameAppearance, type SceneFrameRuntime, type SceneFrameTarget } from './sceneFrameLifecycle'
 import { createEndpointMeasurementScheduler } from './sceneFocusFrameEndpointMeasure'

@@ -217,11 +217,11 @@ export function useSceneFocusFrameController({ targets, freezeMeasurements = fal
         if (!parent || !stage) continue
         const characters = [...stage.querySelectorAll<HTMLElement>('[data-focus-visual-group]')]
           .filter(element => element.dataset.focusVisualGroup === group)
-        const rect = measureSceneCharacters(characters)
-        if (!rect) continue
+        const viewportRect = measureSceneCharacters(characters)
+        if (!viewportRect) continue
         const otherCharacters = [...stage.querySelectorAll<HTMLElement>('[data-scene-characters]')]
           .filter(element => !characters.some(target => target === element || target.contains(element) || element.contains(target)))
-        const neighbors = measureSceneCharacterRects(otherCharacters)
+        const viewportNeighbors = measureSceneCharacterRects(otherCharacters)
         const origin = parent.getBoundingClientRect()
         const parentStyle = getComputedStyle(parent)
         const worldScale = sceneElementVisualScale(parent.closest<HTMLElement>('.scene-mainline-world'))
@@ -236,6 +236,11 @@ export function useSceneFocusFrameController({ targets, freezeMeasurements = fal
         const localHeight = borderSize('y')
         const scaleX = origin.width > 0 && localWidth > 0 ? origin.width / localWidth : worldScale.x
         const scaleY = origin.height > 0 && localHeight > 0 ? origin.height / localHeight : worldScale.y
+        // Measurements arrive in viewport px. Convert once before computing
+        // margins and SVG geometry so gap/stroke scale with the world too.
+        const toLocal = (rect: Parameters<typeof sceneVisualRectInLocalSpace>[0]) => sceneVisualRectInLocalSpace(rect, origin, { x: scaleX, y: scaleY })
+        const rect = toLocal(viewportRect)
+        const neighbors = viewportNeighbors.map(toLocal)
         const nominalMargin = sceneFocusVisualGapPx + sceneFocusStrokeInsetPx
         const minMargin = sceneFocusStrokeInsetPx + .5
         const crowdingMargin = (distance: number) => Math.min(nominalMargin, Math.max(minMargin, minMargin + (distance - 1) / 2))
@@ -253,12 +258,12 @@ export function useSceneFocusFrameController({ targets, freezeMeasurements = fal
         })
         const width = rect.right - rect.left + leftMargin + rightMargin
         const height = rect.bottom - rect.top + topMargin + bottomMargin
-        const bounds = sceneFrameBoundsInLocalSpace(rect, origin, {
+        const bounds = sceneFrameBoundsInLocalSpace(rect, { left: 0, top: 0 }, {
           left: leftMargin,
           top: topMargin,
           right: rightMargin,
           bottom: bottomMargin,
-        }, { x: scaleX, y: scaleY })
+        }, { x: 1, y: 1 })
         updates.set(group, {
           duration: sceneFrameMotionMsForRect(width, height),
           geometry: sceneFocusFrameGeometry(width, height),
diff --git a/src/center/runtime/mainlineInitialState.ts b/src/center/runtime/mainlineInitialState.ts
new file mode 100644
index 0000000..fa4a4fe
--- /dev/null
+++ b/src/center/runtime/mainlineInitialState.ts
@@ -0,0 +1,7 @@
+import type { MainlineSceneId } from './mainlineSceneModel'
+import type { PhoneDevice } from './phoneState'
+
+/** One paired starting state. Saved journeys and explicit test scene URLs
+ * remain separate from the new-game default. */
+export const initialMainlineSceneId: MainlineSceneId = 'commercial-street'
+export const initialMainlinePhoneDevice: PhoneDevice = 'inner'
diff --git a/src/center/runtime/mainlineNavigation.ts b/src/center/runtime/mainlineNavigation.ts
index db86dad..00b31d2 100644
--- a/src/center/runtime/mainlineNavigation.ts
+++ b/src/center/runtime/mainlineNavigation.ts
@@ -48,14 +48,22 @@ type CachedNavigationMesh = {
 // scene identity rather than by snapshot identity. Dynamic actor occupancy is
 // still excluded.
 const physicalIntentMeshCache = new WeakMap<PolygonNavigationMesh, Map<string, PolygonNavigationMesh>>()
-const staticNavigationMeshCache = new WeakMap<MainlineSceneGeometrySnapshot, Map<string, CachedNavigationMesh>>()
+const routeNavigationMeshCache = new WeakMap<MainlineSceneDefinition, Map<string, CachedNavigationMesh>>()
 const preparedWorldNavigationMeshCache = new WeakMap<MainlineSceneDefinition, Map<string, CachedNavigationMesh>>()
 const MAX_STATIC_NAVIGATION_MESHES_PER_SCENE = 8

-function cacheStaticNavigationMesh(snapshot: MainlineSceneGeometrySnapshot, key: string, mesh: PolygonNavigationMesh) {
-  const meshes = staticNavigationMeshCache.get(snapshot) ?? new Map<string, CachedNavigationMesh>()
-  meshes.set(key, { key, mesh })
-  staticNavigationMeshCache.set(snapshot, meshes)
+function routeNavigationMesh(scene: MainlineSceneDefinition, inputs: Parameters<typeof createPolygonNavigationMesh>[0]) {
+  // Exact physical inputs include live door/seat/layout state and footprint.
+  // No snapshot identity, rounding or actor-name heuristic can make stale
+  // geometry reusable. Moving actors are checked below on every route.
+  const key = JSON.stringify(inputs)
+  const meshes = routeNavigationMeshCache.get(scene) ?? new Map<string, CachedNavigationMesh>()
+  const cached = meshes.get(key)
+  const mesh = cached?.mesh ?? createPolygonNavigationMesh(inputs)
+  meshes.delete(key); meshes.set(key, { key, mesh })
+  while (meshes.size > MAX_STATIC_NAVIGATION_MESHES_PER_SCENE) meshes.delete(meshes.keys().next().value!)
+  routeNavigationMeshCache.set(scene, meshes)
+  return mesh
 }

 function cachePreparedWorldNavigationMesh(scene: MainlineSceneDefinition, key: string, mesh: PolygonNavigationMesh) {
@@ -1186,33 +1194,21 @@ export function findMainlinePath(start: Point, target: Point, scene: MainlineSce
     )
     if (detour) return detour
   }
+  const bounds = insetBounds(snapshot.walkBounds, actorFootprint)
+  const staticObstacles = collisionBoxes(scene, layout, staticOptions)
+  const inputs = { bounds, obstacles: staticObstacles,
+    obstacleInset: { x: actorFootprint.width / 2, y: actorFootprint.height / 2 }, barriers, actorFootprint }
+  // Player and NPC requests share immutable physical geometry. A moving actor
+  // never poisons that cache: validate every returned segment against live
+  // occupancy, then use a complete dynamic mesh only if a detour is needed.
+  const staticPath = findNavigationPath(start, target, {
+    ...inputs, navigationMesh: routeNavigationMesh(scene, inputs), canTravel,
+  })
+  if (staticPath || !options.navigationRuntime) return staticPath
   const obstacles = collisionBoxes(scene, layout, options)
-  const cacheKey = [
-    options.actorId ?? 'protagonist',
-    actorFootprint.width.toFixed(4),
-    actorFootprint.height.toFixed(4),
-    [...(options.openPassageIds ?? [])].sort().join(','),
-    [...occupiedSeatIdsForNavigation(scene, options)].sort().join(','),
-  ].join('|')
-  const canReuseStaticMesh = !options.navigationRuntime
-  const cached = canReuseStaticMesh ? staticNavigationMeshCache.get(snapshot)?.get(cacheKey) : undefined
-  const navigationMesh = cached?.key === cacheKey
-    ? cached.mesh
-    : createPolygonNavigationMesh({
-      bounds: insetBounds(snapshot.walkBounds, actorFootprint),
-      obstacles,
-      obstacleInset: { x: actorFootprint.width / 2, y: actorFootprint.height / 2 },
-      barriers,
-      actorFootprint,
-    })
-  if (canReuseStaticMesh && cached?.key !== cacheKey) cacheStaticNavigationMesh(snapshot, cacheKey, navigationMesh)
+  const dynamicInputs = { ...inputs, obstacles }
   return findNavigationPath(start, target, {
-    bounds: insetBounds(snapshot.walkBounds, actorFootprint),
-    obstacles,
-    actorFootprint,
-    barriers,
-    navigationMesh,
-    canTravel,
+    ...dynamicInputs, navigationMesh: routeNavigationMesh(scene, dynamicInputs), canTravel,
   })
 }

diff --git a/src/center/runtime/mainlineSceneModel.ts b/src/center/runtime/mainlineSceneModel.ts
index 44407f8..d991e66 100644
--- a/src/center/runtime/mainlineSceneModel.ts
+++ b/src/center/runtime/mainlineSceneModel.ts
@@ -1652,7 +1652,9 @@ const commercialStreetRearDoorPortals: MainlineScenePortalBlueprint[] = commerci
       threshold: authoredPoint(centerX, sample.back + (north ? commercialStreetRearDoorApproachDepth : -commercialStreetRearDoorApproachDepth)),
       crossingTarget: authoredPoint(centerX, sample.back + (north ? -commercialStreetRearDoorApproachDepth : commercialStreetRearDoorApproachDepth)),
     },
-    wallOpenings: [{ wallId: `${sample.roomId}-shell`, opening: { edge, start: centerX - commercialStreetCellPitch, end: centerX + commercialStreetCellPitch, doorId, labelLayout: 'center' } }],
+    // The portal alone owns this opening. Flanking lattice cells are ordinary
+    // walls, so they cannot become part of a rear-door navigation volume.
+    wallOpenings: [{ wallId: `${sample.roomId}-shell`, opening: { edge, start: centerX - commercialStreetCellPitch, end: centerX + commercialStreetCellPitch, doorId, labelLayout: 'center', doorFlankCount: 0 } }],
     transitionText: '\u540e\u95e8\u5c1a\u672a\u63a5\u901a\u3002',
     access: 'locked',
     lockedText: '\u540e\u95e8\u5c1a\u672a\u5f00\u653e\u3002',
@@ -1694,7 +1696,6 @@ const commercialStreetBlueprint: MainlineSceneBlueprint = {
         boundaryVisualEndpoints: { vertical: { start: 'omit' as const, end: 'omit' as const } },
         edges: [sample.side === 'north' ? 'top' as const : 'bottom' as const, 'left' as const,
           ...(!commercialStreetInteriorSamples.some((other) => other.side === sample.side && other.x > sample.x) ? ['right' as const] : [])],
-        openings: [{ edge: sample.side === 'north' ? 'top' as const : 'bottom' as const, start: sample.x + sample.width / 2 - 2 * commercialStreetCellPitch, end: sample.x + sample.width / 2, doorId: `${sample.roomId}-rear-door`, labelLayout: 'center' as const }],
       })),
     ],
     storefronts: commercialStreetStorefronts,
@@ -1906,7 +1907,7 @@ const jijiaYardBlueprint: MainlineSceneBlueprint = {
     }],
     floorEntities: [
       ...jijiaOldTreeStoneRing,
-      floor({ id: 'jijia-old-tree', label: '老槐树', kind: 'landmark', weight: 'minor', position: jijiaYardCenter, collision: jijiaOldTreeCollision, shape: jijiaOldTreeCollision, visualBounds: box(jijiaYardCenter.x - 4.5, jijiaYardCenter.y - 4.5, 9, 9), focusFrame: 'interactive', visualScale: 1.12, visualVisibility: 'distance-baseline', groupId: 'jijia-yard-group', interactionBehavior: 'echo-pool', visualProfile: 'tree-ring' }),
+      floor({ id: 'jijia-old-tree', label: '老槐树', kind: 'landmark', weight: 'minor', position: jijiaYardCenter, collision: jijiaOldTreeCollision, shape: jijiaOldTreeCollision, visualBounds: box(jijiaYardCenter.x - 4.5, jijiaYardCenter.y - 4.5, 9, 9), focusFrame: 'interactive', visualVisibility: 'distance-baseline', groupId: 'jijia-yard-group', interactionBehavior: 'echo-pool', visualProfile: 'tree-ring' }),
     ],
     blockers: [], furnitureGroups: [{ id: 'jijia-yard-group', anchor: jijiaYardGroupAnchor, entityIds: ['jijia-old-tree'] }], initialPlayerPosition: { x: 25, y: 50 },
   },
diff --git a/src/center/runtime/mainlineScenes.ts b/src/center/runtime/mainlineScenes.ts
index 458bccc..aeeecc1 100644
--- a/src/center/runtime/mainlineScenes.ts
+++ b/src/center/runtime/mainlineScenes.ts
@@ -1,5 +1,6 @@
 import { mainlineWallThickness, type CollisionBox, type Point } from './sceneGeometry'
 import { mainlineSceneBlueprints } from './mainlineSceneModel'
+import { initialMainlineSceneId } from './mainlineInitialState'
 import { boundaryGridCellRange, boundaryGridStepsFromReferenceSpacing, compileSharedFrame, defaultSceneScreenMetrics, sharedBoundaryScreenSpacingPx, type SceneScreenMetrics, type SharedBoundaryCell, type SharedBoundaryFrame, type SharedBoundaryOpening } from './sceneBoundaryGrid'
 import type { SceneDoorBehavior } from './sceneDoorConfig'
 import type { StorefrontPresentationPhase } from './storefrontPresentation'
@@ -1585,7 +1586,7 @@ export const mainlineSceneSlices: Record<MainlineSceneId, MainlineSceneSliceDefi
  * the map always returns to the yard so a map jump never respawns inside a
  * building.
  */
-export const mainlineRespawnSceneId: MainlineSceneId = 'jijia-ancestral-home'
+export const mainlineRespawnSceneId: MainlineSceneId = initialMainlineSceneId

 export type MainlineMapWorld = 'surface' | 'inner'

diff --git a/src/center/runtime/mainlineViewport.ts b/src/center/runtime/mainlineViewport.ts
index db5b8d7..cdaf1cf 100644
--- a/src/center/runtime/mainlineViewport.ts
+++ b/src/center/runtime/mainlineViewport.ts
@@ -55,13 +55,12 @@ type CameraScene = Pick<MainlineSceneDefinition, 'walkBounds'> & Partial<Pick<Ma

 /** Boundary anchors are glyph centers. Include their text box and focus frame
  * when deciding whether the complete scene fits, without changing world scale. */
-export function mainlineCameraVisualOutset(viewport: SceneScreenMetrics): Point {
+export function mainlineCameraVisualOutset(_viewport: SceneScreenMetrics): Point {
   const glyph = mainlineLabelFootprint('字', { x: 0, y: 0 }, sceneDesignReferenceMetrics)
-  const scale = mainlineWorldScale(viewport)
   const frameGap = sceneFocusVisualGapPx + sceneFocusStrokeInsetPx
   return {
-    x: glyph.width / 2 + frameGap / (sceneDesignReferenceMetrics.width * scale) * 100,
-    y: glyph.height / 2 + frameGap / (sceneDesignReferenceMetrics.height * scale) * 100,
+    x: glyph.width / 2 + frameGap / (sceneDesignReferenceMetrics.width) * 100,
+    y: glyph.height / 2 + frameGap / (sceneDesignReferenceMetrics.height) * 100,
   }
 }

diff --git a/src/center/runtime/playerSave.ts b/src/center/runtime/playerSave.ts
index b039cb5..1b90976 100644
--- a/src/center/runtime/playerSave.ts
+++ b/src/center/runtime/playerSave.ts
@@ -1,6 +1,8 @@
 import type { MainlineSceneId } from './mainlineSceneModel'
 import { cleanPhoneNotifications, type PhoneNotification } from './phoneNotifications'
 import type { PhoneDevice } from './phoneState'
+import { mainlineSceneWorldLayers } from './phoneState'
+import { initialMainlinePhoneDevice, initialMainlineSceneId } from './mainlineInitialState'
 import { createInitialMainlineStoryClock, storyClockForStage, type MainlineStoryClock, type MainlineStoryStage } from './mainlineStoryClock'
 import { applyPublicReleaseCutover } from '../../services/publicReleaseMigration'
 import { cleanPhoneCallHistory, cleanPhoneContactNotes, cleanPhoneNotes, createInitialPhoneNotes, type PhoneCallRecord, type PhoneNote } from './phonePersonalData'
@@ -76,13 +78,13 @@ function cleanSceneState(value: unknown): Partial<Record<MainlineSceneId, Player
   ) as Partial<Record<MainlineSceneId, PlayerSceneState>>
 }

-export function createInitialPlayerSave(sceneId: MainlineSceneId): PlayerSave {
+export function createInitialPlayerSave(sceneId: MainlineSceneId = initialMainlineSceneId): PlayerSave {
   return {
     _version: PLAYER_SAVE_VERSION,
     currentSceneId: sceneId,
     currentPosition: null,
     scenePositions: {},
-    phoneDevice: 'surface',
+    phoneDevice: initialMainlinePhoneDevice,
     storyClock: createInitialMainlineStoryClock(sceneId),
     sceneState: {},
     phoneNotifications: [],
@@ -127,15 +129,31 @@ function readLegacyPlayerSave(storage: PlayerSaveStorage | null, fallbackSceneId
     // Ignore malformed legacy state and start with the normal defaults.
   }

+  if (hasLegacyValue && !migrated.currentPosition && migrated.phoneDevice === 'surface'
+    && migrated.scenePositions['jijia-ancestral-home']) {
+    // The legacy map has no current-scene field. Preserve an identifiable
+    // surface-world position instead of pairing its phone with a new street.
+    migrated.currentSceneId = 'jijia-ancestral-home'
+    migrated.currentPosition = migrated.scenePositions['jijia-ancestral-home']!
+  }
+  if (hasLegacyValue && !migrated.currentPosition && migrated.phoneDevice === 'surface') {
+    migrated.currentSceneId = initialMainlineSceneId
+    migrated.phoneDevice = initialMainlinePhoneDevice
+  }
   return hasLegacyValue ? migrated : createInitialPlayerSave(fallbackSceneId)
 }

-export function sanitizePlayerSave(value: unknown, fallbackSceneId: MainlineSceneId): PlayerSave {
+export function sanitizePlayerSave(value: unknown, _fallbackSceneId: MainlineSceneId): PlayerSave {
   const source = value && typeof value === 'object' ? value as Partial<PlayerSave> : {}
-  const currentSceneId = typeof source.currentSceneId === 'string' && source.currentSceneId.length > 0
+  const validScene = typeof source.currentSceneId === 'string' && Object.hasOwn(mainlineSceneWorldLayers, source.currentSceneId)
+  const validPhone = source.phoneDevice === 'inner' || source.phoneDevice === 'surface'
+  const validCore = validScene && validPhone && (source.currentPosition == null || isPoint(source.currentPosition))
+  const currentSceneId = validCore
     ? source.currentSceneId as MainlineSceneId
-    : fallbackSceneId
-  const phoneDevice = source.phoneDevice === 'inner' ? 'inner' : 'surface'
+    : initialMainlineSceneId
+  const phoneDevice = validCore ? source.phoneDevice as PhoneDevice : initialMainlinePhoneDevice
+  const scenePositions = cleanScenePositions(source.scenePositions)
+  if (!validCore) delete scenePositions[initialMainlineSceneId]
   const storyStage = source.storyClock?.stage
   const storyClock: MainlineStoryClock = storyStage === 'commercial-street' || storyStage === 'cafe' || storyStage === 'yonghe' || storyStage === 'opening'
     ? storyClockForStage(storyStage as MainlineStoryStage)
@@ -144,8 +162,8 @@ export function sanitizePlayerSave(value: unknown, fallbackSceneId: MainlineScen
   return {
     _version: PLAYER_SAVE_VERSION,
     currentSceneId,
-    currentPosition: cleanPoint(source.currentPosition),
-    scenePositions: cleanScenePositions(source.scenePositions),
+    currentPosition: validCore ? cleanPoint(source.currentPosition) : null,
+    scenePositions,
     phoneDevice,
     storyClock,
     sceneState: cleanSceneState(source.sceneState),
@@ -159,7 +177,7 @@ export function sanitizePlayerSave(value: unknown, fallbackSceneId: MainlineScen

 export function loadPlayerSave(
   storage = defaultStorage(),
-  fallbackSceneId: MainlineSceneId = 'jijia-ancestral-home',
+  fallbackSceneId: MainlineSceneId = initialMainlineSceneId,
 ): PlayerSave {
   applyPublicReleaseCutover(storage)
   try {
@@ -168,7 +186,7 @@ export function loadPlayerSave(
       ? sanitizePlayerSave(JSON.parse(raw), fallbackSceneId)
       : readLegacyPlayerSave(storage, fallbackSceneId)
   } catch {
-    return createInitialPlayerSave(fallbackSceneId)
+    return createInitialPlayerSave()
   }
 }

@@ -179,10 +197,15 @@ export function loadPlayerSave(
  */
 export function hasResumablePlayerSave(storage = defaultStorage()): boolean {
   const save = loadPlayerSave(storage)
+  let storedPhoneState = false
+  try {
+    storedPhoneState = [PLAYER_SAVE_STORAGE_KEY, ...LEGACY_PHONE_STORAGE_KEYS]
+      .some(key => storage?.getItem(key) != null)
+  } catch { /* Unavailable storage is a fresh in-memory session. */ }
   return save.updatedAt > 0
     || save.currentPosition !== null
     || Object.keys(save.scenePositions).length > 0
-    || save.phoneDevice === 'inner'
+    || (save.phoneDevice === 'inner' && storedPhoneState)
     || Object.values(save.sceneState).some((state) => Object.keys(state ?? {}).length > 0)
 }

diff --git a/src/center/runtime/scene.css b/src/center/runtime/scene.css
index 1572b6d..9c59475 100644
--- a/src/center/runtime/scene.css
+++ b/src/center/runtime/scene.css
@@ -216,9 +216,9 @@
   fill: none;
   stroke: currentColor;
   stroke-width: 1;
-  /* Frame viewBox dimensions are measured in viewport pixels; the host bounds
-     already compensate world scale. Keep stroke and normalized dash length in
-     that same SVG space: non-scaling-stroke truncates dashes under world scale. */
+  /* ViewBox, gap and stroke use local world CSS units and receive the same
+     world projection as text. Keep normalized dashes in this SVG space;
+     non-scaling-stroke would truncate the animated path under world scale. */
   stroke-linecap: square;
   stroke-linejoin: miter;
   stroke-dasharray: 1;
@@ -692,7 +692,7 @@
   .scene-mainline-world { animation: none; }
 }
 .scene-mainline-wall-labels { inset: 0; z-index: 1; }
-.scene-mainline-wall { color: var(--soft); font-size: clamp(12px, 1.2vw, 16px); line-height: 1; }
+.scene-mainline-wall { color: var(--soft); font-size: var(--scene-mainline-object-font-size, 14px); line-height: 1; }
 .scene-mainline-wall-door {
   display: inline-flex;
   align-items: center;
@@ -745,7 +745,7 @@
 }
 .scene-mainline-wall-feature {
   color: var(--soft);
-  font-size: var(--scene-mainline-object-font-size, clamp(9px, 1.15cqw, 16px));
+  font-size: var(--scene-mainline-object-font-size, 14px);
   letter-spacing: normal;
   white-space: nowrap;
 }
@@ -773,7 +773,7 @@
 .scene-mainline-storefront-cell {
   z-index: 3;
   color: var(--soft);
-  font-size: clamp(12px, 1.2vw, 16px);
+  font-size: var(--scene-mainline-object-font-size, 14px);
   line-height: 1;
   white-space: nowrap;
   pointer-events: none;
@@ -820,13 +820,13 @@
   transition: color 120ms ease-out, visibility 0s linear 140ms;
 }
 .scene-mainline-storefront--vertical.scene-mainline-storefront--sign .scene-mainline-storefront__label-track {
-  font-size: min(1em, calc((100cqh - 4px) / var(--storefront-label-length)));
+  font-size: var(--scene-mainline-object-font-size, 14px);
 }
 .scene-mainline-storefront__label-track {
   display: block;
   width: max-content;
   max-width: 100%;
-  font-size: min(1em, calc((100cqw - 4px) / var(--storefront-label-length)));
+  font-size: var(--scene-mainline-object-font-size, 14px);
   white-space: nowrap;
   will-change: transform;
   transform: translate3d(0, 0, 0);
@@ -885,7 +885,7 @@
   z-index: 5;
   transform: translate(-50%, -50%);
   color: var(--ink);
-  font-size: var(--scene-mainline-object-font-size, clamp(9px, 1.15cqw, 16px));
+  font-size: var(--scene-mainline-object-font-size, 14px);
   line-height: 1;
   white-space: nowrap;
 }
@@ -902,19 +902,19 @@
 }
 .scene-mainline-npc:focus-visible { outline: 1px solid var(--active); outline-offset: 4px; }
 .scene-mainline-npc--ambient { pointer-events: none; cursor: default; }
-.scene-mainline-object--door { color: var(--active); font-size: var(--scene-mainline-object-font-size, clamp(10px, 1.35cqw, 18px)); }
+.scene-mainline-object--door { color: var(--active); font-size: var(--scene-mainline-object-font-size, 14px); }
 .scene-mainline-object--landmark,
-.scene-mainline-object--direction { color: var(--soft); font-size: var(--scene-mainline-object-font-size, clamp(9px, 1.15cqw, 16px)); }
+.scene-mainline-object--direction { color: var(--soft); font-size: var(--scene-mainline-object-font-size, 14px); }
 .scene-mainline-yard-tree-ring { color: var(--soft); opacity: .78; }
 .scene-mainline-yard-tree-ring.is-under-player { opacity: .28; }
-.scene-mainline-object--fixture { color: var(--ink); font-size: var(--scene-mainline-object-font-size, clamp(9px, 1.15cqw, 16px)); letter-spacing: 0; }
+.scene-mainline-object--fixture { color: var(--ink); font-size: var(--scene-mainline-object-font-size, 14px); letter-spacing: 0; }
 .scene-mainline-object--table,
 .scene-mainline-object--seat {
   color: var(--soft);
   min-width: 0;
   min-height: 0;
   padding: 0;
-  font-size: var(--scene-mainline-object-font-size, clamp(9px, 1.15cqw, 16px));
+  font-size: var(--scene-mainline-object-font-size, 14px);
   line-height: 1;
 }
 .scene-mainline-exploration--breathing > .scene-mainline-object__label {
@@ -955,7 +955,7 @@
 [data-mainline-scene="commercial-cafe"] .scene-mainline-object--fixture,
 [data-mainline-scene="commercial-cafe"] .scene-mainline-object--table,
 [data-mainline-scene="commercial-cafe"] .scene-mainline-object--seat {
-  font-size: var(--scene-mainline-object-font-size, clamp(9px, 1.15cqw, 16px));
+  font-size: var(--scene-mainline-object-font-size, 14px);
 }
 .scene-mainline-object--table.scene-mainline-object--facing-east > span,
 .scene-mainline-object--table.scene-mainline-object--facing-west > span,
@@ -1136,7 +1136,7 @@
   z-index: 7;
   color: var(--active);
   font-family: Georgia, "Noto Serif SC", serif;
-  font-size: clamp(22px, 3.1cqw, 38px);
+  font-size: 38px;
   line-height: 1;
   pointer-events: none;
   transform: translate(-50%, -50%);
@@ -1325,14 +1325,14 @@
     width: max-content;
     max-width: calc(100% - 8px);
     padding: 0;
-    font-size: var(--scene-mainline-object-font-size, clamp(9px, 1.15vmin, 16px));
+    font-size: var(--scene-mainline-object-font-size, 14px);
     letter-spacing: 0;
   }
   .scene-mainline-wall,
   [data-mainline-scene="commercial-cafe"] .scene-mainline-object--fixture,
   [data-mainline-scene="commercial-cafe"] .scene-mainline-object--table,
   [data-mainline-scene="commercial-cafe"] .scene-mainline-object--seat {
-    font-size: var(--scene-mainline-object-font-size, clamp(9px, 1.15vmin, 16px));
+    font-size: var(--scene-mainline-object-font-size, 14px);
   }
   .scene-mainline-text { max-width: calc(100% - 24px); max-height: 38%; padding: 2px 0; }
   .scene-mainline-text, .scene-mainline-speaker-anchor { font-size: 12px; line-height: 1.5; }
@@ -1347,12 +1347,12 @@
   .scene-shell__state { min-width: 70px; padding-left: 8px; font-size: 9px; }
   .scene-shell__state strong { font-size: 12px; }
   .scene-stage { height: clamp(300px, calc(100svh - 100px), 560px); min-height: 300px; }
-  .scene-mainline-object { min-width: 0; min-height: 0; width: max-content; padding: 0; font-size: var(--scene-mainline-object-font-size, clamp(9px, 1.15vmin, 16px)); }
+  .scene-mainline-object { min-width: 0; min-height: 0; width: max-content; padding: 0; font-size: var(--scene-mainline-object-font-size, 14px); }
   .scene-mainline-wall,
   [data-mainline-scene="commercial-cafe"] .scene-mainline-object--fixture,
   [data-mainline-scene="commercial-cafe"] .scene-mainline-object--table,
   [data-mainline-scene="commercial-cafe"] .scene-mainline-object--seat {
-    font-size: var(--scene-mainline-object-font-size, clamp(9px, 1.15vmin, 16px));
+    font-size: var(--scene-mainline-object-font-size, 14px);
   }
   .scene-spatial-glyph--door { min-width: 42px; }
   .scene-object--fixture,
@@ -1383,3 +1383,21 @@
 @keyframes phone-app-enter { from { opacity: .6; transform: scale(.985); } to { opacity: 1; transform: scale(1); } }
 @keyframes phone-call-pulse { 0%, 60%, 100% { opacity: .28; transform: scale(.8); } 30% { opacity: .9; transform: scale(1.2); } }
 @keyframes phone-place-card-enter { from { opacity: .7; transform: translateX(10px) scale(.94); } to { opacity: 1; transform: translateX(0) scale(1); } }
+
+/* World text has one authored size. Legacy spatial/UI media rules above must
+   not resize mainline furniture or people independently of the world. */
+.scene-mainline-world .scene-spatial-labels,
+.scene-mainline-world .scene-object--fixture,
+.scene-mainline-world .scene-object--character,
+.scene-mainline-world .scene-actor__label,
+.scene-mainline-world .scene-table-text,
+.scene-mainline-world .scene-chair-text {
+  font-size: var(--scene-mainline-object-font-size, 14px);
+}
+
+/* Adjacent letters inside furniture use the 16-unit center pitch: 14 type + 2 tracking. */
+.scene-mainline-world .scene-mainline-object--fixture .scene-mainline-object__label,
+.scene-mainline-world .scene-mainline-object--table .scene-mainline-object__label,
+.scene-mainline-world .scene-mainline-object--seat .scene-mainline-object__label {
+  letter-spacing: 2px;
+}
diff --git a/src/center/runtime/sceneBoundaryGrid.ts b/src/center/runtime/sceneBoundaryGrid.ts
index 722edf9..8330b54 100644
--- a/src/center/runtime/sceneBoundaryGrid.ts
+++ b/src/center/runtime/sceneBoundaryGrid.ts
@@ -12,17 +12,18 @@ export type BoundaryGridCell = {
 }

 /**
- * The stage is authored in percentage coordinates, but glyph spacing is a
- * physical screen concern. Keep one spacing source and project it onto the
- * stage's two dimensions instead of authoring independent x/y steps.
+ * The mainline world is authored against one 1920×1080 reference. Viewport
+ * projection scales its fixed text, lattice and frames together. The legacy
+ * screen-spacing helper remains available to non-world callers.
  */
 export type SceneScreenMetrics = {
   width: number
   height: number
-  /** Viewport-based storefront typography; stage percentages still use width/height. */
+  /** Legacy viewport metadata; mainline world typography uses a fixed reference. */
   viewportWidth?: number
 }

+export const mainlineWorldFontSizePx = 14
 export const sharedBoundaryScreenSpacingPx = 28
 export const sharedFurnitureGlyphSpacingPx = 16
 /** Logical scene authoring reference. Distances are CSS px at 1:1. */
diff --git a/src/center/runtime/sceneLayout.ts b/src/center/runtime/sceneLayout.ts
index 9fd4d99..da645d0 100644
--- a/src/center/runtime/sceneLayout.ts
+++ b/src/center/runtime/sceneLayout.ts
@@ -1,3 +1,4 @@
+import { mainlineWorldFontSizePx, sharedFurnitureGlyphSpacingPx } from './sceneBoundaryGrid'
 import type { CollisionBox, Point } from './sceneGeometry'
 import type { MainlineSceneDefinition, MainlineSceneEntity } from './mainlineScenes'
 import { defaultSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
@@ -177,12 +178,9 @@ function mainlineEntityUsesVerticalText(entity: MainlineSceneEntity) {
   return (entity.kind === 'table' || entity.kind === 'seat') && (entity.facing === 'east' || entity.facing === 'west')
 }

-export function mainlineEntityFontSizePx(_entity: MainlineSceneEntity | null, screenMetrics: SceneScreenMetrics) {
-  // Keep the interaction footprint in lockstep with the mainline object CSS.
-  // The rendered object consumes the same measured stage-width basis through
-  // a CSS custom property. This keeps the footprint and focus frame aligned
-  // on responsive landscape tablet layouts as well as portrait layouts.
-  return Math.max(9, Math.min(16, screenMetrics.width * .0115))
+export function mainlineEntityFontSizePx(_entity: MainlineSceneEntity | null, _screenMetrics: SceneScreenMetrics) {
+  // The world projection scales text and geometry together exactly once.
+  return mainlineWorldFontSizePx
 }

 /**
@@ -194,15 +192,16 @@ export function mainlineLabelFootprint(
   label: string,
   position: Point,
   screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
-  options: { vertical?: boolean; visualScale?: number; lineHeight?: number } = {},
+  options: { vertical?: boolean; visualScale?: number; lineHeight?: number; glyphPitchPx?: number } = {},
 ): CollisionBox {
   const glyphCount = Math.max(1, Array.from(label).length)
   const fontSizePx = mainlineEntityFontSizePx(null, screenMetrics)
   const vertical = options.vertical ?? false
   const lineHeight = options.lineHeight ?? (vertical ? 1 : 1.2)
   const scale = Number.isFinite(options.visualScale) && (options.visualScale ?? 0) > 0 ? options.visualScale! : 1
-  const widthPx = vertical ? fontSizePx : glyphCount * fontSizePx
-  const heightPx = vertical ? glyphCount * fontSizePx : fontSizePx * lineHeight
+  const textExtent = glyphCount * (options.glyphPitchPx ?? fontSizePx)
+  const widthPx = vertical ? fontSizePx : textExtent
+  const heightPx = vertical ? textExtent : fontSizePx * lineHeight
   const width = Number(((widthPx * scale / screenMetrics.width) * 100).toFixed(4))
   const height = Number(((heightPx * scale / screenMetrics.height) * 100).toFixed(4))
   return {
@@ -308,6 +307,7 @@ export function mainlineEntityTextFootprint(
   return mainlineLabelFootprint(entity.label, position, screenMetrics, {
     vertical: mainlineEntityUsesVerticalText(entity),
     visualScale: entity.visualScale,
+    glyphPitchPx: ['fixture', 'table', 'seat'].includes(entity.kind) ? sharedFurnitureGlyphSpacingPx : undefined,
     lineHeight: entity.kind === 'table' || entity.kind === 'seat' ? 1 : 1.2,
   })
 }
diff --git a/src/center/runtime/scenePathfinding.ts b/src/center/runtime/scenePathfinding.ts
index 1a5a0e6..f01a89c 100644
--- a/src/center/runtime/scenePathfinding.ts
+++ b/src/center/runtime/scenePathfinding.ts
@@ -233,27 +233,50 @@ function connectEdgeGroups(
   }
 }

+// A conservative broad phase: it only removes boxes outside the segment AABB.
+// The original open-interior slab test below still decides every candidate.
+type ObstacleTree = { bounds: CollisionBox; boxes?: readonly CollisionBox[]; left?: ObstacleTree; right?: ObstacleTree }
+const obstacleTrees = new WeakMap<readonly CollisionBox[], ObstacleTree>()
+function obstacleTree(boxes: readonly CollisionBox[]): ObstacleTree {
+  const left = Math.min(...boxes.map(box => box.x)), top = Math.min(...boxes.map(box => box.y))
+  const right = Math.max(...boxes.map(box => box.x + box.width)), bottom = Math.max(...boxes.map(box => box.y + box.height))
+  const bounds = { x: left, y: top, width: right - left, height: bottom - top }
+  if (boxes.length <= 8) return { bounds, boxes }
+  const axis = bounds.width >= bounds.height ? 'x' : 'y'
+  const ordered = [...boxes].sort((a, b) => a[axis] - b[axis])
+  const middle = Math.floor(ordered.length / 2)
+  return { bounds, left: obstacleTree(ordered.slice(0, middle)), right: obstacleTree(ordered.slice(middle)) }
+}
 function segmentCrossesInterior(start: Point, end: Point, box: CollisionBox) {
-  let entry = 0
-  let exit = 1
-  const axes = [
-    [start.x, end.x, box.x, box.x + box.width],
-    [start.y, end.y, box.y, box.y + box.height],
-  ] as const
-  for (const [startValue, endValue, minimum, maximum] of axes) {
-    const delta = endValue - startValue
-    if (Math.abs(delta) <= epsilon) {
-      if (startValue <= minimum + epsilon || startValue >= maximum - epsilon) return false
-      continue
-    }
-    const first = (minimum - startValue) / delta
-    const second = (maximum - startValue) / delta
-    entry = Math.max(entry, Math.min(first, second))
-    exit = Math.min(exit, Math.max(first, second))
+  // Reject disjoint boxes before divisions, without allocating axis arrays in
+  // the graph's innermost pair loop. Equality remains a candidate.
+  if (Math.max(start.x, end.x) < box.x || Math.min(start.x, end.x) > box.x + box.width
+    || Math.max(start.y, end.y) < box.y || Math.min(start.y, end.y) > box.y + box.height) return false
+  let entry = 0, exit = 1
+  const dx = end.x - start.x, dy = end.y - start.y
+  if (Math.abs(dx) <= epsilon) {
+    if (start.x <= box.x + epsilon || start.x >= box.x + box.width - epsilon) return false
+  } else {
+    const first = (box.x - start.x) / dx, second = (box.x + box.width - start.x) / dx
+    entry = Math.max(entry, Math.min(first, second)); exit = Math.min(exit, Math.max(first, second))
+    if (entry >= exit - epsilon) return false
+  }
+  if (Math.abs(dy) <= epsilon) {
+    if (start.y <= box.y + epsilon || start.y >= box.y + box.height - epsilon) return false
+  } else {
+    const first = (box.y - start.y) / dy, second = (box.y + box.height - start.y) / dy
+    entry = Math.max(entry, Math.min(first, second)); exit = Math.min(exit, Math.max(first, second))
     if (entry >= exit - epsilon) return false
   }
   return entry < 1 - epsilon && exit > epsilon && entry < exit - epsilon
 }
+function treeBlocksSegment(tree: ObstacleTree, start: Point, end: Point): boolean {
+  const box = tree.bounds
+  if (Math.max(start.x, end.x) < box.x || Math.min(start.x, end.x) > box.x + box.width
+    || Math.max(start.y, end.y) < box.y || Math.min(start.y, end.y) > box.y + box.height) return false
+  if (tree.boxes) return tree.boxes.some(box => segmentCrossesInterior(start, end, box))
+  return treeBlocksSegment(tree.left!, start, end) || treeBlocksSegment(tree.right!, start, end)
+}

 function segmentIsClear(
   start: Point,
@@ -262,7 +285,9 @@ function segmentIsClear(
   barriers: readonly NavigationBarrierSegment[] = [],
   footprint: { width: number; height: number } = { width: 0, height: 0 },
 ) {
-  return obstacles.every((obstacle) => !segmentCrossesInterior(start, end, obstacle))
+  let tree = obstacleTrees.get(obstacles)
+  if (!tree && obstacles.length) { tree = obstacleTree(obstacles); obstacleTrees.set(obstacles, tree) }
+  return (!tree || !treeBlocksSegment(tree, start, end))
     && navigationBarriersAllowTravel(start, end, barriers, footprint)
 }

diff --git a/src/center/runtime/sceneVisualBounds.ts b/src/center/runtime/sceneVisualBounds.ts
index 610c2a9..c97f519 100644
--- a/src/center/runtime/sceneVisualBounds.ts
+++ b/src/center/runtime/sceneVisualBounds.ts
@@ -1,11 +1,17 @@
 export type VisualRect = { left: number; top: number; right: number; bottom: number }

-/** One screen-space gap for every frame; the SVG stroke has its own 1px inset. */
+/** World-local CSS units: gap 2 + stroke inset 1 = outer expansion 3; project once. */
 export const sceneFocusVisualGapPx = 2
 export const sceneFocusStrokeInsetPx = 1

 export type VisualScale = { x: number; y: number }

+/** Convert measured ink/neighbors before applying world-unit frame margins. */
+export function sceneVisualRectInLocalSpace(rect: VisualRect, origin: { left: number; top: number }, scale: VisualScale): VisualRect {
+  return { left: (rect.left - origin.left) / scale.x, right: (rect.right - origin.left) / scale.x,
+    top: (rect.top - origin.top) / scale.y, bottom: (rect.bottom - origin.top) / scale.y }
+}
+
 /**
  * Resolve the screen-to-local scale from the nearest ancestor with a real
  * layout box. getBoundingClientRect is in viewport pixels while canvas font
diff --git a/src/center/runtime/storefrontContactGeometry.ts b/src/center/runtime/storefrontContactGeometry.ts
index e39b90d..ac584f2 100644
--- a/src/center/runtime/storefrontContactGeometry.ts
+++ b/src/center/runtime/storefrontContactGeometry.ts
@@ -1,3 +1,4 @@
+import { mainlineWorldFontSizePx } from './sceneBoundaryGrid'
 import type { MainlineSceneGeometryUnit, MainlineStorefrontSlot } from './mainlineScenes'
 import type { SceneScreenMetrics } from './sceneBoundaryGrid'
 import type { CollisionBox, Point } from './sceneGeometry'
@@ -26,7 +27,7 @@ export function storefrontContactGeometry(
   const start = Math.min(...cells.map(cell => cell.cellStart ?? (horizontal ? cell.x : cell.y)))
   const end = Math.max(...cells.map(cell => cell.cellEnd ?? (horizontal ? cell.x : cell.y)))
   const line = cells.reduce((sum, cell) => sum + (horizontal ? cell.y : cell.x), 0) / cells.length
-  const fontSizePx = Math.max(12, Math.min(16, (metrics.viewportWidth ?? metrics.width) * .012))
+  const fontSizePx = mainlineWorldFontSizePx
   const textExtent = (Array.from(storefront.label).length * 1.08 + .7) * fontSizePx
   const tangentPixels = (end - start) * (horizontal ? metrics.width : metrics.height) / 100
   const extent = Math.min(textExtent, tangentPixels - .15 * fontSizePx)

```

## 最终补充核验

- 最终组合候选补充导航5文件21/21通过：navigationQueryReuse、navigationBarrier、singleDynamicObstacleDetour、npcMovement、dynamicMovementRegression。
- 正常根URL新游戏与损坏档均实际确认data-phone-device=inner、commercial-street、主角(34,50)。
- Notion正文子页已创建并回读，含实际diff、性能前后与旧墙例外：https://app.notion.com/p/400b138d1e11815888c0d3c874889544 。
- 本地4173首页仍引用index-CP1zSUw1.js/index-Br7LuK_y.css；4174两资源HTTP200；未push或发布。
