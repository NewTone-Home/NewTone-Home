import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  calculatePreviewCamera,
  capturePreviewCamera,
  restorePreviewCamera,
} from '../src/hooks/useCenterNavigation'
import { centerMiniLandmarks } from '../src/data/center/centerWorld'
import { sharedWorldGeometry } from '../src/data/center/sharedWorldGeometry'

const navigationSource = readFileSync(new URL('../src/hooks/useCenterNavigation.js', import.meta.url), 'utf8')

describe('Center mini landmark preview camera', () => {
  it('captures and restores camera and zoom without aliasing camera state', () => {
    const camera = { x: 38, y: -12 }
    const snapshot = capturePreviewCamera(camera, 1.2)
    camera.x = 90

    expect(restorePreviewCamera(snapshot)).toEqual({ camera: { x: 38, y: -12 }, zoom: 1.2 })
  })

  it('moves the council toward the left safe area and respects pan bounds', () => {
    const result = calculatePreviewCamera({
      anchor: sharedWorldGeometry.anchors.council,
      layerHeight: 360,
      layerScale: 0.9,
      layerTopRatio: 0.5,
      layerWidth: 1000,
      stageHeight: 720,
      stageWidth: 1000,
      targetZoom: 1.28,
      viewportWidth: 1280,
    })

    expect(result.zoom).toBe(1.28)
    expect(result.camera.x).toBeLessThan(0)
    expect(Math.abs(result.camera.x)).toBeLessThanOrEqual(140)
    expect(Math.abs(result.camera.y)).toBeLessThanOrEqual(100.8)
  })

  it('registers both first-batch surface mini landmarks on shared anchors', () => {
    expect(centerMiniLandmarks['surface-council'].anchorId).toBe('council')
    expect(centerMiniLandmarks['surface-estate'].anchorId).toBe('jijia')
  })

  it('clears preview state when entering a region', () => {
    const resetBody = navigationSource.match(/const resetViewForLayer[\s\S]*?const recenterCamera/)?.[0] ?? ''
    const enterBody = navigationSource.match(/const enterNode[\s\S]*?const goBack/)?.[0] ?? ''

    expect(resetBody).toContain('setPreviewNodeId(null)')
    expect(resetBody).toContain('previewCameraSnapshotRef.current = null')
    expect(enterBody).toContain('resetViewForLayer()')
  })
})
