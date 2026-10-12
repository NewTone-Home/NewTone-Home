import { describe, expect, it } from 'vitest'
import { mainlineRidePickupPositions } from '../src/center/runtime/mainlineRide'
import { phoneRideMapPickupMarkers } from '../src/center/runtime/phoneRideMapModel'

describe('Ride local map pickup markers', () => {
  it('places one car marker at the real Commercial Street pickup exit', () => {
    const exits = mainlineRidePickupPositions('commercial-street')
    const markers = phoneRideMapPickupMarkers('commercial-street', 'commercial-street')
    expect(markers).toHaveLength(1)
    expect(markers[0]?.position).toEqual([exits[0]?.x, exits[0]?.y])
  })

  it('places separate car markers at both real Office pickup exits', () => {
    const exits = mainlineRidePickupPositions('zhongshuyuan-office')
    const markers = phoneRideMapPickupMarkers('zhongshuyuan-office', 'zhongshuyuan-office')
    expect(markers).toHaveLength(2)
    expect(markers.map(marker => marker.position)).toEqual(exits.map(({ x, y }) => [x, y]))
    expect(new Set(markers.map(marker => marker.id)).size).toBe(2)
  })

  it('shows no car marker at the Cafe return passage or other non-pickup scenes', () => {
    expect(phoneRideMapPickupMarkers('commercial-cafe', 'commercial-street')).toEqual([])
    expect(phoneRideMapPickupMarkers('yonghe-eatery', 'yonghe-mining-perimeter')).toEqual([])
  })
})
