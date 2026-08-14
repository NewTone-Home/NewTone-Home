import { useEffect, useRef, useState } from 'react'

export const DEFAULT_SCRAMBLE_CHARS = '01░▒/\\-_:;~*#+%&@'

function randomChar(chars) {
  return chars[Math.floor(Math.random() * chars.length)]
}

export function initialScramble(text, chars = DEFAULT_SCRAMBLE_CHARS) {
  const length = typeof text === 'number' ? text : Array.from(text).length
  return Array.from({ length }, () => randomChar(chars)).join('')
}

function partialScramble(text, resolvedCount, chars) {
  return Array.from(text, (char, index) => (
    index < resolvedCount ? char : randomChar(chars)
  )).join('')
}

/**
 * Shared text lifecycle for entry controls.
 *
 * stable means that the control has resolved and may keep its paired arrow
 * mounted. It intentionally remains true during withdrawing so the arrow can
 * retract while the same text node performs its scramble-out phase.
 */
export function useScrambleText(
  text,
  {
    enabled = true,
    startDelay = 0,
    charInterval = 70,
    scrambleInterval = 40,
    chars = DEFAULT_SCRAMBLE_CHARS,
    withdrawing = false,
    withdrawalDuration = 260,
    holdFinal = false,
    restartKey = null,
    onRevealed,
    onWithdrawn,
  } = {},
) {
  const [displayText, setDisplayText] = useState('')
  const [stable, setStable] = useState(false)
  const [phase, setPhase] = useState('idle')
  const revealedRef = useRef(false)
  const restartKeyRef = useRef(restartKey)
  const holdFinalRef = useRef(holdFinal)
  const wasHoldingFinalRef = useRef(false)
  const onRevealedRef = useRef(onRevealed)
  const onWithdrawnRef = useRef(onWithdrawn)

  holdFinalRef.current = holdFinal
  onRevealedRef.current = onRevealed
  onWithdrawnRef.current = onWithdrawn

  useEffect(() => {
    const shouldRestart = restartKeyRef.current !== restartKey
    if (shouldRestart) {
      restartKeyRef.current = restartKey
      revealedRef.current = false
      wasHoldingFinalRef.current = false
      setDisplayText('')
      setStable(false)
      setPhase('idle')
    }

    if (!enabled) {
      setDisplayText('')
      setStable(false)
      setPhase('idle')
      revealedRef.current = false
      wasHoldingFinalRef.current = false
      return undefined
    }

    let mounted = true
    let resolvedCount = 0
    let scrambleTimer = 0
    let resolveTimer = 0
    let startTimer = 0

    const update = (value) => {
      if (mounted) setDisplayText(value)
    }

    if (withdrawing) {
      setPhase('withdrawing')
      setStable(true)
      update(text)
      const step = 40
      const totalFrames = Math.max(1, Math.floor(withdrawalDuration / step))
      let frame = 0
      scrambleTimer = window.setInterval(() => {
        if (!mounted) return
        frame += 1
        update(frame >= totalFrames ? '' : initialScramble(text, chars))
        if (frame >= totalFrames) {
          window.clearInterval(scrambleTimer)
          revealedRef.current = false
          setPhase('withdrawn')
          onWithdrawnRef.current?.()
        }
      }, step)
      return () => {
        mounted = false
        window.clearInterval(scrambleTimer)
      }
    }

    if (revealedRef.current) {
      setPhase('stable')
      update(text)
      setStable(true)
      return undefined
    }

    setPhase('revealing')
    setStable(false)
    update(initialScramble(text, chars))

    scrambleTimer = window.setInterval(() => {
      if (!mounted) return
      update(partialScramble(text, resolvedCount, chars))
    }, scrambleInterval)

    const resolve = () => {
      resolveTimer = window.setInterval(() => {
        if (!mounted) return
        resolvedCount += 1
        if (resolvedCount >= text.length) {
          window.clearInterval(resolveTimer)
          window.clearInterval(scrambleTimer)
          revealedRef.current = true
          if (holdFinalRef.current) {
            update(initialScramble(text, chars))
            return
          }
          update(text)
          setStable(true)
          setPhase('stable')
          onRevealedRef.current?.()
          return
        }
        update(partialScramble(text, resolvedCount, chars))
      }, charInterval)
    }

    if (startDelay > 0) startTimer = window.setTimeout(resolve, startDelay)
    else resolve()

    return () => {
      mounted = false
      window.clearTimeout(startTimer)
      window.clearInterval(scrambleTimer)
      window.clearInterval(resolveTimer)
    }
  }, [chars, charInterval, enabled, restartKey, scrambleInterval, startDelay, text, withdrawing, withdrawalDuration])

  useEffect(() => {
    if (holdFinal) {
      wasHoldingFinalRef.current = true
      return
    }
    if (!wasHoldingFinalRef.current) return
    wasHoldingFinalRef.current = false
    if (!enabled || withdrawing) return
    setDisplayText(text)
    setStable(true)
    setPhase('stable')
  }, [enabled, holdFinal, text, withdrawing])

  return { displayText, stable, phase }
}
