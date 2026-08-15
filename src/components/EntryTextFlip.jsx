import { useCallback, useEffect, useRef, useState } from 'react'
import './EntryTextFlip.css'

export const ENTRY_TEXT_FLIP_DURATION_MS = 360

function normalizeText(value) {
  return String(value ?? '')
}

function EntryTextFlip({ value, direction = 'down', className = '', style }) {
  const nextValue = normalizeText(value)
  const settledValueRef = useRef(nextValue)
  const transitionRef = useRef({ from: nextValue, to: nextValue, direction })
  const motionRef = useRef('idle')
  const [transition, setTransition] = useState(transitionRef.current)
  const [motion, setMotion] = useState('idle')

  useEffect(() => {
    if (nextValue === settledValueRef.current || motionRef.current === 'moving') return undefined

    const nextTransition = {
      from: settledValueRef.current,
      to: nextValue,
      direction,
    }
    transitionRef.current = nextTransition
    motionRef.current = 'reset'
    setTransition(nextTransition)
    setMotion('reset')

    let secondFrame = 0
    const frame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (transitionRef.current !== nextTransition) return
        motionRef.current = 'moving'
        setMotion('moving')
      })
    })

    return () => {
      window.cancelAnimationFrame(frame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [direction, nextValue])

  const handleTransitionEnd = useCallback(event => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
    if (motionRef.current !== 'moving') return

    settledValueRef.current = transitionRef.current.to
    motionRef.current = 'idle'
    setTransition(current => ({
      from: transitionRef.current.to,
      to: transitionRef.current.to,
      direction: current.direction,
    }))
    setMotion('idle')
  }, [])

  const slotValues = transition.direction === 'down'
    ? [transition.to, transition.from]
    : [transition.from, transition.to]

  return (
    <span
      className={['entry-text-flip', className].filter(Boolean).join(' ')}
      style={style}
      data-entry-text-flip="true"
      data-entry-text-flip-motion={motion}
      data-entry-text-flip-direction={transition.direction}
    >
      <span
        className="entry-text-flip__track"
        data-entry-text-flip-motion={motion}
        data-entry-text-flip-direction={transition.direction}
        onTransitionEnd={handleTransitionEnd}
      >
        {slotValues.map((slotValue, index) => (
          <span className="entry-text-flip__slot" key={`${slotValue}:${index}`} aria-hidden="true">
            {slotValue}
          </span>
        ))}
      </span>
    </span>
  )
}

export default EntryTextFlip
