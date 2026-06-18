import type { CSSProperties } from "react"
import { CHAR_COLOR } from "../constants"

export function lineProgress(progress: number, index: number): number {
	const start = index / 3
	const end = (index + 1) / 3
	return Math.max(0, Math.min(1, (progress - start) / (end - start)))
}

export function yaoLineStyle(q: number, flaring: boolean): CSSProperties {
	const opacity = 0.15 + q * 0.5
	const blur = flaring ? 16 : q * 6
	const alpha = flaring ? 1 : q * 0.5
	const glow = "color-mix(in srgb, " + CHAR_COLOR + " " + Math.round(alpha * 100) + "%, transparent)"

	return {
		width: 24,
		height: 2,
		background: q > 0.01 ? CHAR_COLOR : "var(--color-fg)",
		opacity,
		boxShadow: blur > 0 ? "0 0 " + blur + "px " + glow : "none",
		transition: flaring
			? "opacity 200ms ease-out, box-shadow 200ms ease-out"
			: "opacity 600ms ease-out, background 600ms, box-shadow 400ms ease-out",
		position: "relative",
		transformOrigin: "left center",
	}
}
