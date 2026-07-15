function ReaderPageExit({
  exits,
  onBackward,
  onForward,
  hasForwardPosition,
  canComplete,
  readerCompleted,
  onEnterCenter,
}) {
  return (
    <nav className="reader-stage-exits" aria-label="阅读页面出口">
      <button type="button" onClick={onBackward}>
        <span aria-hidden="true">←</span>
        <span>{exits.backward.action === 'leave-reader' ? '返回入口' : '向前一页'}</span>
      </button>
      {(hasForwardPosition || canComplete) && (
        <button type="button" onClick={onForward}>
          <span>{canComplete ? '完成阅读' : '继续读取'}</span>
          <span aria-hidden="true">→</span>
        </button>
      )}
      {readerCompleted && (
        <button type="button" onClick={onEnterCenter}>
          <span>进入中枢</span>
          <span aria-hidden="true">→</span>
        </button>
      )}
    </nav>
  )
}

export default ReaderPageExit
