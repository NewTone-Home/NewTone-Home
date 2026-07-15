import { useEffect } from 'react'
import { readerContent } from '../data/readerContent'
import { createStaticStageView } from '../reader/readerStageModel'
import { useProgressStore } from '../stores/progressStore'
import LegacyReader from './Reader'
import ReaderStage from './ReaderStage'

function StaticReaderPreview({ onReaderReady }) {
  const language = useProgressStore(state => state.language)
  const toggleLanguage = useProgressStore(state => state.toggleLanguage)
  const view = createStaticStageView(readerContent[0])

  useEffect(() => {
    const frame = requestAnimationFrame(() => onReaderReady?.())
    return () => cancelAnimationFrame(frame)
  }, [onReaderReady])

  return (
    <ReaderStage
      {...view}
      language={language}
      onBackward={() => {}}
      onForward={() => {}}
      onLanguage={toggleLanguage}
    />
  )
}

function ReaderOrchestrator(props) {
  const previewEnabled = new URLSearchParams(window.location.search).get('readerStage') === '1'
  return previewEnabled
    ? <StaticReaderPreview {...props} />
    : <LegacyReader {...props} />
}

export default ReaderOrchestrator
