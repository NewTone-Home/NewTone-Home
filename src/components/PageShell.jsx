import { useTransitionStore } from '../stores/transitionStore'
import { getDefinition, hasDefinition } from '../transitions/transitionDefinitions'
import './PageShell.css'

function PageShell({ children }) {
  const phase = useTransitionStore(s => s.phase)
  const preset = useTransitionStore(s => s.preset)
  const style = {}

  if (hasDefinition(preset)) {
    const def = getDefinition(preset)
    style['--ps-leave-duration'] = `${def.timings.leaving}ms`
    style['--ps-enter-duration'] = `${def.timings.entering}ms`
  }

  return (
    <div className={`page-shell phase-${phase} preset-${preset}`} style={style}>
      {children}
    </div>
  )
}

export default PageShell
