import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { phonePublicPlaces } from './phoneMapModel'
const time = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function PhonePlaceDetails({ id, title, onRide, onCall, onHeight }: {
  id: string | null; title: string | null; onRide: () => void; onCall: () => void; onHeight: (height: number) => void
}) {
  const [content, setContent] = useState<{ id: string; title: string } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => { if (id && title) { setContent({ id, title }); setExpanded(false) } }, [id, title])
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || !id) { onHeight(0); return }
    const measure = () => onHeight(element.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [content, id, onHeight])
  if (!content) return null
  const place = phonePublicPlaces[content.id]
  const hours = place?.hours?.map(([start, end]) => `${time(start)}–${time(end)}`).join(' / ')
  return <section ref={ref} className="world-phone__map-detail" data-open={Boolean(id)} aria-label={`${content.title}地点详情`} aria-hidden={!id} inert={!id} onAnimationEnd={event => { if (event.target === event.currentTarget && !id) setContent(null) }}>
    <div className="world-phone__detail-heading"><strong>{content.title}</strong></div>
    {place?.category && <span>{place.category}</span>}
    {place?.description && <p>{place.description}</p>}
    <p>地址 · {place?.address ?? content.title}</p>
    {hours && <div className="world-phone__business-hours"><strong>营业时间</strong><span>{hours}</span>
      {!expanded ? <button onClick={() => setExpanded(true)} aria-expanded={false}>查看全部营业时间</button> : <dl className="world-phone__weekly-hours">{weekdays.map(day => <div key={day}><dt>{day}</dt><dd>{hours}</dd></div>)}</dl>}
    </div>}
    <div className="world-phone__detail-actions"><button onClick={onRide}>叫车前往</button>{place?.phone && <button onClick={onCall}>电话 {place.phone}</button>}</div>
  </section>
}
