import { useLayoutEffect, useRef, useState } from 'react'

function ReaderBeatStack({ beats, focusBeatIndex, onFocusMotionEnd, focusRef }) {
  const viewportRef = useRef(null)
  const flowRef = useRef(null)
  const beatsRef = useRef(beats)
  const [offset, setOffset] = useState(0)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const flow = flowRef.current
    const focused = flow?.children[focusBeatIndex]
    if (!viewport || !flow || !focused) return undefined

    const centerFocusedBeat = () => {
      const viewportRect = viewport.getBoundingClientRect()
      const focusedCenter = focused.offsetTop + focused.offsetHeight / 2
      const nextOffset = viewportRect.height * 0.5 - focusedCenter
      setOffset(nextOffset)
    }

    const pageChanged = beatsRef.current !== beats
    beatsRef.current = beats
    let restoreFrame = 0
    if (pageChanged) {
      // Snap to the new page's position: the large cross-page offset must not
      // animate as a flying text stack; the page reveal handles the entrance.
      flow.style.transition = 'none'
      centerFocusedBeat()
      restoreFrame = requestAnimationFrame(() => {
        flow.style.transition = ''
      })
      onFocusMotionEnd({ target: flow, currentTarget: flow })
    } else {
      centerFocusedBeat()
    }

    const observer = new ResizeObserver(centerFocusedBeat)
    observer.observe(viewport)
    observer.observe(flow)
    return () => {
      cancelAnimationFrame(restoreFrame)
      observer.disconnect()
    }
  }, [beats, focusBeatIndex])

  return (
    <div ref={viewportRef} className="reader-beat-stack" aria-live="polite">
      <div
        ref={flowRef}
        className="reader-beat-flow"
        style={{ transform: `translateY(${offset}px)` }}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && event.propertyName === 'transform') {
            onFocusMotionEnd(event)
          }
        }}
      >
        {beats.map((beat, beatIndex) => {
          const distance = Math.abs(beatIndex - focusBeatIndex)
          return (
            <article
              key={beat.id}
              ref={distance === 0 ? focusRef : undefined}
              className="reader-stage-beat"
              aria-current={distance === 0 ? 'true' : undefined}
              tabIndex={distance === 0 ? -1 : undefined}
              data-distance={Math.min(distance, 4)}
            >
              {beat.blocks.map((block, blockIndex) => (
                <p key={`${beat.id}-${blockIndex}`}>{block.text}</p>
              ))}
            </article>
          )
        })}
      </div>
    </div>
  )
}

export default ReaderBeatStack
