export type VisualRect = { left: number; top: number; right: number; bottom: number }

/** One screen-space gap for every frame; the SVG stroke has its own 1px inset. */
export const sceneFocusVisualGapPx = 2
export const sceneFocusStrokeInsetPx = 1

export function unionVisualRects(rects: readonly VisualRect[]): VisualRect | null {
  const valid = rects.filter(rect => rect.right > rect.left && rect.bottom > rect.top)
  if (!valid.length) return null
  return {
    left: Math.min(...valid.map(rect => rect.left)), top: Math.min(...valid.map(rect => rect.top)),
    right: Math.max(...valid.map(rect => rect.right)), bottom: Math.max(...valid.map(rect => rect.bottom)),
  }
}

/** Text ranges exclude the unrelated button, doorway and reservation boxes. */
export function measureSceneCharacters(nodes: readonly HTMLElement[]) {
  return unionVisualRects(nodes.flatMap(node => {
    const range = document.createRange()
    range.selectNodeContents(node)
    return Array.from(range.getClientRects())
  }))
}
