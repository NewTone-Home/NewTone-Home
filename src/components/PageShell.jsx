import { useTransitionStore } from '../stores/transitionStore'
import { getDefinition, hasDefinition } from '../transitions/transitionDefinitions'
import { preventPublicShortcut, preventPublicTransfer } from '../interactions/publicInteractionPolicy'
import './PageShell.css'
import '../styles/publicInteractionPolicy.css'

function PageShell({ children, motionMode = 'full', surfaceStyle = {} }) {
  const phase = useTransitionStore(s => s.phase)
  const preset = useTransitionStore(s => s.preset)
  const style = { ...surfaceStyle }

  if (hasDefinition(preset)) {
    const def = getDefinition(preset)
    style['--ps-leave-duration'] = `${def.timings.leaving}ms`
    style['--ps-enter-duration'] = `${def.timings.entering}ms`
  }

  return (
    <div
      className={`page-shell phase-${phase} preset-${preset}`}
      style={style}
      data-motion-mode={motionMode}
      onCopyCapture={preventPublicTransfer}
      onCutCapture={preventPublicTransfer}
      onPasteCapture={preventPublicTransfer}
      onContextMenu={preventPublicTransfer}
      onDragStartCapture={preventPublicTransfer}
      onKeyDownCapture={preventPublicShortcut}
    >
      {children}
    </div>
  )
}

export default PageShell
