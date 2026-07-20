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
    <main className="center" data-center-mode={centerMode}>
      <div className="center-atmosphere" aria-hidden="true">
        <span className="center-atmosphere-mark center-atmosphere-mark--one" />
        <span className="center-atmosphere-mark center-atmosphere-mark--two" />
        <span className="center-atmosphere-mark center-atmosphere-mark--three" />
      </div>

      <div className="center-frame">
        <header className="center-header">
          <h1>{t.center}</h1>
          <CenterNav />
        </header>

        <div className="center-mode-content" key={centerMode}>
          {centerMode === 'home' && (
            <section className="center-home" aria-labelledby="center-home-heading">
              <p id="center-home-heading" className="center-home-text">{t.welcomeCenter}</p>
            </section>
          )}

          {centerMode !== 'home' && items && (
            <section className="center-content" aria-label={t[centerMode]}>
              <button
                className="center-text-link center-back-link"
                onClick={() => setCenterMode('home')}
              >
                <span aria-hidden="true">←</span> {t.backToHome}
              </button>
              <div className="center-item-list">
                {items.map((item, index) => (
                  <article key={item.id} className="center-item" data-item-index={index}>
                    {item.label && <p className="center-item-label">{item.label}</p>}
                    {item.title && <h2 className="center-item-title">{item.title}</h2>}
                    <p className="center-item-text">{item.text}</p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        <nav className="center-directions" aria-label={t.center}>
          <button className="center-direction center-direction--reader" onClick={() => transitionTo('reader', { preset: 'core-to-reader', payload: { mode: 'continue' } })}>
            <span className="center-direction-line" aria-hidden="true" />
            {t.continueReading}
          </button>
          <button className="center-direction center-direction--landing" onClick={() => transitionTo('landing', { preset: 'core-to-surface' })}>
            {t.backToLanding}
            <span className="center-direction-line" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </main>
  )
}

export default Center
