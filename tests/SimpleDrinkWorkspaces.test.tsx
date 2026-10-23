import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MainlineCounterSurface } from '../src/center/runtime/MainlineCounterSurface'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { findMainlinePath, findMainlinePathToEntity, resolveMainlineNpcPosition, isWalkableMainlinePoint, canTravelAlongMainlineSegment } from '../src/center/runtime/mainlineNavigation'
import { resolveMainlineSceneExploration, resolveMainlineSceneEchoChoice } from '../src/center/runtime/mainlineSceneInteractions'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
const scene=mainlineScenes['commercial-street'], options={screenMetrics:sceneDesignReferenceMetrics,actorId:'protagonist',actorFootprint:{width:11/19.2,height:11/10.8}}
const configs=[['cafe-trial','commercial-north-cafe-interior','cafe-coffee-owner',16,144,24,280],['milk-tea-trial','commercial-south-s5-interior','milk-tea-trial-worker',296,198,24,382],['fruit-tea-trial','commercial-north-n1-interior','fruit-tea-trial-worker',16,64,24,382]] as const
const context={incensePhase:'unlit',plantWatered:false,officeBlindsOpen:false,carriedPhoneDevice:'inner',commercialCafeCoffeeOrdered:false} as const

describe('simple drink workspaces: one visible worktop and shared counter entry',()=>{
 for(const [prefix,roomId,worker,x,y,width,height] of configs){
  const room=scene.rooms.find(r=>r.id===roomId)!,point=(x:number,y:number)=>({x:room.bounds.x+x/19.2,y:room.bounds.y+y/10.8}),parts=scene.continuousStructures.filter(p=>p.counterSurface?.roomId===roomId),worktop=parts.find(p=>p.id===prefix+'-worktop-body')!
  it(prefix+' has one physical worktop, one label and no hidden machine collision',()=>{
   for(const [actual,expected] of [[worktop.x,point(x,y).x],[worktop.y,point(x,y).y],[worktop.width,width/19.2],[worktop.height,height/10.8]])expect(actual).toBeCloseTo(expected,10)
   const html=renderToStaticMarkup(<MainlineCounterSurface parts={[worktop]} objects={scene.objects} onInteract={()=>{}}/>);expect(html.match(/data-counter-label=/g)).toHaveLength(1);expect(html).toContain('工作台</span>');expect(html).toContain('data-surface-role="worktop"')
   const aliases=scene.objects.filter(o=>o.counterSurfaceId===prefix+'-worktop'&&o.interactionAliasId);expect(aliases).toHaveLength(prefix==='fruit-tea-trial'?5:4);for(const o of aliases){expect(o.collision).toBeUndefined();expect(o.interactionStructureId).toBe(worktop.id)}
   expect(worktop.y).toBeGreaterThan(room.bounds.y);expect(worktop.y+worktop.height).toBeLessThan(room.bounds.y+room.bounds.height)
  })
  it(prefix+' keeps real staff floor at both ends and a route to the locked rear door',()=>{
   const staff={...options,actorId:worker,actorFootprint:{width:16/19.2,height:16/10.8}},start=resolveMainlineNpcPosition(scene,worker),rear=scene.passages.find(p=>p.id===roomId+'-rear-door')!
   expect(isWalkableMainlinePoint(start,scene,{},staff)).toBe(true);expect(rear.access).toBe('locked')
   const offset=prefix==='milk-tea-trial'?-24:width+24
   for(const target of [point(x+offset,y+16),point(x+offset,y+height-16),rear.thresholds[0]]){const path=findMainlinePath(start,target,scene,{},staff);expect(path).not.toBeNull();expect(isWalkableMainlinePoint(target,scene,{},staff)).toBe(true);for(let i=1;i<path!.length;i++)expect(canTravelAlongMainlineSegment(path![i-1],path![i],scene,{},staff)).toBe(true)}
  })
  it(prefix+' front and long counter contacts have legal public routes and one existing behavior',()=>{
   const front=scene.passages.find(p=>p.toRoomId===roomId&&p.routeThrough)!,counters=parts.filter(p=>p.counterSurface?.role!=='worktop')
   for(const body of counters){const id=body.counterSurface!.interactionEntityId,entity=scene.objects.find(o=>o.id===id)!,canonical=scene.objects.find(o=>o.id===entity.interactionAliasId)!;expect(canonical).toBeDefined();expect(resolveMainlineSceneExploration(scene,entity,context)).toEqual(resolveMainlineSceneExploration(scene,canonical,context));const contact=findMainlinePathToEntity(scene,id,front.crossingTargets[0],{},options);expect(contact.path).not.toBeNull();expect(isWalkableMainlinePoint(contact.target,scene,{},options)).toBe(true)}
  })
 }
 it('widens only takeaway staff bands and keeps their counter terminals physically closed',()=>{
  for(const [prefix,roomId] of configs.slice(1)){const parts=scene.continuousStructures.filter(p=>p.counterSurface?.roomId===roomId&&p.counterSurface.role!=='worktop'),long=parts.find(p=>p.counterSurface?.orientation==='vertical')!,horizontal=parts.find(p=>p.counterSurface?.orientation==='horizontal')!,room=scene.rooms.find(r=>r.id===roomId)!;expect((long.x-room.bounds.x)*19.2).toBeCloseTo(157,5);expect(long.width*19.2).toBeCloseTo(22,5);const region=scene.accessRegions.find(r=>r.id===prefix+'-staff-0')!;expect(region.width*19.2).toBeCloseTo(168,5);if(prefix==='milk-tea-trial')expect(horizontal.x+horizontal.width).toBeCloseTo(room.bounds.x+room.bounds.width-8/19.2,5);else expect(horizontal.x).toBeCloseTo(room.bounds.x+8/19.2,5)}
 })
 it('retains Cafe32px opening and renders its upper short counter without a label',()=>{
  const upper=scene.continuousStructures.find(p=>p.id==='cafe-trial-counter-upper-body')!,long=scene.continuousStructures.find(p=>p.id==='cafe-trial-counter-long-body')!;expect((long.y-upper.y-upper.height)*10.8).toBeCloseTo(32,5);const html=renderToStaticMarkup(<MainlineCounterSurface parts={[upper]} objects={scene.objects} onInteract={()=>{}}/>);expect(html).not.toContain('data-counter-label=');expect(html).toContain('data-counter-part-id=')
 })
 it('frames all six Cafe tables without changing their32x16 shape',()=>{
  const tables=scene.objects.filter(o=>o.roomId===configs[0][1]&&o.kind==='table');expect(tables).toHaveLength(6);for(const t of tables){expect(t.focusFrame).toBe('interactive');expect(t.shape!.width*19.2).toBeCloseTo(32,5);expect(t.shape!.height*10.8).toBeCloseTo(16,5)}
 })
 it('uses the original coffee-order state change from every Cafe counter leg, never a duplicate order',()=>{
  for(const body of scene.continuousStructures.filter(p=>p.counterSurface?.roomId===configs[0][1]&&p.counterSurface.role!=='worktop')){const entity=scene.objects.find(o=>o.id===body.counterSurface!.interactionEntityId)!;expect(resolveMainlineSceneEchoChoice(scene,entity,'点一杯咖啡',1,{commercialCafeCoffeeOrdered:false})?.stateChange?.value).toBe('ordered');expect(resolveMainlineSceneEchoChoice(scene,entity,'点一杯咖啡',1,{commercialCafeCoffeeOrdered:true})).toEqual({dismiss:true})}
 })
})
