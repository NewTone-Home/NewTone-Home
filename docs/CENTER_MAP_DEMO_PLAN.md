# Center 互动地图 Demo：产品、技术与施工 Plan

## 目标与判定

第一版只验证一件事：现有 NewTone Web 是否能用纯代码构建一张完整、顺滑、可扩展的伪 3D 线框地图。地图是 Center 的主体，不设置常驻左右栏，不复刻真实城市，不引入完整 3D 引擎。

成功标准：

- Desktop 可拖动、滚轮缩放、Hover Preview、Click Selection。
- Tablet/Mobile 可拖动、双指缩放、Tap Selection，并保留完整地图。
- 建筑、区域、路线、地标和 POI 都是带 ID 的独立实体，不是背景贴片。
- 信息层依附选中地点出现；关闭或展开信息不重置相机。
- 第一版保持 6–12 栋建筑、2–3 个区域、3–5 个以上真实交互节点。
- Pan/Zoom 期间不触发每帧 React Render，不重建 SVG Scene。

## 1. 推荐技术架构

现有 React 19 + Vite + Zustand 保持不变。Center 新增四个清晰边界：

1. `center/data`：实体和 World Feed 数据。
2. `center/geometry`：isometric 投影与 SVG path 生成。
3. `center/interaction`：与设备无关的状态机。
4. `center/camera`：Pan/Zoom 的命令式渲染边界。

视图层只负责组合地图、上下文 Panel、控制器和 News Ticker。全局应用只新增 `center` View 和 Landing 入口。

## 2. SVG 是否适合作为主方案

适合，而且是这个 Demo 的首选。

- 场景是数十到数百个矢量节点，不是数万粒子。
- 建筑需要独立 DOM/Pointer/Keyboard 语义。
- 任意缩放后必须保持清晰；关键线条使用 `vector-effect: non-scaling-stroke`。
- CSS 可直接处理描线、opacity、局部 glow 和状态反馈。
- Clip、Mask、Filter、Path Animation 均可按实体局部使用。

Demo 的硬控制线：目标少于约 200 个主要 SVG 图形节点；不在 Pan/Zoom 时重新生成 Scene；不在大范围节点上使用实时模糊 Filter。

## 3. 是否需要 Canvas / PixiJS / Three.js

第一版不需要。

- Canvas 会失去天然 DOM 命中、Keyboard 语义和 CSS 状态能力，并迫使项目自建命中测试。
- PixiJS 只有在实体数量和持续动态效果显著增加后才有价值。
- Three.js 会把伪 3D 表现误导成真正 3D 工程，引入相机、材质、光照和资产管线成本。

## 4. Scene Graph

```text
CenterExperience
├── Screen-space header / camera controls
├── SVG viewport
│   ├── defs (local filter / pattern)
│   ├── field
│   └── scene transform group (唯一相机变换节点)
│       ├── grid
│       ├── regions
│       ├── routes
│       ├── structures
│       └── points / landmarks
├── contextual connector
├── contextual information panel
└── World Feed ticker
```

Pan/Zoom 只修改 `scene transform group`。信息层和 Ticker 位于 Screen Space，不随地图缩放。

## 5. 数据模型

每个实体至少包含：

```js
{
  id,
  kind,          // region | route | building | point
  entityType,    // Region | Route | Building | Landmark | PointOfInterest
  interactive,
  name,
  status,
  unlocked,
  summary,
  details,
  geometry,
  links: {
    reader,
    news,
    missions,
    route,
  },
}
```

视觉几何和内容关联共享实体 ID。后续添加剧情、任务、Reader 内容或下一级页面，不改变 Scene Graph。

## 6. Interaction State Machine

```text
Idle
  └─ focus(entity) ──> Focus
Focus
  ├─ blur(entity) ───> Idle
  └─ select(entity) ─> Selected
Selected
  ├─ select(other) ──> Selected(other)
  ├─ open ───────────> Open
  └─ clear ──────────> Idle
Open
  ├─ close-open ─────> Selected
  └─ clear ──────────> Idle
```

动画不拥有状态，也不阻塞状态迁移。用户不必等待描线完成即可点击。

## 7. Desktop / Tablet / Mobile 输入映射

| 抽象行为 | Desktop | Tablet / Mobile |
| --- | --- | --- |
| Focus | Pointer Hover / Keyboard Focus | 首次 Tap 直接进入 Selected |
| Select | Click / Enter / Space | Tap |
| Open | Panel 内进一步操作 | Panel 内进一步操作 |
| Pan | Pointer Drag | One-finger Drag |
| Zoom | Wheel / Trackpad / Controls | Pinch / Controls |
| Clear | 点击地图空白 / Escape | 点击地图空白 / 关闭 Panel |

不模拟 Mobile Hover。三端共享实体、Reducer 和内容。

## 8. Responsive 信息 Panel

- Desktop：根据实体在屏幕中的位置，自动放到目标左侧或右侧，并限制在安全边界内；使用轻量连接线建立归属关系。
- Tablet：仍使用浮动 Panel，但缩小宽度并保留地图主体。
- Mobile：使用底部 Near-full-screen 信息层；Selected 为约半屏，Open 可扩大到接近全屏。
- Panel 开关只改变 Interaction State，不改变相机对象，因此关闭后地图位置和缩放保持不变。

## 9. News Ticker

Ticker 固定在底部，视觉权重低于地图和信息层。职责仅有：

- 提供持续运行的世界事件。
- 让新闻通过 `entityId` 关联地图实体。
- 点击新闻时选中相应实体。

Ticker 不承担文章阅读、分类导航或新闻网站功能。

## 10. Animation

- Hover：实体轻微上浮、局部面明度变化、trace path 渐进描线。
- Selected/Open：描线保持，允许非常局部的 2px blur glow。
- Panel：短距离淡入，不使用大幅弹跳。
- Point：低速轨道旋转；Ticker：线性低速滚动。
- `prefers-reduced-motion` 和项目 `motionMode` 均可关闭非必要运动。

## 11. 性能策略

- Panzoom 直接修改 Scene Group Transform，React 不接收每帧相机坐标。
- Panel Anchor 只通过 `requestAnimationFrame` 合并更新，并直接写定位样式。
- Interaction State 只在实体边界事件、选择和 Panel 操作时更新。
- 几何为静态数据派生；不在 Pointer Move 中重算场景。
- Stroke 使用 `non-scaling-stroke`；Filter 仅作用于当前 Selected/Open 实体。
- 节点数量、Ticker 数量、Filter 面积和事件监听器都有明确上限。

## 12. 技术参考

- Panzoom：小型、无依赖，原生支持 SVG、Pointer Events、Wheel focal zoom 和 Pinch。<https://github.com/timmywil/panzoom>
- D3 Zoom：作为更复杂相机约束、程序化 focus tour 和 transform 数学的备用参考。<https://d3js.org/d3-zoom>
- svg-pan-zoom：参考单一 viewport group、pan limit 和同步视图思路；不采用其额外 Hammer 触摸组合。<https://github.com/bumbu/svg-pan-zoom>
- MDN `vector-effect`：保持关键结构线在缩放时不改变屏幕宽度。<https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/vector-effect>
- MDN `touch-action` / Pointer Pinch：明确浏览器手势与应用手势边界。<https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action>

## 13. 新增或修改区域

新增：

- `src/center/data/*`
- `src/center/geometry/*`
- `src/center/interaction/*`
- `src/center/camera/*`
- `src/center/components/*`
- `src/views/CenterExperience.jsx`
- `src/views/CenterExperience.css`
- Center 单元和契约测试

局部修改：

- `App.jsx`：增加 Center View 和 History 映射。
- `Landing.jsx` / `EntrySurface.jsx`：增加 Center 入口回调。
- `progressStore` / `progressMigration`：允许持久化 `center` View。
- `transitionStore` / `transitionDefinitions`：增加 surface ↔ core 转场。
- `copy.js`：增加入口文字。

不修改 Reader 内容、Supabase、Admin、Landing 主视觉和现有阅读交互。

## 14–15. Phase 施工顺序与验收

### Phase 1：结构可行性

1. 建立 Scene 数据、Isometric 投影、实体类型和 State Machine。
2. 建立单一 SVG Scene Group。
3. 接入成熟 Pan/Zoom，验证 Wheel、Drag、Pinch。

验收：地图整体移动；缩放后结构不散；至少五个实体可独立命中；Pan/Zoom 不触发 React 每帧状态更新。

### Phase 2：完整交互体验

1. 增加 Focus/Selected/Open 视觉状态。
2. 增加 Desktop Floating Panel、Mobile Bottom Layer。
3. 增加 World Feed 与实体关联。
4. 增加 Keyboard 和 Reduced Motion。

验收：Hover 未完成即可 Click；Panel 与实体有空间关系；Mobile 不退化成列表；关闭 Panel 后相机状态不变。

### Phase 3：项目接入与质量闭环

1. 接入 Landing、History 和全局转场。
2. 添加单元/契约测试。
3. Desktop / Tablet / Mobile 浏览器检查。
4. 构建与性能检查，记录 SVG Fallback 触发条件。

验收：Landing → Center → Landing 闭环；刷新和浏览器返回不会进入非法 View；测试、类型检查、Lint、生产构建通过。

## 16. 第一版明确不做

- 真实国家或完整世界。
- PNG 建筑贴片、Raster 底图、3D 模型、真实地理数据。
- Phaser、PixiJS、Three.js、WebGL Shader。
- 剧情、任务、Reader 深链接的真实内容闭环。
- 自动寻路、建筑内部、昼夜天气模拟、多人同步。
- 大面积发光 HUD、固定左右 Dashboard、复杂数据仪表。
- 后端写入和 Production Supabase 改动。

## 17. 主要技术风险

1. SVG 节点无上限增长：通过实体预算、Layer 拆分和压力测试控制。
2. Pan 与 Click 冲突：相机记录移动阈值并短暂抑制拖动后的 Click。
3. Mobile 浏览器原生滚动抢手势：Center 全屏边界使用 `touch-action: none`，退出后恢复项目正常行为。
4. Panel 锚点在相机移动时漂移：屏幕坐标通过实体 `getBoundingClientRect` 在 RAF 中同步。
5. Filter 掉帧：只对 Selected/Open 的局部描线使用小范围 Filter。
6. History 扩展破坏 Reader：Center 使用独立 View 和独立转场，保留 Reader Controller。

## 18. SVG Fallback

只有满足以下任一条件才触发 Fallback 评估：

- 典型移动设备在目标节点数量下无法稳定交互。
- Scene 达到约 800–1200 个持续可见矢量节点，且分层/简化后仍掉帧。
- 需求转向大量粒子、实时材质或成千上万动态对象。

Fallback 顺序：

1. 先保留 DOM/SVG 交互层，把非交互背景层转 Canvas 2D。
2. 若动态对象规模继续上升，再评估 PixiJS 渲染背景与结构层。
3. 只有真正需要三维相机、遮挡、光照或 3D 资产时才评估 Three.js。

无论 Fallback 到哪一层，实体数据、Interaction State Machine、Panel、Ticker 和业务内容模型保持不变。

