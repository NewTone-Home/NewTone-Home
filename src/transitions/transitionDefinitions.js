const TRANSITION_DEFINITIONS = {
  'fade-cover': {
    targetView: null,
    label: '切换中',
    timings: {
      leaving: 220,
      overlayCover: 220,
      coveredHold: 280,
      entering: 360,
    },
    scene: 'fade-cover',
  },
  'surface-to-core': {
    targetView: 'center',
    label: '进入中枢中',
    timings: {
      leaving: 300,
      overlayCover: 300,
      coveredHold: 450,
      entering: 420,
    },
    scene: 'core-entry',
  },
  'reader-to-core': {
    targetView: 'center',
    label: '进入中枢中',
    timings: {
      leaving: 420,
      overlayCover: 280,
      coveredHold: 400,
      entering: 400,
    },
    scene: 'core-entry',
  },
  'core-to-surface': {
    targetView: 'landing',
    label: '返回入口中',
    timings: {
      leaving: 280,
      overlayCover: 280,
      coveredHold: 450,
      entering: 460,
    },
    scene: 'surface-return',
  },
  'core-to-reader': {
    targetView: 'reader',
    label: '回到阅读中',
    timings: {
      leaving: 260,
      overlayCover: 260,
      coveredHold: 380,
      entering: 420,
    },
    scene: 'reader-return',
  },
  'reader-to-surface': {
    targetView: 'landing',
    label: '返回入口中',
    timings: {
      leaving: 380,
      overlayCover: 240,
      coveredHold: 340,
      entering: 400,
    },
    scene: 'surface-return',
  },
}

export function getDefinition(preset) {
  return TRANSITION_DEFINITIONS[preset] || TRANSITION_DEFINITIONS['fade-cover']
}

export function hasDefinition(preset) {
  return Object.prototype.hasOwnProperty.call(TRANSITION_DEFINITIONS, preset)
}
