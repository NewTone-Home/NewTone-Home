import { getReaderUi } from '../../i18n/readerUi'
import './ReaderCompletionPrompt.css'

function ReaderCompletionPrompt({ visible = false, language }) {
  if (!visible) return null

  const ui = getReaderUi(language)
  const fallbackUi = getReaderUi('zh')
  const label = ui.readerCompletion || fallbackUi.readerCompletion

  return (
    <p
      className="reader-completion-prompt"
      role="status"
      aria-live="polite"
      data-reader-completion-prompt="visible"
    >
      {label}
    </p>
  )
}

export default ReaderCompletionPrompt
