// Product choice confirmed on 2026-11-07. Keep policy separate from storage
// format so changing capacity later never migrates or discards existing saves.
export const PLAYER_ACCOUNT_SLOT_LIMIT = 3;

export function canCreatePlayerSaveSlot({ slots }) {
  if (!Array.isArray(slots)) throw Error('PLAYER_SLOT_LIST_REQUIRED');
  return slots.length < PLAYER_ACCOUNT_SLOT_LIMIT;
}
