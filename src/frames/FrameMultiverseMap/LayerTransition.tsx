import type { ReactNode } from "react"
import type { WorldLayer } from "../../types"
import {
	LAYER_FRAME_STYLE,
	LAYER_FRAME_UNDERSIDE_STYLE,
} from "./styles"

type LayerTransitionProps = {
	layer: WorldLayer
	children: ReactNode
}

export function LayerTransition({ layer, children }: LayerTransitionProps) {
	const isUnderside = layer.id === "underside"

	return (
		<div
			key={layer.id}
			className="map-layer-transition"
			style={{
				...LAYER_FRAME_STYLE,
				...(isUnderside ? LAYER_FRAME_UNDERSIDE_STYLE : null),
			}}
		>
			{children}
		</div>
	)
}
