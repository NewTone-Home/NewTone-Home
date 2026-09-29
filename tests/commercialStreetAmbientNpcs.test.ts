import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

const street = mainlineScenes['commercial-street']
const ambientNpcs = street.npcs.filter((npc) => npc.roleId === 'pedestrian')

describe('Commercial Street ambient pedestrians', () => {
  it('authors exactly six non-interactive people in the street only', () => {
    expect(ambientNpcs).toHaveLength(6)
    expect(ambientNpcs.every((npc) => npc.label === '人' && npc.interactive === false && npc.interactionTargetEntityId === undefined)).toBe(true)
    expect(mainlineScenes['commercial-cafe'].npcs.some((npc) => npc.roleId === 'pedestrian')).toBe(false)
  })

  it('gives every pedestrian a distinct startup phase and a fixed legal route', () => {
    expect(street.ambientNpcRoutes).toHaveLength(6)
    expect(new Set(street.ambientNpcRoutes.map((route) => route.npcId))).toEqual(new Set(ambientNpcs.map((npc) => npc.id)))
    expect(new Set(street.ambientNpcRoutes.map((route) => route.initialDelayMs)).size).toBe(6)
    street.ambientNpcRoutes.forEach((route) => {
      expect(route.steps.length).toBeGreaterThan(1)
      route.steps.forEach(({ target, dwellMs }) => {
        expect(dwellMs).toBeGreaterThan(0)
        expect(target.x).toBeGreaterThanOrEqual(street.walkBounds.x)
        expect(target.x).toBeLessThanOrEqual(street.walkBounds.x + street.walkBounds.width)
        expect(target.y).toBeGreaterThanOrEqual(street.walkBounds.y)
        expect(target.y).toBeLessThanOrEqual(street.walkBounds.y + street.walkBounds.height)
      })
    })
  })
})
