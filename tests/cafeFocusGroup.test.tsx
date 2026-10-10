import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MainlineFocusGroup } from '../src/center/runtime/MainlineSceneRenderer'
import { mainlineScenes, mainlineSceneGeometryUnits } from '../src/center/runtime/mainlineScenes'
import { storefrontPresentationRetractsFrame } from '../src/center/runtime/storefrontPresentation'

describe('Café focus geometry and lifecycle', () => {
  for (const metrics of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    it(`measures the canonical façade rather than its label at ${metrics.width}x${metrics.height}`, () => {
      const scene = mainlineScenes['commercial-street']
      const cafe = scene.storefronts.find(slot => slot.portalId)!
      const units = mainlineSceneGeometryUnits(scene, scene.initialPlayerPosition, metrics, new Map([[cafe.id, 'baseline']]))
      const entries = units.filter(unit => unit.storefrontId === cafe.id && unit.variant === 'baseline')
        .flatMap(unit => unit.visual.cells.map(cell => ({ unit, cell, focusGroup: 'cafe', focusPolicy: 'passage' as const })))
      const start = Math.min(...entries.map(({ cell }) => cell.cellStart!))
      const end = Math.max(...entries.map(({ cell }) => cell.cellEnd!))
      for (const label of [cafe.label, '很长的咖啡馆招牌文字', undefined]) {
        const html = renderToStaticMarkup(<MainlineFocusGroup entries={entries} className="" visibilityClass="is-baseline" renderFrame={() => null} storefrontLabel={label} storefrontSpan={cafe.end - cafe.start} storefrontCenter={{ x: entries[0].cell.x, y: (start + end) / 2 }} />)
        expect(html).toContain(`height:${Math.max(.001, end - start)}%`)
        expect(html).toContain('width:1em')
        expect(html).not.toContain('min(')
      }
    })
  }
  it.each([['baseline', false], ['revealing', true], ['revealed', true], ['lingering', true], ['restoring', true], ['retracting', true]] as const)('%s maps to retract=%s', (phase, expected) => {
    expect(storefrontPresentationRetractsFrame(phase)).toBe(expected)
  })
})
