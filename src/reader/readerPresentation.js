export function getReaderProgressPercentage(progress) {
  const normalized = Number.isFinite(progress)
    ? Math.min(Math.max(progress, 0), 1)
    : 0
  return Math.round(normalized * 100)
}

export function hasReaderSceneChanged(previousScene, nextScene) {
  if (!previousScene || !nextScene) return previousScene !== nextScene
  return previousScene.id !== nextScene.id
    || previousScene.label !== nextScene.label
}
