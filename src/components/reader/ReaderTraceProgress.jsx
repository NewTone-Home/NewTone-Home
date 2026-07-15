import { getReaderProgressPercentage } from '../../reader/readerPresentation'

function ReaderTraceProgress({ progress }) {
  const percentage = getReaderProgressPercentage(progress)
  return (
    <div
      className="reader-trace"
      role="progressbar"
      aria-label="阅读进度"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={percentage}
    >
      <div
        className="reader-trace-line"
        aria-hidden="true"
        style={{ '--reader-trace-progress': `${percentage}%` }}
      />
      <span>{percentage}%</span>
    </div>
  )
}

export default ReaderTraceProgress
