import { describe, expect, it } from 'vitest'
import { ruoyuCafeDepartedKey, ruoyuCafeDepartureOnTransition, ruoyuCafeMeetingStatusKey } from '../src/center/runtime/ruoyuCafeMeeting'
describe('Ruoyu departure', () => {
  const done = { [ruoyuCafeMeetingStatusKey]: 'complete' }
  it('leaves only after a finished meeting and a real exit from the commercial street', () => {
    expect(ruoyuCafeDepartureOnTransition(done, 'commercial-street', 'yonghe-mining-perimeter')).toEqual({ [ruoyuCafeDepartedKey]: true })
    expect(ruoyuCafeDepartureOnTransition(done, 'commercial-street', 'commercial-cafe')).toBeNull()
    expect(ruoyuCafeDepartureOnTransition(done, 'commercial-cafe', 'commercial-street')).toBeNull()
    expect(ruoyuCafeDepartureOnTransition({}, 'commercial-street', 'yonghe-mining-perimeter')).toBeNull()
    expect(ruoyuCafeDepartureOnTransition({ ...done, [ruoyuCafeDepartedKey]: true }, 'commercial-street', 'yonghe-mining-perimeter')).toBeNull()
  })
})
