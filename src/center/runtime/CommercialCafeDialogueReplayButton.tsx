import './CommercialCafeDialogueReplayButton.css'

export function CommercialCafeDialogueReplayButton({ visible, disabled = false, onReplay }: {
  visible: boolean
  disabled?: boolean
  onReplay: () => void
}) {
  if (!visible) return null
  return <button type="button" className="commercial-cafe-dialogue-replay-button"
    data-commercial-cafe-dialogue-replay="true" aria-label="重播老周对白"
    disabled={disabled} onClick={onReplay}>重播对白</button>
}