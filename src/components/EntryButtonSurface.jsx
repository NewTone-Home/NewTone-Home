import './EntryButtonSurface.css'

const ENTRY_PATH = 'M 2 2 H 198 V 54 H 2 Z'

function EntryButtonSurface({
  entryId,
  label,
  materialMode = 'background',
  worldLayer = 'surface',
  phase,
  onClick,
  onAnimationEnd,
}) {
  const clipId = `entry-button-clip-${entryId}`

  return (
    <button
      type="button"
      className="entry-button-surface"
      data-entry-id={entryId}
      data-entry-phase={phase}
      data-material-mode={materialMode}
      data-world-layer={worldLayer}
      disabled={phase !== 'visible'}
      onClick={onClick}
      onAnimationEnd={onAnimationEnd}
    >
      <svg className="entry-button-surface__geometry" viewBox="0 0 200 56" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={clipId}>
            <path d={ENTRY_PATH} />
          </clipPath>
        </defs>
        <g className="entry-button-surface__fill" clipPath={`url(#${clipId})`}>
          <rect x="0" y="0" width="200" height="56" />
        </g>
        <path className="entry-button-surface__frame" d={ENTRY_PATH} pathLength="1" />
      </svg>
      <span className="entry-button-surface__label">{label}</span>
    </button>
  )
}

export default EntryButtonSurface
