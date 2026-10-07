import { useState } from 'react'
import { mainlineStoryTimeLabel, type MainlineStoryClock } from './mainlineStoryClock'
import { phonePublicPlaces, phoneBusinessStatus } from './phoneMapModel'
const time=(m:number)=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
export function PhonePlaceDetails({id,title,clock,onClose,onRide,onCall}:{id:string;title:string;clock:MainlineStoryClock;onClose:()=>void;onRide:()=>void;onCall:()=>void}) {
 const [expanded,setExpanded]=useState(false)
 const place=phonePublicPlaces[id]
 const [hour,minute]=mainlineStoryTimeLabel(clock.stage).split(':').map(Number)
 const status=place?.hours ? phoneBusinessStatus(place.hours,hour*60+minute) : null
 return <section className="world-phone__map-detail" aria-label={`${title}地点详情`}>
  <div className="world-phone__detail-heading"><strong>{title}</strong><button aria-label="关闭地点详情" onClick={onClose}>收起</button></div>
  {place?.category && <span>{place.category}</span>}
  {place?.description && <p>{place.description}</p>}
  <p>地址 · {place?.address ?? title}</p>
  {status && <div className="world-phone__business-hours"><strong>{status.open?'营业中':'休息中'}</strong><span>{time(status.nextMinutes)} {status.open?'结束营业':'开始营业'}</span><button onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>查看全部营业时间</button>{expanded && place?.hours?.map(([start,end])=><p key={start}>{time(start)}–{time(end)}</p>)}</div>}
  <div className="world-phone__detail-actions"><button onClick={onRide}>叫车前往</button>{place?.phone && <button onClick={onCall}>电话 {place.phone}</button>}</div>
 </section>
}
