import type { LocalizedString, WorldLayer } from "../../types"
import { LayerTransition } from "./LayerTransition"
import { MapAnchorOverlay } from "./MapAnchorOverlay"
import { MapLayerRenderer } from "./MapLayerRenderer"
import {
	MAP_CANVAS_CORNER_STYLE,
	MAP_CANVAS_DISK_GLOW_STYLE,
	MAP_CANVAS_STYLE,
	MAP_CANVAS_VIGNETTE_STYLE,
	MAP_VIEWPORT_STYLE,
} from "./styles"
import type { VisibleAnchor } from "./types"

type MapCanvasProps = {
	layer: WorldLayer
	visibleAnchors: VisibleAnchor[]
	selectedId?: string
	localize: (value: LocalizedString) => string
	onSelect: (anchorId: string) => void
	isLayerRevealing: boolean
}

export function MapCanvas({
	layer,
	visibleAnchors,
	selectedId,
	localize,
	onSelect,
	isLayerRevealing,
}: MapCanvasProps) {
	const canvasClassName = [
		"world-map-canvas",
		`world-map-canvas--${layer.id}`,
		isLayerRevealing ? "world-map-canvas--revealing" : "",
	]
		.filter(Boolean)
		.join(" ")

	return (
		<div className="world-map-viewport" style={MAP_VIEWPORT_STYLE}>
			<div className={canvasClassName} style={MAP_CANVAS_STYLE}>
				<MapLayerRenderer layer={layer} />
				<div className="world-map-disk-glow" style={MAP_CANVAS_DISK_GLOW_STYLE} />
				<LayerTransition layer={layer}>
					<MapAnchorOverlay
						anchors={visibleAnchors}
						selectedId={selectedId}
						localize={localize}
						onSelect={onSelect}
					/>
				</LayerTransition>
				<div className="world-map-canvas-vignette" style={MAP_CANVAS_VIGNETTE_STYLE} />
				<div className="world-map-canvas-corners" style={MAP_CANVAS_CORNER_STYLE} />
			</div>
		</div>
	)
}
