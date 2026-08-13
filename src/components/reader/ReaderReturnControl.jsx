import { getReaderUi } from '../../i18n/readerUi'
import EntryButtonSurface from '../EntryButtonSurface'
import './ReaderReturnControl.css'

function ReaderReturnControl({
  visible = false,
  mobile = false,
  worldLayer = 'surface',
  onReturnStart,
  onReturnComplete,
  language,
}) {
  const ui = getReaderUi(language)
  const fallbackUi = getReaderUi('zh')
  const returnLabel = ui.returnToLanding || ui.backToLanding || fallbackUi.returnToLanding
  const returnHint = ui.returnToLandingHint || ui.backToLanding || fallbackUi.returnToLandingHint

  return (
    <EntryButtonSurface
      visible={visible}
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
}

export default ReaderReturnControl
