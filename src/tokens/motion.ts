// 动画 token（Canon §13.4 参数表）

export const MOTION = {
  breath: {
    opacityMin: 0.06,
    opacityMax: 0.15,
    periodSec: 7,
  },
  enterDelayMs: 80,
  igniteDurationMs: 120,
  ignitePeakOpacity: 0.32,
  ignitePeakScale: 1.4,
  bloomDurationMs: 280,
  staggerMs: 60,
  exitGraceMs: 300,
  collapseDurationMs: 320,
  breathResumeDelayMs: 280,
  transientLogoDurationMs: 1000,
} as const

export const HIT_AREA_PX = 40
export const DOT_SIZE_PX = 3
