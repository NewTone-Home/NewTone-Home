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
  'reader-to-surface': {
    targetView: 'landing',
    label: '返回入口中',
    timings: {
      leaving: 700,
      overlayCover: 700,
      coveredHold: 1900,
      entering: 700,
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
