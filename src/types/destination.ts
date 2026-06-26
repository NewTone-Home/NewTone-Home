export type EntryDestination =
	| { kind: "full_logo" }
	| { kind: "transient_logo"; next: EntryDestination }
	| { kind: "world_hall"; worldId: string }
	| {
			kind: "multiverse"
			worldId?: string
			regionId?: string
			layerId?: string
			selectedAnchorId?: string
			selectedLocationId?: string
	  }
	| {
			kind: "chapter"
			chapterId: string
			eventId?: string
			returnTo?: EntryDestination
	  }
