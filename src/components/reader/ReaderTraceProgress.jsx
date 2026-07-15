function ReaderTraceProgress({ progress }) {
  const percentage = Math.round(Math.min(Math.max(progress, 0), 1) * 100)
  return (
    <div className="reader-trace" aria-label={`阅读进度 ${percentage}%`}>
      <div className="reader-trace-line" style={{ '--reader-trace-progress': `${percentage}%` }} />
      <span>{percentage}%</span>
    </div>
  )
}

export default ReaderTraceProgress
