export function getBeatVisualState(beatIndex, focusBeatIndex) {
  const distance = Math.abs(beatIndex - focusBeatIndex)
  if (distance === 0) return 'focus'
  if (distance === 1) return 'near'
  return 'far'
}

export function createStaticStageView(phase) {
  const page = phase?.pages?.[0]
  if (!page) throw new Error('Static ReaderStage preview requires a page')

  return {
    phaseId: phase.id,
    page,
    focusBeatIndex: Math.min(1, page.beats.length - 1),
    progress: 0,
  }
}
