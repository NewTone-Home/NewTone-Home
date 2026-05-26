import { ENTRIES_WRAP_STYLE } from "../styles/character"
import { CharacterEntry } from "./CharacterEntry"
import type { WorldEntry } from "../types"

type Props = {
	entries: WorldEntry[]
	onSelect: (characterId: string) => void
}

export function CharacterEntries({ entries, onSelect }: Props) {
	return (
		<div style={ENTRIES_WRAP_STYLE}>
			{entries.map((entry) => (
				<CharacterEntry
					key={entry.character.id}
					entry={entry}
					onSelect={onSelect}
				/>
			))}
		</div>
	)
}
