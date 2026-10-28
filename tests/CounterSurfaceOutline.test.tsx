import { describe,expect,it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MainlineCounterSurface } from '../src/center/runtime/MainlineCounterSurface'
import { counterOutlineGeometry } from '../src/center/runtime/counterOutlineGeometry'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { findMainlinePathToEntity,isWalkableMainlinePoint,findMainlinePath,canTravelAlongMainlineSegment,resolveMainlineNpcPosition,mainlineEntityInteractionCandidates } from '../src/center/runtime/mainlineNavigation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
const scene=mainlineScenes['commercial-street'],options={screenMetrics:sceneDesignReferenceMetrics,actorId:'protagonist',actorFootprint:{width:11/19.2,height:11/10.8}}
describe('counter click contact',()=>{
 it('uses the clicked position along each physical segment for its contact',()=>{
  for(const groupId of ['cafe-trial-L-counter','milk-tea-trial-L-counter','fruit-tea-trial-L-counter']){
   for(const part of scene.continuousStructures.filter(p=>p.counterSurface?.groupId===groupId)){
    const vertical=part.counterSurface!.orientation==='vertical'
    const point=(fraction:number)=>({x:part.x+part.width*(vertical?.5:fraction),y:part.y+part.height*(vertical?fraction:.5)})
    const candidates=(fraction:number)=>mainlineEntityInteractionCandidates(scene,part.counterSurface!.interactionEntityId,point(.5),{},options.actorFootprint,{...options,interactionContactPoint:point(fraction)})[0]!
    expect(Math.abs((vertical?candidates(.8).y:candidates(.8).x)-(vertical?candidates(.2).y:candidates(.2).x))).toBeGreaterThan(.1)
   }
  }
 })
})
const configs=[['commercial-north-cafe-interior','cafe-trial-L-counter','cafe-trial-counter-front-0','bottom','cafe-coffee-owner'],['commercial-south-s5-interior','milk-tea-trial-L-counter','milk-tea-trial-front-return-0','top','milk-tea-trial-worker'],['commercial-north-n1-interior','fruit-tea-trial-L-counter','fruit-tea-trial-front-return-0','bottom','fruit-tea-trial-worker']] as const
const area=(p:{x:number;y:number}[])=>Math.abs(p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-b.x*a.y},0)/2)
describe('one exterior L counter, two labels and complete solid interaction',()=>{
 it('removes the shared joining edge while preserving the hollow inside corner',()=>{
  const geometry=counterOutlineGeometry([{x:0,y:0,width:16,height:100},{x:16,y:84,width:100,height:16}])
  expect(geometry.loops).toHaveLength(1);expect(geometry.loops[0]).toHaveLength(6);expect(area(geometry.loops[0])).toBe(3200);expect(geometry.path.match(/Z/g)).toHaveLength(1);expect(area(geometry.loops[0])).toBeLessThan(geometry.bounds.width*geometry.bounds.height)
 })
 for(const [roomId,groupId,frontId,side,worker] of configs){
  const parts=scene.continuousStructures.filter(p=>p.counterSurface?.groupId===groupId),front=scene.passages.find(p=>p.toRoomId===roomId&&p.routeThrough)!,room=scene.rooms.find(r=>r.id===roomId)!
  it(`${groupId}: one exterior only and exactly two centered labels`,()=>{
   const boxes=parts.map(p=>({x:p.x*19.2,y:p.y*10.8,width:p.width*19.2,height:p.height*10.8})),geometry=counterOutlineGeometry(boxes)
   expect(parts).toHaveLength(2);for(const part of parts)expect(part.counterSurface!.orientation==='vertical'?part.width*19.2:part.height*10.8).toBeCloseTo(22,5);expect(geometry.loops).toHaveLength(1);expect(geometry.loops[0]).toHaveLength(6);expect(area(geometry.loops[0])).toBeCloseTo(boxes.reduce((n,b)=>n+b.width*b.height,0),4)
   const html=renderToStaticMarkup(<MainlineCounterSurface parts={parts} objects={scene.objects} onInteract={()=>{}}/>)
   expect(html.match(/data-counter-outline-path=/g)).toHaveLength(1);expect(html.match(/data-counter-label=/g)).toHaveLength(2);expect(html.match(/data-counter-part-id=/g)).toHaveLength(2);expect(html).toContain('data-counter-label="horizontal"');expect(html).toContain('data-counter-label="vertical"');expect(html.match(/柜台<\/span>/g)).toHaveLength(2)
  })
  it(`${groupId}: front contact uses the public face and a real legal path`,()=>{
   const entity=scene.objects.find(o=>o.id===frontId)!,body=parts.find(p=>p.id===entity.interactionStructureId)!,result=findMainlinePathToEntity(scene,frontId,front.crossingTargets[0],{},options)
   expect(entity.interactionContactSides).toEqual([side]);expect(result.path).not.toBeNull();expect(isWalkableMainlinePoint(result.target,scene,{},options)).toBe(true)
   if(side==='top')expect(result.target.y).toBeLessThan(body.y);else expect(result.target.y).toBeGreaterThan(body.y+body.height)
   for(let i=1;i<result.path!.length;i++)expect(canTravelAlongMainlineSegment(result.path![i-1],result.path![i],scene,{},options)).toBe(true)
  })
  it(`${groupId}: both legs remain solid and the inside corner remains staff floor`,()=>{
   for(const body of parts){expect(isWalkableMainlinePoint({x:body.x+body.width/2,y:body.y+body.height*.15},scene,{},options)).toBe(false);expect(isWalkableMainlinePoint({x:body.x+body.width*.85,y:body.y+body.height/2},scene,{},options)).toBe(false)}
   const staff={...options,actorId:worker,actorFootprint:{width:16/19.2,height:16/10.8}},start=resolveMainlineNpcPosition(scene,worker),rear=scene.passages.find(p=>p.id===roomId+'-rear-door')!
   expect(isWalkableMainlinePoint(start,scene,{},staff)).toBe(true);expect(rear.access).toBe('locked');expect(findMainlinePath(start,rear.thresholds[0],scene,{},staff)).not.toBeNull();expect(isWalkableMainlinePoint({x:room.bounds.x+(worker.includes('milk')?248:worker.includes('fruit')?88:96)/19.2,y:room.bounds.y+350/10.8},scene,{},staff)).toBe(true)
  })
 }
 it('keeps Cafe short counter separated above the32px employee opening',()=>{
  const upper=scene.continuousStructures.find(p=>p.id==='cafe-trial-counter-upper-body')!,long=scene.continuousStructures.find(p=>p.id==='cafe-trial-counter-long-body')!;expect(upper.counterSurface!.groupId).not.toBe(long.counterSurface!.groupId);expect((long.y-upper.y-upper.height)*10.8).toBeCloseTo(32,5)
 })
 it('leaves spatial reading occlusion to the shared scene mask while keeping both part targets',()=>{
  const parts=scene.continuousStructures.filter(part=>part.counterSurface?.groupId==='cafe-trial-L-counter')
  const html=renderToStaticMarkup(<MainlineCounterSurface parts={parts} objects={scene.objects} onInteract={()=>{}}/>),svg=html.match(/<svg[^>]*data-counter-outline-group="cafe-trial-L-counter"[^>]*>/)?.[0]
  expect(svg).not.toContain('filter:')
  expect(html.match(/data-counter-part-id=/g)).toHaveLength(2)
  expect(html.match(/data-counter-outline-path=/g)).toHaveLength(1)
 })
 it('renders distinct small drink-app squares inside both beverage counters without replacing staff order or pickup targets',()=>{
  for(const [roomId,groupId,serviceId] of [
   ['commercial-south-s5-interior','milk-tea-trial-L-counter','commercial-s5-milk-tea-app-square'],
   ['commercial-north-n1-interior','fruit-tea-trial-L-counter','fruit-tea-trial-app-square'],
  ] as const){
   const parts=scene.continuousStructures.filter(p=>p.counterSurface?.groupId===groupId),counter=parts.find(part=>part.counterSurface!.services!.some(item=>item.id===serviceId))!,service=counter.counterSurface!.services!.find(item=>item.id===serviceId)!
   expect(service.visual).toBe('app-square')
   const hit=scene.objects.find(object=>object.id===serviceId)!
   expect(hit).toMatchObject({interactive:true,counterService:true,interactionStructureId:expect.any(String)})
   expect(hit.roomId).toBe(roomId)
   expect(service.position.x*19.2).toBeGreaterThan(counter.x*19.2)
   expect(service.position.x*19.2).toBeLessThan((counter.x+counter.width)*19.2)
   expect(18).toBeLessThan(counter.width*19.2)
   const ordinaryServices=counter.counterSurface!.services!.filter(item=>item.visual!== 'app-square')
   expect(ordinaryServices.every(item=>Math.abs(item.position.y-service.position.y)*10.8>28)).toBe(true)
   const markup=renderToStaticMarkup(<MainlineCounterSurface parts={parts} objects={scene.objects} onInteract={()=>{}}/>), box=markup.match(new RegExp(`<foreignObject[^>]*data-counter-service-box="${serviceId}"[^>]*>`))?.[0]!
   expect(box).toContain('width="18"');expect(box).toContain('height="18"')
   expect(markup).toContain(`data-counter-service-id="${serviceId}"`);expect(markup).toContain('data-counter-app-square="true"')
   expect(scene.objects.some(object=>object.id===serviceId.replace('app-square','order-service-label')||object.id===serviceId.replace('app-square','order'))).toBe(true)
  }
 })
 it('uses the counter legs as the human service target without a second boxed counter',()=>{
  for(const [groupId, serviceId] of [
   ['cafe-trial-L-counter','commercial-cafe-counter'],
   ['milk-tea-trial-L-counter','commercial-s5-milk-tea-order-service-label'],
   ['fruit-tea-trial-L-counter','fruit-tea-trial-order'],
  ] as const){
   const parts=scene.continuousStructures.filter(p=>p.counterSurface?.groupId===groupId)
   const markup=renderToStaticMarkup(<MainlineCounterSurface parts={parts} objects={scene.objects} onInteract={()=>{}}/>)
   expect(parts).toHaveLength(2)
   expect(markup.match(new RegExp(`data-counter-interaction-id="${serviceId}"`,'g'))).toHaveLength(2)
   expect(markup).not.toContain(`data-counter-service-box="${serviceId}"`)
   expect(scene.objects.find(o=>o.id===serviceId)).toMatchObject({interactive:true,counterService:true})
  }
 })
 it('moves only the Cafe menu inside the work-side wall and keeps equipment clear of that wall',()=>{
  for(const [roomId,groupId] of configs){
   const prefix=groupId.startsWith('milk')?'milk-tea-trial':groupId.startsWith('fruit')?'fruit-tea-trial':'cafe-trial'
   const worktop=scene.continuousStructures.find(body=>body.id===`${prefix}-worktop-body`)!
   const aliases=scene.objects.filter(o=>o.roomId===roomId&&(o.id.startsWith(`${prefix}-equipment-`)||['cafe-trial-coffee-machine','cafe-trial-prep-table','cafe-trial-wash','cafe-trial-cold'].includes(o.id)))
   expect(aliases.length).toBeGreaterThanOrEqual(4)
   expect(worktop.counterSurface?.role).toBe('worktop')
   expect(worktop.width*19.2).toBe(24)
   for(const device of aliases){
    expect(device).toMatchObject({interactive:true,counterSurfaceId:`${prefix}-worktop`,interactionStructureId:`${prefix}-worktop-body`,interactionAliasId:`${prefix}-worktop-0`})
    expect(device.collision).toBeUndefined()
   }
   expect(worktop.height*10.8).toBeGreaterThanOrEqual(16)
  }
  for(const [id,roomId,y] of [['commercial-cafe-menu','commercial-north-cafe-interior',392],['commercial-cafe-blackboard','commercial-north-cafe-interior',252],['commercial-s5-milk-tea-menu-service-label','commercial-south-s5-interior',56],['fruit-tea-trial-menu','commercial-north-n1-interior',588]] as const){const room=scene.rooms.find(r=>r.id===roomId)!,entity=scene.objects.find(o=>o.id===id)!;expect(entity.surface).toBe('wall');expect((entity.position.y-room.bounds.y)*10.8).toBeCloseTo(y,5)}
 })
 it('keeps one Café order entry while retaining the other shops’ existing counter targets',()=>{
  const cafeRoomId='commercial-north-cafe-interior'
  expect(scene.objects.filter(o=>o.roomId===cafeRoomId&&o.counterSurfaceId&&o.interactionBehavior==='cafe-order').map(o=>o.id)).toEqual(['commercial-cafe-counter'])
  expect(scene.objects.filter(o=>o.counterService).map(o=>o.id).sort()).toEqual(['commercial-cafe-counter','commercial-cafe-app-square','commercial-s5-milk-tea-order-service-label','fruit-tea-trial-order','commercial-s5-milk-tea-app-square','fruit-tea-trial-app-square'].sort())
  for(const o of scene.objects.filter(o=>o.counterSurfaceId&&!o.counterService))expect(o.interactionBehavior).toBeUndefined()
 })
})
