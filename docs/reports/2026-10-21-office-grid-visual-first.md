# 办公室统一格网：视觉第一版（功能未验收）

- 独立工作区：`E:\小说\NewTone-Workspace\preview-office-grid-pilot-20261021`；分支`preview/office-grid-pilot-20261021`。
- 基线418bb67；视觉应用提交`787b9d2efa889350e5f4256c28688becf3101daa`。不包含027f31面积缩放，原高度投影保持。公网已另发布027f31；本办公室未发布。
- 按作者最新优先级：先交真实渲染图，未等待迁移、寻路回归和独立QA。这里只确认页面能打开且图对应改动，不能使用真实存档或作为功能验收。

## 先看图片

同Chrome、1920×1080、DSF1、普通16字、实际world scale1。左旧右新；左右裁图各保持原始1:1，未重绘游戏画面。完整前后图另存。

- 对比图`office-left-before-after.png`：Library `libfile_1e5668a1b3f481918fe5607b887631d1`，file `file_00000000619881fd8ac9e46435aa336f`。
- 旧全图`before-418bb67-1920.png`：`libfile_e3149563edfc819191bbaa8fcfe8e933`。
- 新全图`after-office-grid-1920.png`：`libfile_5f8cb4ab2f54819186e1f54db007a629`。
- 本地截图和页面证据在`.tmp/office-visual-final/`；上传成功后已给三个原始本地文件写入返回的EA `user.library-file-version=0`。无公开分享链接。

## 实际变化与复用边界

办公室墙中心bbox1689.6×907.2→1792×924；四横隔间422.4→448；走廊237.6→252。统一原点仍115.2/86.4设计像素（world百分比6/8），所有墙/玻璃线在origin+n×28。保留16字号与家具内部16，附墙物件整组跟随；未新增家具或剧情，7个锁门及2个开放门权限保持原定义。

一次性可复用基础：`worldGrid.ts`提供格坐标/矩形及区域局部坐标转换；`sceneBoundaryGrid.ts/latticeBoundaryGridCoordinates`严格生成原点+整数步长，端点不在格上就报错，不做尾压或均分。结构只有显式声明`boundaryWorldGrid`才启用，其他场景未启用。

办公室配置：`officeGrid.ts`记录64×33格、16格宽隔间、9格高走廊及门列；`mainlineSceneModel.ts`将墙、角、玻璃、门窗占位与阈值改为该坐标。长廊对外开口用12.5～20.5的格边界，保留12/21行连接玻璃的四角。两个字的窗口占相邻格，整组中心允许半格，不能把组中心当作单字偏格。附墙桌椅保持整组内尺寸；暗门入口目标同步至同房间桌右侧空位（尚未验证路径）。

关键实际片段：
```ts
// 原先按墙段长度拟合/尾部再压缩：
const coordinates = edge.coordinateCount
  ? fixedBoundaryGridCoordinates(...)
  : boundaryGridCoordinates(...)
// 现在仅办公室显式启用：
const coordinates = edge.grid
  ? latticeBoundaryGridCoordinates(axisStart, axisStart + edge.length, edge.grid.origin, edge.grid.step)
  : edge.coordinateCount ? fixedBoundaryGridCoordinates(...) : boundaryGridCoordinates(...)
// 单一数据基准：
export const officeGrid = createWorldGrid({ x: 6, y: 8 })
export const officeGridFloor = officeGrid.box(0,0,64,33)
export const officeGridNorthRooms = [0,16,32,48].map(x=>officeGrid.box(x,0,16,12))
export const officeGridSouthRooms = [0,16,32,48].map(x=>officeGrid.box(x,21,16,12))
```

完整实际diff可读`git show 787b9d2`，5文件89 insertions/51 deletions，另保留`.tmp/office-visual-final/actual.diff`。

## 已做与明确未做

已做：typecheck；隔离Vite build（既有大chunk提示）；静态几何编译无报错；两版真实页面正常渲染、无pageErrors、computed font16、实际scale1；实际查看前后全图/对比图。不是AI生成或只凭模型画图。

未做：旧办公室档坐标迁移/锁门两侧安全落点、寻路/碰撞/过门/NPC路线回归、跨设备/完整剧情、独立QA。办公室本身无NPC实例，不新造NPC。当前旧存档不得直接拿来测试，不能称可发布。原有物理合同/锚点回归将因本次授权改尺寸而需按新方案更新，尚未把旧失败改测放过。

后续仍需逐场景配置门窗身份、附墙家具、房间边界与旧档归属；可复用格网生成，不代表其他场景零适配。作者认可视觉后再决定推广和最终集中回归，当前不估“一天/两天”总工期。旧独立Cafe清理及两店内装未实施。

## 对应隔离入口与指纹

只供内部视觉检查： http://127.0.0.1:4189/?scene=zhongshuyuan-office ，PID47316，冻结`.tmp/office-grid-visual-final-dist`。
- JS `index-BSRBLcrH.js`，830444 bytes，SHA256 9675CF741AAF29A626745D942FDD091FB3C83504E861A609EBB7405383333952
- CSS `index-m5ImmQK_.css`，200261 bytes，SHA256 0F70720A4DE46FF622E649547CBA2101289D5BADFBB8117674925D5C1A4D6A41
- HTML/JS/CSS HTTP200、与冻结构建字节相同。没有push/main/staging/Vercel、没有改真实存档或其他场景布局。自有截图浏览器已关闭。

