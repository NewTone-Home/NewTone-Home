import { clearIntroCompleted } from '../landing/landingIntro'
import { useProgressStore } from '../stores/progressStore'

const STAGING_TOOLS_ENABLED = import.meta.env.VITE_ENABLE_STAGING_TOOLS === 'true'

const controlStyle = Object.freeze({
  position: 'fixed',
  top: 'max(12px, env(safe-area-inset-top))',
  right: 'max(12px, env(safe-area-inset-right))',
  zIndex: 9999,
  border: '1px solid rgba(82, 68, 54, 0.28)',
  borderRadius: '999px',
  background: 'rgba(247, 242, 233, 0.82)',
  color: 'rgba(61, 50, 40, 0.78)',
  padding: '8px 11px',
  font: '500 12px/1 ui-sans-serif, system-ui, sans-serif',
  letterSpacing: '0.04em',
  boxShadow: '0 2px 10px rgba(55, 44, 34, 0.08)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  cursor: 'pointer',
  touchAction: 'manipulation',
  userSelect: 'none',
  WebkitUserSelect: 'none',
})

export default function StagingResetControl() {
  if (!STAGING_TOOLS_ENABLED) return null

  const resetTestState = () => {
    clearIntroCompleted()
    useProgressStore.getState().reset()
    window.history.replaceState({ newtoneView: 'landing' }, '')
    window.location.replace('/')
  }

  return (
    <button
      type="button"
      style={controlStyle}
      onClick={resetTestState}
      aria-label="重置 NewTone 测试状态"
      title="清除本机 NewTone 测试进度并回到首次 Landing；不会清除传感器权限"
    >
      重置测试
    </button>
  )
}
