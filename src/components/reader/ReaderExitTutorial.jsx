function ReaderExitTutorial({ visible, onDismiss }) {
  if (!visible) return null

  return (
    <aside className="reader-exit-tutorial" aria-label="阅读导航提示">
      <p>使用下方出口前进或返回，也可以使用滚轮、滑动与方向键。</p>
      <button type="button" onClick={onDismiss}>知道了</button>
    </aside>
  )
}

export default ReaderExitTutorial
