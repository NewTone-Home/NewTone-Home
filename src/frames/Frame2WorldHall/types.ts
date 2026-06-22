import type { Character, Chapter, LocalizedString } from "../../types"

export type Frame2WorldHallProps = {
	worldId: string
}

export type WorldEntry = {
	character: Character
	sealChar: string
	label: LocalizedString
}

export type WorldHallData = {
	worldName: LocalizedString
	worldTagline?: LocalizedString
	entries: WorldEntry[]
	chapters: Chapter[]
}
