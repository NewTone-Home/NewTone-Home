import { describe, expect, it } from 'vitest'
import { mainlineScenes } from './mainlineScenes'

describe('commercial drink shop scene connections', () => {
  const scene = mainlineScenes['commercial-street']

  it('places the approved eight-SKU contents on the two actual customer-facing wall menus', () => {
    const milkTeaMenu = scene.explorationText?.['commercial-s5-milk-tea-menu-service-label']?.join('\n') ?? ''
    const fruitTeaMenu = scene.explorationText?.['fruit-tea-trial-menu']?.join('\n') ?? ''
    for (const text of ['原味奶茶', '黑糖珍珠奶茶', '芋泥奶茶', '茉莉奶绿']) expect(milkTeaMenu).toContain(text)
    for (const text of ['百香果绿茶', '葡萄茉莉', '鲜橙汁', '草莓果饮']) expect(fruitTeaMenu).toContain(text)
    expect(milkTeaMenu).toContain('经典原味奶茶，茶香与奶香相互融合。')
    expect(fruitTeaMenu).toContain('百香果酸香，绿茶清爽')
    expect(scene.objects.find(entity => entity.id === 'commercial-s5-milk-tea-menu-service-label')?.surface).toBe('wall')
    expect(scene.objects.find(entity => entity.id === 'fruit-tea-trial-menu')?.surface).toBe('wall')
  })

  it('keeps one service point and the existing QR app square per drink counter', () => {
    expect(scene.objects.some(entity => entity.id === 'commercial-s5-milk-tea-pickup-service-label')).toBe(false)
    expect(scene.objects.some(entity => entity.id === 'fruit-tea-trial-pickup')).toBe(false)
    expect(scene.objects.some(entity => entity.id === 'commercial-s5-milk-tea-order-service-label')).toBe(true)
    expect(scene.objects.some(entity => entity.id === 'fruit-tea-trial-order')).toBe(true)
    expect(scene.objects.some(entity => entity.id === 'commercial-s5-milk-tea-app-square')).toBe(true)
    expect(scene.objects.some(entity => entity.id === 'fruit-tea-trial-app-square')).toBe(true)
    expect(scene.npcs.find(npc => npc.id === 'milk-tea-trial-worker')?.interactive).toBe(true)
    expect(scene.npcs.find(npc => npc.id === 'fruit-tea-trial-worker')?.interactive).toBe(true)
  })

  it.each([
    ['commercial-s5-milk-tea-app-square', 'commercial-south-s5-interior', 192, 168],
    ['fruit-tea-trial-app-square', 'commercial-north-n1-interior', 144, 476],
    ['commercial-cafe-app-square', 'commercial-north-cafe-interior', 172, 477],
  ] as const)('%s fits with an inset on its horizontal counter', (id, roomId, expectedX, expectedY) => {
    const room = scene.rooms.find(candidate => candidate.id === roomId)!
    const entity = scene.objects.find(candidate => candidate.id === id)!
    const owner = scene.continuousStructures.find(part => part.counterSurface?.services?.some(service => service.id === id))!
    const service = owner.counterSurface!.services!.find(candidate => candidate.id === id)!
    const localX = (service.position.x - room.bounds.x) * 19.2
    const localY = (service.position.y - room.bounds.y) * 10.8
    const counterLeft = owner.x * 19.2 - room.bounds.x * 19.2
    const counterTop = owner.y * 10.8 - room.bounds.y * 10.8
    const counterWidth = owner.width * 19.2
    const counterHeight = owner.height * 10.8
    expect(owner.counterSurface!.orientation).toBe('horizontal')
    expect(localX).toBeCloseTo(expectedX, 5)
    expect(localY).toBeCloseTo(expectedY, 5)
    expect(counterHeight).toBeCloseTo(22, 5)
    expect(localX - 9).toBeGreaterThan(counterLeft)
    expect(localX + 9).toBeLessThan(counterLeft + counterWidth)
    expect(localY - 9).toBeGreaterThan(counterTop)
    expect(localY + 9).toBeLessThan(counterTop + counterHeight)
    expect(entity.position.x).toBeCloseTo(service.position.x, 5)
    expect(entity.position.y).toBeCloseTo(service.position.y, 5)
  })
})
