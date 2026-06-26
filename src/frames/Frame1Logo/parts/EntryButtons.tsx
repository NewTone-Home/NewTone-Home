import { motion } from "framer-motion"
import type { MouseEvent } from "react"
import { useEntryStore } from "../../../store"
import {
	buttonHintStyle,
	buttonLabelStyle,
	buttonStyle,
	buttonsRowStyle,
} from "../styles/buttons"
import {
	buttonsAnimate,
	buttonsExit,
	buttonsInitial,
} from "../motion/buttonsVariants"

function handleHoverEnter(e: MouseEvent<HTMLButtonElement>) {
	e.currentTarget.style.background = "rgba(238, 248, 248, 0.92)"
	e.currentTarget.style.color = "#071017"
}

function handleHoverLeave(e: MouseEvent<HTMLButtonElement>) {
	e.currentTarget.style.background = "transparent"
	e.currentTarget.style.color = "#eef8f8"
}

export function EntryButtons() {
	const chooseFirstEntry = useEntryStore((s) => s.chooseFirstEntry)

	function onLinear(e: MouseEvent<HTMLButtonElement>) {
		e.stopPropagation()
		chooseFirstEntry("linear")
	}

	function onGhostMarket(e: MouseEvent<HTMLButtonElement>) {
		e.stopPropagation()
		chooseFirstEntry("free_explore")
	}

	return (
		<motion.div
			key="buttons"
			className="entry-buttons-row"
			initial={buttonsInitial}
			animate={buttonsAnimate}
			exit={buttonsExit}
			style={buttonsRowStyle}
		>
			<button
				onClick={onLinear}
				style={buttonStyle}
				onMouseEnter={handleHoverEnter}
				onMouseLeave={handleHoverLeave}
			>
				<span style={buttonLabelStyle}>从头开始</span>
				<span style={buttonHintStyle}>进入第一世界：中枢环区</span>
			</button>
			<button
				onClick={onGhostMarket}
				style={buttonStyle}
				onMouseEnter={handleHoverEnter}
				onMouseLeave={handleHoverLeave}
			>
				<span style={buttonLabelStyle}>当前开放：鬼市</span>
				<span style={buttonHintStyle}>进入里世界番外事件</span>
			</button>
		</motion.div>
	)
}
