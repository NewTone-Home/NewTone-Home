import { useEffect, useRef, useState } from 'react'

export const dialogueSpeakerTransitionMs = 150
export type SpeakerPresentation = { name: string; phase: 'steady' | 'entering' | 'exiting' }

export function requestSpeaker(current: SpeakerPresentation, requested: string): SpeakerPresentation {
  if (current.name === requested) return current.phase === 'exiting' ? { name: requested, phase: 'steady' } : current
  if (!current.name) return { name: requested, phase: requested ? 'entering' : 'steady' }
  return current.phase === 'exiting' ? current : { ...current, phase: 'exiting' }
}

export function completeSpeakerAnimation(current: SpeakerPresentation, requested: string): SpeakerPresentation {
  if (current.phase === 'exiting') return { name: requested, phase: requested ? 'entering' : 'steady' }
  return current.phase === 'entering' ? { ...current, phase: 'steady' } : current
}

/** One visible name; animation completion always consumes the latest speaker. */
export function DialogueSpeaker({ speaker }: { speaker: string }) {
  const requested = useRef(speaker)
  requested.current = speaker
  const [presentation, setPresentation] = useState<SpeakerPresentation>({ name: speaker, phase: speaker ? 'entering' : 'steady' })
  useEffect(() => setPresentation(current => requestSpeaker(current, speaker)), [speaker])
  return <span className="scene-mainline-text__speaker" data-speaker-phase={presentation.phase}
    style={{ '--speaker-half-duration': `${dialogueSpeakerTransitionMs / 2}ms` } as React.CSSProperties}
    onAnimationEnd={event => {
      if (event.target !== event.currentTarget || event.animationName !== `dialogue-speaker-${presentation.phase}`) return
      setPresentation(current => completeSpeakerAnimation(current, requested.current))
    }}>{presentation.name}</span>
}
