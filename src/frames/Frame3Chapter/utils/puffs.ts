import type { CSSProperties } from "react"
import { PUFF_SWAYS_PX } from "../constants"

export function puffStyle(index: number): CSSProperties {
	return {
		"--puff-sway": PUFF_SWAYS_PX[index] + "px",
	} as CSSProperties
}

export function puffsContainerStyle(q: number): CSSProperties {
	return {
		position: "absolute",
		inset: 0,
		opacity: q,
		transition: "opacity 800ms ease-out",
		pointerEvents: "none",
	}
}
