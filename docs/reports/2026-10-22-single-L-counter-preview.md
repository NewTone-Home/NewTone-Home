# 三饮品店单一 L 柜台视觉候选（未发布）

## 作者本轮要求与画面变化

4222 的重复“柜台”字为了接墙采用局部拉距，形成明显长空隙，已经被否定。本轮改为柜台实体的一条完整外轮廓；每条 L 横段中心仅一组横排“柜台”，竖段中心仅一组竖排“柜台”。两个实体相接边不描线。整个实体可点，不限于中心文字。

咖啡馆上方另有一小段独立柜台，和长柜之间仍有 32 基准像素员工口；该段单独画框，绝不跨员工口连线。咖啡馆旧物理轮廓横段底484、竖段底488，保留4px小台阶，未为画图暗改实体尺寸。请作者看图判断该保留细节。

## 实际代码变更

- `shopInteriorTrial.ts:addCounterSurface`：显式复用每条原柜体矩形，替代重复字坐标/26、24、22局部拉距；每段提供普通查看ID，七个原业务ID与位置、唯一 cafe-order 行为仍保留。Cafe/果茶横段接触侧修为 bottom，奶茶横段修为 top，原纵段侧保持。
- `mainlineSceneModel.ts`：为柜体增加分组、房间、方向及交互锚元数据；语义实体标记柜台分组和原服务锚。没有改变通用家具碰撞规则。
- `counterOutlineGeometry.ts:counterOutlineGeometry`：对轴对齐柜体做并集，仅生成外边界，消除共享边；L内部空地仍不填充，不使用包住整个L的大矩形。
- `MainlineCounterSurface.tsx`：每组一个SVG外轮廓；每个实心腿都可鼠标/键盘操作，原服务锚保留独立点击区，中心标签点击对应原服务/查看。普通柜台点击不会变成下单。字16、线宽1随既有世界投影一次缩放。采用memo/useMemo，避免位置更新反复计算静态轮廓。
- `MainlineSceneRenderer.tsx`：当前房间画新柜台组，隐藏同组旧单字实体的重复渲染；碰撞仍由同一连续柜体提供。
- `CounterSurfaceOutline.test.tsx`：新增12项，覆盖共享边消除/真实面积与空角、三店单轮廓双标签、合法公共接触路径、两腿实心与员工侧空地/锁后门、Cafe32口和原7服务ID。

## 没有修改

墙门位置、三店柜台物理矩形、两茶围合/Cafe唯一员工口、桌椅设备及同侧嵌墙菜单、世界字16/墙28/家具16、缩放相机、剧情/订单内容/权限、矿区暂停6文件、真实存档和公共4173均未改。设备仍是已有观察说明，不新增生产系统。

## 实测

- Vitest 5文件38/38通过：CounterSurfaceOutline、cafeAccessFeedback、cafeSeating、commercialCafeBehavior、takeawayWorkerOperationRoutes。JSON `.tmp/L-counter-tests.json`。
- tsc --noEmit通过；隔离Vite构建成功；git diff --check通过。
- Chrome隔离存档，1920×1300三店全图已真实渲染/查看，三店同侧菜单正常点读，无pageerror。每个L仅一个闭合外轮廓、两标签。
- 三店横段非文字区域正常鼠标点击，分别抵达正确公共侧，显示普通柜台查看；没有将空L角包成柜体。
- 1280×800三店真前门进出；390×844模拟触屏果茶真前门进出。实际手机未测。
- Cafe原椅坐下/起身通过；原送咖啡夹具实际26个可见位置后delivered。不是所有对白和所有座位的全面回归。
- 证据：`.tmp/L-counter-browser`、`.tmp/L-counter-body-clicks`、`.tmp/L-pair-counter-front-smoke`、`.tmp/L-pair-counter-cafe-seat-browser`、`.tmp/L-pair-counter-cafe-delivery`。

## 固定候选与交付限制

本地4223：`http://127.0.0.1:4223/`，本轮新的“恢复”许可后启动；4173未替换。构建目录 `.tmp/L-counter-dist`。
JS `index-DmVAq5RX.js` 864949字节，SHA256 `78ef3cf90efa1c58ec272419693a7d44430b87d0041d7c39d77e2402d3faeb98`。
CSS `index-CGh3wNIs.css` 200573字节，SHA256 `2d1e58d828b388fe280461c6df36351b83657fbbe32c14763870d44f77afe039`。

Library全图：Cafe `libfile_8a4eb58ef9c88191b1d9f52e1feddf47`，奶茶 `libfile_562314c7c02c81919b46fc3c7db461cf`，果茶 `libfile_75b0d6b60dec81918415206fc5acabbd`。

先交作者视觉及独立QA，本轮未跑全量。旧重复字数量/逐字框契约尚需在方案确定后按新语义迁移，不能据38定向宣称全量绿；历史11失败未扩修。未push、未发布公网、未改Notion（父端已正常UI补记并读回，避免重复写）。
