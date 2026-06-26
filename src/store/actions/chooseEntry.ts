import { readStorage, writeStorage } from "../../lib/storage"
import type {
	EntryChoice,
	EntryDestination,
	EntryStorageState,
} from "../../types"
import type { Setter } from "../types"

export function createChooseFirstEntryAction(set: Setter) {
	return (choice: EntryChoice) => {
		const destination: EntryDestination =
			choice === "linear"
				? {
						kind: "multiverse",
						worldId: "first-world",
						regionId: "central-ring",
						layerId: "surface",
						selectedAnchorId: "central-court",
				  }
				: {
						kind: "multiverse",
						worldId: "first-world",
						regionId: "central-ring",
						layerId: "underside",
						selectedAnchorId: "old-crossing",
				  }

		const patch: Partial<EntryStorageState> = { entryChoice: choice }
		if (destination.kind === "multiverse") {
			patch.deepestLayer = "multiverse"
		}

		const current = readStorage()
		writeStorage({ ...current, ...patch })

		set({ destination })
	}
}
