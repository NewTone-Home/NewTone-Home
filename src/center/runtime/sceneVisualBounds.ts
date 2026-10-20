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

/** Clip one glyph's measured ink to CSS overflow ancestors. */
export function intersectVisualRectWithClip(
  rect: VisualRect,
  clip: VisualRect,
  clipX = true,
  clipY = true,
): VisualRect | null {
  const clipped = {
    left: clipX ? Math.max(rect.left, clip.left) : rect.left,
    top: clipY ? Math.max(rect.top, clip.top) : rect.top,
    right: clipX ? Math.min(rect.right, clip.right) : rect.right,
    bottom: clipY ? Math.min(rect.bottom, clip.bottom) : rect.bottom,
  }
  return clipped.right > clipped.left && clipped.bottom > clipped.top ? clipped : null
}

function clipToCharacterSwitch(rect: VisualRect, node: HTMLElement): VisualRect | null {
  const slot = node.closest<HTMLElement>('.scene-character-switch')
  if (!slot) return rect
  const style = getComputedStyle(slot)
  const clipX = style.overflowX !== 'visible'
  const clipY = style.overflowY !== 'visible'
  if (!clipX && !clipY) return rect
  const bounds = slot.getBoundingClientRect()
  const scaleX = slot.offsetWidth > 0 ? bounds.width / slot.offsetWidth : 1
  const scaleY = slot.offsetHeight > 0 ? bounds.height / slot.offsetHeight : 1
  const left = bounds.left + slot.clientLeft * scaleX
  const top = bounds.top + slot.clientTop * scaleY
  return intersectVisualRectWithClip(rect, {
    left,
    top,
    right: left + slot.clientWidth * scaleX,
    bottom: top + slot.clientHeight * scaleY,
  }, clipX, clipY)
}

/**
 * A DOM Range describes the font's advance/line box, not the visible ink. Use
 * the same browser font metrics to tighten each glyph inside its own range;
 * preserve Range coordinates so CSS layout, writing mode and transforms still
 * determine where that glyph lives in the scene.
 */
export function measureSceneCharacterRects(nodes: readonly HTMLElement[]) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const rects: VisualRect[] = []
  for (const root of nodes) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const value = text.textContent ?? ''
      if (!value.trim()) continue
      const style = getComputedStyle(text.parentElement ?? root)
      if (style.visibility === 'hidden' || Number.parseFloat(style.opacity) === 0) continue
      if (context) context.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      const range = document.createRange()
      let offset = 0
      for (const glyph of value) {
        const start = offset
        offset += glyph.length
        if (/^\s+$/u.test(glyph)) continue
        range.setStart(text, start)
        range.setEnd(text, offset)
        const layout = range.getBoundingClientRect()
        if (!(layout.width > 0 && layout.height > 0)) continue
        const metrics = context?.measureText(glyph)
        const inkWidth = metrics ? metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight : layout.width
        const inkHeight = metrics ? metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent : layout.height
        if (!(inkWidth > 0 && inkHeight > 0)) continue
        const verticalSideways = style.writingMode.startsWith('vertical') && style.textOrientation !== 'upright'
        const width = Math.min(layout.width, verticalSideways ? inkHeight : inkWidth)
        const height = Math.min(layout.height, verticalSideways ? inkWidth : inkHeight)
        const top = layout.top + (layout.height - height) / 2
        const measured = {
          left: layout.left + (layout.width - width) / 2,
          top,
          right: layout.left + (layout.width + width) / 2,
          bottom: top + height,
        }
        const visible = clipToCharacterSwitch(measured, text.parentElement ?? root)
        if (visible) rects.push(visible)
      }
    }
  }
  return rects
}

export function measureSceneCharacters(nodes: readonly HTMLElement[]) {
  return unionVisualRects(measureSceneCharacterRects(nodes))
}
