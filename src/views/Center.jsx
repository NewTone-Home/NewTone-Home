import { useProgressStore } from '../stores/progressStore'
import { useTransitionStore } from '../stores/transitionStore'
import CenterViewport from '../components/center/CenterViewport'
import { useCenterNavigation } from '../hooks/useCenterNavigation'
import { copy } from '../i18n/copy'
import './Center.css'
import './CenterEdge.css'

function Center() {
  const language = useProgressStore(s => s.language)
  const transitionTo = useTransitionStore(s => s.transitionTo)
  const t = copy[language]
  const continueReader = () => transitionTo('reader', { preset: 'core-to-reader', payload: { mode: 'continue' } })
  const navigation = useCenterNavigation({
    onExitTop: () => transitionTo('landing', { preset: 'core-to-surface' }),
    onExitBottom: continueReader,
    onOpenContent: continueReader,
  })

  return (
    <main className="center">
      <div className="center-atmosphere" aria-hidden="true">
        <span className="center-atmosphere-mark center-atmosphere-mark--one" />
        <span className="center-atmosphere-mark center-atmosphere-mark--two" />
        <span className="center-atmosphere-mark center-atmosphere-mark--three" />
      </div>

      <header className="center-header">
        <h1>{t.center}</h1>
        <p>当前国家 · 已知区域总览</p>
      </header>

      <CenterViewport navigation={navigation} />
    </main>
  )
}

export default Center
