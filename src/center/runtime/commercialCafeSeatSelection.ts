import { mainlineScenes } from './mainlineScenes'
import type { MainlineSceneDefinition } from './mainlineScenes'

export const defaultLaoZhouCafeSeatId = 'commercial-cafe-right-window-upper-group-chair-top'
const eligibleCafeSeatGroupIds = new Set([
  'commercial-cafe-right-window-upper-group',
  ...Array.from({ length: 6 }, (_, index) => `cafe-trial-table-group-${index + 1}`),
])

type CafeSeat = NonNullable<(typeof mainlineScenes)['commercial-cafe']['objects'][number]['seat']> & {
  id: string
}

function cafeSeats() {
  return mainlineScenes['commercial-cafe'].objects
    .filter((entity) => entity.kind === 'seat' && entity.seat && eligibleCafeSeatGroupIds.has(entity.groupId ?? ''))
    .map((entity) => ({ ...entity.seat!, id: entity.id }))
}

/** Returns only complete, two-chair Cafe table pairs that exist in the authored scene. */
export function laoZhouCafeSeatPairs() {
  const seats = cafeSeats()
  const groups = new Map<string, CafeSeat[]>()
  for (const seat of seats) groups.set(seat.tableId, [...(groups.get(seat.tableId) ?? []), seat])
  return [...groups.values()]
    .filter((pair) => pair.length === 2 && pair[0]!.id !== pair[1]!.id)
    .map((pair) => [pair[0]!, pair[1]!] as const)
}

export function isLaoZhouCafeSeatId(value: unknown): value is string {
  return typeof value === 'string' && laoZhouCafeSeatPairs().some((pair) => pair.some((seat) => seat.id === value))
}

export function laoZhouCafeConversationSeatId(laoZhouSeatId: string): string {
  return laoZhouCafeSeatPairs().find((pair) => pair.some((seat) => seat.id === laoZhouSeatId))
    ?.find((seat) => seat.id !== laoZhouSeatId)?.id
    ?? 'commercial-cafe-right-window-upper-group-chair-bottom'
}

export function selectLaoZhouCafeSeat(random: () => number = Math.random): string {
  const pairs = laoZhouCafeSeatPairs()
  const candidates = pairs.flatMap((pair) => pair.map((seat) => seat.id))
  if (!candidates.length) return defaultLaoZhouCafeSeatId
  const sample = random()
  const index = Number.isFinite(sample) ? Math.min(candidates.length - 1, Math.max(0, Math.floor(sample * candidates.length))) : 0
  return candidates[index] ?? defaultLaoZhouCafeSeatId
}

export function withLaoZhouCafeSeat(scene: MainlineSceneDefinition, laoZhouSeatId: string): MainlineSceneDefinition {
  const validSeat = scene.objects.some((entity) => entity.kind === 'seat' && entity.id === laoZhouSeatId && entity.seat)
  const seatId = validSeat ? laoZhouSeatId : defaultLaoZhouCafeSeatId
  return {
    ...scene,
    npcBehaviors: scene.npcBehaviors?.map((behavior) => behavior.npcId === 'lao-zhou'
      ? { ...behavior, targetId: seatId }
      : behavior),
  }
}

/** Ruoyu joins the existing Cafe only after the persisted SMS unlock. */
export function withRuoyuCafeSeat(scene: MainlineSceneDefinition, ruoyuSeatId: string | null, unlocked: boolean): MainlineSceneDefinition {
  const npcs = scene.npcs.filter(npc => npc.id !== 'ruoyu')
  const behaviors = (scene.npcBehaviors ?? []).filter(behavior => behavior.npcId !== 'ruoyu')
  const legalSeat = ruoyuSeatId && scene.objects.some(entity => entity.id === ruoyuSeatId && entity.kind === 'seat' && entity.seat)
  if (!unlocked || !legalSeat) return { ...scene, npcs, npcBehaviors: behaviors }
  return {
    ...scene,
    npcs: [...npcs, { id: 'ruoyu', roleId: 'ruoyu', label: '若雨', roomId: 'commercial-north-cafe-interior', interactive: true }],
    npcBehaviors: [...behaviors, { npcId: 'ruoyu', dutyId: 'ruoyu.seated', targetId: ruoyuSeatId, targetKind: 'seat' }],
  }
}
