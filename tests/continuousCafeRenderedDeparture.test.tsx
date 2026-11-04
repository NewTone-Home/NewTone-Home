import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { MainlineSceneRenderer } from '../src/center/runtime/MainlineSceneRenderer'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
const scene=mainlineScenes['commercial-street'],position={x:127.313,y:19.1343}
const snapshot=createMainlineSceneGeometrySnapshot(scene,position,{},sceneDesignReferenceMetrics,new Map([['commercial-cafe-slot','revealed']]))
function npcMarkup(x:number,y:number,phase:'idle'|'moving',dutyId:string){const html=renderToStaticMarkup(<MainlineSceneRenderer scene={scene} position={position} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={null} geometrySnapshot={snapshot} viewportMetrics={sceneDesignReferenceMetrics} cameraOffset={{x:0,y:0}} onLayoutChange={()=>{}} onInteract={()=>{}} onWalk={()=>{}} freezeFrameMeasurements npcPositions={new Map([['lao-zhou',{x,y}]])} npcRuntimeSnapshots={new Map([['lao-zhou',{npcId:'lao-zhou',phase,dutyId,targetId:null,target:null,retryCount:0}]])}/>);return html.match(/<button[^>]*data-npc-id="lao-zhou"[^>]*>/)?.[0]??''}
describe('Cafe resident NPC rendered identity',()=>{
 it('renders Lao Zhou as an NPC with his seat used only as the seated pose anchor',()=>{
  const html=npcMarkup(135,12,'idle','lao-zhou.seated')
  expect(html).toContain('data-npc-id="lao-zhou"')
  expect(html).toContain('data-seat-entity-id="commercial-cafe-right-window-upper-group-chair-top"')
  // The layout trial moved this same story chair. Keep the anchor contract,
  // rather than asserting the previous three-table layout's numeric position.
  const seat=snapshot.objects.get('commercial-cafe-right-window-upper-group-chair-top')!.position
  expect(html).toContain(`left:${seat.x}%;top:${seat.y}%`)
 })
})
