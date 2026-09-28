'use client'

import { type AnimationEvent, type CSSProperties } from 'react'
import {
  longDistanceTravelStatusBeats,
  longDistanceTravelStatusPulseDurationMs,
  longDistanceTravelVehicleDurationMs,
} from './longDistanceTravelContract'

type LongDistanceTravelProps = {
  leaving?: boolean
  onTravelComplete: () => void
}

export function completeLongDistanceTravelOnVehicleAnimationEnd(
  event: AnimationEvent<HTMLSpanElement>,
  onTravelComplete: () => void,
): boolean {
  if (event.target !== event.currentTarget || event.animationName !== 'center-long-distance-vehicle-drive') return false
  onTravelComplete()
  return true
}

/** A visual-only curtain. It never owns routing, scene runtime, or input. */
export function LongDistanceTravel({ leaving = false, onTravelComplete }: LongDistanceTravelProps) {
  const handleVehicleAnimationEnd = (event: AnimationEvent<HTMLSpanElement>) => {
    completeLongDistanceTravelOnVehicleAnimationEnd(event, onTravelComplete)
  }
  const travelStyle = {
    '--long-distance-travel-duration': `${longDistanceTravelVehicleDurationMs}ms`,
    '--long-distance-status-pulse-duration': `${longDistanceTravelStatusPulseDurationMs}ms`,
  } as CSSProperties
  const statusBeats = longDistanceTravelStatusBeats()

  return (
    <section
      className={`center-long-distance-travel ${leaving ? 'is-leaving' : ''}`}
      aria-label="正在前往商业街"
      data-long-distance-travel="ride"
      style={travelStyle}
    >
      <div className="center-long-distance-travel__route" aria-hidden="true">
        <span className="center-long-distance-travel__vehicle" onAnimationEnd={handleVehicleAnimationEnd}>
          <i className="center-long-distance-travel__vehicle-body" />
          <i className="center-long-distance-travel__vehicle-wheel center-long-distance-travel__vehicle-wheel--front" />
          <i className="center-long-distance-travel__vehicle-wheel center-long-distance-travel__vehicle-wheel--rear" />
        </span>
      </div>
      <p className="center-long-distance-travel__status" role="status" aria-live="polite" aria-label="行驶中">
        {statusBeats.map((beat) => (
          <span
            className="center-long-distance-travel__status-phrase"
            key={beat.phrase}
            style={{
              '--long-distance-status-delay': `${beat.delayMs}ms`,
              '--long-distance-status-visible-duration': `${beat.visibleDurationMs}ms`,
            } as CSSProperties}
            aria-hidden="true"
          >
            <span className="center-long-distance-travel__status-phrase-content">{beat.phrase}</span>
          </span>
        ))}
      </p>
    </section>
  )
}
