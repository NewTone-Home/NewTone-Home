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
    duration,
    chars: '░▒/\\-_01',
    withdrawing,
    withdrawalDuration,
    onRevealed,
    onWithdrawn,
  })

  return <span>{displayText}</span>
}

export default ScrambleText
