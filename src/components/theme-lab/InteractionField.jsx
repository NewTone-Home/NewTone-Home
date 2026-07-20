import { useRef, useState } from 'react'
import { themePositionFromPointerX } from '../../reader/readerTheme'
import { commitRingPosition, ringStepPosition } from '../../theme/themeLabModel'

function RingSlider({ value, effectiveMotion, onCommit }) {
  const trackRef = useRef(null)
  const thumbRef = useRef(null)
  const pointerIdRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const commitFromPointer = clientX => {
    const trackRect = trackRef.current?.getBoundingClientRect()
    const thumbRect = thumbRef.current?.getBoundingClientRect()
    if (!trackRect?.width || !thumbRect?.width) return
    const raw = themePositionFromPointerX(clientX, trackRect, thumbRect.width)
    onCommit(commitRingPosition(raw, effectiveMotion))
  }

  const handlePointerDown = event => {
    event.preventDefault()
    pointerIdRef.current = event.pointerId
    setDragging(true)
    event.currentTarget.focus({ preventScroll: true })
    try { event.currentTarget.setPointerCapture?.(event.pointerId) } catch { /* inactive pointer */ }
    commitFromPointer(event.clientX)
  }

  const handlePointerMove = event => {
    if (pointerIdRef.current !== event.pointerId) return
    commitFromPointer(event.clientX)
  }

  const handlePointerEnd = event => {
    if (pointerIdRef.current !== event.pointerId) return
    commitFromPointer(event.clientX)
    pointerIdRef.current = null
    setDragging(false)
    try { event.currentTarget.releasePointerCapture?.(event.pointerId) } catch { /* capture already lost */ }
  }

  const handleKeyDown = event => {
    let next = null
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = 1
    else if (['ArrowRight', 'ArrowUp'].includes(event.key)) next = ringStepPosition(value, 1, effectiveMotion)
    else if (['ArrowLeft', 'ArrowDown'].includes(event.key)) next = ringStepPosition(value, -1, effectiveMotion)
    if (next === null) return
    event.preventDefault()
    onCommit(commitRingPosition(next, effectiveMotion))
  }

  return (
    <div
      className={`lab-ring-slider${dragging ? ' is-dragging' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label="世界基调(环形滑块)"
      aria-valuemin="0"
      aria-valuemax="1"
      aria-valuenow={value}
      data-effective-motion={effectiveMotion}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
    >
      <span ref={trackRef} className="lab-ring-track" aria-hidden="true">
        <span className="lab-ring-node" style={{ '--node': 0 }} />
        <span className="lab-ring-node" style={{ '--node': 0.5 }} />
        <span className="lab-ring-node" style={{ '--node': 1 }} />
      </span>
      <span ref={thumbRef} className="lab-ring-hit" style={{ '--ring-position': value }} aria-hidden="true">
        <span className="lab-ring-thumb" />
      </span>
    </div>
  )
}

function InteractionField({ themePosition, effectiveMotion, onThemePosition }) {
  return (
    <section className="lab-field" aria-label="交互实验">
      <p className="lab-scene-emphasis lab-field-mark">交互实验</p>
      <p className="lab-support-text">
        只保留 NewTone 真正需要的交互。试试悬停、Tab 聚焦、按下与展开;禁用项仍可辨认,但不再诱导操作。
      </p>
      <div className="lab-field-row">
        <div className="lab-drawout">
          <button type="button" className="lab-glyph-entry lab-drawout-anchor" aria-expanded="false" aria-label="横向展开工具">
            <svg className="lab-glyph-svg" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 10h12M10 4v12" />
            </svg>
          </button>
          <div className="lab-drawout-tray">
            <button type="button" className="lab-glyph-entry" aria-label="展开项一"><span className="lab-glyph-dot" /></button>
            <button type="button" className="lab-glyph-entry" aria-label="展开项二"><span className="lab-glyph-dot" /></button>
            <button type="button" className="lab-glyph-entry" aria-label="展开项三"><span className="lab-glyph-dot" /></button>
          </div>
        </div>
        <button type="button" className="lab-word-interactive">继续读下去</button>
        <button type="button" className="lab-word-interactive" disabled>尚未解锁的记忆</button>
        <button type="button" className="lab-glyph-entry" aria-label="图形入口">
          <span className="lab-glyph-dot" />
        </button>
      </div>
      <div className="lab-ring-block">
        <RingSlider value={themePosition} effectiveMotion={effectiveMotion} onCommit={onThemePosition} />
        <p className="lab-support-text lab-ring-note">
          环形滑块驱动真实世界基调:完整动态连续取值并在档位附近吸附;动态减弱只允许明亮、柔和、夜间三档。
        </p>
      </div>
    </section>
  )
}

export default InteractionField
