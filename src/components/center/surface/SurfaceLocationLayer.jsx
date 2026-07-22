import { surfaceLocations } from './surfaceWorldData'

function LocationDot({ location, focused, onMouseEnter, onMouseLeave }) {
  const pctX = location.x * 100
  const pctY = location.y * 100

  return (
    <div
      className={`surface-location ${focused ? 'surface-location--focused' : ''}`}
      data-location-id={location.id}
      style={{
        position: 'absolute',
        left: `${pctX}%`,
        top: `${pctY}%`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
        cursor: 'pointer',
        zIndex: 8,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span
        className="surface-location-dot"
        aria-hidden="true"
        style={{
          display: 'block',
          width: 'clamp(10px, 0.8vw, 18px)',
          height: 'clamp(10px, 0.8vw, 18px)',
          borderRadius: '50%',
          border: '1.5px solid rgba(55, 49, 43, 0.55)',
          background: 'rgba(194, 181, 159, 0.60)',
          transition: 'background 180ms ease, border-color 180ms ease',
        }}
      />
    </div>
  )
}

function SurfaceLocationLayer({ focusedLocationId, onHoverStart, onHoverEnd }) {
  return (
    <div
      className="surface-location-layer"
      aria-label="表世界地点"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {surfaceLocations.map(loc => (
        <LocationDot
          key={loc.id}
          location={loc}
          focused={focusedLocationId === loc.id}
          onMouseEnter={() => onHoverStart?.(loc.id, loc.title)}
          onMouseLeave={onHoverEnd}
        />
      ))}
    </div>
  )
}

export default SurfaceLocationLayer
