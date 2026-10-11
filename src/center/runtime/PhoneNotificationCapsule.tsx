import {useEffect,useRef,useState} from 'react'
import type {PhoneNotification} from './phoneNotifications'

/** Notification identity owns the one-shot cue; rerenders and reloads do not replay it. */
export function PhoneNotificationCapsule({notifications,visible}:{notifications:readonly PhoneNotification[];visible:boolean}) {
 const seen=useRef(new Set(notifications.map(n=>n.id)))
 const [flow,setFlow]=useState<string|null>(null)
 useEffect(()=>{
  const incoming=notifications.filter(n=>n.unread&&!seen.current.has(n.id))
  for(const notification of notifications)seen.current.add(notification.id)
  if(!visible) setFlow(null)
  else if(incoming.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)setFlow(incoming[incoming.length-1].id)
 },[notifications,visible])
 const unread=notifications.some(n=>n.unread)
 return <span className="world-phone__handle-mark" aria-hidden="true">
  {unread&&flow&&<svg key={flow} className="world-phone__notification-flow" viewBox="0 0 90 10" onAnimationEnd={event=>{if(event.animationName==='phone-notification-flow')setFlow(null)}}>
   {[0,1,2,3,4,5,6].map(index=><path key={index} d="M89 5 A4 4 0 0 1 85 9 H5 A4 4 0 0 1 1 5 A4 4 0 0 1 5 1 H85 A4 4 0 0 1 89 5" pathLength="100" style={{'--tail':`${index*2.2}px`,opacity:Math.pow(.65,index),strokeWidth:index===0?1.8:1.3} as React.CSSProperties}/>)}</svg>}
  {unread&&(!flow||!visible)&&<i className="world-phone__notification-dot"/>}
 </span>
}
