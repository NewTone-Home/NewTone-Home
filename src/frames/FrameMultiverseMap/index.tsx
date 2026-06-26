import { useEffect, useRef, useState } from "react"
import { defaultAdapter } from "../../content"
import { useLocalized } from "../../i18n/useLocalized"
import { useEntryStore } from "../../store/useEntryStore"
import type { WorldLayer } from "../../types"
import { LocationPanel } from "./LocationPanel"
import { MapScene } from "./MapScene"
import {
	CONTAINER_STYLE,
	HEADER_STYLE,
	KICKER_STYLE,
	OBJECTIVE_LINE_STYLE,
	OBJECTIVE_STYLE,
	SHELL_STYLE,
	SUBTITLE_STYLE,
	TITLE_STYLE,
} from "./styles"
import type { VisibleAnchor } from "./types"

type FrameMultiverseMapProps = {
	worldId?: string
	regionId?: string
	initialLayerId?: string
	initialAnchorId?: string
}

function layerHudCopy(layerId: string) {
	if (layerId === "underside") {
		return {
			subtitle: "里层显现中；鬼市已开放。",
			objective: "显现坐标：鬼市",
			action: "当前事件：已开放",
		}
	}

	return {
		subtitle: "表层记录运行中；旧街口出现可进入暗层的异常。",
		objective: "异常坐标：旧街口",
		action: "暗层显现：可读取",
	}
}

export function FrameMultiverseMap({
	worldId = "first-world",
	regionId = "central-ring",
	initialLayerId = "surface",
	initialAnchorId,
}: FrameMultiverseMapProps) {
	const tr = useLocalized()
	const goTo = useEntryStore((s) => s.goTo)
	const world = defaultAdapter.getWorldById(worldId)
	const region =
		world?.regions?.find((item) => item.id === regionId) ??
		(world
			? {
					id: regionId,
					title: world.name,
					description: world.description,
					layers: world.layers ?? [],
					mapAnchors: world.mapAnchors ?? [],
					events: world.events ?? [],
				}
			: undefined)
	const layers = region?.layers ?? []
	const events = region?.events ?? []
	const anchors = region?.mapAnchors ?? []
	const [activeLayerId, setActiveLayerId] = useState(initialLayerId)
	const activeLayer =
		layers.find((layer) => layer.id === activeLayerId) ?? layers[0]
	const initialAnchor =
		anchors.find((anchor) => anchor.id === initialAnchorId) ??
		anchors.find((anchor) =>
			Object.values(anchor.manifestations).some(
				(manifestation) => manifestation?.id === initialAnchorId,
			),
		) ??
		anchors.find((anchor) => anchor.id === "central-court") ??
		anchors[0]
	const [selectedAnchorId, setSelectedAnchorId] = useState<string | undefined>(
		initialAnchor?.id,
	)
	const [isLayerRevealing, setIsLayerRevealing] = useState(false)
	const revealTimerRef = useRef<number | undefined>(undefined)

	useEffect(() => {
		return () => {
			if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current)
		}
	}, [])

	if (!world || !region || !activeLayer) return null

	const activeWorldId = world.id
	const activeRegionId = region.id
	const hudCopy = layerHudCopy(activeLayer.id)

	const visibleAnchors: VisibleAnchor[] = []
	for (const anchor of anchors) {
		const manifestation = anchor.manifestations[activeLayer.id]
		if (!manifestation || manifestation.status === "hidden") continue
		visibleAnchors.push({ anchor, manifestation })
	}

	const selected =
		visibleAnchors.find(
			(item) => item.anchor.id === selectedAnchorId,
		) ??
		visibleAnchors.find((item) => item.manifestation.status === "available") ??
		visibleAnchors[0]
	const selectedEvents = selected
		? events
				.filter((event) => selected.manifestation.eventIds.includes(event.id))
				.sort((a, b) => a.order - b.order)
		: []

	function switchLayer(layer: WorldLayer, keepAnchorId?: string) {
		const isChangingLayer = layer.id !== activeLayerId
		if (isChangingLayer) {
			if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current)
			setIsLayerRevealing(true)
			revealTimerRef.current = window.setTimeout(() => {
				setIsLayerRevealing(false)
			}, 680)
		}
		setActiveLayerId(layer.id)
		const nextAnchor =
			anchors.find((anchor) => anchor.id === keepAnchorId) ??
			anchors.find(
				(anchor) => anchor.manifestations[layer.id]?.status === "available",
			) ??
			anchors[0]
		setSelectedAnchorId(nextAnchor?.id)
	}

	function handlePrimaryAction() {
		if (!selected) return
		const { anchor, manifestation } = selected
		if (manifestation.action === "switchLayer" && manifestation.targetLayerId) {
			const nextLayer = layers.find(
				(layer) => layer.id === manifestation.targetLayerId,
			)
			if (nextLayer) switchLayer(nextLayer, anchor.id)
			return
		}

		const event = selectedEvents.find((item) => item.status === "available")
		if (!event) return
		goTo({
			kind: "chapter",
			chapterId: event.readerTarget,
			eventId: event.id,
			returnTo: {
				kind: "multiverse",
				worldId: activeWorldId,
				regionId: activeRegionId,
				layerId: activeLayer.id,
				selectedAnchorId: anchor.id,
			},
		})
	}

	return (
		<main style={CONTAINER_STYLE}>
			<div className="world-map-shell" style={SHELL_STYLE}>
				<header style={HEADER_STYLE}>
					<p style={KICKER_STYLE}>NEWTONE MAP SCENE</p>
					<h1 style={TITLE_STYLE}>{tr(region.title)}</h1>
					<p style={SUBTITLE_STYLE}>{hudCopy.subtitle}</p>
					<div style={OBJECTIVE_STYLE} aria-label="当前目标">
						<span style={OBJECTIVE_LINE_STYLE}>{hudCopy.objective}</span>
						<span style={OBJECTIVE_LINE_STYLE}>{hudCopy.action}</span>
					</div>
				</header>
				<MapScene
					layer={activeLayer}
					layers={layers}
					visibleAnchors={visibleAnchors}
					selectedId={selected?.anchor.id}
					localize={tr}
					onSelect={setSelectedAnchorId}
					onLayerSelect={(layer) => switchLayer(layer)}
					isLayerRevealing={isLayerRevealing}
				/>
				<LocationPanel
					layer={activeLayer}
					selected={selected}
					events={selectedEvents}
					localize={tr}
					onPrimaryAction={handlePrimaryAction}
				/>
			</div>
		</main>
	)
}
