import { useState, useEffect, useRef } from 'react'

const CHARS = '░▒/\\-_01'

function ScrambleText({ text, active, duration = 800, onRevealed }) {
  const [display, setDisplay] = useState('')
  const timerRef = useRef(null)
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
    const totalFrames = Math.floor(duration / step)
    let frame = 0

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

    return () => clearInterval(timerRef.current)
  }, [text, active, duration, onRevealed])

  return <span>{display}</span>
}

export default ScrambleText
