import { getReaderProgressPercentage } from '../../reader/readerPresentation'

function ReaderTraceProgress({ progress }) {
  const percentage = getReaderProgressPercentage(progress)
  return (
    <div className="reader-trace" aria-label={`阅读进度 ${percentage}%`}>
      <div className="reader-trace-line" style={{ '--reader-trace-progress': `${percentage}%` }} />
      <span>{percentage}%</span>
    </div>
  )
}

export default ReaderTraceProgress
