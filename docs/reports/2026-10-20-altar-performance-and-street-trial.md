# 祖宅呼吸测量修复与商业街镜头试作（候选，未发布）

基线：`8d4023945013fe093e85252e89b29ac47f3070c0`。公共4173保持基线；本轮只在4174验收。没有修改地图尺寸、1920基准、28/16格距、家具布局、导航、剧情或真实存档。

## 1. 祖宅：供桌固定；真实点香才亮；不因呼吸重测文字

原因已用同设备干预对照验证。旧 `mainlineEntityUsesBreathing` 将供桌及未点香香炉都列为呼吸对象；`hasAltarBreathing` 只检查场景是否含供桌/香炉，故未点香也启动RAF。时钟写到带 `data-focus-visual-group` 的文字节点，`SceneFocusFrames` 的style MutationObserver因此每帧重测各组及其所有邻居。它不是持续存档或布局计算导致的停顿。

实际关键diff（完整差异见本轮分项提交）：

```diff
- || isIncense || isOfferingTable
+ || isIncense && incenseLit
- const hasAltarBreathing = scene.objects.some(entity => isAltarEntity(scene, entity.id))
+ const hasAltarBreathing = incenseLit && scene.objects.some(entity => entity.visualProfile === 'incense')
- <SceneCharacters ref={labelRef} data-focus-visual-group={focusGroup} ... />
+ <span className="scene-mainline-object__grid-content" ref={paintRef}>
+   <SceneCharacters data-focus-visual-group={focusGroup} ... />
+ </span>
```

`MainlineSceneRenderer.tsx`：供桌退出呼吸资格、共享RAF注册；香炉仅fresh/half燃烧状态注册。RAF只写外层画色容器，字体/真实文字节点仍保留style/class/content监听。

`scene.css`：删除供桌呼吸及互动时强制高亮的覆盖规则；供桌固定normal颜色/opacity1；未点香香炉normal颜色/opacity.5（不依赖explored/tutorial/hover）；真实点香后opacity1，外层颜色及opacity .86–.98呼吸。保留原十分钟生命周期。

`SceneFocusFrames.tsx`：普通测量请求合并到一帧；仍监听文字子树内容/style/class、文字与局部host大小、局部host位置样式、字体加载和stage resize；显式以worldScale作为投影变化依赖。相机整体平移和画色容器的亮度写入不通知字形测量。保留门牌动画端点两帧稳定性及generation取消机制。

真实动作已有实现：`resolveMainlineSceneEchoChoice` 仅成功的“重新点香”写 `incenseLitAt=now`；普通查看无stateChange；Page从存档时间计算剩余时长，进场不重启。此次没有新增或伪造动作/存档字段。

### 同设备性能前后

Chrome155.0.8059.85，1280×800、DSF1，headless隔离context；同路径、相同1800ms稳定等待后采4秒，未点香和恢复已点香各3次。修改前后脚本完全相同：`.tmp/profile-altar-current.mjs`；原始数据 `.tmp/altar-perf-before/results.json` / `.tmp/altar-perf-after/results.json`（保留untracked）。时间是浏览器rAF/CDP采样，不是工具响应时间。

| 状态 | FPS前（3次） | FPS后（3次） | ScriptDuration前→后（每4秒） | bounds读取前→后 |
| --- | --- | --- | --- | --- |
| 未点香 | 30.1 /31.6 /29.5 | 100.0 /99.8 /99.8 | 3.909–3.922s → .012–.014s | 178560–190464 →0 |
| 已点香 | 27.6 /29.9 /32.5 | 100.0 /100.1 /99.8 | 3.907–3.917s → .026–.027s | 166656–194928 →0 |

未点香时呼吸写入600–640→0；已点香仍保留香炉400–401次画色写入，但不再触发bounds读取。修改后6次祖宅采样均0长任务，rAF p95约10.1ms；前有50–74ms长任务。大院/办公室前后均约100FPS。前后全部采样Storage.setItem写入0、LayoutCount0。Range.getClientRects计数器本次没覆盖实际使用的Range方法，不能将其0计数解释为没有字符测量；结论依据实际Element bounds读取和CDP脚本时间。

这证明本设备空闲场景停顿修复，不能推定所有设备、进场瞬间、行走或其他剧情状态都已验收。

首轮回归：Renderer/SceneFocusFrames/endpoint scheduler/visual bounds/incense state/interaction visual state 6文件28/28通过。typecheck及隔离Vite构建通过（既有大chunk提示）。真实点香/读档、修改文字尺寸后的画框及手机截图验证结果待追加。

## 2. 商业街分屏镜头（试作，待独立QA）

待追加实际diff和验收数据。

## 3. 门牌翻动范围减半（待独立QA）

待追加实际diff和验收数据。
