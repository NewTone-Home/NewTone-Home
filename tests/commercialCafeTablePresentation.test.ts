import { describe, expect, it } from 'vitest'
import {
  commercialCafeBanknoteAttachedPropId,
  commercialCafeCoffeeAttachedPropId,
  commercialCafeLaoZhouCoffeeAttachedPropId,
  commercialCafeMilkTeaAttachedPropId,
} from '../src/center/runtime/commercialCafeStory'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { resolveCommercialCafeTablePropLayout } from '../src/center/runtime/commercialCafeTablePresentation'

const props = mainlineScenes['commercial-cafe'].attachedProps
const byId = (ids: string[]) => props.filter(({ id }) => ids.includes(id))
const topBottom = [commercialCafeLaoZhouCoffeeAttachedPropId, commercialCafeCoffeeAttachedPropId]

const combinations = [
  { name: 'Lao Zhou coffee only', ids: [commercialCafeLaoZhouCoffeeAttachedPropId] },
  { name: 'coffee and milk tea', ids: [commercialCafeLaoZhouCoffeeAttachedPropId, commercialCafeMilkTeaAttachedPropId] },
  { name: 'two character coffees', ids: topBottom },
  { name: 'two coffees and milk tea', ids: [...topBottom, commercialCafeMilkTeaAttachedPropId] },
  { name: 'two coffees and banknote', ids: [...topBottom, commercialCafeBanknoteAttachedPropId] },
  { name: 'all four props', ids: [...topBottom, commercialCafeMilkTeaAttachedPropId, commercialCafeBanknoteAttachedPropId] },
]

function bounds(layout: { offsetXpx: number; offsetYpx: number; widthPx: number; heightPx: number }) {
  return {
    left: layout.offsetXpx - layout.widthPx / 2,
    right: layout.offsetXpx + layout.widthPx / 2,
    top: layout.offsetYpx - layout.heightPx / 2,
    bottom: layout.offsetYpx + layout.heightPx / 2,
  }
}

function overlapArea(first: ReturnType<typeof bounds>, second: ReturnType<typeof bounds>) {
  return Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left))
    * Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top))
}

describe('Café table prop presentation resolver', () => {
  it('recomputes semantic slots for all six visible prop combinations at all supported viewports', () => {
    for (const viewportWidth of [1280, 412, 390, 360]) {
      for (const { name, ids } of combinations) {
        const result = resolveCommercialCafeTablePropLayout(byId(ids), viewportWidth)
        expect([...result.keys()], `${name} at ${viewportWidth}px`).toHaveLength(ids.length)
        const boxes = [...result.values()].map(bounds)
        for (let first = 0; first < boxes.length; first += 1) {
          for (let second = first + 1; second < boxes.length; second += 1) {
            expect(overlapArea(boxes[first]!, boxes[second]!), `${name} at ${viewportWidth}px`).toBe(0)
          }
        }
      }
    }
  })

  it('centers a single item and keeps tea to the right of the Lao Zhou cup', () => {
    const single = resolveCommercialCafeTablePropLayout(byId([commercialCafeLaoZhouCoffeeAttachedPropId]), 412)
    expect(single.get(commercialCafeLaoZhouCoffeeAttachedPropId)).toMatchObject({ offsetXpx: 0, offsetYpx: 0 })
    const pair = resolveCommercialCafeTablePropLayout(byId([commercialCafeLaoZhouCoffeeAttachedPropId, commercialCafeMilkTeaAttachedPropId]), 412)
    expect(pair.get(commercialCafeLaoZhouCoffeeAttachedPropId)!.offsetXpx).toBeLessThan(0)
    expect(pair.get(commercialCafeMilkTeaAttachedPropId)!.offsetXpx).toBeGreaterThan(0)
  })

  it('places each character coffee on their side and uses top, bottom, right, left in the full layout', () => {
    const twoCups = resolveCommercialCafeTablePropLayout(byId(topBottom), 412)
    expect(twoCups.get(commercialCafeLaoZhouCoffeeAttachedPropId)!.offsetYpx).toBeLessThan(0)
    expect(twoCups.get(commercialCafeCoffeeAttachedPropId)!.offsetYpx).toBeGreaterThan(0)
    const three = resolveCommercialCafeTablePropLayout(byId([...topBottom, commercialCafeMilkTeaAttachedPropId]), 412)
    expect(three.get(commercialCafeMilkTeaAttachedPropId)!.offsetXpx).toBeGreaterThan(0)
    const four = resolveCommercialCafeTablePropLayout(byId([...topBottom, commercialCafeMilkTeaAttachedPropId, commercialCafeBanknoteAttachedPropId]), 412)
    expect(four.get(commercialCafeLaoZhouCoffeeAttachedPropId)!.offsetYpx).toBeLessThan(0)
    expect(four.get(commercialCafeCoffeeAttachedPropId)!.offsetYpx).toBeGreaterThan(0)
    expect(four.get(commercialCafeMilkTeaAttachedPropId)!.offsetXpx).toBeGreaterThan(0)
    expect(four.get(commercialCafeBanknoteAttachedPropId)!.offsetXpx).toBeLessThan(0)
  })
})
