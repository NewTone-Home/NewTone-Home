import type { WorldLayer } from "../../types"
import {
	ASSET_ATMOSPHERE_SURFACE_STYLE,
	ASSET_ATMOSPHERE_UNDERSIDE_STYLE,
	ASSET_BASE_SURFACE_STYLE,
	ASSET_BASE_UNDERSIDE_STYLE,
	ASSET_DETAIL_SURFACE_STYLE,
	ASSET_DETAIL_UNDERSIDE_STYLE,
	ASSET_IMAGE_STYLE,
	ASSET_INTERACTION_SURFACE_STYLE,
	ASSET_INTERACTION_UNDERSIDE_STYLE,
	ASSET_LAYER_STYLE,
} from "./styles"

type MapAssetLayersProps = {
	layer: WorldLayer
}

function assetStyle(layerId: string, slot: keyof NonNullable<WorldLayer["assetSlots"]>) {
	const isUnderside = layerId === "underside"
	if (slot === "base") {
		return isUnderside ? ASSET_BASE_UNDERSIDE_STYLE : ASSET_BASE_SURFACE_STYLE
	}
	if (slot === "detail") {
		return isUnderside ? ASSET_DETAIL_UNDERSIDE_STYLE : ASSET_DETAIL_SURFACE_STYLE
	}
	if (slot === "atmosphere") {
		return isUnderside
			? ASSET_ATMOSPHERE_UNDERSIDE_STYLE
			: ASSET_ATMOSPHERE_SURFACE_STYLE
	}
	return isUnderside
		? ASSET_INTERACTION_UNDERSIDE_STYLE
		: ASSET_INTERACTION_SURFACE_STYLE
}

export function MapAssetLayers({ layer }: MapAssetLayersProps) {
	const slots: Array<keyof NonNullable<WorldLayer["assetSlots"]>> = [
		"base",
		"detail",
		"atmosphere",
		"interactionOverlay",
	]

	return (
		<>
			{slots.map((slot) => {
				const asset = layer.assetSlots?.[slot]
				const shouldRenderImage = slot === "base" && Boolean(asset?.src)
				return (
					<div
						key={slot}
						className={`map-asset-layer map-asset-${slot}`}
						data-asset-slot={slot}
						data-asset-src={asset?.src}
						data-placeholder={asset?.placeholder}
						style={{
							...ASSET_LAYER_STYLE,
							...assetStyle(layer.id, slot),
						}}
						aria-hidden="true"
					>
						{shouldRenderImage ? (
							<img
								src={asset?.src}
								alt=""
								className="map-asset-base-image"
								style={ASSET_IMAGE_STYLE}
								draggable={false}
							/>
						) : null}
					</div>
				)
			})}
		</>
	)
}
