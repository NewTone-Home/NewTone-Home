import type { MainlineSceneBlueprint, MainlineSceneEntity, MainlineFurnitureGroup } from './mainlineSceneModel'
import type { Point } from './sceneGeometry'

/** Visual trial only. From the right-hand front door the customer faces left. */
export function trialYongheInterior(blueprint: MainlineSceneBlueprint): MainlineSceneBlueprint {
  const data=blueprint.scene,room=data.rooms!.find(candidate=>candidate.id==='mining-shop-2-interior')!
  const point=(x:number,y:number):Point=>({x:room.bounds.x+x/1920*100,y:room.bounds.y+y/1080*100})
  const footprint=(x:number,y:number,width=32,height=16)=>({...point(x-width/2,y-height/2),width:width/1920*100,height:height/1080*100})
  const entities:MainlineSceneEntity[]=[],groups:MainlineFurnitureGroup[]=[]
  const fixture=(id:string,label:string,x:number,y:number):MainlineSceneEntity=>({id,label,kind:'fixture',weight:'fixture',surface:'floor',roomId:room.id,position:point(x,y),visualVisibility:'static',interactive:true,collision:footprint(x,y,Array.from(label).length*16)})
  const tableGroup=(groupId:string,x:number,y:number,outdoor=false,tableId=`${groupId}-table`,seatIds=[`${groupId}-chair-top`,`${groupId}-chair-bottom`])=>{
    const ownership=outdoor?undefined:room.id
    entities.push({...fixture(tableId,'桌子',x,y),roomId:ownership,kind:'table',weight:'anchor',groupId,shape:footprint(x,y),approach:point(x+44,y)})
    seatIds.forEach((id,index)=>{const direction=index===0?-1:1,rest=point(x,y+direction*22),pulled=point(x,y+direction*36)
      entities.push({...fixture(id,'椅子',x,y+direction*22),roomId:ownership,kind:'seat',weight:'minor',groupId,position:rest,approach:pulled,shape:footprint(x,y+direction*22),seat:{id,tableId,side:index===0?'top':'bottom',rest,pulled,sit:rest}})
    })
    groups.push({id:groupId,anchor:point(x,y),entityIds:[tableId,...seatIds]})
  }
  // Retain the original four table identities, not their obsolete independent-room positions.
  tableGroup('yonghe-upper-left-group',420,56)
  tableGroup('yonghe-upper-right-group',560,56)
  tableGroup('yonghe-lower-left-group',420,252)
  tableGroup('yonghe-lower-right-group',560,252)
  // The old two outdoor groups belong to this frontage; neither reaches a neighbour or lane centre.
  tableGroup('yonghe-outdoor-group-1',742,84,true,'yonghe-outdoor-table-1',['yonghe-outdoor-chair-1-top','yonghe-outdoor-chair-1-bottom'])
  tableGroup('yonghe-outdoor-group-2',742,252,true,'yonghe-outdoor-table-2',['yonghe-outdoor-chair-2-top','yonghe-outdoor-chair-2-bottom'])
  const counterId='yonghe-trial-counter-body'
  // The first16px cell meets the top wall; only the lower end is a staff opening.
  for(let index=0;index<16;index++){
    const entity=fixture(index===7?'yonghe-counter':`yonghe-trial-counter-${index}`,index%2?'台':'柜',224,16+index*16)
    delete entity.collision;entity.interactionStructureId=counterId;entity.interactionContactSides=['right'];entity.interactive=index===7
    entities.push(entity)
  }
  entities.push(fixture('yonghe-stove','灶台',84,224),fixture('yonghe-trial-board','菜板',140,224))
  entities.push({id:'yonghe-survey-central-lane',label:'观察',kind:'landmark',weight:'minor',surface:'floor',roomId:room.id,position:point(336,154),interactive:true,interactionRange:1,visualVisibility:'static'})
  const menu:MainlineSceneEntity={id:'yonghe-menu',label:'菜单',kind:'fixture',weight:'fixture',surface:'wall',roomId:room.id,position:point(616,0),interactive:true,interactionContactAnchor:point(616,28),visualVisibility:'static'}
  const oldRear=blueprint.portals.find(portal=>portal.id==='yonghe-back-door')!
  const rearPosition=point(0,252),dy=rearPosition.y-oldRear.endpoint.doorPosition.y
  const shift=(p:Point)=>({...p,y:p.y+dy})
  const backText='后门目前无法通行。仅凭眼前的情况，还看不出门后通向哪里。'
  return {...blueprint,
    portals:blueprint.portals.map(portal=>portal.id==='yonghe-back-door'?{...portal,
      entity:{...portal.entity,displayLabel:'门'},
      endpoint:{doorPosition:rearPosition,threshold:shift(portal.endpoint.threshold),crossingTarget:shift(portal.endpoint.crossingTarget)},
      // Replace the sole opening source; the previous centre is ordinary wall again.
      wallOpenings:[{wallId:`${room.id}-shell`,opening:{edge:'left',start:rearPosition.y-28/1080*100,end:rearPosition.y+28/1080*100,doorId:portal.id,labelLayout:'center',doorFlankCount:0}}],
      lockedText:backText,
    }:portal.id==='yonghe-street-entry'?{...portal,transitionText:'进入永和小馆。'}:portal),
    explorationText:{...blueprint.explorationText,
      'yonghe-upper-left-group-table':['店里的桌椅摆得紧凑，但桌与桌之间仍留着通行的空隙。'],
      'yonghe-counter':['柜台与灶台靠在一起，里面的工作区域没有向外延伸。'],
      'yonghe-survey-central-lane':['通道足够让人走过。桌椅虽然靠得近，却没有完全挡住去路。'],
      'yonghe-back-door':[backText],
      'yonghe-menu':['菜单在进门右手的墙上。'],
    },
    scene:{...data,
      floorEntities:[...data.floorEntities,...entities],furnitureGroups:[...data.furnitureGroups,...groups],
      walls:data.walls.map(wall=>wall.id===`${room.id}-shell`?{...wall,features:[...(wall.features??[]),{id:'yonghe-menu-wall',edge:'top',start:point(588,0).x,end:point(644,0).x,glyphs:['菜单'],layout:'content',entity:menu}]}:wall),
      continuousStructures:[...(data.continuousStructures??[]),{id:counterId,kind:'counter',...footprint(224,136,16,256)}],
      accessRegions:[...(data.accessRegions??[]),{id:'yonghe-trial-kitchen',...point(0,0),width:224/1920*100,height:308/1080*100,requiredAccess:'staff',deniedText:'这里是柜台里面的工作区。'}],
      actorAccess:{...data.actorAccess,'yonghe-trial-worker':['public','staff']},
      npcs:[...(data.npcs??[]),{id:'yonghe-trial-worker',roleId:'pedestrian',label:'人',roomId:room.id,interactive:false}],
      npcPlacements:[...(data.npcPlacements??[]),{npcId:'yonghe-trial-worker',position:point(168,154)}],
    },
  }
}
