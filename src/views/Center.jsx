import { useProgressStore } from '../stores/progressStore'
import { useTransitionStore } from '../stores/transitionStore'
import CenterNav from '../components/CenterNav'
import { records } from '../data/records'
import { perspectives } from '../data/perspectives'
import { fragments } from '../data/fragments'
import { copy } from '../i18n/copy'
import './Center.css'

const MODE_DATA = { records, perspectives, fragments }

function Center() {
  const language = useProgressStore(s => s.language)
  const centerMode = useProgressStore(s => s.centerMode)
  const transitionTo = useTransitionStore(s => s.transitionTo)
  const setCenterMode = useProgressStore(s => s.setCenterMode)

  const items = MODE_DATA[centerMode]
  const t = copy[language]

  return (
    <div className="center">
      <div className="center-top-actions">
        <button className="center-text-link" onClick={() => transitionTo('reader', { preset: 'core-to-reader', payload: { mode: 'continue' } })}>
          {t.continueReading}
        </button>
        <button className="center-text-link" onClick={() => transitionTo('landing', { preset: 'core-to-surface' })}>
          {t.backToLanding}
        </button>
      </div>

      <h1>{t.center}</h1>
      <CenterNav />

      <div className="center-mode-content" key={centerMode}>
        {centerMode === 'home' && (
          <p className="center-home-text">{t.welcomeCenter}</p>
        )}

        {centerMode !== 'home' && items && (
          <div className="center-content">
            <button
              className="center-text-link center-back-link"
              onClick={() => setCenterMode('home')}
            >
              ← {t.backToHome}
            </button>
            {items.map(item => (
              <div key={item.id} className="center-item">
                {item.title && <h3 className="center-item-title">{item.title}</h3>}
                <p className="center-item-text">{item.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Center
