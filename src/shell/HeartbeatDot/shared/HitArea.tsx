import type { CSSProperties, ReactNode } from "react"
import { HIT_AREA_PX } from "./breathConfig"

const HIT_AREA_BASE: CSSProperties = {
	position: "fixed",
	right: 16,
	bottom: 16,
	width: HIT_AREA_PX,
	height: HIT_AREA_PX,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	zIndex: 100,
}

const HIT_AREA_NON_INTERACTIVE: CSSProperties = {
	...HIT_AREA_BASE,
	pointerEvents: "none",
}

const HIT_AREA_INTERACTIVE: CSSProperties = {
	...HIT_AREA_BASE,
	pointerEvents: "auto",
	cursor: "default",
}

type Props = {
	children: ReactNode
	interactive: boolean
	onMouseEnter?: () => void
	onMouseLeave?: () => void
}

export function HitArea({ children, interactive, onMouseEnter, onMouseLeave }: Props) {
	return (
		<div
			style={interactive ? HIT_AREA_INTERACTIVE : HIT_AREA_NON_INTERACTIVE}
			onMouseEnter={interactive ? onMouseEnter : undefined}
			onMouseLeave={interactive ? onMouseLeave : undefined}
		>
			{children}
		</div>
	)
}
