export function isUnresolvedNarrativeDelivery(delivery) {
  if (delivery?.holdFuture) return true
  if (delivery === 'pending') return true
  if (delivery?.type === 'pause') return delivery.state === 'pending'
  if (delivery?.type === 'reveal') return delivery.state !== 'confirmed'
  if (delivery?.type === 'typewriter') return delivery.state !== 'completed'
  return false
}

export function getLocalNarrativeGateBeatIndex({ beats, focusBeatIndex, deliveryStates }) {
  return beats.findIndex((beat, beatIndex) => (
    beatIndex >= focusBeatIndex
    && beat.blocks.some(block => isUnresolvedNarrativeDelivery(deliveryStates[`${beat.id}:${block.id}`]))
  ))
}
