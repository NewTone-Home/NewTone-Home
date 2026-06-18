import type { CSSProperties } from "react"
import type { ChapterParagraphType } from "../../../types/chapter"

const PARA_OPEN: CSSProperties = {
	fontSize: 26,
	marginBottom: "28vh",
	textAlign: "center",
}

const PARA_NARRATE: CSSProperties = {
	fontSize: 18,
	marginBottom: "1.5em",
}

const PARA_KEY: CSSProperties = {
	fontSize: 22,
	marginBottom: "22vh",
	fontStyle: "italic",
}

const PARA_THOUGHT: CSSProperties = {
	fontSize: 18,
	marginBottom: "14vh",
	color: "var(--color-muted)",
}

const PARA_DIALOGUE: CSSProperties = {
	fontSize: 22,
	marginBottom: "14vh",
}

const PARA_PAUSE: CSSProperties = {
	fontSize: 22,
	marginBottom: "25vh",
	textAlign: "center",
	color: "var(--color-muted)",
}

export const DRAMATIC_TYPES: ChapterParagraphType[] = ["open", "key", "pause"]

function paragraphBase(type: ChapterParagraphType): CSSProperties {
	if (type === "open") return PARA_OPEN
	if (type === "narrate") return PARA_NARRATE
	if (type === "key") return PARA_KEY
	if (type === "thought") return PARA_THOUGHT
	if (type === "dialogue") return PARA_DIALOGUE
	return PARA_PAUSE
}

export function paragraphStyle(
	type: ChapterParagraphType,
	opacity: number,
	translateY: number,
): CSSProperties {
	return Object.assign({}, paragraphBase(type), {
		opacity,
		transform: "translateY(" + translateY + "px)",
		transition: "opacity 120ms linear, transform 120ms linear",
	})
}
