import type { EntryDestination, EntryStorageState } from "../../types"

export function decideReturningDestination(
	state: EntryStorageState,
): EntryDestination {
	if (state.deepestLayer === "chapter" && state.lastChapterId) {
		return {
			kind: "multiverse",
			worldId: "first-world",
			regionId: "central-ring",
			layerId: "underside",
			selectedAnchorId: "old-crossing",
		}
	}

	if (state.deepestLayer === "world_hall" && state.lastWorldId) {
		return { kind: "world_hall", worldId: state.lastWorldId }
	}

	return {
		kind: "multiverse",
		worldId: "first-world",
		regionId: "central-ring",
		layerId: "surface",
	}
}
