import { motion } from "framer-motion"
import { useLanguageStore } from "../../../store/useLanguageStore"
import { titleVariants } from "../motion/titleVariants"
import {
	TITLE_WRAP_STYLE,
	TITLE_TEXT_STYLE,
	TITLE_TAGLINE_STYLE,
} from "../styles/title"
import { pickText } from "../utils/pick"
import type { LocalizedString } from "../../../types"

type Props = {
	name: LocalizedString
	tagline?: LocalizedString
}

export function WorldTitle({ name, tagline }: Props) {
	const lang = useLanguageStore((s) => s.lang)
	return (
		<motion.div
			style={TITLE_WRAP_STYLE}
			variants={titleVariants}
			initial="hidden"
			animate="visible"
		>
			<h1 style={TITLE_TEXT_STYLE}>{pickText(name, lang)}</h1>
			{tagline && (
				<p style={TITLE_TAGLINE_STYLE}>{pickText(tagline, lang)}</p>
			)}
		</motion.div>
	)
}
