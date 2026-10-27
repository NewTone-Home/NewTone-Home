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
})
