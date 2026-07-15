function ReaderPageExit({ exits, onBackward, onForward }) {
  return (
    <nav className="reader-stage-exits" aria-label="阅读页面出口">
      <button type="button" onClick={onBackward}>
        <span aria-hidden="true">←</span>
        <span>{exits.backward.action === 'leave-reader' ? '返回入口' : '向前一页'}</span>
      </button>
      <button type="button" onClick={onForward}>
        <span>{exits.forward.action === 'complete-reader' ? '完成阅读' : '继续读取'}</span>
        <span aria-hidden="true">→</span>
      </button>
    </nav>
  )
}

export default ReaderPageExit
