export const RITUAL_WHEEL_MIN_DELTA = 8

function resolveRitualSelection(phase, selectorOption) {
  if (phase === 'language-active' && selectorOption === 'primary') {
    return { type: 'language' }
  }

  if (phase === 'mode-active' && selectorOption === 'primary') {
    return { type: 'mode', mode: 'immersive' }
  }

  if (phase === 'mode-active' && selectorOption === 'secondary') {
    return { type: 'mode', mode: 'standard' }
  }

  return null
}

export function resolveRitualWheelAction(phase, selectorOption, deltaY) {
  if (!Number.isFinite(deltaY) || deltaY <= RITUAL_WHEEL_MIN_DELTA) return null
  return resolveRitualSelection(phase, selectorOption)
}

export function resolveRitualTapAction(phase, selectorOption, pointerType) {
  if (pointerType !== 'touch') return null
  return resolveRitualSelection(phase, selectorOption)
}
