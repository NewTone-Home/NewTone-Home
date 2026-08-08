export const RITUAL_WHEEL_MIN_DELTA = 8
export const RITUAL_SWIPE_MIN_DELTA = 42

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

export function isRitualDirectPointer(pointerType) {
  return pointerType === 'touch' || pointerType === 'pen'
}

export function resolveRitualArmAction(phase, selectorOption, pointerType) {
  if (!isRitualDirectPointer(pointerType)) return null
  return resolveRitualSelection(phase, selectorOption)
}

export function resolveRitualSwipeAction({ phase, selectorOption, pointerType, startY, endY }) {
  if (!isRitualDirectPointer(pointerType)) return null
  if (!Number.isFinite(startY) || !Number.isFinite(endY)) return null
  if (startY - endY < RITUAL_SWIPE_MIN_DELTA) return null
  return resolveRitualSelection(phase, selectorOption)
}
