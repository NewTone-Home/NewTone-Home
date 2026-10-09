import { describe, expect, it } from 'vitest'
import { phoneDriverDisplayDistance, phoneDriverDistanceLabel,phoneDriverEtaLabel, phoneRideTripEstimate } from '../src/center/runtime/phoneRidePresentation'
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
    expect(values).toEqual([50, 50, 50, 50, 0, 0])
    expect(values.every((value, i) => i === 0 || value <= values[i - 1])).toBe(true)
  })
  it('uses coarse distance bands and the true remaining deadline',()=>{
    const values=[0,100000,200000,250000,300000,320000,333334,400000].map(now=>phoneDriverDisplayDistance(400000,now))
    expect(values.every((value,index)=>index===0||value<=values[index-1])).toBe(true)
    expect(phoneDriverDistanceLabel(10000,0)).toBe('不足 100 米')
    expect(phoneDriverDistanceLabel(50000,0)).toBe('约 300 米')
    expect(phoneDriverDistanceLabel(400000,0)).toBe('约 3 公里')
    expect(phoneDriverEtaLabel(90000,0)).toBe('约 2 分钟')
    expect(phoneDriverEtaLabel(90000,60000)).toBe('即将到达')
    expect(phoneDriverEtaLabel(90000,90000)).toBe('已到达')
  })
})
