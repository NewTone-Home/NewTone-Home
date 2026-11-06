import { ReaderPreviewStoreProvider, useProgressStore, useProgressStoreApi } from '../stores/progressStore'
import { useTransitionStore } from '../stores/transitionStore'
import Reader from '../views/ReaderOrchestrator'
import PageShell from '../components/PageShell'
import GlobalTransitionOverlay from '../components/GlobalTransitionOverlay'
import { getReaderThemeVariables } from '../reader/readerTheme'
function PreviewContents({ session }) {
  const progress = useProgressStoreApi()
  const currentView = useProgressStore(state => state.currentView)
  const themePosition = useProgressStore(state => state.themePosition)
  const motionMode = useProgressStore(state => state.motionMode)
  const phase = useTransitionStore(state => state.phase)
  const restart = () => {
    progress.getState().commitLocation(session.initialLocation)
    progress.getState().startReading()
  }
  const surfaceStyle = getReaderThemeVariables(themePosition)
  return <div data-owner-reader-preview-host>
    <PageShell motionMode={motionMode} surfaceStyle={surfaceStyle}>
      {currentView === 'reader' ? <Reader onReaderReady={() => session.stores.transitionStore.getState().notifyTargetReady('reader')} />
        : <main className="admin-access"><section><h1>Reader 预览已结束</h1><button type="button" onClick={restart}>重新预览</button><a href="/admin">返回管理台</a></section></main>}
    </PageShell>
    {phase !== 'idle' && <GlobalTransitionOverlay surfaceStyle={surfaceStyle} />}
    <a className="admin-preview-return" href="/admin">返回管理台</a>
  </div>
}
export default function OwnerReaderPreviewHost({ session }) {
  return <ReaderPreviewStoreProvider stores={session.stores}><PreviewContents session={session} /></ReaderPreviewStoreProvider>
}
