import type { LocalizedString, WorldLayer } from "../../types"
import { MapCanvas } from "./MapCanvas"
import {
	LAYER_BUTTON_ACTIVE_STYLE,
	LAYER_BUTTON_STYLE,
	LAYER_CHIP_STYLE,
	SCENE_BACKDROP_IMAGE_STYLE,
	SCENE_BACKDROP_STYLE,
	SCENE_BACKDROP_VEIL_STYLE,
	SCENE_STAGE_STYLE,
} from "./styles"
import type { VisibleAnchor } from "./types"

type MapSceneProps = {
	layer: WorldLayer
	layers: WorldLayer[]
	visibleAnchors: VisibleAnchor[]
	selectedId?: string
	localize: (value: LocalizedString) => string
	onSelect: (anchorId: string) => void
	onLayerSelect: (layer: WorldLayer) => void
	isLayerRevealing: boolean
}

export function MapScene({
	layer,
	layers,
	visibleAnchors,
	selectedId,
	localize,
	onSelect,
	onLayerSelect,
	isLayerRevealing,
}: MapSceneProps) {
	const backdropSrc = layer.assetSlots?.base.src

	return (
		<section
			className="world-map-stage"
			style={SCENE_STAGE_STYLE}
			aria-label={localize(layer.label)}
		>
			<div className="world-map-atmosphere" style={SCENE_BACKDROP_STYLE}>
				{backdropSrc ? (
					<img
						src={backdropSrc}
						alt=""
						style={SCENE_BACKDROP_IMAGE_STYLE}
						draggable={false}
					/>
				) : null}
				<div style={SCENE_BACKDROP_VEIL_STYLE} />
			</div>
			<MapCanvas
				layer={layer}
				visibleAnchors={visibleAnchors}
				selectedId={selectedId}
				localize={localize}
				onSelect={onSelect}
				isLayerRevealing={isLayerRevealing}
			/>
			<div
				className="world-map-layer-toggle"
				style={LAYER_CHIP_STYLE}
				aria-label="当前世界层"
			>
				{layers.map((item) => (
					<button
						key={item.id}
						type="button"
						style={{
							...LAYER_BUTTON_STYLE,
							...(item.id === layer.id ? LAYER_BUTTON_ACTIVE_STYLE : null),
						}}
						onClick={() => onLayerSelect(item)}
					>
						{localize(item.label)}
					</button>
				))}
			</div>
		</section>
	)
}
