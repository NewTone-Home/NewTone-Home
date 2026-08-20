import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.jsx')
const landing = read('../src/views/Landing.jsx')
const center = read('../src/views/CenterExperience.jsx')
const camera = read('../src/center/camera/useCenterPanZoom.js')

describe('Center product boundary', () => {
  it('uses a dedicated public view and landing entry without changing the Reader entry controller', () => {
    expect(app).toContain("currentView === 'center'")
    expect(app).toContain("preset: 'surface-to-core'")
    expect(app).toContain("lazy(() => import('./views/CenterExperience'))")
    expect(app).toContain('waitForReady: true')
    expect(landing).toContain("id: 'center'")
    expect(landing).toContain('onEnterCenter?.()')
  })

  it('keeps camera mutation outside React render state', () => {
    expect(camera).toContain("import Panzoom from '@panzoom/panzoom'")
    expect(camera).toContain("scene.addEventListener('panzoomchange'")
    expect(camera).not.toContain('useState')
    expect(center).toContain('useReducer(centerInteractionReducer')
  })

  it('ships the shared map, contextual panel, and world feed on one surface', () => {
    expect(center).toContain('<CenterMap')
    expect(center).toContain('<CenterInfoPanel')
    expect(center).toContain('<CenterNewsTicker')
  })
})
