# 固定28世界墙字格距补修（独立4177候选）

基线090654110a9f0ca6629367bcbc29b61ffbdf3d31；4174冻结0b82a2a应用资源、公共4173冻结cea7f14，均未覆盖。无push、无Vercel、未操作真实存档。

## 为什么前一轮没有统一

普通字14与整幅世界等比投影已经统一，但旧直墙生成器仍保留端点等分。sceneBoundaryGrid.ts的boundaryGridCoordinates先round计算格数，再用(end-start)/intervalCount摊开；fixedBoundaryGridCoordinates也用(end-start)/(count-1)。mainlineScenes.compileMainlineFrameUnits传入reference28之后，旧函数再次拟合，所以参考字号固定不能自动修正墙的字符中心距。

修改前canonical直墙实测（参考1920×1080像素）：
- 大院jijia-ancestral-home及内堂jijia-ancestral-interior：X27.86–27.88，Y27.65。
- 窄道zhongshuyuan-passage：X28.19–28.20，Y本身28，部分跨门相邻样本为56。
- 办公室zhongshuyuan-office：X27.97–28.17，Y27.90–28.35，多框分别拟合。
- 兼容独立commercial-cafe直墙：X27.92–27.94，Y28.14–28.16；曲面玻璃另由curveGeometryUnits按sampleCount26取点，不能把其单轴投影35.72当直墙单格。
- 商业街及矿区：已有固定cellCount/28参考跨度，约27.99–28.01是旧坐标三位小数的取整量级，保留已经验收的格坐标。

## 选用的最小修法

没有直接改等分函数：隔离试算显示，直接改成从端点每28放一格，会改变负责门/画像的cell索引；大院正门碰撞起点移动约23.8参考像素，旧Cafe入口/后门约24.8/26.1，办公室暗门约8.7。这条方案已弃用，没有写进产品。

采用mainlineWallGlyphGrid.fixedMainlineWallGlyphGrid：
1. mainlineScenes.compileMainlineGeometry依照frame配置识别没有显式固定cellCount的旧框，统一编译其普通墙字符；商业街/矿区固定格框原样保留。
2. 读取canonical连续实墙拥有的区间与保留的门/画像/特征区间，以世界原点的28参考格生成墙字符中心。使用ceil/floor选择范围内格点，不用范围长度除格数，不按viewport计算步长。
3. 门、画像与其保留区间不重排。端部不足一格时不再塞入压缩字符，仍由原有连续实墙矩形覆盖到端点；没有新开孔、无隐藏门、无导航范围变化。极短端帽保留glyph为空的canonical wall cell，它仍是原本的实墙，不成为门。
4. 新字符中心写在mainline几何单元的visual.cells中，Renderer、真实字形测量及FocusFrame读取这些实际世界坐标，不使用CSS拉伸。单位矩形、navigation metadata、passage及剧情物件保持完全相同。
5. 沿用普通字14、家具字符距16、世界缩放及相机，不改门位、房间范围、家具布局或剧情。

## 不变性与回归证据

修改前固定保存八个scene ID的SHA256摘要：每个物理unit去visual后的全部字段、所有非wall门/feature cell、scene.passages、walkBounds及objects。

mainlineFixedWallGlyphGrid.test.ts逐场景对照上述摘要，8/8全部一致，同时validateMainlineSceneGeometry通过；另8个字距用例验证直墙相邻中心28。不是只比较门数量或constant。

首批4文件40项通过；扩大7个实际存在文件94项通过，覆盖fixed-grid、navigationBarrier、shell/retail、storefrontPresentation、viewport和visualBounds。传入的mainlineSceneGeometry.test.ts在仓库不存在，因此不能把它算作已跑文件。Typecheck及Vite build通过，仅既有大chunk提示。新增fixture仅是这些摘要，不含用户存档。

## 实际浏览器归一化测量与截图

Chrome155.0.8059.85：1920×1080、1280×800、390×844，八scene ID共24次一次性context。Edge155.0.4283.62：大院与办公室三窗口，共6次。DSF1。

使用实际wall字getBoundingClientRect中心，除.scene-mainline-world实际宽/1920所得scale。大院、内堂、办公室X/Y：约27.984–28.016，中位28；暗道横墙同样中位28。商业街/矿区原坐标保留，约27.969–28.016，中位28（旧三位坐标和浏览器取整共同误差）。普通字computed font仍14px。不同viewport没有再次改变基础步长。

暗道可见竖边被门及端点省略分隔，浏览器没有相邻竖向单格可采，不能捏造Y单格实测；canonical剩余竖墙双格为56，横向126个单格归一化28。

原始数据：.tmp/qa-fixed-wall-28/browser-wall-pitches.json（30例）、all-scene-wall-pitches.json、各浏览器/场景截图。已查看1280大院/办公室、390内堂的端部和门旁截图；门旁原合法门及物件仍在原位置，没有把留白改成门。

## “旧场景”的准确用途

- 当前普通咖啡馆从commercial-street内street-cafe-entry门洞走进room，不切换commercial-cafe。正常Cafe性能与进出验收均必须用连续街道。
- commercial-cafe定义仍可通过显式?scene=commercial-cafe和有效旧存档进入：mainlineScenes.resolveMainlineSceneId允许已定义ID；CenterExperience初始route读取URL或loadPlayerSave.currentSceneId；playerSave.sanitizePlayerSave保留有效旧scene，没有把它迁到街内room。因此它是可达兼容定义，不是完全死代码；本报告对其直墙的兼容测试不算现役Cafe验收。
- yonghe-eatery已调用createMiningStreetShellBlueprint('yonghe-eatery')，与yonghe-mining-perimeter共用八店连续矿区生成器。这个旧ID仍被旧档/URL接受，但已不是旧独立小馆布局。
- 正常打车目的地来自mainlineMapLandmarksByWorld的commercial-street/yonghe-mining-perimeter；PhoneRideApp选region，不选POI；longDistanceTravelContract也只允许街道级目的地。保留旧ID是兼容当前可达存档/入口，不擅自删除。

## 候选与待验

独立地址：http://127.0.0.1:4177/，服务PID35044，目录.tmp/fixed-wall-28-dist。
JS index-aNkrS7Kw.js，827686 bytes，SHA256 C9DF8F5F9FA08BA139BE1372152E0EBF3160BF8495C5AE1711F38183A6F2ADE6。
CSS index-DqwytlUi.css，200263 bytes，SHA256 8037B3161155B4BD755F467A08FC895B2A38EBAA6A21E30C7F8CC89513EB913A。

等待独立QA确认端部收口、门前/墙后交互及跨场景实际路径。本轮物理数据逐项不变，不等于所有剧情已经走通。兼容旧Cafe曲面玻璃是非正交曲线，不将它混同直墙X/Y单格。

已收到4174正常路线近/远街起步351/370ms、门310ms和后续437ms长任务，前轮隔离深处存档的68ms不代表正常路线通过。本补修不含新的性能代码。已读取E:/NewTone-Preview/.tmp/qa-candidate-0b82a2a/perf-4174的JSON，hot为空、尚无该版本CPU profile；需与QA错开测量时段继续定位，不凭数字猜单一根因。4174保持冻结。

## 实际调用diff

```diff
diff --git a/src/center/runtime/mainlineScenes.ts b/src/center/runtime/mainlineScenes.ts
index aeeecc1..462d0af 100644
--- a/src/center/runtime/mainlineScenes.ts
+++ b/src/center/runtime/mainlineScenes.ts
@@ -1,3 +1,4 @@
+import { fixedMainlineWallGlyphGrid } from './mainlineWallGlyphGrid'
 import { mainlineWallThickness, type CollisionBox, type Point } from './sceneGeometry'
 import { mainlineSceneBlueprints } from './mainlineSceneModel'
 import { initialMainlineSceneId } from './mainlineInitialState'
@@ -837,7 +838,14 @@ function compileMainlineGeometry(
     navigation: { blocked: true },
   }))
   units.push(...curveGeometryUnits(curves))
-  return units
+  // Fixed-count retail frames already derive their extent from 28-unit
+  // cells. Other frames keep their authored doors/physical endpoints and
+  // receive fixed world glyph coordinates instead of fitted wall labels.
+  const fixedGlyphOwners = new Set(frameEdgeConfigs.filter(config => {
+    const orientation = config.edge === 'top' || config.edge === 'bottom' ? 'horizontal' : 'vertical'
+    return !config.structure.boundaryCoordinateCount?.[orientation]
+  }).map(config => config.structure.id))
+  return fixedMainlineWallGlyphGrid(units, fixedGlyphOwners)
 }

 function geometryCollisionForPassage(units: readonly MainlineSceneGeometryUnit[], passageId: string): CollisionBox {

```

## 新的墙字坐标函数完整实现

```ts
import type { MainlineSceneGeometryUnit, MainlineSceneVisualCell } from './mainlineScenes'
import { sceneDesignReferenceMetrics, sharedBoundaryScreenSpacingPx } from './sceneBoundaryGrid'

/** Fixed reference-grid glyphs inside existing solid boundary ranges. Door,
 * feature and collision ranges are immutable; endpoint remainder stays solid
 * and never becomes another opening or an extra compressed glyph. */
export function fixedMainlineWallGlyphGrid(units: readonly MainlineSceneGeometryUnit[], owners: ReadonlySet<string>): MainlineSceneGeometryUnit[] {
  const pitch = { x: sharedBoundaryScreenSpacingPx / sceneDesignReferenceMetrics.width * 100,
    y: sharedBoundaryScreenSpacingPx / sceneDesignReferenceMetrics.height * 100 }
  const seen = new Set<string>()
  return units.map(unit => {
    if (!owners.has(unit.ownerId) || !unit.edge || unit.geometryKind !== 'boundary' || unit.storefrontId) return unit
    const axis = unit.edge === 'top' || unit.edge === 'bottom' ? 'x' : 'y'
    const extent = axis === 'x' ? 'width' : 'height'
    const walls = unit.visual.cells.filter(c => c.kind === 'wall' && c.glyph)
    if (!walls.length) return unit
    const protectedCells = unit.visual.cells.filter(c => c.kind !== 'wall')
    // Keep old endpoint omissions and replacement flanks as reserved ranges.
    const ranges = walls.map(c => ({ start: Math.max(unit[axis],c.cellStart ?? c[axis]-pitch[axis]/2),
      end: Math.min(unit[axis]+unit[extent],c.cellEnd ?? c[axis]+pitch[axis]/2) }))
      .sort((a,b)=>a.start-b.start)
    const runs: {start:number;end:number}[]=[]
    for(const range of ranges){const last=runs.at(-1);if(last && range.start<=last.end+.00001)last.end=Math.max(last.end,range.end);else runs.push({...range})}
    const glyphs: MainlineSceneVisualCell[]=[]
    for(const run of runs){
      const first=Math.ceil((run.start-.000001)/pitch[axis]),last=Math.floor((run.end+.000001)/pitch[axis])
      for(let n=first;n<=last;n++){
        const coordinate=Number((n*pitch[axis]).toFixed(8))
        const point={x:axis==='x'?coordinate:walls[0]!.x,y:axis==='y'?coordinate:walls[0]!.y}
        if(protectedCells.some(c=>coordinate>=(c.cellStart??c[axis]-pitch[axis]/2)-.000001&&coordinate<=(c.cellEnd??c[axis]+pitch[axis]/2)+.000001))continue
        const key=`${unit.ownerId}:${point.x.toFixed(7)}:${point.y.toFixed(7)}`
        if(seen.has(key))continue
        seen.add(key)
        const nearest=walls.reduce((best,c)=>Math.abs(c[axis]-coordinate)<Math.abs(best[axis]-coordinate)?c:best,walls[0]!)
        glyphs.push({...nearest,id:`${unit.id}-fixed-wall-${n}`,...point,
          cellStart:Math.max(run.start,coordinate-pitch[axis]/2),cellEnd:Math.min(run.end,coordinate+pitch[axis]/2)})
      }
    }
    // A sub-cell solid end cap can legitimately have no character center.
    // Keep a non-painted canonical cell so it remains an explicit wall range.
    if(!glyphs.length && !protectedCells.length)glyphs.push({...walls[0]!,glyph:''})
    return {...unit,visual:{...unit.visual,cells:[...protectedCells,...glyphs]}}
  })
}

```
