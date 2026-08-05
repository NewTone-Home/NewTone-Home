import { useMemo } from 'react'

function createRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const RAIN_BANDS = {
  near: { count: 34, length: [18, 30], width: [1.4, 2], speed: [0.6, 0.85], opacity: [0.34, 0.5] },
  far: { count: 44, length: [8, 14], width: [1, 1.2], speed: [1, 1.5], opacity: [0.14, 0.26] },
}

const FALL_DISTANCE_VH = 125

function makeRainDrops(band, seed) {
  const spec = RAIN_BANDS[band]
  const random = createRandom(seed)
  const range = (low, high) => low + random() * (high - low)

  return Array.from({ length: spec.count }, () => {
    const speed = range(...spec.speed)
    const angle = range(7, 9)
    return {
      x: random() * 100,
      y: random() * 96,
      length: range(...spec.length),
      width: range(...spec.width),
      speed,
      opacity: range(...spec.opacity),
      delay: -random() * speed,
      angle,
      drift: Math.tan((angle * Math.PI) / 180) * FALL_DISTANCE_VH,
    }
  })
}

const SNOW_BANDS = {
  near: { count: 28, size: [3, 5], speed: [7, 11], opacity: [0.55, 0.9], sway: [10, 22] },
  far: { count: 40, size: [1.5, 3], speed: [12, 19], opacity: [0.28, 0.5], sway: [6, 14] },
}

function makeSnowFlakes(band, seed) {
  const spec = SNOW_BANDS[band]
  const random = createRandom(seed)
  const range = (low, high) => low + random() * (high - low)

  return Array.from({ length: spec.count }, () => {
    const speed = range(...spec.speed)
    return {
      x: random() * 100,
      y: random() * 96,
      size: range(...spec.size),
      speed,
      opacity: range(...spec.opacity),
      delay: -random() * speed,
      sway: range(...spec.sway),
      swayDuration: range(2.6, 4.8),
      drift: range(-4, 4),
    }
  })
}

function RainField() {
  const bands = useMemo(() => ['near', 'far'].map(band => ({
    band,
    drops: makeRainDrops(band, band === 'near' ? 11 : 47),
  })), [])

  return (
    <span className="reader-rain-field">
      {bands.map(({ band, drops }) => (
        <span key={band} className="reader-rain-band" data-band={band}>
          {drops.map((drop, index) => (
            <i
              key={index}
              className="reader-rain-drop"
              style={{
                '--p-x': `${drop.x.toFixed(2)}%`,
                '--p-y': `${drop.y.toFixed(1)}vh`,
                '--p-len': `${drop.length.toFixed(1)}px`,
                '--p-w': `${drop.width.toFixed(2)}px`,
                '--p-dur': `${drop.speed.toFixed(2)}s`,
                '--p-opacity': drop.opacity.toFixed(2),
                '--p-delay': `${drop.delay.toFixed(2)}s`,
                '--p-rot': `${(-drop.angle).toFixed(1)}deg`,
                '--p-drift': `${drop.drift.toFixed(1)}vh`,
              }}
            />
          ))}
        </span>
      ))}
    </span>
  )
}

function SnowField() {
  const bands = useMemo(() => ['near', 'far'].map(band => ({
    band,
    flakes: makeSnowFlakes(band, band === 'near' ? 23 : 71),
  })), [])

  return (
    <span className="reader-snow-field">
      {bands.map(({ band, flakes }) => (
        <span key={band} className="reader-snow-band" data-band={band}>
          {flakes.map((flake, index) => (
            <span
              key={index}
              className="reader-snow-fall"
              style={{
                '--p-x': `${flake.x.toFixed(2)}%`,
                '--p-y': `${flake.y.toFixed(1)}vh`,
                '--p-dur': `${flake.speed.toFixed(1)}s`,
                '--p-delay': `${flake.delay.toFixed(1)}s`,
                '--p-drift': `${flake.drift.toFixed(1)}vh`,
              }}
            >
              <i
                className="reader-snow-flake"
                style={{
                  '--p-size': `${flake.size.toFixed(1)}px`,
                  '--p-opacity': flake.opacity.toFixed(2),
                  '--p-sway': `${flake.sway.toFixed(1)}px`,
                  '--p-sway-dur': `${flake.swayDuration.toFixed(1)}s`,
                }}
              />
            </span>
          ))}
        </span>
      ))}
    </span>
  )
}

export default function ReaderPrecipitation() {
  return (
    <span className="reader-precipitation" aria-hidden="true">
      <RainField />
      <SnowField />
    </span>
  )
}
