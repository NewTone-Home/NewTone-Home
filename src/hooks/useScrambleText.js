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

export function partialScramble(text, resolvedCount, chars = DEFAULT_SCRAMBLE_CHARS) {
  return textUnits(text).map((char, index) => (
    index < resolvedCount ? char : randomChar(chars)
  )).join('')
}

function withdrawingScramble(text, remainingCount, chars) {
  const units = textUnits(text)
  return units.slice(0, remainingCount).map(char => randomChar(chars) || char).join('')
}

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
    let remainingCount = textUnits(text).length
    let scrambleTimer = 0
    let resolveTimer = 0
    let startTimer = 0
    let withdrawalTimer = 0

    const update = value => {
      if (mounted) setDisplayText(value)
    }

    if (withdrawing) {
      setPhase('withdrawing')
      setStable(true)
      update(String(text ?? ''))
      const interval = Math.max(20, Math.floor(withdrawalDuration / Math.max(1, remainingCount)))
      withdrawalTimer = window.setInterval(() => {
        if (!mounted) return
        remainingCount -= 1
        update(remainingCount > 0 ? withdrawingScramble(text, remainingCount, chars) : '')
        if (remainingCount <= 0) {
          window.clearInterval(withdrawalTimer)
          revealedRef.current = false
          setPhase('withdrawn')
          onWithdrawnRef.current?.()
        }
      }, interval)
      return () => {
        mounted = false
        window.clearInterval(withdrawalTimer)
      }
    }

    if (revealedRef.current) {
      setPhase('stable')
      update(String(text ?? ''))
      setStable(true)
      return undefined
    }

    setPhase('revealing')
    setStable(false)
    update(initialScramble(text, chars))

    const resolve = () => {
      scrambleTimer = window.setInterval(() => {
        if (!mounted || resolvedCount >= textUnits(text).length) return
        update(partialScramble(text, resolvedCount, chars))
      }, Math.max(20, scrambleInterval))

      resolveTimer = window.setInterval(() => {
        if (!mounted) return
        resolvedCount += 1
        const unitsLength = textUnits(text).length
        if (resolvedCount >= unitsLength) {
          window.clearInterval(resolveTimer)
          window.clearInterval(scrambleTimer)
          revealedRef.current = true
          if (holdFinalRef.current) {
            update(initialScramble(text, chars))
            return
          }
          update(String(text ?? ''))
          setStable(true)
          setPhase('stable')
          onRevealedRef.current?.()
          return
        }
        update(partialScramble(text, resolvedCount, chars))
      }, Math.max(20, charInterval))
    }

    if (startDelay > 0) startTimer = window.setTimeout(resolve, startDelay)
    else resolve()

    return () => {
      mounted = false
      window.clearTimeout(startTimer)
      window.clearInterval(scrambleTimer)
      window.clearInterval(resolveTimer)
      window.clearInterval(withdrawalTimer)
    }
  }, [charInterval, chars, enabled, restartKey, scrambleInterval, startDelay, text, withdrawing, withdrawalDuration])

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
