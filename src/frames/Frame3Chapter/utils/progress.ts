import type { CSSProperties } from "react"
import { CHAR_COLOR } from "../constants"

export function lineProgress(progress: number, index: number): number {
	const start = index / 3
	const end = (index + 1) / 3
	return Math.max(0, Math.min(1, (progress - start) / (end - start)))
}

export function yaoLineTrackStyle(): CSSProperties {
	return {
		width: 24,
		height: 2,
		background: "var(--color-line)",
		opacity: 0.52,
		position: "relative",
		overflow: "visible",
	}
}

export function yaoLineFillStyle(q: number, flaring: boolean): CSSProperties {
	const alpha = flaring ? 0.62 : 0.2 + q * 0.34
	const blur = flaring ? 8 : q * 4
	const glow = "color-mix(in srgb, " + CHAR_COLOR + " " + Math.round(alpha * 100) + "%, transparent)"

	return {
		width: 24,
		height: 2,
		background: CHAR_COLOR,
		opacity: q > 0.01 ? 0.38 + q * 0.44 : 0,
		boxShadow: blur > 0 ? "0 0 " + blur + "px " + glow : "none",
		transform: "scaleX(" + q + ")",
		transformOrigin: "left center",
		transition: flaring
			? "opacity 160ms ease-out, box-shadow 160ms ease-out, transform 120ms linear"
			: "opacity 260ms ease-out, box-shadow 260ms ease-out, transform 120ms linear",
	}
}
