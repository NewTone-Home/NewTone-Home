import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { MainlineSceneRenderer } from '../src/center/runtime/MainlineSceneRenderer'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
const scene=mainlineScenes['commercial-street'],position={x:127.313,y:19.1343}
const snapshot=createMainlineSceneGeometrySnapshot(scene,position,{},sceneDesignReferenceMetrics,new Map([['commercial-cafe-slot','revealed']]))
function npcMarkup(x:number,y:number,phase:'idle'|'moving',dutyId:string){const html=renderToStaticMarkup(<MainlineSceneRenderer scene={scene} position={position} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={null} geometrySnapshot={snapshot} viewportMetrics={sceneDesignReferenceMetrics} cameraOffset={{x:0,y:0}} onLayoutChange={()=>{}} onInteract={()=>{}} onWalk={()=>{}} freezeFrameMeasurements npcPositions={new Map([['lao-zhou',{x,y}]])} npcRuntimeSnapshots={new Map([['lao-zhou',{npcId:'lao-zhou',phase,dutyId,targetId:null,target:null,retryCount:0}]])}/>);return html.match(/<button[^>]*data-npc-id="lao-zhou"[^>]*>/)?.[0]??''}
describe('Cafe NPC rendered departure position',()=>{
 it('renders two distinct live positions after leaving the sitting duty, rather than holding the configured seat',()=>{
  const first=npcMarkup(135,12,'moving','lao-zhou.exit-cafe'),second=npcMarkup(123,30,'moving','lao-zhou.exit-cafe')
  expect(first).toContain('left:135%;top:12%');expect(second).toContain('left:123%;top:30%')
  expect(first).not.toContain('data-seat-entity-id');expect(second).not.toContain('data-seat-entity-id')
 })
 it('retains the chair-centered label while the actual sitting duty is active',()=>{
  const html=npcMarkup(135,12,'idle','lao-zhou.seated')
  expect(html).toContain('data-seat-entity-id="commercial-cafe-right-window-upper-group-chair-top"')
  expect(html).toContain('left:141.79166666666666%;top:8.259066666666676%')
 })
})
