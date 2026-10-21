# 固定墙格与极短尾格：556a45b / 4181候选，等待独立QA

Notion Codex板原生子页正文：https://app.notion.com/p/400b138d1e1181daa884f2a7e8afed70 。创建后回读已确认提交SHA、4181资源、111测试、12组尾格、实际diff与未测限制均存在；不是只写评论。

## 本轮结果和范围

作者已明确批准：必要墙尾可以短一格；极短余量造成挤字时，仅尾部最后两个间隔可以分摊。普通世界字14、墙直段中心距28、家具字距16不变；门位和房间边界不动，不把余量全墙均摊。

应用提交 `556a45bd99b17c719655040b1f684441f5a45013`，基于`88d17eaf56b76dd46872cb645a2318802395a8ef`。本地提交，无push。旧4180、性能4179、冻结4174和公网4173保持原包；新候选只在4181。未改main/staging/Vercel，也未做咖啡馆内装。真实存档未读写。

本轮自查通过，**仍需独立QA与作者整体验收，不得发布**。前轮11c06的全局格点/按unit裁字实现被本提交替换；旧4180单短格重叠截图与失败报告保留为历史，不能当当前结果。

## 实际代码：改前、改后、为什么

### mainlineWallGlyphGrid.ts / fixedMainlineWallGlyphGrid

改前：各碰撞unit内部按世界0的全局28格点选字。门旁unit有时以原墙字中心作为末端，裁剪与相位叠加后丢字，形成62–67像素门旁缺口。

改后：按完整owner/edge收集原有视觉墙段，跨物理unit排字。相邻的门组不移动：外侧门字中心±28确定最近墙字，再向远离门的墙尾延伸。无门段保持原视觉首尾锚点。墙字按生成坐标归属到真正包含它的既有unit，而非把字位置限制在原来那枚字所属的unit中。

非wall cell保持原值；门、画像、窗、开孔、权限与交互不新建、不移位。碰撞unit的全部物理字段保持原样。新视觉cell的cellStart/cellEnd只描述视觉字格，未拿它扩碰撞或改变门域。

普通余量：只保留一个短尾格。例如大院顶墙最后20，其余28；不把整条墙的28改成27.x。

极短余量：仅当尾格中心距小于普通字号14时，修改该尾部倒数一个内点，让末尾两个间隔相等。起点、终点和门旁28锚点不动，其余内点不动。办公室示例：原尾部255.20/283.20/284.16（28与0.96），改255.20/269.68/284.16（14.48与14.48）。从另一端门向外生长时，短尾在坐标序列前端，对应只分摊前两个间隔；仍是远离门的墙尾，不会把门邻距改短。

近零坐标舍入（低于0.02参考像素）按一个端点处理，避免0.005的重复中心；没有将正常格距差异当舍入吞掉。

### mainlineScenes.ts / compileMainlineGeometry

fixed-count排字豁免从owner改为owner+edge。一个结构某一轴未指定count，不再连带重排另一轴已固定count的边。这也避免了前轮矿区边框因owner级选择而被误改另一轴。

### 测试

- `mainlineFixedWallGlyphGrid.test.ts`：保留8场景physical/door/feature/passage/bounds/object摘要；每个run全量检查直段28，短间隔最多一个，或仅极短尾部两个相等间隔；两个短间隔之和必须小于42（28+余量<14）；中心距不低于14。没有24–32距离筛选。
- `mainlineWallVisualCoverage.test.ts`：保留原完整覆盖基线的全部最大间隙、门旁、端点、拐角上限；新增所有门组两侧28±0.04。没有放宽原覆盖上限。
- `mainlineWallLocalAnchors.test.ts`：6个独立反例，包括unit末端即墙字中心、两门固定锚点、近零舍入、同owner另一边豁免、0.96尾格只分摊末两段、从远端门反向延伸的尾格。

## 测试与构建

实际13个文件111项全部通过；`.tmp/wall-two-tail-related.json`。覆盖上述墙格、后墙门完整性、导航deferred topology/独立最短路oracle/动态查询复用、测框batch/字形边界/endpoint、viewport与初始状态。没有把不存在的文件计入覆盖。TypeScript --noEmit通过；Vite隔离构建通过，仅既有大chunk警告；git diff --check通过。

8个scene definition的物理unit、门/feature cells、passages、walkBounds和objects摘要仍逐项等于0906541基线。商业街534个geometry units的**完整visual数据**也与0906541原始输出逐项相同。此轮未触及9a6b117/7745385性能代码、出生与手机配对代码、门权限或NPC模拟。

模型全部门旁：大院正门/院门、内堂正门/暗门、办公室暗门精确28；暗道两门28.0044；商业街14后门27.9936–28.0128（源坐标舍入）。后墙11额外洞口清除、14合法后门锁门及普通墙语义回归保持；本轮未重复全部店的浏览器权限提示测试，不冒称新增全店浏览器验收。

## 浏览器自查与实际单位

Chrome155.0.8059.85、Edge155.0.4283.62，deviceScaleFactor=1。1920×1080/1280×800/390×844。Chrome8定义×3尺寸24例，Edge大院/办公室×3尺寸6例，共30。使用独立测试存档，未读取真实存档。`.tmp/qa-wall-two-tail/measurements.json`与30张截图。

表中是DOM字中心的实际像素距离除以`.scene-mainline-world`整体scale，单位为1920×1080设计参考像素，不是把CSS常量直接当测量。

| 场景 | 所测普通28直段的归一化实际范围 | 所测短尾格范围 |
| --- | --- | --- |
| 大院 | 27.984–28.016 | 20.000–24.828 |
| 内堂 | 27.984–28.016 | 23.766–26.594 |
| 兼容独立Cafe | 28.000–28.000 | 14.656–27.641 |
| 矿区外围 | 28.000–28.016 | 无新增短尾格 |
| yonghe兼容ID（同连续矿区） | 28.000–28.016 | 无新增短尾格 |
| 暗道 | 28.000–28.000 | 20.391–20.406 |
| 办公室 | 27.984–28.016 | 14.484–27.016 |

商业街固定count字格未生成新run ID，以上run脚本不把它算入新增28直段统计；已有字体/格距独立QA仍有效，本轮以全量visual完全相等和相关回归证明未更改。没有用兼容旧独立Cafe代替当前连续商业街Cafe验收。

另补8个桌面/手机近景：办公室左右下角、兼容Cafe左墙、大院右门；`.tmp/qa-wall-two-tail-focused/`。使用浏览器实际字体canvas ink宽/高与归一化中心距比较，办公室最小净隙0.484参考像素、兼容Cafe0.656、大院6.000，均为正。已查看办公室1920全图和390近景，原0.96/3.5重叠字已分离。此方法是字体ink bounding metrics加截图自查，不是逐像素截图分割。手机大院右门此存档点未让短尾对同时进入视口（visiblePairs=0），没有将其计为手机近景成功；其桌面近景、模型全部门邻与Chrome/Edge整体几何检查通过，仍交独立QA验证手机镜头到位后的门旁画面。

## 固定4181指纹

- 地址 `http://127.0.0.1:4181/`；PID26708；outDir `.tmp/wall-two-tail-dist`。
- 应用SHA `556a45bd99b17c719655040b1f684441f5a45013`。
- JS `index-CRQ9tLb0.js`，828796 bytes，SHA256 `2DF2D6144E238B62FE4A2887BD838FFFEDB2779FC27C960785667258DDFA59A6`。
- CSS `index-DqwytlUi.css`，200263 bytes，SHA256 `8037B3161155B4BD755F467A08FC895B2A38EBAA6A21E30C7F8CC89513EB913A`。
- 4181固定不再换包，等待独立QA。旧4180仍保持index-BQs70Z-f.js供对照。未push、未替换公网或其它预览。

## 未测与交付边界

此轮未重新做正常Cafe性能A/B；相关优化代码与全部物理/导航输入未改，父端已在固定4179独立测得60/53/61ms。不能把该专项通过扩写为当前版本所有性能或场景通过。未跑全部历史测试套件、未验证所有存档组合或所有世界外UI。

本轮自查结束后浏览器已关闭，独立QA可使用4181。整体验收前不发布。

补充精确核对父端列出的12组极短尾距：`.tmp/wall-two-tail-12-groups.json`逐组对比4180和4181，确认办公室8组、兼容旧Cafe2组、暗道2组全部覆盖，每段只移动一个尾部内点，字符数量不变。新两段均14.48–20.40，未动其它直段；全部端点与门字不动。

4181首页及上述JS/CSS已通过实际HTTP200核对，字节与SHA256逐项等于隔离构建文件。沙箱内初次HTTP连接因EACCES不可用，经批准的只读核验已成功，不存在待解决权限阻断。

## 应用提交实际diff（556a45b，5文件136 insertions/46 deletions）

```diff
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
index 712a034..aef724c 100644
--- a/src/center/runtime/mainlineWallGlyphGrid.ts
+++ b/src/center/runtime/mainlineWallGlyphGrid.ts
@@ -1,44 +1,77 @@
 import type { MainlineSceneGeometryUnit, MainlineSceneVisualCell } from './mainlineScenes'
-import { sceneDesignReferenceMetrics, sharedBoundaryScreenSpacingPx } from './sceneBoundaryGrid'
+import { mainlineWorldFontSizePx, sceneDesignReferenceMetrics, sharedBoundaryScreenSpacingPx } from './sceneBoundaryGrid'

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
+ * Only a tail interval may be shorter than the reference pitch. If that tail
+ * cannot fit an ordinary glyph, share its remainder with the preceding interval. */
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
+      // Never refit the full wall: only the final pair at the short tail moves.
+      // A 14px glyph needs at least 14 reference pixels between its centers.
+      // Door-neighbor anchors and both visual endpoints stay unchanged.
+      const minimumGlyphPitch = pitch * mainlineWorldFontSizePx / sharedBoundaryScreenSpacingPx
+      if (coordinates.length >= 3) {
+        if (coordinates[1]! - coordinates[0]! < minimumGlyphPitch) {
+          coordinates[1] = (coordinates[0]! + coordinates[2]!) / 2
+        } else {
+          const lastIndex = coordinates.length - 1
+          if (coordinates[lastIndex]! - coordinates[lastIndex - 1]! < minimumGlyphPitch) {
+            coordinates[lastIndex - 1] = (coordinates[lastIndex - 2]! + coordinates[lastIndex]!) / 2
+          }
+        }
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
index a112bbc..f11e9a5 100644
--- a/tests/mainlineFixedWallGlyphGrid.test.ts
+++ b/tests/mainlineFixedWallGlyphGrid.test.ts
@@ -15,14 +15,24 @@ describe('fixed wall glyph pitch with unchanged physical/story anchors',()=>{
   expect(digest(scene.objects)).toBe(saved.objects)
   expect(validateMainlineSceneGeometry(scene)).toEqual([])
  })
- it.each(Object.values(mainlineScenes))('$id uses 28 reference px between ordinary wall centers, without fitted remainder',scene=>{
+ it.each(Object.values(mainlineScenes))('$id keeps 28 reference px except its approved one- or two-interval tail',scene=>{
   const units=mainlineCanonicalSceneGeometryUnits(scene,metrics)
   const groups=new Map<string,number[]>()
   for(const u of units){if(u.geometryKind!=='boundary'||!u.edge)continue;const axis=u.edge==='top'||u.edge==='bottom'?'x':'y',other=axis==='x'?'y':'x',dimension=axis==='x'?1920:1080
-   for(const c of u.visual.cells){if(c.kind!=='wall'||!c.glyph)continue;const key=`${u.ownerId}:${axis}:${c[other].toFixed(6)}`;const values=groups.get(key)??[];values.push(c[axis]*dimension/100);groups.set(key,values)}
+   for(const c of u.visual.cells){if(c.kind!=='wall'||!c.glyph)continue;const run=c.id.match(/^(.*-anchored-wall-\d+)-\d+$/)?.[1];const key=run??`${u.ownerId}:${axis}:${c[other].toFixed(6)}`;const values=groups.get(key)??[];values.push(c[axis]*dimension/100);groups.set(key,values)}
   }
   let checked=0
-  for(const [key,values] of groups){const ordered=[...new Set(values)].sort((a,b)=>a-b);for(let i=1;i<ordered.length;i++){const gap=ordered[i]!-ordered[i-1]!;expect(Math.abs(gap-Math.round(gap/28)*28),`${key} gap=${gap}`).toBeLessThan(.04);checked++}}
+  for(const [key,values] of groups){const ordered=[...new Set(values)].sort((a,b)=>a-b);const short:{index:number;gap:number}[]=[];for(let i=1;i<ordered.length;i++){const gap=ordered[i]!-ordered[i-1]!;
+   if(key.includes('-anchored-wall-')){
+    expect(gap,`${key} gap=${gap}`).toBeLessThanOrEqual(28.04)
+    expect(gap,`${key} glyphs must not squeeze below their 14px base size`).toBeGreaterThanOrEqual(13.99)
+    if(gap<27.96)short.push({index:i,gap})
+   }else expect(Math.abs(gap-Math.round(gap/28)*28),`${key} gap=${gap}`).toBeLessThan(.04)
+   checked++}
+   expect(short.length,`${key} must not distribute remainder through the run`).toBeLessThanOrEqual(2)
+   if(short.length===1)expect(short[0]!.index===1||short[0]!.index===ordered.length-1,`${key} single cap stays at a tail`).toBe(true)
+   if(short.length===2){const[a,b]=short;expect((a!.index===1&&b!.index===2)||(a!.index===ordered.length-2&&b!.index===ordered.length-1),`${key} only the final two intervals may share`).toBe(true);expect(Math.abs(a!.gap-b!.gap),`${key} shares the short remainder equally`).toBeLessThan(.04);expect(a!.gap+b!.gap,`${key} only an extreme remainder below 14 can activate two intervals`).toBeLessThan(42.04)}
+  }
   expect(checked).toBeGreaterThan(10)
  })
 })
diff --git a/tests/mainlineWallLocalAnchors.test.ts b/tests/mainlineWallLocalAnchors.test.ts
new file mode 100644
index 0000000..25150dd
--- /dev/null
+++ b/tests/mainlineWallLocalAnchors.test.ts
@@ -0,0 +1,40 @@
+import {describe,expect,it} from 'vitest'
+import {fixedMainlineWallGlyphGrid} from '../src/center/runtime/mainlineWallGlyphGrid'
+import type {MainlineSceneGeometryUnit,MainlineSceneVisualCell} from '../src/center/runtime/mainlineScenes'
+
+const px=(n:number)=>n/19.2
+const cell=(x:number,kind:MainlineSceneVisualCell['kind']='wall'):MainlineSceneVisualCell=>({id:`${kind}-${x}`,x:px(x),y:0,kind,glyph:kind==='door'?'门':'墙'})
+const unit=(id:string,start:number,end:number,cells:MainlineSceneVisualCell[]):MainlineSceneGeometryUnit=>({id,ownerId:'frame',edge:'top',geometryKind:'boundary',surface:'wall',x:px(start),y:-.7,width:px(end-start),height:1.4,visual:{kind:'wall',cells},navigation:{blocked:true}})
+const centers=(units:MainlineSceneGeometryUnit[])=>units.flatMap(u=>u.visual.cells.filter(c=>c.kind==='wall').map(c=>Math.round(c.x*19.2*1e6)/1e6)).sort((a,b)=>a-b)
+describe('local door anchors and approved short wall tail',()=>{
+ it('keeps an endpoint glyph whose original collision unit ended at its center',()=>{
+  const source=[unit('left',0,80,[cell(0),cell(27),cell(54),cell(80)]),unit('door',80,120,[cell(100,'door')]),unit('right',120,200,[cell(120),cell(147),cell(174),cell(200)])]
+  const result=fixedMainlineWallGlyphGrid(source,new Set(['frame:top']))
+  expect(centers(result)).toEqual([0,16,44,72,128,156,184,200])
+  expect(result.flatMap(u=>u.visual.cells.filter(c=>c.kind==='door'))).toEqual([cell(100,'door')])
+  expect(result.map(({visual,...rest})=>rest)).toEqual(source.map(({visual,...rest})=>rest))
+ })
+ it('keeps exact 28 door neighbors at both ends, puts only one remainder at the wall tail',()=>{
+  const source=[unit('all',0,160,[cell(0,'door'),cell(27),cell(54),cell(80),cell(107),cell(134),cell(160,'door')])]
+  expect(centers(fixedMainlineWallGlyphGrid(source,new Set(['frame:top'])))).toEqual([28,56,84,112,132])
+ })
+ it('does not put almost coincident endpoint glyphs in a rounded 28-pitch run',()=>{
+  const source=[unit('rounded',0,84.005,[cell(0),cell(28),cell(56),cell(84.005)])]
+  expect(centers(fixedMainlineWallGlyphGrid(source,new Set(['frame:top'])))).toEqual([0,28,56,84.005])
+ })
+ it('leaves explicitly fixed-count edges of the same owner untouched',()=>{
+  const source=[unit('same-owner-fixed-edge',0,80,[cell(0),cell(40),cell(80)])]
+  expect(fixedMainlineWallGlyphGrid(source,new Set(['frame:left']))).toEqual(source)
+ })
+ it('shares only an extreme 0.96px end remainder over the final two intervals',()=>{
+  const source=[unit('office-tail',115.2,284.16,Array.from({length:7},(_,i)=>cell(115.2+i*28)).concat(cell(284.16)))]
+  expect(centers(fixedMainlineWallGlyphGrid(source,new Set(['frame:top'])))).toEqual([115.2,143.2,171.2,199.2,227.2,255.2,269.68,284.16])
+ })
+ it('shares the leading tail when growing away from a fixed far door',()=>{
+  const source=[unit('far-door',0,130,[cell(0),cell(25),cell(50),cell(75),cell(102),cell(130,'door')])]
+  // Door neighbor102 remains fixed; the near tail18 is already wide enough.
+  expect(centers(fixedMainlineWallGlyphGrid(source,new Set(['frame:top'])))).toEqual([0,18,46,74,102])
+  const tiny=[unit('far-door',0,116,[cell(0),cell(22),cell(44),cell(66),cell(88),cell(116,'door')])]
+  expect(centers(fixedMainlineWallGlyphGrid(tiny,new Set(['frame:top'])))).toEqual([0,16,32,60,88])
+ })
+})
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
