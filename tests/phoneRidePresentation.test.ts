import { describe, expect, it } from 'vitest'
import { phoneDriverDisplayDistance, phoneRideTripEstimate } from '../src/center/runtime/phoneRidePresentation'
import { storyClockForStage } from '../src/center/runtime/mainlineStoryClock'

describe('Phone ride presentation estimates', () => {
  it.each([['commercial', 'zhongshuyuan', 12], ['commercial', 'mine', 18], ['zhongshuyuan', 'mine', 24]] as const)('keeps %s ↔ %s symmetric and stable', (from, to, minutes) => {
    const clock = storyClockForStage('commercial-street'), before = { ...clock }
    expect(phoneRideTripEstimate(from, to, clock)?.minutes).toBe(minutes)
    expect(phoneRideTripEstimate(to, from, clock)).toEqual(phoneRideTripEstimate(from, to, clock))
    expect(phoneRideTripEstimate(from, to, clock)).toEqual(phoneRideTripEstimate(from, to, clock))
    expect(clock).toEqual(before)
  })
  it('uses reference story time, never player walking ETA', () => {
    expect(phoneRideTripEstimate('commercial', 'mine', storyClockForStage('commercial-street'))).toEqual({ minutes: 18, arrivalLabel: '11:18' })
    expect(phoneRideTripEstimate('commercial', 'zhongshuyuan', storyClockForStage('cafe'))).toEqual({ minutes: 12, arrivalLabel: '12:12' })
    expect(phoneRideTripEstimate('jijia', 'commercial', storyClockForStage('opening'))).toBeNull()
  })
  it('shows a monotone bounded rounded estimate and zero only at arrival', () => {
    const values = [0, 1000, 2000, 4999, 5000, 6000].map(now => phoneDriverDisplayDistance(5000, now))
    expect(values).toEqual([30, 25, 20, 5, 0, 0])
    expect(values.every((value, i) => i === 0 || value <= values[i - 1])).toBe(true)
  })
})
