import type { MainlineSceneBlueprint, MainlineSceneEntity, MainlineFurnitureGroup, MainlineContinuousStructure, MainlineScenePortalBlueprint } from './mainlineSceneModel'
import type { Point } from './sceneGeometry'

/** Visual trial only. From the right-hand front door the customer faces left. */
export function trialYongheInterior(blueprint: MainlineSceneBlueprint): MainlineSceneBlueprint {
  const data=blueprint.scene,room=data.rooms!.find(candidate=>candidate.id==='mining-shop-2-interior')!,frontX=room.bounds.width*1920/100
  const point=(x:number,y:number):Point=>({x:room.bounds.x+(frontX-y)/1920*100,y:room.bounds.y+x/1080*100})
  const footprint=(x:number,y:number,width=32,height=16)=>{const center=point(x,y),worldWidth=height/1920*100,worldHeight=width/1080*100;return {x:center.x-worldWidth/2,y:center.y-worldHeight/2,width:worldWidth,height:worldHeight}};
  const entities:MainlineSceneEntity[]=[],groups:MainlineFurnitureGroup[]=[],structures:MainlineContinuousStructure[]=[]
  const rect=(x:number,y:number,width:number,height:number)=>{const center=point(x+width/2,y+height/2);return {x:center.x-height/1920*50,y:center.y-width/1080*50,width:height/1920*100,height:width/1080*100}}
  const addSurface=(id:string,groupId:string,box:{x:number;y:number;width:number;height:number},orientation:'horizontal'|'vertical',entityId:string,role:'counter'|'worktop',hideLabel=true,outline={x:box.x,y:box.y,width:box.width,height:box.height},surfaceRoomId=room.id)=>{
    structures.push({id,kind:'counter',...rect(box.x,box.y,box.width,box.height),counterSurface:{groupId,roomId:surfaceRoomId,interactionEntityId:entityId,labelEntityId:entityId,orientation,role,label:role==='worktop'?'\u5de5\u4f5c\u53f0':undefined,hideLabel,outlineBounds:rect(outline.x,outline.y,outline.width,outline.height)}})
  }
  const fixture=(id:string,label:string,x:number,y:number):MainlineSceneEntity=>({id,label,kind:'fixture',weight:'fixture',surface:'floor',roomId:room.id,position:point(x,y),visualVisibility:'static',interactive:true,collision:footprint(x,y,Array.from(label).length*16)})
  const tableGroup=(groupId:string,x:number,y:number,outdoor=false,tableId=`${groupId}-table`,seatIds=[`${groupId}-chair-top`,`${groupId}-chair-bottom`])=>{
    const ownership=outdoor?undefined:room.id
    const spaceOwnership=outdoor?'mining-street-public-lane':undefined
    const tableLabel=outdoor?'\u684c':'\u684c\u5b50'
    entities.push({...fixture(tableId,tableLabel,x,y),roomId:ownership,spaceId:spaceOwnership,kind:'table',weight:'anchor',groupId,textLayout:outdoor?'vertical':undefined,focusFrame:'interactive',shape:footprint(x,y,outdoor?16:32),approach:point(x+44,y)})
    seatIds.forEach((id,index)=>{const direction=index===0?-1:1,seatX=outdoor?x:x+direction*30,seatY=outdoor?y+direction*28:y,rest=point(seatX,seatY),pulled=outdoor?point(x+22,seatY):point(x+direction*52,y)
      entities.push({...fixture(id,outdoor?'\u6905':'\u6905\u5b50',seatX,seatY),roomId:ownership,spaceId:spaceOwnership,kind:'seat',weight:'minor',groupId,textLayout:outdoor?'vertical':undefined,position:rest,approach:pulled,shape:footprint(seatX,seatY,outdoor?16:32),seat:{id,tableId,side:index===0?'top':'bottom',rest,pulled,sit:rest}})
    })
    groups.push({id:groupId,anchor:point(x,y),entityIds:[tableId,...seatIds]})
  }
  // Retain the original four table identities, not their obsolete independent-room positions.
  tableGroup('yonghe-upper-left-group',420,56)
  tableGroup('yonghe-upper-right-group',532,56)
  tableGroup('yonghe-lower-left-group',420,252)
  tableGroup('yonghe-lower-right-group',532,252)
  // The old two outdoor groups belong to this frontage; neither reaches a neighbour or lane centre.
  tableGroup('yonghe-outdoor-group-1',616,56,true,'yonghe-outdoor-table-1',['yonghe-outdoor-chair-1-top','yonghe-outdoor-chair-1-bottom'])
  tableGroup('yonghe-outdoor-group-2',616,252,true,'yonghe-outdoor-table-2',['yonghe-outdoor-chair-2-top','yonghe-outdoor-chair-2-bottom'])
  const counterId='yonghe-trial-counter-body'
  // The first16px cell meets the top wall; only the lower end is a staff opening.
  for(let index=0;index<16;index++){
    const entity=fixture(index===7?'yonghe-counter':`yonghe-trial-counter-${index}`,index%2?'台':'柜',224,8+index*16)
    delete entity.collision;entity.interactionStructureId=counterId;entity.counterSurfaceId=counterId;entity.interactionContactSides=['bottom'];entity.interactive=index===7
    entities.push(entity)
  }
  addSurface(counterId,'yonghe-trial-counter-line',{x:216,y:0,width:16,height:256},'horizontal','yonghe-counter','counter',false,{x:212,y:-14,width:24,height:274})
  // The two framed legs overlap at the rear/right corner to form one continuous L.
  addSurface('yonghe-trial-worktop-back-body','yonghe-trial-worktop-L',{x:10,y:10,width:24,height:246},'horizontal','yonghe-stove','worktop',true)
  addSurface('yonghe-trial-worktop-right-body','yonghe-trial-worktop-L',{x:10,y:10,width:180,height:24},'vertical','yonghe-trial-board','worktop',true)
  const stove=fixture('yonghe-stove','灶台',102,22),board=fixture('yonghe-trial-board','菜板',22,100)
  stove.textLayout='vertical'
  stove.animationGroup='yonghe-stove-breathing'
  entities.push(stove,board)
  const menuAnchorX = 406
  const menuHalfSpan = 28
  const menu:MainlineSceneEntity={id:'yonghe-menu',label:'菜单',kind:'fixture',weight:'fixture',surface:'wall',roomId:room.id,position:point(menuAnchorX,0),textLayout:'vertical',interactive:true,interactionContactAnchor:point(menuAnchorX,28),visualVisibility:'static'}
  const rearPosition=point(0,280)
  const rearStep=28/1080*100
  const rearXStep=28/1920*100
  return {...blueprint,
    portals:[...blueprint.portals.map<MainlineScenePortalBlueprint>(portal=>portal.id==='yonghe-back-door'?{...portal,
      entity:{...portal.entity,displayLabel:'门'},
      endpoint:{doorPosition:rearPosition,threshold:{x:rearPosition.x,y:rearPosition.y-1.5*rearStep},crossingTarget:{x:rearPosition.x,y:rearPosition.y+1.5*rearStep}},
      // Replace the sole opening source; the previous centre is ordinary wall again.
      wallOpenings:[{wallId:'mining-shop-2-interior-shell',opening:{edge:'top',start:rearPosition.x-rearXStep,end:rearPosition.x+rearXStep,doorId:portal.id,labelLayout:'center',doorFlankCount:0}}],
      lockedText:undefined,
      transitionText:'',
    }:portal.id==='yonghe-street-entry'?{...portal,transitionText:'进入永和小馆。'}:portal)],
    explorationText:{...blueprint.explorationText,
      'yonghe-upper-left-group-table':['店里的桌椅摆得紧凑，但桌与桌之间仍留着通行的空隙。'],
      'yonghe-back-door':[],
      'yonghe-menu':['菜单在进门右手的墙上。'],
    },
    scene:{...data,
      floorEntities:[...data.floorEntities,...entities],furnitureGroups:[...data.furnitureGroups,...groups],
      walls:data.walls.map(wall=>wall.id===`${room.id}-shell`?{...wall,features:[...(wall.features??[]),{id:'yonghe-menu-wall',edge:'right',start:point(menuAnchorX-menuHalfSpan,0).y,end:point(menuAnchorX+menuHalfSpan,0).y,glyphs:['菜','单'],layout:'content',entity:menu}]}:wall),
      continuousStructures:[...(data.continuousStructures??[]),...structures],
      accessRegions:[...(data.accessRegions??[]),{id:'yonghe-trial-kitchen',...point(0,256),width:256/1920*100,height:216/1080*100,requiredAccess:'staff',deniedText:'厨房重地，闲人免进。'}],
      // One finite line from the board side down to the counter's left end; the walls and counter close the other sides.
      accessBoundaries:[...(data.accessBoundaries??[]),{id:'yonghe-trial-kitchen-left-access-boundary',regionId:'yonghe-trial-kitchen',edge:'left' as const}],
      navigationBarriers:[...(data.navigationBarriers??[]),...groups.flatMap(group=>group.entityIds.slice(1).map(id=>({id:`${id}-table-gap`,firstEntityId:group.entityIds[0],secondEntityId:id})))],
      actorAccess:{...data.actorAccess,'yonghe-trial-worker':['public','staff']},
      npcBehaviorTargets:[...(data.npcBehaviorTargets??[]),{id:'yonghe-worker-counter-station',position:point(168,154)},{id:'yonghe-worker-prep-station',position:point(96,90)}],
      npcBehaviors:[...(data.npcBehaviors??[]),{npcId:'yonghe-trial-worker',dutyId:'yonghe-counter-service',targetId:'yonghe-worker-counter-station',targetKind:'point',interactionContactEntityId:'yonghe-counter'}],
      npcs:[...(data.npcs??[]),{id:'yonghe-trial-worker',roleId:'pedestrian',label:'老板娘',roomId:room.id,interactive:true}],
      npcPlacements:[...(data.npcPlacements??[]),{npcId:'yonghe-trial-worker',position:point(168,154)}],
    },
  }
}
