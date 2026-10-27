import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MainlineSceneRenderer } from '../../src/center/runtime/MainlineSceneRenderer'
import { mainlineScenes } from '../../src/center/runtime/mainlineScenes'
import { createMainlineSceneGeometrySnapshot } from '../../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineDialogueFurnitureGroupIds, mainlineDialogueStageHiddenEntityIds } from '../../src/center/runtime/mainlineDialogueStage'
import { commercialCafeLaoZhouConversationSeatId } from '../../src/center/runtime/commercialCafeStory'
import '../../src/center/runtime/scene.css'

function Fixture() {
  const scene = mainlineScenes['commercial-street']
  const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')!
  const [stageSpeakerActorId, setStageSpeakerActorId] = useState<string | null>('protagonist')
  const seatId = commercialCafeLaoZhouConversationSeatId
  const groups = mainlineDialogueFurnitureGroupIds(scene.objects, new Set([seatId]))
  const stage = {
    roomId: room.id,
    speakerActorId: stageSpeakerActorId,
    participantActorIds: new Set(['protagonist', 'lao-zhou']),
    hiddenEntityIds: mainlineDialogueStageHiddenEntityIds({ entities: scene.objects, roomId: room.id, protectedEntityIds: new Set(['lao-zhou']), protectedFurnitureGroupIds: groups }),
  }
  const [lineIndex, setLineIndex] = useState(0)
  const [motion, setMotion] = useState<'typing' | 'static' | 'deleting' | 'deleted'>('typing')
  const [sessionId, setSessionId] = useState(1)
  const [handoff, setHandoff] = useState(false)
  const lines = [
    { id: 'fixture-first-line', speaker: '修杰' as const, text: '陈副部长还是没有消息吗？' },
    { id: 'fixture-second-line', speaker: '老周' as const, speakerNpcId: 'lao-zhou', text: '还没有。' },
  ]
  const line = lines[lineIndex]!
  const position = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
  const metrics = { width: innerWidth, height: innerHeight, viewportWidth: innerWidth }
  const geometry = createMainlineSceneGeometrySnapshot(scene, position, {}, metrics)
  const onMotionComplete = (_id: number, nextMotion: 'typing' | 'static' | 'deleting' | 'deleted') => {
    if (nextMotion === 'typing') setMotion('static')
    if (nextMotion === 'deleting') {
      setMotion('typing')
      setHandoff(false)
      setLineIndex(1)
      setSessionId(value => value + 1)
      setStageSpeakerActorId('lao-zhou')
    }
  }
  return <div className="mainline-scene--map-only">
    <MainlineSceneRenderer scene={scene} position={position} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={null} geometrySnapshot={geometry} viewportMetrics={metrics} cameraOffset={{ x: 50 - position.x, y: 50 - position.y }} onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => {}} dialogue={{ triggerEntityId: 'fixture-dialogue', lines }} dialogueLine={line} dialogueText={line.text} dialoguePosition={{ x: 70, y: 42 }} dialogueLineIndex={lineIndex} dialogueSegmentIndex={0} dialogueSegmentCount={1} dialogueTextSessionId={sessionId} dialogueTextMotion={motion} readingMode="dialogue" dialogueStage={stage} dialogueHandoffActive={handoff} dialogueHandoffFadeDurationMs={300} onDialogueTypingSkip={() => setMotion('static')} onDialogueAdvance={() => { setHandoff(true); setMotion('deleting') }} onDialogueTextMotionComplete={onMotionComplete} />
    <button data-fixture-fast-skip onClick={() => { setHandoff(true); setMotion('deleting') }}>handoff</button>
  </div>
}

createRoot(document.getElementById('root')!).render(<Fixture />)
