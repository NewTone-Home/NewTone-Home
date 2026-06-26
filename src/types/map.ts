import type { LocalizedString } from "./common"

export type WorldLayerId = "surface" | "underside" | string

export type WorldRegion = {
	id: string
	title: LocalizedString
	subtitle?: LocalizedString
	description?: LocalizedString
	layers: WorldLayer[]
	mapAnchors: MapAnchor[]
	events: WorldEvent[]
}

export type WorldLayer = {
	id: WorldLayerId
	label: LocalizedString
	description?: LocalizedString
	visualState?: string
	assetSlots?: MapAssetSlots
}

export type MapAssetSlot = {
	src?: string
	placeholder: string
}

export type MapAssetSlots = {
	base: MapAssetSlot
	detail: MapAssetSlot
	atmosphere: MapAssetSlot
	interactionOverlay: MapAssetSlot
}

export type ManifestationStatus =
	| "available"
	| "locked"
	| "unstable"
	| "completed"
	| "hidden"

export type ManifestationType =
	| "main"
	| "main-hub"
	| "side"
	| "extra"
	| "anomaly"
	| "hub"

export type WorldManifestation = {
	id: string
	layerId: WorldLayerId
	title: LocalizedString
	subtitle?: LocalizedString
	type: ManifestationType
	status: ManifestationStatus
	description?: LocalizedString
	eventIds: string[]
	action?: "switchLayer" | "enterEvent" | "none"
	targetLayerId?: WorldLayerId
}

export type MapAnchor = {
	id: string
	position: { x: number; y: number }
	manifestations: Record<string, WorldManifestation | undefined>
}

export type WorldEventType = "main" | "side" | "extra"
export type WorldEventStatus =
	| "available"
	| "locked"
	| "comingSoon"
	| "completed"

export type WorldEvent = {
	id: string
	anchorId: string
	manifestationId: string
	type: WorldEventType
	status: WorldEventStatus
	title: LocalizedString
	subtitle?: LocalizedString
	entryLabel: LocalizedString
	readerTarget: string
	order: number
	recommended?: boolean
}
