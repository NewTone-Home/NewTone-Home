# 正常Cafe路线性能追修与墙格阻断

## 当前状态：不发布

应用HEAD77453851a1c22a5461f16e268ce89ef5014190cc，前一导航提交9a6b1173c26c8c9331e6e27be8785b0b22e09a97。

本轮性能改动已分项保存；墙格11c06da仍被独立QA否决，任何含它的组合构建均不可发布。4179仅供性能与框测量验证。4174仍是index-CXaqEsxg.js，公共4173仍是cea7f14，均未替换；未push/main/staging/Vercel，真实存档未碰。

## 正常路线剩余停顿，不能被旧68ms隔离样本代替

独立QA无CPU采样、Chrome1280×800、DSF1，从商业街正常走进连续Cafe深处，再点击近街/远街/正门：起步350.8/约370/309.9ms；点门后另437ms长任务。证据E:/NewTone-Preview/.tmp/qa-candidate-0b82a2a/perf-4174。用户所指Cafe是commercial-street内房间，不是兼容独立commercial-cafe。

复用QA的实际行走脚本，保留walk(122.831,50)→点击street-cafe-entry→walk(140.3,-24)→测量点击的流程。没有注入主角深处位置、没有停NPC。脚本会记录reached和实际before；现场NPC/合法路径投影使部分尝试停在Y≈-27.5～-27.9，部分到达-24附近，不能把不同实际起点说成完全一致。

先在冻结4174做一次正常路线CPU采样，起步373.9ms、首长任务374ms，复现了QA等级。原始profile .tmp/cafe-normal-before/near.cpuprofile。分析按首个React onClick样本锚定时间窗口，再关联LongTask时间，不把Profiler启动前的(program)等待当作点击函数。

## 9a6b117：按需要构图，保留路径合法性

实际栈包含createPolygonNavigationMesh的自由单元枚举、connectEdgeGroups及可见图大量相交检查。findMainlinePath只调用mesh.findPath，却先构造只供nearestPoint/resolvePath连通区使用的自由单元图。

- scenePathfinding.PolygonNavigationOptions新增deferTopology；routeNavigationMesh只对路线mesh开启。world projection仍默认eager，保持原先准备阶段和最近点/连通区语义；延迟mesh若调用nearestPoint/resolvePath会构造完全相同的图。
- 可见性从“首次查询先全部节点两两连线”改为实际扩展节点时生成其邻边；已完成节点行意味着正反边的可见/不可见结果都已检查，无需重算。
- 选择下一节点用路径成本加到目标的欧氏距离，作为一致且不高估的A*启发；沿边仍经过原始障碍/屏障检查。完整图Dijkstra独立对照90个冷/渐暖目标的最短合法成本一致。
- mainlineNavigation.mainlineOccupancyQuery只在一次同步路线/segment查询内保存当时障碍、footprint、通行权限；不在每0.18采样点重新生成整个collisionBoxes数组和座位Set。公开isWalkableMainlinePoint、下一移动tick及下一寻路重新读取现场NPC/门状态；没有跨tick缓存动态占用。
- 保留前轮exact-input/8项LRU、动态挡路完整网格fallback、合法门路径、实时canTravel验证；没有删障碍、缩碰撞或瞬移。

只延迟单元图的中间版仍230ms，已明确判未达标；加入按需可见图和同步查询复用后，正常近街无采样起步83.6ms、正门采样51.5ms，但出店后还有141/156ms，继续诊断，没有拿这一版当整轮通过。

## 7745385：一次框测量内不要重复量整场字

141ms任务的精确部署bundle CPU窗口主要是measureSceneCharacterRects→Range/getBoundingClientRect/measureText及视觉scale/clip读取。一个框量自己的字后，又量所有邻字；下一框重复同一组邻字。

- SceneFocusFrames.measure每次调用创建一个共享canvas context，并按stage建立focus roots索引。
- sceneVisualBounds.createSceneCharacterRectBatch按DOM root缓存本批次字形rect；不同框的目标/邻居可以复用同一个root的结果。
- 测量函数退出即丢弃Map。下一次内容、字号、字体加载、相对位置、viewport投影、ResizeObserver或门翻动端点触发仍创建新批次；没有跨帧复用旧坐标，也没有更改观察器策略。
- 墨迹测法、switch clipping、世界单位margin/stroke、闭合路径及画出/收回计算不变。batch单测覆盖重复root、空/裁掉字形缓存，以及下一批次重新读取新位置。

## 单浏览器顺序实测（无CPU sampling）

相同Chrome155.0.8059.85、1280×800、DSF1；从正常街道进店，不注入深处位置。依次执行近/远/门，每次fresh context，前一个浏览器关闭后才开启下一个。每种操作本轮主对照为一次，不冒称三次重复统计或用工具响应时间算FPS。

- 近街：起步58.0ms；最长rAF间隔50ms；4.5秒观察窗无LongTask。
- 远街：起步60.1ms；最长rAF49.9ms；一次55ms LongTask。
- 正门：起步63.8ms；最长rAF50ms；一次52ms LongTask。
- 带CPU采样的最终正门：起步60.5ms，观察窗仅一次50ms任务，原141/156ms重复测量任务不再出现。

主轻量样本实际before：near(140.234,-24.0697)，far(140.234,-27.4952)，door(140.234,-24.114)。QA原样本约(140.234,-27.87)，路线输入相同但实际抵达点会因NPC/合法投影不同，已保留并公开，不把它隐藏成完全同坐标。

额外正常行走到QA原深处坐标的压力对照：请求walk(140.234,-27.87)后，远街实际before(140.234,-27.8831)，reached=true，与QA原坐标接近；起步67.1ms、一次54ms任务。近街/门两例请求该点未到达，实际更深Y=-30.1783，起步52.3/56.4ms，分别无/一次50ms任务。这两例只算更深位置压力样本，不冒称精确同坐标。

仍需独立QA复验；不能把LongTask为50–55ms说成绝对没有卡顿或全部性能通过。

## 框、测试、构建

- 21文件170项指定回归通过（这是性能/交互/保存/字体/框组，不含随后新增的红色墙格覆盖组）。导航7文件27项包括90次完整图最短成本对照、defer/eager nearest与projection相等、NPC/动态挡路/屏障；测量批次组30项通过。
- TypeScript及Vite build通过，只见既有大chunk warning。
- 1280×800和390×844真实果茶进出，desktop进入后实际resize为手机再回桌面：门框稳定闭合、返街收回隐藏，resize后重新测量。截图 .tmp/qa-perf-followup-frames，已有observer/endpoint/font加载代码未改，字体切换下载的真实浏览器专项未另测。
- 170通过不抵销墙格失败：新全门邻字、端点、整边最大间隙与拐角覆盖测试明确判红，详见下节。

## 墙格：新反回归抓到14项失败，尚待局部锚定确认

旧test只取24<gap<32，不能抓62/67空隙。这条筛选已移除，格相位检查现在检查全部间隔；新增mainlineWallVisualCoverage.test.ts与helpers/wallVisualCoverage.ts、0906541基线完整覆盖fixture，逐场景检查全部门组两端邻字、整边最大间隔、端点距离、全部结构拐角距离。断言使用soft收集全部样本错误，不在第一个失败后漏过后面的门。

同一覆盖测试在git archive隔离0906541控制组16/16通过；当前失败墙格中14/16不通过。与格距/物理测试一起总18通过14失败，红色结果主动保留，不放宽阈值伪装修好。还发现矿区industrial-edge这个未配fixed cell count的边同样被失败实现改动，否定“矿区全部视觉未动”的旧笼统说法；商业店主体格保留不等于所有工业边界保留。

当前仍使用失败11c06产品实现供核查，未发布。新的局部锚定只读方案见docs/reports/2026-10-21-wall-local-anchor-proposal.md：按完整frame edge而非unit裁字，门旁以最外门字±28作为邻字锚点，再向外排28。若两端固定锚点间不是28整数倍，则必须明确选择一种收口；建议普通直墙28，冲突仅在一处不足28的端部收口、不制造大空隙。这个建议不是已授权的“全部严格28”，需父/作者确认；否则只能逐段批准必要角字/边界微调。未擅自删字、移门或进行新布局。

## 性能测试构建（包含失败墙格，不可发布）

地址http://127.0.0.1:4179/，应用SHA77453851a1c22a5461f16e268ce89ef5014190cc，PID26528。
JS index-B6cNvnZj.js，828201 bytes，SHA256 E854F77569A3C24B59912973FE82489419E968074A919CF367E4DDA60C250298。
CSS index-DqwytlUi.css，200263 bytes，SHA256 8037B3161155B4BD755F467A08FC895B2A38EBAA6A21E30C7F8CC89513EB913A。

4177保留失败墙格证据；4178保留导航小步对照；4174/4173冻结。没有任何一项发布动作。

## 原始证据

- .tmp/cafe-normal-before/near.json、near.cpuprofile：冻结4174的正常路线374ms采样复现。
- .tmp/cafe-normal-deferred-sampled：230ms中间步骤，非最终通过。
- .tmp/cafe-normal-final-sampled：导航后正门51.5ms，后续141/156ms及完整当时index-BsFvXeTd.js。
- .tmp/cafe-normal-batch-sampled：批次优化后正门采样60.5ms与一次50ms任务。
- .tmp/cafe-normal-batch-light：主轻量near/far/door三项；.tmp/cafe-normal-matched-light：更深/近似原点压力三项。
- .tmp/qa-perf-followup-frames：真实进出与resize截图/状态。
- .tmp/wall-current-visual-coverage.json、wall-visual-coverage-regression.json：全部墙视觉覆盖及14项红色失败。

## 两项性能提交实际运行时代码diff

```diff
diff --git a/src/center/runtime/SceneFocusFrames.tsx b/src/center/runtime/SceneFocusFrames.tsx
index 175fa36..f7d7c40 100644
--- a/src/center/runtime/SceneFocusFrames.tsx
+++ b/src/center/runtime/SceneFocusFrames.tsx
@@ -2,7 +2,7 @@

 import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type TransitionEvent as ReactTransitionEvent } from 'react'
 import { sceneFrameDefaultMotionMs, sceneFrameMotionMsForRect } from './sceneMotion'
-import { measureSceneCharacterRects, measureSceneCharacters, sceneElementVisualScale, sceneVisualRectInLocalSpace, sceneFrameBoundsInLocalSpace, sceneFocusVisualGapPx, sceneFocusStrokeInsetPx } from './sceneVisualBounds'
+import { measureSceneCharacterRects, createSceneCharacterRectBatch, unionVisualRects, sceneElementVisualScale, sceneVisualRectInLocalSpace, sceneFrameBoundsInLocalSpace, sceneFocusVisualGapPx, sceneFocusStrokeInsetPx } from './sceneVisualBounds'
 import { beginFrameAppearance, beginFrameRetraction, completeFrameTransition, frameShouldCollapse, frameVisualPhase, preserveFrameRetractCorner, resumeFrameAppearance, type SceneFrameRuntime, type SceneFrameTarget } from './sceneFrameLifecycle'
 import { createEndpointMeasurementScheduler } from './sceneFocusFrameEndpointMeasure'

@@ -209,19 +209,32 @@ export function useSceneFocusFrameController({ targets, freezeMeasurements = fal
     if (freezeMeasurements) return undefined
     const measure = (groups: Iterable<string> = targetGroups) => {
       const updates = new Map<string, { duration: number; geometry: SceneFocusFrameGeometry; bounds: CSSProperties }>()
+      const context = document.createElement('canvas').getContext('2d')
+      const measureRects = createSceneCharacterRectBatch(nodes => measureSceneCharacterRects(nodes, context))
+      const stages = new Map<Element, { groups: Map<string, HTMLElement[]>; characters: HTMLElement[] }>()
       for (const group of groups) {
         const node = frameNodesRef.current.get(group)
         if (!node) continue
         const parent = node.parentElement
         const stage = node.closest('.mainline-scene-stage')
         if (!parent || !stage) continue
-        const characters = [...stage.querySelectorAll<HTMLElement>('[data-focus-visual-group]')]
-          .filter(element => element.dataset.focusVisualGroup === group)
-        const viewportRect = measureSceneCharacters(characters)
+        let stageNodes = stages.get(stage)
+        if (!stageNodes) {
+          const groups = new Map<string, HTMLElement[]>()
+          stage.querySelectorAll<HTMLElement>('[data-focus-visual-group]').forEach(element => {
+            const id = element.dataset.focusVisualGroup ?? ''
+            const roots = groups.get(id) ?? []
+            roots.push(element); groups.set(id, roots)
+          })
+          stageNodes = { groups, characters: [...stage.querySelectorAll<HTMLElement>('[data-scene-characters]')] }
+          stages.set(stage, stageNodes)
+        }
+        const characters = stageNodes.groups.get(group) ?? []
+        const viewportRect = unionVisualRects(measureRects(characters))
         if (!viewportRect) continue
-        const otherCharacters = [...stage.querySelectorAll<HTMLElement>('[data-scene-characters]')]
+        const otherCharacters = stageNodes.characters
           .filter(element => !characters.some(target => target === element || target.contains(element) || element.contains(target)))
-        const viewportNeighbors = measureSceneCharacterRects(otherCharacters)
+        const viewportNeighbors = measureRects(otherCharacters)
         const origin = parent.getBoundingClientRect()
         const parentStyle = getComputedStyle(parent)
         const worldScale = sceneElementVisualScale(parent.closest<HTMLElement>('.scene-mainline-world'))
diff --git a/src/center/runtime/mainlineNavigation.ts b/src/center/runtime/mainlineNavigation.ts
index 00b31d2..311174b 100644
--- a/src/center/runtime/mainlineNavigation.ts
+++ b/src/center/runtime/mainlineNavigation.ts
@@ -59,7 +59,7 @@ function routeNavigationMesh(scene: MainlineSceneDefinition, inputs: Parameters<
   const key = JSON.stringify(inputs)
   const meshes = routeNavigationMeshCache.get(scene) ?? new Map<string, CachedNavigationMesh>()
   const cached = meshes.get(key)
-  const mesh = cached?.mesh ?? createPolygonNavigationMesh(inputs)
+  const mesh = cached?.mesh ?? createPolygonNavigationMesh({ ...inputs, deferTopology: true })
   meshes.delete(key); meshes.set(key, { key, mesh })
   while (meshes.size > MAX_STATIC_NAVIGATION_MESHES_PER_SCENE) meshes.delete(meshes.keys().next().value!)
   routeNavigationMeshCache.set(scene, meshes)
@@ -163,7 +163,7 @@ export function canTravelAlongMainlineSegment(
   maxStep = sharedNavigationTraversalStep,
 ) {
   return isMainlineNavigationBarrierClear(start, end, scene, layout, options)
-    && canTravelAlongSegment(start, end, (point) => isWalkableMainlinePoint(point, scene, layout, options), maxStep)
+    && canTravelAlongSegment(start, end, mainlineOccupancyQuery(scene, layout, options, start), maxStep)
 }

 function overlaps(first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) {
@@ -173,9 +173,6 @@ function overlaps(first: { x: number; y: number; width: number; height: number }
     && first.y + first.height > second.y
 }

-function expanded(box: { x: number; y: number; width: number; height: number }, radius: number) {
-  return { x: box.x - radius, y: box.y - radius, width: box.width + radius * 2, height: box.height + radius * 2 }
-}

 function actorAccessFor(scene: MainlineSceneDefinition, actorId?: string) {
   return new Set(scene.actorAccess[actorId ?? 'protagonist'] ?? ['public'])
@@ -208,6 +205,7 @@ function collisionBoxes(
   // A closed passage stays a physical gate until its lifecycle marks it open;
   // planning may approach its boundary, but cannot plan through the doorway.
   const geometry = snapshot.units
+  const occupiedSeats = occupiedSeatIdsForNavigation(scene, options)
   const staticBoxes = [
     ...geometry
       .filter((unit) => {
@@ -231,7 +229,7 @@ function collisionBoxes(
       })
       .map((unit) => ({ x: unit.x, y: unit.y, width: unit.width, height: unit.height })),
     ...scene.objects
-      .filter((entity) => entity.visible !== false && !(entity.kind === 'seat' && occupiedSeatIdsForNavigation(scene, options).has(entity.id)))
+      .filter((entity) => entity.visible !== false && !(entity.kind === 'seat' && occupiedSeats.has(entity.id)))
       .map((entity) => snapshot.objects.get(entity.id)?.collision ?? mainlineEntityCollision(scene, entity, layout, options.screenMetrics))
       .filter((collision): collision is NonNullable<typeof collision> => Boolean(collision)),
   ]
@@ -243,21 +241,31 @@ export function mainlineNavigationCollisionBoxes(scene: MainlineSceneDefinition,
   return collisionBoxes(scene, layout, options)
 }

-export function isWalkableMainlinePoint(point: Point, scene: MainlineSceneDefinition, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
-  const footprint = mainlineActorFootprint(scene, options, point)
+/** One synchronous query owns one current occupancy snapshot. Movement ticks
+ * still call the public predicate afresh, so later NPC/door changes are live. */
+function mainlineOccupancyQuery(scene: MainlineSceneDefinition, layout: SceneLayout, options: MainlineNavigationOptions, position: Point, obstacles = collisionBoxes(scene, layout, options)) {
+  const footprint = mainlineActorFootprint(scene, options, position)
   const bounds = insetBounds(sceneGeometrySnapshot(scene, layout, options).walkBounds, footprint)
-  if (point.x < bounds.x || point.x > bounds.x + bounds.width || point.y < bounds.y || point.y > bounds.y + bounds.height) return false
-  // Access is a semantic occupancy policy, never a physical scene obstacle.
-  if (scene.accessRegions.some(region => !actorCanEnterRegion(scene, options.actorId, region) && containsPoint(region, point))) return false
-  for (const boundary of scene.accessBoundaries) {
+  const access = actorAccessFor(scene, options.actorId)
+  const deniedRegions = scene.accessRegions.filter(region => !access.has(region.requiredAccess))
+  const deniedEdges = scene.accessBoundaries.flatMap(boundary => {
     const region = scene.accessRegions.find(candidate => candidate.id === boundary.regionId)
-    if (!region || actorCanEnterRegion(scene, options.actorId, region)) continue
-    const contact = accessBoundaryGeometry(region, boundary.edge, footprint)
-    const tangent = point[contact.tangentAxis]
-    if (tangent >= contact.min && tangent <= contact.max && (point[contact.axis] - contact.line) * contact.direction <= contact.clearance) return false
+    return region && !access.has(region.requiredAccess) ? [accessBoundaryGeometry(region, boundary.edge, footprint)] : []
+  })
+  return (point: Point) => {
+    if (point.x < bounds.x || point.x > bounds.x + bounds.width || point.y < bounds.y || point.y > bounds.y + bounds.height) return false
+    if (deniedRegions.some(region => containsPoint(region, point))) return false
+    for (const contact of deniedEdges) {
+      const tangent = point[contact.tangentAxis]
+      if (tangent >= contact.min && tangent <= contact.max && (point[contact.axis] - contact.line) * contact.direction <= contact.clearance) return false
+    }
+    const actorBox = navigationActorBox(point, footprint)
+    return obstacles.every(collision => !overlaps(actorBox, collision))
   }
-  const actorBox = navigationActorBox(point, footprint)
-  return collisionBoxes(scene, layout, options).every((collision) => !overlaps(actorBox, expanded(collision, 0)))
+}
+
+export function isWalkableMainlinePoint(point: Point, scene: MainlineSceneDefinition, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}) {
+  return mainlineOccupancyQuery(scene, layout, options, point)(point)
 }

 function distance(first: Point, second: Point) {
@@ -1169,19 +1177,21 @@ export function findMainlinePathThroughPassage(scene: MainlineSceneDefinition, p

 export function findMainlinePath(start: Point, target: Point, scene: MainlineSceneDefinition, layout: SceneLayout = {}, options: MainlineNavigationOptions = {}): Point[] | null {
   options = { ...options, geometrySnapshot: sceneGeometrySnapshot(scene, layout, options) }
-  if (!isWalkableMainlinePoint(start, scene, layout, options)) return null
-  const targetIsWalkable = isWalkableMainlinePoint(target, scene, layout, options)
-  if (!targetIsWalkable) return null
   const staticOptions = { ...options, navigationRuntime: undefined }
   const actorFootprint = mainlineActorFootprint(scene, options, start)
   const snapshot = sceneGeometrySnapshot(scene, layout, options)
   const barriers = mainlineNavigationBarriers(scene, layout, { ...options, geometrySnapshot: snapshot })
-  const canOccupy = (point: Point) => isWalkableMainlinePoint(point, scene, layout, options)
-  if (targetIsWalkable && isMainlineNavigationBarrierClear(start, target, scene, layout, options) && canTravelAlongSegment(start, target, canOccupy)) return [start, target]
-  const canTravel = (from: Point, to: Point) => isMainlineNavigationBarrierClear(from, to, scene, layout, options)
-    && canTravelAlongSegment(from, to, canOccupy)
-  const canTravelStatic = (from: Point, to: Point) => isMainlineNavigationBarrierClear(from, to, scene, layout, staticOptions)
-    && canTravelAlongSegment(from, to, point => isWalkableMainlinePoint(point, scene, layout, staticOptions))
+  const staticObstacles = collisionBoxes(scene, layout, staticOptions)
+  const obstacles = [...staticObstacles, ...(options.navigationRuntime?.dynamicObstaclesFor(options.actorId) ?? [])]
+  const canOccupy = mainlineOccupancyQuery(scene, layout, options, start, obstacles)
+  const canOccupyStatic = mainlineOccupancyQuery(scene, layout, staticOptions, start, staticObstacles)
+  if (!canOccupy(start)) return null
+  const targetIsWalkable = canOccupy(target)
+  if (!targetIsWalkable) return null
+  const barriersClear = (from: Point, to: Point) => navigationBarriersAllowTravel(from, to, barriers, actorFootprint)
+  const canTravel = (from: Point, to: Point) => barriersClear(from, to) && canTravelAlongSegment(from, to, canOccupy)
+  if (canTravel(start, target)) return [start, target]
+  const canTravelStatic = (from: Point, to: Point) => barriersClear(from, to) && canTravelAlongSegment(from, to, canOccupyStatic)
   if (targetIsWalkable
     && options.navigationRuntime
     && canTravelStatic(start, target)) {
@@ -1195,7 +1205,6 @@ export function findMainlinePath(start: Point, target: Point, scene: MainlineSce
     if (detour) return detour
   }
   const bounds = insetBounds(snapshot.walkBounds, actorFootprint)
-  const staticObstacles = collisionBoxes(scene, layout, staticOptions)
   const inputs = { bounds, obstacles: staticObstacles,
     obstacleInset: { x: actorFootprint.width / 2, y: actorFootprint.height / 2 }, barriers, actorFootprint }
   // Player and NPC requests share immutable physical geometry. A moving actor
@@ -1205,7 +1214,6 @@ export function findMainlinePath(start: Point, target: Point, scene: MainlineSce
     ...inputs, navigationMesh: routeNavigationMesh(scene, inputs), canTravel,
   })
   if (staticPath || !options.navigationRuntime) return staticPath
-  const obstacles = collisionBoxes(scene, layout, options)
   const dynamicInputs = { ...inputs, obstacles }
   return findNavigationPath(start, target, {
     ...dynamicInputs, navigationMesh: routeNavigationMesh(scene, dynamicInputs), canTravel,
diff --git a/src/center/runtime/scenePathfinding.ts b/src/center/runtime/scenePathfinding.ts
index f01a89c..902fae5 100644
--- a/src/center/runtime/scenePathfinding.ts
+++ b/src/center/runtime/scenePathfinding.ts
@@ -1,6 +1,8 @@
 import { createPoint, type CollisionBox, type NavigationBarrierSegment, type Point } from './sceneGeometry'

 export type PolygonNavigationOptions = {
+  /** Route-only meshes defer free-cell topology until projection is requested. */
+  deferTopology?: boolean
   /** The actor-clear walkable rectangle, before obstacle clearance is applied. */
   bounds: CollisionBox
   /** Raw static collision boxes from the shared scene contract. */
@@ -343,54 +345,63 @@ export function createPolygonNavigationMesh(options: PolygonNavigationOptions):
     height: (options.obstacleInset?.y ?? 0) * 2,
   }

-  const xLines = uniqueSorted([
-    bounds.x,
-    bounds.x + bounds.width,
-    ...obstacles.flatMap((obstacle) => [obstacle.x, obstacle.x + obstacle.width]),
-    ...barriers.flatMap((barrier) => [barrier.start.x, barrier.end.x]),
-  ]).filter((value) => value >= bounds.x - epsilon && value <= bounds.x + bounds.width + epsilon)
-  const yLines = uniqueSorted([
-    bounds.y,
-    bounds.y + bounds.height,
-    ...obstacles.flatMap((obstacle) => [obstacle.y, obstacle.y + obstacle.height]),
-    ...barriers.flatMap((barrier) => [barrier.start.y, barrier.end.y]),
-  ]).filter((value) => value >= bounds.y - epsilon && value <= bounds.y + bounds.height + epsilon)
-
   const cells: FreeCell[] = []
-  for (let xIndex = 0; xIndex < xLines.length - 1; xIndex += 1) {
-    for (let yIndex = 0; yIndex < yLines.length - 1; yIndex += 1) {
-      const left = xLines[xIndex]!
-      const right = xLines[xIndex + 1]!
-      const top = yLines[yIndex]!
-      const bottom = yLines[yIndex + 1]!
-      if (right - left <= epsilon || bottom - top <= epsilon) continue
-      const cell: CollisionBox = { x: left, y: top, width: right - left, height: bottom - top }
-      const center = { x: (left + right) / 2, y: (top + bottom) / 2 }
-      if (obstacles.some((obstacle) => containsPoint(obstacle, center) || overlaps(cell, obstacle))) continue
-      cells.push({ ...cell, index: cells.length })
+  const links = new Map<number, CellLink[]>()
+  let topologyReady = false
+  const ensureTopology = () => {
+    if (topologyReady) return
+    const xLines = uniqueSorted([
+      bounds.x,
+      bounds.x + bounds.width,
+      ...obstacles.flatMap((obstacle) => [obstacle.x, obstacle.x + obstacle.width]),
+      ...barriers.flatMap((barrier) => [barrier.start.x, barrier.end.x]),
+    ]).filter((value) => value >= bounds.x - epsilon && value <= bounds.x + bounds.width + epsilon)
+    const yLines = uniqueSorted([
+      bounds.y,
+      bounds.y + bounds.height,
+      ...obstacles.flatMap((obstacle) => [obstacle.y, obstacle.y + obstacle.height]),
+      ...barriers.flatMap((barrier) => [barrier.start.y, barrier.end.y]),
+    ]).filter((value) => value >= bounds.y - epsilon && value <= bounds.y + bounds.height + epsilon)
+
+    for (let xIndex = 0; xIndex < xLines.length - 1; xIndex += 1) {
+      for (let yIndex = 0; yIndex < yLines.length - 1; yIndex += 1) {
+        const left = xLines[xIndex]!
+        const right = xLines[xIndex + 1]!
+        const top = yLines[yIndex]!
+        const bottom = yLines[yIndex + 1]!
+        if (right - left <= epsilon || bottom - top <= epsilon) continue
+        const cell: CollisionBox = { x: left, y: top, width: right - left, height: bottom - top }
+        const center = { x: (left + right) / 2, y: (top + bottom) / 2 }
+        if (obstacles.some((obstacle) => containsPoint(obstacle, center) || overlaps(cell, obstacle))) continue
+        cells.push({ ...cell, index: cells.length })
+      }
     }
-  }

-  const verticalEdges = new Map<string, CellEdge[]>()
-  const horizontalEdges = new Map<string, CellEdge[]>()
-  const addEdge = (map: Map<string, CellEdge[]>, coordinate: number, start: number, end: number, cell: number) => {
-    const key = coordinate.toFixed(4)
-    const group = map.get(key) ?? []
-    group.push({ cell, start, end })
-    map.set(key, group)
+    const verticalEdges = new Map<string, CellEdge[]>()
+    const horizontalEdges = new Map<string, CellEdge[]>()
+    const addEdge = (map: Map<string, CellEdge[]>, coordinate: number, start: number, end: number, cell: number) => {
+      const key = coordinate.toFixed(4)
+      const group = map.get(key) ?? []
+      group.push({ cell, start, end })
+      map.set(key, group)
+    }
+    cells.forEach((cell) => {
+      addEdge(verticalEdges, cell.x, cell.y, cell.y + cell.height, cell.index)
+      addEdge(verticalEdges, cell.x + cell.width, cell.y, cell.y + cell.height, cell.index)
+      addEdge(horizontalEdges, cell.y, cell.x, cell.x + cell.width, cell.index)
+      addEdge(horizontalEdges, cell.y + cell.height, cell.x, cell.x + cell.width, cell.index)
+    })
+    connectEdgeGroups(verticalEdges, cells, links, obstacles, barriers, actorFootprint)
+    connectEdgeGroups(horizontalEdges, cells, links, obstacles, barriers, actorFootprint)
+    topologyReady = true
   }
-  cells.forEach((cell) => {
-    addEdge(verticalEdges, cell.x, cell.y, cell.y + cell.height, cell.index)
-    addEdge(verticalEdges, cell.x + cell.width, cell.y, cell.y + cell.height, cell.index)
-    addEdge(horizontalEdges, cell.y, cell.x, cell.x + cell.width, cell.index)
-    addEdge(horizontalEdges, cell.y + cell.height, cell.x, cell.x + cell.width, cell.index)
-  })
-  const links = new Map<number, CellLink[]>()
-  connectEdgeGroups(verticalEdges, cells, links, obstacles, barriers, actorFootprint)
-  connectEdgeGroups(horizontalEdges, cells, links, obstacles, barriers, actorFootprint)
+  // findPath uses visibility only. World projection still builds topology
+  // eagerly by default; deferred meshes build the exact same graph on demand.
+  if (!options.deferTopology) ensureTopology()

-  const cellContaining = (point: Point) => cells.find((cell) => containsPoint(cell, point))
+  const cellContaining = (point: Point) => { ensureTopology(); return cells.find((cell) => containsPoint(cell, point)) }
   const nearestPoint = (point: Point): Point | null => {
+    ensureTopology()
     let closest: Point | null = null
     let closestDistance = Infinity
     for (const cell of cells) {
@@ -476,32 +487,29 @@ export function createPolygonNavigationMesh(options: PolygonNavigationOptions):
     && obstacles.every((obstacle) => !containsPoint(obstacle, node))
   ))
   const staticVisibilityDistances = staticVisibilityNodes.map(() => new Map<number, number>())
-  let visibilityGraphReady = false
-  const ensureVisibilityGraph = () => {
-    if (visibilityGraphReady) return
-    visibilityGraphReady = true
-    staticVisibilityNodes.forEach((node, nodeIndex) => {
-      for (let candidateIndex = nodeIndex + 1; candidateIndex < staticVisibilityNodes.length; candidateIndex += 1) {
-        const candidate = staticVisibilityNodes[candidateIndex]!
-        if (!segmentIsClear(node, candidate, obstacles, barriers, actorFootprint)) continue
-        const distance = pointDistance(node, candidate)
-        staticVisibilityDistances[nodeIndex]!.set(candidateIndex, distance)
-        staticVisibilityDistances[candidateIndex]!.set(nodeIndex, distance)
-      }
-    })
+  const visibilityNeighborsReady = new Set<number>()
+  const ensureVisibilityNeighbors = (nodeIndex: number) => {
+    if (visibilityNeighborsReady.has(nodeIndex)) return
+    const node = staticVisibilityNodes[nodeIndex]!
+    for (let candidateIndex = 0; candidateIndex < staticVisibilityNodes.length; candidateIndex += 1) {
+      // A completed opposite row already tested this undirected edge, even
+      // when blocked. Retain both legal and blocked results without another
+      // scene-wide all-pairs build on the first route.
+      if (candidateIndex === nodeIndex || visibilityNeighborsReady.has(candidateIndex)) continue
+      const candidate = staticVisibilityNodes[candidateIndex]!
+      if (!segmentIsClear(node, candidate, obstacles, barriers, actorFootprint)) continue
+      const distance = pointDistance(node, candidate)
+      staticVisibilityDistances[nodeIndex]!.set(candidateIndex, distance)
+      staticVisibilityDistances[candidateIndex]!.set(nodeIndex, distance)
+    }
+    visibilityNeighborsReady.add(nodeIndex)
   }

   const findPathToGoal = (start: Point, goal: Point): Point[] | null => {
     if (segmentIsClear(start, goal, obstacles, barriers, actorFootprint)) return [start, goal]
-    ensureVisibilityGraph()

     const visibilityNodes = [start, goal, ...staticVisibilityNodes]
     const visibilityDistances = visibilityNodes.map(() => new Map<number, number>())
-    staticVisibilityDistances.forEach((links, nodeIndex) => {
-      links.forEach((distance, candidateIndex) => {
-        visibilityDistances[nodeIndex + 2]!.set(candidateIndex + 2, distance)
-      })
-    })
     for (let dynamicIndex = 0; dynamicIndex < 2; dynamicIndex += 1) {
       const node = visibilityNodes[dynamicIndex]!
       for (let candidateIndex = dynamicIndex + 1; candidateIndex < visibilityNodes.length; candidateIndex += 1) {
@@ -520,10 +528,19 @@ export function createPolygonNavigationMesh(options: PolygonNavigationOptions):
       let current = -1
       for (let index = 0; index < visibilityCost.length; index += 1) {
         if (visited.has(index) || visibilityCost[index] === Infinity) continue
-        if (current < 0 || visibilityCost[index]! < visibilityCost[current]!) current = index
+        // Euclidean distance is a consistent lower bound for these Euclidean
+        // visibility edges: A* preserves shortest legal routes while avoiding
+        // expansion (and neighbor construction) of unrelated stores.
+        if (current < 0 || visibilityCost[index]! + pointDistance(visibilityNodes[index]!, goal)
+          < visibilityCost[current]! + pointDistance(visibilityNodes[current]!, goal)) current = index
       }
       if (current < 0) break
+      if (current === 1) break
       visited.add(current)
+      if (current >= 2) {
+        ensureVisibilityNeighbors(current - 2)
+        staticVisibilityDistances[current - 2]!.forEach((distance, candidate) => visibilityDistances[current]!.set(candidate + 2, distance))
+      }
       for (const [candidate, edgeCost] of visibilityDistances[current]!) {
         const nextCost = visibilityCost[current]! + edgeCost
         if (nextCost < visibilityCost[candidate]!) {
diff --git a/src/center/runtime/sceneVisualBounds.ts b/src/center/runtime/sceneVisualBounds.ts
index c97f519..998a014 100644
--- a/src/center/runtime/sceneVisualBounds.ts
+++ b/src/center/runtime/sceneVisualBounds.ts
@@ -113,9 +113,7 @@ function clipToCharacterSwitch(rect: VisualRect, node: HTMLElement): VisualRect
  * preserve Range coordinates so CSS layout, writing mode and transforms still
  * determine where that glyph lives in the scene.
  */
-export function measureSceneCharacterRects(nodes: readonly HTMLElement[]) {
-  const canvas = document.createElement('canvas')
-  const context = canvas.getContext('2d')
+export function measureSceneCharacterRects(nodes: readonly HTMLElement[], context: CanvasRenderingContext2D | null = document.createElement('canvas').getContext('2d')) {
   const rects: VisualRect[] = []
   for (const root of nodes) {
     const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
@@ -160,3 +158,14 @@ export function measureSceneCharacterRects(nodes: readonly HTMLElement[]) {
 export function measureSceneCharacters(nodes: readonly HTMLElement[]) {
   return unionVisualRects(measureSceneCharacterRects(nodes))
 }
+
+/** Reuse immutable ink rectangles only inside one synchronous measurement
+ * pass. A new pass must use a new batch after any layout/font/projection edit. */
+export function createSceneCharacterRectBatch(measure: (nodes: readonly HTMLElement[]) => VisualRect[]) {
+  const measured = new Map<HTMLElement, VisualRect[]>()
+  return (nodes: readonly HTMLElement[]) => nodes.flatMap(root => {
+    let rects = measured.get(root)
+    if (!rects) { rects = measure([root]); measured.set(root, rects) }
+    return rects
+  })
+}

```

## Notion正文回读

https://app.notion.com/p/400b138d1e11816d94bce073c232efa2 已创建为原Codex留言板原生子页并回读，含实际代码diff、7745385、三项轻量数据、14项墙格红色失败及未施工的局部锚定方案。4179冻结给专项QA，不是发布合格构建。
