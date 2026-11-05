export const dialogueChoiceWheelItemGapPx = 62
export const dialogueChoiceWheelIdleDelayMs = 145
export const dialogueChoiceWheelSnapDurationMs = 150

export function dialogueChoiceWheelClampPosition(position: number, optionCount: number) {
  if (optionCount <= 0) return 0
  return Math.max(0, Math.min(optionCount - 1, position))
}

export function dialogueChoiceWheelNearestIndex(position: number, optionCount: number) {
  return Math.round(dialogueChoiceWheelClampPosition(position, optionCount))
}

export function dialogueChoiceWheelCanConfirm(input: {
  entering: boolean
  scrolling: boolean
  settled: boolean
  position: number
  optionCount: number
}) {
  return !input.entering
    && !input.scrolling
    && input.settled
    && input.optionCount > 0
    && Math.abs(input.position - dialogueChoiceWheelNearestIndex(input.position, input.optionCount)) < .001
}
