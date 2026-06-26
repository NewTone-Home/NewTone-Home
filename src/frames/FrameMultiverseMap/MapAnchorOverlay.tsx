import type { LocalizedString, WorldManifestation } from "../../types"
import {
	ANCHOR_OVERLAY_STYLE,
	NODE_DOT_ANOMALY_STYLE,
	NODE_DOT_GHOST_STYLE,
	NODE_DOT_HUB_STYLE,
	NODE_DOT_LOCKED_STYLE,
	NODE_DOT_STYLE,
	NODE_LABEL_HUB_STYLE,
	NODE_LABEL_STYLE,
	NODE_STYLE,
	NODE_SUBTITLE_STYLE,
	NODE_TITLE_STYLE,
} from "./styles"
import type { VisibleAnchor } from "./types"

type MapAnchorOverlayProps = {
	anchors: VisibleAnchor[]
	selectedId?: string
	localize: (value: LocalizedString) => string
	onSelect: (anchorId: string) => void
}

function nodeDotStyle(manifestation: WorldManifestation) {
	if (manifestation.type === "hub" || manifestation.type === "main-hub") {
		return NODE_DOT_HUB_STYLE
	}
	if (manifestation.id === "ghost-market") return NODE_DOT_GHOST_STYLE
	if (manifestation.type === "anomaly") return NODE_DOT_ANOMALY_STYLE
	if (manifestation.status === "locked") return NODE_DOT_LOCKED_STYLE
	return null
}

function nodeClassName(
	anchorId: string,
	manifestation: WorldManifestation,
	selectedId?: string,
) {
	return [
		"map-anchor-node",
		`map-anchor-node--${manifestation.type}`,
		anchorId === selectedId ? "map-anchor-node--selected" : "",
		anchorId === "old-crossing" && manifestation.action === "switchLayer"
			? "map-anchor-node--old-crossing"
			: "",
		manifestation.id === "ghost-market" ? "map-anchor-node--ghost-market" : "",
	]
		.filter(Boolean)
		.join(" ")
}

function statusLabel(status: string) {
	if (status === "available") return "已开放"
	if (status === "unstable") return "信号不稳定"
	if (status === "hidden") return "隐藏"
	return "暂未开放"
}

export function MapAnchorOverlay({
	anchors,
	selectedId,
	localize,
	onSelect,
}: MapAnchorOverlayProps) {
	return (
		<div className="map-anchor-overlay" style={ANCHOR_OVERLAY_STYLE}>
			{anchors.map(({ anchor, manifestation }) => (
				<button
					key={manifestation.id}
					type="button"
					className={nodeClassName(anchor.id, manifestation, selectedId)}
					style={{
						...NODE_STYLE,
						left: `${anchor.position.x}%`,
						top: `${anchor.position.y}%`,
					}}
					onClick={() => onSelect(anchor.id)}
					aria-pressed={selectedId === anchor.id}
				>
					<span
						style={{
							...NODE_DOT_STYLE,
							...nodeDotStyle(manifestation),
						}}
						aria-hidden="true"
					/>
					<span className="map-anchor-connector" aria-hidden="true" />
					<span
						className="world-map-node-label"
						style={{
							...NODE_LABEL_STYLE,
							...(manifestation.type === "hub" ||
							manifestation.type === "main-hub"
								? NODE_LABEL_HUB_STYLE
								: null),
						}}
					>
						<span style={NODE_TITLE_STYLE}>{localize(manifestation.title)}</span>
						<span style={NODE_SUBTITLE_STYLE}>
							{manifestation.subtitle
								? localize(manifestation.subtitle)
								: statusLabel(manifestation.status)}
						</span>
						{manifestation.action === "switchLayer" ? (
							<span className="map-anchor-action">查看另一面</span>
						) : null}
					</span>
				</button>
			))}
		</div>
	)
}
