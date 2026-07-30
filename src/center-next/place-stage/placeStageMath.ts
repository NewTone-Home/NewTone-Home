import type { PlaceSlotVisual, PlaceStageState } from './placeStageTypes'

/**
 * Place Stage 的纯数学。
 *
 * 这里只回答一件事：给定连续位置，每个地点此刻站在世界空间的哪个深度上。
 *
 * 核心模型是**一条深度轨**，不是两张卡片的交换：
 *
 *   深度 t:   0            1              2
 *             前景主体      侧后方邻居      更深处 / 未知边界
 *             (约 80%)     (约 20%)       (已退出视觉)
 *
 * 位置推进时，进入者沿右侧深度轨推进，离场者走独立的左退轨迹：
 *   - 后一个地点   t: 1 → 0   （从右侧后方推进到前景，放大、恢复完整层级）
 *   - 当前主体     t: 0 → 2   （向左滑出、缩小、淡化，并连续收成剪影）
 *   - 再后一个     t: 2 → 1   （从右侧深处浮出，成为新的 20%）
 *
 * 因此原主体经历的是 foreground → neighbor → silhouette/boundary 的**连续**变化，
 * 既不是瞬切，也不是把两张图 crossfade 掉包。
 *
 * 80/20 是视觉前后权重，不是栏宽切分：它由 t=0 与 t=1 两个构图预设之间的插值表达。
 */

/** 前景主体（约 80% 视觉权重）的构图预设。深度轨的 t = 0。 */
export const FOREGROUND_PRESET = {
  scale: 1,
  /** 主体稳定在左侧，为右侧邻居与信息层留出世界空间。 */
  translateXPct: -18,
  translateYPct: 0,
  zIndex: 30,
  opacity: 1,
  veil: 0,
  blurPx: 0,
  unfold: 1,
  converge: 0,
} as const

/**
 * 当前主体的左侧退场终点。
 *
 * 这是离场专用轨迹，不复用右侧邻居的深度预设：旧主体必须向左退出，
 * 而进入者仍从右侧邻居位推进。两条轨迹分开后，切换不再读成 panel slide。
 */
export const OUTGOING_EXIT_PRESET = {
  scale: 0.42,
  translateXPct: -58,
  translateYPct: -6,
  zIndex: 4,
  opacity: 0,
  veil: 0.7,
  blurPx: 0,
  unfold: 0,
  converge: 1,
} as const

/**
 * 侧后方邻居（约 20% 视觉权重）的构图预设。深度轨的 t = 1。
 *
 * 与前景靠六项同时区分：尺寸、水平位置、垂直位置、z-index、透明度、veil(对比度)。
 * blurPx 默认 0 —— 景深不靠 blur 制造，靠这六项加上遮挡关系。
 */
export const NEIGHBOR_PRESET = {
  scale: 0.56,
  translateXPct: 27,
  /**
   * 负值 = 更靠上。邻居的底边要落在**更高的地面位置**（更靠近地平线），
   * 它才读成「同一条地面透视上更远的地点」，而不是一张缩小的卡片。
   * 绝不与主体同处一条平行线。
   */
  translateYPct: -12,
  zIndex: 10,
  /** 远处地点主要靠位置、空气与彩度区分，不靠大幅透明化。 */
  opacity: 0.72,
  veil: 0.44,
  blurPx: 0,
  /**
   * 邻居仍然是一个**真实地点**，只是更小更远，不是一块剪影。
   *
   * 剪影属于深处（t = 2），因为退场序列是
   * foreground → neighbor → silhouette/boundary —— 剪影在邻居之后，不在邻居这一步。
   */
  unfold: 0.6,
  converge: 1,
} as const

/**
 * 更深处。深度轨的 t = 2。
 *
 * 退场主体的终点，也是新邻居浮出前的起点：继续向右、继续缩小、
 * 对比度继续下降，最后完全退出视觉。它不是一个可停留的档位 ——
 * 稳定状态下没有任何真实地点停在这里。
 */
export const DEEP_PRESET = {
  scale: 0.34,
  translateXPct: 47,
  /** 沿同一条地面透视继续后退：比邻居更靠近地平线。 */
  translateYPct: -17,
  zIndex: 4,
  opacity: 0,
  veil: 0.62,
  blurPx: 0,
  unfold: 0,
  converge: 1,
} as const

/** 深度超过这个值的地点完全退出视觉，也不再参与构图。 */
export const DEPTH_LIMIT = 2

/**
 * 退场主体沿深度轨的推进倍率。
 *
 * 后来者走完一格位置才前进一个深度；离场者要在同一格里走完两个深度
 * （前景 → 邻居 → 深处），因此是 2。这正是「原主体连续退过邻居位」的来源。
 */
export const OUTGOING_DEPTH_RATE = 2

/** 小于这个距离才算「稳定处于主体位」，才允许打开信息层。 */
export const PLACE_SETTLE_DISTANCE = 0.12

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

function smoothstep(value: number): number {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

export function clampPlacePosition(value: number, placeCount: number): number {
  const upper = Math.max(0, placeCount - 1)
  const numeric = Number(value)
  // NaN 没有方向，落回第一个地点；±Infinity 有方向，交给 clamp 处理
  if (Number.isNaN(numeric)) return 0
  return Math.min(upper, Math.max(0, numeric))
}

/**
 * 从控制器状态派生连续位置。
 *
 * position 是派生量，不承担状态语义：真正的构图状态是
 * fromIndex / toIndex / transitionProgress 三者。
 */
export function derivePosition(state: Pick<PlaceStageState, 'fromIndex' | 'toIndex' | 'transitionProgress'>): number {
  // toIndex === null 表示高位是未知边界，边界不可成为主体，因此推进恒为 0
  if (state.toIndex === null) return state.fromIndex
  return state.fromIndex + clamp01(state.transitionProgress) * (state.toIndex - state.fromIndex)
}

/** 把连续位置拆回构图对。到达整数位时重新锚定，推进量恒落在 [0, 1)。 */
export function resolveComposition(
  position: number,
  placeCount: number,
): Pick<PlaceStageState, 'fromIndex' | 'toIndex' | 'transitionProgress'> {
  const clamped = clampPlacePosition(position, placeCount)
  const lastIndex = Math.max(0, placeCount - 1)
  const fromIndex = Math.min(lastIndex, Math.floor(clamped))
  const highIndex = fromIndex + 1

  return {
    fromIndex,
    // 越界的高位不是地点，是未知世界边界
    toIndex: highIndex <= lastIndex ? highIndex : null,
    transitionProgress: clamped - fromIndex,
  }
}

export function nearestPlaceIndex(position: number, placeCount: number): number {
  return Math.round(clampPlacePosition(position, placeCount))
}

export function isSettledAt(index: number, position: number): boolean {
  return Math.abs(index - position) < PLACE_SETTLE_DISTANCE
}

/**
 * 释放后总是落到一个正式地点，不允许中间态长期停留。
 * 占比超过一半的一侧获胜；精确 50/50 时按地点链前进方向落到高位。
 */
export function weakSnapTarget(position: number, placeCount: number): number {
  return nearestPlaceIndex(position, placeCount)
}

/**
 * 位置偏移换算成深度轨坐标。
 *
 * offset = index - position。
 * - offset ≥ 0：还没轮到的地点，一格位置换一个深度；
 * - offset < 0：已经让位的地点，同一格里走完两个深度，
 *   于是它必然在中途经过 t = 1 的邻居位，而不是直接消失。
 */
export function depthOfOffset(offset: number): number {
  const value = Number(offset)
  if (!Number.isFinite(value)) return DEPTH_LIMIT
  return value >= 0 ? value : -value * OUTGOING_DEPTH_RATE
}

/**
 * 深度轨上任意一点的构图。
 *
 * t ∈ [0,1] 在前景与邻居之间插值；t ∈ [1,2] 在邻居与深处之间插值。
 * z-index 不插值，按深度分档 —— 过渡中途必须真正交换前后关系，
 * 而不是靠透明度伪装。
 */
export function poseAtDepth(depth: number): Omit<PlaceSlotVisual, 'placeIndex' | 'role' | 'visible' | 'unfoldDelay'> {
  const t = Math.max(0, Number.isFinite(depth) ? depth : DEPTH_LIMIT)
  const near = t <= 1 ? FOREGROUND_PRESET : NEIGHBOR_PRESET
  const far = t <= 1 ? NEIGHBOR_PRESET : DEEP_PRESET
  const k = t <= 1 ? t : Math.min(1, t - 1)

  return {
    depth: t,
    // 前后权重只在前景↔邻居这一段有意义；更深处一律读作 0
    prominence: clamp01(1 - t),
    scale: lerp(near.scale, far.scale, k),
    translateXPct: lerp(near.translateXPct, far.translateXPct, k),
    translateYPct: lerp(near.translateYPct, far.translateYPct, k),
    /*
      z 跟着深度连续走，不分档。
      推进途中两个地点会交错而过，只有连续的 z 才能保证「谁在前」始终由
      深度决定 —— 分档会让擦身而过的两个地点在同一档里靠 DOM 顺序碰运气。
    */
    zIndex: Math.round(lerp(near.zIndex, far.zIndex, k)),
    opacity: lerp(near.opacity, far.opacity, k),
    veil: lerp(near.veil, far.veil, k),
    blurPx: lerp(near.blurPx, far.blurPx, k),
    unfold: lerp(near.unfold, far.unfold, k),
    converge: lerp(near.converge, far.converge, k),
  }
}

function roleAtDepth(depth: number, placeIndex: number | null): PlaceSlotVisual['role'] {
  if (placeIndex === null) return 'boundary'
  return depth < 0.5 ? 'active' : 'neighbor'
}

/** 由深度轨生成一个槽位的视觉量。 */
export function slotAtDepth(placeIndex: number | null, depth: number): PlaceSlotVisual {
  const pose = poseAtDepth(depth)
  return {
    ...pose,
    placeIndex,
    role: roleAtDepth(pose.depth, placeIndex),
    visible: pose.depth < DEPTH_LIMIT ? 1 : 0,
    unfoldDelay: 0,
  }
}

/** 离场主体：从左侧稳定位连续缩小、淡化并向左滑出。 */
function outgoingSlotVisual(placeIndex: number, depth: number): PlaceSlotVisual {
  const t = clamp01(depth / DEPTH_LIMIT)
  const k = smoothstep(t)

  return {
    placeIndex,
    role: roleAtDepth(depth, placeIndex),
    visible: t < 1 ? 1 : 0,
    depth,
    prominence: 1 - t,
    scale: lerp(FOREGROUND_PRESET.scale, OUTGOING_EXIT_PRESET.scale, k),
    translateXPct: lerp(FOREGROUND_PRESET.translateXPct, OUTGOING_EXIT_PRESET.translateXPct, k),
    translateYPct: lerp(FOREGROUND_PRESET.translateYPct, OUTGOING_EXIT_PRESET.translateYPct, k),
    // 前后遮挡仍由统一深度决定；左右轨迹只改变平面路径，不改变空间顺序。
    zIndex: poseAtDepth(depth).zIndex,
    opacity: lerp(FOREGROUND_PRESET.opacity, OUTGOING_EXIT_PRESET.opacity, k),
    veil: lerp(FOREGROUND_PRESET.veil, OUTGOING_EXIT_PRESET.veil, k),
    blurPx: 0,
    unfold: lerp(FOREGROUND_PRESET.unfold, OUTGOING_EXIT_PRESET.unfold, k),
    converge: lerp(FOREGROUND_PRESET.converge, OUTGOING_EXIT_PRESET.converge, k),
    unfoldDelay: 0,
  }
}

/**
 * 当前构图里所有仍在视觉内的地点。
 *
 * 未知世界边界被当成「索引 placeCount 的虚拟地点」参与同一条深度轨 ——
 * 没有任何特判数据，新地点加入后自然被真实地点替换。
 *
 * 稳定状态下恰好两个真实槽位可见（主体 t=0 与邻居 t=1）；
 * 过渡途中会短暂出现第三个 —— 那正是退场主体经过邻居位再退进深处的过程。
 */
export function resolvePlaceSlots(position: number, placeCount: number): PlaceSlotVisual[] {
  if (placeCount <= 0) return []

  const slots: PlaceSlotVisual[] = []
  const first = Math.max(0, Math.ceil(position - DEPTH_LIMIT / OUTGOING_DEPTH_RATE) - 1)
  const last = Math.min(placeCount - 1, Math.floor(position + DEPTH_LIMIT) + 1)

  for (let index = first; index <= last; index += 1) {
    const offset = index - position
    const depth = depthOfOffset(offset)
    const slot = offset < 0
      ? outgoingSlotVisual(index, depth)
      : slotAtDepth(index, depth)
    if (slot.visible > 0) slots.push(slot)
  }

  // 未知世界边界：虚拟索引 placeCount，只会出现在最后一个真实地点之后
  const boundary = slotAtDepth(null, depthOfOffset(placeCount - position))
  if (boundary.visible > 0) slots.push(boundary)

  return slots
}

/**
 * 实际挂载的地点索引。
 *
 * 比可见槽位多留一格，且刻意由 settledIndex（低频）而不是 position（每帧）推导：
 * 这样一个地点从邻居走到主体位的整个过程中 DOM 节点不变，
 * 不会出现「卸载剪影再挂载完整主体」的突变。多出来的地点 visible 恒为 0。
 */
export function resolveMountWindow(settledIndex: number, placeCount: number): number[] {
  const indices: number[] = []
  for (let index = settledIndex - 1; index <= settledIndex + 2; index += 1) {
    if (index >= 0 && index < placeCount) indices.push(index)
  }
  return indices
}

/** 已挂载但不在构图里的地点：保留 DOM，视觉上完全退出。 */
export function hiddenSlotVisual(placeIndex: number): PlaceSlotVisual {
  return { ...slotAtDepth(placeIndex, DEPTH_LIMIT), visible: 0 }
}

/**
 * HUD 用：把位置读成「A 80 / B 20」这样的**视觉前后权重**。
 *
 * 刻意不是 100/0：稳定态本来就同时有主体与邻居，
 * 读成 100/0 会把这套构图重新误解成「一个占满、一个没有」。
 * 端点固定在 80/20，中间态才是 50/50。
 */
export const STABLE_WEIGHT_HIGH = 80
export const STABLE_WEIGHT_LOW = 20

export function describeWeights(position: number, placeCount: number): { low: number; high: number } {
  const composition = resolveComposition(position, placeCount)
  const frac = clamp01(composition.transitionProgress)
  const span = STABLE_WEIGHT_HIGH - STABLE_WEIGHT_LOW

  return {
    low: Math.round(STABLE_WEIGHT_LOW + span * (1 - frac)),
    high: Math.round(STABLE_WEIGHT_LOW + span * frac),
  }
}
