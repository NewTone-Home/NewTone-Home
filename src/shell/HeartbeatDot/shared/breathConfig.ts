// Canon §13.4 参数表 · v2.2.1 双层差异

export const DOT_SIZE_PX = 3
export const HIT_AREA_PX = 40

// 双层呼吸（v2.2.1 实测调参）
export const BREATH_CORE = { min: 0.35, max: 0.55 }
export const BREATH_HALO = { min: 0.06, max: 0.15 }
export const BREATH_PERIOD_S = 7

// Hover 进入热区后点燃
export const ENTER_DELAY_MS = 80
export const IGNITE_DURATION_MS = 120
export const IGNITE_PEAK_OPACITY = 0.32
export const IGNITE_CORE_PEAK_OPACITY = 0.85  // core 比 halo 更显眼
export const IGNITE_PEAK_SCALE = 1.4

// 图标墨痕散开
export const BLOOM_DURATION_MS = 280
export const STAGGER_MS = 60

// 反向收回
export const EXIT_GRACE_MS = 300
export const COLLAPSE_DURATION_MS = 320
export const BREATH_RESUME_DELAY_MS = 280
