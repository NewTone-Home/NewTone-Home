import { useProgressStore } from '../stores/progressStore'
import { copy } from '../i18n/copy'
import './CenterNav.css'

const ENTRIES = [
  { mode: 'records', copyKey: 'records' },
  { mode: 'perspectives', copyKey: 'perspectives' },
  { mode: 'fragments', copyKey: 'fragments' },
]

function CenterNav() {
  const language = useProgressStore(s => s.language)
  const centerMode = useProgressStore(s => s.centerMode)
  const setCenterMode = useProgressStore(s => s.setCenterMode)

  const t = copy[language]

  return (
    <nav className="center-nav" aria-label={t.center}>
      {ENTRIES.map(entry => (
        <button
          key={entry.mode}
          className={`center-nav-entry ${centerMode === entry.mode ? 'is-active' : ''}`}
          aria-current={centerMode === entry.mode ? 'page' : undefined}
          onClick={() => setCenterMode(entry.mode)}
        >
          <span>{t[entry.copyKey]}</span>
        </button>
      ))}
    </nav>
  )
}

export default CenterNav
