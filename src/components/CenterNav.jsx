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
  const setCenterMode = useProgressStore(s => s.setCenterMode)

  const t = copy[language]

  return (
    <div className="center-nav">
      {ENTRIES.map(entry => (
        <button
          key={entry.mode}
          className="center-nav-entry"
          onClick={() => setCenterMode(entry.mode)}
        >
          {t[entry.copyKey]}
        </button>
      ))}
    </div>
  )
}

export default CenterNav
