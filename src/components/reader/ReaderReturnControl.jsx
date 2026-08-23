import { forwardRef, useImperativeHandle, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import EntryButtonSurface from '../EntryButtonSurface'
import './ReaderReturnControl.css'

const ReaderReturnControl = forwardRef(function ReaderReturnControl({
  visible = false,
  alwaysVisible = false,
  mobile = false,
  worldLayer = 'surface',
  onReturnStart,
  onReturnComplete,
  language,
}, ref) {
  const [boundaryProgress, setBoundaryProgress] = useState(1)
  useImperativeHandle(ref, () => ({
    setBoundaryProgress(nextProgress) {
      const normalized = Number.isFinite(nextProgress)
        ? Math.max(0, Math.min(1, nextProgress))
        : 1
      setBoundaryProgress(current => Math.abs(current - normalized) < 0.001 ? current : normalized)
    },
  }), [])

  const ui = getReaderUi(language)
  const fallbackUi = getReaderUi('zh')
  const returnLabel = ui.returnToLanding || ui.backToLanding || fallbackUi.returnToLanding
  const returnHint = ui.returnToLandingHint || ui.backToLanding || fallbackUi.returnToLandingHint

  return (
    <EntryButtonSurface
      visible={visible}
      controlledProgress={alwaysVisible ? 0 : boundaryProgress}
      mobile={mobile}
      materialMode="world"
      worldLayer={worldLayer}
      entryId="reader-return"
      label={returnLabel}
      ariaLabel={returnHint}
      className="reader-return-control"
      dataAttributes={{
        'data-reader-return-control': 'true',
        'data-return-world-layer': worldLayer,
      }}
      onActionStart={onReturnStart}
      onActionComplete={onReturnComplete}
    />
  )
})

export default ReaderReturnControl
