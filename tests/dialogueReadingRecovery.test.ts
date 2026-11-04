import { describe, expect, it } from 'vitest'
import { mainlineEchoLayout, mainlineSpeakerAnchor } from '../src/center/runtime/mainlineEchoLayout'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineAvailableReadingWidthPx, mainlineMaximumReadingWidthPx, mainlineReadingCameraOffset, mainlineReadingEnvelopeNeedsCameraPan } from '../src/center/runtime/mainlineTextReading'

describe('restored Cafe dialogue reading placement', () => {
  const scene = mainlineScenes['commercial-street']
  const cafe = scene.rooms.find(room => room.id === 'commercial-north-cafe-interior')!
  const restoredActor = { x: 141.7916667, y: 22.2590667 }
  const dialoguePoint = { x: cafe.bounds.x + cafe.bounds.width / 2, y: cafe.bounds.y + cafe.bounds.height / 2 }
  const lines = [
    { speaker: 'Lao Zhou', text: 'Are you still waiting for the deputy minister to call?' },
    { speaker: 'Xiujie', text: 'I have not heard from him yet.' },
  ]

  it.each([{ width: 1280, height: 800, scale: 1 }, { width: 390, height: 844, scale: .65 }, { width: 360, height: 550, scale: .65 }])(
    'keeps the restored room dialogue visible at $width by $height', viewport => {
      const metrics = { width: viewport.width, height: viewport.height }
      const actorCamera = { x: 50 - restoredActor.x, y: 50 - restoredActor.y }
      const currentWidth = mainlineAvailableReadingWidthPx(scene, dialoguePoint, metrics, viewport.scale, actorCamera)
      const maximumWidth = mainlineMaximumReadingWidthPx(scene, dialoguePoint, metrics, viewport.scale)
      const readingCamera = mainlineReadingCameraOffset(scene, dialoguePoint, metrics, viewport.scale, actorCamera)
      const readingWidth = mainlineAvailableReadingWidthPx(scene, dialoguePoint, metrics, viewport.scale, readingCamera)
      const layout = mainlineEchoLayout(lines[0].text, metrics, { speaker: lines[0].speaker, maxWidthPx: readingWidth })
      const anchor = mainlineSpeakerAnchor(lines, metrics, dialoguePoint, { x: 0, y: 0 }, viewport.scale, readingWidth)
      const screenLeft = viewport.width / 2 + (anchor.left + readingCamera.x - 50) / 100 * 1920 * viewport.scale
      const screenRight = screenLeft + anchor.worldWidthPx * viewport.scale

      expect(currentWidth).toBeGreaterThan(0)
      expect(readingWidth).toBeGreaterThanOrEqual(currentWidth)
      expect(readingWidth).toBeLessThanOrEqual(maximumWidth)
      expect(layout.widthPx).toBeLessThanOrEqual(readingWidth)
      expect(screenLeft).toBeGreaterThanOrEqual(-1)
      expect(screenRight).toBeLessThanOrEqual(viewport.width + 1)
      expect(mainlineReadingEnvelopeNeedsCameraPan(anchor.left, anchor.widthPx, metrics, viewport.scale, actorCamera))
        .toBe(viewport.width < 500)
      expect(mainlineReadingEnvelopeNeedsCameraPan(anchor.left, anchor.widthPx, metrics, viewport.scale, readingCamera)).toBe(false)
    },
  )

  it('does not clamp a world-space Cafe anchor to screen percentages before camera translation', () => {
    const anchor = mainlineSpeakerAnchor(lines, { width: 390, height: 844 }, dialoguePoint, { x: 0, y: 0 }, .65, 366)
    expect(anchor.left + anchor.worldWidthPx / 1920 * 50).toBeCloseTo(dialoguePoint.x, 5)
    expect(anchor.top).toBeCloseTo(dialoguePoint.y, 5)
  })
})
