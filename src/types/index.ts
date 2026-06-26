// Barrel 导出 — 让别处一行 import 拿到所有类型

export type {
  LocalizedString,
  Timestamped,
  SoftDeletable,
  Publishable,
  Taggable,
  AssetRef,
} from "./common"

export type { Novel } from "./novel"
export type { World } from "./world"
export type { Arc } from "./arc"
export type { Chapter } from "./chapter"
export type { Character } from "./character"
export type { Asset, AssetType } from "./asset"
export type {
	MapAnchor,
	MapAssetSlot,
	MapAssetSlots,
	ManifestationStatus,
	ManifestationType,
	WorldManifestation,
	WorldEvent,
	WorldEventStatus,
	WorldEventType,
	WorldLayer,
	WorldLayerId,
	WorldRegion,
} from "./map"

export type {
  EntryChoice,
  DeepestLayer,
  EntryStorageState,
  WorldProgress,
  ReaderPreferences,
} from "./storage"

export { STORAGE_KEY, CURRENT_SCHEMA_VERSION } from "./storage"

export type { EntryDestination } from "./destination"
