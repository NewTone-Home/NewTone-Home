import React from 'react'
// @ts-expect-error The app intentionally has no Node typings; this test reads its companion CSS file.
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { mainlineEntityUsesBreathing } from './MainlineSceneRenderer'
import { MainlineSceneRenderer } from './MainlineSceneRenderer'
import { createMainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { mainlineScenes } from './mainlineScenes'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'

describe('mainline renderer breathing semantics', () => {
  it('breathes for the old tree but not its tree-ring stones', () => {
    const yard = mainlineScenes['jijia-ancestral-home']
    const tree = yard.objects.find((entity) => entity.id === 'jijia-old-tree')
    const stone = yard.objects.find((entity) => entity.id === 'jijia-old-tree-stone-n')

    expect(tree?.visualProfile).toBe('tree-ring')
    expect(tree && mainlineEntityUsesBreathing(yard, tree)).toBe(true)
    expect(stone).toMatchObject({ visualProfile: 'tree-ring', interactive: false })
    expect(stone && mainlineEntityUsesBreathing(yard, stone)).toBe(false)
  })

  it('keeps offering tables steady and only breathes for actually lit incense', () => {
    const interior = mainlineScenes['jijia-ancestral-interior']
    const incense = interior.objects.find((entity) => entity.id === 'jijia-incense-burner')
    const offeringTable = interior.objects.find((entity) => entity.id === 'jijia-offering-table-north')
    const office = mainlineScenes['zhongshuyuan-office']
    const desk = office.objects.find((entity) => entity.id === 'zhongshuyuan-office-desk')

    expect(incense && mainlineEntityUsesBreathing(interior, incense)).toBe(false)
    expect(incense && mainlineEntityUsesBreathing(interior, incense, true)).toBe(true)
    expect(offeringTable && mainlineEntityUsesBreathing(interior, offeringTable, true)).toBe(false)
    expect(desk && mainlineEntityUsesBreathing(office, desk)).toBe(true)
  })

  it('animates only the stove label through its rendered grid-content wrapper', async () => {
    const scene = mainlineScenes['yonghe-mining-perimeter']
    const stove = scene.objects.find(entity => entity.id === 'yonghe-stove')!
    const position = { x: stove.position.x, y: stove.position.y }
    const markup = renderToStaticMarkup(<MainlineSceneRenderer
      scene={scene} position={position} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={null}
      geometrySnapshot={createMainlineSceneGeometrySnapshot(scene, position, {}, sceneDesignReferenceMetrics)}
      viewportMetrics={sceneDesignReferenceMetrics} cameraOffset={{ x: 50 - position.x, y: 50 - position.y }}
      onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => {}} freezeFrameMeasurements
    />)
    const stoveButton = [...markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
      .map(match => match[0]).find(button => button.includes('data-object-id="yonghe-stove"'))
    expect(stoveButton).toMatch(/class="[^"]*scene-mainline-exploration--breathing[^"]*"[\s\S]*?<span class="scene-mainline-object__grid-content"><span class="scene-mainline-object__label"[^>]*>灶台<\/span><\/span>/)

    const sceneStyles = readFileSync(new URL('./scene.css', import.meta.url), 'utf8')
    expect(sceneStyles).toContain('.scene-mainline-exploration--breathing > .scene-mainline-object__grid-content > .scene-mainline-object__label {')
    expect(sceneStyles).not.toContain('.scene-mainline-exploration--breathing > .scene-mainline-object__label {')
  })

  it('renders the new speaker and a separate deleting outgoing dialogue layer together', () => {
    const scene = mainlineScenes['commercial-street']
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')!
    const position = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
    const line = { id: 'incoming-line', speaker: '老周' as const, text: '下一句正在打字' }
    const markup = renderToStaticMarkup(<MainlineSceneRenderer
      scene={scene} position={position} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={null}
      geometrySnapshot={createMainlineSceneGeometrySnapshot(scene, position, {}, sceneDesignReferenceMetrics)}
      viewportMetrics={sceneDesignReferenceMetrics} cameraOffset={{ x: 50 - position.x, y: 50 - position.y }}
      onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => {}} freezeFrameMeasurements
      dialogue={{ triggerEntityId: 'lao-zhou', lines: [line] }} dialogueLine={line} dialogueText={line.text}
      dialogueLineIndex={0} dialoguePosition={position} dialogueTextSessionId={4} dialogueTextMotion="typing"
      dialogueStage={{ roomId: room.id, speakerActorId: 'lao-zhou', participantActorIds: new Set(['protagonist', 'lao-zhou']), hiddenEntityIds: new Set() }}
      dialogueHandoffActive dialogueHandoffOutgoing={{ id: 9, text: '旧句正在删除', position: { x: position.x - 8, y: position.y }, durationMs: 300 }}
      readingMode="dialogue" onDialogueHandoffOutgoingDeleted={() => {}}
    />)

    expect(markup).toContain('data-dialogue-line-id="incoming-line"')
    expect(markup).toContain('data-dialogue-handoff-outgoing="9"')
    expect(markup).toContain('旧句正在删除')
    expect(markup).toContain('scene-mainline-text--handoff-outgoing')
  })
})
