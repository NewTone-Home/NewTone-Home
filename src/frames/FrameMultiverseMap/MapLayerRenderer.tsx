import type { WorldLayer } from "../../types"
import { LayerTransition } from "./LayerTransition"
import { MapAssetLayers } from "./MapAssetLayers"

type MapLayerRendererProps = {
	layer: WorldLayer
}

export function MapLayerRenderer({ layer }: MapLayerRendererProps) {
	return (
		<LayerTransition layer={layer}>
			<MapAssetLayers layer={layer} />
		</LayerTransition>
	)
}
