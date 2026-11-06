import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import './EntryTextFade.css'

export const ENTRY_TEXT_FADE_MS = 180

export default function EntryTextFade({ value, className = '', style, reduced = false, onSettled }) {
  const target = String(value ?? '')
  const prefersReduced = useReducedMotion()
  const [displayed, setDisplayed] = useState(target)
  const [phase, setPhase] = useState('stable')
  const settled = useRef(target), generation = useRef(0), callback = useRef(onSettled)
  callback.current = onSettled
  useEffect(() => {
    const id = ++generation.current
    let incoming = 0
    if (target === settled.current || reduced || prefersReduced) {
      settled.current = target; setDisplayed(target); setPhase('stable')
      callback.current?.(target)
      return () => { generation.current++ }
    }
    setPhase('out')
    const outgoing = setTimeout(() => {
      if (id !== generation.current) return
      setDisplayed(target); setPhase('in')
      incoming = setTimeout(() => {
        if (id !== generation.current) return
        settled.current = target; setPhase('stable'); callback.current?.(target)
      }, ENTRY_TEXT_FADE_MS)
    }, ENTRY_TEXT_FADE_MS)
    return () => { generation.current++; clearTimeout(outgoing); clearTimeout(incoming) }
  }, [target, reduced, prefersReduced])
  return <span className={`entry-text-fade ${className}`} style={style} data-entry-text-fade={phase}>
    <span className="entry-text-fade__value" data-entry-text-fade-value={phase}>{displayed}</span>
  </span>
}
