import { centerText } from '../data/centerScene'

function CenterInfoPanel({ panelRef, entity, language, mode, copy, onClose, onOpen, onCloseOpen }) {
  if (!entity) return null
  const isOpen = mode === 'open'
  const linkedCount = [entity.links?.reader, entity.links?.route, ...(entity.links?.news || []), ...(entity.links?.missions || [])].filter(Boolean).length

  return (
    <aside
      ref={panelRef}
      className={`center-info-panel${isOpen ? ' center-info-panel--open' : ''}`}
      data-center-panel-mode={mode}
      aria-label={centerText(entity.name, language)}
      aria-live="polite"
    >
      <button type="button" className="center-info-panel__close" onClick={onClose} aria-label={copy.close}>×</button>
      <div className="center-info-panel__eyebrow">
        <span>{entity.entityType}</span>
        <span>{entity.id}</span>
      </div>
      <h2>{centerText(entity.name, language)}</h2>
      <p className="center-info-panel__summary">{centerText(entity.summary, language)}</p>
      <dl className="center-info-panel__meta">
        <div><dt>{copy.status}</dt><dd data-status={entity.status}>{entity.status}</dd></div>
        <div><dt>{copy.unlocked}</dt><dd>{entity.unlocked ? copy.unlocked : copy.locked}</dd></div>
        <div><dt>{copy.linked}</dt><dd>{String(linkedCount).padStart(2, '0')}</dd></div>
      </dl>
      {isOpen && (
        <div className="center-info-panel__record">
          <span>{copy.placeholder}</span>
          <p>{centerText(entity.details, language)}</p>
        </div>
      )}
      <button type="button" className="center-info-panel__action" onClick={isOpen ? onCloseOpen : onOpen}>
        <span>{isOpen ? copy.closeRecord : copy.open}</span>
        <span aria-hidden="true">{isOpen ? '−' : '↗'}</span>
      </button>
    </aside>
  )
}

export default CenterInfoPanel

