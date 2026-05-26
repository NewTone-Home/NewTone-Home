import { useState } from "react"
import { motion } from "framer-motion"
import { useLanguageStore } from "../../../store/useLanguageStore"
import { characterVariants } from "../motion/characterVariants"
import {
	metaContainerVariants,
	metaItemVariants,
} from "../motion/metaVariants"
import {
	ENTRY_TRIGGER_STYLE,
	SEAL_CHAR_STYLE,
} from "../styles/character"
import {
	META_WRAP_STYLE,
	META_NAME_STYLE,
	META_LABEL_STYLE,
} from "../styles/meta"
import { pickText } from "../utils/pick"
import type { WorldEntry } from "../types"

type Props = {
	entry: WorldEntry
	onSelect: (characterId: string) => void
}

export function CharacterEntry({ entry, onSelect }: Props) {
	const [hover, setHover] = useState(false)
	const lang = useLanguageStore((s) => s.lang)
	const phase = hover ? "active" : "dormant"
	const nameText = pickText(
		typeof entry.character.name === "object"
			? entry.character.name
			: { zh: entry.character.name as string },
		lang,
	)
	return (
		<motion.button
			type="button"
			style={ENTRY_TRIGGER_STYLE}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			onFocus={() => setHover(true)}
			onBlur={() => setHover(false)}
			onClick={() => onSelect(entry.character.id)}
			aria-label={nameText}
			initial="dormant"
			animate={phase}
		>
			<motion.span style={SEAL_CHAR_STYLE} variants={characterVariants}>
				{entry.sealChar}
			</motion.span>
			<motion.div
				style={META_WRAP_STYLE}
				variants={metaContainerVariants}
			>
				<motion.p style={META_NAME_STYLE} variants={metaItemVariants}>
					{nameText}
				</motion.p>
				<motion.p style={META_LABEL_STYLE} variants={metaItemVariants}>
					{pickText(entry.label, lang)}
				</motion.p>
			</motion.div>
		</motion.button>
	)
}
