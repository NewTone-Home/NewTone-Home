import { motion } from "framer-motion"
import { clusterVariants, iconVariants } from "./bloomMotion"
import type { HoverPhase } from "../types"
import { useLanguageStore } from "../../../store/useLanguageStore"
import { useThemeStore } from "../../../store/useThemeStore"

const STYLES = {
	wrap: { display: "flex", gap: 10, alignItems: "center" } as const,
	icon: {
		background: "none",
		border: "none",
		padding: "4px 8px",
		cursor: "pointer",
		fontSize: 16,
		fontFamily: "inherit",
		color: "var(--color-text)",
		opacity: 0,
	} as const,
}

type Props = { phase: HoverPhase }

export function IconCluster({ phase }: Props) {
	const cycleLang = useLanguageStore((s) => s.cycleLang)
	const cycleTheme = useThemeStore((s) => s.cycleTheme)
	const tabIndex = phase === "bloomed" ? 0 : -1

	const handleLang = () => {
		cycleLang()
		console.log("[language] cycled to:", useLanguageStore.getState().lang)
	}

	const handleTheme = () => {
		cycleTheme()
		console.log("[theme] cycled to:", useThemeStore.getState().theme)
	}

	return (
		<motion.div
			style={STYLES.wrap}
			variants={clusterVariants}
			animate={
				phase === "bloomed"
					? "bloomed"
					: phase === "collapsing"
						? "collapsing"
						: "hidden"
			}
			initial="hidden"
		>
			<motion.button
				type="button"
				style={STYLES.icon}
				variants={iconVariants}
				tabIndex={tabIndex}
				aria-label="切换语言"
				onClick={handleLang}
			>
				文
			</motion.button>
			<motion.button
				type="button"
				style={STYLES.icon}
				variants={iconVariants}
				tabIndex={tabIndex}
				aria-label="切换主题"
				onClick={handleTheme}
			>
				◐
			</motion.button>
		</motion.div>
	)
}
