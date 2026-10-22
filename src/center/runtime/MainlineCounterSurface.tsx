import { memo, useMemo } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { MainlineContinuousStructure, MainlineSceneEntity } from './mainlineSceneModel'
import { counterOutlineGeometry } from './counterOutlineGeometry'

function CounterSurface({parts,objects,onInteract}:{parts:readonly MainlineContinuousStructure[];objects:readonly MainlineSceneEntity[];onInteract:(id:string)=>void}){
 const rectangles=useMemo(()=>parts.map(p=>({x:p.x*19.2,y:p.y*10.8,width:p.width*19.2,height:p.height*10.8})),[parts])
 const geometry=useMemo(()=>counterOutlineGeometry(rectangles),[rectangles]),{bounds}=geometry
 const activate=(event:{stopPropagation:()=>void},id:string)=>{event.stopPropagation();onInteract(id)}
 const keyboard=(e:KeyboardEvent,id:string)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(e,id)}}
 const group=parts[0].counterSurface!.groupId
 const labelStyle:CSSProperties={display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:'100%',fontSize:16,fontFamily:'inherit',fontWeight:'inherit',letterSpacing:0,lineHeight:1,color:'inherit',background:'none',border:0,padding:0,cursor:'pointer'}
 return <svg data-counter-outline-group={group} aria-label="柜台" role="group" viewBox={`0 0 ${bounds.width} ${bounds.height}`} preserveAspectRatio="none" style={{position:'absolute',left:`${bounds.x/19.2}%`,top:`${bounds.y/10.8}%`,width:`${bounds.width/19.2}%`,height:`${bounds.height/10.8}%`,overflow:'visible',pointerEvents:'none',zIndex:3,color:'var(--interaction-normal)',opacity:.9}}>
  {parts.map((part,index)=>{const box=rectangles[index],meta=part.counterSurface!,vertical=meta.orientation==='vertical',labelWidth=vertical?16:32,labelHeight=vertical?32:16,labelId=meta.labelEntityId
   const services=objects.filter(e=>e.counterSurfaceId===group&&e.counterService&&e.interactionStructureId===part.id)
   return <g key={part.id}>
    <rect data-counter-part-id={part.id} data-counter-interaction-id={meta.interactionEntityId} x={box.x-bounds.x} y={box.y-bounds.y} width={box.width} height={box.height} fill="transparent" style={{pointerEvents:'all',cursor:'pointer'}} role="button" tabIndex={0} aria-label="柜台，查看" onClick={e=>activate(e,meta.interactionEntityId)} onKeyDown={e=>keyboard(e,meta.interactionEntityId)}/>
    {services.map(service=>{const center=vertical?service.position.y*10.8:service.position.x*19.2,start=vertical?box.y:box.x,length=vertical?box.height:box.width,span=Math.min(32,length),offset=Math.max(start,Math.min(start+length-span,center-span/2));return <rect key={service.id} data-counter-service-id={service.id} data-object-id={service.id!==labelId?service.id:undefined} x={(vertical?box.x:offset)-bounds.x} y={(vertical?offset:box.y)-bounds.y} width={vertical?box.width:span} height={vertical?span:box.height} fill="transparent" style={{pointerEvents:'all',cursor:'pointer'}} role="button" tabIndex={0} aria-label={`${service.label}，原服务位置`} onClick={e=>activate(e,service.id)} onKeyDown={e=>keyboard(e,service.id)}/>})}
    <foreignObject x={box.x+box.width/2-labelWidth/2-bounds.x} y={box.y+box.height/2-labelHeight/2-bounds.y} width={labelWidth} height={labelHeight} style={{overflow:'visible',pointerEvents:'all'}}>
     <button data-counter-label={meta.orientation} data-object-id={labelId} style={labelStyle} onClick={e=>activate(e,labelId)} aria-label="柜台，互动"><span style={{writingMode:vertical?'vertical-rl':'horizontal-tb',textOrientation:'upright',lineHeight:1}}>柜台</span></button>
    </foreignObject>
   </g>
  })}
  <path data-counter-outline-path={group} d={geometry.path} fill="none" stroke="currentColor" strokeWidth={1} strokeLinejoin="miter" style={{pointerEvents:'none'}}/>
 </svg>
}

export const MainlineCounterSurface = memo(CounterSurface)
