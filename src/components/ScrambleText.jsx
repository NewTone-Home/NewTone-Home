import { useState, useEffect, useRef } from 'react'

const CHARS = '░▒/\\-_01'

function randomScramble(text) {
  return Array.from(text, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
}

function ScrambleText({
  text,
  active,
  duration = 800,
  startDelay = 0,
  onRevealed,
  withdrawing = false,
  withdrawalDuration = 260,
  onWithdrawn,
}) {
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

    if (withdrawing) {
      const step = 40
      const totalFrames = Math.max(1, Math.floor(withdrawalDuration / step))
      let frame = 0
      setDisplay(text)

      timerRef.current = setInterval(() => {
        frame++
        setDisplay(frame >= totalFrames ? '' : randomScramble(text))

        if (frame >= totalFrames) {
          clearInterval(timerRef.current)
          revealedRef.current = false
          onWithdrawn?.()
        }
      }, step)

      return () => clearInterval(timerRef.current)
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
            result += randomScramble('x')
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
  }, [text, active, duration, startDelay, onRevealed, withdrawing, withdrawalDuration, onWithdrawn])

  return <span>{display}</span>
}

export default ScrambleText
