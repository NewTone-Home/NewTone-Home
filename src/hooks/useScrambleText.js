import { useEffect, useRef, useState } from 'react'

export const DEFAULT_SCRAMBLE_CHARS = '01░▒/\\-_:;~*#+%&@'

function randomChar(chars) {
  return chars[Math.floor(Math.random() * chars.length)]
}

function textUnits(text) {
  return Array.from(String(text ?? ''))
}

export function initialScramble(text, chars = DEFAULT_SCRAMBLE_CHARS) {
  const length = typeof text === 'number' ? text : textUnits(text).length
  return Array.from({ length }, () => randomChar(chars)).join('')
}

function createScrambleBuffer(units, chars) {
  return units.map(() => randomChar(chars))
}

function resolveScrambleBuffer(buffer, units, resolvedCount) {
  for (let index = 0; index < resolvedCount; index += 1) {
    buffer[index] = units[index]
  }
  return buffer.join('')
}

function now() {
  return window.performance?.now?.() ?? Date.now()
}

function scheduleFrame(callback) {
  if (typeof window.requestAnimationFrame === 'function') return window.requestAnimationFrame(callback)
  return window.setTimeout(() => callback(now()), 16)
}

function cancelFrame(frame) {
  if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame)
  else window.clearTimeout(frame)
}

export function useScrambleText(
  text,
  {
    enabled = true,
    startDelay = 0,
    duration = 800,
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
    let frame = 0
    let delayFrame = 0
    const units = textUnits(text)
    const fullText = units.join('')
    const scrambleBuffer = createScrambleBuffer(units, chars)

    const update = value => {
      if (mounted) setDisplayText(value)
    }

    if (withdrawing) {
      setPhase('withdrawing')
      setStable(true)
      update(fullText)
      const startedAt = now()
      let lastRemainingCount = units.length
      const tick = timestamp => {
        if (!mounted) return
        const progress = Math.min(1, Math.max(0, (timestamp - startedAt) / Math.max(1, withdrawalDuration)))
        const remainingCount = progress >= 1
          ? 0
          : Math.max(0, Math.ceil((1 - progress) * units.length))
        if (remainingCount !== lastRemainingCount) {
          lastRemainingCount = remainingCount
          update(scrambleBuffer.slice(0, remainingCount).join(''))
        }
        if (progress >= 1) {
          revealedRef.current = false
          setPhase('withdrawn')
          onWithdrawnRef.current?.()
          return
        }
        frame = scheduleFrame(tick)
      }
      frame = scheduleFrame(tick)
      return () => {
        mounted = false
        cancelFrame(frame)
      }
    }

    if (revealedRef.current) {
      setPhase('stable')
      update(fullText)
      setStable(true)
      return undefined
    }

    setPhase('revealing')
    setStable(false)
    update(scrambleBuffer.join(''))

    const reveal = startedAt => {
      let lastResolvedCount = -1
      const tick = timestamp => {
        if (!mounted) return
        const progress = Math.min(1, Math.max(0, (timestamp - startedAt) / Math.max(1, duration)))
        const resolvedCount = progress >= 1 ? units.length : Math.floor(progress * units.length)

        if (progress >= 1) {
          revealedRef.current = true
          if (holdFinalRef.current) {
            update(initialScramble(units.length, chars))
            return
          }
          update(fullText)
          setStable(true)
          setPhase('stable')
          onRevealedRef.current?.()
          return
        }

        if (resolvedCount !== lastResolvedCount) {
          lastResolvedCount = resolvedCount
          update(resolveScrambleBuffer(scrambleBuffer, units, resolvedCount))
        }
        frame = scheduleFrame(tick)
      }
      frame = scheduleFrame(tick)
    }

    const startedAt = now() + Math.max(0, startDelay)
    if (startDelay > 0) {
      const waitForStart = timestamp => {
        if (!mounted) return
        if (timestamp < startedAt) {
          delayFrame = scheduleFrame(waitForStart)
          return
        }
        reveal(startedAt)
      }
      delayFrame = scheduleFrame(waitForStart)
    } else {
      reveal(startedAt)
    }

    return () => {
      mounted = false
      cancelFrame(frame)
      cancelFrame(delayFrame)
    }
  }, [chars, duration, enabled, restartKey, startDelay, text, withdrawing, withdrawalDuration])

  useEffect(() => {
    if (holdFinal) {
      wasHoldingFinalRef.current = true
      return
    }
    if (!wasHoldingFinalRef.current) return
    wasHoldingFinalRef.current = false
    if (!enabled || withdrawing) return
    setDisplayText(String(text ?? ''))
    setStable(true)
    setPhase('stable')
  }, [enabled, holdFinal, text, withdrawing])

  return { displayText, stable, phase }
}
