# 普通世界字16与8处必要三段收口：0d1106f / 固定4183待独立QA

## 范围与已发布手机单项

作者先批准普通字14→16试作，随后明确批准仅8处极短墙尾借用再前一段，末三段分摊。正常墙距28、家具字格16、1920×1080基准与单次等比投影、房间边界与门位保持；问号38特例、世界外UI、内装及剧情不改。

本组合应用提交 `0d1106f091715ff0b3cfc8a01e99336a0a3ddc4d`，包含此前手机修复8220392。手机单项独立QA通过后已于04:08:53 UTC从冻结4182发布原4173/QuickTunnel，**公开仍为14号字**；全部8文件本地/公网HTTP200、字节和SHA匹配，新档与隔离旧档烟测通过、556a45b回滚保留。此处16号字组合4183未发布，等待父端独立QA结果，不再次询问同轮发布授权。

## 文件与实际函数变化

- `sceneBoundaryGrid.ts / mainlineWorldFontSizePx`：普通世界文字基准14→16。墙步长28、家具glyph步长16、reference/default screen metrics没有改。
- `scene.css`：仅将`var(--scene-mainline-object-font-size, 14px)`的世界范围fallback改16，避免无inline变量时回退14；没有改world外UI的clamp/vw或字号，也没改问号38px。家具字格16不等于家具字号另放大一次。
- `mainlineWallGlyphGrid.ts / fixedMainlineWallGlyphGrid`：保留整条edge局部锚定、合法门字两侧28、首尾端点及物理归属。普通尾格照旧；短尾先试两段，只有两段平均距小于16，才多借一个28间隔，局部三段均分。不全墙摊余数，不移动门或外框，不删除字。
- 从坐标反向排字时，尾部在有序数组前端，因此只改前两个内部点；仍是远离门的尾部，不是移动门旁锚点。

示例：办公室原尾部最后三段合计56.96，改为三段18.9866667；两端位置和字符数量不变，只有两个尾部内点移动。

## 严格限制到批准的8处

`font16-approved-wall-tails.json`保存556a45b/14字的全部58条局部run：8条获准的完整坐标，另外50条的坐标摘要。`font16ApprovedWallTails.test.ts`验证：仅这8条改变，字符数量和两个端点不变、恰好两个尾部内点移动、只有末三段均分；另外50条逐点摘要相同。不是只把允许数量放宽到3后宣称范围正确。

8条包括兼容旧Cafe左墙2条、办公室floor frame右墙2条/底墙1条/左墙3条；暗道原12.8余量在末两段各20.4，16字下已足够，不扩大到三段。新三段最小距离18.9867，最大19.9500，所有其它直段28。

`mainlineFixedWallGlyphGrid.test.ts`同时全量检查普通段28、字中心不低于16、局部尾段最多3且相邻并等分；两段总长<44，三段总长<60，不能把任意大范围重排冒充尾段。原完整视觉覆盖、门旁28、端点/拐角、物理/door/feature/passages/bounds/story objects摘要检查继续保留，不使用24–32距离筛选。

## 测试与构建

实际15文件128项通过，包括字体、8处范围约束、全场景完整墙覆盖与门邻、后墙门语义、手机旧档/初始状态/存档、导航mesh复用/最短路、focus frame与endpoint/视觉边界。typecheck和隔离Vite build通过（仅既有大chunk提示）；源码提交后另出目录重建，8个文件与冻结4183逐字节一致。未跑全部历史套件；已知旧独立Cafe坐姿ETA基线失败见手机报告，本轮未修该路径或改断言。

## 浏览器实际字形与格距

Chrome155.0.8059.85、Edge155.0.4283.62，DSF1；1920×1080、1280×800、390×844。Chrome全部8定义×3尺寸24例，Edge大院/办公室×3尺寸6例，共30。普通墙字computed font均16px，几何距离除整体worldScale后，普通直段约27.984–28.016参考像素。没有按设备单独改字号或二次scaleX。

另8个近景覆盖办公室左右下角、兼容Cafe左墙、大院右门桌面/手机。字体canvas实际ink指标与归一化中心距相减：办公室最小净隙约2.000，兼容Cafe3.094，大院4.000参考像素。已实际查看办公室1920全图和手机近景，没有原先尾字叠印。不是仅用DOM line box判断；也不是逐像素图像分割。手机大院右门短尾对没有同时进视口（visiblePairs=0），不把该局部当成功，仍交独立QA到位验证。

原始证据 `.tmp/qa-font16-wall/measurements.json`及30张截图、`.tmp/qa-font16-ink/ink-clearance.json`及8张近景；单位是1920×1080设计参考像素，实际屏幕像素须乘worldScale。

## 框自查

1280×800和390×844，果茶店正常进出，另桌面→手机→桌面resize。店内门框visible，viewBox20×22；稳定截图闭合，world gap/line width仍按同一投影。返街后门框和招牌框均collapsed/hidden，观察返回过程及最终截图无持续残线。证据`.tmp/qa-font16-frames/front-frame-results.json`与截图；DOM path Z/dash=0仅作辅助，不代替截图。尚未逐一复测所有店框或所有操作序列。

## 固定候选指纹

Notion正文报告：https://app.notion.com/p/400b138d1e1181a09ff7d5b75e7cd37e 。创建后已fetch回读，核对应用SHA、JS/CSS、180.1ms限制及实际source diff；并非评论。4183 HTML/JS/CSS全部HTTP200且与冻结构建逐字节相同，证据`.tmp/font16-http-verification.json`。

- 地址 http://127.0.0.1:4183/ ，PID41576，outDir `.tmp/phone-font16-final-dist`。
- 应用SHA `0d1106f091715ff0b3cfc8a01e99336a0a3ddc4d`。
- JS `index-BodlhUbF.js`，829209 bytes，SHA256 `E5BAD0ED1D7CD565FB5912149F41BEA606C6CE1E03F9FC0AE8F6771D10A3DAFD`。
- CSS `index-5Xvf2Gob.css`，200263 bytes，SHA256 `08FFFCC91E6EFEFC78A08427247768470D9B09962F1E025ADEFAC53F1CCC20C9`。
- 4182手机单项保持冻结、已发布的手机构建不因本源码提交而换包。没有push/main/staging/Vercel操作或真实存档修改。

## 性能复查

串行完成同机、Chrome155、1280×800、DSF1、正常走街进Cafe深处再点击近街/远街/正门的14字4182和16字4183对照。未启用CPU sampling。原始数据目录`.tmp/font16-perf-4182/`、`.tmp/font16-perf-4183/`。

| 操作 | 14字起步ms | 16字起步ms | 14字最大帧间隔ms | 16字最大帧间隔ms |
| --- | --- | --- | --- | --- |
| 近街 | 62.6 | 51.4 | 79.5 | 180.1 |
| 远街 | 51.6 | 49.2 | 40.3 | 40.0 |
| 正门 | 48.5 | 42.9 | 39.9 | 29.9 |

六轮LongTask数组与页面错误均为空；16字近街仍有180.1ms帧间隔，不能把“无长任务”说成无卡帧。每操作每版本只有一轮，不能当作重复统计或真实手机性能验收；不使用工具响应耗时当FPS。

所有起点x=140.234，14字三次y=-27.4952/-27.6203/-27.4950，16字y=-24.0556/-27.8701/-27.6201。正常走动未注入位置，深处目标受实际路线/动态占用影响，只有16字近街到达原设目标（reached=true），其余均未到达该精确目标但确在Cafe深处。因此这是同操作的真实样本，不能伪称完全相同起点的严格A/B。原始JSON保留坐标、reached、帧时间、输入和首个位置变化。独立QA仍需复验；本候选未发布。

## Actual source and scope regression diff

```diff
diff --git a/src/center/runtime/mainlineWallGlyphGrid.ts b/src/center/runtime/mainlineWallGlyphGrid.ts
index aef724c..42a10c3 100644
--- a/src/center/runtime/mainlineWallGlyphGrid.ts
+++ b/src/center/runtime/mainlineWallGlyphGrid.ts
@@ -4,7 +4,8 @@ import { mainlineWorldFontSizePx, sceneDesignReferenceMetrics, sharedBoundaryScr
 /** Lay out each complete visual wall run, never clip glyphs by collision-unit
  * endpoints. Doors/features and physical geometry retain their authored values.
  * Only a tail interval may be shorter than the reference pitch. If that tail
- * cannot fit an ordinary glyph, share its remainder with the preceding interval. */
+ * cannot fit an ordinary glyph, share its remainder within the approved local
+ * tail (at most three intervals at the 16px trial size). */
 export function fixedMainlineWallGlyphGrid(units: readonly MainlineSceneGeometryUnit[], edges: ReadonlySet<string>): MainlineSceneGeometryUnit[] {
   const replacements = new Map<MainlineSceneGeometryUnit, MainlineSceneVisualCell[]>()
   for (const edge of edges) {
@@ -49,17 +50,23 @@ export function fixedMainlineWallGlyphGrid(units: readonly MainlineSceneGeometry
       for (let i = coordinates.length - 1; i > 0; i--) {
         if (coordinates[i]! - coordinates[i - 1]! < tolerance) coordinates.splice(i - 1, 1)
       }
-      // Never refit the full wall: only the final pair at the short tail moves.
-      // A 14px glyph needs at least 14 reference pixels between its centers.
+      // Never refit the full wall. Keep the approved two-interval tail unless
+      // it cannot fit the current glyph size: only then borrow one more 28px
+      // interval (the eight explicitly reviewed runs at the 16px trial size).
       // Door-neighbor anchors and both visual endpoints stay unchanged.
       const minimumGlyphPitch = pitch * mainlineWorldFontSizePx / sharedBoundaryScreenSpacingPx
       if (coordinates.length >= 3) {
         if (coordinates[1]! - coordinates[0]! < minimumGlyphPitch) {
-          coordinates[1] = (coordinates[0]! + coordinates[2]!) / 2
+          const count = (coordinates[2]! - coordinates[0]!) / 2 < minimumGlyphPitch ? 3 : 2
+          if (coordinates.length <= count) throw new Error(`Insufficient wall tail for readable glyphs: ${edge}`)
+          for (let i = 1; i < count; i++) coordinates[i] = coordinates[0]! + (coordinates[count]! - coordinates[0]!) * i / count
         } else {
           const lastIndex = coordinates.length - 1
           if (coordinates[lastIndex]! - coordinates[lastIndex - 1]! < minimumGlyphPitch) {
-            coordinates[lastIndex - 1] = (coordinates[lastIndex - 2]! + coordinates[lastIndex]!) / 2
+            const count = (coordinates[lastIndex]! - coordinates[lastIndex - 2]!) / 2 < minimumGlyphPitch ? 3 : 2
+            if (coordinates.length <= count) throw new Error(`Insufficient wall tail for readable glyphs: ${edge}`)
+            const startIndex = lastIndex - count
+            for (let i = 1; i < count; i++) coordinates[startIndex + i] = coordinates[startIndex]! + (coordinates[lastIndex]! - coordinates[startIndex]!) * i / count
           }
         }
       }
diff --git a/src/center/runtime/scene.css b/src/center/runtime/scene.css
index 9c59475..11bc370 100644
--- a/src/center/runtime/scene.css
+++ b/src/center/runtime/scene.css
@@ -692,7 +692,7 @@
   .scene-mainline-world { animation: none; }
 }
 .scene-mainline-wall-labels { inset: 0; z-index: 1; }
-.scene-mainline-wall { color: var(--soft); font-size: var(--scene-mainline-object-font-size, 14px); line-height: 1; }
+.scene-mainline-wall { color: var(--soft); font-size: var(--scene-mainline-object-font-size, 16px); line-height: 1; }
 .scene-mainline-wall-door {
   display: inline-flex;
   align-items: center;
@@ -745,7 +745,7 @@
 }
 .scene-mainline-wall-feature {
   color: var(--soft);
-  font-size: var(--scene-mainline-object-font-size, 14px);
+  font-size: var(--scene-mainline-object-font-size, 16px);
   letter-spacing: normal;
   white-space: nowrap;
 }
@@ -773,7 +773,7 @@
 .scene-mainline-storefront-cell {
   z-index: 3;
   color: var(--soft);
-  font-size: var(--scene-mainline-object-font-size, 14px);
+  font-size: var(--scene-mainline-object-font-size, 16px);
   line-height: 1;
   white-space: nowrap;
   pointer-events: none;
@@ -820,13 +820,13 @@
   transition: color 120ms ease-out, visibility 0s linear 140ms;
 }
 .scene-mainline-storefront--vertical.scene-mainline-storefront--sign .scene-mainline-storefront__label-track {
-  font-size: var(--scene-mainline-object-font-size, 14px);
+  font-size: var(--scene-mainline-object-font-size, 16px);
 }
 .scene-mainline-storefront__label-track {
   display: block;
   width: max-content;
   max-width: 100%;
-  font-size: var(--scene-mainline-object-font-size, 14px);
+  font-size: var(--scene-mainline-object-font-size, 16px);
   white-space: nowrap;
   will-change: transform;
   transform: translate3d(0, 0, 0);
@@ -885,7 +885,7 @@
   z-index: 5;
   transform: translate(-50%, -50%);
   color: var(--ink);
-  font-size: var(--scene-mainline-object-font-size, 14px);
+  font-size: var(--scene-mainline-object-font-size, 16px);
   line-height: 1;
   white-space: nowrap;
 }
@@ -902,19 +902,19 @@
 }
 .scene-mainline-npc:focus-visible { outline: 1px solid var(--active); outline-offset: 4px; }
 .scene-mainline-npc--ambient { pointer-events: none; cursor: default; }
-.scene-mainline-object--door { color: var(--active); font-size: var(--scene-mainline-object-font-size, 14px); }
+.scene-mainline-object--door { color: var(--active); font-size: var(--scene-mainline-object-font-size, 16px); }
 .scene-mainline-object--landmark,
-.scene-mainline-object--direction { color: var(--soft); font-size: var(--scene-mainline-object-font-size, 14px); }
+.scene-mainline-object--direction { color: var(--soft); font-size: var(--scene-mainline-object-font-size, 16px); }
 .scene-mainline-yard-tree-ring { color: var(--soft); opacity: .78; }
 .scene-mainline-yard-tree-ring.is-under-player { opacity: .28; }
-.scene-mainline-object--fixture { color: var(--ink); font-size: var(--scene-mainline-object-font-size, 14px); letter-spacing: 0; }
+.scene-mainline-object--fixture { color: var(--ink); font-size: var(--scene-mainline-object-font-size, 16px); letter-spacing: 0; }
 .scene-mainline-object--table,
 .scene-mainline-object--seat {
   color: var(--soft);
   min-width: 0;
   min-height: 0;
   padding: 0;
-  font-size: var(--scene-mainline-object-font-size, 14px);
+  font-size: var(--scene-mainline-object-font-size, 16px);
   line-height: 1;
 }
 .scene-mainline-exploration--breathing > .scene-mainline-object__label {
@@ -955,7 +955,7 @@
 [data-mainline-scene="commercial-cafe"] .scene-mainline-object--fixture,
 [data-mainline-scene="commercial-cafe"] .scene-mainline-object--table,
 [data-mainline-scene="commercial-cafe"] .scene-mainline-object--seat {
-  font-size: var(--scene-mainline-object-font-size, 14px);
+  font-size: var(--scene-mainline-object-font-size, 16px);
 }
 .scene-mainline-object--table.scene-mainline-object--facing-east > span,
 .scene-mainline-object--table.scene-mainline-object--facing-west > span,
@@ -1325,14 +1325,14 @@
     width: max-content;
     max-width: calc(100% - 8px);
     padding: 0;
-    font-size: var(--scene-mainline-object-font-size, 14px);
+    font-size: var(--scene-mainline-object-font-size, 16px);
     letter-spacing: 0;
   }
   .scene-mainline-wall,
   [data-mainline-scene="commercial-cafe"] .scene-mainline-object--fixture,
   [data-mainline-scene="commercial-cafe"] .scene-mainline-object--table,
   [data-mainline-scene="commercial-cafe"] .scene-mainline-object--seat {
-    font-size: var(--scene-mainline-object-font-size, 14px);
+    font-size: var(--scene-mainline-object-font-size, 16px);
   }
   .scene-mainline-text { max-width: calc(100% - 24px); max-height: 38%; padding: 2px 0; }
   .scene-mainline-text, .scene-mainline-speaker-anchor { font-size: 12px; line-height: 1.5; }
@@ -1347,12 +1347,12 @@
   .scene-shell__state { min-width: 70px; padding-left: 8px; font-size: 9px; }
   .scene-shell__state strong { font-size: 12px; }
   .scene-stage { height: clamp(300px, calc(100svh - 100px), 560px); min-height: 300px; }
-  .scene-mainline-object { min-width: 0; min-height: 0; width: max-content; padding: 0; font-size: var(--scene-mainline-object-font-size, 14px); }
+  .scene-mainline-object { min-width: 0; min-height: 0; width: max-content; padding: 0; font-size: var(--scene-mainline-object-font-size, 16px); }
   .scene-mainline-wall,
   [data-mainline-scene="commercial-cafe"] .scene-mainline-object--fixture,
   [data-mainline-scene="commercial-cafe"] .scene-mainline-object--table,
   [data-mainline-scene="commercial-cafe"] .scene-mainline-object--seat {
-    font-size: var(--scene-mainline-object-font-size, 14px);
+    font-size: var(--scene-mainline-object-font-size, 16px);
   }
   .scene-spatial-glyph--door { min-width: 42px; }
   .scene-object--fixture,
@@ -1392,7 +1392,7 @@
 .scene-mainline-world .scene-actor__label,
 .scene-mainline-world .scene-table-text,
 .scene-mainline-world .scene-chair-text {
-  font-size: var(--scene-mainline-object-font-size, 14px);
+  font-size: var(--scene-mainline-object-font-size, 16px);
 }
 
 /* Adjacent letters inside furniture use the 16-unit center pitch: 14 type + 2 tracking. */
diff --git a/src/center/runtime/sceneBoundaryGrid.ts b/src/center/runtime/sceneBoundaryGrid.ts
index 8330b54..4e5b38a 100644
--- a/src/center/runtime/sceneBoundaryGrid.ts
+++ b/src/center/runtime/sceneBoundaryGrid.ts
@@ -23,7 +23,7 @@ export type SceneScreenMetrics = {
   viewportWidth?: number
 }
 
-export const mainlineWorldFontSizePx = 14
+export const mainlineWorldFontSizePx = 16
 export const sharedBoundaryScreenSpacingPx = 28
 export const sharedFurnitureGlyphSpacingPx = 16
 /** Logical scene authoring reference. Distances are CSS px at 1:1. */
diff --git a/tests/font16ApprovedWallTails.test.ts b/tests/font16ApprovedWallTails.test.ts
new file mode 100644
index 0000000..3f1ea0c
--- /dev/null
+++ b/tests/font16ApprovedWallTails.test.ts
@@ -0,0 +1,27 @@
+import {describe,it,expect} from 'vitest'
+import {readFileSync} from 'node:fs'
+import {createHash} from 'node:crypto'
+import {mainlineScenes,mainlineCanonicalSceneGeometryUnits} from '../src/center/runtime/mainlineScenes'
+const reference=JSON.parse(readFileSync('tests/fixtures/font16-approved-wall-tails.json','utf8')) as {approved:Record<string,number[]>;unchanged:Record<string,string>}
+const groups:Record<string,number[]>={}
+for(const scene of Object.values(mainlineScenes))for(const unit of mainlineCanonicalSceneGeometryUnits(scene,{width:1920,height:1080}))for(const cell of unit.visual.cells){
+ const run=cell.id.match(/^(.*-anchored-wall-\d+)-\d+$/)?.[1];if(!run)continue
+ const axis=unit.edge==='top'||unit.edge==='bottom'?'x':'y'
+ ;(groups[scene.id+'/'+run]??=[]).push(cell[axis]*(axis==='x'?19.2:10.8))
+}
+for(const[key,values]of Object.entries(groups))groups[key]=values.sort((a,b)=>a-b).map(n=>Number(n.toFixed(7)))
+describe('font16 changes only the eight individually approved wall tails',()=>{
+ it('keeps every unapproved run pixel-for-pixel unchanged',()=>{
+  expect(Object.keys(groups).sort()).toEqual([...Object.keys(reference.approved),...Object.keys(reference.unchanged)].sort())
+  for(const[key,hash]of Object.entries(reference.unchanged))expect(createHash('sha256').update(JSON.stringify(groups[key])).digest('hex'),key).toBe(hash)
+ })
+ it.each(Object.entries(reference.approved))('%s retains endpoints and count, moves only two tail interiors', (key,before)=>{
+  const now=groups[key]!,last=now.length-1;expect(now.length).toBe(before.length);expect(now[0]).toBe(before[0]);expect(now[last]).toBe(before[last])
+  const changed=now.flatMap((v,i)=>Math.abs(v-before[i]!)>.000001?[i]:[])
+  expect(changed.length).toBe(2)
+  expect(JSON.stringify(changed)===JSON.stringify([1,2])||JSON.stringify(changed)===JSON.stringify([last-2,last-1])).toBe(true)
+  const first=changed[0]===1?0:last-3,steps=Array.from({length:3},(_,i)=>now[first+i+1]!-now[first+i]!)
+  expect(Math.min(...steps)).toBeGreaterThanOrEqual(16);expect(Math.max(...steps)-Math.min(...steps)).toBeLessThan(.000001)
+  expect(steps.reduce((a,b)=>a+b,0)).toBeLessThan(60)
+ })
+})
```
