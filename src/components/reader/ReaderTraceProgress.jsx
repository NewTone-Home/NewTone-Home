import { getReaderProgressPercentage } from '../../reader/readerPresentation'

function ReaderTraceProgress({ progress }) {
  const percentage = getReaderProgressPercentage(progress)
  return (
    <div className="reader-trace" role="progressbar" aria-label="阅读进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percentage} tabIndex="0" data-progress={percentage}>
      <span className="reader-reading-percent">当前阅读 {percentage}%</span>
      <span className="reader-trace-line" aria-hidden="true"><span style={{ transform: `scaleX(${percentage / 100})` }} /></span>
    </div>
  )
}

export default ReaderTraceProgress
