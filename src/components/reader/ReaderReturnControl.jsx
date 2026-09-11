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
  const [boundaryVisible, setBoundaryVisible] = useState(false)
  useImperativeHandle(ref, () => ({
    setBoundaryVisible(nextVisible) {
      setBoundaryVisible(Boolean(nextVisible))
    },
  }), [])

  const ui = getReaderUi(language)
  const fallbackUi = getReaderUi('zh')
  const returnLabel = ui.returnToLanding || ui.backToLanding || fallbackUi.returnToLanding
  const returnHint = ui.returnToLandingHint || ui.backToLanding || fallbackUi.returnToLandingHint
  const entryVisible = visible && (alwaysVisible || boundaryVisible)

  return (
    <EntryButtonSurface
      visible={entryVisible}
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
