import type {
	AssetRef,
	LocalizedString,
	Publishable,
	SoftDeletable,
	Taggable,
	Timestamped,
} from "./common"
import type { MapAnchor, WorldEvent, WorldLayer, WorldRegion } from "./map"

export type World = {
	id: string
	novelId: string
	sharedWithNovelIds?: string[]
	name: LocalizedString
	tagline?: LocalizedString
	description?: LocalizedString
	coverAsset?: AssetRef
	status?: string
	regions?: WorldRegion[]
	layers?: WorldLayer[]
	mapAnchors?: MapAnchor[]
	events?: WorldEvent[]
} & Timestamped &
	SoftDeletable &
	Publishable &
	Taggable
