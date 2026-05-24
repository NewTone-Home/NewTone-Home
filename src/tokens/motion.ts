// 动画时长 / 节奏 token — 一处改全站生效

export const MOTION = {
  breath: {
    durationMs: 7000,
    opacityRange: [0.06, 0.15, 0.06] as const,
  },
  enterDelayMs: 80,
  igniteDurationMs: 120,
  bloomDurationMs: 280,
  staggerMs: 60,
  exitGraceMs: 300,
  collapseDurationMs: 320,
  breathResumeDelayMs: 280,
} as const

export const INTRO_DURATION_MS = 800
export const ANY_KEY_BLINK_MS = 1600
