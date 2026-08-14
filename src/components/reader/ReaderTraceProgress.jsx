import { useEffect, useRef, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import { getReaderProgressPercentage } from '../../reader/readerPresentation'

export function getPageSceneTrail(beats, focusBeatIndex) {
  const safeBeats = Array.isArray(beats) ? beats : []
  const trail = []
  safeBeats.forEach((beat, beatIndex) => {
    const state = beat?.worldState
    if (!state?.locationId) return
    const previous = trail[trail.length - 1]
    if (previous?.locationId === state.locationId) {
      previous.lastBeatIndex = beatIndex
      return
    }
    trail.push({
      locationId: state.locationId,
      firstBeatIndex: beatIndex,
      lastBeatIndex: beatIndex,
    })
  })
  return trail.map(item => ({
    ...item,
    state: focusBeatIndex > item.lastBeatIndex
      ? 'past'
      : focusBeatIndex >= item.firstBeatIndex
        ? 'current'
        : 'future',
  }))
}

function ReaderTraceProgress({ progress, beats, focusBeatIndex, language, readingMode, returningToLanding = false }) {
  const percentage = getReaderProgressPercentage(progress)
  const [visualProgress, setVisualProgress] = useState(() => percentage / 100)
  const visualProgressRef = useRef(percentage / 100)
  const targetProgressRef = useRef(percentage / 100)
  const frameRef = useRef(0)
  const lastFrameRef = useRef(0)
  const ui = getReaderUi(language)
  const trail = readingMode === 'immersive' ? getPageSceneTrail(beats, focusBeatIndex) : []
  const complete = percentage >= 100 && !returningToLanding

  useEffect(() => {
    targetProgressRef.current = percentage / 100
    if (frameRef.current) return undefined

    const follow = time => {
      const delta = lastFrameRef.current ? Math.min(48, time - lastFrameRef.current) : 16
      lastFrameRef.current = time
      const current = visualProgressRef.current
      const target = targetProgressRef.current
      const followRate = 1 - Math.exp(-delta / 1900)
      const next = current + (target - current) * followRate
      visualProgressRef.current = Math.abs(target - next) < 0.0005 ? target : next
      setVisualProgress(visualProgressRef.current)
      if (visualProgressRef.current === targetProgressRef.current) {
        frameRef.current = 0
        lastFrameRef.current = 0
        return
      }
      frameRef.current = window.setTimeout(() => follow(window.performance.now()), 16)
    }

    frameRef.current = window.setTimeout(() => follow(window.performance.now()), 16)
    return undefined
  }, [percentage])

  useEffect(() => () => {
    window.clearTimeout(frameRef.current)
    frameRef.current = 0
    lastFrameRef.current = 0
  }, [])

  const visualRemaining = Math.max(0, Math.min(100, Math.round((1 - visualProgress) * 100)))
  const tailCompression = Math.max(0, (visualProgress - 0.9) / 0.1)
  const featherSpan = 20 - 18 * tailCompression
  const featherStart = Math.max(0, visualProgress * 100 - featherSpan)
  const featherEnd = Math.min(99.5, visualProgress * 100 + 24)
  const tailStrength = 0.72 - visualProgress * 0.5

  return (
    <div
      className={`reader-trace${complete ? ' is-complete' : ''}${returningToLanding ? ' is-returning' : ''}`}
      role="progressbar"
      aria-label={ui.readingProgress}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={percentage}
      data-progress={percentage}
      data-returning-to-landing={returningToLanding ? 'true' : 'false'}
      data-page-scenes={trail.filter(item => item.state !== 'future').map(item => item.locationId).join(' ')}
      style={{
        '--reader-progress': percentage / 100,
        '--reader-visual-progress': visualProgress,
        '--reader-feather-start': `${featherStart}%`,
        '--reader-feather-end': `${featherEnd}%`,
        '--reader-tail-strength': tailStrength,
      }}
    >
      <span className="reader-reading-percent">
        <span className="reader-reading-percent-label">{language === 'en' ? 'remaining:' : '剩余：'}</span>
        <span className="reader-reading-percent-value">{visualRemaining}%</span>
      </span>
      <span className="reader-trace-line" aria-hidden="true">
        <span className="reader-trace-base" />
        <span className="reader-trace-ink" />
      </span>
    </div>
  )
}

export default ReaderTraceProgress
