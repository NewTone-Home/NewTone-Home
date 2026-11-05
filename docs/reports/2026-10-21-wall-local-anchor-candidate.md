# 墙格局部锚定候选：门旁缺格已恢复，极短尾格出现字形重叠，未通过

这是旧4180的历史失败记录。作者随后批准极短尾格分摊最后两个间隔，当前应用候选已更新为556a45b / 4181，见同目录2026-10-21-wall-two-tail-candidate.md；旧4180仍保留对照。本文件不代表当前4181的结果。

## 授权与结论

作者已批准：普通字14、墙距28、家具字距16；门和房间边界不动；必要墙尾最后一格可以短于28。本轮据此恢复施工，没有扩大到咖啡馆内装。公网4173、冻结4174和性能专项4179未替换，无push。

当前应用差异基于88d17eaf56b76dd46872cb645a2318802395a8ef，尚未提交。4180隔离候选已固定，但**不能发布或标记整体合格**：模型已恢复门旁与端点覆盖；真实1920截图发现办公室等位置的极短尾格让两个墙字挤压重叠。没有用测试通过掩盖此失败。

## 实际代码差异与原因

- `mainlineWallGlyphGrid.ts / fixedMainlineWallGlyphGrid`：旧实现以世界0为统一相位，并把每个碰撞unit起止当成字中心可用范围；有些unit末端本来就是原墙字中心，导致裁掉门旁字。新候选跨unit按整条owner/edge收集原墙字连续段，不再按单unit裁字。
- 原门/画像/窗等非wall cells保持原值；门旁最近墙字从外侧门字中心±28锚定，再朝墙尾按28延伸，最后保留原视觉端点作为短收口。双端有门时两端门旁都28，尾部余数在最后一段。
- 新墙字按实际坐标归属到包含它的既有物理单元，不扩碰撞。原物理unit、门/feature cells、passages、walkBounds、objects的8场景摘要全部保持。
- `mainlineScenes.ts / compileMainlineGeometry`：选择器由owner改为owner+edge。某owner只有一轴没有fixed count时，不应把另一轴已有fixed count的格距也重排。
- `mainlineFixedWallGlyphGrid.test.ts`：对每个局部run检查直段28、至多一个位于首/尾的短格、无大间隙；不再用只适合全局严格28的断言否决作者已批准的尾格。固定count的原有边仍检查28整数倍。
- `mainlineWallVisualCoverage.test.ts`：保留0906541原完整视觉覆盖的所有最大间隙、全部门旁、端点、拐角上限，没有放宽或24–32距离筛选；新增全部门组两侧实际28断言。
- `mainlineWallLocalAnchors.test.ts`：补碰撞unit末端恰是墙字中心、双门固定锚点、近零舍入余数去重、同owner另一fixed edge不被改的4个独立用例。

## 验证结果与当前失败

墙格/完整覆盖/新局部锚定/后墙门/寻路与测框9个实际存在的文件77项通过；typecheck、隔离Vite build通过，只有既有大chunk警告。另补跑viewport/focus及出生存档相关文件，结果以原始JSON为准，不把不存在的文件参数计为覆盖。

全部门旁模型检查：大院正门/院门、内堂正门/暗门、办公室暗门两侧精确28；暗道门两侧28.0044；商业街14合法后门两侧27.9936–28.0128（原坐标小数舍入）。前轮62–67大缺口已消失。全部物理摘要不变；不代表视觉整体合格。

浏览器自查：Chrome155及Edge、1920×1080/1280×800/390×844，共30个场景/尺寸组合；Chrome含全部8定义，Edge代表大院/办公室。使用隔离测试存档，不碰真实存档。截图与原始测量 `.tmp/qa-wall-local-anchors/`。当前桌面办公室截图可直接看到极短尾格重叠，故本轮尚未交合格候选。

**精确冲突示例**：办公室底墙一段原端点为基准X=284.16，起点115.20。从115.20按28排到283.20，只余0.96，继续补284.16尾字会重叠。办公室侧墙同类余数3.50/3.85；兼容旧独立Cafe左墙3.1964/1.314。不是碰撞变化，也不是把wall28当font28。

只保留两个固定视觉端点、其余间隔全部28、且只允许最后一个短间隔时，这些数值是必然余数；不能同时保证字形不重叠。当前未擅自采用第二种例外。

供父端决定的最小建议：极短尾格时仅将尾部最后两段分摊成两个14–28的短间隔，前面全28，门旁仍28，门/物理边界不动。例如办公室该段最后三个中心由255.20/283.20/284.16改成255.20/269.68/284.16，两段14.48。**这是“最后两格短”，超出刚批准的仅最后一格短，尚未实施。** 也没有删字、移动门/房间、局部缩字来消除重叠。

## 隔离候选指纹（未通过，不可发布）

- 地址 `http://127.0.0.1:4180/`；PID37628；outDir `.tmp/wall-local-anchor-dist`。
- JS `index-BQs70Z-f.js`，828671 bytes，SHA256 `64487203F024C7D678D30CCC2FBA973E7E7EF6E48D8CC17F34B8EBEE051D79DF`。
- CSS `index-DqwytlUi.css`，200263 bytes，SHA256 `8037B3161155B4BD755F467A08FC895B2A38EBAA6A21E30C7F8CC89513EB913A`。
- 资源源于本报告所述88d17ea之上未提交差异；当前没有新的candidate commit SHA，不能冒称HEAD已包含改动。
- 已通过的9a6b117/7745385性能代码及出生规则保留。父端独立4179性能60/53/61ms仅所测路径通过，不等于本墙格候选通过。

## 原始证据

- `.tmp/wall-anchor-related.json`（9文件77/77）
- `.tmp/wall-anchor-retained.json`（补跑保留行为）
- `.tmp/wall-current-visual-coverage.json`（所有门旁、端点、拐角，无距离过滤）
- `.tmp/wall-anchored-units.json`（本候选全量canonical cells）
- `.tmp/qa-wall-local-anchors/chrome-1920-zhongshuyuan-office.png`（真实重叠）
- `.tmp/qa-wall-local-anchors/measurements.json`（原始DOM匹配数据；未匹配/被裁绘节点不能假称全边浏览器已测）

补跑实际4文件32/32：mainlineInitialState、mainlineViewport、sceneFocusFrameEndpointMeasure、SceneFocusFrames；不存在的playerSave.test.ts参数没有计为覆盖。合计13个实际文件109项通过。

## 本轮实际tracked diff（尚未提交，不能作为视觉通过证明）

```diff
warning: in the working copy of 'src/center/runtime/mainlineWallGlyphGrid.ts', LF will be replaced by CRLF the next time Git touches it
diff --git a/src/center/runtime/mainlineScenes.ts b/src/center/runtime/mainlineScenes.ts
index 462d0af..281b1ed 100644
--- a/src/center/runtime/mainlineScenes.ts
+++ b/src/center/runtime/mainlineScenes.ts
@@ -844,7 +844,7 @@ function compileMainlineGeometry(
   const fixedGlyphOwners = new Set(frameEdgeConfigs.filter(config => {
     const orientation = config.edge === 'top' || config.edge === 'bottom' ? 'horizontal' : 'vertical'
     return !config.structure.boundaryCoordinateCount?.[orientation]
-  }).map(config => config.structure.id))
+  }).map(config => `${config.structure.id}:${config.edge}`))
   return fixedMainlineWallGlyphGrid(units, fixedGlyphOwners)
 }

diff --git a/src/center/runtime/mainlineWallGlyphGrid.ts b/src/center/runtime/mainlineWallGlyphGrid.ts
index 712a034..f2e2b41 100644
--- a/src/center/runtime/mainlineWallGlyphGrid.ts
+++ b/src/center/runtime/mainlineWallGlyphGrid.ts
@@ -1,44 +1,62 @@
 import type { MainlineSceneGeometryUnit, MainlineSceneVisualCell } from './mainlineScenes'
 import { sceneDesignReferenceMetrics, sharedBoundaryScreenSpacingPx } from './sceneBoundaryGrid'

-/** Fixed reference-grid glyphs inside existing solid boundary ranges. Door,
- * feature and collision ranges are immutable; endpoint remainder stays solid
- * and never becomes another opening or an extra compressed glyph. */
-export function fixedMainlineWallGlyphGrid(units: readonly MainlineSceneGeometryUnit[], owners: ReadonlySet<string>): MainlineSceneGeometryUnit[] {
-  const pitch = { x: sharedBoundaryScreenSpacingPx / sceneDesignReferenceMetrics.width * 100,
-    y: sharedBoundaryScreenSpacingPx / sceneDesignReferenceMetrics.height * 100 }
-  const seen = new Set<string>()
-  return units.map(unit => {
-    if (!owners.has(unit.ownerId) || !unit.edge || unit.geometryKind !== 'boundary' || unit.storefrontId) return unit
-    const axis = unit.edge === 'top' || unit.edge === 'bottom' ? 'x' : 'y'
-    const extent = axis === 'x' ? 'width' : 'height'
-    const walls = unit.visual.cells.filter(c => c.kind === 'wall' && c.glyph)
-    if (!walls.length) return unit
-    const protectedCells = unit.visual.cells.filter(c => c.kind !== 'wall')
-    // Keep old endpoint omissions and replacement flanks as reserved ranges.
-    const ranges = walls.map(c => ({ start: Math.max(unit[axis],c.cellStart ?? c[axis]-pitch[axis]/2),
-      end: Math.min(unit[axis]+unit[extent],c.cellEnd ?? c[axis]+pitch[axis]/2) }))
-      .sort((a,b)=>a.start-b.start)
-    const runs: {start:number;end:number}[]=[]
-    for(const range of ranges){const last=runs.at(-1);if(last && range.start<=last.end+.00001)last.end=Math.max(last.end,range.end);else runs.push({...range})}
-    const glyphs: MainlineSceneVisualCell[]=[]
-    for(const run of runs){
-      const first=Math.ceil((run.start-.000001)/pitch[axis]),last=Math.floor((run.end+.000001)/pitch[axis])
-      for(let n=first;n<=last;n++){
-        const coordinate=Number((n*pitch[axis]).toFixed(8))
-        const point={x:axis==='x'?coordinate:walls[0]!.x,y:axis==='y'?coordinate:walls[0]!.y}
-        if(protectedCells.some(c=>coordinate>=(c.cellStart??c[axis]-pitch[axis]/2)-.000001&&coordinate<=(c.cellEnd??c[axis]+pitch[axis]/2)+.000001))continue
-        const key=`${unit.ownerId}:${point.x.toFixed(7)}:${point.y.toFixed(7)}`
-        if(seen.has(key))continue
-        seen.add(key)
-        const nearest=walls.reduce((best,c)=>Math.abs(c[axis]-coordinate)<Math.abs(best[axis]-coordinate)?c:best,walls[0]!)
-        glyphs.push({...nearest,id:`${unit.id}-fixed-wall-${n}`,...point,
-          cellStart:Math.max(run.start,coordinate-pitch[axis]/2),cellEnd:Math.min(run.end,coordinate+pitch[axis]/2)})
-      }
+/** Lay out each complete visual wall run, never clip glyphs by collision-unit
+ * endpoints. Doors/features and physical geometry retain their authored values.
+ * Only the last interval of a run may be shorter than the reference pitch. */
+export function fixedMainlineWallGlyphGrid(units: readonly MainlineSceneGeometryUnit[], edges: ReadonlySet<string>): MainlineSceneGeometryUnit[] {
+  const replacements = new Map<MainlineSceneGeometryUnit, MainlineSceneVisualCell[]>()
+  for (const edge of edges) {
+    const members = units.filter(u => `${u.ownerId}:${u.edge}` === edge && u.geometryKind === 'boundary' && !u.storefrontId)
+    if (!members.length) continue
+    const axis = members[0]!.edge === 'top' || members[0]!.edge === 'bottom' ? 'x' : 'y'
+    const pitch = sharedBoundaryScreenSpacingPx / (axis === 'x' ? sceneDesignReferenceMetrics.width : sceneDesignReferenceMetrics.height) * 100
+    const nodes = members.flatMap(unit => unit.visual.cells.filter(cell => cell.glyph).map(cell => ({ unit, cell })))
+      .sort((a, b) => a.cell[axis] - b.cell[axis])
+    const walls = nodes.filter(n => n.cell.kind === 'wall')
+    if (!walls.length) continue
+    for (const unit of members) replacements.set(unit, unit.visual.cells.filter(c => c.kind !== 'wall' || !c.glyph))
+    const runs: typeof walls[] = []
+    for (const wall of walls) {
+      const run = runs.at(-1), previous = run?.at(-1)
+      const separated = previous && (wall.cell[axis] - previous.cell[axis] > pitch * 1.6 || nodes.some(n => n.cell.kind !== 'wall' && n.cell[axis] > previous.cell[axis] && n.cell[axis] < wall.cell[axis]))
+      if (!run || separated) runs.push([wall]); else run.push(wall)
     }
-    // A sub-cell solid end cap can legitimately have no character center.
-    // Keep a non-painted canonical cell so it remains an explicit wall range.
-    if(!glyphs.length && !protectedCells.length)glyphs.push({...walls[0]!,glyph:''})
-    return {...unit,visual:{...unit.visual,cells:[...protectedCells,...glyphs]}}
-  })
+    runs.forEach((run, runIndex) => {
+      const first = run[0]!, last = run.at(-1)!
+      const before = nodes.filter(n => n.cell.kind !== 'wall' && n.cell[axis] < first.cell[axis]).at(-1)
+      const after = nodes.find(n => n.cell.kind !== 'wall' && n.cell[axis] > last.cell[axis])
+      const startsAtDoor = before?.cell.kind === 'door' && first.cell[axis] - before.cell[axis] < pitch * 1.6
+      const endsAtDoor = after?.cell.kind === 'door' && after.cell[axis] - last.cell[axis] < pitch * 1.6
+      const start = startsAtDoor ? before.cell[axis] + pitch : first.cell[axis]
+      const end = endsAtDoor ? after.cell[axis] - pitch : last.cell[axis]
+      if (end < start - .000001) throw new Error(`Wall run cannot fit between immutable anchors: ${edge}`)
+      const coordinates: number[] = []
+      // With a door at the far end, grow away from that door so its immediate
+      // neighbor stays exactly one pitch away; the short cap belongs at the tail.
+      if (endsAtDoor && !startsAtDoor) {
+        for (let p = end; p > start + .000001; p -= pitch) coordinates.push(p)
+        coordinates.push(start)
+        coordinates.reverse()
+      } else {
+        for (let p = start; p < end - .000001; p += pitch) coordinates.push(p)
+        coordinates.push(end)
+      }
+      // Authored coordinates were rounded to .001 percent. A near-zero
+      // rounding remainder is one endpoint, not two overlapping glyphs.
+      const tolerance = pitch * .02 / sharedBoundaryScreenSpacingPx
+      for (let i = coordinates.length - 1; i > 0; i--) {
+        if (coordinates[i]! - coordinates[i - 1]! < tolerance) coordinates.splice(i - 1, 1)
+      }
+      coordinates.forEach((coordinate, index) => {
+        const nearest = run.reduce((best, n) => Math.abs(n.cell[axis] - coordinate) < Math.abs(best.cell[axis] - coordinate) ? n : best, first)
+        const target = members.find(u => coordinate >= u[axis] - .001 && coordinate <= u[axis] + u[axis === 'x' ? 'width' : 'height'] + .001
+          && u.visual.cells.some(c => c.kind === 'wall'))
+        if (!target) throw new Error(`Wall glyph has no physical wall owner: ${edge} at ${coordinate}`)
+        replacements.get(target)!.push({ ...nearest.cell, id: `${edge}-anchored-wall-${runIndex}-${index}`,
+          [axis]: coordinate, cellStart: coordinate - pitch / 2, cellEnd: coordinate + pitch / 2 })
+      })
+    })
+  }
+  return units.map(unit => replacements.has(unit) ? { ...unit, visual: { ...unit.visual, cells: replacements.get(unit)! } } : unit)
 }
diff --git a/tests/mainlineFixedWallGlyphGrid.test.ts b/tests/mainlineFixedWallGlyphGrid.test.ts
index a112bbc..c4fa690 100644
--- a/tests/mainlineFixedWallGlyphGrid.test.ts
+++ b/tests/mainlineFixedWallGlyphGrid.test.ts
@@ -15,14 +15,20 @@ describe('fixed wall glyph pitch with unchanged physical/story anchors',()=>{
   expect(digest(scene.objects)).toBe(saved.objects)
   expect(validateMainlineSceneGeometry(scene)).toEqual([])
  })
- it.each(Object.values(mainlineScenes))('$id uses 28 reference px between ordinary wall centers, without fitted remainder',scene=>{
+ it.each(Object.values(mainlineScenes))('$id uses 28 reference px with at most one short interval at each wall-run tail',scene=>{
   const units=mainlineCanonicalSceneGeometryUnits(scene,metrics)
   const groups=new Map<string,number[]>()
   for(const u of units){if(u.geometryKind!=='boundary'||!u.edge)continue;const axis=u.edge==='top'||u.edge==='bottom'?'x':'y',other=axis==='x'?'y':'x',dimension=axis==='x'?1920:1080
-   for(const c of u.visual.cells){if(c.kind!=='wall'||!c.glyph)continue;const key=`${u.ownerId}:${axis}:${c[other].toFixed(6)}`;const values=groups.get(key)??[];values.push(c[axis]*dimension/100);groups.set(key,values)}
+   for(const c of u.visual.cells){if(c.kind!=='wall'||!c.glyph)continue;const run=c.id.match(/^(.*-anchored-wall-\d+)-\d+$/)?.[1];const key=run??`${u.ownerId}:${axis}:${c[other].toFixed(6)}`;const values=groups.get(key)??[];values.push(c[axis]*dimension/100);groups.set(key,values)}
   }
   let checked=0
-  for(const [key,values] of groups){const ordered=[...new Set(values)].sort((a,b)=>a-b);for(let i=1;i<ordered.length;i++){const gap=ordered[i]!-ordered[i-1]!;expect(Math.abs(gap-Math.round(gap/28)*28),`${key} gap=${gap}`).toBeLessThan(.04);checked++}}
+  for(const [key,values] of groups){const ordered=[...new Set(values)].sort((a,b)=>a-b);let short=0;for(let i=1;i<ordered.length;i++){const gap=ordered[i]!-ordered[i-1]!;
+   if(key.includes('-anchored-wall-')){
+    expect(gap,`${key} gap=${gap}`).toBeLessThanOrEqual(28.04)
+    expect(gap,`${key} duplicate glyph`).toBeGreaterThan(.019)
+    if(gap<27.96){short++;expect(i===1||i===ordered.length-1,`${key} short interval must be at a tail`).toBe(true)}
+   }else expect(Math.abs(gap-Math.round(gap/28)*28),`${key} gap=${gap}`).toBeLessThan(.04)
+   checked++}expect(short,`${key} must not distribute remainder through the run`).toBeLessThanOrEqual(1)}
   expect(checked).toBeGreaterThan(10)
  })
 })
diff --git a/tests/mainlineWallVisualCoverage.test.ts b/tests/mainlineWallVisualCoverage.test.ts
index b86266a..5e3f989 100644
--- a/tests/mainlineWallVisualCoverage.test.ts
+++ b/tests/mainlineWallVisualCoverage.test.ts
@@ -5,8 +5,8 @@ import {wallVisualCoverage,wallCornerCoverage} from './helpers/wallVisualCoverag
 const baseline=JSON.parse(readFileSync('tests/fixtures/wall-visual-coverage-0906541.json','utf8'))
 const measured=Object.fromEntries(Object.values(mainlineScenes).map(scene=>{const units=mainlineCanonicalSceneGeometryUnits(scene,{width:1920,height:1080});return[scene.id,{edges:wallVisualCoverage(scene,units),corners:wallCornerCoverage(scene,units)}]}))
 writeFileSync('.tmp/wall-current-visual-coverage.json',JSON.stringify(measured,null,2))
-// This intentionally fails against rejected11c06 until the anchored layout is
-// fixed. Do not relax the bounds or filter out large/small distances.
+// Keep the original full-coverage bounds after fixing rejected11c06. The
+// approved short tail is tested separately; no distance-band filtering here.
 describe('all door neighbors, complete edge gaps and corner coverage',()=>{
  it.each(Object.values(mainlineScenes))('$id retains complete door-adjacent and endpoint coverage',scene=>{
   const units=mainlineCanonicalSceneGeometryUnits(scene,{width:1920,height:1080}),actual=wallVisualCoverage(scene,units)
@@ -21,4 +21,11 @@ describe('all door neighbors, complete edge gaps and corner coverage',()=>{
   const units=mainlineCanonicalSceneGeometryUnits(scene,{width:1920,height:1080}),actual=wallCornerCoverage(scene,units)
   for(const before of baseline[scene.id].corners){const now=actual.find(e=>e.key===before.key);expect.soft(now,before.key).toBeDefined();if(!now)continue;before.distances.forEach((distance:number,index:number)=>expect.soft(now!.distances[index],`${before.key} corner${index}`).toBeLessThanOrEqual(distance+1))}
  })
+ it.each(Object.values(mainlineScenes))('$id has a wall exactly one reference pitch outside each door group',scene=>{
+  const edges=wallVisualCoverage(scene,mainlineCanonicalSceneGeometryUnits(scene,{width:1920,height:1080}))
+  for(const edge of edges)for(const[id,sides]of Object.entries(edge.doorNeighbors))for(const side of ['before','after']as const){
+   expect(sides[side],`${id} ${side} wall exists`).not.toBeNull()
+   expect(Math.abs(sides[side]!-28),`${id} ${side} reference pitch`).toBeLessThan(.04)
+  }
+ })
 })
```
