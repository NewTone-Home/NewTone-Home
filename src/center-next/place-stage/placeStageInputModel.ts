import { normalizeWheelDelta } from '../../reader/readerInput'

/**
 * Place Stage 的输入换算。
 *
 * 这里只做「像素 → 地点增量」的纯换算，不产生视觉量、不碰 CSS、不认识图层。
 * 输入设备的差异到 usePlaceStageInput 为止，再往下只剩 PlaceNavigationIntent。
 *
 * 连续输入是 1:1 直接操作：没有自研惯性、没有累加器、没有「一次手势最多跨一个地点」
 * 的 clamp —— 位置由用户的手决定。
 *
 * 输入职责固定分开：
 * - pointer 横向拖动 = 地点切换；
 * - wheel 主轴 = 沿地点链深入 / 返回；
 * - click 不在本文件导航，只交给上层打开信息板。
 */

/** 相邻地点中心间距占舞台宽度的比例。拖满这段距离恰好走过一个地点。 */
export const PLACE_STRIDE_RATIO = 0.62

/** 拖动超过这个像素后，松手产生的 click 必须被屏蔽。 */
export const PLACE_DRAG_CLICK_THRESHOLD = 8

/** wheel 停止多久后判定手势结束。 */
export const PLACE_WHEEL_IDLE_MS = 140

/** 单个 wheel 事件的最大有效位移，挡住异常巨量 delta。 */
export const PLACE_MAX_WHEEL_DELTA = 240

/** Reduced motion 下判定「这一次拖动算换一个地点」的最小比例。 */
export const PLACE_DISCRETE_STEP_RATIO = 0.25

export function stridePixels(viewportWidth: number): number {
  const width = Number(viewportWidth)
  if (!Number.isFinite(width) || width <= 0) return 1
  return Math.max(1, width * PLACE_STRIDE_RATIO)
}

/** wheel 沿当前手势的主轴读取；普通鼠标滚轮因此直接使用 deltaY。 */
export function dominantWheelDelta(deltaX: number, deltaY: number): number {
  const x = Number(deltaX)
  const y = Number(deltaY)
  const safeX = Number.isFinite(x) ? x : 0
  const safeY = Number.isFinite(y) ? y : 0
  return Math.abs(safeY) >= Math.abs(safeX) ? safeY : safeX
}

/**
 * wheel 深度 delta 归一化。
 *
 * 复用 reader 已有并已测试的 normalizeWheelDelta：它按 deltaMode 处理行(1)与页(2)单位，
 * 轴无关，页单位这里传舞台宽度。
 */
export function normalizeDepthWheelDelta(
  deltaX: number,
  deltaY: number,
  deltaMode: number,
  viewportWidth: number,
): number {
  const normalized = normalizeWheelDelta(dominantWheelDelta(deltaX, deltaY), deltaMode, viewportWidth)
  return Math.max(-PLACE_MAX_WHEEL_DELTA, Math.min(PLACE_MAX_WHEEL_DELTA, normalized))
}

/**
 * 拖动位移换算成位置增量。
 *
 * 光标向左拖 => 内容随手左移 => 右后方邻居推进到前景 => 索引增大，所以是 -dx / stride。
 */
export function dragPositionDelta(dx: number, stridePx: number): number {
  const delta = Number(dx)
  const stride = Number(stridePx)
  if (!Number.isFinite(delta) || !Number.isFinite(stride) || stride <= 0) return 0
  return -delta / stride
}

/** wheel 的主轴 delta 换算成地点链深度增量：正值深入，负值返回。 */
export function wheelPositionDelta(normalizedDelta: number, stridePx: number): number {
  const delta = Number(normalizedDelta)
  const stride = Number(stridePx)
  if (!Number.isFinite(delta) || !Number.isFinite(stride) || stride <= 0) return 0
  return delta / stride
}

/** 累计位移是否已经构成「拖动」，用于屏蔽松手的 click。 */
export function exceedsDragThreshold(totalMovement: number): boolean {
  const movement = Number(totalMovement)
  if (!Number.isFinite(movement)) return false
  return Math.abs(movement) > PLACE_DRAG_CLICK_THRESHOLD
}

/** Reduced motion 下：这一次拖动应该换几个地点（-1 / 0 / 1）。 */
export function discreteDragStep(dx: number, stridePx: number): number {
  const delta = dragPositionDelta(dx, stridePx)
  if (Math.abs(delta) < PLACE_DISCRETE_STEP_RATIO) return 0
  return delta > 0 ? 1 : -1
}

/** 位置增量的方向。0 增量没有方向，按前进处理。 */
export function intentDirection(positionDelta: number): -1 | 1 {
  return Number(positionDelta) < 0 ? -1 : 1
}
