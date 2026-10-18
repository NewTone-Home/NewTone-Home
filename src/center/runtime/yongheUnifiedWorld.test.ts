import { describe, expect, it } from 'vitest'
import { createInitialPlayerSave, recordPlayerScenePosition, recordPlayerSceneStatePatch, sanitizePlayerSave } from './playerSave'
import { yongheSurveyPointStateKey, yongheSurveyStatusStateKey } from './yongheSurvey'
import { yongheCurrentRegionFromSave, yongheWorldPositionFromSave, yongheWorldSceneId } from './yongheUnifiedWorld'
import { mainlineSceneRoute, resolveMainlineSceneId, mainlineScenes } from './mainlineScenes'
import { defaultSceneScreenMetrics } from './sceneBoundaryGrid'
import { mainlineEntityTextFootprint } from './sceneLayout'

describe('Yonghe unified world save compatibility', () => {
  it('merges survey progress from the legacy eatery bucket and keeps the legacy fields', () => {
    const saved = sanitizePlayerSave({
      ...createInitialPlayerSave('yonghe-eatery'),
      sceneState: { 'yonghe-eatery': { [yongheSurveyPointStateKey('tables')]: true } },
    }, 'yonghe-mining-perimeter')
    expect(saved.sceneState[yongheWorldSceneId]?.[yongheSurveyPointStateKey('tables')]).toBe(true)
    expect(saved.sceneState['yonghe-eatery']?.[yongheSurveyPointStateKey('tables')]).toBe(true)
    expect(saved.sceneState[yongheWorldSceneId]?.[yongheSurveyStatusStateKey]).toBe('in-progress')
  })

  it('maps legacy eatery positions into the shared world key without dropping aliases', () => {
    const positioned = recordPlayerScenePosition(createInitialPlayerSave('yonghe-mining-perimeter'), 'yonghe-eatery', { x: 37.5, y: 35 })
    expect(positioned.currentSceneId).toBe(yongheWorldSceneId)
    expect(yongheWorldPositionFromSave(positioned, 'yonghe-eatery')).toEqual({ x: 37.5, y: 35 })
    expect(yongheWorldPositionFromSave(positioned, yongheWorldSceneId)).toEqual({ x: 37.5, y: 35 })
  })

  it('normalizes a legacy eatery resume to the one mine world and retains its position alias', () => {
    const saved = sanitizePlayerSave({
      ...createInitialPlayerSave('yonghe-eatery'),
      currentPosition: { x: 34, y: 35 },
      scenePositions: { 'yonghe-eatery': { x: 34, y: 35 } },
    }, 'jijia-ancestral-home')
    expect(saved.currentSceneId).toBe(yongheWorldSceneId)
    expect(saved.currentPosition).toEqual({ x: 34, y: 35 })
    expect(saved.scenePositions['yonghe-eatery']).toEqual({ x: 34, y: 35 })
    expect(saved.scenePositions[yongheWorldSceneId]).toEqual({ x: 34, y: 35 })
    expect(yongheCurrentRegionFromSave(saved)).toBe('eatery')
  })

  it('routes the compatibility eatery URL through the canonical world with a region query', () => {
    expect(mainlineSceneRoute('yonghe-eatery', { x: 34, y: 35 })).toBe('/?scene=yonghe-mining-perimeter&region=eatery&entryX=34&entryY=35')
    expect(resolveMainlineSceneId('?scene=yonghe-mining-perimeter&region=eatery')).toBe('yonghe-eatery')
  })

  it('mounts the menu on the right wall and matches horizontal table glyphs to its footprint', () => {
    const eatery = mainlineScenes['yonghe-eatery']
    const menu = eatery.objects.find((entity) => entity.id === 'yonghe-menu')!
    const room = eatery.structures.find((structure) => structure.id === 'yonghe-room')!
    expect(menu.surface).toBe('wall')
    expect(room.features).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'yonghe-menu-feature', entityId: 'yonghe-menu', edge: 'right' })]))
    const table = eatery.objects.find((entity) => entity.id === 'yonghe-upper-left-group-table')!
    const text = mainlineEntityTextFootprint(table, table.position, defaultSceneScreenMetrics)
    expect(Array.from(table.label)).toHaveLength(3)
    expect(table.collision?.width).toBeCloseTo(text.width, 2)
    expect(table.shape).toEqual(table.collision)
  })
  it('writes future survey patches to the canonical mine world state', () => {
    const saved = recordPlayerSceneStatePatch(createInitialPlayerSave('yonghe-mining-perimeter'), 'yonghe-eatery', { [yongheSurveyPointStateKey('counter')]: true })
    expect(saved.sceneState[yongheWorldSceneId]?.[yongheSurveyPointStateKey('counter')]).toBe(true)
  })
})
