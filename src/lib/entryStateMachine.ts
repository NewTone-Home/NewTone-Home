import { FEATURED_WORLD_ID } from "../config/worlds"
import type { EntryDestination, EntryStorageState } from "../types/entry"
import { hasAnyTrace } from "./entryStorage"

export function computeEntryDestination(state: EntryStorageState): EntryDestination {
  if (!hasAnyTrace(state)) {
    return { kind: "logo_full" }
  }
  const next = resolveReturnDestination(state)
  return { kind: "logo_transient", next }
}

function resolveReturnDestination(state: EntryStorageState): EntryDestination {
  const lastWorldId = state.lastVisitedWorld
  if (lastWorldId && state.worldProgress?.[lastWorldId]) {
    const wp = state.worldProgress[lastWorldId]
    if (wp.deepestLayer === "world_hall" || wp.deepestLayer === "chapter") {
      return { kind: "world_hall", worldId: lastWorldId }
    }
  }
  return { kind: "multiverse" }
}

export function destinationForFirstChoice(
  choice: "linear" | "free_explore",
): EntryDestination {
  if (choice === "linear") {
    return { kind: "world_hall", worldId: FEATURED_WORLD_ID }
  }
  return { kind: "multiverse" }
}
