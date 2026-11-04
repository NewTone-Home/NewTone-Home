import type {MainlineSceneDefinition} from '../../src/center/runtime/mainlineScenes'
export function gridSemanticContract(s:MainlineSceneDefinition){
 return {
  objects:s.objects.map(o=>({id:o.id,label:o.label,displayLabel:o.displayLabel,roomId:o.roomId,kind:o.kind,weight:o.weight,interactive:o.interactive,groupId:o.groupId,interactionBehavior:o.interactionBehavior,doorBehavior:o.doorBehavior,seat:o.seat?{id:o.seat.id,tableId:o.seat.tableId,side:o.seat.side}:undefined})),
  portals:s.portals.map(p=>({id:p.id,access:p.access,targetSceneId:p.targetSceneId,routeThrough:p.routeThrough,fromRoomId:p.fromRoomId,toRoomId:p.toRoomId,lockedText:p.lockedText,transitionText:p.transitionText})),
  rooms:s.rooms.map(r=>({id:r.id,kind:r.kind})),npcs:s.npcs,npcBehaviors:s.npcBehaviors,
  interactionText:s.interactionText,explorationText:s.explorationText,echoPool:s.echoPool,dialogue:s.dialogue,
 }
}
