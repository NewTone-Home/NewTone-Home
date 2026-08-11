import { useScrambleText } from '../hooks/useScrambleText'

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
  const { displayText } = useScrambleText(text, {
    enabled: active,
    startDelay,
    charInterval: Math.max(40, Math.floor(duration / Math.max(1, text.length))),
    scrambleInterval: 40,
    chars: '░▒/\\-_01',
    withdrawing,
    withdrawalDuration,
    onRevealed,
    onWithdrawn,
  })

  return <span>{displayText}</span>
}

export default ScrambleText
