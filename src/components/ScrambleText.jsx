import { useState, useEffect, useRef } from 'react'

const CHARS = '░▒/\\-_01'

function ScrambleText({ text, active, duration = 800, startDelay = 0, onRevealed }) {
  const [display, setDisplay] = useState('')
  const timerRef = useRef(null)
  const delayRef = useRef(null)
  const revealedRef = useRef(false)

  useEffect(() => {
    if (!active) {
      setDisplay('')
      revealedRef.current = false
      return
    }

    if (revealedRef.current) {
      setDisplay(text)
      return
    }

    const step = 40
    const totalFrames = Math.max(1, Math.floor(duration / step))
    let frame = 0

    const begin = () => {
      timerRef.current = setInterval(() => {
        frame++
        const progress = frame / totalFrames
        const revealCount = Math.min(Math.floor(progress * text.length), text.length)

        let result = ''
        for (let i = 0; i < text.length; i++) {
          if (i < revealCount) {
            result += text[i]
          } else {
            result += CHARS[Math.floor(Math.random() * CHARS.length)]
          }
        }
        setDisplay(result)

        if (frame >= totalFrames) {
          clearInterval(timerRef.current)
          setDisplay(text)
          revealedRef.current = true
          onRevealed?.()
        }
      }, step)
    }

    if (startDelay > 0) delayRef.current = setTimeout(begin, startDelay)
    else begin()

    return () => {
      clearTimeout(delayRef.current)
      clearInterval(timerRef.current)
    }
  }, [text, active, duration, startDelay, onRevealed])

  return <span>{display}</span>
}

export default ScrambleText
